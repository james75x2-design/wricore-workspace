// Remote MCP client foundation.
// Future work: connect WriCoRe MCP mode to external MCP servers
// over JSON-RPC / Streamable HTTP.

const DEFAULT_TIMEOUT_MS = 8000;

export async function callRemoteMcpServer({
  serverUrl,
  method,
  params = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: (crypto.randomUUID?.() || String(Date.now())),
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`Remote MCP HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (payload.error) {
      throw new Error(
        payload.error.message || "Remote MCP returned an error"
      );
    }

    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function listRemoteTools(serverUrl, options = {}) {
  return callRemoteMcpServer({
    serverUrl,
    method: "tools/list",
    ...options
  });
}

export async function callRemoteTool(
  serverUrl,
  name,
  argumentsObject = {},
  options = {}
) {
  return callRemoteMcpServer({
    serverUrl,
    method: "tools/call",
    params: {
      name,
      arguments: argumentsObject
    },
    ...options
  });
}