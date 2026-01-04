const groqService = require('../services/groqService');

async function runTests() {
    console.log("=== STARTING GROQ SERVICE UNIT TESTS ===\n");

    // Mock the makeRequest method to capture the prompt and return dummy data
    groqService.makeRequest = async (messages, maxTokens) => {
        console.log("--- DETECTED API CALL ---");
        const systemMsg = messages.find(m => m.role === 'system').content;
        const userMsg = messages.find(m => m.role === 'user').content;

        console.log("SYSTEM PROMPT PREVIEW:", systemMsg.substring(0, 100) + "...");
        console.log("USER PROMPT:");
        console.log(userMsg);

        // Simulating a "perfect" AI response
        return JSON.stringify({
            lyrics: "[Verse 1]\nThis is a test song\nWith rhyme and throng\n\n[Chorus]\nOh yeah, functionality check\nNothing to wreck",
            title: "The Functionality Check Song",
            description: "A song about checking code functionality.",
            tags: ["code", "test", "check"]
        });
    };

    // TEST 1: Full Auto (No Prompts)
    console.log("\n>>> TEST 1: Full Auto Generation (Genres: Pop, Synth)");
    await groqService.generateAllContent({
        genres: ['Pop', 'Synth'],
        language: 'English'
    });

    // TEST 2: User Overrides
    console.log("\n>>> TEST 2: User Overrides (Title & Lyrics)");
    await groqService.generateAllContent({
        genres: ['Rock'],
        language: 'Hindi',
        titlePrompt: "Make the title about Fire",
        lyricsPrompt: "Include the word 'Jwala'",
        descPrompt: "Mention it is hot",
        tagsPrompt: "fire, burns, hot"
    });

    // TEST 3: Partial Overrides
    console.log("\n>>> TEST 3: Partial Overrides (Only Tags)");
    await groqService.generateAllContent({
        genres: ['Jazz'],
        tagsPrompt: "smooth, relax, night"
    });

    console.log("\n=== TESTS COMPLETE ===");
}

runTests().catch(console.error);
