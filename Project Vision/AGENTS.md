# Project Vision — DOX contract

## Purpose

Canonical vision and specification documents for Paper Chase v.1.0. These seven documents are the source of truth for what the system must do; implementation is checked against them for compliance.

## Ownership

* `01_PRODUCT_VISION_AND_ARCHITECTURE.md` — product vision, architecture, workspace/wiki layout
* `02_WIKI_concept_detailed.md` — wiki page philosophy and mechanics
* `03_DOX_concept_detailed.md` — DOX framework adaptation (index.md contracts, AGENTS.md in wikis)
* `04_orchestration_detailed.md` — the five-layer ingest pipeline (Extractor, Materializer with per-ingest curation, Synthesis Writer, DOX Writer) and the multilingual input/output language model (§9)
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

* `optimizations/` — post-mortem analysis and decision records for ingest cost/time optimization (2026-07-23 adhd-wiki run); NOT canon — decisions take effect only after promotion into the canon docs above. See `optimizations/AGENTS.md`
