# Sprint 6 — Extraction & Chunking Refactor

## Goal
Refactor the existing extraction pipeline into a context-cautious chunking system that can handle 1000+ page PDFs. The chunking strategy should adapt to the configured LLM context limit, always erring on the side of more chunks/smaller context consumption.

## Acceptance Criteria
1. `src/chunking/` directory exists with a clean public API.
2. A `chunking-strategy.md` template is generated and stored in `.kimi-code/` of each wiki workspace.
3. Chunk size adapts based on LLM provider context limit (or a configurable max tokens).
4. Sequential chunks are emitted with overlap for rolling memory continuity.
5. Chunk metadata includes: index, startPage, endPage, wordCount, overlapRange, estimatedTokenCount.
6. Existing `pdf.ts` and `entities.ts` are refactored so extraction is decoupled from writing.
7. All existing tests pass or are updated to the new API.

## Technical Gate
- `tsc --noEmit` passes.
- `npm test` passes.
- A 1000+ page test document (mock or real) can be chunked without crashing.

## Validation Gate
- Reviewer confirms chunking is context-cautious (max chunk well below context limit).
- Reviewer confirms overlap is present and sequential.

## Files to Create/Modify
- `src/chunking/index.ts` (new)
- `src/chunking/types.ts` (new)
- `src/chunking/strategy.ts` (new)
- `src/pdf.ts` (modify)
- `src/entities/index.ts` (modify)
- `src/cli.ts` (modify commands if needed)
- `plan/sprint-6/NOTES.md` (new)

## Dependencies
- Sprint 5 complete
- Existing LLM client
- Existing PDF parser

## Implementation Notes
- Use the strategy defined in `chunking-strategy.md` as the LLM-facing contract.
- The orchestrator will later read this file during sample/ingest, so keep it human-readable and stable.
- Preserve all extracted text; chunking must not drop pages.
