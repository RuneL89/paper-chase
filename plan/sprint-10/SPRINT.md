# Sprint 10 — Tests & Documentation

## Goal
Finalize the test suite, user-facing documentation, and developer documentation so the project is complete, well-tested, and usable by end users and contributors.

## Acceptance Criteria
1. All Vitest tests pass (`npm run test`).
2. Test coverage includes the happy path, missing config, malformed PDF, scanned page, incremental update, structural change acceptance/rejection, and broken citation/wikilink detection.
3. `AGENTS.md` is created from scratch, reflecting the current project conventions and architecture.
4. `README.md` is created from scratch using `AGENTS.md` and `C:\Users\atavi\Projects\Wiki v4\.kimi-code\FRD.md` as context, with the following sections in order:
   1. Introduction / elevator pitch
   2. End-user friendly functional architecture
   3. Step-by-step app flow & orchestration (agent pipeline, rejection loops, rejection criteria) for a mid-level developer
   4. Detailed technical architecture for a senior developer
   5. Project structure with every folder and file described
5. `docs/QUICKSTART.md` and `docs/USAGE.md` are updated to match the implemented commands and workflows.
6. `.env.example` is updated with any relevant environment variables.
7. Every command produces a JSON run log in `.kimi-code/logs/`.
8. `npm run build` passes.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes.

## Validation Gate
- Reviewer confirms the README is complete and follows the required five-section structure.
- Reviewer confirms all tests pass.
- Reviewer confirms the docs are accurate and helpful.

## Files to Create/Modify
- `AGENTS.md` (create from scratch)
- `README.md` (create from scratch)
- `docs/QUICKSTART.md` (update)
- `docs/USAGE.md` (update)
- `.env.example` (update)
- `tests/*.test.ts` (extend/modify as needed)
- `src/log.ts` (verify run logs are produced for every command)

## Dependencies
- All previous sprints (5–9) — COMPLETE.
- FRD v2.0 requirements QA-001 through QA-013, FR-020, FR-021, FR-022, NF-009, NF-016.

## Implementation Notes
- Do not hardcode secrets in any documentation.
- The README should be readable by end users in sections 1–2 and by developers in sections 3–5.
- Keep `AGENTS.md` focused on coding conventions, architecture, and commands for developers working in this repo.
- Update `docs/QUICKSTART.md` for a beginner and `docs/USAGE.md` for detailed command reference.
