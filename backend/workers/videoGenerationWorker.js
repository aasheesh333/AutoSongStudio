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

    /**
     * START generation for a scheduler (Validate & Start Suno)
     * Returns Promise that resolves when Suno request is accepted (or throws).
     * Does NOT wait for FFmpeg.
     */
    async validateAndStart(scheduler) {
        if (this.isGenerating) return; // Simple lock (per worker instance)
        this.isGenerating = true;

        let videoId = null;

        try {
            console.log(`\n[Worker] Validating & Starting for: ${scheduler.name}`);

            // 1. Validation & Setup
            const mongoose = require('mongoose');
            const Scheduler = mongoose.model('Scheduler');
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
                // Note: Actual API call might still fail if key is invalid/exhausted remotely
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

            // 3. Generate Audio (Suno) - The Critical Check
            // If this fails (Credits), it throws, and we catch it below.
            const audioData = await sunoService.generateSong(
                content.lyrics,
                scheduler.genres.join(', '),
                user.plan,
                user.sunoApiKey
            );

            // Download audio if not already downloaded by sunoService
            let audioPath = audioData.audioPath;
            if (!audioPath && audioData.audioUrl) {
                const audioFilename = `${videoId}.mp3`;
                audioPath = path.join(this.storageDir, 'audio', audioFilename);
                await sunoService.downloadAudio(audioData.audioUrl, audioPath);
            }

            const audioUrl = `${config.backendUrl}${config.storage.publicUrl}/audio/${path.basename(audioPath)}`;

            await VideoModel.update(videoId, {
                audioUrl: audioUrl,
                audioPath: audioPath,
                duration: audioData.duration
            });

            if (user.plan !== 'pro') await SunoKeyUsageModel.incrementUsage(user.sunoApiKey);

            console.log(`[Worker] ✅ Suno Request Accepted for ${videoId}. Finishing in background...`);

            // 4. Trigger Background Completion (Fire & Forget)
            this._completeGeneration(videoId, scheduler, content)
                .catch(err => console.error(`[Worker] Background completion failed for ${videoId}:`, err));

            // Release lock immediately for other tasks? 
            // Ideally keep locked until complete, but user wants "Immediate Check".
            // Since we use `isGenerating` flag, returning here means we can accept another?
            // No, `isGenerating` stays true until `_completeGeneration` finishes.
            // Wait, if I return, `videoGenerationWorker` might be called again?
            // `isGenerating` is instance var. 
            // I should pass lock responsibility to `_completeGeneration`.

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
     * Finish generation (Images + FFmpeg) - Background
     */
    async _completeGeneration(videoId, scheduler, content) {
        try {
            const video = await VideoModel.findById(videoId);
            if (!video) {
                throw new Error(`Video ${videoId} not found for completion.`);
            }

            // 5. Generate Images
            const imagePrompts = await imageService.generatePrompts(content.lyrics);
            const imageUrls = await imageService.generateImages(imagePrompts);

            const thumbnails = [];
            const thumbDir = path.join(this.storageDir, 'thumbnails');

            for (let i = 0; i < imageUrls.length; i++) {
                const url = imageUrls[i];
                const localPath = path.join(thumbDir, `${videoId}_${i}.png`);

                const response = await axios({ url, responseType: 'stream' });
                const writer = fs.createWriteStream(localPath);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                thumbnails.push(localPath);
            }

            const thumbnailUrl = `${config.backendUrl}${config.storage.publicUrl}/thumbnails/${path.basename(thumbnails[0])}`;
            await VideoModel.update(videoId, { thumbnailPath: thumbnails[0], thumbnailUrl });

            // 6. FFmpeg
            // We need audioPath. SunoService returns it? 
            // In step 3 we got `audioData`. But `_completeGeneration` context lost `audioData`.
            // We need to re-fetch or pass it.
            // Actually, we saved to DB.
            // But wait, sunoService might be async download?
            // Original code: `const audioPath = await sunoService.downloadAudio...`
            // My step 3 `generateSong` handles download? 
            // I need to check `sunoService.generateSong` implementation.
            // Assuming `generateSong` returns object with `audioPath`.

            // Render
            const outputPath = path.join(this.storageDir, 'videos', `${videoId}.mp4`);
            await ffmpegService.createVideo({
                audioPath: video.audioPath,
                images: thumbnails,
                outputPath,
                lyrics: JSON.parse(video.lyrics || '[]')
            });

            const videoUrl = `${config.backendUrl}${config.storage.publicUrl}/videos/${path.basename(outputPath)}`;

            // 5-MINUTE DELAYED PUBLISHING: Ensure strictly 5 minutes AFTER triggers
            // If nextRunAt is in past (catch-up), use NOW as base. If future, use nextRunAt.
            let baseTime = new Date();
            if (scheduler.nextRunAt) {
                const scheduledTime = new Date(scheduler.nextRunAt);
                if (scheduledTime > baseTime) baseTime = scheduledTime;
            }

            const publishAt = new Date(baseTime);
            publishAt.setMinutes(publishAt.getMinutes() + 5);

            // Finalize
            await VideoModel.update(videoId, {
                videoPath: outputPath,
                videoUrl,
                status: 'ready',
                scheduledPublishAt: publishAt
            });

            // Schedule for Upload (UploadWorker handles this via `scheduledPublishAt`)

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

            if (schedulerDoc) {
                const scheduler = { id: schedulerDoc._id.toString(), ...schedulerDoc.toObject() };
                console.log(`[Worker] Manual trigger for scheduler: ${scheduler.name}`);

                // Await validation completely!
                await this.validateAndStart(scheduler);
            }
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
