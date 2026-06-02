[README.md](https://github.com/user-attachments/files/28490385/README.md)
# WriCoRe — Write · Code · Research
**A free AI-powered multi-agent workspace with Writing, Coding, and Research agents — no API key needed.**

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Version](https://img.shields.io/badge/version-2.6-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Powered by Groq](https://img.shields.io/badge/powered%20by-Groq-orange)

---

## What Is WriCoRe?

WriCoRe brings three specialized AI agents into one clean, focused workspace. No sign-up. No API key. No setup. Just open and start working.

| Agent | Role | Best For |
|-------|------|----------|
| ✍️ **Writing Agent** | Professional writing & editorial partner | Essays, blogs, emails, summaries, copy edits |
| 💻 **Coding Agent** | Full-stack engineering & debugging assistant | Writing code, explaining algorithms, fixing bugs |
| 🔍 **Research Agent** | Deep analysis & grounded researcher | Factual reports, comparisons, structured outlines |

Each agent has its own purpose-built system prompt, starter prompts, and AI safeguards — so you get focused, consistent help without babysitting the AI.

---

## 🚀 Live Demo

👉 **[Try WriCoRe Live — Free, No Sign-up](https://james75x2-design.github.io/wricore-workspace)**

> Powered by Groq's free API. Just open and start working.

---

## 💡 Why I Built This

I'm an externalizer — someone who thinks more clearly by working things through with a thinking partner rather than having ideas pre-formed in my head.

For years, getting started on complex tasks felt slow and frustrating. AI changed that. But jumping between different tools, re-explaining context each time, and figuring out how to prompt a general chatbot for a specific task added friction back in.

WriCoRe removes that friction. One workspace. Three focused agents. No setup. Just start.

---

## 🛠️ How It's Built

- **Single-file HTML app** — no framework dependencies, runs in any browser
- **Groq API** — ultra-fast free inference powering all three agents (llama-3.3-70b-versatile)
- **Purpose-built prompt engineering** — each agent has custom system instructions, safeguards, and starter prompts
- **Exponential backoff** — automatic retry logic for network failures
- **Custom markdown renderer** — renders AI output as clean formatted text with syntax-highlighted code blocks
- **Client-side only** — no backend, no database, no tracking
- **Text-to-speech** — listen to any response read aloud
- **Export to Markdown** — download any response as a .md file
- **Branch chat** — rewind and restart from any message in the conversation

---

## ✨ Key Features

- Three specialized AI agents — Writing, Coding, Research
- Completely free — no API key required from users
- Powered by Groq — some of the fastest free AI inference available
- Purpose-built prompts — no generic chatbot vagueness
- AI safeguards built into every agent
- Starter prompts to help you get moving immediately
- Text-to-speech, markdown export, branch chat
- Clean dark UI — focused and distraction-free
- Runs entirely in the browser — no server, no data collection

---

## 🚦 Getting Started

### Option 1 — Use the Live Version
Click the live demo link above. No installation, no sign-up, no API key needed.

### Option 2 — Run Locally with Your Own Groq Key
```bash
git clone https://github.com/james75x2-design/wricore-workspace.git
cd wricore-workspace
```
Open `index.html`, find `const GROQ_API_KEY = 'your-key-here'` at the top of the script, and replace with your own free Groq key from [console.groq.com](https://console.groq.com). Open in any modern browser.

---

## 🗺️ Roadmap

- [ ] Mobile-responsive layout improvements
- [ ] Memory and context persistence across sessions
- [ ] Additional agent personas (Data Agent, Design Agent)
- [ ] MCP integration for enterprise workflow connectivity
- [ ] Custom system prompt editor — let users define their own agents
- [ ] Integration with AGAD — Assisted Generation of Approval Documents

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

*© 2026 James Earl C. Felipe. Built with Claude and Gemini. Designed for thinkers.*
