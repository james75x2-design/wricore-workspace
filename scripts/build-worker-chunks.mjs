// scripts/build-worker-chunks.mjs
// Rebuilds data/index/worker-chunks.js from data/index/chunks-embedded.jsonl
// so the Cloudflare Worker can retrieve without filesystem access.
//
// Usage: node scripts/build-worker-chunks.mjs
import fs from "fs/promises";

const CHUNKS_IN = "data/index/chunks-embedded.jsonl";
const CHUNKS_OUT = "data/index/worker-chunks.js";
const EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";

const raw = await fs.readFile(CHUNKS_IN, "utf8");
const chunks = raw.split("\n").filter(Boolean).map(JSON.parse).map(c => ({
  chunk_id: c.chunk_id,
  section: c.section,
  source_path: c.source_path,
  text: c.text,
  embedding: c.embedding
}));

const body =
  "// Auto-generated from chunks-embedded.jsonl.\n" +
  `// Model: ${EMBEDDING_MODEL} (${chunks[0].embedding.length} dims)\n` +
  "// Regenerate with: node scripts/build-worker-chunks.mjs\n" +
  `export const EMBEDDING_MODEL = ${JSON.stringify(EMBEDDING_MODEL)};\n` +
  `export const EMBEDDING_DIMS = ${chunks[0].embedding.length};\n` +
  `export const WRICORE_CHUNKS = ${JSON.stringify(chunks, null, 2)};\n`;

await fs.writeFile(CHUNKS_OUT, body);
const stat = await fs.stat(CHUNKS_OUT);
console.log(`Wrote ${CHUNKS_OUT} with ${chunks.length} chunks (${(stat.size / 1024).toFixed(1)} KB)`);
