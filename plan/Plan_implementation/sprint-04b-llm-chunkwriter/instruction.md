# Sprint 4b — LLM-Driven ChunkWriter

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-04b-llm-chunkwriter` |
| Goal | Make the LLM the author of markdown content by implementing an LLM-driven ChunkWriter that produces synthesis, citations, and wikilinks, while refactoring `ingestion/engine.ts` to delegate content generation to the writers/orchestrator. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 1; `Project Vision/02_WIKI_concept_detailed.md` §7; `Project Vision/04_orchestration_detailed.md` §4.4.6; `Project Vision/06_citation_and_provenance.md` §2, §3. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint

`Project Vision/01` §3 Principle 1 says:

> The LLM does all research, planning, and writing of markdown. This includes not only synthesized summaries, analyses, and connections, but also the faithful transcription of extracted text, tables, and figure descriptions into markdown.

The ChunkWriter is the agent that makes this principle real. `Project Vision/04` §4.4.6 describes it:

> Receives the page plan and all extracted material. Writes the markdown body of each page, including: LLM-written synthesis and summaries; faithful transcription of extracted text, tables, and figures; inline citations (`[^srcN]`); wikilinks to related pages. Updates existing pages by appending new evidence and mentions without losing existing detail.

This sprint also addresses the engine refactoring risk. The current `ingestion/engine.ts` contains content-generation logic that should live in the ChunkWriter and writers. This sprint refactors that incrementally while keeping existing tests green.

---

## 2. Prerequisites

- **Sprints 1, 2, 3, and 4a** must be approved by the user.
- The deterministic provenance layer and `AGENTS.md` generation are in place.
- The `AGENTS.md` ingestion guide is available at `wikis/<slug>/AGENTS.md`.

---

## 3. Scope

### 3.1 LLM-Driven ChunkWriter

- Rewrite `chunkWriter` in `src/orchestrator/agents.ts` to call the LLM with a structured prompt containing:
  - The current `AGENTS.md`.
  - The rolling memory summary.
  - The page plan from PagePlanner.
  - The extracted text, tables, and figures for the chunk.
  - Existing page content (if updating).
- The LLM response must be parsed into a set of page updates. Each update contains:
  - `filePath`
  - `frontmatter` (YAML)
  - `body` (markdown with `[^srcN]` and `[[...]]`)
- The ChunkWriter must handle both new pages and updates to existing pages, preserving existing detail.
- If the LLM response is invalid or missing, fall back to the deterministic baseline document pages from Sprint 3.

### 3.2 Engine Refactoring

- Move content-generation logic from `src/ingestion/engine.ts` into `src/orchestrator/ingest.ts` and the writers.
- `engine.ts` should remain responsible for orchestration: discovering sources, tracking incremental state, calling extraction, chunking, and the orchestrator, and writing the final output.
- The ChunkWriter/writers should be responsible for producing markdown bodies and frontmatter.
- Refactor incrementally; each step must keep `npm run test` green.

### 3.3 Document Page Synthesis

- Update `src/writers/document.ts` to accept LLM-written content.
- The deterministic fallback from Sprint 3 remains available for when the LLM fails.
- Entity, topic, and index pages may also be written or updated by the ChunkWriter in this sprint, but the focus is on document pages.

### 3.4 Integration with Deterministic Validation

- The output of the ChunkWriter must be validated by the frontmatter schema validator added in Sprint 1.
- If validation fails, the pipeline falls back to the deterministic baseline and logs a warning.

### 3.5 LLM Resilience, Resume, and Content Rules

Sprint 4b is the first sprint to make real LLM calls in the core pipeline. It must implement the API-level resilience mechanisms defined in Sprint 1 and add the content-generation rules missing from the plan.

#### Resume Mechanism

- After every chunk completes successfully, write a `chunk-state.json` file to `output/.state/chunks/<source-slug>-<chunk-num>.json`.
- The `ingest` command accepts a `--resume` flag that skips chunks with a completed state file.
- Maintain a `run-manifest.json` listing every chunk's status: `pending`, `processing`, `completed`, `failed`, `quarantined`.
- The retry logic from Sprint 1 (exponential backoff, max 3 retries, malformed-JSON fallback) is applied to every ChunkWriter call.

#### `confidence` Field

The ChunkWriter may set the optional `confidence` field (`high`, `medium`, `low`) on document pages based on source clarity, OCR quality, or extraction warnings. The deterministic fallback sets `confidence: low` for pages with scanned-page warnings.

#### Tags Taxonomy and Generation

The ChunkWriter generates `tags` for each page based on the page content and the `AGENTS.md` tag conventions. Tags should be:

- Lowercase and hyphenated.
- Drawn from a corpus-specific vocabulary discovered during `sample` (e.g., `["donor", "political-party", "2024"]` for a donations wiki).
- Stored in the rolling memory so the vocabulary grows incrementally across chunks.

#### Special Citation Cases

The ChunkWriter prompt must explicitly cover the three special cases from `Project Vision/06` §9:

1. **Claims spanning multiple sources** — cite all of them: `[^src1] [^src2]`.
2. **Tables and figures** — every cell must be traceable; the table caption includes a citation: `Source: [^src1]`.
3. **Scanned pages** — claims are either not made or explicitly marked as needing verification.

The ChunkWriter JSON output must include a `citations` section listing every claim and its source mapping, so the deterministic layer can validate it before writing the page.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 1: The LLM writes all markdown content.
- `Project Vision/02` §7: The `AGENTS.md` schema/ingestion guide.
- `Project Vision/02` §7.2: `AGENTS.md` as the LLM's system prompt.
- `Project Vision/04` §4.4.6: ChunkWriter responsibilities.
- `Project Vision/05` §2: Common frontmatter fields (`confidence`, `tags`).
- `Project Vision/05` §4.2: Document page two-layer structure (synthesis + preserved detail).
- `Project Vision/06` §2, §3: Citation format and `sources` frontmatter schema.
- `Project Vision/06` §9: Special citation cases (multi-source claims, tables/figures, scanned pages).
- `Project Vision/07` §7: Fallback to deterministic extraction when the LLM fails.

---

## 5. Files to Create or Modify

- `src/orchestrator/agents.ts` — LLM-driven `ChunkWriter`.
- `src/writers/document.ts` — accept LLM-written content.
- `src/writers/entity.ts` and `src/writers/topic.ts` — may accept LLM-written content if produced by ChunkWriter.
- `src/ingestion/engine.ts` — refactor to delegate content generation and support `--resume`.
- `src/ingestion/resume.ts` — new file for per-chunk state and run manifest.
- `src/orchestrator/ingest.ts` — wire ChunkWriter output into the ingestion flow and apply retry logic.
- `src/ingestion/state.ts` — track page-level state for updates and resume.
- `tests/orchestrator/chunkWriter.test.ts` — new tests (including special citation cases).
- `tests/writers/document.test.ts` — update tests for LLM content, fallback, and `confidence`/`tags`.
- `tests/ingestion/resume.test.ts` — new tests for `--resume` and run manifest.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. `ChunkWriter` produces pages with:
   - LLM-written synthesis at the top.
   - Preserved extracted detail below.
   - Inline `[^srcN]` citations for every factual claim, including multi-source claims.
   - `[[Page Name]]` wikilinks to related entity/topic/document pages.
3. Tests verify that document pages contain at least one `[^srcN]` citation and at least one `[[...]]` wikilink when the corpus contains entities.
4. Tests verify that updating an existing page does not overwrite earlier content.
5. Tests verify that invalid LLM output falls back to the deterministic baseline document page after retries are exhausted.
6. Frontmatter from ChunkWriter output passes the schema validator from Sprint 1 and includes `confidence` and `tags`.
7. The refactored `engine.ts` no longer contains markdown content-generation logic.
8. LLM calls are logged in the run log (no raw PDF bytes, only extracted text and metadata).
9. The `ingest --resume` flag skips chunks whose `chunk-state.json` is marked `completed`.
10. The run manifest tracks every chunk as `pending`/`processing`/`completed`/`failed`/`quarantined`.
11. Tests verify the three special citation cases (multi-source, tables/figures, scanned pages) are handled in the ChunkWriter prompt and output.
12. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. Running `ingest` on the same corpus produces document pages that begin with an LLM-written summary, not just raw extracted text.
2. The summary contains inline citations like `[^src1]` that map to a `sources` entry in the frontmatter.
3. Entity names in the summary are linked like `[[Acme Corp]]`.
4. The full extracted text is still preserved below the summary.
5. Re-running `ingest` with a new PDF updates existing pages with new evidence without losing existing detail.
6. If the LLM returns invalid output, the page still contains the deterministic fallback content after retries.
7. Document pages include a `confidence` field and a `tags` list drawn from the corpus vocabulary.
8. Running `ingest --resume` after a failure skips already-completed chunks and continues from the failed chunk.
9. Tables and figures in the summary include citations that map to the source.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 5 until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprints 1–4a. The `init` command, extraction, chunking, state tracking, deterministic writers, and `AGENTS.md` generation must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 4b with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 5 until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 5 — LLM Sub-Agent Pipeline**: `plan/Plan_implementation/sprint-05-llm-sub-agents/instruction.md`.
