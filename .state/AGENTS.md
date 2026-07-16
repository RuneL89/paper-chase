# .state/ — DOX contract

## Purpose

Durable phase records: goal/stopping condition, gate status, deviations, cost tracking, compliance checks, and independent verification reports. "The agent forgets; the repo remembers."

## Ownership

* `phase-N-status.json` — one per phase: goal, gate results (`gatesPassed`/`gatesFailed`/`gatesPending`), `deviations`, `llmCost`, `blocker`, `nextAction`; written by Implementer/orchestrator, read by Verifier and Reporter
* `compliance-log.md` — append-only log of compliance checks (format per `Implementation Plan/MASTER_IMPLEMENTATION_PROMPT.md` §3: timestamp, changed files, vision docs/sections checked, result, checker)
* `phase-N-verification.md` — Verifier sub-agent's independent per-gate report

## Local Contracts

* Records are factual and append-forward: do not rewrite history in `compliance-log.md`; correct errors by adding a new dated entry
* Product LLM spend is recorded per phase in the status file's `llmCost`; phase budgets are hard caps (`Implementation Plan/AGENTS.md`)
* These files are committed to git (they are the project's memory); secrets never go here — `.env` stays git-ignored at the project root

## Work Guidance

## Verification

## Child DOX Index

No child folders.
