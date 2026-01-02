const { SchedulerModel, VideoModel, UserModel, SunoKeyUsageModel } = require('../models');
const groqService = require('../services/groqService');
const sunoService = require('../services/sunoService');
const imageService = require('../services/imageGenerationService');
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
 * 4. Generate thumbnail (Pollinations.ai)
 * 5. Create video (FFmpeg)
 * 6. Mark as READY
 */

class VideoGenerationWorker {
    constructor() {
        this.tempDir = config.temp.directory;
        this.ensureTempDirectories();
        this.isGenerating = false; // Global lock
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
    * Keep-ahead logic: Always ensure 1 video is ready OR processing per active scheduler
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

            // Check how many READY or PROCESSING videos exist for this scheduler
            // Note: Firestore 'in' query allows max 10 values
            const videosSnapshot = await db.collection(config.collections.videos)
                .where('schedulerId', '==', scheduler.id)
                .where('status', 'in', ['ready', 'processing'])
                .get();

            const existingCount = videosSnapshot.size;

            // KEEP-AHEAD LOGIC: Always maintain 1 video (ready or processing)
            if (existingCount === 0) {
                console.log(`[Worker] Scheduler "${scheduler.name}" needs video (0 existing)`);
                schedulersNeedingVideos.push(scheduler);
            } else {
                // Debug: Log which videos are found
                const videoIds = videosSnapshot.docs.map(d => `${d.id}(${d.data().status})`).join(', ');
                console.log(`[Worker] Scheduler "${scheduler.name}" has ${existingCount} video(s): [${videoIds}] - skipping`);
            }
        }

        return schedulersNeedingVideos;
    }

    /**
     * Generate video for a scheduler
     */
    async generateVideo(scheduler) {
        if (this.isGenerating) {
            console.log(`[Worker] Generation busy. Queuing/Skipping scheduler: ${scheduler.name}`);
            return;
        }

        this.isGenerating = true;
        const videoId = require('uuid').v4();

        try {
            // ... (rest of generation logic) ...
            console.log(`\n${'='.repeat(60)}`);
            console.log(`[Worker] Starting video generation for scheduler: ${scheduler.name}`);
            console.log(`${'='.repeat(60)}\n`);

            // DB-BASED LOCK: Prevent duplicate generation across multiple processes
            const { SchedulerModel } = require('../models');
            const freshScheduler = await SchedulerModel.findById(scheduler.id);

            if (freshScheduler.lastGenerationStarted) {
                const lastStart = new Date(freshScheduler.lastGenerationStarted);
                const now = new Date();
                const diffMs = now - lastStart;

                // If started less than 5 minutes ago, assume another worker is handling it
                if (diffMs < 5 * 60 * 1000) {
                    console.log(`[Worker] ⚠️ Scheduler ${scheduler.name} recently started generation (${Math.round(diffMs / 1000)}s ago). Skipping to prevent duplicates.`);
                    // Release local lock since we are aborting
                    this.isGenerating = false;
                    return;
                }
            }

            // Claim the job
            await SchedulerModel.update(scheduler.id, {
                lastGenerationStarted: new Date().toISOString()
            });

            // Get user info for Suno API key
            console.log(`[Worker] Fetching user: ${scheduler.userId}`);
            const user = await UserModel.findById(scheduler.userId);
            if (!user) {
                console.error(`[Worker] ❌ User not found for ID: ${scheduler.userId}`);
                throw new Error(`User not found: ${scheduler.userId}`);
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

            // Fetch previous video titles for this scheduler to avoid repetition
            const db = require('../config/firebase').getFirestore();
            const previousVideosSnapshot = await db.collection(config.collections.videos)
                .where('schedulerId', '==', scheduler.id)
                .where('title', '!=', null)
                .orderBy('title')
                .orderBy('createdAt', 'desc')
                .limit(10)  // Last 10 titles to avoid
                .get();

            const previousTitles = previousVideosSnapshot.docs
                .map(doc => doc.data().title)
                .filter(title => title && title.length > 0);

            console.log(`[Worker] Found ${previousTitles.length} previous titles to avoid repetition`);

            // STEP 1: Generate content (lyrics + metadata)
            console.log('[Worker] Step 1/5: Generating content with Groq...');
            const content = await groqService.generateAllContent({
                genres: scheduler.genres,
                language: scheduler.language,
                titlePrompt: scheduler.titlePrompt,
                descPrompt: scheduler.descPrompt,
                tagsPrompt: scheduler.tagsPrompt,
                lyricsPrompt: scheduler.lyricsPrompt,
                previousTitles  // Pass previous titles to avoid repetition
            });

            // Update video with generated content
            console.log(`[Worker] Updating video metadata:`, JSON.stringify(content, null, 2));
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
            console.log('[Worker] Step 3/5: Generating thumbnail with Pollinations.ai...');
            const thumbnailPath = path.join(this.tempDir, 'thumbnails', `${video.id}.png`);

            await imageService.generateAndSave(
                scheduler.genres,
                content.lyrics,
                content.title,
                thumbnailPath
            );

            // Save thumbnail URL to database (streaming endpoint)
            const thumbnailUrl = `${config.backendUrl}/api/videos/${video.id}/thumbnail-stream`;
            await VideoModel.update(video.id, { thumbnailUrl });

            console.log('[Worker] ✅ Thumbnail generated and URL saved');

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

            // Check for Insufficient Credits Error
            if (error.message.includes('Insufficient Suno credits') || error.message.includes('429')) {
                console.log(`[Worker] 🛑 Insufficient credits detected. Deactivating all schedulers for user: ${scheduler.userId}`);
                await SchedulerModel.deactivateAllForUser(scheduler.userId);

                // Update video status with clear error for Frontend Toast
                try {
                    await VideoModel.updateStatus(videoId, 'failed', 'Insufficient Suno credits. All schedulers paused.');
                } catch (updateError) {
                    // Video might have been deleted already, ignore
                    console.log(`[Worker] Could not update video status (may be deleted): ${updateError.message}`);
                }
            } else {
                try {
                    await VideoModel.updateStatus(videoId, 'failed', error.message);
                } catch (updateError) {
                    // Video might have been deleted already, ignore
                    console.log(`[Worker] Could not update video status (may be deleted): ${updateError.message}`);
                }
            }

            throw error;
        } finally {
            this.isGenerating = false; // Release lock
        }
    }

    /**
     * Update scheduler's next run time
     */
    async updateSchedulerNextRun(scheduler) {
        // ... (unchanged) ...
        const { time, frequency, activeDays } = scheduler;
        const [hours, minutes] = time.split(':').map(Number);
        let next = new Date(scheduler.nextRunAt);
        if (frequency === 'daily') { next.setDate(next.getDate() + 1); }
        else if (frequency === 'weekly') { do { next.setDate(next.getDate() + 1); } while (!activeDays.includes(next.getDay())); }
        else if (frequency === 'monthly') { next.setMonth(next.getMonth() + 1); }
        await SchedulerModel.update(scheduler.id, { nextRunAt: next.toISOString() });
        console.log(`[Worker] Updated scheduler next run: ${next.toISOString()}`);
    }

    async triggerForScheduler(schedulerId) {
        if (this.isGenerating) {
            console.log(`[Worker] System busy. Cannot trigger immediate check for: ${schedulerId}`);
            return;
        }

        console.log(`[Worker] Triggered immediate check for scheduler: ${schedulerId}`);
        const { SchedulerModel } = require('../models');
        const scheduler = await SchedulerModel.findById(schedulerId);
        if (scheduler && scheduler.active) {
            const db = require('../config/firebase').getFirestore();
            // Fix: Check for ready OR processing to prevent duplicate
            const existingVideos = await db.collection(config.collections.videos)
                .where('schedulerId', '==', schedulerId)
                .where('status', 'in', ['ready', 'processing'])
                .get();

            if (existingVideos.empty) {
                console.log(`[Worker] Scheduler ${scheduler.name} needs video (Triggered)`);
                // Note: generateVideo manages this.isGenerating lock
                this.generateVideo(scheduler).catch(err =>
                    console.error(`[Worker] Triggered generation failed: ${err.message}`)
                );
            } else {
                console.log(`[Worker] Scheduler ${scheduler.name} already has ${existingVideos.size} videos (Ready/Processing).`);
            }
        }
    }

    /**
    * Main worker loop
    */
    async run() {
        console.log('[Worker] Video Generation Worker started');
        console.log('[Worker] Keep-ahead mode: Always maintains 1 ready/processing video per scheduler');

        // Recover any stale videos from previous crashes/restarts
        await this.recoverStaleVideos();

        // Check every 2 minutes for schedulers needing videos
        setInterval(async () => {
            if (this.isGenerating) {
                console.log('[Worker] Worker busy generating video. Skipping cycle.');
                return;
            }

            try {
                const schedulers = await this.checkSchedulers();

                if (schedulers.length > 0) {
                    // Process only ONE scheduler per cycle to strictly enforce "one API call" rule
                    const scheduler = schedulers[0];
                    console.log(`[Worker] Generating video for scheduler: ${scheduler.name}`);
                    await this.generateVideo(scheduler);

                    if (schedulers.length > 1) {
                        console.log(`[Worker] ${schedulers.length - 1} other schedulers waiting for next cycle.`);
                    }
                } else {
                    console.log('[Worker] All schedulers satisfy keep-ahead - standby mode');
                }
            } catch (error) {
                console.error('[Worker] Error in worker loop:', error.message);
                this.isGenerating = false; // Safety release
            }
        }, 120000);  // Every 2 minutes
    }

    /**
     * Recover stale videos stuck in 'processing' or 'queued' status
     * This handles cases where the server was restarted mid-generation
     */
    async recoverStaleVideos() {
        console.log('[Worker] Checking for stale videos...');
        const db = require('../config/firebase').getFirestore();

        try {
            // Find videos stuck in 'processing' status
            const processingSnapshot = await db.collection(config.collections.videos)
                .where('status', '==', 'processing')
                .get();

            // Also check for stuck 'queued' videos
            const queuedSnapshot = await db.collection(config.collections.videos)
                .where('status', '==', 'queued')
                .get();

            const allStuckDocs = [...processingSnapshot.docs, ...queuedSnapshot.docs];

            if (allStuckDocs.length === 0) {
                console.log('[Worker] ✅ No stale videos found');
                return;
            }

            console.log(`[Worker] Found ${allStuckDocs.length} video(s) in processing/queued state`);

            const now = new Date();
            const staleThresholdMs = 5 * 60 * 1000; // 5 minutes (aggressive due to Render restarts)
            const schedulerIdsToTrigger = new Set();

            for (const doc of allStuckDocs) {
                const video = { id: doc.id, ...doc.data() };
                const createdAt = new Date(video.createdAt);
                const ageMs = now - createdAt;

                if (ageMs > staleThresholdMs) {
                    console.log(`[Worker] ⚠️ Found stale video: ${video.id} (status: ${video.status}, age: ${Math.round(ageMs / 60000)}min)`);

                    // Mark as failed using DIRECT Firestore update for reliability
                    try {
                        await db.collection(config.collections.videos).doc(video.id).update({
                            status: 'failed',
                            error: 'Generation interrupted by server restart. Will be regenerated.',
                            updatedAt: new Date().toISOString()
                        });

                        // Verify the update worked
                        const verifyDoc = await db.collection(config.collections.videos).doc(video.id).get();
                        if (verifyDoc.exists && verifyDoc.data().status === 'failed') {
                            console.log(`[Worker] ✅ Verified: Video ${video.id} status is now 'failed'`);
                            schedulerIdsToTrigger.add(video.schedulerId);
                        } else {
                            console.error(`[Worker] ❌ VERIFICATION FAILED: Video ${video.id} status is still ${verifyDoc.data()?.status}`);
                        }
                    } catch (updateErr) {
                        console.error(`[Worker] ❌ Failed to update video ${video.id}: ${updateErr.message}`);
                    }
                }
            }

            console.log('[Worker] ✅ Stale video recovery complete');

            // Immediately trigger check for affected schedulers
            if (schedulerIdsToTrigger.size > 0) {
                console.log(`[Worker] Triggering immediate generation for ${schedulerIdsToTrigger.size} scheduler(s)...`);

                // Small delay to ensure Firestore consistency
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Run a check cycle immediately
                const schedulers = await this.checkSchedulers();
                if (schedulers.length > 0 && !this.isGenerating) {
                    const scheduler = schedulers[0];
                    console.log(`[Worker] Starting immediate generation for: ${scheduler.name}`);
                    this.generateVideo(scheduler).catch(err =>
                        console.error(`[Worker] Immediate generation failed: ${err.message}`)
                    );
                }
            }
        } catch (error) {
            console.error('[Worker] Error recovering stale videos:', error.message);
        }
    }
}

module.exports = new VideoGenerationWorker();
