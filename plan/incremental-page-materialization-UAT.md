# UAT: Per-Chunk Incremental Page Materialization

> **Status:** Pending execution after the per-chunk incremental page materialization change is implemented and the current E2E run is completed.
>
> **Scope:** One wiki = one corpus (one large immutable PDF or a collection of similar PDFs, e.g. recurring yearly reports). Cross-wiki navigation remains via `index-of-indexes.md`.

## 1. Purpose

Validate that the `ingest` command writes pages incrementally per chunk, preserves all previously written information when entity/topic pages are updated, and correctly surfaces relationships between entities that appear in distant parts of the same source.

## 2. Preconditions

1. The per-chunk incremental page materialization change is merged and built.
2. `npm run build` passes.
3. A temporary workspace is created for testing, e.g. `C:\temp\wiki-uat-incremental`.
4. The workspace is initialized with the CLI:
   ```bash
   npm run dev -- init incremental-uat --title "Incremental UAT Wiki"
   ```
5. LLM configuration is present and working (verified with `npm run dev -- test-llm`).

## 3. Test Data

### 3.1 Test Set A — Single large source
A PDF of at least 100 pages where two distinct entities are discussed in separated sections (e.g., one entity in pages 10–20 and another in pages 80–90, with a relationship between them established in pages 95–100). The exact file is chosen by the tester at execution time.

### 3.2 Test Set B — Recurring similar sources
Two or more short PDFs that mention the same organization in different reports (e.g., two yearly reports for the same company).

## 4. Test Cases

### TC-1 — Single source writes document pages incrementally

**Steps:**
1. Place Test Set A in the wiki `raw/` folder.
2. Run `npm run dev -- ingest incremental-uat`.
3. During the run, observe the `wikis/incremental-uat/documents/` folder.

**Expected result:**
- Document pages appear in `documents/` as chunks complete, not only at the end of the run.
- Each document page corresponds to one chunk and has valid frontmatter (`title`, `source`, `page_range`, etc.).
- No chunk is left without a document page when the run succeeds.

### TC-2 — Entity pages are updated as new chunks are processed

**Steps:**
1. Use the same wiki as TC-1.
2. After the run completes, list the `entities/` folder.
3. Open an entity page that appears in multiple chunks.

**Expected result:**
- The entity page exists.
- The page contains an **Appearances** section listing every source and page range where the entity occurs.
- The page contains all facts, citations, and relationships discovered from the first chunk through the last chunk.
- Nothing from an earlier chunk is missing after later chunks are processed.

### TC-3 — Distant relationships within one source are preserved

**Steps:**
1. Use the same wiki as TC-1.
2. Find two entities that appear in widely separated chunks (e.g., entity A in chunk 3, entity B in chunk 12, relationship mentioned in chunk 12).
3. Open both entity pages.

**Expected result:**
- Each entity page mentions the relationship.
- The relationship is cited with a `[^srcN]` marker that maps to the correct source and page range.
- The relationship is described in the same way on both pages (no contradiction).

### TC-4 — Adding a second source preserves existing entity information

**Steps:**
1. Use Test Set B (two similar PDFs).
2. Place the first PDF in `raw/` and run `ingest incremental-uat`.
3. Verify the entity page for the shared organization.
4. Place the second PDF in `raw/` and run `ingest incremental-uat` again.
5. Open the same entity page.

**Expected result:**
- All mentions and facts from the first PDF are still present.
- New mentions and facts from the second PDF are added in the correct sections.
- The **Appearances** section now lists both sources and their page ranges.
- Citations from both sources are present and correctly numbered.

### TC-5 — Manual edits are preserved on re-ingest

**Steps:**
1. Use the same wiki as TC-4 after the second source is ingested.
2. Manually edit an entity page: add a sentence, a footnote, or a section that is not in the original LLM output.
3. Save the page and note its content hash (optional, but helpful for verification).
4. Run `ingest incremental-uat` again on the unchanged sources.

**Expected result:**
- The manual addition is still present in the entity page after re-ingest.
- New LLM-generated content is added only if it does not conflict with the manual edit.
- If the preservation check is implemented, the manual edit is either kept verbatim or a warning is emitted; it is never silently deleted.

### TC-6 — Resume from a failed run

**Steps:**
1. Start a new wiki with a large PDF (Test Set A).
2. Begin `ingest incremental-uat`.
3. While the run is in progress, terminate the process (e.g., `Ctrl+C`) after at least one chunk has been completed but before the source is finished.
4. Run `ingest incremental-uat --resume`.

**Expected result:**
- Completed chunks are skipped.
- The remaining chunks are processed.
- No duplicate document pages are created for completed chunks.
- Entity/topic pages are consistent with the partial and completed chunk sets.

### TC-7 — Citations remain valid across incremental updates

**Steps:**
1. After TC-4, inspect several entity and topic pages.
2. For every `[^srcN]` marker, verify that the corresponding `sources:` frontmatter entry exists and points to the correct source file and page range.

**Expected result:**
- All citation markers resolve to a source entry.
- No orphan markers exist.
- Source numbering is stable or correctly regenerated.

### TC-8 — Links remain valid across incremental updates

**Steps:**
1. After TC-4, run `npm run dev -- status incremental-uat` (or any available link validator) and inspect the lint report.

**Expected result:**
- No broken `[[Entity: ...]]` or `[[Topic: ...]]` links.
- No broken links to document pages or source pages.
- The lint report does not contain new errors compared to the baseline.

## 5. Acceptance Criteria

All test cases (TC-1 through TC-8) pass:
- Document pages are written incrementally per chunk.
- Entity/topic pages retain all existing information when new chunks or sources are added.
- Relationships across distant chunks are correctly captured and cited.
- Manual edits are preserved or explicitly protected, never silently overwritten.
- Resume from a failed run skips completed chunks and produces a consistent wiki.
- Citations and wikilinks are valid.

## 6. Sign-Off

| Role | Name | Date | Result |
|---|---|---|---|
| Tester | | | Pass / Fail |
| Reviewer | | | Pass / Fail |

## 7. Notes

- This UAT is intended to be run independently of the current E2E pipeline. It uses its own workspace and test files.
- If any test case fails, the defect must be recorded separately and the implementation adjusted before this UAT is re-run.
- The exact test files are not prescribed here; the tester should choose files that match the described characteristics (large source with separated entities, and recurring similar sources).
