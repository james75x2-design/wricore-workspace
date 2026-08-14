import assert from "node:assert/strict";
import {
  callRemoteMcpServer,
  listRemoteTools,
  callRemoteTool
} from "../src/mcp/remote-client.mjs";

let calls = [];

const mockJsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  async json() {
    return body;
  }
});

globalThis.fetch = async (url, init) => {
  calls.push({
    url,
    init,
    body: JSON.parse(init.body)
  });

  if (url.endsWith("/list")) {
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: calls.at(-1).body.id,
      result: {
        tools: [
          {
            name: "demo",
            description: "Demo remote tool"
          }
        ]
      }
    });
  }

  if (url.endsWith("/call")) {
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: calls.at(-1).body.id,
      result: {
        content: [
          {
            type: "text",
            text: "ok"
          }
        ]
      }
    });
  }

  if (url.endsWith("/rpc-error")) {
    return mockJsonResponse({
      jsonrpc: "2.0",
      id: calls.at(-1).body.id,
      error: {
        code: -32601,
        message: "Method not found"
      }
    });
  }

  if (url.endsWith("/http-error")) {
    return mockJsonResponse({}, false, 500);
  }

  return mockJsonResponse({
    jsonrpc: "2.0",
    id: calls.at(-1).body.id,
    result: {
      ok: true
    }
  });
};

const listed = await listRemoteTools("https://example.test/list");

assert.deepEqual(listed, {
  tools: [
    {
      name: "demo",
      description: "Demo remote tool"
    }
  ]
});

assert.equal(calls.at(-1).body.method, "tools/list");
assert.deepEqual(calls.at(-1).body.params, {});
assert.equal(calls.at(-1).init.method, "POST");
assert.equal(calls.at(-1).init.headers["Content-Type"], "application/json");
assert.equal(calls.at(-1).body.jsonrpc, "2.0");
assert.ok(calls.at(-1).body.id);

const called = await callRemoteTool(
  "https://example.test/call",
  "demo",
  { query: "hello" }
);

assert.deepEqual(called, {
  content: [
    {
      type: "text",
      text: "ok"
    }
  ]
});

assert.equal(calls.at(-1).body.method, "tools/call");
assert.deepEqual(calls.at(-1).body.params, {
  name: "demo",
  arguments: {
    query: "hello"
  }
});

await assert.rejects(
  () =>
    callRemoteMcpServer({
      serverUrl: "https://example.test/rpc-error",
      method: "tools/list"
    }),
  /Method not found/
);

await assert.rejects(
  () =>
    callRemoteMcpServer({
      serverUrl: "https://example.test/http-error",
      method: "tools/list"
    }),
  /Remote MCP HTTP 500/
);

console.log("remote MCP client tests passed");