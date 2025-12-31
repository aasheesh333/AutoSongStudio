const express = require('express');
const router = express.Router();
const { VideoModel } = require('../models');
const youtubeService = require('../services/youtubeService');
const fs = require('fs');

/**
 * Video Routes
 * Manage generated videos
 */

/**
 * GET /api/videos
 * List videos with filters
 */
router.get('/', async (req, res) => {
    const { userId, channelId, schedulerId, status, limit = 50 } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        let videos;

        if (schedulerId) {
            videos = await VideoModel.findByScheduler(schedulerId, parseInt(limit));
        } else {
            videos = await VideoModel.findByUser(userId, channelId, status);
        }

        res.json({ videos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/videos/:id
 * Get video details
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const video = await VideoModel.findById(id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.json({ video });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/videos/:id
 * Update video metadata (only if not uploaded)
 */
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, tags } = req.body;

    try {
        const video = await VideoModel.findById(id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        if (video.locked || video.status === 'uploaded') {
            return res.status(403).json({ error: 'Cannot edit uploaded video' });
        }

        const updates = {};
        if (title) updates.title = title;
        if (description) updates.description = description;
        if (tags) updates.tags = tags;

        const updated = await VideoModel.update(id, updates);
        console.log(`[Videos] ✅ Updated video: ${id}`);

        res.json({ video: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/videos/:id/thumbnail
 * Replace video thumbnail (only if not uploaded)
 */
router.post('/:id/thumbnail', async (req, res) => {
    const { id } = req.params;
    const { thumbnailUrl } = req.body;  // New thumbnail URL or base64

    try {
        const video = await VideoModel.findById(id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        if (video.locked || video.status === 'uploaded') {
            return res.status(403).json({ error: 'Cannot edit uploaded video' });
        }

        // In production, handle thumbnail upload/storage here
        const updated = await VideoModel.update(id, { thumbnailUrl });

        res.json({ video: updated, message: 'Thumbnail updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/videos/:id/upload-now
 * Trigger immediate upload to YouTube
 */
router.post('/:id/upload-now', async (req, res) => {
    const { id } = req.params;
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: 'Access token required' });
    }

    try {
        const video = await VideoModel.findById(id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        if (video.status !== 'ready') {
            return res.status(400).json({ error: `Video not ready for upload. Status: ${video.status}` });
        }

        // Note: In production, videoPath should be stored temporarily
        // For now, we'll assume it exists in temp directory
        const videoPath = `./temp/videos/${id}.mp4`;

        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Video file not found. It may have been cleaned up.' });
        }

        // Upload to YouTube
        await VideoModel.updateStatus(id, 'uploading');

        const result = await youtubeService.uploadVideo(
            videoPath,
            {
                title: video.title,
                description: video.description,
                tags: video.tags,
                scheduledPublishAt: video.scheduledPublishAt
            },
            accessToken,
            video.userId
        );

        // Mark as uploaded and lock for editing
        await VideoModel.markAsUploaded(id, result.videoId);

        // Cleanup video file
        fs.unlinkSync(videoPath);

        console.log(`[Videos] ✅ Uploaded video ${id} to YouTube: ${result.videoId}`);

        res.json({
            success: true,
            youtubeId: result.videoId,
            url: result.url,
            message: 'Video uploaded successfully'
        });

        // Trigger keep-ahead generation
        const videoWorker = req.app.get('videoWorker');
        if (videoWorker) {
            videoWorker.triggerForScheduler(video.schedulerId);
        }
    } catch (error) {
        // Mark as failed
        await VideoModel.updateStatus(id, 'failed', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/videos/:id
 * Delete video (only if not uploaded)
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const video = await VideoModel.findById(id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        if (video.status === 'uploaded') {
            return res.status(403).json({ error: 'Cannot delete uploaded video' });
        }

        // Capture schedulerId before deletion (wait, we have video object)
        const schedulerId = video.schedulerId;

        await VideoModel.delete(id);
        console.log(`[Videos] ✅ Deleted video: ${id}`);

        res.json({ success: true, message: 'Video deleted' });

        // Trigger keep-ahead generation
        const videoWorker = req.app.get('videoWorker');
        if (videoWorker) {
            videoWorker.triggerForScheduler(schedulerId);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
