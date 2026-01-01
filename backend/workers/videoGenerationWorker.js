const { SchedulerModel, VideoModel, UserModel, SunoKeyUsageModel } = require('../models');
const groqService = require('../services/groqService');
const sunoService = require('../services/sunoService');
const huggingfaceService = require('../services/huggingfaceService');
const ffmpegService = require('../services/ffmpegService');
const config = require('../config');
const fs = require('fs');
const path = require('path');

/**
 * Video Generation Worker
 * 
 * Runs the complete video generation pipeline:
 * 1. Generate lyrics (Groq)
 * 2. Generate metadata (Groq)
 * 3. Generate audio (Suno)
 * 4. Generate thumbnail (HuggingFace)
 * 5. Create video (FFmpeg)
 * 6. Mark as READY
 */

class VideoGenerationWorker {
    constructor() {
        this.tempDir = config.temp.directory;
        this.ensureTempDirectories();
    }

    /**
     * Ensure temp directories exist
     */
    ensureTempDirectories() {
        const dirs = [
            this.tempDir,
            path.join(this.tempDir, 'audio'),
            path.join(this.tempDir, 'thumbnails'),
            path.join(this.tempDir, 'videos')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
   * Check which schedulers need videos generated
   * Keep-ahead logic: Always ensure 1 video is ready per active scheduler
   */
    async checkSchedulers() {
        const db = require('../config/firebase').getFirestore();

        // Get all active schedulers
        const snapshot = await db.collection(config.collections.schedulers)
            .where('active', '==', true)
            .get();

        const schedulersNeedingVideos = [];

        for (const doc of snapshot.docs) {
            const scheduler = { id: doc.id, ...doc.data() };

            // Check how many READY videos exist for this scheduler
            const readyVideosSnapshot = await db.collection(config.collections.videos)
                .where('schedulerId', '==', scheduler.id)
                .where('status', '==', 'ready')
                .get();

            const readyCount = readyVideosSnapshot.size;

            // KEEP-AHEAD LOGIC: Always maintain 1 ready video
            if (readyCount === 0) {
                console.log(`[Worker] Scheduler "${scheduler.name}" needs video (0 ready)`);
                schedulersNeedingVideos.push(scheduler);
            } else {
                console.log(`[Worker] Scheduler "${scheduler.name}" has ${readyCount} ready video(s) - OK`);
            }
        }

        return schedulersNeedingVideos;
    }

    /**
     * Generate video for a scheduler
     */
    async generateVideo(scheduler) {
        const videoId = require('uuid').v4();

        try {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`[Worker] Starting video generation for scheduler: ${scheduler.name}`);
            console.log(`${'='.repeat(60)}\n`);

            // Get user info for Suno API key
            const user = await UserModel.findById(scheduler.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Create video record
            const video = await VideoModel.createVideo({
                schedulerId: scheduler.id,
                userId: scheduler.userId,
                channelId: scheduler.channelId,
                genres: scheduler.genres,
                status: 'processing'
            });

            console.log(`[Worker] Created video record: ${video.id}`);

            // QUANTITY CHECK: Free Plan Limit (Max 4 songs per Key)
            if (user.plan !== 'pro') {
                if (!user.sunoApiKey) {
                    throw new Error('Suno API key required for free plan');
                }

                // Check usage count
                const usage = await SunoKeyUsageModel.getUsage(user.sunoApiKey);
                if (usage.usageCount >= 4) {
                    throw new Error('API Key Limit Reached (Max 4 songs). Please provide a new key in Settings.');
                }
            }

            // STEP 1: Generate content (lyrics + metadata)
            console.log('[Worker] Step 1/5: Generating content with Groq...');
            const content = await groqService.generateAllContent({
                genres: scheduler.genres,
                language: scheduler.language,
                titlePrompt: scheduler.titlePrompt,
                descPrompt: scheduler.descPrompt,
                tagsPrompt: scheduler.tagsPrompt,
                lyricsPrompt: scheduler.lyricsPrompt
            });

            // Update video with generated content
            await VideoModel.update(video.id, {
                title: content.title || 'Untitled Video',
                description: content.description || 'No description available.',
                tags: content.tags || [],
                lyrics: content.lyrics || ''
            });

            console.log(`[Worker] ✅ Content generated - Title: "${content.title}"`);

            // STEP 2: Generate audio
            console.log('[Worker] Step 2/5: Generating audio with Suno...');
            const audioPath = path.join(this.tempDir, 'audio', `${video.id}.mp3`);

            await sunoService.generateAndDownload(
                content.lyrics,
                scheduler.genres,
                audioPath,
                user.plan,
                user.sunoApiKey
            );

            // Increment Usage Count (Free Plan)
            if (user.plan !== 'pro') {
                await SunoKeyUsageModel.incrementUsage(user.sunoApiKey);
                console.log(`[Worker] Usage incremented for key. count: ${(await SunoKeyUsageModel.getUsage(user.sunoApiKey)).usageCount}`);
            }

            console.log('[Worker] ✅ Audio generated');

            // STEP 3: Generate thumbnail
            console.log('[Worker] Step 3/5: Generating thumbnail with HuggingFace...');
            const thumbnailPath = path.join(this.tempDir, 'thumbnails', `${video.id}.png`);

            await huggingfaceService.generateAndSave(
                scheduler.genres,
                content.lyrics,
                content.title,
                thumbnailPath
            );

            console.log('[Worker] ✅ Thumbnail generated');

            // STEP 4: Create video
            console.log('[Worker] Step 4/5: Creating video with FFmpeg...');
            const videoPath = path.join(this.tempDir, 'videos', `${video.id}.mp4`);

            await ffmpegService.createVideoSafe(audioPath, thumbnailPath, videoPath, true);

            console.log('[Worker] ✅ Video created');

            // STEP 5: Mark as ready
            console.log('[Worker] Step 5/5: Finalizing...');

            // Calculate scheduled publish time (e.g., next scheduler run)
            const scheduledPublishAt = scheduler.nextRunAt;

            await VideoModel.update(video.id, {
                status: 'ready',
                scheduledPublishAt
            });

            console.log(`\n${'='.repeat(60)}`);
            console.log(`[Worker] ✅ VIDEO GENERATION COMPLETE!`);
            console.log(`Video ID: ${video.id}`);
            console.log(`Title: ${content.title}`);
            console.log(`Scheduled for: ${scheduledPublishAt}`);
            console.log(`${'='.repeat(60)}\n`);

            return video;
        } catch (error) {
            console.error(`[Worker] ❌ Video generation failed:`, error.message);

            // Mark video as failed
            await VideoModel.updateStatus(videoId, 'failed', error.message);

            throw error;
        }
    }

    /**
     * Update scheduler's next run time
     */
    async updateSchedulerNextRun(scheduler) {
        const { time, frequency, activeDays } = scheduler;
        const [hours, minutes] = time.split(':').map(Number);

        let next = new Date(scheduler.nextRunAt);

        // Calculate next run based on frequency
        if (frequency === 'daily') {
            next.setDate(next.getDate() + 1);
        } else if (frequency === 'weekly') {
            // Move to next active day
            do {
                next.setDate(next.getDate() + 1);
            } while (!activeDays.includes(next.getDay()));
        } else if (frequency === 'monthly') {
            next.setMonth(next.getMonth() + 1);
        }

        await SchedulerModel.update(scheduler.id, {
            nextRunAt: next.toISOString()
        });

        console.log(`[Worker] Updated scheduler next run: ${next.toISOString()}`);
    }

    async triggerForScheduler(schedulerId) {
        console.log(`[Worker] Triggered immediate check for scheduler: ${schedulerId}`);
        const { SchedulerModel } = require('../models');
        const scheduler = await SchedulerModel.findById(schedulerId);
        if (scheduler && scheduler.active) {
            const db = require('../config/firebase').getFirestore();
            const readyCount = (await db.collection(config.collections.videos)
                .where('schedulerId', '==', schedulerId)
                .where('status', '==', 'ready')
                .get()).size;

            if (readyCount === 0) {
                console.log(`[Worker] Scheduler ${scheduler.name} needs video (Triggered)`);
                this.generateVideo(scheduler).catch(err =>
                    console.error(`[Worker] Triggered generation failed: ${err.message}`)
                );
            } else {
                console.log(`[Worker] Scheduler ${scheduler.name} already has ${readyCount} videos.`);
            }
        }
    }

    /**
   * Main worker loop
   */
    async run() {
        console.log('[Worker] Video Generation Worker started');
        console.log('[Worker] Keep-ahead mode: Always maintains 1 ready video per scheduler');

        // Check every 2 minutes for schedulers needing videos
        setInterval(async () => {
            try {
                const schedulers = await this.checkSchedulers();

                if (schedulers.length > 0) {
                    console.log(`[Worker] Found ${schedulers.length} scheduler(s) needing videos`);

                    for (const scheduler of schedulers) {
                        try {
                            console.log(`[Worker] Generating video for scheduler: ${scheduler.name}`);
                            await this.generateVideo(scheduler);
                        } catch (error) {
                            console.error(`[Worker] Failed to generate video for scheduler ${scheduler.id}:`, error.message);
                        }
                    }
                } else {
                    console.log('[Worker] All schedulers have ready videos - standby mode');
                }
            } catch (error) {
                console.error('[Worker] Error in worker loop:', error.message);
            }
        }, 120000);  // Every 2 minutes (more efficient than 1 minute)
    }
}

module.exports = VideoGenerationWorker;
