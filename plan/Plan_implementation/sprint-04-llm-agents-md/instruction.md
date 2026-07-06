# Sprint 4 — LLM as Author: `AGENTS.md` and ChunkWriter

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-04-llm-agents-md` |
| Goal | Make the LLM the author of markdown content by generating a per-wiki `AGENTS.md` ingestion guide and implementing an LLM-driven ChunkWriter that produces synthesis, citations, and wikilinks. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 1; `Project Vision/02_WIKI_concept_detailed.md` §7; `Project Vision/04_orchestration_detailed.md` §4.4.6; `Project Vision/06_citation_and_provenance.md` §2, §3. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint

This is the pivotal sprint. `Project Vision/01` §3 Principle 1 says:

> The LLM does all research, planning, and writing of markdown. This includes not only synthesized summaries, analyses, and connections, but also the faithful transcription of extracted text, tables, and figure descriptions into markdown.

The two mechanisms that enable this are:

1. A **per-wiki `AGENTS.md` ingestion guide** that the LLM reads before writing (`Project Vision/02` §7).
2. A **ChunkWriter** that calls the LLM to produce markdown bodies with synthesis, citations, and wikilinks (`Project Vision/04` §4.4.6).

---

## 2. Prerequisites

- **Sprints 1, 2, and 3** must be approved by the user.
- The deterministic provenance layer (source, raw, baseline document pages) is in place.

---

## 3. Scope

### 3.1 `AGENTS.md` Generation During `sample`

During `sample`, after the corpus has been analyzed, the LLM must produce a full `AGENTS.md` for the wiki. The content must follow `Project Vision/02` §7.1:

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

- Add a new writer `src/writers/agents.ts` that takes the folder plan, page types, and naming conventions and writes `wikis/<slug>/AGENTS.md`.
- Update `src/orchestrator/index.ts` (`runSampleOrchestrator`) to:
  - Read the skeleton `AGENTS.md` from `init`.
  - Pass it to a new LLM prompt that produces the full `AGENTS.md`.
  - Write the full `AGENTS.md` to disk.
- Update `src/orchestrator/ingest.ts` (`runIngestOrchestrator`) to read the current `AGENTS.md` at the start of each source/chunk and pass it to the LLM context.

### 3.2 LLM-Driven ChunkWriter

`Project Vision/04` §4.4.6 describes ChunkWriter:

> Receives the page plan and all extracted material. Writes the markdown body of each page, including: LLM-written synthesis and summaries; faithful transcription of extracted text, tables, and figures; inline citations (`[^srcN]`); wikilinks to related pages. Updates existing pages by appending new evidence and mentions without losing existing detail. Updates the `index.md` contracts to include new pages and page types.

Implementation:

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

### 3.3 Document Page Synthesis

Update `src/writers/document.ts` to accept LLM-written content. The deterministic fallback from Sprint 3 remains available for when the LLM fails.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 1: The LLM writes all markdown content.
- `Project Vision/02` §7: The `AGENTS.md` schema/ingestion guide.
- `Project Vision/02` §7.1: What `AGENTS.md` must contain.
- `Project Vision/02` §7.2: `AGENTS.md` as the LLM's system prompt.
- `Project Vision/04` §4.4.6: ChunkWriter responsibilities.
- `Project Vision/05` §4.2: Document page two-layer structure (synthesis + preserved detail).
- `Project Vision/06` §2, §3: Citation format and `sources` frontmatter schema.

---

## 5. Files to Create or Modify

- `src/orchestrator/agents.ts` — LLM-driven `ChunkWriter`, `AGENTS.md` generation prompts.
- `src/writers/agents.ts` — full `AGENTS.md` writer.
- `src/writers/document.ts` — accept LLM-written content.
- `src/orchestrator/index.ts` — generate `AGENTS.md` during `sample`.
- `src/orchestrator/ingest.ts` — read `AGENTS.md` at start of each chunk.
- `src/llm/client.ts` — may need helper to prepend `AGENTS.md` to prompts.
- `tests/orchestrator/chunkWriter.test.ts` — new tests.
- `tests/writers/agents.test.ts` — new tests.
- `tests/writers/document.test.ts` — update tests for LLM content.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. After `sample`, `wikis/<slug>/AGENTS.md` contains all sections listed in `Project Vision/02` §7.1.
3. `AGENTS.md` is re-read at the start of every `ingest` chunk and passed to the LLM context.
4. `ChunkWriter` produces pages with:
   - LLM-written synthesis at the top.
   - Preserved extracted detail below.
   - Inline `[^srcN]` citations for every factual claim.
   - `[[Page Name]]` wikilinks to related entity/topic/document pages.
5. Tests verify that document pages contain at least one `[^srcN]` citation and at least one `[[...]]` wikilink when the corpus contains entities.
6. Tests verify that updating an existing page does not overwrite earlier content.
7. LLM calls are logged in the run log (no raw PDF bytes, only extracted text and metadata).
8. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. Running `sample` on a corpus produces a `wikis/<slug>/AGENTS.md` that describes the folder structure, page types, and citation rules for this specific corpus.
2. Running `ingest` on the same corpus produces document pages that begin with an LLM-written summary, not just raw extracted text.
3. The summary contains inline citations like `[^src1]` that map to a `sources` entry in the frontmatter.
4. Entity names in the summary are linked like `[[Acme Corp]]`.
5. The full extracted text is still preserved below the summary.
6. Re-running `ingest` with a new PDF updates existing pages with new evidence without losing existing detail.

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

Preserve all context from Sprints 1–3. The `init` command, extraction, chunking, state tracking, and deterministic writers must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 4 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 5 until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 5 — LLM Sub-Agent Pipeline**: `plan/Plan_implementation/sprint-05-llm-sub-agents/instruction.md`.
