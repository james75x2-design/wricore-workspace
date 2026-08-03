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

export async function executeTool(name, args, _ctx = {}) {
  if (name === "calculator") return safeCalculate(args && args.expression);
  if (name === "current_time") { const now = new Date(); return { iso_utc: now.toISOString(), unix_ms: now.getTime() }; }
  if (name === "web_search") return webSearch(args && args.query);
  throw new Error(`Unknown tool: ${name}`);
}
