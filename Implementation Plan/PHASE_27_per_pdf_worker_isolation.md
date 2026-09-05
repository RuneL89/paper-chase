# Phase 27: Per-PDF Worker-Process Isolation (TUI Conductor + Crash Recovery)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-027`
**Version:** 1.0.1 (v1.0.1 fix iteration appended 2026-09-03 — §8)
**Status:** v1.0.0 Implemented (all 11 gates green 2026-09-02). v1.0.1 Implemented (gates 27.12–27.19 green 2026-09-03; full key-less suite green — 602 passed, 16 skipped, 0 failed; Verifier cold-check PASS; $0 LLM spend).
**Date:** 2026-09-02 (v1.0.0) / 2026-09-03 (v1.0.1)
**Dependencies:** Phases 0-9, 11-26 (Phase 26's per-PDF loop is the boundary being isolated; Phase 16's checkpointing is what makes retry cheap)
**Estimated Time:** 10-14 hours
**LLM Token Budget:** **$0.00** — fully deterministic. The worker split is transport-neutral; every gate uses the existing injectable stub seams (`extractChunkFn`, `synthesisFn`, `amendmentFn`, …). Crash gates fault-inject via a debug env var (`PAPER_CHASE_WORKER_FAULT=<stage>`), never a real API call. The key-less suite profile is unchanged.

**Canon basis:** `Project Vision/04_orchestration_detailed.md` §1 (**Worker-process isolation amendment, 2026-09-02, user-ratified** — this phase's founding law), §3.2 (loop scope, checkpointing), §6 (per-stage outage detector keeps its scope inside each worker), `01_PRODUCT_VISION_AND_ARCHITECTURE.md` §4 (TUI workflow — screens byte-identical in normal operation), root `AGENTS.md` preference 2026-09-02. Evidence: the 2026-09-02 rkkp silent-death post-mortem — a 3-day live ingest died when an escaped error exited the single do-everything node process; forensics eliminated sleep (machine continuously awake 135.8 h), reboot, AV, system memory exhaustion, crash telemetry (none existed — a clean exit leaves no WER trace), and stall exhaustion (`exhausted: false` on the last record). The codebase has zero `unhandledRejection`/`uncaughtException` handlers, and the launcher's exit propagation (`bin/chase.js` `child.on('close', …) process.exit(code)`) closed the console, erasing stderr — the only evidence. User decisions 2026-09-02: ratify the 04 §1 amendment; auto-retry ON with cap **3 retries per PDF, 30-second backoff**, then stop-and-surface (never auto-defer); defer is user-initiated only, deletes nothing.

---

## 1. Objective

Run each PDF's mini-pipeline inside a **dedicated child worker process**, spawned and sequenced by the TUI/CLI parent (the **conductor**), with the deferred tail (DOX / workspace / cross-wiki / updater) in its own worker exactly once after the loop. A worker dying for ANY reason — escaped error, OOM abort, native crash — never ends the run: the conductor captures the worker's stderr, appends a record to `.state/crash-log.jsonl`, and offers recovery (**retry** resumes from checkpoints; **defer** is user-initiated only). Memory resets at every PDF boundary, making months-long runs structurally possible.

Invariants (user-ratified):
- **Pipeline law unchanged:** pool cap 4 stays inside each worker; workers run strictly one at a time; state-file writes stay serialized; the in-process engine path remains THE engine (isolation is a wrapper, not a fork).
- **Byte-identical normal operation:** user-facing TUI screens, progress lines, stall lines, and result banners are unchanged when nothing fails; the only new UI is the crash-recovery panel.
- **Data is never lost or auto-skipped:** retry resumes from the per-PDF/per-page checkpoints (Phase 16 law); deferral deletes nothing and never happens automatically; the circuit breaker stops loudly and never auto-defers.
- **The in-process path stays available:** `ingest()` called directly (CLI, tests, embedded flows) produces byte-identical results to the conductor-driven worker path.

## 2. What to Build

### 2.1 Engine split (mechanical, equivalence-preserving)

**Files:** `src/commands/ingest.ts`

- Lift the per-PDF loop body into an internal `ingestOnePdf()`; `ingest()` keeps its signature and calls it in a loop. Add an optional `onlyPdfs?: string[]` selector (file names) so a worker can run exactly one PDF, and a `finalizeOnly?: boolean` mode that skips the loop and runs only the deferred tail + end-of-run state. **A `onlyPdfs` run executes ONLY the selected PDFs' loop — the deferred tail (validation, DOX, workspace, cross-wiki, updater, end-of-run state/metrics) is the finalize worker's alone** (vision amendment: "the deferred tail runs in its own worker exactly once after the loop"); the per-PDF checkpoints inside the loop already persist that run's ingestion state.
- No behavior change: the existing loop, checkpoint cadence, progress emission (`onProgress`), stall-reporter wiring, and `IngestResult` accumulation are untouched; a run without `onlyPdfs` behaves byte-identically (gate 27.1 proves the three-run conductor shape — PDF worker, PDF worker, finalize — converges to the single full run's tree).

### 2.2 The worker subcommand + event protocol

**Files:** `src/cli.ts` (new `ingest-worker` subcommand), NEW `src/commands/worker-protocol.ts`

- `ingest-worker <slug> [--pdf <file>] [--finalize] [--workspace <dir>] [ingest flags]` — headless: runs `ingest(slug, { onlyPdfs | finalizeOnly, … })` and exits.
- **Event protocol (JSONL on stdout):** `{"type":"progress","line":"…"}` streamed from `onProgress`; `{"type":"result","result":<IngestResult>}` as the LAST line on success; `{"type":"fatal","error":"…","stack":"…"}` on a caught top-level error. Worker stderr stays raw (diagnostics). One JSON object per line; the conductor tolerates and preserves non-JSON stderr separately.
- **Fault injection (test-only):** `PAPER_CHASE_WORKER_FAULT=pre-result|mid-pdf` makes the worker `process.exit(1)` at the named point (after N progress lines for `mid-pdf`) WITHOUT emitting `result` — the deterministic crash used by the crash gates. Compiled out of nothing; harmless in production because the variable is never set.

### 2.3 The conductor (TUI)

**Files:** `src/tui/ingest-screen.tsx` (swap the in-process call for the conductor), NEW `src/tui/ingest-conductor.ts`

- `runIngestConductor(wiki, options)`: enumerates the selected PDFs (the same discovery the engine uses), spawns one worker per PDF via the spawn resolver (§2.4), relays `progress` events into the screen's existing `onProgress` callback verbatim, merges each worker's `result` into the run total (`IngestResult` is already an accumulation — lists concatenated, counters summed), then spawns the `--finalize` worker.
- **Crash handling:** on `close` with a non-zero exit code and no `result` event → append a `.state/crash-log.jsonl` record `{timestamp, pdf, phase, exitCode, stderrTail, attempts}` → **auto-retry** up to 3 times (30 s backoff, progress line announcing each wait) → on cap exhaustion, render the crash panel and stop (never auto-defer).
- **Crash panel (the only new UI):** inline block on the ingest screen — worker target, exit code, elapsed, last ~10 stderr lines, and `[R] Retry  [S] Skip PDF  [A] Abort run`. Retry = fresh worker for the same PDF (resumes from checkpoints). Skip = defer: record the PDF in the result's `deferred` list (new, additive `IngestResult` field), continue with the next PDF — the deferred PDF remains in `raw/` and is re-attempted on the next ingest run (hash unchanged ⇒ still selected). Abort = end the session cleanly (landed work stays; no finalize pass).
- The post-run UI (result banner, `p` review shortcut) is driven by the merged run result exactly as today.

### 2.4 Spawn resolver + signal forwarding

**Files:** NEW `src/tui/worker-spawn.ts`

- **Dev:** spawn `process.execPath` with the `tsx` entry (`bin/chase.js` precedent) — args array, no shell.
- **Packaged (pkg launcher):** the TUI already runs on real Node with assets extracted to `%LOCALAPPDATA%\paper-chase\runtime\<VERSION>`; the resolver finds the runtime `node.exe` + `dist/chase.mjs` next to the running bundle (env override `PAPER_CHASE_WORKER_CMD` for tests). Missing bundle → loud configuration error BEFORE the first spawn (fail fast, never mid-run).
- **Ctrl+C:** the conductor traps SIGINT/interrupt, terminates the current worker (resume machinery covers the rest — Phase 16/26 law), and exits cleanly.

### 2.5 Crash audit log

**Files:** NEW `src/state/crash-log.ts` (append via the Phase 15 serialized-write queue; one JSON line per worker death AND per auto-retry attempt: `{timestamp, pdf, phase, exitCode, stderrTail, attempt, autoRetried}`).

## 3. LLM Call Inventory

**$0.00 — no live LLM calls anywhere in this phase.** All gates inject deterministic stubs; crash gates use `PAPER_CHASE_WORKER_FAULT`; the worker/conductor split is transport-neutral (the same `callLLM` code runs inside the worker). The key-less suite profile is unchanged (no gate requires any API key).

## 4. Technical Approval Gates

All gates live in `tests/phase-27.test.ts` (+ `tests/tui/ingest-screen.test.tsx` additions) and run key-less.

| Gate | Test |
|---|---|
| 27.1 | **Engine-split equivalence:** the deterministic two-PDF fixture run through `ingest()` (in-process, no selector) produces byte-identical page output, state files, and `IngestResult` to the pre-split behavior (snapshot/fixture parity), and `onlyPdfs:['a.pdf']` processes exactly PDF a with the same per-PDF effects (checkpoint lands only for a). |
| 27.2 | **Protocol:** the worker serializes `progress` events verbatim, emits exactly one terminal `result` (success) or `fatal` (error) line, never both; the conductor parser round-trips all three event shapes and survives interleaved non-JSON noise on stderr (kept separate). |
| 27.3 | **Conductor sequencing:** two PDFs + finalize produce exactly three worker spawns in order (a, b, finalize); each worker's `result` merges into the run total (lists concatenated, counters summed); `--finalize` runs only after the last PDF worker exits 0. |
| 27.4 | **Crash → retry resumes:** `PAPER_CHASE_WORKER_FAULT=mid-pdf` on the first attempt only — the conductor retries the same PDF, the retry worker resumes from checkpoints (already-extracted chunks are NOT re-extracted — asserted via the stub call log), and the run completes with a correct merged result. |
| 27.5 | **Defer semantics:** after cap exhaustion with the user choosing Skip, the PDF lands in `result.deferred`, nothing under the wiki is deleted for it, the next PDF still runs, and a subsequent ingest run selects the deferred PDF again (hash unchanged). |
| 27.6 | **Crash log:** every worker death AND every auto-retry attempt appends a `crash-log.jsonl` record with `{timestamp, pdf, phase, exitCode, stderrTail, attempt, autoRetried}`; the file grows only through the serialized-write queue (concurrent appends never interleave). |
| 27.7 | **Spawn resolver:** dev path resolves the local `tsx` entry; packaged path resolves the runtime node + `chase.mjs` from the extraction root; a missing bundle produces the loud pre-run configuration error; `PAPER_CHASE_WORKER_CMD` override works (all tested with fake executables / injected resolver — no real spawning of the app in unit tests beyond a Node echo stub). |
| 27.8 | **Interrupt forwarding:** SIGINT during an active worker terminates the worker, ends the session cleanly (no finalize), and leaves landed work + checkpoints intact. |
| 27.9 | **Auto-retry cap:** a worker that always faults (`PAPER_CHASE_WORKER_FAULT` persistent) is attempted exactly 1 + 3 times with 30 s waits (fake timers), then the crash panel state is reached (`status: 'crashed'`, awaiting user key) — the conductor never proceeds past the cap and never auto-defers. |
| 27.10 | **TUI pixel-identity:** the ingest screen snapshot for a healthy conductor-driven run is byte-identical to the pre-phase in-process snapshot (same progress lines, same banner); the crash panel renders only in the crashed state with Retry/Skip/Abort and the stderr tail. |
| 27.11 | **Doc gates:** vision 04 §1 amendment present and quoted accurately in the phase doc; root AGENTS.md preference 2026-09-02 present; `src/AGENTS.md`, `tests/AGENTS.md`, `src/tui` notes current; VERSION bumped (asset-affecting — the TUI bundle changed). |

## 5. User Acceptance Tests (UAT)

Mechanical checks are Verifier pre-UAT (gates above). Human-verifiable UAT for the Reporter:

- **UAT 27.1 (crash panel, perceptual):** in the real TUI, run an ingest on a scratch wiki with `PAPER_CHASE_WORKER_FAULT=mid-pdf` set for the first worker only — watch the auto-retry progress lines, then (with auto-retry disabled for this demo) the crash panel with the stderr tail; press `R` and watch the run resume from checkpoints and complete. Expected: the window never closes; the panel shows target/exit code/stderr; retry completes the PDF.
- **UAT 27.2 (pixel-identity, perceptual):** run a normal (no-fault) ingest on a scratch wiki — confirm the screen looks exactly as before this phase: the SAME progress lines in the same order (the engine inside each worker emits them; the conductor adds no lines of its own in a healthy run) and the same final banner.
- **UAT 27.3 (memory, observable):** with a multi-PDF scratch wiki, watch the conductor's own RSS in Task Manager across PDF boundaries — the WORKER process appears/disappears per PDF and the TUI stays small; the worker's memory does not accumulate across PDFs.

## 6. Approval Checklist

- [x] All 11 technical gates pass (key-less `npm test` green — 594 passed, 16 skipped, 0 failed across 41 files; tsc --noEmit clean).
- [x] UAT steps documented with expected output; human-perceptual steps presented by the Reporter.
- [x] Compliance log shows COMPLIANT (founded on the user-ratified 2026-09-02 vision amendment — no contradiction).
- [x] Status file `.state/phase-27-status.json` shows all gates passed, no blockers.
- [x] LLM spend $0.00 (hard cap $0.00 — deterministic phase; every gate stub-injected or script-spawned).

## 7. Integration Notes

- **VERSION bump required** (launcher-entry.ts): the TUI bundle + new `src/tui/*` files are extracted assets; without a bump the packaged runtime silently reuses the stale extraction (the 1.0.1→1.0.2 lesson).
- **The in-process path stays the engine:** tests, CLI `ingest`, and any embedded flows keep calling `ingest()` directly; the conductor is the only caller that spawns workers. The outage detector (vision 04 §6) keeps its scope inside each worker; the conductor's retry cap is the run-level circuit breaker.
- **`IngestResult.deferred` is additive** (absent = empty for all old callers); `formatIngestSummary` mentions deferred PDFs only when the list is non-empty.
- **No new Settings rows, prompts, or model routing** — the worker inherits the same `.paper-chase.json` resolution because it runs in the same launch/workspace context the TUI passes explicitly.
- **Phase 16 interaction:** transport failures inside a worker ride the stall ladders exactly as today; a worker death mid-stall-wait looks like any other crash to the conductor (pipe closes, no result).

---

## 8. v1.0.1 Fix Iteration (2026-09-03): Worker-scope fencing + conductor observability

**User-ratified 2026-09-03** (AskUserQuestion round — "All three fixes / Full TUI depth / Rebuild ASAP" — plus the rollout directive). Born from the 2026-09-03 live rkkp evidence, observed on the production run itself:

1. **False orphan warnings:** the Phase 8 removed-PDF check builds `presentSlugs` from the `onlyPdfs`-FILTERED file list (`src/commands/ingest.ts` ~892), so every Phase 27 PDF worker warns that every OTHER recorded source's PDF "is no longer in raw/" (the AKDB skip-worker printed four false warnings while all five PDFs sat in raw/). The empty-raw path (~843) has the same shape. **Fix:** gate both warning blocks on `options.onlyPdfs === undefined` — the check is run-level, and the finalize worker (no `onlyPdfs`) carries the complete raw/ list, so it still runs exactly once per run with correct data. A scoped worker whose target vanished mid-run exits gracefully with one honest line instead of all-sources spam.
2. **Fallback re-runs per skip-worker:** the 2026-07-21 all-skip repair fallback (`lastMaterializeResult === undefined`) ran in EVERY hash-skip worker under the conductor — the AFDK skip-worker burned 8h53m re-curating the whole wiki, with DAPROCA/DGCD/HOFTER owing ~3 more passes. **Fix:** restore batch semantics — the fallback runs for full runs (unchanged) OR for `finalizeOnly && idleFallback` (new additive option, CLI `--idle-fallback`); the conductor passes the flag iff its merged `result.ingested.length === 0` (the conductor is the only party that knows whether any PDF landed). An all-skip run still gets exactly ONE repair pass per run, now in the finalize worker before the tail.
3. **Observability (amends the 2026-09-02 "only new UI is the crash-recovery panel" clause by user ratification):** per-worker banner lines (`[2/37] AKDB_2025.pdf`, `[finalize] validation · DOX · workspace · cross-wiki · updater`), a persistent dim worker-position row (`Worker 2/37 · <pdf> · elapsed …`), and stall lines that carry the failing call's label with a LIVE countdown in the TUI (clamping at zero to `retry in flight…`); `StallWaitInfo` gains `label`, the worker emits a structured `{type:'stall'}` protocol event, and the CLI degrades to today's single text line (now labeled).

**Budget: $0.00** — every new gate is deterministic (stub seams + scripted spawns); the key-less suite profile is unchanged.

### v1.0.1 Technical gates (tests/phase-27.test.ts + tests/tui/ingest-screen.test.tsx)

| Gate | Test |
|---|---|
| 27.12 | **Orphan fencing (scoped):** an `onlyPdfs` run over a wiki with OTHER recorded sources present in raw/ emits ZERO "no longer in raw/" warnings; a scoped run whose target PDF is absent emits one honest skip line and returns cleanly (no all-sources warnings, no error). |
| 27.13 | **Orphan fencing (finalize keeps it):** a `finalizeOnly` run (and a plain full run) over a wiki with a genuinely removed PDF still emits the warning exactly once — Phase 8 law preserved at run level. |
| 27.14 | **Fallback fencing:** an `onlyPdfs` worker whose PDF hash-skips makes ZERO curation LLM calls and exits (the fallback does not run in per-PDF workers). |
| 27.15 | **idleFallback engine mode:** `ingest(slug, { finalizeOnly: true, idleFallback: true })` on an all-skip wiki runs materialize + curation + synthesis (the repair pass) before the tail; without the flag the finalize run performs no materialize/curation. |
| 27.16 | **Conductor flag + banners:** the conductor spawns the finalize worker with `--idle-fallback` iff no PDF was ingested this run (both scenarios asserted on the spawn sequence); each PDF worker is preceded by a `[i/N] <pdf>` banner line and the finalize worker by a `[finalize]` banner, relayed through onProgress in order. |
| 27.17 | **Worker-position + stall relay:** the conductor fires `onWorkerChange({index, total, pdf, phase})` at each worker start; a worker `{type:'stall'}` event reaches the conductor's `onStall` callback with the label/wait/attempt payload; `StallWaitInfo` carries `label` and the ingest progress stall line includes it. |
| 27.18 | **Screen rows:** the ingest screen renders the worker-position row during a conductor run and a live stall row that counts down (zero-clamp shows `retry in flight…`); both vanish when the run ends; the healthy-run screen gains the banner lines and the crash panel is unchanged. |
| 27.19 | **Doc gates:** vision 04 §1 rider (2026-09-03) present; phase doc v1.0.1 section with gates 27.12–27.19 present. |

### v1.0.1 Approval Checklist

- [x] Gates 27.12–27.19 green; full key-less suite green (602 passed + 16 skipped, 41 files); tsc --noEmit clean.
- [x] Compliance log: pre-check (COMPLIANT with the user-ratified observability amendment) + closeout entries present.
- [x] Vision 04 §1 rider (2026-09-03) present; root AGENTS.md preference + dist 1.0.31 entries present.
- [x] VERSION 1.0.30 → 1.0.31; `npm run package:win` rebuild after the live TUI is closed (feat 70bf960 + build 235a9a9; exe smoke-tested — 1.0.31 runtime extracted, `ingest-worker` subcommand present).
- [ ] Live-run UAT (post-rebuild, on rkkp): skip-workers exit in seconds with no curation calls and no false warnings; banner/position rows visible; CPOP's real worker runs and records the source.
