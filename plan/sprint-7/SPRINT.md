# Sprint 7 — Sample Orchestrator & Index.md Contracts

## Goal
Implement the `sample` command orchestrator. When `--sample` is run, after the general chunking strategy is produced, the LLM performs a deep analysis of the document using sub-agents. Based on that analysis, the LLM writes the wiki-level `index.md` contract and the initial folder hierarchy. Each folder's `index.md` acts as a child contract for that branch.

## Acceptance Criteria
1. The `sample` command runs the orchestrator with the seven sub-agents.
2. Sub-agents operate on chunks sequentially with rolling memory.
3. The orchestrator produces a document-analysis artifact in `.kimi-code/sample-analysis.md`.
4. The orchestrator creates the wiki workspace: `wikis/<slug>/index.md` and at least one dynamic folder with its own `index.md`.
5. Wiki-level `index.md` frontmatter uses the schema from the FRD with `type: "index"`, `wiki`, `updated`, `children`.
6. Folder-level `index.md` frontmatter uses the schema with `type: "index"`, `wiki`, `parent`, `children`.
7. The orchestrator writes `chunking-strategy.md` before the deep analysis if it does not exist.
8. Structural change proposals are surfaced in a human-readable format with pros/cons and pause ingestion until accepted.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes.
- Sample command completes on a test PDF without errors.

## Validation Gate
- Reviewer confirms the wiki-level `index.md` is a valid DOX child contract.
- Reviewer confirms folder-level `index.md` files are valid child contracts.
- Reviewer confirms no per-wiki AGENTS.md is created (only index.md contracts).

## Files to Create/Modify
- `src/orchestrator/` directory (new)
- `src/orchestrator/index.ts` (new)
- `src/orchestrator/agents.ts` (new)
- `src/orchestrator/memory.ts` (new)
- `src/orchestrator/contracts.ts` (new)
- `src/commands/sample.ts` (modify)
- `plan/sprint-7/NOTES.md` (new)

## Dependencies
- Sprint 6 complete
- LLM client with Kimi support
- Custom orchestrator skill

## Implementation Notes
- Rolling memory = compressed summary of previous chunks + structured state object (entities, relationships, open questions, evidence).
- The orchestrator should not run sub-agents in parallel; it is sequential per chunk.
- For the sample phase, the document-analysis may be on a single representative chunk or multiple chunks depending on size; the orchestrator decides based on chunking strategy.
