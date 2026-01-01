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
    async generateLyrics(genres, language, titlePrompt = '', lyricsPrompt = '') {
        const genresText = genres.join(', ');

        const systemPrompt = `You are a professional songwriter. Generate creative, high-quality song lyrics in ${language}. 
The lyrics should be appropriate for a 2-4 minute song (50-100 lines max). 
Never mention AI, generated content, or similar terms.
Focus on emotions, storytelling, and musical flow.`;

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
    async generateMetadata(lyrics, genres, titlePrompt = '', descPrompt = '', tagsPrompt = '') {
        const genresText = genres.join(', ');

        const systemPrompt = `You are a YouTube SEO expert. Generate optimized metadata for music videos.
Rules:
- Title: Under 100 characters, catchy and SEO-friendly
- Description: 200-500 characters, engaging with relevant keywords
- Tags: Maximum 15 tags, comma-separated, relevant to the music
- Never mention "AI generated" or similar terms
- Optimize for discovery and engagement`;

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
     */
    async generateAllContent(options) {
        const {
            genres,
            language,
            titlePrompt = '',
            descPrompt = '',
            tagsPrompt = '',
            lyricsPrompt = ''
        } = options;

        console.log(`[Groq] Generating content for genres: ${genres.join(', ')}`);

        // Step 1: Generate lyrics
        const lyrics = await this.generateLyrics(genres, language, titlePrompt, lyricsPrompt);

        // Step 2: Generate metadata based on lyrics
        const metadata = await this.generateMetadata(lyrics, genres, titlePrompt, descPrompt, tagsPrompt);

        return {
            lyrics,
            ...metadata
        };
    }
}

module.exports = new GroqService();
