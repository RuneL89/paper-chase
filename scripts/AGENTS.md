# scripts/ — DOX contract

## Purpose

One-off, committed utility scripts (run with `npx tsx`) that create or verify project fixtures. Not part of the shipped CLI.

## Ownership

* `create-golden-master.ts` — generates `test-pdfs/golden-master.pdf` (pdf-lib); kept for provenance only
* `verify-golden-master.ts` — extraction verification helper for the golden master

## Local Contracts

* `create-golden-master.ts` must **never be re-run** against the committed golden master — the PDF is immutable (see `test-pdfs/AGENTS.md`); the script exists to document how it was made
* Scripts are run manually with `npx tsx scripts/<name>.ts`; they must not be imported by `src/` or `tests/`

## Work Guidance

## Verification

## Child DOX Index

No child folders.
