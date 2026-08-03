// WriCoRe MCP — OpenAI-compatible adapters.
// WriCoRe's Worker calls BOTH Gemini and Groq through OpenAI-compatible
// /chat/completions endpoints, so a SINGLE adapter set covers both providers
// (unlike VoyageFlow, which also needed native-Gemini adapters). Pure helpers,
// no network calls, Worker-safe.

function safeParse(s) {
  if (s == null) return {};
  if (typeof s === "object") return s;
  try { return JSON.parse(s); } catch { return {}; }
}

// TOOL_DEFS -> OpenAI "tools" array shape.
export function toolsForOpenAI(toolDefs) {
  return toolDefs.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));
}

// Loop transcript -> OpenAI messages (handles assistant tool_calls + tool results).
export function messagesForOpenAI(messages, systemPrompt) {
  const out = [];
  if (systemPrompt) out.push({ role: "system", content: systemPrompt });

  for (const m of messages) {
    if (m.role === "tool") {
      out.push({ role: "tool", tool_call_id: m.tool_call_id, content: m.content });
    } else if (m.role === "assistant" && m.tool_calls) {
      out.push({
        role: "assistant",
        content: null,
        tool_calls: m.tool_calls.map(c => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.args) }
        }))
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

// OpenAI response -> normalized turn for runToolLoop.
export function parseOpenAIResponse(data) {
  const msg = data?.choices?.[0]?.message;
  if (!msg) return { type: "final", text: "" };

  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    return {
      type: "tool_calls",
      calls: msg.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function?.name,
        args: safeParse(tc.function?.arguments)
      }))
    };
  }

  return { type: "final", text: msg.content || "" };
}
