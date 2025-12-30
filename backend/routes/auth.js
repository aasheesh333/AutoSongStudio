const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtubeService');
const { UserModel } = require('../models');

/**
 * Authentication Routes
 * Handles YouTube OAuth 2.0 flow
 */

/**
 * GET /api/auth/youtube
 * Get OAuth consent URL
 */
router.get('/youtube', (req, res) => {
    try {
        const authUrl = youtubeService.getAuthUrl();
        res.json({ authUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/callback
 * OAuth callback endpoint
 * Redirects from Google OAuth
 */
router.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
    }

    try {
        // Exchange code for tokens
        const tokens = await youtubeService.exchangeCode(code);

        // Get user's YouTube channels
        const channels = await youtubeService.getUserChannels(tokens.accessToken);

        if (channels.length === 0) {
            return res.status(400).json({ error: 'No YouTube channels found for this account' });
        }

        // Get or create user (using first channel's email as identifier)
        // In production, you'd extract email from Google OAuth
        const channelId = channels[0].id;
        let user = await UserModel.findByEmail(channelId);  // Simplified: using channelId as email

        if (!user) {
            user = await UserModel.createUser({
                email: channelId,
                youtubeRefreshToken: tokens.refreshToken,
                plan: 'free'
            });
        } else {
            // Update refresh token
            await UserModel.update(user.id, {
                youtubeRefreshToken: tokens.refreshToken
            });
        }

        // Return user data and channels to frontend
        // In production, you'd set secure cookies or return JWT tokens
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                plan: user.plan
            },
            channels,
            tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            }
        });
    } catch (error) {
        console.error('[Auth] Callback error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
        const tokens = await youtubeService.refreshAccessToken(refreshToken);
        res.json({ accessToken: tokens.accessToken });
    } catch (error) {
        res.status(401).json({ error: 'Token refresh failed' });
    }
});

/**
 * GET /api/auth/channels
 * Get user's YouTube channels
 */
router.get('/channels', async (req, res) => {
    const { accessToken } = req.query;

    if (!accessToken) {
        return res.status(400).json({ error: 'Access token required' });
    }

    try {
        const channels = await youtubeService.getUserChannels(accessToken);
        res.json({ channels });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/signout
 * Sign out user (frontend should clear tokens)
 */
router.post('/signout', (req, res) => {
    // In production, invalidate tokens/sessions
    res.json({ success: true, message: 'Signed out successfully' });
});

module.exports = router;
