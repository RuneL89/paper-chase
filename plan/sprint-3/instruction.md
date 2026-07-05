# Sprint 3: Full Ingestion, Entities, Topics & Wikilinks

| Attribute | Value |
|---|---|
| Sprint | 3 |
| Goal | Implement the `ingest` command to process every PDF in a wiki, generate document/entity/topic pages, and build the wikilink graph with incremental update support. |
| FRD References | FR-009, FR-006, FR-014, FR-017, FR-018 |
| Implements | Full ingestion command, corpus-wide document pages, entity pages, topic pages, wikilink generation, and incremental updates. |
| Dependencies | Sprint 2 |
| Est. Duration | Large |

## Why This Matters

Full ingestion is where the wiki-of-wikis becomes real. Every PDF is turned into document pages, every recurring name into an entity page, and every recurring theme into a topic page. Wikilinks transform isolated pages into a traversable graph so a research AI agent can follow mentions from any page to related pages. Incremental updates ensure that adding one new report does not force re-processing the entire corpus, making the tool practical for a growing journalism corpus.

## Tasks

1. Implement `llm-wiki-cli ingest <wiki-slug>`: read `config.json` and `AGENTS.md`, validate the wiki, and process every PDF in `raw/`.
2. Apply the chunking strategy from `config.json` to each PDF and generate document pages for every chunk.
3. Ensure every document page cites the originating PDF and page range using `[^srcN]` and `sources` frontmatter entries.
4. Implement entity extraction: detect people, organizations, products, and locations mentioned repeatedly and generate `entity` pages in `output/entities/`.
5. Implement topic extraction: detect recurring themes, sections, or concepts and generate `topic` pages in `output/topics/`.
6. Generate wikilinks: link entity mentions to canonical entity pages, topic mentions to topic pages, document pages to source pages, and all pages to the wiki-level index.
7. Implement incremental updates: detect added/changed/removed PDFs by SHA-256 and modification time; re-extract only changed files; update affected pages, indexes, and links; preserve unchanged pages and incoming links.
8. Report per-file and per-wiki statistics, warnings, and errors.
9. Write tests for full ingestion, entity/topic generation, wikilink resolution, and incremental behavior.

## Technical Acceptance Criteria (TAC)

1. `ingest` processes every PDF in the wiki's `raw/` folder and produces at least one document page per chunk and one source page per PDF.
2. Entity pages are generated for entities mentioned repeatedly across sources, with a configurable minimum mention threshold from `config.json`.
3. Topic pages are generated for recurring themes detected across the corpus.
4. Wikilinks use the `[[Page Title]]` syntax; unresolved or ambiguous links are recorded in lint output, not silently dropped.
5. Document pages link to their source page and to the wiki-level index.
6. Incremental re-run after adding one PDF updates only the affected source page, document pages, entity/topic pages, and indexes; unchanged pages remain untouched.
7. Incremental re-run with no source changes produces no new writes or modifications.
8. A malformed PDF during full ingestion writes a `raw` page and continues processing the remaining PDFs.

## UAT Acceptance Criteria (UAC)

1. A journalist can run `ingest` and see plain-language progress for each PDF, including counts of pages generated and warnings.
2. Entity pages consolidate mentions from multiple document pages within the wiki.
3. Adding a new PDF to the wiki and re-running `ingest` updates only the affected pages, leaving existing pages intact.
4. A research AI agent can follow wikilinks from a document page to its source page, to an entity page, and to the wiki-level index.

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
