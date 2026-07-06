# Sprint 8 Validation Notes

**Sprint:** 8 — Ingest Orchestrator & Dynamic Hierarchy  
**Date:** 2026-07-06  
**Status:** COMPLETE

## Acceptance Criteria Checklist

| # | Criterion | Result |
|---|---|---|
| 1 | `src/ingestion/engine.ts` calls the orchestrator for each changed source PDF | PASS |
| 2 | Orchestrator processes chunks sequentially and maintains rolling memory between chunks | PASS |
| 3 | Orchestrator produces document, source, topic, entity, and raw pages into the dynamic folder hierarchy | PASS |
| 4 | Folder-level `index.md` files are created or updated for every folder that receives pages | PASS |
| 5 | Wiki-level `index.md` is updated with the new catalog and navigation | PASS |
| 6 | Every document page contains `[^srcN]` citations mapped to YAML `sources` frontmatter | PASS |
| 7 | Structural change proposals are detected and surfaced | PASS (logged; auto-accepted in this implementation) |
| 8 | Incremental updates still work: only changed PDFs are re-processed | PASS |
| 9 | `npm run build` and `npm run test` pass | PASS |

## Technical Gate

- `tsc --noEmit` passes.
- `npm test` passes (59 tests).

## Validation Gate

- Reviewed ingest output on test fixtures: dynamic folder hierarchy contracts exist for populated folders.
- Rolling memory is persisted in `output/.state/ingest-state.json`.
- Incremental re-run tests confirm unchanged PDFs are skipped.

## Notes

- `src/orchestrator/ingest.ts` was created to run the orchestrator during full ingestion and to write the dynamic hierarchy contracts.
- Rolling memory is persisted across runs via the `memory` field in `IngestionState`.
- Structural change proposals are detected and logged; the current implementation auto-accepts them to keep the CLI non-interactive. A future enhancement could add an interactive prompt or `--yes` flag.
- Document, source, topic, entity, and raw pages continue to use the existing deterministic writers, now guided by the orchestrator's folder plan.
