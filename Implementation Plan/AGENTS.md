# Implementation Plan — DOX contract

## Purpose

The phased implementation plan for Paper Chase v.1.0: phases 0–9 and 11–17, each a standalone deliverable with technical gates and user acceptance tests, plus the prompts that drive the implementing agent.

## Ownership

* `IMPLEMENTATION_PLAN_MASTER_INDEX.md` — phase directory, golden rules, approval workflow
* `MASTER_IMPLEMENTATION_PROMPT.md` — loop engineering framework, compliance rule, sub-agent architecture, phase prompt template
* `START_PHASE_PROMPT.md` — kickoff prompt template for starting a phase
* `PHASE_00_infrastructure.md` … `PHASE_17_entity_graph_and_citation_integrity.md` — one document per phase: objective, files to build, gates, UAT, checklist, integration notes
* `BACKLOG.md` — living list of open issues, accepted residuals, and future tracks (multi-format ingestion since 2026-07-25); entries are unscheduled and move into a `PHASE_XX` doc when scheduled

## Local Contracts

* All implementation artifacts described here (`src/`, `tests/`, `test-pdfs/`, `templates/`, `prompts/`, `package.json`, etc.) are created directly in the project root (`Wiki v5/`), never in a separate project directory
* Phases are executed in order. Do not start the next phase until every gate in the current phase passes
* Before each phase, run the compliance check against the mapped vision documents in `Project Vision/` (mapping: `MASTER_IMPLEMENTATION_PROMPT.md` Section 4)
* Token budgets per phase are hard caps; pause at 80% and report
* Status and compliance records go to `.state/` in the project root

## Work Guidance

* Follow the Implementer / Verifier / Reporter sub-agent split from `MASTER_IMPLEMENTATION_PROMPT.md`
* The golden master PDFs (`test-pdfs/golden-master.pdf`, `test-pdfs/golden-master-2.pdf`) never change once created

## Verification

Each phase document defines its own technical gates (automated tests, `npm test`) and UAT steps; all gates must pass before proceeding.

## Child DOX Index

No child folders yet. Implementation subfolders created during Phase 0+ are indexed in the root AGENTS.md as they appear.
