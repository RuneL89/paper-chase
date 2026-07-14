# src/ — Source Code

## Purpose

This folder contains the LLM Wiki CLI source code: the Commander entry point, command implementations, PDF extraction, chunking, ingestion orchestration, LLM client abstraction, page writers, entity/topic handling, lint, TUI, and supporting utilities.

## Ownership

- **LLM agents** design and draft new modules, agent prompts, page writers, and command flows.
- **Deterministic code** owns extraction, hashing, file I/O, validation, state management, and orchestration wiring.
- **Human user** approves structural changes and decides when to run commands.

## Local Contracts

- All source files are TypeScript 5.5+ with `strict` enabled and `NodeNext` module resolution.
- Every ESM import path must end in `.js`, even from `.ts` source files.
- Use `path.join` / `path.resolve` for filesystem paths and `toRelativePath` from `workspace.ts` for stored relative paths (forward slashes).
- Deterministic code must not draft or mutate wiki page bodies; the LLM is the sole author of markdown content.
- No raw PDF bytes are passed to the LLM; only extracted text and metadata.
- No LLM agent may compute SHA-256 hashes or perform file I/O directly.
- `CLIError` is used for user-facing failures; unexpected errors bubble to `main()` and exit non-zero.

## Work Guidance

- Add new CLI commands by registering them in `src/cli.ts` and implementing the handler in `src/commands/`.
- Add new LLM providers in `src/llm/` with an adapter that matches the existing client interface.
- Instrument long-running operations with `ProgressReporter` from `src/progress/`; do not change existing return values.
- Keep the TUI in `src/tui/` thin: it delegates to command functions and may use deterministic workspace helpers for lightweight read-only UI state; it must not compute hashes or do I/O directly.
- When extending the orchestrator, prefer adding agents or helpers in `src/orchestrator/agents.ts` and wiring them in `src/orchestrator/ingest.ts` or `src/orchestrator/index.ts`.
- When modifying ingestion state, update `src/ingestion/state.ts` and keep resume/re-ingest logic in sync.

## Verification

- `npm run build` — compile with `tsc` and catch type errors.
- `npm run test` — run the full Vitest suite.
- For focused testing: `npx vitest run --pool=forks --poolOptions.forks.singleFork tests/<file>.test.ts`.

## Child DOX Index

- `src/orchestrator/AGENTS.md` — multi-agent orchestrator and sub-agent pipeline.
- `src/ingestion/AGENTS.md` — ingestion engine, incremental state, resume, and per-chunk materialization.
