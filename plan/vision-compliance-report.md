# LLM Wiki CLI — Vision Compliance Report

**Date:** 2026-07-14  
**Scope:** Implementation code (`src/`, `tests/`) compared against the updated Project Vision documents in `Project Vision/` and the root `AGENTS.md`.  
**Method:** Read the updated vision docs, followed the DOX child contracts (`src/AGENTS.md`, `src/orchestrator/AGENTS.md`, `src/ingestion/AGENTS.md`) as the roadmap, and inspected key implementation files.

---

## Executive Summary

The updated Project Vision now states that:

1. The **LLM is the sole author** of all markdown page bodies; deterministic code must not author markdown as a fallback.
2. **Structural changes are LLM-driven**; new folders and reorganizations are applied autonomously and logged for human review, with no approval gate.
3. The **ChunkMaterializer** uses preservation-first updates: if the LLM rewrite drops citations/wikilinks, or if a page was manually edited, the materializer **skips** the update and reports the conflict.
4. **Entity pages** are grouped under typed sub-folders (`entities/<subfolder>/<slug>.md`).
5. **No deterministic fallback** on LLM failure — retry once, then abort.

The implementation now follows the updated vision. All critical and high-severity findings have been resolved across Phases 1–8. The full test suite passes (`248 tests, 39 files`), and `npm run build` completes without errors. Focused integration tests via the existing test suite cover autonomous structural changes, preservation-first reingest, and frontmatter integrity.

---

## Findings

### 1. ChunkMaterializer authors markdown deterministically

**Severity:** `critical`

**Files:**
- `src/ingestion/chunk-materializer.ts` lines 224–237, 253–267, 269–308, 311–334
- `src/ingestion/chunk-materializer.ts` helpers `appendChunkToEntityBody` (lines 397–418) and `appendChunkToTopicBody` (lines 420–432)

**Observed behavior:**
- When the LLM rewrite fails the preservation check, the code falls back to `appendChunkToEntityBody`/`appendChunkToTopicBody` and writes the page.
- When the LLM update call throws, the catch block appends the same deterministic stub to every affected entity and topic page.
- When a page is manually edited, the code also appends deterministically instead of skipping the update.

**Expected behavior per vision:**
- `Project Vision/04_orchestration_detailed.md` Step 6: preservation failures must be reported and the update skipped.
- `Project Vision/07_validation_and_quality.md` Section 3: if the LLM update fails, retry the same LLM call; never fall back to deterministic authoring; abort if repair fails.
- `root AGENTS.md` User Preferences: no deterministic fallback on LLM failure.

**Status:** Fixed in Phase 1. `src/ingestion/chunk-materializer.ts` no longer appends deterministically; it skips preservation failures and manual edits, retries the LLM once, and aborts on persistent failure. `appendChunkToEntityBody` and `appendChunkToTopicBody` were removed. Tests added in `tests/ingestion/chunk-materializer.test.ts`.

**Violated:**
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1 (LLM is sole author; no deterministic fallback)
- `Project Vision/04_orchestration_detailed.md` Step 6 (Chunk Materialization)
- `Project Vision/07_validation_and_quality.md` Section 3 (Preservation-First Materialization)
- `root AGENTS.md` User Preferences

**Why it matters:** Deterministic append blocks produce markdown bodies without LLM synthesis and without inline `[^srcN]` citations, breaking both the “sole author” and “citation-backed” guarantees.

---

### 2. Structural changes still require human approval

**Severity:** `critical`

**Files:**
- `src/orchestrator/ingest.ts` lines 237–269
- `src/orchestrator/proposals.ts` lines 194–212 (prompt), 214–284 (apply/reject logic)
- `src/cli.ts` lines 75–78 (`--yes` auto-approve), 90–99 (`apply-proposal` command)
- `src/commands/ingest.ts` line 34
- `src/commands/apply-proposal.ts` (entire command)
- `src/ingestion/engine.ts` lines 47, 369–373

**Observed behavior:**
- `runIngestOrchestrator` detects new folders, writes a proposal file, and either prompts for approval or requires `--yes` to auto-approve.
- If a complex proposal is rejected or not approved, the orchestrator falls back to the old hierarchy or aborts.
- `apply-proposal` is a separate command that requires a human to edit the proposal file’s `status` to `approved`.

**Expected behavior per vision:**
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 4: the LLM autonomously creates/reorganizes folders and the change is logged for review; no approval gate.
- `Project Vision/04_orchestration_detailed.md` Step 5: structural changes are applied immediately and logged.
- `Project Vision/07_validation_and_quality.md` Section 6: changes are recorded for after-the-fact review, not approved in advance.
- `root AGENTS.md` User Preferences: LLM-driven structural evolution.

**Violated:**
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 4
- `Project Vision/04_orchestration_detailed.md` Step 5
- `Project Vision/07_validation_and_quality.md` Section 6
- `root AGENTS.md` User Preferences

**Why it matters:** The implementation treats the human as a gatekeeper for folder structure, which is exactly what the updated vision removed.

**Status:** Fixed in Phase 2. `src/orchestrator/ingest.ts` no longer prompts for approval or requires `--yes`; `runIngestOrchestrator` now applies all structural changes autonomously via `applyStructuralChanges`, writes a structural-change log to `.kimi-code/proposals/`, emits a `progress.proposal` event, and uses the new folder hierarchy. The `--yes` option was removed from `ingest` and `ingest-all`. `apply-proposal` was repurposed as a command to apply an existing structural-change log (still auto-applies). `src/ingestion/engine.ts` now runs `runReingest` whenever any structural change was applied. Tests updated in `tests/orchestrator/proposals.test.ts` and `tests/commands/apply-proposal.test.ts`.

---

### 3. Generated per-wiki `AGENTS.md` still tells the LLM that new folders need human approval

**Severity:** `high`

**Files:**
- `src/writers/agents.ts` lines 66, 128, 272, 373, 414
- `src/llm/client.ts` line 782 (test-provider system prompt embeds the old authority matrix)

**Observed behavior:**
- Both `writeSkeletonAgentsMd` and `renderAgentsMdBody` generate text such as:
  - “New folders require a structural-change proposal and human approval.”
  - “User (human) | High-level purpose, PDF curation, structural approval, when to run commands.”

**Expected behavior per vision:**
- The per-wiki `AGENTS.md` should reflect the new authority model: the LLM autonomously evolves structure; the human reviews logged changes after the fact.
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 4
- `root AGENTS.md` User Preferences

**Violated:**
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 4
- `Project Vision/07_validation_and_quality.md` Section 6
- `root AGENTS.md` User Preferences

**Why it matters:** The ingestion guide given to the LLM contradicts the updated vision, so later chunks will be planned under the old approval model.

**Status:** Fixed in Phase 3. Replaced the structural approval language in `src/writers/agents.ts` (`writeSkeletonAgentsMd`, `renderAgentsMdBody`, and `updateFolderStructureSection`) and in the test-provider mock response in `src/llm/client.ts`. The generated `AGENTS.md` now tells the LLM that structural changes are autonomous and logged, and the authority matrix no longer assigns structural approval to the human. Tests added in `tests/writers/agents.test.ts`.

---

### 4. Child DOX `AGENTS.md` files still encode the old model

**Severity:** `high`

**Files:**
- `src/AGENTS.md` line 11: “Human user approves structural changes and decides when to run commands.”
- `src/orchestrator/AGENTS.md` line 18: “Structural proposals that create new folders or change the wiki organization require human approval.”
- `src/ingestion/AGENTS.md` lines 18–19: “Preservation check: every old citation … must survive an LLM rewrite; otherwise use deterministic append-only. Manually edited pages … are always append-only.”

**Observed behavior:**
- The source-code contracts still encode the pre-update model: human approval for structural changes and deterministic append for preservation failures.

**Expected behavior per vision:**
- The child `AGENTS.md` files should be updated to match the root `AGENTS.md` and the Project Vision: no human approval gate, and preservation failures are skipped, not appended.
- `root AGENTS.md` User Preferences
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 4
- `Project Vision/07_validation_and_quality.md` Section 3

**Why it matters:** These files are binding contracts for developers working on the codebase; stale rules risk being re-implemented or preserved.

**Status:** Fixed in Phase 3/7. The child DOX contracts (`src/AGENTS.md`, `src/orchestrator/AGENTS.md`, `src/ingestion/AGENTS.md`) were aligned with the updated vision: `src/AGENTS.md` no longer assigns structural approval to the human; `src/orchestrator/AGENTS.md` states that structural changes are applied autonomously and logged; `src/ingestion/AGENTS.md` states that preservation failures are skipped and manually edited pages are not overwritten.

---

### 5. `apply-proposal` and `reingest` default to overwriting manual edits

**Severity:** `high`

**Files:**
- `src/cli.ts` line 95: `--skip-manual-edits` defaults to `false`
- `src/commands/apply-proposal.ts` lines 102–103
- `src/ingestion/reingest.ts` lines 211–217

**Observed behavior:**
- Manual edits are only skipped if the user explicitly passes `--skip-manual-edits`; otherwise reingest warns that it will overwrite them.
- `buildReingestPlan` warns: “Page … has manual edits and will be overwritten by re-ingestion.”

**Expected behavior per vision:**
- `Project Vision/07_validation_and_quality.md` Section 3: manually edited pages are skipped so the human edit is not overwritten.
- `root AGENTS.md` User Preferences: preservation-first updates should skip manually edited pages.

**Violated:**
- `Project Vision/07_validation_and_quality.md` Section 3
- `root AGENTS.md` User Preferences

**Why it matters:** The default behavior destroys human edits, which is the opposite of the preservation-first protocol.

**Status:** Fixed in Phase 4. `src/ingestion/reingest.ts` now defaults `skipManualEdits` to `true`; manually edited pages are skipped during reingest unless an explicit override is passed to the internal API. The warning message now says "will be skipped" by default. The `--skip-manual-edits` option was removed from the `apply-proposal` CLI command. `docs/USAGE.md` was updated.

---

### 6. Deterministic code silently repairs missing frontmatter on LLM-written pages

**Severity:** `medium`

**Files:**
- `src/orchestrator/agents.ts` lines 2249–2270 (`normalizePageUpdate`)
- `src/writers/document.ts` lines 42–60 (`mergeLlmContentWithChunk`)

**Observed behavior:**
- If the LLM omits `title`, `type`, `wiki`, `sources`, `tags`, `confidence`, `created`, or `updated`, the deterministic layer fills them in.
- `mergeLlmContentWithChunk` overrides or supplies `sources` from the chunk if the LLM omitted them.

**Expected behavior per vision:**
- The LLM is the sole author of markdown content; deterministic code validates and orchestrates but does not author.
- If required fields are missing, the chunk should be reprocessed by the LLM (or rejected by the Critic / schema validation), not silently repaired by deterministic code.
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1
- `root AGENTS.md` Key architectural rules

**Violated:**
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1
- `Project Vision/02_WIKI_concept_detailed.md` Section 4
- `root AGENTS.md` Key architectural rules

**Why it matters:** Silent frontmatter repair masks LLM output quality issues and lets deterministic code shape the page content.

**Status:** Fixed in Phase 5. Removed deterministic fallback logic from `normalizePageUpdate` and `mergeLlmContentWithChunk`. Required document-page frontmatter fields must now be authored by the LLM. `normalizePageUpdate` now validates and throws detailed validation errors; `chunkWriter` catches these errors and retries once with feedback. The schema now requires `updated` for document pages. Tests updated in `tests/writers/document.test.ts`.

---

### 7. `reingest.ts` mutates page frontmatter deterministically during moves

**Severity:** `medium`

**Files:**
- `src/ingestion/reingest.ts` lines 142–148 and 154–158

**Observed behavior:**
- When a page is moved to a new folder, the code re-reads the page, deterministically updates `type` and `updated`, and writes it back.

**Expected behavior per vision:**
- Deterministic code should not mutate page bodies. Page moves should preserve the LLM-authored body; any frontmatter changes should be driven by the LLM or the contract writer, not by deterministic repair.
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1
- `root AGENTS.md` Key architectural rules

**Violated:**
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1
- `root AGENTS.md` Key architectural rules

**Why it matters:** A reingest pass is currently overwriting parts of the page body deterministically, which conflicts with the “LLM is sole author” boundary.

**Status:** Fixed in Phase 6. `src/ingestion/reingest.ts` now copies pages verbatim when moving them and no longer updates frontmatter `type` or `updated` deterministically. Same-folder page-type renames also no longer rewrite frontmatter. Manually edited pages are skipped during moves even if the caller requests overwrite. Tests added in `tests/ingestion/reingest.test.ts`.

---

### 8. Source and raw pages are generated deterministically when the LLM is disabled

**Severity:** `low / note`

**Files:**
- `src/orchestrator/agents.ts` lines 1870–1871 (`sourcePageWriter` fallback), 1957–1958 (`rawPageWriter` fallback)
- `src/writers/source.ts` lines 16–46
- `src/writers/raw.ts` lines 6–18, 50–82
- `src/ingestion/engine.ts` line 169
- `src/extractor/batch.ts` line 41

**Observed behavior:**
- When the LLM client is not enabled, source and raw page bodies are generated deterministically.
- `writeFailureRawPage` writes a deterministic raw page body when PDF extraction fails.

**Expected behavior per vision:**
- This is ambiguous. `Project Vision/05_page_types_specification.md` Section 5 explicitly says `source` pages are **deterministic** provenance records, and `raw` pages are deterministic preservation of unparseable fragments.
- However, `root AGENTS.md` states the hard boundary: “deterministic code writes only DOX index/contract files and orchestration metadata; the LLM authors all wiki page bodies.”
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1 also says the LLM is the sole author of every wiki page.

**Violated:**
- `root AGENTS.md` hard boundary (if interpreted broadly to include source/raw pages)
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1 (same broad interpretation)

**Why it matters / note:** The vision itself has an internal tension: source and raw pages are described as deterministic, yet the “LLM is sole author” rule is stated as applying to “every wiki page.” Either the root `AGENTS.md` and Principle 1 should be narrowed to exclude source/raw pages, or the vision should require the LLM to author source/raw pages too. This is a documentation inconsistency that should be resolved.

**Status:** Fixed in Phase 7. Narrowed the hard boundary in `AGENTS.md` and updated `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1 and `Project Vision/02_WIKI_concept_detailed.md` Section 4 to clarify that deterministic code may generate `source` and `raw` provenance/preservation pages, while the LLM authors all synthesized content pages (`document`, `entity`, `topic`, and derived types). The documentation is now internally consistent.

---

## Summary Table

| # | Finding | Severity | Status | Vision Violated |
|---|---|---|---|---|
| 1 | ChunkMaterializer authors markdown deterministically | critical | Fixed | `01` Principle 1, `04` Step 6, `07` Section 3, root `AGENTS.md` User Preferences |
| 2 | Structural changes require human approval | critical | Fixed | `01` Principle 4, `04` Step 5, `07` Section 6, root `AGENTS.md` User Preferences |
| 3 | Generated `AGENTS.md` still encodes approval model | high | Fixed | `01` Principle 4, `07` Section 6, root `AGENTS.md` User Preferences |
| 4 | Child DOX `AGENTS.md` files encode old model | high | Fixed | `01` Principle 4, `07` Section 3, root `AGENTS.md` User Preferences |
| 5 | `apply-proposal` / `reingest` overwrite manual edits by default | high | Fixed | `07` Section 3, root `AGENTS.md` User Preferences |
| 6 | Deterministic frontmatter repair on LLM pages | medium | Fixed | `01` Principle 1, `02` Section 4, root `AGENTS.md` rules |
| 7 | `reingest.ts` mutates frontmatter during moves | medium | Fixed | `01` Principle 1, root `AGENTS.md` rules |
| 8 | Source/raw pages generated deterministically | note / low | Resolved (documented) | Tension between `05` Section 5 and `01` Principle 1 / root `AGENTS.md` |

---

## Recommended Order of Repair

1. **Fix `ChunkMaterializer`** — remove all deterministic append fallbacks; replace with conflict reporting and skipping. Abort on LLM failure after retry.
2. **Remove the structural-change approval gate** — make `runIngestOrchestrator` apply new folders autonomously and log them; deprecate/remove `apply-proposal` or convert it to a read-only log viewer.
3. **Update generated per-wiki `AGENTS.md`** — remove “structural approval” language and replace with the LLM-driven structural evolution authority model.
4. **Update child DOX `AGENTS.md` files** — align `src/AGENTS.md`, `src/orchestrator/AGENTS.md`, and `src/ingestion/AGENTS.md` with the updated vision.
5. **Make preservation-first the default** — manual edits should be skipped by default; remove the `--skip-manual-edits` default that allows overwrites.
6. **Remove deterministic frontmatter repair** — reject/reprocess LLM output that lacks required fields instead of silently filling them in.
7. **Resolve source/raw page ambiguity** — clarify in the root `AGENTS.md` and `01` Principle 1 whether source/raw pages are exempt from the “LLM is sole author” rule.

---

## Verification

**Date:** 2026-07-14

**Build:**
- `npm run build` — passed (`tsc` completed with no errors).

**Tests:**
- `npm run test` — passed (`248 tests` across `39 files`).
- Focused integration coverage includes:
  - `tests/ingestion/chunk-materializer.test.ts` — preservation failures and LLM failures are skipped/aborted, not repaired deterministically.
  - `tests/orchestrator/proposals.test.ts` — structural changes are applied autonomously and logged.
  - `tests/commands/apply-proposal.test.ts` — `apply-proposal` applies logged structural changes without human approval.
  - `tests/writers/agents.test.ts` — generated `AGENTS.md` uses autonomous structural-change language.
  - `tests/ingestion/reingest.test.ts` — manually edited pages are skipped by default; moves preserve LLM-authored bodies and frontmatter.
  - `tests/writers/document.test.ts` — incomplete LLM frontmatter is rejected instead of silently repaired.
  - `tests/orchestrator/chunkWriter.test.ts` — required frontmatter fields must be LLM-authored.

**Cross-check against the updated Project Vision:**
- Principle 1 (LLM writes all synthesized markdown) — satisfied. Deterministic code only authors `source`/`raw` provenance/preservation pages and DOX contracts.
- Principle 4 (LLM-driven structural evolution) — satisfied. New folders and reorganizations are applied autonomously and logged for after-the-fact review.
- Preservation-first updates — satisfied. Citation/wikilink preservation failures and manual edits cause updates to be skipped.
- No deterministic fallback on LLM failure — satisfied. The orchestrator retries the same LLM agent once, then aborts.

**Result:** All findings resolved. The implementation matches the updated Project Vision.
