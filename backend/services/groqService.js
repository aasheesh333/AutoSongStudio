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
    async makeRequest(messages, maxTokens = 3000) {
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
     * Enforces strict YouTube limits: Title < 100, Desc < 5000, Tags < 500.
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
- **UNIQUENESS RULE**: NEVER repeat patterns from previous songs. Every song must feel distinct.
- **STRUCTURE**: Verse 1 → Pre-Chorus → Chorus → Verse 2 → Chorus → Bridge → Final Chorus (Ensure significant length)

📈 WORLD'S BEST SEO STRATEGIST (YouTube algorithm expert):
- Generate metadata that MAXIMIZES YouTube discoverability with STRICT LIMITS.
- **TITLE RULES**: 
  - **ABSOLUTE MAX LENGTH: 99 CHARACTERS**. (YouTube rejects 100+)
  - Aim for 80-99 characters for maximum impact.
  - MUST include: Main Keyword + Emotional Hook + Action Verb + Context + (Unique ID/Vibe)
  - Example: "Heartbreaking Sad Piano Song for Crying 2024 | Emotional Breakup Music with Rain [Deep Focus]"
- **DESCRIPTION RULES**:
  - **ABSOLUTE MAX LENGTH: 4999 CHARACTERS**. (YouTube reject 5000+)
  - Minimum 1000 characters.
  - Include lyrics, story behind the song, usage scenarios, and call-to-action.
- **TAGS RULES**:
  - **ABSOLUTE MAX TOTAL LENGTH: 499 CHARACTERS** (All tags combined + commas).
  - 20-25 diverse, high-volume search terms.

CRITICAL RULES - USER PROMPT PRIORITY:
🔴 HIGHEST: If user provides ANY specific instruction, FOLLOW IT EXACTLY.
   - If user says "3 minute long", generate EXTRA verses and repeated choruses to ensure audio length.
   
🟡 NO PROMPT PROVIDED: Generate MAXIMUM length (within limits), highest-quality content:
   - Title: MAX allowed length (90-99 chars), SEO stuffed.
   - Description: Detailed and rich.
   - Lyrics: Extended structure (Verse-Chorus-Verse-Chorus-Bridge-Chorus-Outro).

OUTPUT FORMAT:
- Return ONLY valid JSON
- Lyrics in ${language}
- Title/Description/Tags in ENGLISH (for YouTube SEO)
- NO AI phrases like "Here's the song" or "As requested"
- JSON Structure:
  {
    "title": "String (Max 99 chars)",
    "description": "String (Max 4999 chars)",
    "tags": ["tag1", "tag2"],
    "lyrics": "String"
  }`;

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
        userPrompt += `[METADATA INSTRUCTION]:\n`;

        if (titlePrompt && titlePrompt.trim()) {
            userPrompt += `- TITLE: ${titlePrompt} (STRICTLY < 100 chars)\n`;
        } else {
            userPrompt += `- TITLE: Generate a click-worthy, SEO-optimized title (80-99 chars).\n`;
        }

        if (descPrompt && descPrompt.trim()) {
            userPrompt += `- DESCRIPTION: ${descPrompt} (Include lyrics, strict < 5000 chars)\n`;
        } else {
            userPrompt += `- DESCRIPTION: Write a rich description with lyrics, story, and hashtags (< 5000 chars).\n`;
        }

        if (tagsPrompt && tagsPrompt.trim()) {
            userPrompt += `- TAGS: ${tagsPrompt} (Relevant tags, max 500 chars total)\n`;
        } else {
            userPrompt += `- TAGS: Generate 20-30 high-volume tags relevant to the song/genre.\n`;
        }

        userPrompt += `
\nReturn ONLY this JSON structure:
{
  "lyrics": "full lyrics string with \\n for line breaks",
  "title": "final title string (MAX 99 chars)",
  "description": "final description string (MAX 4999 chars)",
  "tags": ["tag1", "tag2", "tag3", ... max 499 chars total]
}`;

        try {
            const rawResponse = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]);

            // Parse content
            let content;
            try {
                // Find JSON object start/end (handling potential markdown)
                const jsonStart = rawResponse.indexOf('{');
                const jsonEnd = rawResponse.lastIndexOf('}');
                if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');

                let jsonStr = rawResponse.substring(jsonStart, jsonEnd + 1);

                // SANITIZE: Remove control characters that break JSON parsing
                // This handles Hindi/multilingual text with raw line breaks inside strings
                jsonStr = jsonStr
                    // Replace actual newlines inside strings with escaped newlines
                    .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
                    .replace(/[\x00-\x1F\x7F]/g, (char) => {
                        // Keep valid whitespace, escape everything else
                        if (char === '\t') return ' ';  // Tab to space
                        return '';  // Remove other control characters
                    })
                    // Clean up multiple spaces
                    .replace(/\s+/g, ' ')
                    // Fix common JSON issues
                    .replace(/,\s*}/g, '}')  // Remove trailing commas
                    .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays

                console.log('[Groq] Sanitized JSON length:', jsonStr.length);
                content = JSON.parse(jsonStr);
            } catch (parseError) {
                console.error('[Groq] JSON Parse Error:', parseError);
                console.error('Raw Response:', rawResponse.substring(0, 500));
                throw new Error('Failed to parse AI response');
            }

            // SAFETY: Strict Character Limit Enforcement (Truncation)
            // Even if AI hallucinates longer content, we strictly truncate it.

            if (content.title && content.title.length > 99) {
                console.warn(`[Groq] Truncating Title from ${content.title.length} to 99 chars`);
                content.title = content.title.substring(0, 99);
            }

            if (content.description && content.description.length > 4999) {
                console.warn(`[Groq] Truncating Description from ${content.description.length} to 4999 chars`);
                content.description = content.description.substring(0, 4999);
            }

            // Tags limit check (Total string length of comma-separated tags)
            if (content.tags && Array.isArray(content.tags)) {
                let currentLength = 0;
                const validTags = [];
                for (const tag of content.tags) {
                    const tagStr = String(tag).trim();
                    const tagLen = tagStr.length;

                    // YouTube limits tags to 500 chars total (including commas)
                    // We check: current + tag + comma(1) <= 499
                    if (currentLength + tagLen + 1 <= 499) {
                        validTags.push(tagStr);
                        currentLength += tagLen + 1;
                    } else {
                        break; // Stop adding tags if limit reached
                    }
                }
                content.tags = validTags;
            } else if (!content.tags) {
                content.tags = genres;
            }

            // Fallbacks
            if (!content.lyrics) content.lyrics = "[Instrumental]";
            if (!content.title) content.title = `${genres[0]} Song`;
            if (!content.description) content.description = `New ${genresText} song.`;

            return content;
        } catch (error) {
            console.error('[Groq] Content Generation Failed:', error);
            throw error;
        }
    }
}

module.exports = new GroqService();
