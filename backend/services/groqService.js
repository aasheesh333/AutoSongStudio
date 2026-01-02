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

        console.log(`[Groq] Generating ALL content in single request for genres: ${genresText}`);
        console.log(`[Groq] Lyrics language: ${language}, Metadata: English`);

        const systemPrompt = `You are a professional songwriter and YouTube SEO expert.

Generate a complete song package with lyrics and YouTube metadata.

IMPORTANT RULES:
1. LYRICS: Write in ${language} language. Create complete, ready-to-sing lyrics with verses, chorus, and bridge (50-100 lines).
2. TITLE: Write in ENGLISH only. Under 100 characters, catchy and SEO-friendly.
3. DESCRIPTION: Write in ENGLISH only. 200-500 characters, engaging with relevant keywords.
4. TAGS: Write in ENGLISH only. Maximum 15 tags, relevant to the music.
5. Never mention "AI generated" or similar terms anywhere.
6. Optimize metadata for YouTube discovery.
7. Each song must be unique and creative.`;

        // Build user prompt with all user directions
        let userPrompt = `Create a complete song package for these genres: ${genresText}

`;

        // Add user-specific directions if provided
        if (lyricsPrompt) {
            userPrompt += `LYRICS DIRECTION: ${lyricsPrompt}\n`;
        }
        if (titlePrompt) {
            userPrompt += `TITLE DIRECTION: ${titlePrompt}\n`;
        }
        if (descPrompt) {
            userPrompt += `DESCRIPTION DIRECTION: ${descPrompt}\n`;
        }
        if (tagsPrompt) {
            userPrompt += `TAGS DIRECTION: ${tagsPrompt}\n`;
        }

        userPrompt += `
Return a JSON object with this EXACT structure:
{
  "lyrics": "complete song lyrics here in ${language}",
  "title": "video title here in English",
  "description": "video description here in English",
  "tags": ["tag1", "tag2", "tag3"]
}

REMEMBER: 
- Lyrics MUST be in ${language}
- Title, description, tags MUST be in English
- Follow all user directions above`;

        const response = await this.makeRequest([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], 2500);

        try {
            // Extract JSON from response (handles markdown code blocks)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid JSON response from Groq');
            }

            const content = JSON.parse(jsonMatch[0]);

            // Validate required fields
            if (!content.lyrics || !content.title) {
                throw new Error('Missing required fields in response');
            }

            // Enforce limits
            if (content.title.length > 100) {
                content.title = content.title.substring(0, 97) + '...';
            }

            if (content.description && content.description.length > 5000) {
                content.description = content.description.substring(0, 4997) + '...';
            }

            if (content.tags && content.tags.length > 15) {
                content.tags = content.tags.slice(0, 15);
            }

            // Ensure tags array is strings
            if (content.tags) {
                content.tags = content.tags.map(tag => String(tag).trim());
            } else {
                content.tags = genres.slice(0, 5);
            }

            // Default description if missing
            if (!content.description) {
                content.description = `Enjoy this original ${genresText} music composition.`;
            }

            console.log(`[Groq] ✅ Generated all content - Title: "${content.title}"`);
            console.log(`[Groq] ✅ Lyrics: ${content.lyrics.length} chars, Tags: ${content.tags.length}`);

            return content;
        } catch (error) {
            console.error('[Groq] Failed to parse response:', error.message);
            console.error('[Groq] Raw response:', response.substring(0, 500));

            // Fallback - try to extract what we can
            return {
                lyrics: response.includes('"lyrics"') ? '' : response, // Might be plain lyrics
                title: `${genres[0]} Music - ${new Date().toISOString().split('T')[0]}`,
                description: `Enjoy this original ${genresText} music composition.`,
                tags: genres.slice(0, 5)
            };
        }
    }
}

module.exports = new GroqService();
