# E2E Bug Report — LLM Wiki CLI v2.0

**Date:** 2026-07-14  
**E2E workspace:** `C:\temp\wiki-e2e-20260714`  
**Source PDFs:** `C:\Users\atavi\Documents\test ingest`  
**LLM config:** `C:\Users\atavi\Documents\config.json` (provider: `kimi`, model: `k2.7-code`, baseUrl: `https://api.kimi.com/coding`, enabled: `true`)  
**Codebase:** `C:\Users\atavi\Projects\Wiki v4`, working tree **dirty**, branch `feat/fix-12-issues`, `npm run build` **succeeded**.

---

## Pre-Run Checks

| Check | Result |
|---|---|
| PDF `Abstract-Examples.pdf` | Exists, 362,463 bytes (~354 KB) |
| PDF `Corporate Governance Guidelines as of February 20, 2025.pdf` | Exists, 186,850 bytes (~183 KB) |
| PDF `wipo_pub_rn2021_18e.pdf` | Exists, 1,308,911 bytes (~1.3 MB) |
| LLM config | Exists, provider `kimi`, model `k2.7-code`, enabled |
| `npm run build` | Succeeded (tsc only, no test run) |
| Git status | Dirty — see below. Per user instruction, E2E proceeds with dirty tree. |

### Dirty working tree (recorded because `AGENTS.md` normally requires a clean tree)

```
 M "Project Vision/07_validation_and_quality.md"
 M plan/IMPLEMENTATION_PLAN.md
 M plan/e2e-bug-report.md
 M plan/fix-suggestions.md
n M tests/chunking/chunker.test.ts
 M tests/commands/ingest-all.test.ts
 M tests/entities/disambiguation.test.ts
 M tests/fixtures/*.pdf
 M tests/orchestrator/agents.test.ts
 M tests/orchestrator/contracts.test.ts
 M tests/orchestrator/proposals.test.ts
 M tests/orchestrator/sampling.test.ts
 M tests/writers/document.test.ts
```

No `src/` files are modified, so the runtime code under test matches the latest commit on `feat/fix-12-issues`.

---

## E2E Execution Summary

1. Created a fresh workspace in `C:\temp\wiki-e2e-20260714`.
2. Copied `C:\Users\atavi\Documents\config.json` to `<workspace>\.kimi-code\config.json`.
3. Initialized the first wiki: `abstract-examples`.
4. Copied `Abstract-Examples.pdf` into `wikis/abstract-examples/raw/`.
5. Ran `sample abstract-examples`.
6. The command failed at the **ChunkWriter** step with:
   ```
   ChunkWriter returned invalid or unparseable output after one repair attempt.
   ```
   originating from `src/orchestrator/agents.ts:96` (`callAgentWithRepair`).
7. Per the E2E gate in `AGENTS.md`, the run stopped at the first failure. No further `sample` or `ingest` commands were executed.

### Observed partial output

- The wiki skeleton was created: `index.md`, `AGENTS.md`, `chunking-strategy.md`, `config.json`, `documents/`, `sources/`, `raw/`.
- The PDF was copied to `raw/`.
- `chunking-strategy.md` shows the document has 3 physical pages, 3 tables, 1 multi-page table, and was grouped into a single chunk (pages 1-3) because the table spans the entire document.
- No document pages, source pages, or raw pages were written; the `documents/` and `sources/` folders are empty.

---

## Methodology

- Followed `plan/SPRINT_INSTRUCTIONS.md` §3.5 with the substitution of the three PDFs from `C:\Users\atavi\Documents\test ingest`.
- Did not modify source code, tests, or documentation to continue after a failure.
- Compared the implementation against:
  - `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` through `07_validation_and_quality.md`
  - `plan/IMPLEMENTATION_PLAN.md`
  - `plan/SPRINT_INSTRUCTIONS.md`
  - `AGENTS.md` (workspace standards and authority matrix)
- Ran the `code-review` skill against `main` with the Project Vision and Implementation Plan as the spec source.

---

## Issues Found

### 1. [HIGH] `AGENTS.md` materializer description contradicts the implementation

- **Severity:** High
- **Location:** `AGENTS.md` (root) and `src/ingestion/chunk-materializer.ts:225-236` / `311-334`
- **Root cause:** The root `AGENTS.md` says: *“If preservation fails or the page was manually edited, the materializer reports the conflict and skips the update so the human edit is not overwritten.”* In the code, when preservation fails or the LLM batch call fails, the materializer appends a deterministic fallback body (`appendChunkToEntityBody` / `appendChunkToTopicBody`) instead of skipping.
- **Why this violates the vision:** `AGENTS.md` Closeout rule requires removing stale or contradictory text immediately. The authority matrix says deterministic code must not draft or mutate wiki page bodies; the fallback append functions synthesize markdown section headings and bullets.

### 2. [HIGH] Deterministic default bodies for `source` and `raw` pages when LLM is disabled

- **Severity:** High
- **Location:** `src/writers/source.ts:16-46` (`buildDefaultSourcePageBody`), `src/writers/raw.ts:6-18` (`buildDefaultRawPageBody`), and `src/orchestrator/agents.ts:1871-1872` / `1957-1958` where the writers return these defaults when `!llmClient.isEnabled()`.
- **Root cause:** The LLM-driven `sourcePageWriter` and `rawPageWriter` fall back to deterministic body builders when the LLM is disabled, and those builders remain reachable functions even when the LLM is enabled.
- **Why this violates the vision:** `AGENTS.md` hard boundary: *“LLM agents never compute SHA-256 or perform file I/O directly; the LLM authors all wiki page bodies.”* `Project Vision/01` §3 Principle 1 says deterministic code never drafts or mutates markdown bodies.

### 3. [HIGH] Corpus-centric `sample` does not fully classify and drive the corpus

- **Severity:** High
- **Location:** `src/commands/sample.ts:41-56`
- **Root cause:** The command classifies the corpus (`classifyCorpus`) but still extracts and samples only a single representative PDF (`selectRepresentativePdf`). The corpus classification is not used to drive the category-specific strategies from `Project Vision/01` §8.2 (e.g., read one document fully and sample subsets of the rest for similar-manageable documents, or read the first document fully and defer the rest for similar-large documents).
- **Why this violates the vision:** `Project Vision/01` §8.2 expects `sample` to analyze the PDFs in `raw/` and choose a sampling strategy appropriate to the collection; the current implementation is still document-centric at the extraction level.

### 4. [MEDIUM] LLM-driven `source` and `raw` pages risk scope creep / provenance drift

- **Severity:** Medium
- **Location:** `src/orchestrator/agents.ts:1859-1887` (`sourcePageWriter`), `1946-1974` (`rawPageWriter`), plus prompts `src/orchestrator/prompts/source-page-writer.md` and `src/orchestrator/prompts/raw-page-writer.md`.
- **Root cause:** The diff adds two new LLM agents outside the specified seven-agent pipeline to author catalog and raw pages. While this addresses the authorship boundary, `Project Vision/02` §6.4 and §6.5 frame `source` and `raw` pages as deterministic catalog entries / preserved fragments, not as LLM-authored content.
- **Why this violates the vision:** `Project Vision/05` §5.1 specifies deterministic provenance fields for `source` pages. Allowing the LLM to write the prose of a provenance page risks hallucinated metadata or editorialized provenance, which conflicts with the citation-backed principle.

### 5. [MEDIUM] LLM-driven `ChunkingPlanner` feedback loop is not requested

- **Severity:** Medium
- **Location:** `src/chunking/chunker.ts` (oversized-chunk feedback loop)
- **Root cause:** The chunker iteratively shrinks `max_chunk_size` and asks the LLM for finer split boundaries when a chunk is too large. `Project Vision/01` §3 Principle 5 requires page-based chunks and never splitting inside a table/figure; the LLM feedback loop introduces LLM influence into what is supposed to be a deterministic audit trail (`IMPLEMENTATION_PLAN` §2.2).
- **Why this violates the vision:** Chunking strategy should be deterministic per the vision; adding an LLM feedback loop blurs the boundary and could produce non-reproducible splits.

### 6. [LOW] `outputDir` is a misleading name after `output.dir` removal

- **Severity:** Low (code smell)
- **Location:** `src/ingestion/reingest.ts`, `src/orchestrator/ingest.ts:284-286`, `src/ingestion/engine.ts`, etc.
- **Root cause:** After `output.dir` was removed, `const outputDir = wikiDir;` is used in several places. The variable name implies a separate output directory, but it is now always the wiki directory.
- **Why this violates the standards:** The code should use honest names; `wikiDir` or `contentDir` would make the co-location rule obvious.

### 7. [LOW] Duplicated oversized-chunk filter in `chunker.ts`

- **Severity:** Low (code smell)
- **Location:** `src/chunking/chunker.ts`
- **Root cause:** The same oversized-chunk expression is computed twice: once inside the feedback loop and once as `stillOversized` after the loop.
- **Why this violates the standards:** Duplicated code increases the risk of inconsistent logic when the oversized threshold changes.

### 8. [LOW] `output.dir` removal scattered across many files

- **Severity:** Low (code smell)
- **Location:** `src/ingestion/engine.ts`, `reingest.ts`, `chunk-materializer.ts`, `orchestrator/ingest.ts`, `lint/index.ts`, `writers/log.ts`, etc.
- **Root cause:** Path construction logic was updated in many files to remove the configurable `output.dir` prefix.
- **Why this violates the standards:** A single `wikiContentDir` helper would make the co-location rule live in one place and reduce future shotgun surgery.

### 9. [BLOCKING] ChunkWriter fails on the first sample with unparseable LLM output

- **Severity:** Blocking — stops the E2E pipeline on the first PDF.
- **Location:** `src/orchestrator/agents.ts:96` (`callAgentWithRepair` → `ChunkWriter`), `src/orchestrator/agents.ts:1840-1855` (`chunkWriterForChunk`), `src/orchestrator/agents.ts:2224-2230` (`parseChunkWriterJson`).
- **Root cause:**
  - The ChunkWriter prompt (`buildChunkWriterPrompt`, `src/orchestrator/agents.ts:2070-2222`) is very large: it includes the full extracted chunk content, the page plan, AGENTS.md, rolling memory, and a JSON schema example.
  - For `Abstract-Examples.pdf`, the entire 3-page document is a single chunk containing a multi-page table. The prompt may exceed the comfortable JSON-generation context for the model, or the model may return the body wrapped in markdown fences, partial JSON, or malformed keys.
  - `parseChunkWriterJson` only accepts the response if `parseStructuredJson` succeeds and `parsed.pages` is an array. Any deviation (e.g., top-level object with no `pages` array, markdown fences, trailing commas, or generated text outside JSON) is rejected.
  - `callAgentWithRepair` retries once with the same prompt plus a generic "return only valid JSON" instruction. If the model’s first failure is due to prompt overload or schema confusion, the repair attempt usually repeats the same mistake rather than correcting it.
  - There is no deterministic fallback to emit a valid document page when the LLM cannot produce parseable JSON, so the entire `sample` command aborts.
- **Why this violates the vision:**
  - `Project Vision/02_WIKI_concept_detailed.md` §2: *“The most important rule of the wiki is that no extracted data may be left out.”* Aborting the run means none of the extracted content reaches the wiki.
  - `Project Vision/07_validation_and_quality.md` §7 requires resilient LLM handling: *“If a chunk or LLM agent failed validation, the system retries once with a stricter repair prompt. If the repaired output was still invalid, the run aborted and the error was reported to the user.”* While one retry is present, the repair prompt does not address the root cause (oversized/confusing prompt), so the retry is ineffective.
  - `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 1 expects the LLM to write the markdown, but the deterministic pipeline should still produce a usable output even when the LLM returns malformed JSON.


