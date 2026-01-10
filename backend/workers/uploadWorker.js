const { VideoModel, UserModel } = require('../models');
const youtubeService = require('../services/youtubeService');
const config = require('../config');
const fs = require('fs');
const path = require('path');

/**
 * Upload Worker
 * 
 * Checks for videos ready to upload to YouTube
 */

class UploadWorker {
    constructor() {
        this.storageDir = config.storage.path;
    }

    async findReadyVideos() {
        return await VideoModel.findReadyForUpload();
    }

    async uploadVideo(video) {
        try {
            console.log(`\n[Upload] Starting: ${video.title}`);

            const user = await UserModel.findById(video.userId);
            if (!user || !user.youtubeRefreshToken) {
                throw new Error('No YouTube connection');
            }

            const tokens = await youtubeService.refreshAccessToken(user.youtubeRefreshToken);

            // Use the stored videoPath, or fallback (for legacy/temp)
            let videoPath = video.videoPath;
            if (!videoPath || !fs.existsSync(videoPath)) {
                // Fallback for older videos in temp?
                const tempPath = path.join(config.temp.directory, 'videos', `${video.id}.mp4`);
                if (fs.existsSync(tempPath)) videoPath = tempPath;
                else throw new Error('Video file not found on disk');
            }

            await VideoModel.updateStatus(video.id, 'uploading');

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

            await VideoModel.markAsUploaded(video.id, result.videoId);

            // CLEANUP (Retention Policy) - Delete local files after upload
            try {
                this.cleanupVideoFiles(video);

                // Clear file paths from DB (only YouTube URL remains)
                await VideoModel.update(video.id, {
                    videoPath: null,
                    audioPath: null,
                    thumbnailPath: null
                });

                console.log('[Upload] ✅ Local files deleted and paths cleared from DB');
            } catch (e) {
                console.warn(`[Upload] Cleanup failed: ${e.message}`);
            }

            console.log(`[Upload] ✅ Complete: ${result.videoId}`);
            return result;
        } catch (error) {
            console.error(`[Upload] Failed: ${error.message}`);
            await VideoModel.updateStatus(video.id, 'failed', error.message);
            throw error;
        }
    }

    cleanupVideoFiles(video) {
        // We need to look up the DB again to get paths if they weren't in the object?
        // The `video` passed into uploadVideo comes from `findReadyForUpload` which returns the doc.
        // It SHOULD have audioPath, thumbnailPath, videoPath.

        const deleteFile = (p) => {
            if (p && fs.existsSync(p)) fs.unlinkSync(p);
        };

        deleteFile(video.videoPath);
        deleteFile(video.audioPath);
        deleteFile(video.thumbnailPath);

        // Also try temp paths if not set, just in case
        if (!video.videoPath) deleteFile(path.join(config.temp.directory, 'videos', `${video.id}.mp4`));
    }

    async run() {
        console.log('[Upload] Worker Started');
        setInterval(async () => {
            try {
                const videos = await this.findReadyVideos();
                if (videos.length > 0) {
                    for (const v of videos) {
                        await this.uploadVideo(v);
                    }
                }
            } catch (e) {
                console.error('[Upload] Loop error:', e.message);
            }
        }, 60000); // 1 min
    }
}

module.exports = new UploadWorker();
