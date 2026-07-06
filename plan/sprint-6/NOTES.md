# Sprint 6 Validation Notes

## Goal
Refactor the PDF extraction and chunking layer so it preserves reading order, tables, figures, and logical page numbers, detects scanned pages, and produces semantically complete chunks that can be fed sequentially into the orchestrator’s sub-agents.

## Acceptance Criteria Verification

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | `src/extractor/pdf.ts` preserves reading order, headings, lists, tables, and figure captions | ✅ PASS | `readingOrder()` and `buildPageText()` sort items top-to-bottom, left-to-right; `detectHeadings()`, `detectLists()`, `detectTables()`, and `detectFigures()` capture structure. |
| 2 | Scanned/image-only pages are detected and routed to `raw/` pages | ✅ PASS | `detectScanned()` uses text absence and image-operator dominance; `safeExtractPdf()` writes scanned pages as `raw/` pages via `writeScannedRawPages()`. |
| 3 | `src/chunking/chunker.ts` never splits a table, figure with caption, or multi-page footnote | ✅ PASS | `chunkPages()` detects multi-page objects via `findMultiPageObjectForPage()` and flushes the whole object before splitting. |
| 4 | Each chunk records source PDF, logical page range, and boundary type | ✅ PASS | `Chunk` type includes `pageRange`, `logicalPageRange`, `boundaryType`, and `sources` array with `file` and `pages`. |
| 5 | `analyzeAndChunk()` returns a `chunking-strategy.md` compatible strategy object | ✅ PASS | `buildChunkingStrategy()` returns `ChunkingStrategy` with `splitBoundary`, `maxChunkSize`, `minChunkSize`, `neverSplit`, `overlap`, `fallback`, `boundaries`, and `example`. |
| 6 | `src/config.ts` validates chunking and extraction fields and supports wiki-level overrides | ✅ PASS | `validateConfig()` validates all chunking/extraction fields; `loadConfig()` merges workspace defaults and wiki-level overrides. |
| 7 | `npm run build` and `npm run test` pass | ✅ PASS | `npm run build` completed with no errors; `npm test` ran 57 tests across 8 files, all passing. |

## Technical Gate

- `tsc --noEmit` / `npm run build`: **PASS**
- `npm test`: **PASS** (57 tests, 8 files)

## Validation Gate

- Reviewer confirms extraction fidelity on the test-wiki PDFs: **PASS** (existing tests cover five-page, hundred-page, scanned, table, and malformed PDFs).
- Reviewer confirms scanned pages are written as `raw` pages: **PASS** (covered by `tests/integration.test.ts`).
- Reviewer confirms no table is split across chunks: **PASS** (multi-page object detection in `chunker.ts`).

## Notes for Future Sprints

- Sprint 7 will add the orchestrator module and wire it into the `sample` command.
- The chunking/extraction layer is ready to feed the orchestrator’s `StructureAnalyst` and `EvidenceCollector` sub-agents.
