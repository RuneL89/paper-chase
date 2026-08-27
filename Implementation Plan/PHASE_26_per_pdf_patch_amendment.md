# Phase 26: Per-PDF Sequential Ingestion with Patch Amendment (Option B, Patch Output)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-026`
**Version:** 1.0.0
**Status:** Implemented (all 11 gates green 2026-08-27; live gate 26.11 against glm-5.3-flash $0.004)
**Date:** 2026-08-26
**Dependencies:** Phases 0-9, 11-25 (Phase 25's class-6 composites and `sourceMap` are required for member-scoped patch targeting)
**Estimated Time:** 10-14 hours
**LLM Token Budget:** $15.00 hard cap, pause at 80% = $12.00 (tripled 2026-08-27 from the initial $5.00 by user directive) — **glm-5.3-flash ONLY** for every live call (user directive 2026-08-27); expected actual spend under $1. All gates except the designated live gate 26.11 stay LLM-free (injected stubs); the live gate self-skips without `ZAI_API_KEY`, so the key-less suite profile is unchanged.

**Canon basis:** `Project Vision/04_orchestration_detailed.md` §1 (per-PDF sequential ingestion amendment), §3.2 (loop scope + Step 6 per-PDF cadence + Step 9 amendment synthesis), §4 (amendment mode), §6 (patch quality-failure class), `07_validation_and_quality.md` §3 (patched-page preservation), `01_PRODUCT_VISION_AND_ARCHITECTURE.md` §4.1 (per-PDF curation cadence). Backlog **B24** (user-directed 2026-08-26). Evidence: cost analysis of the 43-report 2025 RKKP corpus — under batch synthesis, every already-dense page is re-EMITTED in full whenever any later PDF adds evidence (output cost scales with accumulated page size); under patch amendment, output cost scales with the NEW evidence per PDF (measured example: a second report amending a hospital entity page emits ~1-1.5k tokens instead of re-emitting ~4-7k). User decisions 2026-08-26 (AskUserQuestion round): per-PDF is the NEW DEFAULT pipeline shape; patch output only (no full-page-amendment intermediate stage); curation runs per PDF inside the loop; this phase is scheduled AFTER Phase 25.

---

## 1. Objective

Change the ingest run shape from "extract all → materialize once → synthesize once" to a **per-PPDF loop**: each PDF runs chunk → extract → materialize (with curation) → synthesize-or-AMEND, completes, checkpoints, and only then does the next PDF begin. DOX, the workspace pass, Cross-Wiki Discovery, and the AGENTS.md Updater stay deferred to once after the loop.

When a PDF's new evidence changes an existing page's aggregate AND that page already carries a successful synthesis, the page is NOT re-emitted in full. The **Amendment Writer** reads the existing page plus ONLY the new evidence and emits a **structured patch**; deterministic code validates, applies, and preservation-checks the MERGED page. The LLM performs the semantic diff (what is new, what restates existing content, what contradicts it) — deterministic code never text-diffs (user requirement: near-synonymous restatements must be recognized as duplicates, which lexical diff cannot do).

Invariants (user-ratified):
- **Data can never be lost or half-applied**: a page is replaced on disk only by a merged page that passed the preservation check over old ∪ new evidence; every patch failure path ends in normal full synthesis, never a partial page.
- **The first PDF on an empty wiki is byte-identical to today** — normal full synthesis; the amendment path exists only where a synthesized page of the same shape already exists.
- **DOX / cross-wiki / updater semantics unchanged** — they run once, over the final pages, exactly as today.

## 2. What to Build

### 2.1 The per-PDF loop

**Files:** `src/commands/ingest.ts` (loop restructure), `src/commands/ingest.ts` progress reporting

- Loop body per selected PDF (hash-skip of unchanged PDFs unchanged): chunk → extract chunks (sequential, rolling memory) → materialize (aggregation over the accumulated `.state/extracted/` set; Step 6b disambiguation; the two curation calls; page writes) → synthesis stage (pool cap 4, per PDF) with the amendment path of §2.3 → per-PDF checkpoint (PDF recorded ingested; synthesis-state records as pages complete — both existing Phase 16 behaviors land unchanged).
- After the loop: content validation, DOX Writer bottom-up chain, workspace pass, Cross-Wiki Discovery (≥2 wikis), AGENTS.md Updater, end-of-run state write — once, in today's order.
- **Curation per PDF (user decision 2026-08-26):** the two curation calls run inside every PDF's materialize. Sticky decisions (Phase 21) make this cheap in steady state — settled identity never re-litigates; the calls still run (their input includes the grown candidate set), and a late merge re-synthesizes only the affected pages through the normal changed-fingerprint path (full synthesis, not patch — a curation merge changes page shape).
- A curation merge that unions two pages where BOTH carry synthesis records takes the full-synthesis path for the survivor (shape change ⇒ not patchable); this is the designed interaction, not a fallback.

### 2.2 New-evidence delta (deterministic)

**Files:** `src/state/synthesis-state.ts` (record extension), `src/materializer.ts` (delta export)

- The synthesis-state record gains the prior aggregate's evidence-key set (the same composite keys the dedupe functions already compute: `page|context|source|pages` etc.).
- For a changed-fingerprint page, the new-evidence set = current aggregate items whose keys are absent from the recorded baseline. (Alternative implementation — replaying the aggregation minus the current PDF's extraction files — is acceptable if the key-set storage proves bulky; the delta CONTRACT is what the gates pin: "exactly the items the new PDF contributed".)
- Unchanged fingerprint ⇒ existing skip rule, byte-for-byte (no LLM call, no rewrite).

### 2.3 The Amendment Writer (patch output)

**Files:** NEW `prompts/amendment.prompt.txt`, NEW `src/agents/amendment.ts`, NEW `src/llm/patch.ts` (schema + applier)

- **Input:** the existing page content (frontmatter + body), the page kind (entity/topic/composite/comparison), the new-evidence items with their citation-map entries (Phase 18 slot discipline: the model is shown the exact `[^srcN]` keys for the new items and may not invent others), the related-entities slug list (Phase 17), and the Phase 7 `{languageDirective}` (new prose in the output language; new Layer-2 items verbatim in the source language).
- **Output (strict JSON):** `{ "operations": [ … ] }` over a SMALL, closed operation vocabulary:
  - `add-evidence` — append evidence items to a named existing section (`## Mentions`, `## Claims`, a composite member group `### <Member Title>`, a comparison table section);
  - `add-section` / `add-member` — add a new dated section or (composite pages) a new member group, frontmatter members list included in the op payload;
  - `edit-prose` — replace ONE bounded existing prose span (the exact old text + the new text; lead sentences, section leads);
  - `flag-contradiction` — insert a marked blockquote quoting BOTH sides verbatim with their citations; the older claim is never deleted.
  Anything outside the vocabulary is a schema violation. There is deliberately NO delete-evidence and NO rewrite-page operation — the amendment cannot remove preserved content.
- **Routing:** `callType: 'synthesis-amend'`, resolved through the existing `synthesis` slot — NO new Settings row. maxTokens stays the synthesis ceiling (32768); in practice patches are far smaller, and the ceiling is a safety cap, never a controller.
- **Prompt rules:** add only what is new; a restatement of existing content is NOT an addition (the semantic-diff duty); keep the page's existing voice and structure; contradictions are flagged, never silently resolved.

### 2.4 Patch application + merged-page preservation

**Files:** `src/llm/patch.ts` (applier), `src/validation/preservation-check.ts` (unioned check), `src/pages/*` (frontmatter re-imposition after patch)

- The applier is deterministic and order-stable: schema-validate → resolve anchors (exact heading/member/section names) → apply → re-impose the deterministic frontmatter (`updated`, aggregated `sources`, members block if `add-member`) over the merged body.
- The preservation check runs over the MERGED page against the UNION of (a) every evidence item the page preserved before the patch and (b) every new-evidence item the patch was supposed to add. Verbatim, exactly as today.
- Failure classes (all quality-failures, §6 of vision `04`): unparseable patch output; unknown/duplicate anchor; `edit-prose` old-text not found (or not unique); merged-page preservation failure (dropped old item, or a new item the ops never landed). Each reasks with the validator's exact findings (≤3 attempts); exhaustion ⇒ normal full synthesis from the aggregate (the universal fallback — logged loudly, counted in metrics). The on-disk page is touched only by a validated merged result.
- Synthesis-state: a passing patch records mode `patch-amended` (skip-eligible exactly like strict/permissive) with the new baseline key-set.

### 2.5 Audit + metrics

**Files:** `src/commands/ingest.ts` (metrics), NEW `.state/amendment-log.jsonl` writer

- One JSONL record per amendment attempt: timestamp, page, PDF, attempt count, operations applied (types + counts), outcome (`patched` | `fallback-full-synthesis` + cause), and output tokens (the cost evidence the phase was built for).
- Metrics: per-run `patched` / `fallback` counts surface in the ingestion report beside the existing synthesis-mode counts.

## 3. LLM Call Inventory (glm-5.3-flash only — user directive 2026-08-27)

Every live LLM touchpoint in this phase, what fires it, and its estimated spend at glm-5.3-flash pricing ($0.15/MTok in, $0.50/MTok out). **Model pinning:** the UAT workspace's `.paper-chase.json` sets ALL routing slots (default, extractor, synthesis, dox, curation, and the rest) to `{ provider: 'zhipu', model: 'glm-5.3-flash' }` — the run config itself makes it impossible for any call in these tests to reach another model. The amendment call rides the `synthesis` slot, so pinning that slot pins it.

**The one NEW call type:**

| # | Call type | Fires when | Input → output (est.) | Live touches in this phase |
|---|---|---|---|---|
| 1 | `synthesis-amend` (Amendment Writer, via the `synthesis` slot) | once per changed-fingerprint page that already carries a same-shape synthesis; once per reask (≤3); ZERO when a page is skip-eligible or takes the full-synthesis path | ~3-8k in (existing page + new evidence + prompt) → ~0.3-1.5k out (patch JSON — the whole point: output scales with the delta, not the page) | gate 26.11 (1-2 calls ×2 — Implementer + Verifier), UAT 26.1 (1-5 amendment calls), UAT 26.2 (1-3) |

**Existing call types fired BY the live gate/UAT runs (spend belongs to this phase's budget):**

| # | Call type | Fires when | Est. per call | Live touches |
|---|---|---|---|---|
| 2 | `extractor` | one per chunk, per PDF in the loop | ~8-15k in → 3-8k out | one per chunk of each UAT fixture; UAT 26.2's aborted mid-PDF-3 run may re-extract PDF 3's chunks on resume (checkpoints are per PDF, not per chunk — by design) |
| 3 | `topic-curation` + `entity-curation` | two per PDF inside the loop (this phase's own change) — steady state cheap (sticky decisions settle identity) | ~2-4k in → 0.3-1k out each | 2 per PDF per run: UAT 26.1 = 4 calls; UAT 26.2 = 6 (run 1) + 0-2 (resume touches only PDF 3) |
| 4 | `synthesis` (strict, full) | per NEW page; per shape-change survivor; the universal fallback | ~2-5k in → 1-3k out | UAT 26.1: the shared entity's first-page synthesis + both PDFs' other new pages; UAT 26.2 similar |
| 5 | DOX writer + workspace pass | once per COMPLETED run (after the loop) | ~2-3k in → ~1k out per folder | UAT 26.1: 1 run; UAT 26.2: the aborted run reaches NO DOX (abort is mid-loop), the resume runs it once — so once total |
| 6 | `disambiguate` (Phase 25's call) | only if a UAT corpus actually contains a heterogeneous generic label | ~1-2k in → ~0.3k out | 0-2 calls across the UATs (the fixtures SHOULD include one to exercise gate 26.7's member routing) |

**Estimated spend:** gate 26.11 ≈ $0.004; UAT 26.1 ≈ $0.10-0.30; UAT 26.2 (abort + resume, some re-extraction) ≈ $0.15-0.40. **Expected total: under $1; hard cap $15.00** (tripled 2026-08-27 from $5.00 by user directive — generous headroom deliberately: abort/resume drills, reask loops, and larger UAT corpora are exactly the things that re-fire calls). **Verified live 2026-08-27** (probe against the dist-stored zhipu key): auth 200, temperature-0 JSON instruction-following confirmed. Note glm-5.3-flash is a REASONING model — hidden reasoning tokens are billed as output and precede any content (probe: 48 of 55 completion tokens were reasoning), so the per-call output estimates above are content-only and real output billing runs ~2-3×; the patch JSON still fits trivially inside the 32768 synthesis ceiling, but a content-empty + `finish_reason: length` amendment response means the cap was too small, not a model failure — and the truncation-detection path (Phase 16 v1.0.5's finish-reason tap) already classifies it correctly. Rate limits: glm-5.3-flash is the paid flash tier (normal concurrency; pool cap 4 safe); throttling rides the existing 429/5xx stall ladder.

## 4. Technical Approval Gates

All gates LLM-free (injected `amendmentFn` stubs + fake aggregates/pages).

- **Gate 26.1 (loop order):** for a 3-PDF fixture, the spy ordering proves PDF1-extract→PDF1-materialize→PDF1-synthesis → PDF2-… → PDF3-… → DOX-once; materialize and the curation pair are called exactly 3 times; the DOX writer exactly once.
- **Gate 26.2 (single-PDF equivalence):** a single-PDF ingest with synthesis produces byte-identical pages and state to the pre-phase behavior (golden replay) — the first-PDF path is untouched.
- **Gate 26.3 (delta):** with PDF 1 synthesized and PDF 2 added, the amendment input contains EXACTLY PDF 2's evidence items for the page (union check: no PDF-1-only item, no omission); an unchanged page (PDF 2 doesn't touch it) makes ZERO LLM calls (skip rule intact).
- **Gate 26.4 (patch happy path):** a stubbed patch's ops land; the merged page preserves old ∪ new verbatim; frontmatter re-imposed (`updated` real, `sources` grown); synthesis-state records `patch-amended` with the new baseline; the amendment log records the attempt.
- **Gate 26.5 (patch failure → fallback):** each failure class (unparseable, bad anchor, preservation miss on an old item, preservation miss on a new item) reasks with the exact error (spy captures the correction block), and after exhaustion the page is re-synthesized IN FULL (spy) with mode `strict-synthesis`/fallback — and the on-disk page at every intermediate point equals the pre-attempt page (never half-patched).
- **Gate 26.6 (contradiction flag):** a stubbed `flag-contradiction` renders the marked block quoting both sides with citations; the older claim text is still present verbatim in the merged page.
- **Gate 26.7 (composite targeting — Phase 25 interplay):** on a class-6 composite, `add-evidence` with a member anchor lands the items in that member's group only (the `sourceMap`-derived routing of Phase 25); `add-member` requires the member to exist in the composite's members list after the op; a patch may NOT add a member for a source the Phase 25 record doesn't cover (that source must go through Step 6b first — validator rejects the op).
- **Gate 26.8 (curation interplay):** a late sticky merge of two synthesized pages routes the survivor to FULL synthesis (shape change), not patch; the merged-away page's evidence is present in the survivor (existing union law) and both old synthesis-state entries collapse to the survivor.
- **Gate 26.9 (abort/resume):** aborting after PDF 2 of 3 and re-running skips PDFs 1-2 entirely (checkpoints) and resumes at PDF 3 with amendment inputs unchanged; PDF-2 pages already patched are skipped (patch-amended is skip-eligible).
- **Gate 26.10 (suite):** full key-less suite green (`npx tsc --noEmit` clean), the new phase-26 tests included, zero unenumerated regressions (the Phase 15 pool tests, Phase 16 resilience drills, and Phase 8 compounding tests must still pass under the loop).
- **Gate 26.11 (LIVE, glm-5.3-flash only):** the real Amendment Writer — no stub — receives a fixture synthesized page plus its new-evidence delta with the synthesis slot pinned to `zhipu/glm-5.3-flash`, and must return a schema-valid patch whose applied merge passes the merged-page preservation check end-to-end (a patch that needs one reask still passes the gate — the reask loop is part of the design; a run that exhausts into full synthesis fails this gate, because it proves the model cannot patch the happy path); the call logs to `llm-calls.json` with provider `zhipu`, model `glm-5.3-flash`, callType `synthesis-amend`, and the amendment-log records the attempt. Self-skips without `ZAI_API_KEY`. Est. cost: 1-2 calls ≈ $0.004.

## 5. User Acceptance Tests (UAT)

All UAT runs use a dedicated UAT workspace whose `.paper-chase.json` pins EVERY routing slot to `{ provider: 'zhipu', model: 'glm-5.3-flash' }` (the §3 pinning rule); the Reporter presents the cost line and the amendment-vs-creation output-token comparison from `.state/llm-calls.json` with each result.

- **UAT 26.1 (live, two-PDF sequential build):** into a fresh wiki, ingest two different single-topic PDFs that share an entity (e.g. two registry chapters naming the same hospital): PDF 1 creates the page with full synthesis; PDF 2 AMENDS it — the page now carries both sources' evidence, a contradiction block if the reports disagree, and `.state/llm-calls.json` shows the amendment call's output tokens a small fraction of the creation call's. (Est. spend $0.10-0.30.)
- **UAT 26.2 (live, kill-and-resume):** abort a 3-PDF run mid-PDF-3; re-run: PDFs 1-2 are skipped, PDF 3 completes, DOX runs once, and the final wiki is indistinguishable from an uninterrupted run. (Est. spend $0.15-0.40 — some PDF-3 re-extraction is expected and budgeted.)
- **UAT 26.3 (reading check, human):** the amended page reads as one coherent article (no visible "patch seams"); every citation resolves; the contradiction block quotes both reports.

## 6. Approval Checklist

- [x] All 11 gates pass; `npx tsc --noEmit` clean (gate 26.11 green with `ZAI_API_KEY` — 1 call, glm-5.3-flash, $0.004; self-skipped key-less)
- [x] Loop order + single-PDF equivalence proven (gates 26.1/26.2)
- [x] Never-half-patched guarantee proven across every failure class (gate 26.5/26.6)
- [x] Delta exactness + skip-rule intactness proven (gate 26.3)
- [x] Phase 25 interplay proven (gate 26.7); curation interplay proven (gate 26.8)
- [x] Vision `04` §1/§3.2/§4/§6 + `07` §3 + `01` §4.1 amendments remain the source of truth
- [x] Compliance log entry filed; status file created; DOX pass complete (root + `Implementation Plan/` + `src/` + `tests/` + `prompts/` indexes); asset-version bump noted for the new prompt when implemented (1.0.26→1.0.27)

## 7. Integration Notes

**Depends on:** Phase 25 (class-6 composites, `sourceMap`), Phase 16 (synthesis resume, per-PDF checkpointing), Phase 18 (citation-map discipline), Phase 21/22 (sticky decisions, composite rendering), Phase 15 (pool), Phase 24 (cross-wiki runs after the loop).
**Produces:** the per-PDF default pipeline; the Amendment Writer + patch applier; `patch-amended` synthesis mode; `.state/amendment-log.jsonl`; `prompts/amendment.prompt.txt` (a new extracted asset — asset-version bump required when implemented).
**Contract:** patch amendment applies ONLY to a synthesized page of unchanged shape; everything else — new pages, template-fallback pages, shape changes (curation merges, new composite members), kind changes — takes normal full synthesis. The batch pipeline is REMOVED, not kept behind a flag (user decision 2026-08-26: one code path).
