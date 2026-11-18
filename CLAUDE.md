# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Session Forge: a D&D 5e session planner. The user configures a party (size, level, classes) and session parameters (difficulty, environment, theme, tone, villain), and the app generates a session outline plus an encounter with monster stat blocks.

## Commands

Two processes must run together — the Vite frontend and the Express backend.

```sh
# Frontend (repo root) — http://localhost:5173
npm install
npm run dev
npm run build
npm run lint        # ESLint over the whole project

# Backend (session-forge-server/) — http://localhost:3001
cd session-forge-server
npm install
npm run dev         # node --watch server.js
```

`start-servers.bat` launches both in separate windows on Windows. There is no test suite.

Production-style locally: `npm run build` then `npm start` — the Express server serves `dist/` and `/api` from one port.

## Architecture

- **Shared data** (`shared/dnd.js`) — XP thresholds, option lists (classes, environments, …), input limits and `computeXpBudget`, imported by both the frontend and the server. The server validates requests against these lists, so add new dropdown options here, not in `App.jsx`.
- **Frontend** (`src/App.jsx`) — essentially the whole UI lives in this single file: frontend-only constants (CR→XP map, colors, tier labels), small presentational components (`Card`, `Chip`, `StatBlock`, …), the `SessionTab` / `EncounterTab` result views, and the `SessionForge` root component. Styling is inline `style={{}}` plus a `<style>` block of `sf-*` classes injected from the root component; `src/App.css` is not imported.
- **Generation flow** (`generate()` in `App.jsx`):
  1. Compute an XP budget with `computeXpBudget` (`XP_THRESHOLDS[level][difficulty] * playerCount`).
  2. `fetchMonsters()` pulls candidate monsters directly from the public D&D 5e API (`https://www.dnd5eapi.co/api`) by best-fit CR. These full monster objects are kept in state and rendered as stat blocks by matching names (`findMonsterDetails`).
  3. The browser POSTs `{ form, monsters }` (monsters reduced to name/CR/HP/AC) to `/api/generate`. It never sends a prompt.
  4. The server validates every field (`validateRequest` in `session-forge-server/prompt.js`) and builds the prompt there (`buildPrompt`), including an explicit JSON schema (`sessionOutline` + `encounterBuilder`). This keeps the public endpoint from being usable as a general Claude proxy.
  5. The frontend strips code fences from the response text and `JSON.parse`s it. The result-tab components read fields from that schema directly, so changes to the JSON shape in `buildPrompt` must be mirrored in `SessionTab` / `EncounterTab`.
- **Backend** (`session-forge-server/server.js`) — keeps the Anthropic API key off the client. `POST /api/generate` goes through a per-IP rate limit (`express-rate-limit`) and an in-memory site-wide daily cap, then validation, then calls the Anthropic Messages API (model and `max_tokens` set here). It returns `{ text }`, 502 if the response hit `max_tokens`, and Anthropic's HTTP status with a generic message (raw error bodies are only logged). If `dist/` exists, the server also serves the built frontend statically.
- **Dev proxy** — `vite.config.js` proxies `/api` to `localhost:3001`, so the frontend uses relative URLs in both dev and production (same origin, so no CORS).
- **Printing** — results are printable via `window.print()`; elements with the `sf-no-print` class are hidden by an `@media print` rule.

## Configuration

- Locally, the server loads `ANTHROPIC_API_KEY` from the **repo-root** `.env` (`path.resolve(__dirname, "../.env")`), not from `session-forge-server/.env`, and exits on startup if it's missing. `PORT` defaults to 3001. `RATE_LIMIT_PER_HOUR` (default 10) and `DAILY_GENERATION_CAP` (default 200) tune the limits.
- **Deployment:** Render, defined in `render.yaml` (one Node web service). The build installs and builds the frontend, then installs the server's production dependencies; the start command is `npm start`. `ANTHROPIC_API_KEY` is set in the Render dashboard. The server trusts one proxy hop (`trust proxy`) so the rate limiter sees real client IPs.

## Notes

- `../SessionForge.jsx` (outside this repo, in the parent directory) is an earlier single-file prototype that called the Anthropic API directly from the browser. The current app is `src/App.jsx`.
- `README.md` is the unmodified Vite template README.
