# Fix Suggestions — E2E and Code/Product Analysis Findings

For each issue identified in `plan/e2e-bug-report.md`, at least two candidate fixes are listed below. Every suggestion has a **confidence score** (≥80%) and **pros/cons rooted in the Project Vision**. Suggestions that would violate the Project Vision or that had confidence below 80% were rejected and replaced.

---

## Issue 1 — RelationshipExtractor aborts on empty/invalid relationships

### Suggestion 1A: Accept empty relationships as a valid result
- **What:** Change `relationshipExtractor` in `src/orchestrator/agents.ts:778-809` so that a missing, empty, or all-filtered `relationships` array returns `{ relationships: [] }` instead of throwing. Keep the LLM call and parsing logic; only remove the terminal `throw`.
- **Confidence:** 95%
- **Verification:** Downstream consumers in `src/orchestrator/index.ts:64` and `src/orchestrator/ingest.ts:188` destructure `{ relationships }` and feed it into rolling memory, which already handles empty arrays. The E2E error `RelationshipExtractor returned invalid or empty output.` is eliminated.
- **Pros:**
  - Aligns with `Project Vision/04_orchestration_detailed.md` §4.4.3: the extractor finds relationships *when they exist*, not on every chunk.
  - Preserves the compounding principle: a chunk with no relationships still contributes entities and evidence to the wiki.
- **Cons:**
  - If the LLM consistently misses a real relationship, the pipeline will not surface it in that chunk. A later Critic pass (per `Project Vision/07_validation_and_quality.md`) is the right place to catch such omissions, not a hard abort.

### Suggestion 1B: Deterministic co-occurrence fallback
- **What:** When LLM output is empty/invalid, generate a baseline relationship for every pair of entities that appear in the same chunk or page, using a generic predicate such as `co-occurs in`. Validate subject/object against the canonical entity list.
- **Confidence:** 90%
- **Verification:** The fallback always produces a non-empty `RelationshipOutput`, so the abort path is never reached. The resulting relationships are still derived from LLM-extracted entities, so the knowledge graph keeps growing.
- **Pros:**
  - Satisfies `Project Vision/02_WIKI_concept_detailed.md` §2 (“no extracted data may be left out”) by ensuring entity co-occurrences are captured even when the LLM returns nothing.
  - Matches the resilience requirement in `Project Vision/07_validation_and_quality.md`.
- **Cons:**
  - Relationships may be generic/noisy, which slightly lowers the signal-to-noise ratio until the Critic or a human refines them.

---

## Issue 2 — No deterministic fallback for malformed/empty LLM output

### Suggestion 2A: Add a `callAgentWithFallback` helper and per-agent defaults
- **What:** Introduce a single wrapper (`callAgentWithFallback(prompt, options, fallback)`) in `src/orchestrator/agents.ts` that calls `llmClient.call`, parses the JSON, and returns the supplied fallback value if parsing fails or the result is semantically empty. Use it for every sub-agent (`StructureAnalyst`, `EntityExtractor`, `RelationshipExtractor`, `PagePlanner`, `ChunkWriter`, `EntityTopicPageWriter`).
- **Confidence:** 95%
- **Verification:** The fallback values are all valid return types (e.g., empty arrays for `entities`, a default page plan based on chunks, a document body synthesized from the chunk text), so downstream functions receive expected shapes and continue processing.
- **Pros:**
  - Directly implements `plan/IMPLEMENTATION_PLAN.md` §7.5: *“if still malformed, the chunk falls back to deterministic output.”*
  - Prevents the cascading aborts observed at `agents.ts:339, 429, 980, 1467, 1859`.
- **Cons:**
  - Requires a small, centralized change plus per-agent fallback definitions; slightly more code than a blanket try/catch.

### Suggestion 2B: Implement recovery-mode strategies (`abort`, `fallback`, `aggressive`)
- **What:** Make `resilience.recoveryMode` functional. In `fallback` mode, use deterministic fallbacks as above. In `abort` mode, keep the current `CLIError` behavior. In `aggressive` mode, skip the failing chunk and continue. Update `src/config.ts` to default to `fallback` and allow all three values.
- **Confidence:** 90%
- **Verification:** Changing the default to `fallback` matches the plan, and the strategy dispatch ensures the pipeline continues unless the user explicitly configures `abort`. This fixes the E2E failure under the default configuration.
- **Pros:**
  - Fully aligns with `plan/IMPLEMENTATION_PLAN.md` §7.5 default and allowed values.
  - Gives users explicit control over trade-offs between completeness and quality.
- **Cons:**
  - More implementation surface than a single fallback; `aggressive` mode requires careful logging so skipped data is visible.

---

## Issue 3 — Recovery mode defaults to `abort` and only `abort` is allowed

### Suggestion 3A: Change default to `fallback` and accept `fallback`/`aggressive`/`abort`
- **What:** Update `src/config.ts:122` to `recoveryMode: 'fallback'` and add `'fallback'` and `'aggressive'` to `allowedRecoveryModes` at `src/config.ts:320`. Implement the behavior mapping described in Suggestion 2B.
- **Confidence:** 95%
- **Verification:** The plan explicitly states the default is `fallback`; making the config match removes a hidden mismatch that currently forces every malformed LLM response to abort the run.
- **Pros:**
  - Directly realizes the resilience model described in `plan/IMPLEMENTATION_PLAN.md` §7.5 and `Project Vision/07_validation_and_quality.md`.
- **Cons:**
  - Requires coupling with the fallback strategy implementation; should be done together with Issue 2.

### Suggestion 3B: Default to `fallback` and implement only `fallback` for now
- **What:** Same as 3A, but keep `allowedRecoveryModes = ['abort', 'fallback']`. Add `aggressive` later if needed.
- **Confidence:** 90%
- **Verification:** Fixes the default mismatch immediately. The E2E uses the default mode, so the abort-on-error behavior disappears.
- **Pros:**
  - Smaller change than 3A; still satisfies the documented default.
- **Cons:**
  - Leaves `aggressive` unimplemented, which is a minor deviation from the plan but does not violate the core vision.

---

## Issue 4 — Chunk content is truncated before the LLM

### Suggestion 4A: Remove the 10,000-character truncation in the ChunkWriter prompt
- **What:** Delete `MAX_CHUNK_PROMPT_CHARS` and the `.slice(0, MAX_CHUNK_PROMPT_CHARS)` call in `src/orchestrator/agents.ts:1647-1655`. Pass the full chunk content to the LLM. Rely on the chunking layer to keep each chunk within the configured LLM context limit.
- **Confidence:** 95%
- **Verification:** `src/chunking/chunker.ts` already creates page-based chunks sized to `config.chunking.max_chunk_size`. If that configuration is honored, the prompt should fit. Removing the truncation lets the LLM see every word, table, and figure description.
- **Pros:**
  - Fully honors `Project Vision/02_WIKI_concept_detailed.md` §2: *“no extracted data may be left out”* and §4: *“The LLM must then turn this extracted material into markdown pages.”*
- **Cons:**
  - If a chunk is misconfigured to be larger than the LLM context window, the call may fail. The correct fix then is in chunking, not in truncating the prompt.

### Suggestion 4B: Split oversized chunks before the ChunkWriter instead of truncating
- **What:** If a chunk exceeds a safe prompt budget, split it only at page or section boundaries (never inside a table or figure) and invoke the ChunkWriter once per sub-chunk. Remove the static 10,000-character slice.
- **Confidence:** 85%
- **Verification:** The vision already requires page-based chunks and forbids splitting inside tables/figures. This approach respects that constraint while ensuring the LLM always sees the full text of each sub-chunk.
- **Pros:**
  - Preserves every word; respects context-window limits.
  - Keeps the LLM-call cost proportional to the document size.
- **Cons:**
  - More LLM calls for very large pages; requires careful handling of page-range metadata in the resulting document pages.

---

## Issue 5 — `source` and `raw` page bodies are written deterministically

### Suggestion 5A: Make the LLM author `source` and `raw` page bodies
- **What:** Move `writeSourcePage` and `writeRawPage` body generation into the LLM sub-agent pipeline (or a dedicated `SourcePageWriter` agent). Deterministic code still writes the file and the frontmatter, but the body text comes from the LLM.
- **Confidence:** 90%
- **Verification:** The body is an LLM output, so `AGENTS.md`’s authority matrix is satisfied. The provenance fields (`sha256`, `file`, `pages`) remain deterministic frontmatter, preserving the provenance anchor required by `Project Vision/06_citation_and_provenance.md`.
- **Pros:**
  - Fully satisfies `AGENTS.md`: *“No deterministic code may draft or mutate markdown bodies; the LLM is the sole author of all markdown content pages.”*
  - Keeps the source page as the provenance anchor described in `Project Vision/06_citation_and_provenance.md`.
- **Cons:**
  - Adds LLM calls for catalog pages, increasing cost and runtime.

### Suggestion 5B: LLM-drafted template + deterministic serialization
- **What:** Send a prompt to the LLM with the extracted source metadata and the required body schema; the LLM returns the body text. Deterministic code then merges that body with deterministic frontmatter and writes the file.
- **Confidence:** 85%
- **Verification:** The LLM produces the prose, but deterministic code never drafts or mutates it. This is exactly the same boundary used for document pages (`src/writers/document.ts`).
- **Pros:**
  - Clear separation of concerns: LLM authors, code serializes.
  - Minimal change to existing writers; mostly a prompt and call-site addition.
- **Cons:**
  - Still consumes LLM tokens for metadata-heavy pages.

---

## Issue 6 — Critic prompt misrepresents authorship

### Suggestion 6A: Rewrite the Critic prompt to make the LLM responsible for full content
- **What:** Remove the scope notes in `src/orchestrator/prompts/critic.md:108-112` that claim deterministic code appends source catalog and tables. Update the checklist to require the LLM to include those elements in the document page body.
- **Confidence:** 90%
- **Verification:** If the LLM is told it must produce the full content, the Critic will flag missing tables/figures, which drives the ChunkWriter to satisfy the no-data-loss rule.
- **Pros:**
  - Aligns with `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 1: the LLM writes all markdown content.
- **Cons:**
  - Larger document-page bodies may increase token usage and LLM call duration.

### Suggestion 6B: Remove the “do not flag absence” scope notes entirely
- **What:** Delete the two bullet scope notes and instruct the Critic to flag any missing extracted source context, tables, or figures as blocking issues unless they appear in the page body.
- **Confidence:** 90%
- **Verification:** The Critic checklist already includes `tables-figures-preserved` and `paragraphs-represented`; this change lets those checks actually bite.
- **Pros:**
  - Directly closes the gap between what the prompt says and what the code actually produces.
- **Cons:**
  - May produce more Critic issues initially until the ChunkWriter is improved (Issue 4). This is the intended feedback loop per `Project Vision/07_validation_and_quality.md`.

---

## Issue 7 — `sample` still exposes a single-PDF argument

### Suggestion 7A: Remove the optional `[path-to-pdf]` argument from `sample`
- **What:** Change the CLI signature to `sample <slug>` and always select the representative PDF from the corpus in `wikis/<slug>/raw/`. Remove the optional path handling from `src/commands/sample.ts`.
- **Confidence:** 85%
- **Verification:** The existing `selectRepresentativePdf` function already implements corpus-centric selection; making it the only path removes the document-centric UI.
- **Pros:**
  - Fully realizes the corpus-centric sampling described in `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §8.2 and fixes the gap called out in `plan/IMPLEMENTATION_PLAN.md` §2.2.
- **Cons:**
  - Users can no longer force a specific representative PDF from the CLI. If needed, they can temporarily move the desired PDF to the front of `raw/`.

### Suggestion 7B: Update the CLI help text and examples to emphasize corpus sampling
- **What:** Keep the optional path for advanced use, but rename the argument to `[representative-pdf]` and rewrite the description to say: *“Optional representative PDF from wikis/<slug>/raw/; if omitted, sample analyzes the entire corpus and chooses one.”* Update examples in `src/cli.ts` and `docs/USAGE.md`.
- **Confidence:** 80%
- **Verification:** The code already analyzes the corpus via `collectOtherPdfInfo`; the change is purely instructional, reducing the risk of users misinterpreting `sample` as single-document ingestion.
- **Pros:**
  - Low-risk, backward-compatible.
- **Cons:**
  - The document-centric interface remains, so the original vision gap is only partially closed.

---

## Issue 8 — TUI command and React/ink UI are not in the vision

### Suggestion 8A: Remove the TUI from the core CLI
- **What:** Delete `src/tui/`, `docs/TUI.md`, and the `tui` command registration in `src/cli.ts`. Remove the `ink` dependencies from `package.json` if they are unused.
- **Confidence:** 95%
- **Verification:** The remaining CLI commands match the list in `AGENTS.md` and `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` exactly.
- **Pros:**
  - Strict scope control; the delivered product matches the specified command set.
- **Cons:**
  - Any invested TUI work is discarded (can be recovered from Git history).

### Suggestion 8B: Move the TUI to a separate optional package or branch
- **What:** Keep the TUI code, but move it out of `src/` and into a separate package (e.g., `packages/llm-wiki-cli-tui`) or a feature branch. Keep `main` focused on the CLI commands defined in the vision.
- **Confidence:** 85%
- **Verification:** The core CLI repo no longer contains TUI code or dependencies, while the TUI remains available elsewhere.
- **Pros:**
  - Preserves the TUI work without expanding the core CLI’s scope.
- **Cons:**
  - Requires ongoing maintenance of a separate package/branch.

---

## Issue 9 — Debug and temporary files committed to the repository

### Suggestion 9A: Delete debug/temporary files and add them to `.gitignore`
- **What:** Remove `debug-*.ts`, `tmp*.ts`, `tmp-make-pdfs.cjs`, `diff.txt`, and any other ad-hoc files from the working tree and from tracking, then add patterns to `.gitignore` so they are not re-committed.
- **Confidence:** 95%
- **Verification:** The repo contains only source, tests, docs, and plan files, matching the layout described in `AGENTS.md`.
- **Pros:**
  - Keeps the repository clean and focused on the product.
- **Cons:**
  - Any genuinely useful debugging scripts should be moved to a `scripts/` or `tools/` folder with proper documentation.

### Suggestion 9B: Move debug scripts to a `tools/` folder with documentation
- **What:** Keep useful debugging scripts, but move them to `tools/` or `scripts/` and add a README explaining their purpose. Remove unused scratch files.
- **Confidence:** 85%
- **Verification:** The top-level and `src/` directories remain clean; tooling is still available for developers.
- **Pros:**
  - Preserves useful diagnostics while maintaining project hygiene.
- **Cons:**
  - Requires auditing each file to decide whether it is worth keeping.

---

## Issue 10 — Minor standards / code-quality issues

### Suggestion 10A: Replace `any[]` with proper types in page-info builders
- **What:** Add typed interfaces for the return values of `buildSourcePageInfos`, `buildDocumentPageInfos`, and `buildRawPageInfos` in `src/orchestrator/ingest.ts`, and replace the `any` parameter in `src/extractor/pdf.ts` with the correct `pdfjs-dist` page type.
- **Confidence:** 90%
- **Verification:** TypeScript compilation remains green; the code is more robust and easier to maintain.
- **Pros:**
  - Aligns with `AGENTS.md` strict-TypeScript rule and `Project Vision/07_validation_and_quality.md` quality goals.
- **Cons:**
  - Minor refactor effort; no functional change.

### Suggestion 10B: Replace custom `pathBasename` with Node.js `path.basename`
- **What:** Delete the `pathBasename` helper in `src/writers/document.ts:70-72` and use `path.basename` from the Node.js `path` module, which is already imported.
- **Confidence:** 95%
- **Verification:** `path.basename` handles both Windows and POSIX separators correctly; behavior is preserved and the code is shorter.
- **Pros:**
  - Follows `AGENTS.md` path-handling guidance and removes an unnecessary custom reimplementation.
- **Cons:**
  - None; this is a pure simplification.

---

## Rejected Suggestions (Not Presented)

The following ideas were rejected because they violated the Project Vision or had confidence below 80%:

- **Append full chunk text deterministically after the LLM body.** Rejected because deterministic code would be drafting a markdown body, which violates `AGENTS.md`’s LLM-authorship rule. Replaced by Suggestions 4A and 4B.
- **Keep the TUI and update the CLI help only.** Rejected because it does not resolve the scope-creep mismatch with the vision. Replaced by Suggestions 8A and 8B.
- **Retry the RelationshipExtractor once with a stricter prompt only.** Rejected because an LLM can legitimately return an empty relationship set for a chunk; retrying does not guarantee a non-empty result and is therefore low-confidence (<80%). Replaced by Suggestions 1A and 1B.
- **Change the recovery-mode default to `fallback` without implementing fallback behavior.** Rejected because it would make the default mode non-functional and fail validation. Replaced by Suggestions 2A/2B and 3A/3B.
