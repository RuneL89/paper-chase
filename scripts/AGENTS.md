# scripts/ — DOX contract

## Purpose

One-off, committed utility scripts (run with `npx tsx`) that create or verify project fixtures. Not part of the shipped CLI.

## Ownership

* `create-golden-master.ts` — generates `test-pdfs/golden-master.pdf` (pdf-lib); kept for provenance only
* `create-golden-master-da.ts` — generates `test-pdfs/golden-master-da.pdf` (pdf-lib, Phase 7; run once 2026-07-20); kept for provenance only
* `create-golden-master-2.ts` — generates `test-pdfs/golden-master-2.pdf` (pdf-lib, Phase 8; run once 2026-07-21); kept for provenance only; header comment records the full verbatim page text
* `verify-golden-master.ts` — extraction verification helper for the golden master

## Local Contracts

* `create-golden-master.ts`, `create-golden-master-da.ts`, and `create-golden-master-2.ts` must **never be re-run** against the committed golden masters — the PDFs are immutable (see `test-pdfs/AGENTS.md`); the scripts exist to document how they were made
* Scripts are run manually with `npx tsx scripts/<name>.ts`; they must not be imported by `src/` or `tests/`

## Work Guidance

## Verification

## Child DOX Index

No child folders.
