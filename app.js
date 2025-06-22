import readline from "readline";
import fetch from "node-fetch";

import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { PythonShell } from 'python-shell';
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
import cors from 'cors';
app.use(express.static('public'));


const port = 3000;

// File upload handling with multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Extract text from the uploaded PDF
async function extractTextFromPDF(filePath) {
    return new Promise((resolve, reject) => {
        console.log("🔍 Starting PythonShell with file:", filePath);

        const shell = new PythonShell('extract_text.py', {
            args: [filePath],
            pythonOptions: ['-u'], // <- FORCE unbuffered output
            pythonPath: 'python', // or full path to python.exe
        });

        let output = [];
        shell.on('message', (message) => {
            console.log("📥 Python output:", message);
            output.push(message);
        });

        shell.end((err, code, signal) => {
            if (err) {
                console.error("❌ PythonShell error:", err);
                return reject(err);
            }

            if (output.length === 0) {
                console.warn("⚠️ No output received from extract_text.py");
                return reject(new Error("No output from script"));
            }

            console.log("✅ PythonShell finished. Code:", code, "Signal:", signal);
            resolve(output.join('\n'));
        });
    });
}

async function addToSupermemory(text) {
    try {
        const res = await fetch('https://api.supermemory.ai/v3/memories', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.SUPERMEMORY_API_KEY}`,
                'Content-Type': 'application/json',
            },

            body: JSON.stringify({ content: text }),
        });

        const data = await res.json();
        if (data.success || data.status === "queued") {
            console.log("✅ Memory accepted by Supermemory and queued for processing.");
        } else {
            console.error("❌ Failed to add memory:", data);
        }

    } catch (err) {
        console.error("🚨 Error adding to Supermemory:", err.message);
    }
}


async function searchMemory(query) {
    try {
        const res = await fetch("https://api.supermemory.ai/v3/search", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.SUPERMEMORY_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ q: query })
        });

        const data = await res.json();
        return data;
    } catch (err) {
        console.error('🚨 [ERROR] Supermemory v3 search failed:', err.message);
        return null;
    }
}



// Chat interface using LLaMA model
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
            model: "meta-llama/llama-3-70b-instruct",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful, knowledgeable assistant designed to answer questions based on corporate information. You pull from the company’s memory context to give accurate, factual, and relevant answers. You prioritize clarity, precision, and professionalism while maintaining a direct, no-nonsense tone. Respond in a way that mirrors the company’s corporate culture and guidelines, ensuring that the information shared is up-to-date and aligned with the organization’s internal documents.`
                },
                {
                    role: "system",
                    content: `Memory:\n${context}`
                },
                ...messages
            ]
        };

        try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
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

app.use(express.static('public'));

// POST route to upload PDF and process it
app.post('/upload', upload.single('pdf'), async (req, res) => {
    console.log('Received file:', req.file);

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = path.normalize(path.join(__dirname, 'uploads', req.file.filename));
    console.log('File Path:', filePath);

    try {
        const extractedText = await extractTextFromPDF(filePath);

        // Add the extracted text to Supermemory
        await addToSupermemory(extractedText);

        // Respond with success message
        res.status(200).send(extractedText);
    } catch (error) {
        console.error("Error during file processing:", error.message);
        res.status(500).send('Error processing the PDF.');
    } finally {
        // Clean up the uploaded file
        fs.unlinkSync(filePath);
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Start the chat interface
console.log("Chat started. Type your question (or 'exit' to quit):");
askQuestion();
