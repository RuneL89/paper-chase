# Sprint 4: Indexes, Status, Logs & LLM Integration

| Attribute | Value |
|---|---|
| Sprint | 4 |
| Goal | Generate wiki-level and top-level indexes, implement the remaining CLI commands, write reproducible run logs, and add LLM support with full local-only fallback. |
| FRD References | FR-002, FR-003, FR-019, FR-020, FR-022 |
| Implements | Wiki-level index, index-of-indexes, `ingest-all`, `status`, JSON run logs, LLM client abstraction, and basic lint checks. |
| Dependencies | Sprint 3 |
| Est. Duration | Medium |

## Why This Matters

Indexes turn a folder of pages into a navigable knowledge base. The wiki-level index is the entry point for a single corpus; the index-of-indexes is the entry point for the entire workspace. Without them, a research AI agent cannot efficiently choose where to look. Run logs make every ingestion reproducible and auditable, which is essential for journalism. The LLM integration allows structure discovery and drafting while preserving the local-only fallback and privacy guarantees.

## Tasks

1. Implement wiki-level `index.md` generation: summary, source catalog with metadata, links to document/source/raw pages, tag/topic map, citations, and required frontmatter.
2. Implement top-level `index-of-indexes.md` generation: list of all wikis with title, slug, source count, page count, scope summary, links to each wiki-level index, search-oriented overview, and last-updated timestamp.
3. Implement `llm-wiki-cli ingest-all` to run `ingest` for every wiki in the workspace and update the top-level index.
4. Implement `llm-wiki-cli status` to report wikis, source counts, generated page counts, last ingestion, and warnings.
5. Implement JSON run logs in `.kimi-code/logs/YYYY-MM-DD_HH-MM-SS_<command>.json` with command, timestamp, workspace, wiki slugs, source files, chunk boundaries, pages generated, warnings, errors, status, CLI version, and config versions.
6. Implement an LLM client abstraction that supports OpenAI/Anthropic-style providers, records provider/model/estimated tokens/cost in the run log, and never sends raw PDFs.
7. Implement a local-only mode: when no LLM is configured, extraction and basic chunking still function; LLM-dependent planning/drafting may be skipped or produce minimal output.
8. Implement basic lint checks: broken wikilinks, citation integrity, schema compliance, and tag validity; emit a lint summary.
9. Write tests for indexes, `ingest-all`, `status`, run logs, and LLM client behavior.

## Technical Acceptance Criteria (TAC)

1. Wiki-level `index.md` has required frontmatter `title`, `type`, `updated`, `wiki`, and `sources`.
2. Wiki-level `index.md` contains links to every source page, every document page, and every raw page in the wiki.
3. `index-of-indexes.md` lists every wiki with title, slug, source count, page count, and a one-line scope summary; it links to each wiki-level index.
4. `ingest-all` processes every wiki in the workspace and regenerates the top-level index.
5. `status` reports the number of wikis, source files per wiki, generated pages per wiki, last ingestion timestamp, and any warnings.
6. Every CLI run writes a JSON log to `.kimi-code/logs/` containing command, timestamp, workspace, wiki slugs, source files, chunk boundaries, pages generated, warnings, errors, final status, CLI version, and config versions.
7. LLM calls record provider, model, estimated token usage, and estimated cost in the run log; raw PDFs are never transmitted.
8. When no LLM is configured, the CLI falls back to local-only operation and still produces valid extraction, source pages, and document pages.
9. Basic lint checks detect broken wikilinks, invalid citations, and missing required frontmatter; results are surfaced in the run log and CLI summary.

## UAT Acceptance Criteria (UAC)

1. A journalist can run `status` and see the workspace state at a glance.
2. A research AI agent can read `index-of-indexes.md`, choose a wiki, read the wiki-level index, and follow wikilinks to document and source pages with citations.
3. Run logs are machine-readable and contain enough information to reproduce the same ingestion given the same inputs and config.
4. Without an LLM configured, the CLI still works and produces a complete local wiki.

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
