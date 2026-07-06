# Sprint 8 — Ingest Orchestrator & Dynamic Hierarchy

## Goal
Wire the custom orchestrator into the `ingest` command so that the full corpus is processed sequentially chunk-by-chunk, maintaining rolling memory, producing a dynamic folder hierarchy, and surfacing structural change proposals when the corpus does not fit the existing structure.

## Acceptance Criteria
1. `src/ingestion/engine.ts` calls the orchestrator for each changed source PDF.
2. The orchestrator processes chunks sequentially and maintains rolling memory between chunks.
3. The orchestrator produces `document`, `source`, `topic`, `entity`, and `raw` pages into the dynamic folder hierarchy.
4. Folder-level `index.md` files are created or updated for every folder that receives pages.
5. Wiki-level `index.md` is updated with the new catalog and navigation.
6. Every `document` page contains `[^srcN]` citations mapped to YAML `sources` frontmatter.
7. Structural change proposals are surfaced when the corpus cannot fit the existing hierarchy; on acceptance, the contracts and hierarchy are updated and ingestion restarts.
8. Incremental updates still work: only changed PDFs are re-processed unless a structural restart is required.
9. `npm run build` and `npm run test` pass.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes (or no tests are broken).

## Validation Gate
- Reviewer confirms `ingest` processes all PDFs in the test wiki without crash.
- Reviewer confirms the output contains a dynamic hierarchy with folder-level `index.md` files.
- Reviewer confirms citations and wikilinks are valid.
- Reviewer confirms incremental re-run only affects changed files.

## Files to Create/Modify
- `src/orchestrator/ingest.ts` (new) — `runIngestOrchestrator()` entry point
- `src/orchestrator/agents.ts` (extend) — prompts for all seven sub-agents
- `src/orchestrator/memory.ts` (extend) — rolling memory persistence
- `src/orchestrator/validation.ts` (extend) — Critic and deterministic checks
- `src/ingestion/engine.ts` (modify)
- `src/ingestion/state.ts` (modify) — persist orchestrator rolling memory
- `src/commands/ingest.ts` (modify if needed)
- `src/writers/` (modify as needed for dynamic hierarchy)
- `tests/ingest.test.ts` (modify/extend)

## Dependencies
- Sprint 5 (Custom Orchestrator Skill & Contracts) — COMPLETE.
- Sprint 6 (Extraction & Chunking Refactor) — COMPLETE.
- Sprint 7 (Sample Orchestrator & Index.md Contracts) — COMPLETE.
- FRD v2.0 requirements FR-010, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-023, FR-025.

## Implementation Notes
- Reuse the existing extraction, chunking, state, and writer modules.
- Rolling memory should be persisted to the wiki’s `ingest-state.json` so it survives restarts.
- The dynamic folder hierarchy should be driven by the `PagePlanner` sub-agent but constrained by the existing structure.
- Structural change proposals should be returned as a special object from the orchestrator; the command layer should pause and prompt the user.

