# tests/ — DOX contract

## Purpose

Vitest suites for LLM Wiki CLI v2.0. Each phase's technical gates are encoded as tests here; `npm test` is the phase acceptance check.

## Ownership

* `infrastructure.test.ts` — Phase 0 gates 0.1–0.5 (extraction, page ranges, hashing, LLM cost logging, CLI commands)
* `tui/menu.test.tsx` — Phase 0 gates 0.6–0.8 (TUI render, menu options, navigation)

## Local Contracts

* Every test must trace to a numbered gate or requirement in a phase document; when a gate's literal test code cannot run on this platform, the restructured test must still verify the gate's pass criterion and the deviation must be recorded in `.state/phase-N-status.json`
* Tests must not make live LLM calls by default; live-call tests use `test.skipIf(!process.env.ANTHROPIC_API_KEY)` and are run deliberately with the key loaded
* Tests must not modify `test-pdfs/golden-master.pdf` (see `test-pdfs/AGENTS.md`)
* Ink 7 non-TTY harness conventions: capture frames via fake stdout and assert after `unmount()`; drive input via fake-TTY stdin (PassThrough with `isTTY`/`setRawMode` stubs); render `TestScreen` with `autoRun=false` so tests never spawn `npm test` recursively

## Work Guidance

* Platform is Windows/Git Bash: shellout assertions need fallbacks (e.g. `shasum` → `certutil` → `node:crypto`)

## Verification

* `npm test` green (10/10 with `ANTHROPIC_API_KEY` loaded; live test self-skips without it)

## Child DOX Index

* `tui/` — TUI component tests (covered by this file's contracts; no separate child doc yet)
