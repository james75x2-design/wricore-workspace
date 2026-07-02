WriCoRe — Write · Code · Research

A free AI-powered multi-agent workspace with Writing, Coding, and Research agents — backed by a secure Dual-Engine Cloudflare Proxy.

----
⚡ What Is WriCoRe?

WriCoRe brings three specialized AI agents into one clean, focused workspace. No sign-ups required, and your API keys are never exposed in the browser.

Agent

Role

Best For

✍️ Writing Agent

Professional writing & editorial partner

Essays, blogs, emails, summaries, copy edits

💻 Coding Agent

Full-stack engineering & debugging assistant

Writing code, explaining algorithms, fixing bugs

🔍 Research Agent

Deep analysis & grounded researcher

Factual reports, comparisons, structured outlines

🚀 The Dual-Engine Architecture

Relying on a single free-tier AI API often results in rate limits. WriCoRe solves this using a custom Cloudflare Worker that securely routes your requests through a prioritized fallback queue:

Primary Engine: Google Gemini 2.5 Flash (for high-speed, 1M+ context window reasoning).

Fallback Engine: Groq's Llama 3.3 and 3.1 models. If Gemini hits a rate limit, the proxy instantly reroutes the prompt to Groq, ensuring near-100% uptime.

Your active engine is dynamically displayed in the top-left corner of the workspace UI.

----
🚦 Setup Instructions

Step 1 — Deploy the Secure Cloudflare Proxy

Because exposing API keys directly in HTML is a massive security risk, WriCoRe stores them securely on a free Cloudflare Worker.

Go to your Cloudflare Dashboard -> Workers & Pages.

Click Create Application -> Create Worker. Name it wricore-proxy.

Click Edit Code and paste the entire contents of the backend JavaScript file into the editor, then click Deploy.

Go back to the Worker's settings -> Settings -> Variables and Secrets.

Add the following secrets:

GEMINI_API_KEY — Get it free from Google AI Studio

GROQ_API_KEY — Get it free from the Groq Console

Copy your Worker's URL (e.g., https://wricore-proxy.yourname.workers.dev/).

----
Step 2 — Connect the Frontend HTML

WriCoRe is a pristine, single-file web application. No npm install, no build tools.

Open the index.html file in any code editor (like VS Code or Notepad).

Find Line 103:

const WORKER_URL = 'https://wricore.james75x2.workers.dev/';

Replace the link with the URL of your new Cloudflare Worker.

----
Save the file and double-click index.html to open it in your browser.

You are now running a highly secure, Dual-Engine AI workspace!

✨ Features

Completely Client-Side UI: Powered by Babel Standalone and React 18 CDNs.

Offline Sandbox Mode: Built-in UI testing without burning API tokens.

One-Click Actions:

Copy formatted text or code blocks instantly.

Export AI responses directly to .md Markdown files.

----
Text-to-speech integration to read responses aloud.

Branch timelines to rewind conversations.

Draft directly into Gmail.

📄 License

MIT License — free to use, modify, and share with attribution.

----
© 2026 James Earl C. Felipe. Built with Claude and Gemini. Designed for thinkers.
