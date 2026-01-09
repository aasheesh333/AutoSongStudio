const config = require('../config');
const { VideoModel, SchedulerModel, UserModel, SunoKeyUsageModel } = require('../models');
const groqService = require('../services/groqService');
const sunoService = require('../services/sunoService');
const imageService = require('../services/imageGenerationService');
const ffmpegService = require('../services/ffmpegService');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class VideoGenerationWorker {
    constructor() {
        this.isGenerating = false;
        this.storageDir = config.storage.path;

        // Ensure directories exist
        ['audio', 'thumbnails', 'videos'].forEach(dir => {
            const fullPath = path.join(this.storageDir, dir);
            if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
        });
    }

    async checkSchedulers() {
        const mongoose = require('mongoose');
        const Scheduler = mongoose.model('Scheduler');
        const Video = mongoose.model('Video');

        // Find active schedulers
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

    /**
     * START generation for a scheduler (Validate & Start Suno)
     * Returns Promise that resolves when Suno request is accepted (or throws).
     * Does NOT wait for FFmpeg.
     */
    async validateAndStart(scheduler) {
        if (this.isGenerating) return;
        this.isGenerating = true;

        let videoId = null;

        try {
            console.log(`\n[Worker] Validating & Starting for: ${scheduler.name}`);

            // 1. Validation & Setup
            const user = await UserModel.findById(scheduler.userId);

            if (!user) throw new Error(`User not found: ${scheduler.userId}`);

            // 24-Hour Rule Check
            if (user.plan === 'free') {
                const lastActiveAt = new Date(user.lastActiveAt || 0);
                const hoursSinceActive = (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60);
                if (hoursSinceActive > 24) {
                    console.log(`[Worker] ⚠️ Free user ${scheduler.userId} inactive for ${hoursSinceActive.toFixed(1)} hours. Pausing all schedulers.`);
                    await SchedulerModel.deactivateAllForUser(scheduler.userId, 'App not opened in 24 hours. Please open the app and re-enable your schedulers.');
                    throw new Error('User inactive for 24+ hours - schedulers paused');
                }
            }

            // Create Status Record
            const videoData = await VideoModel.createVideo({
                schedulerId: scheduler.id,
                userId: scheduler.userId,
                channelId: scheduler.channelId,
                genres: scheduler.genres,
                status: 'processing'
            });
            videoId = videoData.id;
            console.log(`[Worker] Created video: ${videoId}`);

            // Usage Check (Pre-flight)
            if (user.plan !== 'pro') {
                if (!user.sunoApiKey) throw new Error('Suno API key required');
                const usage = await SunoKeyUsageModel.getUsage(user.sunoApiKey);
                if (usage.usageCount >= 4) throw new Error('API Key Limit Reached (Pre-check)');
            }

            // 2. Generate Content (Groq) - Fast
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

            // 3. Generate Audio (Suno) - The Critical Check & Init
            // If this fails (Credits), it throws, and we catch it below.
            // Returns taskId immediately.
            const taskId = await sunoService.generateAudio(
                content.lyrics, // Clean lyrics (no JSON)
                scheduler.genres, // Array of strings
                user.plan,
                user.sunoApiKey
            );

            console.log(`[Worker] ✅ Suno Request Accepted. Task ID: ${taskId}`);

            // 4. Trigger Background Completion (Fire & Forget)
            // Pass taskId so background thread can poll and download
            this._completeGeneration(videoId, scheduler, content, taskId, user)
                .catch(err => console.error(`[Worker] Background completion failed for ${videoId}:`, err));

            return; // Success!

        } catch (error) {
            this.isGenerating = false; // Unlock on error
            console.error(`[Worker] ❌ Validation/Suno Failed: ${error.message}`);

            // Handle Credits Error
            const isCreditsExhausted =
                error.message.toLowerCase().includes('insufficient') ||
                error.message.includes('429') ||
                error.message.toLowerCase().includes('credit') ||
                error.message.toLowerCase().includes('limit') ||
                error.message.toLowerCase().includes('quota');

            if (isCreditsExhausted) {
                console.error(`[Worker] ⚠️ Suno credits exhausted for user ${scheduler.userId}. Pausing ALL schedulers.`);
                await SchedulerModel.deactivateAllForUser(scheduler.userId, 'API key limit exceeds please change API key from settings');
                throw new Error(error.message); // Propagate to API
            }

            if (videoId) {
                await VideoModel.updateStatus(videoId, 'failed', error.message);
            }
            throw error; // Propagate generic errors too
        }
    }

    /**
     * Finish generation (Poll Audio -> Images -> FFmpeg) - Background
     */
    async _completeGeneration(videoId, scheduler, content, taskId, user) {
        try {
            const video = await VideoModel.findById(videoId);
            if (!video) throw new Error(`Video ${videoId} not found.`);

            // 3b. Poll & Download Audio (Long Running)
            const apiKey = sunoService.getApiKey(user.plan, user.sunoApiKey);
            const audioResult = await sunoService.pollGenerationStatus(taskId, apiKey);

            // Download
            const audioFilename = `${videoId}.mp3`;
            const audioPath = path.join(this.storageDir, 'audio', audioFilename);
            await sunoService.downloadAudio(audioResult.audioUrl, audioPath);

            const audioUrlLink = `${config.backendUrl}${config.storage.publicUrl}/audio/${audioFilename}`;

            await VideoModel.update(videoId, {
                audioUrl: audioUrlLink,
                audioPath: audioPath,
                duration: audioResult.duration
            });

            if (user.plan !== 'pro') await SunoKeyUsageModel.incrementUsage(user.sunoApiKey);

            // 5. Generate Thumbnail using Suno Cover API (matches the music style)
            const thumbFilename = `${videoId}.png`;
            const thumbnailPath = path.join(this.storageDir, 'thumbnails', thumbFilename);

            try {
                // Request cover image from Suno (uses the music taskId)
                console.log(`[Worker] Generating cover using Suno API for task: ${taskId}`);
                const coverTaskId = await sunoService.generateCover(taskId, apiKey);
                const coverResult = await sunoService.pollCoverStatus(coverTaskId, apiKey);
                await sunoService.downloadCover(coverResult.imageUrl, thumbnailPath);
                console.log(`[Worker] ✅ Suno cover downloaded: ${thumbnailPath}`);
            } catch (coverError) {
                // Fallback to Pollinations if Suno Cover fails
                console.warn(`[Worker] Suno cover failed (${coverError.message}), falling back to Pollinations`);
                await imageService.generateAndSave(scheduler.genres, content.lyrics, content.title, thumbnailPath);
            }

            const thumbnailUrl = `${config.backendUrl}${config.storage.publicUrl}/thumbnails/${thumbFilename}`;
            await VideoModel.update(videoId, { thumbnailPath, thumbnailUrl });

            // 6. FFmpeg
            const outputPath = path.join(this.storageDir, 'videos', `${videoId}.mp4`);
            await ffmpegService.createVideo(audioPath, thumbnailPath, outputPath);

            const videoUrl = `${config.backendUrl}${config.storage.publicUrl}/videos/${path.basename(outputPath)}`;

            // Calculate proper publish time based on scheduler's configured time
            // Uses user's timezone from database to convert to UTC
            let publishAt;
            if (scheduler.time) {
                // scheduler.time is in "HH:MM" format (e.g., "09:00") in user's LOCAL timezone
                const [hours, minutes] = scheduler.time.split(':').map(Number);

                // Create date in UTC
                publishAt = new Date();

                // Fetch user's timezone from database
                const user = await UserModel.findById(scheduler.userId);
                const userTimezone = user?.timezone || 'Asia/Kolkata';  // Default to IST

                // Timezone offset map (hours, minutes) - positive means ahead of UTC
                const timezoneOffsets = {
                    'Asia/Kolkata': { hours: 5, minutes: 30 },      // IST (India)
                    'Asia/Dubai': { hours: 4, minutes: 0 },         // UAE
                    'Asia/Singapore': { hours: 8, minutes: 0 },     // Singapore
                    'Asia/Tokyo': { hours: 9, minutes: 0 },         // Japan
                    'Europe/London': { hours: 0, minutes: 0 },      // UK (no DST adjustment)
                    'Europe/Paris': { hours: 1, minutes: 0 },       // Central Europe
                    'America/New_York': { hours: -5, minutes: 0 },  // US Eastern
                    'America/Los_Angeles': { hours: -8, minutes: 0 }, // US Pacific
                    'America/Toronto': { hours: -5, minutes: 0 },   // Canada Eastern
                    'Australia/Sydney': { hours: 10, minutes: 0 },  // Australia Eastern
                    'UTC': { hours: 0, minutes: 0 }
                };

                const offset = timezoneOffsets[userTimezone] || timezoneOffsets['Asia/Kolkata'];

                // Convert user's local time to UTC
                // If user says 7:00 AM in their timezone, subtract their offset to get UTC
                let utcHours = hours - offset.hours;
                let utcMinutes = minutes - offset.minutes;

                // Handle minute underflow
                if (utcMinutes < 0) {
                    utcMinutes += 60;
                    utcHours -= 1;
                }
                if (utcMinutes >= 60) {
                    utcMinutes -= 60;
                    utcHours += 1;
                }

                // Handle hour underflow (goes to previous day)
                if (utcHours < 0) {
                    utcHours += 24;
                    publishAt.setDate(publishAt.getDate() - 1); // Go back one day first
                }
                if (utcHours >= 24) {
                    utcHours -= 24;
                    publishAt.setDate(publishAt.getDate() + 1); // Go forward one day
                }

                publishAt.setUTCHours(utcHours, utcMinutes, 0, 0);

                // If time has already passed today (in UTC), schedule for tomorrow
                if (publishAt <= new Date()) {
                    publishAt.setDate(publishAt.getDate() + 1);
                }
                console.log(`[Worker] Scheduler time: ${scheduler.time} (${userTimezone}) → ${publishAt.toISOString()} UTC`);
            } else {
                // Fallback: 5 minutes from now
                publishAt = new Date();
                publishAt.setMinutes(publishAt.getMinutes() + 5);
                console.log(`[Worker] No scheduler.time set, publishing in 5 mins: ${publishAt.toISOString()}`);
            }

            // Finalize
            await VideoModel.update(videoId, {
                videoPath: outputPath,
                videoUrl,
                status: 'ready',
                scheduledPublishAt: publishAt
            });

            console.log(`[Worker] ✅ Full Completion: ${videoId}`);

        } catch (error) {
            console.error(`[Worker] Background Task Failed for ${videoId}: ${error.message}`);
            await VideoModel.updateStatus(videoId, 'failed', error.message);
        } finally {
            this.isGenerating = false; // Release lock finally
        }
    }

    async triggerForScheduler(schedulerId) {
        try {
            const mongoose = require('mongoose');
            const Scheduler = mongoose.model('Scheduler');
            const schedulerDoc = await Scheduler.findById(schedulerId);

            if (!schedulerDoc) {
                console.log(`[Worker] triggerForScheduler: Scheduler ${schedulerId} not found - skipping`);
                return;
            }

            // CRITICAL: Check if scheduler is active before triggering
            if (!schedulerDoc.active) {
                console.log(`[Worker] triggerForScheduler: Scheduler "${schedulerDoc.name}" is paused - skipping generation`);
                return;
            }

            const scheduler = { id: schedulerDoc._id.toString(), ...schedulerDoc.toObject() };
            console.log(`[Worker] Manual trigger for scheduler: ${scheduler.name}`);

            // Await validation completely!
            await this.validateAndStart(scheduler);
        } catch (e) {
            console.error(`[Worker] triggerForScheduler/Validation error: ${e.message}`);
            throw e; // RETHROW so route catches it!
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

        // Run cleanup daily
        setInterval(() => this.cleanupOldFailedVideos(), 24 * 60 * 60 * 1000);

        setInterval(async () => {
            if (this.isGenerating) return;
            try {
                const schedulers = await this.checkSchedulers();
                if (schedulers.length > 0) {
                    await this.validateAndStart(schedulers[0]);
                }
            } catch (e) {
                console.error('[Worker] Loop error:', e.message);
                this.isGenerating = false;
            }
        }, 60000); // 1 min check
    }
}

// Singleton
const worker = new VideoGenerationWorker();
module.exports = worker;
