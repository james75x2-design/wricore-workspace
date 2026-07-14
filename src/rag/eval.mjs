// src/rag/eval.mjs
//
// WriCoRe Step 6–9 Evaluation Harness v0.2
//
// What this checks:
// 1. Retrieval correctness:
//    Did expected chunk_ids appear in top retrieved chunks?
//
// 2. Answer correctness:
//    Did answer-with-context produce:
//    - correct unanswered behavior
//    - valid citations
//    - expected citation IDs
//
// 3. Simple metrics:
//    - retrieval pass rate
//    - answer pass rate
//    - overall pass rate
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

function percent(numerator, denominator) {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
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

async function loadEvalData() {
  const raw = await fs.readFile(EVAL_DATA_PATH, "utf8");
  return JSON.parse(raw);
}

function evaluateRetrieval(testCase, retrievedChunks) {
  const retrievedIds = retrievedChunks.map(c => c.chunk_id);
  const expectedIds = testCase.expected_chunk_ids || [];
  const expectUnanswered = Boolean(testCase.expect_unanswered);

  let retrievalPass;

  if (expectUnanswered && expectedIds.length === 0) {
    // For unanswerable questions, good retrieval means no chunks retrieved.
    retrievalPass = retrievedIds.length === 0;
  } else {
    retrievalPass = containsAll(retrievedIds, expectedIds);
  }

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

  const validationValid = Boolean(answerResult.validation?.valid);

  let citationPass;

  if (expectUnanswered) {
    citationPass = allCitationIds.length === 0;
  } else {
    citationPass = containsAll(allCitationIds, expectedCitationIds);
  }

  const answerPass =
    unansweredMatches &&
    citationPass &&
    (expectUnanswered ? true : validationValid);

  return {
    pass: answerPass,
    expected_citation_ids: expectedCitationIds,
    actual_citation_ids: allCitationIds,
    unanswered_expected: expectUnanswered,
    unanswered_actual: Boolean(answerResult.unanswered),
    validation_valid: validationValid,
    answer_preview: (answerResult.answer_markdown || "").slice(0, 260)
  };
}

async function runOne(testCase) {
  const retrievedChunks = (await retrieve(testCase.query, TOP_K)).slice(0, TOP_K);
  const answerResult = await answerWithContext(testCase.query);

  const retrieval = evaluateRetrieval(testCase, retrievedChunks);
  const answer = evaluateAnswer(testCase, answerResult);

  return {
    id: testCase.id,
    query: testCase.query,
    pass: retrieval.pass && answer.pass,
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
  console.log("WriCoRe RAG Evaluation Harness v0.2");
  console.log("===================================");

  const testCases = await loadEvalData();
  const results = [];

  for (const testCase of testCases) {
    const result = await runOne(testCase);
    results.push(result);
    printResult(result);
  }

  const total = results.length;

  const passed = results.filter(r => r.pass).length;
  const failed = total - passed;

  const retrievalPassed = results.filter(r => r.retrieval.pass).length;
  const answerPassed = results.filter(r => r.answer.pass).length;

  const retrievalPassRate = percent(retrievalPassed, total);
  const answerPassRate = percent(answerPassed, total);
  const overallPassRate = percent(passed, total);

  console.log("");
  console.log("Summary");
  console.log("-------");
  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Retrieval passed: ${retrievalPassed}/${total} (${retrievalPassRate}%)`);
  console.log(`Answer passed: ${answerPassed}/${total} (${answerPassRate}%)`);
  console.log(`Overall pass rate: ${overallPassRate}%`);

  const report = {
    generated_at: new Date().toISOString(),
    total,
    passed,
    failed,
    retrieval_passed: retrievalPassed,
    answer_passed: answerPassed,
    retrieval_pass_rate: retrievalPassRate,
    answer_pass_rate: answerPassRate,
    overall_pass_rate: overallPassRate,
    results
  };

  await fs.writeFile(
    "eval-report.json",
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log("");
  console.log("Wrote eval-report.json");

  if (failed > 0) {
    console.log("");
    console.log("Note: Some failures are useful. They show what retrieval or prompting should improve next.");
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error("Evaluation harness failed:");
  console.error(err);
  process.exit(1);
});