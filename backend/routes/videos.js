const express = require('express');
const router = express.Router();
const { VideoModel } = require('../models');
const youtubeService = require('../services/youtubeService');
const fs = require('fs');
const config = require('../config');
const path = require('path');

// Helper to delete files
const deleteVideoFiles = (video) => {
    const safeDelete = (p) => { if (p && fs.existsSync(p)) fs.unlinkSync(p); };
    safeDelete(video.videoPath);
    safeDelete(video.audioPath);
    safeDelete(video.thumbnailPath);
};

// GET /api/videos - with pagination support
router.get('/', async (req, res) => {
    const { userId, channelId, schedulerId, status, limit = 10, skip = 0 } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        let videos;
        if (schedulerId) {
            videos = await VideoModel.findByScheduler(schedulerId, parseInt(limit));
        } else {
            // Use pagination for user videos
            const mongoose = require('mongoose');
            const Video = mongoose.model('Video');

            const query = { userId };
            if (channelId) query.channelId = channelId;
            if (status) query.status = status;

            const docs = await Video.find(query)
                .sort({ createdAt: -1 })
                .skip(parseInt(skip))
                .limit(parseInt(limit));

            videos = docs.map(d => ({ ...d.toObject(), id: d._id.toString() }));
        }
        console.log(`[Videos API] userId=${userId}, channelId=${channelId || 'none'}, returned=${videos.length} videos`);
        res.json({ videos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/videos/:id
router.get('/:id', async (req, res) => {
    try {
        let video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        // Live Metadata Fetching for Uploaded Videos
        if (video.status === 'uploaded' && video.youtubeId) {
            try {
                // We need to import the service. It is likely required at top of file?
                // If not, require it here (checking file content first would be safer but assuming it's available or requiring).
                const youtubeService = require('../services/youtubeService');
                const details = await youtubeService.getVideoDetails(video.youtubeId, video.userId);

                if (details) {
                    console.log(`[VideoAPI] Fetched live metadata for ${video.id}`);
                    // Merge details into video object for response (don't save to DB)
                    video = { ...video, ...details };

                    // Specific field mapping if needed
                    if (details.tags) video.tags = details.tags;
                    if (details.description) video.description = details.description;
                    if (details.title) video.title = details.title;
                    if (details.thumbnailUrl) video.thumbnailUrl = details.thumbnailUrl;
                }
            } catch (e) {
                console.warn(`[VideoAPI] Failed to fetch live metadata: ${e.message}`);
                // Continue with DB data (empty fields)
            }
        }

        res.json({ video });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/videos/:id
router.patch('/:id', async (req, res) => {
    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Video not found' });
        if (video.locked || video.status === 'uploaded') return res.status(403).json({ error: 'Cannot edit uploaded video' });

        const updated = await VideoModel.update(req.params.id, req.body);
        res.json({ video: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/videos/:id
router.delete('/:id', async (req, res) => {
    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Video not found' });
        if (video.status === 'uploaded') return res.status(403).json({ error: 'Cannot delete uploaded video' });

        const videoStatus = video.status;  // Save before deletion
        const schedulerId = video.schedulerId;

        // DELETE FILES (Retention Policy)
        deleteVideoFiles(video);

        await VideoModel.delete(req.params.id);
        console.log(`[Videos] Deleted video ${req.params.id} (status was: ${videoStatus})`);

        res.json({ success: true, message: 'Video deleted' });

        // Trigger keep-ahead ONLY if:
        // 1. Video was NOT failed (failed videos don't need replacement)
        // 2. Scheduler is still active (paused schedulers shouldn't trigger generation)
        if (videoStatus === 'failed') {
            console.log(`[Videos] Skipping replacement: video was 'failed' status`);
        } else {
            // Check if scheduler is active before triggering
            const { SchedulerModel } = require('../models');
            const scheduler = await SchedulerModel.findById(schedulerId);

            if (!scheduler) {
                console.log(`[Videos] Skipping replacement: scheduler not found`);
            } else if (!scheduler.active) {
                console.log(`[Videos] Skipping replacement: scheduler '${scheduler.name}' is paused`);
            } else {
                console.log(`[Videos] Triggering replacement for active scheduler: ${scheduler.name}`);
                const videoWorker = req.app.get('videoWorker');
                if (videoWorker) videoWorker.triggerForScheduler(schedulerId);
            }
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/videos/:id/upload-now
router.post('/:id/upload-now', async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Token required' });

    console.log(`[Upload] Starting upload for video: ${req.params.id}`);

    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Not found' });

        let videoPath = video.videoPath;
        console.log(`[Upload] Video path: ${videoPath}`);

        if (!videoPath || !fs.existsSync(videoPath)) {
            console.error(`[Upload] Video file not found at path: ${videoPath}`);
            return res.status(404).json({ error: 'Video file not found via path' });
        }

        await VideoModel.updateStatus(video.id, 'uploading');
        console.log(`[Upload] Status updated to uploading. Starting YouTube upload...`);

        const result = await youtubeService.uploadVideo(
            videoPath,
            { title: video.title, description: video.description, tags: video.tags, scheduledPublishAt: video.scheduledPublishAt },
            accessToken,
            video.userId
        );

        console.log(`[Upload] YouTube upload successful! Video ID: ${result.videoId}`);
        await VideoModel.markAsUploaded(video.id, result.videoId);

        // CLEANUP FILES (Retention Policy)
        deleteVideoFiles(video);

        res.json({ success: true, youtubeId: result.videoId, url: result.url });

        const videoWorker = req.app.get('videoWorker');
        if (videoWorker) videoWorker.triggerForScheduler(video.schedulerId);

    } catch (error) {
        console.error(`[Upload] FAILED:`, error.message);
        console.error(`[Upload] Full error:`, error);
        await VideoModel.updateStatus(req.params.id, 'failed', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/videos/:id/stream - Video streaming (backward compatibility)
router.get('/:id/stream', async (req, res) => {
    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const videoPath = video.videoPath;
        if (!videoPath || !fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Video file not found' });
        }

        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            const file = fs.createReadStream(videoPath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': 'video/mp4'
            });
            file.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4'
            });
            fs.createReadStream(videoPath).pipe(res);
        }
    } catch (error) {
        console.error('[Videos] Stream error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/videos/:id/thumbnail-stream - Thumbnail streaming (backward compatibility)
router.get('/:id/thumbnail-stream', async (req, res) => {
    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const thumbnailPath = video.thumbnailPath;
        if (!thumbnailPath || !fs.existsSync(thumbnailPath)) {
            return res.status(404).json({ error: 'Thumbnail not found' });
        }

        res.setHeader('Content-Type', 'image/png');
        fs.createReadStream(thumbnailPath).pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/videos/:id/thumbnail - Upload custom thumbnail (base64)
router.post('/:id/thumbnail', requireAuth, async (req, res) => {
    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const { thumbnailUrl } = req.body;
        if (!thumbnailUrl) {
            return res.status(400).json({ error: 'thumbnailUrl required' });
        }

        // Check if it's a base64 data URL
        if (thumbnailUrl.startsWith('data:image')) {
            const matches = thumbnailUrl.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) {
                return res.status(400).json({ error: 'Invalid base64 image format' });
            }

            const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Save to thumbnails directory
            const config = require('../config');
            const path = require('path');
            const storageDir = config.storage?.directory || './storage';
            const thumbFilename = `${req.params.id}.${extension}`;
            const thumbnailPath = path.join(storageDir, 'thumbnails', thumbFilename);

            // Ensure directory exists
            const thumbnailDir = path.join(storageDir, 'thumbnails');
            if (!fs.existsSync(thumbnailDir)) {
                fs.mkdirSync(thumbnailDir, { recursive: true });
            }

            // Write file
            fs.writeFileSync(thumbnailPath, buffer);
            console.log(`[Videos] Saved custom thumbnail: ${thumbnailPath}`);

            // Update video record
            const publicThumbnailUrl = `${config.backendUrl}${config.storage.publicUrl}/thumbnails/${thumbFilename}`;
            await VideoModel.update(req.params.id, {
                thumbnailPath: thumbnailPath,
                thumbnailUrl: publicThumbnailUrl
            });

            res.json({
                message: 'Thumbnail uploaded successfully',
                thumbnailUrl: publicThumbnailUrl
            });
        } else {
            // Direct URL - just update the record
            await VideoModel.update(req.params.id, {
                thumbnailUrl: thumbnailUrl
            });

            res.json({
                message: 'Thumbnail URL updated',
                thumbnailUrl: thumbnailUrl
            });
        }
    } catch (error) {
        console.error('[Videos] Thumbnail upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
