# Sprint 7 — Selective Re-ingestion & Quality

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-07-selective-reingestion` |
| Goal | Implement selective re-ingestion after approved structural changes, preserving manual edits while aligning existing pages with the new structure. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 4; `Project Vision/07_validation_and_quality.md` §5, §6; `Project Vision/03_DOX_concept_detailed.md` §5. |
| Status | `COMPLETE` |

---

## 1. Why This Sprint

The original plan hand-waved re-ingestion after structural changes. `Project Vision/07` §6 states:

> After a structural change is approved, the system must re-ingest earlier documents to align them with the new folder structure. It does not need to re-extract every PDF from scratch; it only needs to re-plan and re-write the pages whose folder or page type would change.

This sprint makes that explicit. It defines how the system identifies affected pages, preserves manual edits, and re-processes only what is necessary.

---

## 2. Prerequisites

- **Sprints 1, 2, 3, 4a, 4b, 5, and 6** must be approved by the user.
- The dynamic structure and human approval flow are in place.

---

## 3. Scope

### 3.1 Affected Page Identification

After a structural change is approved, the system intersects the new folder/page-type rules with the existing state:

- For each existing page, determine whether its folder or page type would change under the new rules.
- If unchanged, leave the page as-is.
- If changed, mark it for re-processing.
- If a page type is removed, mark the page for deletion or archiving.

The `ingestion/state.ts` incremental state must be extended to track per-page metadata (folder, page type, source, last SHA-256) so that this comparison is deterministic.

### 3.2 Preserving Manual Edits

- Before re-processing a page, compare its current content to the last generated version (stored in state or a hash).
- If the current content differs from the last generated version, warn the user that the page has manual edits and will be overwritten.
- Optionally allow the user to skip re-processing for that page (CLI prompt or flag).
- Unchanged PDFs are not fully re-extracted unless the new structure requires it (e.g., a new page type needs to be populated from all sources).

### 3.3 Re-processing Flow

- For each affected page, re-run the relevant sub-agents (PagePlanner, ChunkWriter, Critic) with the new structure and `AGENTS.md`.
- Use the existing extraction result if the source PDF has not changed.
- Update folder-level `index.md` contracts and the wiki-level `index.md` to reflect the new structure.
- Write a re-ingestion summary to the run log.

### 3.4 Integration with Proposals

- When `apply-proposal` is run, it triggers the selective re-ingestion flow.
- If the proposal is applied during `sample` or `ingest`, the flow runs automatically after the proposal is approved.
- Re-ingestion results are reported in the CLI summary.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 4: Human approval for structural changes.
- `Project Vision/03` §5: Contract updates after changes.
- `Project Vision/07` §5: Structural change proposals.
- `Project Vision/07` §6: Re-ingestion after changes.

---

## 5. Files to Create or Modify

- `src/ingestion/state.ts` — extend per-page state tracking.
- `src/ingestion/reingest.ts` — new file for selective re-ingestion logic.
- `src/orchestrator/proposals.ts` — trigger re-ingestion after approval.
- `src/commands/apply-proposal.ts` — run re-ingestion.
- `src/commands/ingest.ts` — handle re-ingestion after in-run approvals.
- `src/writers/index.ts` — update contracts after re-ingestion.
- `tests/ingestion/reingest.test.ts` — new tests.
- `tests/commands/apply-proposal.test.ts` — update for re-ingestion.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. After a structural change, only pages whose folder or page type would change are marked for re-processing.
3. Unchanged pages are left as-is, including their content and frontmatter.
4. Manual edits to generated pages are detected and warned before overwrite.
5. The user can skip re-processing for manually edited pages.
6. Unchanged PDFs are not re-extracted unless required by the new structure.
7. Re-ingestion updates folder-level `index.md` and wiki-level `index.md` contracts.
8. The re-ingestion summary is written to the run log.
9. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. After approving a structural change that adds a `timeline/` folder, existing pages that belong in `timeline/` are moved or rewritten there.
2. Pages that are unaffected by the structural change remain unchanged.
3. If a generated page was manually edited, the CLI warns the user before overwriting and offers to skip.
4. Re-ingestion completes faster than a full re-run because unchanged PDFs are not re-extracted.
5. The final wiki structure matches the approved proposal.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 8 until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprints 1–6. The `init` command, extraction, chunking, state tracking, writers, `AGENTS.md`, sampling strategies, ChunkWriter, LLM sub-agent pipeline, and structural proposal flow must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 7 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 8 until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 8 — Validation, Quality & Cross-Wiki**: `plan/Plan_implementation/sprint-08-validation-quality/instruction.md`.
