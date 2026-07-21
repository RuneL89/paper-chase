# Phase 10 Verification (Verifier sub-agent, cold compliance check)

Date: 2026-07-21
Spec: `Implementation Plan/PHASE_10_pdf_engine_ab.md` v1.0.0
Claims under review: `.state/phase-10-status.json` ("gates-complete", gates 10.1–10.8 passed)
Method: independent file reads, hash checks, live extraction comparisons, an independent full `npm test` + `npx tsc --noEmit` run, and a targeted end-to-end precedence experiment. No project source/test/fixture files were modified.

---

## Gate-by-gate results

### Gate 10.1 — Frozen Surface Preserved: PASS
- `src/extraction/pdf.ts` exports `extractText(pdfPath, startPage?, endPage?): Promise<string>` and `getPageCount(pdfPath): Promise<number>` with unchanged signatures (plus additive `extractDocumentPages` and re-exports — allowed by §3.1 "internal addition allowed").
- `git show HEAD:src/extraction/pdf.ts | diff - src/extraction/pdf-pdfjs.ts` → IDENTICAL (faithful verbatim move).
- Independent byte-identity check (temp script outside the repo, `PDF_ENGINE` unset): live `extractText` on both golden masters equals `tests/snapshots/*-pdfjs.txt` byte-for-byte; per-page `extractText(pdf, n, n)` equals `tests/snapshots/*-pdfjs-pages.json`; page counts 3 and 2 match. Result: `text-identical: true`, `pages-identical: true` for both documents.
- Snapshot immutability cannot be proven from git (the `tests/snapshots/` directory is new/untracked), but the snapshots are consistent with the current pdfjs output, and the pdfjs implementation is byte-identical to the pre-refactor file, so the claim is sound.

### Gate 10.2 — Existing Extraction Gates Under Both Engines: PASS
- `npx vitest run tests/phase-10.test.ts` (verifier's own run): **15 passed, 0 skipped**. The opendataloader variants ran for real (Temurin 21.0.11 on PATH) — no self-skips.
- Test code mirrors infrastructure Gate 0.1/0.2 assertions and asserts `pages: "1-3"` provenance frontmatter via hermetic temp-workspace ingests under both engines (LLM-free, `extract: false`).

### Gate 10.3 — Page Semantics Agree: PASS
- Test iterates all 6 corpus fixtures + both golden masters asserting equal page counts and per-page non-empty agreement across engines; ran for real (not skipped).
- Engine design supports this: `pdf-opendataloader.getPageCount` reuses the pdfjs count and `runBatch` throws on page-count mismatch — provenance (vision `06` §3, `pages: "N-M"`) is defended in code, not just in tests.

### Gate 10.4 — Engine Selection Precedence: UNIT PASS / PLUMBING FAIL (ISSUE 1)
- `resolvePdfEngine` itself is correct: flag > env > settings > default `'pdfjs'`; unknown values throw `Unknown PDF engine '<x>'. Valid engines: pdfjs, opendataloader.`; resolution reads its inputs per call (no caching); `src/extraction/pdf.ts` reads `process.env.PDF_ENGINE` at call time.
- **However, the ingest plumbing does not honor the resolved engine on the pdfjs path.** In `src/commands/ingest.ts` (~line 447), the `opendataloader` branch passes the resolved engine explicitly (`extractDocumentPages(pdfPath, pdfEngine)`), but the `pdfjs` else-branch calls the dispatcher `extractText(pdfPath, n, n)`, which re-resolves from `process.env.PDF_ENGINE` ONLY (by design of the frozen module). Consequence: **`--pdf-engine pdfjs` cannot override `PDF_ENGINE=opendataloader`** — the one flag-vs-env conflict combination where the flag must win (phase doc §3.1: "Resolution order (highest wins): CLI flag → env var → settings file → default 'pdfjs'").
- Verifier's empirical proof (temp script, hermetic temp wikis, `extract: false`, LLM-free):
  - default, env unset → chunk contains pdfjs 4x3 table header `| Quarter | Revenue | Growth |`: **true** (pdfjs used)
  - `PDF_ENGINE=opendataloader` → **false** (opendataloader used; its blank line breaks the table run, per the A/B report's recorded golden-master divergence)
  - `PDF_ENGINE=opendataloader` + `pdfEngine: 'pdfjs'` (the CLI-flag path) → **false** (opendataloader used despite the explicit flag)
  - `resolvePdfEngine({flag:'pdfjs', env:'opendataloader'})` correctly returns `'pdfjs'`, so the loss happens between resolution and extraction.
- Severity: moderate. A user who explicitly passes `--pdf-engine pdfjs` (or selects pdfjs in the TUI while the env var is set) silently gets opendataloader — including its Java requirement, its table regressions, and JVM spawns. The fix is small (route the pdfjs branch through `extractDocumentPages(pdfPath, 'pdfjs')`, whose per-page loop is byte-identical to the current loop). Gate 10.4's test does not cover this because it tests `resolvePdfEngine` in isolation.

### Gate 10.5 — Missing-JRE Handling: PASS
- `MISSING_JAVA_MESSAGE` (engine.ts) states both the Java 11+ requirement AND the pdfjs alternative verbatim: "PDF engine 'opendataloader' requires Java 11+. Install a JRE and ensure 'java' is on PATH, or switch the PDF engine to pdfjs (default, no system dependencies)."
- The JRE gate runs before the batch cache in `extractAllPages`, so a stale cache can never bypass it. Default resolution never probes Java and never errors (verified in test: env unset extraction succeeds with the probe forced to false). Test simulates absence two ways (PATH override + forced probe override). No crash/hang paths observed.

### Gate 10.6 — A/B Corpus Integrity: PASS
- `test-pdfs/ab-corpus/` = 6 fixtures + `manifest.json` + `README.md` (spec §3.6 satisfied, including the optional scanned page).
- Verifier recomputed SHA-256 of all six fixtures: all match `manifest.json` entries and `.state/phase-10-status.json` `abCorpusSha256` exactly.
- Both engines extract every fixture without throwing (tests ran for real).

### Gate 10.7 — Comparison Harness Emits a Report: PASS
- `.state/pdf-engine-ab-report.md` + `.json` exist with all required sections per fixture: expected-string presence, table fidelity, diacritics integrity, page-boundary alignment, wall time, plus JVM startup overhead and a Recommendation.
- Number sanity-check (verifier arithmetic on the report):
  - pdfjs per-doc times 304+17+21+10+16+4+28+16 = **416 ms** — matches reported total (JSON: 415.61).
  - opendataloader 522+588+558+505+669+294+602+601 = **4339 ms** — matches (JSON: 4338.67).
  - 4339/416 = **10.4x** — matches the recommendation text.
  - JVM startup ~227 ms is consistent with first-doc (522) minus steady-state (~294) overhead.
  - Failure counts consistent: 2 opendataloader table-fidelity FAILs visible in the md (tables.pdf bordered 3x3-detected vs 4x3-expected; golden-master.pdf quarter table 3x3 vs 4x3), 0 pdfjs failures.
- Gate 10.7's test runs the harness as a subprocess on a 2-fixture subset into a temp dir (deviation from the letter of the gate, justified by scripts/AGENTS.md no-import rule; pass criterion preserved). Ran for real.

### Gate 10.8 — Full Suite Green Under Default Engine: PASS
- Verifier's independent `npm test`: **23 files, 264 passed + 1 skipped (265)** in 113.68s — matches tests/AGENTS.md's recorded counts exactly. The 1 skip is the pre-existing Phase 0 gate 0.4 pattern, not a Phase 10 skip.
- Verifier's independent `npx tsc --noEmit`: clean (exit 0).
- Note: the suite ran with the repo's API key present, so the pre-existing Phase 2 live gates made ~12 LLM calls (~$0.13). This is standard keyed-suite behavior from earlier phases, not Phase 10 spend — all Phase 10 artifacts (tests/phase-10.test.ts, scripts/compare-pdf-engines.ts, scripts/create-ab-corpus.ts, both engine modules) are LLM-free (verifier grep: no anthropic/openai/LLM-API usage; only temp-dir names containing "llm-wiki").

---

## Non-gate checklist items (phase doc §6)

| Item | Result |
| --- | --- |
| All 8 technical gates pass | 7/8 clean; 10.4 has the plumbing-level precedence bug above |
| All 4 UAT steps pass | USER-PENDING (expected; not a failure) |
| Frozen Phase 0 surface unchanged | PASS |
| pdfjs remains default absent configuration | PASS (verified live: env unset → pdfjs output) |
| Engine selectable from CLI/env/settings/TUI | PRESENT everywhere, but CLI flag loses to env in the flag=pdfjs/env=opendataloader case (Issue 1) |
| Missing-JRE path yields documented error, never crash | PASS |
| Page semantics identical across engines | PASS |
| `renderTablesAsMarkdown` interplay decision implemented + documented | PASS (Option A, documented in status file with token-preservation test evidence; engine uses `format: 'text'` so no double-processing) |
| A/B corpus + manifest committed; golden masters untouched | PASS — `git status --porcelain -- test-pdfs/` shows only `M test-pdfs/AGENTS.md` (DOX update) + the new untracked `ab-corpus/` and Phase 8's `golden-master-2.pdf`; both golden masters' SHA-256 match the hashes recorded in `test-pdfs/AGENTS.md` (`1e4f2cbe…`, `55d040c7…`) |
| A/B report produced; default-engine decision recorded | Report PASS; recommendation KEEP-pdfjs recorded in status file; the actual default-engine decision is user-pending at UAT 10.3 (expected — spec §3.6 makes it a user decision) |
| LLM cost $0 (gates) | PASS — status `llmCost: "$0.00"`; Phase 10 artifacts are LLM-free |

## DOX consistency

- `src/AGENTS.md`: accurately describes the dispatcher (env-only resolution explicitly documented), `pdf-pdfjs.ts` (verbatim move), `pdf-opendataloader.ts` (batch path, cache, JRE gate), `engine.ts`, the CLI flag, settings schema/screen row, and the ingest `pdfEngine` option. One inaccuracy flows from Issue 1: the ingest entry claims resolution "flag → PDF_ENGINE env → settings → 'pdfjs'" governs the run, which is not true on the pdfjs branch.
- `tests/AGENTS.md`: phase-10.test.ts description accurate; verification counts (23 files, 264 passed + 1 skipped; Phase 10: 15 tests) match the verifier's observed runs exactly.
- `scripts/AGENTS.md`: accurately describes `compare-pdf-engines.ts` (incl. subset/report/json flags and the direct-execution guard) and `create-ab-corpus.ts`.
- `test-pdfs/AGENTS.md`: accurately records the ab-corpus contract and golden-master hashes (verified against live SHA-256).

## Vision consistency

- `Project Vision/01` §5 names `pdfjs-dist` as the extraction implementation — remains true for the default configuration; the second engine was pre-ratified by the 2026-07-20 user amendment (recorded in root AGENTS.md preferences and the compliance log's 10:00 pre-check). No new contradiction.
- `Project Vision/06` §3 page-range provenance is defended by Gate 10.3 and by the engine's hard page-count-mismatch error.
- No vision contradictions found beyond what the compliance log already records.

## Discrepancies vs implementer claims

1. `gatesPassed: ["10.4"]` overstates coverage: the unit resolution passes, but the ingest plumbing silently ignores an explicit `pdfjs` flag when `PDF_ENGINE=opendataloader` (empirically demonstrated above). Not recorded in the status file's deviations.
2. Everything else in the status file (test counts, report headline numbers, corpus hashes, Option A rationale, JVM timings) was independently confirmed as accurate.

---

## Verdict: ISSUES FOUND

One functional bug must be fixed before Phase 10 can be called gate-complete:

1. **Gate 10.4 / §3.1 precedence violated in ingest plumbing** — `src/commands/ingest.ts` pdfjs branch routes through the env-only dispatcher, so `--pdf-engine pdfjs` (or a TUI/settings pdfjs selection) loses to `PDF_ENGINE=opendataloader`. Proven end-to-end: with `PDF_ENGINE=opendataloader` and `pdfEngine: 'pdfjs'`, the ingested chunk shows opendataloader output (missing the pdfjs `| Quarter | Revenue | Growth |` 4x3 table header). Suggested fix: use `extractDocumentPages(pdfPath, 'pdfjs')` on the pdfjs branch (byte-identical per-page loop, respects the resolved engine). Tests should add a flag-vs-env conflict case.

Minor (non-blocking): the `src/AGENTS.md` ingest entry repeats the incorrect precedence claim and should be corrected with the fix.

UAT 10.1–10.4 and the default-engine decision remain user-pending, as expected by the spec.

---

## Re-check — 2026-07-21 02:15 (Issue 1 / Issue 2 resolution)

**Note on authorship:** the Verifier sub-agent stalled on resume (no activity ~20 min, same model-request hang pattern as the Implementer) and was stopped; this re-check was performed by the orchestrator using the Verifier's own reproduction recipe, and is labeled as such. The independent first-pass verification above stands as the maker/checker separation for this phase.

**Fix verified:**

1. `src/commands/ingest.ts` no longer imports the env-only `extractText`/`getPageCount` dispatcher — extraction routes through `extractDocumentPages(pdfPath, pdfEngine)` with the resolved engine for BOTH engines (pdfjs branch = the byte-identical per-page loop; page count derived from the extracted pages, which both engines agree on per Gate 10.3). Confirmed by reading the diff.
2. New automated test: "gate 10.4: explicit pdfEngine flag beats PDF_ENGINE env end to end (ingest)" in `tests/phase-10.test.ts` proves both conflict directions using the quarter-table shape evidence from the A/B report.
3. Independent reproduction of the ORIGINAL failing scenario (fresh script, hermetic temp wikis, golden-master.pdf, `extract: false`):
   - `PDF_ENGINE=opendataloader` + `pdfEngine: 'pdfjs'` → progress `PDF engine: pdfjs`, chunk CONTAINS `| Quarter | Revenue | Growth |` (pdfjs 4x3 table) — **PASS** (was FAIL pre-fix).
   - `PDF_ENGINE=pdfjs` + `pdfEngine: 'opendataloader'` → progress `PDF engine: opendataloader`, chunk does NOT contain the 4x3 header (opendataloader 3x3 shape) — **PASS**.
   - No config at all → `PDF engine: pdfjs`, pdfjs 4x3 header present (default path intact) — **PASS**.
4. `src/AGENTS.md` ingest bullet reworded to describe resolved-engine end-to-end routing (Issue 2).
5. Test runs: `npx vitest run tests/phase-10.test.ts` = **16/16 passed, 0 skipped** (all JRE-gated tests ran for real under Temurin 21); full `npm test` = **23 files, 265 passed + 1 skipped**; `npx tsc --noEmit` = **clean**.

**Verdict: Issue 1 RESOLVED, Issue 2 RESOLVED. Gate 10.4 now genuinely passes. PHASE 10 GATES VERIFIED — 8/8.** Remaining open items are the user-pending UAT 10.1–10.4 and the default-engine decision (phase doc expects these to be user-decided).
