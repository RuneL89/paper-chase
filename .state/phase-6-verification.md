# Phase 6 (DOX Writer, LLM-driven) — Independent Verification Report

**Verifier:** Verifier sub-agent (cold check; no knowledge of Implementer rationale)
**Date:** 2026-07-18
**Spec:** `Implementation Plan/PHASE_06_dox_writer.md` (gates 6.1–6.8 §4, formats §3, pipeline §2/§3.5)
**Pre-check:** `.state/compliance-log.md` [2026-07-18 23:20] (COMPLIANT; two sanctioned extensions)

## Verdict: APPROVED

All 8 gates pass against the spec, the design-level requirements (deterministic enforcement, graceful fallback, pipeline order, production wiring, prompt coverage, DOX Writer prohibitions, deterministic library default, LLM call logging) are all implemented as claimed, and no contradictions with vision 03 §4/§6 or vision 05 §1–§3 were found.

## Commands run (independent)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | CLEAN (no output, exit 0) |
| `npx vitest run tests/phase-06.test.ts` | 12 passed / 12 (1 file, ~5.4s) |
| `npm test` (full suite) | **166 passed + 1 skipped (167 tests, 17 files)**, ~119s |

## LLM-free confirmation for new Phase 6 tests

- `tests/phase-06.test.ts` uses hermetic temp workspaces (`mkdtempSync` under `os.tmpdir()`, removed in `afterAll`), an injected `extractChunkFn` stub for the ingest-integration gates (6.6, 6.7), and an injected `writeDoxIndexFn` stub for the `doxLlm: true` gates (6.8, fallback).
- The phase-06-only run produced zero `LLM Call | Tokens:` stdout lines (observed full output; only Link/Citation/Schema check lines).
- No `llm-calls.json` file exists anywhere in the repo after my runs (`find . -name llm-calls.json` → none); no `dox-writer` entries in any log. The full-suite run did make 12 live Phase 2 Extractor calls via the repo `.env` key (~$0.0115 each, observed in stdout) — established precedent, not a Phase 6 defect.

## Per-gate results (cold)

| Gate | Test (`tests/phase-06.test.ts`) | Result | Evidence |
|---|---|---|---|
| 6.1 every folder has index.md | `every folder has an index.md` (L168) | PASS | Walks all folders except `.state`/`raw`, asserts `index.md` exists in each. Green. |
| 6.2 children list completeness | `index.md lists all pages in folder` (L183) | PASS | Asserts `children` contains `john-smith.md`; implementation builds children from scanned files/sub-folders (`buildChildrenList`). Green. |
| 6.3 wiki index links 4 top folders | `wiki-level index.md links to all top folders` (L199) | PASS | Asserts `entities/`, `topics/`, `documents/`, `sources/` all present. Green. |
| 6.4 valid frontmatter | `index.md has valid YAML frontmatter` (L214) | PASS | `type: index`, truthy `title`, `children` array. Matches vision 05 §3.1 shape (title/type/wiki/updated/children). Green. |
| 6.5 statistics accurate | `index.md statistics are accurate` (L229) | PASS | Counts content files recursively (excluding `index.md`) and matches the written `Entity/Topic/Document pages:` and `Sources:` lines. Semantics match vision 03 §4.4 example (`Pages: 2` in a folder whose children list includes `index.md`). See Finding 1. Green. |
| 6.6 re-ingest regenerates | `re-ingest regenerates index.md files` (L253) | PASS | Stronger than spec: also asserts the new page `new-person.md` appears and mtime increased. `writeDoxContracts` runs unconditionally at the end of `ingest()`, so even a hash-skipped re-ingest regenerates contracts. LLM-free via injected `extractChunkFn` (recorded deviation). Green. |
| 6.7 final validation clean | `DOX pages pass final validation` (L356) | PASS | `result.validation` (first pass) preserved; `result.finalValidation.links.broken` and `.schema.invalid` both `[]`. Observed stdout: first pass "4 links, 0 broken", final pass "35 links, 0 broken, 0 orphaned" — the final pass covers the DOX pages. Green. |
| 6.8 content-based descriptions | `folder index description reflects actual content` (L437) | PASS | `doxLlm: true` + stub: index contains `executive` and `CEO of Acme Corp`, does NOT contain the generic template. Bonus assertions prove deterministic enforcement (below). Green. |

## Design-level requirements (§3 + pre-check)

1. **Deterministic enforcement (vision 03 §6) — VERIFIED.** `writeFolderIndexLlm` (src/dox-writer.ts L516–570) always writes the deterministically-computed frontmatter (`title/type/wiki/updated/children`); `enforceLlmBody` parses the LLM output with `matter()` and keeps only `.content` (LLM frontmatter discarded), then `replaceStatisticsSection` re-imposes the deterministic `## Statistics` lines. Gate 6.8's stub deliberately returns hallucinated frontmatter (`type: entity`, `wiki: wrong-wiki`, `children: ['ghost.md']`) and wrong counts (`999`); the test asserts all of it is discarded (`children` = `['john-smith.md']`, `Pages: 1`, no `999`, no `ghost.md`). The LLM cannot hallucinate files or counts.
2. **Graceful fallback — VERIFIED.** `try/catch` around the LLM call plus a null-enforcement branch both fall back to the deterministic body with `console.warn` (never throws). Test `DOX LLM failure falls back to the deterministic contract` (L491) injects a throwing `writeDoxIndexFn`, asserts the run completes, a warning was emitted, and the fallback `index.md` is byte-identical to a deterministic reference run modulo the `updated` timestamp. A missing API key takes the same catch path (`callLLM` throws).
3. **Pipeline order (§3.5) — VERIFIED** in `src/commands/ingest.ts`: materialize (L329) → optional synthesis (L363–491) → `validateWiki` → `result.validation`, logged+persisted via `logValidation` (L498–502) → `writeDoxContracts` (L507–511) → `validateWiki` again → `result.finalValidation`, logged+persisted (L516–520). `git diff` confirms the reorder from the old validate→synthesis→DOX order. `IngestOptions.doxLlm`/`writeDoxIndexFn` are additive (both optional, default undefined → deterministic). `extract: false` behavior unchanged: single DOX pass, no validations; pre-existing test `ingest without extraction still writes DOX contracts` green.
4. **Production wiring — VERIFIED.** `src/cli.ts` L47: `--no-dox-llm` Commander negated flag → `doxLlm` defaults `true` for CLI runs, opt-out documented. `src/tui/ingest-screen.tsx` L98 passes `doxLlm: true`.
5. **Prompt coverage (§3.2) — VERIFIED.** `prompts/dox-writer.prompt.txt`: map-not-territory role (L1), exact output format incl. frontmatter fields and section order (L35–49), verbatim children/statistics instructions (L8, L20, L42, L49, L52), AGENTS.md writing-rules instruction (L29–30, L54), one folder-level example (L57–88, matches §3.3), one wiki-level example (L90–119, matches §3.4). Placeholders filled in `writeDoxIndexWithLlm` cover every input in §3.1 (children, sub-folders, pages, statistics, page contents, AGENTS.md, rolling memory) plus the recorded extra `{navigation}` placeholder.
6. **DOX Writer prohibitions (vision 03 §6) — VERIFIED.** The only `writeFile` targets in `src/dox-writer.ts` are `<folder>/index.md` (two call sites). No folder creation, no page moves, no content-page writes, no taxonomy decisions anywhere in the diff surface (`git diff` of src/ inspected).
7. **Deterministic library default — VERIFIED.** `doxLlm` absent/false takes the pre-existing deterministic path; the diff to `src/dox-writer.ts` refactors statistics into `buildStatisticsLines` with identical logic (26 removed lines are the moved block) and the fallback test proves byte-identical deterministic output. The 9 pre-existing phase-06 tests are untouched — the test-file diff is 100% additive (176 additions, 0 deletions; only the 3 new tests added).
8. **LLM call logging — VERIFIED.** `writeDoxIndexWithLlm` calls `callLLM` with `callType: 'dox-writer'`, `context` = folder path or `'(root)'`, `maxTokens: 2048`, and `logPath` defaulting to `<wiki>/.state/llm-calls.json`; `src/llm/client.ts` (L112–118, L184–187) appends JSON-lines entries with callType/context/tokens/cost.

## Compliance check (vision 03 §4/§6, vision 05 §1–§3)

- Frontmatter shape (03 §4.2, 05 §3.1): `title/type/wiki/updated/children` — implementation matches exactly.
- Body structure (03 §4.2–§4.4): folder = title + description + `## Pages` + `## Navigation` + `## Statistics`; root = title + description + `## Start Here` + `## Statistics`. Matches.
- DOX Writer role and prohibitions (03 §6): LLM-driven with deterministic children/statistics; no folder creation, page moves, content pages, or taxonomy decisions. Matches.
- Page type `index` (05 §3): naming `index.md`, levels of index. Matches. (05 §1's table says "DOX Writer (deterministic)" while 03 §6 says LLM-driven — a pre-existing inter-doc tension the pre-check already resolved in favor of 03 §6 with deterministic enforcement; the implementation satisfies both readings. NOT a Phase 6 contradiction.)
- **Result: COMPLIANT — no contradictions found.**

## AGENTS.md spot-check

- `tests/AGENTS.md`: claims "with the key — 166 passed + 1 skipped" — matches my measured full-suite count exactly (166+1, 17 files). Without-key claim (154+13) is arithmetically consistent (166−12 live Phase 2 gates) but not re-measured (would require hiding the repo `.env`).
- `src/AGENTS.md`: accurately describes the two dox-writer modes, deterministic enforcement, fallback, post-order processing, `maxTokens 2048`, `callType 'dox-writer'`, the ingest pipeline reorder, `--no-dox-llm`, and the corrected "LLM calls in the pipeline" contract line (was the stale "Extractor is the ONLY LLM call"). Verified against the code.
- `prompts/AGENTS.md` and root `AGENTS.md`: accurately list `dox-writer.prompt.txt` with its real placeholders (cross-checked against `fillPromptTemplate` call sites). Not aspirational.

## Non-blocking findings

1. **Gate 6.5 snippet semantics (pre-existing, unrecorded):** the phase doc's literal gate-6.5 snippet counts `entities/**/*.md`, which would include `index.md` files; the implementation (and its pre-landed test) count content pages excluding `index.md`. The implementation matches vision 03 §4.4's example (`Pages: 2` in a folder whose children list includes `index.md`), so this is a spec-snippet imprecision, not a defect. The test predates Phase 6 (100%-additive test diff). Recorded as a deviation note in the status file.
2. **Empty top-folder edge (pre-existing):** `writeFolderIndex` skips folders with no `.md` files and no sub-folders (pre-Phase-6 behavior, confirmed via `git show HEAD:src/dox-writer.ts` L219). A wiki with an empty top folder (e.g., zero topics extracted) would get no `topics/index.md` while the root children list hardcodes all four top folders. Not exercised by any gate fixture; not introduced by Phase 6.
3. **Unparseable-output fallback branch untested:** the throwing-LLM fallback is tested; the distinct `enforceLlmBody → null` branch (parseable response missing required sections) has no dedicated test. Same outer fallback effect; minor coverage gap.
4. Incidental full-suite spend observed: 12 live Phase 2 Extractor calls at ~$0.0115 each (matches the Implementer's ~$0.14 estimate). Zero `dox-writer` calls.

## State

- This report: `.state/phase-6-verification.md`.
- `.state/phase-6-status.json` updated: `status: verified`, gates 6.1–6.8 passed, nextAction "Reporter: present UAT steps", Finding 1 appended to deviations.
