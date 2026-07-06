# Sprint 7 — Sample Orchestrator & Index.md Contracts

## Goal
Wire the custom orchestrator’s seven sub-agents into the `sample` command so that a single representative PDF can bootstrap a wiki with a valid wiki-level `index.md`, at least one folder-level `index.md`, and all required artifacts.

## Acceptance Criteria
1. `src/commands/sample.ts` calls the orchestrator after extraction and chunking.
2. The orchestrator runs the seven sub-agents (`StructureAnalyst`, `EntityExtractor`, `RelationshipExtractor`, `EvidenceCollector`, `PagePlanner`, `ChunkWriter`, `Critic`) on the sample document.
3. The orchestrator produces a valid wiki-level `wikis/<slug>/index.md` contract with the correct YAML frontmatter and sections.
4. The orchestrator produces at least one valid folder-level `wikis/<slug>/<folder>/index.md` contract.
5. `sample` still writes `chunking-strategy.md`, `config.json`, document/source/raw pages, and sets `status: "ready"`.
6. The generated contracts are consistent with the FRD schemas and the custom orchestrator skill.
7. `npm run build` and `npm run test` pass.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes (or no tests are broken).

## Validation Gate
- Reviewer confirms `sample` produces a wiki-level `index.md` and a folder-level `index.md`.
- Reviewer confirms the frontmatter is valid YAML and matches the FRD schema.
- Reviewer confirms the seven sub-agents are invoked in the correct order.

## Files to Create/Modify
- `src/orchestrator/` (new directory)
  - `index.ts` — orchestrator entry point for `sample`
  - `agents.ts` — seven sub-agent prompts and parsers
  - `memory.ts` — rolling memory types and update functions
  - `contracts.ts` — index contract writers
  - `validation.ts` — orchestrator validation helpers
- `src/commands/sample.ts` (modify)
- `src/writers/index.ts` (modify to write wiki-level `index.md` at the correct path)
- `src/writers/` — add or modify folder-level index writer
- `tests/sample.test.ts` (modify/extend)

## Dependencies
- Sprint 5 (Custom Orchestrator Skill & Contracts) — COMPLETE.
- Sprint 6 (Extraction & Chunking Refactor) — COMPLETE.
- FRD v2.0 requirements FR-005, FR-006, FR-007, FR-008, FR-009, FR-002, FR-003, FR-013, FR-023.

## Implementation Notes
- Reuse existing extraction, chunking, and writers.
- The orchestrator should be a thin layer that calls the LLM client for sub-agent reasoning and then uses existing writers to materialize pages.
- Keep the sample command flow: extract → chunk → write strategy → run orchestrator → write config → finalize.
- Do not create a per-wiki `AGENTS.md`; the wiki-level `index.md` replaces it.
