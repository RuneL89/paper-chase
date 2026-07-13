# src/orchestrator/ — Multi-Agent Orchestrator

## Purpose

This folder contains the multi-agent orchestrator that drives the `sample` and `ingest` commands. It defines the sub-agents, shared types, contracts, validation helpers, and rolling memory.

## Ownership

- **LLM agents** design and refine sub-agents, prompts, and page-planning logic.
- **Deterministic code** owns the orchestration loop, memory persistence, contract writers, and validation.

## Local Contracts

- Sub-agents live in `src/orchestrator/agents.ts` and are wired in `src/orchestrator/index.ts` (sample) and `src/orchestrator/ingest.ts` (ingest).
- The public sub-agent pipeline for `sample` is: StructureAnalyst → EntityExtractor → RelationshipExtractor → EvidenceCollector → PagePlanner → ChunkWriter → Critic.
- During `ingest`, after the Critic approves a chunk, `src/ingestion/chunk-materializer.ts` updates affected entity/topic pages.
- Rolling memory is accumulated across PDFs and persisted in `.state/rolling-memory.json` and `.state/memory-summary.md`.
- Structural proposals that create new folders or change the wiki organization require human approval.

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
