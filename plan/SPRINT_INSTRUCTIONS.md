# SPRINT_INSTRUCTIONS.md — Implementation Tracker (Revised)

| Attribute | Value |
|---|---|
| Project | LLM Wiki CLI v2.0 |
| Version | 2.0-revised |
| Date | 2026-07-07 |
| Based on | `plan/IMPLEMENTATION_PLAN.md` and `Project Vision/` |
| Purpose | Single source of truth for sprint execution order, status, and human gates. |

---

## 1. How to Use This File

This file is the anchor for the implementation phase. It records which sprint is currently in progress, which are complete, and which are awaiting user approval. Every sprint has its own instruction file in `plan/Plan_implementation/sprint-NN-slug/`.

**Rule:** The next sprint must **NEVER** start until **all** Technical Acceptance Criteria (TAC) and **all** User Acceptance Criteria (UAT) for the current sprint have been met, and the user has **explicitly approved** the UAT.

### Pre-Sprint Reading Requirement

Before starting any sprint, the implementer must read the canonical `Project Vision/` documents and the current sprint's instruction file. These documents define the architectural intent, page types, folder conventions, and contract hierarchy that tests alone cannot fully capture.

Required reading before sprint work begins:

- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` — product purpose and high-level architecture.
- `Project Vision/02_WIKI_concept_detailed.md` — wiki concept, page types, and the per-wiki `AGENTS.md` ingestion-guide role.
- `Project Vision/03_DOX_concept_detailed.md` — DOX-inspired cascading `index.md` contract hierarchy and folder co-location rules.
- `Project Vision/04_orchestration_detailed.md` — sampling and ingestion orchestrator flows.
- `Project Vision/05_page_types_specification.md` — frontmatter schemas and content structures for default page types.
- `Project Vision/06_citation_and_provenance.md` — citation format, `sources` frontmatter, and provenance rules.
- `Project Vision/07_validation_and_quality.md` — validation order, Critic, lint, and structural-change approval.
- `plan/Plan_implementation/sprint-NN-slug/instruction.md` — the specific sprint's instructions.

**Rule:** If there is a conflict between the sprint instruction file and the Project Vision, the Project Vision is the source of truth. Raise the conflict with the user before implementing.

### Sprint Execution Order

```
Sprint 1: Foundation + Test Infrastructure
    ↓
Sprint 2: Extraction & Chunking
    ↓
Sprint 3: Deterministic Provenance Layer + ingest-all
    ↓
Sprint 4a: Sampling Strategies & AGENTS.md
    ↓
Sprint 4b: LLM-Driven ChunkWriter
    ↓
Sprint 5: LLM Sub-Agent Pipeline
    ↓
Sprint 6: Dynamic Structure & Human Approval
    ↓
Sprint 7: Selective Re-ingestion
    ↓
Sprint 8: Validation, Quality & Cross-Wiki
    ↓
Sprint 9: README Documentation
```

### Where to Find Each Sprint's Instructions

| Sprint | Folder | Instruction File |
|---|---|---|
| Sprint 1 — Foundation + Test Infrastructure | `plan/Plan_implementation/sprint-01-foundation/` | `instruction.md` |
| Sprint 2 — Extraction & Chunking | `plan/Plan_implementation/sprint-02-extraction-chunking/` | `instruction.md` |
| Sprint 3 — Deterministic Provenance Layer + `ingest-all` | `plan/Plan_implementation/sprint-03-deterministic-provenance/` | `instruction.md` |
| Sprint 4a — Sampling Strategies & `AGENTS.md` | `plan/Plan_implementation/sprint-04a-agents-md-sampling/` | `instruction.md` |
| Sprint 4b — LLM-Driven ChunkWriter | `plan/Plan_implementation/sprint-04b-llm-chunkwriter/` | `instruction.md` |
| Sprint 5 — LLM Sub-Agent Pipeline | `plan/Plan_implementation/sprint-05-llm-sub-agents/` | `instruction.md` |
| Sprint 6 — Dynamic Structure & Human Approval | `plan/Plan_implementation/sprint-06-dynamic-structure/` | `instruction.md` |
| Sprint 7 — Selective Re-ingestion | `plan/Plan_implementation/sprint-07-selective-reingestion/` | `instruction.md` |
| Sprint 8 — Validation, Quality & Cross-Wiki | `plan/Plan_implementation/sprint-08-validation-quality/` | `instruction.md` |
| Sprint 9 — README Documentation | `plan/Plan_implementation/sprint-09-readme/` | `instruction.md` |

---

## 2. What Changed in the Revised Plan

The original 8-sprint plan was revised to address the following weaknesses:

1. **Sprint 1 now includes test-mode definition and frontmatter schema validation.** Every later sprint needs a deterministic `test` LLM provider and a YAML schema validator.
2. **Sprint 2 clarifies that `chunking-strategy.md` is deterministic**, not LLM-written.
3. **Sprint 3 explicitly scopes `ingest-all`.**
4. **Sprint 4 is split into 4a and 4b.** Sprint 4a discovers the sampling strategy *before* generating the full `AGENTS.md`, resolving the circular dependency. Sprint 4b handles the LLM-driven ChunkWriter and the engine refactoring.
5. **Sprint 5 consumes the `AGENTS.md` and sampling context** produced in Sprint 4a.
6. **Sprint 6 is narrowed to structural proposals and human approval.**
7. **New Sprint 7** is dedicated to selective re-ingestion after approved structural changes, with a clear strategy for preserving manual edits.
8. **Sprint 8** is renumbered from the original Sprint 7 (validation, quality, cross-wiki).
9. **Sprint 9** is renumbered from the original Sprint 8 (README documentation).

---

## 3. TDD Red-Green-Refactor-Evaluate Methodology

Every sprint must be implemented using the following loop. The instruction file for each sprint repeats these rules.

### 3.1 RED Phase — Write Tests First

Before implementing any feature in a sprint, write the Technical Acceptance Criteria as executable tests (unit tests, integration tests, or manual verification scripts). These tests must fail against the current codebase.

### 3.2 GREEN Phase — Make Tests Pass

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

### 3.3 EVALUATE Phase — Evaluator-Optimizer Loop

Run the Evaluator-Optimizer loop against the sprint's TAC and UAT. Treat the TAC as a weighted rubric. Score each criterion as **PASS** or **FAIL**. If any criterion fails:

1. Revise the implementation.
2. Re-evaluate.

**Maximum 3 evaluation iterations per sprint.** During this phase, use the actual Kimi Code credentials to run the implemented feature through the LLM and verify it works as required.

### 3.4 REFACTOR Phase — Improve Quality

Once all tests pass and all criteria are met, improve code quality (naming, structure, deduplication) while ensuring all tests still pass. Do not add new features during refactoring.

### 3.5 HUMAN GATE — User Approval Required

Do **not** proceed to the next sprint until the user has explicitly approved the UAT Acceptance Criteria. This is a hard Human-in-the-Loop checkpoint.

At the end of each sprint, present the user with:

1. A summary of what was implemented.
2. A list of tests that passed (with pass rate).
3. The acceptance criteria score (PASS/FAIL for each criterion).
4. Any blockers or open questions.
5. A clear request for approval: **"Approve"** or **"Reject"**.

---

## 4. Boundedness Rules

Every loop must have a termination condition:

| Loop | Maximum Iterations | Action on Failure |
|---|---|---|
| Compile-fix loop | 5 | Stop and ask for human input. |
| Evaluator-optimizer loop | 3 | Stop and ask for human input. |
| TDD loop for a single feature | 10 | Stop and ask for human input. |
| Documentation review loop (Sprint 9) | 3 | Stop and ask for human input. |

If any loop hits its maximum without success, escalate to the user. Do not silently continue.

---

## 5. State Accumulation Rule

When moving to the next sprint, preserve all context from previous sprints. Do not start fresh. The `plan/` directory, the test suite, and the working codebase are the accumulated state. Use them as context for each new sprint.

This means:

- Previous tests must continue to pass.
- Previous commands must continue to work.
- Previous configuration files and generated artifacts must remain valid.

---

## 6. Status Table

This table is updated at the end of every sprint and whenever a sprint's status changes. It is the primary state checkpoint.

| Sprint | Status | Test Pass Rate | Acceptance Criteria Score | Blockers |
|---|---|---|---|---|
| Sprint 1 — Foundation + Test Infrastructure | `COMPLETE` | 90/90 (100%) | TAC: 10/10 PASS; UAT: approved | — |
| Sprint 2 — Extraction & Chunking | `COMPLETE` | 106/106 (100%) | TAC: 7/7 PASS; UAT: approved | — |
| Sprint 3 — Deterministic Provenance Layer + `ingest-all` | `NOT_STARTED` | — | — | — |
| Sprint 4a — Sampling Strategies & `AGENTS.md` | `NOT_STARTED` | — | — | — |
| Sprint 4b — LLM-Driven ChunkWriter | `NOT_STARTED` | — | — | — |
| Sprint 5 — LLM Sub-Agent Pipeline | `NOT_STARTED` | — | — | — |
| Sprint 6 — Dynamic Structure & Human Approval | `NOT_STARTED` | — | — | — |
| Sprint 7 — Selective Re-ingestion | `NOT_STARTED` | — | — | — |
| Sprint 8 — Validation, Quality & Cross-Wiki | `NOT_STARTED` | — | — | — |
| Sprint 9 — README Documentation | `NOT_STARTED` | — | — | — |

### Status Values

- `NOT_STARTED` — Sprint has not begun.
- `IN_PROGRESS` — Sprint is actively being implemented.
- `TECHNICAL_REVIEW` — Implementation is complete; TAC is being evaluated.
- `AWAITING_UAT` — TAC passed; waiting for user approval of UAT.
- `COMPLETE` — TAC and UAT both passed and user has explicitly approved.
- `BLOCKED` — Implementation is blocked; requires human intervention.
- `FAILED` — Sprint failed after maximum retries.

---

## 7. Hard Rules

1. **Next sprint never starts until all UAT Acceptance Criteria are accepted by the user.** This is non-negotiable.
2. Sprints execute in strict order.
3. If a sprint's TAC or UAT fails after 3 evaluation iterations, escalate to the user.
4. Do not modify code from completed sprints unless necessary to fix a regression in the current sprint.
5. This file is the single source of truth for sprint status. Update it faithfully.

---

## 8. Changelog

| Date | Sprint | Action | Updated By |
|---|---|---|---|
| 2026-07-07 | All | Revised plan: split Sprint 4, added test mode, schema validation, selective re-ingestion | ZCode |
| 2026-07-08 | Sprint 1 | Implemented init command, test provider, schema validator, slug/memory/resilience foundations; COMPLETE | ZCode |
| 2026-07-08 | Sprint 2 | Implemented page-based chunking, SHA-256 state tracking, deterministic chunking-strategy.md, extraction scan confidence; TAC passed, UAT awaiting approval | ZCode |
| 2026-07-08 | Sprint 2 | **Bug fix:** content pages were written to `output/<folder>/` instead of co-located with their folder-level `index.md` contracts. Fixing so document/source/topic/entity/raw pages live in their respective root folders per the DOX framework. | ZCode |
| 2026-07-08 | All | Added pre-sprint reading requirement: implementer must read `Project Vision/` files and the sprint instruction file before starting work; Project Vision wins in conflicts. | ZCode |
| 2026-07-08 | Sprint 2 | UAT approved by user; Sprint 2 marked COMPLETE. Next sprint NOT started. | ZCode |

---

*This file is the anchor for the LLM Wiki CLI v2.0 implementation. Keep it updated at the end of every sprint.*
