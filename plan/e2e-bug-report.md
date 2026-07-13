# E2E Bug Report — LLM Wiki CLI v2.0

**Date:** 2026-07-13  
**E2E workspace:** `C:\temp\wiki-e2e-6W9oRs`  
**Source PDFs:** `C:\Users\atavi\Documents\test ingest`  
**Test scope:** Full `init` → `sample` → `ingest` cycle for three wikis, one per PDF, with LLM config from `C:\Users\atavi\Documents\config.json`.  
**Codebase:** `C:\Users\atavi\Projects\Wiki v4`, working tree clean, built successfully with `npm run build`.

## E2E Execution Summary

1. All three `init` commands succeeded.
2. All three PDFs were copied into the respective `raw/` folders.
3. `sample abstract-examples` failed with:
   ```
   RelationshipExtractor returned invalid or empty output.
   ```
   originating from `src/orchestrator/agents.ts:808`.
4. Per `AGENTS.md` E2E rules, the run stopped at the first failure. `sample` for the remaining wikis and all `ingest` commands were **not** executed.

## Methodology

- Verified working tree cleanliness (`git status --short` returned empty).
- Compared the implementation diff from `c0539c1` (pre-sprint baseline) to `HEAD` against:
  - `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` through `07_validation_and_quality.md`
  - `plan/IMPLEMENTATION_PLAN.md`
  - `plan/SPRINT_INSTRUCTIONS.md`
  - `AGENTS.md` (coding standards / authority matrix)
- Ran the full code-review process (Standards and Spec axes) over the same diff.
- Did **not** modify any source code, tests, or documentation to continue the run.

## Issues Found

### 1. [BLOCKING] RelationshipExtractor aborts when no relationships are found

- **Severity:** Critical (blocks the E2E pipeline)
- **Location:** `src/orchestrator/agents.ts:778-809`
- **Root cause:**
  - `relationshipExtractor` parses the LLM response and immediately throws a `CLIError` if `parsed.relationships` is missing, empty, or if all normalized relationships are filtered out (e.g., subject/object not in the extracted entity list).
  - The `normalizeRelationship` function also discards any relationship whose subject or object is not exactly in the entity list, so even a valid LLM output can result in an empty set and trigger the abort.
- **Why this violates the vision:**
  - `Project Vision/04_orchestration_detailed.md` describes the RelationshipExtractor as finding relationships *when they exist*, not requiring them on every chunk.
  - `Project Vision/02_WIKI_concept_detailed.md` states that **no extracted data may be left out**; aborting an entire chunk because no relationship was found loses the rest of that chunk's content.
  - `plan/IMPLEMENTATION_PLAN.md` §7.5 says the default recovery mode should be `fallback`, not `abort`.

### 2. No deterministic fallback for malformed or empty LLM output

- **Severity:** High
- **Location:** `src/orchestrator/agents.ts:339, 429, 808, 980, 1467, 1859`
- **Root cause:**
  - Every LLM sub-agent (`StructureAnalyst`, `EntityExtractor`, `RelationshipExtractor`, `PagePlanner`, `ChunkWriter`, `EntityTopicPageWriter`) throws a `CLIError` when the LLM response cannot be parsed or is semantically empty.
  - The JSON parser (`src/llm/json.ts`) tries to repair malformed JSON, but there is no retry with a stricter prompt, and no fallback to deterministic output when repair fails.
- **Why this violates the vision:**
  - `plan/IMPLEMENTATION_PLAN.md` §7.5 explicitly requires: *“Malformed JSON is retried once with a stricter prompt; if still malformed, the chunk falls back to deterministic output.”*
  - `Project Vision/07_validation_and_quality.md` requires a resilient pipeline; an unparseable response from one chunk should not kill the entire ingestion.

### 3. Recovery mode defaults to `abort` and only `abort` is allowed

- **Severity:** High
- **Location:** `src/config.ts:122` (default), `src/config.ts:320-323` (validation)
- **Root cause:**
  - `defaultConfig.resilience.recoveryMode` is set to `'abort'`.
  - `validateConfig` only allows `'abort'` in the `allowedRecoveryModes` array.
- **Why this violates the vision:**
  - `plan/IMPLEMENTATION_PLAN.md` §7.5 states: *“Recovery mode is configurable per wiki (`aggressive`, `fallback`, `abort`). Default: `fallback`.”*
  - Defaulting to `abort` makes the malformed-JSON fallback required by the plan unreachable in practice.

### 4. Chunk content is truncated before the LLM

- **Severity:** High
- **Location:** `src/orchestrator/agents.ts:1647-1655`
- **Root cause:**
  - `buildChunkWriterPrompt` slices chunk content to `MAX_CHUNK_PROMPT_CHARS = 10000` characters before sending it to the LLM.
  - The final document page (`src/writers/document.ts`) stores only the LLM-authored `body`; it does not append the full original chunk text.
- **Why this violates the vision:**
  - `Project Vision/02_WIKI_concept_detailed.md` §2: *“The most important rule of the wiki is that no extracted data may be left out.”*
  - `Project Vision/02_WIKI_concept_detailed.md` §4: *“The LLM must then turn this extracted material into markdown pages. It is not allowed to … summarize it in a way that removes detail, or to omit a table because it is complicated.”*
  - Truncating the chunk before the LLM means the LLM cannot faithfully transcribe or cite anything beyond the first 10,000 characters.

### 5. `source` and `raw` page bodies are written deterministically

- **Severity:** Medium–High
- **Location:** `src/writers/source.ts`, `src/writers/raw.ts`
- **Root cause:**
  - `writeSourcePage` and `writeRawPage` construct the entire markdown body deterministically (`bodyLines`) and write it with `gray-matter`.
- **Why this violates the standards:**
  - `AGENTS.md` authority matrix: *“No deterministic code may draft or mutate markdown bodies; the LLM is the sole author of all markdown content pages.”*
  - `AGENTS.md` also states: *“Deterministic code writes only DOX index/contract files and orchestration metadata.”*
  - This creates a direct conflict with `Project Vision/06_citation_and_provenance.md`, which says every source PDF has a source page as a provenance anchor. That conflict must be resolved explicitly in either the standard or the implementation.

### 6. Critic prompt misrepresents authorship

- **Severity:** Medium
- **Location:** `src/orchestrator/prompts/critic.md:108-112`
- **Root cause:**
  - The Critic prompt tells the LLM: *“The full source catalog, extracted source context, and preserved tables are appended by deterministic code after drafting, so do not flag their absence from this context.”*
- **Why this violates the vision:**
  - This contradicts `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 1: *“The LLM writes all markdown content … deterministic code … never drafts or mutates markdown bodies.”*
  - In practice, the full extracted text is **not** appended to document pages (see Issue 4), so the Critic is being told not to flag a gap that actually exists.

### 7. `sample` still exposes a single-PDF argument

- **Severity:** Low–Medium
- **Location:** `src/cli.ts:62-70`, `src/commands/sample.ts`
- **Root cause:**
  - The CLI signature remains `sample <slug> [path-to-pdf]`, with the optional path defaulting to the first PDF in `raw/`.
- **Why this violates the vision:**
  - `plan/IMPLEMENTATION_PLAN.md` §2.2 identified the old `sample` as *“document-centric, not corpus-centric”* and the vision expects `sample` to analyze the whole corpus (`Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §8.2).
  - The implementation does classify the corpus when the optional path is supplied, but the CLI interface still perpetuates the document-centric mental model.

### 8. TUI command and React/ink UI are not in the vision

- **Severity:** Low (scope creep)
- **Location:** `src/tui/`, `docs/TUI.md`, `src/cli.ts:102-104`
- **Root cause:**
  - A full terminal UI (`llm-wiki-cli tui`) was added to the CLI and documented.
- **Why this violates the vision:**
  - `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` and the CLI command list in `AGENTS.md` list only `init, sample, ingest, ingest-all, status, configure-llm, test-llm`. No TUI is specified.

### 9. Debug and temporary files are committed to the repository

- **Severity:** Low
- **Location:** `debug-*.ts`, `tmp*.ts`, `tmp-make-pdfs.cjs`, `diff.txt`
- **Root cause:**
  - These files appear in the diff from `c0539c1` to `HEAD` and are tracked in `main`.
- **Why this matters:**
  - They are not source code, tests, or documentation. They clutter the repo, increase the diff size, and could be mistaken for production code.

### 10. Minor standards / code-quality issues

- **Severity:** Low
- **Location:** `src/orchestrator/ingest.ts` (`any[]` return types), `src/extractor/pdf.ts` (`any` parameter), `src/writers/document.ts` (custom `pathBasename` reimplementing `path.basename`)
- **Root cause:**
  - Use of `any` and reimplementation of Node.js path helpers despite `AGENTS.md` strict-TypeScript rule.

## Cross-Cutting Observations

- The **LLM sub-agent pipeline is brittle**: every agent aborts on empty or malformed output rather than degrading gracefully. This makes the entire ingestion dependent on every LLM call returning perfect JSON, which is unrealistic for production PDFs.
- The **chunk-writer truncation** undermines the project's central promise that no extracted data is lost.
- The **authorship boundary** between deterministic code and the LLM is inconsistent: some content pages (`source`, `raw`) are deterministic, some are LLM-authored, and the Critic prompt was written to excuse content that is not actually present in document pages.

## Recommended Next Steps (Pending User Approval)

1. Resolve the RelationshipExtractor abort and malformed-JSON fallback so the E2E can run to completion.
2. Decide whether `source`/`raw` page bodies should remain deterministic or become LLM-authored, and document that decision in `AGENTS.md`.
3. Remove chunk truncation or guarantee the full chunk is preserved in the final document page.
4. Reconcile the Critic prompt with the chosen authorship model.
5. Decide whether the TUI and optional `sample` path should remain, and update the vision/standard if so.
6. Clean up committed debug/temporary files.

See `plan/fix-suggestions.md` for at least two candidate fixes per issue, with confidence scores and pros/cons.
