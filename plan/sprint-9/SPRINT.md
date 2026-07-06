# Sprint 9 — Wiki-of-Wiki Agent & Validation

## Goal
Implement the wiki-of-wiki agent that maintains the top-level `index-of-indexes.md`, surfaces cross-wiki entity and topic names, and run deterministic validation (frontmatter, citations, wikilinks) across the workspace.

## Acceptance Criteria
1. `index-of-indexes.md` is generated at the workspace root and lists every wiki with slug, title, source count, page count, and scope.
2. The wiki-of-wiki agent runs after each `ingest` and after `ingest-all`, updating `index-of-indexes.md` without reprocessing PDFs.
3. Cross-wiki entity/topic names are surfaced with links to each wiki’s page; no cross-wiki entity merging occurs.
4. A deterministic validator checks YAML frontmatter, citation source resolution, and wikilink existence.
5. Validation results are written to the wiki-level `index.md` and to run logs.
6. `npm run build` and `npm run test` pass.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes (or no tests are broken).

## Validation Gate
- Reviewer confirms `index-of-indexes.md` is generated correctly after `ingest-all` on the test wiki.
- Reviewer confirms cross-wiki name surfacing works.
- Reviewer confirms the validator catches broken citations and wikilinks.

## Files to Create/Modify
- `src/orchestrator/wiki-of-wiki.ts` (new) — wiki-of-wiki agent
- `src/writers/index-of-indexes.ts` (new or extend from `src/writers/index.ts`)
- `src/lint/index.ts` (modify/extend) — deterministic validator
- `src/commands/ingest.ts` (modify) — trigger wiki-of-wiki agent
- `src/commands/ingest-all.ts` (modify) — trigger wiki-of-wiki agent
- `tests/sprint4.test.ts` (modify/extend or create new sprint9 tests)
- `tests/lint.test.ts` (create if needed)

## Dependencies
- Sprint 5 (Custom Orchestrator Skill & Contracts) — COMPLETE.
- Sprint 8 (Ingest Orchestrator & Dynamic Hierarchy) — COMPLETE.
- FRD v2.0 requirements FR-004, FR-024, FR-023, FR-014, FR-015, FR-016, FR-019, FR-025.

## Implementation Notes
- Reuse the existing `writeIndexOfIndexes()` writer and extend it to cross-wiki name surfacing.
- The validator should be deterministic and not require an LLM.
- Lint output should be stored in `wikis/<slug>/output/lint/report.json` as already implemented.
- Cross-wiki surfacing is name-based only; keep per-wiki entity resolution separate.
