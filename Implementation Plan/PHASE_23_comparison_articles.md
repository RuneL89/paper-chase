# Phase 23: Comparison-Table Articles

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-023`
**Version:** 1.0.0
**Status:** Complete — user-accepted 2026-07-29
**Date:** 2026-07-29
**Dependencies:** Phases 0-9, 11-20 (Phase 21/22 not required — independent track; shares page-kind machinery when available)
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $0 (all gate tests are LLM-free — injected stubs)

**Canon basis:** `Project Vision/05_page_types_specification.md` §9 (custom page types — the sanctioned extension point), `03_DOX_concept_detailed.md` §3.1 (top-level folders — extended with `comparisons/`, ratified in the arc's compliance entry), `02_WIKI_concept_detailed.md` §3 (two-layer pages), `06_citation_and_provenance.md` §1-§3. Backlog **B21** (user-directed 2026-07-29). Evidence (verified): `dist/wikis/rkkp-afdk/documents/afdk-2023-part-004.md` holds a full indicator comparison table (national/region/hospital rows × performance, standard-met flags, CIs, 3 year-columns); the extractor dissolved it into 36 atomic claims; no article carries the table. Compliance pre-check: compliance-log [2026-07-29 12:30].

---

## 1. Objective

Corpora routinely contain structured comparison tables (regions × indicators, hospitals × outcomes, years × values). Today their content only reaches the wiki dissolved into claims and prose — the complete, scannable table exists nowhere as an article. Generate an independent, verbatim-preserved, synthesized article per comparison table — **corpus-driven and generic, never hard-coded to a specific PDF's structure.**

Three design answers refined during review (2026-07-29): (a) article identity keys on the table's SUBJECT entity (canonical, post-curation) — never on the drifting title; (b) cross-PDF structural drift is embraced, not merged — each source's table is preserved verbatim in its own dated section while identity holds via the subject (indicator renumberings reconcile through Phase 21's entity signals); (c) free-text comparisons stay in the claim/topic system (already first-class) — the comparison page adds a deterministic "Related comparisons in prose" bridge linking out to them.

## 2. What to Build

### 2.1 Extractor `tables` output

**Files:** `prompts/extractor.prompt.txt`, `src/validation/extractor-schema.ts`, `src/agents/extractor.ts` (pass-through only)

- New output array in the extraction JSON: `tables: [{ subject, title, page, rowDimension, colDimension, entities: [slug…], markdown, summary }]` — `subject` is the entity the table is ABOUT (the indicator/theme; canonical slug when resolvable), `title` the table's own caption, the dimensions (what rows compare, what columns show), the entities appearing in it, the table as markdown, and a one-sentence summary. Generic wording: "structured tables comparing multiple subjects (e.g., regions, organizations, periods) against shared measures." Note: pdfjs destroys table geometry, so the extractor RECONSTRUCTS the text-table into markdown — the structure is the extractor's, the values must be the PDF's (gate 23.5).
- Schema validation: `title`, `page` (within chunk range), `markdown` non-empty required; dimensions/summary free-text; entities reference known slugs (warning, not rejection — tables may mention unextracted names). Bounded-retry and reask rules unchanged.

### 2.2 The `comparison` page type + `comparisons/` folder

**Files:** NEW `src/pages/comparison-page.ts`, `src/materializer.ts`, `templates/AGENTS.md`, `src/validation/schema-validator.ts`

- New top-level `comparisons/` folder (the arc's ratified extension of `03` §3.1). One article per comparison SUBJECT: identity = the canonical subject-entity slug when resolvable (so a renamed/renumbered table — the corpus's 2023→2024 indicator renumbering — reconciles onto ONE page through Phase 21's entity signals); normalized-title slug only as fallback. Cross-PDF structural drift (changed columns, added years, renamed rows) is NEVER force-merged: each source's table keeps its own dated `## Table: <source>, p. <page>` section, preserved verbatim as that source printed it (`01` Principle 3 — compounding); the synthesis reads ACROSS the sections (trend detection).
- The deterministic shell: complete frontmatter (`type: comparison`, title, real `updated`, aggregated `sources`, aliases), the verbatim table markdown per source (preservation-checked verbatim), per-table entity links, `## Sources` basename-form. `templates/AGENTS.md` documents the type per `05` §9.

### 2.3 Comparison synthesis

**Files:** NEW `prompts/comparison.prompt.txt`, `src/agents/synthesis.ts`

- Generic comparison Layer 1 (leaders and trailers, standards met/missed, trends ACROSS the dated table sections, outliers) — explicitly NOT RKKP-specific; carries the Phase 7 `{languageDirective}` and Phase 18 `{citationMap}` slots and the Phase 17 `relatedEntities` slot (the table's entities).
- Preservation: ROW-VALUE preservation, not byte-substring — every row's key values (row subject + its numbers) must appear in the emitted table section; a row with altered or dropped values is a content defect in the reask loop. (The markdown structure is the extractor's reconstruction; the numbers are the PDF's.)
- Bridge section (deterministic): `## Related comparisons in prose` — claims sharing the table's entities (from `claim.entities`), linking out to the topic/entity pages where free-text comparisons already live.

### 2.4 Validators, links, DOX

**Files:** `src/validation/*`, `src/dox-writer.ts`

- Comparison pages are content pages for link/orphan/island purposes; their table-entity links feed `relatedEntities`; `comparisons/index.md` joins the bottom-up DOX chain (deterministic children re-imposition includes it at the wiki root).

## 3. Technical Approval Gates

All gates LLM-free.

- **Gate 23.1:** the extractor schema accepts a well-formed `tables` array and rejects missing title/page/empty markdown; off-range pages rejected; unknown entity slugs warn but pass.
- **Gate 23.2:** assembly — one page per subject entity; TWO fixtures prove the identity rule: (a) the same table title from two sources accumulates as two dated sections on ONE page; (b) the DRIFT fixture — same subject, different title and different columns across sources (the indicator-renumbering pattern) — still lands on ONE page via the canonical subject slug; no page is created for a chunk with an empty tables array.
- **Gate 23.3:** the deterministic shell preserves the table markdown byte-for-byte inside its section; frontmatter complete; `## Sources` basename-form and citation-map consistent.
- **Gate 23.4:** synthesis values carry the table sections, entities, relatedEntities, citationMap; the prompt is slot-additive, generic (assert it contains no RKKP/registry-specific words).
- **Gate 23.5:** row-value preservation — a section missing a row's key value (or with an altered number) fails as a content defect; a reformatted-but-value-complete section passes.
- **Gate 23.6b:** the bridge section lists exactly the claims sharing the table's entities (deterministic), with links to their topic/entity pages, and is empty-form honest when none exist.
- **Gate 23.6:** validators + DOX — comparison pages resolve in the link checker as content pages; `comparisons/index.md` appears in the wiki root's children.
- **Gate 23.7:** full key-less suite: the Phase 22 baseline plus the new phase-23 tests, zero unenumerated regressions; `npx tsc --noEmit` clean.

## 4. User Acceptance Tests (UAT)

- **UAT 23.1 (live re-ingest of rkkp-afdk or rkkp-akdb):** the indicator comparison tables appear as independent articles under `comparisons/` (the afdk-2023-part-004 table findable by title in Obsidian), each carrying the verbatim table(s) from both report years and a synthesized reading (leaders, trailers, trends); every region/hospital named in the table links to its page.
- **UAT 23.2 (live):** a wiki whose corpus has NO comparison tables gains no empty `comparisons/` artifacts beyond the folder contract rules (no ghost pages).

## 5. Approval Checklist

- [ ] All 7 gates pass; `npx tsc --noEmit` clean
- [ ] Detection and prompt are generic (gate 23.4's no-hardcoding assertion)
- [ ] Accumulation rule works (gate 23.2); verbatim preservation enforced (gate 23.5)
- [ ] `templates/AGENTS.md` documents the type; `03` §3.1 folder amendment recorded
- [ ] Compliance log shows no unresolved contradictions; status file updated; DOX pass complete

## 6. Integration Notes

**Depends on:** Phase 2 (extractor surface), Phase 17/18 (relatedEntities, citation map), Phase 22 optionally (page-kind scaffolding).
**Produces:** the `comparison` page type; the extractor `tables` output; the `comparisons/` top-level folder.
**Contract:** corpus-driven and generic; verbatim tables are never paraphrased in Layer 2; accumulation compounds per subject across sources.
