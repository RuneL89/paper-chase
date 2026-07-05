# Sprint 9 — Wiki-of-Wiki Agent & Validation

## Goal
Implement the Wiki-of-Wiki agent. After one or more wikis are ingested, this agent reads every wiki-level `index.md` and maintains the root `index-of-indexes.md` contract, enabling cross-document connection discovery.

## Acceptance Criteria
1. A new command or automatic phase runs the Wiki-of-Wiki agent after ingestion.
2. The agent reads all `wikis/<slug>/index.md` files in the workspace.
3. The agent produces/updates `index-of-indexes.md` in the workspace root.
4. `index-of-indexes.md` frontmatter includes `type: "index-of-indexes"`, `updated`, `children`.
5. The agent identifies cross-wiki entities, relationships, and topics and links them.
6. The agent is lightweight; it does not re-read full PDFs or full page bodies.
7. Validation: deterministic checks verify every generated `index.md` and `index-of-indexes.md` matches the schema.
8. Validation: schema validation checks YAML frontmatter.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes.
- Wiki-of-Wiki agent runs on a workspace with multiple wikis.

## Validation Gate
- Reviewer confirms `index-of-indexes.md` is a valid root DOX contract.
- Reviewer confirms cross-wiki connections are surfaced and linkable.

## Files to Create/Modify
- `src/orchestrator/wiki-of-wiki.ts` (new)
- `src/orchestrator/validation.ts` (extend)
- `src/cli.ts` (add command if needed)
- `plan/sprint-9/NOTES.md` (new)

## Dependencies
- Sprint 8 complete
- Contract schemas from Sprint 5
- Multiple test wikis for cross-document validation

## Implementation Notes
- The wiki-of-wiki agent should only read index files (root and per-wiki), not page bodies, to stay efficient.
- It can use the LLM to summarize and find connections, but should keep the prompt small by only passing index metadata.
- Update `index-of-indexes.md` incrementally: only rewrite when a wiki is added or a structural change is accepted.
