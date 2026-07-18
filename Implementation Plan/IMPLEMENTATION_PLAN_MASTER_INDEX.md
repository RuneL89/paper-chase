# LLM Wiki CLI v2.0 — Implementation Plan Master Index

**Document ID:** `LLM-WIKI-CLI-IMPL-MASTER`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16

---

## Overview

This implementation plan breaks the LLM Wiki CLI v2.0 into 10 phases (0-9). Each phase is a standalone deliverable that can be tested in isolation and integrated with previously accepted phases. **You do not move to the next phase until every gate in the current phase passes.**

This structure prevents the compounding bug problem that destroyed the previous implementation. Each phase has:
- A clear objective
- Specific files to build
- Technical approval gates (automated tests)
- User acceptance tests (manual verification)
- A hard checklist that must be signed off before proceeding
- Integration notes explaining what this phase produces and what the next phase expects

---

## Phase Directory

| Phase | Document | Objective | LLM Cost | Est. Time |
|---|---|---|---|---|
| 0 | [PHASE_00_infrastructure.md](PHASE_00_infrastructure.md) | Repo, build system, test framework, golden master PDF | $0 | 2-4h |
| 1 | [PHASE_01_raw_document_pages.md](PHASE_01_raw_document_pages.md) | `init` and `ingest` commands, raw document pages, source pages | $0 | 3-5h |
| 2 | [PHASE_02_extractor.md](PHASE_02_extractor.md) | Extractor agent: one LLM call per chunk returns structured JSON | $5.00 | 4-6h |
| 3 | [PHASE_03_materializer.md](PHASE_03_materializer.md) | Materializer: deterministic code writes entity and topic pages | $0 | 4-6h |
| 4 | [PHASE_04_link_checker.md](PHASE_04_link_checker.md) | Link checker, citation checker, schema validator | $0 | 2-3h |
| 5 | [PHASE_05_synthesis_writer.md](PHASE_05_synthesis_writer.md) | Synthesis Writer: optional LLM-written synthesis for entity, topic, and document pages | $10.00 | 4-6h |
| 6 | [PHASE_06_dox_writer.md](PHASE_06_dox_writer.md) | DOX Writer: LLM-driven rich `index.md` generation | Quality-first | 4-6h |
| 7 | [PHASE_07_multi_pdf_compounding.md](PHASE_07_multi_pdf_compounding.md) | Multi-PDF compounding, incremental ingestion, conflict detection | $5.00 | 4-5h |
| 8 | [PHASE_08_agents_updater.md](PHASE_08_agents_updater.md) | AGENTS.md updater: proposes updates based on discovered structure | $2.00 | 3-4h |
| 9 | [PHASE_09_polish.md](PHASE_09_polish.md) | Productionization: per-call LLM model routing with suggestion labels, TUI cleanup, smoother workflow, full README.md, metrics, E2E tests | $0 | 4-6h |

**Total Estimated LLM Cost (all phases):** Variable; baseline ~$27.00 plus quality-first DOX Writer cost per wiki.
**Total Estimated Time:** 32-46 hours

---

## The Golden Rule

> **If a phase fails a gate, you do not move to the next phase. You fix the current phase.**

This is the rule that prevents compounding bugs. Each phase is a contract. The next phase depends on the previous phase's output being correct. If Phase 2's Extractor returns invalid JSON, Phase 3's Materializer will fail in ways that are hard to debug. Fix Phase 2 first.

---

## Isolation vs. Integration Testing

Every phase has two kinds of tests:

**Isolation Tests:** Test the new component without the rest of the pipeline.
- Phase 2: Call `extractChunk()` directly with a string of text. No filesystem, no `ingest` command.
- Phase 3: Create fake JSON files manually, then call `materialize()`. No LLM, no extraction.
- Phase 5: Call `writeEntitySynthesis()`, `writeTopicSynthesis()`, or `writeDocumentSynthesis()` with fake data. No filesystem.
- Phase 6: Call `writeDoxContracts()` on a fake folder tree. No full pipeline.

**Integration Tests:** Test the component within the full pipeline.
- Phase 2: Run `ingest` and verify `.state/extracted/` contains valid JSON.
- Phase 3: Run `ingest` and verify `entities/` contains pages.
- Phase 5: Run `ingest --synthesis` and verify entity, topic, and document pages have readable prose.
- Phase 6: Run `ingest` and verify `index.md` hierarchy is generated.

**Rule:** Every gate must have an isolation test. Integration tests are for UAT and final verification.

---

## Token Budgets

| Phase | Budget | What Happens If You Hit It |
|---|---|---|
| 2 | $5.00 | Your prompt is wrong. Fix the prompt, not the code. |
| 5 | $15.00 | Your Synthesis Writer prompt is too verbose or the page data is too large. |
| 6 | Quality-first | The DOX Writer makes one call per folder + root; cost scales with wiki size. Optimize prompts, not output quality. |
| 7 | $5.00 | Your test PDFs are too large. Use smaller fixtures. |
| 8 | $2.00 | The AGENTS.md is too long. Trim it. |

**No retry loops.** If an LLM call fails, fix the prompt and run again. Do not burn tokens on retries.

---

## The Test Fixture Strategy

You have two golden master PDFs:
- `test-pdfs/golden-master.pdf` (3 pages) — used in Phases 0-6.
- `test-pdfs/golden-master-2.pdf` (2 pages) — used in Phase 7.

These PDFs are sacred. They never change. If a test fails, the code is wrong, not the PDF.

**Why this matters:** In the previous implementation, you tested with real leaked documents. You could not tell if a bug was in your code or in the PDF. The golden master removes that ambiguity.

---

## Compliance with Vision Documents

Before starting each phase, read the relevant vision document (all in `Project Vision/`):

| Phase | Vision Document | Why |
|---|---|---|
| 0 | `01_PRODUCT_VISION_AND_ARCHITECTURE.md` | Understand the overall architecture and philosophy. |
| 1 | `02_WIKI_concept_detailed.md` | Understand raw document pages and source pages. |
| 2 | `04_orchestration_detailed.md` | Understand the Extractor's role in the pipeline. |
| 3 | `05_page_types_specification.md` | Understand entity page format and frontmatter. |
| 4 | `07_validation_and_quality.md` | Understand validation layers and preservation checks. |
| 5 | `02_WIKI_concept_detailed.md` | Understand the two-layer page structure (synthesis + preserved detail). |
| 6 | `03_DOX_concept_detailed.md` | Understand DOX contracts and index.md hierarchy. |
| 7 | `01_PRODUCT_VISION_AND_ARCHITECTURE.md` | Understand compounding and incremental ingestion. |
| 8 | `03_DOX_concept_detailed.md` | Understand AGENTS.md as a living document. |
| 9 | All | Polish and production readiness. |

After completing each phase, update the relevant vision document if the implementation diverged from the spec. The vision documents are the source of truth.

---

## Approval Workflow

For each phase:

1. **Read the phase document.** Understand what to build.
2. **Build the code.** Write tests first, then implementation.
3. **Run isolation tests.** Verify the component works alone.
4. **Run integration tests.** Verify the component works in the pipeline.
5. **Run UAT.** Manually verify the output.
6. **Check the approval checklist.** Every box must be checked.
7. **Commit.** `git commit -m "Phase N: Description"`
8. **Move to next phase.** Only after all gates pass.

---

## What You Have at Each Phase

| Phase | What the Journalist Can Do |
|---|---|
| 0 | Nothing yet. Infrastructure only. |
| 1 | Search raw PDF text with `grep`. Open document pages in Obsidian. |
| 2 | Inspect extracted JSON. See structured entities, relationships, claims. |
| 3 | Browse entity pages. Click `[[Acme Corp]]` and see mentions. |
| 4 | Verify all links work. Verify all citations map to sources. |
| 5 | Read synthesized entity, topic, and document pages with readable prose and preserved detail. |
| 6 | Navigate the wiki via rich `index.md` contracts with content-based descriptions. See folder structure and purpose. |
| 7 | Add new PDFs over time. Watch the wiki compound. See conflicts logged. |
| 8 | Review proposed AGENTS.md updates. Apply them manually. |
| 9 | Use a production-ready CLI with config, logging, metrics, and documentation. |

---

## Files in This Project

All implementation artifacts (`src/`, `tests/`, `test-pdfs/`, `templates/`, `prompts/`, `package.json`, etc.) are created directly in the project root (`Wiki v5/`). Do not create a separate project directory. Documents live in two subfolders:

```
Wiki v5/                              # project root — all code and tests are built here
├── AGENTS.md                         # DOX root contract
├── Project Vision/                   # canonical vision documents (source of truth)
│   ├── 01_PRODUCT_VISION_AND_ARCHITECTURE.md
│   ├── 02_WIKI_concept_detailed.md
│   ├── 03_DOX_concept_detailed.md
│   ├── 04_orchestration_detailed.md
│   ├── 05_page_types_specification.md
│   ├── 06_citation_and_provenance.md
│   └── 07_validation_and_quality.md
└── Implementation Plan/              # this folder: phases and agent prompts
    ├── IMPLEMENTATION_PLAN_MASTER_INDEX.md
    ├── MASTER_IMPLEMENTATION_PROMPT.md
    ├── START_PHASE_PROMPT.md
    ├── PHASE_00_infrastructure.md
    ├── PHASE_01_raw_document_pages.md
    ├── PHASE_02_extractor.md
    ├── PHASE_03_materializer.md
    ├── PHASE_04_link_checker.md
    ├── PHASE_05_synthesis_writer.md
    ├── PHASE_06_dox_writer.md
    ├── PHASE_07_multi_pdf_compounding.md
    ├── PHASE_08_agents_updater.md
    └── PHASE_09_polish.md
```

---

## Final Note

This plan is designed to prevent the exact failure mode you experienced: building everything at once, then discovering that no part works. Each phase is small, verifiable, and independent. If you get stuck on Phase 2, you still have a working system from Phase 1. If you never reach Phase 6, you still have a usable wiki from Phase 5.

Start with Phase 0. Do not skip ahead. Do not add features from future phases. Build one gate at a time.
