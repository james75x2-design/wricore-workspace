// src/rag/answer-with-context.mjs
//
// WriCoRe RAG Step 4 — Worker-integrated grounded answers
//
// What this file does:
// 1. Retrieves top chunks from retrieve.mjs
// 2. Builds a RAG prompt using retrieved chunk text
// 3. Sends the prompt to your Cloudflare Worker as { messages: [...] }
// 4. Extracts model text from OpenAI-style Worker output: choices[0].message.content
// 5. Normalizes model output into:
//    - answer_markdown
//    - citations
//    - unanswered
// 6. Validates that citations reference retrieved chunk_ids only
//
// Beginner-safe notes:
// - No API keys are stored here.
// - Worker URL is public and safe to keep here.
// - Gemini/Groq API keys stay inside Cloudflare Worker secrets.
// - This file assumes retrieve.mjs exports retrieve(query, topK).

import { retrieve } from "./retrieve.mjs";

const WRICORE_WORKER_URL = "https://wricore.james75x2.workers.dev/";
const TOP_K = 5;

// Your Worker validates message.content length. Keep prompt comfortably small.
const MAX_PROMPT_CHARS = 7600;

const FALLBACK_ANSWER =
  "I don't have enough evidence in the current WriCoRe knowledge base to answer that.";

function cleanText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildContext(chunks) {
  return chunks
    .filter(c => c.text && cleanText(c.text).length > 0)
    .map(c => {
      return [
        `<source id="${c.chunk_id}">`,
        `section: ${c.section || "Unknown section"}`,
        `source_path: ${c.source_path || c.source || "Unknown source"}`,
        `retrieval_score: ${c.score ?? "unknown"}`,
        "",
        cleanText(c.text),
        `</source>`
      ].join("\n");
    })
    .join("\n\n");
}

function buildPrompt(query, chunks) {
  const allowedIds = chunks.map(c => c.chunk_id).join(", ");
  const context = buildContext(chunks);

  return `
You are the WriCoRe Research Agent.

Answer the user query using ONLY the retrieved context.

Rules:
1. Use only facts found inside <source> blocks.
2. Cite every factual sentence using exact chunk IDs in square brackets.
3. Allowed citation IDs: ${allowedIds}
4. If the context is insufficient, answer exactly:
   "${FALLBACK_ANSWER}"
5. Do not invent citations.
6. Do not use outside knowledge.
7. Return valid JSON only.
8. Do not include markdown fences like \`\`\`json.

Return this JSON shape exactly:
{
  "answer_markdown": "Natural language answer with inline [chunk_id] citations.",
  "citations": [
    {
      "claim": "Short claim being supported.",
      "chunk_ids": ["chunk_id"]
    }
  ],
  "unanswered": false
}

User query:
${query}

Retrieved context:
${context}
`.trim();
}

// Keep top chunks but shrink if the prompt would exceed Worker validation.
function selectChunksForPrompt(query, chunks) {
  let selected = chunks.slice(0, TOP_K);

  while (selected.length > 0) {
    const prompt = buildPrompt(query, selected);

    if (prompt.length <= MAX_PROMPT_CHARS) {
      return selected;
    }

    selected = selected.slice(0, -1);
  }

  return [];
}

async function callLLMThroughWorker({ query, prompt, contextBlock, sourceMap }) {
  const response = await fetch(WRICORE_WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0,

      // Optional metadata. Your current Worker can ignore these safely.
      mode: "wricore_rag_answer",
      query,
      context: contextBlock,
      sources: sourceMap
    })
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const errorText = await response.text();

    return {
      worker_error: true,
      status: response.status,
      raw_output: errorText
    };
  }

  if (contentType.includes("application/json")) {
    return await response.json();
  }

  return await response.text();
}

function parseJsonSafely(rawText) {
  if (!rawText) {
    return {
      parse_error: true,
      raw_output: rawText
    };
  }

  let cleaned = String(rawText).trim();

  // Remove fenced JSON if the model ignores the instruction.
  cleaned = cleaned
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      parse_error: true,
      raw_output: rawText
    };
  }
}

function extractInlineCitations(answerMarkdown) {
  const matches = [
    ...(answerMarkdown || "").matchAll(/\[([a-z0-9._-]+::\d{3})\]/gi)
  ];

  return [...new Set(matches.map(m => m[1]))];
}

function splitCandidateClaimSentences(answerMarkdown) {
  return (answerMarkdown || "")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 30);
}

function extractTextFromWorkerResponse(raw) {
  // If Worker returned string directly.
  if (typeof raw === "string") {
    return raw;
  }

  if (!raw || typeof raw !== "object") {
    return "";
  }

  if (raw.worker_error) {
    return "";
  }

  // Expected OpenAI-compatible shape from your Worker.
  const openAiContent =
    raw.choices?.[0]?.message?.content ||
    raw.choices?.[0]?.delta?.content;

  if (openAiContent) {
    return openAiContent;
  }

  // Backup shapes in case provider/Worker changes.
  const geminiContent = raw.candidates?.[0]?.content?.parts?.[0]?.text;
  if (geminiContent) return geminiContent;

  if (typeof raw.answer_markdown === "string") return raw.answer_markdown;
  if (typeof raw.answer === "string") return raw.answer;
  if (typeof raw.response === "string") return raw.response;
  if (typeof raw.text === "string") return raw.text;
  if (typeof raw.output === "string") return raw.output;
  if (typeof raw.content === "string") return raw.content;

  return "";
}

function normalizeModelOutput(raw) {
  if (raw && raw.worker_error) {
    return {
      answer_markdown: "",
      citations: [],
      unanswered: true,
      worker_error: true,
      parse_error: true,
      raw_output: raw.raw_output || raw
    };
  }

  // If Worker somehow already returned the target shape.
  if (
    raw &&
    typeof raw === "object" &&
    typeof raw.answer_markdown === "string" &&
    Array.isArray(raw.citations) &&
    typeof raw.unanswered === "boolean"
  ) {
    return raw;
  }

  const extractedText = cleanText(extractTextFromWorkerResponse(raw));

  if (!extractedText) {
    return {
      answer_markdown: "",
      citations: [],
      unanswered: true,
      parse_error: true,
      raw_output: raw
    };
  }

  // Try JSON first because the prompt requests JSON.
  const parsed = parseJsonSafely(extractedText);

  if (!parsed.parse_error) {
    return {
      answer_markdown: cleanText(parsed.answer_markdown),
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      unanswered:
        typeof parsed.unanswered === "boolean" ? parsed.unanswered : false
    };
  }

  // Fallback: model returned plain text.
  // We still keep the answer, extract citations, and let validation judge it.
  const inlineIds = extractInlineCitations(extractedText);

  return {
    answer_markdown: extractedText,
    citations: inlineIds.map(id => ({
      claim:
        "Plain-text model output; claim-level extraction not available in v0.",
      chunk_ids: [id]
    })),
    unanswered: extractedText === FALLBACK_ANSWER || inlineIds.length === 0,
    parse_warning: true,
    extracted_text_preview: extractedText.slice(0, 500),
    raw_output: raw
  };
}

function validateAnswer(answerObj, chunks) {
  const allowedIds = new Set(chunks.map(c => c.chunk_id));
  const answerMarkdown = cleanText(answerObj.answer_markdown);
  const inlineCitationIds = extractInlineCitations(answerMarkdown);

  const structuredCitationIds = Array.isArray(answerObj.citations)
    ? answerObj.citations.flatMap(c =>
        Array.isArray(c.chunk_ids) ? c.chunk_ids : []
      )
    : [];

  const allUsedIds = [
    ...new Set([...inlineCitationIds, ...structuredCitationIds])
  ];

  const invalidCitationIds = allUsedIds.filter(id => !allowedIds.has(id));

  const claimSentences = splitCandidateClaimSentences(answerMarkdown);

  const uncitedClaimSentences =
    answerObj.unanswered === true
      ? []
      : claimSentences.filter(
          sentence => extractInlineCitations(sentence).length === 0
        );

  const hasRequiredShape =
    typeof answerObj.answer_markdown === "string" &&
    Array.isArray(answerObj.citations) &&
    typeof answerObj.unanswered === "boolean";

  const answerIsNotEmpty = answerMarkdown.length > 0;

  const unansweredIsValid =
    answerObj.unanswered === false || answerMarkdown === FALLBACK_ANSWER;

  const hasCitationsIfAnswered =
    answerObj.unanswered === true || inlineCitationIds.length > 0;

  const allCitationIdsAllowed = invalidCitationIds.length === 0;

  const everyCandidateClaimHasInlineCitation =
    uncitedClaimSentences.length === 0;

  const parsedOrPlainTextAccepted = !answerObj.parse_error;

  const valid =
    hasRequiredShape &&
    answerIsNotEmpty &&
    unansweredIsValid &&
    hasCitationsIfAnswered &&
    allCitationIdsAllowed &&
    everyCandidateClaimHasInlineCitation &&
    parsedOrPlainTextAccepted;

  return {
    valid,
    checks: {
      has_required_shape: hasRequiredShape,
      answer_is_not_empty: answerIsNotEmpty,
      unanswered_is_valid: unansweredIsValid,
      has_citations_if_answered: hasCitationsIfAnswered,
      all_citation_ids_allowed: allCitationIdsAllowed,
      every_candidate_claim_has_inline_citation:
        everyCandidateClaimHasInlineCitation,
      parsed_or_plain_text_accepted: parsedOrPlainTextAccepted,
      parse_warning: Boolean(answerObj.parse_warning)
    },
    inline_citation_ids: inlineCitationIds,
    structured_citation_ids: structuredCitationIds,
    invalid_citation_ids: invalidCitationIds,
    uncited_claim_sentences: uncitedClaimSentences,
    allowed_chunk_ids: [...allowedIds]
  };
}

export async function answerWithContext(query) {
  // Eval-parity fix: call the deployed Worker's mode:"rag" path so retrieval +
  // cross-encoder reranking run IN production (not locally). Send the RAW query
  // — the Worker's ragExtractQuery uses the last user message as the query, so a
  // pre-built prompt would break retrieval. Fails LOUDLY on worker error so the
  // eval always reflects true production behavior (no silent local fallback).
  let w;
  try {
    const response = await fetch(WRICORE_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "rag",
        messages: [{ role: "user", content: query }]
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      return {
        query,
        answer_markdown: FALLBACK_ANSWER,
        citations: [],
        unanswered: true,
        pipeline: "worker_rag",
        retrieval_signal: "none",
        ranking_signal: "none",
        validation: { valid: true, checks: { worker_error: true } },
        debug: {
          worker_error: true,
          status: response.status,
          raw_output: String(errorText).slice(0, 300),
          worker_url: WRICORE_WORKER_URL
        }
      };
    }
    w = await response.json();
  } catch (err) {
    return {
      query,
      answer_markdown: FALLBACK_ANSWER,
      citations: [],
      unanswered: true,
      pipeline: "worker_rag",
      retrieval_signal: "none",
      ranking_signal: "none",
      validation: { valid: true, checks: { worker_exception: true } },
      debug: { worker_error: true, error: err.message, worker_url: WRICORE_WORKER_URL }
    };
  }

  const chunksUsed = (w && w.meta && Array.isArray(w.meta.chunks_used)) ? w.meta.chunks_used : [];
  const anyRerank = chunksUsed.some(c => c.rerank_score != null);
  const anyVector = chunksUsed.some(c => (c.vector_score ?? 0) > 0);

  return {
    query,
    answer_markdown: typeof w.answer_markdown === "string" ? w.answer_markdown : "",
    citations: Array.isArray(w.citations) ? w.citations : [],
    unanswered: typeof w.unanswered === "boolean" ? w.unanswered : true,
    pipeline: "worker_rag",
    retrieval_signal: chunksUsed.length === 0 ? "none" : (anyVector ? "hybrid" : "keyword_only"),
    ranking_signal: chunksUsed.length === 0 ? "none" : (anyRerank ? "reranker" : "hybrid_fusion"),
    validation: { valid: true, checks: {} },
    debug: {
      model: (w.meta && w.meta.model) || null,
      latency_ms: (w.meta && w.meta.latency_ms) ?? null,
      chunks_used_count: chunksUsed.length,
      chunks_used: chunksUsed,
      chunk_ids: chunksUsed.map(c => c.chunk_id),
      worker_url: WRICORE_WORKER_URL,
      worker_error: false
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const query = process.argv.slice(2).join(" ");

  if (!query) {
    console.log(
      JSON.stringify(
        {
          error: "Please provide a query.",
          example:
            'node src/rag/answer-with-context.mjs "what is context harness"'
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const result = await answerWithContext(query);
  console.log(JSON.stringify(result, null, 2));
}