# Phase 25: Generic-Label Disambiguation (Option E, Variant B)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-025`
**Version:** 1.0.0
**Status:** Planned (canonized 2026-08-26 — not yet implemented)
**Date:** 2026-08-26
**Dependencies:** Phases 0-9, 11-24 (the Phase 21/22 sticky-decision and composite machinery is required; Phase 26 builds on this phase)
**Estimated Time:** 6-9 hours
**LLM Token Budget:** $6.00 hard cap, pause at 80% = $4.80 (tripled 2026-08-27 from the initial $2.00 by user directive) — **glm-5.3-flash ONLY** for every live call (user directive 2026-08-27); expected actual spend well under $0.50. All gates except the designated live gate 25.9 stay LLM-free (injected stubs); the live gate self-skips without `ZAI_API_KEY`, so the key-less suite profile is unchanged.

**Canon basis:** `Project Vision/02_WIKI_concept_detailed.md` §4.6 (class-6 composite amendment, added 2026-08-26, user-ratified), `05_page_types_specification.md` §6 (class 6 + the `disambiguate` mechanism) and §7 (the same-label-different-meaning topic rule), `04_orchestration_detailed.md` §3.2 Step 6b (the disambiguation pass). Backlog **B23** (user-directed 2026-08-26). Evidence (verified, live corpus): `Indikator 2` in DPD_2025.pdf = "first specialised-palliative treatment contact within 10 days" (p. 11/14) while in HOFTER_2025.pdf = "surgery within 24 hours of arrival" (p. 9/14) — the same generic label, two registries, two unrelated clinical meanings; under the current architecture both collapse onto one slug (`src/materializer.ts` keys aggregates by slug alone) and the conflated page PASSES the preservation check (a silent semantic error). User decisions 2026-08-26 (AskUserQuestion round): Option E Variant B — composite-style disambiguation page at the generic slug, not child pages.

---

## 1. Objective

A generic label that different sources use for **different real things** must never be conflated into one homogeneous page. Detect such labels deterministically, let an LLM judge the heterogeneity with per-source evidence, and render a confirmed split as ONE class-6 composite page at the generic slug — members are the per-meaning identities, evidence grouped per member. The mechanism is general (any generic-pattern slug from any corpus), never tailored to indicators or to RKKP: the label pattern is a shape (`indikator-N`/`table-N`/`section-N`/…), and the collision test is per-source evidence divergence, not a hard-coded term list.

Design invariants (user-ratified):
- **Deterministic code proposes; the LLM confirms or denies** (the Phase 21/22 pattern — no silent LLM identity power, no deterministic semantic guessing).
- **Heterogeneity-gated**: a generic label that means the same thing across sources (one register's indicator across report years) stays one ordinary page. The pattern alone never fires.
- **One page, not child pages** (Variant B over Variant A): reuse the Phase 22 composite rendering; member pages are never written; every pre-existing wikilink to the generic slug still resolves because the composite lives at that slug.
- **Sticky**: a confirmed split is recorded and pre-applied on every later run — the judgment is paid for once; `splits` dissolves it by hand.

## 2. What to Build

### 2.1 Deterministic detector (generic pattern + per-source heterogeneity)

**Files:** `src/agents/pre-merge.ts` (generalize `isIndicatorSlug` → `isGenericLabelSlug`, exported), `src/materializer.ts` (new detection pass between aggregation and curation-candidate construction — vision `04` Step 6b)

- Generic-label shape: `^(?:indikator|indicator|table|tabel|section|afsnit|appendix|appendiks|figure|figur)-\d+(?:-.+)?$` (the shape families; slug-language-agnostic by pattern, not term list — extend the regex alternation, never a corpus term list).
- Heterogeneity signal: the slug carries evidence (entity mentions/significance, or topic claims) from ≥2 distinct source files, and the substantive-token overlap between the per-source sample sets is below a threshold — tokens computed after lowercasing, stopword removal (a small checked-in da/en stopword list), and exclusion of the label's own tokens and bare numbers. Both conditions required.
- Output: a **proposed disambiguation** per flagged slug (slug, title, per-source samples), mirroring `ProposedPair`/`ProposedCluster` shapes.

### 2.2 The disambiguation judgment call

**Files:** NEW `prompts/disambiguation.prompt.txt`, NEW `src/agents/disambiguation.ts`

- One lightweight LLM call per flagged slug (not per pair — the call judges ONE label's whole evidence). Input: slug, title, and the sample claims/significance grouped by source file (2-3 samples per source, truncated). Carries the Phase 7 `{languageDirective}`.
- Output (strict JSON, code-fence-stripped, schema-validated): `{ "split": false }` OR `{ "split": true, "reason": "few words", "members": [{ "slug": "…", "title": "…", "sources": ["file.pdf"] }] }` — member slugs are meaning-derived (`indikator-2-first-treatment-contact`) or register-derived (`dpd-indicator-2`), never a bare renumbering; every evidence source file maps to exactly one member; ≥2 members.
- Routing: `callType: 'disambiguate'`, resolved through the existing `curation` slot (fallback Default) — NO new Settings row.
- Failure posture (the curation house rules): invalid output → reask ≤3 with the validator's exact errors; exhaustion/transport/4xx → the keep-one-page fallback (the label stays one ordinary page, logged; self-healing next run).

### 2.3 Application + the sticky `disambiguate` record

**Files:** `src/materializer.ts`, `src/state/curation-decisions.ts`, `src/agents/curation.ts` (validator extension)

- New action `'disambiguate'` in `CurationDecisionAction`; record shape: `{ concern, action: 'disambiguate', from: [member slugs], into: <generic slug>, signal: 'generic-heterogeneity' | 'model', sourceMap: { "<source-file>": "<member-slug>" }, decidedAt, runId }`. The additive `sourceMap` is what makes later runs deterministic: evidence from a known source routes to that member with NO new judgment; a NEW source file whose evidence diverges from its mapped member re-enters the judgment for that member only.
- Validation (deterministic, all-or-nothing per label): every `from` slug non-empty and unique; `into` is the flagged slug; `sourceMap` covers every source file that fed the proposal and nothing else; member count 2-4 (cap shared with Phase 22); no member slug collides with an existing non-member slug.
- Pre-application: on every materialize, active `disambiguate` records apply before curation candidates are built (the Phase 21 sticky tier) — the flagged label never re-pays the judgment.
- `splits` escape hatch: a listed slug dissolves the disambiguation exactly as it dissolves a cluster (member pages rebuilt, composite removed, reversal logged).

### 2.4 Class-6 composite rendering (entities AND topics)

**Files:** `src/pages/composite-page.ts` (class-6 support; generalize the topic-composite shape), `src/materializer.ts`, `src/validation/schema-validator.ts`

- Entity labels: the existing `CompositePageData`/`writeCompositePage` path with `class: 6` and per-member evidence groups.
- Topic labels: a topic composite at `topics/<slug>/<slug>.md` with the same members block, per-member claim groups under `### <Member Title>` subheadings, and the standard topic frontmatter re-imposition. This is the single sanctioned exception to "topics never cluster" (`05` §7 amendment) — validator: class 1-5 clusters on topics remain errors; class 6 is legal on both concerns.
- The composite lives at the GENERIC slug: pre-existing wikilinks keep resolving; member titles join the `aliases` union; per-member evidence keeps its verbatim preservation guarantee (the unioned citation map covers it unchanged).

## 3. LLM Call Inventory (glm-5.3-flash only — user directive 2026-08-27)

Every live LLM touchpoint in this phase, what fires it, and its estimated spend at glm-5.3-flash pricing ($0.15/MTok in, $0.50/MTok out). **Model pinning:** the UAT workspace's `.paper-chase.json` sets ALL routing slots (default, extractor, synthesis, dox, curation, and the rest) to `{ provider: 'zhipu', model: 'glm-5.3-flash' }` — the run config itself makes it impossible for any call in these tests to reach another model.

**The one NEW call type:**

| # | Call type | Fires when | Input → output (est.) | Live touches in this phase |
|---|---|---|---|---|
| 1 | `disambiguate` (routed via the `curation` slot) | once per flagged generic-label slug per materialize; steady state ZERO (sticky records pre-apply) | ~1-2k in (slug, title, 2-3 samples per source) → ~0.2-0.5k out (split/no-split JSON) | gate 25.9 (1 call ×2 — Implementer + Verifier), UAT 25.1 (1-2 calls), UAT 25.2 (0-1 calls) |

**Existing call types fired BY the live gate/UAT runs (spend belongs to this phase's budget):**

| # | Call type | Fires when | Est. per call | Live touches |
|---|---|---|---|---|
| 2 | `extractor` | one per chunk | ~8-15k in → 3-8k out | gate 25.9 fixture (none — gate 25.9 feeds evidence directly, no extraction); UAT 25.1/25.2: one call per chunk of each fixture (trimmed fixtures: 1-2 chunks each → 2-4 calls per UAT) |
| 3 | `topic-curation` + `entity-curation` | two per PDF (per-PDF cadence is Phase 26; in THIS phase they fire per materialize as today) | ~2-4k in → 0.3-1k out each | 2 calls per UAT ingest |
| 4 | `synthesis` (strict) | per new/changed page | ~2-5k in → 1-3k out | UAT 25.1/25.2: ~5-10 pages each |
| 5 | DOX writer + workspace pass | once per folder + root, end of each UAT ingest | ~2-3k in → ~1k out | ~5-8 calls per UAT ingest |

**Estimated spend:** gate 25.9 ≈ $0.002; each live UAT ingest ≈ $0.05-0.25 depending on fixture size; Verifier re-runs double the gate cost only (UATs run once). **Expected total: well under $0.50; hard cap $6.00** (tripled 2026-08-27 from $2.00 by user directive — headroom for bigger fixtures and extra judgment re-runs). **Verified live 2026-08-27** (probe against the dist-stored zhipu key): auth 200, model accepts, clean temperature-0 JSON. Note glm-5.3-flash is a REASONING model — hidden reasoning tokens are billed as output and precede any content (probe: 48 of 55 completion tokens were reasoning), so per-call output estimates above are content-only and real output billing runs ~2-3×; ceilings must always leave reasoning headroom, and a content-empty + `finish_reason: length` response means the cap was too small, not that the model failed. Rate limits: glm-5.3-flash is the paid flash tier (normal concurrency; the synthesis pool cap 4 is safe); if Zhipu throttles anyway, the existing 429/5xx stall ladder rides it out — no test retries beyond it.

## 4. Technical Approval Gates

All gates LLM-free (injected `disambiguateFn` stubs, fake extraction JSON fixtures).

- **Gate 25.1 (detector):** a fixture with `indikator-2` evidence from two sources with disjoint substantive tokens IS flagged; the same slug from ONE source is NOT; two sources with high token overlap (same meaning restated) is NOT; a non-generic slug (`rigshospitalet`) with disjoint multi-source evidence is NOT; `table-3` shape IS recognized by the pattern.
- **Gate 25.2 (judgment + validation):** the prompt carries the per-source evidence, the language directive, and the member rules; schema accepts a well-formed split and a no-split; rejects a 1-member split, a member without sources, a source mapped to two members, and a bare-renumber member slug (`indikator-3`); each rejection names the offending member in the reask block.
- **Gate 25.3 (application):** a confirmed split writes ONE class-6 composite at the generic slug with per-member evidence groups; the sticky record (incl. `sourceMap`) is written; a SECOND materialize with the same data makes ZERO judgment calls (pre-applied) and reproduces the composite byte-identically.
- **Gate 25.4 (topic composite):** a class-6 topic composite renders with members block + per-member claim groups + complete topic frontmatter; a class-3 cluster proposal on a TOPIC is still a validation error (the exception is class 6 only).
- **Gate 25.5 (preservation + links):** every per-member verbatim evidence item appears in the composite; the unioned citation map defines every marker; wikilinks targeting the generic slug resolve to the composite; member pages do not exist on disk.
- **Gate 25.6 (new source, new meaning):** a third fixture source with a NEW meaning under an already-split label re-enters the judgment scoped to the mapping of THAT source; existing members and their evidence are untouched; the record's `sourceMap` grows.
- **Gate 25.7 (escape hatch):** listing the generic slug in `splits` dissolves the composite at the next materialize (ordinary page rebuilt from the aggregate, reversal logged in the curation report).
- **Gate 25.8 (suite):** full key-less suite green (`npx tsc --noEmit` clean) with the new phase-25 tests and zero unenumerated regressions.
- **Gate 25.9 (LIVE, glm-5.3-flash only):** the real `disambiguate()` agent — no stub — receives the DPD/HOFTER `indikator-2` fixture evidence (two sources, divergent definitions) with the curation slot pinned to `zhipu/glm-5.3-flash`, and the response must be schema-valid JSON (a `split: true` with ≥2 well-formed members, or `split: false` — both are valid JUDGMENTS, the gate proves the model produces parseable, rule-conformant output, not which verdict it picks); the call is logged to `llm-calls.json` with provider `zhipu`, model `glm-5.3-flash`, callType `disambiguate`; a second invocation with the same-register control evidence must also return schema-valid JSON. Self-skips without `ZAI_API_KEY` (the key-less profile is unchanged). Est. cost: 2 calls ≈ $0.002.

## 5. User Acceptance Tests (UAT)

All UAT runs use a dedicated UAT workspace whose `.paper-chase.json` pins EVERY routing slot to `{ provider: 'zhipu', model: 'glm-5.3-flash' }` (the §3 pinning rule — no call can leak to another model); the Reporter presents the cost line from `.state/llm-calls.json` with each result.

- **UAT 25.1 (live, two-report fixture):** ingest one small PDF from each of two different registries (e.g. the DPD and HOFTER indicator-overview chapters as trimmed fixtures) into a fresh wiki; `indikator-2` becomes ONE composite page whose two member sections each carry only their own registry's verbatim indicator definition and results; the aliases union finds the page from either member title. (Est. spend $0.05-0.25.)
- **UAT 25.2 (live, same-register control):** ingest two report YEARS of the SAME registry; `indikator-2` stays one ordinary topic/entity page (no split) — proving the heterogeneity gate. (Est. spend $0.05-0.25.)
- **UAT 25.3 (reading check, human):** open the composite in Obsidian: the lead names both meanings, each member section is self-contained, and every citation resolves to the correct report.

## 6. Approval Checklist

- [ ] All 9 gates pass; `npx tsc --noEmit` clean (gate 25.9 green with `ZAI_API_KEY`, self-skipped key-less)
- [ ] Detection is shape- and heterogeneity-driven (gate 25.1's controls; no corpus term lists)
- [ ] Sticky pre-application proven (gate 25.3's zero-call second run); `splits` dissolves (gate 25.7)
- [ ] Vision `02` §4.6 / `05` §6-§7 / `04` §3.2 Step 6b amendments remain the source of truth (no divergence)
- [ ] Compliance log entry filed; status file created; DOX pass complete (root + `Implementation Plan/` + `src/` + `tests/` + `prompts/` indexes)

## 7. Integration Notes

**Depends on:** Phase 21 (sticky decisions), Phase 22 (composite rendering, class validation), Phase 14 (curation house rules), Phase 7 (`{languageDirective}`).
**Produces:** the `disambiguate` sticky action; class-6 composites (entities and topics); the `isGenericLabelSlug` surface; `prompts/disambiguation.prompt.txt` (a new extracted asset — asset-version bump required when implemented).
**Contract for Phase 26:** patch amendments target member sections of class-6 composites via the `sourceMap` (new evidence from a known source lands in that source's member), and a new-meaning source expands the composite through this phase's judgment before any patch op may add a member.
