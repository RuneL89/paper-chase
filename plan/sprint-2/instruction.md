# Sprint 2: Sample Ingestion & Chunking Artifacts

| Attribute | Value |
|---|---|
| Sprint | 2 |
| Goal | Implement the `sample` command so the CLI can analyze one representative PDF, decide a personalized chunking strategy, and emit the four required artifacts plus a sample document page. |
| FRD References | FR-004, FR-005, FR-006, FR-007, FR-008, FR-011, FR-012, FR-013 |
| Implements | Sample command, chunking-strategy.md, AGENTS.md schema, config.json, sample document page, chunking rules, page types, and citation model. |
| Dependencies | Sprint 1 |
| Est. Duration | Large |

## Why This Matters

The `sample` command is the journalist's first interaction with a new corpus. It must discover the PDF's structure, decide how to chunk without losing context, and produce four artifacts that serve as the contract for full ingestion. Without a clear chunking strategy and schema, full ingestion would produce inconsistent, uncited pages. This sprint turns raw extraction output into a repeatable, schema-bound pipeline.

## Tasks

1. Implement `llm-wiki-cli sample <wiki-slug> <path-to-pdf>`: validate the PDF belongs to the wiki's `raw/` folder, ensure the wiki exists, and create missing wiki folders if needed.
2. Analyze the sample PDF structure: detect cover, TOC, headings, sections, tables, figures, footnotes, appendices, and scanned pages.
3. Generate `wikis/<wiki-slug>/chunking-strategy.md` with structure description, chosen chunk boundaries, never-split rules, max/min sizes, fallback rule, and a concrete example.
4. Generate or update `wikis/<wiki-slug>/AGENTS.md` with page types, required/optional frontmatter per type, tag taxonomy, naming conventions, citation format, malformed-page handling, and wiki-specific conventions.
5. Generate `wikis/<wiki-slug>/config.json` with wiki metadata, schema references, chunking parameters, extraction settings, output paths, and status.
6. Apply the chunking strategy to the sample PDF and write at least one `document` page to `wikis/<wiki-slug>/output/documents/`.
7. Ensure the generated document page has valid YAML frontmatter, preserves extracted content without arbitrary summarization, and uses `[^srcN]` citations mapped to `sources` entries.
8. Add wikilinks to related entities, topics, and the source page.
9. Print a plain-language summary to stdout describing the artifacts and any warnings.

## Technical Acceptance Criteria (TAC)

1. Running `sample` creates exactly these artifacts: `chunking-strategy.md`, `AGENTS.md`, `config.json`, and at least one document page in `output/documents/`.
2. `chunking-strategy.md` contains: PDF structure description, chosen chunk boundaries, never-split rules, max/min chunk sizes, fallback rule for malformed pages, and a concrete chunk example with page range and content description.
3. `config.json` validates against the schema: wiki metadata, schema references, chunking parameters, extraction settings, output paths, and `status`.
4. The generated document page has `type: document` with required frontmatter `title`, `tags`, `sources`, and `confidence`.
5. Citations use inline `[^srcN]` and map to a YAML `sources` entry containing `file`, `pages`, and `extracted` ISO 8601 timestamp.
6. A table, figure, or caption is never split across arbitrary byte or character offsets; only at semantic boundaries or physical page boundaries.
7. Chunks below the minimum size are flagged in metadata, not discarded.
8. The sample command exits with a non-zero code if the specified PDF is not inside the wiki's `raw/` folder.

## UAT Acceptance Criteria (UAC)

1. A journalist can run `sample` and read a plain-language summary of what was created and why.
2. The `chunking-strategy.md` report is understandable by a non-engineer and explains why each chunk boundary was chosen.
3. The sample document page contains the full extracted content (text, tables, figures) without arbitrary summarization.
4. The AGENTS.md file explains the wiki's page types, tags, and citation conventions in plain language.

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
