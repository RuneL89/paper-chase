# Phase 13 Verification — Output Caps & Prompt Self-Sizing

**Phase Doc:** `Implementation Plan/PHASE_13_output_caps_and_prompt_self_sizing.md` v1.0.0
**Verifier:** Verifier sub-agent (cold check — all claims independently re-derived)
**Date:** 2026-07-24
**Verdict:** **PHASE 13 VERIFIED** — all 7 gates PASS, scope clean, checklist satisfied (UAT 13.2 remains the user's optional live step).

---

## Gate 13.1 — Cap constants — **PASS**

Static (re-derived by my own greps, not the test):
- `src/agents/synthesis.ts:29` — exactly one `const SYNTHESIS_MAX_TOKENS = 32768;` (grep count = 1); `8192` occurs **0** times in the file; all four call sites pass the constant: lines 220 (`callType: 'synthesis'`), 250 (`'permissive-synthesis'`), 276 (`'topic-synthesis'`), 302 (`'permissive-topic-synthesis'`). One shared constant, no per-language split.
- `src/dox-writer.ts:170` — `const DOX_WRITER_MAX_TOKENS = 8192;` (was 2048); `2048` occurs **0** times; all three call sites covered: lines 919, 1323, 1346.
- `src/agents/extractor.ts:95` — `EXTRACTION_MAX_TOKENS = 16384` unchanged (used at line 343).
- `git diff HEAD` on both files shows ONLY the constant/comment changes and the four literal swaps — nothing else.

Behavior proof (test inspection + my own run): `tests/phase-13.test.ts` test "gate 13.1 (behavior)" spies `llmClient.callLLM` and captures the request `options` objects — it asserts all four synthesis call types arrive with `maxTokens === 32768` (lines 372–380) and that real `writeDoxContracts` calls (folder + root, one chunk materialized so the `hasContent` guard passes) all carry `maxTokens === 8192` with `callType === 'dox-writer'` (lines 418–428). This proves the values reach the request options, not merely the constants' existence. Passed in my run (11/11).

## Gate 13.2 — Prompts carry no word counts + ratified block — **PASS**

- **Word-count sweep (my own grep):** `grep -ri "word" prompts/` — in the four synthesis prompts the only matches are "word**ing**" in the pre-existing verbatim-preservation lines (`synthesis-permissive.prompt.txt:31`, `synthesis-topic-permissive.prompt.txt:20`) — not word counts. Zero `at least N words` / `no more than N words` / `word count` / numeric `words` patterns. ("2-4 paragraphs" Layer-1 shape text is a paragraph count, pre-existing, untouched.) Matches elsewhere are frozen surfaces (`extractor.prompt.txt:77` significance-field guidance, `agents-updater.prompt.txt:28` "reword", `dox-writer.prompt.txt:73` "rewording") — out of scope and unchanged.
- **Verbatim block (byte-level, my own Node script):** extracted the fenced ratified block from `Project Vision/optimizations/optimizations.md` L1b (the RATIFIED SOURCE TEXT) and confirmed the phase doc's copy is byte-identical to it. The block in `prompts/synthesis.prompt.txt` (bytes 2300→EOF) and `prompts/synthesis-permissive.prompt.txt` (bytes 2067→EOF) are each **byte-identical to the ratified text** — em-dashes U+2014 (3 occurrences, matching), straight quotes, LF endings, no CR anywhere.
- **First paragraph:** byte-identical across all four files and equal to the ratified first paragraph (`Length is not a target — completeness is. … then stop.`).
- **ⓣ topic variant:** sentence-level diff of collapsed topic vs entity blocks shows **exactly 4 differing sentences**, and each matches the phase doc's ⓣ specification verbatim: (1) "A richly documented topic earns several paragraphs; a topic supported by a single claim earns a few honest sentences."; (2) the topic completeness list "what this topic is and why it matters across the corpus; which key entities are involved and how; chronology with explicit dates when the evidence supports it; the key claims."; (3) "(one or two claims, …)"; (4) "list every claim from the data above, verbatim." Bullet 4 is claim-only in topic files and mention/relationship/claim/timeline in entity files. Bullet 3 retains "no significant claims or relationships" and the Jane Doe example — correct: the phase doc's ⓣ list specifies only the "one or two mentions" → "one or two claims" substitution, and ONLY those four adjustments are permitted. Max line length 76 chars in both variants. Both topic files byte-identical to each other.

## Gate 13.3 — Prompt diff confined to the amendment — **PASS**

`git diff HEAD -- prompts/` (my own run): each of the four synthesis prompts shows exactly one removed line (the old word-count bullet: `- The page must be at least 300 words of synthesis (Layer 1) [and no more than 2000 words total.]`) and the inserted block at the same tail position; all context lines (`{languageDirective}` block, wikilink rule, citation rule, journalist bullet, data sections/placeholders) byte-identical. `prompts/dox-writer.prompt.txt` shows exactly one added line, seated between the `## Pages` requirement bullet and the `## Statistics` bullet, indented 3 spaces to match its sibling list:
`- Each \`## Pages\` line must tell the reader something the page title alone does not.` — rule text exact. The 2-5-sentence description rule ("One rich description paragraph (2-5 sentences)…") is still present, unchanged. No other prompt text changed.

## Gate 13.4 — Sparse flag written by the Materializer — **PASS**

Rule code (read directly): `src/pages/entity-page.ts:91-95` — `isSparseEntity` returns `mentions.length <= 2 && relationships.length === 0 && claims.length === 0` (single exported rule; vision `02` §4.8 + `05` §2). Frontmatter writer (`entity-page.ts:297-308`) emits `sparse: true` only when true — never `sparse: false` — ordered after `aliases`, before `wiki`/`sources` (title, type, aliases?, sparse?, wiki, updated, sources, tags). `src/materializer.ts:414-438` hoists the deduped mentions/relationships/claims and adds `sparse: isSparseEntity({...})` to the `MaterializeResult.entityPages` data, recomputed from the full extraction set every run.
Tests (inspected + passed in my run): the materialize gate covers 1-mention-no-claims-no-relationships → `sparse: true` present in parsed + raw frontmatter with aliases < sparse < sources ordering; 2-mention-WITH-claim (john-smith) → absent; 3+ mentions (acme-corp) → absent; `sparse: false` never appears (`not.toMatch(/^sparse:/m)` + `'sparse' in data === false`); update-mode lifecycle proven across three materialize runs (1 mention → flag; 2 mentions → flag retained at the ≤2 boundary; 3 mentions → flag gone from the re-derived page, with all 3 mentions accumulated). Unit boundaries: 0/2 mentions sparse, 3 mentions not, 2-mentions+claim not, 1-mention+relationship not.

## Gate 13.5 — Sparse survives synthesis replacement — **PASS**

Read `src/commands/ingest.ts` directly, not just the tests:
- **Strict entity write path (lines 762-769):** `enforceSparseInMarkdown(enforceAliasesInMarkdown(strict.page, …), entityPage.sparse === true)` — composed after the UAT 6.3 aliases enforcement, flag taken from the materializer's structured data, never the model's frontmatter.
- **Permissive entity write path (lines 796-803):** identical composition.
- `enforceSparseInMarkdown` (`entity-page.ts:106-122`): gray-matter round-trip — sets `sparse: true` when the entity is sparse, `delete`s any `sparse` field when not (so a model-emitted `sparse: true` on a non-sparse entity is stripped); pages without frontmatter or with unparseable frontmatter pass through unchanged (it never invents a block).
- **Topic write paths (lines 844-877):** untouched — aliases only, no sparse (entity-only rule). **Template-fallback path (lines 813-829):** no `writeFile` at all — the materializer-written page (already carrying the correct flag) stays on disk.
Tests: strict-pass test (model omits flag for sparse jane-doe → written page gains it; model hallucinates it for john-smith → stripped; `synthesized === 3`); permissive-pass test (strict forced to fail preservation for two entities → permissive write points apply the same re-imposition/strip; `synthesized === 1`, `synthesizedPermissive === 2`). Both passed in my run.

## Gate 13.6 — TUI labels — **PASS**

`git diff HEAD -- src/tui/settings-screen.tsx` shows ONLY the two `modelDox` rows (plus the RECOMMENDATIONS comment block): Anthropic `Sonnet — mid-tier; structural navigation, correctness re-imposed deterministically` (Opus gone); OpenAI `GPT-5.6 Terra — mid-tier; structural navigation, correctness re-imposed deterministically` (Sol gone). `modelExtractor`/`modelSynthesis` rows byte-unchanged; no defaults, catalogs, or routing code touched (label-only, per the ratified L2-as-settings-guidance). README.md diff updates the same two suggestion strings to identical text and nothing else. Render tests (ink fake-TTY harness) assert the new labels render for both providers, the old "strong contract writing"/"Sonnet/Opus"/"Terra/Sol" strings are absent, and the other rows render intact — passed in my run.

## Gate 13.7 — Full regression — **PASS** (run by me, key-less)

- `npx tsc --noEmit` → **exit 0, zero output**. Note: the known external noise (TS7016 in `scripts/reconciler-smoke.ts`, user-owned) did **not** reproduce — the file no longer errors (user-fixed since Phase 12); `scripts/` is untouched in git status. No other errors.
- Key-less protocol: `.env` existed (171 bytes, 1 API_KEY line) → renamed to `.env.bak-verify13` → `npm test` → restored immediately after; the phase-13-alone confirmation run repeated the same rename/restore. Final state verified: `.env` present with original size/timestamp/key line, no `.env.bak-*` left behind.
- **Verbatim result:** `Test Files 18 passed | 1 skipped (19)` / `Tests 270 passed | 14 skipped (284)`, exit 0, duration 20.89s. Matches the expected 270+14 across 19 files exactly (Phase 12 baseline 259+14 across 18 + 11 new). The "ANTHROPIC_API_KEY is not set … writing the deterministic contract instead" lines in the output confirm the key-less profile was genuinely in effect — zero live calls.
- `tests/phase-13.test.ts` alone: **11 passed (11)**.
- Pre-existing-test audit: `tests/phase-11.test.ts:627,644` `maxTokens: 2048` verified fixture-local — a caller-supplied option in the OpenAI request-body mapping test (`max_completion_tokens: 2048` assertion), unrelated to `DOX_WRITER_MAX_TOKENS`. No pre-existing test asserted the removed word-count lines or old caps; no test edits outside `tests/phase-13.test.ts` (new) and the `tests/AGENTS.md` DOX entry.
- With-key profile: NOT run (budget $0) — projected 282 passed + 2 skipped per the status file; verify with a key before any release.

---

## Scope / compliance sweep — **CLEAN**

`git diff HEAD --stat` + `git status --short` (my own runs). Every touched file accounted for:

**In phase scope:** `src/agents/synthesis.ts`, `src/dox-writer.ts`, `src/pages/entity-page.ts`, `src/materializer.ts`, `src/commands/ingest.ts`, `src/tui/settings-screen.tsx` (diffs confined to the phase changes — verified hunk-by-hunk); the 5 prompt files; `tests/phase-13.test.ts` (new); the DOX pass (`src/AGENTS.md`, `prompts/AGENTS.md`, `tests/AGENTS.md`, `README.md`).

**Ratification/planning artifacts (pre-implementation canon work in the same uncommitted tree, content verified against `optimizations.md` decisions):** `Project Vision/01/04/05/07` promotions (output-token ceilings §6/§5, `sparse` field §2, curation/concurrency amendments), `Project Vision/AGENTS.md` + `Project Vision/optimizations/` (untracked decision record), root `AGENTS.md` (the 2026-07-23 routing-preference bullet — the phase's own canon basis — and the Child-Index "Phases 0–9, 11–15" line), `Implementation Plan/AGENTS.md` + master index + master prompt (phase 13/14/15 rows), untracked `PHASE_13/14/15` docs.

**Framework lifecycle:** `.state/phase-12-status.json` modified — `verified-awaiting-uat` → `completed` with a `uatAcceptance` record (user-accepted 2026-07-23) and nextAction → Phase 13. Legitimate bookkeeping, not implementation scope creep. `.state/compliance-log.md` +113 lines (pre-check + implementation entries, both COMPLIANT — see below).

**Untouched as required:** `scripts/`, `dist/` (gitignored), `wikis/` runtime content (gitignored), `package.json`, `package-lock.json`, `vitest.config.ts`, `tsconfig.json`, golden masters, extractor/updater/workspace prompts. No stray `.state/` files. `.zcode/` (untracked, contains only an empty `plans/` dir dated Jul 23 23:41) is ZCode-CLI tooling noise, not a phase artifact. Temp helper `.state/phase13-prompt-splice.mjs` confirmed absent.

**DOX-pass quality (read in full):** `src/AGENTS.md` — 8 added word-diff segments, all accurate: the synthesis bullet's `SYNTHESIS_MAX_TOKENS = 32768` note, the dox-writer 8192 note, the entity-page sparse-rule/helpers note, the materializer `sparse` data note, the ingest re-imposition note, the settings-screen label note, and two new Local Contracts (output-token-ceiling doctrine; sparse frontmatter rule) — none contradict existing bullets. `prompts/AGENTS.md` — the four synthesis bullets + DOX bullet + Verification line accurately describe the amendment (word-count removal, self-sizing block, exactly-four ⓣ adjustments, rule seating). `tests/AGENTS.md` — phase-13 ownership entry + updated Verification counts (270+14/19 files) match my own run exactly. Root `AGENTS.md` needed no Phase-13 implementation claims (correct: its two diff lines are ratification-time/plan-index records). Compliance-log entry `[2026-07-24 07:34]` is present, accurate against my findings, and shows no unresolved contradictions.

---

## Checklist audit (phase doc §5)

| # | Item | Result |
|---|---|---|
| 1 | All 7 technical gates pass (`npm test` green; full suite unregressed) | **Met** — 13.1–13.7 PASS per above; 270+14/19 files, exit 0, re-run by verifier |
| 2 | All 3 UAT steps pass (13.2 may be demonstrated by gate evidence) | **Met as far as verification can take it** — UAT 13.1 demonstrated by gate 13.2/13.3 byte-evidence; UAT 13.3 demonstrated by gate 13.6 render tests; UAT 13.2 (optional live ingest, real cost) remains the user's step |
| 3 | Synthesis 32768 / DOX 8192 / Extractor unchanged; no per-language split | **Met** — one shared constant at all 4 synthesis sites; 8192 at all 3 DOX sites; 16384 intact |
| 4 | Zero word counts; ratified block verbatim (topic variants per ⓣ) | **Met** — byte-proven against `optimizations.md` L1b; exactly the 4 ⓣ adjustments |
| 5 | Prompt diffs confined to the amendments | **Met** — git-diff evidence above |
| 6 | `sparse: true` deterministic for ≤2-mention claim-less/relationship-less entities; survives synthesis; absent elsewhere | **Met** — code + boundary + lifecycle + re-imposition/strip evidence above |
| 7 | TUI DOX labels mid-tier on both providers; no defaults changed | **Met** — label-only diff; render tests green |
| 8 | Compliance log shows no unresolved contradictions | **Met** — pre-check + implementation entries, both COMPLIANT |
| 9 | No new LLM calls in implementation testing; budget $0 | **Met** — 11/11 LLM-free (spies/stubs/mocked transport); key-less suite re-run; $0 |

---

## Nits / notes for the user (non-blocking)

1. The status file's "root AGENTS.md needed NO edit" refers to the Phase-13 DOX pass proper; the working tree's root-AGENTS.md diff is the ratification-time routing bullet + the plan-index line — accurate, just worth reading precisely.
2. The tsc TS7016 known-noise in `scripts/reconciler-smoke.ts` no longer reproduces (user-fixed since Phase 12) — tsc is now fully clean.
3. UAT 13.2 (live sparse-flag ingest) is un-run by design (optional, costs money); the with-key suite profile (projected 282+2) should be run before any release.
4. Untracked `.zcode/plans/` tooling dir and the untracked `PHASE_14/15` + `Project Vision/optimizations/` ratification artifacts sit alongside the phase — expected, but they will ride along in any "commit everything" gesture.

## Final verdict

**PHASE 13 VERIFIED.** All 7 gates independently confirmed with file/line evidence and a verifier-run key-less regression (270 passed + 14 skipped across 19 files, tsc clean, `.env` restored). No blockers. Recommended status: `verified-awaiting-uat` (UAT 13.1–13.3 for the user; 13.2 optional live).
