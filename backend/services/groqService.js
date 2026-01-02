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
    async makeRequest(messages, maxTokens = 2000) {
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
     * Generate song lyrics based on genres and language
     */
    async generateLyrics(genres, language, titlePrompt = '', lyricsPrompt = '', previousTitles = []) {
        const genresText = genres.join(', ');
        const avoidText = previousTitles.length > 0
            ? `\n\nIMPORTANT: AVOID these themes/styles used in previous songs: ${previousTitles.join(', ')}. Create something COMPLETELY DIFFERENT.`
            : '';

        const systemPrompt = `You are a professional songwriter. Generate creative, high-quality song lyrics in ${language}. 
The lyrics should be appropriate for a 2-4 minute song (50-100 lines max). 
Never mention AI, generated content, or similar terms.
Focus on emotions, storytelling, and musical flow.
CRITICAL: Each song must be unique - different theme, different style, different story.${avoidText}`;

        const userPrompt = `Create song lyrics for these genres: ${genresText}
${titlePrompt ? `\nTitle theme: ${titlePrompt}` : ''}
${lyricsPrompt ? `\nStyle/theme: ${lyricsPrompt}` : ''}

Generate complete, ready-to-sing lyrics with verses, chorus, and bridge. Format with clear line breaks.`;

        const lyrics = await this.makeRequest([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], 1500);

        console.log(`[Groq] ✅ Generated lyrics (${lyrics.length} chars)`);
        return lyrics.trim();
    }

    /**
     * Generate video metadata (title, description, tags)
     */
    async generateMetadata(lyrics, genres, titlePrompt = '', descPrompt = '', tagsPrompt = '', previousTitles = []) {
        const genresText = genres.join(', ');
        const avoidText = previousTitles.length > 0
            ? `\n\nCRITICAL: Do NOT use these titles or similar ones: ${previousTitles.join(', ')}. Create a COMPLETELY DIFFERENT title.`
            : '';

        const systemPrompt = `You are a YouTube SEO expert. Generate optimized metadata for music videos.
Rules:
- Title: Under 100 characters, catchy and SEO-friendly
- Description: 200-500 characters, engaging with relevant keywords
- Tags: Maximum 15 tags, comma-separated, relevant to the music
- Never mention "AI generated" or similar terms
- Optimize for discovery and engagement
- EACH VIDEO MUST HAVE A UNIQUE TITLE - no duplicates allowed${avoidText}`;

        const userPrompt = `Based on these inputs, generate YouTube metadata:

Genres: ${genresText}
Lyrics excerpt: ${lyrics.substring(0, 300)}...
${titlePrompt ? `\nTitle direction: ${titlePrompt}` : ''}
${descPrompt ? `\nDescription direction: ${descPrompt}` : ''}
${tagsPrompt ? `\nTag direction: ${tagsPrompt}` : ''}

Return ONLY a JSON object with this exact structure:
{
  "title": "video title here",
  "description": "video description here",
  "tags": ["tag1", "tag2", "tag3"]
}`;

        const response = await this.makeRequest([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], 800);

        try {
            // Extract JSON from response (handles markdown code blocks)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid JSON response from Groq');
            }

            const metadata = JSON.parse(jsonMatch[0]);

            // Validate and enforce limits
            if (metadata.title.length > 100) {
                metadata.title = metadata.title.substring(0, 97) + '...';
            }

            if (metadata.description.length > 5000) {
                metadata.description = metadata.description.substring(0, 4997) + '...';
            }

            if (metadata.tags.length > 15) {
                metadata.tags = metadata.tags.slice(0, 15);
            }

            // Ensure tags array is strings
            metadata.tags = metadata.tags.map(tag => String(tag).trim());

            console.log(`[Groq] ✅ Generated metadata - Title: "${metadata.title}"`);
            return metadata;
        } catch (error) {
            console.error('[Groq] Failed to parse metadata:', error.message);
            // Fallback metadata
            return {
                title: metadata?.title || `${genres[0]} Music - ${new Date().toISOString().split('T')[0]}`,
                description: metadata?.description || 'Enjoy this original music composition.',
                tags: Array.isArray(metadata?.tags) ? metadata.tags : genres.slice(0, 5)
            };
        }
    }

    /**
     * Generate all content at once (lyrics + metadata)
     * @param {Object} options - Generation options
     * @param {string[]} options.genres - Music genres
     * @param {string} options.language - Lyrics language
     * @param {string} [options.titlePrompt] - Direction for title
     * @param {string} [options.descPrompt] - Direction for description
     * @param {string} [options.tagsPrompt] - Direction for tags
     * @param {string} [options.lyricsPrompt] - Direction for lyrics
     * @param {string[]} [options.previousTitles] - Titles of previous videos to avoid repetition
     */
    async generateAllContent(options) {
        const {
            genres,
            language,
            titlePrompt = '',
            descPrompt = '',
            tagsPrompt = '',
            lyricsPrompt = '',
            previousTitles = []
        } = options;

        console.log(`[Groq] Generating content for genres: ${genres.join(', ')}`);
        if (previousTitles.length > 0) {
            console.log(`[Groq] Avoiding ${previousTitles.length} previous titles for uniqueness`);
        }

        // Step 1: Generate lyrics (pass previous titles to avoid same themes)
        const lyrics = await this.generateLyrics(genres, language, titlePrompt, lyricsPrompt, previousTitles);

        // Step 2: Generate metadata based on lyrics (pass previous titles to avoid duplicates)
        const metadata = await this.generateMetadata(lyrics, genres, titlePrompt, descPrompt, tagsPrompt, previousTitles);

        return {
            lyrics,
            ...metadata
        };
    }
}

module.exports = new GroqService();
