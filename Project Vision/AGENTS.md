# Project Vision — DOX contract

## Purpose

Canonical vision and specification documents for LLM Wiki CLI v2.0. These seven documents are the source of truth for what the system must do; implementation is checked against them for compliance.

## Ownership

* `01_PRODUCT_VISION_AND_ARCHITECTURE.md` — product vision, architecture, workspace/wiki layout
* `02_WIKI_concept_detailed.md` — wiki page philosophy and mechanics
* `03_DOX_concept_detailed.md` — DOX framework adaptation (index.md contracts, AGENTS.md in wikis)
* `04_orchestration_detailed.md` — the four-layer ingest pipeline (Extractor, Materializer, DOX Writer)
* `05_page_types_specification.md` — page types, frontmatter, naming conventions
* `06_citation_and_provenance.md` — citation and provenance model
* `07_validation_and_quality.md` — validation layers and quality rules

## Local Contracts

* These documents are canonical. If implementation contradicts them, the Contradiction Protocol in `Implementation Plan/MASTER_IMPLEMENTATION_PROMPT.md` applies: halt, document, present to the user, proceed only after the user decides
* When implementation diverges with user approval, update the affected vision document in the same pass — the vision documents remain the source of truth
* Documents are written for readers without prior context; keep them self-contained

## Work Guidance

## Verification

## Child DOX Index

No child folders.
