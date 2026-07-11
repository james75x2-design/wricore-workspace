# WriCoRe Evaluation Harness

A structured evaluation framework for measuring the quality, consistency, and reliability of WriCoRe's three specialized agents. Modeled after the VoyageFlow evaluation harness and adapted for the multi-agent workspace domain.

---

## Purpose

WriCoRe routes user requests to one of three specialized agents:

1. **Writing Agent (WRITE-BOT)** — Professional writing & editorial partner
2. **Coding Agent (DEV-BOT)** — Full-stack engineering & debugging assistant
3. **Research Agent (ANALYST-BOT)** — Deep analysis & grounded researcher

Each agent has distinct expected behavior, voice, and output format. This harness provides:

- Canonical test prompts per agent
- A shared scoring rubric with domain-specific dimensions
- Sample scored outputs for calibration
- A human-in-the-loop review process

---

## Test Prompts

Nine prompts total — three per agent — covering happy paths, edge cases, and adversarial inputs.

### Writing Agent (WRITE-BOT)

| # | Prompt | Expected Behavior |
|---|---|---|
| W1 | "Draft a professional email asking for project delays approval." | Clear, professional email; empathetic yet direct tone; ready-to-send format |
| W2 | "Polish and rewrite a rough paragraph into a compelling pitch: [paragraph]" | Improved clarity, stronger verbs, punchy structure without losing meaning |
| W3 | "Write a 3-sentence bio for a data scientist joining our team." | Tight, professional, first-person; no filler phrases |

### Coding Agent (DEV-BOT)

| # | Prompt | Expected Behavior |
|---|---|---|
| C1 | "Write a responsive CSS flexbox layout example with modern styling." | Valid, runnable code; explains modern practices (gap, min-width, etc.) |
| C2 | "Create a JavaScript function with exponential backoff for fetching data." | Correct backoff math; handles errors; returns Promise; clean async/await |
| C3 | "Explain the Big O complexity of quicksort vs mergesort with code samples." | Accurate complexity analysis; runnable sample code for both; clear tradeoffs |

### Research Agent (ANALYST-BOT)

| # | Prompt | Expected Behavior |
|---|---|---|
| R1 | "Compare the architectural trade-offs of Monoliths vs Microservices." | Balanced comparison, specific criteria (deployment, scaling, testing, ownership); avoids one-sided narrative |
| R2 | "Explain quantum computing principles for a non-technical audience." | Clear analogies, no jargon dumps, structured explanation with concrete examples |
| R3 | "Create a structured research outline on renewable energy progress." | Hierarchical outline; clear thesis; specific sub-topics; publishable structure |

---

## Scoring Rubric

Each response is scored on 6 dimensions, 1–5 scale.

| Dimension | 5 (Excellent) | 3 (Acceptable) | 1 (Fail) |
|---|---|---|---|
| **Task Fidelity** | Perfectly addresses the prompt intent | Addresses most of the ask | Misinterprets or ignores the prompt |
| **Domain Voice** | Nails the agent's role (writing / dev / research) | Mostly on-tone with slips | Wrong register (e.g., research response reads like marketing copy) |
| **Structure** | Well-organized with headers, lists, or code blocks as appropriate | Serviceable structure | Wall of text; no navigability |
| **Correctness** | Factually accurate; code runs; claims verifiable | Mostly correct with minor issues | Contains false claims or broken code |
| **Depth vs Length** | Appropriate depth for the ask; no bloat | Slightly too long or too shallow | Padded, repetitive, or superficial |
| **Fallback Handling** | Response identifies which model answered (Gemini vs Groq); no user-visible difference in quality | Quality dips slightly on fallback | Fallback response is noticeably worse |

**Total possible:** 30 points per response.
**Portfolio-grade threshold:** ≥ 24 (80%) average across all 9 prompts.

---

## Sample Scored Output

**Prompt R1:** "Compare the architectural trade-offs of Monoliths vs Microservices."

**Model used:** `GEMINI-2.5-FLASH`
**Latency:** ~1.1s
**Version:** 3.1

| Dimension | Score | Notes |
|---|---|---|
| Task Fidelity | 5 | Directly compares both architectures across 6 criteria |
| Domain Voice | 5 | Analyst voice throughout; no marketing tone |
| Structure | 5 | Clear headers per criterion; comparison table; concluding synthesis |
| Correctness | 5 | Deployment complexity, network overhead, DB per service — all accurate |
| Depth vs Length | 4 | Slightly long on the microservices trade-off section |
| Fallback Handling | N/A | Primary answered, no fallback triggered |

**Total:** 24 / 25 (rescaled) → **96%** ✅

---

## Failure Modes to Watch

Common issues to look for during harness runs:

- **Agent bleed-through** — Coding agent slips into research-report tone, or writing agent starts giving code snippets
- **Model-name mismatch** — Response arrives but doesn't correctly report which model answered
- **Fallback quality dip** — Llama 3.1 8B answers noticeably worse than Gemini or Llama 3.3 70B
- **Length spirals** — Research agent especially prone to over-long answers when prompt is broad
- **Missing structure** — Writing agent should return polished prose; Coding agent should return runnable code blocks; Research agent should return outlined analysis

---

## How to Run the Harness

Currently the harness is run manually.

### Manual process

1. Open the live app: https://james75x2-design.github.io/wricore-workspace/
2. For each agent, send its 3 test prompts and record the response.
3. Score each response on the 6 rubric dimensions.
4. Log results in a spreadsheet or Markdown table.
5. Flag any response scoring < 3 on any dimension for prompt/system revision.

### Future: automated harness

- A Node.js script hits `POST /` for each prompt with the appropriate agent context.
- Responses parsed and validated against expected structure.
- LLM-as-judge scoring against the rubric (separate model to avoid bias).
- Results written to `harness/results/YYYY-MM-DD.json`.

---

## HITL (Human-in-the-Loop) Review

Even with an automated harness, human review remains the gold standard for tone and voice.

**Review cadence:** Every new worker version (v3.x → v3.x+1) should pass the full 9-prompt harness with an average score ≥ 24 before deploying.

**Review checklist:**

- [ ] All 9 prompts completed across all 3 agents
- [ ] Each response scored on all 6 dimensions
- [ ] Failed dimensions flagged with root-cause notes
- [ ] Prompt/system fixes proposed for anything scoring < 3
- [ ] Full result set committed to `harness/results/`

---

## Roadmap

- [ ] Automate the harness runner (Node.js script)
- [ ] Add LLM-as-judge scoring for consistency
- [ ] Track scores across worker versions to detect regressions
- [ ] Expand prompt set to 15+ covering more agent-specific edge cases
- [ ] Add multi-turn conversation tests (currently single-turn only)

---

*This harness is designed to grow alongside WriCoRe. Add new prompts and dimensions as new agents or capabilities ship.*
