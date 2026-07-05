# Sprint 10 — Tests & Documentation

## Goal
Wrap the v2.0 implementation with comprehensive tests, end-to-end validation, and user-facing documentation. Ensure the CLI, orchestrator, and contracts are ready for real-world use.

## Acceptance Criteria
1. Unit tests cover chunking, contract validation, and orchestrator state management.
2. Integration tests run the sample and ingest commands on a small PDF (or mock).
3. End-to-end test verifies a multi-wiki workspace produces a valid `index-of-indexes.md`.
4. `README.md` is updated with v2.0 usage, architecture, and command reference.
5. `AGENTS.md` is updated if any new conventions or files were added.
6. `.env.example` and `package.json` scripts are updated if needed.
7. All tests pass in CI-equivalent local run.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes with 100% of tests green.
- `npm run build` succeeds.

## Validation Gate
- Reviewer confirms documentation matches the implemented behavior.
- Reviewer confirms the end-to-end test exercises sample, ingest, and wiki-of-wiki phases.

## Files to Create/Modify
- `tests/` (new or extend)
- `README.md` (update)
- `AGENTS.md` (update if needed)
- `package.json` (update scripts if needed)
- `plan/sprint-10/NOTES.md` (new)
- `plan/SPRINT_INSTRUCTIONS.md` (final status update)

## Dependencies
- Sprints 5–9 complete

## Implementation Notes
- Use a mock LLM client for deterministic tests.
- For integration tests, use a small PDF fixture or a text fixture.
- Keep the README concise but cover the new orchestrator architecture and DOX-style contracts.
