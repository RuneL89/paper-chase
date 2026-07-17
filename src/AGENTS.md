# src/ — DOX contract

## Purpose

All TypeScript source for LLM Wiki CLI v2.0: CLI entry point, TUI (Ink), PDF extraction, LLM client, utilities, and (in later phases) commands, state, and agents.

## Ownership

* `cli.ts` — Commander entry point; named `program` export; `program.parse()` only runs when executed directly (guarded), never on import
* `tui/` — Ink TUI: `app.tsx` (screen router), `menu.tsx` (6-item main menu + exported `resolveMenuSelection`), screen per command (`init-screen.tsx`, `ingest-screen.tsx`, `add-pdfs-screen.tsx` — user-directed 2026-07-17 extension that copies PDFs into `raw/`; primary control is the native graphical picker via `pickFiles` (default `pickPdfFiles`, injectable for tests), manual path input is the demoted fallback), `components/` (header, footer, spinner, error-box, success-box), `hooks/use-wiki-list.ts`, `hooks/use-wiki-details.ts`, `hooks/use-raw-contents.ts`
* `extraction/pdf.ts` — `extractText(pdfPath, startPage?, endPage?)` via pdfjs-dist legacy build; never splits a page; additive Phase 1 `getPageCount(pdfPath)` shares the same loader
* `extraction/markdown-tables.ts` — deterministic plaintext-table detection; rebuilds markdown tables from whitespace-collapsed extraction output (conservative guards, every word preserved)
* `llm/client.ts` — `callLLM(prompt, system?)`; Anthropic Messages API; logs `LLM Call | Tokens: i/o | Cost: $x` for every call; no retries, throws on failure
* `utils/hash.ts` — `sha256(filePath)` streaming helper
* `utils/slug.ts` — wiki-slug validation (kebab-case) and source-slug derivation from PDF file names
* `utils/paths.ts` — workspace/wiki path helpers; generated paths always use forward slashes
* `utils/file-dialog.ts` — native graphical PDF picker (user decision 2026-07-17 10:55): `pickPdfFiles()` spawns `powershell.exe -NoProfile -NonInteractive -Command <script>` (`shell: false`, args array only) showing a topmost System.Windows.Forms OpenFileDialog (PDF filter, multi-select, 10-minute timeout); resolves with the picked paths, `null` on cancel, throws descriptively on spawn/non-zero-exit/timeout; `parseDialogOutput(stdout)` is the pure `\r\n`-safe parser exported for tests
* `commands/init.ts` — Phase 1 `init(slug, { title?, workspace? })`: creates `wikis/<slug>/` structure and generates AGENTS.md from `templates/AGENTS.md` (all `{{WIKI_TITLE}}`/`{{SLUG}}` replaced)
* `commands/ingest.ts` — Phase 1 `ingest(slug, { workspace?, pagesPerChunk?, onProgress? })`: hash-skip unchanged PDFs, page-by-page extraction, whole-page chunking (default 5), document pages via gray-matter, source pages, state; Layer 1 only, no LLM
* `commands/add-pdf.ts` — user-directed Phase 1 extension (2026-07-17): `addPdfToWiki(wikiDir, sourcePath)` copies a PDF into `<wikiDir>/raw/` (strips surrounding quotes from drag-drop pastes, validates existence + `.pdf`, keeps the file name); throws typed `AddPdfError` with user-displayable messages; no LLM, no new deps
* `state/ingestion-state.ts` — read/write `wikis/<slug>/.state/ingestion.json` (phase doc §2.3 shape)
* `pages/source-page.ts` — deterministic `sources/<source-slug>.md` provenance pages (phase doc §2.4)
* `agents/` — empty scaffolding for Phases 2+ (`.gitkeep`); no Extractor/Materializer/DOX Writer code may land before its phase

## Local Contracts

* Phase 0 public surface is frozen per `Implementation Plan/PHASE_00_infrastructure.md` §7: `extractText`, `callLLM`, `sha256`, and the TUI framework must not change signature/behavior after Phase 0 approval; later phases extend, they do not break (Phase 1's `getPageCount` is an additive extension)
* Everything in `agents/` remains placeholder-only until its implementing phase; `init`/`ingest` business logic landed in Phase 1 per its phase doc — later-phase logic (Extractor, Materializer, DOX Writer) still may not land outside its phase
* LLM provider is Anthropic (user decision 2026-07-17): key from `ANTHROPIC_API_KEY` with `.env` fallback, model from `ANTHROPIC_MODEL` (default `claude-haiku-4-5-20251001`), prices overridable via env
* Every LLM call must log tokens and cost; product LLM spend is tracked per phase in `.state/phase-N-status.json`
* TUI conventions (Ink 7): every `useInput` is gated `isActive: isRawModeSupported === true`; components must render correctly in non-TTY contexts (static fallbacks); Escape = back, Enter = select
* Native-picker contract (user decision 2026-07-17 10:55, binding for the Add PDFs screen): the PRIMARY way to add PDFs is the OS-native graphical file picker (`utils/file-dialog.ts`); typed/pasted path entry is a demoted FALLBACK only, kept for environments where the dialog cannot run. Cancelling the dialog is neutral ("No files selected."), never an error; input is gated while the dialog/copy is in flight
* Windows shellout rule: spawn with an args array and `shell: false`, never string-concatenated shell commands (see `utils/file-dialog.ts`); the one sanctioned exception is spawning `.cmd` shims like npm, which requires `shell: true` on Windows (EINVAL guard, `tui/test-screen.tsx`)
* ESM only (`"type": "module"`); strict TypeScript; no new dependencies without recording the reason in the phase status file

## Work Guidance

* Follow the phase document for the phase being implemented; check compliance against the mapped vision documents before writing code (root AGENTS.md + `Implementation Plan/AGENTS.md`)
* Windows/Git Bash environment: no UNIX-only shellouts in committed code without a Windows fallback

## Verification

* `npm test` (vitest) must be green; `npx tsc --noEmit` must be clean
* Each phase's gates in its phase document are the acceptance tests for code here

## Child DOX Index

No child folders with their own contracts yet.
