const axios = require('axios');
const config = require('../config');

/**
 * Suno API Service
 * Uses sunoapi.org for music generation
 * 
 * Rate Limits:
 * - 20 requests per 10 seconds
 * - Concurrency limit: 20
 * 
 * API uses Bearer Token authentication
 */

class SunoService {
    constructor() {
        this.baseUrl = config.suno.baseUrl;
        this.serverApiKey = config.suno.apiKey;

        // Rate limiting
        this.requestTimestamps = [];
    }

    /**
     * Get API key (user's own for free tier, server's for pro)
     */
    getApiKey(userPlan, userSunoKey) {
        if (userPlan === 'pro') {
            return this.serverApiKey;
        }

        if (!userSunoKey) {
            throw new Error('Suno API key required. Please add your key in settings.');
        }

        return userSunoKey;
    }

    /**
     * Rate limiting check (20 requests per 10 seconds)
     */
    async checkRateLimit() {
        const now = Date.now();
        const tenSecondsAgo = now - 10000;

        // Remove old timestamps
        this.requestTimestamps = this.requestTimestamps.filter(ts => ts > tenSecondsAgo);

        if (this.requestTimestamps.length >= config.suno.rateLimit.requestsPer10Seconds) {
            const oldestRequest = this.requestTimestamps[0];
            const waitTime = 10000 - (now - oldestRequest);

            if (waitTime > 0) {
                console.log(`[Suno] Rate limit reached, waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // Clear and retry
            this.requestTimestamps = [];
        }

        this.requestTimestamps.push(now);
    }

    /**
     * Make authenticated request to Suno API
     */
    async makeRequest(endpoint, method = 'GET', data = null, apiKey) {
        await this.checkRateLimit();

        const url = `${this.baseUrl}${endpoint}`;

        try {
            const response = await axios({
                method,
                url,
                data,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            // Don't log 404s here, let the caller handle them (e.g. checkCredits)
            if (error.response?.status !== 404) {
                console.error('[Suno] API Error:', error.response?.data || error.message);
            }

            if (error.response?.status === 429) {
                throw new Error('Insufficient Suno credits. Please check your account.');
            }

            throw new Error(`Suno API failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Generate music from lyrics
     */
    async generateAudio(lyrics, genres, userPlan, userSunoKey) {
        const apiKey = this.getApiKey(userPlan, userSunoKey);

        console.log(`[Suno] Starting audio generation for genres: ${genres.join(', ')}`);

        const payload = {
            prompt: lyrics,
            customMode: true,  // Fixed: camelCase
            style: genres.join(', '),
            title: lyrics.substring(0, 50), // Title is required for customMode
            model: 'V4_5',  // Requested by user
            instrumental: false, // Fixed: camelCase 'instrumental' instead of 'make_instrumental'
            callBackUrl: `${config.backendUrl}/api/webhooks/suno` // Optional but good practice
        };

        const result = await this.makeRequest('/api/v1/generate', 'POST', payload, apiKey);

        // API returns { code: 200, msg: "success", data: { taskId: "..." } }
        if (!result || !result.data || !result.data.taskId) {
            // Check if it's a "soft" error (successful HTTP 200 but error code in body)
            if (result.code === 429) {
                throw new Error('Insufficient Suno credits. Please check your account.');
            }
            if (result.code && result.code !== 200) {
                throw new Error(`Suno API Error: ${result.msg || 'Unknown error'}`);
            }

            console.error('[Suno] Generation failed. Response:', JSON.stringify(result, null, 2));
            throw new Error('Invalid response from Suno API: Missing taskId');
        }

        const taskId = result.data.taskId; // Fixed: taskId instead of task_id
        console.log(`[Suno] Generation started, task ID: ${taskId}`);

        return taskId;
    }

    /**
     * Poll generation status until complete
     */
    async pollGenerationStatus(taskId, apiKey, maxAttempts = 60) {
        console.log(`[Suno] Polling status for task: ${taskId}`);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 5000));  // Wait 5 seconds

            // API uses GET variables (query params) for taskId
            const status = await this.makeRequest(`/api/v1/generate/record-info?taskId=${taskId}`, 'GET', null, apiKey);

            if (!status || !status.data) {
                console.warn(`[Suno] Invalid status response, attempt ${attempt + 1}`);
                continue;
            }

            // Status is now uppercase string (e.g. 'SUCCESS', 'PENDING')
            const state = status.data.status || 'unknown';
            console.log(`[Suno] Status: ${state}`);

            if (state === 'SUCCESS') {
                const sunoData = status.data.response?.sunoData?.[0];
                if (sunoData && sunoData.audioUrl) {
                    console.log(`[Suno] ✅ Generation complete!`);
                    return {
                        audioUrl: sunoData.audioUrl,
                        duration: sunoData.duration || 0,
                        imageUrl: sunoData.imageUrl,
                        title: sunoData.title
                    };
                }
            }

            if (state === 'GENERATE_AUDIO_FAILED' || state === 'CREATE_TASK_FAILED' || state === 'SENSITIVE_WORD_ERROR') {
                throw new Error(`Suno generation failed with status: ${state}`);
            }
        }

        throw new Error('Suno generation timeout (5 minutes)');
    }

    /**
     * Download generated audio file
     */
    async downloadAudio(audioUrl, outputPath) {
        console.log(`[Suno] Downloading audio from: ${audioUrl}`);

        const response = await axios({
            method: 'GET',
            url: audioUrl,
            responseType: 'stream'
        });

        const fs = require('fs');
        const writer = fs.createWriteStream(outputPath);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`[Suno] ✅ Audio downloaded to: ${outputPath}`);
                resolve(outputPath);
            });
            writer.on('error', reject);
        });
    }

    /**
     * Check remaining credits
     */
    async checkCredits(apiKey) {
        try {
            const result = await this.makeRequest('/api/v1/account/credits', 'GET', null, apiKey);
            return result.data?.credits || 0;
        } catch (error) {
            // If 404, endpoint might be changed/unavailable, assume unlimited or let generation fail naturally
            if (error.message.includes('404')) {
                console.warn('[Suno] Credits endpoint not found (404), skipping check.');
                return null;
            }
            console.warn('[Suno] Could not fetch credits:', error.message);
            return null;
        }
    }

    /**
     * Complete workflow: Generate and download audio
     */
    async generateAndDownload(lyrics, genres, outputPath, userPlan, userSunoKey) {
        const apiKey = this.getApiKey(userPlan, userSunoKey);

        // Check credits before generation
        const credits = await this.checkCredits(apiKey);
        if (credits !== null && credits < 1) {
            throw new Error('Insufficient Suno credits');
        }

        // Generate audio
        const taskId = await this.generateAudio(lyrics, genres, userPlan, userSunoKey);

        // Poll until complete
        const result = await this.pollGenerationStatus(taskId, apiKey);

        // Download audio file
        await this.downloadAudio(result.audioUrl, outputPath);

        return {
            audioPath: outputPath,
            duration: result.duration,
            audioUrl: result.audioUrl
        };
    }
}

module.exports = new SunoService();
