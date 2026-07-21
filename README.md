# WriCoRe — Write · Code · Research

**A dual-engine AI workspace with three specialized agents and grounded RAG — built for people who think better with a thinking partner.**

![Status](https://img.shields.io/badge/status-live-brightgreen)
![Worker](https://img.shields.io/badge/worker-v3.3.0-blue)
![RAG](https://img.shields.io/badge/RAG-hybrid%20+%20reranker-brightgreen)
![Eval](https://img.shields.io/badge/eval-100%25%20pass-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![Backend](https://img.shields.io/badge/backend-Cloudflare%20Workers-orange)
![Engine](https://img.shields.io/badge/AI-Gemini%20%2B%20Groq-purple)
![Frontend](https://img.shields.io/badge/frontend-GitHub%20Pages-lightgrey)

---

## What Is WriCoRe?

WriCoRe brings three specialized AI agents into one clean, focused workspace — powered by a dual-engine backend that automatically routes requests to the best available provider. **The Research Agent additionally supports Grounded RAG mode**, returning cited answers from an embedded knowledge base using hybrid retrieval + cross-encoder reranking. No API keys required from users. No switching between tools. No re-explaining context. Just start.

| Agent | Role | Best For | Modes |
|-------|------|----------|-------|
| ✍️ **Writing Agent** | Professional writing & editorial partner | Essays, blogs, emails, summaries, copy edits | Chat |
| 💻 **Coding Agent** | Full-stack engineering & debugging assistant | Writing code, explaining algorithms, fixing bugs | Chat |
| 🔍 **Research Agent** | Deep analysis & grounded researcher | Factual reports, comparisons, structured outlines | **Chat + Grounded RAG** |

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

Empowered with factual grounding to synthesize deep, logical reports. **Now with Grounded RAG mode** — toggle to get answers cited directly from the WriCoRe knowledge base.

<img src="https://raw.githubusercontent.com/james75x2-design/wricore-workspace/main/docs/screenshots/03-research-agent.png" alt="Research Agent (ANALYST-BOT v3.1)">

---

### 4. Grounded RAG Mode with Sources Strip *(NEW in v3.3.0)*

Grounded answers cite chunks directly from the WriCoRe knowledge base. Every claim is traceable to a chunk ID via the green Sources pills below each answer.

<img src="https://raw.githubusercontent.com/james75x2-design/wricore-workspace/main/docs/screenshots/04-grounded-rag-sources.png" alt="Research Agent in Grounded RAG mode showing Sources strip">

---

## 🧠 Grounded RAG Mode *(v3.3.0)*

The Research Agent now supports a **Grounded RAG mode** that answers factual questions from an embedded knowledge base with citations. Toggle it from the mode pill above the input.

### How it works

```
User query → Cloudflare Worker (mode: "rag")
             ↓
             1. Hybrid Retrieval: keyword scoring + vector cosine similarity
                against 31 embedded chunks (@cf/baai/bge-small-en-v1.5, 384-dim)
             ↓
             2. Cross-encoder Reranker: rescore top-20 candidates
                with @cf/baai/bge-reranker-base
             ↓
             3. Top-5 chunks → citation-enforced LLM prompt
             ↓
             4. Response: { answer_markdown, citations, unanswered, meta }
             ↓
UI renders:  Clean prose (inline [chunk_id] markers stripped)
             + Sources strip with green chunk pills
```

**Two Cloudflare Workers AI models running natively:**

| Model | Purpose |
|---|---|
| `@cf/baai/bge-small-en-v1.5` | 384-dim query + chunk embeddings |
| `@cf/baai/bge-reranker-base` | Cross-encoder rerank scoring |

### RAG features

- **Hybrid retrieval** — keyword scoring + vector cosine similarity, fused 0.5/0.5 (normalized to [0,1])
- **Cross-encoder reranker** — refines top-20 hybrid candidates to top-5 for the LLM
- **Citation enforcement** — hallucinated chunk IDs are filtered against the retrieved set before response
- **Graceful fallbacks** — vector → keyword-only, reranker → hybrid fusion, if either AI call fails
- **Structured logs** tag `retrieval_signal` (`hybrid` | `keyword_only`) and `ranking_signal` (`reranker` | `hybrid_fusion`)
- **Failure categorization** — eval reports classify each failure (`retrieval_fail` | `generation_fail` | `grounding_fail` | `unanswered_mismatch`)

### Evaluation

**100% pass rate** on the local eval harness (10 test cases including prompt injection, out-of-scope refusal, and semantic queries):

| Metric | Pre-Phase 1 | After Phase 1-3 | Delta |
|---|---|---|---|
| Total tests | 10 | 10 | — |
| Passed | 7 | **10** | **+3** |
| Retrieval passed | 9 | 10 | +1 |
| Answer passed | 8 | 10 | +2 |
| Overall pass rate | 70% | **100%** | **+30pp** |

Run the eval harness yourself:

```bash
node src/rag/eval.mjs
```

Reports archived in `eval-report-pre-phase1-baseline.json`, `eval-report-phase1-hybrid-final.json`, and `eval-report-phase23-final.json`.

---

## 🏗️ Architecture

<img src="https://raw.githubusercontent.com/james75x2-design/wricore-workspace/main/docs/screenshots/architecture.png" alt="WriCoRe Architecture Diagram — dual-engine AI workspace with Gemini primary and Groq fallback">

**Data flow (Chat mode)**

1. User picks an agent (Writing / Coding / Research) from the top switcher.
2. UI applies the agent's theme, prompt templates, and system prompt.
3. Message POSTed to Cloudflare Worker with the agent-specific context.
4. Worker validates payload, tries Gemini first, falls to Groq on failure.
5. Response returned as JSON with model name + metadata.
6. UI renders response with the active agent's styling.

**Data flow (Grounded RAG mode — Research Agent only)**

1. User toggles mode to **Grounded RAG** on the Research Agent.
2. UI POSTs `{ mode: "rag", messages: [...] }` to the Worker.
3. Worker runs hybrid retrieval across 31 embedded KB chunks.
4. Cross-encoder reranker refines top-20 candidates → top-5.
5. Citation-enforced prompt sent to Gemini (with Groq fallback).
6. Response normalized into `{ answer_markdown, citations, chunks_used }`.
7. UI strips inline `[chunk_id]` markers from prose, renders Sources strip below.

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
- **Grounded RAG mode on Research Agent (v3.3.0)** — hybrid retrieval + reranker + citations
- **Sources strip** — green chunk pills below RAG answers for verification
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
  "version": "3.3.0",
  "timestamp": "2026-07-21T00:00:00.000Z"
}
```

### `POST /` — Chat mode (default)

OpenAI-compatible message format. Used by all three agents when no `mode` is specified.

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
  "meta": { "version": "3.3.0", "latency_ms": 780 }
}
```

### `POST /` — Grounded RAG mode *(NEW in v3.3.0)*

Set `mode: "rag"` to route through hybrid retrieval + reranker + citation-enforced generation.

```bash
curl -X POST https://wricore.james75x2.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "rag",
    "messages": [
      { "role": "user", "content": "what is WriCoRe" }
    ]
  }'
```

Success response (200):
```json
{
  "answer_markdown": "WriCoRe is a dual-engine AI workspace that brings three specialized AI agents into one clean, focused workspace [wricore-readme::002]. It is built for people who think better with a thinking partner [wricore-readme::001].",
  "citations": [
    { "claim": "WriCoRe brings three specialized AI agents", "chunk_ids": ["wricore-readme::002"] },
    { "claim": "Built for people who think better with a thinking partner", "chunk_ids": ["wricore-readme::001"] }
  ],
  "unanswered": false,
  "meta": {
    "mode": "rag",
    "model": "LLAMA-3.3-70B-VERSATILE",
    "version": "3.3.0",
    "latency_ms": 1554,
    "chunks_used": [
      { "chunk_id": "wricore-readme::002", "section": "What Is WriCoRe?", "score": 0.9954, "keyword_score": 36, "vector_score": 0.6983, "rerank_score": 0.9817 }
    ]
  }
}
```

### Error responses

| Status | Meaning |
|---|---|
| `400` | Malformed payload |
| `404` | Unknown path |
| `405` | Wrong HTTP method |
| `429` | All providers rate-limited |
| `502` | All providers failed |

**Payload limits:** Max 30 messages per request, max 8000 characters per message.

**CORS:** Locked to GitHub Pages + localhost origins. Update `ALLOWED_ORIGINS` in the worker if you fork.

---

## 🔒 Security Architecture

| Layer | Implementation |
|-------|---------------|
| API key storage | Cloudflare Worker encrypted environment secrets |
| Frontend exposure | Zero — keys never appear in HTML, JS, or network responses |
| CORS policy | Origin allowlist — `james75x2-design.github.io` + localhost dev |
| Request validation | Worker rejects non-POST, malformed JSON, oversized payloads, empty message arrays |
| Provider errors | Sanitized before returning to client — raw API errors never forwarded |
| Payload limits | Max 30 messages, max 8000 chars per message |
| **RAG citation enforcement** | Hallucinated chunk IDs filtered against retrieved set before response |
| **Prompt injection defense** | RAG prompt explicitly forbids inventing sources; verified via eval `vf-eval-008` |

---

## 🛠️ How It's Built

**Frontend**
- Single-file HTML app — React 18, Tailwind CSS, Babel (in-browser, no build step)
- CDN: `cdn.jsdelivr.net` for React, ReactDOM, and Babel (reliable behind ad-blockers and firewalls)
- JSX compiled at runtime using Babel's classic runtime
- **Mode toggle** on Research Agent — Chat / Grounded RAG with animated pills
- **Sources strip renderer** — green chunk pills below RAG answers with `BookIcon` visual affordance
- Custom markdown renderer — renders AI output as formatted text with syntax-highlighted, copyable code blocks
- Inline `[chunk_id]` markers stripped from RAG prose for clean display
- Text-to-speech via Web Speech API with markdown stripping for clean audio

**Backend (Cloudflare Worker v3.3.0)**
- ES module deployed via **Wrangler CLI** (`wrangler.toml` + `[ai]` binding)
- Cloudflare Workers AI native models — no external embedding/rerank APIs
- Chat mode: OpenAI-compatible dual-engine router (Gemini primary + Groq fallback)
- **RAG mode**: hybrid retrieval + cross-encoder reranker + citation-enforced generation
- 31 chunks embedded inline in `data/index/worker-chunks.js` (~315 KB, well under 1 MB limit)
- Helper functions: `jsonResponse()`, `getCorsHeaders()`, `fetchWithTimeout()`, `logEvent()`, `validateMessages()`, `ragRetrieveHybrid()`, `rerankCandidates()`, `ragBuildPrompt()`, `ragNormalizeAnswer()`
- 25-second timeout on all upstream calls via `AbortController`
- Structured JSON logging — severity-aware for Cloudflare log search, tagged with `retrieval_signal` + `ranking_signal`
- Graceful fallback ladder: vector → keyword-only, reranker → hybrid fusion

**Local RAG pipeline (dev/eval only)**
- `src/rag/retrieve.mjs` — keyword-scored + hybrid retriever with stopwords, section boosts, phrase boosts
- `src/rag/answer-with-context.mjs` — Worker-integrated grounded answer pipeline with validation
- `src/rag/eval.mjs` — evaluation harness with failure categorization
- `scripts/embed-chunks.mjs` — batch-embeds KB chunks via Cloudflare AI
- `scripts/build-worker-chunks.mjs` — regenerates `data/index/worker-chunks.js` for Worker

**Hosting**
- Frontend: GitHub Pages (`james75x2-design.github.io/wricore-workspace`)
- Backend: Cloudflare Workers (`wricore.james75x2.workers.dev`)

---

## 🏗️ Repository Structure

```text
wricore-workspace/
├── index.html                        # Frontend — React app with 3 agents + RAG mode toggle
├── cloudflare_worker_proxy.js        # Cloudflare Worker v3.3.0 — dual-engine + mode:rag + reranker
├── wrangler.toml                     # Wrangler CLI config with [ai] binding
├── README.md                         # This file
├── LICENSE                           # MIT
├── HARNESS.md                        # Evaluation harness documentation
├── .env.example                      # Example env vars for local dev
├── eval-data.json                    # RAG eval test cases (10 total)
├── eval-report*.json                 # Archived eval results per phase
├── data/
│   ├── kb/                           # Knowledge base source markdown
│   └── index/
│       ├── chunks.jsonl              # Chunked KB with metadata
│       ├── chunks-embedded.jsonl     # Same + embeddings
│       └── worker-chunks.js          # Chunks + embeddings inlined for Worker
├── src/rag/
│   ├── retrieve.mjs                  # Local keyword + hybrid retriever
│   ├── answer-with-context.mjs       # Local RAG answer pipeline
│   ├── ingest-and-chunk.mjs          # KB ingestion
│   └── eval.mjs                      # Eval harness with failure categorization
├── scripts/
│   ├── embed-chunks.mjs              # Batch-generate embeddings
│   └── build-worker-chunks.mjs       # Rebuild worker-chunks.js
└── docs/
    ├── architecture.png
    └── screenshots/
        ├── 01-writing-agent.png
        ├── 02-coding-agent.png
        ├── 03-research-agent.png
        └── 04-grounded-rag-sources.png
```

Deployed via **GitHub Pages** from `main`. Backend runs on **Cloudflare Workers** at `wricore.james75x2.workers.dev` via **Wrangler CLI**.

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

**2. Deploy the Cloudflare Worker via Wrangler CLI**
```bash
npm install --save-dev wrangler
npx wrangler login   # or set CLOUDFLARE_API_TOKEN env var
npx wrangler secret put GEMINI_API_KEY   # from https://aistudio.google.com
npx wrangler secret put GROQ_API_KEY     # from https://console.groq.com
npx wrangler deploy
```

**3. Verify the Worker**
```bash
curl https://<your-worker>.workers.dev/health
```

**4. (Optional) Rebuild embeddings for your own knowledge base**

Place your Markdown docs in `data/kb/`, then:

```bash
node src/rag/ingest-and-chunk.mjs      # Chunk your KB
node scripts/embed-chunks.mjs          # Generate embeddings via Cloudflare AI
node scripts/build-worker-chunks.mjs   # Bundle for Worker
npx wrangler deploy                    # Redeploy Worker with new chunks
```

**5. Update the Worker URL in `index.html`**

Find this line and replace with your own Worker URL:
```javascript
const WORKER_URL = 'https://wricore.james75x2.workers.dev/';
```

Also update `ALLOWED_ORIGINS` in the Worker if you fork this project to include your GitHub Pages URL.

**6. Deploy the frontend to GitHub Pages**
- Push `index.html` to your repo's `main` branch
- Go to **Settings → Pages** → Source: `main` branch → Save
- Your app will be live at `https://<your-username>.github.io/<repo-name>`

---

## 🗺️ Roadmap

- [x] Evaluation harness (`HARNESS.md`) for measuring quality per agent
- [x] Worker hardening (v3.1) — CORS allowlist, /health endpoint, structured logging, timeouts
- [x] **Local hybrid retrieval (Phase 1)** — keyword + vector fusion, failure categorization
- [x] **Production hybrid retrieval (Phase 2)** — Worker `mode:rag` branch with embedded 31 chunks
- [x] **Cross-encoder reranker (Phase 3)** — `@cf/baai/bge-reranker-base` on top-20 hybrid candidates
- [x] **UI mode toggle (Phase 4 Component 1)** — Chat vs Grounded RAG on Research Agent + Sources strip
- [x] Wrangler CLI deploy pipeline with `[ai]` binding
- [ ] **Phase 4 Component 2** — Local `answer-with-context.mjs` calls Worker's `mode:rag` for eval-vs-production parity
- [ ] **Phase 4 Component 3** — `eval.mjs` exercises Worker's `mode:rag` path for full end-to-end coverage
- [ ] Mobile-responsive layout improvements
- [ ] Persistent conversation history across sessions
- [ ] Additional agent personas (Data Agent, Design Agent)
- [ ] Custom system prompt editor — define your own agents
- [ ] Grounded RAG mode on Writing and Coding agents (with agent-specific KBs)
- [ ] Streaming responses for faster perceived latency
- [ ] MCP integration for enterprise workflow connectivity
- [ ] Integration with AGAD — Assisted Generation of Approval Documents

---

## 💡 Why I Built This

I'm an externalizer — someone who thinks more clearly by working things through with a thinking partner rather than having ideas pre-formed in my head.

For years, getting started on complex tasks felt slow and frustrating. AI changed that. But jumping between different tools, re-explaining context each time, and figuring out how to prompt a general chatbot for a specific task added friction back in.

WriCoRe removes that friction. One workspace. Three focused agents. Two AI providers with automatic failover. Grounded RAG when you need factual answers with citations. No setup. Just start.

---

## 🔗 Related Projects

**VoyageFlow — AI Travel Concierge** *(Live)*
A free, zero-friction AI travel concierge with a Premium Booking Desk — instant itineraries and pre-filled deep links for flights, hotels, tours, and insurance. Built with the same dual-engine architecture (Gemini + Groq via Cloudflare Workers) and hybrid retrieval RAG (v2.3.0). Scored 91.6% on AgentTalent's Sensei evaluation suite.
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
| **v3.3.0** | **Cross-encoder reranker** (`@cf/baai/bge-reranker-base`) refines top-20 hybrid candidates to top-5; `chunks_used` includes `rerank_score`; structured logs tag `ranking_signal`; graceful fallback to hybrid fusion if reranker fails |
| **v3.2.0** | **Grounded RAG mode** (`mode: "rag"`) with 31 embedded knowledge base chunks; hybrid retrieval (keyword + vector cosine similarity via `@cf/baai/bge-small-en-v1.5`); citation enforcement filters hallucinated chunk IDs; structured logs tag `retrieval_signal`; Wrangler CLI deploy pipeline with `[ai]` binding |
| **v3.1** | CORS allowlist, `/health` endpoint, structured JSON logging, 25s timeout protection via `AbortController`, payload validation (max 30 messages, max 8000 chars), version + latency metadata in every response, cleaner model queue |
| v3.0 | Dual-engine backend (Gemini primary + Groq fallback via Cloudflare Worker), live engine indicator, CDN switched to jsdelivr, Babel classic runtime fix, `React.createElement` render fix |
| v2.6 | Groq-only with Cloudflare Worker proxy, text-to-speech, markdown export, branch chat, feedback buttons |
| v2.5 | Initial multi-provider version (Gemini, OpenRouter, Groq, GitHub Models) |

### Phase-by-phase RAG evolution (Sunday July 20, 2026)

| Phase | Ship | Impact |
|---|---|---|
| **Phase 1** — Local hybrid retrieval | Keyword + vector fusion, failure categorization | 70% → 100% eval pass (+30pp) |
| **Phase 2** — Worker `mode:rag` branch | 31 chunks embedded, hybrid retrieval, citation enforcement | Production RAG endpoint live |
| **Phase 3** — Cross-encoder reranker | `@cf/baai/bge-reranker-base` refines candidates | Higher answer quality with rerank scores |
| **Phase 4 Component 1** — UI mode toggle | Research Agent shows Chat / Grounded RAG toggle + Sources strip | End-users can trigger RAG mode |

---

*Built with Claude and Gemini. Designed for thinkers.*
