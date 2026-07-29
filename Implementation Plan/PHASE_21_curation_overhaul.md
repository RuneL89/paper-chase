# Phase 21: Curation Overhaul — Deterministic Pre-Merge, Confirm-Deny, Sticky Decisions

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-021`
**Version:** 1.0.0
**Status:** Complete — user-accepted 2026-07-29
**Date:** 2026-07-29
**Dependencies:** Phases 0-9, 11-20
**Estimated Time:** 5-8 hours
**LLM Token Budget:** $0 (all gate tests are LLM-free — injected stubs)

**Canon basis:** `Project Vision/04_orchestration_detailed.md` §3.2 Step 6 (curation mechanism), `05_page_types_specification.md` §6 (entity identity) + §7 (topic eligibility), `07_validation_and_quality.md` §2.3 (decision-list validation) + §5. Backlog **B5** (HIGH PRIORITY). Evidence: three consecutive runs (2026-07-28/29) each re-discovered dozens of correct merges — ≈$60 of $163 in re-synthesis; ~70% of the observed merges match deterministic patterns (transliteration/typos, abbreviations already present as frontmatter aliases, name subsequences, region/indicator regex families, domain translations). Compliance pre-check: compliance-log [2026-07-29 12:30]. **Arc context:** this phase builds the sticky-decision and pair-proposal infrastructure that Phase 22 (composite pages) requires.

---

## 1. Objective

Curation currently re-litigates every identity from scratch on every pass: the model never sees its own previous decisions, and lexical-stem bucketing hides variant pairs from each other. Make identity decisions **sticky**, make the **deterministically findable ~70% free**, and turn the LLM's open-discovery task into a **confirmation task** — discovery stays available for genuine judgment cases.

## 2. What to Build

### 2.1 Deterministic pre-merge signals (Track 1)

**Files:** NEW `src/agents/pre-merge.ts`

- Signal families (each returns proposed pairs `{ from, into, signal, evidence }`):
  1. **Transliteration/typo** — slugs equal after applying the input-language transliteration map in both directions, or edit-distance ≤ 2 on long slugs (`landspatientregistret`/`landspatientregisteret`, `sundhedsvaesenet`/`sundhedsvaesenets`).
  2. **Alias match** — one candidate's name/title slugifies to another's frontmatter `aliases` (`lpr` vs page with alias `LPR`).
  3. **Corpus-derived abbreviations** — mine chunk text for the `Full Name (ABBR)` parenthesized pattern; pair ABBR-slug ↔ full-name-slug.
  4. **Subsequence/initials** — one candidate's tokens are a subsequence of the other's (`peter-olsen-svenningsen`/`peter-svenningsen`, `moeller-m-h`/`morten-moller`).
  5. **Formulaic families** — region name-forms (`X`, `X-region`, `region-X`) and indicator number↔name (`indikator-N-*`) regex families.
  6. **Domain translation glossary** — a small checked-in da↔en glossary for corpus-domain terms (symptoms, procedures, registries); pair translations.
- Two confidence tiers: **auto-apply** (slug-identical-after-transliteration AND alias-exact — near-zero risk, no LLM) and **propose** (everything else, to §2.2). Every auto-apply is recorded in the curation report with its signal.

### 2.2 Confirm-deny pair proposals (Track 2)

**Files:** `src/agents/curation.ts`, `prompts/curation-entities.prompt.txt`, `prompts/curation-topics.prompt.txt`

- The curation calls gain a `proposedPairs` section (pairs + signal + evidence). The model returns `confirm`/`deny` per pair with a few-words justification — a bounded decision list validated by the existing deterministic validator (slugs exist, no self-merge, union-find chains, neverMerge vetoes). Confirmed pairs apply exactly like today's merges.
- The residual open-discovery pass continues over unproposed candidates only (smaller input, fewer bucket splits — variance source #4 shrinks). Bucketing by lexical stem is replaced by signal-aware grouping (proposed pairs always co-located).

### 2.3 Sticky decisions (Track 3)

**Files:** NEW `.state/curation-decisions.json` contract, `src/agents/curation.ts`, `src/materializer.ts`

- Every applied merge/drop/cluster is recorded: `{ concern, action: merge|drop|cluster, from: [...], into, signal|model, decidedAt, runId }`.
- Before candidate construction, the record is **pre-applied deterministically** (union-find seeded from merges; drops removed from candidates) — the model judges ONLY unstuck candidates (new extractions, undecided pairs). Sticky drops included (they lose no evidence; the topic's claims stay on entity/document pages).
- **Split escape hatch:** a hand-edited `splits: [slug]` list in the same file — a recorded merge/cluster whose `into` or any `from` appears there is un-applied (union-find reversed), the pair returns to candidates, and the reversal is logged. Merges stay one-way by default; splits are the documented manual exception.
- The curation report distinguishes `fromSticky` vs `decidedThisRun` for audit.
- `curation-overrides.json` (human `neverMerge`) is unchanged and still vetoed into keep.

## 3. Technical Approval Gates

All gates LLM-free (fixtures drawn from the REAL observed merge lists).

- **Gate 21.1:** each signal family fires on its fixture pairs (`regionshospitalet-godstrup/-goedstrup`, `lpr`+alias-`LPR` page, `Landspatientregisteret (LPR)` corpus text, `peter-olsen-svenningsen/-svenningsen`, all 5 region name-forms ×3, `indikator-2-ct-skanning`/`ct-skanning`, `echocardiography`/`ekkokardiografi`) and produces zero false positives on colocated-but-distinct controls.
- **Gate 21.2:** auto-apply tier applies ONLY slug-identical-after-transliteration + alias-exact pairs; everything else is proposed, never auto-applied.
- **Gate 21.3:** the confirm-deny path — the prompt carries the proposed pairs; a stubbed confirm applies the merge identically to a model merge (evidence union, aliases, relationship repoints, wikilink rewrites); a stubbed deny leaves both and records the denial.
- **Gate 21.4:** sticky pre-application — run 1 applies merges; run 2's curation input contains NO already-decided pairs (the survivor is pre-merged deterministically); the model is only called with unstuck candidates.
- **Gate 21.5:** sticky drops — a dropped topic never re-enters the candidate set on later runs; its claims stay on entity/document pages.
- **Gate 21.6:** oscillation impossible — after a merge is applied and stuck, a later pass that would not re-propose the pair CANNOT recreate the merged-away page (the extraction data re-aggregates but the sticky record pre-merges it).
- **Gate 21.7:** split escape hatch — a slug in `splits` un-applies its recorded merge (both pages rebuilt on next materialize, reversal logged, pair returns to candidates).
- **Gate 21.8:** neverMerge veto still wins over auto-apply, confirm, and sticky.
- **Gate 21.9:** full key-less suite: Phase 18-20 baseline (375 passed + 14 skipped / 26 files) plus the new phase-21 tests, zero unenumerated regressions; `npx tsc --noEmit` clean.

## 4. User Acceptance Tests (UAT)

- **UAT 21.1 (live re-ingest, one wiki):** curation cost per run drops visibly (fewer candidates proposed to the model); the report shows `fromSticky` vs `decidedThisRun`; no previously-merged identity re-litigates; re-synthesis count from curation variance drops to ~0 on a second consecutive run.
- **UAT 21.2 (live):** a merge from the observed list (e.g. `lpr → landspatientregisteret`) is applied by the deterministic tier WITHOUT any LLM call.

## 5. Approval Checklist

- [ ] All 9 gates pass; `npx tsc --noEmit` clean
- [ ] Auto-apply tier is exactly the two near-zero-risk signals (gate 21.2)
- [ ] neverMerge veto unbroken (gate 21.8); keep-all fallback contract unchanged
- [ ] Split escape hatch documented in the decisions-file contract and wikis/AGENTS.md
- [ ] Compliance log shows no unresolved contradictions; unified regression green
- [ ] Status file updated; DOX pass complete (src/, prompts/, tests/, wikis/ AGENTS.md)

## 6. Integration Notes

**Depends on:** Phase 14 (curation mechanism, validators, keep-all fallback), Phase 16 (decision-list sizing), Phase 19 (hash convergence — sticky pre-merging changes aggregates, so fingerprints flip ONCE per stuck merge, then stabilize).
**Produces:** the sticky-decision record and pair-proposal machinery **Phase 22's cluster decisions build directly on**; cheaper, stable curation.
**Contract:** auto-apply limited to near-zero-risk signals; splits are manual and logged; the keep-all fallback and neverMerge contracts are not weakened.
