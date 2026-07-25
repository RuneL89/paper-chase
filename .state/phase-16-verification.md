# Phase 16 Verification Report — Run Resilience

**Verifier:** cold-check sub-agent (no trust in status-file claims; every claim re-derived from spec, canon, code, and independent test runs)
**Date:** 2026-07-24 (session); spec dated 2026-07-25
**Spec:** `Implementation Plan/PHASE_16_run_resilience.md` §3 gates, §5 checklist
**LLM cost:** $0 (stash protocol used for the key-less run; `.env` stashed → suite → restored; verified 171 bytes, mtime 1784495627, md5 946b4029d38b2f3685e104332d2a1b8f — identical before and after)

---

## Independent runs

| Check | Result |
|---|---|
| `npx tsc --noEmit` | CLEAN (exit 0, no output) |
| Key-less `npm test` (`.env` stashed) | **332 passed + 14 skipped across 22 files (21 passed, 1 skipped)** — duration 23.4s |
| `npx vitest run tests/phase-16.test.ts` | **17/17 passed** — duration 12.1s |
| `.env` restored | byte-identical (size, mtime, md5 all match pre-stash) |

Numbers match the status file's claims exactly (Phase 15 baseline 315+14/21 + 17 new = 332+14/22).

## Scope sweep (`git status --short` + `git diff HEAD --stat`)

Changed files, all in phase scope:
- Production: `src/commands/ingest.ts`, `src/llm/client.ts`, `src/utils/worker-pool.ts`, `src/state/synthesis-state.ts` (NEW), `src/materializer.ts`, `src/state/metrics.ts`, `src/state/synthesis-report.ts`, `src/agents/curation.ts`, `prompts/curation-topics.prompt.txt`, `prompts/curation-entities.prompt.txt`
- Tests: `tests/phase-16.test.ts` (NEW) + exactly the four enumerated pre-existing updates (`tests/phase-15.test.ts` six `poolStaggerMs: 0` hunks; `tests/phase-07.test.ts` gate 7.10 sleeper; `tests/phase-14.test.ts` gate 14.3 sleeper; `tests/phase-14.test.ts` gate 14.1 missing-bucket → legacy-keep-contradiction). Each inspected in diff: genuinely required by the amended semantics, intent-preserving (attempt counts, error classes, and pool-semantics assertions all still pinned).
- DOX/state: `src/AGENTS.md`, `prompts/AGENTS.md`, `tests/AGENTS.md`, `wikis/AGENTS.md`, `README.md`, `.state/compliance-log.md`, `.state/phase-16-status.json`

Untouched as required: `scripts/`, `dist/`, wikis runtime (`wikis/*/` gitignored; only `wikis/AGENTS.md` changed), golden masters (`test-pdfs/`), `package.json`/`package-lock.json` (no new dependencies), `.env`, root `AGENTS.md` (verified: unchanged and contains no Phase-16 index claim that could be false). Untracked `.zcode/` is the agent-CLI tooling dir, not a project artifact — excluded from scope judgment.

---

## Per-gate verdicts

### Gate 16.1 — Per-page transport fallback: **PASS**
- Catch sites exist ONLY in the two pool page bodies: `src/commands/ingest.ts` L1107-1139 (entity) and L1281-1305 (topic). Both gate on `isTransientTransportError(error)` and `throw error` otherwise (L1117-1119, L1285-1287) — 4xx and every non-transport class rethrow.
- Classification verified at `src/llm/client.ts` L458-467: matches `'… API transport error after N attempt(s)'` (network/timeout, both providers) and `'… API error (HTTP n)'` only for 429/5xx (`isTransientStatus`, L404-406). HTTP 4xx → false.
- Fallback semantics: page keeps the Materializer-written structured template (no synthesis write occurs), report entry `finalMode: 'transport-fallback'` (additive in `src/state/synthesis-report.ts` L35), exact loud warning `Transport failure for <slug> after retries — template fallback.` (ingest.ts L1124/L1290), run-scoped counter into `metrics.transportFailures` (additive required field, `src/state/metrics.ts` L109; written L1491), run-level summary warning (ingest.ts L1361-1365).
- Test evidence: `tests/phase-16.test.ts` L286-362 — one exhausted-timeout (entity-3) + one exhausted-429 (t-c), 9+9 synthesized, 2 ordered transport-fallback entries, exact warning strings, summary line, `transportFailures === 2`, template bytes on disk, records carry `transport-fallback` mode.

**Phase-doc-text judgment (required finding):** the gate text — "A 10-page pool run where 2 stub pages throw … run completes" — is INCONSISTENT with the ratified outage rule under a single-stage reading: 2 failures in one 10-page stage = 20% > 10% → the detector must abort. The Implementer's encoding (one failure per 10-page stage across the two stages = 10% each, exactly at — not over — the strictly-greater threshold) is the ONLY reading consistent with both the ratified rule and the gate's "run completes" outcome, and as encoded the test DOES prove the gate's intent (fallback without abort, plus report/warning/metrics evidence). **Recommendation: correct the phase doc gate text** (e.g. "a 10-pages-per-stage pool run where one stub page per stage throws exhausted-transport errors" or "2 failures across 20+ attempted pages"). Doc-text nit; the implementation and test are correct.

### Gate 16.2 — Outage detector, consecutive: **PASS**
- State machine at ingest.ts L330-359: `recordDetectorTransportFailure` increments `failed`/`consecutive` and RETHROWS the page's own transport error at `consecutive >= 5` (constant L315) — the pool then rejects with THE transport error after in-flight settles (worker-pool.ts L70-86; unstarted items never start — the post-stagger `if (failed) return` at L61-63 closes the stagger-chain hole).
- Reset semantics: `recordDetectorSuccess` (L341-343) is called for every non-`transport` outcome — INCLUDING quality-template pages (L1150-1154, L1316-1318). Correct: a quality template means the LLM demonstrably answered; a TRANSPORT fallback does NOT reset (it is a failure). Matches vision 04 §6 "no successful call in between".
- Test evidence: 50-page fixture (5 consecutive = exactly 10% so the rate rule cannot fire) aborts with 'Headers Timeout Error' and never writes metrics (L378-409); two 4-streaks separated by a success over 80 pages (8/80 = 10%, at-not-over) complete with `transportFailures === 8` — completion is impossible without the reset (L411-442). Completion-order determinism via per-index increasing delays (documented L370-376) — verified sound: pickups are non-decreasing in index, so completions stay index-ordered; no wall-clock assertions.

### Gate 16.3 — Outage detector, rate: **PASS**
- Rule: `failed > total * 0.1` (strictly greater; `TRANSPORT_OUTAGE_RATE = 0.1`, L323). Denominator = pages ATTEMPTED this run (`makeOutageDetector(stage.toRun.length)`, L1144/L1310) — resume-skipped pages make no calls and cannot witness an outage. The vision text "a stage's pages" and the phase doc's "the stage's total pages" coincide with attempted pages on any fresh run; the attempted-reading is defensible and documented in code (L326-329) and the status file.
- Test evidence: 3 spread failures of 20 (15%, consecutive never exceeds 1) abort with the transport error; 1 of 20 (5%) completes with `transportFailures === 1` (L447-491).

### Gate 16.4 — 4xx never falls back: **PASS**
- 404 → `isTransientTransportError` false → immediate rethrow → pool rejects. `runWithFeedbackRetry` never catches thrown errors (`src/llm/reask.ts` L112-113: "PROPAGATE immediately"), so exactly one call for the page. Verified by test: one call counted, run rejects on 'HTTP 404', zero `transport-fallback` records, no report append, page stays the structured template (L496-535). Zero fallbacks written.

### Gate 16.5 — Resume skip + template retry: **PASS**
- `pageDataHash` (`src/state/synthesis-state.ts` L144-151): SHA-256 over `canonicalJson({aggregate, language})` — recursive key sort, array order kept, `undefined` dropped. `slugToTitle` is EXCLUDED (L148) — correct: it is global cross-page context whose inclusion would re-synthesize every page on any unrelated rename; title/folder/structured data/language pair are all inside the hash. No volatile fields (no timestamps; `sparse`/`mergedAliases` are deterministic functions of the aggregate).
- Skip rule: `isSkipEligible` = `strict-synthesis` | `permissive-synthesis` ONLY (L104-106); partition requires record + fingerprint match + not rewritten by this run's Materializer (`partitionStage`, ingest.ts L955-974). Template records (`structured-template`, `transport-fallback`) and unrecorded pages are retried. Skipped pages contribute reconstructed report entries (timestamp/mode from the record, L983-1000) and NEVER rewrite their record (records are written only inside pool tasks, L1158-1162/L1319-1323), so `synthesizedAt` survives — resume byte-stability.
- Test evidence (L540-641): killed leg 1 (8 pass + 2 quality-template via throwing updater stub) leaves 10 records; leg 2 makes zero calls for the 8 (`synthesisSkipped === 8`, skip progress line), retries the 2 templates; a direct extraction-JSON aggregate flip re-synthesizes exactly entity-0 (`synthesisSkipped === 9`).

### Gate 16.6 — Materialize preserves passed pages: **PASS**
- Preservation check runs BEFORE the manual-edit conflict path in BOTH write loops (`src/materializer.ts` L1163-1172 entities, L1247-1256 topics): skip-eligible record + `pageDataHash` match + file exists → no write, page pushed to `entityPages`/`topicPages` AND `preservedPages` (path + current on-disk hash). Byte-for-byte — no `writeFile` on that path. No records on disk → the pre-Phase-16 path is byte-identical (empty map, every check falls through).
- Ordering consequence (status design decision (e)): a human edit to a skip-eligible page is silently kept (no conflict entry) — outcome identical to the conflict path (page preserved), log entry differs; changed-fingerprint pages keep full conflict behavior. Acceptable and documented.
- Ingest-side convergence: preserved hashes fold into `workingPageHashes` (ingest.ts L676-678) so a mid-synthesis abort cannot leave a stale pre-synthesis hash that would false-flag the page next run.
- Test evidence (L677-726): byte-identical preserved page, `preservedPages`/`writtenPages` split, page still flows to synthesis; fingerprint flip → rewrite with the new aggregate.

### Gate 16.7 — Per-PDF checkpoint: **PASS**
- Checkpoint write at ingest.ts L851-860: `state.sources[sourceSlug] = { hash, documentPages, ingestedAt: now, language: input }` — THE SAME assignment the end-of-run write persists — then `state.pageHashes = workingPageHashes; writeIngestionState(dir, state)` immediately. The end-of-run write (L888) stays final. Writer and end-of-run writer are the same object/shape by construction.
- Resume skip: Phase 8 hash-skip (`existing.hash === hash → continue`, L720-724) sees the checkpoint → zero extraction calls for the recorded PDF.
- Test evidence (L731-849): killed-after-PDF-1 run records exactly `{hash, documentPages, ingestedAt, language}` for `aaa-master`; resume extracts only `bbb-master-part-001`; final `ingestion.json` and the documents/sources/entities/topics trees are BYTE-EQUAL to an uninterrupted run at the same pinned time.

### Gate 16.8 — Transport tuning: **PASS**
- 600s timeout: `largeCall = (maxTokens ?? 1024) >= LARGE_CALL_MAX_TOKENS (32768)` → `headersTimeout: 600_000` spread ONLY then (client.ts L414-417, L543, L557). Test asserts present at 32768, absent at 32767 and at default (L889-914).
- Stagger: worker-pool slot chain (L53-63) spreads pickups deterministically one `staggerMs` apart; `sleepFn` is the test seam; default 0 = Phase 15 behavior; production default `SYNTHESIS_POOL_STAGGER_MS = 250` wired at both pool calls (ingest.ts L931, L1169, L1330). Eager-clock test reads pickups at 250/500/750/1000 (verified: the `.then` reservation is registered before the `await` continuation, so the eager clock reading is deterministic in microtask order) and the cap/order/unstaggered behavior are untouched (L854-887). Post-failure, the slot chain cannot start unstarted items (`if (failed) return` after the slot await).
- Backoff: `transportRetryDelayMs = 5000 * 3^(retry-1)` → 5s/15s/45s (client.ts L427-429), awaited via the replaceable sleeper (L580); `maxAttempts` formula and error classes untouched. Test asserts the delay function and a recording-sleeper run ([5000, 15000] between 3 attempts) with no wall-clock sleeping (L916-957).
- The two pre-existing sleeper injections (phase-07 gate 7.10, phase-14 gate 14.3) are finally-restored and preserve intent: attempt counts and error classes still pinned there; the sequence itself is pinned here.
- `isTransientTransportError` matrix test (L959-971): 429/5xx/network true for both providers; 404/400/missing-key/garbage/non-Error false.

### Gate 16.9 — Slim decision-list schema: **PASS**
- Both prompts: no `"keep":` schema key, explicit "There is NO \"keep\" bucket… kept automatically… Do not output a \"keep\" list", justification cap "Do not justify your decisions. If a justification is truly unavoidable, cap it at a few words." (`prompts/curation-topics.prompt.txt` L16/L22/L34-38; `prompts/curation-entities.prompt.txt` L18/L22/L37-38). `{languageDirective}`/`{agentsMd}`/`{candidates}` placeholders intact.
- Validation (`src/agents/curation.ts`): `keep` optional in parse (L462); derived keep = candidates minus merged-away minus dropped (into-survivors and `unsure` fold in) (L670-678); every-mentioned-slug rules unchanged (unknown/double-list/self-merge/into-dropped/no-unique-survivor); legacy `keep` accepted only when EXACTLY consistent with the raw buckets, rejected with the slugs named otherwise (L635-667). Verified the status file's claim: the `unexpected` branch is unreachable (such a slug is double-listed and rejected by the membership rule first) — harmless dead branch, consistent behavior.
- Test evidence (L976-1049): prompt-contract assertions, slim topic/entity outputs derive the exact complement with every candidate accounted once, legacy-consistent accepted, legacy-contradictory rejected naming gamma/delta, double-listing still rejected.

### Gate 16.10 — Size-based bucketing: **PASS**
- Trigger: `overCount (>250) || overSize (estimateDecisionListTokens >= CURATION_SIZE_TRIGGER_TOKENS = 24576 = 75% of 32768)` (curation.ts L174-200, L990-1000). `bucketCandidatesSized` closes buckets on count OR size (L335-361). Reconciliation over survivors + per-round keep-all fallback intact (L1004-1037; a failed bucket keeps all its candidates, L1016-1019).
- Test evidence (L1075-1165): 200 candidates with ~450-char slugs exceeds the size trigger below 250; >1 bucket, each ≤250; bucket-1 first attempt invalid (ghost slug) → independently re-asked with the correction block; reconciliation over 199 survivors; second test: bucket-1 transport death → keep-all fallback recorded, bucket-2's merge survives, final set never grows.

### Gate 16.11 — Kill-and-resume integration: **PASS**
- End-to-end (L1170-1302): leg 1 kills mid-synthesis (entity-8 exhausted-transport → transport-fallback record; entity-9 fatal 404) leaving 9 checkpointed records + both PDFs recorded; leg 2 (plain ingest, no flags): zero extraction calls, `synthesisSkipped === 8`, only entity-8/entity-9 retried; final tree byte-compared against an uninterrupted run at the same pinned Date.
- Byte-comparison set: the ENTIRE wiki tree (all `.md` incl. DOX indexes and AGENTS.md, plus every `.state` artifact — synthesis-report/state, ingestion, rolling-memory, curation/validation reports, structural-changes, language, extracted JSON) MINUS `metrics.json`.
- The metrics.json exclusion is HONEST: metrics is a per-run audit (its `chunksSkipped`, `wallClockMs`, cost window legitimately differ between a resumed run and an uninterrupted one — it records run history, not wiki content). Every reader-facing artifact IS byte-compared. The equality claim is strong enough.
- Determinism of the 9-record checkpoint verified by pool semantics: pickups are strictly index-ordered (shared counter), item 9 is the last pickup, every started item settles with its checkpoint before the pool rejects — no completion-order dependence.

### Gate 16.12 — Full-suite regression: **PASS**
- `npx tsc --noEmit` clean; key-less suite 332 passed + 14 skipped across 22 files (21 passed, 1 skipped) — re-run independently by this verifier. Pre-existing tests touched ONLY at the four enumerated sites (diff-inspected; see Scope sweep).

---

## Checklist audit (phase doc §5)

- [x] All 12 technical gates pass (`npm test` green; full suite unregressed except the four enumerated semantic updates) — independently re-run.
- [ ] UAT 16.1 — live kill-and-resume drill: NOT in verifier scope ($0 constraint); pending at the user's discretion. UAT 16.2/16.3 demonstrable by gate evidence (16.1/16.2/16.3/16.11).
- [x] Per-page fallback ONLY for exhausted transient transport at the two synthesis stages; 4xx and all other stages unchanged — catch sites only in the two pool bodies; extractor/DOX/workspace/updater code untouched by the diff.
- [x] Outage detector: 5 consecutive OR >10% → abort, both proven (16.2 abort+reset, 16.3 abort+complete).
- [x] Skip rule honors only strict/permissive passes with matching fingerprints; templates retried; materialize never rewrites skip-eligible pages (16.5/16.6).
- [x] Per-PDF checkpoint produces exactly the uninterrupted-run state record (16.7 byte-equality).
- [x] Keep-bucket removed from both prompts; derived-keep validation; size-based bucketing below 250 proven (16.9/16.10).
- [x] Compliance log: entry [2026-07-25 10:10] COMPLIANT; no NON-COMPLIANT entries; every "unresolved" mention in the log is a "no unresolved contradictions" close-out.
- [x] No new LLM calls in implementation testing; budget $0 — key-less suite green; gates 16.8's real-`callLLM` tests use a fake key against mocked undici.

## DOX-pass quality

- `src/AGENTS.md`: four-class retry contract (4xx-never-fallback, exponential backoff, 600s large-call timeout, per-page fallback + detector), curation contract (keep-complement, legacy consistency, dual trigger), concurrency boundary (stagger as dispatch-only, `poolStaggerMs` test seam, checkpoints on the serialized queue), NEW run-resume contract (pure-optimization statement, skip-eligibility, per-PDF checkpoint) — all accurate against the code, no neighbor contradictions. New `state/synthesis-state.ts` module bullet present and accurate.
- `prompts/AGENTS.md`: both curation bullets updated (keep removed, derived keep, justification cap, count-OR-size trigger) — accurate.
- `tests/AGENTS.md`: phase-16 entry (17 tests, per-gate summaries) + Verification counts 332+14/22 — accurate.
- `wikis/AGENTS.md`: `.state` gains `synthesis-state.json` with shape — accurate.
- `README.md`: Layer-4 item, rejection-loops paragraph (linear→exponential corrected), LLM-client paragraph (600s timeout), state-files list (+synthesis-state.json, transport-failures metric), new Run resilience paragraph — all accurate.

## Findings the user must know (all nits; none blocking)

1. **Phase doc gate 16.1 text needs a correction** (see gate 16.1 above): "10-page pool run, 2 stub pages throw, run completes" contradicts the ratified >10% rule under a single-stage reading (20% would abort). The two-stage encoding is the only consistent reading and proves the intent. One-line doc fix recommended.
2. **Pre-existing (not Phase 16) mislabel in `src/AGENTS.md` curation contract:** "topic `unsure` folds into keep" — `unsure` is the ENTITY bucket (topics have `drop`); the phrase predates this phase (verified at HEAD) and was left unchanged. One-word fix in a future DOX pass.
3. Outage-rate denominator is the stage's ATTEMPTED pages (post-skip), not literal total pages — identical on fresh runs; defensible (skipped pages make no calls) and documented in code/status.
4. The legacy-keep consistency check's `unexpected` branch is unreachable (double-listing rejects first) — harmless.
5. Materialize preservation silently keeps human edits to skip-eligible pages without a conflict entry (outcome identical to the conflict path; documented design decision).
6. Gate 16.11 excludes `metrics.json` from byte-comparison — honest and justified (run-history audit).

---

## VERDICT: **PHASE 16 VERIFIED**

All 12 gates independently confirmed PASS with file/line evidence; tsc clean; key-less suite 332 passed + 14 skipped across 22 files with phase-16 at 17/17; scope sweep clean (only the four enumerated pre-existing test updates, each intent-preserving); `.env` untouched (md5/mtime verified); $0 LLM cost. Blockers: NONE. The single recommended follow-up is the phase-doc gate-16.1 text correction (nit 1) before or alongside UAT 16.1.
