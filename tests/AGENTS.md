# tests/ — Test Suite

## Purpose

This folder contains the Vitest test suite for the LLM Wiki CLI, including unit tests, integration tests, CLI command tests, and generated PDF fixtures.

## Ownership

- **ZCode agents** add tests for new commands, modules, and LLM providers.
- **Deterministic code** owns fixture generation and test-environment setup.
- The human user decides when to run verification runs and whether E2E results are acceptable.

## Local Contracts

- Tests run with `vitest run --pool=forks --poolOptions.forks.singleFork`.
- Focused test command: `npx vitest run --pool=forks --poolOptions.forks.singleFork tests/<file>.test.ts`.
- Fixtures live in `tests/fixtures/`; include valid/bad workspaces and generated PDFs.
- Generated PDF fixtures are written by `tests/fixtures/pdf-helpers.ts` into a per-run temp directory (never into `tests/fixtures/`), so test runs do not modify the working tree. The committed PDFs under `tests/fixtures/` are static inputs for tests that reference them by path.
- E2E / verification runs must not modify source code, tests, docs, or plan files; only the E2E workspace data may change.

## Work Guidance

- Add tests for new CLI commands in `tests/` near the feature they exercise.
- Keep the full suite green after changes.
- Use the `test` LLM provider in temporary workspaces to avoid network calls.
- When creating new fixtures, reuse `pdf-helpers.ts` helpers rather than hand-writing binary files.

## Verification

- `npm run test` — run the full suite.
- A focused test file should also pass when run alone.

## Child DOX Index

No nested child docs needed.
