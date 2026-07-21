# Phase 9 Verification Report — AGENTS.md Updater

**Verifier:** independent verification sub-agent (did not write this code)
**Date:** 2026-07-21
**Spec:** `Implementation Plan/PHASE_09_agents_updater.md` (v1.0.0)
**Status file reviewed:** `.state/phase-9-status.json`

---

## 1. Test Runs (independent, from project root, Git Bash)

### Vitest

Command: `npx vitest run tests/phase-09.test.ts tests/tui/agents-review-screen.test.tsx tests/tui/structural-changes-screen.test.tsx tests/tui/menu.test.tsx`

Result: **4 test files passed, 26 tests passed, 0 failed** (~6.6s).

- `tests/phase-09.test.ts` — 12 passed
- `tests/tui/agents-review-screen.test.tsx` — 6 passed
- `tests/tui/structural-changes-screen.test.tsx` — 3 passed
- `tests/tui/menu.test.tsx` — 5 passed

### TypeScript

Command: `npx tsc --noEmit`

Result: **0 errors.** Note: the phase-9 brief allowed exactly one error in
`scripts/compare-pdf-engines.ts` (Phase 10 in-progress file). At verification
time that file compiles cleanly — the concurrent Phase 10 session has
apparently fixed it, or the error was transient. Not a Phase 9 concern either
way. `tests/phase-10.test.ts` was not run (explicitly out of Phase 9 scope;
its gates 10.5/10.7 failures are the concurrent session's in-progress work).

---

## 2. Per-Gate Verdicts

### Gate 9.1: Updater Proposes Valid AGENTS.md — PASS (with recorded, verified deviation)

- `tests/phase-09.test.ts` gate 9.1 asserts the proposal contains
  `## Folder Structure`, `## Page Types`, `## Language`, and
  `## Ingest Instructions for the LLM`.
- Deviation verified against `templates/AGENTS.md`: the template's actual
  headings are `## Purpose`, `## Language`, `## Ingest Instructions for the
  LLM`, `## Folder Structure`, `## Page Types`, `## Page Frontmatter`,
  `## Entity Page Format`, `## Citation Rules`, `## Writing Rules`,
  `## What You Provide`. The phase doc's literal `"Ingest Workflow"` section
  does not exist anywhere in the template. The deviation is real, correctly
  recorded in the status file, and the gate's pass criterion ("proposal
  contains all required sections") is preserved.
- Implementation-side required-section validation exists
  (`REQUIRED_SECTIONS` in `src/agents/agents-updater.ts:40`) and invalid
  proposals are retried (≤3 attempts) then fall back deterministically —
  verified by the supplementary retry test.

### Gate 9.2: Proposal Includes New Folders — PASS

- Gate 9.2 runs the updater with a permanently-throwing LLM stub and asserts
  every `new-folder` entry in `.state/proposals/structural-changes.json`
  appears in the (deterministic fallback) proposal. Stronger than the
  literal gate — passes.
- Gate 9.2b additionally verifies the prompt carries the current
  constitution, the discovered folders (`entities/people/executives`,
  `entities/companies`, `topics/financial`), and the page types
  (`person`, `company`). Passes.

### Gate 9.3: Proposal Is Saved to Disk — PASS

- `wikis/<slug>/.state/proposed-agents.md` exists after
  `proposeAgentsUpdate`. Verified in code (`agents-updater.ts:294-296`) and
  by the passing gate test.

### Gate 9.4: Original AGENTS.md Is Not Overwritten — PASS

- The only `writeFile` in `src/agents/agents-updater.ts` targets
  `.state/proposed-agents.md` (line 296). `AGENTS.md` is only ever read
  (line 216). Gate test passes. The TUI review screen's Apply action does
  `copyFile` over `AGENTS.md`, but that is the explicit human action of
  UAT 9.3 — not the updater.

### Gate 9.5: Updater Does Not Run by Default — PASS

- `IngestOptions.updateAgents` is optional with no default assignment in
  `ingest()` (falsy when omitted); the updater block at `ingest.ts:830-835`
  is guarded by `if (options.updateAgents)`. Gate test asserts
  `result.agentsUpdateProposed` is undefined and no proposal file exists
  after a plain ingest. Gate 9.5b confirms the opt-in path runs after the
  DOX/workspace passes (code order at `ingest.ts:795-835` confirms placement
  after `writeDoxContracts` and `writeWorkspaceIndex`).

---

## 3. UAT Verification

- **UAT 9.1** (console message): exact spec string
  `"Proposed AGENTS.md updates saved to .state/proposed-agents.md. Review and apply manually."`
  present at `agents-updater.ts:298` and as ingest progress line at
  `ingest.ts:834`. PASS (static verification; live run requires an API key).
- **UAT 9.2** (review proposal): proposal content verified by gates 9.1/9.2
  (new folders, page types, required sections). PASS.
- **UAT 9.3** (apply manually): TUI Apply test performs the equivalent of
  `cp proposed-agents.md AGENTS.md` and asserts the result contains the
  proposed addition and preserves `## Language`. PASS.
- **UAT 9.4** (structural changes log): supplementary tests assert
  timestamps, reasons, `affectedEntities`, folder paths, and page types;
  the Structural Changes TUI screen test renders timestamps/reasons/entities.
  PASS.

---

## 4. Compliance Against Vision Documents

### Vision 03 §5 — Structural Change Logging shape — COMPLIANT

The `changes` array entries in `src/state/structural-changes.ts` match the
vision shape field-for-field: `timestamp` (ISO string), `type`
(`new-folder` | `new-page-type` | `entity-reclassification`), `path`,
`reason`, optional `affectedEntities`. The file lives at
`.state/proposals/structural-changes.json` as specified. The top-level
additive `knownPageTypes` tracker is a documented extension (status file +
module docstring) that does not alter the `changes` entry shape — it exists
so each page type is logged exactly once; the vision's "byte-for-byte"
requirement applies to the entries, which are exact.

Detection hook in `src/materializer.ts:498-566` runs before
`saveRollingMemory` and diffs against the previous rolling memory (folders)
and the log's own `knownPageTypes` (types), so a folder/type is logged
exactly once — verified by the "re-materializing logs nothing new" test.

### Vision 01 §2 Principle 4 and §5 Who Decides What — COMPLIANT

- Principle 4: LLM creates folders freely; changes are logged for
  after-the-fact review — exactly what the materializer hook + log deliver.
- §5 "High-level wiki purpose — Human — AGENTS.md": the updater is
  proposal-only; `AGENTS.md` is never auto-overwritten (gate 9.4). Applying
  requires an explicit human act (manual `cp` or the TUI Apply action).
- §5 "Structural change review — Human — after-the-fact via
  `.state/proposals/` log": delivered.
- The deterministic re-imposition of the `## Language` section verbatim
  (`agents-updater.ts:149-159`) reinforces the §5 "Wiki output language —
  Human" row; verified by the "Klingon" vandalism test.

### Recorded deviations — all verified real and acceptable

1. Phase 8 incomplete per explicit user direction — user-directed; code
   touchpoints (materializer, DOX writer, ingest pipeline) are landed.
2. Phase doc §2.4's claim that the log was "partially built in Phase 3" is
   false; the module is fresh. Doc inaccuracy, not an implementation defect.
3. Gate 9.1 "Ingest Workflow" vs template's actual "Ingest Instructions for
   the LLM" — verified against `templates/AGENTS.md` (see Gate 9.1 above).
4. Live-LLM gate calls restructured to injected stubs — matches the
   `tests/AGENTS.md` contract; pass criteria preserved and, for 9.2,
   strengthened.
5. `/goal` skill absence — process note, no code impact.

**Compliance verdict: COMPLIANT.** No contradictions with vision 01 or 03.

---

## 5. Phase Doc §6 Approval Checklist

| Item | Verdict |
|---|---|
| All 5 technical gates pass (npm test green) | PASS — 26/26 tests green in the 4 Phase 9 suites |
| All 4 UAT steps pass | PASS (9.2–9.4 by automated tests; 9.1 console string statically verified — live CLI run needs an API key) |
| Updater proposes valid AGENTS.md updates | PASS (gate 9.1 + required-section validation) |
| Proposal includes new folders and page types | PASS (gate 9.2/9.2b; fallback also lists both) |
| Proposal saved to `.state/proposed-agents.md` | PASS (gate 9.3) |
| Original `AGENTS.md` not overwritten | PASS (gate 9.4; only write target is `.state/proposed-agents.md`) |
| Updater is opt-in (`--update-agents`) | PASS (gate 9.5; CLI flag at `cli.ts:50`, TUI toggle at `ingest-screen.tsx:327` with settings pre-select at `ingest-screen.tsx:115`) |
| TUI AGENTS.md Review screen shows proposed changes and allows apply/discard | PASS (6 screen tests: summary render, apply, discard, diff view, empty state, non-TTY fallback) |
| Total LLM cost under $2.00 | PASS — $0.00 recorded; all tests are LLM-free |

---

## 6. Adversarial Checks

1. **No write to `wikis/<slug>/AGENTS.md` from the updater:** CONFIRMED.
   Sole write in `agents-updater.ts` is to `.state/proposed-agents.md`.
2. **Default-off:** CONFIRMED. `updateAgents` defaults falsy; CLI flag and
   TUI toggle/settings persist it; gate 9.5 proves a plain `ingest()`
   produces no proposal.
3. **Log shape byte-for-byte for `changes` entries:** CONFIRMED against
   vision 03 §5 (`timestamp`, `type`, `path`, `reason`, optional
   `affectedEntities`). `knownPageTypes` is a top-level additive extension,
   documented.
4. **Ink 7 conventions:** CONFIRMED in both new screens — `useInput` gated
   on `isActive: isRawModeSupported === true`; Escape = back (and
   diff-view → summary); non-TTY static fallbacks tested by the two
   `notty` tests; `src/AGENTS.md` conventions honored.
5. **No live LLM calls in tests:** CONFIRMED. Every LLM path is injected
   (`extractChunkFn`, `callLLMFn`, `proposeAgentsUpdateFn`). The only
   `ANTHROPIC_API_KEY` reference is inside a throwing test stub.

## 7. Issues Found

None blocking. Minor observations (non-blocking):

- The phase doc §2.4 inaccuracy (structural log "already partially built in
  Phase 3") was correctly recorded as a deviation rather than silently
  followed.
- `tests/phase-10.test.ts` gates 10.5/10.7 failures were not re-run (out of
  scope per brief); `scripts/compare-pdf-engines.ts` currently compiles
  cleanly under `tsc --noEmit`, so the anticipated Phase 10 tsc error was
  not observed at verification time.

## 8. Overall Recommendation

**APPROVE Phase 9.** All 5 gates pass, the §6 checklist is fully satisfied,
compliance with vision 01 §2/§5 and vision 03 §5 is clean, the recorded
deviations are real and acceptable, and no blockers were found.
