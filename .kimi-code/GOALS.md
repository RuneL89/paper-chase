# Goal

**Date:** 2026-07-04
**Status:** ACTIVE

## Stated Goal

"I want to start with the MVP goal. But a VERY important thing to keep in mind is that this product will be used by investigative journalism to find connections between very large datasets that is very time consuming for a journalist to read through. So, with this, it's very important that this cli doesn't just extract some data. But that the generated wiki can contain all relevant data so even small connections can be found by the journalist / research AI agent. So I would like for us to spend some time nailing down that concept."

## Refined Goal

Build an MVP **llm-wiki-cli** — a local Node.js CLI that converts a `raw/` folder of documents (PDFs, CSVs, PPTX, DOCX, JSON, images) into a citation-backed markdown wiki with full data fidelity. The tool is designed for investigative journalism, where even small cross-dataset connections must be discoverable by human researchers and research AI agents.

## Maturity

Problem-focused

## Notes

- **Data fidelity over summarization:** The primary success criterion is that no relevant data is lost during ingestion. Every row, page, slide, section, object, and OCR transcript must be preserved and addressable in the wiki.
- **Connection discovery:** The wiki must be structured (page types, wikilinks, entity pages, indexes) so that a research agent or journalist can traverse from any mention to related mentions across source files.
- **Journalism context:** Users are not software experts; CLI UX, error messages, and documentation should be clear and actionable.
- **MVP scope:** Core ingestion loop first (watch, chunk, extract, profile, plan, write, lint/index). Advanced features such as the human approval gate, LangGraph.js orchestration, and deploy sync can be stubbed or deferred after the data-fidelity model is solid.
- **Source document:** `01_PRODUCT_VISION_AND_ARCHITECTURE.md` is the canonical architectural reference. The FRD should translate it into concrete, testable requirements for the journalism use case.
- **Open questions for the FRD:**
  - What does "all relevant data" mean for each file type?
  - How are entities extracted, resolved, and linked so small connections are surfaced?
  - What citation format makes every claim traceable to a source location?
  - What wiki page types and index structure best support connection discovery?
  - Which MVP features are in scope, and what is intentionally stubbed?
