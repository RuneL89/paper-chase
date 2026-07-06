# Sprint 9 Validation Notes

**Sprint:** 9 — Wiki-of-Wiki Agent & Validation  
**Date:** 2026-07-06  
**Status:** COMPLETE

## Acceptance Criteria Checklist

| # | Criterion | Result |
|---|---|---|
| 1 | `index-of-indexes.md` is generated at the workspace root and lists every wiki with slug, title, source count, page count, and scope | PASS |
| 2 | The wiki-of-wiki agent runs after each `ingest` and after `ingest-all`, updating `index-of-indexes.md` without reprocessing PDFs | PASS |
| 3 | Cross-wiki entity/topic names are surfaced with links to each wiki's page; no cross-wiki entity merging occurs | PASS |
| 4 | A deterministic validator checks YAML frontmatter, citation source resolution, and wikilink existence | PASS |
| 5 | Validation results are written to the wiki-level `index.md` and to run logs | PASS |
| 6 | `npm run build` and `npm run test` pass | PASS |

## Technical Gate

- `tsc --noEmit` passes.
- `npm test` passes (60 tests).

## Validation Gate

- Reviewed `index-of-indexes.md` output: cross-wiki section lists shared entity/topic names with wiki links.
- Deterministic lint module in `src/lint/index.ts` validates frontmatter, citations, and wikilinks.
- Lint report is written to `output/lint/report.json` and surfaced in run logs.

## Notes

- `src/orchestrator/wiki-of-wiki.ts` implements the cross-wiki name discovery agent.
- `src/writers/index.ts` `writeIndexOfIndexes` now accepts cross-wiki names and renders a `## Cross-Wiki Names` section.
- The agent is triggered from both `src/ingestion/engine.ts` and `src/commands/ingest-all.ts` so the top-level index is always current.
- No LLM is required for the wiki-of-wiki agent; it operates deterministically by reading entity/topic page titles across wikis.
