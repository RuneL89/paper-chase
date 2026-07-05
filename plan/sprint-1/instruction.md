# Sprint 1: PDF Extraction & Source Pages

| Attribute | Value |
|---|---|
| Sprint | 1 |
| Goal | Build the PDF extraction engine, source page writer, and raw/failed-extraction page handling so every PDF can be read and cataloged with full fidelity. |
| FRD References | FR-010, FR-015, FR-016 |
| Implements | PDF text/metadata extraction, reading-order preservation, scanned-page detection, source page generation, and raw page generation. |
| Dependencies | Sprint 0 |
| Est. Duration | Medium |

## Why This Matters

Data fidelity is the primary success criterion of the product. If the CLI cannot extract every page, preserve reading order, detect scanned pages, and catalog each source file with provenance, the entire downstream wiki becomes unreliable. Source pages are the anchor for every citation; raw pages ensure that nothing is silently dropped. This sprint must be rock-solid before chunking or page writing begins.

## Tasks

1. Integrate a PDF extraction library (e.g., `pdf-parse` or `opendocloader-pdf`) and create an `extractor/pdf.ts` module.
2. Extract text, headings, tables, lists, and document-level metadata (title, author, creation date, page count) from each PDF page.
3. Preserve reading order and map logical page numbers to physical PDF pages.
4. Detect image-only or scanned pages and flag them for OCR; record OCR failures as raw pages.
5. Implement a `source` page writer that emits a markdown file with file path, filename, logical/physical page counts, file size, SHA-256 hash, metadata, ingestion timestamp, and extraction warnings.
6. Implement a `raw` page writer for malformed or unparseable content, preserving the original fragment as text or image reference where feasible.
7. Ensure extraction failures on one PDF do not block processing of other PDFs or wikis.
8. Write tests using synthetic and, if available, real PDF fixtures.

## Technical Acceptance Criteria (TAC)

1. A 5-page synthetic PDF yields extracted text for every physical page, with no silently dropped pages.
2. A source page's YAML frontmatter contains `file`, `sha256`, `logical_pages`, `physical_pages`, `size_bytes`, `metadata`, `ingested`, and `warnings`.
3. A scanned or image-only page produces a `raw` page with `type: raw`, `source`, `pages`, `reason`, and `confidence: low`.
4. Extraction of a malformed PDF emits a warning and writes a `raw` page; it does not crash the process or prevent other PDFs from being processed.
5. A 100-page PDF is extracted in under 5 minutes on a standard laptop without LLM calls.
6. Every extracted table or figure is represented in the extraction output as a markdown table or structured description, not discarded.

## UAT Acceptance Criteria (UAC)

1. A source page lists the PDF filename, page count, file size, and any extraction warnings.
2. A scanned page is recorded as a `raw` page instead of being silently dropped or returning empty content.
3. Progress output shows the currently processing PDF and stage (e.g., "Extracting acme-2024.pdf…").

## LOOP ENGINEERING METHODOLOGY

### Phase A: PLAN
1. List ALL files to create/modify.
2. List ALL tests to write.
3. List ALL dependencies to install.
4. Identify risks and fallbacks.
5. Verify tech stack compatibility.
6. Plan order: backend → API → frontend → integration.

### Phase B: RED — Write Failing Tests
1. Write tests for each TAC BEFORE implementation.
2. Tests MUST fail when first run.
3. Use appropriate test frameworks.
4. Each test maps to exactly one TAC.
5. Max 10 test cases per feature. Split if more needed.

### Phase C: GREEN — Implement Minimal Code
1. Write minimum code to make tests pass.
2. After EVERY file change, run compiler/linter.
3. If compilation fails, enter Self-Correcting loop (max 5 iterations).
4. Do NOT write perfect code. Write working code.

### Phase D: EVALUATE — Score Against TAC Rubric
1. Score each TAC: 0 (fail), 0.5 (partial), 1 (pass).
2. Calculate overall percentage.
3. If < 100%, identify failures and revise.
4. Re-run tests and re-score.
5. Max 3 evaluation iterations.

### Phase E: REFACTOR — Improve Quality
1. Clean up while keeping tests green.
2. Remove dead code, console.logs, temporary comments.
3. Ensure consistent naming and organization.
4. Add inline comments only for non-obvious logic.
5. Verify no compiler warnings remain.
6. Do NOT add new features.

### Phase F: REPORT
Report back with:
- PASS/FAIL table for each TAC
- Test commands and output
- Compilation errors and resolutions
- Files created/modified (with line counts)
- Dependencies installed
- Blockers or notes for subsequent sprints
