# Project Vision/ — Vision and Requirements

## Purpose

This folder holds the canonical product vision, architecture, wiki concept, DOX contract hierarchy, orchestration flows, page-type specifications, citation rules, and validation/quality expectations.

## Ownership

- **Human user** owns the product vision, high-level requirements, and acceptance criteria.
- **LLM agents** draft updates when implementation changes the architecture or page types.
- Deterministic code does not own these documents.

## Local Contracts

- These documents are the source of truth for the project's shape and behavior.
- If implementation changes make a vision document inaccurate, update the vision doc before or alongside the code change.
- `04_orchestration_detailed.md` must reflect the current sub-agent pipeline, including the per-chunk materializer.
- `05_page_types_specification.md` must describe entity/topic page update mode if the code supports it.
- `07_validation_and_quality.md` must include the materializer's preservation check.

## Work Guidance

- Read the relevant vision files before making large architectural changes.
- When adding a new page type, update `05_page_types_specification.md` first.
- When changing the orchestrator pipeline, update `04_orchestration_detailed.md`.
- When changing validation rules, update `07_validation_and_quality.md`.

## Verification

- Cross-check implementation against the vision docs.
- Ensure no contradictions between vision docs and the root `AGENTS.md`.

## Child DOX Index

No nested child docs needed.
