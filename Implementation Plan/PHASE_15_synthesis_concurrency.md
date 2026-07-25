# Phase 15: Synthesis Concurrency (L5)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-015`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-23
**Dependencies:** Phases 0-9, 11, 12, 13, 14
**Estimated Time:** 3-4 hours
**LLM Token Budget:** $0 (all gate tests are LLM-free — injected synthesis stubs with controllable delays; live timing verification only during real ingests at the user's discretion)

**Canon basis (user-ratified 2026-07-23 with user-narrowed scope, promoted compliance-log [2026-07-23 23:59]):** `Project Vision/04_orchestration_detailed.md` §1 (concurrency note: entity/topic synthesis may run through a bounded worker pool, fixed cap 4, deterministic output order; everything else sequential). Decision record: `Project Vision/optimizations/optimizations.md` lever L5. This phase implements exactly that ratification — no more, no less.

---

## 1. Objective

The 2026-07-23 production ingest spent ~11 hours wall time because the synthesis loops are sequential `for…of` awaits (`src/commands/ingest.ts:744,827`): wall time equals the sum of call latencies. Pages are independent of one another — no synthesis reads another page — so process entity synthesis and topic synthesis through a bounded worker pool with a **fixed cap of 4 concurrent calls**. Everything else stays sequential by ratified scope: extraction (chunks share rolling-memory context), the curation calls, the DOX Writer (bottom-up level dependencies), the workspace pass, and the AGENTS.md Updater. No cost change — same calls, same models; purely wall time (11 h → ~2.5–3.5 h projected with the rest of the package).

---

## 2. What to Build

### 2.1 The worker-pool helper

**File:** `src/utils/worker-pool.ts` (new)

```typescript
export async function runPool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: { concurrency: number },
): Promise<R[]>;
```

- Fixed-size pool: exactly `concurrency` workers pull from a shared index; a worker picks up the next item as soon as its current one settles. In-flight count NEVER exceeds `concurrency`.
- **Results are returned in input order** regardless of completion order (the caller writes reports deterministically).
- A rejected item rejects the pool after the in-flight workers settle (fail-loud per the existing ingest error semantics — per-page failures are already handled inside each page's strict→permissive→template chain and do not reject; only infrastructure errors propagate).
- No external dependency — ~20 lines of plain TypeScript.

### 2.2 Pooling the two synthesis loops

**File:** `src/commands/ingest.ts`

- Wrap the entity-synthesis loop (~line 744) and the topic-synthesis loop (~line 827) in `runPool(…, { concurrency: SYNTHESIS_POOL_SIZE })` where `const SYNTHESIS_POOL_SIZE = 4;` — a fixed constant, **not** a Settings field (ratified scope).
- Each pool task is exactly today's per-page body: strict `trySynthesisMode` → permissive → structured-template fallback, with the Phase 12 reask loop inside. Per-page semantics are unchanged — each page independently lands on strict-synthesis, permissive-synthesis, or template.
- The constant `SYNTHESIS_MAX_ATTEMPTS = 3` and all retry/backoff behavior are untouched; the existing 429/5xx machinery absorbs pool pressure at cap 4.

### 2.3 Serialized state writes + deterministic reports

**Files:** `src/commands/ingest.ts`, `src/state/metrics.ts` or the owning state modules, `src/llm/client.ts` (append seam only)

- `llm-calls.json` is appended per LLM call from inside `callLLM` via `logPath`; with 4 workers, appends race. Introduce a **single serialized append queue** (a per-process promise chain keyed by file path) so every JSONL append is whole-line and ordered by completion; no interleaved or torn lines. Same queue serves `conflicts.json` appends.
- `synthesis-report.json` entries are **collected in memory during the pool run and written once afterwards in original page order** (deterministic, diff-friendly output — ratified design constraint), not appended per completion.
- `metrics.json` is written once at the end of the run as today; the repair-rate accounting (`feedbackRepairs`, `countLlmCallsSince`) is order-insensitive and unchanged.

### 2.4 TUI aggregate progress

**File:** `src/commands/ingest.ts` (`progress()` call sites), `src/tui/ingest-screen.tsx` (display only if it parses progress lines)

- Per-page "Writing synthesis for page X" lines become an aggregate counter: `Synthesis: N/M pages complete (4 workers)` for the entity stage, then the topic stage. A completion bumps N; the line is re-emitted on change.
- The CLI (non-TUI) progress stream gets the same aggregate lines — no behavior fork between TUI and CLI.

### 2.5 Explicitly out of scope (ratified sequential)

Extraction per chunk, both curation calls (they are two, run by `Promise.all` since Phase 14 — unchanged), the DOX folder/root loops, the workspace pass, the AGENTS.md Updater. No pooling, no reordering, no shared-writer changes beyond what §2.3 already covers.

---

## 3. Technical Approval Gates

All gates are LLM-free (injected synthesis stubs with controllable async delays; temp wikis).

### Gate 15.1: Pool cap is hard

A 20-page fixture run with delay-stubbed synthesis: a shared in-flight counter never exceeds 4 at any await point; all 20 pages complete; total elapsed < sequential time (sanity bound, not a wall-clock assertion — assert via the counter's overlap, not timers).

### Gate 15.2: Deterministic report order

Stub completion order is scrambled (randomized delays): `synthesis-report.json` entries are in original page order for both stages, byte-stable across repeated runs.

### Gate 15.3: Serialized JSONL writes

Under the 4-worker load, `llm-calls.json` parses line-by-line as complete JSON records (no torn/interleaved lines); `conflicts.json` likewise. Line count equals the number of stub calls.

### Gate 15.4: Per-page semantics unchanged

Fixture with one page failing strict preservation (then passing permissive) and one page exhausting both modes: outcomes are strict/permissive/template exactly as the sequential code produced; reask attempt counts and `#attemptN` log contexts unchanged; one page's fallback does not affect another page's mode.

### Gate 15.5: Aggregate progress

The progress stream carries the aggregate counter form (`N/M pages complete (4 workers)`) and reaches `M/M` for both stages; no per-page spam lines from the pool path.

### Gate 15.6: Sequential stages untouched

Source-level and behavioral proof: the extraction loop, curation calls, DOX loops, workspace pass, and updater contain no `runPool` usage; a stubbed DOX `writeDoxIndexFn` in-flight counter never exceeds 1.

### Gate 15.7: Full-suite regression

`npx tsc --noEmit` clean; key-less `npm test` green. Existing ingest/synthesis gates (which run the loops through stubs) pass unmodified — sequential test doubles remain valid because pool semantics reduce to sequential semantics at concurrency ≥ items or with instant stubs.

---

## 4. User Acceptance Tests (UAT)

### UAT 15.1: Wall-time on a real ingest (live, user-chosen cost)

1. Re-ingest a wiki with enough entity pages to feel the pool (any existing multi-PDF wiki).
2. Expected: progress shows `N/M pages complete (4 workers)`; the synthesis stage finishes visibly faster than the pre-Phase-15 sequential baseline; `synthesis-report.json` is in page order; `llm-calls.json` parses cleanly.

### UAT 15.2: Quiet correctness

1. After the ingest, open two or three synthesized pages at random.
2. Expected: pages are complete two-layer pages (strict or permissive as reported); no torn state files; the wiki's DOX contracts regenerated normally (still sequential).

### UAT 15.3: Package UAT (the real measurement)

The full adhd-wiki re-ingest against the $144.95 / ~11 h baseline (projection ~$45–55 / ~2.5–3.5 h) runs once here as the package-level acceptance of Phases 13–15 together. User-triggered; real money.

---

## 5. Approval Checklist

- [ ] All 7 technical gates pass (`npm test` green; full suite unregressed).
- [ ] All UAT steps pass (15.3 is the package UAT and may close the phase after user review of 15.1/15.2).
- [ ] Fixed cap 4, not a Settings field; only entity + topic synthesis pooled.
- [ ] In-flight never exceeds 4; reports in original page order; state files serialized.
- [ ] Per-page strict→permissive→template + reask semantics byte-equivalent to sequential.
- [ ] Extraction, curation, DOX, workspace, updater provably sequential.
- [ ] TUI/CLI progress is the aggregate counter.
- [ ] Compliance log shows no unresolved contradictions.
- [ ] No new LLM calls in implementation testing; budget $0.

---

## 6. Integration Notes

### What Phase 15 Depends On
- The Phase 12 reask loop inside `trySynthesisMode` (per-page attempts unchanged; the pool wraps outside it).
- Phase 13's cap constants (long pages under the pool are the common case now).
- Phase 14's curated page set (fewer, richer pages → the pool has the final workload shape).

### What Phase 15 Produces
- `src/utils/worker-pool.ts`, pooled entity/topic synthesis loops, the serialized JSONL append queue, collected-then-ordered synthesis reports, aggregate progress lines.

### Contract with Final Acceptance
- Pool semantics must reduce to sequential semantics for every existing test double — the full pre-Phase-15 suite passes unmodified (Gate 15.7).
- Determinism: same input corpus + same stub outputs ⇒ byte-identical reports and wiki output regardless of completion order.
- DOX pass required on completion: `src/AGENTS.md` (worker-pool.ts contract + ingest loop pooling + serialized writers), `tests/AGENTS.md` (phase-15 entry), root AGENTS.md (phase index), README (concurrency note + `SYNTHESIS_POOL_SIZE`).
