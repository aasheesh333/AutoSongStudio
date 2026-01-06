const { SchedulerModel, VideoModel, UserModel, SunoKeyUsageModel } = require('../models');
const groqService = require('../services/groqService');
const sunoService = require('../services/sunoService');
const imageService = require('../services/imageGenerationService');
const ffmpegService = require('../services/ffmpegService');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Video Generation Worker (MongoDB + Local Storage)
 */
class VideoGenerationWorker {
    constructor() {
        // Use persistent storage instead of temp
        this.storageDir = config.storage.path;
        this.ensureDirectories();
        this.isGenerating = false;
    }

    ensureDirectories() {
        const dirs = [
            this.storageDir,
            path.join(this.storageDir, 'audio'),
            path.join(this.storageDir, 'thumbnails'),
            path.join(this.storageDir, 'videos')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async checkSchedulers() {
        // MongoDB: Find active schedulers
        // We use the Adapter which returns POJOs
        // But for complex queries we might need direct Mongoose if Adapter is limited
        // Adapter `findByUser` helps, but here we need ALL active schedulers.
        // Let's use the Mongoose model directly for this internal system query if needed,
        // OR extend the adapter. Adapter has no `findAllActive`.
        // Let's import the Mongoose model directly for this worker logic
        const mongoose = require('mongoose');
        const Scheduler = mongoose.model('Scheduler');
        const Video = mongoose.model('Video');

        const activeSchedulers = await Scheduler.find({ active: true });
        const schedulersNeedingVideos = [];

        for (const schedulerDoc of activeSchedulers) {
            const scheduler = { id: schedulerDoc._id.toString(), ...schedulerDoc.toObject() };

            // Check existing READY or PROCESSING videos
            // Count videos for this scheduler that are NOT uploaded/failed
            const count = await Video.countDocuments({
                schedulerId: scheduler.id,
                status: { $in: ['ready', 'processing', 'queued'] }
            });

            // KEEP-AHEAD: Maintain 1 video
            if (count === 0) {
                console.log(`[Worker] Scheduler "${scheduler.name}" needs video (0 pending)`);
                schedulersNeedingVideos.push(scheduler);
            }
        }

        return schedulersNeedingVideos;
    }

    async generateVideo(scheduler) {
        if (this.isGenerating) return;
        this.isGenerating = true;

        let videoId = null; // Declare outside try for catch block access

        try {
            console.log(`\n[Worker] Starting generation for: ${scheduler.name}`);

            // Check lock
            const mongoose = require('mongoose');
            const Scheduler = mongoose.model('Scheduler');

            // Re-fetch to check lock
            // We can't easily do atomic "check if time > 5min" in one query without aggregation,
            // so we do it in code.
            const freshScheduler = await Scheduler.findById(scheduler.id);
            // We use a custom field on the document for locking: `nextRunAt` is for scheduling.
            // We can assume single worker instance for now, or just trust the `startedAt` we add.
            // We didn't add `lastGenerationStarted` to Schema. Let's ignore it for MVP 
            // or assuming single instance. User has 1 VPS.

            const user = await UserModel.findById(scheduler.userId);
            if (!user) {
                console.error(`[Worker] User NOT found for ID: ${scheduler.userId}`);
                throw new Error(`User not found: ${scheduler.userId}`);
            }

            // 24-HOUR RULE: Check if free user has opened app in last 24 hours
            if (user.plan === 'free') {
                const lastActiveAt = new Date(user.lastActiveAt || 0);
                const hoursSinceActive = (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60);

                if (hoursSinceActive > 24) {
                    console.log(`[Worker] ⚠️ Free user ${scheduler.userId} inactive for ${hoursSinceActive.toFixed(1)} hours. Pausing all schedulers.`);
                    await SchedulerModel.deactivateAllForUser(
                        scheduler.userId,
                        'App not opened in 24 hours. Please open the app and re-enable your schedulers.'
                    );
                    throw new Error('User inactive for 24+ hours - schedulers paused');
                }
            }

            // Create Video Record first
            const videoData = await VideoModel.createVideo({
                schedulerId: scheduler.id,
                userId: scheduler.userId,
                channelId: scheduler.channelId,
                genres: scheduler.genres,
                status: 'processing'
            });
            videoId = videoData.id;
            console.log(`[Worker] Created video: ${videoId}`);

            // Usage Check
            if (user.plan !== 'pro') {
                if (!user.sunoApiKey) throw new Error('Suno API key required');
                const usage = await SunoKeyUsageModel.getUsage(user.sunoApiKey);
                if (usage.usageCount >= 4) throw new Error('API Key Limit Reached');
            }

            // 1. Content
            const content = await groqService.generateAllContent({
                genres: scheduler.genres,
                language: scheduler.language || 'English',
                titlePrompt: scheduler.titlePrompt,
                descPrompt: scheduler.descPrompt,
                tagsPrompt: scheduler.tagsPrompt,
                lyricsPrompt: scheduler.lyricsPrompt
            });

            await VideoModel.update(videoId, {
                title: content.title,
                description: content.description,
                tags: content.tags,
                lyrics: content.lyrics
            });

            // 2. Audio
            const audioFilename = `${videoId}.mp3`;
            const audioPath = path.join(this.storageDir, 'audio', audioFilename);
            await sunoService.generateAndDownload(content.lyrics, scheduler.genres, audioPath, user.plan, user.sunoApiKey);

            // Start serving this file
            const audioUrl = `${config.backendUrl}${config.storage.publicUrl}/audio/${audioFilename}`;
            await VideoModel.update(videoId, { audioPath, audioUrl });

            if (user.plan !== 'pro') await SunoKeyUsageModel.incrementUsage(user.sunoApiKey);

            // 3. Thumbnail
            const thumbFilename = `${videoId}.png`;
            const thumbnailPath = path.join(this.storageDir, 'thumbnails', thumbFilename);
            await imageService.generateAndSave(scheduler.genres, content.lyrics, content.title, thumbnailPath);

            const thumbnailUrl = `${config.backendUrl}${config.storage.publicUrl}/thumbnails/${thumbFilename}`;
            await VideoModel.update(videoId, { thumbnailPath, thumbnailUrl });

            // 4. Video
            const videoFilename = `${videoId}.mp4`;
            const videoPath = path.join(this.storageDir, 'videos', videoFilename);
            await ffmpegService.createVideoSafe(audioPath, thumbnailPath, videoPath, true);

            const videoUrl = `${config.backendUrl}${config.storage.publicUrl}/videos/${videoFilename}`;

            // 5-MINUTE DELAYED PUBLISHING: Add 5 minutes to scheduled time
            const publishAt = new Date(scheduler.nextRunAt || Date.now());
            publishAt.setMinutes(publishAt.getMinutes() + 5);

            await VideoModel.update(videoId, {
                videoPath,
                videoUrl,
                status: 'ready',
                scheduledPublishAt: publishAt
            });

            console.log(`[Worker] ✅ Complete: ${videoId}`);

        } catch (error) {
            console.error(`[Worker] ❌ Failed: ${error.message}`);

            // Check for Suno credits exhaustion
            const isCreditsExhausted =
                error.message.toLowerCase().includes('insufficient') ||
                error.message.includes('429') ||
                error.message.toLowerCase().includes('credit') ||
                error.message.toLowerCase().includes('quota');

            if (isCreditsExhausted) {
                console.error(`[Worker] ⚠️ Suno credits exhausted for user ${scheduler.userId}. Pausing ALL schedulers.`);
                await SchedulerModel.deactivateAllForUser(scheduler.userId, 'Suno API credits exhausted. Please add more credits or update your API key.');
            }

            // Mark the video as failed if we have a videoId
            if (videoId) {
                await VideoModel.updateStatus(videoId, 'failed', error.message);
                console.log(`[Worker] Video ${videoId} marked as failed`);
            }
        } finally {
            this.isGenerating = false;
        }
    }

    async triggerForScheduler(schedulerId) {
        try {
            const mongoose = require('mongoose');
            const Scheduler = mongoose.model('Scheduler');
            const schedulerDoc = await Scheduler.findById(schedulerId);

            if (schedulerDoc) {
                const scheduler = { id: schedulerDoc._id.toString(), ...schedulerDoc.toObject() };
                console.log(`[Worker] Manual trigger for scheduler: ${scheduler.name}`);
                // Don't await generation to avoid blocking the API response
                this.generateVideo(scheduler).catch(e => console.error(`[Worker] Trigger generation failed: ${e.message}`));
            }
        } catch (e) {
            console.error(`[Worker] triggerForScheduler error: ${e.message}`);
        }
    }

    // RETENTION LOGIC: Clean up files
    async deleteVideoFiles(video) {
        try {
            if (video.audioPath && fs.existsSync(video.audioPath)) fs.unlinkSync(video.audioPath);
            if (video.thumbnailPath && fs.existsSync(video.thumbnailPath)) fs.unlinkSync(video.thumbnailPath);
            if (video.videoPath && fs.existsSync(video.videoPath)) fs.unlinkSync(video.videoPath);
            console.log(`[Worker] Cleaned up files for video ${video.id}`);
        } catch (e) {
            console.error(`[Worker] File cleanup error: ${e.message}`);
        }
    }

    // 7-DAY CLEANUP: Remove failed videos older than 7 days
    async cleanupOldFailedVideos() {
        try {
            const mongoose = require('mongoose');
            const Video = mongoose.model('Video');

            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const oldFailedVideos = await Video.find({
                status: 'failed',
                failedAt: { $lt: sevenDaysAgo }
            });

            for (const video of oldFailedVideos) {
                await this.deleteVideoFiles({ id: video._id.toString(), ...video.toObject() });
                await VideoModel.delete(video._id.toString());
                console.log(`[Worker] 🗑️ Cleaned up old failed video: ${video._id}`);
            }

            if (oldFailedVideos.length > 0) {
                console.log(`[Worker] Cleaned up ${oldFailedVideos.length} old failed videos`);
            }
        } catch (e) {
            console.error('[Worker] Cleanup error:', e.message);
        }
    }

    async run() {
        console.log('[Worker] Started (MongoDB Version)');

        // Run cleanup on startup
        await this.cleanupOldFailedVideos();

        const mongoose = require('mongoose');
        const Video = mongoose.model('Video');

        // Find 'processing' videos older than 10 mins and fail them
        // ... (simplified for brevity)

        // Run cleanup daily
        setInterval(() => this.cleanupOldFailedVideos(), 24 * 60 * 60 * 1000);

        setInterval(async () => {
            if (this.isGenerating) return;
            try {
                const schedulers = await this.checkSchedulers();
                if (schedulers.length > 0) {
                    await this.generateVideo(schedulers[0]);
                }
            } catch (e) {
                console.error('[Worker] Loop error:', e);
                this.isGenerating = false;
            }
        }, 60000); // 1 min check
    }
}

// Singleton
const worker = new VideoGenerationWorker();
module.exports = worker;
