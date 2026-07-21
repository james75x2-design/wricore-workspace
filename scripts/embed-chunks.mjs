// scripts/embed-chunks.mjs
// Generates embeddings for each chunk and writes them to chunks-embedded.jsonl
// so the local hybrid retriever can do vector similarity without per-chunk API calls.
//
// Uses Cloudflare Workers AI REST API for embeddings.
// Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.

import fs from "fs/promises";

const CHUNKS_IN = "data/index/chunks.jsonl";
const CHUNKS_OUT = "data/index/chunks-embedded.jsonl";
const EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN_WRICORE || process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("Missing env vars. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
  process.exit(1);
}

async function embed(text) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${EMBEDDING_MODEL}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: [text] })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding failed (${response.status}): ${err}`);
  }
  const data = await response.json();
  return data.result.data[0];
}

async function main() {
  console.log("Loading chunks...");
  const raw = await fs.readFile(CHUNKS_IN, "utf8");
  const chunks = raw.split("\n").filter(Boolean).map(JSON.parse);
  console.log(`Loaded ${chunks.length} chunks.`);

  console.log("Generating embeddings...");
  const lines = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const embedText = `${c.section || ""}\n\n${c.text || ""}`.trim();
    process.stdout.write(`  [${i + 1}/${chunks.length}] ${c.chunk_id}... `);
    const vector = await embed(embedText);
    lines.push(JSON.stringify({ ...c, embedding: vector }));
    console.log(`(${vector.length} dims)`);
  }

  await fs.writeFile(CHUNKS_OUT, lines.join("\n") + "\n");
  const stat = await fs.stat(CHUNKS_OUT);
  console.log(`\nWrote ${CHUNKS_OUT} with ${chunks.length} chunks including embeddings.`);
  console.log(`File size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error("Failed:", err.message);
  process.exit(1);
});
