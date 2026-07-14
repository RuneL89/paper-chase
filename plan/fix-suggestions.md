# Fix Suggestions — E2E and Code/Product Analysis Findings

For each issue identified in `plan/e2e-bug-report.md`, at least two candidate fixes are listed below. Every suggestion has a **confidence score** (≥ 80%) and **pros/cons rooted in the Project Vision**. Suggestions that violate the Project Vision or have confidence below 80% were rejected and replaced.

---

## Issue 1 — `AGENTS.md` materializer description contradicts the implementation

### Suggestion 1A: Update the root `AGENTS.md` to describe the actual fallback append behavior
- **What it does:** Change the root `AGENTS.md` text to say that when preservation fails or the LLM batch call fails, the materializer appends a deterministic audit trace of the chunk to the existing page rather than skipping.
- **Confidence:** 90% — It is a one-line doc change that immediately removes the contradiction.
- **Verification:** Read `AGENTS.md` and `src/ingestion/chunk-materializer.ts`; confirm the described behavior matches the actual `appendChunkToEntityBody` / `appendChunkToTopicBody` calls.
- **Pros:**
  - Removes the stale/contradictory text required by the DOX closeout rule.
  - Keeps the current runtime behavior intact, so no regression risk.
- **Cons:**
  - Codifies a behavior that violates the authority matrix (deterministic code authoring markdown bodies).
  - Does not bring the implementation closer to the original Project Vision intent.

### Suggestion 1B: Remove the deterministic fallback append and truly skip updates on preservation/LLM failure
- **What it does:** Delete `appendChunkToEntityBody` and `appendChunkToTopicBody`, and change the materializer so that when preservation fails or the LLM batch fails it records the conflict and leaves the existing page untouched.
- **Confidence:** 85% — The code already has a skip path for manually-edited pages; extending it to preservation/LLM failures is a localized change.
- **Verification:** Run `npm run test` and the E2E; verify that no entity/topic page body contains deterministic bullet sections after a failed LLM batch or preservation failure.
- **Pros:**
  - Aligns the code with the root `AGENTS.md` and the authority matrix.
  - Preserves human edits and prevents deterministic code from drafting page bodies.
- **Cons:**
  - A chunk whose LLM update failed would be silently absent from the entity/topic pages unless the conflict is surfaced prominently.
  - Requires better conflict reporting (e.g., a lint report entry) so the user knows the page is stale.

---

## Issue 2 — Deterministic default bodies for `source` and `raw` pages when LLM is disabled

### Suggestion 2A: Remove the default body builders and require an enabled LLM
- **What it does:** Delete `buildDefaultSourcePageBody` and `buildDefaultRawPageBody`, and make `sourcePageWriter` / `rawPageWriter` return a placeholder object or throw a clear `CLIError` when the LLM is not enabled. The commands would fail fast with instructions to configure an LLM.
- **Confidence:** 90% — The CLI already blocks many operations when the LLM is disabled; this extends the same rule to all page writers.
- **Verification:** Set `provider: "test"` with no model, run `sample`, and confirm the command fails with a helpful message instead of producing deterministic bodies.
- **Pros:**
  - Fully enforces the hard boundary that the LLM authors all wiki page bodies.
  - Eliminates unreachable-but-tempting fallback code that could be accidentally used.
- **Cons:**
  - The CLI cannot produce any wiki pages in fully offline mode.
  - Users who only want skeleton files must still configure an LLM.

### Suggestion 2B: Replace default builders with frontmatter-only placeholders and a human-fill prompt
- **What it does:** When the LLM is disabled, emit a page whose YAML frontmatter contains all deterministic provenance fields (`pages`, `sha256`, `file`, etc.) and whose body is a single placeholder line such as `<!-- Human: fill in source/raw summary here -->`.
- **Confidence:** 85% — The writers already separate frontmatter from body; the body can be reduced to a comment or placeholder.
- **Verification:** Inspect generated `source`/`raw` pages with LLM disabled; confirm the body contains no synthesized claims, only a placeholder comment.
- **Pros:**
  - Preserves the provenance contract without having deterministic code invent factual prose.
  - Keeps the CLI usable for setup and offline cataloging.
- **Cons:**
  - The placeholder body still contains deterministic text, which technically falls under the “LLM authors bodies” boundary.
  - A human must later replace the placeholder for the page to be useful.

---

## Issue 3 — Corpus-centric `sample` does not fully classify and drive the corpus

### Suggestion 3A: Implement category-aware multi-PDF sampling
- **What it does:** Refactor `sampleCommand` so that `classifyCorpus` returns a concrete strategy, and the command executes it:
  - **similar-manageable:** fully read the first PDF and sample subsets of the remaining PDFs.
  - **similar-large:** fully read the first PDF and defer the rest to `ingest` (mark them as deferred in the chunking strategy).
  - **mixed / heterogeneous:** identify subgroups and sample one representative from each.
- **Confidence:** 85% — The classification logic exists; the missing piece is wiring it to extraction and chunking.
- **Verification:** Run `sample` on a wiki with multiple PDFs of different sizes; verify that the chunking strategy describes which PDFs were fully read, sampled, or deferred, and that more than one PDF contributes to the sample output.
- **Pros:**
  - Matches `Project Vision/01` §8.2 and the corpus-centric design intent.
  - Produces a more representative initial folder plan and taxonomy.
- **Cons:**
  - Increases `sample` runtime and complexity.
  - Requires careful state tracking so deferred PDFs are not skipped during `ingest`.

### Suggestion 3B: Use `classifyCorpus` output to adjust the chunking strategy for the remaining PDFs
- **What it does:** Keep sampling one representative PDF for the initial plan, but write the corpus classification into `chunking-strategy.md` and `config.json` so that `ingest` applies the appropriate per-PDF strategy to the rest of the collection.
- **Confidence:** 80% — The strategy writer already serializes the classification; the next step is consuming it in `ingest`.
- **Verification:** Inspect `chunking-strategy.md` and `config.json` after `sample`; run `ingest` and verify that each PDF is chunked according to its category.
- **Pros:**
  - Minimal change to `sample`; most work happens in `ingest` where the full corpus is processed anyway.
  - Avoids increasing `sample` runtime.
- **Cons:**
  - Does not make `sample` itself corpus-centric; the initial folder plan is still derived from one PDF.
  - Does not fully satisfy the vision’s expectation that `sample` analyzes the collection.

---

## Issue 4 — LLM-driven `source` and `raw` pages risk scope creep / provenance drift

### Suggestion 4A: Revert `source` and `raw` pages to deterministic provenance templates
- **What it does:** Remove the `sourcePageWriter` and `rawPageWriter` LLM agents and restore deterministic writers that produce frontmatter-only pages with a brief, fixed provenance block and no synthesized prose.
- **Confidence:** 90% — The provenance fields are already defined in `Project Vision/05` §5.1 and are deterministic by nature.
- **Verification:** Run `sample` and `ingest`; confirm `sources/<file>.md` contains only extraction metadata and a link to document pages, with no LLM-authored summaries.
- **Pros:**
  - Protects provenance integrity; metadata cannot be hallucinated or editorialized.
  - Aligns `source` and `raw` pages with their design as catalog entries and preserved fragments.
- **Cons:**
  - Catalog pages are less readable than LLM-synthesized summaries.
  - Removes the recent improvement that moved these pages under the LLM authorship boundary.

### Suggestion 4B: Keep LLM-driven prose but add deterministic validation for source pages
- **What it does:** After the LLM writes a `source` page, run a deterministic validator that checks every frontmatter field (`pages`, `sha256`, `file`, `title`, etc.) against the `ExtractionResult` and rejects any mismatch before the page is written.
- **Confidence:** 85% — The validation infrastructure already exists (`src/lint/` and `src/orchestrator/validation.ts`).
- **Verification:** Add a test where the LLM returns a source page with a wrong page count; confirm the writer retries or aborts rather than committing the page.
- **Pros:**
  - Retains helpful LLM summaries while guarding provenance fields.
  - Fits the Critic/validation pattern already used elsewhere.
- **Cons:**
  - Adds runtime overhead and another LLM round-trip on mismatch.
  - The LLM can still introduce editorial tone or unstated claims that are not caught by field validation.

---

## Issue 5 — LLM-driven `ChunkingPlanner` feedback loop is not requested

### Suggestion 5A: Remove the LLM feedback loop entirely
- **What it does:** Delete the oversized-chunk retry path that calls `chunkingPlanner` iteratively. Instead, enforce the chunk size policy deterministically and emit a warning if a single page exceeds `max_chunk_size`.
- **Confidence:** 90% — The vision explicitly states chunks are page-based and never split inside tables/figures; a warning is the cleanest deterministic response.
- **Verification:** Run `ingest` on a PDF with a very large page; confirm the chunk is emitted as one page, a warning is recorded, and no LLM is called for boundary planning.
- **Pros:**
  - Makes chunking reproducible and deterministic.
  - Preserves the authority boundary: LLM does not decide how to split documents.
- **Cons:**
  - A single oversized page may exceed downstream LLM context limits.
  - May require later work on context-window management.

### Suggestion 5B: Replace the LLM feedback loop with a deterministic rule-based shrinker
- **What it does:** If a chunk exceeds the maximum size, deterministically reduce `max_chunk_size` (e.g., halve it) and re-run the same deterministic split algorithm until the chunk fits or a minimum size is reached. No LLM is involved.
- **Confidence:** 85% — The existing loop structure can be reused; only the planner call is replaced with a deterministic size adjustment.
- **Verification:** Add a chunking test with an oversized synthetic chunk; confirm the loop shrinks the size and exits deterministically without calling an LLM.
- **Pros:**
  - Keeps the existing oversized-chunk handling code path.
  - Respects the deterministic boundary while still trying to fit chunks within limits.
- **Cons:**
  - Halving a page-based chunk size does not actually split a page, so the loop may never resolve for a single huge page.
  - The logic may need to fall back to a warning anyway.

---

## Issue 6 — `outputDir` is a misleading name after `output.dir` removal

### Suggestion 6A: Rename `outputDir` to `wikiDir` everywhere
- **What it does:** Replace every local `const outputDir = wikiDir;` with `const wikiDir = wikiPath(workspace, slug);` and rename parameters/variables accordingly in `engine.ts`, `reingest.ts`, `chunk-materializer.ts`, `orchestrator/ingest.ts`, etc.
- **Confidence:** 95% — A pure rename with no behavior change; TypeScript will catch any missed references.
- **Verification:** Run `npm run build` and `npm run test`; confirm no references to `outputDir` remain.
- **Pros:**
  - Makes the co-location rule obvious from variable names.
  - Low risk; compiler verifies completeness.
- **Cons:**
  - Touch-only change; does not improve the path-helper structure.

### Suggestion 6B: Introduce a single `wikiContentDir` helper and use it everywhere
- **What it does:** Add `wikiContentDir(workspace, slug)` to `src/workspace.ts` that returns the wiki directory (or a dedicated helper for content paths), and replace all inline path joins with it.
- **Confidence:** 90% — `workspace.ts` already centralizes path helpers; adding one more is consistent with existing patterns.
- **Verification:** Grep for `path.join(wikiPath(...` and `outputDir`; confirm all content paths use the helper.
- **Pros:**
  - Centralizes the co-location rule in one place.
  - Reduces future shotgun surgery when the layout changes.
- **Cons:**
  - Slightly more abstraction; readers must look up the helper.

---

## Issue 7 — Duplicated oversized-chunk filter in `chunker.ts`

### Suggestion 7A: Extract the oversized filter into a local helper
- **What it does:** Define a small function like `isChunkOversized(chunk, maxSize)` inside `chunker.ts` and call it from both the feedback loop and the post-loop check.
- **Confidence:** 95% — Trivial refactor with a single definition and two call sites.
- **Verification:** Read `chunker.ts`; confirm both checks use the same helper and tests still pass.
- **Pros:**
  - Single source of truth for the oversized threshold.
  - Prevents accidental divergence if the threshold changes.
- **Cons:**
  - Very small win; only reduces duplication.

### Suggestion 7B: Restructure the loop to compute oversized once per iteration
- **What it does:** Refactor the feedback loop so that the oversized flag is computed at the top of each iteration and used to decide whether to shrink and retry or to exit and report.
- **Confidence:** 90% — A local control-flow refactor; behavior stays the same.
- **Verification:** Step through the chunker logic with an oversized chunk; confirm the loop terminates with the same result.
- **Pros:**
  - Eliminates the duplicated expression by design.
  - Makes the loop invariant explicit.
- **Cons:**
  - Slightly more invasive than a helper extraction.
  - No functional improvement beyond code clarity.

---

## Issue 8 — `output.dir` removal scattered across many files

### Suggestion 8A: Introduce a `wikiContentDir` helper as the single source of truth
- **What it does:** Add `wikiContentDir(workspace, slug)` to `src/workspace.ts` and replace every place that previously constructed `path.join(wikiDir, ...)` or `outputDir` with the helper. Include `entities/`, `topics/`, `documents/`, `sources/`, `raw/`, and `lint/` subpaths.
- **Confidence:** 90% — The helper pattern is already used elsewhere in `workspace.ts` for `wikiPath`, `rawDir`, etc.
- **Verification:** Grep for `outputDir` and `path.join(wikiPath`; confirm all content paths are routed through `wikiContentDir` and tests pass.
- **Pros:**
  - Centralizes the co-location layout rule.
  - Reduces future shotgun surgery and inconsistency.
- **Cons:**
  - Requires a broad refactor across many files.
  - Slightly more abstraction for simple paths.

### Suggestion 8B: Add a custom ESLint / project lint rule that flags direct path construction
- **What it does:** After centralizing paths in a helper, add a lightweight lint rule (or a grep-based check in `npm run build`) that fails if code constructs wiki content paths directly instead of using `workspace.ts` helpers.
- **Confidence:** 80% — A grep-based check is easy; a full ESLint rule requires more setup but is feasible.
- **Verification:** Temporarily add a direct `path.join` in a source file and confirm the build/lint check fails.
- **Pros:**
  - Prevents regression and keeps the helper pattern enforced.
  - Low ongoing maintenance once the rule is in place.
- **Cons:**
  - Does not fix existing code on its own; must be paired with Suggestion 8A.
  - Adds tooling complexity.

---

## Issue 9 — [BLOCKING] ChunkWriter fails on the first sample with unparseable LLM output

### Suggestion 9A: On ChunkWriter failure, emit a raw preservation page and continue
- **What it does:** When `chunkWriterForChunk` cannot produce parseable JSON after the repair attempt, write the chunk’s extracted content to a `raw/` page with a `warning` frontmatter field explaining that the LLM could not synthesize it, and continue the pipeline without aborting.
- **Confidence:** 85% — The raw-page writer already preserves fragments; adding a failure-handling branch is a localized change.
- **Verification:** Run the E2E on `Abstract-Examples.pdf`; confirm the pipeline no longer aborts and a raw page contains the table content.
- **Pros:**
  - Preserves the extracted data (Project Vision/02 §2: *“no extracted data may be left out”*).
  - Respects the authorship boundary: deterministic code only preserves a fragment, it does not author a document page.
- **Cons:**
  - The document page is missing; downstream source-page links may be broken.
  - Requires updating source-page generation to tolerate missing document pages.

### Suggestion 9B: Shrink the ChunkWriter prompt by passing a structured summary instead of the full chunk content
- **What it does:** Replace the full `chunk.content` in the ChunkWriter prompt with a structured summary extracted by deterministic code (headings, paragraph snippets, table row counts, caption text, page range). The LLM still writes the page body, but it no longer receives the entire raw table.
- **Confidence:** 90% — The prompt is already large; reducing the input size directly addresses the likely cause of the unparseable JSON failure.
- **Verification:** Log the prompt token count before and after the change; run the E2E and confirm ChunkWriter returns valid JSON.
- **Pros:**
  - Reduces model overload and improves JSON adherence.
  - Keeps the LLM as the author of document pages.
- **Cons:**
  - The LLM may lose some detail needed for accurate table transcription.
  - Requires careful summary design to avoid dropping important claims.

### Suggestion 9C: Harden the parser and repair prompt for markdown-fenced JSON
- **What it does:** Update `parseChunkWriterJson` to strip common markdown fences (```json ... ```) and trailing comments before parsing. Update the repair prompt to explicitly request a single JSON object matching the schema, with a smaller example, and to forbid any prose outside the JSON.
- **Confidence:** 85% — Many LLM JSON failures are caused by fences or prose wrappers; a stricter parser/repair prompt fixes the common cases.
- **Verification:** Add unit tests with fenced, partial, and prose-wrapped JSON; confirm they parse correctly after the fix.
- **Pros:**
  - Addresses the most common LLM output issues without changing the overall architecture.
  - Minimal change to the existing retry logic.
- **Cons:**
  - Does not help if the root cause is prompt overload.
  - Still allows a single LLM failure to abort the run if the hardened parser is not enough.

---

## Summary Table

| Issue | Primary Recommendation | Confidence | Vision Impact |
|---|---|---|---|
| 1 | 1B — Remove fallback append, truly skip updates | 85% | Restores authorship boundary |
| 2 | 2A — Remove default body builders, require LLM | 90% | Enforces hard LLM-authorship boundary |
| 3 | 3A — Implement category-aware multi-PDF sampling | 85% | Matches corpus-centric vision |
| 4 | 4A — Revert source/raw to deterministic templates | 90% | Protects provenance integrity |
| 5 | 5A — Remove LLM feedback loop | 90% | Makes chunking deterministic |
| 6 | 6B — Introduce `wikiContentDir` helper | 90% | Centralizes co-location rule |
| 7 | 7A — Extract oversized helper | 95% | Removes duplication |
| 8 | 8A — Introduce `wikiContentDir` helper | 90% | Reduces shotgun surgery |
| 9 | 9B — Shrink ChunkWriter prompt + 9C — Harden parser | 90% / 85% | Unblocks E2E while keeping LLM authorship |

**No source-code changes have been made.** These suggestions are ready for your review and explicit approval before implementation.
