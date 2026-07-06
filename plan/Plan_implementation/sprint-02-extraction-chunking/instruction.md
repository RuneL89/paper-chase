# Sprint 2 — Extraction & Chunking: From PDFs to Page-Based Chunks

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-02-extraction-chunking` |
| Goal | Implement robust PDF extraction, page-based chunking, scanned-page handling, and incremental SHA-256 state tracking. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 5, §8.3; `Project Vision/05_page_types_specification.md` §8; `AGENTS.md` key architectural rules. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint

`Project Vision/01` §3 Principle 5 states:

> PDFs are processed in chunks sized to fit within the configured LLM context limit. Chunks are **page-based**: a chunk is one or more consecutive pages, and the system never splits inside a page, table, or figure. The system errs on the side of more, smaller chunks to leave ample context for the LLM's planning and writing prompts.

`Project Vision/01` §8.3 adds:

> `ingest` is incremental. It tracks every PDF by SHA-256 hash... New PDFs are processed in full. Changed PDFs are re-processed... Unchanged PDFs are skipped.

Extraction and chunking are the deterministic prerequisites for every LLM step. They must be solid before the LLM is asked to write anything.

---

## 2. Prerequisites

- **Sprint 1 — Foundation** must be approved by the user. The `init` command and workspace scaffolding must exist.
- The wiki folder structure (`wikis/<slug>/raw/`, `config.json`) is available.

---

## 3. Scope

Refine and harden the PDF extraction and chunking pipeline:

1. Refine `src/extractor/pdf.ts` to:
   - Use `pdfjs-dist/legacy/build/pdf.mjs` with `useSystemFonts: true`.
   - Read the whole file into memory as `Uint8Array`.
   - Extract text, detect tables, detect figures, and flag scanned pages.
   - Preserve `physicalPage` and `logicalPage` numbers.
   - Record extraction warnings.
2. Refine `src/chunking/chunker.ts` to:
   - Group consecutive pages into chunks based on configured token/context limit.
   - Never split a page, table, or figure across chunks.
   - Prefer smaller chunks over larger ones.
   - Mark boundary type (`page`, `table`, `figure`, `heading`).
3. Ensure `src/chunking/analyzer.ts` produces a structure summary with headings, sections, and reading-order flags.
4. Ensure `src/ingestion/state.ts` tracks:
   - Per-source SHA-256.
   - Per-source derived pages (document, raw, source).
   - Per-source entity/topic counts.
   - Rolling memory reference.
5. Implement incremental diff logic: added/changed/removed detection.
6. Preserve scanned pages as `raw` pages later in Sprint 3.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 5: Context-cautious chunking.
- `Project Vision/01` §8.3: Incremental ingestion and SHA-256 tracking.
- `Project Vision/05` §8: The `raw` page type for unparseable/scanned pages.
- `Project Vision/06` §4: Provenance pages require SHA-256 and page counts.
- `AGENTS.md` key architectural rules: PDF extraction, chunking, incremental ingestion.

---

## 5. Files to Create or Modify

- `src/extractor/pdf.ts` — refine extraction.
- `src/chunking/chunker.ts` — page-based chunking.
- `src/chunking/analyzer.ts` — structure analysis.
- `src/chunking/types.ts` — ensure chunk types support boundary types.
- `src/chunking/strategy-writer.ts` — document chunking strategy.
- `src/ingestion/state.ts` — SHA-256 and diff tracking.
- `tests/extractor/pdf.test.ts` — new or expanded tests.
- `tests/chunking/chunker.test.ts` — new or expanded tests.
- `tests/ingestion/state.test.ts` — new or expanded tests.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. `npm run test` passes with new tests covering:
   - A 10-page PDF is chunked into page-based chunks (no page split).
   - A PDF with a multi-page table keeps the table in a single chunk.
   - A scanned-only page is flagged `isScanned` and produces a raw page in later sprints.
   - Re-running `ingest` with an unchanged PDF skips it (SHA-256 match).
   - Changing one byte in a PDF causes re-processing.
   - Removing a PDF causes its derived pages to be removed.
3. Extraction produces `ExtractionResult` with `pages`, `tables`, `figures`, `warnings`, `physicalPages`, `logicalPages`, and `sha256`.
4. Chunking strategy document is written to `chunking-strategy.md` after `sample`/`ingest`.
5. State file is persisted to `output/.state/ingest-state.json`.

---

## 7. User Acceptance Criteria (UAT)

1. Placing `annual-report.pdf` in `wikis/acme/raw/` and running `ingest` produces chunks named `documents/annual-report-part-001.md`, etc.
2. The `chunking-strategy.md` file explains why each chunk boundary was chosen.
3. Re-running `ingest` immediately after the first run reports "0 sources changed" and finishes quickly.
4. A PDF with a scanned page produces a `raw/annual-report-page-005.md` page (completed in Sprint 3, but extraction must flag it here).
5. The `ingest-state.json` file tracks SHA-256 hashes for every PDF.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 3 until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprint 1. The `init` command, workspace scaffolding, and any tests from Sprint 1 must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 2 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 3 until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 3 — Deterministic Provenance Layer**: `plan/Plan_implementation/sprint-03-deterministic-provenance/instruction.md`.
