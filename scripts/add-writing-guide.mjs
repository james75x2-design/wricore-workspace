// scripts/add-writing-guide.mjs
// Idempotent: authors data/kb/writing-guide.md and appends its chunks to
// data/index/chunks.jsonl in the exact existing shape. Safe to re-run.
//
// After running this: node scripts/embed-chunks.mjs && node scripts/build-worker-chunks.mjs
import fs from "fs/promises";
import crypto from "crypto";

const DOC_ID = "writing-guide";
const SOURCE_PATH = "data/kb/writing-guide.md";
const TITLE = "WriCoRe Writing Guide";
const CHUNKS_JSONL = "data/index/chunks.jsonl";
const RAW_DOCS = "data/index/raw_docs.jsonl";

const SECTIONS = [
  ["Structuring an Argument",
    "A persuasive piece leads with its central claim, then supports it with evidence in descending order of strength. Each paragraph should advance one idea, and transitions should signal the logical relationship between points rather than merely listing them."],
  ["Editing for Concision",
    "Concise writing removes words that do not earn their place. Cut hedging phrases, redundant qualifiers, and throat-clearing openings, replace nominalizations with verbs, and prefer the shorter of two equally clear constructions."],
  ["Tone and Register",
    "Register is the formality level a piece adopts, and it should match the audience and channel. Keep tone consistent throughout a document, and calibrate warmth, authority, and directness to the reader's expectations rather than personal habit."],
  ["Active Voice and Strong Verbs",
    "Active voice names the actor before the action and usually produces shorter, clearer sentences. Passive voice is justified when the actor is unknown or irrelevant, but habitual passive construction obscures responsibility and slows the reader."],
  ["Adapting to Your Audience",
    "Effective writing starts from what the reader already knows and what they need to do next. Define unfamiliar terms on first use, cut context the audience already has, and choose examples drawn from the reader's own domain."],
  ["Outlining Before Drafting",
    "An outline fixes the sequence of ideas before sentence-level choices consume attention. Draft the headline claim first, list the supporting points beneath it, and confirm the order is defensible before writing full prose."],
  ["Common Style Pitfalls",
    "Frequent problems include burying the main point below preamble, inconsistent parallel structure in lists, overlong sentences carrying multiple clauses, and vague pronouns whose referents are ambiguous. Reading a draft aloud surfaces most of these quickly."]
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
