# Sprint 1 — Foundation + Test Infrastructure

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-01-foundation` |
| Goal | Implement the `init` command, workspace/wiki scaffolding, and the cross-cutting infrastructure (test-mode LLM and frontmatter schema validation) needed by every later sprint. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §8.1; `Project Vision/04_orchestration_detailed.md` §2; `Project Vision/07_validation_and_quality.md` §2.4; `AGENTS.md` commands section. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint First

`Project Vision/04` §2 states that before the orchestrator runs, `init` must:

> create the workspace and wiki folders; create an empty `raw/` folder for the PDFs; write a skeleton `AGENTS.md` file with the user's high-level description of the wiki; create a skeleton wiki-level `index.md`.

Without `init`, the user cannot express the wiki's purpose up front, and `AGENTS.md` cannot exist as a schema/system prompt for later sprints.

This sprint also establishes two cross-cutting pieces of infrastructure that every later sprint depends on:

1. **Test-mode LLM**: a deterministic `test` provider that returns canned JSON responses, so tests can run without API keys or network calls.
2. **Frontmatter schema validation**: a runtime validator for YAML frontmatter, essential because the LLM will generate YAML in later sprints.

---

## 2. Prerequisites

- No prior sprints required. This is the first sprint.
- Baseline repo builds with `npm run build` and tests pass with `npm run test`.

---

## 3. Scope

1. Implement `init <slug>` command and register it in `src/cli.ts`.
2. Create the workspace directory structure for a new wiki:
   ```
   wikis/<slug>/
   ├── raw/                  # empty folder for source PDFs
   ├── config.json           # wiki-level config with status "initialized"
   ├── index.md              # skeleton wiki-level contract
   ├── AGENTS.md             # skeleton ingestion guide
   └── chunking-strategy.md  # empty or stub
   ```
3. Make `init` interactive or flag-driven:
   - `llm-wiki-cli init donations --title "Political Donations" --description "Annual filings..."`
   - If flags are missing, prompt for title and description.
4. Write a skeleton `AGENTS.md` containing the sections required by `Project Vision/02` §7.1:
   - Purpose and scope.
   - Placeholder folder structure.
   - Placeholder page types.
   - Citation rules.
   - Content rules.
   - Workflows.
   - Lint / quality rules.
5. Write a skeleton wiki-level `index.md` with `type: index`, scope, and empty children list.
6. Set wiki status to `"initialized"` (not `"ready"`).
7. Update `status` command to show initialized/sampled/ready states.
8. Fail if the wiki already exists unless `--force` is passed.

### New: Test-Mode LLM Infrastructure

`Project Vision/07` and the revised plan require that every sprint's TAC be testable without real API keys. Implement a `test` provider in `src/llm/client.ts`:

- Accepts a prompt and returns a deterministic JSON response based on the prompt type or a configured fixture.
- Is selectable in `.kimi-code/config.json` as `provider: "test"`.
- All tests in this and later sprints use the `test` provider by default.

### New: Frontmatter Schema Validation

`Project Vision/07` §2.4 requires schema validation for every page. Implement a runtime validator in a new module (e.g., `src/validation/schema.ts`):

- Define required fields per page type (`index`, `document`, `source`, `topic`, `entity`, `raw`, etc.) based on `Project Vision/05`.
- Validate YAML frontmatter against the schema and produce structured errors.
- This validator is used in tests in this sprint and in production in later sprints.

### New: Foundation Design Decisions

The following cross-cutting conventions must be decided, documented, and implemented in Sprint 1 so later sprints can rely on them.

#### Rolling Memory Format

`Project Vision/04` §5 describes rolling memory as a compressed natural-language summary plus a structured state object. For this MvP:

- The natural-language summary lives in `output/.state/memory-summary.md`.
- The structured state lives in `output/.state/rolling-memory.json`.
- The summary is capped at **8,000 tokens** by default (configurable via `llm.maxRollingMemoryTokens`).
- The structured state is capped at **500 entities, 200 topics, and 500 relationships**.
- When a cap is exceeded, the oldest **20%** of entities/topics/relationships are archived into a "Historical Summary" section of the natural-language summary.
- If the summary still cannot fit after compaction, the system switches to **summary-only mode**: only the compressed summary is passed to the LLM; the structured state is used for deterministic lookups (link validation, entity deduplication).
- Rolling memory is persisted to disk after every chunk so a failed run can resume from the last persisted state.

> **Note:** Full compaction logic is implemented in Sprint 5; Sprint 1 only defines the format, caps, and persistence contract.

#### LLM Resilience and Recovery Mode

`Project Vision/07` §7 requires configurable error handling. Sprint 1 must add the configuration schema and basic retry behavior so Sprint 4b can build on it:

- **Retry strategy:** Exponential backoff with jitter: 1s, 2s, 4s, 8s. Maximum **3 retries** per LLM call.
- **Rate limiting:** Maintain a per-provider request queue with configurable concurrency (default **5** parallel requests). Respect `Retry-After` headers when present.
- **Malformed JSON:** If the LLM returns unparseable JSON, retry once with a stricter prompt. If still malformed, mark the chunk as failed and fall back to deterministic output.
- **Recovery mode:** Add `recoveryMode: "fallback" | "aggressive" | "abort"` to the wiki config (default `"fallback"`).
  - `fallback`: switch to deterministic output after retries are exhausted.
  - `aggressive`: retry indefinitely (with exponential backoff).
  - `abort`: stop the run and report the error.
- **Resume mechanism:** The full mid-run resume (per-chunk state files and `--resume` flag) is implemented in Sprint 4b, but Sprint 1 must define the `output/.state/chunks/` directory and the `chunk-state.json` schema.

> **Circuit breaker:** If more than 30% of chunks fail in a 5-minute window, the run pauses and prompts the user to continue, fallback, or abort. The full circuit breaker is implemented in Sprint 5; Sprint 1 defines the config schema.

#### Slugification and Disambiguation

`Project Vision/05` §6.3 implies normalized entity names, but the exact rules are not specified. Sprint 1 must define and implement the slugification function so Sprint 3 can write collision-free entity pages:

- Apply Unicode **NFKD** normalization.
- Convert to lowercase.
- Replace non-alphanumeric characters with hyphens.
- Collapse consecutive hyphens and trim trailing hyphens.
- Examples:
  - `slugify("Russell Barkley")` → `russell-barkley`
  - `slugify("Électricité de France")` → `electricite-de-france`
- When a slug collision is detected, append an incremental integer: `john-smith.md`, `john-smith-1.md`, `john-smith-2.md`. The first entity keeps the base slug; subsequent entities receive suffixes.
- The structured state maps every extracted entity name to its canonical slug so that later chunks can resolve aliases (`"J. Smith"` → `john-smith`).

> **Canonical name resolution** is implemented in Sprint 5, but the slugification and collision-detection functions must exist after Sprint 1.

#### Authority Matrix

`Project Vision/04` §7 describes a division of authority. Sprint 1 documents this in the developer-facing `AGENTS.md` and the generated skeleton `AGENTS.md`:

| Role | Authority |
|---|---|
| **User (human)** | High-level purpose, PDF curation, structural approval, when to run commands. |
| **LLM Orchestrator** | Folder structure, page content, entities, links, citations, new page types. |
| **Local deterministic code** | Extraction, hashing, validation, orchestration, file I/O. |
| **Critic** | Whether LLM output is good enough to commit. |

No deterministic code may draft or mutate markdown bodies; no LLM agent may compute hashes or manage file I/O directly.

### New: Recommended Implementation Phases

Because Sprint 1 introduces seven distinct foundation features, implement them in three verified phases rather than all at once. Each phase must end with `npm run build && npm run test` passing before proceeding.

1. **Phase 1 — CLI and scaffolding:** `init` command, `status` update, and the workspace/wiki folder tree.
2. **Phase 2 — Test infrastructure:** `test` LLM provider and frontmatter schema validator.
3. **Phase 3 — Cross-cutting utilities:** slugification/disambiguation, rolling memory format and persistence, LLM retry/resilience config, and authority matrix documentation.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 4: Human Approval for Structural Changes.
- `Project Vision/01` §8.1: Initiation flow.
- `Project Vision/02` §7: The `AGENTS.md` schema/ingestion guide.
- `Project Vision/02` §7.1: What `AGENTS.md` must contain.
- `Project Vision/05` §3: The `index` page type and frontmatter.
- `Project Vision/04` §5: Rolling memory.
- `Project Vision/04` §7: Authority matrix (who decides what).
- `Project Vision/05` §6.3: Entity naming and slug conventions.
- `Project Vision/07` §7: Error handling and recovery.
- `AGENTS.md`: The current command list must be updated to include `init`.

---

## 5. Files to Create or Modify

- `src/cli.ts` — register `init` command.
- `src/commands/init.ts` — new file.
- `src/writers/agents.ts` — skeleton `AGENTS.md` writer.
- `src/writers/index.ts` — skeleton wiki-level `index.md` writer.
- `src/config.ts` — add `status` field (`initialized` / `sampled` / `ready`), rolling memory caps, LLM retry/recovery settings, and slugification defaults.
- `src/utils/slug.ts` — new slugification and disambiguation utility.
- `src/orchestrator/memory.ts` — rolling memory types and persistence contract (or extend `src/orchestrator/types.ts`).
- `src/llm/client.ts` — add `test` provider and retry/resilience layer.
- `src/commands/status.ts` — show status field.
- `src/validation/schema.ts` — new schema validator.
- `tests/commands/init.test.ts` — new tests.
- `tests/validation/schema.test.ts` — new tests.
- `tests/llm/client.test.ts` — new or expanded tests for test provider and retry behavior.
- `tests/utils/slug.test.ts` — new tests for slugification and disambiguation.
- `tests/orchestrator/memory.test.ts` — new tests for rolling memory format and persistence.
- `AGENTS.md` — update command list to include `init`.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. `npm run test` passes; new tests cover:
   - `init` creates the expected folder tree.
   - Missing required flags prompt the user (tested with mocked stdin).
   - Skeleton `AGENTS.md` contains all sections listed in `Project Vision/02` §7.1 and the authority matrix.
   - `init` fails if the wiki already exists unless `--force` is passed.
   - Generated `AGENTS.md` and `index.md` have valid YAML frontmatter.
   - The `test` LLM provider returns deterministic JSON without network calls.
   - The frontmatter schema validator correctly rejects missing required fields and invalid page types.
   - The slugification utility produces the expected slugs and resolves collisions with incremental suffixes.
   - The rolling memory schema is persisted to `output/.state/` and respects configured caps.
   - The LLM retry config and `recoveryMode` are loaded from `config.json` and applied by the client.
3. Wiki status is persisted in `config.json` as `"initialized"`.
4. `status` command displays the initialized status.

---

## 7. User Acceptance Criteria (UAT)

1. Running `llm-wiki-cli init donations` creates `wikis/donations/` with an empty `raw/`, a `config.json`, a skeleton `AGENTS.md`, and a skeleton `index.md`.
2. The user can open `AGENTS.md` and see a purpose section that matches what they typed.
3. Running `llm-wiki-cli ingest donations` before `sample` warns: "Wiki is not ready; run sample first."
4. The generated `AGENTS.md` is a valid markdown file with YAML frontmatter.
5. Re-running `init` on the same slug without `--force` fails with a clear error.
6. The `test-llm` command can use the `test` provider without an API key and return a deterministic response.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality (naming, structure, deduplication) while ensuring all tests still pass.
5. **HUMAN GATE** — Do **not** proceed to Sprint 2 until the user has explicitly approved the UAT.

### Boundedness Rules

- Compile-fix loop: max 5 iterations.
- Evaluator-optimizer loop: max 3 iterations.
- TDD loop for a single feature: max 10 iterations.
- If any loop hits its maximum without success, stop and escalate to the user.

---

## 9. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 1 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate.
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with:
   - A summary of implemented features.
   - A list of tests that passed.
   - The UAT checklist.
   - A clear request for approval.
3. **Do not start Sprint 2 until the user explicitly approves.**

---

## 10. Next Sprint

After approval, proceed to **Sprint 2 — Extraction & Chunking**: `plan/Plan_implementation/sprint-02-extraction-chunking/instruction.md`.
