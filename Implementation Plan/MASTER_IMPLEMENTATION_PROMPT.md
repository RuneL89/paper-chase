# Paper Chase v.1.0 — Master Implementation Prompt

**Document ID:** `LLM-WIKI-CLI-MASTER-PROMPT`
**Version:** 1.0.0
**Status:** Canonical
**Date:** 2026-07-16

---

## Overview

This document is the standard prompt given to the AI coding agent at the beginning of each implementation phase. It establishes the loop engineering framework, the goal skill usage, the sub-agent architecture, and the compliance requirements.

**The agent must read this prompt in full before starting any phase.**

---

## 1. The Loop Engineering Framework

You are not writing code in a single pass. You are operating within a **goal-driven loop** that continues until the phase is complete, tested, and validated.

### 1.1 The Five Loop Primitives

Per loop engineering best practices, your workflow must implement:

1. **Automations / Goal Skill** — The `/goal` skill drives the loop. You define a verifiable stopping condition and work until it is met. After every turn, a fresh model checks whether the goal is achieved.

2. **Worktrees** — Each sub-agent operates in its own isolated context. The main agent coordinates; sub-agents execute.

3. **Skills** — Project knowledge lives in the vision documents. You read them before acting. You do not guess.

4. **Sub-agents** — The maker and the checker are separate. One sub-agent implements; another verifies. They do not grade their own homework.

5. **State / Memory** — Progress is tracked on disk, not in context. The agent forgets; the repo remembers.

### 1.2 The Goal Skill (`/goal`)

Use `/goal` for every phase. The goal is a verifiable stopping condition, not a vague instruction.

**Good goal:**
```
All 8 technical gates in PHASE_02_extractor.md pass (npm test is green),
all 4 UAT steps are documented with expected output,
and the Extractor JSON schema matches the specification in 04_orchestration_detailed.md.
Total LLM cost is under $7.00.
```

**Bad goal:**
```
Implement the Extractor.
```

The `/goal` skill:
- Keeps working across turns until the stopping condition is true.
- After every turn, a separate check evaluates whether the condition holds.
- If stuck, it pauses and asks for direction rather than burning tokens.

### 1.3 Sub-Agent Architecture

You must use three sub-agents, each with a distinct role:

| Sub-agent | Role | When Invoked |
|---|---|---|
| **Implementer** | Writes code, runs tests, fixes bugs | For every implementation task |
| **Verifier** | Checks compliance against vision docs, runs tests independently | After Implementer claims a gate is passed |
| **Reporter** | Summarizes results, presents UAT steps to user, logs compliance | After Verifier confirms phase is complete |

**Rules for sub-agents:**
- The Implementer does not know if the Verifier will approve. It writes the best code it can.
- The Verifier does not know the Implementer's rationale. It checks against the spec cold.
- The Reporter does not modify code. It presents findings to the user.
- Sub-agents run in isolated contexts. They do not share reasoning. Only final results pass between them.

### 1.4 Dynamic Prompting Between Sub-agents

Sub-agents communicate via structured status files, not conversation.

**Status file format:** `.state/phase-{N}-status.json`
```json
{
  "phase": "02",
  "status": "in-progress",
  "lastAction": "Implemented Extractor prompt",
  "gatesPassed": ["2.1", "2.2"],
  "gatesFailed": [],
  "gatesPending": ["2.3", "2.4", "2.5", "2.6", "2.7", "2.8"],
  "llmCost": "$2.34",
  "tokenBudgetRemaining": "$4.66",
  "blocker": null,
  "nextAction": "Run Gate 2.3: Deterministic slugs"
}
```

When a sub-agent completes, it writes the status file. The next sub-agent reads it and decides what to do. This is dynamic prompting: the prompt for the next agent is generated based on the current state.

---

## 2. The Compliance Rule (MANDATORY)

Before any code is written, before any test is run, you must check the implementation against the Project Vision documents.

### 2.1 The Compliance Checklist

1. **Identify the relevant vision document(s).** Every change touches at least one vision document. Find it.
2. **Read the relevant section(s).** Do not skim. Read the full section.
3. **Compare implementation against vision.** Does it match? Does it contradict? Does it extend?
4. **Document the comparison.** Write a compliance note.
5. **If contradiction found, STOP.** Trigger the Contradiction Protocol (see Project Vision AGENTS.md).

### 2.2 The Contradiction Protocol

When implementation contradicts vision:
1. **Halt.** Stop all work.
2. **Document.** Create a contradiction report.
3. **Present to user.** Two options: Accept (update vision) or Reject (roll back code).
4. **Record decision.** Log in commit message.

**You do not proceed without user decision.**

---

## 3. Standard Phase Prompt Template

At the beginning of each phase, present this prompt to the agent:

```
# PHASE {N}: {PHASE_NAME}

## Your Goal

Implement Phase {N} of Paper Chase v.1.0 per the implementation plan and vision documents.

## Documents You Must Read

1. **This Phase Document:** `Implementation Plan/PHASE_{N:02d}_{phase_slug}.md`
   - Read the full document before writing any code.
   - Understand every technical gate and UAT step.
   - Note the LLM token budget. Do not exceed it.

2. **Relevant Vision Documents:** (all in `Project Vision/`)
{vision_docs_list}

3. **Project AGENTS.md:** `AGENTS.md` (project root)
   - The compliance rule and contradiction protocol are mandatory.

## Your Task

1. Read the phase document and vision documents.
2. Run the compliance check. If any contradiction is found, STOP and report it.
3. Implement the code for this phase.
4. Run the technical gates (automated tests).
5. Document the UAT steps (manual verification steps for the user).
6. Have the Verifier sub-agent check compliance against vision docs.
7. Have the Reporter sub-agent present results to the user.

## Sub-Agent Invocation

### Implementer
Task: Implement Phase {N} per the specification. Write all code, tests, and fixtures. Run tests until they pass. Stay within the token budget. Write the status file when done.

### Verifier
Task: Read the phase document and vision documents. Check that the implementation matches the spec. Run the tests independently. Verify no contradictions exist. Report pass/fail for each gate.

### Reporter
Task: Read the status file and verifier report. Present a summary to the user: what was implemented, which gates passed, which UAT steps to perform, and what the expected results are. Do not modify code.

## Compliance Log

Log every compliance check to `.state/compliance-log.md`:

```
[YYYY-MM-DD HH:MM] Phase {N} Compliance Check
  Changed: {files changed}
  Vision Docs Checked: {list}
  Sections Checked: {list}
  Result: {COMPLIANT | CONTRADICTION | EXTENSION}
  Checked By: {agent name}
```

## Token Budget

This phase has a hard token budget of ${budget}. If you hit 80% of the budget, pause and report to the user. Do not exceed the budget.

## Stopping Condition

The phase is complete when:
- All technical gates pass (npm test is green).
- All UAT steps are documented with expected output.
- The compliance log shows no unresolved contradictions.
- The status file shows all gates passed and no blockers.
```

---

## 4. Phase-Specific Vision Document Mapping

Phase documents live in `Implementation Plan/`; vision documents live in `Project Vision/`. All implementation code is created in the project root (`Wiki v5/`).

| Phase | Phase Document | Vision Documents to Check | Why |
|---|---|---|---|
| 0 | `PHASE_00_infrastructure.md` | `01_PRODUCT_VISION_AND_ARCHITECTURE.md` | Overall architecture, philosophy, TUI requirements |
| 1 | `PHASE_01_raw_document_pages.md` | `02_WIKI_concept_detailed.md`, `06_citation_and_provenance.md` | Raw document pages, source pages, citation format |
| 2 | `PHASE_02_extractor.md` | `04_orchestration_detailed.md`, `05_page_types_specification.md` | Extractor role, page types, JSON schema |
| 3 | `PHASE_03_materializer.md` | `05_page_types_specification.md`, `03_DOX_concept_detailed.md` | Entity page format, folder hierarchy |
| 4 | `PHASE_04_link_checker.md` | `07_validation_and_quality.md`, `06_citation_and_provenance.md` | Validation layers, citation integrity |
| 5 | `PHASE_05_synthesis_writer.md` | `02_WIKI_concept_detailed.md`, `05_page_types_specification.md` | Two-layer pages, synthesis requirements |
| 6 | `PHASE_06_dox_writer.md` | `03_DOX_concept_detailed.md`, `05_page_types_specification.md` | DOX contracts, index.md hierarchy |
| 7 | `PHASE_07_multilingual_ingestion.md` | `04_orchestration_detailed.md` §9, `02_WIKI_concept_detailed.md` §3.4, `05_page_types_specification.md` §2.1, `06_citation_and_provenance.md` §8 | Input/output language model, two-layer language rule, slug transliteration, source-language evidence |
| 8 | `PHASE_08_multi_pdf_compounding.md` | `01_PRODUCT_VISION_AND_ARCHITECTURE.md`, `04_orchestration_detailed.md` | Compounding, incremental ingestion |
| 9 | `PHASE_09_agents_updater.md` | `03_DOX_concept_detailed.md`, `01_PRODUCT_VISION_AND_ARCHITECTURE.md` | AGENTS.md as living document |
| 11 | `PHASE_11_polish.md` | All vision documents | Final polish, must not break any existing spec |
| 12 | `PHASE_12_validation_feedback_retry.md` | `04_orchestration_detailed.md` §6, `07_validation_and_quality.md` §2 + §5 | Feedback-retry (reask) carve-out: validator errors fed back to the LLM, ≤3 attempts; HTTP 4xx never retried |
| 13 | `PHASE_13_output_caps_and_prompt_self_sizing.md` | `04_orchestration_detailed.md` §6, `07_validation_and_quality.md` §5, `02_WIKI_concept_detailed.md` §4.7/§4.8, `05_page_types_specification.md` §2 | Output-token ceilings (synthesis 32768, DOX 8192); word-count removal + quality-based self-sizing restoring §4.7/§4.8 fidelity; the `sparse` frontmatter flag |
| 14 | `PHASE_14_topic_and_entity_curation.md` | `01_PRODUCT_VISION_AND_ARCHITECTURE.md` §4.1/§5, `04_orchestration_detailed.md` §1/§3.2/§6/§9.4, `05_page_types_specification.md` §6/§7, `07_validation_and_quality.md` §1/§2.3/§5 | Curate-then-write: topic merge/drop/keep + entity merge-only curation, deterministic decision-list validation, keep-all fallback, `curation` routing slot |
| 15 | `PHASE_15_synthesis_concurrency.md` | `04_orchestration_detailed.md` §1 | Bounded worker pool (fixed cap 4) for entity/topic synthesis; deterministic output order; everything else sequential |
| 16 | `PHASE_16_run_resilience.md` | `04_orchestration_detailed.md` §1/§3.2/§6/Step 9/Step 11, `07_validation_and_quality.md` §2.3/§5 | Run resilience: per-page transport fallback + outage detector, synthesis resume, per-PDF checkpointing, pool transport tuning, curation decision-list sizing |
| 17 | `PHASE_17_entity_graph_and_citation_integrity.md` | `02_WIKI_concept_detailed.md` §2/§4.3/§4.5/§4.8, `05_page_types_specification.md` §2/§6, `06_citation_and_provenance.md` §1-§3/§7, `07_validation_and_quality.md` §2.5/§2.6, `04_orchestration_detailed.md` §3.2/§4 | Bidirectional (incoming) relationships, related-entity link targets in synthesis, island (zero-outgoing) detection, deterministic post-synthesis frontmatter + `## Sources` normalization (B10/B12/B1/B2) |

---

## 5. Example: Phase 2 Prompt

Here is what the actual prompt looks like for Phase 2:

```
# PHASE 2: The Extractor (Layer 2)

## Your Goal

Implement the Extractor agent per PHASE_02_extractor.md. One LLM call per chunk
that returns structured JSON with entities, relationships, claims, timeline,
context, significance, and disambiguation.

## Documents You Must Read

1. Implementation Plan/PHASE_02_extractor.md (this phase document)
2. Project Vision/04_orchestration_detailed.md (Extractor's role in the pipeline)
3. Project Vision/05_page_types_specification.md (entity page format the Extractor feeds)
4. AGENTS.md (project root — compliance rule and contradiction protocol)

## Your Task

1. Read all four documents.
2. Run compliance check: Does the Extractor JSON schema in the phase doc match
the orchestration spec? Does it match the page type requirements?
3. Implement src/agents/extractor.ts and prompts/extractor.prompt.txt.
4. Write tests for all 12 gates (2.1 through 2.12).
5. Run tests until they pass.
6. Document UAT steps for the user.
7. Have Verifier check compliance.
8. Have Reporter present results.

## Sub-Agent Invocation

### Implementer
Implement the Extractor. Write the prompt, the TypeScript function, the schema
validator, and all tests. Run tests. Stay within $7.00 budget. Write status file.

### Verifier
Read Project Vision/04_orchestration_detailed.md Section 3.4 (Step 5) and
Project Vision/05_page_types_specification.md Section 6. Verify the Extractor output matches
both specs. Run tests independently. Check for contradictions.

### Reporter
Present to user: which gates passed, which UAT steps to perform, what the
expected Extractor JSON looks like, and how to verify it.

## Token Budget

$7.00 hard cap. Pause at $5.60 (80%) and report to user.

## Stopping Condition

All 12 gates pass, all 4 UAT steps are documented, compliance log shows no
contradictions, status file shows all gates passed and no blockers.
```

---

## 6. The Reporter's UAT Presentation Format

When presenting UAT steps to the user, the Reporter must use this format:

```
╔══════════════════════════════════════════════════════════════╗
║  PHASE {N} UAT — {Phase Name}                                ║
╠══════════════════════════════════════════════════════════════╣
║  Status: READY FOR USER TESTING                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  UAT 1: {Step Name}                                        ║
║  ─────────────────                                         ║
║  Command: {exact command to run}                             ║
║  Expected: {what the user should see}                      ║
║  How to verify: {how to confirm it worked}                   ║
║                                                              ║
║  UAT 2: ...                                                ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  Technical Gates: {X}/{Y} PASSED                           ║
║  LLM Cost: ${amount} / ${budget}                           ║
║  Compliance: {COMPLIANT | CONTRADICTION}                   ║
╚══════════════════════════════════════════════════════════════╝
```

The user runs the UAT steps manually and reports back. If any UAT fails, the loop continues.

---

## 7. Critical Rules

1. **Read before writing.** Always read the phase document and vision documents before writing code.
2. **Check compliance.** Every change must be checked against the vision. No exceptions.
3. **Use sub-agents.** Implementer writes, Verifier checks, Reporter presents. Never combine roles.
4. **Stay in budget.** Hard token caps per phase. Pause at 80% and report.
5. **Log everything.** Status files, compliance logs, and test results are mandatory.
6. **Fail loud.** If a gate fails, report it clearly. Do not hide failures.
7. **No contradictions without user decision.** If code contradicts vision, stop and ask.
8. **The user is the final arbiter.** Present findings; let the user decide.

---

## 8. Files the Agent Must Know

All paths are relative to the project root (`Wiki v5/`). Implementation code is built in the project root — do not create a separate project folder.

```
Wiki v5/
├── AGENTS.md                                     # DOX root contract + compliance rule
├── Project Vision/
│   ├── 01_PRODUCT_VISION_AND_ARCHITECTURE.md     # Overall vision
│   ├── 02_WIKI_concept_detailed.md               # Wiki page philosophy
│   ├── 03_DOX_concept_detailed.md                # DOX framework
│   ├── 04_orchestration_detailed.md              # Pipeline architecture
│   ├── 05_page_types_specification.md            # Page types, frontmatter
│   ├── 06_citation_and_provenance.md             # Citation rules
│   └── 07_validation_and_quality.md              # Validation layers
├── Implementation Plan/
│   ├── IMPLEMENTATION_PLAN_MASTER_INDEX.md       # Phase directory
│   ├── MASTER_IMPLEMENTATION_PROMPT.md           # This document
│   ├── START_PHASE_PROMPT.md                     # Phase kickoff prompt
│   ├── PHASE_00_infrastructure.md                # Phase 0
│   ├── PHASE_01_raw_document_pages.md            # Phase 1
│   ├── PHASE_02_extractor.md                     # Phase 2
│   ├── PHASE_03_materializer.md                  # Phase 3
│   ├── PHASE_04_link_checker.md                  # Phase 4
    │   ├── PHASE_05_synthesis_writer.md              # Phase 5
    │   ├── PHASE_06_dox_writer.md                    # Phase 6

│   ├── PHASE_07_multilingual_ingestion.md          # Phase 7
│   ├── PHASE_08_multi_pdf_compounding.md           # Phase 8
│   ├── PHASE_09_agents_updater.md                  # Phase 9
│   ├── PHASE_11_polish.md                          # Phase 11
│   ├── PHASE_12_validation_feedback_retry.md       # Phase 12
│   ├── PHASE_13_output_caps_and_prompt_self_sizing.md  # Phase 13
│   ├── PHASE_14_topic_and_entity_curation.md           # Phase 14
│   ├── PHASE_15_synthesis_concurrency.md               # Phase 15
│   ├── PHASE_16_run_resilience.md                      # Phase 16
│   └── PHASE_17_entity_graph_and_citation_integrity.md # Phase 17
└── templates/
    └── AGENTS.md                                 # Template for wiki AGENTS.md (created in Phase 0)
```

---

## 9. Starting a Phase

To start a phase, the user says:

> "Start Phase {N}"

The agent then:
1. Reads this Master Prompt.
2. Reads the Phase Document for Phase {N}.
3. Reads the mapped Vision Documents.
4. Reads the Project AGENTS.md (compliance rules).
5. Runs the compliance check.
6. If compliant, invokes the Implementer sub-agent.
7. The loop begins.
