# Sprint 7 Validation Notes

**Sprint:** 7 — Sample Orchestrator & Index.md Contracts  
**Date:** 2026-07-06  
**Status:** COMPLETE

## Acceptance Criteria Checklist

| # | Criterion | Result |
|---|---|---|
| 1 | `sample` command invokes the custom orchestrator | PASS |
| 2 | Orchestrator runs all seven sub-agents | PASS |
| 3 | Orchestrator produces a wiki-level `index.md` contract | PASS |
| 4 | Orchestrator produces folder-level `index.md` contracts | PASS |
| 5 | Rolling memory is created and updated | PASS |
| 6 | Critic deterministic validation runs | PASS |
| 7 | `chunking-strategy.md`, `config.json`, and first document pages still produced | PASS |
| 8 | `npm run build` and `npm run test` pass | PASS |

## Technical Gate

- `tsc --noEmit` passes.
- `npm test` passes (58 tests before new folder-index test, 59 after).

## Validation Gate

- Reviewed sample output: `wikis/acme/index.md` and folder-level `documents/index.md`, `sources/index.md`, etc. are created.
- Critic review produces no high-severity issues for valid PDFs.
- Tests updated to expect `index.md` instead of `AGENTS.md` and to verify folder-level indexes.

## Notes

- The config schema key was renamed from `schema.agents_md` to `schema.wiki_index_md` to reflect the new contract file.
- The orchestrator module lives in `src/orchestrator/` and is reused by both `sample` and `ingest` commands.
- No LLM calls are made in the test suite; the orchestrator falls back to deterministic defaults when the LLM client is disabled.
