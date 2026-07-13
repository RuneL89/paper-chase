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
- `chunk-materializer.ts` immediately writes/updates affected entity/topic pages after each chunk is processed.
- Preservation check: every old citation (`[^srcN]`) and wikilink (`[[...]]`) must survive an LLM rewrite; otherwise use deterministic append-only.
- Manually edited pages (hash mismatch with stored state) are always append-only.
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
