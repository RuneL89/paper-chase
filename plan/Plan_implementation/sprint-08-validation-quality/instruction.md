# Sprint 8 — Validation, Quality & Cross-Wiki: Critic, Completeness, Lint, and Multi-Wiki Index

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-08-validation-quality` |
| Goal | Harden the system with LLM Critic, deterministic completeness checks, lint reports, and cross-wiki index discovery. |
| Based on | `Project Vision/07_validation_and_quality.md` §2, §4, §5, §7; `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §2.1, §7.1; `Project Vision/03_DOX_concept_detailed.md` §3.1. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint

`Project Vision/07` §2 defines the validation order:

1. **Critic** — LLM review of the drafted pages.
2. **Deterministic completeness check** — compare the LLM-written page against the extracted input.
3. **Deterministic structural checks** — broken links, citation integrity, schema compliance.
4. **Schema validation** — all pages must match the required frontmatter schema.

`Project Vision/01` §2.1 requires a top-level `index-of-indexes.md`. `Project Vision/03` §3 requires the cascading `index.md` contract hierarchy. This sprint hardens the system and makes it usable across multiple wikis.

---

## 2. Prerequisites

- **Sprints 1–7** must be approved by the user.
- The LLM sub-agent pipeline, dynamic structure, human approval flow, and selective re-ingestion are in place.

---

## 3. Scope

### 3.1 LLM Critic Agent

`Project Vision/07` §2.1:

> The **Critic** is the seventh sub-agent in the orchestrator pipeline. It reviews the LLM-written pages and the page plan for: quality and clarity of writing; completeness; consistency; correctness; adherence to `AGENTS.md`.

Implementation:

- Add a true LLM Critic in `src/orchestrator/agents.ts` that receives the drafted pages, the page plan, the extracted input, `AGENTS.md`, and rolling memory.
- It returns `approved` or `blocked` with a list of issues and suggested fixes.
- The Critic prompt must include the eight-item checklist from `Project Vision/07` §3.1. Its JSON response must include a `checks` array with a `PASS`/`FAIL` result for each item and a `blockingIssues` array for any failed check:
  1. Does every factual claim have a citation?
  2. Are the citations mapped to real sources in the frontmatter?
  3. Are tables and figures preserved?
  4. Are all extracted paragraphs represented?
  5. Are wikilinks pointing to plausible pages?
  6. Does the page plan match the pages that were actually written?
  7. Are new page types documented in the folder-level `index.md`?
  8. Are the pages self-contained and readable?
- If blocked, the pipeline reprocesses the chunk with feedback.
- Max reprocessing attempts configurable (default 3).

### 3.2 Deterministic Completeness Check

`Project Vision/07` §2.2:

> After the Critic approves, the local deterministic layer compares the LLM-written pages against the extracted input to ensure that: no text was dropped; tables were preserved verbatim; figures were described; no material was materially altered.

Implementation:

- Add `src/validation/completeness.ts` with functions that:
  - Check that every paragraph in the extracted text appears in the markdown body (allowing for reordering and rephrasing, but not omission).
  - Check that every table cell is preserved.
  - Check that figures are described.
- This check runs after the Critic and before structural/schema checks.
- If it fails, the chunk is reprocessed with feedback.

### 3.3 Structural & Schema Checks

- Broken wikilink detection: every `[[Page Name]]` must point to an existing file.
- Citation integrity: every `[^srcN]` must map to a `sources` entry; the source file must exist in `raw/`.
- Orphaned page detection: pages should have incoming links unless they are `index` or `source` pages.
- Duplicate entity flagging: very similar entity names are flagged for merging.
- Schema validation: required frontmatter fields per page type (`Project Vision/05`).

### 3.4 Lint Report

`Project Vision/07` §4:

> After each ingestion run, the system writes a lint report to the wiki's output folder, typically `output/lint/report.json`. The report contains: total page count and pages by type; number of errors and warnings; broken links; orphaned pages; citation integrity issues; duplicate entity flags; stale pages.

Implementation:

- Enhance `src/lint/index.ts` to produce the report structure described above.
- Write `output/lint/report.json` after every `ingest` run.

### 3.5 Error Handling and Recovery

`Project Vision/07` §7:

> If a chunk fails validation repeatedly, the system has several options: quarantine the chunk; fallback to deterministic extraction; abort the run.

Implementation:

- Configurable recovery mode per wiki (`aggressive`, `fallback`, `abort`).
- Quarantine: write extracted text to a `failed/` or `raw/` page.
- Fallback: write deterministic document page.
- Abort: stop the run and report the error.

### 3.6 Cross-Wiki Index and Name Discovery

`Project Vision/01` §2.1:

> The top-level entry point. It lists every wiki in the workspace, how many sources each one has, and how many pages were generated in total.

Implementation:

- Ensure `src/writers/index.ts` writes a valid `index-of-indexes.md`.
- The frontmatter must include:
  - `type: index`
  - `wiki: workspace` (or the workspace-level identifier)
  - `children`: list of wiki-level `index.md` files
- The body must list:
  - Every wiki in the workspace.
  - The number of sources and pages in each wiki.
  - The scope or purpose of each wiki.
  - Cross-wiki names and links, if any.
- Ensure `src/orchestrator/wiki-of-wiki.ts` surfaces cross-wiki names (entities or topics that appear in multiple wikis).
- The wiki-of-wiki agent should call the LLM only with extracted summaries and entity lists, never with raw PDFs.

### 3.7 `log.md` — Append-Only Audit Record

`Project Vision/02` §7.4 describes an optional append-only `log.md` that records ingestion runs and structural decisions. For this MvP it is required:

- After every `ingest` run, append a section to `output/log.md` (or `wikis/<slug>/log.md` if the wiki is single).
- Each entry must include:
  - Timestamp.
  - Command run (`ingest`, `ingest-all`, `sample`, `apply-proposal`).
  - Sources processed (added/changed/removed) and their SHA-256 hashes.
  - Pages created, updated, or deleted.
  - Structural changes applied or proposed.
  - Any errors, warnings, or quarantined chunks.
- The file is append-only; deterministic code appends the entry, and the LLM does not rewrite it.
- The lint report (§3.4) references the latest `log.md` entry for context.

---

## 4. Project Vision References

- `Project Vision/01` §2.1: Root roadmap `index-of-indexes.md`.
- `Project Vision/01` §7.1: Validation order.
- `Project Vision/02` §7.4: `log.md` append-only audit record.
- `Project Vision/03` §3.1: Level 0 contract.
- `Project Vision/05`: Page type schemas for validation.
- `Project Vision/06` §6: Citation integrity.
- `Project Vision/07` §2: Validation order.
- `Project Vision/07` §3.1: Critic checklist.
- `Project Vision/07` §4: Lint report.
- `Project Vision/07` §7: Error handling and recovery.

---

## 5. Files to Create or Modify

- `src/orchestrator/agents.ts` — LLM Critic.
- `src/validation/completeness.ts` — new file.
- `src/validation/links.ts` — may be new or expanded.
- `src/validation/citations.ts` — may be new or expanded.
- `src/lint/index.ts` — enhanced lint report.
- `src/writers/index.ts` — cross-wiki index and `index-of-indexes.md` schema.
- `src/writers/log.ts` — append-only `log.md` writer.
- `src/orchestrator/wiki-of-wiki.ts` — cross-wiki name discovery.
- `src/config.ts` — add recovery mode setting.
- `tests/validation/completeness.test.ts` — new tests.
- `tests/lint/index.test.ts` — new or expanded tests.
- `tests/writers/index.test.ts` — new tests for cross-wiki index and `index-of-indexes.md` schema.
- `tests/writers/log.test.ts` — new tests for append-only `log.md`.
- `tests/orchestrator/critic.test.ts` — new tests for the Critic checklist.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. The LLM Critic returns `approved` or `blocked` with a `checks` array covering the eight checklist items from `Project Vision/07` §3.1 and a `blockingIssues` array for any failed check.
3. Completeness check fails if an extracted paragraph is missing from the final markdown.
4. Lint report matches the schema in `Project Vision/07` §4 and is written to `output/lint/report.json`.
5. Broken wikilinks and missing citations are flagged in the lint report.
6. Cross-wiki name discovery produces a list of names appearing in multiple wikis.
7. `index-of-indexes.md` is updated after every `ingest` run in a multi-wiki workspace and includes the schema from `Project Vision/03` §3.1.
8. Recovery modes (`quarantine`, `fallback`, `abort`) are tested.
9. `log.md` is appended after every `ingest` run with timestamp, sources processed, pages changed, structural changes, and errors/warnings.
10. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. Running `ingest` produces a lint report at `output/lint/report.json` with page counts, errors, and warnings.
2. If a document page is missing a citation, the lint report flags it and the pipeline may reprocess the chunk.
3. In a workspace with multiple wikis, `index-of-indexes.md` lists all wikis, source/page counts, scopes, and cross-wiki names.
4. If a chunk repeatedly fails, the system writes the extracted text to a `raw/` or `failed/` page instead of crashing.
5. The final wiki has a cascading `index.md` contract hierarchy that a human can navigate without opening every content page.
6. The Critic blocks and reprocesses a chunk when it detects missing citations or un-preserved tables, with a checklist showing which checks failed.
7. `log.md` is append-only and contains a chronological record of every ingestion run and structural change.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 9 until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprints 1–7. Every previous component must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 8 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 9 until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 9 — README Documentation**: `plan/Plan_implementation/sprint-09-readme/instruction.md`.
