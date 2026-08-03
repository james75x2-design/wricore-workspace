// WriCoRe MCP — Tool registry (Phase 5a).
// Keyless demo tools that prove the tool-loop plumbing end-to-end BEFORE wiring
// a real external MCP server (Phase 5b: Search / GitHub / Docs). Deterministic,
// no auth, no network — so a failed tool can never be a credentials problem.

export const TOOL_DEFS = [
  {
    name: "calculator",
    description:
      "Evaluate a basic arithmetic expression (+, -, *, /, parentheses). " +
      "Use for any exact numeric calculation instead of doing mental math.",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "e.g. '(3 + 4) * 5'" }
      },
      required: ["expression"]
    }
  },
  {
    name: "current_time",
    description:
      "Get the current UTC date and time. Use when the user asks what time or " +
      "date it is, or needs a timestamp.",
    parameters: { type: "object", properties: {}, required: [] }
  }
];

// Workers-safe arithmetic: recursive-descent parser. NO eval / NO Function()
// (Cloudflare Workers block dynamic code evaluation — "Code generation from
// strings disallowed"). Grammar:
//   expr   = term (('+'|'-') term)*
//   term   = factor (('*'|'/') factor)*
//   factor = number | '(' expr ')' | ('+'|'-') factor
function safeCalculate(expr) {
  const s = String(expr || "").trim();
  if (!/^[0-9+\-*/().\s]+$/.test(s)) {
    return { error: "Only numbers and + - * / ( ) are allowed." };
  }
  if (s.length > 100) return { error: "Expression too long." };

  let i = 0;
  const skip = () => { while (i < s.length && s[i] === " ") i++; };

  function parseExpr() {
    let v = parseTerm(); skip();
    while (i < s.length && (s[i] === "+" || s[i] === "-")) {
      const op = s[i++]; const r = parseTerm();
      v = op === "+" ? v + r : v - r; skip();
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor(); skip();
    while (i < s.length && (s[i] === "*" || s[i] === "/")) {
      const op = s[i++]; const r = parseFactor();
      v = op === "*" ? v * r : v / r; skip();
    }
    return v;
  }
  function parseFactor() {
    skip();
    if (s[i] === "+") { i++; return parseFactor(); }
    if (s[i] === "-") { i++; return -parseFactor(); }
    if (s[i] === "(") {
      i++; const v = parseExpr(); skip();
      if (s[i] !== ")") throw new Error("missing )");
      i++; return v;
    }
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
    if (!Number.isFinite(value)) {
      return { error: "Expression did not evaluate to a finite number." };
    }
    return { expression: s, result: value };
  } catch {
    return { error: "Invalid arithmetic expression." };
  }
}

export async function executeTool(name, args, _ctx = {}) {
  if (name === "calculator") {
    return safeCalculate(args && args.expression);
  }
  if (name === "current_time") {
    const now = new Date();
    return { iso_utc: now.toISOString(), unix_ms: now.getTime() };
  }
  throw new Error(`Unknown tool: ${name}`);
}
