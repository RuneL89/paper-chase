# Phase 28: Fine-Grained Crash Resume — Per-Chunk Checkpoints, Stage Markers, Synthesis Journal, Crash Telemetry

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-028`
**Version:** 1.0.0
**Status:** Implemented (gates 28.1–28.9 green 2026-09-07; full key-less suite green — 613 passed, 16 skipped, 0 failed across 42 files; tsc --noEmit clean; $0 LLM spend). Built at VERSION 1.0.32 (feat 63fbc1e + build a3e8552; exe smoke-tested — 1.0.32 runtime extracted, `ingest-worker` present). UAT 28.1/28.2 accepted by the user 2026-09-07. Standing exception: the independent Verifier cold-check (the Implementer sub-agent hit the account usage limit mid-run — the orchestrating agent completed the build; role-merge deviation recorded in `.state/phase-28-status.json`).
**Date:** 2026-09-07
**Dependencies:** Phases 0-9, 11-27 (Phase 27's conductor + auto-retry + crash audit are the recovery machinery this phase makes fine-grained; Phase 16's checkpointing law is what it extends; Phase 26's per-PDF loop is the loop being checkpointed; Phase 12/16's `validateExtractorResult` is the reused deterministic validator)
**Estimated Time:** 8-12 hours
**LLM Token Budget:** **$0.00** — fully deterministic. The checkpoint machinery is transport-neutral; every gate uses the existing injectable stub seams (`extractChunkFn`, `synthesisFn`, …) plus scripted spawns and `PAPER_CHASE_WORKER_FAULT` fault injection — never a real API call. The key-less suite profile is unchanged.

**Canon basis:** `Project Vision/04_orchestration_detailed.md` §1 (**Fine-grained crash resume rider, 2026-09-07, user-ratified** — this phase's founding law) + Step 11 (**fine-grained resume extension**, same date), `01_PRODUCT_VISION_AND_ARCHITECTURE.md` §4 (byte-identity — the resume line is recovery-path only, per the 2026-09-03 observability rider precedent). Backlog **B25** (user-directed 2026-09-05). Evidence: the 2026-09-04/05 production rkkp crashes — CPOP_2025 (03:41 Helsinki) and DAD_2025 (09:28:54 Helsinki) both died mid-extraction (exit 1 after extractor output-token-cap bursts on glm-5.3-flash, `attempt 1, autoRetried: true` in `.state/crash-log.jsonl`), and the DAD retry demonstrably re-extracted part-005 at 09:59 with parts 001–010 already on disk — each crash pays the partial extraction twice (~5–8 min per chunk of wall clock).

**Refinement outcomes (2026-09-07, binding — the backlog B25 item's recorded decisions, AskUserQuestion round):**

1. **Provenance store:** an additive optional `_provenance` envelope INSIDE each extraction JSON (source sha256, page-range, sourceFile, extractedAt) — a self-contained single artifact with one atomic write per chunk; legacy envelope-less JSONs fail the guard conservatively and re-extract.
2. **Scope:** per-chunk checkpoints + per-PDF stage markers, with resume coverage running THROUGH synthesis/amendment (each PDF's mini-pipeline); the finalize tail stays a re-runnable unit (cheap, mostly deterministic, cross-wiki already fingerprint-gated).
3. **Synthesis resume:** an EXPLICIT in-flight journal (stage cursor + per-page done/queue) — user choice over verify-only; the per-page `synthesis-state.json` records remain the durable cross-run skip law and are written consistently with journal entries.
4. **Crash telemetry (B25 fix direction 3, promoted from optional):** full fix — the conductor captures the fatal event's error/stack into the crash record, the stderr tail filters `LLM Call |` cost lines, and the worker mirrors the caught error to stderr.
5. **Resume UX:** one dim progress line on a PDF's first skipped work (`Resuming <file> from chunk N/M (earlier chunks already extracted)…`) — recovery-path only; normal runs stay byte-identical.

**Findings → fixes:**

1. **No per-chunk checkpoint:** the chunk loop calls `extractDocumentChunk` unconditionally (`src/commands/ingest.ts` ~1191 — no `existsSync` guard on `.state/extracted/<chunk-id>.json` anywhere in the loop), so a crashed worker's auto-retry restarts the PDF from chunk 001. **Fix:** §2.1.
2. **No stage record for the in-flight PDF:** nothing records "extraction/materialize/curation done" between chunk 001 and the per-PDF `ingestion.json` write (~1250); the only resume protection that fires is the per-page synthesis rule, which a first-time PDF never reaches — and even mid-synthesis, the retry's chunk re-extraction churn (nondeterministic LLM output shifting page fingerprints) silently defeats the existing per-page skip. **Fix:** §2.2 + §2.3.
3. **Crash records lose the exception:** the worker's catch emits a `{type:'fatal'}` event on stdout that the conductor DROPS (its comment claims the error "also lands on stderr via the worker's console.error" — it does not; `src/cli.ts` ~234-237), while worker stderr carries only `LLM Call | Tokens … | Cost …` lines, so both production records' `stderrTail` are pure cost noise and the crash causes stayed undiagnosed. **Fix:** §2.4.

---

## 1. Objective

Carry the Phase 16/27 checkpoint guarantee **inside an in-flight PDF's mini-pipeline**: a worker death at ANY point — mid-extraction, mid-materialize, mid-synthesis — auto-retries from the finest completed granularity instead of restarting the PDF. Invariants (user-ratified):

- **Data is never skipped:** a valid on-disk extraction is data, not skipped work; any invalid, stale, or fingerprint-mismatched checkpoint is conservatively recomputed. The changed-PDF re-ingest path keeps deleting stale extraction JSONs.
- **Existing law stays authoritative:** the per-PDF `ingestion.json` record (Step 11) and the per-page `synthesis-state.json` records (Step 9) are untouched and remain the durable skip law; the new state is additive in-run scaffolding, deleted at the PDF's checkpoint.
- **Byte-identical normal operation:** the resume line and crash-panel enrichment appear only on the recovery path (the 2026-09-03 observability rider precedent); a healthy run's output, progress lines, and UI are unchanged.
- **Finalize boundary respected:** resume coverage stops at each PDF's mini-pipeline; the deferred tail stays a re-runnable unit.

## 2. What to Build

### 2.1 Per-chunk extraction checkpoints

**Files:** NEW `src/state/extraction-checkpoints.ts`, `src/commands/extract-chunk.ts`, `src/commands/ingest.ts`

- `readValidExtraction(wikiDir, chunkId, expect: { sha256, pages })` — the ONE helper behind the check and the skip (they can never drift): read `.state/extracted/<chunk-id>.json`; return the parsed result only if it parses, carries a `_provenance` envelope whose `sha256`/`pages` match `expect`, and passes the existing deterministic `validateExtractorResult(json, pages)` (`src/validation/extractor-schema.ts` — the reask loop's own validator, no LLM). Any failure → `null` → re-extract.
- `extractDocumentChunk` writes `{ _provenance: { sha256, pages, sourceFile, extractedAt }, …result }` as the JSON's first key — values parsed from the document page frontmatter it already reads (`sources[0].sha256` is read instead of ignored). `ChunkExtraction.result` stays the bare `ExtractorResult`; the Materializer and validator ignore the unknown root key (the `tables?` additive-optional-field precedent).
- The ingest chunk loop consults the guard BEFORE the `extractChunkFn ?? extractDocumentChunk` seam, and the guard applies regardless of seam (a checkpoint is disk state, not an LLM concern): a valid checkpoint skips the LLM call, still pushes `result.extractions` + metrics counts from the stored JSON (the run report stays complete), and emits the dim resume line on the PDF's first skip. Document pages are still written unconditionally (cheap, deterministic — keeps the loop uniform).
- Changed-PDF stale cleanup (`ingest.ts` ~1140) refined: an old chunk JSON is deleted only when its envelope is absent or its `sha256` ≠ the NEW hash, so a crashed changed-PDF attempt's fresh checkpoints survive its own retry (deletion stays conservative — anything unreadable or stale goes).

### 2.2 Per-PDF stage markers

**Files:** NEW `src/state/pdf-progress.ts`, `src/commands/ingest.ts`

- `.state/pdf-progress.json`, entries keyed by sourceSlug: `{ hash, chunksExtracted, totalChunks, extractedSetHash, stages: { extraction, materialize, curation, synthesis? }, updatedAt }`, written via `enqueueSerializedWrite` (Phase 15 queue — same serialized-write law as every state file); the entry is REMOVED when the PDF's own `ingestion.json` record lands (the checkpoint makes it redundant).
- `extractedSetHash` = sha256 over the sorted list of all `.state/extracted/*.json` (basename + file hash) — materialize's actual input. The `materialize`/`curation` flags are recorded after those passes complete; on retry, a hash-matching entry skips them (the amendment snapshot is re-taken from disk — deterministic, and materialize never ran so pre-materialize content is still on disk).
- On retry the per-chunk guard does the chunk-level resuming on its own; the stage flags give the correct stage-entry decision and the resume line its context.

### 2.3 In-flight synthesis journal

**Files:** `src/state/pdf-progress.ts`, `src/commands/ingest.ts` (`runSynthesisStages`)

- The entry's `stages.synthesis` section is the journal: `{ stage: 'entities' | 'topics' | 'composites' | 'comparisons' | 'done', done: [<page paths>], queue: [<page paths>] }`, initialized from `partitionStage` at the PDF's synthesis entry, appended per completed page (AFTER the per-page record write, keeping journal and records consistent), advanced per stage.
- On retry the journal resumes at the cursor: done pages get ZERO synthesis calls, the queue continues from the first not-done page. The per-page `synthesis-state.json` records stay authoritative for cross-run skipping and fingerprint changes — a fingerprint mismatch overrides the journal conservatively (that page re-synthesizes).
- The pool cap 4 and deterministic page ordering are untouched; the journal only records what partitionStage already computed.

### 2.4 Crash telemetry

**Files:** `src/cli.ts`, `src/tui/ingest-conductor.ts`, `src/state/crash-log.ts`, `src/tui/ingest-screen.tsx`

- The worker's catch also `console.error(error)` — the error and stack land on worker stderr, fulfilling the conductor's existing comment (belt-and-braces with the event capture; uncaught crashes land on stderr naturally).
- The conductor STOPS dropping `fatal` events: the event's `error`/`stack` flow into the crash record as additive `fatalError`/`fatalStack` fields.
- `tailLines` filters `LLM Call | ` cost lines before the last-N cut (`CRASH_LOG_STDERR_TAIL_LINES` stays 25 — with cost noise gone, 25 real lines are ample).
- The crash panel renders `fatalError` preferentially above the stderr tail (recovery-path UI only — the 2026-09-03 rider's sanctioned surface).

## 3. LLM Call Inventory

**$0.00 — no live LLM calls anywhere in this phase.** All gates inject deterministic stubs; crash gates use scripted spawns / `PAPER_CHASE_WORKER_FAULT`; the checkpoint machinery is transport-neutral (the same `callLLM` code runs inside the worker). The key-less suite profile is unchanged (no gate requires any API key).

## 4. Technical Approval Gates

All gates live in `tests/phase-28.test.ts` (+ a `tests/phase-16.test.ts` expectation amendment) and run key-less.

| Gate | Test |
|---|---|
| 28.1 | **Checkpoint skip:** a pre-seeded valid extraction JSON (envelope sha256 === PDF hash, pages match, schema-valid) is NOT re-extracted — the `extractChunkFn` stub records zero calls for that chunk while the next missing chunk still extracts; `result.extractions` + run metrics still count the skipped chunk from the stored JSON. |
| 28.2 | **Guard conservatism:** corrupt JSON (parse failure), schema-invalid JSON, envelope hash-mismatch, pages-mismatch, and legacy no-envelope files each re-extract — data is never skipped. |
| 28.3 | **Envelope write + first-run identity:** a fresh-wiki run writes `_provenance` (sha256/pages/sourceFile/extractedAt from the document-page frontmatter) into every extraction JSON; page output, state files, and progress lines are byte-identical to pre-phase behavior when no checkpoints exist. |
| 28.4 | **Crash → chunk-level resume:** a worker death mid-extraction (scripted spawn or `PAPER_CHASE_WORKER_FAULT`) → the auto-retried worker resumes at the first missing chunk: ZERO extraction calls for checkpointed chunks, the dim resume line emitted exactly once per PDF, correct final tree. |
| 28.5 | **Changed-PDF cleanup:** the stale-JSON deletion removes envelope-mismatched extraction JSONs (stale data never feeds the Materializer) and PRESERVES envelope-hash-matching fresh checkpoints. |
| 28.6 | **Stage markers:** a crash after materialize → the hash-matching retry skips materialize and curation (spy/count assertions) and re-takes the amendment snapshot from disk; the `pdf-progress.json` entry is removed when the `ingestion.json` checkpoint lands. |
| 28.7 | **Synthesis journal:** a crash mid-synthesis → the retry synthesizes ZERO already-done pages (synthesis stub/spy count), continues from the journal cursor, and closes the journal (stage `done` / entry removed) at the PDF's checkpoint; a fingerprint-mismatched page still re-synthesizes despite a journal done-entry. |
| 28.8 | **Crash telemetry:** a fault-injected crash record carries `fatalError`/`fatalStack` from the fatal event; `stderrTail` contains no `LLM Call |` lines; the worker's stderr contains the error text; the crash panel renders `fatalError`. |
| 28.9 | **Doc gates:** vision 04 §1 rider (2026-09-07) + Step 11 extension present; this phase doc present; root `AGENTS.md` preference + dist 1.0.32 chain entries present (at closeout); `.state/phase-16-status.json` deviation note for the amended per-PDF-atomicity test expectation. |

## 5. User Acceptance Tests (UAT)

Mechanical checks are Verifier pre-UAT (gates above). Human-verifiable UAT for the Reporter:

- **UAT 28.1 (resume, perceptual):** on a scratch wiki, let an ingest reach mid-extraction and kill it (or use the fault injection), then watch the auto-retry: the dim `Resuming …` line appears once, the chunk counter continues at the first missing chunk (not 1/M), and the PDF completes with a correct result banner.
- **UAT 28.2 (crash panel, perceptual):** with auto-retry capped, force a worker crash — the crash panel now shows the actual exception text (`fatalError`) above the stderr tail, not cost lines.

## 6. Approval Checklist

- [x] Gates 28.1–28.9 green; full key-less suite green (613 passed + 16 skipped across 42 files); `tsc --noEmit` clean. (Gate 28.9's doc items verified at closeout: vision rider + Step 11 extension, root `AGENTS.md` preference + dist 1.0.32 chain entries, `.state/phase-16-status.json` deviation note.)
- [x] Compliance log: the 2026-09-07 pre-check + closeout entries present.
- [x] Vision 04 §1 rider (2026-09-07) + Step 11 extension present; root `AGENTS.md` preference + dist 1.0.32 entries present.
- [x] VERSION 1.0.31 → 1.0.32 (`scripts/launcher-entry.ts`); `npm run package:win` rebuilt via the runtime node (npm not on this shell's PATH); exe smoke-tested — the 1.0.32 runtime extracted and `ingest-worker --help` responds.
- [x] UAT 28.1/28.2 accepted by the user (2026-09-07, explicit acceptance — the machine-verifiable claims are gates 28.1–28.8; the perceptual reads stand on the same recovery paths the gates drive).
- [ ] Independent Verifier cold-check (blocked by the account usage limit during implementation; must run as a separate pass).

## 7. Integration Notes

- **VERSION bump required** (`scripts/launcher-entry.ts` 1.0.31 → 1.0.32): every touched bundle is an extracted asset — without a bump the packaged runtime silently reuses the stale extraction.
- The phase-16 gate comment "the aborted PDF (pdf-b) is re-processed whole (per-PDF atomicity — its chunks re-extract)" is SUPERSEDED by the Step 11 extension: an unchanged-PDF abort now resumes per chunk. The `tests/phase-16.test.ts` expectation is amended with a deviation note in `.state/phase-16-status.json` (tests/AGENTS.md contract).
- Stub helpers (`makeExtractChunkFnStub`, `stubExtractChunkFn`) write the envelope for fidelity with the real path; the phase-26 golden snapshot is a frozen INPUT fixture and is untouched.
- No worker-protocol changes (checkpoints are on-disk state — house precedent); no new Settings rows, prompts, or model routing; `IngestResult` shape unchanged.
