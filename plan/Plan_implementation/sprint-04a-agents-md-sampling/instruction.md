# Sprint 4a — Sampling Strategies & `AGENTS.md`

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-04a-agents-md-sampling` |
| Goal | Discover the sampling strategy for the corpus and generate the full per-wiki `AGENTS.md` ingestion guide before the LLM writes any content. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §8.2; `Project Vision/02_WIKI_concept_detailed.md` §7; `Project Vision/04_orchestration_detailed.md` §4.1–4.3; `Project Vision/07_validation_and_quality.md` §5. |
| Status | `COMPLETE` |

---

## 1. Why This Sprint

The original plan tried to generate `AGENTS.md` and implement the ChunkWriter in the same sprint, which created a circular dependency: the ChunkWriter needs to know the wiki conventions, but the conventions can only be discovered after analyzing the corpus. This sprint resolves that by splitting the work.

`Project Vision/01` §8.2 says the `sample` command must adapt to the document category:

> The sampling strategy must adapt to the nature of the documents in the corpus. The orchestrator chooses or is configured with a strategy appropriate to the document collection, such as: a collection of smaller, similar documents; a single very large document; a collection of similar but very large documents; a mixed corpus.

`Project Vision/02` §7 specifies that `AGENTS.md` is the LLM's ingestion guide for the wiki. It must be generated *after* the corpus is understood, because it contains corpus-specific folder structure, page types, naming conventions, citation rules, and special instructions.

---

## 2. Prerequisites

- **Sprints 1, 2, and 3** must be approved by the user.
- The `init` command, extraction, chunking, deterministic provenance layer, and `ingest-all` are in place.

---

## 3. Scope

### 3.1 Sampling Strategy Detection

Implement the four strategies from `Project Vision/01` §8.2:

| Category | Detection | Strategy |
|---|---|---|
| Single very large document | Exactly one PDF, physical pages > threshold | Look for a TOC in the first 50 pages. If found, use it for folder planning. If not, perform a full read during sample. |
| Similar, manageable-sized documents | Multiple PDFs, all below threshold, similar metadata | Read one document fully, then sample pages from remaining documents. |
| Similar but very large documents | Multiple PDFs, all above threshold, similar metadata | Read the first document fully to create the strategy; process the rest with `ingest`. |
| Mixed corpus | PDFs with different metadata or size profiles | Classify each document into a sub-group and apply the appropriate strategy per group. |

The thresholds should be configurable in `config.json` (e.g., `largePageThreshold`, default 500 pages). The strategy is recorded in `wikis/<slug>/chunking-strategy.md` as part of the deterministic audit trail.

### 3.2 `AGENTS.md` Generation During `sample`

During `sample`, after the corpus has been classified and analyzed, the LLM produces a full `AGENTS.md` for the wiki. The content must follow `Project Vision/02` §7.1:

- Purpose and scope.
- Folder structure (discovered from the corpus).
- Page types (default + any new types discovered).
- Naming conventions.
- Citation rules.
- Content rules.
- Special instructions (corpus-specific).
- Workflows (how to handle `sample`, `ingest`, maintenance).
- Lint / quality rules.

`Project Vision/02` §7.2 emphasizes:

> When the LLM ingests a new PDF, it should read the current `AGENTS.md` first. The document acts as the LLM's memory of the project's conventions.

Implementation:

- Add a new writer `src/writers/agents.ts` that writes `wikis/<slug>/AGENTS.md` from a structured input.
- Update `src/orchestrator/index.ts` (`runSampleOrchestrator`) to:
  - Classify the corpus and choose a sampling strategy.
  - Run the chosen strategy to gather structure, entities, and evidence.
  - Pass the gathered context to a new LLM prompt that produces the full `AGENTS.md`.
  - Write the full `AGENTS.md` to disk.
- Update `src/orchestrator/ingest.ts` (`runIngestOrchestrator`) to read the current `AGENTS.md` at the start of each source/chunk and pass it to the LLM context.

### 3.3 Structural Proposals (Lightweight)

New folders discovered during `sample` do not yet require human approval, because the wiki is being set up for the first time. However, the `AGENTS.md` must document the chosen folder structure, and any new page types beyond the defaults must be listed with their rationale.

If `sample` is run on an existing wiki with status `ready`, proposed structural changes must follow the approval flow from `Project Vision/07` §5. That full approval flow is implemented in Sprint 6.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 1: The LLM writes all markdown content.
- `Project Vision/01` §8.2: Sampling strategies.
- `Project Vision/02` §7: The `AGENTS.md` schema/ingestion guide.
- `Project Vision/02` §7.1: What `AGENTS.md` must contain.
- `Project Vision/02` §7.2: `AGENTS.md` as the LLM's system prompt.
- `Project Vision/04` §4.1–4.3: The sampling phase and corpus classification.
- `Project Vision/07` §5: Structural change proposals (applied only to existing wikis in this sprint).

---

## 5. Files to Create or Modify

- `src/orchestrator/sampling.ts` — new file for strategy detection and execution.
- `src/writers/agents.ts` — full `AGENTS.md` writer.
- `src/orchestrator/index.ts` — integrate sampling strategy and `AGENTS.md` generation into `sample`.
- `src/orchestrator/ingest.ts` — read `AGENTS.md` at start of each chunk.
- `src/config.ts` — add sampling thresholds to the wiki config schema.
- `src/chunking/strategy.ts` — may need updates to record sampling strategy in `chunking-strategy.md`.
- `tests/orchestrator/sampling.test.ts` — new tests.
- `tests/writers/agents.test.ts` — new tests.
- `tests/commands/sample.test.ts` — update for corpus-level sampling.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. After `sample`, `wikis/<slug>/AGENTS.md` contains all sections listed in `Project Vision/02` §7.1.
3. `sample` correctly classifies the corpus into one of the four strategies based on fixture PDFs.
4. The chosen strategy is recorded in `wikis/<slug>/chunking-strategy.md`.
5. `AGENTS.md` is re-read at the start of every `ingest` chunk and passed to the LLM context.
6. Tests verify that the sampling strategy adapts to document size and count.
7. LLM calls during `sample` are logged in the run log (no raw PDF bytes, only extracted text and metadata).
8. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. Placing one 2,000-page PDF in `raw/` and running `sample` triggers the "single very large document" strategy and searches for a TOC in the first 50 pages.
2. Placing 15 annual reports in `raw/` and running `sample` triggers the "similar, manageable-sized documents" strategy and reads one fully plus a subset of others.
3. Placing a mix of large reports and small memos in `raw/` triggers the "mixed corpus" strategy and classifies documents into sub-groups.
4. After `sample`, `wikis/<slug>/AGENTS.md` exists and describes the folder structure, page types, and citation rules for this specific corpus.
5. The `sample` command reports the detected sampling strategy and the documents it read.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 4b until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprints 1–3. The `init` command, extraction, chunking, state tracking, and deterministic writers must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 4a with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 4b until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 4b — LLM-Driven ChunkWriter**: `plan/Plan_implementation/sprint-04b-llm-chunkwriter/instruction.md`.
