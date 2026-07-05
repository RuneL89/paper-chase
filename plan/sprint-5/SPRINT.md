# Sprint 5 — Custom Orchestrator Skill & Contracts

## Goal
Deliver the custom orchestrator skill that governs the LLM Wiki CLI v2.0 architecture. Establish the DOX-inspired contract file conventions and the `index-of-indexes.md` / `index.md` contract schemas so every later sprint operates within a single, consistent methodology.

## Acceptance Criteria
1. `.zcode/skills/llm-wiki-orchestrator/SKILL.md` exists and is tailored to the LLM Wiki CLI.
2. The skill defines the complete orchestrator loop: Phase 0 skipped, Phase 1 (planning), Phase 2 (sequential sprints), Phase 3 (validation), Phase 4 (documentation).
3. The skill specifies the seven sub-agents: StructureAnalyst, EntityExtractor, RelationshipExtractor, EvidenceCollector, PagePlanner, ChunkWriter, Critic.
4. The skill defines the `index-of-indexes.md` root contract and folder-level `index.md` child contracts, including the YAML frontmatter schema.
5. The skill defines rolling memory format: compressed summary + structured state object.
6. The skill defines the validation order: Critic → deterministic checks → schema validation.
7. The skill defines the human-in-the-loop structural change proposal format with pros/cons and restart on accept.
8. The `plan/sprint-5` directory contains the skill file and any validation notes.

## Technical Gate
- `tsc --noEmit` passes for all files touched.
- `npm test` passes (or no tests are broken).

## Validation Gate
- Reviewer confirms the skill is self-contained and consistent with FRD.
- Reviewer confirms the contract schemas are valid YAML frontmatter.

## Files to Create/Modify
- `.zcode/skills/llm-wiki-orchestrator/SKILL.md` (new)
- `plan/sprint-5/NOTES.md` (new)
- `plan/SPRINT_INSTRUCTIONS.md` (update status)

## Dependencies
- FRD v2.0

## Implementation Notes
- Keep the skill file as a standalone markdown document; it is both documentation and the agent's instruction set.
- Use exact file paths and schemas from the FRD.
- Do not implement sample/ingest logic here; this sprint is purely the skill and contracts.
