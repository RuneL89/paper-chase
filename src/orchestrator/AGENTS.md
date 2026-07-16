# src/orchestrator/ — Multi-Agent Orchestrator

## Purpose

This folder contains the multi-agent orchestrator that drives the `sample` and `ingest` commands. It defines the sub-agents, shared types, contracts, validation helpers, and rolling memory.

## Ownership

- **LLM agents** design and refine sub-agents, prompts, and page-planning logic.
- **Deterministic code** owns the orchestration loop, memory persistence, contract writers, and validation.

## Local Contracts

- Sub-agents live in `src/orchestrator/agents.ts` and are wired in `src/orchestrator/index.ts` (sample) and `src/orchestrator/ingest.ts` (ingest).
- The public sub-agent pipeline for `sample` is: StructureAnalyst → EntityExtractor → RelationshipExtractor → EvidenceCollector → PagePlanner → ChunkWriter → Critic.
- Every agent routed through `callAgentWithRepair` gets one JSON-repair retry then aborts, and (on Kimi) runs with `thinking: { type: "disabled" }` via `structuredOutputOptions` so thinking tokens cannot starve or truncate the JSON reply. The big body-writers (ChunkWriter, EntityTopicPageWriter) use a 32k output budget; PagePlanner and the AGENTS.md writer use 16k.
- The PagePlanner receives the chunk list and must plan a document page per chunk (`fileName` = `<chunk-id>.md`) and a non-empty `folderPlacements`; semantic gaps get one repair retry naming the problems, then abort. There is no deterministic default page plan.
- The Critic receives the FULL drafted pages (frontmatter + body), the chunk's full extracted input, and the same known-wikilink list the ChunkWriter was given (including source and index titles). After the retry loop, remaining Critic blocking issues or deterministic validation failures abort the run; unvalidated content is never committed.
- Wikilinks may use piped display text (`[[Exact Title|display]]`); validators check the target before the pipe against known titles.
- `sources.file`/`sha256` on document pages are deterministic provenance set from the chunk's extraction record (`enforceSourceProvenance`); the LLM authors the citations themselves (`id`, `pages`, and `[^srcN]` placement).
- During `ingest`, after the Critic approves a chunk, `src/ingestion/chunk-materializer.ts` updates affected entity/topic pages.
- Rolling memory is accumulated across PDFs and persisted in `.state/rolling-memory.json` and `.state/memory-summary.md`.
- Structural changes that create new folders or reorganize the wiki are applied autonomously by the LLM and recorded in a structural change log for human review. Folder removals are never inferred from omission; they are logged as "absent from the latest plan (NOT removed)".

## Work Guidance

- When adding a new sub-agent, define it in `agents.ts` and add it to the appropriate orchestrator entry point.
- Keep agent prompts focused on producing structured output that deterministic code can consume.
- Update `src/orchestrator/types.ts` when shared memory or plan types change.
- Changes to the sub-agent pipeline should be reflected in `Project Vision/04_orchestration_detailed.md`.

## Verification

- `npm run build`
- `npm run test`
- Focused tests: `tests/orchestrator/*.test.ts`

## Child DOX Index

No nested child docs needed.
