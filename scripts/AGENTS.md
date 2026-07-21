# scripts/ — DOX contract

## Purpose

One-off, committed utility scripts (run with `npx tsx`) that create or verify project fixtures. Not part of the shipped CLI.

## Ownership

* `create-golden-master.ts` — generates `test-pdfs/golden-master.pdf` (pdf-lib); kept for provenance only
* `create-golden-master-da.ts` — generates `test-pdfs/golden-master-da.pdf` (pdf-lib, Phase 7; run once 2026-07-20); kept for provenance only
* `create-golden-master-2.ts` — generates `test-pdfs/golden-master-2.pdf` (pdf-lib, Phase 8; run once 2026-07-21); kept for provenance only; header comment records the full verbatim page text
* `verify-golden-master.ts` — extraction verification helper for the golden master
* `create-ab-corpus.ts` — generates the six `test-pdfs/ab-corpus/*.pdf` fixtures (pdf-lib, Phase 10; run once 2026-07-21); kept for provenance only — must **never be re-run** against the committed fixtures (they are immutable, see `test-pdfs/AGENTS.md`)
* `compare-pdf-engines.ts` — Phase 10 A/B comparison harness (LLM-free): runs pdfjs and (when a JRE is present) opendataloader over every ab-corpus fixture + the two golden masters; checks expected-string presence, table fidelity (shape after `renderTablesAsMarkdown` vs. manifest), diacritics integrity, page-boundary alignment, and per-engine wall time + JVM startup overhead; writes `.state/pdf-engine-ab-report.md` + `.json` with a keep-pdfjs/switch-default recommendation. Usage: `npx tsx scripts/compare-pdf-engines.ts [--subset <names>] [--report <path>] [--json <path>]`; exports `runComparison` for programmatic use, direct-execution guarded (argv[1]/argv[2] vs module path, `VITEST` check) so importing never runs the comparison

## Local Contracts

* `create-golden-master.ts`, `create-golden-master-da.ts`, and `create-golden-master-2.ts` must **never be re-run** against the committed golden masters — the PDFs are immutable (see `test-pdfs/AGENTS.md`); the scripts exist to document how they were made
* Scripts are run manually with `npx tsx scripts/<name>.ts`; they must not be imported by `src/` or `tests/`

## Work Guidance

## Verification

## Child DOX Index

No child folders.
