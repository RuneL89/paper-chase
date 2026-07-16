# LLM Wiki CLI v2.0 — Start Phase {N}

## For the User

Replace `{N}` with the phase number (0-9) and paste this into your AI coding agent.

## For the Agent

You are implementing **Phase {N}** of the LLM Wiki CLI v2.0.

### Step 1: Read the Master Prompt

Read `Implementation Plan/MASTER_IMPLEMENTATION_PROMPT.md` in full. This document explains:
- The loop engineering framework (`/goal` skill, sub-agents, dynamic prompting).
- The compliance rule (mandatory vision doc checking).
- The contradiction protocol (halt on contradiction, ask user).
- The standard phase prompt template.

### Step 2: Read This Phase's Documents

1. **Phase Document:** `Implementation Plan/PHASE_{N:02d}_*.md` (find the file matching Phase {N})
2. **Vision Documents:** In `Project Vision/` — check `Implementation Plan/MASTER_IMPLEMENTATION_PROMPT.md` Section 4 for the mapping.
3. **Project AGENTS.md:** `AGENTS.md` (project root — compliance rules and contradiction protocol)

All implementation files and folders are created directly in the project root (`Wiki v5/`). Do not create a separate project directory.

### Step 3: Run Compliance Check

Before writing any code:
- Identify which vision documents govern this phase.
- Read the relevant sections.
- Compare the phase requirements against the vision.
- Log the check to `.state/compliance-log.md`.
- If contradiction found, STOP and report to user.

### Step 4: Invoke Sub-Agents

Use the three sub-agents:

**Implementer:** Write code, tests, fixtures. Run tests. Stay in budget. Write status file.

**Verifier:** Check compliance against vision docs. Run tests independently. Report pass/fail.

**Reporter:** Present UAT steps to user. Summarize results. Do not modify code.

### Step 5: Use `/goal`

Set the goal to the phase's stopping condition (from the Phase Document's Approval Checklist).

Example for Phase 2:
```
All 12 technical gates in PHASE_02_extractor.md pass (npm test is green),
all 4 UAT steps are documented with expected output,
compliance log shows no unresolved contradictions,
and total LLM cost is under $7.00.
```

### Step 6: Present Results

When the phase is complete, the Reporter presents:
- Which gates passed/failed.
- UAT steps with exact commands and expected output.
- Compliance status.
- Token cost.
- Recommendation: proceed to next phase or fix blockers.

---

## Phase {N} Specifics

| Attribute | Value |
|---|---|
| Phase Document | `Implementation Plan/PHASE_{N:02d}_*.md` |
| Vision Docs | `Project Vision/` — see MASTER_IMPLEMENTATION_PROMPT.md Section 4 |
| Token Budget | See Phase Document |
| Stopping Condition | See Phase Document Approval Checklist |

---

**Begin by reading `Implementation Plan/MASTER_IMPLEMENTATION_PROMPT.md`, then the Phase Document, then the Vision Documents. Do not write code until compliance is confirmed.**
