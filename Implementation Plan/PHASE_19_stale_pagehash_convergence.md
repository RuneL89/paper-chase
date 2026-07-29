# Phase 19: Stale-Hash Convergence (Manual-Edit Guard False-Flags)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-019`
**Version:** 1.0.0
**Status:** Complete — user-accepted 2026-07-29
**Date:** 2026-07-29
**Dependencies:** Phases 0-9, 11-17
**Estimated Time:** 2-4 hours (includes root-cause investigation)
**LLM Token Budget:** $0 (all gate tests are LLM-free)

**Canon basis:** `Project Vision/07_validation_and_quality.md` §3 (preservation-first materialization: manual-edit detection, merge-don't-replace, conflict logging); `04_orchestration_detailed.md` §3.2 Step 6 (update mode) + Step 11 (checkpointing). Backlog **B19**. Evidence: 2026-07-28 afdk re-ingest — 8 topic pages (3 template + 5 strict) conflict-skipped with disk-hash ≠ recorded hash although every byte on disk was tool-written; repaired by hand (keys deleted); akdb showed 0 — the leak is stage/content-specific. Normally masked by the Phase 16 skip-eligibility/preservedPages convergence; exposed when `synthesis-state.json` is absent. Compliance pre-check: compliance-log [2026-07-29 09:10].

---

## 1. Objective

The manual-edit guard exists to protect human edits (`07` §3), but today it can be fooled by the tool's own bookkeeping: some stage writes (or rewrites) a content page without folding the final hash into `.state/ingestion.json` `pageHashes`, so a later run treats the tool's own page as human-edited and refuses to ever update it — self-perpetuating. Find the leak, fix it, prove the invariant, and give the guard a safe convergence path for provably-tool-written pages.

## 2. What to Build

### 2.1 Root-cause reproduction (investigation first)

**Files:** `tests/phase-19.test.ts` (the reproduction lives here), read-only analysis of `src/materializer.ts`, `src/commands/ingest.ts`, `src/state/ingestion-state.ts`

- Trace every write of a topic/entity page and every `pageHashes` fold point (materialize writtenPages → workingPageHashes; curation rewrittenLinks; preservedPages convergence; per-PDF checkpoint; end-of-run re-hash from disk at `ingest.ts:1420-1430`).
- Write the fixture that reproduces the afdk symptom: a synthesized topic page whose recorded hash after a completed ingest ≠ its disk content. The reproduction must fail (or fail its assertion) against the pre-fix code — it is the proof the leak was found. If the first hypothesized stage doesn't reproduce, iterate candidates until it does; record the found stage in the status file.

### 2.2 Fix the leaking stage

**Files:** whichever stage §2.1 convicts (expected within `src/commands/ingest.ts` hash bookkeeping or `src/materializer.ts`; `src/state/ingestion-state.ts` as needed)

- Make that stage fold the final content hash exactly like the end-of-run re-hash does. No behavior change beyond hash convergence.

### 2.3 Safe convergence for provably-tool-written pages (design decision, recorded)

**Files:** `src/materializer.ts` (`checkPageConflict` path)

- When the guard detects disk ≠ recorded, before declaring a manual-edit conflict, deterministically render the page from the CURRENT aggregate (`writeEntityPage`/`writeTopicPage`). If the on-disk content equals that render OR equals the aggregate's render under the immediately-previous code shape is NOT required — the rule is: if disk == deterministic render of the current aggregate, the page is provably tool-written → converge (record the disk hash, proceed with the update, log a convergence note, not a conflict). Anything else → conflict exactly as today (human-edit protection NOT weakened).

### 2.4 Hash-consistency invariant

**Files:** `tests/phase-19.test.ts`

- After any fixture ingest: for every content page on disk that the tool wrote this run, `pageHashes[path] == sha256(disk content)`. This invariant is the regression net for future leaks.

## 3. Technical Approval Gates

All gates LLM-free.

- **Gate 19.1:** the §2.1 reproduction fails against the pre-fix code and names the leaking stage (asserted in-test).
- **Gate 19.2:** with the fix, the reproduction passes: the completed ingest leaves recorded == disk for every page it wrote.
- **Gate 19.3:** safe convergence: a fixture page whose disk content equals the current deterministic render but whose recorded hash is stale converges WITHOUT a conflict entry and IS updated; a fixture page with a true human edit (content matching no render) still conflicts.
- **Gate 19.4:** the invariant of §2.4 holds across a two-PDF fixture ingest with curation active.
- **Gate 19.5:** full key-less suite: Phase 17/18 baselines plus the new phase-19 tests, zero unenumerated regressions; `npx tsc --noEmit` clean.

## 4. User Acceptance Tests (UAT)

- **UAT 19.1 (next live ingest, observational):** zero "Skipping update of … (manually edited)" lines for pages that were never hand-edited; any convergence notes are logged, not conflicts.
- **UAT 19.2 (observational, $0):** the afdk wiki (hand-repaired 2026-07-28) shows no new false-flags on its next ingest.

## 5. Approval Checklist

- [ ] Leaking stage identified in the status file (not just hypothesized)
- [ ] All 5 gates pass; `npx tsc --noEmit` clean
- [ ] Human-edit conflicts still fire for true human edits (gate 19.3 second leg)
- [ ] Compliance log shows no unresolved contradictions
- [ ] Status file updated; unified verification (with Phases 18/20) passed

## 6. Integration Notes

**Depends on:** Phase 8 (update mode + guard), Phase 14 (curation link rewrites), Phase 16 (checkpointing, resume convergence).
**Produces:** the leaking stage's hash folding; the safe-convergence rule; the hash-consistency invariant test.
**Contract:** human-edit protection is never weakened; convergence requires disk == current deterministic render; every convergence is logged.
