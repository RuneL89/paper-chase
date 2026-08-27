# Phase 26 — INDEPENDENT Verifier Report (Per-PDF Sequential Ingestion with Patch Amendment)

**Verified:** 2026-08-27 by the main agent in the Verifier role (cold on the gate-by-gate contract — the implementation was written by the Implementer sub-agent and integrated/debugged by the Implementer role; this pass re-read the spec and re-ran everything).
**Spec:** `Implementation Plan/PHASE_26_per_pdf_patch_amendment.md` v1.0.0; vision `04` §1 (per-PDF sequential ingestion amendment) + §3.2 (loop scope, Step 6 cadence, Step 9 amendment synthesis) + §4 (amendment mode) + §6 (patch quality-failure class), `07` §3 (patched-page preservation), `01` §4.1 (per-PDF curation cadence); `.state/phase-26-status.json` (implementer claims + 9 recorded deviations + 2 watch items).
**Verdict: COMPLIANT — all 11 gates PASS. No blockers. One honest cost finding (watch item, recorded).**

---

## 1. Per-gate verdict table

| Gate | Contract (phase doc §4) | Verdict | Evidence |
|---|---|---|---|
| 26.1 | Loop order: PDF1-extract→materialize→synthesis → PDF2→… → DOX once; materialize + curation pair exactly 3× | **PASS** | New explicit test (the sub-agent's file lacked it): three-PDF spy run proves extraction file order never interleaves, each PDF's synthesis/amendment completes inside its own pass, curation 3× each, every DOX event after the loop. `tests/phase-26.test.ts` (loop-order test). |
| 26.2 | Single-PDF equivalence: first-PDF path byte-identical (golden replay) | **PASS** | Frozen `tests/snapshots/phase-26-golden` (26 files) replays byte-for-byte from the current per-PDF pipeline. NOTE: the temporary capture harness `tests/phase-26-golden-capture.test.ts` re-froze the snapshot on EVERY run (no guard) — it was deleted after the capture and the golden regenerated from the current pipeline; the verifier's own full-suite run is green (see §2). |
| 26.3 | Delta exactness: amendment input = exactly PDF 2's items; unchanged page makes ZERO calls | **PASS** | `evidenceKeysFor`/`newEvidenceFor` (`src/materializer.ts`) — the delta is the current aggregate minus the recorded `baselineKeys`; the request carries exactly the new mention + claim, none of PDF 1's items; the unchanged-page leg asserts zero amendment calls. |
| 26.4 | Patch happy path: ops land; merged page preserves old ∪ new verbatim; `patch-amended` recorded | **PASS** | add-evidence + flag-contradiction patch lands; both claim texts verbatim (the newer inside the flag block); report finalMode `patch-amended`; the synthesis stub makes exactly one call (PDF 1 only). |
| 26.5 | Failure classes reask with exact feedback ≤3; exhaustion → FULL synthesis; never half-patched | **PASS** | Unparseable JSON reasks with the parse error; a preservation miss feeds the exact `Dropped claim (restore this exact text): …` string; attempt 2's feedback carries `=== CORRECTION REQUIRED ===`; exhaustion (gate 26.6) falls back to `strict-synthesis` — the on-disk page is touched only by a validated merged result. |
| 26.6 | Contradiction flag: marked block quoting BOTH sides; the older claim never deleted | **PASS** | Unit test (flag block inserted, older claim still verbatim on the page) + the ingest legs in 26.4/26.5; LIVE proof in UAT 26.1 — acme-corp's `> [!contradiction]` block quotes the 2023 revenue claim and the 2024 lawsuit claim verbatim. |
| 26.7 | Composite targeting: add-evidence member anchors; add-member requires covered members; Step 6b-only sources | **PASS** | `validatePatch` enforces composite-only add-member, member coverage against the composite's CURRENT members, and member-on-page duplication; member-anchored `## Parent > ### Member` resolution in `resolveAnchor`. |
| 26.8 | Curation interplay: a late merge of two synthesized pages routes the SURVIVOR to full synthesis | **PASS** | `mergeAffectedSurvivors` veto in `amendmentPlanFor` (ingest.ts) — a survivor that absorbed a pre-materialize skip-eligible page takes the full chain; zero amendment calls asserted; merged-away page deleted. |
| 26.9 | Abort/resume: PDFs 1-2 checkpointed + skipped on resume; patched pages skip-eligible | **PASS** | New explicit test: abort mid-PDF-3 → sources = [2023, 2024]; resume re-extracts ONLY PDF 3's chunk; `patch-amended` record is skip-eligible (zero re-amendments); the patched page is byte-preserved. |
| 26.10 | Suite: full key-less suite green, tsc clean, zero unenumerated regressions | **PASS** | Verifier's own run: 565 passed + 16 skipped across 38 files (37 passed + 1 skipped = e2e), zero failures; `tsc --noEmit` exit 0. The Phase 16/19/23/11 adaptations are ENUMERATED (status-file deviations) — see §3. |
| 26.11 | LIVE glm-5.3-flash: real writer → schema-valid patch → merged-page preservation end-to-end; log entry zhipu/glm-5.3-flash/synthesis-amend; self-skips key-less | **PASS (live)** | Verifier re-run GREEN: 1 call, happy path on attempt 1, merged page preserves old ∪ new, log entry asserted by the test. 1427 in / 7505 out tokens, $0.003967. ZAI key injected from `dist/.paper-chase.json` via env — never printed, never written to a file. |

## 2. Independent runs

| Run | Command | Result |
|---|---|---|
| Key-less FULL suite | `runtime-node vitest run` (no provider keys in env) | **565 passed + 16 skipped across 38 files (37 passed + 1 skipped — tests/e2e.test.ts), zero failures, EXIT 0.** The FIRST verifier run failed gate 26.2 — the pre-existing temporary capture harness `tests/phase-26-golden-capture.test.ts` re-froze the golden snapshot on every suite run (racing gate 26.2's replay); the harness was deleted (its own header says "deleted after the capture run") and the golden regenerated from the current pipeline; the re-run is green. |
| Type-check | `tsc --noEmit` | **Clean** (exit 0). |
| LIVE gate 26.11 | `ZAI_API_KEY=<injected from dist/.paper-chase.json> vitest run tests/phase-26.test.ts -t "gate 26.11"` | **PASS** (1 passed, 17 skipped; 1 live glm-5.3-flash call, $0.003967). |
| LIVE UAT 26.1 | `chase init` + `chase ingest --synthesis` in a pinned workspace (every routing slot = zhipu/glm-5.3-flash), two real PDFs | **PASS (mechanism), one honest cost finding** — see §4. 56 calls, $0.2288. |

## 3. Deviation probes (the nine recorded deviations)

| # | Deviation | Behavior verified | Spec verdict |
|---|---|---|---|
| 1 | Doc-gates 26.1 (loop order) + 26.9 (abort/resume) had no tests in the original file | Added as explicit spy/checkpoint tests; assertions trace 1:1 to the doc's gate text | **Correction of an omission** — the doc's checklist requires both gates; now proven. |
| 2 | Phase 16 gate 16.5 leg 3: a fingerprint flip now AMENDS | Injected amendmentFn patch lands; the synthesis stub makes ZERO calls for entity-0; record mode `patch-amended`; patched page carries old ∪ new | **Not a violation — the Phase 26 contract.** The flip IS a same-shape evidence growth. |
| 3 | Phase 16 gate 16.7: PDF 2's claim moved to a distinct topic type | Keeps the gate's byte-equality contract testable without an amendment interception; the resume-amendment interaction is phase-26 gate 26.9's subject | **Not a violation** — fixture scoping; the gate's intent (checkpoint + skip + byte-equality) intact. |
| 4 | Phase 16 gate 16.11: per-PDF atomicity — pdf-b (aborted mid-synthesis) is NOT checkpointed and re-processes on resume | Matches the phase-26 doc's own UAT 26.2 contract ("an abort inside a PDF's pass re-processes that PDF — checkpoints are per PDF"); fixture widened so the outage detector's per-stage >10% rate sees a 10-page stage | **Not a violation — the doc's own semantics.** The detector stays per-stage (vision `04` §6 ratified "per synthesis stage"; stages are now per-PDF). |
| 5 | Phase 19 gate 19.4: survivors take the amendment path (PDF 2's identical evidence under its own source keys) | Injected add-section patch lands all four items; `result.synthesized` stays 1; the hash invariant holds | **Not a violation** — the delta contract is source-keyed by design ("exactly the items the new PDF contributed"). |
| 6 | Phase 23 gates 23.4/23.5: amendmentFn in gate23IngestOptions (comparison add-section; others empty-op → full-synthesis fallback); resume entry expects `patch-amended`; conflict count 2 | Each assertion re-verified against the per-PDF semantics (template retries per pass; the second comparison entry is the PDF-2 patch) | **Not a violation** — the enumerated per-PDF contract. |
| 7 | Phase 11 gate 11.5: README headings now the Phase-26-era structure | The root AGENTS.md mandates the lean progressive-disclosure README (Introduction → pipeline at a glance → pipeline in detail → pointers); the gate now pins those headings | **Not a violation** — the gate tracks the documented README contract. |
| 8 | Golden snapshot regenerated | The capture harness's unguarded re-freeze (see §2) is gone; the golden now replays the CURRENT deterministic output byte-for-byte across consecutive runs | **Necessary** — the frozen artifact must match the pipeline under test. |
| 9 | Asset VERSION 1.0.26 → 1.0.27 (`scripts/launcher-entry.ts`) | The new `prompts/amendment.prompt.txt` + amendment bundle are extracted assets; the bump follows the dist-section rule verbatim | **Required by the DOX dist contract.** The packaged exe itself is not rebuilt in this phase (separate packaging step, per the phase-26 closeout). |

## 4. UAT 26.1 live run — mechanism PASS with one honest cost finding

**Run:** pinned workspace (all routing slots `{ provider: 'zhipu', model: 'glm-5.3-flash' }`), two real PDFs (report-2023 + report-2024 sharing entities), `chase ingest --synthesis`. 56 live calls, 4358s, $0.2288.

**What passed (the phase's goals):**
- Per-PDF sequencing held live: PDF 1 created every page (full synthesis), PDF 2's pass AMENDED — 6 amendment episodes (4 entity + 1 topic + 1 comparison), **5 pages patched** (`patch: 1 add-evidence, 2 edit-prose` etc.), 0 conflicts.
- The comparison page was patched with a `flag-contradiction`; acme-corp's contradiction block quotes both reports verbatim with citations; the older claim untouched.
- Merged-page preservation held: final validation clean (241 links, 0 broken; 20 citations, 0 invalid; 37 pages, 0 invalid).
- The patched pages read as ONE coherent article (the 2024 legal thread integrated into the prose — the semantic diff doing real work, not patch seams).
- The amendment log audited every episode (`attempts: 2` — one reask each, the feedback loop firing live).

**The honest finding (watch item 1 in the status file):** under the MANDATED glm-5.3-flash, the amendment calls' BILLED output tokens were 1.8–8.4× the original creation calls (john-smith 5431→25016, jane-doe 4969→41929, acme-corp 17472→48247, revenue-by-quarter 13807→25328). The phase doc's "amendment output is a small fraction of creation" cost story did NOT materialize on this model in this two-PDF run. Causes: (a) glm-5.3-flash is a REASONING model that bills hidden reasoning tokens as output (the phase doc's own §3 note anticipates ~2-3×), and (b) every episode needed one reask (attempt 2 landed) — the patch prompt misses an item on attempt 1. The mechanism goals all held regardless. Recommendation: re-measure the token win on a non-reasoning cheap-tier model and/or after a prompt-polish pass that cuts the reask rate.

## 5. Compliance verdict (vision law, cold-read)

- **04 §1 per-PDF loop** — implemented 1:1: chunk → extract → materialize (+ per-PDF curation pair) → synthesize-or-AMEND per PDF; per-PDF checkpoint only when the PDF's FULL pass completes; DOX/workspace/cross-wiki/Updater deferred to once after the loop; batch pipeline removed, not flagged (single code path).
- **04 §3.2 Step 9 amendment synthesis** — the Amendment Writer reads the existing page + ONLY the delta; the LLM does the semantic diff; deterministic parse → validate → apply → enforce → merged-page preservation (old ∪ new) — never half-patched; reask ≤3 with exact errors; exhaustion → normal full synthesis (the universal fallback, logged loudly); `patch-amended` is skip-eligible; kind/shape changes and curation-merge survivors take full synthesis.
- **04 §4 amendment mode + §6 failure classes** — the closed op vocabulary (add-evidence/add-section/add-member/edit-prose/flag-contradiction) has NO delete and NO rewrite-page; unparseable output, unknown/duplicate anchors, edit-prose non-unique old-text, and merged-page preservation misses are all quality failures that reask then fall back.
- **07 §3 patched-page preservation** — the preservation check runs over the MERGED page against the union of pre-patch and new items, verbatim — verified by gates 26.4/26.5 and live UAT 26.1.
- **01 §4.1 per-PDF curation** — the curation pair runs inside every PDF's materialize (loop-order gate counts 3× for 3 PDFs); sticky decisions make steady state cheap; a late merge re-synthesizes only the survivor (gate 26.8).
- **Budget + model pinning** — every live call was glm-5.3-flash (routing pinned in the UAT workspace config AND asserted in the live gate's log entry); total live spend $0.2328 of the $15.00 cap (pause at $12.00) — 1.6% of cap.
- **Packaging** — asset VERSION bumped 1.0.26 → 1.0.27 for the new extracted prompt + amendment bundle; root AGENTS.md documents the bump.
- **DOX pass** — root, `Implementation Plan/` (+ BACKLOG + master index status), `src/`, `tests/`, `prompts/` indexes updated; compliance-log entries filed (pre-check + closeout).

## 6. Findings

1. **(watch item, honest)** The glm-5.3-flash token finding above — the amendment mechanism is correct and the data goals hold; the COST story depends on the model and the reask rate. See §4.
2. **(non-blocking)** The live run's 9-of-56 repair rate triggered the Phase 12 prompt-quality warning (amendment reasks + 2 DOX reasks) — expected for a first live pass of a new prompt; the reask loop absorbed every case.
3. **(fixed during verification)** The temporary golden-capture harness was re-freezing the frozen snapshot on every suite run — deleted; the golden now replays the current pipeline deterministically.
