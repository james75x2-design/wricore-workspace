[README.md](https://github.com/user-attachments/files/28417612/README.md)
# WriCoRe — Write · Code · Research
**A Multi-LLM AI workspace with three specialized agents — built for people who think better with a thinking partner.**

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Version](https://img.shields.io/badge/version-2.6-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Multi-LLM](https://img.shields.io/badge/Multi--LLM-4%20Providers-purple)

---

## What Is WriCoRe?

WriCoRe brings three specialized AI agents into one clean, focused workspace — powered by your choice of AI provider. No switching between tools, no re-explaining context, no setup friction. Just start.

| Agent | Role | Best For |
|-------|------|----------|
| ✍️ **Writing Agent** | Professional writing & editorial partner | Essays, blogs, emails, summaries, copy edits |
| 💻 **Coding Agent** | Full-stack engineering & debugging assistant | Writing code, explaining algorithms, fixing bugs |
| 🔍 **Research Agent** | Deep analysis & grounded researcher | Factual reports, comparisons, structured outlines |

Each agent has its own purpose-built system prompt, starter prompts, and AI safeguards — so you get focused, consistent help without babysitting the AI.

---

## 🚀 Live Demo

👉 **[Try WriCoRe Live](https://james75x2-design.github.io/wricore-workspace)**

> No account needed. Just bring a free API key — see below for how to get one in 2 minutes.

---

## 🔑 Getting a Free API Key

You don't need to pay anything to use WriCoRe. Two free options:

**Option 1 — OpenRouter (Recommended)**
- Go to [openrouter.ai](https://openrouter.ai)
- Sign up for a free account
- Go to API Keys → Create Key
- No credit card required
- Access to multiple free models including Llama, Gemma, Qwen, and Kimi

**Option 2 — Groq**
- Go to [console.groq.com](https://console.groq.com)
- Sign up for a free account
- Go to API Keys → Create API Key
- No credit card required
- Extremely fast inference — some of the fastest free models available

Once you have your key, paste it into WriCoRe's Connect modal and select your provider. Done.

---

## 🤖 Supported AI Providers

WriCoRe v2.6 supports four AI backends — switch anytime:

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| **Google Gemini** | Yes (limited) | Research agent with live Google Search grounding |
| **OpenRouter** | Yes | Access to 7+ free models in one place |
| **Groq** | Yes | Ultra-fast responses — 500-840+ tokens/second |
| **GitHub Models** | Yes (with GitHub account) | Access to GPT-5, o4-mini, Phi-4 |

---

## ✨ Features

- Three specialized AI agents — Writing, Coding, Research
- Four AI provider options — Gemini, OpenRouter, Groq, GitHub Models
- Purpose-built system prompts — no generic chatbot vagueness
- AI safeguards built into every agent
- Starter prompts to help you get moving immediately
- Text-to-speech — listen to any response read aloud
- Export to Markdown — download any response as a .md file
- Draft to Gmail — send any response directly to Gmail
- Branch chat — rewind and restart from any message
- Feedback buttons — thumbs up/down on every response
- Session management — clear and restart instantly
- Clean dark UI — focused and distraction-free
- Runs entirely in the browser — no server, no data collection

---

## 🔒 Security & Privacy

WriCoRe stores your API key in your browser's localStorage — on your own device only. Your key is never sent to any WriCoRe server because there isn't one. All API calls go directly from your browser to your chosen AI provider.

**Recommendations:**
- Don't use WriCoRe on shared or public computers
- Use provider-level key restrictions where available (e.g. domain restrictions)
- Revoke and regenerate your key anytime from your provider's dashboard

For a production deployment, server-side key management would be implemented. WriCoRe is currently a portfolio and personal productivity project.

---

## 🛠️ How It's Built

- **Single-file HTML app** — React 18, Tailwind CSS, Babel — no build step required
- **Multi-provider API architecture** — Gemini, OpenRouter, Groq, GitHub Models
- **Exponential backoff** — automatic retry logic for network failures
- **Custom markdown renderer** — renders AI output as clean formatted text with syntax-highlighted code blocks
- **Text-to-speech engine** — Web Speech API with markdown stripping for clean audio
- **Client-side only** — no backend, no database, no tracking

---

## 🚦 Getting Started

### Option 1 — Use the Live Version
Click the live demo link above. No installation needed.

### Option 2 — Run Locally
```bash
git clone https://github.com/james75x2-design/wricore-workspace.git
cd wricore-workspace
open index.html
```
Open in any modern browser. Enter your API key in the Connect modal. Start working.

---

## 🗺️ Roadmap

- [ ] Mobile-responsive layout improvements
- [ ] Memory and context persistence across sessions
- [ ] Additional agent personas (Data Agent, Design Agent)
- [ ] MCP integration for enterprise workflow connectivity
- [ ] Custom system prompt editor — let users define their own agents
- [ ] Integration with AGAD — Assisted Generation of Approval Documents

---

## 💡 Why I Built This

I'm an externalizer — someone who thinks more clearly by working things through with a thinking partner rather than having ideas pre-formed in my head.

For years, getting started on complex tasks felt slow and frustrating. AI changed that. But jumping between different tools, re-explaining context each time, and figuring out how to prompt a general chatbot for a specific task added friction back in.

WriCoRe removes that friction. One workspace. Three focused agents. Four AI providers. No setup. Just start.

---

## 🔗 Related Projects

**AGAD — Assisted Generation of Approval Documents** *(In Development)*
An AI-powered tool helping Filipino patients and their families navigate hospital LOA and insurance approval processes — built from direct personal experience with the problem. Designed for the exhausted family member standing in a hospital billing queue at 3am, trying to navigate a system they don't understand.
*Repository coming soon.*

---

## 👤 About

**James Earl C. Felipe**
AI Solutions Designer | Enterprise IT Professional
Building AI tools that solve real human problems.

🔗 [LinkedIn](https://linkedin.com/in/james-earl-felipe-13359665) · 📧 james75x2@gmail.com

---

## 📄 License

MIT License — free to use, modify, and share with attribution.

---

*Built with Claude and Gemini. Designed for thinkers.*
