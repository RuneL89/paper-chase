# SPRINT_INSTRUCTIONS.md — Implementation Tracker

| Attribute | Value |
|---|---|
| Project | LLM Wiki CLI v2.0 |
| Version | 2.0 |
| Date | 2026-07-06 |
| Based on | `plan/IMPLEMENTATION_PLAN.md` and `Project Vision/` |
| Purpose | Single source of truth for sprint execution order, status, and human gates. |

---

## 1. How to Use This File

This file is the anchor for the implementation phase. It records which sprint is currently in progress, which are complete, and which are awaiting user approval. Every sprint has its own instruction file in `plan/Plan_implementation/sprint-NN-slug/`.

**Rule:** The next sprint must **NEVER** start until **all** Technical Acceptance Criteria (TAC) and **all** User Acceptance Criteria (UAT) for the current sprint have been met, and the user has **explicitly approved** the UAT.

### Sprint Execution Order

```
Sprint 1: Foundation
    ↓
Sprint 2: Extraction & Chunking
    ↓
Sprint 3: Deterministic Provenance Layer
    ↓
Sprint 4: LLM as Author — AGENTS.md & ChunkWriter
    ↓
Sprint 5: LLM Sub-Agent Pipeline
    ↓
Sprint 6: Dynamic Structure & Human Approval
    ↓
Sprint 7: Validation, Quality & Cross-Wiki
    ↓
Sprint 8: README Documentation
```

### Where to Find Each Sprint's Instructions

| Sprint | Folder | Instruction File |
|---|---|---|
| Sprint 1 — Foundation | `plan/Plan_implementation/sprint-01-foundation/` | `instruction.md` |
| Sprint 2 — Extraction & Chunking | `plan/Plan_implementation/sprint-02-extraction-chunking/` | `instruction.md` |
| Sprint 3 — Deterministic Provenance Layer | `plan/Plan_implementation/sprint-03-deterministic-provenance/` | `instruction.md` |
| Sprint 4 — LLM as Author: AGENTS.md & ChunkWriter | `plan/Plan_implementation/sprint-04-llm-agents-md/` | `instruction.md` |
| Sprint 5 — LLM Sub-Agent Pipeline | `plan/Plan_implementation/sprint-05-llm-sub-agents/` | `instruction.md` |
| Sprint 6 — Dynamic Structure & Human Approval | `plan/Plan_implementation/sprint-06-dynamic-structure/` | `instruction.md` |
| Sprint 7 — Validation, Quality & Cross-Wiki | `plan/Plan_implementation/sprint-07-validation-quality/` | `instruction.md` |
| Sprint 8 — README Documentation | `plan/Plan_implementation/sprint-08-readme/` | `instruction.md` |

---

## 2. TDD Red-Green-Refactor-Evaluate Methodology

Every sprint must be implemented using the following loop. The instruction file for each sprint repeats these rules.

### 2.1 RED Phase — Write Tests First

Before implementing any feature in a sprint, write the Technical Acceptance Criteria as executable tests (unit tests, integration tests, or manual verification scripts). These tests must fail against the current codebase.

### 2.2 GREEN Phase — Make Tests Pass

Implement the minimal code to make the tests pass. After every code change, immediately run:

```bash
npm run build
npm run test
```

If compilation fails or tests fail, enter a **Self-Correcting Generator-Critic loop**:

1. Analyze the error message.
2. Reason about the root cause.
3. Apply the minimal fix.
4. Re-run `npm run build` and `npm run test`.

**Maximum 5 iterations per fix attempt.** If the issue cannot be resolved after 5 iterations, stop and ask for human input.

### 2.3 EVALUATE Phase — Evaluator-Optimizer Loop

Run the Evaluator-Optimizer loop against the sprint's TAC and UAT. Treat the TAC as a weighted rubric. Score each criterion as **PASS** or **FAIL**. If any criterion fails:

1. Revise the implementation.
2. Re-evaluate.

**Maximum 3 evaluation iterations per sprint.** During this phase, use the actual Kimi Code credentials to run the implemented feature through the LLM and verify it works as required.

### 2.4 REFACTOR Phase — Improve Quality

Once all tests pass and all criteria are met, improve code quality (naming, structure, deduplication) while ensuring all tests still pass. Do not add new features during refactoring.

### 2.5 HUMAN GATE — User Approval Required

Do **not** proceed to the next sprint until the user has explicitly approved the UAT Acceptance Criteria. This is a hard Human-in-the-Loop checkpoint.

At the end of each sprint, present the user with:

1. A summary of what was implemented.
2. A list of tests that passed (with pass rate).
3. The acceptance criteria score (PASS/FAIL for each criterion).
4. Any blockers or open questions.
5. A clear request for approval: **"Approve"** or **"Reject"**.

---

## 3. Boundedness Rules

Every loop must have a termination condition:

| Loop | Maximum Iterations | Action on Failure |
|---|---|---|
| Compile-fix loop | 5 | Stop and ask for human input. |
| Evaluator-optimizer loop | 3 | Stop and ask for human input. |
| TDD loop for a single feature | 10 | Stop and ask for human input. |
| Documentation review loop (Sprint 8) | 3 | Stop and ask for human input. |

If any loop hits its maximum without success, escalate to the user. Do not silently continue.

---

## 4. State Accumulation Rule

When moving to the next sprint, preserve all context from previous sprints. Do not start fresh. The `plan/` directory, the test suite, and the working codebase are the accumulated state. Use them as context for each new sprint.

This means:

- Previous tests must continue to pass.
- Previous commands must continue to work.
- Previous configuration files and generated artifacts must remain valid.

---

## 5. Status Table

This table is updated at the end of every sprint and whenever a sprint's status changes. It is the primary state checkpoint.

| Sprint | Status | Test Pass Rate | Acceptance Criteria Score | Blockers |
|---|---|---|---|---|
| Sprint 1 — Foundation | `NOT_STARTED` | — | — | — |
| Sprint 2 — Extraction & Chunking | `NOT_STARTED` | — | — | — |
| Sprint 3 — Deterministic Provenance Layer | `NOT_STARTED` | — | — | — |
| Sprint 4 — LLM as Author: AGENTS.md & ChunkWriter | `NOT_STARTED` | — | — | — |
| Sprint 5 — LLM Sub-Agent Pipeline | `NOT_STARTED` | — | — | — |
| Sprint 6 — Dynamic Structure & Human Approval | `NOT_STARTED` | — | — | — |
| Sprint 7 — Validation, Quality & Cross-Wiki | `NOT_STARTED` | — | — | — |
| Sprint 8 — README Documentation | `NOT_STARTED` | — | — | — |

### Status Values

- `NOT_STARTED` — Sprint has not begun.
- `IN_PROGRESS` — Sprint is actively being implemented.
- `TECHNICAL_REVIEW` — Implementation is complete; TAC is being evaluated.
- `AWAITING_UAT` — TAC passed; waiting for user approval of UAT.
- `COMPLETE` — TAC and UAT both passed and user has explicitly approved.
- `BLOCKED` — Implementation is blocked; requires human intervention.
- `FAILED` — Sprint failed after maximum retries.

---

## 6. Hard Rules

1. **Next sprint never starts until all UAT Acceptance Criteria are accepted by the user.** This is non-negotiable.
2. Sprints execute in strict order.
3. If a sprint's TAC or UAT fails after 3 evaluation iterations, escalate to the user.
4. Do not modify code from completed sprints unless necessary to fix a regression in the current sprint.
5. This file is the single source of truth for sprint status. Update it faithfully.

---

## 7. Changelog

| Date | Sprint | Action | Updated By |
|---|---|---|---|
| 2026-07-06 | All | Created SPRINT_INSTRUCTIONS.md and Plan_implementation structure | ZCode |

---

*This file is the anchor for the LLM Wiki CLI v2.0 implementation. Keep it updated at the end of every sprint.*
