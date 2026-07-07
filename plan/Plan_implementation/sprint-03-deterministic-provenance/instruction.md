# Sprint 3 — Deterministic Provenance Layer + `ingest-all`

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-03-deterministic-provenance` |
| Goal | Implement the deterministic provenance layer (source, raw, baseline document pages) and explicitly scope the `ingest-all` command. This is the fallback that the LLM will later enhance. |
| Based on | `Project Vision/05_page_types_specification.md` §4, §5, §8; `Project Vision/06_citation_and_provenance.md` §4; `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §2.5, §2.6. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint

Before the LLM writes synthesis, the system must be able to produce the provenance anchors that every citation will rely on. `Project Vision/06` §4 states:

> Every source PDF has a corresponding `source` page. The `source` page is the provenance anchor for all citations to that PDF.

`Project Vision/05` §5 specifies the `source` page frontmatter: `file`, `sha256`, `pages`, `ingested`, `warnings`. §4 specifies `document` pages as containers for raw material. §6 specifies `raw` pages for unparseable fragments.

This sprint also implements the deterministic document-page fallback that the system can use when the LLM fails in later sprints (per `Project Vision/07` §7 Error Handling and Recovery). It also explicitly scopes `ingest-all`, which exists in the current codebase but is not clearly defined.

---

## 2. Prerequisites

- **Sprint 1 — Foundation + Test Infrastructure** and **Sprint 2 — Extraction & Chunking** must be approved by the user.
- `init`, extraction, chunking, and incremental state tracking are in place.

---

## 3. Scope

1. Implement `src/writers/source.ts` to write deterministic `source` pages with:
   - File path and SHA-256.
   - Page count and metadata.
   - Warnings (e.g., scanned pages).
   - Links to derived document and raw pages.
2. Implement `src/writers/raw.ts` to write deterministic `raw` pages with:
   - Source PDF and page number.
   - Reason (scanned/image-only).
   - Any OCR text or image metadata.
3. Implement baseline `src/writers/document.ts` to write deterministic document pages that contain:
   - Frontmatter with `title`, `type: document`, `wiki`, `sources` (file + page range), `tags`, `confidence`.
   - Extracted text organized by headings.
   - Tables preserved as markdown tables.
   - Figure descriptions.
   - No LLM synthesis yet — this is the fallback when the LLM fails.
4. Implement `src/writers/index.ts` to write wiki-level `index.md` and `index-of-indexes.md` with counts and links.
5. Update `src/commands/ingest.ts` to call the writers and produce the deterministic output.

### New: `ingest-all` Scope

The `ingest-all` command iterates over every wiki in the workspace and runs `ingest` on each. It updates the top-level `index-of-indexes.md` once at the end, after all wikis have been processed. It does not process multiple wikis in parallel; it processes them sequentially to avoid memory spikes from large PDF collections.

### New: Index Contract, Provenance Schema, and Disambiguation

Sprint 3 is the first sprint that writes content pages, so it must implement the conventions defined in Sprint 1:

#### `children` in `index.md` Frontmatter

Every `index.md` (wiki-level and folder-level) must include a `children` field listing the folders or pages beneath it, as specified in `Project Vision/05` §3.1. The index writer is deterministic and must not rely on the LLM to generate this list.

Example wiki-level `index.md` frontmatter:
```yaml
---
type: index
wiki: donations
title: Political Donations Wiki
children:
  - documents/index.md
  - sources/index.md
  - entities/index.md
  - topics/index.md
  - raw/index.md
---
```

#### Folder-Level Contract Content Schema

`Project Vision/03` §3.3 requires every folder-level `index.md` to contain:

1. The folder's purpose.
2. What page types live in the folder.
3. The naming convention for files.
4. How pages in this folder are linked to other folders.
5. Any folder-specific rules.
6. A catalog of the pages in the folder.

Sprint 3 implements `src/writers/index.ts` so that each folder-level `index.md` has all six sections. The content is deterministic and derived from the folder contents, not from the LLM.

#### `created`, `wiki`, and `label` Fields

- `created`: ISO 8601 timestamp set when a page is first created. It is preserved on updates.
- `wiki`: The wiki slug. Every generated page must include `wiki: <slug>` in its frontmatter.
- `label`: Optional human-readable source label. Default to the PDF filename without extension, humanized (e.g., `annual-report-2024.pdf` → `"Annual Report 2024"`). The `label` field is added to the `source` page frontmatter and to the `sources` entry in document pages.

#### Disambiguation Suffix

Sprint 3 is the first sprint that writes entity pages. It must use the slugification function from Sprint 1 and detect slug collisions. When two entities would share the same slug, append an incremental integer suffix: `john-smith.md`, `john-smith-1.md`, `john-smith-2.md`. The first entity keeps the base slug.

> **Canonical name resolution** (resolving `"J. Smith"` to the same entity as `"John Smith"`) is implemented in Sprint 5; Sprint 3 only handles exact collisions on the canonical slug.

---

## 4. Project Vision References

- `Project Vision/01` §2.5: Source pages.
- `Project Vision/01` §2.6: Raw pages.
- `Project Vision/05` §4: The `document` page type.
- `Project Vision/05` §5: The `source` page type.
- `Project Vision/05` §8: The `raw` page type.
- `Project Vision/03` §3.3: Folder-level contract content.
- `Project Vision/05` §2: Common frontmatter fields (`created`, `wiki`, `tags`).
- `Project Vision/05` §3.1: The `index` page type and `children` field.
- `Project Vision/05` §6.3: Entity naming and slug conventions.
- `Project Vision/06` §3.2: Optional `label` field for sources.
- `Project Vision/07` §7: Fallback to deterministic extraction.

---

## 5. Files to Create or Modify

- `src/writers/source.ts` — source pages.
- `src/writers/raw.ts` — raw pages.
- `src/writers/document.ts` — deterministic baseline document pages.
- `src/writers/index.ts` — wiki-level and top-level index pages.
- `src/writers/config.ts` — may need updates for config handling.
- `src/commands/ingest.ts` — wire writers into the ingestion flow.
- `src/commands/ingest-all.ts` — implement `ingest-all` sequence.
- `tests/writers/source.test.ts` — new tests.
- `tests/writers/raw.test.ts` — new tests.
- `tests/writers/document.test.ts` — new tests.
- `src/utils/slug.ts` — use the slugification and disambiguation helpers from Sprint 1.
- `tests/writers/index.test.ts` — new tests (including folder-level contracts and `children`).
- `tests/commands/ingest-all.test.ts` — new tests.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. `npm run test` passes with new tests covering:
   - Every source PDF produces a `sources/<slug>.md` with valid frontmatter matching `Project Vision/05` §5, including `label`.
   - Every scanned page produces a `raw/<source>-page-<NNN>.md` with valid frontmatter matching `Project Vision/05` §8.
   - Every chunk produces a `documents/<source>-part-<NNN>.md` with valid frontmatter and extracted text.
   - The source page SHA-256 matches the file on disk.
   - All citations in a document page map to a `sources` entry with a valid file, page range, and `label`.
   - The wiki-level `index.md` lists the number of sources, document pages, and raw pages, and contains a `children` field.
   - Every folder-level `index.md` contains the six required contract sections from `Project Vision/03` §3.3.
   - Every generated page includes `wiki: <slug>` and a `created` timestamp that is preserved on updates.
   - `ingest-all` processes all wikis in the workspace and updates `index-of-indexes.md` once.
   - Entity slug collisions are resolved with incremental suffixes (`john-smith`, `john-smith-1`, ...).
3. Deterministic output matches the expected frontmatter schema from `Project Vision/05`.

---

## 7. User Acceptance Criteria (UAT)

1. After `ingest`, `output/sources/` contains one page per PDF with a SHA-256 hash and a human-readable `label`.
2. Opening a document page shows the extracted text, tables, and figure descriptions from the chunk.
3. A scanned page is represented in `output/raw/` with a note explaining it could not be parsed.
4. The wiki-level `index.md` lists the number of sources, document pages, and raw pages, and includes a `children` field.
5. Every folder-level `index.md` explains the folder's purpose, page types, naming convention, links, rules, and catalog.
6. Every generated page includes `wiki: <slug>` and a `created` timestamp.
7. The top-level `index-of-indexes.md` is created or updated in a multi-wiki workspace.
8. `ingest-all` processes every wiki in the workspace with one command and reports a summary per wiki.
9. If two entities would share the same slug, the second one is written with an incremental suffix (`john-smith-1.md`).

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 4a until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprints 1 and 2. The `init` command, extraction, chunking, and state tracking must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 3 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 4a until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 4a — Sampling Strategies & `AGENTS.md`**: `plan/Plan_implementation/sprint-04a-agents-md-sampling/instruction.md`.
