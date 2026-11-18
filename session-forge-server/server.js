import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { validateRequest, buildPrompt } from "./prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Locally the key comes from the repo-root .env; in production (Render) it's set as an environment variable.
config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY not set. Add it to", path.resolve(__dirname, "../.env"), "or the host's environment variables.");
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const DIST_DIR = path.resolve(__dirname, "../dist");

// Per-visitor limit, plus a site-wide daily cap as a cost backstop. Both are adjustable via env vars.
const PER_IP_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR) || 10;
const DAILY_CAP = Number(process.env.DAILY_GENERATION_CAP) || 200;

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 4,
});

// Render puts one proxy in front of the app; trusting it lets the rate limiter see real client IPs.
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));

const perIpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: PER_IP_PER_HOUR,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: `You've hit the limit of ${PER_IP_PER_HOUR} generations per hour. Please try again later.` },
});

let dailyCount = 0;
let dailyDate = new Date().toISOString().slice(0, 10);
function dailyCap(req, res, next) {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== dailyDate) { dailyDate = today; dailyCount = 0; }
    if (dailyCount >= DAILY_CAP) {
        return res.status(429).json({ error: "The site has reached its daily generation limit. Please try again tomorrow." });
    }
    dailyCount++;
    next();
}

app.post("/api/generate", perIpLimiter, (req, res, next) => {
    try {
        req.validated = validateRequest(req.body);
        next();
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}, dailyCap, async (req, res) => {
    const { form, monsters } = req.validated;

    try {
        const message = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 8000,
            messages: [{ role: "user", content: buildPrompt(form, monsters) }],
        });

        if (message.stop_reason === "max_tokens") {
            return res.status(502).json({
                error: "Model response was truncated before completing the JSON. Try again, or raise max_tokens on the server.",
            });
        }

        const text = message.content
            .filter(b => b.type === "text")
            .map(b => b.text)
            .join("");

        res.json({ text });
    } catch (err) {
        console.error("Anthropic error:", err.status, err.message, err.error ?? "");
        // Don't forward Anthropic's raw error body to the public; the status is enough for the frontend's messages.
        const status = err.status ?? 500;
        const error = status === 429
            ? "Claude's API rate limit was hit. Wait a moment and try again."
            : "Generation failed on the server.";
        res.status(status).json({ error });
    }
});

// In production the server also serves the built frontend (npm run build → dist/).
// In development Vite serves the frontend and proxies /api here.
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
}

app.listen(PORT, () => {
    console.log(`Session Forge server running on http://localhost:${PORT}`);
});
