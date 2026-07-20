// src/rag/retrieve.mjs
//
// WriCoRe Retrieval v0.2
//
// What changed from v0:
// - Better lexical scoring
// - Stopword removal
// - Section/title boost
// - Exact phrase boost
// - Minimum score threshold
// - Simple duplicate removal
// - Always returns only topK results
//
// Expected output shape:
// {
//   chunk_id,
//   section,
//   source_path,
//   score,
//   preview,
//   text
// }

import fs from "fs/promises";

const CHUNKS_PATH = "data/index/chunks.jsonl";

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 2;

const STOPWORDS = new Set([
  "what",
  "is",
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "by",
  "from",
  "how",
  "does",
  "do",
  "can",
  "you",
  "your",
  "my",
  "me",
  "tell",
  "about",
  "please",
  "explain",
  "using",
  "use",
  "only"
]);

function cleanText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForMatch(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeForMatch(text)
    .split(/\s+/)
    .filter(token => token.length > 2)
    .filter(token => !STOPWORDS.has(token));
}

async function loadChunks() {
  const raw = await fs.readFile(CHUNKS_PATH, "utf8");

  return raw
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function scoreChunk(query, chunk) {
  const queryTokens = tokenize(query);
  const queryNormalized = normalizeForMatch(query);

  const text = cleanText(chunk.text);
  const textNormalized = normalizeForMatch(text);

  const section = cleanText(chunk.section);
  const sectionNormalized = normalizeForMatch(section);

  if (queryTokens.length === 0) return 0;

  let score = 0;

  // Token matches in full text.
  for (const token of queryTokens) {
    if (textNormalized.includes(token)) score += 2;
    if (sectionNormalized.includes(token)) score += 3;
  }

  // Exact query phrase boost, useful for "context harness".
  if (queryNormalized.length > 0 && textNormalized.includes(queryNormalized)) {
    score += 8;
  }

  if (queryNormalized.length > 0 && sectionNormalized.includes(queryNormalized)) {
    score += 10;
  }

  // Consecutive token phrase boost.
  const importantPhrase = queryTokens.join(" ");
  if (importantPhrase.length > 0 && textNormalized.includes(importantPhrase)) {
    score += 5;
  }

  if (importantPhrase.length > 0 && sectionNormalized.includes(importantPhrase)) {
    score += 7;
  }

  // Prefer compact chunks slightly.
  // This is small so it does not overpower actual relevance.
  if (text.length > 0 && text.length < 1200) {
    score += 1;
  }

  return score;
}

function dedupeResults(results) {
  const seen = new Set();
  const deduped = [];

  for (const result of results) {
    const key = [
      result.source_path,
      result.section,
      normalizeForMatch(result.text).slice(0, 200)
    ].join("::");

    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

export async function retrieve(query, topK = DEFAULT_TOP_K, options = {}) {
  const minScore =
    typeof options.minScore === "number"
      ? options.minScore
      : DEFAULT_MIN_SCORE;

  const chunks = await loadChunks();

  const scored = chunks
    .map(chunk => {
      const text = cleanText(chunk.text);
      const score = scoreChunk(query, chunk);

      return {
        chunk_id: chunk.chunk_id,
        section: chunk.section,
        source_path: chunk.source_path,
        source: chunk.source_path,
        score,
        preview: text
          .replace(/[#*`]/g, "")
          .replace(/\s+/g, " ")
          .slice(0, 220),
        text
      };
    })
    .filter(result => result.text.length > 0)
    .filter(result => result.score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.text.length - b.text.length;
    });

  return dedupeResults(scored).slice(0, topK);
}

// ─── Hybrid Retrieval (v0.3 — keyword + vector fusion) ──────────────────────
// Added Phase 1: computes cosine similarity between query embedding and
// pre-computed chunk embeddings, then fuses with keyword score.

const EMBEDDED_CHUNKS_PATH = "data/index/chunks-embedded.jsonl";
const EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";
const RAG_KEYWORD_WEIGHT = 0.5;
const RAG_VECTOR_WEIGHT = 0.5;
const VECTOR_THRESHOLD = 0.3;

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN_WRICORE ||
  process.env.CLOUDFLARE_API_TOKEN;

async function loadEmbeddedChunks() {
  const raw = await fs.readFile(EMBEDDED_CHUNKS_PATH, "utf8");
  return raw.split("\n").filter(Boolean).map(line => JSON.parse(line));
}

async function embedQuery(query) {
  if (!ACCOUNT_ID || !API_TOKEN) return null;
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${EMBEDDING_MODEL}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: [query] })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.result?.data?.[0] || null;
  } catch (err) {
    return null;
  }
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function normalizeScores(items, scoreKey) {
  const scores = items.map(x => x[scoreKey]);
  const max = Math.max(...scores, 0);
  if (max === 0) {
    return items.map(x => ({ ...x, [`${scoreKey}_norm`]: 0 }));
  }
  return items.map(x => ({ ...x, [`${scoreKey}_norm`]: x[scoreKey] / max }));
}

export async function retrieveHybrid(query, topK = DEFAULT_TOP_K, options = {}) {
  const minScore =
    typeof options.minScore === "number" ? options.minScore : 0;

  const chunks = await loadEmbeddedChunks();

  // Signal 1 — keyword scoring (reuses existing scoreChunk logic)
  const scored = chunks.map(chunk => {
    const text = cleanText(chunk.text);
    return {
      chunk_id: chunk.chunk_id,
      section: chunk.section,
      source_path: chunk.source_path,
      source: chunk.source_path,
      text,
      embedding: chunk.embedding,
      keyword_score: scoreChunk(query, chunk),
      vector_score: 0,
      preview: text
        .replace(/[#*`]/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 220)
    };
  });

  // Signal 2 — vector similarity
  const queryEmbedding = await embedQuery(query);
  if (queryEmbedding) {
    for (const c of scored) {
      c.vector_score = cosineSimilarity(queryEmbedding, c.embedding);
    }
  }

  // Filter: keep chunks with keyword hits OR meaningful vector similarity
  let candidates = scored.filter(c =>
    c.keyword_score > 0 || c.vector_score >= VECTOR_THRESHOLD
  );
  if (candidates.length === 0) return [];

  // Normalize per signal, then fuse with weighted sum
  candidates = normalizeScores(candidates, "keyword_score");
  candidates = normalizeScores(candidates, "vector_score");

  const fused = candidates.map(c => ({
    ...c,
    score: Number(
      (RAG_KEYWORD_WEIGHT * c.keyword_score_norm +
       RAG_VECTOR_WEIGHT * c.vector_score_norm).toFixed(4)
    ),
    retrieval_signal: queryEmbedding ? "hybrid" : "keyword_only"
  }));

  return dedupeResults(
    fused
      .filter(c => c.score >= minScore)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.text.length - b.text.length;
      })
  ).slice(0, topK);
}

// CLI usage:
// node src/rag/retrieve.mjs "what is context harness"
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const useHybrid = args.includes("--hybrid");
  const query = args.filter(a => a !== "--hybrid").join(" ");

  if (!query) {
    console.log(
      JSON.stringify(
        {
          error: "Please provide a query.",
          example: 'node src/rag/retrieve.mjs "what is context harness" [--hybrid]'
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const results = useHybrid
    ? await retrieveHybrid(query, DEFAULT_TOP_K)
    : await retrieve(query, DEFAULT_TOP_K);

  const display = results.map(({ text, embedding, ...rest }) => rest);

  console.log(JSON.stringify({ mode: useHybrid ? "hybrid" : "keyword", results: display }, null, 2));
}