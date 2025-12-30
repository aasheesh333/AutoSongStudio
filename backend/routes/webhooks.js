const express = require('express');
const router = express.Router();
const { VideoModel } = require('../models');

/**
 * Video Deletion Webhook
 * Triggers keep-ahead logic when user deletes a video
 */

/**
 * POST /api/webhooks/video-deleted
 * Called when user deletes a video from mobile app
 */
router.post('/video-deleted', async (req, res) => {
    const { videoId, schedulerId } = req.body;

    if (!videoId || !schedulerId) {
        return res.status(400).json({ error: 'videoId and schedulerId required' });
    }

    try {
        console.log(`[Webhook] Video deleted: ${videoId} from scheduler: ${schedulerId}`);
        console.log(`[Webhook] Keep-ahead logic will auto-generate replacement video`);

        // The video generation worker will automatically detect missing video
        // and generate a new one in its next cycle (every 2 minutes)

        res.json({
            success: true,
            message: 'Video deletion processed. Replacement video will be generated automatically.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
