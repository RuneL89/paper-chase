# SPRINT_INSTRUCTIONS.md — Implementation Tracker

**Project:** LLM Wiki CLI (MVP v2.0)
**Version:** 2.0
**Last Updated:** 2026-07-04

## Loop Engineering Methodology

1. **Plan-and-Execute** (Phase 1): Decompose FRD → sprint plans → execute sequentially.
2. **TDD Red-Green-Refactor** (Phase 2 per sprint): Failing tests → minimal code → refactor.
3. **Self-Correcting Generator-Critic** (per file): Compile → fix → recompile. Max 5 iterations.
4. **Evaluator-Optimizer** (per sprint): Score TACs → revise. Max 3 iterations.
5. **Multi-Agent Validation Swarm** (Phase 3 per sprint): Parallel integration + UI/UX validation. Max 3 rounds.
6. **Human-in-the-Loop** (escalation only): Triggered when boundedness exceeded.

## Status Table

| Sprint | Goal | Status | Technical Gate | Validation Gate | Blockers | Retries |
|---|---|---|---|---|---|---|
| Sprint 5 | Custom Orchestrator Skill & Contracts | COMPLETE | PASS | PASS | None | 0 |
| Sprint 6 | Extraction & Chunking Refactor | COMPLETE | PASS | PASS | None | 0 |
| Sprint 7 | Sample Orchestrator & Index.md Contracts | COMPLETE | PASS | PASS | None | 0 |
| Sprint 8 | Ingest Orchestrator & Dynamic Hierarchy | COMPLETE | PASS | PASS | None | 0 |
| Sprint 9 | Wiki-of-Wiki Agent & Validation | COMPLETE | PASS | PASS | None | 0 |
| Sprint 10 | Tests & Documentation | COMPLETE | PASS | PASS | None | 0 |

**Status:** PENDING | IN_PROGRESS | COMPLETE | BLOCKED | FAILED
**Gate:** PENDING | PASS | FAIL

## Hard Rules
1. Next sprint NEVER starts until both gates show PASS.
2. Sprints execute in strict order.
3. If either gate FAIL after 3 retries, ESCALATE.
4. Do NOT modify completed sprint code when working on a new sprint.
5. This file is the single source of truth.

## Changelog

| Date | Sprint | Action | Updated By |
|---|---|---|---|
| 2026-07-04 | All | Archived v1.0 sprints and created v2.0 sprint plan | orchestrator |
| 2026-07-04 | Sprint 5 | Planning complete | orchestrator |
| 2026-07-06 | Sprint 5 | Verification complete; sprint marked COMPLETE | orchestrator |
| 2026-07-06 | Sprint 6 | Detailed sprint plan created | orchestrator |
| 2026-07-06 | Sprint 7 | Implementation and verification complete; marked COMPLETE | orchestrator |
| 2026-07-06 | Sprint 8 | Implementation and verification complete; marked COMPLETE | orchestrator |
| 2026-07-06 | Sprint 9 | Implementation and verification complete; marked COMPLETE | orchestrator |
| 2026-07-06 | Sprint 10 | Documentation, AGENTS.md, README.md, and docs updated; marked COMPLETE | orchestrator |

