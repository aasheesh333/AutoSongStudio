const express = require('express');
const router = express.Router();
const { UserModel } = require('../models');

/**
 * User Activity Routes
 * Handles heartbeat for 24-hour engagement rule and channel selection
 */

/**
 * POST /api/user/heartbeat
 * Called when user opens the app - updates lastActiveAt
 */
router.post('/heartbeat', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await UserModel.update(userId, { lastActiveAt: new Date() });
        console.log(`[User] ✅ Heartbeat received for user: ${userId}`);
        res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('[User] Heartbeat error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/user/select-channel
 * Save user's selected channel preference
 */
router.post('/select-channel', async (req, res) => {
    const { userId, channelId } = req.body;

    if (!userId || !channelId) {
        return res.status(400).json({ error: 'userId and channelId required' });
    }

    try {
        await UserModel.update(userId, { selectedChannelId: channelId });
        console.log(`[User] ✅ Channel selected: ${channelId} for user: ${userId}`);
        res.json({ success: true, selectedChannelId: channelId });
    } catch (error) {
        console.error('[User] Select channel error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/user/profile
 * Get user profile with stored channels and preferences
 */
router.get('/profile', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                plan: user.plan,
                channels: user.channels || [],
                selectedChannelId: user.selectedChannelId,
                lastActiveAt: user.lastActiveAt,
                sunoApiKey: user.sunoApiKey ? '***' : null  // Mask the key
            }
        });
    } catch (error) {
        console.error('[User] Get profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
