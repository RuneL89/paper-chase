# Phase 16: Run Resilience

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-016`
**Version:** 1.0.2
**Status:** Draft
**Date:** 2026-08-20
**Dependencies:** Phases 0-9, 11-15
**Estimated Time:** 5-8 hours
**LLM Token Budget:** $0 (all gate tests are LLM-free — injected stubs, mocked transport; live resilience verification only during real ingests at the user's discretion)

**Canon basis (user-ratified 2026-07-25, promoted compliance-log [2026-07-25 09:20]):** `Project Vision/04_orchestration_detailed.md` §6 (per-page transport fallback + outage detector), Step 9 (synthesis resume), Step 11 (per-PDF checkpointing), Step 6 (decision-list sizing), §1 (pool transport tuning); `Project Vision/07_validation_and_quality.md` §5 + §2.3. Evidence: the 2026-07-24 live test — run 4 aborted at 54/175 on one headers-timeout after ~$16 of work; the entity curation decision list overflowed 32768 output at ~200 candidates (keep-all fallback fired). **Amended 2026-08-20 (user directive, compliance-log [2026-08-20 …]):** the reactive 429 stall — evidence: a Zhipu GLM-4.7-Flash free-tier 429 aborted an extraction on chunk 2/42; the free tier's throttle window outlasted the 3-attempt / ~20s retry budget, so quick retries exhausted inside the window. The stall waits the window out instead (6 attempts, ~31 min), and a v1.1.0 draft that instead SKIPPED throttled chunks was rolled back the same day as a data-preservation violation — the 429 rule never loses a chunk. This phase implements exactly those ratifications — no more, no less.

---

## 1. Objective

A single network hiccup must never again force a run to restart from zero. Three independent weaknesses made the 2026-07-24 run-4 abort expensive: (a) one page's transport failure killed the whole run, (b) nothing was hash-recorded until run end, (c) already-paid pages had no completion memory and would have been re-bought on resume. Fix all three — per-page transport fallback with an outage detector, per-PDF checkpointing, and content-addressed synthesis resume — plus the two organic findings: calmer pool transport, and curation decision lists that can no longer overflow the output ceiling. The 2026-08-20 amendment adds the reactive 429 stall: a throttled provider's rate limit must slow the run down, never lose data and never abort cheaply — stall, wait the window out, and complete.

---

## 2. What to Build

### 2.1 Per-page transport fallback + outage detector (vision `04` §6)

**Files:** `src/commands/ingest.ts` (the two pool loops + `trySynthesisMode`), `src/state/metrics.ts`

- When a synthesis pool task throws a **transient transport error after the bounded retries are exhausted** (429/5xx/network/timeout — the client's existing classification), the error is caught for THAT page: the page lands on the deterministic structured template (identical to the quality-exhaustion fallback), a loud warning is emitted (`Transport failure for <slug> after retries — template fallback.`), the report entry records the new `finalMode: 'transport-fallback'`, and the additive `metrics.transportFailures` counter increments.
- **HTTP 4xx NEVER falls back** — it still throws immediately and aborts the run (deterministic failure class; a config problem must not silently template a wiki).
- **Outage detector:** per stage, track transport-failed pages. Abort the run with the transport error (fail loud) when EITHER (a) **5 consecutive** transport-failed pages occur with no successful call in between, OR (b) transport-failed pages exceed **10% of the stage's total pages**. Below both thresholds the run completes with template fallbacks and a summary warning.
- Extractor behavior unchanged (thrown errors abort); DOX/workspace/updater catch-once behavior unchanged.

### 2.2 Synthesis resume (vision `04` Step 9)

**Files:** `src/state/synthesis-state.ts` (new), `src/materializer.ts`, `src/commands/ingest.ts`

- New state file `.state/synthesis-state.json`:
  ```json
  { "pages": { "entities/people/john-smith.md": { "mode": "strict-synthesis", "dataHash": "sha256…", "synthesizedAt": "ISO" } } }
  ```
  Written per page as it completes (appended through the Phase 15 serialized-write queue). `dataHash` = SHA-256 over the page's canonical aggregate input (the entity/topic structured data + title + folder + the run's language pair), computed by one exported helper (`pageDataHash(pageData, language)`).
- **Skip rule (synthesis stage):** a page with a `strict-synthesis` or `permissive-synthesis` record whose `dataHash` matches the current aggregate is SKIPPED — no LLM call, and it is counted in the stage summary as skipped. Template-fallback pages (recorded with `mode: 'template-fallback'` or unrecorded) are NOT skipped — they are retried.
- **Materialize preservation:** the Materializer must NOT rewrite a skip-eligible page (same rule, same fingerprint check before overwriting) — the finished page is preserved byte-for-byte. Any aggregate change (new evidence, a curation merge) changes the fingerprint → normal rewrite + re-synthesis.
- Pages are keyed by wiki-relative path; stale entries for pages that no longer exist are pruned at write time.

### 2.3 Per-PDF checkpointing (vision `04` Step 11)

**File:** `src/commands/ingest.ts`, `src/state/ingestion-state.ts`

- As soon as a PDF's own processing completes (its chunks extracted and the per-PDF materialize done), its ingestion record (hash, language, timestamps — the same shape the end-of-run write produces) is persisted to `.state/ingestion.json`. A subsequent abort leaves completed PDFs recorded → resume skips their extraction (Phase 8 hash-skip works as designed).
- The end-of-run write stays the final complete record; checkpoint writes are additive and must produce exactly what a completed run would have written for that PDF.

### 2.4 Pool transport tuning (vision `04` §1)

**Files:** `src/llm/client.ts`, `src/utils/worker-pool.ts`

- Header timeout for large-output calls: calls with `maxTokens >= 32768` get a generous headers timeout (600s); smaller calls keep the current default.
- Staggered dispatch: workers pick up items with a small deterministic jitter (~250ms between pickups) so a stage never fires 4 large requests at the same instant.
- Backoff between transport retries becomes exponential (e.g., 5s → 15s → 45s) instead of linear — identical attempt counts and error classes, only the wait changes.

### 2.5 Curation decision-list sizing (vision `04` Step 6, `07` §2.3)

**Files:** `prompts/curation-topics.prompt.txt`, `prompts/curation-entities.prompt.txt`, `src/agents/curation.ts`

- **Schema slimming:** the `keep` bucket is REMOVED from the output schema in both prompts — kept candidates are the deterministic complement (input minus `merge` sources, `drop`, `unsure`), computed by code. Validation still enforces "every candidate accounted for exactly once" via the derived keep. Per-decision justifications in the output are capped by the prompt (short or omitted).
- **Size-based bucketing trigger:** before the call, estimate the decision-list output size from the candidate set; when the estimate approaches the ceiling (a conservative fraction of 32768), the lexical-stem bucketing + reconciliation scheme runs even below the old 250-candidate threshold. The candidate-count trigger stays as a second condition.
- Backwards tolerance: if the model still emits a `keep` list, validation accepts it (checked for consistency) but never requires it.

### 2.6 Reactive 429 stall (2026-08-20 user directive)

**Files:** `src/llm/client.ts`, `src/commands/ingest.ts`, `src/tui/ingest-screen.tsx` (no screen change — progress plumbing only)

- **Extended budget for 429 only:** when a caller that opted into retries (`maxRetries > 0`) receives an HTTP 429, that call gets `RATE_LIMIT_MAX_ATTEMPTS = 6` total attempts instead of the caller's 3 (a 2026-08-20 user-ratified amendment to the 2026-07-20 ≤3-attempt bounded-retry rule, scoped to 429; every other transient class keeps the caller's bound). The ceiling is recomputed per attempt, so a 5xx after a 429 reverts to the caller's bound. `maxRetries: 0` keeps the frozen no-retry default — a 429 throws on the first attempt, byte-identical to before.
- **Escalating stall floor:** the wait between 429 retries is `max(exponential backoff, Retry-After header, 60s × 2^(retry-1))` — 60s, 120s, 240s, 480s, 960s, ~31 minutes of waiting in total. The old backoff exhausted its budget inside ~20 seconds, well within a free-tier throttle window; the floor waits the window out. All providers' 429s stall — 429 means "slow down" everywhere.
- **Cheap completion over speed:** the goal on a throttled free model (e.g. Zhipu GLM-4.7-Flash) is that the run completes, not that it is fast — no chunk is ever skipped, no data is lost, and only exhausted stalls (6 real 429s) abort with the fail-loud attempt-count error.
- **Stall feedback:** `setRateLimitWaitReporter` (module-level, the `setModelRouting`/`setTransportRetrySleeper` precedent) hands each stall `{ waitSeconds, attempt, maxAttempts }` to a reporter; `ingest` wires it to the run's `onProgress` channel (`Rate limited by provider (HTTP 429) — waiting Ns before retry (attempt X/6)...`), so the TUI and CLI show the wait live instead of a frozen screen, and clears it in a `finally` so it never leaks into another run. Without a reporter the client console.warns the same line.

---

## 3. Technical Approval Gates

All gates are LLM-free (injected stubs, mocked undici, temp workspaces).

### Gate 16.1: Per-page transport fallback

Across two 10-page stage runs, one stub page per run throws an exhausted-transport error (10% per stage — at, not over, the ratified >10% abort threshold; a 2-of-10 single-stage encoding would trip the outage detector and is NOT this gate): each failed page lands on the structured template with `finalMode: 'transport-fallback'` in the ordered report, a loud warning is emitted, `metrics.transportFailures` accumulates to 2 across the runs, each run completes, and all other pages synthesize normally.

### Gate 16.2: Outage detector — consecutive

5 consecutive transport-failed pages → the run aborts with the transport error; 4 consecutive (then a success) → completes. Counter resets on success are proven.

### Gate 16.3: Outage detector — rate

3 transport-failed pages out of 20 (15%) → abort; 1 of 20 (5%) → completes.

### Gate 16.4: 4xx never falls back

A stubbed 404 mid-stage → immediate abort, zero template fallbacks written, exactly one call for that page (no retries).

### Gate 16.5: Resume skip + template retry

Run 1 synthesizes 10 pages (8 pass, 2 template) and is killed. Run 2 with identical data: the 8 are skipped (zero LLM calls for them), the 2 template pages are retried; flipping one page's aggregate changes its fingerprint → it is re-synthesized.

### Gate 16.6: Materialize preserves passed pages

A passed synthesized page is byte-identical after a resume materialize (never rewritten); a fingerprint-changed page is rewritten.

### Gate 16.7: Per-PDF checkpoint

A 2-PDF run killed after PDF 1's materialize: `.state/ingestion.json` already records PDF 1; the resume skips PDF 1's extraction entirely (no extraction calls for it) and processes only PDF 2; final state equals an uninterrupted run's.

### Gate 16.8: Transport tuning

Staggered dispatch: the first 4 pool pickups are not simultaneous (deterministic jitter observable via injected clock). Headers timeout: `maxTokens >= 32768` calls carry the 600s timeout, smaller calls the default. Backoff: the retry-delay sequence is exponential (asserted from the delay function, no wall-clock sleeping).

### Gate 16.9: Slim decision-list schema

Both prompts contain no `keep` bucket instruction; validation derives keep as the exact complement (every candidate accounted for once); a legacy output that still includes `keep` is accepted when consistent and rejected when it contradicts the other buckets.

### Gate 16.10: Size-based bucketing

A synthetic candidate set engineered to overflow the output estimate below 250 candidates triggers lexical-stem bucketing; each bucket call is independently validated; the reconciliation round runs over survivors; the keep-all fallback per round is intact.

### Gate 16.11: Kill-and-resume integration

End-to-end: a 2-PDF ingest is killed mid-synthesis (stub counts tracked), resumed with plain `ingest` (no flags): completed PDFs are not re-extracted, passed pages are not re-synthesized, template pages are retried, and the final wiki + `.state` equals an uninterrupted run's (byte-comparison of page trees and reports).

### Gate 16.12: Full-suite regression

`npx tsc --noEmit` clean; key-less `npm test` green. Pre-existing tests untouched except where the amended semantics REQUIRE updates (e.g. a thrown-transport-at-synthesis assertion now expects the per-page fallback; every such update is enumerated in the status file with the reason).

### Gate 16.13: 429/5xx stall floor + Retry-After (v1.0.3)

The stall floor function is the exact sequence 1min/5min/15min/45min/90min (60s/300s/900s/2700s/5400s, ~2.6 h of waiting); a mocked 429 with `Retry-After: 7` waits the 60s floor (floor wins), and `Retry-After: 90` waits 90s (header wins). All waits observed through the injected sleeper — no wall-clock.

### Gate 16.14: Extended 429 attempt budget (v1.0.3)

Five mocked 429s then a 200 with `maxRetries: 2` → exactly 6 total attempts with the escalating stalls recorded, and the call resolves successfully — the 429 budget exceeds the caller's 3-attempt bound.

### Gate 16.15: Persistent 429 aborts after 6 (v1.0.3)

A persistent 429 → exactly 6 attempts, then the fail-loud error `API error (HTTP 429) after 6 attempt(s)` — still classified transient by `isTransientTransportError`. No chunk is ever skipped; exhaustion stays loud.

### Gate 16.16: 5xx shares the ladder; network keeps the old bound (v1.0.3)

503 ×2 then a 200 → 3 attempts with the exact 60s/300s stall floors; a persistent 500 → exactly 6 attempts then `API error (HTTP 500) after 6 attempt(s)` (fail-loud, still transient-classified); network errors ×2 then a 200 with `maxRetries: 2` → 3 attempts with the exact 5s/15s waits (no stall floor); `maxRetries: 0` + 429/500 → exactly 1 attempt and an immediate throw (frozen default preserved).

### Gate 16.17: Stall feedback wiring (v1.0.3)

The reporter receives the exact `{ waitSeconds, attempt, maxAttempts, statusCode }` per stall (429 and 500 both) and owns the stall message (console.warn suppressed); without a reporter the console.warn line fires (`Rate limited (HTTP 429)` / `Provider error (HTTP 500)` — waiting Ns before retry (attempt X/6)). Ingest-level: a stalled 429/5xx during a real (stubbed-transport) run surfaces the line on the run's `onProgress` channel, and the reporter never outlives the run (a post-run 429 warns on the console path). TUI-level: the ingest screen renders the stall line from the progress channel.

---

## 4. User Acceptance Tests (UAT)

### UAT 16.1: Kill-and-resume drill (live, moderate cost)

1. Start an ingest of a multi-PDF wiki with synthesis on; once synthesis is underway (~20 pages), kill the process (close the terminal / task manager).
2. Re-run the identical ingest command.
3. Expected: completed PDFs are NOT re-extracted (no extraction cost); already-synthesized pages are skipped (progress shows them counted as skipped); template-fallback pages are retried; the run completes; `metrics.json` reflects both legs; total second-leg cost is visibly smaller than a from-scratch run.

### UAT 16.2: Transport fallback in the wild (observational)

1. If a transient failure occurs during any later ingest (or is simulated by briefly disconnecting the network during synthesis): the run no longer dies — affected pages log `Transport failure … — template fallback.` and the run completes with a summary warning. Reconnect and re-run: the template pages are retried and complete.

### UAT 16.3: The deferred test wiki completes (the 54/175 wiki, optional)

1. Re-run `ingest new-wiki-phase13-14-15 -w dist --input-language da --synthesis`.
2. Expected: it completes end-to-end (this validates 16.1 in the wild); note that its pre-Phase-16 crash left no checkpoints/fingerprints, so this first completion re-extracts 2024 and re-synthesizes all pages — subsequent runs are then resume-cheap.

### UAT 16.4: Throttled/erroring free-tier run stalls and completes (live, v1.0.3)

1. Run the previously-throttled ingest with the free Zhipu GLM-4.7-Flash on a sequential step (e.g. the Extractor).
2. Expected: a 429 shows `Rate limited by provider (HTTP 429) — waiting Ns before retry (attempt X/6)...` and a 500 shows `Provider error (HTTP 500) — waiting Ns before retry (attempt X/6)...` in the progress channel, with waits escalating 1/5/15/45/90 min; the run keeps its place (no chunk re-processing, no skipped chunks), and it completes — slower, but complete. A provider that stays throttled/erroring through 6 attempts still aborts loudly with the attempt-count error and the PDF unrecorded (clean resume later).

---

## 5. Approval Checklist

- [ ] All 12 technical gates pass (`npm test` green; full suite unregressed except enumerated semantic updates).
- [ ] Gates 16.13–16.17 pass: 429 stall floor + Retry-After, extended 6-attempt budget, fail-loud exhaustion, non-429 classes byte-unchanged, reporter wiring (client + ingest + TUI).
- [ ] UAT 16.1 passes (16.2/16.3 may be demonstrated by gate evidence; 16.4 is live/observational).
- [ ] Per-page fallback ONLY for exhausted transient transport at the two synthesis stages; 4xx and all other stages unchanged.
- [ ] The 429 stall never skips data: it only waits; exhaustion still fails loud with the PDF unrecorded (clean resume).
- [ ] Outage detector: 5 consecutive OR >10% → abort, both proven.
- [ ] Skip rule honors only strict/permissive passes with matching fingerprints; templates retried; materialize never rewrites skip-eligible pages.
- [ ] Per-PDF checkpoint produces exactly the uninterrupted-run state record.
- [ ] Keep-bucket removed from both curation prompts; derived-keep validation; size-based bucketing below 250 candidates proven.
- [ ] Compliance log shows no unresolved contradictions.
- [ ] No new LLM calls in implementation testing; budget $0.

---

## 6. Integration Notes

### What Phase 16 Depends On
- Phase 12's error classification (transient vs deterministic vs content-defect) — the fallback consumes the transient class only.
- Phase 15's pool + serialized-write queue (fallback and synthesis-state writes ride them).
- Phase 14's curation bucketing machinery (the sizing trigger reuses it).
- Phase 8's incremental state shapes (checkpoint writes must match them exactly).

### What Phase 16 Produces
- Per-page transport fallback + outage detector; `.state/synthesis-state.json` + `pageDataHash`; per-PDF checkpointing; 600s large-call timeout + staggered dispatch + exponential backoff; slim curation decision schema + size-based bucketing; additive `metrics.transportFailures`. v1.0.3 (user directive 2026-08-22): the reactive 429/5xx stall (`TRANSIENT_MAX_ATTEMPTS` + `transientStallDelayMs` (1/5/15/45/90 min) + Retry-After honoring in `src/llm/client.ts`) and the `setStallWaitReporter` stall-feedback seam (carrying `statusCode`) wired through ingest's `onProgress`; supersedes the v1.0.2 429-only 60s×2^(n-1) stall.

### Contract with Final Acceptance
- Fail-loud preserved where it matters: 4xx, real outages (detector), Extractor exhaustion.
- Resume must be a pure optimization: an uninterrupted run is byte-identical with or without the resume machinery; resume correctness is proven by gate 16.11's byte-comparison.
- DOX pass required on completion: `src/AGENTS.md` (new state module, fallback, detector, checkpoint, tuning, curation sizing), `prompts/AGENTS.md` (schema slimming), `tests/AGENTS.md` (phase-16 entry), `wikis/AGENTS.md` (`synthesis-state.json`), `README.md` (resilience section), root AGENTS.md index if applicable.
