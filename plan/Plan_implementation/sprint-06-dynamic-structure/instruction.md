# Sprint 6 — Dynamic Structure & Human Approval: Sampling Strategies and Folder Planning

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-06-dynamic-structure` |
| Goal | Implement corpus-aware sampling strategies, dynamic folder planning, and the human approval flow for structural changes. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 Principle 4, §8.2; `Project Vision/03_DOX_concept_detailed.md` §4; `Project Vision/07_validation_and_quality.md` §5. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint

`Project Vision/01` §8.2 says the `sample` command must adapt to the document category:

> The sampling strategy must adapt to the nature of the documents in the corpus. The orchestrator chooses or is configured with a strategy appropriate to the document collection, such as: a collection of smaller, similar documents; a single very large document; a collection of similar but very large documents; a mixed corpus.

`Project Vision/03` §4 says the folder structure is discovered during `sample` and `ingest`, not fixed in advance. `Project Vision/01` §3 Principle 4 and `Project Vision/07` §5 require human approval for structural changes.

---

## 2. Prerequisites

- **Sprints 1–5** must be approved by the user.
- The LLM sub-agent pipeline is in place and produces page plans.

---

## 3. Scope

### 3.1 Sampling Strategies

Implement the four strategies from `Project Vision/01` §8.2:

| Category | Strategy |
|---|---|
| Single very large document | Look for a TOC in the first 50 pages. If found, use it. If not, perform a full read during sample. |
| Similar, manageable-sized documents | Read one document fully, then sample pages from remaining documents. |
| Similar but very large documents | Read the first document fully to create the strategy; process the rest with `ingest`. |
| Mixed corpus | Classify each document and apply the appropriate strategy per group. |

Implementation:

- Add `src/orchestrator/sampling.ts` with strategy detection and execution.
- The `sample` command should discover all PDFs in `raw/`, classify them, and apply the right strategy.
- The output is a folder plan and `AGENTS.md` that can accommodate all document types.

### 3.2 Dynamic Folder Planning

- `PagePlanner` must propose folders based on the corpus, not just the default `documents`, `sources`, `entities`, `topics`, `raw`.
- New page types inside existing folders are auto-approved (`Project Vision/01` §3 Principle 4).
- New folders require a structural change proposal.

### 3.3 Structural Change Proposals

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
- After accepting a proposal that affects existing pages, re-ingest earlier chunks to align them with the new structure.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 4: Human approval for structural changes.
- `Project Vision/01` §8.2: Sampling strategies.
- `Project Vision/03` §4: Dynamic folders and the sample phase.
- `Project Vision/03` §5: The contract as a binding document.
- `Project Vision/07` §5: Structural change proposals.
- `Project Vision/07` §6: Re-ingestion after changes.

---

## 5. Files to Create or Modify

- `src/orchestrator/sampling.ts` — new file.
- `src/orchestrator/proposals.ts` — new file.
- `src/commands/sample.ts` — use sampling strategies.
- `src/commands/apply-proposal.ts` — new command or flag.
- `src/orchestrator/agents.ts` — PagePlanner must use corpus-aware folder proposals.
- `src/orchestrator/index.ts` — integrate sampling into sample orchestrator.
- `src/orchestrator/ingest.ts` — detect and surface structural proposals.
- `tests/orchestrator/sampling.test.ts` — new tests.
- `tests/orchestrator/proposals.test.ts` — new tests.
- `tests/commands/sample.test.ts` — update for corpus-level sampling.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. `sample` discovers all PDFs in `raw/` and classifies the corpus into one of the four strategies.
3. Each strategy produces a folder plan and `AGENTS.md`.
4. The proposal system writes `.kimi-code/proposals/` files for complex structural changes.
5. Interactive approval works for simple changes (tested with mocked stdin).
6. Rejected proposals leave the existing structure unchanged.
7. Accepted proposals trigger re-ingestion of affected earlier chunks.
8. Tests cover all four sampling strategies with fixture PDFs.
9. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. Placing one 2,000-page PDF in `raw/` and running `sample` triggers the "single very large document" strategy and searches for a TOC in the first 50 pages.
2. Placing 15 annual reports in `raw/` and running `sample` triggers the "similar, manageable-sized documents" strategy and reads one fully plus a subset of others.
3. Running `ingest` on a corpus that needs a new folder (`timeline/` for chronological events) pauses and asks the user to approve the new folder.
4. After approving, the new folder appears with a folder-level `index.md` contract, and earlier pages are reorganized if needed.
5. The user can review complex proposals in `.kimi-code/proposals/` before deciding.
6. Rejecting a proposal keeps the existing folder structure and continues ingestion.

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

Preserve all context from Sprints 1–5. The `init` command, extraction, chunking, state tracking, writers, `AGENTS.md`, ChunkWriter, and LLM sub-agent pipeline must remain functional. Do not start fresh.

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

After approval, proceed to **Sprint 7 — Validation, Quality & Cross-Wiki**: `plan/Plan_implementation/sprint-07-validation-quality/instruction.md`.
