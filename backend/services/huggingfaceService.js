const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');

/**
 * HuggingFace Inference API Service
 * Uses Stable Diffusion for thumbnail generation
 * 
 * Rate Limits (Free Tier):
 * - 1,000 requests per day
 * - May return 503 when model is loading (requires retry)
 */

class HuggingFaceService {
    constructor() {
        this.token = config.huggingface.token;
        this.apiUrl = config.huggingface.apiUrl;
        this.model = config.huggingface.model;
        this.requestCount = 0;
    }

    /**
     * Optimize prompt for music thumbnails
     */
    optimizePrompt(genres, lyrics, title) {
        // Extract mood/theme from lyrics
        const lyricsSnippet = lyrics.substring(0, 200).toLowerCase();

        // Build visual description based on genres
        const genreVisuals = {
            'lofi': 'cozy anime-style room, warm sunset lighting, vinyl records, plants',
            'jazz': 'smoky nightclub, saxophone silhouette, noir lighting, city lights',
            'synthwave': 'retro 80s grid, neon pink and cyan, sun setting, palm trees',
            'ambient': 'ethereal clouds, peaceful mountains, soft pastel colors, calm water',
            'classical': 'elegant concert hall, grand piano, golden lighting',
            'trap': 'urban street art, graffiti, neon signs, city night',
            'phonk': 'dark urban aesthetic, purple smoke, car drift, night city',
            'deep house': 'beach sunset, abstract waves, purple and orange gradient',
            'acoustic': 'warm wooden guitar, natural lighting, forest background'
        };

        // Find matching genre visual
        let visual = 'abstract colorful music visualization, vibrant colors, artistic';
        for (const [genre, genreVisual] of Object.entries(genreVisuals)) {
            if (genres.some(g => g.toLowerCase().includes(genre))) {
                visual = genreVisual;
                break;
            }
        }

        const prompt = `high quality digital art, ${visual}, professional music cover art, 16:9 aspect ratio, no text, cinematic lighting, detailed, trending on artstation`;

        console.log(`[HuggingFace] Generated prompt: ${prompt}`);
        return prompt;
    }

    /**
     * Generate thumbnail with retry logic for 503 errors
     */
    async generateThumbnail(genres, lyrics, title, maxRetries = 5) {
        const prompt = this.optimizePrompt(genres, lyrics, title);

        this.requestCount++;
        if (this.requestCount > config.huggingface.rateLimit.requestsPerDay) {
            throw new Error('HuggingFace daily rate limit exceeded');
        }

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`[HuggingFace] Generating thumbnail (attempt ${attempt + 1}/${maxRetries})`);

                const response = await axios.post(
                    `${this.apiUrl}/${this.model}`,
                    {
                        inputs: prompt,
                        options: {
                            wait_for_model: true
                        }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.token}`,
                            'Content-Type': 'application/json'
                        },
                        responseType: 'arraybuffer',
                        timeout: 60000  // 60 second timeout
                    }
                );

                console.log(`[HuggingFace] ✅ Thumbnail generated successfully`);
                return Buffer.from(response.data);
            } catch (error) {
                const status = error.response?.status;

                if (status === 503) {
                    // Model is loading, wait and retry
                    const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);  // Exponential backoff, max 30s
                    console.log(`[HuggingFace] Model loading (503), retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                let errorMessage = error.message;
                if (error.response?.data) {
                    const data = error.response.data;
                    if (Buffer.isBuffer(data)) {
                        errorMessage = data.toString('utf8');
                    } else if (typeof data === 'object') {
                        errorMessage = JSON.stringify(data);
                    } else {
                        errorMessage = data;
                    }
                }

                console.error(`[HuggingFace] API Error (${status}):`, errorMessage);
                throw new Error(`HuggingFace API failed: ${errorMessage}`);
            }
        }

        throw new Error('HuggingFace thumbnail generation timeout after retries');
    }

    /**
     * Save thumbnail to file
     */
    async saveThumbnail(imageBuffer, outputPath) {
        const fs = require('fs');

        return new Promise((resolve, reject) => {
            fs.writeFile(outputPath, imageBuffer, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`[HuggingFace] ✅ Thumbnail saved to: ${outputPath}`);
                    resolve(outputPath);
                }
            });
        });
    }

    /**
     * Generate and save thumbnail
     */
    async generateAndSave(genres, lyrics, title, outputPath) {
        const imageBuffer = await this.generateThumbnail(genres, lyrics, title);
        await this.saveThumbnail(imageBuffer, outputPath);
        return outputPath;
    }
}

module.exports = new HuggingFaceService();
