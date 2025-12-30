const express = require('express');
const router = express.Router();
const { UserModel } = require('../models');
const youtubeService = require('../services/youtubeService');
const config = require('../config');

/**
 * Settings Routes
 * User settings and plan management
 */

/**
 * GET /api/settings
 * Get user settings and plan info
 */
router.get('/', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const planConfig = config.plans[user.plan] || config.plans.free;

        res.json({
            user: {
                id: user.id,
                email: user.email,
                plan: user.plan,
                videosThisMonth: user.videosThisMonth || 0,
                schedulersCount: user.schedulersCount || 0
            },
            planLimits: {
                maxSchedulers: planConfig.maxSchedulers,
                maxVideosPerDay: planConfig.maxVideosPerDay,
                requiresOwnSunoKey: planConfig.requiresOwnSunoKey,
                adsEnabled: planConfig.adsEnabled
            },
            sunoKeyRequired: planConfig.requiresOwnSunoKey && !user.sunoApiKey
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/settings/suno-key
 * Update Suno API key (free tier only)
 */
router.put('/suno-key', async (req, res) => {
    const { userId, sunoApiKey } = req.body;

    if (!userId || !sunoApiKey) {
        return res.status(400).json({ error: 'userId and sunoApiKey required' });
    }

    try {
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.plan !== 'free') {
            return res.status(403).json({ error: 'Pro users do not need to provide Suno API key' });
        }

        // In production, encrypt before storing
        await UserModel.update(userId, { sunoApiKey });

        console.log(`[Settings] ✅ Updated Suno API key for user: ${userId}`);
        res.json({ success: true, message: 'Suno API key updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/settings/quota
 * Get current month's video quota usage
 */
router.get('/quota', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const usage = await youtubeService.getQuotaUsage(userId);

        res.json({
            today: usage,
            monthly: {
                videosGenerated: (await UserModel.findById(userId)).videosThisMonth || 0,
                limit: config.plans.free.maxVideosPerDay * 30  // Rough monthly estimate
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/upgrade
 * Initiate plan upgrade flow (placeholder)
 */
router.post('/upgrade', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        // In production, integrate with payment processor (Stripe, etc.)
        // For now, return placeholder
        res.json({
            message: 'Upgrade flow not implemented',
            upgradeUrl: `${config.baseUrl}/upgrade`,
            plans: {
                pro: {
                    price: '$9.99/month',
                    features: [
                        'Up to 20 schedulers',
                        'Server-provided Suno API key',
                        'No ads',
                        'Priority support'
                    ]
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
