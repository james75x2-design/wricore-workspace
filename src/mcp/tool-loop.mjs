// WriCoRe MCP — Provider-agnostic tool-calling loop.
// Ported from VoyageFlow (proven in production). The model asks for a tool,
// the Worker executes it, the result is fed back, and the model returns a
// final answer. WriCoRe's Worker uses a single OpenAI-compatible interface for
// BOTH Gemini and Groq, so callModel/parse are OpenAI-shaped throughout.

export async function runToolLoop({
  messages,
  tools,
  callModel,     // async (workingMessages, tools, { round, maxRounds }) => parsed turn
  executeTool,   // async (name, args, ctx) => result
  ctx = {},
  maxRounds = 6,
  logEvent = () => {}
}) {
  const working = [...messages];
  const toolCalls = [];
  let rounds = 0;

  while (rounds < maxRounds) {
    rounds++;
    const turn = await callModel(working, tools, { round: rounds, maxRounds });

    if (turn.type === "final") {
      logEvent("info", "tool_loop_final", { rounds, tool_calls: toolCalls.length });
      return { finalText: turn.text, rounds, toolCalls };
    }

    if (turn.type === "tool_calls") {
      // Record the assistant's tool-call request in the transcript.
      working.push({ role: "assistant", tool_calls: turn.calls });

      for (const call of turn.calls) {
        let result;
        try {
          result = await executeTool(call.name, call.args, ctx);
        } catch (err) {
          result = { error: String(err && err.message ? err.message : err) };
        }
        toolCalls.push({ name: call.name, args: call.args, result });
        working.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify(result)
        });
        logEvent("info", "tool_executed", { name: call.name });
      }
      continue;
    }

    logEvent("warn", "tool_loop_unknown_turn", { rounds });
    return { finalText: "", rounds, toolCalls, error: "unknown_turn_type" };
  }

  logEvent("warn", "tool_loop_max_rounds", { rounds });
  return { finalText: "", rounds, toolCalls, error: "max_rounds_exceeded" };
}
