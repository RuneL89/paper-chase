# tests/ — DOX contract

## Purpose

Vitest suites for LLM Wiki CLI v2.0. Each phase's technical gates are encoded as tests here; `npm test` is the phase acceptance check.

## Ownership

* `infrastructure.test.ts` — Phase 0 gates 0.1–0.5 (extraction, page ranges, hashing, LLM cost logging, CLI commands)
* `tui/menu.test.tsx` — Phase 0 gates 0.6–0.8 (TUI render, menu options, navigation); gate 0.7's "menu shows all 5 options" superseded 2026-07-17 by the user-directed 6-item menu (`add-pdfs` added; deviation logged in `.state/phase-1-status.json`), then grown to 7 items in Phase 2 ('Test Extractor' after 'Ingest PDFs', phase doc §5.2), then 9 items in Phase 3 ('Browse Entities' and 'Browse Topics' added after 'Add PDFs'), then 10 items in Phase 4 ('View Validation Report' added after 'Add PDFs'), then 11 items in Phase 5 ('Browse DOX Contracts' added after 'Browse Topics')
* `tui/test-screen-spawn.test.tsx` — Phase 0 regression test (UAT 0.2 fix, commit 86633e8): `test` command spawns npm via shell on Windows (EINVAL guard)
* `phase-01.test.ts` — Phase 1 gates 1.1–1.9 (init structure, document pages, frontmatter, source-page hash, idempotency, state) plus supplementary tests for chunking, placeholders, warnings, stale-chunk cleanup; runs hermetically against a temp workspace via the `workspace` option; all `ingest` calls pass `extract: false` (Phase 2 deviation: Phase 1 gates are Layer-1 tests and must stay key-less and $0)
* `phase-02.test.ts` — Phase 2 gates 2.1–2.12 (Extractor JSON schema, known entities, deterministic slugs, valid folders, claims with pages, `.state/extracted/` persistence, empty input, rolling memory, timeline, context, significance, disambiguation); the 12 gates are LIVE LLM tests (`test.skipIf(!process.env.ANTHROPIC_API_KEY)`, 120s timeouts; the file loads the project-root `.env` so skipIf mirrors the client's key resolution; gate 2.6 hermetic temp workspace) plus deterministic LLM-free suites (schema validator cases, slug normalization, JSON parse/ExtractorError, rolling-memory reader, ingest `extract: false`)
* `phase-03.test.ts` — Phase 3 gates 3.1–3.8 (Materializer creates entity pages, valid frontmatter, all mentions, citations, dynamic folders, topic pages, rolling memory, re-ingest updates); deterministic and LLM-free via fake `.state/extracted/*.json` fixtures in temp workspaces, plus a supplementary test that ingest with `extract: false` preserves materialized pages
* `phase-04.test.ts` — Phase 4 gates 4.1–4.6 (link checker, broken links, citation checker, schema validator, orphaned pages, validation logged); deterministic and LLM-free via temp workspaces and an injected `extractChunkFn` for the ingest integration test
* `tui/extractor-test-screen.test.tsx` — Phase 2 §5 TUI tests: wiki/chunk selectors, run flow, results panel (counts, entities, save path), scrollable JSON viewer, Escape chain, non-TTY fallback; `extractChunkFn` stub-injected so tests never call the LLM
* `tui/entity-browser.test.tsx` — Phase 3 §5.1 TUI tests: entity folder tree render, folder expansion, file viewer, Escape chain, non-TTY static fallback
* `tui/topic-browser.test.tsx` — Phase 3 §5.2 TUI tests: topic folder tree render, folder expansion, file viewer, Escape chain, non-TTY static fallback
* `phase-05.test.ts` — Phase 5 gates 5.1–5.6 (every folder has `index.md`, `index.md` lists children, wiki-level `index.md` links to top four folders, valid YAML frontmatter, accurate statistics, re-ingest regeneration); deterministic and LLM-free via temp workspaces and an injected `extractChunkFn` for the ingest integration test
* `tui/dox-browser.test.tsx` — Phase 5 §5.1 TUI tests: DOX contract tree render, index.md viewer, content page viewer, Escape chain, non-TTY static fallback; stubs disk operations in temp workspaces so tests remain LLM-free
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

* `npm test` green in both modes: without a key — 134 passed + 13 self-skipped (12 live Phase 2 gates + Phase 0 gate 0.4); with the key (`.env` at project root) — 146 passed + 1 skipped (gate 0.4 keeps its Phase 0 exported-var-only behavior, verified separately 5/5)

## Child DOX Index

* `tui/` — TUI component tests (covered by this file's contracts; no separate child doc yet)
