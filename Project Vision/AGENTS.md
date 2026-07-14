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
- `04_orchestration_detailed.md` must reflect the current sub-agent pipeline, including the per-chunk materializer and the entity taxonomy proposed by the PagePlanner.
- `05_page_types_specification.md` must describe entity/topic page update mode if the code supports it, and must describe the typed entity sub-folder taxonomy (`entities/<subfolder>/<slug>.md`) and default type-to-folder mapping.
- `03_DOX_concept_detailed.md` must describe the deeper `entities/<subfolder>/index.md` child contracts and how contracts are updated when the LLM autonomously changes the folder structure.
- `07_validation_and_quality.md` must include the materializer's preservation check and describe the structural change log (not an approval process).
- `01_PRODUCT_VISION_AND_ARCHITECTURE.md` must state that structural changes (new folders, reorganizations, taxonomy changes) are driven by the LLM without a human approval gate.

## Work Guidance

- Read the relevant vision files before making large architectural changes.
- When adding a new page type, update `05_page_types_specification.md` first.
- When changing the orchestrator pipeline or entity sub-folder behavior, update `04_orchestration_detailed.md`.
- When changing the contract hierarchy depth (e.g., adding or removing entity sub-folder contracts), update `03_DOX_concept_detailed.md`.
- When changing validation rules, update `07_validation_and_quality.md`.

## Verification

- Cross-check implementation against the vision docs.
- Ensure no contradictions between vision docs and the root `AGENTS.md`.

## Child DOX Index

No nested child docs needed.
