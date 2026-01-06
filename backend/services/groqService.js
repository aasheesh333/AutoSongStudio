const axios = require('axios');
const config = require('../config');

/**
 * Groq API Service
 * Uses llama-3.3-70b-versatile for content generation
 * 
 * Rate Limits:
 * - 30 requests/minute
 * - 12,000 tokens/minute
 * - 1,000 requests/day
 * - 100,000 tokens/day
 */

class GroqService {
    constructor() {
        this.apiKey = config.groq.apiKey;
        this.apiUrl = config.groq.apiUrl;
        this.model = config.groq.model;

        // Simple rate limiting tracking
        this.requestCount = 0;
        this.lastResetTime = Date.now();
    }

    /**
     * Make a request to Groq API with rate limiting
     */
    async makeRequest(messages, maxTokens = 2500) {
        // Simple rate limiting (reset every minute)
        const now = Date.now();
        if (now - this.lastResetTime > 60000) {
            this.requestCount = 0;
            this.lastResetTime = now;
        }

        if (this.requestCount >= config.groq.rateLimit.requestsPerMinute) {
            throw new Error('Groq rate limit exceeded. Please wait a moment.');
        }

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: this.model,
                    messages,
                    max_tokens: maxTokens,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            this.requestCount++;
            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('[Groq] API Error:', error.response?.data || error.message);
            throw new Error(`Groq API failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Generate ALL content in a SINGLE request for full context awareness
     * - Lyrics: In the selected language
     * - Title, Description, Tags: Always in ENGLISH for YouTube SEO
     * 
     * This allows user prompts like:
     * - descPrompt: "Include lyrics and title in description"
     * - tagsPrompt: "Generate tags related to title"
     * 
     * @param {Object} options - Generation options
     * @param {string[]} options.genres - Music genres
     * @param {string} options.language - Lyrics language (e.g., "English", "Hindi")
     * @param {string} [options.titlePrompt] - User direction for title
     * @param {string} [options.descPrompt] - User direction for description
     * @param {string} [options.tagsPrompt] - User direction for tags
     * @param {string} [options.lyricsPrompt] - User direction for lyrics
     */
    /**
     * Generate All Content with improved prompt engineering
     */
    async generateAllContent(options) {
        const {
            genres,
            language = 'English',
            titlePrompt = '',
            descPrompt = '',
            tagsPrompt = '',
            lyricsPrompt = ''
        } = options;

        const genresText = genres.join(', ');

        console.log(`[Groq] Generating content for genres: ${genresText}`);

        // 1. Construct the System Prompt (World's Best SEO + Lyricist)
        const systemPrompt = `You are TWO WORLD-CLASS EXPERTS in one:

🎤 WORLD'S BEST LYRICIST (Grammy-winning songwriter):
- Write emotionally powerful, creative lyrics that could chart #1 on Billboard
- Use poetic devices: metaphors, internal rhymes, near rhymes, alliteration
- Create memorable hooks and choruses that stick in listeners' minds
- Write with authentic emotion - NO generic or robotic phrases
- Structure: Verse 1 → Pre-Chorus → Chorus → Verse 2 → Chorus → Bridge → Final Chorus

📈 WORLD'S BEST SEO STRATEGIST (YouTube algorithm expert):
- Generate metadata that MAXIMIZES YouTube discoverability
- Write titles that are CLICK-WORTHY and contain trending keywords
- Create descriptions that boost watch time and engagement
- Use tags that real users searching for ${genresText} music would type

CRITICAL RULES - USER PROMPT PRIORITY:
🔴 HIGHEST: If user provides ANY specific instruction, FOLLOW IT EXACTLY:
   - User says "short title" → max 40 characters
   - User says "add [text]" → include that exact text verbatim
   - User says "dark theme" → entire content must be dark-themed
   - User says anything specific → OBEY without deviation
   
🟡 NO PROMPT PROVIDED: Generate MAXIMUM length, highest-quality content:
   - Title: 60-80 characters, include genre + emotional hook + trending keyword
   - Description: 500-600 characters, include lyrics excerpt, call-to-action
   - Tags: 20 diverse, high-volume search terms
   - Lyrics: Full 3+ verses, bridge, powerful chorus

OUTPUT FORMAT:
- Return ONLY valid JSON
- Lyrics in ${language}
- Title/Description/Tags in ENGLISH (for YouTube SEO)
- NO AI phrases like "Here's the song" or "As requested"`;

        // 2. Construct the User Prompt (The "Specific Task")
        let userPrompt = `TASK: Create a new song package for genres: ${genresText}.\n\n`;

        // --- SECTION A: LYRICS ---
        if (lyricsPrompt && lyricsPrompt.trim()) {
            userPrompt += `[LYRICS INSTRUCTION]: ${lyricsPrompt}\n(Follow this instruction STRICTLY)\n`;
        } else {
            userPrompt += `[LYRICS INSTRUCTION]: Write a creative, emotionally powerful song about a theme suitable for ${genresText} music. Use vivid imagery, metaphors, and make it memorable and catchy. Include at least 3 verses, a strong chorus, and a bridge.\n`;
        }

        userPrompt += `\nGenerate the Lyrics first. Then, based on those lyrics and the genres, generate the Metadata.\n\n`;

        // --- SECTION B: METADATA ---

        // Title
        if (titlePrompt && titlePrompt.trim()) {
            userPrompt += `[TITLE INSTRUCTION]: ${titlePrompt}\n(Follow this instruction STRICTLY)\n`;
        } else {
            userPrompt += `[TITLE INSTRUCTION]: Generate a CATCHY, CREATIVE, SEO-OPTIMIZED title (50-80 characters). The title should:
- Include the main emotional theme or hook from the lyrics
- Be memorable and click-worthy
- Include a relevant keyword for YouTube search
- NOT be generic like "Song" or just the genre name
Example good titles: "Midnight Memories - Chill Lofi Beats", "Heartbreak Avenue | Emotional Love Song 2024"\n`;
        }

        // Description
        if (descPrompt && descPrompt.trim()) {
            userPrompt += `[DESCRIPTION INSTRUCTION]: ${descPrompt}\n(Follow this instruction STRICTLY)\n`;
        } else {
            userPrompt += `[DESCRIPTION INSTRUCTION]: Write a LONG, SEO-OPTIMIZED YouTube description (400-600 characters). The description MUST include:
- An engaging opening hook that makes viewers want to listen
- Summary of the song's emotional journey/story
- Quote 2-3 memorable lines from the lyrics in quotation marks
- Mention of the genres (${genresText})
- Call to action (like, subscribe, comment)
- Relevant hashtags at the end
Make it feel human-written, not robotic. This description helps with YouTube SEO.\n`;
        }

        // Tags
        if (tagsPrompt && tagsPrompt.trim()) {
            userPrompt += `[TAGS INSTRUCTION]: ${tagsPrompt}\n(Follow this instruction STRICTLY)\n`;
        } else {
            userPrompt += `[TAGS INSTRUCTION]: Generate 15-20 HIGH-VOLUME SEO tags. Include:
- Genre-specific tags (${genresText})
- Mood/emotion tags (relaxing, sad, romantic, energetic, etc.)
- Instrument tags (guitar, piano, beats, etc.)
- Popular search terms (new music 2024, best songs, viral music)
- Language-specific tags if applicable
- Similar artist style tags
Tags should be what real users would search for on YouTube.\n`;
        }

        userPrompt += `
\nReturn ONLY this JSON structure:
{
  "lyrics": "full lyrics string with \\n for line breaks",
  "title": "final title string (50-80 chars, SEO optimized)",
  "description": "final description string (400-600 chars, engaging, SEO optimized)",
  "tags": ["tag1", "tag2", "tag3", ... 15-20 tags]
}`;

        const response = await this.makeRequest([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], 3000); // Increased token limit slightly for longer lyrics

        try {
            // Robust JSON extraction
            let jsonString = response;
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonString = jsonMatch[0];
            }

            const content = JSON.parse(jsonString);

            // Validation and Fallbacks
            if (!content.lyrics) content.lyrics = "[Instrumental]";

            if (!content.title) {
                // Critical Fallback if AI fails to generate title
                content.title = `${genres[0]} Vibes - ${new Date().toLocaleDateString()}`;
            }

            if (!content.tags || !Array.isArray(content.tags)) {
                content.tags = genres;
            }

            if (!content.description) {
                content.description = `Listen to this new ${genresText} track!`;
            }

            // Sanitization
            if (content.tags) {
                content.tags = content.tags.slice(0, 20).map(t => String(t).trim());
            }

            console.log(`[Groq] ✅ Generated: "${content.title}" (${content.lyrics.length} chars)`);
            return content;

        } catch (error) {
            console.error('[Groq] JSON Parsing Failed:', error.message);
            console.log('Raw Response:', response);

            // Emergency fallback to prevent worker crash
            return {
                lyrics: response.substring(0, 2000), // Return raw text as lyrics if it's not JSON
                title: `New ${genres[0]} Track`,
                description: `A new ${genresText} song.`,
                tags: genres
            };
        }
    }
}

module.exports = new GroqService();
