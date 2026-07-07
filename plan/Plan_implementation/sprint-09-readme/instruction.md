# Sprint 9 — README Documentation: Final Project Documentation

| Attribute | Value |
|---|---|
| Sprint ID | `sprint-09-readme` |
| Goal | Rewrite and finalize `README.md` so that it is a complete, self-contained guide for users, mid-level developers, and senior developers. |
| Based on | `AGENTS.md`; `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md`; `Project Vision/04_orchestration_detailed.md`; `Project Vision/07_validation_and_quality.md`; this implementation plan. |
| Status | `NOT_STARTED` |

---

## 1. Why This Sprint Last

The README is the front door of the project. It must be accurate and complete only after all implementation is done. It must explain what the tool does, how a user uses it, how the internals work, and how the codebase is organized. Writing it last ensures it reflects the actual implemented behavior rather than the planned behavior.

The required structure is:

1. **Introduction** — elevator pitch of what the app is.
2. **Functional Architecture** — end-user friendly description of how the app works from the user's perspective.
3. **Step-by-Step Architecture / Flow** — mid-level developer explanation of the agent flow, orchestration, rejection loops, and rejection criteria.
4. **Detailed Technical Architecture** — senior developer explanation of the entire app, sufficient to understand the codebase without reading other files.
5. **Project Structure** — description of all folders and files.

---

## 2. Prerequisites

- **Sprints 1–8** must be approved by the user.
- All features are implemented, tested, and accepted.

---

## 3. Scope

1. Rewrite `README.md` from scratch using the required five-section structure.
2. Ensure the README is consistent with:
   - `AGENTS.md` (commands, conventions, tech stack).
   - `Project Vision/01` (purpose, philosophy, page types, flows).
   - `Project Vision/04` (orchestrator, sub-agents, rolling memory).
   - `Project Vision/07` (validation order, Critic, lint, structural proposals).
   - The implemented CLI behavior.
3. Include practical usage examples:
   - `llm-wiki-cli init <slug>`
   - `llm-wiki-cli sample <slug>`
   - `llm-wiki-cli ingest <slug>`
   - `llm-wiki-cli ingest-all`
   - `llm-wiki-cli status <slug>`
   - `llm-wiki-cli test-llm`
4. Include setup instructions (Node.js ≥20, `npm install`, LLM configuration).
5. Include security notes (no raw PDFs over the network, API keys in `.kimi-code/config.json`).
6. Ensure the README is readable by:
   - A journalist who has never seen the code.
   - A mid-level developer who wants to understand the flow.
   - A senior developer who wants to maintain or extend the system.
7. Document the claim verification path from `Project Vision/06` §8 so a reader can verify any claim:
   - Find the inline citation `[^srcN]` on the wiki page.
   - Look at the `sources` entry for `srcN` in the frontmatter.
   - Note the source PDF and page range.
   - Open the corresponding `source` page to confirm provenance.
   - Open the original PDF at the cited page range to verify the claim.

---

## 4. Project Vision References

- `Project Vision/01` §1: Purpose and philosophy.
- `Project Vision/01` §2: What the tool creates in the end.
- `Project Vision/01` §3: Core principles.
- `Project Vision/01` §4: High-level architecture.
- `Project Vision/04` §4: The seven sub-agents and rolling memory.
- `Project Vision/06` §8: Claim verification path.
- `Project Vision/07` §2, §5, §7: Validation, structural proposals, and recovery.
- `AGENTS.md`: Tech stack, commands, coding conventions, known gotchas.

---

## 5. Files to Create or Modify

- `README.md` — rewrite from scratch.
- `docs/QUICKSTART.md` — update if needed.
- `docs/USAGE.md` — update if needed.
- `package.json` — ensure description and scripts are accurate.

---

## 6. Technical Acceptance Criteria (TAC)

1. `README.md` contains exactly the five required sections in the specified order:
   - Introduction (elevator pitch).
   - Functional Architecture (end-user friendly).
   - Step-by-Step Architecture / Flow (mid-level developer).
   - Detailed Technical Architecture (senior developer).
   - Project Structure (all folders and files).
2. The README accurately reflects the implemented CLI commands and options.
3. The README explains the agent orchestration flow, including the seven sub-agents and the Critic/rejection loop.
4. The README explains the validation order: Critic → completeness → structural → schema.
5. The README explains the structural change proposal and approval flow.
6. The README lists the tech stack, dependencies, and Node.js version requirement.
7. The README includes setup and usage examples.
8. The README documents the claim verification path from `Project Vision/06` §8.
9. `npm run build` and `npm run test` still pass after documentation changes (no code changes should be needed).

---

## 7. User Acceptance Criteria (UAT)

1. A journalist can read the Introduction and Functional Architecture sections and understand what the tool does and how to use it.
2. A mid-level developer can read the Step-by-Step Architecture section and understand the agent flow, rolling memory, and rejection loop.
3. A senior developer can read the Detailed Technical Architecture section and understand the codebase well enough to make changes without reading every file.
4. The Project Structure section accurately describes every top-level folder and major file in `src/`.
5. The README includes copy-pasteable commands for the full workflow (`init` → `sample` → `ingest`).
6. The README is free of broken internal links and stale references.
7. A reader can follow the documented claim verification path to check a citation against the original PDF.

---

## 8. TDD Red-Green-Refactor-Evaluate Methodology

Documentation is not code, but the same discipline applies:

1. **RED PHASE** — Identify the missing or inaccurate sections in the current README. Draft the new structure and content gaps before writing.
2. **GREEN PHASE** — Write the README content to fill the gaps. Verify that every claim in the README matches the actual implemented behavior by running the relevant CLI commands.
3. **EVALUATE PHASE** — Review the README against the TAC and UAT. Have the target audiences (user, mid-level developer, senior developer) in mind. If any section is unclear or inaccurate, revise and re-evaluate. **Maximum 3 evaluation iterations.**
4. **REFACTOR PHASE** — Improve readability, consistency, and formatting without changing meaning.
5. **HUMAN GATE** — Do **not** mark the project complete until the user has explicitly approved the README.

### Boundedness Rules

- Documentation review loop: max 3 iterations.
- If any review loop hits its maximum without approval, stop and escalate to the user.

---

## 9. State Accumulation Rule

Preserve all context from Sprints 1–8. The README must reflect the actual implemented system, not the original plan. Do not start fresh.

---

## 10. Human Gate

After completing this sprint:

1. Update `plan/SPRINT_INSTRUCTIONS.md` status table for Sprint 9 with:
   - Status: `AWAITING_UAT` or `TECHNICAL_REVIEW`.
   - Test pass rate (should be 100%).
   - Acceptance criteria score.
   - Any blockers.
2. Present the user with the final README for review.
3. **Do not mark the project complete until the user explicitly approves the README.**

---

## 11. Project Completion

After Sprint 9 is approved, the implementation is complete. Update `plan/SPRINT_INSTRUCTIONS.md` to show all sprints as `COMPLETE` and archive any remaining notes.
