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
   - Lyrics: MUST use Suno.com format with structure tags.

SUNO LYRICS FORMAT (REQUIRED):
- Use [Verse 1], [Verse 2] for story/narrative
- Use [Chorus] for the hook/repeating part
- Use [Pre-Chorus] for build-up to chorus
- Use [Bridge] for middle transition
- Use [Outro] for ending
- Use [Intro] for soft opening (optional)
- Each section on new line after tag

OUTPUT FORMAT:
- Return ONLY valid JSON
- Lyrics in ${language} with Suno structure tags in English
- Title/Description/Tags in ENGLISH (for YouTube SEO)
- NO AI phrases like "Here's the song" or "As requested"
- JSON Structure:
  {
    "title": "String (Max 99 chars)",
    "description": "String (Max 4999 chars)",
    "tags": ["tag1", "tag2"],
    "lyrics": "String with [Verse], [Chorus], etc. tags (MAX 3000 chars for Suno API)"
  }`;

        // 2. Construct the User Prompt (The "Specific Task")
        let userPrompt = `TASK: Create a new song package for genres: ${genresText}.\n\n`;

        // --- SECTION A: LYRICS ---
        // CRITICAL: Suno API V4 has 3000 char limit for lyrics
        const LYRICS_MAX_CHARS = 3000;

        if (lyricsPrompt && lyricsPrompt.trim()) {
            userPrompt += `[LYRICS INSTRUCTION]: ${lyricsPrompt}\n(Follow this instruction STRICTLY. Use Suno format with [Verse], [Chorus], etc. tags)\n`;
        } else {
            userPrompt += `[LYRICS INSTRUCTION]: Write a creative, emotionally powerful song about a theme suitable for ${genresText} music. Use vivid imagery, metaphors, and make it memorable and catchy.\n`;
        }

        userPrompt += `
⚠️ SUNO FORMAT REQUIRED - Use these exact structure tags:
[Verse 1]
First verse lyrics here...

[Pre-Chorus]
Build-up lyrics (optional)...

[Chorus]
Catchy hook lyrics here...

[Verse 2]
Second verse lyrics...

[Bridge]
Transition lyrics (optional)...

[Chorus]
Repeat chorus...

[Outro]
Ending lyrics...
\n`;

        userPrompt += `\n⚠️ CRITICAL LYRICS LIMIT: Lyrics MUST be under ${LYRICS_MAX_CHARS} characters. This is a HARD LIMIT for the Suno music generation API. If lyrics exceed this limit, the song WILL FAIL to generate. Write concise, impactful lyrics.\n`;

        userPrompt += `\nGenerate the Lyrics first (keeping under ${LYRICS_MAX_CHARS} chars). Then, based on those lyrics and the genres, generate the Metadata.\n\n`;

        // --- SECTION B: METADATA ---
        userPrompt += `[METADATA INSTRUCTION]:\n`;

        // TITLE PROMPT - Follow user instructions strictly
        // MAX LIMITS (NEVER EXCEED)
        const TITLE_MAX = 99;
        const DESC_MAX = 4999;
        const TAGS_MAX = 499;
        const LYRICS_MAX = 3000;

        if (titlePrompt && titlePrompt.trim()) {
            // Detect if user specified a character count
            const titleLengthMatch = titlePrompt.match(/(\d+)\s*(char|charac|character|chars|characters|words)/i);
            let requestedTitleLength = titleLengthMatch ? parseInt(titleLengthMatch[1]) : null;

            // Cap at maximum
            if (requestedTitleLength && requestedTitleLength > TITLE_MAX) {
                console.log(`[Groq] User requested ${requestedTitleLength} chars for title, capping at ${TITLE_MAX}`);
                requestedTitleLength = TITLE_MAX;
            }

            userPrompt += `- TITLE: ${titlePrompt}
  🚨 LENGTH REQUIREMENT:
  ${requestedTitleLength ? `Target: ${requestedTitleLength} characters (capped at maximum ${TITLE_MAX}).` : 'Generate a title between 80-99 characters.'}
  - Count every character including spaces and punctuation
  (ABSOLUTE MAX: ${TITLE_MAX} chars - NEVER EXCEED)\n`;
        } else {
            userPrompt += `- TITLE: Generate a click-worthy, SEO-optimized title (80-99 chars).\n`;
        }

        // DESCRIPTION PROMPT - Follow user instructions strictly
        if (descPrompt && descPrompt.trim()) {
            // Detect if user specified a character count
            const descLengthMatch = descPrompt.match(/(\d+)\s*(char|charac|character|chars|characters)/i);
            let requestedDescLength = descLengthMatch ? parseInt(descLengthMatch[1]) : null;

            // Cap at maximum
            if (requestedDescLength && requestedDescLength > DESC_MAX) {
                console.log(`[Groq] User requested ${requestedDescLength} chars for description, capping at ${DESC_MAX}`);
                requestedDescLength = DESC_MAX;
            }

            userPrompt += `- DESCRIPTION: ${descPrompt}
  🚨 LENGTH REQUIREMENT:
  ${requestedDescLength ? `Target: ${requestedDescLength} characters (capped at maximum ${DESC_MAX}).` : 'Generate 3000-4000 characters of rich content.'}
  
  TO ACHIEVE REQUIRED LENGTH:
  - Include full song lyrics in the description
  - Add the song title at the beginning
  - Write a detailed story/meaning behind the song
  - Add timestamps for each section
  - Include popular hashtags (20-30 hashtags)
  - Add music credits, genre info, mood description
  
  - If user says "include title" → ADD the title
  - If user says "include lyrics" → ADD full lyrics
  - If user mentions hashtags → Include 20+ hashtags
  (ABSOLUTE MAX: ${DESC_MAX} chars - NEVER EXCEED)\n`;
        } else {
            userPrompt += `- DESCRIPTION: Write a rich description (3000-4000 chars) including: full lyrics, story behind the song, timestamps, 20+ relevant hashtags. (MAX 4999 chars).\n`;
        }

        // TAGS PROMPT - Follow user instructions strictly
        if (tagsPrompt && tagsPrompt.trim()) {
            // Detect if user specified a count
            const tagsCountMatch = tagsPrompt.match(/(\d+)\s*(tag|tags)/i);
            let requestedTagsCount = tagsCountMatch ? parseInt(tagsCountMatch[1]) : null;

            // No cap for count, but chars are limited
            userPrompt += `- TAGS: ${tagsPrompt}
  ${requestedTagsCount ? `Generate EXACTLY ${requestedTagsCount} tags as specified.` : 'Generate 20-30 relevant YouTube tags.'}
  (ABSOLUTE MAX: ${TAGS_MAX} chars total for all tags combined - NEVER EXCEED)\n`;
        } else {
            userPrompt += `- TAGS: Generate 25-30 high-volume YouTube tags relevant to the song/genre. (MAX ${TAGS_MAX} chars total)\n`;
        }

        userPrompt += `
\n⚠️ STRICT COMPLIANCE REQUIRED:
- Follow ALL user prompts EXACTLY as specified
- If user says "female version" for lyrics → write from female perspective
- If user says "male version" for lyrics → write from male perspective
- If user says "soft music" → write calm, gentle, melodic lyrics
- If user says "hard music" → write intense, powerful, energetic lyrics
- If user specifies character counts → match EXACTLY (not more)
- Never exceed the absolute maximums: Title=99, Description=4999, Lyrics=3000, Tags=499

Return ONLY this JSON structure:
{
  "lyrics": "full lyrics string (STRICTLY UNDER 3000 chars) with \\n for line breaks",
  "title": "final title string (MAX 99 chars)",
  "description": "final description string (MAX 4999 chars) - include title/lyrics if user requested",
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

            // CRITICAL: Lyrics limit for Suno API (3000 chars for V4)
            if (content.lyrics && content.lyrics.length > 3000) {
                console.warn(`[Groq] ⚠️ Truncating Lyrics from ${content.lyrics.length} to 3000 chars (Suno API limit)`);
                // Truncate at the last complete line before 3000 chars
                let truncated = content.lyrics.substring(0, 3000);
                const lastNewline = truncated.lastIndexOf('\n');
                if (lastNewline > 2500) {
                    truncated = truncated.substring(0, lastNewline);
                }
                content.lyrics = truncated;
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
