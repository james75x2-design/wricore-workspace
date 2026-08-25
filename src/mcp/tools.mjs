// WriCoRe MCP — Tool registry (Phase 5).
// Keyless tools executed through the MCP tool-loop. calculator + current_time
// are deterministic demos; web_search does REAL external I/O against the keyless
// Wikipedia REST API (no key, Worker-safe fetch) — proving the loop can consume
// live external data. NOTE: web_search is a real external TOOL, not a connection
// to a remote MCP *server* (that JSON-RPC/Streamable-HTTP client is future work).

export const TOOL_DEFS = [
  {
    name: "calculator",
    description:
      "Evaluate a basic arithmetic expression (+, -, *, /, parentheses). " +
      "Use for any exact numeric calculation instead of doing mental math.",
    parameters: {
      type: "object",
      properties: { expression: { type: "string", description: "e.g. '(3 + 4) * 5'" } },
      required: ["expression"]
    }
  },
  {
    name: "current_time",
    description:
      "Get the current UTC date and time. Use when the user asks what time or " +
      "date it is, or needs a timestamp.",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    name: "web_search",
    description:
      "Search Wikipedia for factual, encyclopedic information about a topic, " +
      "person, place, event, or concept. Returns titles, short descriptions, " +
      "snippet excerpts, and article URLs. Use this when the user asks about " +
      "real-world facts that may be outside your training data or need a citable " +
      "source. Always cite the returned URLs in your answer.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Search terms, e.g. 'Model Context Protocol'" } },
      required: ["query"]
    }
  },
  {
    name: "github_search",
    description:
      "Search public GitHub repositories by keyword. Returns top repos with " +
      "full name, description, star count, primary language, and URL. Use for " +
      "questions about open-source projects, libraries, packages, SDKs, or frameworks.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "GitHub keywords, e.g. 'cloudflare workers kv cache'. Do not include the word github." } },
      required: ["query"]
    }
  },
  {
    name: "docs_search",
    description:
      "Search official developer documentation (MDN Web Docs) for web platform, " +
      "JavaScript, CSS, HTML, DOM, and browser API references. Use when the user " +
      "asks how to use a web/JS/CSS feature, method, property, or API, or wants an " +
      "authoritative docs link. Returns titles, summaries, and doc URLs. Always cite the URLs.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Docs keywords, e.g. 'array flatMap' or 'css grid template columns'" } },
      required: ["query"]
    }
  }
];

// ── calculator: Workers-safe recursive-descent parser (NO eval / NO Function) ──
function safeCalculate(expr) {
  const s = String(expr || "").trim();
  if (!/^[0-9+\-*/().\s]+$/.test(s)) return { error: "Only numbers and + - * / ( ) are allowed." };
  if (s.length > 100) return { error: "Expression too long." };
  let i = 0;
  const skip = () => { while (i < s.length && s[i] === " ") i++; };
  function parseExpr() {
    let v = parseTerm(); skip();
    while (i < s.length && (s[i] === "+" || s[i] === "-")) { const op = s[i++]; const r = parseTerm(); v = op === "+" ? v + r : v - r; skip(); }
    return v;
  }
  function parseTerm() {
    let v = parseFactor(); skip();
    while (i < s.length && (s[i] === "*" || s[i] === "/")) { const op = s[i++]; const r = parseFactor(); v = op === "*" ? v * r : v / r; skip(); }
    return v;
  }
  function parseFactor() {
    skip();
    if (s[i] === "+") { i++; return parseFactor(); }
    if (s[i] === "-") { i++; return -parseFactor(); }
    if (s[i] === "(") { i++; const v = parseExpr(); skip(); if (s[i] !== ")") throw new Error("missing )"); i++; return v; }
    const start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (i === start) throw new Error("expected number");
    const num = Number(s.slice(start, i));
    if (!Number.isFinite(num)) throw new Error("bad number");
    return num;
  }
  try {
    const value = parseExpr(); skip();
    if (i !== s.length) return { error: "Invalid arithmetic expression." };
    if (!Number.isFinite(value)) return { error: "Expression did not evaluate to a finite number." };
    return { expression: s, result: value };
  } catch { return { error: "Invalid arithmetic expression." }; }
}

// ── web_search: keyless Wikipedia REST API. Wikimedia asks for a descriptive UA ──
const WIKI_SEARCH_URL = "https://en.wikipedia.org/w/rest.php/v1/search/page";
const WIKI_UA = "WriCoRe/1.0 (+https://github.com/james75x2-design/wricore-workspace)";
function stripTags(s) { return String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }

async function webSearch(query) {
  const q = String(query || "").trim();
  if (!q) return { error: "Empty search query." };
  const url = `${WIKI_SEARCH_URL}?q=${encodeURIComponent(q)}&limit=5`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": WIKI_UA }, signal: controller.signal });
    if (!r.ok) return { error: `Wikipedia search HTTP ${r.status}` };
    const j = await r.json();
    const pages = Array.isArray(j.pages) ? j.pages : [];
    if (pages.length === 0) return { query: q, source: "wikipedia", results: [], note: "No Wikipedia results for this query." };
    return {
      query: q,
      source: "wikipedia",
      results: pages.slice(0, 5).map(p => ({
        title: p.title,
        description: p.description || null,
        excerpt: stripTags(p.excerpt),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.key)}`
      }))
    };
  } catch (e) {
    return { error: e.name === "AbortError" ? "Wikipedia search timed out." : String(e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

// ── docs_search: keyless MDN Web Docs search API. Workers-safe (fetch + timeout) ──
const MDN_SEARCH_URL = "https://developer.mozilla.org/api/v1/search";
const DOCS_UA = "WriCoRe/1.0 (+https://github.com/james75x2-design/wricore-workspace)";

async function docsSearch(query) {
  const q = String(query || "").trim();
  if (!q) return { error: "Empty docs query." };
  const url = `${MDN_SEARCH_URL}?q=${encodeURIComponent(q)}&locale=en-US`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": DOCS_UA }, signal: controller.signal });
    if (!r.ok) return { error: `MDN search HTTP ${r.status}` };
    const j = await r.json();
    const docs = Array.isArray(j.documents) ? j.documents : [];
    if (docs.length === 0) return { query: q, source: "mdn", results: [], note: "No MDN documentation results for this query." };
    return {
      query: q,
      source: "mdn",
      results: docs.slice(0, 5).map(d => ({
        title: d.title,
        summary: stripTags(d.summary),
        url: d.mdn_url ? `https://developer.mozilla.org${d.mdn_url}` : null
      }))
    };
  } catch (e) {
    return { error: e.name === "AbortError" ? "MDN docs search timed out." : String(e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function executeTool(name, args, _ctx = {}) {
  if (name === "calculator") return safeCalculate(args && args.expression);
  if (name === "current_time") { const now = new Date(); return { iso_utc: now.toISOString(), unix_ms: now.getTime() }; }
  if (name === "web_search") return webSearch(args && args.query);
  if (name === "github_search") return executeGithubSearch(args && args.query, _ctx && _ctx.env);
  if (name === "docs_search") return docsSearch(args && args.query);
  throw new Error(`Unknown tool: ${name}`);
}

// ============================================================
// GitHub second tool + intent-based round-1 gating
// ============================================================


// ---- (1) Executor: real GitHub REST call (auth-optional, rate-limit aware) ----
export async function executeGithubSearch(query, env) {
  const token = env && env.GITHUB_TOKEN ? env.GITHUB_TOKEN : null;
  const url =
    "https://api.github.com/search/repositories?q=" +
    encodeURIComponent(query) +
    "&sort=stars&order=desc&per_page=5";

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "WriCoRe-Agent (https://github.com/james75x2-design/wricore-workspace)",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = "Bearer " + token;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      let body = "";
      try { body = (await res.text()).slice(0, 200); } catch (_) {}
      return {
        ok: false,
        error: `GitHub API ${res.status}${body ? ": " + body : ""}`,
        results: [],
      };
    }
    const data = await res.json();
    const results = (data.items || []).slice(0, 5).map((r) => ({
      name: r.full_name,
      description: r.description || "",
      stars: r.stargazers_count,
      language: r.language || "n/a",
      url: r.html_url,
    }));
    return { ok: true, results };
  } catch (e) {
    return {
      ok: false,
      error: e.name === "AbortError" ? "GitHub search timeout (8s)" : e.message,
      results: [],
    };
  } finally {
    clearTimeout(t);
  }
}

// ---- (2) Intent-based tool selection for the round-1 forcing gate ----
export function pickForcedTool(userText) {
  const t = (userText || "").toLowerCase();

  const mathOp = /[\d)]\s*[-+*/^]\s*[\d(]/.test(t);
  const mathWord = /\b(calculate|compute|evaluate|sum of|product of|multiply|divide|square root|percent)\b/.test(t);
  if (mathOp || mathWord) return "calculator";

  if (/\b(github|repo|repository|open[- ]?source|npm|package|library|sdk|framework|boilerplate)\b/.test(t)) {
    return "github_search";
  }

  if (/\b(docs|documentation|mdn|api reference|how (do|to) (i|you) use|syntax (of|for)|method reference)\b/.test(t)) {
    return "docs_search";
  }

  if (/\b(who|what|when|where|which|history|explain|define|meaning of|latest|current)\b/.test(t)) {
    return "web_search";
  }

  return null;
}

// ---- (2) Build the tool_choice for a given round ----
export function buildToolChoice(round, userText) {
  if (round !== 1) return "auto";
  const forced = pickForcedTool(userText);
  if (!forced) return "auto";
  return { type: "function", function: { name: forced } };
}
