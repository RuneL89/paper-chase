# Sprint 5 — LLM Sub-Agent Pipeline: Structure, Entity, Relationship, Evidence, Plan, Write, Critic

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-05-llm-sub-agents` |
| Goal | Convert the seven sub-agents from deterministic stubs into LLM-driven roles that share rolling memory and produce the page plan that ChunkWriter consumes. |
| Based on | `Project Vision/04_orchestration_detailed.md` §1, §4.4; `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §4.2, §4.3; `Project Vision/07_validation_and_quality.md` §2.1. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint

`Project Vision/04` §1 and §4.4 define the seven sub-agents. Currently, only `PagePlanner` calls the LLM (and shallowly). The other agents are deterministic stubs. For the vision to hold, each agent must be an LLM-driven role that consumes the outputs of the previous agents and the rolling memory.

`Project Vision/04` §4.4 lists the agents and their responsibilities:

1. **StructureAnalyst** — identifies headings, sections, tables, figures, and page boundaries.
2. **EntityExtractor** — extracts named entities.
3. **RelationshipExtractor** — identifies relationships between entities.
4. **EvidenceCollector** — collects claims and their citations.
5. **PagePlanner** — decides which pages to create or update and where they belong.
6. **ChunkWriter** — drafts the actual markdown content for the planned pages.
7. **Critic** — reviews the output for quality, consistency, and completeness.

(ChunkWriter was implemented in Sprint 4; this sprint focuses on the first five agents and the Critic's basic form.)

---

## 2. Prerequisites

- **Sprints 1–4** must be approved by the user.
- The `init` command, deterministic provenance layer, `AGENTS.md` generation, and LLM-driven ChunkWriter are in place.

---

## 3. Scope

Convert each sub-agent in `src/orchestrator/agents.ts` to an LLM-driven function (or an LLM-driven wrapper with deterministic fallback):

1. **StructureAnalyst** — LLM prompt receives the chunk text and metadata; returns headings, sections, tables, figures, page boundaries, and reading-order flags. Fallback to current heuristic if the LLM is unavailable.
2. **EntityExtractor** — LLM prompt receives the chunk and current entity list from rolling memory; returns a list of named entities with types, normalized names, and mention locations. Must be far more accurate than regex.
3. **RelationshipExtractor** — LLM prompt receives entities and chunk text; returns explicit relationships ("X is CEO of Y") and co-occurrence relationships with evidence and page ranges.
4. **EvidenceCollector** — LLM prompt receives chunk text and entities; returns specific claims, numbers, dates, quotes, and their source locations.
5. **PagePlanner** — LLM prompt receives all previous outputs, `AGENTS.md`, and rolling memory; returns a page plan with new pages, updates, folder placements, and structural proposals if needed.
6. **ChunkWriter** — Already LLM-driven from Sprint 4; this sprint focuses on integration with the other agents' outputs.
7. **Critic** — LLM prompt receives the drafted pages, page plan, extracted input, and `AGENTS.md`; returns approval or blocking issues with suggested fixes. (This is a separate agent from the deterministic validation that follows in Sprint 7.)

All agents must share a consistent prompt context:

- Current `AGENTS.md`.
- Rolling memory (compressed summary + structured state).
- Source PDF metadata.
- Current chunk text and structure.

---

## 4. Project Vision References

- `Project Vision/01` §4.2: The LLM Orchestrator and the seven sub-agents.
- `Project Vision/01` §4.3: Rolling memory.
- `Project Vision/04` §1: What the orchestrator is.
- `Project Vision/04` §4.4: Step-by-step sub-agent flow.
- `Project Vision/04` §6: What the sub-agents produce and consume.
- `Project Vision/07` §2.1: Critic review.

---

## 5. Files to Create or Modify

- `src/orchestrator/agents.ts` — convert all sub-agents to LLM-driven roles.
- `src/orchestrator/types.ts` — agent I/O types.
- `src/orchestrator/index.ts` and `src/orchestrator/ingest.ts` — wire agents together.
- `src/orchestrator/validation.ts` — may need updates for prompt validation.
- `src/llm/client.ts` — may need helper for structured JSON responses.
- `tests/orchestrator/agents.test.ts` — new or expanded tests.
- `tests/orchestrator/pipeline.test.ts` — end-to-end pipeline tests.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. Each sub-agent has a dedicated prompt builder and LLM response parser in `src/orchestrator/agents.ts`.
3. Each sub-agent has a deterministic fallback when the LLM is disabled or returns invalid JSON.
4. The orchestrator pipeline (`src/orchestrator/index.ts` and `ingest.ts`) runs the seven agents in order and passes outputs forward.
5. LLM calls are logged in the run log (no raw PDF bytes, only extracted text and metadata).
6. Tests verify that each agent returns a valid structured output when given a sample chunk.
7. Tests verify that the pipeline can process a chunk end-to-end without crashing when the LLM is in `test` mode.
8. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. Running `ingest` on a corpus with named people and companies produces entity pages for the most significant ones.
2. Entity pages contain a description, relationships, and a list of mentions with citations.
3. Topic pages are created for recurring themes.
4. Document pages mention related entities and topics and link to them.
5. The run log shows multiple LLM calls (one per sub-agent) for each processed chunk.
6. Entity and topic extraction is noticeably better than the regex-only approach from earlier sprints.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 6 until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprints 1–4. The `init` command, extraction, chunking, state tracking, deterministic writers, `AGENTS.md` generation, and LLM-driven ChunkWriter must remain functional. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 5 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with a summary, test results, and UAT checklist.
3. **Do not start Sprint 6 until the user explicitly approves.**

---

## 11. Next Sprint

After approval, proceed to **Sprint 6 — Dynamic Structure & Human Approval**: `plan/Plan_implementation/sprint-06-dynamic-structure/instruction.md`.
