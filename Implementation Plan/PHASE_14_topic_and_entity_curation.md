# Phase 14: Topic & Entity Curation (L3 + L3e)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-014`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-23
**Dependencies:** Phases 0-9, 11, 12, 13
**Estimated Time:** 5-7 hours
**LLM Token Budget:** $0 (all gate tests are LLM-free — injected curation stubs; live curation calls only during real ingests at the user's discretion)

**Canon basis (user-ratified 2026-07-23, promoted compliance-log [2026-07-23 23:59]):** `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §4.1 + §5, `Project Vision/04_orchestration_detailed.md` §1 + §3.2 Step 6 (aggregate → curate → apply → write) + §6 (decision-list validation failure class + keep-all fallback) + §9.4 (curation language rule), `Project Vision/05_page_types_specification.md` §7 (topic eligibility) + §6 (entity identity) + §2 (aliases), `Project Vision/07_validation_and_quality.md` §1 + §2.3 + §5. Decision record: `Project Vision/optimizations/optimizations.md` levers L3 and L3e (risks accepted by the user). This phase implements exactly those ratifications — no more, no less.

---

## 1. Objective

Topics are unconstrained Extractor claim `type` values: yesterday's run proved that an unconstrained vocabulary manufactures junk topics (≈27 of 57), each costing a synthesis call and a DOX contract. Entities fork across chunks: one real-world clinic existed as 9 pages over 4 folders. Insert a **curate-then-write** stage into materialization: after aggregation, before any topic/entity page is written, two per-ingest LLM calls (one for topics, one for entities — they may run in parallel) return strict JSON decision lists that deterministic code validates and applies. Merge duplicates, drop non-topics, merge forked entities — with a keep-all fallback that reproduces pre-curation behavior on every failure mode, so this phase can never lose data.

---

## 2. What to Build

### 2.1 The two curation prompts

**Files:** `prompts/curation-topics.prompt.txt`, `prompts/curation-entities.prompt.txt` (new)

- One prompt per concern — the judgment standards differ (topic hygiene vs strict identity). Both carry the Phase 7 `=== LANGUAGE ===\n{languageDirective}\n\n` block near the top (`prompts/AGENTS.md` contract; empty directive removes the whole block byte-identically), both demand strict JSON only (no fences, no commentary), and both are filled with the wiki `AGENTS.md` appended, matching the other agent prompts.
- **Topic prompt** (grounded in vision `05` §7 eligibility): *merge* = the same theme under different wording/plural/form; *drop* = not a theme/concept/issue a journalist would search for — meta-descriptors of the documents' rhetoric (`statistical`, `temporal`, `methodological`, …) are not topics; *keep* = everything else. Output schema:
  ```json
  { "merge": [{ "from": ["slug-a", "slug-b"], "into": "slug-a" }], "drop": ["slug-c"], "keep": ["slug-d"] }
  ```
- **Entity prompt** (strict identity, vision `05` §6): merge ONLY name variants, abbreviations, translations, and word-order permutations of the SAME real-world thing; never sub-units into parents; never colocated-but-distinct things (the room ≠ the clinic; the day unit ≠ the ambulatorium); **merge-only — never drop**. An optional `unsure` bucket is treated as keep (asymmetry: a false merge is far worse than a false keep). Output schema:
  ```json
  { "merge": [{ "from": ["slug-x"], "into": "slug-y" }], "keep": ["slug-z"], "unsure": ["slug-w"] }
  ```

### 2.2 The curation agent

**File:** `src/agents/curation.ts` (new)

- **Input builders.** Topics: for every candidate topic AND every existing on-disk topic — slug, title, folder, claim count, up to 3 sample claims (each truncated to ~200 chars). Entities: for every candidate entity AND every existing on-disk entity — slug, title, type, folder, mention count, significance, disambiguation, plus 1–2 sample mention contexts (truncated): identity judgment needs evidence text, not just names. Including the on-disk sets is what makes update runs re-curate everything (self-healing after a fallback).
- **The calls.** `curateTopics(input, options)` and `curateEntities(input, options)`; `callType: 'curation'` (routes to the new §2.6 slot); `maxTokens: 32768` (the Phase 13 `SYNTHESIS_MAX_TOKENS` constant reused — decision lists for ~300 topics run 5–8K output); `{languageDirective}` filled from the run's language settings; each call logged to `.state/llm-calls.json`. The two calls are independent and may be awaited in parallel (`Promise.all`).
- **Deterministic validation** (both lists, before anything is applied): every slug mentioned exists in the input set; every input slug appears in exactly one bucket (`unsure` folds into `keep` for this accounting); every `into` is itself kept (not dropped, not merged away); no self-merges; merge **chains** (A→B, B→C) are resolved by union-find to their canonical survivor rather than rejected. Violations produce the exact offending entries as feedback.
- **Reask + keep-all fallback** (vision `07` §2.3/§5): validation failures route through the Phase 12 `runWithFeedbackRetry` (≤3 total attempts, exact offending entries fed back). Exhaustion, transient transport exhaustion, and HTTP 4xx all land on the **keep-all fallback**: curation is skipped entirely and the Materializer writes all candidates exactly as it did pre-Phase-14. Decisions are applied **all-or-nothing** — validation runs on the complete list before any application, so a malformed list can never half-merge or wrongly delete anything. Fallbacks are logged (console warning, report entry, metrics counter).
- **Two-round scaling (>~250–300 topics).** Above the threshold, round 1 buckets candidates deterministically by lexical stems of the transliterated slugs (language-agnostic) so likely duplicates share a bucket — one validated call per bucket (parallel-safe); round 2 is a single reconciliation call over all survivors. Each round is independently validated with its own keep-all fallback; every round strictly shrinks the set, so the scheme converges. Entities reuse the same scheme above ~300 entities (accepted residual: translation variants evade lexical bucketing and reconcile only in round 2).

### 2.3 Deterministic application

**Files:** `src/agents/curation.ts` (pure functions), `src/materializer.ts` (integration)

- **Topic merge:** union the `from` topics' claims into the `into` topic (identical claim texts deduped); title kept from `into`. **Topic drop:** the candidate is discarded; its claims remain on their entity and document pages (preservation contract intact — vision `02` §1). Only then are topic pages written.
- **Entity merge:** union mentions, relationships, claims, and timeline into the `into` entity (deduped by their existing content keys); rewrite `subject`/`object` slugs in ALL relationship records; accumulate every variant title into the canonical page's `aliases` (vision `05` §2); canonical folder = the `into` entity's folder (resolves folder drift; the Phase 8 first-folder-wins memory rule applies to the survivor).
- **Wikilink rewrite pass** across ALL content pages (entity, topic, document — not DOX indexes, which regenerate every run): `[[from-slug|Display]]` → `[[into-slug|Display]]`; bare `[[from-slug]]` → `[[into-slug|From Title]]`. Matching is by **exact target segment only** — a plain substring replace would corrupt `[[odense-bup-auditorium|…]]` when rewriting `[[odense]]`. (Reuse/extend `src/utils/wikilinks.ts`; the DOX Writer's pipe-form conventions are the target forms.)

### 2.4 The Materializer seam

**File:** `src/materializer.ts`

The aggregate is already fully built in memory before any page write (verified: aggregation completes before the entity-page write loop). Restructure `materialize()` into: **aggregate** (unchanged) → **curate** (§2.2; skipped transparently when synthesis/LLM is disabled for the run — curation is an LLM stage and follows the same enablement as synthesis; ALSO skipped when there is nothing new to curate and no on-disk set) → **apply** (§2.3, deterministic — runs only on a validated decision list) → **write** (existing page-write path, operating on the curated aggregates). `MaterializeResult` gains a `curation` summary field (applied merges/drops, fallback flag) for reporting. The Phase 8 `removedDuplicates` machinery is the precedent for deterministic page deletion and is reused where possible.

### 2.5 Update-mode rules

- Merging away or dropping an **existing on-disk** topic/entity deletes its page (and now-empty folder chain) deterministically and re-materializes the `into` page, which then re-enters synthesis normally.
- An existing `from` page that was **manually edited** (hash mismatch with `.state/ingestion.json`, vision `07` §3 preservation-first) is **skipped and logged as a conflict**, never auto-merged.
- `.state/extracted/*.json` is immutable per-chunk truth: curation never touches it, so any merge can be undone by re-materializing without it (full reversibility).

### 2.6 The `curation` settings slot

**Files:** `src/llm/client.ts`, `src/tui/settings-screen.tsx`, workspace settings I/O (`.paper-chase.json`)

- `ModelRouting` gains an **additive** `curation: string | null` slot (absent in legacy configs → normalized to null by `setModelRouting`, exactly like the v1.5.0 `apiKeys` addition — legacy behavior byte-identical). `resolveModel` maps `callType === 'curation'` → `routing.curation` → falls through to `default` when null.
- TUI Settings gains a `modelCuration` row (SettingRow union, ROW_ORDER after `modelDox`, cycleModel catalog handling) with provider defaults `claude-sonnet-5` / `gpt-5.6-terra` (mid-tier — ratified) and a recommendation label: `Sonnet — mid-tier judgment for merge/drop decisions` / `GPT-5.6 Terra — mid-tier judgment for merge/drop decisions`. Switching providers resets all five slots to that provider's defaults.

### 2.7 Observability

- `.state/curation-report.json` (per run): applied merges (from → into, both concerns), drops, manual-edit skips, fallback events with cause, attempt counts.
- `.state/curation-overrides.json` (human-editable, never written by the tool except created-empty): `{ "neverMerge": [["slug-a", "slug-b"]] }` — honored by the checker on subsequent runs (a listed pair is forced into keep even if the LLM says merge; the pair is validated like any other entry).
- Fallback observability matches the other deterministic fallbacks: console warning, report entry, additive metrics counter (`curationFallbacks`).
- Rolling memory updates AFTER curation (vision `04` Step 6 item 5), so it reflects the curated set.

---

## 3. Technical Approval Gates

All gates are LLM-free (injected curation stubs, fixture extraction sets, temp wikis).

### Gate 14.1: Decision-list validation rule classes

Each violation class is rejected with the exact offending entries as feedback: unknown slug; slug in two buckets; input slug missing from every bucket; `into` dropped or merged-away; self-merge. Valid lists pass.

### Gate 14.2: Union-find chain resolution

A→B, B→C collapses deterministically to a single merge into the canonical survivor (which must be kept); no reask loop on legitimate chains.

### Gate 14.3: Reask then keep-all fallback

Attempt 1 invalid → attempt 2 prompt contains the offending entries → valid → applied. All-attempts-invalid → keep-all: every candidate written as pre-Phase-14, nothing merged, nothing deleted, warning + report entry + metrics counter. HTTP 4xx → immediate fallback, zero retries. Transient exhaustion → fallback after the bounded transport retries.

### Gate 14.4: All-or-nothing application

A list that is 90% valid but fails validation applies NOTHING (no merges, no deletions) — the wiki is byte-identical to the keep-all outcome.

### Gate 14.5: Topic merge/drop application

Merge unions claims (deduped by text), title from `into`; dropped candidates are never written; every dropped topic's claims still appear on their entity/document pages (corpus-level preservation check passes).

### Gate 14.6: Entity merge application

Fixture: the Odense-clinic pattern (3 slug variants, mentions spread across them, cross-relationships). Result: one page at the `into` folder; mentions/claims/timeline unioned and deduped; relationship subject/object slugs repointed; all variant titles in `aliases`; no page left at the old folders.

### Gate 14.7: Exact-segment wikilink rewrite

`[[from|Display]]` → `[[into|Display]]`; bare `[[from]]` → `[[into|From Title]]`; prefix-collision safety — rewriting `[[odense]]` leaves `[[odense-bup-auditorium|X]]` and `[[odense-2]]` untouched; links inside document pages are rewritten; citation markers and frontmatter untouched.

### Gate 14.8: Manual-edit skip

A `from` page with a hash mismatch is skipped, logged to conflicts, never merged; its pair is treated as keep for the rest of the application.

### Gate 14.9: Update-mode deletions + re-materialization

An on-disk topic merged away/dropped: page + empty folder chain deleted deterministically; `into` page re-materialized and re-enters synthesis; on-disk entities same. Empty-folder behavior matches the Phase 8 precedent (DOX regenerates contracts).

### Gate 14.10: The `curation` slot

`resolveModel('curation')` → curation entry → default chain; legacy config without the field behaves byte-identically; TUI row exists with mid-tier defaults on both providers; provider switch resets five slots; `setModelRouting` normalizes absent `curation` to null.

### Gate 14.11: Overrides honored

`.state/curation-overrides.json` `neverMerge` pair → forced keep even when the stub LLM merges them; malformed overrides file → ignored with a warning (never crashes the run).

### Gate 14.12: Two-round scaling

>~300 synthetic topics → deterministic lexical-stem bucketing, one stubbed call per bucket, reconciliation round over survivors; per-round keep-all fallback leaves earlier rounds' results intact; final set strictly ≤ input set.

### Gate 14.13: Language + prompt contracts

Both prompts carry the `{languageDirective}` block (removed byte-identically when empty, Phase 7 gate-7.2b pattern); curation input includes on-disk topics/entities (self-healing property); `.state/extracted/*.json` untouched (reversibility); rolling memory written after curation and reflecting it.

### Gate 14.14: Full-suite regression

`npx tsc --noEmit` clean; key-less `npm test` green; Phase 3/8 materializer gates updated only where the aggregate→curate→apply→write restructure requires it (curation stubbed off → pre-Phase-14 behavior byte-identical — the default-off path is the regression guard).

---

## 4. User Acceptance Tests (UAT)

### UAT 14.1: Dry inspection on a small wiki

1. Ingest a small wiki (golden-master) with synthesis on.
2. Expected: `.state/curation-report.json` exists (possibly zero merges — clean set); ingest completes; topic/entity trees unchanged when the set is already clean; no warnings on a healthy run.

### UAT 14.2: Fallback drill (dry)

1. Temporarily point the `curation` slot at a nonsense model name via Settings, ingest.
2. Expected: HTTP 4xx → immediate keep-all fallback, warning line, run completes exactly as pre-Phase-14; `curationFallbacks` counter incremented. Restore the slot afterwards.

### UAT 14.3: The adhd-wiki effect (deferred to the package UAT)

The real proof — junk topics gone, the Odense clinic merged to one rich page with 8 aliases, links resolving — is measured once by the post-Phase-15 package UAT re-ingest. Running it here too would pay the full ingest cost twice for no extra signal.

---

## 5. Approval Checklist

- [ ] All 14 technical gates pass (`npm test` green; full suite unregressed with curation stubbed off).
- [ ] All UAT steps pass (14.2 may be demonstrated by gate evidence).
- [ ] Merge-only for entities; strict-identity prompt with evidence samples; `unsure` → keep.
- [ ] Decision lists validated before application; all-or-nothing; union-find chains; reask ≤3 with exact offending entries; keep-all fallback on every failure class (validation exhaustion, transient exhaustion, HTTP 4xx).
- [ ] Exact-segment link rewrite proven against prefix collisions.
- [ ] Manual-edit pages never auto-merged; `.state/extracted/` immutable; report + overrides files behave as specified.
- [ ] `curation` slot additive with mid-tier defaults; legacy configs byte-identical.
- [ ] Both prompts carry `{languageDirective}`; rolling memory updated post-curation.
- [ ] Compliance log shows no unresolved contradictions.
- [ ] No new LLM calls in implementation testing; budget $0.

---

## 6. Integration Notes

### What Phase 14 Depends On
- Phase 12 `runWithFeedbackRetry` (decision-list reask) and the four-class retry policy.
- Phase 13's `SYNTHESIS_MAX_TOKENS` constant (reused for the curation calls) and prompt conventions.
- Phase 8 update-mode machinery (`removedDuplicates`, hash-mismatch conflict detection, first-folder-wins memory) — the deletion/skip precedents this phase extends.

### What Phase 14 Produces
- `src/agents/curation.ts`, two curation prompts, the Materializer aggregate→curate→apply→write restructure, exact-segment wikilink rewriting, the `curation` routing slot, curation report/overrides state files.

### Contract with Final Acceptance
- Curation OFF (LLM disabled / legacy config / any fallback) must be byte-identical to pre-Phase-14 behavior — the golden-master suites are the guard.
- The vision's accepted residual risks stand (R2 no un-merge UX beyond overrides + re-materialization; R3 translation variants in bucketed mode; R4 run-to-run merge variance; R6 sub-unit traps) — mitigated as specified, not eliminated.
- DOX pass required on completion: `prompts/AGENTS.md` (two new prompt entries + `{languageDirective}` set grows to eight), `src/AGENTS.md` (curation.ts contract, materializer seam, client slot), `tests/AGENTS.md` (phase-14 entry), root AGENTS.md (phase index), `wikis/AGENTS.md` if runtime state files are documented there, README (curation stage + settings row).
