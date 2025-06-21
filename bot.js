import readline from "readline";
import fetch from "node-fetch"; // Optional in Node 18+, required in older versions

// API Keys
const OPENROUTER_API_KEY = "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";
const SUPERMEMORY_API_KEY = "sm_vwFqRTBPD2fceRagoJCzWw_uXnGBmNxKsEoWceZTuwBzVfXvQjdUnvGXKRkyuchjlrQOmCYehbDIGpZFnGVmquK";

// Endpoints
const SEARCH_URL = "https://v2.api.supermemory.ai/search";
const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3-70b-instruct";

// Memory search
async function searchMemory(query) {
  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "x-api-key": SUPERMEMORY_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query })
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('\n[ERROR] Failed to fetch memory:', err.message);
    return null;
  }
}

// Chat interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const messages = [];

async function askQuestion() {
  rl.question("\nYou: ", async (input) => {
    if (input.toLowerCase() === "exit") return rl.close();

    const searchResults = await searchMemory(input);

    let context = '';
    try {
      context = searchResults?.results?.map((r) =>
        r.chunks.map((c) => c.content).join("\n")
      ).join("\n\n") || '';

    } catch (e) {
      console.error('\n[ERROR] Failed to extract memory context:', e.message);
    }

    messages.push({ role: "user", content: input });

    const payload = {
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a direct, no-nonsense assistant with Puneet's personality. You speak clearly, avoid fluff, and value realness and productivity. You're slightly introverted and practical in tone, but visionary when needed. Use the memory context below to respond accordingly.`
        },
        {
          role: "system",
          content: `Memory:\n${context}`
        },
        ...messages
      ]
    };

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "No response";

      console.log("\nAssistant:", reply);
      messages.push({ role: "assistant", content: reply });

    } catch (error) {
      console.error('\n[ERROR] Failed to get response from LLaMA:', error.message);
    }

    askQuestion();
  });
}

console.log("Chat started. Type your question (or 'exit' to quit):");
askQuestion();