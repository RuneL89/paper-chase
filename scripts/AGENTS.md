# scripts/ — DOX contract

## Purpose

One-off, committed utility scripts (run with `npx tsx`) that create or verify project fixtures. Not part of the shipped CLI.

## Ownership

* `create-golden-master.ts` — generates `test-pdfs/golden-master.pdf` (pdf-lib); kept for provenance only
* `create-golden-master-da.ts` — generates `test-pdfs/golden-master-da.pdf` (pdf-lib, Phase 7; run once 2026-07-20); kept for provenance only
* `create-golden-master-2.ts` — generates `test-pdfs/golden-master-2.pdf` (pdf-lib, Phase 8; run once 2026-07-21); kept for provenance only; header comment records the full verbatim page text
* `verify-golden-master.ts` — extraction verification helper for the golden master
* `build-exe.ts` — packaging step 1 (2026-07-23): esbuild-bundles `exe-entry.ts` → `dist/chase.mjs` (ESM; react-devtools-core stubbed, createRequire banner) and the pdf.js worker → `dist/pdf.worker.cjs` (CJS, for pkg exe mode)
* `exe-entry.ts` — export-free side-effect entry for the esbuild bundle (pkg's ESM transform cannot bytecode-wrap exports+top-level-await); the cli.ts parse guard fires under pkg via `process.pkg`
* `build-launcher.ts` — packaging step 2: stages `dist/pdf.worker.mjs` (ESM worker for the launcher child) + `dist/runtime-node.exe` (the build machine's real Node) and esbuild-bundles `launcher-entry.ts` → `dist/launcher.cjs` (plain CJS, pkg's most mature mode)
* `launcher-entry.ts` — the paper-chase.exe payload: extracts the runtime (real node.exe, chase.mjs, prompts, template, pdfjs fonts + native canvas) once to `%LOCALAPPDATA%\paper-chase\runtime\<asset-version>` (marker-guarded) and hands off to real Node with inherited stdio — pkg's patched Node runtime segfaults inside react-reconciler's commit when ink renders, so the TUI must run under real Node (see the file's header comment for the full rationale)
* `react-devtools-core-stub.js` — esbuild alias stub for ink's optional, guarded `react-devtools-core` import (the package is deliberately not installed)

## Local Contracts

* `create-golden-master.ts`, `create-golden-master-da.ts`, and `create-golden-master-2.ts` must **never be re-run** against the committed golden masters — the PDFs are immutable (see `test-pdfs/AGENTS.md`); the scripts exist to document how they were made
* Scripts are run manually with `npx tsx scripts/<name>.ts` (or via the `package:win*` npm scripts for the packaging ones); they must not be imported by `src/` or `tests/`

## Work Guidance

## Verification

## Child DOX Index

No child folders.
