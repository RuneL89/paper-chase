# src/ — DOX contract

## Purpose

All TypeScript source for LLM Wiki CLI v2.0: CLI entry point, TUI (Ink), PDF extraction, LLM client, the Extractor agent (Layer 2), schema validation, commands, state, utilities, and (in later phases) Materializer/DOX Writer agents.

## Ownership

* `cli.ts` — Commander entry point; named `program` export; `program.parse()` only runs when executed directly (guarded), never on import; `ingest` accepts `--no-extract` (Layer-1-only opt-out; extraction is default-on since Phase 2)
* `tui/` — Ink TUI: `app.tsx` (screen router), `menu.tsx` (main menu + exported `resolveMenuSelection`), `init-screen.tsx`, `ingest-screen.tsx`, `add-pdfs-screen.tsx`, `extractor-test-screen.tsx`, `entity-browser.tsx`, `topic-browser.tsx`, `test-screen.tsx`, `settings-screen.tsx`, `components/` (header, footer, spinner, error-box, success-box, tree-browser), `hooks/use-wiki-list.ts`, `hooks/use-wiki-details.ts`, `hooks/use-raw-contents.ts`, `hooks/use-document-chunks.ts`
* `extraction/pdf.ts` — `extractText(pdfPath, startPage?, endPage?)` via pdfjs-dist legacy build; never splits a page; additive Phase 1 `getPageCount(pdfPath)` shares the same loader
* `extraction/markdown-tables.ts` — deterministic plaintext-table detection; rebuilds markdown tables from whitespace-collapsed extraction output (conservative guards, every word preserved)
* `llm/client.ts` — `callLLM(prompt, system?, options?)`; Anthropic Messages API; logs `LLM Call | Tokens: i/o | Cost: $x` for every call; no retries, throws on failure; additive Phase 2 `CallLLMOptions { maxTokens?, temperature? }` — defaults (1024, temperature omitted) preserve the frozen Phase 0 behavior exactly
* `utils/hash.ts` — `sha256(filePath)` streaming helper
* `utils/slug.ts` — wiki-slug validation (kebab-case), source-slug derivation, and `slugify` (also used by the Extractor for deterministic slug normalization)
* `utils/paths.ts` — workspace/wiki path helpers; generated paths always use forward slashes
* `utils/file-dialog.ts` — native graphical PDF picker (user decision 2026-07-17 10:55): `pickPdfFiles()` spawns `powershell.exe -NoProfile -NonInteractive -Command <script>` (`shell: false`, args array only) showing a topmost System.Windows.Forms OpenFileDialog (PDF filter, multi-select, 10-minute timeout); resolves with the picked paths, `null` on cancel, throws descriptively on spawn/non-zero-exit/timeout; `parseDialogOutput(stdout)` is the pure `\r\n`-safe parser exported for tests
* `commands/init.ts` — Phase 1 `init(slug, { title?, workspace? })`: creates `wikis/<slug>/` structure and generates AGENTS.md from `templates/AGENTS.md` (all `{{WIKI_TITLE}}`/`{{SLUG}}` replaced)
* `commands/ingest.ts` — `ingest(slug, { workspace?, pagesPerChunk?, extract?, onProgress? })`: hash-skip unchanged PDFs, page-by-page extraction, whole-page chunking (default 5), document pages via gray-matter, source pages, state; Layer 2 since Phase 2: per-chunk Extractor run (default-on, `extract?: boolean` opt-out) saving `.state/extracted/<chunk-id>.json`, additive `IngestResult.extractions` counts; unchanged PDFs skip extraction entirely
* `commands/extract-chunk.ts` — Phase 2 `extractDocumentChunk(wikiDir, chunkId)`: the single shared extraction path used by both `ingest` and the TUI Test Extractor screen; reads the document page (chunk text, page range, source file from frontmatter), the wiki constitution, and rolling memory (read-only); writes `.state/extracted/<chunk-id>.json`
* `commands/add-pdf.ts` — user-directed Phase 1 extension (2026-07-17): `addPdfToWiki(wikiDir, sourcePath)` copies a PDF into `<wikiDir>/raw/` (strips surrounding quotes from drag-drop pastes, validates existence + `.pdf`, keeps the file name); throws typed `AddPdfError` with user-displayable messages; no LLM, no new deps
* `state/ingestion-state.ts` — read/write `wikis/<slug>/.state/ingestion.json` (phase doc §2.3 shape)
* `state/rolling-memory.ts` — Phase 2 read-only loader and Phase 3 writer for `.state/rolling-memory.json` (vision `04` §5 shape: `folderStructure` → folders, `entities[].slug` → slugs; absence → empty lists, malformed → descriptive throw)
* `pages/source-page.ts` — deterministic `sources/<source-slug>.md` provenance pages (phase doc §2.4)
* `pages/entity-page.ts` — deterministic `entities/<subfolder>/<slug>.md` writer with YAML frontmatter, mentions, relationships, claims, and `[^srcN]` citations (phase doc §2.1)
* `pages/topic-page.ts` — deterministic `topics/<subfolder>/<slug>.md` writer grouped by claim type (phase doc §2.2)
* `materializer.ts` — deterministic Layer 3: reads `.state/extracted/*.json`, aggregates entities/topics, writes pages, updates rolling memory (phase doc §2.3)
* `agents/extractor.ts` — Phase 2: the Extractor (Layer 2), the ONLY LLM call in the pipeline. `extractChunk(chunkText, pageRange, sourceFile, agentsMd, existingFolders, existingEntities)` → extended `ExtractorResult` (entities/relationships/claims + `timeline`, `context`, per-entity `significance`, optional `disambiguation` — gates 2.9-2.12 extension); typed `ExtractorError` (raw response on invalid JSON, issue list on schema failure; NO retry); fence-tolerant JSON parse; deterministic `slugify()` normalization of all slugs before validation; extraction calls use `maxTokens: 4096, temperature: 0`
* `validation/extractor-schema.ts` — Phase 2: non-throwing `validateExtractorResult(data, pageRange?)` → `{ valid, issues }` per phase doc §2.4 + extended fields; folder prefix `^entities/|^topics/`, no `..`, ≤4 segments, page-range checks (skipped for unparseable ranges)
* `agents/` — Phase 2 landed `extractor.ts` only; the Materializer (Phase 3) is deterministic code in `src/materializer.ts`, not an agent in this folder; DOX Writer code may not land before Phase 5

## Local Contracts

* Phase 0 public surface is frozen per `Implementation Plan/PHASE_00_infrastructure.md` §7: `extractText`, `callLLM`, `sha256`, and the TUI framework must not change signature/behavior after Phase 0 approval; later phases extend, they do not break (Phase 1's `getPageCount` and Phase 2's `CallLLMOptions` are additive extensions with identical defaults)
* `agents/` holds only the agents whose phase has run (Phase 2: the Extractor); the Materializer is deterministic code in `src/materializer.ts`; DOX Writer and any rolling-memory writes may not land outside their phases
* The Extractor is the ONLY LLM call in the pipeline (vision `04` §1); every other concern (folder creation, page writing, memory updates) is deterministic code or a later phase
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
