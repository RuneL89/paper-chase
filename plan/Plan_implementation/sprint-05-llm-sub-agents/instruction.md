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

(ChunkWriter was implemented in Sprint 4b; this sprint focuses on the first five agents and the Critic's basic form.)

---

## 2. Prerequisites

- **Sprints 1, 2, 3, 4a, and 4b** must be approved by the user.
- The `init` command, deterministic provenance layer, `AGENTS.md` generation, sampling strategies, and LLM-driven ChunkWriter are in place.

---

## 3. Scope

Convert each sub-agent in `src/orchestrator/agents.ts` to an LLM-driven function (or an LLM-driven wrapper with deterministic fallback). Each agent must consume the `AGENTS.md` ingestion guide and the sampling context produced in Sprint 4a:

1. **StructureAnalyst** — LLM prompt receives the chunk text and metadata, plus `AGENTS.md`; returns headings, sections, tables, figures, page boundaries, and reading-order flags. Fallback to current heuristic if the LLM is unavailable.
2. **EntityExtractor** — LLM prompt receives the chunk, `AGENTS.md`, and current entity list from rolling memory; returns a list of named entities with types, normalized names, and mention locations. Must be far more accurate than regex.
3. **RelationshipExtractor** — LLM prompt receives entities, `AGENTS.md`, and chunk text; returns explicit relationships ("X is CEO of Y") and co-occurrence relationships with evidence and page ranges.
4. **EvidenceCollector** — LLM prompt receives chunk text, `AGENTS.md`, and entities; returns specific claims, numbers, dates, quotes, and their source locations.
5. **PagePlanner** — LLM prompt receives all previous outputs, `AGENTS.md`, sampling context, and rolling memory; returns a page plan with new pages, updates, folder placements, and structural proposals if needed.
6. **ChunkWriter** — Already LLM-driven from Sprint 4b; this sprint focuses on integration with the other agents' outputs.
7. **Critic** — LLM prompt receives the drafted pages, page plan, extracted input, `AGENTS.md`, and sampling context; returns approval or blocking issues with suggested fixes. (This is a separate agent from the deterministic validation that follows in Sprint 8.)

All agents must share a consistent prompt context:

- Current `AGENTS.md` and the sampling context from Sprint 4a.
- Rolling memory (compressed summary + structured state).
- Source PDF metadata.
- Current chunk text and structure.
- The test-mode LLM provider from Sprint 1 (used for deterministic tests).

### New: Rolling Memory, Canonical Names, and Extraction Rules

This sprint consumes rolling memory at scale, so it must implement the behaviors that were only defined in Sprint 1.

#### Rolling Memory Compaction

- When the natural-language summary exceeds the configured token cap (default 8,000 tokens) or the structured state exceeds the entity/topic/relationship caps, archive the oldest **20%** into a "Historical Summary" section of `memory-summary.md`.
- If the summary still cannot fit after compaction, switch to **summary-only mode**: the LLM receives only the compressed summary; the structured state is used for deterministic lookups.
- Persist rolling memory to disk after every chunk.

#### Canonical Name Resolution

- The EntityExtractor maps every extracted name to a canonical slug using the slugification function from Sprint 1.
- If the LLM extracts an alias (e.g., `"J. Smith"`) that matches an existing canonical entity (`"John Smith"`), resolve it to the existing slug.
- If the canonical slug is already taken by a different entity, apply the disambiguation suffix from Sprint 1.
- This canonical map is stored in the rolling memory structured state and updated after every chunk.

#### `mentions` Count

- Entity pages track a `mentions` count in their frontmatter.
- The EntityExtractor increments the count for every chunk where the entity appears.
- The count is persisted in the structured state so re-ingestion does not double-count.

#### `related` Field on Topic Pages

- The PagePlanner includes `related` links in every topic page plan.
- The ChunkWriter populates the `related` field in the topic page frontmatter based on the page plan, pointing to supporting documents and entities.

#### Page Type Discovery Checklist

The PagePlanner prompt must include the six discovery questions from `Project Vision/05` §10. Its JSON output must include a `discovery` section answering:

1. Does this chunk belong to an existing document page or a new one?
2. Does it mention any entities that should have entity pages?
3. Does it introduce or reinforce any themes that should have topic pages?
4. Does it contain any tables or figures that must be preserved?
5. Are there any pages that should be raw because they are unparseable?
6. Does the corpus demand a new page type?

#### Duplicate Entity Flagging

- Implement a deterministic similarity check over the entity list.
- If two entity slugs have a Levenshtein distance less than 3 (or share a base slug before disambiguation suffix), flag them as potential duplicates in the rolling memory structured state.
- Do **not** auto-merge; the journalist decides. The final lint report (Sprint 8) surfaces these flags.

---

## 4. Project Vision References

- `Project Vision/01` §4.2: The LLM Orchestrator and the seven sub-agents.
- `Project Vision/01` §4.3: Rolling memory.
- `Project Vision/04` §1: What the orchestrator is.
- `Project Vision/04` §4.4: Step-by-step sub-agent flow.
- `Project Vision/04` §6: What the sub-agents produce and consume.
- `Project Vision/05` §6.1: Entity `mentions` count.
- `Project Vision/05` §6.3: Entity naming and canonical names.
- `Project Vision/05` §7.1: Topic `related` field.
- `Project Vision/05` §10: Page type discovery checklist.
- `Project Vision/07` §2.1: Critic review.
- `Project Vision/07` §2.3: Duplicate entity flagging.

---

## 5. Files to Create or Modify

- `src/orchestrator/agents.ts` — convert all sub-agents to LLM-driven roles.
- `src/orchestrator/types.ts` — agent I/O types and rolling memory shape.
- `src/orchestrator/memory.ts` — rolling memory persistence and compaction logic.
- `src/orchestrator/index.ts` and `src/orchestrator/ingest.ts` — wire agents together.
- `src/orchestrator/validation.ts` — may need updates for prompt validation.
- `src/llm/client.ts` — may need helper for structured JSON responses.
- `src/utils/similarity.ts` — new string-similarity helper for duplicate entity flagging.
- `tests/orchestrator/agents.test.ts` — new or expanded tests.
- `tests/orchestrator/memory.test.ts` — new tests for compaction and overflow.
- `tests/orchestrator/pipeline.test.ts` — end-to-end pipeline tests (canonical names, mentions, related, discovery checklist).

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. Each sub-agent has a dedicated prompt builder and LLM response parser in `src/orchestrator/agents.ts`.
3. Each sub-agent has a deterministic fallback when the LLM is disabled or returns invalid JSON.
4. The orchestrator pipeline (`src/orchestrator/index.ts` and `ingest.ts`) runs the seven agents in order and passes outputs forward.
5. LLM calls are logged in the run log (no raw PDF bytes, only extracted text and metadata).
6. Tests verify that each agent returns a valid structured output when given a sample chunk.
7. Tests verify that the pipeline can process a chunk end-to-end without crashing when the LLM is in `test` mode.
8. Rolling memory compaction is triggered when the summary or structured-state caps are exceeded.
9. Entity aliases resolve to the same canonical slug and share a disambiguation suffix when required.
10. Entity page frontmatter includes a correct `mentions` count updated across chunks.
11. Topic page frontmatter includes a `related` field with supporting documents and entities.
12. The PagePlanner output includes a `discovery` section answering the six page-type discovery questions.
13. Potential duplicate entities (Levenshtein distance < 3 or shared base slug) are flagged in the rolling memory state.
14. `npm run test` passes.

---

## 7. User Acceptance Criteria (UAT)

1. Running `ingest` on a corpus with named people and companies produces entity pages for the most significant ones.
2. Entity pages contain a description, relationships, a `mentions` count, and a list of mentions with citations.
3. Topic pages are created for recurring themes and include `related` links to supporting documents and entities.
4. Document pages mention related entities and topics and link to them.
5. The run log shows multiple LLM calls (one per sub-agent) for each processed chunk.
6. Entity and topic extraction is noticeably better than the regex-only approach from earlier sprints.
7. Entity aliases (e.g., `"J. Smith"` and `"John Smith"`) resolve to the same entity page when they refer to the same person.
8. If two distinct entities share the same canonical name, the second one receives a disambiguation suffix (`john-smith-1.md`).
9. Potential duplicate entities are flagged for the user to review.

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

Preserve all context from Sprints 1–4b. The `init` command, extraction, chunking, state tracking, deterministic writers, `AGENTS.md` generation, sampling strategies, and LLM-driven ChunkWriter must remain functional. Do not start fresh.

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
