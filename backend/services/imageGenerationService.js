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
     * Detect main character from lyrics and title for targeted thumbnail generation
     * Returns visual description of the main subject for the thumbnail
     */
    detectMainCharacter(lyrics, title, genres) {
        const text = `${title} ${lyrics}`.toLowerCase();
        const genreText = genres.join(' ').toLowerCase();

        // DEITY DETECTION - Specific Hindu deities with detailed visual descriptions
        const deityKeywords = {
            // Khatu Shyam / Shyam Baba
            'khatu shyam': 'majestic divine figure of Khatu Shyam Ji, blue-skinned deity with golden crown, standing in ancient temple with divine golden light rays, peacock feathers, devotees in prayer, sacred saffron atmosphere',
            'khatushyam': 'majestic divine figure of Khatu Shyam Ji, blue-skinned deity with golden crown, ancient temple backdrop, divine aura, peacock feathers decoration, spiritual devotion scene',
            'shyam baba': 'divine Shyam Baba figure, blue deity with serene expression, golden ornaments, temple architecture background, evening aarti lamps, devotional atmosphere',
            'barbarik': 'warrior deity Barbarik with three arrows, majestic royal appearance, divine golden armor, Himalayan backdrop, heroic pose, mythological setting',

            // Krishna
            'krishna': 'ethereal Lord Krishna playing divine flute, mesmerizing blue skin with golden jewelry, peacock feather crown, standing by lotus pond under moonlight, radiant divine glow, enchanting smile',
            'kanha': 'adorable baby Krishna, cute divine child with butter pot, playful expression, golden ornaments, village of Vrindavan backdrop, cows and peacocks, warm sunset',
            'gopal': 'young cowherd Krishna surrounded by cows, pastoral Vrindavan landscape, flute in hand, peacock feather crown, golden hour lighting, divine pastoral scene',
            'radha krishna': 'divine couple Radha and Krishna in eternal love, Radha in pink saree, Krishna with flute, enchanted forest of Vrindavan, lotus flowers, moonlit romantic atmosphere, celestial beauty',
            'radhe': 'beautiful Radha Rani in elegant pink and gold attire, divine beauty, lotus in hand, Yamuna river backdrop, golden temple, devotional grace, ethereal glow',

            // Shiva
            'shiva': 'majestic Lord Shiva in deep meditation, blue throat (Neelkanth), third eye, crescent moon in matted locks, snow-covered Kailash mountain, Ganga flowing from hair, trishul and damru, serpent Vasuki, divine cosmic energy',
            'mahadev': 'powerful Mahadev form of Shiva, cosmic destroyer and creator, Nataraja dance pose, ring of fire, universe in backdrop, ash-covered body, divine masculine energy',
            'bholenath': 'gentle Bholenath sitting in peaceful meditation, simple ash-covered form, rudraksha beads, cannabis leaves, devotees seeking blessings, Himalayan cave ashram, dim lamp lighting',
            'shankar': 'graceful Lord Shankar with Goddess Parvati, divine couple on Mount Kailash, tiger skin, trishul, snow peaks, peaceful family scene with Ganesha and Kartikeya',

            // Hanuman
            'hanuman': 'mighty Lord Hanuman in heroic flying pose, glowing orange-gold body, massive muscular form, carrying Dronagiri mountain, Ram naam on chest, sunrise over mountains, divine warrior energy',
            'bajrangbali': 'powerful Bajrangbali with golden mace (gada), muscular divine form, devotion in eyes, temple bells, saffron flags, strength and devotion symbolism',
            'maruti': 'dynamic Maruti in action pose, flying through clouds, serving Lord Ram, orange hues, wind god son, speed and power visualization',

            // Ganesha
            'ganesh': 'beloved Lord Ganesha with elephant head, seated on lotus throne, modak sweets, mouse vehicle, broken tusk, writing Mahabharata, auspicious red and gold colors, prosperity symbols',
            'ganapati': 'dancing Ganapati in celebration, large belly and gentle eyes, four arms with various mudras, blessings pose, festive Ganesh Chaturthi atmosphere, flowers and lamps',
            'vighnaharta': 'wise Vighnaharta removing obstacles, serene elephant-headed deity, scholar pose with books, blessing devotees, golden crown and jewelry, divine wisdom',

            // Durga
            'durga': 'fierce Goddess Durga riding lion, ten arms wielding divine weapons, slaying demon Mahishasura, red and gold saree, third eye blazing, cosmic battle scene, powerful feminine divine energy',
            'mata rani': 'benevolent Mata Rani showering blessings, beautiful divine mother, multiple arms with weapons and lotus, lion mount, red saree, devotees receiving grace, temple setting',
            'sherawali': 'triumphant Sherawali Maa on lion mount, victorious pose over evil, red and gold attire, fierce protective mother aspect, Navratri celebration atmosphere',

            // Lakshmi
            'lakshmi': 'gracious Goddess Lakshmi seated on lotus, gold coins flowing, four arms with lotus flowers, elephant bathing her, prosperity and wealth symbols, pink lotus pond, divine beauty and abundance',
            'mahalaxmi': 'resplendent Mahalaxmi in red and gold, standing on lotus, blessing devotees with wealth, golden temple background, oil lamps, Diwali celebration atmosphere',

            // Ram
            'ram': 'noble Lord Ram with divine bow, princely blue skin, golden crown, Sita and Lakshman beside, Ayodhya kingdom backdrop, righteousness personified, regal bearing',
            'sita ram': 'divine couple Sita and Ram, ideal husband-wife, forest exile scene or royal court, Hanuman in devotion, epic Ramayana visualization',

            // Other deities
            'saraswati': 'graceful Goddess Saraswati on white lotus, playing veena, swan vehicle, white pure attire, books and knowledge symbols, peaceful wisdom emanation',
            'vishnu': 'supreme Lord Vishnu reclining on Sheshnag serpent, blue skin, four arms with conch shell chakra mace lotus, cosmic ocean, Lakshmi at feet, divine preservation aspect',
            'kartikeya': 'handsome warrior god Kartikeya on peacock, spear (vel) in hand, six heads, divine army commander, South Indian temple style, victory over demons'
        };

        // Check for deity keywords
        for (const [deity, visual] of Object.entries(deityKeywords)) {
            if (text.includes(deity)) {
                console.log(`[ImageGen] Detected deity character: ${deity}`);
                return { type: 'deity', visual };
            }
        }

        // Check for general devotional/bhajan without specific deity
        if (genreText.includes('devotional') || genreText.includes('bhajan') || text.includes('bhagwan') || text.includes('prabhu') || text.includes('mandir')) {
            console.log('[ImageGen] Detected general devotional theme');
            return {
                type: 'devotional',
                visual: 'serene devotional scene, ancient temple silhouette at golden sunrise, divine light rays through clouds, oil lamps (diyas), devotees in prayer, saffron and golden atmosphere, spiritual peace'
            };
        }

        // ROMANTIC COUPLE DETECTION
        const coupleKeywords = ['tum aur main', 'hum dono', 'tere sang', 'saath', 'couple', 'jodi', 'dulhan', 'shaadi', 'wedding', 'love story', 'romance'];
        for (const keyword of coupleKeywords) {
            if (text.includes(keyword)) {
                console.log('[ImageGen] Detected romantic couple theme');
                return {
                    type: 'couple',
                    visual: 'romantic couple silhouette at golden sunset, man and woman in love, holding hands, cinematic lighting, dreamy bokeh, warm golden hour, emotional connection, love story atmosphere'
                };
            }
        }

        // FEMALE PROTAGONIST DETECTION
        const femaleKeywords = ['ladki', 'larki', 'girl', 'she', 'her', 'wo', 'uski', 'naari', 'aurat', 'beti', 'girlfriend', 'patni', 'wife', 'meri jaan', 'jaanu'];
        const femaleEmotions = ['roti', 'royee', 'tanhai', 'akeli', 'miss her', 'bichhad', 'judai'];

        for (const keyword of [...femaleKeywords, ...femaleEmotions]) {
            if (text.includes(keyword)) {
                // Check if sad/melancholic
                if (text.includes('sad') || text.includes('roti') || text.includes('aansu') || text.includes('dard') || text.includes('tanhai')) {
                    console.log('[ImageGen] Detected sad female protagonist');
                    return {
                        type: 'female_sad',
                        visual: 'beautiful young Indian woman alone, melancholic expression, tears glistening, looking out rainy window, blue-grey tones, emotional depth, soft lighting, loneliness and heartbreak, cinematic portrait'
                    };
                }
                console.log('[ImageGen] Detected female protagonist');
                return {
                    type: 'female',
                    visual: 'beautiful young Indian woman, elegant traditional or modern attire, expressive eyes, graceful pose, warm golden lighting, portrait style, emotional depth, cinematic beauty shot'
                };
            }
        }

        // MALE PROTAGONIST DETECTION
        const maleKeywords = ['ladka', 'larka', 'boy', 'he', 'his', 'uska', 'aadmi', 'boyfriend', 'pati', 'husband'];
        const maleEmotions = ['rota', 'roya', 'akela', 'tanha'];

        for (const keyword of [...maleKeywords, ...maleEmotions]) {
            if (text.includes(keyword)) {
                if (text.includes('sad') || text.includes('rota') || text.includes('dard') || text.includes('tanha')) {
                    console.log('[ImageGen] Detected sad male protagonist');
                    return {
                        type: 'male_sad',
                        visual: 'handsome young Indian man alone, contemplative sad expression, sitting by window at night, city lights in background, emotional vulnerability, blue tones, cinematic portrait, heartbreak visualization'
                    };
                }
                console.log('[ImageGen] Detected male protagonist');
                return {
                    type: 'male',
                    visual: 'handsome young Indian man, stylish modern or traditional attire, confident yet emotional expression, urban or natural backdrop, warm cinematic lighting, portrait style'
                };
            }
        }

        // Default - abstract music visualization
        console.log('[ImageGen] No specific character detected, using abstract theme');
        return {
            type: 'abstract',
            visual: 'abstract artistic music visualization, dynamic sound waves, vibrant colors, emotional energy flow, professional album art aesthetic'
        };
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
            ? `concept inspired by "${randomLyricLine.substring(0, 40)}"`
            : '';

        // Genre-specific visuals (including Indian/Bollywood and devotional)
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
            'bollywood': 'cinematic Indian aesthetic, vibrant colors, dramatic lighting, emotional depth, royal palace background',
            'hindi': 'romantic Indian setting, marigold flowers, warm golden hour, cultural richness',
            'romantic': 'sunset silhouette of couple, warm golden tones, dreamy atmosphere, soft bokeh',
            'pop': 'vibrant modern aesthetic, dynamic colors, stylish urban setting, bright energy',
            'rock': 'electric guitar close-up, stage lights, dramatic smoke effects, powerful energy',
            'edm': 'colorful laser lights, festival crowd silhouette, electric atmosphere',
            'rnb': 'smooth urban night, city lights reflection, intimate mood lighting',
            'soul': 'warm studio lighting, vinyl records, vintage microphone, authentic emotion',
            'hiphop': 'urban street culture, graffiti murals, authentic vibe, streetwear aesthetic',
            'sad': 'rainy window, melancholic blue tones, solitary figure, emotional atmosphere',
            'happy': 'bright sunshine, vibrant flowers, joyful colors, celebration mood',
            'devotional': 'temple silhouette at sunrise, divine light rays, peaceful spiritual atmosphere, saffron tones',
            'meditation': 'zen garden, stones and water, soft green nature, peaceful balance',
            // Deity-specific themes
            'khatushyam': 'ancient temple architecture, divine golden light rays, peacock feathers motif, saffron and gold palette, himalayan mountain backdrop, spiritual aura',
            'khatu shyam': 'ancient temple architecture, divine golden light rays, peacock feathers motif, saffron and gold palette, himalayan mountain backdrop, spiritual aura',
            'shyam': 'mystical blue twilight sky, peacock feather silhouette, divine golden glow, temple bells aesthetic, spiritual tranquility',
            'krishna': 'enchanting flute silhouette, moonlit night, lotus pond, peacock feathers, divine blue ethereal glow, yamuna river backdrop',
            'shiva': 'himalayan mountain peaks with snow, crescent moon, trishul silhouette, mystic blue energy, sacred om symbol, meditation aesthetic',
            'hanuman': 'sunrise over mountains, orange saffron hues, strength and devotion symbols, ancient temple architecture, divine warrior aesthetic',
            'ganesh': 'auspicious beginnings, lotus flowers, modak sweets silhouette, traditional lamp lighting, prosperity and wisdom symbols',
            'durga': 'powerful divine feminine energy, lion silhouette, red and gold palette, victory over evil aesthetic, dramatic lighting',
            'lakshmi': 'golden lotus flowers, flowing river of gold coins, prosperity aesthetic, divine radiance, elegant traditional patterns',
            'bhajan': 'traditional diya lamps, temple bells silhouette, evening aarti atmosphere, warm golden lighting, devotional serenity',
            'spiritual': 'abstract cosmic mandala, chakra energy visualization, sacred geometry patterns, divine light emanation, transcendental aesthetic'
        };

        // EXTREME VARIETY GENERATORS
        const cameras = [
            'cinematic 35mm lens, f/1.8', 'drone aerial shot', 'GoPro wide angle action', 'macro close-up detail',
            'Sony A7R IV photography', 'vintage Polaroid style', 'fisheye lens distortion', 'telephoto compression',
            'double exposure photography', 'tilt-shift miniature effect'
        ];

        const lightings = [
            'golden hour soft sunlight', 'neon cyberpunk city glow', 'moody volumetric fog and shafts of light',
            'studio softbox professional lighting', 'bioluminescent magical glow', 'dramatic noir high contrast shadows',
            'warm candlelight atmosphere', 'cold blue moonlight', 'colorful stage concert lighting', 'natural dappled forest light'
        ];

        const artStyles = [
            'hyperrealistic 8k render', 'digital artstation masterpiece', 'oil painting texture with heavy brushstrokes',
            'vaporwave retro aesthetic', 'dark fantasy concept art', 'minimalist vector flat design',
            'watercolor painting style', 'cyberpunk futuristic 2077', 'surrealist dreamscape like Dali', 'anime Makoto Shinkai style'
        ];

        const moods = [
            'mysterious and foggy', 'energetic and dynamic', 'peaceful and serene', 'dark and gritty',
            'romantic and dreamy', 'nostalgic and vintage', 'futuristic and clean', 'chaotic and colorful'
        ];

        // Randomly select elements
        const randomCamera = cameras[Math.floor(Math.random() * cameras.length)];
        const randomLighting = lightings[Math.floor(Math.random() * lightings.length)];
        const randomStyle = artStyles[Math.floor(Math.random() * artStyles.length)];
        const randomMood = moods[Math.floor(Math.random() * moods.length)];

        // Find matching genre visual - check genres, title, AND lyrics for keywords
        let genreVisual = 'abstract artistic music visualization, vibrant professional colors';
        const searchText = [
            ...genres.map(g => g.toLowerCase()),
            title.toLowerCase(),
            lyrics.toLowerCase().substring(0, 200)  // First 200 chars of lyrics
        ].join(' ');

        for (const [genre, visual] of Object.entries(genreVisuals)) {
            if (searchText.includes(genre)) {
                genreVisual = visual;
                console.log(`[ImageGen] Matched theme: ${genre}`);
                break;
            }
        }

        // MAIN CHARACTER DETECTION - Primary subject for the thumbnail
        const character = this.detectMainCharacter(lyrics, title, genres);
        let mainVisual;

        if (character.type !== 'abstract') {
            // Character detected - use as PRIMARY visual (takes priority over genre)
            mainVisual = character.visual;
            console.log(`[ImageGen] Using character visual (${character.type}): ${mainVisual.substring(0, 50)}...`);
        } else {
            // No character detected - use genre visual
            mainVisual = genreVisual;
        }

        // HIGH QUALITY MODIFIERS for professional thumbnails
        const qualityModifiers = [
            'masterpiece', 'award-winning digital art', 'ultra detailed', '8K UHD',
            'professional YouTube thumbnail', 'trending on artstation',
            'photorealistic', 'cinematic composition', 'dramatic lighting'
        ].join(', ');

        // Final Prompt Construction (Character-first for better thumbnails)
        // Character visual is the PRIMARY focus, supplemented by style and mood
        const prompt = `${qualityModifiers}, ${mainVisual}, ${emotionalContext}, ${randomStyle}, ${randomLighting}, ${randomMood}, ${lyricVisual}, highly detailed, emotionally evocative, professional album art, ((absolutely no text)), ((no words)), ((no letters)), ((no typography)), ((no writing)), no watermark, no signature, no logos`;

        console.log(`[ImageGen] Final prompt: ${prompt.substring(0, 120)}...`);
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
