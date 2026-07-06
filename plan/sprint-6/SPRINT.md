# Sprint 6 — Extraction & Chunking Refactor

## Goal
Refactor the PDF extraction and chunking layer so it preserves reading order, tables, figures, and logical page numbers, detects scanned pages, and produces semantically complete chunks that can be fed sequentially into the orchestrator’s sub-agents.

## Acceptance Criteria
1. `src/extractor/pdf.ts` preserves reading order, headings, lists, tables, and figure captions.
2. Scanned/image-only pages are detected (by text absence or image dominance) and routed to `raw/` pages instead of document chunks.
3. `src/chunking/chunker.ts` never splits a table, figure with caption, or multi-page footnote across chunks.
4. Each chunk records its source PDF, logical page range, and boundary type (`page`, `section`, `table`, `figure`).
5. `analyzeAndChunk()` returns a `chunking-strategy.md` compatible strategy object.
6. `src/config.ts` validates chunking and extraction fields and supports wiki-level overrides of workspace defaults.
7. `npm run build` and `npm run test` pass.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes (or no tests are broken).

## Validation Gate
- Reviewer confirms extraction fidelity on the test-wiki PDFs.
- Reviewer confirms scanned pages are written as `raw` pages.
- Reviewer confirms no table is split across chunks.

## Files to Create/Modify
- `src/extractor/pdf.ts` (modify)
- `src/extractor/batch.ts` (modify if needed)
- `src/chunking/analyzer.ts` (modify)
- `src/chunking/chunker.ts` (modify)
- `src/chunking/types.ts` (create or modify)
- `src/config.ts` (modify if needed)
- `tests/extractor.test.ts` (modify/extend)
- `tests/sample.test.ts` (modify if needed)

## Dependencies
- Sprint 5 (Custom Orchestrator Skill & Contracts) — COMPLETE.
- FRD v2.0 requirements FR-011, FR-012, FR-021, FR-022.

## Implementation Notes
- Keep using `pdfjs-dist/legacy/build/pdf.mjs` with `useSystemFonts: true`.
- Add extraction metadata fields: `logical_pages`, `physical_pages`, `has_tables`, `has_figures`, `is_scanned`.
- Extend chunk metadata with `boundary_type` and `source_page_range`.
- When a table or figure spans a chunk boundary, extend the chunk so the whole object is included.
- Scanned pages should still generate a `raw` page with a citation back to the source PDF.
