const { VideoModel, UserModel } = require('../models');
const youtubeService = require('../services/youtubeService');
const config = require('../config');
const fs = require('fs');
const path = require('path');

/**
 * Upload Worker
 * 
 * Checks for videos ready to upload and uploads them to YouTube
 * at their scheduled time
 */

class UploadWorker {
    constructor() {
        this.tempDir = config.temp.directory;
    }

    /**
     * Find videos ready for upload
     */
    async findReadyVideos() {
        return await VideoModel.findReadyForUpload();
    }

    /**
     * Upload video to YouTube
     */
    async uploadVideo(video) {
        try {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`[Upload] Starting upload for video: ${video.title}`);
            console.log(`${'='.repeat(60)}\n`);

            // Get user to fetch refresh token
            const user = await UserModel.findById(video.userId);
            if (!user || !user.youtubeRefreshToken) {
                throw new Error('User not found or YouTube not connected');
            }

            // Refresh access token
            const tokens = await youtubeService.refreshAccessToken(user.youtubeRefreshToken);

            // Video path
            const videoPath = path.join(this.tempDir, 'videos', `${video.id}.mp4`);

            if (!fs.existsSync(videoPath)) {
                throw new Error('Video file not found. It may have been cleaned up.');
            }

            // Mark as uploading
            await VideoModel.updateStatus(video.id, 'uploading');

            // Upload to YouTube
            const result = await youtubeService.uploadVideo(
                videoPath,
                {
                    title: video.title,
                    description: video.description,
                    tags: video.tags,
                    scheduledPublishAt: video.scheduledPublishAt
                },
                tokens.accessToken,
                video.userId
            );

            // Mark as uploaded and lock
            await VideoModel.markAsUploaded(video.id, result.videoId);

            // Cleanup video file
            try {
                fs.unlinkSync(videoPath);
                console.log('[Upload] Video file cleaned up');
            } catch (cleanupError) {
                console.warn('[Upload] Failed to cleanup video file:', cleanupError.message);
            }

            console.log(`\n${'='.repeat(60)}`);
            console.log(`[Upload] ✅ UPLOAD COMPLETE!`);
            console.log(`Video: ${video.title}`);
            console.log(`YouTube ID: ${result.videoId}`);
            console.log(`URL: ${result.url}`);
            console.log(`${'='.repeat(60)}\n`);

            return result;
        } catch (error) {
            console.error(`[Upload] ❌ Upload failed:`, error.message);

            // Mark as failed
            await VideoModel.updateStatus(video.id, 'failed', error.message);

            throw error;
        }
    }

    /**
     * Cleanup old temporary files
     */
    async cleanupOldFiles() {
        const maxAgeMs = config.temp.maxAgeHours * 60 * 60 * 1000;
        const now = Date.now();

        const dirs = [
            path.join(this.tempDir, 'audio'),
            path.join(this.tempDir, 'thumbnails'),
            path.join(this.tempDir, 'videos')
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) continue;

            const files = fs.readdirSync(dir);

            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                if (age > maxAgeMs) {
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`[Upload] Cleaned up old file: ${file}`);
                    } catch (error) {
                        console.warn(`[Upload] Failed to cleanup ${file}:`, error.message);
                    }
                }
            }
        }
    }

    /**
     * Main worker loop
     */
    async run() {
        console.log('[Upload] Upload Worker started');

        // Check for uploads every minute
        setInterval(async () => {
            try {
                const readyVideos = await this.findReadyVideos();

                if (readyVideos.length > 0) {
                    console.log(`[Upload] Found ${readyVideos.length} video(s) ready for upload`);

                    for (const video of readyVideos) {
                        try {
                            await this.uploadVideo(video);
                        } catch (error) {
                            console.error(`[Upload] Failed to upload video ${video.id}:`, error.message);
                        }
                    }
                }
            } catch (error) {
                console.error('[Upload] Error in worker loop:', error.message);
            }
        }, 60000);  // Every 1 minute

        // Cleanup old files every hour
        setInterval(async () => {
            try {
                await this.cleanupOldFiles();
            } catch (error) {
                console.error('[Upload] Error in cleanup:', error.message);
            }
        }, config.temp.cleanupIntervalHours * 60 * 60 * 1000);
    }
}

module.exports = UploadWorker;
