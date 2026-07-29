# Phase 18: Citation Numbering Alignment

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-018`
**Version:** 1.0.0
**Status:** Complete — user-accepted 2026-07-29
**Date:** 2026-07-29
**Dependencies:** Phases 0-9, 11-17
**Estimated Time:** 2-3 hours
**LLM Token Budget:** $0 (all gate tests are LLM-free)

**Canon basis:** `Project Vision/06_citation_and_provenance.md` §1 (every claim traceable), §2 (keys unique within a page), §3 (frontmatter source map), §7 (verification workflow); `04_orchestration_detailed.md` §4 (synthesis input — "e.g." non-exhaustive), §6 (reask loop); `07_validation_and_quality.md` §2.4 (preservation), §5. Backlog **B18**. Evidence: 33 dangling model-invented `[^srcN]` markers on ~13 afdk topic pages + 19 in akdb (2026-07-28/29 live runs), all caught by the Phase 17 §2.6 consistency check; predicted by the Phase 17 Verifier (design note g). Compliance pre-check: compliance-log [2026-07-29 09:10].

---

## 1. Objective

The deterministic citation map assigns `[^srcN]` keys by order of first appearance in a page's evidence, but the synthesis model never sees that map — so it improvises markers that dangle (33+19 observed) and burns reask retries (~30% of calls). Teach the model the numbering, and make off-map markers a content defect the reask loop corrects.

## 2. What to Build

### 2.1 Citation-map prompt slot

**Files:** `src/agents/synthesis.ts`, `prompts/synthesis.prompt.txt`, `prompts/synthesis-permissive.prompt.txt`, `prompts/synthesis-topic.prompt.txt`, `prompts/synthesis-topic-permissive.prompt.txt`

- Compute the deterministic map ONCE per page from the page data (reuse `buildCitationMap` from `src/pages/entity-page.ts` — order of first appearance across mentions → relationships (outgoing then incoming) → claims → timeline sources; the topic equivalent).
- New prompt slot (entity + topic synthesis values): `citationMap` — rendered as `[^srcN]: <basename>, pages <range>` lines in assignment order (same form the deterministic `## Sources` rebuild emits).
- All four synthesis prompt templates gain the slot under a `=== CITATION KEYS ===`-style section with the rule: every citation MUST use exactly these keys for these sources; no other `[^srcN]` keys may appear. PROMPT DISCIPLINE: slot-additive; every pre-existing section (incl. LANGUAGE block and the Phase 17 `relatedEntities` slot) byte-identical.

### 2.2 Off-map marker detection in the quality validator

**Files:** `src/validation/preservation-check.ts`

- After the existing checks, extract all `[^srcN]` markers in the written page; any key NOT in the deterministic set is collected into a new `extraMarkers: string[]` result field (key + first line it appears on). `passed` becomes false when the list is non-empty (a content defect — the existing Phase 12 reask loop then feeds the exact offending markers back for correction; the orchestrator wires the feedback text in `src/commands/ingest.ts`).

### 2.3 No deterministic stripping (design decision, recorded)

Off-map markers are NEVER silently stripped or renumbered — they are corrected by the model via the reask loop; on exhaustion the page takes the existing permissive/template fallback. (Fail-loud-with-repair, per `07` §5; silent rewriting of model prose is the B1-class mistake this project already fixed once.)

## 3. Technical Approval Gates

All gates LLM-free.

- **Gate 18.1:** the `citationMap` slot matches `buildCitationMap` exactly — keys, order, basenames, page ranges — for a fixture entity page (mentions + outgoing + incoming + claims) and a fixture topic page.
- **Gate 18.2:** all four prompt templates carry the slot and the rule; removing the slot restores byte-equality with the Phase 17 templates; the filled prompt renders the map.
- **Gate 18.3:** a synthesized page containing an off-map marker (`[^src9]` when the map has src1-3) fails with `extraMarkers: ["[^src9]"]` naming the key and line; an on-map page passes.
- **Gate 18.4:** the preservation result's feedback text lists the exact offending markers for the reask correction block.
- **Gate 18.5:** full key-less suite: Phase 17 baseline (350 passed + 14 skipped / 23 files) plus the new phase-18 tests, zero unenumerated regressions; `npx tsc --noEmit` clean.

## 4. User Acceptance Tests (UAT)

- **UAT 18.1 (next live ingest, observational):** `invalid` and `missingFrontmatterSource` in `validation-report.json` drop to 0 or near-0 on a wiki that previously showed them (afdk had 33, akdb 19). Reask rate should drop visibly from the ~30% band.
- **UAT 18.2 (observational, $0):** the afdk/akdb wikis' existing dangling markers are unchanged by this phase (no retroactive mutation; they clear on the next content-changing ingest of those pages).

## 5. Approval Checklist

- [ ] All 5 gates pass; `npx tsc --noEmit` clean
- [ ] Four prompt templates slot-additive; pre-existing sections byte-identical
- [ ] No deterministic stripping/renumbering of model markers (reask-only)
- [ ] Compliance log shows no unresolved contradictions
- [ ] Status file updated; unified verification (with Phases 19/20) passed

## 6. Integration Notes

**Depends on:** Phase 5 (synthesis), Phase 12 (reask loop), Phase 17 (citation map consumers, `## Sources` normalization, §2.6 check).
**Produces:** a citation-map contract shared by prompt and validator; lower reask rate; zero dangling markers on new pages.
**Contract:** prompt changes slot-additive only; preservation result gains `extraMarkers` (additive); no retroactive wiki mutation.
