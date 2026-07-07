# Sprint 6 — Dynamic Structure & Human Approval

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-06-dynamic-structure` |
| Goal | Implement corpus-aware dynamic folder planning, structural change proposals, and the human approval flow. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 4; `Project Vision/03_DOX_concept_detailed.md` §4, §5; `Project Vision/07_validation_and_quality.md` §5, §6; `Project Vision/04_orchestration_detailed.md` §4.4.5. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint

`Project Vision/01` §3 Principle 4 states:

> Structural changes that affect the top-level contract require a human-approved proposal. New page types within existing folders can be added without approval.

`Project Vision/03` §4 says the folder structure is discovered during `sample` and `ingest`, not fixed in advance. `Project Vision/07` §5 and §6 describe the proposal format and the re-ingestion that follows approval. This sprint implements the proposal and approval machinery, building on the sampling strategies and `AGENTS.md` from Sprint 4a and the LLM-driven ChunkWriter from Sprint 4b.

---

## 2. Prerequisites

- **Sprints 1, 2, 3, 4a, 4b, and 5** must be approved by the user.
- The LLM sub-agent pipeline, `AGENTS.md` generation, and sampling strategies are in place.

---

## 3. Scope

### 3.1 Dynamic Folder Planning

- `PagePlanner` must propose folders based on the corpus, not just the default `documents`, `sources`, `entities`, `topics`, `raw`.
- New page types inside existing folders are auto-approved (`Project Vision/01` §3 Principle 4).
- New folders or changes to the top-level contract require a structural change proposal.
- Folder planning must respect the sampling context from Sprint 4a (e.g., a mixed corpus may need sub-group folders).

### 3.2 Structural Change Proposals

`Project Vision/07` §5.1 describes the hybrid approval process:

> Simple structural changes (e.g., adding a single folder) are presented interactively in the CLI. Complex changes (e.g., reorganizing the entire wiki) are written to a proposal file in `.kimi-code/proposals/` for the user to review and edit later.

Implementation:

- Add `src/orchestrator/proposals.ts` to:
  - Detect when a proposed folder structure differs from the current one.
  - Classify the change as simple or complex.
  - For simple changes: prompt the user interactively in the CLI (`Approve? y/n`).
  - For complex changes: write a proposal file to `.kimi-code/proposals/<timestamp>-structural-change.md` with reason, affected pages, proposed structure, pros/cons, and required contract updates.
- Add a command or flag to apply approved proposals: `llm-wiki-cli apply-proposal <slug> <proposal-file>` or auto-apply on next `sample`/`ingest` if the proposal file is marked approved.
- If a proposal is rejected, fall back to the existing structure.
- After accepting a proposal, update the wiki-level `index.md` and any affected folder-level `index.md` contracts to reflect the new structure.

### 3.3 Re-ingestion Trigger (Selective)

After a proposal is approved, the system must selectively re-process affected pages. The full re-ingestion strategy is implemented in Sprint 7; this sprint only triggers the need and records the affected pages in the proposal file.

### 3.4 Dual Documentation for New Page Types

`Project Vision/02` §6.6 and `Project Vision/05` §9 require that new page types be documented in **both** the folder-level `index.md` and the wiki's `AGENTS.md`. This is a deterministic post-processing step, not an LLM decision:

- When a new page type is created inside an existing folder (auto-approved per `Project Vision/01` §3 Principle 4), the ChunkWriter must emit two deterministic updates after writing the new page:
  1. Update the folder-level `index.md` to list the new page type, its frontmatter schema, and naming convention.
  2. Update the wiki's `AGENTS.md` to add the new page type to the "Page Types" section, with a brief rationale.
- The update must preserve existing manual edits to the markdown body where possible, only appending or modifying the relevant section.
- New page types that require a new folder still follow the structural-change proposal flow from §3.2; the dual documentation is applied after the proposal is approved.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 4: Human approval for structural changes.
- `Project Vision/02` §6.6: New page types must be documented in `AGENTS.md`.
- `Project Vision/03` §4: Dynamic folders and the sample phase.
- `Project Vision/03` §5: The contract as a binding document.
- `Project Vision/04` §4.4.5: PagePlanner responsibilities.
- `Project Vision/05` §9: New page type dual documentation.
- `Project Vision/07` §5: Structural change proposals.
- `Project Vision/07` §6: Re-ingestion after changes.

---

## 5. Files to Create or Modify

- `src/orchestrator/proposals.ts` — new file.
- `src/commands/apply-proposal.ts` — new command or flag.
- `src/orchestrator/agents.ts` — PagePlanner must use corpus-aware folder proposals.
- `src/orchestrator/index.ts` — integrate proposal detection into sample orchestrator.
- `src/orchestrator/ingest.ts` — detect and surface structural proposals.
- `src/orchestrator/contracts.ts` — update contracts after approved structural changes.
- `src/writers/agents.ts` — update `AGENTS.md` when new page types are added.
- `src/writers/index.ts` — update folder-level `index.md` when new page types are added.
- `tests/orchestrator/proposals.test.ts` — new tests.
- `tests/commands/apply-proposal.test.ts` — new tests.
- `tests/commands/sample.test.ts` — update for proposal flow.
- `tests/writers/agents.test.ts` — update for dual documentation.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. `sample` and `ingest` detect when a proposed folder structure differs from the current one.
3. The proposal system writes `.kimi-code/proposals/` files for complex structural changes.
4. Interactive approval works for simple changes (tested with mocked stdin).
5. Rejected proposals leave the existing structure unchanged.
6. Accepted proposals update the wiki-level `index.md` and affected folder-level `index.md` contracts.
7. New page types inside existing folders are approved automatically and do not generate a proposal.
8. When a new page type is created inside an existing folder, both the folder-level `index.md` and the wiki's `AGENTS.md` are updated deterministically.
9. Tests cover simple, complex, and rejected proposals.
10. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. Running `ingest` on a corpus that needs a new folder (`timeline/` for chronological events) pauses and asks the user to approve the new folder.
2. After approving, the new folder appears with a folder-level `index.md` contract.
3. The user can review complex proposals in `.kimi-code/proposals/` before deciding.
4. Rejecting a proposal keeps the existing folder structure and continues ingestion.
5. Adding a new page type inside an existing folder (e.g., a new `entity` page) does not trigger a proposal.
6. When a new page type is added, both the folder-level `index.md` and the wiki's `AGENTS.md` are updated to document it.
7. The proposal file includes reason, pros/cons, affected pages, and required contract updates.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 7 until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprints 1–5. The `init` command, extraction, chunking, state tracking, writers, `AGENTS.md`, sampling strategies, ChunkWriter, and LLM sub-agent pipeline must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 6 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 7 until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 7 — Selective Re-ingestion**: `plan/Plan_implementation/sprint-07-selective-reingestion/instruction.md`.
