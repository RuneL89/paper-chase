# Phase 15 Verification — Synthesis Concurrency (L5)

**Verifier:** cold-check sub-agent (no trust in status-file claims; everything below independently re-derived from spec, code, diffs, and my own test runs)
**Date:** 2026-07-24
**Spec:** `Implementation Plan/PHASE_15_synthesis_concurrency.md` v1.0.0
**Canon:** `Project Vision/04_orchestration_detailed.md` §1 concurrency note (line 17 — bounded pool, fixed cap 4, entity/topic synthesis only, deterministic output order, everything else sequential); `Project Vision/optimizations/optimizations.md` L5 (lines 223–229, 250 — user-narrowed scope, ratified 2026-07-23)
**LLM cost:** $0 — no live calls; key-less run via stash protocol (`.env` stashed, restored, verified 171 bytes with original mtime; no ambient `ANTHROPIC_*`/`OPENAI_*` env vars present — checked before the run).

---

## Per-gate results

### Gate 15.1 (pool cap is hard) — PASS

**Structural enforcement, not timing luck.** `src/utils/worker-pool.ts:51-52`: `workerCount = Math.max(1, Math.min(options.concurrency, items.length))` workers are spawned; each worker loop (lines 32–49) pulls one index at a time off the shared `nextIndex` counter and `await`s its task before pulling the next. One item in flight per worker × exactly `workerCount` workers ⇒ in-flight can never exceed `min(4, items.length)`. There is no timer, batching, or scheduling assumption anywhere in the cap path.

**Test proves it with a counter, not wall-clock.** `tests/phase-15.test.ts:199-207` (shared `inFlight`/`maxInFlight` counter mutated inside the delay-stubbed synthesis fns), asserted at line 249 (`maxInFlight <= SYNTHESIS_POOL_SIZE`) and line 250 (`maxInFlight > 1` — overlap proven via the counter). All 20 entity + 3 topic pages complete (lines 241–244). The only timer usage is inside the stubs to force overlap; no assertion reads elapsed time.

**Rejection semantics verified against code.** worker-pool.ts:41-47: a rejecting task sets `failed`/`failure` and its worker returns; the `while (!failed)` guard (line 33) stops surviving workers from pulling new items but lets their current task settle; `Promise.all` (line 52) resolves only after every worker loop has returned, then `throw failure` (lines 53–55) — the pool rejects AFTER in-flight settles. The supplementary test (lines 769–791) proves this behaviorally: item 2 rejects after 1 ms, the 25 ms siblings 0/1/3 all settle before rejection (`settled == [0,1,3]`), and items 4/5 never start (`started == [0,1,2,3]`).

*Nit (non-blocking):* the test asserts `≤ 4` and `> 1`, never `== 4`. The gate text requires exactly never-exceeds-plus-overlap, so this passes as written; the implementer's "deterministically reaches exactly 4" is true in practice (the four worker loops start their first tasks synchronously before the event loop turns) but is not pinned by an assertion.

### Gate 15.2 (deterministic report order) — PASS

**Ordering is structural, not luck.** runPool writes `results[index]` (worker-pool.ts:27,40) — results land in INPUT order regardless of completion order. `src/commands/ingest.ts:917-941` (entity) and `:1019-1043` (topic): the pool is awaited, THEN `appendSynthesisReportEntries(dir, outcomes.map(o => o.entry))` writes once per stage; the entity stage's `await` (line 917) completes before the topic pool starts (line 1019), so the entity block always precedes the topic block. `src/state/synthesis-report.ts:70-80` does a single read-modify-write per call — deterministic `JSON.stringify(state, null, 2) + '\n'`.

**Test.** phase-15.test.ts:256-313: `vi.useFakeTimers({ toFake: ['Date'] })` (line 259) + `setSystemTime` pins entry timestamps while `setTimeout` stays real so the two deterministic delay scrambles (lines 293–294) genuinely reorder completion. Asserts: entity entries equal invocation order (= input order, since workers pull indexes in order), topic entries equal topic start order, entity block precedes topic block (lines 299–309), and `runB.reportRaw === runA.reportRaw` — byte-stable across the two scrambles (line 312).

**Fake-timer leak check.** `toFake: ['Date']` is valid for the repo's vitest ^1.6.0 (package.json:36; @sinonjs/fake-timers supports Date-only faking); `afterEach` calls `vi.useRealTimers()` (line 53); `useFakeTimers` appears in gate 15.2 only. No leak path. Behaviorally confirmed: my standalone run of the whole file passed 7/7 with the timer-faking test in the middle of the file.

### Gate 15.3 (JSONL integrity) — PASS

**The seam.** `src/llm/client.ts:427-442`: `appendLlmCallLog` enqueues every `llm-calls.json` append on the shared queue keyed by `logPath`; the try/catch lives INSIDE the task (lines 435–440), so logging stays best-effort and a write failure can neither fail the LLM call nor reject the chain task. `src/state/conflicts.ts:92-115` (`logConflict`) and `:127-137` (`logManualEditConflict`) run their read-modify-writes inside the same queue keyed by `conflictsPath(wikiDir)`.

**Queue semantics verified against code.** `src/utils/serialized-writes.ts:23-34`: `run = previous.then(() => task())` — tasks for one key execute sequentially in enqueue order; the STORED chain link is `run.then(() => undefined, () => undefined)` (lines 28–32), so a task's rejection propagates to its own caller via the returned `run` but the stored chain continues resolved for the next task. Correct by inspection.

**Test drives the REAL seam.** phase-15.test.ts:318-429: `vi.mock('undici')` (line 45), FAKE key saved/set/restored in `finally` (lines 325–327, 422–428), real `callLLM` invoked from the stubs (lines 352, 365, 375) under the 4-worker pool with random delays on both transport and task. Asserts: non-empty line count === `stubCalls` === 36 (lines 396, 405 — 5×1 strict-pass + 5×6 double-mode-exhaustion + 1 topic); every line `JSON.parse`s with string `timestamp`/`callType` (lines 398–403); `conflicts.json` holds exactly the five concurrent failure entries entity-5..9, all `pageType: 'entity'` (lines 410–421) — no lost updates in the read-modify-write.

*Nit (non-blocking):* the queue's rejection-continuity property ("a task's rejection never breaks the chain") has NO direct test — no test file references `enqueueSerializedWrite`, and the client's task is constructed to never reject. The conflicts.ts tasks could reject (disk failure) but that path is untestable without fault injection. Code is correct by inspection; no gate requires this coverage.

### Gate 15.4 (per-page semantics unchanged) — PASS

**Diff-level byte-equivalence.** `git diff HEAD -- src/commands/ingest.ts`: the pre-Phase-15 loop body is verbatim-moved into the `synthesizeEntityPage` (ingest.ts:820-913) / `synthesizeTopicPage` (:944-1015) closures — identical `trySynthesisMode` calls with the same `run*Synthesis(page, agentsMd, llmLogPath, language, feedback ?? undefined, attempt)` arguments, identical `writeFile` + `enforceSparseInMarkdown(enforceAliasesInMarkdown(...))` compositions (the Phase 13/14 parts of the body are present on BOTH sides of the diff hunk), identical `console.warn` strings, identical `logConflict` call. The ONLY changes: report logging inverted (the entry is RETURNED — old `await logSynthesisReport(...); continue;` becomes `return { kind, entry: {...identical fields...} };`) and the `result.*` counters moved to a post-pool tally loop (ingest.ts:929-937, 1031-1039). Same totals, same entry shapes.

**Test.** phase-15.test.ts:434-562 pins the sequential contract under the pool: entity-0 strict pass @1, entity-1 strict ×3 → permissive pass @2, entity-2 full chain → template; counters exactly 1/1/1/1 (lines 482–485); attempt sequences `[1]`, `[1,2,3]`, `[1,2]`, `[1,2,3]`, `[1,2,3]` per page/mode (lines 490–494 — these are the numbers the real writers compose `#attemptN` contexts from; phase-12 pins that composition); attempt-2 feedback carries the correction block with the PAGE'S OWN dropped mention string (lines 497–501 — per-page feedback isolation under concurrency); exact report entries in page order entity-0,1,2,financial (lines 503–533); only entity-2 in conflicts.json (lines 538–541); entity-0's page written despite failing pool neighbours (lines 542–543 — fallback independence); `metrics.feedbackRepairs === 7` (lines 547–550 — order-insensitive reask accounting intact); per-page WARNING lines kept (lines 553–561).

*Observation (ratified design, not a defect):* if a task rejects at infrastructure level, the pooled stage writes NO report entries for pages already completed (collect-then-write discards the batch on throw), where the sequential loop had already appended them. This is exactly phase-doc §2.3 ("collected in memory during the pool run and written once afterwards"); the ingest aborts either way, and per-page quality outcomes — the gate's scope — are unaffected.

### Gate 15.5 (aggregate progress) — PASS

**Code.** ingest.ts:922-924 and :1024-1026 emit `Synthesis: N/M pages complete (4 workers)` on each completion (N is a plain incrementing counter, M the stage's page count — the "(4 workers)" segment interpolates `SYNTHESIS_POOL_SIZE`). The pre-Phase-15 `Writing synthesis for N page(s)...` lines are removed — `grep -rn "Writing synthesis" src/` returns nothing. `progress = options.onProgress ?? (() => {})` (ingest.ts:455); the CLI wires `onProgress: (message) => console.log(message)` (src/cli.ts:74) and the TUI wires `onProgress: (line) => setProgressLines(...)` (src/tui/ingest-screen.tsx:223) — the SAME string from the SAME call site reaches both; the TUI renders progress lines verbatim (only "Chunk X/Y" lines get a bar prefix, ingest-screen.tsx:66-68). No behavior fork.

**Test.** phase-15.test.ts:567-617: anchored counter regex; entity lines climb exactly 1..8 and topic lines 1..3 (lines 601–604); M/M present for both stages (lines 606–607); last entity counter precedes first topic counter (lines 608–611); no progress line contains `entity-` and none contains `Writing synthesis` (lines 615–616).

### Gate 15.6 (sequential stages untouched) — PASS

**My own source-level sweep.** `grep -rn "runPool" src scripts dist`: only `src/utils/worker-pool.ts` (definition) and `src/commands/ingest.ts` (import line 44, comment line 787, call sites 917 and 1019). `grep -c "await runPool(" src/commands/ingest.ts` = **2**. The Phase 14 curation `Promise.all` is intact at `src/materializer.ts:786-793` (`[topicOutcome, entityOutcome] = await Promise.all([...])`) — untouched. `SYNTHESIS_POOL_SIZE` appears only at ingest.ts:272 (`export const SYNTHESIS_POOL_SIZE = 4`), its two call sites/progress lines, and tests — `grep` of `src/tui/settings.ts`, `src/tui/settings-screen.tsx`, and all of `src/tui` for `SYNTHESIS_POOL_SIZE`/`poolSize`/`concurrency` is empty. The cap is NOT threaded through Settings/`.paper-chase.json`/TUI.

**Behavioral proof in the test.** phase-15.test.ts:622-749: source assertions (exactly two `await runPool(`, runPool absent from materializer/dox-writer/curation/agents-updater/extract-chunk, cap constant present, absent from Settings files — lines 625–640) PLUS an instrumented run (doxLlm: true, pagesPerChunk 1, three 10 ms-delayed chunks, disjoint entity slices): `maxExtractInFlight === 1` and `maxDoxInFlight === 1` (lines 747–748).

### Gate 15.7 (full-suite regression) — PASS (my own runs, not the implementer's)

- `npx tsc --noEmit` — exit 0, clean (run by me 2026-07-24).
- Key-less full suite: no ambient `ANTHROPIC_*`/`OPENAI_*` env vars (checked); `.env` (171 bytes) moved to `.env.bak-p15v`, `npm test` executed, `.env` restored in the same shell command, verified restored at **171 bytes with the original Jul 20 00:13 mtime** and no leftover stash file. The run's own output confirms key-lessness ("ANTHROPIC_API_KEY is not set…" fallback lines).
- **Result: 315 passed + 14 skipped across 21 test files (20 passed, 1 skipped)** — exactly the implementer's claimed numbers; 315 = 308 Phase-14 baseline + 7 new. Duration 21.87 s. `tests/phase-15.test.ts` standalone: **7/7** (run separately by me).
- **No pre-existing test modified by Phase 15.** `git diff HEAD --stat -- tests/` shows only `tests/AGENTS.md` (Phase 15 DOX scope) and `tests/phase-11.test.ts` modified. The phase-11 diff is 100% Phase 14 curation-slot scope (Curation Model row Down-counts in gates 11.1/11.10, `curation` slot in the seed/legacy/seedModels assertions) — the anticipated Phase 14 baseline nit; `.state/phase-14-verification.md:90` confirms "the six phase-11 sites" were Phase 14 scope. `tests/phase-15.test.ts` is the only new Phase 15 test file.

---

## Scope sweep

`git status --short` + `git diff HEAD --stat` enumerated (38 modified, 18 untracked entries). Classification:

- **Phase 15 scope (all present, nothing missing):** `src/utils/worker-pool.ts` (new), `src/utils/serialized-writes.ts` (new), `src/commands/ingest.ts`, `src/llm/client.ts`, `src/state/conflicts.ts`, `src/state/synthesis-report.ts`, `tests/phase-15.test.ts` (new), `src/AGENTS.md`, `tests/AGENTS.md`, `README.md`, `.state/phase-15-status.json` (+ this verification file).
- **Pre-existing uncommitted Phase 13/14/planning scope (expected, matches phase-13/14 verification scope lists):** `src/agents/curation.ts`, `src/state/curation-report.ts`, `src/state/curation-overrides.ts`, `prompts/curation-*.prompt.txt` (new, Phase 14); the six prompt modifications, `src/agents/synthesis.ts`, `src/dox-writer.ts`, `templates/AGENTS.md` (Phase 13); `src/materializer.ts`, `src/pages/entity-page.ts`, `src/state/metrics.ts` (diff shows ONLY the Phase 14 `curationFallbacks` addition — Phase 15 did not touch metrics, per spec §2.3), `src/tui/settings.ts`, `src/tui/settings-screen.tsx`, `src/utils/aliases.ts`, `src/utils/language.ts`, `src/utils/wikilinks.ts`, `tests/phase-11.test.ts`, `tests/phase-13.test.ts`, `tests/phase-14.test.ts`, `wikis/AGENTS.md` (diff: Phase 14 `.state` additions only), root `AGENTS.md`, `prompts/AGENTS.md`, `Implementation Plan/*` (incl. the three new phase docs), `Project Vision/*` (incl. `optimizations/`), `.state/phase-12..14-*`, `.state/compliance-log.md`.
- **Flag check — nothing to flag:** `scripts/` untouched; `dist/` untouched (gitignored); `wikis/` runtime content untouched (only the `wikis/AGENTS.md` doc); `test-pdfs/` golden masters untouched; `package.json`/`package-lock.json` untouched (worker-pool/serialized-writes are dependency-free — confirmed by reading both files); `.env` untouched (171 bytes, original mtime). `.zcode/` (untracked, ZCode tooling session dir) — neutral, not production code.

## DOX-pass quality

- `src/AGENTS.md`: worker-pool bullet (line 24), serialized-writes bullet (line 25), client.ts addendum (line 13), ingest.ts addendum (line 27), conflicts.ts addendum (line 32), synthesis-report.ts addendum (line 35), and the new binding **Concurrency boundary** Local Contract (line 65) — each independently checked against the code; all accurate, no contradictions with neighboring bullets (the fixed-cap-not-a-Setting, input-order results, reject-after-settle, best-effort logging, collect-then-write, sequential-stages, and aggregate-progress statements all match the implementation).
- `tests/AGENTS.md`: phase-15 entry enumerates all seven gates accurately; the Verification block's counts (315+14, 21 files, 7 new over the 308 baseline, 20+1 file split) match my own run exactly.
- `README.md:52` (Layer 4): the concurrency note (fixed 4-cap constant, identical per-page outcomes, once-per-stage original-order reports, aggregate progress line, serialized write queue, everything else sequential) is accurate.
- Root `AGENTS.md`: phase-index line now reads "Phases 0–9, 11–15" — TRUE; per phase-14-verification line 90 the root doc was Phase 14 DOX scope, consistent with the implementer's "intentionally unchanged in Phase 15" claim (indistinguishable from the working tree since all phases are uncommitted, but current content is correct either way).

## Checklist audit (phase doc §5)

| # | Item | Result |
|---|---|---|
| 1 | All 7 technical gates pass (`npm test` green; full suite unregressed) | PASS — my own key-less run: 315+14 / 21 files |
| 2 | All UAT steps pass | DEFERRED — user directive (compliance log [2026-07-24 15:00]): combined Phase 14+15 UAT after Phase 15; UAT steps documented in §4; not runnable at $0 budget |
| 3 | Fixed cap 4, not a Settings field; only entity + topic synthesis pooled | PASS — grep + code + gate 15.6 |
| 4 | In-flight never exceeds 4; reports in original page order; state files serialized | PASS — gates 15.1/15.2/15.3 + code inspection |
| 5 | Per-page strict→permissive→template + reask semantics byte-equivalent to sequential | PASS — diff-verbatim body + gate 15.4 |
| 6 | Extraction, curation, DOX, workspace, updater provably sequential | PASS — source grep + behavioral counters + curation `Promise.all` intact |
| 7 | TUI/CLI progress is the aggregate counter | PASS — single `progress()` call site feeds both |
| 8 | Compliance log shows no unresolved contradictions | PASS — Phase 15 pre-check and close-out both COMPLIANT; no open contradiction entries |
| 9 | No new LLM calls in implementation testing; budget $0 | PASS — all tests stub-injected or undici-mocked; key-less suite green; $0.00 |

## Findings the user should know (all non-blocking nits)

1. Gate 15.1's counter asserts `≤ 4` and `> 1` but never `== 4` — the gate text is satisfied; a tighter pin is possible if desired.
2. The serialized queue's rejection-continuity property (a rejecting task doesn't break the per-path chain) has NO direct test; correct by inspection (serialized-writes.ts:28-32). Low risk: the client's task is built to never reject (catch inside), so only conflicts.ts tasks could ever exercise it.
3. Abort-path divergence (ratified §2.3 design): on an infrastructure-level task rejection the pooled stage writes no report entries for already-completed pages; the old sequential loop had already appended them. Per-page outcomes unaffected.
4. With-key profile NOT re-run (budget $0 — correct): projected 326 passed + 2 skipped; must be verified with the key loaded before any release.
5. Combined Phase 14+15 UAT remains pending (user-deferred) — the phase cannot fully close until UAT 15.1–15.3 run on a live ingest.

---

## VERDICT: PHASE 15 VERIFIED

All 7 technical gates independently re-verified against code and by my own runs (`tsc --noEmit` clean; key-less `npm test` 315 passed + 14 skipped / 21 files; phase-15 standalone 7/7; `.env` stash protocol executed and restoration verified). Scope sweep clean; fixed cap confirmed un-threaded through Settings; DOX pass accurate; compliance log without unresolved contradictions; LLM cost $0. No blockers. Status → `verified-awaiting-uat` (combined Phase 14+15 UAT pending by user directive).
