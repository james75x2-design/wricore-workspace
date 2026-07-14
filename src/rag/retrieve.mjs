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

// CLI usage:
// node src/rag/retrieve.mjs "what is context harness"
if (import.meta.url === `file://${process.argv[1]}`) {
  const query = process.argv.slice(2).join(" ");

  if (!query) {
    console.log(
      JSON.stringify(
        {
          error: "Please provide a query.",
          example: 'node src/rag/retrieve.mjs "what is context harness"'
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const results = await retrieve(query, DEFAULT_TOP_K);

  const display = results.map(({ text, ...rest }) => rest);

  console.log(JSON.stringify(display, null, 2));
}