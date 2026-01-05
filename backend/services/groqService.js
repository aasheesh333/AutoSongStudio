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

        // 1. Construct the System Prompt (The "Expert Persona")
        // We define strict rules here that apply globally
        const systemPrompt = `You are an elite Songwriter and YouTube SEO Expert.
Your goal is to generate high-quality, creative, and human-like content for a music video based on provided genres.

CRITICAL INSTRUCTION HIERARCHY:
1. USER PROMPTS (Highest Priority): If a specific direction is given (e.g., "Title Direction"), you MUST follow it exactly.
2. GENRE MATCHING: If no user direction is given, the content MUST match the vibe/mood of the '${genresText}' genres.
3. CONTENT CONSISTENCY: The Title, Description, and Tags must be relevant to the Lyrics you generate.

OUTPUT REQUIREMENTS:
- JSON Only: valid JSON object.
- Language: Lyrics in ${language}, Metadata (Title/Desc/Tags) in English.
- No AI filler: Do not use phrases like "Here is the song" or "AI generated".

LYRICS GUIDELINES:
- Structure: Standard Verse-Chorus-Verse-Chorus-Bridge-Chorus format.
- Quality: Use near rhymes, internal rhymes, and strong imagery. Avoid cliché, robotic, or simple AABB rhymes constantly. 
- Style: Match the '${genresText}' style (e.g., if Rap -> complex flow; if Ballad -> emotional).

METADATA GUIDELINES (If no specific User Prompt):
- Title: Catchy, under 80 chars. Not just "Genre Music". Use a creative name based on the song's theme.
- Description: 2-3 sentences convincing a viewer to listen. Include the mood and theme.
- Tags: 10-15 high-volume search terms related to the genre and mood.`;

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
