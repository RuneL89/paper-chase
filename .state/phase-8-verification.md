# Phase 8 Verification Report — Multi-PDF Compounding and Incremental Ingestion

**Verifier:** Verifier sub-agent (cold check; no implementation authored by this agent)
**Date:** 2026-07-21
**Spec:** `Implementation Plan/PHASE_08_multi_pdf_compounding.md` (v1.0.0)
**Claims file:** `.state/phase-8-status.json` (status: complete, gates 8.1–8.6 passed, cost $0.38)

---

## 1. Fixture Verification

| Check | Result | Evidence |
|---|---|---|
| `test-pdfs/golden-master-2.pdf` exists | PASS | 1935 bytes, created 2026-07-21 |
| SHA-256 matches recorded hash | PASS | `fd6de6f2ecfb457b2a4cb07c2f0374df98d6a6a1387c3ce1ad52e25b9857fbd2` — matches test-pdfs/AGENTS.md and phase-8-status.json |
| 2 pages | PASS | pdfjs `numPages === 2` (independent extraction by verifier) |
| John Smith in NEW context | PASS | Page 1: "John Smith testified before the Delaware Court of Chancery" (golden-master.pdf context is annual results/CEO presentation) |
| Jane Doe introduced | PASS | Page 1: "Jane Doe, General Counsel of Acme Corp"; page 2 settlement negotiations |
| New claim type (legal) | PASS | Page 1: class-action lawsuit alleging misstated FY2023 revenue; page 2: $3.1M settlement — no legal content in golden-master.pdf (financial results only) |
| `golden-master.pdf` untouched | PASS | SHA-256 `1e4f2cbec74a83bf8ae56f3a45035827ec405bd02989d6b38f08929b80ac339d` (matches Phase 0 record); absent from `git diff --stat` |
| Generator script documents known content | PASS | `scripts/create-golden-master-2.ts` header contains full verbatim text of both pages; matches extracted text |

## 2. Gate Results (independent run)

`npx vitest run tests/phase-08.test.ts` run independently by this verifier: **11/11 passed** (4.0s). Full `npm test`: **23 files, 264 passed, 1 skipped, 0 failed** — exactly matching the status claim and tests/AGENTS.md verification line.

| Gate | Test | Result | Pass criterion preserved? |
|---|---|---|---|
| 8.1 New PDF adds new entities | `gate 8.1: new PDF adds new entities to wiki` | PASS | Yes — asserts `entities/people/executives/jane-doe.md` exists after two stub-driven ingests |
| 8.2 Existing entity pages updated | `gate 8.2: new PDF updates existing entity pages` | PASS | Yes — asserts page grew AND contains `golden-master-2.pdf` |
| 8.3 Unchanged PDFs skipped | `gate 8.3: unchanged PDFs are skipped on re-ingest` | PASS | Yes — spies console.log wired to onProgress; asserts stringContaining('Skipping') and exact `'Skipping golden-master.pdf (unchanged)'` |
| 8.4 Rolling memory reflects both PDFs | `gate 8.4: rolling memory contains entities from both PDFs` | PASS | Yes — asserts both slugs in `memory.entities` |
| 8.5 Manual edit conflict detected | `gate 8.5: manual edit conflict is detected` | PASS | Yes, and STRONGER than spec — also asserts the exact §2.5 JSON shape (`type: 'manual-edit'`, page path, reason string, timestamp) and that the journalist's edit survives the ingest |
| 8.6 No duplicate entity pages | `gate 8.6: no duplicate entity pages for same slug` | PASS | Yes — recursive readdir instead of globSync (no glob dep in project); assertion identical |

Supplementary tests (all passing) cover spec §2.2/§2.5/§5.1 details beyond the gates: tool's own writes never flagged as conflicts; removed-PDF warning keeps derived pages; changed PDF replaces stale extraction JSON; changed-PDF language-drift warning (vision 04 §9.3) with `language` recorded in `.state/ingestion.json`; metrics.json shape (newPdfs, newEntities, updatedEntities with addedMentions, conflicts, totalCost).

The gate restructuring (live `ingest('test-wiki')` → LLM-free temp workspace + injected `extractChunkFn` stub) is the accepted pattern per tests/AGENTS.md §Local Contracts ("when a gate's literal test code cannot run on this platform, the restructured test must still verify the gate's pass criterion and the deviation must be recorded"). All deviations are recorded in phase-8-status.json. Pass criteria are preserved in every case.

## 3. Spec Detail Inspection

**`src/commands/ingest.ts`:**
- SHA-256 skip with log: line 428–432 — `progress(`Skipping ${fileName} (unchanged)`)`; result.skipped tracked. CLI wires onProgress → console.log (cli.ts:75). PASS.
- Changed-PDF re-process: lines 437–441 (language-drift warning), 469–480 (old document pages AND stale `.state/extracted/<chunk>.json` removed before re-chunking). PASS.
- Removed-PDF warning without deletion: lines 403–413 (main path) and 374–388 (empty-raw/ early-return path). Derived pages kept — verified by supplementary test. PASS.
- Stored hash updated after programmatic writes: lines 764–779 — every page written this run is re-hashed FROM DISK after synthesis, so the recorded hash reflects the tool's final bytes (synthesis output included). PASS.

**`src/materializer.ts` (update mode):**
- Merge = re-derivation from the full `.state/extracted/*.json` set (lines 184–340). Mentions appended across chunks; dedupe key `page|context|source|pages` (line 92) keeps identical text on different pages — spec's "no dedup" intent preserved. Relationships deduped by a SUPERSET of (subject,predicate,object) (line 102). Claims deduped by a SUPERSET of text (line 112). Sources accumulate per-mention into the page frontmatter (gate 8.2 proves `golden-master-2.pdf` lands on john-smith.md). PASS.
- Conflict detection: `checkPageConflict` (lines 159–173) — hash mismatch vs `.state/ingestion.json` `pageHashes` → skip + `logManualEditConflict` (entity pages lines 386–392; topic pages lines 420–426, an extension). Conflicted pages are excluded from `entityPages`/`topicPages` so the Synthesis Writer cannot overwrite a manual edit either — a defense the spec implies but does not state. PASS.
- Conflicts.json entry shape matches §2.5 exactly (src/state/conflicts.ts:118–127; asserted byte-shape in gate 8.5). PASS.

**`src/state/rolling-memory.ts`:** entities/mentionCount/folders/sources/topics all rebuilt after materialization (materializer.ts:483–496, saveRollingMemory line 568); `readFullRollingMemory` added for the metrics diff. PASS (§2.4).

**`src/tui/compounding-log-screen.tsx` (§5.1):** renders every mockup field — Run timestamp, New PDFs (count + names), New Entities (title + folder), Updated Entities (title + `+N mentions`), Conflicts (count + per-entry lines from conflicts.json), Total Cost (`$X.XXXX`). Reads `.state/metrics.json` + `.state/conflicts.json`. Scrollable (12-line viewport, Up/Down). Non-TTY static fallback per src/AGENTS.md Ink 7 conventions. PASS.

**Menu (§5.3):** `{ label: 'View Ingestion Log', value: 'compounding-log' }` present (menu.tsx:23); menu test updated to 14 items. PASS.

**Post-ingest wiring (§5.2):** app.tsx:43–46 routes IngestScreen's `onViewReport` to `compounding-log` with the ingested wiki; ingest-screen.tsx:196 calls it on success. Deviation from the literal "Ingestion Complete! / Viewing results..." interstitial is real and matches the Phase 4 immediate-navigation precedent. PASS (deviation accepted).

## 4. Deviation Audit (`.state/phase-8-status.json`)

All 11 deviations verified against the code:

1. Gates 8.1/8.2/8.4/8.5/8.6 stub-restructured — REAL (tests/phase-08.test.ts:149–173), acceptable.
2. Gate 8.3 via onProgress — REAL (ingest.ts:317; Phase 1 precedent confirmed in tests/AGENTS.md), acceptable.
3. Gate 8.6 readdir instead of globSync — REAL (test lines 194–208; no glob dep in package.json), acceptable.
4. §5.2 direct navigation — REAL (app.tsx:43–46), acceptable.
5. Re-derivation merge with superset dedupe keys — REAL (materializer.ts:89–117), acceptable; "no detail is lost" (vision 01 Principle 3) preserved.
6. Removed-PDF warning on empty-raw path — REAL (ingest.ts:374–388), acceptable extension.
7. Conflict detection covers topic pages — REAL (materializer.ts:422–426), acceptable extension (vision 04 Step 6 says "the page").
8. Untracked pages update normally and begin tracking — REAL (materializer.ts:167–169), acceptable; no false conflicts on first Phase-8 run (supplementary test proves it).
9. UATs run in temp workspace — VERIFIED that `wikis/test-wiki` is a committed fixture (`git ls-files wikis/` lists it) and CLI supports `-w`; live output not re-verifiable by this agent but code paths are consistent. Acceptable.
10. Cost sums `.state/llm-calls.json`, 4-decimal display — REAL (metrics.ts:83–106; screen line 133). Extractor calls are console-only — totalCost can understate a run's true spend; disclosed in the status file. Acceptable.
11. Coordination with concurrent Phase 9/10 agents — REAL (shared files carry all three phases' code; full suite green). Acceptable.

**Unrecorded nits found by verifier (cosmetic, not gate-affecting):**
- The phase doc §2.2 literal log string is `"Skipping {filename} (unchanged)."` with a trailing period; the implementation emits it WITHOUT the period (ingest.ts:429), and gate 8.3's exact-string assertion mirrors the implementation. Pass criterion ("Console shows 'Skipping'") unaffected.
- UAT 8.1's expected console line "Processing golden-master-2.pdf" is emitted as "Extracting text from golden-master-2.pdf..." — semantically equivalent, not literal.
- No dedicated `tests/tui/compounding-log-screen.test.tsx` (peer screens validation-report/agents-review/structural-changes each have one). §5.1 defines no test gate and the screen's data source is covered by the metrics supplementary test + menu test, so this is a coverage observation, not a failure.

## 5. Compliance Verdict

Checked against vision 01 §2 Principle 3, §4.2, §4.3 and vision 04 §3.1, §3.2 (Step 6 update mode + conflict rule), §5, §9.3:

- Incremental ingestion (skip/new/changed/removed) matches 01 §4.2 / 04 §3.1. Removed-PDF "marked as stale" (vision) is implemented as warn-and-keep per the phase doc's explicit, more conservative contract — consistent with 01 §5 (human reviews structural changes after the fact); the pre-implementation compliance log entry (2026-07-21 00:06) already ruled this COMPLIANT.
- Update mode + hash-mismatch conflict rule matches 04 §3.2 Step 6 exactly, including skip-not-overwrite.
- Rolling memory shape and update timing match 04 §5.
- Changed-PDF language-drift warning matches 04 §9.3.
- Compounding (01 Principle 3): mentions never lost, sources accumulate, existing pages grow — proven by gates 8.1/8.2/8.4/8.6.

**Verdict: COMPLIANT.** No contradictions found.

## 6. Entanglement Check (Phase 9 / Phase 10 in the same tree)

- Phase 9's structural-change hook lives inside `materialize` (materializer.ts:498–566) and Phase 10's engine dispatch lives inside `ingest` (ingest.ts:327–336, 447–465). Both are additive; Phase 8 gates and the full suite pass with them in place. No Phase 8 deliverable is broken.
- Phase 8 tests do not depend on Phase 9/10 features (stubs inject only `extractChunkFn`; engine defaults to pdfjs).
- phase-9-status.json's "Phase 8 incomplete" deviation was written before Phase 8 landed and is stale history, not a current defect; phase-8-status.json documents the user-sanctioned coordination.
- One cross-phase inconsistency to note: tests/AGENTS.md's ownership list does not yet carry a `phase-08.test.ts` line (it jumps from phase-07 to phase-09), though the 14-item menu note mentions Phase 8. Documentation gap only.

## 7. Approval Checklist

- [x] All 6 technical gates pass (independently re-run: 11/11; full suite 264 passed / 1 skipped)
- [x] UAT steps documented with expected output; live execution claimed and consistent with code (two literal-string nits noted above)
- [x] New PDFs add new entities / update existing pages / unchanged skipped / rolling memory reflects all / conflicts logged / no duplicates
- [x] TUI Ingestion Log shows what changed in the last run (screen + menu + post-ingest wiring verified)
- [x] Cost $0.38 < $5.00 (claimed; consistent with tests/AGENTS.md verification counts)

## Overall Recommendation: **APPROVE**

All six gates pass on independent re-run, every claimed deviation is real and acceptable, the implementation is vision-COMPLIANT, and no Phase 9/10 entanglement damages Phase 8 deliverables. The three cosmetic nits (log-string trailing period, "Processing" vs "Extracting text" wording, missing dedicated screen test, tests/AGENTS.md ownership-line gap) are recommended as follow-ups but do not block approval.
