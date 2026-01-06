const { google } = require('googleapis');
const config = require('../config');
const fs = require('fs');
const { QuotaTrackingModel } = require('../models');

/**
 * YouTube Data API v3 Service
 * 
 * Quota Limits:
 * - Daily quota: 10,000 units
 * - Video upload: 1,600 units
 * - Max uploads per day: 6 videos
 * 
 * Uses OAuth 2.0 for authentication
 */

class YouTubeService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            config.youtube.clientId,
            config.youtube.clientSecret,
            config.youtube.redirectUri
        );

        this.youtube = google.youtube({
            version: 'v3',
            auth: this.oauth2Client
        });
    }

    /**
     * Get OAuth consent URL
     */
    getAuthUrl(state) {
        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',  // Gets refresh token
            scope: config.youtube.scopes,
            prompt: 'consent',  // Force consent screen to get refresh token
            state: state
        });

        console.log('[YouTube] Generated OAuth URL');
        return authUrl;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCode(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            console.log('[YouTube] ✅ Tokens obtained');

            return {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date
            };
        } catch (error) {
            console.error('[YouTube] Token exchange failed:', error.message);
            throw new Error('Failed to exchange authorization code');
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken) {
        try {
            this.oauth2Client.setCredentials({
                refresh_token: refreshToken
            });

            const { credentials } = await this.oauth2Client.refreshAccessToken();
            console.log('[YouTube] ✅ Access token refreshed');

            return {
                accessToken: credentials.access_token,
                expiryDate: credentials.expiry_date
            };
        } catch (error) {
            console.error('[YouTube] Token refresh failed:', error.message);
            throw new Error('Failed to refresh access token');
        }
    }

    /**
     * Set OAuth credentials
     */
    setCredentials(accessToken) {
        this.oauth2Client.setCredentials({
            access_token: accessToken
        });
    }

    /**
     * Get user's YouTube channels
     */
    async getUserChannels(accessToken) {
        this.setCredentials(accessToken);

        try {
            const response = await this.youtube.channels.list({
                part: ['snippet', 'contentDetails', 'statistics'],
                mine: true
            });

            const channels = response.data.items.map(channel => ({
                id: channel.id,
                title: channel.snippet.title,
                description: channel.snippet.description,
                thumbnailUrl: channel.snippet.thumbnails.default.url,
                subscriberCount: channel.statistics.subscriberCount,
                videoCount: channel.statistics.videoCount
            }));

            console.log(`[YouTube] ✅ Retrieved ${channels.length} channels`);
            return channels;
        } catch (error) {
            console.error('[YouTube] Failed to fetch channels:', error.message);
            throw new Error('Failed to fetch YouTube channels');
        }
    }

    /**
     * Check if user can upload today (quota check)
     */
    async canUploadToday(userId) {
        return await QuotaTrackingModel.canUploadToday(userId);
    }

    /**
     * Upload video to YouTube
     */
    async uploadVideo(videoPath, metadata, accessToken, userId) {
        this.setCredentials(accessToken);

        // Check quota
        const canUpload = await this.canUploadToday(userId);
        if (!canUpload) {
            throw new Error('Daily upload limit reached (6 videos). YouTube API quota exhausted.');
        }

        const { title, description, tags, scheduledPublishAt } = metadata;

        // ALWAYS use delayed publishing (5 minutes from now or scheduled time)
        // This gives YouTube time to process the video before it goes public
        let publishAt;
        if (scheduledPublishAt) {
            // User scheduled a specific time
            publishAt = new Date(scheduledPublishAt);
        } else {
            // Instant upload: delay by 5 minutes
            publishAt = new Date(Date.now() + 5 * 60 * 1000);
        }

        // Privacy status is always private initially (YouTube makes it public at publishAt)
        const privacyStatus = 'private';

        try {
            console.log(`[YouTube] Uploading video: "${title}"`);
            console.log(`[YouTube] Will go public at: ${publishAt.toISOString()}`);

            const response = await this.youtube.videos.insert({
                part: ['snippet', 'status'],
                requestBody: {
                    snippet: {
                        title: title.substring(0, 100),  // YouTube limit
                        description: description.substring(0, 5000),  // YouTube limit
                        tags: tags.slice(0, 15),  // Max 15 tags (YouTube might allow more but 15 is safe)
                        categoryId: '10'  // Music category
                    },
                    status: {
                        privacyStatus,
                        publishAt: publishAt.toISOString(),
                        selfDeclaredMadeForKids: false,
                        license: 'youtube',  // Standard YouTube license
                        embeddable: true,
                        publicStatsViewable: true
                    }
                },
                media: {
                    body: fs.createReadStream(videoPath)
                }
            });

            const videoId = response.data.id;
            console.log(`[YouTube] ✅ Video uploaded successfully! ID: ${videoId}`);

            // Track quota usage
            await QuotaTrackingModel.incrementQuota(userId, config.youtube.quota.uploadCost);

            return {
                videoId,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                publishAt: publishAt.toISOString()
            };
        } catch (error) {
            console.error('[YouTube] Upload failed:', error.message);

            if (error.message.includes('quotaExceeded')) {
                throw new Error('YouTube API quota exceeded. Cannot upload more videos today.');
            }

            throw new Error(`YouTube upload failed: ${error.message}`);
        }
    }

    /**
     * Update video metadata (before upload only in our workflow, but kept for flexibility)
     */
    async updateVideo(videoId, metadata, accessToken) {
        this.setCredentials(accessToken);

        try {
            await this.youtube.videos.update({
                part: ['snippet'],
                requestBody: {
                    id: videoId,
                    snippet: {
                        title: metadata.title.substring(0, 100),
                        description: metadata.description.substring(0, 5000),
                        tags: metadata.tags.slice(0, 15),
                        categoryId: '10'
                    }
                }
            });

            console.log(`[YouTube] ✅ Video ${videoId} metadata updated`);
        } catch (error) {
            console.error('[YouTube] Update failed:', error.message);
            throw new Error(`Failed to update video: ${error.message}`);
        }
    }

    /**
     * Get quota usage for today
     */
    async getQuotaUsage(userId) {
        const quota = await QuotaTrackingModel.getTodayQuota(userId);

        return {
            quotaUsed: quota.quotaUsed,
            quotaLimit: config.youtube.quota.dailyLimit,
            videosUploaded: quota.videosUploaded,
            maxVideos: config.youtube.quota.maxUploadsPerDay,
            remainingVideos: Math.max(0, config.youtube.quota.maxUploadsPerDay - quota.videosUploaded)
        };
    }
}

module.exports = new YouTubeService();
