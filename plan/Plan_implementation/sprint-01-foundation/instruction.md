# Sprint 1 — Foundation: `init`, Workspace Scaffolding, and Status Gate

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-01-foundation` |
| Goal | Implement the `init` command and the workspace/wiki scaffolding so that every subsequent sprint has a well-defined starting point. |
| Based on | `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §8.1; `Project Vision/04_orchestration_detailed.md` §2; `AGENTS.md` commands section. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint First

`Project Vision/04` §2 states that before the orchestrator runs, `init` must:

> create the workspace and wiki folders; create an empty `raw/` folder for the PDFs; write a skeleton `AGENTS.md` file with the user's high-level description of the wiki; create a skeleton wiki-level `index.md`.

`Project Vision/01` §8.1 adds:

> A new wiki is created with an `init <slug>` command. This command: creates the workspace directory structure; creates the wiki folder `wikis/<slug>/` with an empty `raw/` folder; writes an initial `AGENTS.md` ingestion guide tailored to the wiki's expected content; creates a skeleton wiki-level `index.md`.

Without `init`, the user cannot express the wiki's purpose up front, and the per-wiki `AGENTS.md` cannot exist as the schema/system prompt for later sprints.

---

## 2. Prerequisites

- No prior sprints required. This is the first sprint.
- Baseline repo builds with `npm run build` and tests pass with `npm run test`.

---

## 3. Scope

Implement the `init <slug>` command and the supporting scaffolding:

1. Register `init` in `src/cli.ts`.
2. Create `src/commands/init.ts`.
3. Create the workspace directory structure for a new wiki:
   ```
   wikis/<slug>/
   ├── raw/                  # empty folder for source PDFs
   ├── config.json           # wiki-level config with status "initialized"
   ├── index.md              # skeleton wiki-level contract
   ├── AGENTS.md             # skeleton ingestion guide
   └── chunking-strategy.md  # empty or stub
   ```
4. Make `init` interactive or flag-driven:
   - `llm-wiki-cli init donations --title "Political Donations" --description "Annual filings..."`
   - If flags are missing, prompt for title and description.
5. Write a skeleton `AGENTS.md` containing the sections required by `Project Vision/02` §7.1:
   - Purpose and scope.
   - Placeholder folder structure.
   - Placeholder page types.
   - Citation rules.
   - Content rules.
   - Workflows.
   - Lint / quality rules.
6. Write a skeleton wiki-level `index.md` with `type: index`, scope, and empty children list.
7. Set wiki status to `"initialized"` (not `"ready"`).
8. Update `status` command to show initialized/sampled/ready states.
9. Fail if the wiki already exists unless `--force` is passed.

---

## 4. Project Vision References

- `Project Vision/01` §3 Principle 4: Human Approval for Structural Changes — `init` is the human's first point of control.
- `Project Vision/01` §8.1: Initiation flow.
- `Project Vision/02` §7: The `AGENTS.md` schema/ingestion guide.
- `Project Vision/02` §7.1: What `AGENTS.md` must contain.
- `Project Vision/05` §3: The `index` page type and frontmatter.
- `AGENTS.md`: The current command list must be updated to include `init`.

---

## 5. Files to Create or Modify

- `src/cli.ts` — register `init` command.
- `src/commands/init.ts` — new file.
- `src/writers/agents.ts` — skeleton `AGENTS.md` writer.
- `src/writers/index.ts` — skeleton wiki-level `index.md` writer.
- `src/config.ts` — add `status` field (`initialized` / `sampled` / `ready`).
- `src/commands/status.ts` — show status field.
- `tests/commands/init.test.ts` — new tests.
- `AGENTS.md` — update command list to include `init`.

---

## 6. Technical Acceptance Criteria (TAC)

1. `npm run build` succeeds with no TypeScript errors.
2. `npm run test` passes; new tests cover:
   - `init` creates the expected folder tree.
   - Missing required flags prompt the user (tested with mocked stdin).
   - Skeleton `AGENTS.md` contains all sections listed in `Project Vision/02` §7.1.
   - `init` fails if the wiki already exists unless `--force` is passed.
   - Generated `AGENTS.md` and `index.md` have valid YAML frontmatter.
3. Wiki status is persisted in `config.json` as `"initialized"`.
4. `status` command displays the initialized status.

---

## 7. User Acceptance Criteria (UAT)

1. Running `llm-wiki-cli init donations` creates `wikis/donations/` with an empty `raw/`, a `config.json`, a skeleton `AGENTS.md`, and a skeleton `index.md`.
2. The user can open `AGENTS.md` and see a purpose section that matches what they typed.
3. Running `llm-wiki-cli ingest donations` before `sample` warns: "Wiki is not ready; run sample first."
4. The generated `AGENTS.md` is a valid markdown file with YAML frontmatter.
5. Re-running `init` on the same slug without `--force` fails with a clear error.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Follow this exact loop for every feature in this sprint:

1. **RED PHASE** — Write the tests first. Before implementing a feature, write executable tests that assert the TAC. These tests must fail against the current codebase.
2. **GREEN PHASE** — Implement the minimal code to make the tests pass. After any code change, immediately run `npm run build` and `npm run test`. If compilation or tests fail, enter a Self-Correcting Generator-Critic loop: analyze the error, reason about the fix, apply the fix, and re-run. **Maximum 5 iterations per fix attempt.** If unresolved after 5, stop and ask for human input.
3. **EVALUATE PHASE** — Run the Evaluator-Optimizer loop against the TAC and UAT. Score each criterion as PASS or FAIL. **Maximum 3 evaluation iterations.** If any criterion fails, revise and re-evaluate. During this phase, use the actual Kimi Code credentials to verify the implemented feature works end-to-end.
4. **REFACTOR PHASE** — Once all tests pass and all criteria are met, improve code quality (naming, structure, deduplication) while keeping all tests green.
5. **HUMAN GATE** — Do **not** proceed to Sprint 2 until the user has explicitly approved the UAT. Present a summary of what was implemented, what tests passed, and ask for explicit "approve" or "reject".

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

