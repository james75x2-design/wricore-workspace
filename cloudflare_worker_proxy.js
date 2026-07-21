import { WRICORE_CHUNKS, EMBEDDING_MODEL, EMBEDDING_DIMS } from "./data/index/worker-chunks.js";

/**
 * WriCoRe Cloudflare Worker Proxy — Dual-Engine Router (v3.1.0)
 * Format:    ES Module
 * Primary:   Google Gemini (gemini-2.0-flash, via OpenAI-compatible endpoint)
 * Fallback:  Groq (llama-3.3-70b-versatile)
 *
 * v3.3 Improvements over v3.2:
 *   - Cross-encoder reranker (@cf/baai/bge-reranker-base)
 *   - Hybrid retrieval returns top-20 candidates, reranker refines to top-5
 *   - Graceful fallback to hybrid fusion ranking if reranker fails
 *   - Structured logs tag ranking_signal: "reranker" | "hybrid_fusion"
 *
 * v3.2 Improvements over v3.1:
 *   - RAG mode (mode: "rag") with embedded 31 WriCoRe knowledge chunks
 *   - Hybrid retrieval: keyword scoring + vector similarity with score fusion
 *   - Citation enforcement: hallucinated chunk IDs filtered before response
 *   - Cloudflare Workers AI embeddings (@cf/baai/bge-small-en-v1.5, 384 dims)
 *   - Graceful fallback to keyword-only if AI binding call fails
 *   - Preserves existing chat/proxy flow with zero regression
 *
 * v3.1 Improvements:
 *   - CORS allowlist (locked from wildcard)
 *   - GET /health endpoint
 *   - Structured JSON logging with severity levels
 *   - 25s timeout protection via AbortController
 *   - Payload validation (message count + text length)
 *   - Version + latency metadata in every response
 *   - Rate-limit surfacing (429 bubbles cleanly)
 *   - Cleaner model queue definition
 */

// ─── Worker Metadata ──────────────────────────────────────────────────────────
const WORKER_VERSION = "3.3.0";
const WORKER_SERVICE = "wricore-worker";

// ─── Model Queue ──────────────────────────────────────────────────────────────
const MODEL_QUEUE_TEMPLATE = [
  {
    provider: "gemini",
    modelId: "gemini-2.0-flash",
    displayName: "GEMINI-2.0-FLASH",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    envKey: "GEMINI_API_KEY"
  },
  {
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    displayName: "LLAMA-3.3-70B-VERSATILE",
    url: "https://api.groq.com/openai/v1/chat/completions",
    envKey: "GROQ_API_KEY"
  }
];

// ─── Upstream Timeout (ms) ────────────────────────────────────────────────────
const UPSTREAM_TIMEOUT_MS = 25000;

// ─── Payload Limits ───────────────────────────────────────────────────────────
const MAX_MESSAGES = 30;
const MAX_TEXT_LENGTH = 8000;

// ─── CORS Allowlist ───────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://james75x2-design.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000"
];

// ─── CORS Helper ──────────────────────────────────────────────────────────────
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

// ─── Structured Logging ───────────────────────────────────────────────────────
function logEvent(level, event, data = {}) {
  const payload = JSON.stringify({
    level,
    event,
    service: WORKER_SERVICE,
    version: WORKER_VERSION,
    timestamp: new Date().toISOString(),
    ...data
  });

  if (level === "error") {
    console.error(payload);
  } else if (level === "warn") {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

// ─── Message Validation ───────────────────────────────────────────────────────
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Missing or empty messages array");
  }

  if (messages.length > MAX_MESSAGES) {
    throw new Error(`Too many messages (max ${MAX_MESSAGES})`);
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg || typeof msg !== "object") {
      throw new Error(`Message at index ${i} is not an object`);
    }

    if (!msg.role || typeof msg.role !== "string") {
      throw new Error(`Message at index ${i} is missing a valid role`);
    }

    if (typeof msg.content !== "string") {
      throw new Error(`Message at index ${i} is missing content string`);
    }

    if (msg.content.length > MAX_TEXT_LENGTH) {
      throw new Error(`Message at index ${i} exceeds ${MAX_TEXT_LENGTH} chars`);
    }
  }
}

// ─── Fetch With Timeout ───────────────────────────────────────────────────────
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── JSON Response Helper ─────────────────────────────────────────────────────
function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// ─── Path Normalizer ──────────────────────────────────────────────────────────
function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

// ─── RAG: Hybrid Retrieval Helpers (v3.2.0) ───────────────────────────────────

const RAG_TOP_K = 5;
const RAG_CANDIDATE_POOL = 20;
const RERANKER_MODEL = "@cf/baai/bge-reranker-base";
const RAG_KEYWORD_WEIGHT = 0.5;
const RAG_VECTOR_WEIGHT = 0.5;
const VECTOR_THRESHOLD = 0.3;
const RAG_FALLBACK_ANSWER = "I don't have enough evidence in the current WriCoRe knowledge base to answer that.";

const RAG_STOPWORDS = new Set([
  "what", "is", "the", "a", "an", "and", "or", "to", "of", "in", "on",
  "for", "with", "by", "from", "how", "does", "do", "can", "you", "your",
  "my", "me", "tell", "about", "please", "explain", "using", "use", "only"
]);

function ragTokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 2)
    .filter(t => !RAG_STOPWORDS.has(t));
}

function ragScoreChunk(queryTokens, queryNormalized, chunk) {
  const text = String(chunk.text || "").toLowerCase();
  const section = String(chunk.section || "").toLowerCase();
  if (queryTokens.length === 0) return 0;
  let score = 0;
  for (const token of queryTokens) {
    if (text.includes(token)) score += 2;
    if (section.includes(token)) score += 3;
  }
  if (queryNormalized.length > 0 && text.includes(queryNormalized)) score += 8;
  if (queryNormalized.length > 0 && section.includes(queryNormalized)) score += 10;
  const importantPhrase = queryTokens.join(" ");
  if (importantPhrase.length > 0 && text.includes(importantPhrase)) score += 5;
  if (importantPhrase.length > 0 && section.includes(importantPhrase)) score += 7;
  if (text.length > 0 && text.length < 1200) score += 1;
  return score;
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

async function embedQuery(env, query) {
  if (!env.AI) return null;
  try {
    const result = await env.AI.run(EMBEDDING_MODEL, { text: [query] });
    return result?.data?.[0] || null;
  } catch (err) {
    return null;
  }
}

function normalizeScores(items, scoreKey) {
  const scores = items.map(x => x[scoreKey]);
  const max = Math.max(...scores, 0);
  if (max === 0) return items.map(x => ({ ...x, [`${scoreKey}_norm`]: 0 }));
  return items.map(x => ({ ...x, [`${scoreKey}_norm`]: x[scoreKey] / max }));
}

async function ragRetrieveHybrid(env, query, topK, poolSize) {
  const effectiveK = poolSize || topK;
  const queryTokens = ragTokenize(query);
  const queryNormalized = String(query || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (queryTokens.length === 0) return [];

  const scored = WRICORE_CHUNKS.map(c => ({
    chunk_id: c.chunk_id,
    section: c.section,
    source_path: c.source_path,
    text: c.text,
    embedding: c.embedding,
    keyword_score: ragScoreChunk(queryTokens, queryNormalized, c),
    vector_score: 0
  }));

  const queryEmbedding = await embedQuery(env, query);
  if (queryEmbedding) {
    for (const c of scored) {
      c.vector_score = cosineSimilarity(queryEmbedding, c.embedding);
    }
  }

  let candidates = scored.filter(c => c.keyword_score > 0 || c.vector_score >= VECTOR_THRESHOLD);
  if (candidates.length === 0) return [];

  candidates = normalizeScores(candidates, "keyword_score");
  candidates = normalizeScores(candidates, "vector_score");

  return candidates
    .map(c => ({
      chunk_id: c.chunk_id,
      section: c.section,
      source_path: c.source_path,
      text: c.text,
      keyword_score: c.keyword_score,
      vector_score: Number(c.vector_score.toFixed(4)),
      score: Number((RAG_KEYWORD_WEIGHT * c.keyword_score_norm + RAG_VECTOR_WEIGHT * c.vector_score_norm).toFixed(4)),
      retrieval_signal: queryEmbedding ? "hybrid" : "keyword_only"
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, effectiveK);
}

async function rerankCandidates(env, query, candidates) {
  if (!env.AI || !candidates || candidates.length === 0) return null;
  try {
    const contexts = candidates.map(c => ({ text: String(c.text || "").slice(0, 1000) }));
    const result = await env.AI.run(RERANKER_MODEL, { query, contexts });
    const scores = result?.response;
    if (!Array.isArray(scores) || scores.length !== candidates.length) return null;

    return candidates
      .map((c, i) => ({
        ...c,
        rerank_score: Number((scores[i]?.score ?? 0).toFixed(4))
      }))
      .sort((a, b) => b.rerank_score - a.rerank_score);
  } catch (err) {
    return null;
  }
}

function ragBuildContext(chunks) {
  return chunks.map(c => [
    `<source id="${c.chunk_id}">`,
    `section: ${c.section || "Unknown section"}`,
    `source_path: ${c.source_path || "Unknown source"}`,
    `retrieval_score: ${c.score ?? "unknown"}`,
    "",
    String(c.text || "").trim(),
    `</source>`
  ].join("\n")).join("\n\n");
}

function ragBuildPrompt(query, chunks) {
  const allowedIds = chunks.map(c => c.chunk_id).join(", ");
  const context = ragBuildContext(chunks);
  return `
You are the WriCoRe knowledge assistant.

Answer the user query using ONLY the retrieved context below. Do not use outside knowledge.

Rules:
1. Use only facts found inside <source> blocks.
2. Cite every factual sentence using exact chunk IDs in square brackets, e.g. [${chunks[0]?.chunk_id || "chunk-id"}].
3. Allowed citation IDs: ${allowedIds}
4. If the context does not contain enough information to answer, respond with exactly:
   "${RAG_FALLBACK_ANSWER}"
5. Do not invent citations or sources.
6. Return valid JSON only. Do not include markdown fences like triple-backtick json.

Return this JSON shape exactly:
{
  "answer_markdown": "Natural language answer with inline [chunk_id] citations.",
  "citations": [
    { "claim": "Short claim being supported.", "chunk_ids": ["chunk_id"] }
  ],
  "unanswered": false
}

Retrieved context:
${context}

User query:
${query}
`.trim();
}

function ragParseJsonSafely(rawText) {
  if (!rawText) return null;
  const cleaned = String(rawText)
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function ragNormalizeAnswer(rawText, allowedChunkIds) {
  const parsed = ragParseJsonSafely(rawText);
  if (parsed && typeof parsed.answer_markdown === "string" && Array.isArray(parsed.citations) && typeof parsed.unanswered === "boolean") {
    return parsed;
  }
  const text = String(rawText || "").trim();
  const inlineIds = [...text.matchAll(/\[([a-z0-9._-]+::\d{3})\]/gi)]
    .map(m => m[1])
    .filter(id => allowedChunkIds.includes(id));
  return {
    answer_markdown: text || RAG_FALLBACK_ANSWER,
    citations: [...new Set(inlineIds)].map(id => ({
      claim: "Extracted from plain-text model output.",
      chunk_ids: [id]
    })),
    unanswered: text === RAG_FALLBACK_ANSWER || text.length === 0
  };
}

function ragExtractQuery(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === "user") {
      return msg.content || "";
    }
  }
  return "";
}

// ─── ES Module Export ─────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const startTime = Date.now();
    const corsHeaders = getCorsHeaders(request);
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (request.method === "GET" && path === "/health") {
      return jsonResponse({
        status: "ok",
        service: WORKER_SERVICE,
        version: WORKER_VERSION,
        timestamp: new Date().toISOString()
      }, 200, corsHeaders);
    }

    // Root GET
    if (request.method === "GET" && path === "") {
      return jsonResponse({
        service: WORKER_SERVICE,
        version: WORKER_VERSION,
        message: "This endpoint accepts POST requests with { messages: [...] } payload."
      }, 200, corsHeaders);
    }

    // Unknown GET path
    if (request.method === "GET") {
      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    }

    // Method guard
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed" }, 405, corsHeaders);
    }

    // Parse + validate body
    let requestData;
    let messages;
    try {
      requestData = await request.json();
      messages = requestData.messages;
      validateMessages(messages);
    } catch (err) {
      logEvent("warn", "validation_failed", { error: err.message });
      return jsonResponse({ error: `Bad request: ${err.message}` }, 400, corsHeaders);
    }

    const temperature = requestData.temperature ?? 0.7;
    const mode = requestData.mode === "rag" ? "rag" : "chat";

    // ── RAG mode: retrieve + build citation-enforcing prompt ───────────────
    let ragChunks = [];
    let ragAllowedIds = [];
    let ragChunksUsed = [];

    if (mode === "rag") {
      const query = ragExtractQuery(messages);
      if (!query) {
        logEvent("warn", "rag_missing_query", {});
        return jsonResponse({ error: "Missing user query for RAG mode." }, 400, corsHeaders);
      }

      // Phase 3: retrieve top-20 candidates via hybrid, then rerank to top-5.
      const candidatePool = await ragRetrieveHybrid(env, query, RAG_TOP_K, RAG_CANDIDATE_POOL);
      const reranked = await rerankCandidates(env, query, candidatePool);
      let rankingSignal = "hybrid_fusion";

      if (reranked && reranked.length > 0) {
        ragChunks = reranked.slice(0, RAG_TOP_K);
        rankingSignal = "reranker";
      } else {
        ragChunks = candidatePool.slice(0, RAG_TOP_K);
      }

      ragAllowedIds = ragChunks.map(c => c.chunk_id);
      ragChunksUsed = ragChunks.map(c => ({
        chunk_id: c.chunk_id,
        section: c.section,
        score: c.score,
        keyword_score: c.keyword_score,
        vector_score: c.vector_score,
        rerank_score: c.rerank_score ?? null
      }));

      logEvent("info", "rag_retrieved", {
        query_len: query.length,
        candidate_pool_size: candidatePool.length,
        chunks_count: ragChunks.length,
        chunk_ids: ragAllowedIds,
        retrieval_signal: ragChunks[0]?.retrieval_signal || "none",
        ranking_signal: rankingSignal
      });

      // No relevant chunks → return fallback answer WITHOUT calling LLM.
      if (ragChunks.length === 0) {
        return jsonResponse({
          answer_markdown: RAG_FALLBACK_ANSWER,
          citations: [],
          unanswered: true,
          meta: {
            mode: "rag",
            version: WORKER_VERSION,
            model: "none",
            chunks_used: [],
            latency_ms: Date.now() - startTime
          }
        }, 200, corsHeaders);
      }

      // Replace messages with the RAG prompt.
      const ragPrompt = ragBuildPrompt(query, ragChunks);
      messages = [{ role: "user", content: ragPrompt }];
    }

    // Filter to models actually available (based on env keys)
    const activeQueue = MODEL_QUEUE_TEMPLATE.filter(m => env[m.envKey]);

    if (activeQueue.length === 0) {
      logEvent("error", "no_providers_configured");
      return jsonResponse({
        error: "Configuration Error: Add GEMINI_API_KEY or GROQ_API_KEY as Cloudflare Worker secrets."
      }, 500, corsHeaders);
    }

    let successfulResponse = null;
    let usedModel = null;
    let rateLimited = false;
    const failureLogs = [];

    // ── Fallback Loop ────────────────────────────────────────────────────────
    for (const activeModel of activeQueue) {
      try {
        const apiPayload = {
          model: activeModel.modelId,
          messages: messages,
          temperature: temperature,
          stream: false
        };

        const response = await fetchWithTimeout(activeModel.url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env[activeModel.envKey]}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(apiPayload)
        }, UPSTREAM_TIMEOUT_MS);

        if (response.status === 429) {
          logEvent("warn", "rate_limited", { model: activeModel.displayName });
          failureLogs.push(`${activeModel.displayName}: 429 rate-limited`);
          rateLimited = true;
          continue;
        }

        if (!response.ok) {
          logEvent("warn", "provider_failed", {
            model: activeModel.displayName,
            status: response.status
          });
          failureLogs.push(`${activeModel.displayName}: ${response.status}`);
          continue;
        }

        successfulResponse = await response.json();
        successfulResponse.model = activeModel.displayName;
        usedModel = activeModel.displayName;
        rateLimited = false;
        break;

      } catch (err) {
        if (err.name === "AbortError") {
          logEvent("warn", "provider_timeout", { model: activeModel.displayName });
          failureLogs.push(`${activeModel.displayName}: timeout (>25s)`);
        } else {
          logEvent("warn", "provider_exception", {
            model: activeModel.displayName,
            error: err.message
          });
          failureLogs.push(`${activeModel.displayName}: ${err.message}`);
        }
        continue;
      }
    }

    const latencyMs = Date.now() - startTime;

    // ── Success ──────────────────────────────────────────────────────────────
    if (successfulResponse) {
      logEvent("info", "request_succeeded", {
        mode,
        model: usedModel,
        latency_ms: latencyMs
      });

      // RAG mode: normalize LLM output into citation-enforced JSON shape.
      if (mode === "rag") {
        const rawContent = successfulResponse.choices?.[0]?.message?.content || "";
        const normalized = ragNormalizeAnswer(rawContent, ragAllowedIds);

        // Enforce that every cited chunk_id is in the retrieved set.
        const cleanCitations = (normalized.citations || [])
          .map(c => ({
            claim: typeof c.claim === "string" ? c.claim : "",
            chunk_ids: Array.isArray(c.chunk_ids)
              ? c.chunk_ids.filter(id => ragAllowedIds.includes(id))
              : []
          }))
          .filter(c => c.chunk_ids.length > 0);

        return jsonResponse({
          answer_markdown: normalized.answer_markdown || RAG_FALLBACK_ANSWER,
          citations: cleanCitations,
          unanswered: Boolean(normalized.unanswered) || cleanCitations.length === 0,
          meta: {
            mode: "rag",
            model: usedModel,
            version: WORKER_VERSION,
            latency_ms: latencyMs,
            chunks_used: ragChunksUsed
          }
        }, 200, corsHeaders);
      }

      // Default (chat/proxy) mode: unchanged response shape.
      successfulResponse.meta = {
        version: WORKER_VERSION,
        latency_ms: latencyMs
      };

      return jsonResponse(successfulResponse, 200, corsHeaders);
    }

    // ── All providers failed ─────────────────────────────────────────────────
    logEvent("error", "all_providers_failed", {
      rate_limited: rateLimited,
      latency_ms: latencyMs,
      logs: failureLogs
    });

    return jsonResponse({
      error: rateLimited
        ? "Dual Engine Exhausted: All providers rate-limited. Please try again in a moment."
        : "Dual Engine Exhausted: All AI providers failed to respond.",
      logs: failureLogs.join(" | "),
      meta: { version: WORKER_VERSION, latency_ms: latencyMs }
    }, rateLimited ? 429 : 502, corsHeaders);
  }
};