import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const PORT = process.env.PORT || 3001;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.post("/api/generate", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    try {
        const message = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4000,
            messages: [{ role: "user", content: prompt }],
        });

        const text = message.content
            .filter(b => b.type === "text")
            .map(b => b.text)
            .join("");

        res.json({ text });
    } catch (err) {
        console.error("Anthropic error:", err);
        res.status(500).json({ error: err.message ?? "API call failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Session Forge server running on http://localhost:${PORT}`);
});
