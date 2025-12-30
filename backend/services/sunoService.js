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
            console.error('[Suno] API Error:', error.response?.data || error.message);

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
            custom_mode: true,
            style: genres.join(', '),
            model: 'v4.5',  // Latest model
            make_instrumental: false,
            wait_audio: false  // We'll poll for completion
        };

        const result = await this.makeRequest('/api/v1/generate', 'POST', payload, apiKey);

        if (!result || !result.data || !result.data.task_id) {
            throw new Error('Invalid response from Suno API');
        }

        const taskId = result.data.task_id;
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

            const status = await this.makeRequest(`/api/v1/query/${taskId}`, 'GET', null, apiKey);

            if (!status || !status.data) {
                console.warn(`[Suno] Invalid status response, attempt ${attempt + 1}`);
                continue;
            }

            const progress = status.data.progress || 0;
            const state = status.data.status || 'unknown';

            console.log(`[Suno] Progress: ${progress}% - Status: ${state}`);

            if (state === 'complete' && status.data.audio_url) {
                console.log(`[Suno] ✅ Generation complete!`);
                return {
                    audioUrl: status.data.audio_url,
                    duration: status.data.duration || 0
                };
            }

            if (state === 'failed' || state === 'error') {
                throw new Error('Suno generation failed');
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
