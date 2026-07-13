# WriCoRe — Write · Code · Research
**A dual-engine AI workspace with three specialized agents — built for people who think better with a thinking partner.**

![Status](https://img.shields.io/badge/status-live-brightgreen) ![Worker](https://img.shields.io/badge/worker-v3.1-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Backend](https://img.shields.io/badge/backend-Cloudflare%20Workers-orange) ![Engine](https://img.shields.io/badge/AI-Gemini%20%2B%20Groq-purple) ![Frontend](https://img.shields.io/badge/frontend-GitHub%20Pages-lightgrey)

---

## What Is WriCoRe?

WriCoRe brings three specialized AI agents into one clean, focused workspace — powered by a dual-engine backend that automatically routes requests to the best available provider. No API keys required from users. No switching between tools. No re-explaining context. Just start.

| Agent | Role | Best For |
|-------|------|----------|
| ✍️ **Writing Agent** | Professional writing & editorial partner | Essays, blogs, emails, summaries, copy edits |
| 💻 **Coding Agent** | Full-stack engineering & debugging assistant | Writing code, explaining algorithms, fixing bugs |
| 🔍 **Research Agent** | Deep analysis & grounded researcher | Factual reports, comparisons, structured outlines |

Each agent has its own purpose-built system prompt, starter suggestions, and AI safeguards — so you get focused, consistent help without babysitting the AI.

---

## 🚀 Live Demo

👉 **[Try WriCoRe Live](https://james75x2-design.github.io/wricore-workspace/)**

Backend health check: https://wricore.james75x2.workers.dev/health

No account needed. No API key required. Fully operational on load.

---

## 🖼️ Screenshots

### 1. Writing Agent (WRITE-BOT v3.1)

Your premium writing partner for essays, blogs, emails, summaries, and complex copy edits.

<img src="https://raw.githubusercontent.com/james75x2-design/wricore-workspace/main/docs/screenshots/01-writing-agent.png" alt="Writing Agent (WRITE-BOT v3.1)">

---

### 2. Coding Agent (DEV-BOT v3.1)

Your interactive code companion. Writes clean code, explains algorithms, and refactors bugs.

<img src="https://raw.githubusercontent.com/james75x2-design/wricore-workspace/main/docs/screenshots/02-coding-agent.png" alt="Coding Agent (DEV-BOT v3.1)">

---

### 3. Research Agent (ANALYST-BOT v3.1)

Empowered with factual grounding to synthesize deep, logical reports.

<img src="https://raw.githubusercontent.com/james75x2-design/wricore-workspace/main/docs/screenshots/03-research-agent.png" alt="Research Agent (ANALYST-BOT v3.1)">

---

## 🏗️ Architecture

<img src="https://raw.githubusercontent.com/james75x2-design/wricore-workspace/main/docs/screenshots/architecture.png" alt="WriCoRe Architecture Diagram — dual-engine AI workspace with Gemini primary and Groq fallback">

**Data flow**

1. User picks an agent (Writing / Coding / Research) from the top switcher.
2. UI applies the agent's theme, prompt templates, and system prompt.
3. Message POSTed to Cloudflare Worker with the agent-specific context.
4. Worker validates payload, tries Gemini first, falls to Groq on failure.
5. Response returned as JSON with model name + metadata.
6. UI renders response with the active agent's styling and shows which engine answered.

---

## 🤖 Dual-Engine Architecture

WriCoRe uses a **Cloudflare Worker** as a secure backend proxy that manages two AI providers automatically:

```
Browser → Cloudflare Worker → Gemini (primary)
                            ↘ Groq (fallback, if Gemini fails)
```

**Google Gemini** is tried first on every request. If Gemini fails for any reason — rate limit, safety block, timeout, missing key, network error, or empty response — the Worker automatically retries with **Groq** without the user ever knowing. Every response comes back in OpenAI-compatible format regardless of which provider handled it.

The frontend header shows the **active engine** used for each response in real time (`GEMINI-2.0-FLASH`, `LLAMA-3.3-70B-VERSATILE`, or `OFFLINE SIMULATION`).

### Fallback trigger conditions

The Worker falls back from Gemini to Groq on:
- Non-2xx HTTP status from Gemini
- Gemini safety block (`promptFeedback.blockReason`)
- Empty or missing candidates/parts in the response
- JSON parse failure on the Gemini response
- Network error or 25-second timeout
- Missing `GEMINI_API_KEY` environment variable

---

## ✨ Features

- Three specialized AI agents — Writing, Coding, Research
- Dual-engine backend — Gemini primary, Groq fallback, fully automatic
- Live engine indicator — shows which AI model handled each response
- Purpose-built system prompts — no generic chatbot vagueness
- Temporal anchoring — every request includes the real current date to prevent date hallucination
- Starter suggestions — three pre-built prompts per agent to get moving immediately
- Text-to-speech — listen to any response read aloud (Web Speech API)
- Export to Markdown — download any response as a `.md` file
- Draft to Gmail — open any response directly in Gmail Compose
- Branch chat — rewind and restart the conversation from any message
- Feedback buttons — thumbs up/down on every AI response
- Copy to clipboard — one-click copy on any response or code block
- Syntax-highlighted code blocks — with per-block copy button
- Offline Demo Mode — test the full interface without any network connection
- Session management — clear and restart instantly
- Clean dark UI — focused and distraction-free
- No server-side user data — API keys never touch the frontend

---

## 📡 API Reference

### `GET /health`

Returns operational status. Useful for uptime monitors.

```bash
curl https://wricore.james75x2.workers.dev/health
```

Response:
```json
{
  "status": "ok",
  "service": "wricore-worker",
  "version": "3.1.0",
  "timestamp": "2026-07-11T00:00:00.000Z"
}
```

### `POST /`

Main chat endpoint. OpenAI-compatible message format.

```bash
curl -X POST https://wricore.james75x2.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "system", "content": "You are a writing assistant." },
      { "role": "user", "content": "Draft a professional email declining a meeting." }
    ],
    "temperature": 0.7
  }'
```

Success response (200):
```json
{
  "choices": [{ "message": { "role": "assistant", "content": "…" } }],
  "model": "GEMINI-2.0-FLASH",
  "meta": { "version": "3.1", "latency_ms": 780 }
}
```

Error responses:

| Status | Meaning |
|---|---|
| `400` | Malformed payload |
| `404` | Unknown path |
| `405` | Wrong HTTP method |
| `429` | All providers rate-limited |
| `502` | All providers failed |

**Payload limits:** Max 30 messages per request, max 8000 characters per message.

**CORS:** Locked to GitHub Pages + localhost origins (v3.1). Update `ALLOWED_ORIGINS` in the worker if you fork.

---

## 🔒 Security Architecture

| Layer | Implementation |
|-------|---------------|
| API key storage | Cloudflare Worker encrypted environment secrets |
| Frontend exposure | Zero — keys never appear in HTML, JS, or network responses |
| CORS policy | Origin allowlist (v3.1) — `james75x2-design.github.io` + localhost dev |
| Request validation | Worker rejects non-POST, malformed JSON, oversized payloads, empty message arrays |
| Provider errors | Sanitized before returning to client — raw API errors never forwarded |
| Payload limits | Max 30 messages, max 8000 chars per message |

---

## 🛠️ How It's Built

**Frontend**
- Single-file HTML app — React 18, Tailwind CSS, Babel (in-browser, no build step)
- CDN: `cdn.jsdelivr.net` for React, ReactDOM, and Babel (reliable behind ad-blockers and firewalls)
- JSX compiled at runtime using Babel's classic runtime (prevents `import` statement injection into non-module scripts)
- Custom markdown renderer — renders AI output as formatted text with syntax-highlighted, copyable code blocks
- Text-to-speech via Web Speech API with markdown stripping for clean audio

**Backend**
- Cloudflare Worker (free tier — 100,000 requests/day)
- Helper functions: `jsonResponse()`, `getCorsHeaders()`, `fetchWithTimeout()`, `logEvent()`, `validateMessages()`
- OpenAI-compatible endpoint for both Gemini and Groq
- 25-second timeout on both providers via `AbortController`
- Structured JSON logging (v3.1) — severity-aware for Cloudflare log search
- Always returns OpenAI-compatible `choices[0].message.content` shape

**Hosting**
- Frontend: GitHub Pages (`james75x2-design.github.io/wricore-workspace`)
- Backend: Cloudflare Workers (`wricore.james75x2.workers.dev`)

---

## 🏗️ Repository Structure

```text
wricore-workspace/
├── index.html                    # Frontend — single-file React app with 3 agents
├── cloudflare_worker_proxy.js    # Cloudflare Worker — Gemini + Groq gateway (v3.1)
├── README.md                     # This file
├── LICENSE                       # MIT
├── HARNESS.md                    # Evaluation harness for the 3 agents
├── .env.example                  # Example env vars for local dev
└── docs/
    ├── architecture.png          # Architecture diagram
    └── screenshots/              # UI screenshots per agent
        ├── 01-writing-agent.png
        ├── 02-coding-agent.png
        └── 03-research-agent.png
```

Deployed via **GitHub Pages** from `main`. Backend runs on **Cloudflare Workers** at `wricore.james75x2.workers.dev`.

---

## 🚦 Getting Started (Self-Hosting)

### Option 1 — Use the Live Version
Click the live demo link above. No setup needed.

### Option 2 — Deploy Your Own

**1. Clone the repo**
```bash
git clone https://github.com/james75x2-design/wricore-workspace.git
cd wricore-workspace
```

**2. Deploy the Cloudflare Worker**
- Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create Worker
- Paste the contents of `cloudflare_worker_proxy.js` into the editor
- Click **Save and Deploy**
- Go to **Settings → Variables and Secrets** and add:
  - `GEMINI_API_KEY` (Secret) — get from [aistudio.google.com](https://aistudio.google.com)
  - `GROQ_API_KEY` (Secret) — get from [console.groq.com](https://console.groq.com)
- Verify: `curl https://<your-worker>.workers.dev/health`

**3. Update the Worker URL in `index.html`**

Find this line and replace with your own Worker URL:
```javascript
const WORKER_URL = 'https://wricore.james75x2.workers.dev/';
```

Also update `ALLOWED_ORIGINS` in the Worker if you fork this project to include your GitHub Pages URL.

**4. Deploy the frontend to GitHub Pages**
- Push `index.html` to your repo's `main` branch
- Go to **Settings → Pages** → Source: `main` branch → Save
- Your app will be live at `https://<your-username>.github.io/<repo-name>`

---

## 🗺️ Roadmap

- [x] Evaluation harness (`HARNESS.md`) for measuring quality per agent
- [x] Worker hardening (v3.1) — CORS allowlist, /health endpoint, structured logging, timeouts
- [ ] Mobile-responsive layout improvements
- [ ] Persistent conversation history across sessions
- [ ] Additional agent personas (Data Agent, Design Agent)
- [ ] Custom system prompt editor — define your own agents
- [ ] MCP integration for enterprise workflow connectivity
- [ ] Integration with AGAD — Assisted Generation of Approval Documents
- [ ] Automated harness runner (Node.js script)
- [ ] Streaming responses for faster perceived latency

---

## 💡 Why I Built This

I'm an externalizer — someone who thinks more clearly by working things through with a thinking partner rather than having ideas pre-formed in my head.

For years, getting started on complex tasks felt slow and frustrating. AI changed that. But jumping between different tools, re-explaining context each time, and figuring out how to prompt a general chatbot for a specific task added friction back in.

WriCoRe removes that friction. One workspace. Three focused agents. Two AI providers with automatic failover. No setup. Just start.

---

## 🔗 Related Projects

**VoyageFlow — AI Travel Concierge** *(Live)*
A free, zero-friction AI travel concierge with a Premium Booking Desk — instant itineraries and pre-filled deep links for flights, hotels, tours, and insurance. Built with the same dual-engine architecture (Gemini + Groq via Cloudflare Workers) and scored 91.6% on AgentTalent's Sensei evaluation suite.
🔗 [Try VoyageFlow Live](https://james75x2-design.github.io/VoyageFlow/)

**AGAD — Assisted Generation of Approval Documents** *(In Development)*
An AI-powered tool helping Filipino patients and their families navigate hospital LOA and insurance approval processes — built from direct personal experience with the problem. Designed for the exhausted family member standing in a hospital billing queue at 3am, trying to navigate a system they don't understand.
*Repository coming soon.*

---

## 👤 About

**James Earl C. Felipe**
AI Solutions Designer | Enterprise IT Professional
Building AI tools that solve real human problems.

🔗 https://linkedin.com/in/james-earl-felipe-13359665 · 📧 james75x2@gmail.com

---

## 📄 License

MIT License — free to use, modify, and share with attribution. See `LICENSE` for full text.

---

## 📋 Version History

| Version | Changes |
|---------|---------|
| **v3.1** | CORS allowlist, `/health` endpoint, structured JSON logging, 25s timeout protection via `AbortController`, payload validation (max 30 messages, max 8000 chars), version + latency metadata in every response, cleaner model queue |
| v3.0 | Dual-engine backend (Gemini primary + Groq fallback via Cloudflare Worker), live engine indicator, CDN switched to jsdelivr, Babel classic runtime fix, `React.createElement` render fix |
| v2.6 | Groq-only with Cloudflare Worker proxy, text-to-speech, markdown export, branch chat, feedback buttons |
| v2.5 | Initial multi-provider version (Gemini, OpenRouter, Groq, GitHub Models) |

---

*Built with Claude and Gemini. Designed for thinkers.*
