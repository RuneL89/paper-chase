# Phase 12 Verification Report — Validation Feedback Retry ("reask")

**Verifier:** independent sub-agent (cold check; no Implementer rationale trusted)
**Date:** 2026-07-23 ~05:47
**Phase doc:** `Implementation Plan/PHASE_12_validation_feedback_retry.md` v1.0.0
**Vision basis:** `Project Vision/04_orchestration_detailed.md` §6 + `07_validation_and_quality.md` §5/§2.1/§2.2 (amended 2026-07-23, ratified compliance-log 07:00; pre-check 08:00)
**LLM cost of this verification:** $0.00 (`.env` renamed aside for the full-suite run and restored immediately after; restoration verified — 171 bytes, original mtime, key present)

Phase 12 changes are uncommitted (HEAD = Phase 11 commit `387b463`), so every code claim below was verified against `git diff HEAD` — the exact delta from pre-Phase-12 code.

---

## Per-gate verdicts

### Gate 12.1 — Extractor JSON-parse reask: PASS
Evidence (code, `src/agents/extractor.ts` diff):
- Attempt 1 calls `callLLM(prompt, undefined, { maxTokens: 16384, temperature: 0, maxRetries: 2, callType: 'extractor', context: options?.context, logPath })` — the diff shows this is byte-for-byte the pre-Phase-12 call (same prompt construction via `loadPromptTemplate`/`fillPromptTemplate`/`applyLanguageDirective`, unchanged in the diff; same options object; `prompts/extractor.prompt.txt` unmodified in git status).
- Attempts 2+ send exactly `` `${prompt}\n\n${feedback}` `` with context `` `${ctx}#attempt${attempt}` ``.
- Feedback = `buildCorrectionBlock(rawResponse, [parseError.message])` — invalid output verbatim (strings pass through `stringifyInvalidOutput`) + the exact parse error (`Extractor returned invalid JSON: ...`).
Evidence (test, `tests/phase-12.test.ts` gate 12.1): `callLLM` spy — 2 calls; attempt-2 prompt `startsWith(attempt1 + '\n\n=== CORRECTION REQUIRED ===')`; attempt 1 has no block; contexts `['golden-master-part-001', 'golden-master-part-001#attempt2']`; success on attempt 2 yields the normal `ExtractorResult`. Ran green.

### Gate 12.2 — Extractor schema-violation reask: PASS
Evidence: validator (`src/validation/extractor-schema.ts:77`) produces `` `${label}: folder "${value}" must start with "entities/" or "topics/"` ``; the extractor's validate closure returns `validation.issues` verbatim as the feedback error list. Test drives the UAT slip (7th entity, index 6, `products/assessment-tools`) and asserts the attempt-2 prompt contains `entities[6]: folder "products/assessment-tools" must start with "entities/" or "topics/"` plus the slipped JSON verbatim. Ran green.

### Gate 12.3 — Extractor exhaustion stays fail-loud: PASS
Evidence: `runWithFeedbackRetry` with `EXTRACTION_MAX_ATTEMPTS = 3` makes exactly 3 calls (loop bound; test asserts `toHaveBeenCalledTimes(3)` and contexts `[chunk-x, chunk-x#attempt2, chunk-x#attempt3]`). Exhaustion re-throws the closure-captured failure in exactly the pre-Phase-12 shapes — diff-verified: schema → `new ExtractorError('Extractor output failed schema validation: <issues joined by ;>', { issues, rawResponse })`; parse → `new ExtractorError(<original message>, { rawResponse })`. The ingest abort path (throw propagates out of `extractChunk`) is unchanged. Ran green.

### Gate 12.4 — Synthesis reask: PASS
Evidence (code): all four `synthesize*` functions gained ONLY trailing optional `feedback?: string, attempt?: number` (diff); absent → `feedback === undefined` → byte-identical prompt and plain `<slug>` context; present → `${fullPrompt}\n\n${feedback}` + `<slug>#attempt<N>`. `trySynthesisMode` (`src/commands/ingest.ts`) routes through `runWithFeedbackRetry` (max 3) and converts the preservation check into feedback via `preservationFeedbackErrors` — dropped mentions/relationships/claims/citations emitted as `Dropped mention (restore this exact text): <verbatim substring>` etc. The strict → permissive → structured-template chain and conflict logging are diff-verified unchanged (the only delta: a `lastCheck !== null` guard on a path that was previously an unsafe cast and is unreachable in practice — no behavior change).
Evidence (test): attempt 1 drops a mention; attempt 2's feedback contains `=== CORRECTION REQUIRED ===`, the exact `Dropped mention (restore this exact text): John Smith, CEO of Acme Corp`, and the invalid page verbatim; page replaced on success; `metrics.feedbackRepairs === 1`; all four synthesis stubs injected (no live path possible). Ran green.

### Gate 12.5 — DOX Writer reask: PASS
Evidence (code, `src/dox-writer.ts` diff): `hasRequiredSections` → `missingRequiredSections` returning exact strings (`missing required section: ## Pages` / `## Statistics` / `## Start Here` / `## Navigation` / level-1 title); `enforceLlmBodyDetailed` also returns the frontmatter-parse error verbatim. `runDoxLlmWithRetries` routes through the helper (≤3); exhaustion → the same deterministic contract body as before (test asserts `## Statistics` + `type: index` written on exhaustion). Injection seam `writeDoxIndexFn(context, feedback?, attempt?)` is additive and still honored. Test: root attempt 1 missing `## Start Here` → attempt-2 feedback contains `missing required section: ## Start Here` + the invalid body verbatim; folders pass attempt 1 with `feedback === undefined`. Ran green.

### Gate 12.6 — Workspace pass + AGENTS.md Updater reask: PASS (with a coverage nit — see Findings)
Evidence (updater, `src/agents/agents-updater.ts` diff): `isValidProposal` → `validateProposal` returning exact errors (`missing required section: ## Folder Structure` / `## Page Types` / `## Language`, `proposal is too short (N chars)...`); attempt 1 `composed = prompt` byte-identical; attempts 2+ `${prompt}\n\n${feedback}` with `<wikiSlug>#attempt<N>` context; exhaustion (3 calls) → the same `## Proposed Additions (deterministic fallback)` proposal; injected `callLLMFn` seam receives the composed prompt as arg 1 (unchanged contract). Test asserts all of this, including `attempt2.startsWith(attempt1 + '\n\n=== CORRECTION REQUIRED ===')`. Ran green.
Evidence (workspace, code only): `runWorkspaceEntryWithRetries` re-asks empty responses with feedback `the response was empty; return the complete requested text`, ≤3 attempts, deterministic description/prose on exhaustion (diff-verified). **Nit: no dedicated test exercises the workspace empty-response reask** (see Findings F1).

### Gate 12.7 — Repair-rate accounting + warning: PASS
Evidence (code): `repairsThisRun` module counter incremented once per scheduled repair inside the shared helper (single source — all five sites counted); `beginReaskRun()` resets at `ingest()` start (line ~391); `IngestionMetrics.feedbackRepairs` additive in `src/state/metrics.ts`; written at BOTH write points (preliminary line 1025 and final line 1101, both via `buildRunMetrics()` which reads `reaskRepairs()`). Warning: `repairs >= 5 || (llmCalls > 0 && repairs / llmCalls > 0.25)` — M=0 edge guarded; message matches the phase-doc example; wrapped in try/catch (never fails the run). `countLlmCallsSince` counts `timestamp >= runStartedAt` (run-scoped).
Evidence (test): ≥5-absolute branch (8 folder repairs vs 40 future-timestamped seeds → `Warning: 8 of \d+ LLM calls...`, `feedbackRepairs: 8`); 25%-ratio branch (1 repair vs 3 seeded calls → warning fires); clean run (no warning, `feedbackRepairs: 0`). Ran green.

### Gate 12.8 — HTTP 4xx never re-asked: PASS
Evidence (code): `runWithFeedbackRetry` never catches `runLlm` exceptions — they propagate on attempt 1; `callLLM` 4xx handling unchanged (diff of `src/llm/client.ts`: no Phase 12 changes at all; `isTransientStatus` = 429/≥500 only).
Evidence (test): helper level — throwing `runLlm` called exactly once, rejection propagates. Client level — REAL `extractChunk` → real `callLLM` → `vi.mock('undici')` 404 with a FAKE key (saved/restored in `finally`): exactly 1 transport request, request body contains no `=== CORRECTION REQUIRED ===`, error is a plain HTTP Error (not `ExtractorError`). Transient behavior: `maxRetries: 2` preserved at every call site (extractor, synthesis ×4, dox ×3, updater default wrapper); the Phase 7 transient tests (gates 7.10/7.11) ran green in the full suite. Ran green.

### Logging (`#attemptN` in llm-calls.json): PASS
Every site's repair context is asserted at the callLLM-options level (`<ctx>#attempt2` etc. in gates 12.1/12.3); attempt 1 keeps the plain context everywhere (diff-verified at all five sites). The on-disk write itself is the pre-existing, separately tested `appendLlmCallLog` path (Phase 4/9 tests) — the spy bypass is acknowledged in test comments; the composition chain (context string → callLLM → log entry) is fully pinned.

---

## Gate-7.12 re-cast verdict: LEGITIMATE

Scrutinized `git diff HEAD -- tests/phase-07.test.ts` (Cases 2–3) and the `tests/AGENTS.md` annotation.

What changed:
- Case 2 (DOX stub always throws): expected calls 9 → 3 (1 per target × 3 targets); deterministic contract assertions kept (`## Pages` present, rich description absent).
- Case 3 (workspace entry stub): was "throw ×2 then valid → 3 calls, prose used"; now "always throws → 1 call, deterministic `## Wikis` contract".
- Case 1 (content-defect garbage → retried then accepted) is byte-untouched.

Why it is the amended vision, not homework-grading:
1. The 2026-07-23 four-class policy (vision 04 §6, ratified compliance-log 07:00) leaves NO class under which a *thrown* error is site-retried: 4xx is "never retried"; transient is "up to 3 total attempts **per call**" (inside `callLLM`, `maxRetries: 2` intact at every site). A site-level retry loop over a thrown error either re-asks a 4xx (explicitly forbidden) or multiplies transient attempts to 9 per target (beyond the policy).
2. The old behavior was already in tension with the 2026-07-20 text ("HTTP 4xx responses fail immediately", 07 §5): a 404 at the DOX site WAS being re-issued 3 times. The re-cast strengthens the 4xx guarantee (1 call, not 3) — it does not weaken anything the amended vision still requires.
3. The content-defect retry that the amendment ADDS is still pinned by the unchanged Case 1 plus new gates 12.5/12.6.
4. The change is transparently annotated in `tests/AGENTS.md` with date, rationale, and the new expected counts.

The alternative hypothesis (weakening an old gate to make new work pass) fails on the evidence: the new expectations are STRICTER for thrown errors and the re-ask path is covered by stricter new assertions elsewhere.

---

## tsc status

`npx tsc --noEmit` at 05:46 → 4 errors, ALL in `scripts/tprobe.ts` (TS1002/TS1005 syntax errors — a 3-line timer probe with an unterminated string). Cross-check: `git status --short` shows `?? scripts/tprobe.ts` (untracked); file mtime 2026-07-23 05:43 — created DURING this verification session; the user is actively iterating exe-packaging debug scripts in parallel (same pattern the Implementer recorded for `ink-smoke.ts`/`yoga-smoke.ts`/`reconciler-smoke.ts`, the latter now compiling clean). Zero errors in any tracked file or Phase 12 file. Prior-phase acceptance required tsc clean repo-wide; this error is confined to an untracked user-owned script outside Phase 12 scope — reported, not fixed, not attributed to this phase.

## Test totals (independent runs, key-less)

- `npm test` (with `.env` renamed aside): **259 passed + 14 skipped (273); 17 passed + 1 skipped test files (18)** — exactly the Implementer's claim; no failures, no new skips. The "ANTHROPIC_API_KEY is not set" warnings in the output confirm the key-less profile was genuinely in effect; the only `LLM Call` lines came from Phase 11 mocked-transport tests with FAKE keys ($0.0000, 1–2 tokens).
- `npx vitest run tests/phase-12.test.ts`: **10/10 passed** (gates 12.1–12.8 + 2 helper pins).
- `.env` restored immediately after and verified (171 bytes, original mtime 2026-07-20 00:13, key present).

## $0-cost confirmation

No live-call paths in the new tests: gates 12.1–12.3 spy on `callLLM`; 12.8 mocks `undici` with a FAKE key (and the routing table pinned to anthropic); 12.4–12.7 use injected stubs at every LLM seam (all four synthesis stubs defensively injected in 12.4; workspace prose/entry stubs in 12.7). Any real network call in the key-less run would have thrown and failed the suite — none did.

## Compliance verdict

Vision 04 §6 / 07 §5 implemented exactly: reask ≤3 total attempts with the validator's exact errors + invalid output verbatim; attempt-1 byte-identity at all five sites (diff-verified, not just claimed); HTTP 4xx never re-asked; transient backoff untouched (`client.ts` has no Phase 12 diff); Extractor exhaustion fail-loud with the pre-Phase-12 error shapes; all deterministic fallbacks unchanged; repair accounting run-scoped and written every run; warning only at ≥5 repairs or >25% of run calls; `#attemptN` log contexts. NO scope creep detected: no reject-and-continue, no attempt-count changes, no new dependencies, no validator changes.

## Findings (non-blocking)

- **F1 (coverage nit):** Gate 12.6's letter covers "Workspace pass + AGENTS.md Updater", but `tests/phase-12.test.ts` exercises only the updater half. The workspace empty-response reask (`runWorkspaceEntryWithRetries`, feedback `the response was empty; return the complete requested text`) is implemented correctly (diff-verified) but has no dedicated reask test — the same helper and the sibling DOX path are tested (12.5 + helper pins), so risk is low. Optional hardening: one stub test (empty → complete on attempt 2; exhaustion → deterministic description).
- **F2 (external noise):** untracked user-owned `scripts/tprobe.ts` breaks repo-wide tsc (created mid-verification by the user's parallel exe-packaging work). Outside Phase 12 scope; the user should delete or fix it before the next phase's "tsc clean" acceptance.
- **F3 (observation, not Phase 12):** the working tree also contains unrelated deletions (`wikis/test-wiki/AGENTS.md`, `wikis/test-wiki/documents/golden-master-part-001.md`) and the user's exe-packaging files. Suite is green regardless; flagged so the next phase doesn't attribute them to Phase 12.

## RECOMMENDATION: READY FOR UAT

All 8 gates pass with independently produced evidence; the 7.12 re-cast is legitimate; compliance is exact. UAT 12.1/12.3 spend real money deliberately (user's choice per the phase doc); UAT 12.2 may be demonstrated by gate evidence.
