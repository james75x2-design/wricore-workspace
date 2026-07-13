// src/rag/eval.mjs
//
// WriCoRe Step 5 — Simple Evaluation Harness
//
// What this checks:
// 1. Retrieval correctness:
//    Did expected chunk_ids appear in retrieved chunks?
//
// 2. Answer correctness:
//    Did answer-with-context return validation.valid === true?
//    Did the final answer cite the expected chunk_ids?
//    Did unanswered behavior match expectation?
//
// Beginner-safe:
// - No frameworks
// - No vector DB
// - Uses eval-data.json
// - Uses existing retrieve.mjs and answer-with-context.mjs
//
// Run:
// node src/rag/eval.mjs

import fs from "fs/promises";
import { retrieve } from "./retrieve.mjs";
import { answerWithContext } from "./answer-with-context.mjs";

const EVAL_DATA_PATH = "eval-data.json";
const TOP_K = 5;

function unique(values) {
  return [...new Set(values)];
}

function extractInlineCitations(answerMarkdown) {
  const matches = [
    ...(answerMarkdown || "").matchAll(/\[([a-z0-9._-]+::\d{3})\]/gi)
  ];

  return unique(matches.map(m => m[1]));
}

function getStructuredCitationIds(citations) {
  if (!Array.isArray(citations)) return [];

  return unique(
    citations.flatMap(c =>
      Array.isArray(c.chunk_ids) ? c.chunk_ids : []
    )
  );
}

function containsAll(actualIds, expectedIds) {
  return expectedIds.every(id => actualIds.includes(id));
}

function arraysEqualAsSets(a, b) {
  const aa = unique(a).sort();
  const bb = unique(b).sort();

  return (
    aa.length === bb.length &&
    aa.every((value, index) => value === bb[index])
  );
}

async function loadEvalData() {
  const raw = await fs.readFile(EVAL_DATA_PATH, "utf8");
  return JSON.parse(raw);
}

function evaluateRetrieval(testCase, retrievedChunks) {
  const retrievedIds = retrievedChunks.map(c => c.chunk_id);
  const expectedIds = testCase.expected_chunk_ids || [];

  // For answerable questions, expected chunks must appear.
  // For unanswerable questions, we do not require zero retrieval yet because
  // lexical retrieval may still find partial keyword matches.
  const retrievalPass =
    expectedIds.length === 0
      ? true
      : containsAll(retrievedIds, expectedIds);

  return {
    pass: retrievalPass,
    expected_chunk_ids: expectedIds,
    retrieved_chunk_ids: retrievedIds
  };
}

function evaluateAnswer(testCase, answerResult) {
  const expectedCitationIds = testCase.expected_citation_ids || [];
  const expectUnanswered = Boolean(testCase.expect_unanswered);

  const inlineCitationIds = extractInlineCitations(answerResult.answer_markdown);
  const structuredCitationIds = getStructuredCitationIds(answerResult.citations);
  const allCitationIds = unique([
    ...inlineCitationIds,
    ...structuredCitationIds
  ]);

  const unansweredMatches =
    Boolean(answerResult.unanswered) === expectUnanswered;

  const validationPass = Boolean(answerResult.validation?.valid);

  const citationPass =
    expectedCitationIds.length === 0
      ? allCitationIds.length === 0
      : containsAll(allCitationIds, expectedCitationIds);

  const answerPass =
    unansweredMatches &&
    (expectUnanswered ? true : validationPass) &&
    citationPass;

  return {
    pass: answerPass,
    expected_citation_ids: expectedCitationIds,
    actual_citation_ids: allCitationIds,
    unanswered_expected: expectUnanswered,
    unanswered_actual: Boolean(answerResult.unanswered),
    validation_valid: validationPass,
    answer_preview: (answerResult.answer_markdown || "").slice(0, 220)
  };
}

async function runOne(testCase) {
  const retrievedChunks = (await retrieve(testCase.query, TOP_K)).slice(0, TOP_K);
  const answerResult = await answerWithContext(testCase.query);

  const retrieval = evaluateRetrieval(testCase, retrievedChunks);
  const answer = evaluateAnswer(testCase, answerResult);

  const overallPass = retrieval.pass && answer.pass;

  return {
    id: testCase.id,
    query: testCase.query,
    pass: overallPass,
    retrieval,
    answer
  };
}

function printResult(result) {
  const icon = result.pass ? "✅" : "❌";

  console.log("");
  console.log(`${icon} ${result.id}: ${result.query}`);
  console.log(`   Retrieval: ${result.retrieval.pass ? "PASS" : "FAIL"}`);
  console.log(
    `   Expected chunks: ${JSON.stringify(result.retrieval.expected_chunk_ids)}`
  );
  console.log(
    `   Retrieved chunks: ${JSON.stringify(result.retrieval.retrieved_chunk_ids)}`
  );

  console.log(`   Answer: ${result.answer.pass ? "PASS" : "FAIL"}`);
  console.log(
    `   Expected citations: ${JSON.stringify(result.answer.expected_citation_ids)}`
  );
  console.log(
    `   Actual citations: ${JSON.stringify(result.answer.actual_citation_ids)}`
  );
  console.log(
    `   Unanswered expected/actual: ${result.answer.unanswered_expected}/${result.answer.unanswered_actual}`
  );
  console.log(`   Validation valid: ${result.answer.validation_valid}`);
  console.log(`   Answer preview: ${result.answer.answer_preview}`);
}

async function main() {
  console.log("WriCoRe RAG Evaluation Harness");
  console.log("================================");

  const testCases = await loadEvalData();

  const results = [];

  for (const testCase of testCases) {
    const result = await runOne(testCase);
    results.push(result);
    printResult(result);
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const failed = total - passed;

  const retrievalPassed = results.filter(r => r.retrieval.pass).length;
  const answerPassed = results.filter(r => r.answer.pass).length;

  console.log("");
  console.log("Summary");
  console.log("-------");
  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Retrieval passed: ${retrievalPassed}/${total}`);
  console.log(`Answer passed: ${answerPassed}/${total}`);
  console.log(`Overall pass rate: ${Math.round((passed / total) * 100)}%`);

  // Write machine-readable report.
  const report = {
    generated_at: new Date().toISOString(),
    total,
    passed,
    failed,
    retrieval_passed: retrievalPassed,
    answer_passed: answerPassed,
    overall_pass_rate: passed / total,
    results
  };

  await fs.writeFile(
    "eval-report.json",
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log("");
  console.log("Wrote eval-report.json");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error("Evaluation harness failed:");
  console.error(err);
  process.exit(1);
});