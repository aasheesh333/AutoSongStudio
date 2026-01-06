const axios = require('axios');
const fs = require('fs');

/**
 * Image Generation Service using Pollinations.ai
 * 
 * Pollinations.ai is a 100% FREE, no-API-key image generation service
 * using Stable Diffusion models.
 * 
 * Benefits:
 * - No rate limits
 * - No API key required
 * - No credits to manage
 * - High quality output
 */

class ImageGenerationService {
    constructor() {
        this.baseUrl = 'https://image.pollinations.ai/prompt';
    }

    /**
     * Extract emotional keywords from lyrics to enhance image quality
     */
    extractEmotion(lyrics) {
        const lyricsLower = lyrics.toLowerCase();

        // Emotional keyword mapping
        const emotionKeywords = {
            // Love & Romance
            'love': 'romantic, warm colors, soft lighting, intimate atmosphere',
            'pyar': 'romantic sunset, warm golden tones, dreamy atmosphere',
            'dil': 'heart, emotional depth, soft focus, warm embrace',
            'ishq': 'passionate, deep reds and purples, intense emotion',

            // Sadness & Longing
            'sad': 'melancholic, blue tones, rain, lonely atmosphere',
            'miss': 'nostalgic, faded colors, memories, longing',
            'alone': 'solitary figure, vast empty space, contemplative',
            'tears': 'emotional, rain drops, reflective surfaces',

            // Joy & Celebration
            'happy': 'vibrant colors, celebration, bright lighting',
            'dance': 'dynamic movement, colorful lights, energy',
            'party': 'festive atmosphere, neon lights, celebration',

            // Peace & Spirituality
            'peace': 'serene, nature, calm water, soft sunlight',
            'soul': 'spiritual, ethereal glow, transcendent atmosphere',
            'divine': 'heavenly light, clouds, golden rays',

            // Night & Urban
            'night': 'city lights, neon glow, urban atmosphere',
            'raat': 'moonlit night, stars, peaceful darkness',
            'city': 'urban skyline, glowing windows, street lights'
        };

        // Find matching emotions
        let emotionalContext = '';
        for (const [keyword, visual] of Object.entries(emotionKeywords)) {
            if (lyricsLower.includes(keyword)) {
                emotionalContext = visual;
                break;
            }
        }

        return emotionalContext || 'emotional depth, artistic expression, cinematic mood';
    }

    /**
     * Generate optimized prompt for music cover art with MAXIMUM variety
     * Each thumbnail should be unique - uses lyrics context and timestamp seed
     */
    generatePrompt(genres, lyrics, title) {
        // Extract emotion from lyrics
        const emotionalContext = this.extractEmotion(lyrics);

        // VARIETY: Extract a random line from lyrics to inspire the image
        const lyricsLines = lyrics.split('\n').filter(l => l.trim().length > 10);
        const randomLyricLine = lyricsLines.length > 0
            ? lyricsLines[Math.floor(Math.random() * lyricsLines.length)].trim()
            : '';

        // Convert lyric line to visual concept (avoid using actual text)
        const lyricVisual = randomLyricLine.length > 0
            ? `inspired by the concept: "${randomLyricLine.substring(0, 50)}"`
            : '';

        // Genre-specific visuals (including Indian/Bollywood)
        const genreVisuals = {
            'lofi': 'cozy anime room, warm sunset through window, vinyl records, indoor plants, soft lo-fi aesthetic',
            'jazz': 'smoky jazz club, saxophone silhouette, noir atmosphere, city lights through window',
            'synthwave': 'retro 80s neon grid, pink and cyan sunset, palm trees, retrofuturistic',
            'ambient': 'ethereal cloudscape, peaceful mountains, soft pastel aurora, calm reflective water',
            'classical': 'grand concert hall, elegant piano, golden chandelier lighting, velvet curtains',
            'trap': 'urban street art, neon graffiti walls, city night scene, bold contrasting colors',
            'phonk': 'dark urban drifting cars, purple and red smoke effects, night city skyline',
            'deep house': 'tropical beach sunset, ocean waves crashing, purple orange gradient sky',
            'acoustic': 'wooden guitar by window, natural forest light, cozy cabin atmosphere',
            'bollywood': 'cinematic Indian aesthetic, vibrant colors, dramatic lighting, emotional depth',
            'hindi': 'romantic Indian setting, marigold flowers, warm golden hour, cultural richness',
            'romantic': 'sunset silhouette of couple, warm golden tones, dreamy atmosphere, soft bokeh',
            'pop': 'vibrant modern aesthetic, dynamic colors, stylish urban setting, bright energy',
            'rock': 'electric guitar close-up, stage lights, dramatic smoke effects, powerful energy',
            'edm': 'colorful laser lights, festival crowd silhouette, electric atmosphere',
            'rnb': 'smooth urban night, city lights reflection, intimate mood lighting',
            'soul': 'warm studio lighting, vinyl records, vintage microphone, authentic emotion',
            'hiphop': 'urban street culture, graffiti murals, authentic vibe, streetwear aesthetic',
            'sad': 'rainy window, melancholic blue tones, solitary figure, emotional atmosphere',
            'happy': 'bright sunshine, vibrant flowers, joyful colors, celebration mood'
        };

        // MORE random visual elements for variety
        const randomElements = [
            'golden hour lighting with lens flare',
            'blue hour mood, twilight atmosphere',
            'dramatic silhouette against sunset',
            'soft pastel color palette',
            'vibrant neon accents and reflections',
            'misty atmospheric fog',
            'cinematic depth of field, bokeh',
            'ethereal glowing particles',
            'moody contrasting shadows',
            'dreamy double exposure effect',
            'abstract geometric overlays',
            'flowing silk fabric texture',
            'rain droplets on glass',
            'starry night sky background',
            'aurora borealis northern lights',
            'underwater light rays'
        ];

        // Find matching genre visual
        let genreVisual = 'abstract artistic music visualization, vibrant professional colors';
        for (const [genre, visual] of Object.entries(genreVisuals)) {
            if (genres.some(g => g.toLowerCase().includes(genre))) {
                genreVisual = visual;
                break;
            }
        }

        // Pick MULTIPLE random elements for more variety
        const randomElement1 = randomElements[Math.floor(Math.random() * randomElements.length)];
        const randomElement2 = randomElements[Math.floor(Math.random() * randomElements.length)];

        // Construct highly varied prompt - STRICTLY NO TEXT
        const prompt = `masterpiece, award-winning digital art, ${genreVisual}, ${emotionalContext}, ${randomElement1}, ${randomElement2}, ${lyricVisual}, professional music album cover, cinematic composition, dramatic lighting, 8k ultra HD, trending on artstation, emotionally evocative, ((absolutely no text)), ((no words)), ((no letters)), ((no typography)), ((no writing)), no watermark, no signature, no logos`;

        console.log(`[ImageGen] Generated unique prompt with seed context`);
        return prompt;
    }

    /**
     * Generate thumbnail using Pollinations.ai
     */
    async generateThumbnail(genres, lyrics, title, maxRetries = 3) {
        const prompt = this.generatePrompt(genres, lyrics, title);

        // URL encode the prompt
        const encodedPrompt = encodeURIComponent(prompt);

        // Add random seed for variety (different image each time)
        const seed = Math.floor(Math.random() * 1000000);

        // Pollinations.ai image URL with parameters for quality
        // width=1280, height=720 for 16:9 aspect ratio (YouTube thumbnail)
        const imageUrl = `${this.baseUrl}/${encodedPrompt}?width=1280&height=720&nologo=true&seed=${seed}`;

        console.log(`[ImageGen] Requesting image from Pollinations.ai...`);

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`[ImageGen] Generating thumbnail (attempt ${attempt + 1}/${maxRetries})`);

                const response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000,  // 2 minute timeout (image generation can take time)
                    headers: {
                        'User-Agent': 'AutoSongStudio/1.0'
                    }
                });

                console.log(`[ImageGen] ✅ Thumbnail generated successfully`);
                return Buffer.from(response.data);
            } catch (error) {
                console.error(`[ImageGen] Error (attempt ${attempt + 1}):`, error.message);

                if (attempt < maxRetries - 1) {
                    const waitTime = 5000 * (attempt + 1);  // 5s, 10s, 15s
                    console.log(`[ImageGen] Retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                throw new Error(`Image generation failed after ${maxRetries} attempts: ${error.message}`);
            }
        }
    }

    /**
     * Save thumbnail to file
     */
    async saveThumbnail(imageBuffer, outputPath) {
        return new Promise((resolve, reject) => {
            fs.writeFile(outputPath, imageBuffer, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`[ImageGen] ✅ Thumbnail saved to: ${outputPath}`);
                    resolve(outputPath);
                }
            });
        });
    }

    /**
     * Generate and save thumbnail (main entry point)
     */
    async generateAndSave(genres, lyrics, title, outputPath) {
        const imageBuffer = await this.generateThumbnail(genres, lyrics, title);
        await this.saveThumbnail(imageBuffer, outputPath);
        return outputPath;
    }
}

module.exports = new ImageGenerationService();
