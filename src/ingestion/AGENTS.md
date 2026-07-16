# src/ingestion/ — Ingestion Engine and State

## Purpose

This folder implements the full ingestion flow, incremental state tracking, resume/re-ingest logic, and the per-chunk materializer that writes entity and topic pages incrementally.

## Ownership

- **Deterministic code** owns extraction, chunking, hashing, state persistence, and the materializer's preservation checks.
- **LLM agents** design the entity/topic update prompts and the materializer's merge strategies.
- The human user decides when to run `ingest`, `--resume`, and re-ingest.

## Local Contracts

- `engine.ts` drives the source loop and delegates per-chunk work to the orchestrator and materializer.
- `state.ts` is the source of truth for per-source SHA-256, page hashes, and the manifest used for resume and manual-edit detection.
- `refreshPageState` only re-baselines pages the system wrote in the current run (a `writtenPaths` set from the engine); a page whose content differs from its stored hash and was not written this run keeps its old baseline so the manual-edit conflict stays detectable across runs. Root-level files (`index.md`, `AGENTS.md`, `chunking-strategy.md`) and `.state/`/`lint/` are never tracked as content pages.
- `chunk-materializer.ts` immediately writes/updates affected entity/topic pages after each chunk is processed. The affected-topic set comes exclusively from LLM-planned topics (page plans + rolling memory); deterministic n-gram extraction does not decide page existence.
- The batch entity/topic writer response must contain a body (and LLM-authored `tags`, plus `related` for topics) for every requested page; a shortfall triggers one stricter repair retry naming the missing pages, then the run aborts. Nothing is silently skipped except the two sanctioned cases below.
- Preservation check: every old citation (`[^srcN]`) and wikilink (`[[...]]`) must survive an LLM rewrite; if the rewrite drops prior content, the update is skipped and the conflict is reported.
- Manually edited pages (hash mismatch with stored state) are skipped entirely; the human edit is not overwritten. There is no overwrite option. Legacy flat entity pages are checked for manual edits under their OLD path before migration, and their page state is re-keyed (`movePageState`) when moved.
- Re-ingest and resume use the per-chunk manifest in `IngestionState` to skip unchanged work.

## Work Guidance

- When adding new state fields, keep them backward-compatible or bump `STATE_VERSION`.
- When changing the materializer, update the preservation tests in `tests/ingestion/state.test.ts`.
- Ensure resume logic skips completed chunks unless the source SHA-256 changed.
- The materializer must not perform file I/O outside the writers; delegate writes to `src/entities/index.ts` and `src/topics/index.ts`.

## Verification

- `npm run build`
- `npm run test`
- Focused tests: `tests/ingestion/state.test.ts`, `tests/ingestion/resume.test.ts`, `tests/ingestion/reingest.test.ts`, `tests/ingest.test.ts`

## Child DOX Index

No nested child docs needed.
