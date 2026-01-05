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

// GET /api/videos
router.get('/', async (req, res) => {
    const { userId, channelId, schedulerId, status, limit = 50 } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        let videos;
        if (schedulerId) videos = await VideoModel.findByScheduler(schedulerId, parseInt(limit));
        else videos = await VideoModel.findByUser(userId, channelId, status);
        res.json({ videos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/videos/:id
router.get('/:id', async (req, res) => {
    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Video not found' });
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

        // DELETE FILES (Retention Policy)
        deleteVideoFiles(video);

        await VideoModel.delete(req.params.id);
        console.log(`[Videos] Deleted video ${req.params.id} and its files.`);

        res.json({ success: true, message: 'Video deleted' });

        // Trigger keep-ahead
        const videoWorker = req.app.get('videoWorker');
        if (videoWorker) videoWorker.triggerForScheduler(video.schedulerId);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/videos/:id/upload-now
router.post('/:id/upload-now', async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Token required' });

    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Not found' });

        let videoPath = video.videoPath;
        if (!videoPath || !fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Video file not found via path' });
        }

        await VideoModel.updateStatus(video.id, 'uploading');

        const result = await youtubeService.uploadVideo(
            videoPath,
            { title: video.title, description: video.description, tags: video.tags, scheduledPublishAt: video.scheduledPublishAt },
            accessToken,
            video.userId
        );

        await VideoModel.markAsUploaded(video.id, result.videoId);

        // CLEANUP FILES (Retention Policy)
        deleteVideoFiles(video);

        res.json({ success: true, youtubeId: result.videoId, url: result.url });

        const videoWorker = req.app.get('videoWorker');
        if (videoWorker) videoWorker.triggerForScheduler(video.schedulerId);

    } catch (error) {
        await VideoModel.updateStatus(req.params.id, 'failed', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
