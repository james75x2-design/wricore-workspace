// scripts/add-coding-guide.mjs
// Idempotent: authors data/kb/coding-guide.md and appends its chunks to
// data/index/chunks.jsonl in the exact existing shape. Safe to re-run.
//
// After running this: node scripts/embed-chunks.mjs && node scripts/build-worker-chunks.mjs
import fs from "fs/promises";
import crypto from "crypto";

const DOC_ID = "coding-guide";
const SOURCE_PATH = "data/kb/coding-guide.md";
const TITLE = "WriCoRe Coding Guide";
const CHUNKS_JSONL = "data/index/chunks.jsonl";
const RAW_DOCS = "data/index/raw_docs.jsonl";

const SECTIONS = [
  ["Code Review Principles",
    "Effective code review focuses on correctness, readability, and maintainability rather than personal style. Reviewers should check for clear naming, small focused functions, and adequate test coverage, and leave specific, actionable comments."],
  ["Debugging Methodology",
    "Systematic debugging starts by reproducing the failure reliably, then narrowing the search space with logging, breakpoints, or bisection. Form a hypothesis, test one variable at a time, and confirm the root cause before applying a fix."],
  ["Writing Unit Tests",
    "Good unit tests are fast, isolated, and deterministic. Each test should verify one behavior, use clear arrange-act-assert structure, and cover edge cases such as empty inputs, boundary values, and error paths in addition to the happy path."],
  ["Git Commit Hygiene",
    "Commits should be small, atomic, and scoped to a single logical change. Write imperative commit messages that explain why the change was made, and avoid mixing refactoring with behavioral changes in the same commit."],
  ["Refactoring Safely",
    "Refactor only when tests are green, and change structure without changing behavior. Make one small transformation at a time, run the test suite after each step, and commit frequently so any regression is easy to isolate and revert."],
  ["Error Handling Patterns",
    "Robust code handles failures explicitly rather than letting them propagate silently. Validate inputs at boundaries, fail fast with clear messages, and degrade gracefully with timeouts and fallbacks when calling external services."],
  ["Performance Profiling",
    "Optimize based on measurement, not guesswork. Profile to find the real bottleneck, focus on the hottest paths, and confirm each change with before-and-after benchmarks so you avoid premature or ineffective optimizations."]
];

function contentHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

async function main() {
  const md = `# ${TITLE}\n\n` + SECTIONS.map(([s, b]) => `## ${s}\n${b}`).join("\n\n") + "\n";
  await fs.writeFile(SOURCE_PATH, md);
  console.log(`\u2022 Wrote ${SOURCE_PATH} (${md.length} chars, ${SECTIONS.length} sections).`);

  let existing = "";
  try { existing = await fs.readFile(CHUNKS_JSONL, "utf8"); } catch { existing = ""; }
  const keptLines = existing.split("\n").filter(Boolean).filter(line => {
    try { return JSON.parse(line).doc_id !== DOC_ID; } catch { return true; }
  });

  const newLines = SECTIONS.map(([section, body], i) => {
    const text = `## ${section}\n${body}`;
    return JSON.stringify({
      chunk_id: `${DOC_ID}::${String(i + 1).padStart(3, "0")}`,
      doc_id: DOC_ID,
      source_path: SOURCE_PATH,
      section,
      char_start: 0,
      char_end: text.length,
      content_hash: contentHash(text),
      text
    });
  });

  await fs.writeFile(CHUNKS_JSONL, keptLines.concat(newLines).join("\n") + "\n");
  console.log(`\u2022 chunks.jsonl: kept ${keptLines.length} existing + added ${newLines.length} ${DOC_ID} chunks.`);

  let rawLines = [];
  try {
    const rawRaw = await fs.readFile(RAW_DOCS, "utf8");
    rawLines = rawRaw.split("\n").filter(Boolean).filter(line => {
      try { return JSON.parse(line).doc_id !== DOC_ID; } catch { return true; }
    });
  } catch { rawLines = []; }
  rawLines.push(JSON.stringify({
    doc_id: DOC_ID,
    source_path: SOURCE_PATH,
    title: TITLE,
    text_hash: contentHash(md),
    char_count: md.length
  }));
  await fs.writeFile(RAW_DOCS, rawLines.join("\n") + "\n");
  console.log(`\u2022 raw_docs.jsonl updated for ${DOC_ID}.`);

  console.log(`\u2713 Step 1 done. Next: node scripts/embed-chunks.mjs && node scripts/build-worker-chunks.mjs`);
}
main();
