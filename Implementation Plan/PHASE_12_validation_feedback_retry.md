# Phase 12: Validation Feedback Retry (Reask)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-012`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-23
**Dependencies:** Phases 0-9, 11
**Estimated Time:** 3-4 hours
**LLM Token Budget:** $0 (all gate tests mock the transport / inject stubs; live repair calls only happen during real ingests at the user's discretion)

**Canon basis (user-ratified 2026-07-23, compliance-log [2026-07-23 07:00]):** `Project Vision/04_orchestration_detailed.md` §6 (four-class retry policy) and `Project Vision/07_validation_and_quality.md` §5 + §2.1/§2.2 (feedback-retry carve-out). This phase implements exactly that amendment — no more, no less.

---

## 1. Objective

Replace the pipeline's blind fail-loud and blind quality-retry behavior with the **reask pattern**: when a validator rejects LLM output, the LLM gets its previous output plus the validator's exact error list and is asked to correct only the listed violations, up to 3 total attempts. HTTP 4xx stays never-retried; transient backoff, attempt counts, deterministic fallbacks, and Extractor-exhaustion abort are all unchanged. One shared helper serves all five LLM call sites — no five bespoke loops.

---

## 2. What to Build

### 2.1 Shared feedback-retry helper

**File:** `src/llm/reask.ts` (new)

A single generic loop used by every site:

```typescript
export interface ReaskResult<T> {
  output: T | null;          // null only on exhaustion
  attempts: number;          // 1..3
  lastErrors: string[];      // validator errors from the final attempt
}

export async function runWithFeedbackRetry<T>(
  runLlm: (feedback: string | null) => Promise<T>,   // attempt 1: null; attempts 2+: feedback block
  validate: (output: T) => { valid: boolean; errors: string[] },
  options: { maxAttempts?: number; label: string; onRepair?: (errors: string[]) => void },
): Promise<ReaskResult<T>>;
```

- Attempt 1 calls `runLlm(null)` (identical to today's prompt — byte-identical first attempts everywhere).
- On validation failure, `onRepair` is invoked (repair-rate accounting, §2.6) and the next attempt calls `runLlm(feedback)` where feedback is a composed correction block (§2.2).
- `maxAttempts` defaults to 3 (vision: ≤3 total attempts). Exhaustion returns `{ output: null }` — the caller's existing fail-loud / fallback path handles it unchanged.

### 2.2 The correction block

Each site composes the feedback as: the invalid output + the validator's exact error list + an instruction to **correct only the listed violations and return the complete corrected output** (full JSON for the Extractor; full page for Synthesis; full contract for DOX/workspace; full constitution for the Updater). Feedback text is appended to the site's normal prompt as a clearly delimited correction section; the base prompt is unchanged, so attempt 1 is byte-identical to pre-Phase-12 behavior.

### 2.3 Extractor reask

**Files:** `src/agents/extractor.ts`, `src/commands/extract-chunk.ts`

- JSON-parse failures AND schema-validation failures (invalid folder prefix, page out of range, dangling relationship slug, missing fields) route through `runWithFeedbackRetry`.
- The validator's existing precise errors (e.g. `entities[5]: folder "products/assessment-tools" must start with "entities/" or "topics/"`) become the feedback verbatim.
- Exhaustion → the same thrown error as today (fail-loud abort, vision 04 §6 exhaustion rule).
- Each attempt logged via the existing `logPath` (callType `extractor`, context `<chunkId>` — attempt number included in context, e.g. `<chunkId>#attempt2`).

### 2.4 Synthesis Writer reask

**Files:** `src/agents/synthesis.ts`, `src/commands/ingest.ts` (`trySynthesisMode`)

- The four synthesis functions gain an optional `feedback?: string` parameter; `trySynthesisMode` wires the loop through `runWithFeedbackRetry`.
- On preservation failure, the check's exact missing items (dropped mentions, relationships, claims, citations — the verbatim substrings the check already produces) are fed back.
- The strict → permissive → structured-template chain is unchanged; feedback retries happen inside each mode's ≤3 attempts.

### 2.5 DOX Writer / workspace pass / AGENTS.md Updater reask

**Files:** `src/dox-writer.ts`, `src/agents/agents-updater.ts`

- `runDoxLlmWithRetries` and `runWorkspaceEntryWithRetries` route through the shared helper: feedback = parse error or the exact missing required sections (`## Pages`, `## Statistics`, …).
- `agents-updater.ts`: feedback = missing required sections (`## Folder Structure` / `## Page Types` / `## Language`) or the <200-char length failure.
- Deterministic fallbacks on exhaustion unchanged.

### 2.6 Repair-rate accounting + warning

**Files:** `src/commands/ingest.ts`, `src/state/metrics.ts`

- A per-run counter accumulates every feedback-repair attempt (every call where a previous attempt failed validation, across all five sites — via the `onRepair` hook).
- `IngestionMetrics` gains additive `feedbackRepairs: number`.
- At the end of the run: if `feedbackRepairs >= 5` OR `feedbackRepairs / llmCallsInRun > 0.25` (calls counted from `.state/llm-calls.json` entries for the run), emit the prompt-quality warning (vision 04 §6): a `progress()` line, e.g. `Warning: N of M LLM calls this run needed validator-feedback repair — the underlying prompt may need attention.`

### 2.7 Never-retried stays never-retried

HTTP 4xx (auth, quota, unknown model) bypasses the helper entirely — the existing `callLLM` behavior is unchanged, and a 4xx during any reask attempt aborts the loop immediately.

---

## 3. Technical Approval Gates

All gates are LLM-free (mocked transport or injected stubs; FAKE outputs only).

### Gate 12.1: Extractor JSON-parse reask

Injected extractor stub returns invalid JSON on attempt 1, valid JSON on attempt 2 → extraction succeeds on attempt 2; the attempt-2 prompt contains the invalid output and the exact parse error; result identical to a first-attempt success.

### Gate 12.2: Extractor schema-violation reask

Attempt 1 returns entities with `folder: "products/assessment-tools"` (the UAT-found slip); attempt 2 returns corrected folders → succeeds; the feedback contains the exact validator message (`entities[5]: folder ... must start with "entities/" or "topics/"`).

### Gate 12.3: Extractor exhaustion stays fail-loud

All 3 attempts invalid → the ingest aborts with the schema-validation error (same error shape as pre-Phase-12); exactly 3 attempts, no more.

### Gate 12.4: Synthesis reask

Attempt 1 drops a mention (preservation check fails with the exact missing substring); attempt 2 includes the dropped item in the feedback prompt and passes → page replaced; chain/fallback behavior on exhaustion unchanged.

### Gate 12.5: DOX Writer reask

Attempt 1 missing `## Pages`; attempt 2 complete → contract written; feedback contains the missing-section name; exhaustion → deterministic contract body (unchanged).

### Gate 12.6: Workspace pass + AGENTS.md Updater reask

Same pattern for both sites: feedback carries the missing sections; fallbacks intact on exhaustion.

### Gate 12.7: Repair-rate accounting + warning

A run with ≥5 repairs emits the prompt-quality warning and writes `metrics.feedbackRepairs`; a run below threshold does not warn. The 25%-of-calls branch is covered by a synthetic call count.

### Gate 12.8: HTTP 4xx never re-asked

Mocked 404 (model not found) → exactly 1 attempt, error thrown immediately, no correction prompt composed. Transient 429/5xx retry behavior unchanged (existing client tests keep passing).

---

## 4. User Acceptance Tests (UAT)

### UAT 12.1: The ADHD corpus gets past the slip (live, small cost)

1. Re-run the failed ingest: `chase` → Ingest PDFs → `adhd-wiki` (5 PDFs, Input Dansk / Output English, Synthesis + AGENTS.md updates on).
2. Expected: the run passes the point where it previously died (chunk adhd-2022-part-005); if a schema slip recurs, the progress log shows a repair attempt and the run continues.
3. Expected end state: `Ingest complete` banner (not an error box); `wikis/adhd-wiki/.state/metrics.json` contains `feedbackRepairs` (≥ 0); `.state/llm-calls.json` shows any repair attempts with `#attemptN` contexts.
4. Cost note: a full 5-PDF Danish run is real money; the user may instead watch just the first PDF and Escape, or run to completion — their choice. The pass criterion is surviving past the previous failure point.

### UAT 12.2: Normal run stays quiet (live or dry)

1. Ingest a wiki whose content validates cleanly (e.g. `uat-phase11` with golden-master.pdf, or any small healthy wiki).
2. Expected: no repair warnings; `metrics.feedbackRepairs` is 0; no prompt-quality warning line.

### UAT 12.3: Fallbacks still work when repair can't

1. (Dry, user-optional) Temporarily route the Extractor to a nonsensical-but-accepted model name via Settings, or skip — this UAT may be demonstrated by the Verifier's mocked gate evidence instead.
2. Expected (if run live): after 3 failed attempts the ingest aborts with the schema error, and no 4th call is made.

---

## 5. Approval Checklist

- [ ] All 8 technical gates pass (`npm test` green; full suite unregressed).
- [ ] All 3 UAT steps pass (12.3 may be demonstrated by gate evidence).
- [ ] First attempts byte-identical to pre-Phase-12 prompts at every site.
- [ ] ≤3 total attempts everywhere; HTTP 4xx never re-asked; transient behavior unchanged.
- [ ] Every repair attempt logged to `.state/llm-calls.json` with `#attemptN` context.
- [ ] `metrics.feedbackRepairs` written every run; warning fires only at threshold.
- [ ] Compliance log shows no unresolved contradictions.
- [ ] No new LLM calls in implementation testing; budget $0.

---

## 6. Integration Notes

### What Phase 12 Depends On
- The validators already produce precise error lists (Phase 2 schema validator, Phase 5 preservation check, Phase 6 DOX section enforcement, Phase 9 section checks) — they are the feedback source, unchanged.
- The retry seam: `callLLM` transient handling (Phase 7 v1.1.0) is untouched; the helper composes above it.
- Model routing (Phase 11 v1.4.0): reask attempts inherit the call site's routed model unchanged.

### What Phase 12 Produces
- `src/llm/reask.ts` shared helper; reask wiring at all five LLM call sites.
- `metrics.feedbackRepairs` + the prompt-quality warning.
- Regression coverage for the UAT-found folder-prefix slip.

### Contract with Final Acceptance
- All tests green; all UAT passed; compliance log clean; vision 04 §6 / 07 §5 implemented exactly as amended — nothing more (no reject-and-continue, no attempt-count changes, no 4xx retries).
