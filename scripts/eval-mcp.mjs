import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  executeTool,
  pickForcedTool,
  buildToolChoice
} from "../src/mcp/tools.mjs";

const execFileAsync = promisify(execFile);

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

console.log("\n[MCP EVAL]\n");

await test("calculator execution", async () => {
  const result = await executeTool("calculator", {
    expression: "(12 + 8) * 3"
  });

  assert.equal(result.result, 60);
});

await test("calculator routing", () => {
  assert.equal(
    pickForcedTool("what is (12 + 8) * 3"),
    "calculator"
  );
});

await test("github routing", () => {
  assert.equal(
    pickForcedTool("best github repository for model context protocol"),
    "github_search"
  );
});

await test("web_search routing", () => {
  assert.equal(
    pickForcedTool("what is model context protocol"),
    "web_search"
  );
});

await test("round 2 uses auto", () => {
  assert.equal(
    buildToolChoice(
      2,
      "what is model context protocol"
    ),
    "auto"
  );
});

await test("remote MCP client", async () => {
  await execFileAsync("node", [
    "scripts/test-remote-mcp-client.mjs"
  ]);
});

console.log(
  `\nSummary: ${passed}/${passed + failed} passed`
);

if (failed > 0) {
  process.exit(1);
}