# tests/ — DOX contract

## Purpose

Vitest suites for LLM Wiki CLI v2.0. Each phase's technical gates are encoded as tests here; `npm test` is the phase acceptance check.

## Ownership

* `infrastructure.test.ts` — Phase 0 gates 0.1–0.5 (extraction, page ranges, hashing, LLM cost logging, CLI commands)
* `tui/menu.test.tsx` — Phase 0 gates 0.6–0.8 (TUI render, menu options, navigation); gate 0.7's "menu shows all 5 options" superseded 2026-07-17 by the user-directed 6-item menu (`add-pdfs` added; deviation logged in `.state/phase-1-status.json`)
* `tui/test-screen-spawn.test.tsx` — Phase 0 regression test (UAT 0.2 fix, commit 86633e8): `test` command spawns npm via shell on Windows (EINVAL guard)
* `phase-01.test.ts` — Phase 1 gates 1.1–1.9 (init structure, document pages, frontmatter, source-page hash, idempotency, state) plus supplementary tests for chunking, placeholders, warnings, stale-chunk cleanup; runs hermetically against a temp workspace via the `workspace` option
* `tui/phase-01-screens.test.tsx` — Phase 1 §5.4 TUI tests (init form fields, wiki list) plus end-to-end form/ingest flows on a fake-TTY harness; uses temp workspaces via the screens' optional `workspace`/`defaultWorkspace` props
* `tui/add-pdfs-screen.test.tsx` — user-directed Phase 1 extension tests (2026-07-17): Add PDFs screen render, wiki list, live raw/ contents, interactive select-and-paste flow (kept working after the 10:55 redesign — typing auto-focuses the fallback manual input), missing-file error path, Escape contract (input → selector → menu), non-TTY static fallback (renders both add controls), plus `addPdfToWiki` unit tests (byte-identical copy of the golden master via `sha256`, quote/whitespace stripping, missing file, non-PDF rejection, paths with spaces); hermetic temp workspaces. The 2026-07-17 10:55 refinement adds native-picker tests with an injected `pickFiles` stub (never the real dialog): Browse button is the primary default-focused control, batch add summarizes "Added N file(s)", cancel is neutral ("No files selected."), picker failure points at manual entry, mixed results count successes and report per-file failures
* `file-dialog.test.ts` — user-directed Phase 1 refinement tests (2026-07-17 10:55): pure `parseDialogOutput` unit tests (single/multiple paths, `\r\n` and LF handling, empty output → `[]`, paths with spaces, blank-line skipping). `pickPdfFiles` itself spawns the real Windows OpenFileDialog and is exercised by user UAT only — automated tests must never spawn the dialog

## Local Contracts

* Every test must trace to a numbered gate or requirement in a phase document; when a gate's literal test code cannot run on this platform, the restructured test must still verify the gate's pass criterion and the deviation must be recorded in `.state/phase-N-status.json`
* Tests must not make live LLM calls by default; live-call tests use `test.skipIf(!process.env.ANTHROPIC_API_KEY)` and are run deliberately with the key loaded
* Tests must not modify `test-pdfs/golden-master.pdf` (see `test-pdfs/AGENTS.md`)
* Ink 7 non-TTY harness conventions: capture frames via fake stdout and assert after `unmount()`; drive input via fake-TTY stdin (PassThrough with `isTTY`/`setRawMode` stubs); render `TestScreen` with `autoRun=false` so tests never spawn `npm test` recursively

## Work Guidance

* Platform is Windows/Git Bash: shellout assertions need fallbacks (e.g. `shasum` → `certutil` → `node:crypto`)

## Verification

* `npm test` green (57 total: 56 passed + 1 self-skipped live LLM test without `ANTHROPIC_API_KEY`; the live test runs when the key is loaded)

## Child DOX Index

* `tui/` — TUI component tests (covered by this file's contracts; no separate child doc yet)
