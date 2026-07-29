# Phase 17: Entity Graph and Citation Integrity

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-017`
**Version:** 1.0.0
**Status:** Complete — user-accepted 2026-07-29
**Date:** 2026-07-28
**Dependencies:** Phases 0-9, 11-16
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $0 (all gate tests are LLM-free — deterministic fixtures and temp workspaces; live verification only during real ingests at the user's discretion)

**Canon basis:** `Project Vision/02_WIKI_concept_detailed.md` §2 (no page is an island), §4.3 B (relationships must be bidirectional), §4.5 (Journalist Test), §4.8 (sparse flag); `Project Vision/05_page_types_specification.md` §2 (universal frontmatter), §6 (entity identity); `Project Vision/06_citation_and_provenance.md` §1-§3 (frontmatter source map), §7 (verification workflow); `Project Vision/07_validation_and_quality.md` §2.5 (structural checks), §2.6 (page schema validation); `Project Vision/04_orchestration_detailed.md` §3.2 Step 6 (materialize), §4 (synthesis input). Backlog items **B10, B12, B1, B2** (B2 rides §2.4). Evidence: run-5 validation report (`dist/wikis/rkkp-adhd/.state/validation-report.json`) — 176 `missingSource` flags on 53 pages, 315 `schema.invalid` flags; the 2026-07-28 audit (53/119 entity pages with no frontmatter; `adhd-foreningen.md` relationship-blind and link-free). Compliance pre-check: compliance-log [2026-07-28 16:21] — COMPLIANT with extension notes, one design decision (§2.1, sparse scope) presented for ratification.

---

## 1. Objective

Entity pages today tell only half of every relationship story and are trusted with output they provably mishandle. Three defects, one coherent work item sharing the Materializer's merge rules and the synthesis write path:

1. **Relationships attach to the subject only** (`src/materializer.ts:662-678`), so object pages violate `02` §4.3 B's ratified "bidirectional" rule — `adhd-foreningen.md` shows `## Relationships (none)` while the corpus holds two `is-chair-of` relationships naming it.
2. **The synthesis context carries no foreign entity slugs** (only relationship/claim fields ever contain slugs), so the model cannot form wikilinks to the entities its prose names, and the link checker (`src/validation/link-checker.ts:113-150`) counts only incoming links — zero-outgoing pages are invisible to validation despite `02` §2.
3. **A passing synthesis page replaces the deterministic page wholesale** with only `aliases`/`sparse` re-imposed, and both enforcers no-op on a missing frontmatter block (`src/pages/entity-page.ts:109-116`) — producing pages with no frontmatter at all, untrusted `updated` (B2), unverified frontmatter `sources`, and `## Sources` definitions whose path form the citation checker cannot resolve (176 `missingSource` flags, all LLM-chosen full-path definitions).

Fix all three; make the validators green on the classes they can now prove.

---

## 2. What to Build

### 2.1 Incoming relationships — bidirectional page data (B10; vision `02` §4.3 B)

**Files:** `src/materializer.ts`, `src/pages/entity-page.ts`, `src/agents/synthesis.ts`, `src/validation/preservation-check.ts`, `prompts/synthesis.prompt.txt`, `prompts/synthesis-permissive.prompt.txt`

- After the subject-attach loop (`materializer.ts:662-678`), mirror it: attach an **incoming** record to `entityMap.get(relationship.object)` — same skip-on-unknown guard, self-loops render once (as outgoing). Follows the claims multi-attach precedent (`materializer.ts:707-719`). Dedup (`materializer.ts:189`) is upstream of attachment and unaffected; curation slug remaps (`materializer.ts:1023-1030`) run before page assembly, so incoming records carry canonical slugs.
- `EntityPageData` gains `incomingRelationships` (subject, predicate, evidence, page, source, pages). `writeEntityPage` renders both directions in `## Relationships` with direction explicit and the evidence quote verbatim: outgoing unchanged (`- [[object|Title]] — Predicate [^srcN]`); incoming as `- [[subject|Title]] — Predicate (incoming) — "evidence" [^srcN]`.
- The synthesis prompt's Relationships section formats both directions (marked subsections); Layer 1 guidance notes the entity may be the object of a relationship and should say so when the evidence supports it.
- `checkPreservation` requires incoming evidence substrings exactly as it requires outgoing ones today (data-driven; no structural change beyond the new field).
- **DESIGN DECISION (RATIFIED 2026-07-28, user choice — compliance-log [2026-07-28 16:21] note e and ratification entry):** the `02` §4.8 sparse rule's clause "no significant claims or relationships" is scoped to **outgoing** relationships — incoming relationships do NOT clear `sparse`. Rationale: sparse signals the page's own evidence depth; an incoming relationship's evidence lives primarily on the subject page. The vision predates bidirectionality and is silent on the distinction. (`isSparseEntity`, `entity-page.ts:98-102`, keeps reading the outgoing `relationships` array only.)

### 2.2 Related-entity link targets in the synthesis context (B12a; vision `02` §2, §4.2 C)

**Files:** `src/agents/synthesis.ts`, `prompts/synthesis.prompt.txt`, `prompts/synthesis-permissive.prompt.txt`

- `buildEntitySynthesisValues` gains a `relatedEntities` slot: the deterministic, deduplicated, sorted list of `{slug, title}` the page may legally link to — every relationship subject and object (both directions, after §2.1) plus every co-entity in the page's claims, minus the page itself. Titles via the existing `slugToTitle`.
- Both entity-synthesis prompts gain the slot and an updated wikilink rule: targets MUST come from `relatedEntities`; when Layer 1 names a related entity from that list, it links it on first mention. (The current rule — "the target is the entity's slug from the data above" — stays conceptually; the data above now actually contains the slugs.)

### 2.3 Island detection — outgoing-link structural check (B12b; vision `02` §2, `07` §2.5)

**Files:** `src/validation/link-checker.ts`, `src/validation/index.ts`

- The link checker's existing parse loop also tallies **outgoing** counts per page. The report gains `islands: string[]` — entity/topic pages with zero outgoing wikilinks — alongside `orphaned` (unchanged: no incoming). Exemptions match the orphan rule (`index.md`, `sources/*.md`) plus `documents/*.md` (raw chunk text legitimately carries no links).
- Console summary line gains the islands count, same style as orphans (`validation/index.ts:81-82`). Detection only — no gate, no fallback; same reporting posture as orphans.

### 2.4 Deterministic frontmatter re-imposition (B1 Defect B + B2; vision `05` §2, `06` §2-§3)

**Files:** `src/pages/entity-page.ts`, `src/pages/topic-page.ts`, `src/commands/ingest.ts`

- New `enforceFrontmatterInMarkdown(markdown, pageData)` applied to every synthesized entity AND topic page at the existing write points (`ingest.ts:1032-1039`, `1069-1074`, `1219`, `1248`), after the aliases/sparse enforcers:
  - Builds the complete frontmatter from the deterministic page data — `title`, `type`, `wiki`, `updated` (**real write time — this is B2's fix**), `aliases` (existing `combinedAliases`), `sparse` (existing `isSparseEntity`, entity pages only), `sources` (the full aggregated list — the `sourceRanges` logic at `entity-page.ts:277-299` and the topic equivalent).
  - **Creates the block when the model omitted it** — ending the "never invents a frontmatter block" no-op class (53/119 entity pages in run 5's wiki). The aliases/sparse enforcers keep their current behavior and slot into the same block.
- Skip-eligible pages under the Phase 16 resume rule are untouched (byte-stability contract: enforcement runs only when a page is actually synthesized or materialized).

### 2.5 `## Sources` definition normalization (B1 Defect A; vision `06` §7)

**Files:** `src/pages/entity-page.ts`, `src/pages/topic-page.ts`, `src/commands/ingest.ts`

- New `enforceSourcesSectionInMarkdown(markdown, citationMap)`: rebuild the `## Sources` section deterministically from `buildCitationMap` + `sourceFileName` (basename + page ranges — the form the citation checker resolves and `06` §7's example shows), replacing the model-written definitions; in-prose `[^srcN]` markers stay model-placed (the preservation check already pins the key set).
- Applied at the same write points as §2.4, for entity and topic pages.

### 2.6 Citation consistency check (optional hardening; vision `07` §2.5)

**Files:** `src/validation/citation-checker.ts`

- Now that §2.4 guarantees a complete frontmatter `sources` map, add the check the original B1 report described: every distinct body `[^srcN]` key on entity/topic pages must be covered by the page's frontmatter `sources` (report-only, same posture as `missingSource`).

---

## 3. Technical Approval Gates

All gates are LLM-free (deterministic fixtures, temp workspaces, injected stubs).

### Gate 17.1: Incoming attachment

Two chunks where `a — rel → b` (one relationship per chunk, distinct sources/pages): the materialized `b` page data carries both incoming records with verbatim evidence, page, source, pages; the `a` page data carries both outgoing; a relationship naming an unknown object is skipped; a self-loop attaches once (outgoing only).

### Gate 17.2: Template renders both directions

`writeEntityPage` on the gate-17.1 aggregate: `## Relationships` contains the outgoing line (unchanged format) and the incoming line with the `(incoming)` marker, the verbatim evidence, and correct `[^srcN]` keys; the citation map and frontmatter `sources` cover the incoming records' sources.

### Gate 17.3: Sparse scope

An entity with ≤2 mentions, no claims, and ONLY incoming relationships keeps `sparse: true` in `writeEntityPage` output; the same entity with one outgoing relationship has no `sparse` field.

### Gate 17.4: Preservation covers incoming

`checkPreservation` fails a synthesized page that drops an incoming relationship's evidence string and names it in `droppedRelationships`; passes when all incoming + outgoing evidence appears verbatim.

### Gate 17.5: `relatedEntities` computation

The synthesis slot contains exactly the deduplicated, sorted `{slug, title}` union of relationship subjects/objects (both directions) and claim co-entities, excluding the page itself; empty data yields the documented empty form.

### Gate 17.6: Prompt slots

Both entity-synthesis prompt templates carry the `relatedEntities` slot and the updated wikilink rule; the filled prompt (fixture data) renders the slot and preserves every pre-existing section byte-for-byte (including the LANGUAGE block placeholders).

### Gate 17.7: Island detection

A fixture wiki with: one zero-outgoing entity page (with an incoming link), one zero-outgoing topic page, one linked entity page: `islands` lists exactly the two zero-outgoing pages; `orphaned` is unchanged by the new tally; `index.md`, `sources/*`, `documents/*` are exempt from both lists.

### Gate 17.8: Frontmatter re-imposition over LLM frontmatter

A synthesized page whose model frontmatter carries a wrong `updated` (the constitution's example date), partial `sources`, and a fabricated field: after enforcement, `updated` is the real write time, `sources` is the complete deterministic aggregation, title/type/wiki/aliases/sparse match the page data, and the model's extra field is gone.

### Gate 17.9: Frontmatter creation when absent

A synthesized page with NO frontmatter block (the run-5 53-page class): after enforcement the page has the complete block of gate 17.8, body untouched — including `sparse: true` on the textbook-sparse fixture (the `adhd-foreningen` case).

### Gate 17.10: Sources-definition normalization

A synthesized page whose model wrote full-workspace-path definitions (`[^src1]: wikis/wiki/raw/x.pdf, pages 1-5`): after enforcement the definitions are basename-form with the deterministic page ranges, in-prose markers byte-identical; `checkCitations` reports zero `missingSource` on the fixture.

### Gate 17.11: Topic pages enforced

The §2.4/§2.5 enforcers applied at the topic write points produce the same guarantees for a topic page (frontmatter created when absent; definitions normalized).

### Gate 17.12: Resume byte-stability

A skip-eligible page (Phase 16 record, matching fingerprint) is preserved byte-for-byte across a re-materialize + re-synthesize-skip — the new enforcement never touches it.

### Gate 17.13: Full-suite regression

`npm test` (key-less): the Phase 16 baseline (332 passed + 14 skipped across 22 files) plus the new phase-17 tests, zero unenumerated regressions; `npx tsc --noEmit` clean.

---

## 4. User Acceptance Tests (UAT)

### UAT 17.1: Object page tells both sides of the story (live re-ingest, moderate cost)

Re-ingest a wiki whose corpus contains a relationship-rich entity pair (e.g. the deferred test wiki, or `rkkp-afdk`/`rkkp-akdb` after the routing fix).
**Expected:** the object entity's page lists the incoming relationship in `## Relationships` with the `(incoming)` marker and names the related party in Layer 1 with a working wikilink; the subject page is unchanged in content.
**How to verify:** open both pages; click the link in Obsidian; confirm it resolves to the correct page.

### UAT 17.2: Validators go green on the new wiki (live re-ingest)

Same re-ingest.
**Expected:** `validation-report.json` shows `missingSource: []`, `schema.invalid` at or near zero for synthesized pages, and an `islands` list; every synthesized entity/topic page opens with complete frontmatter (title/type/wiki/updated/sources; `sparse` where honest).
**How to verify:** read the report; spot-check a known-thin page (the `adhd-foreningen` analog) for frontmatter + `sparse: true` + an outgoing link or an honest island listing.

### UAT 17.3: Run-5 wiki unchanged until re-synthesized (observational, $0)

Without re-ingesting, open `dist/wikis/rkkp-adhd`.
**Expected:** pre-fix pages are untouched (the fix is not retroactive to skip-eligible pages); the backlog documents that existing wikis pick up the fixes on their next aggregate-changing ingest.
**How to verify:** `adhd-foreningen.md` still shows the pre-fix form; no files modified by installing the phase.

---

## 5. Approval Checklist

- [ ] All 13 technical gates pass (`npm test` green), LLM-free, $0
- [ ] `npx tsc --noEmit` clean
- [ ] The sparse-scope design decision (§2.1) is user-ratified and recorded in the status file
- [ ] Both entity-synthesis prompts carry `relatedEntities`; pre-existing prompt sections byte-identical
- [ ] UAT steps documented with expected output
- [ ] Compliance log shows no unresolved contradictions
- [ ] Status file shows all gates passed and no blockers
- [ ] DOX pass complete (src/, prompts/, tests/, wikis/ AGENTS.md; backlog B1/B2/B10/B12 marked FIXED with the phase reference)

## 6. Integration Notes

### What Phase 17 Depends On

- Phase 3 (Materializer merge rules, claims multi-attach precedent), Phase 5 (synthesis prompts + preservation check), Phase 6 (UAT 6.3 alias re-imposition precedent), Phase 13 (sparse re-imposition), Phase 14 (curation slug remaps), Phase 16 (resume skip-eligibility and its byte-stability contract).

### What Phase 17 Produces

- Bidirectional relationship page data and rendering, with incoming evidence preservation-checked.
- A `relatedEntities` link-target contract in both entity-synthesis prompts; island (zero-outgoing) detection in the validation report.
- Deterministic post-synthesis frontmatter (created when absent) and `## Sources` normalization for entity and topic pages; B2 fixed by the same pass; optional body-vs-frontmatter citation consistency check.

### Contract with Final Acceptance

- No retroactive mutation of existing wikis: skip-eligible pages stay byte-stable (Phase 16 contract); pre-fix wikis adopt the new shapes on their next aggregate-changing ingest.
- The DOX Writer, workspace pass, curation, and extractor surfaces are untouched; prompt changes are slot-additive only.
