# Phase 22: Composite Pages (Option C)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-022`
**Version:** 1.0.0
**Status:** Complete — user-accepted 2026-07-29
**Date:** 2026-07-29
**Dependencies:** Phases 0-9, 11-21 (uses Phase 21's sticky records and pair machinery)
**Estimated Time:** 8-12 hours (largest single change since Phase 3)
**LLM Token Budget:** $0 (all gate tests are LLM-free — injected stubs)

**Canon basis + AMENDMENT (user-resolved contradiction, compliance-log [2026-07-29 12:30]):** the user directed (2026-07-29): *"I would rather the end-articles are longer, more detailed, more rich… I don't mind that a wiki article covers several entities if the entities logically map to each other."* This contradicts `02_WIKI_concept_detailed.md` §4.6 ("One entity = one page… even if they are related") and `05_page_types_specification.md` §6 (strict-identity merges only; never sub-unit→parent, never colocated-but-distinct). The user-resolved amendment — **composite pages are allowed ONLY within five checkable rollup classes** (member cap 2-4, sticky cluster records, manual split escape hatch, validation rejects out-of-class clusters):
1. **abbreviation/name-variant** (already legal strict identity — unchanged);
2. **brand↔generic substance** (`eliquis`↔`apixaban`);
3. **indicator↔measured concept, 1:1 only** (`indikator-1`↔`antibiotikabehandling`);
4. **facility↔city, only when the facility is the city's story** (`holbaek-hospital`↔`holbaek`);
5. **same-name different-type** (organization↔location: `region-hovedstaden`).

The graph stays entity-granular (relationships, extraction, identity); pages become cluster-granular for these classes only. `02` §4.6 / `05` §6 text is amended with this wording at implementation time. Backlog **B22**. Arc context: uses Phase 21's sticky decisions and pair machinery; shares page-kind machinery with Phase 23.

---

## 1. Objective

Thin, logically-mapped entities pool their evidence into one rich article while keeping their identities in the graph. Thin stubs disappear; every composite passes the Journalist Test more easily than its members did alone.

## 2. What to Build

### 2.1 Cluster decisions (on the Phase 21 machinery)

**Files:** `src/agents/curation.ts`, `src/agents/pre-merge.ts`, `prompts/curation-entities.prompt.txt`

- New `cluster` decision: `{ members: [slug…], class: 1-5, into, rationale }`. Deterministic families (region name-forms class 5, indicator renumberings class 3) are proposed by signal; judgment classes (2, 4) go through confirm-deny.
- Validation enforces: every member exists, class ∈ 1-5, 2 ≤ members ≤ 4, class-3 requires exactly 2 members (one indicator, one concept), class-5 requires same slug-stem, neverMerge still vetoes, no member in two clusters. Out-of-class or over-cap → validation error → reask.
- Clusters are recorded in `.state/curation-decisions.json` (`action: cluster`) and pre-applied deterministically every run — thin member pages can never oscillate back.

### 2.2 CompositePageData + assembly

**Files:** `src/materializer.ts`, NEW `src/pages/composite-page.ts`

- `CompositePageData`: `title` (e.g. `Indikator 1 — Antibiotikabehandling`), `slug` (the `into`), `members: [{ slug, title, type, role, significance, disambiguation, aliases }]`, and the unioned member-tagged evidence (mentions/relationships/incoming/claims/timeline/contexts — every item keeps its member association from extraction).
- Member pages are NOT written; wikilinks targeting member slugs are rewritten to the composite (the Phase 14 rewrite pass, extended); the composite's frontmatter `aliases` unions all member titles; `type: composite`.
- Fingerprint = hash over `{ members, unioned evidence, language }` — member-set changes flip it exactly once; the Phase 16 resume contract holds.

### 2.3 Composite writer + synthesis

**Files:** `src/pages/composite-page.ts` (deterministic shell), NEW `prompts/composite.prompt.txt`, `prompts/composite-permissive.prompt.txt`, `src/agents/synthesis.ts`

- The deterministic shell: frontmatter (members block, aliases union, real `updated`, aggregated `sources`), `## Members` section (each member's name, type, role, significance), then the standard Layer 2 sections with evidence grouped per member, `## Sources` basename-form.
- The composite synthesis prompts (strict + permissive) carry the Phase 7 `{languageDirective}`, Phase 17 `relatedEntities`, and Phase 18 `{citationMap}` slots: Layer 1 is ONE rich article weaving the members; Layer 2 preserves every evidence item verbatim per member.
- Sparse never applies to composites (they are rich by construction).

### 2.4 Validators, links, DOX

**Files:** `src/validation/*`, `src/dox-writer.ts`

- Preservation check over the unioned evidence (verbatim substrings, per member — same mechanism).
- Link checker: composite pages are normal content pages; member slugs resolve via the rewrite (and aliases for search).
- Schema validator: `type: composite` requires `members` (2-4) + `class`; DOX folder indexes catalog composites with member names in the catalog line.

## 3. Technical Approval Gates

All gates LLM-free.

- **Gate 22.1:** cluster validation — accepts a class-3 pair (indicator+concept) and a class-5 same-stem pair; rejects out-of-class, over-cap, double-membership, and neverMerge-vetoed clusters with exact error lists.
- **Gate 22.2:** assembly — the composite carries the unioned member-tagged evidence; NO member pages are written; member-targeted wikilinks on other pages are rewritten to the composite slug; aliases union.
- **Gate 22.3:** the deterministic shell renders members block + per-member evidence groups + basename Sources; frontmatter complete (type composite, members, real updated, aggregated sources).
- **Gate 22.4:** synthesis values carry both members' slots + relatedEntities + citationMap; the two prompts are slot-additive against their Phase 18 baselines.
- **Gate 22.5:** preservation fails when any member's evidence is dropped; passes when complete (both members' items verbatim).
- **Gate 22.6:** sticky re-application — after a cluster is recorded, a later materialize with unchanged extraction data produces the composite and ZERO member pages, with no curation call for those members (sticky).
- **Gate 22.7:** split escape hatch — a slug in `splits` dissolves the cluster (member pages rebuilt, composite removed, reversal logged).
- **Gate 22.8:** fingerprint changes when the member set changes, not when an unrelated page changes (resume byte-stability for unaffected composites).
- **Gate 22.9:** full key-less suite: the Phase 21 baseline plus the new phase-22 tests, zero unenumerated regressions; `npx tsc --noEmit` clean.
- **Gate 22.10 (added 2026-07-29 — closes the doc's ingest-wiring gap):** the ingest synthesis stage is wired for composites — composite pages flow through their own strict → permissive → template chain (`runCompositeSynthesis` / `runCompositePermissiveSynthesis`, the Phase 12 reask loop, `checkCompositePreservation`) with report entries in the existing finalMode vocabulary and progress lines; a strict pass replaces the shell with the rich article; the shell is kept on double failure; a skip-eligible composite (unchanged fingerprint) makes zero LLM calls on the next run.

## 4. User Acceptance Tests (UAT)

- **UAT 22.1 (live re-ingest, one wiki):** at least one composite per ratified class appears (expected from observed data: `indikator-N`-concept, `region-X` org/location, a brand/generic drug pair in afdk); member stubs are gone; their names still find the composite in Obsidian search; incoming/outgoing relationships render on the composite.
- **UAT 22.2 (live):** a journalist reading one composite can name every member, cite three facts with sources, and follow links to two related pages (the Journalist Test, `02` §4.5).

## 5. Approval Checklist

- [ ] All 9 gates pass; `npx tsc --noEmit` clean
- [ ] Vision `02` §4.6 / `05` §6 amended with the five-class wording (recorded in the compliance log)
- [ ] Member cap 2-4 enforced; class rules enforced; neverMerge unbroken
- [ ] Split escape hatch documented (decisions-file contract + wikis/AGENTS.md)
- [ ] No TUI changes (Obsidian browsing per the five-item menu preference)
- [ ] Compliance log shows no unresolved contradictions; status file updated; DOX pass complete

## 6. Integration Notes

**Depends on:** Phase 21 (sticky records, pair machinery, confirm-deny), Phase 17 (bidirectional relationships, relatedEntities), Phase 18 (citation map), Phase 19 (hash convergence).
**Produces:** the composite page kind; the five ratified rollup classes; the cluster decision type. Phase 23 reuses the new-page-kind machinery (writer/prompt/validator scaffolding).
**Contract:** the graph stays entity-granular; composites only within the five classes, 2-4 members; splits manual and logged; out-of-class clustering is a validation error, never a silent judgment.
