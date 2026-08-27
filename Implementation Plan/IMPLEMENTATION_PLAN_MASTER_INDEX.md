# Paper Chase v.1.0 — Implementation Plan Master Index

**Document ID:** `LLM-WIKI-CLI-IMPL-MASTER`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16

---

## Overview

This implementation plan breaks Paper Chase v.1.0 into phases 0–9 and 11–26. Each phase is a standalone deliverable that can be tested in isolation and integrated with previously accepted phases. **You do not move to the next phase until every gate in the current phase passes.**

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
| 6 | [PHASE_06_dox_writer.md](PHASE_06_dox_writer.md) | DOX Writer: LLM-driven rich `index.md` generation, including the workspace-level `wikis/index-of-indexes.md` | Quality-first | 4-6h |
| 7 | [PHASE_07_multilingual_ingestion.md](PHASE_07_multilingual_ingestion.md) | Multilingual ingestion: per-run input language, per-wiki output language, transliterated slugs | $3.00 | 4-6h |
| 8 | [PHASE_08_multi_pdf_compounding.md](PHASE_08_multi_pdf_compounding.md) | Multi-PDF compounding, incremental ingestion, conflict detection | $5.00 | 4-5h |
| 9 | [PHASE_09_agents_updater.md](PHASE_09_agents_updater.md) | AGENTS.md updater: proposes updates based on discovered structure | $2.00 | 3-4h |
| 11 | [PHASE_11_polish.md](PHASE_11_polish.md) | Productionization: per-call LLM model routing with suggestion labels, TUI cleanup, smoother workflow, full README.md, metrics, E2E tests | $0 | 4-6h |
| 12 | [PHASE_12_validation_feedback_retry.md](PHASE_12_validation_feedback_retry.md) | Validation feedback retry (reask): validator errors fed back to the LLM at all five call sites, ≤3 attempts, repair-rate warning | $0 | 3-4h |
| 13 | [PHASE_13_output_caps_and_prompt_self_sizing.md](PHASE_13_output_caps_and_prompt_self_sizing.md) | Output-token ceilings (synthesis 32768, DOX 8192), word-count removal + quality-based self-sizing in the synthesis prompts, `sparse` flag, mid-tier DOX label | $0 | 2-3h |
| 14 | [PHASE_14_topic_and_entity_curation.md](PHASE_14_topic_and_entity_curation.md) | Curate-then-write: per-ingest LLM topic curation (merge/drop/keep) + entity curation (merge-only), deterministic validation + application, keep-all fallback, `curation` Settings slot | $0 | 5-7h |
| 15 | [PHASE_15_synthesis_concurrency.md](PHASE_15_synthesis_concurrency.md) | Bounded worker pool (fixed cap 4) for entity/topic synthesis only; serialized state writes; deterministic report order; aggregate TUI progress | $0 | 3-4h |
| 16 | [PHASE_16_run_resilience.md](PHASE_16_run_resilience.md) | Run resilience: per-page transport fallback + outage detector, synthesis resume (data fingerprints), per-PDF checkpointing, pool transport tuning, curation decision-list sizing | $0 | 5-8h |
| 17 | [PHASE_17_entity_graph_and_citation_integrity.md](PHASE_17_entity_graph_and_citation_integrity.md) | Entity graph + citation integrity: bidirectional (incoming) relationships, related-entity link targets in synthesis, island (zero-outgoing) detection, deterministic post-synthesis frontmatter + `## Sources` normalization (backlog B10/B12/B1/B2) | $0 | 4-6h |
| 18 | [PHASE_18_citation_numbering_alignment.md](PHASE_18_citation_numbering_alignment.md) | Citation numbering alignment: deterministic citation map taught in all four synthesis prompts; off-map markers become reask-loop content defects (backlog B18) | $0 | 2-3h |
| 19 | [PHASE_19_stale_pagehash_convergence.md](PHASE_19_stale_pagehash_convergence.md) | Stale-hash convergence: locate + fix the pageHashes leak false-flagging tool-written pages; safe convergence for provably-tool-written pages; hash-consistency invariant (backlog B19) | $0 | 2-4h |
| 20 | [PHASE_20_wikilink_repair.md](PHASE_20_wikilink_repair.md) | Wikilink repair: deterministic unique-prefix/alias repair at synthesis write points + one-time dist/wikis remediation with hash re-convergence (backlog B20) | $0 | 2-3h |
| 21 | [PHASE_21_curation_overhaul.md](PHASE_21_curation_overhaul.md) | Curation overhaul: deterministic pre-merge signals (~70% of merges at $0), confirm-deny pair proposals, sticky decisions with split escape hatch (backlog B5, HIGH PRIORITY) | $0 | 5-8h |
| 22 | [PHASE_22_composite_pages.md](PHASE_22_composite_pages.md) | Composite pages (Option C): cluster-granular rich articles over the entity-granular graph within five ratified rollup classes; vision `02` §4.6/`05` §6 amendment (backlog B22) | $0 | 8-12h |
| 23 | [PHASE_23_comparison_articles.md](PHASE_23_comparison_articles.md) | Comparison-table articles: extractor `tables` output, `comparison` page type, `comparisons/` folder, per-subject accumulation across sources (backlog B21) | $0 | 4-6h |
| 24 | [PHASE_24_cross_wiki_discovery.md](PHASE_24_cross_wiki_discovery.md) | Cross-wiki discovery layer (v1.2.1): agent-first entity registry, relationship graph, topic clusters, entity summaries, predicate normalization, hypothesis signals, and preflight run-control for downstream agents (backlog B14) | $0 | 12-18h |
| 25 | [PHASE_25_generic_label_disambiguation.md](PHASE_25_generic_label_disambiguation.md) | Generic-label disambiguation (Option E Variant B): class-6 composite pages at generic slugs whose per-source meanings diverge — deterministic heterogeneity proposal, LLM split judgment, sticky `disambiguate` records with source→member mapping (backlog B23) | ≤$6 (glm-5.3-flash only) | 6-9h |
| 26 | [PHASE_26_per_pdf_patch_amendment.md](PHASE_26_per_pdf_patch_amendment.md) | Per-PDF sequential ingestion (Option B Patch, new default pipeline): each PDF runs extract → materialize (+per-PDF curation) → synthesize-or-AMEND with LLM patch output, deterministic applier, merged-page preservation, full-synthesis fallback; DOX/cross-wiki deferred to after the loop (backlog B24) | ≤$15 (glm-5.3-flash only) | 10-14h |

**Total Estimated LLM Cost (all phases):** Variable; baseline ~$32.00 plus quality-first DOX Writer cost per wiki.
**Total Estimated Time:** 68-99 hours

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
- Phase 7: Call `slugify('København', 'da')` and `buildLanguageDirective()` directly. Pipeline gates use the test-only LLM injections (`extractChunkFn`, `synthesize*Fn`, `writeDoxIndexFn`). No live LLM calls.

**Integration Tests:** Test the component within the full pipeline.
- Phase 2: Run `ingest` and verify `.state/extracted/` contains valid JSON.
- Phase 3: Run `ingest` and verify `entities/` contains pages.
- Phase 5: Run `ingest --synthesis` and verify entity, topic, and document pages have readable prose.
- Phase 6: Run `ingest` and verify `index.md` hierarchy is generated.
- Phase 7: Run `ingest --input-language da` on the Danish fixture and verify transliterated slugs, verbatim Danish Layer 2, and output-language Layer 1.

**Rule:** Every gate must have an isolation test. Integration tests are for UAT and final verification.

---

## Token Budgets

| Phase | Budget | What Happens If You Hit It |
|---|---|---|
| 2 | $5.00 | Your prompt is wrong. Fix the prompt, not the code. |
| 5 | $15.00 | Your Synthesis Writer prompt is too verbose or the page data is too large. |
| 6 | Quality-first | The DOX Writer makes one call per folder + root; cost scales with wiki size. Optimize prompts, not output quality. |
| 7 | $3.00 | The Danish fixture is 2 pages: one chunk, a handful of live calls in UAT only. Gates are LLM-free. |
| 8 | $5.00 | Your test PDFs are too large. Use smaller fixtures. |
| 9 | $2.00 | The AGENTS.md is too long. Trim it. |
| 12 | $0 | All gate tests mock the transport; live repair calls only during real ingests. |
| 13 | $0 | LLM-free gates (static prompt assertions, stubbed captures); live verification only during real ingests. |
| 14 | $0 | LLM-free gates (injected curation stubs); live curation calls only during real ingests. |
| 15 | $0 | LLM-free gates (delay-stubbed synthesis); live timing verification only during real ingests. |
| 16 | $0 | LLM-free gates (stubbed transport + injected fingerprints); live resilience drills only during real ingests. |
| 25 | $6.00 | glm-5.3-flash ONLY (user directive 2026-08-27; cap tripled same day), pinned via the UAT workspace's slot config; one designated live gate (25.9, self-skips key-less) + live UAT ingests; everything else stub-based. Expected actual spend <$0.50. |
| 26 | $15.00 | glm-5.3-flash ONLY (user directive 2026-08-27; cap tripled same day), pinned via the UAT workspace's slot config; one designated live gate (26.11, self-skips key-less) + live UAT ingests incl. abort/resume re-fires; everything else stub-based. Expected actual spend <$1. |

**No retry loops.** If an LLM call fails, fix the prompt and run again. Do not burn tokens on retries.

---

## The Test Fixture Strategy

You have three golden master PDFs:
- `test-pdfs/golden-master.pdf` (3 pages) — used in Phases 0-6.
- `test-pdfs/golden-master-2.pdf` (2 pages) — used in Phase 8.
- `test-pdfs/golden-master-da.pdf` (2 pages, Danish) — created in Phase 7, used in Phase 7.

These PDFs are sacred. Once created, they never change. If a test fails, the code is wrong, not the PDF.

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
| 7 | `04_orchestration_detailed.md` §9, `02_WIKI_concept_detailed.md` §3.4, `05_page_types_specification.md` §2.1, `06_citation_and_provenance.md` §8 | Understand the input/output language model, the two-layer language rule, slug transliteration, and source-language evidence. |
| 8 | `01_PRODUCT_VISION_AND_ARCHITECTURE.md` | Understand compounding and incremental ingestion. |
| 9 | `03_DOX_concept_detailed.md` | Understand AGENTS.md as a living document. |
| 11 | All | Polish and production readiness. |
| 12 | `04_orchestration_detailed.md` §6, `07_validation_and_quality.md` §2 + §5 | The reask carve-out (already promoted; Phase 12 canon basis). |
| 13 | `04_orchestration_detailed.md` §6, `07_validation_and_quality.md` §5, `02_WIKI_concept_detailed.md` §4.7/§4.8, `05_page_types_specification.md` §2 | Output-token ceilings, self-sizing prompts restoring §4.7/§4.8 fidelity, the `sparse` frontmatter field. |
| 14 | `01_PRODUCT_VISION_AND_ARCHITECTURE.md` §4.1/§5, `04_orchestration_detailed.md` §1/§3.2/§6/§9.4, `05_page_types_specification.md` §6/§7, `07_validation_and_quality.md` §1/§2.3/§5 | Curate-then-write placement, topic eligibility, entity identity, decision-list validation, keep-all fallback. |
| 15 | `04_orchestration_detailed.md` §1 | The concurrency note (bounded pool, cap 4, deterministic order; everything else sequential). |
| 25 | `02_WIKI_concept_detailed.md` §4.6, `05_page_types_specification.md` §6 + §7, `04_orchestration_detailed.md` §3.2 Step 6b | Class-6 disambiguation composites; the same-label-different-meaning topic rule; the disambiguation pass mechanism. |
| 26 | `04_orchestration_detailed.md` §1 + §3.2 + §4 + §6, `07_validation_and_quality.md` §3, `01_PRODUCT_VISION_AND_ARCHITECTURE.md` §4.1 | The per-PDF loop; amendment synthesis (patch output); patched-page preservation; per-PDF curation cadence. |

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
| 7 | Ingest Danish (or other European-language) PDFs. Get prose in the wiki's output language, verbatim source-language evidence, and readable transliterated slugs. |
| 8 | Add new PDFs over time. Watch the wiki compound. See conflicts logged. |
| 9 | Review proposed AGENTS.md updates. Apply them manually. |
| 11 | Use a production-ready CLI with config, logging, metrics, and documentation. |
| 12 | Watch transient and content-defect LLM failures repair themselves via validator feedback instead of aborting the run. |
| 13 | Read honest sparse pages on thin entities (flagged `sparse: true`) and fully synthesized dense pages that no longer truncate. |
| 14 | Browse a curated wiki: duplicate topics merged, meta-descriptor junk gone, forked entities unified into one rich page with aliases. |
| 15 | Wait hours less for the same wiki — entity/topic synthesis runs four pages at a time. |
| 16 | Kill a run mid-flight and watch the re-run skip finished PDFs and already-paid pages; a network hiccup costs one page, not the run. |
| 25 | Trust that `Indikator 2` from two different registries is never conflated — one page, two clearly separated meanings, each with its own evidence. |
| 26 | Ingest 100 PDFs and watch entity pages grow one amendment at a time — each new report pays only for ITS new information, not for re-writing the page. |

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
    ├── PHASE_07_multilingual_ingestion.md
    ├── PHASE_08_multi_pdf_compounding.md
    ├── PHASE_09_agents_updater.md
    ├── PHASE_11_polish.md
    ├── PHASE_12_validation_feedback_retry.md
    ├── PHASE_13_output_caps_and_prompt_self_sizing.md
    ├── PHASE_14_topic_and_entity_curation.md
    ├── PHASE_15_synthesis_concurrency.md
    ├── PHASE_16_run_resilience.md
    ├── PHASE_17_entity_graph_and_citation_integrity.md
    ├── PHASE_18_citation_numbering_alignment.md
    ├── PHASE_19_stale_pagehash_convergence.md
    ├── PHASE_20_wikilink_repair.md
    ├── PHASE_21_curation_overhaul.md
    ├── PHASE_22_composite_pages.md
    ├── PHASE_23_comparison_articles.md
    ├── PHASE_24_cross_wiki_discovery.md
    ├── PHASE_25_generic_label_disambiguation.md
    └── PHASE_26_per_pdf_patch_amendment.md
```

---

## Final Note

This plan is designed to prevent the exact failure mode you experienced: building everything at once, then discovering that no part works. Each phase is small, verifiable, and independent. If you get stuck on Phase 2, you still have a working system from Phase 1. If you never reach Phase 6, you still have a usable wiki from Phase 5.

Start with Phase 0. Do not skip ahead. Do not add features from future phases. Build one gate at a time.
