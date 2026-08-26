# scripts/ — DOX contract

## Purpose

One-off, committed utility scripts (run with `npx tsx`) that create or verify project fixtures and drive the Windows packaging pipeline (build-exe → build-launcher → pkg → set-icon). Not part of the shipped CLI.

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
* `repair-wikilinks.ts` — Phase 20 one-time wikilink remediation (B20, user-directed 2026-07-29): `npx tsx scripts/repair-wikilinks.ts [wikisRoot=dist/wikis] [--dry]` walks every wiki under the root and applies the deterministic unique-prefix/alias repair (`src/utils/wikilink-repair.ts`) to every entity/topic page, rewrites changed pages, and re-converges `.state/ingestion.json` `pageHashes` from disk for every modified page (no B19-class false flags); `--dry` prints the full report without writing; per-wiki report of repairs (old → new), unrepairable + candidates, unchanged counts
* `build-icon.ts` — regenerates `assets/icon.ico` (multi-size 16/24/32/48/64/128/256) from `assets/icon.svg` + `assets/icon-small.svg` using headless Chrome/Edge screenshots (transparency via `--default-background-color=00000000`) and a dependency-free ICO packer (this build machine has no standalone npm on PATH — see `assets/AGENTS.md`); run only when the SVG sources change; also writes throwaway review previews (512px + pixelated small-size strip) to the OS temp dir
* `set-icon.ts` — packaging step 3: patches `assets/icon.ico` into `dist/paper-chase.exe` with the vendored rcedit. pkg has no icon support, and a bare `rcedit --set-icon` BREAKS the exe: rcedit's PE rewrite drops pkg's appended payload overlay AND pkg bakes PAYLOAD_POSITION (its own section end) into the prelude at build time, so a mis-placed payload boots degraded ("Pkg: Error reading from file." — the launcher then "extracts" live project files instead of the snapshot). The script captures the overlay, runs rcedit, zero-pads the section-table gap, and re-appends the overlay at the original baked position (final size == fresh pkg output); it runs on a FRESH pkg output only (always true inside `npm run package:win`) and refuses loudly if rcedit grows the sections past the baked position
* `vendor/rcedit-x64.exe` — the only vendored binary (electron/rcedit v2.0.0, downloaded 2026-08-24); used solely by `set-icon.ts`; keep it in lockstep with the rcedit usage there

## Local Contracts

* `create-golden-master.ts`, `create-golden-master-da.ts`, and `create-golden-master-2.ts` must **never be re-run** against the committed golden masters — the PDFs are immutable (see `test-pdfs/AGENTS.md`); the scripts exist to document how they were made
* Scripts are run manually with `npx tsx scripts/<name>.ts` (or via the `package:win*` npm scripts for the packaging ones); they must not be imported by `src/` or `tests/`

## Work Guidance

## Verification

## Child DOX Index

No child folders.
