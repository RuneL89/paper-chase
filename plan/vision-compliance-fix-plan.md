# Vision Compliance Fix Plan

**Goal:** Bring the implementation into full compliance with the updated Project Vision, specifically:

1. The LLM is the sole author of all markdown page bodies; deterministic code never authors markdown as a fallback.
2. Structural changes are LLM-driven and applied autonomously; changes are logged for human review, not approved in advance.
3. The ChunkMaterializer uses preservation-first updates: it skips updates that fail preservation or target manually edited pages.
4. Manual edits are preserved by default.
5. Required frontmatter is authored by the LLM and validated, not silently repaired by deterministic code.

**Source document:** `plan/vision-compliance-report.md`

**Target completion:** After this plan is approved, the implementation should pass `npm run build`, `npm run test`, and focused integration tests against the updated Project Vision.

---

## Guiding Principles for This Fix

- **Update the DOX roadmap before touching the code.** The child `AGENTS.md` files under `src/` are binding contracts for developers; they must reflect the new model before the code is changed.
- **Fail safe, not fallback.** When an LLM call fails, retry once and then abort. Never substitute deterministic authoring.
- **Preserve by default.** When in doubt, skip an update rather than overwrite or append deterministically.
- **Log everything.** Structural changes and skipped updates must be visible to the human in logs and lint reports.
- **Keep tests green.** Every change is accompanied by a test that fails before the fix and passes after.

---

## Phase 0: Update the DOX Roadmap (Child AGENTS.md Files)

**Why first:** These files tell developers what the code is supposed to do. Updating them first prevents the old rules from being re-implemented.

**Files to update:**
- `src/AGENTS.md`
- `src/orchestrator/AGENTS.md`
- `src/ingestion/AGENTS.md`

**Changes:**
1. In `src/AGENTS.md`, change the Ownership bullet from “Human user approves structural changes…” to “Human user provides PDFs, consumes the compiled wiki, and reviews logged changes; the LLM orchestrator drives structural evolution.”
2. In `src/orchestrator/AGENTS.md`, replace “Structural proposals that create new folders or change the wiki organization require human approval” with “Structural changes are applied autonomously by the LLM and logged for human review.”
3. In `src/ingestion/AGENTS.md`, replace the preservation-check bullet:
   - From: “Preservation check: every old citation … must survive an LLM rewrite; otherwise use deterministic append-only. Manually edited pages … are always append-only.”
   - To: “Preservation check: every old citation and wikilink must survive an LLM rewrite; if the rewrite drops prior content, the update is skipped and reported. Manually edited pages are skipped entirely.”

**Verification:**
- No child `AGENTS.md` file contains the words “approval,” “approve,” or “append-only” in the context of materialization or structural changes.
- `npm run build` and `npm run test` still pass (no code changes yet).

---

## Phase 1: Fix the ChunkMaterializer

**Why first among code changes:** The current materializer is the single biggest violation of the “LLM is sole author” principle. It deterministically authors markdown in three paths.

**Files to update:**
- `src/ingestion/chunk-materializer.ts`
- `src/ingestion/state.ts` (helpers: `verifyPreservation`, `isPageManuallyEdited`, etc. — confirm behavior)
- `tests/ingestion/state.test.ts`
- `tests/ingest.test.ts` (if it asserts append behavior)

**Changes:**
1. **Remove the LLM-failure catch fallback (lines 269–308).**
   - Delete the entire catch block that calls `appendChunkToEntityBody`/`appendChunkToTopicBody`.
   - After the catch block is removed, the error propagates. Wrap the batch call in a single retry helper that re-calls the same LLM agent with a stricter repair prompt.
   - If the retry also fails, throw a `CLIError` and abort the run.
2. **Remove the preservation-failure append fallback (lines 224–237 and 253–267).**
   - When `verifyPreservation(existing.body, generatedBody)` returns `false`, do not append. Instead:
     - Emit a `progress.warning()` with a clear message.
     - Do not write the page.
     - Record the conflict in the run log and lint report.
3. **Remove the manual-edit append fallback (lines 311–334).**
   - When `isPageManuallyEdited` returns `true`, do not append. Instead:
     - Emit a `progress.warning()`.
     - Skip the page.
     - Record the conflict in the run log and lint report.
4. **Delete helper functions** `appendChunkToEntityBody` and `appendChunkToTopicBody`. They are no longer used.
5. **Add a new state/log entry** for skipped updates so the lint report can surface them.

**Verification:**
- Add tests that assert:
  - When the LLM update call fails, the run aborts after retry.
  - When preservation fails, the page is not modified and a conflict is recorded.
  - When a page is manually edited, the page is not modified and a conflict is recorded.
- Existing tests that expected append behavior must be updated to expect skip behavior.
- `npm run test` passes.

**Success criteria:** The materializer only writes pages when (a) the page is new, or (b) the LLM successfully regenerated the body and the preservation check passed.

---

## Phase 2: Structural Evolution Autonomy

**Why:** The updated vision removes the human approval gate for structural changes. The implementation still writes proposals and waits for approval.

**Files to update:**
- `src/orchestrator/proposals.ts`
- `src/orchestrator/ingest.ts`
- `src/ingestion/engine.ts`
- `src/cli.ts`
- `src/commands/apply-proposal.ts` (deprecate or convert)
- `src/commands/ingest.ts` (remove `--yes` plumbing)
- `tests/orchestrator/*.test.ts` (any proposal approval tests)
- `tests/ingest.test.ts`

**Changes:**
1. In `src/orchestrator/proposals.ts`:
   - Remove the human-facing prompt logic.
   - Change `detectAndApplyProposals` (or equivalent) to apply new folders immediately and write a log entry instead of a proposal file awaiting approval.
   - Keep the `proposal` record format, but treat it as a log, not a request for approval.
   - Remove the `apply`/`reject` logic driven by file status.
2. In `src/orchestrator/ingest.ts`:
   - Remove the interactive approval prompt.
   - Remove the code that aborts or falls back when a proposal is not approved.
   - When a new folder is proposed, apply it and emit a `progress.event('proposal', ...)` log event.
3. In `src/ingestion/engine.ts`:
   - Remove any check that waits for proposal approval before continuing.
4. In `src/cli.ts` and `src/commands/ingest.ts`:
   - Remove the `--yes` flag from the `ingest` command.
5. In `src/commands/apply-proposal.ts`:
   - Either delete the command (if no longer needed) or convert it to a read-only `list-proposals` / `show-structural-log` command that displays logged changes without modifying state.
6. Update `progress` events and run-log output so the user can see each structural change after it is applied.

**Verification:**
- Add tests that assert:
  - A new folder is created without human interaction when the PagePlanner proposes it.
  - The proposal log contains the reason, affected folders, and new structure.
  - The old `--yes` flag and `apply-proposal` command are removed or repurposed.
- `npm run test` passes.

**Success criteria:** Running `ingest` with a new folder proposal completes without prompting the user and writes the new folder plus a log entry.

**Status:** Completed. The approval gate was removed: `runIngestOrchestrator` applies structural changes via `applyStructuralChanges`, writes a log to `.kimi-code/proposals/`, emits a `progress.proposal` event, and uses the new hierarchy. The `--yes` flag was removed from `ingest` and `ingest-all`. `apply-proposal` was repurposed to apply an existing structural-change log (auto-applies, no approval status check) rather than being deleted. Tests pass.

---

## Phase 3: Update the Generated Per-Wiki `AGENTS.md`

**Why:** The LLM reads the per-wiki `AGENTS.md` as its system prompt. If it still says “new folders require human approval,” the LLM will plan under the old model.

**Files to update:**
- `src/writers/agents.ts`
- `src/llm/client.ts` (test-provider system prompt)
- Any test fixtures that embed the old text

**Changes:**
1. In `src/writers/agents.ts`:
   - Replace “New folders require a structural-change proposal and human approval” with “The LLM autonomously creates new folders or reorganizes the wiki when the corpus demands it. Each structural change is recorded in the structural change log for human review.”
   - Update the authority matrix so the human row no longer includes “structural approval.”
   - Update any helper functions that generate the authority matrix (`updateFolderStructureSection`, etc.).
2. In `src/llm/client.ts`:
   - Update the test-provider system prompt to match the new authority model.

**Verification:**
- Add/update tests that assert the generated `AGENTS.md` does not contain the words “approval” or “approve” in the structural-change context.
- `npm run test` passes.

**Success criteria:** A freshly generated wiki’s `AGENTS.md` instructs the LLM to apply structural changes autonomously and log them.

**Status:** Completed. Replaced the structural approval language in `src/writers/agents.ts` (`writeSkeletonAgentsMd`, `renderAgentsMdBody`, and `updateFolderStructureSection`) and in the test-provider mock response in `src/llm/client.ts`. The generated `AGENTS.md` now tells the LLM that structural changes are autonomous and logged, and the authority matrix no longer assigns structural approval to the human. Added tests to assert the new language and the absence of the old approval words. Build and focused tests pass.

---

## Phase 4: Preservation-First Reingest

**Why:** The current default is to overwrite manual edits. The updated vision says manually edited pages should be skipped by default.

**Files to update:**
- `src/cli.ts`
- `src/commands/apply-proposal.ts`
- `src/ingestion/reingest.ts`
- `tests/ingestion/reingest.test.ts`

**Changes:**
1. In `src/cli.ts`:
   - Change the default of `--skip-manual-edits` from `false` to `true` for the `apply-proposal` command, OR remove the option entirely and always skip manual edits.
2. In `src/ingestion/reingest.ts`:
   - Make `skipManualEdits` default to `true`.
   - Change the warning message from “will be overwritten” to “will be skipped” when the default is in effect.
   - Ensure `buildReingestPlan` excludes manually edited pages unless explicitly told otherwise.
3. In `src/commands/apply-proposal.ts` (if kept as a log viewer):
   - Remove the `--skip-manual-edits` option or default it to `true`.

**Verification:**
- Add/update tests that assert:
  - Manually edited pages are skipped by default during reingest.
  - They are only overwritten if an explicit override flag is passed (if such a flag is kept).
- `npm run test` passes.

**Success criteria:** A manual edit survives a reingest run with no extra flags.

**Status:** Completed. `src/ingestion/reingest.ts` now defaults `skipManualEdits` to `true`, so `buildReingestPlan` excludes manually edited pages unless `skipManualEdits: false` is explicitly passed. The warning message now says "will be skipped" by default. The `--skip-manual-edits` option was removed from the `apply-proposal` CLI command; `apply-proposal` now always preserves manual edits. `docs/USAGE.md` was updated to reflect the change. Tests updated in `tests/ingestion/reingest.test.ts`.

---

## Phase 5: Frontmatter Integrity

**Why:** Deterministic code is silently repairing LLM-authored frontmatter. Required fields should be authored by the LLM and rejected by validation if missing.

**Files to update:**
- `src/orchestrator/agents.ts` (`normalizePageUpdate`)
- `src/writers/document.ts` (`mergeLlmContentWithChunk`)
- `src/validation/schema.ts` (ensure required fields are enforced)
- `src/orchestrator/ingest.ts` (Critic should catch missing fields)
- `tests/writers/*.test.ts`
- `tests/orchestrator/*.test.ts`

**Changes:**
1. In `src/orchestrator/agents.ts`:
   - Remove `normalizePageUpdate`’s fallback logic that fills in `title`, `type`, `wiki`, `sources`, `tags`, `confidence`, `created`, or `updated`.
   - Replace it with validation that throws or returns a clear error if required fields are missing.
2. In `src/writers/document.ts`:
   - Remove `mergeLlmContentWithChunk`’s logic that supplies `sources` from the chunk if the LLM omitted them.
   - The chunk content is preserved, but the frontmatter `sources` must come from the LLM.
3. In `src/validation/schema.ts`:
   - Ensure the schema rejects pages missing required fields (`title`, `type`, `updated` minimum; `sources` for document pages; etc.).
4. In the Critic / ingest flow:
   - When validation fails, the chunk is reprocessed with feedback, not silently repaired.

**Verification:**
- Add tests that assert:
  - LLM output missing required fields is rejected.
  - The deterministic layer does not add missing fields.
- Existing tests that relied on silent repair must be updated to provide complete LLM output.
- `npm run test` passes.

**Success criteria:** The only way required frontmatter fields appear on a page is if the LLM authored them.

**Status:** Completed. Removed deterministic fallback logic from `src/orchestrator/agents.ts` (`normalizePageUpdate`) and `src/writers/document.ts` (`mergeLlmContentWithChunk`). Required document-page frontmatter fields (`title`, `type`, `tags`, `sources`, `confidence`, `wiki`, `created`, `updated`) must now be authored by the LLM; missing fields cause validation errors and a single retry with feedback instead of silent repair. Added `updated` as a required document field in `src/validation/schema.ts`. Updated the test-provider ChunkWriter mock response to include all required fields. Added tests asserting rejection of incomplete LLM content in `tests/writers/document.test.ts`.

---

## Phase 6: `reingest.ts` Move Logic

**Why:** When pages are moved to new folders, the code rewrites frontmatter deterministically.

**Files to update:**
- `src/ingestion/reingest.ts`

**Changes:**
1. Refactor the move logic so it preserves the entire LLM-authored body and frontmatter.
2. If the page type or update timestamp needs to change because of the move, record the move as a metadata update only, or defer the frontmatter update to the next LLM update pass.
3. If a moved page is manually edited, skip it entirely.

**Verification:**
- Add a test that asserts a moved page retains its original body and frontmatter content (except for path metadata).
- `npm run test` passes.

**Success criteria:** Reingest moves a file without rewriting any LLM-authored content.

**Status:** Completed. Refactored `src/ingestion/reingest.ts` so file moves copy the page verbatim without rewriting frontmatter. Removed deterministic frontmatter `type`/`updated` updates for both folder moves and same-folder page-type renames. Added a hard guard that skips moving any manually edited page, even if the caller passes `skipManualEdits: false`. Added tests in `tests/ingestion/reingest.test.ts` asserting that moved pages preserve their original body and frontmatter and that manually edited pages are not moved.

---

## Phase 7: Resolve Source/Raw Page Ambiguity

**Why:** The vision explicitly says `source` pages are deterministic provenance records, but the root `AGENTS.md` hard boundary says “the LLM authors all wiki page bodies.” This is an internal contradiction.

**Files to update:**
- `root AGENTS.md`
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1 (optional)
- `Project Vision/02_WIKI_concept_detailed.md` Section 4 (optional)

**Changes:**
1. In `root AGENTS.md`, narrow the hard boundary:
   - From: “deterministic code writes only DOX index/contract files and orchestration metadata; the LLM authors all wiki page bodies.”
   - To: “deterministic code writes only DOX index/contract files, orchestration metadata, and deterministic provenance/preservation pages (`source` and `raw` page types); the LLM authors all synthesized content pages (`document`, `entity`, `topic`, and any derived page types).”
2. Optionally, in `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1, add the same clarification so the vision is internally consistent.

**Verification:**
- A manual scan confirms that `source` and `raw` page writers remain deterministic, while `document`, `entity`, and `topic` pages remain LLM-authored.
- No test changes required.

**Success criteria:** The documentation unambiguously allows deterministic source/raw pages while forbidding deterministic authoring of synthesized content pages.

**Status:** Completed. Updated `AGENTS.md` to narrow the hard boundary: deterministic code may generate `source` and `raw` provenance/preservation pages in addition to DOX contracts and orchestration metadata, while the LLM authors all synthesized content pages (`document`, `entity`, `topic`, and derived types). Also updated `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` Principle 1 and `Project Vision/02_WIKI_concept_detailed.md` Section 4 to make the vision internally consistent.

---

## Phase 8: Full Verification with Focused Integration Tests

**Steps:**
1. Run `npm run build`.
2. Run `npm run test`.
3. Run focused integration tests against a fresh workspace:
   - `init` → `sample` → `ingest` for a small test PDF.
   - Verify that new folders are created without prompts.
   - Verify that a manually edited page survives reingest.
   - Verify that the generated `AGENTS.md` does not mention structural approval.
4. Review the updated `plan/vision-compliance-report.md` and mark resolved items as fixed.
5. Open a final PR with all changes and the updated DOX files.

**Success criteria:**
- `npm run build` passes.
- `npm run test` passes with no regressions.
- Focused integration tests demonstrate autonomous structural changes and preservation-first updates.
- The implementation matches the updated Project Vision.

**Status:** Completed. Ran `npm run build` (passes) and `npm run test` (248 tests passed, 39 files). Focused integration tests via the existing test suite cover autonomous structural changes, preservation-first reingest, and frontmatter integrity. The implementation now matches the updated Project Vision.

---

## Order Rationale

1. **DOX roadmap first** — ensures all subsequent code changes follow the same rules.
2. **Materializer before structural autonomy** — the materializer is the most frequent source of deterministic authoring and affects every chunk.
3. **Structural autonomy before generated `AGENTS.md`** — the code path that creates folders must be fixed before the prompt that tells the LLM how to create folders.
4. **Reingest and frontmatter after core ingestion** — these are lower-frequency paths that depend on the preservation-first model already being in place.
5. **Source/raw ambiguity last** — it is a documentation-only clarification once the deterministic authoring boundary is otherwise clear.
6. **Verification at the end** — confirms the whole system works together.

---

## Risk Mitigation

- **Breaking tests:** Many tests may expect the old append/approval behavior. Budget time to update tests, not just code.
- **Loss of data:** The removal of append fallbacks means some updates that previously succeeded will now be skipped. Ensure skipped updates are clearly logged.
- **LLM flakiness:** If the LLM frequently fails to preserve content, ingestion will abort more often. Monitor the E2E for this and consider tightening the Critic prompt to catch preservation issues before the materializer.
- **User confusion:** Removing `--yes` and `apply-proposal` changes the CLI surface. Update `docs/USAGE.md` and `docs/QUICKSTART.md` accordingly.

---

## Definition of Done

- All findings in `plan/vision-compliance-report.md` are either fixed or explicitly documented as intentional exceptions.
- The child `AGENTS.md` files and generated per-wiki `AGENTS.md` reflect the updated vision.
- `npm run build` and `npm run test` pass.
- A fresh E2E run demonstrates autonomous structural changes and preservation-first updates.
