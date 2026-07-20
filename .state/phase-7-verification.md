# Phase 7 Verification: Multilingual Ingestion

**Date:** 2026-07-20
**Verifier:** Verifier sub-agent (independent, cold review — no knowledge of implementer rationale)
**Spec:** `Implementation Plan/PHASE_07_multilingual_ingestion.md` (full); `Project Vision/04_orchestration_detailed.md` §9; `02_WIKI_concept_detailed.md` §3.4; `05_page_types_specification.md` §2.1; `06_citation_and_provenance.md` §8

---

## 1. Diff Scope Review

`git status` / `git diff` confirm the change set matches the expected list exactly:

- **New (untracked):** `src/utils/language.ts`, `src/state/language.ts`, `scripts/create-golden-master-da.ts`, `test-pdfs/golden-master-da.pdf`, `tests/phase-07.test.ts` — all present.
- **Modified:** `src/utils/slug.ts`, `src/agents/extractor.ts`, `src/agents/synthesis.ts`, `src/dox-writer.ts`, `src/commands/init.ts`, `src/commands/ingest.ts`, `src/commands/extract-chunk.ts`, `src/cli.ts`, `src/tui/init-screen.tsx`, `src/tui/ingest-screen.tsx`, `templates/AGENTS.md`, six `prompts/*.prompt.txt`, `.state/compliance-log.md` (pre-check entry).
- **Correctly NOT modified:** `prompts/dox-writer-workspace.prompt.txt` (already carries `{outputLanguage}` per the Phase 6 amendment), `prompts/AGENTS.md`, all pre-Phase-7 test files (`git status tests/` shows only the new `phase-07.test.ts` as untracked; `git diff --stat tests/` is empty).
- **No Phase 8/9 code:** no multi-PDF compounding code; `--update-agents` remains the pre-existing Phase 1 no-op flag.

## 2. Gate-by-Gate Results (against `tests/phase-07.test.ts` AND the production code)

| Gate | Result | Evidence |
|---|---|---|
| 7.1 Transliteration maps | **PASS** | `src/utils/language.ts` maps match vision §9.3 exactly: DA_NO `æ→ae ø→oe å→aa` (+uppercase) shared by da/no; DE `ä→ae ö→oe ü→ue ß→ss`; SV `å→a ä→a ö→o` as a separate map (deliberately not merged); en/fr/es empty maps. `transliterate()` applies the explicit map char-by-char BEFORE `normalize('NFD')` + `\p{M}` strip. All gate assertions verified by reading code, and test passes (incl. supplementary `Æblegrød`→`aeblegroed`, `transliterate('Å','da')==='Aa'`, `getLanguage('jp')` throws). |
| 7.2 English default byte-identical | **PASS** | `git diff src/utils/slug.ts`: when `language` is omitted/`'en'`, the code path is `slugify(name)` on the original string with the identical lowercase/filter regexes — byte-identical. `buildLanguageDirective(*, 'en', 'en')` returns `''` for all three roles. Test 7.2b additionally proves `applyLanguageDirective(template, '')` removes the whole `=== LANGUAGE ===\n{languageDirective}\n\n` block (LF and CRLF variants) so all six filled prompts are byte-identical to pre-Phase-7 (vision §9.4). |
| 7.3 Extractor slug normalization | **PASS** | `normalizeExtractorSlugs(data, language?)` threads the language into every `slugify()` call (entity slugs, relationship subject/object, claim/timeline entity arrays). `extractChunk` calls it with the resolved input language. Test asserts raw `Søren Møller` → `soeren-moeller` etc., and omitted-language byte-identical behavior (`s-ren-m-ller`). |
| 7.4 Directive reaches every prompt | **PASS** | Extractor: `applyLanguageDirective(filled, buildLanguageDirective('extractor', input, output))` before `callLLM`. Synthesis: all four functions route through the shared `buildSynthesisPrompt(..., language?)` which fills the directive. DOX Writer: `writeDoxIndexWithLlm` fills it from `context.language`. Test mocks `callLLM` and asserts every captured prompt (extractor, synthesis, topic-synthesis, all dox-writer calls) contains the language name and NO raw `{languageDirective}`. Gate 7.4b proves en/en prompts carry no LANGUAGE block at all. No raw placeholder can reach the LLM. |
| 7.5 Language state round-trip | **PASS** | `init` replaces `{{OUTPUT_LANGUAGE}}` with the language's English name (`getLanguage(...).name`, default English) alongside `{{WIKI_TITLE}}`/`{{SLUG}}`, and persists `.state/language.json` via `writeWikiLanguage`. Test asserts constitution contains "Danish", no leftover `{{OUTPUT_LANGUAGE}}`, state `{da, en}` after init, `{da, da}` after `ingest --input-language da`, and absent-file → `{en, en}` defaults. `readWikiLanguage` validates codes, throws on malformed JSON. |
| 7.6 End-to-end Danish ingest | **PASS** | Test drives the REAL `extractChunk` (mocked `callLLM`) with `inputLanguage: 'da'` — transliteration happens in production code. Asserts `entities/people/soeren-moeller.md`, `places/koebenhavn.md`, `companies/moebler-a-s.md` exist and parsed frontmatter titles are verbatim (`Søren Møller`, `København`). **Noted deviation from the gate's literal snippet:** title is unquoted in YAML (entity-page writer only quotes YAML-sensitive titles); the test verifies verbatim-ness via `matter(page).data.title` — pass criterion (transliterated filenames, verbatim titles) fully met; the test documents this inline. |
| 7.7 Cross-language synthesis preservation | **PASS** | English Layer 1 + verbatim Danish Layer 2 passes strict preservation: `synthesized=1`, `synthesizedPermissive=0`, `synthesisConflicts=0`, topics likewise. Page contains English prose AND the verbatim Danish claim `Virksomheden omsatte for 12,5 millioner kr. i 2024`. The ingest code threads `language` into both strict and permissive entity/topic synthesis calls. |
| 7.8 Input-language-change warning | **PASS** | `ingest.ts`: warning fires only when resolved input ≠ stored `lastInputLanguage` AND `.state/extracted/` contains `.json` — matches phase §3.11 and vision §9.3 exactly, including the prescribed message ("differs from the last run ... slug forking"). Test covers: fires on en→da switch with extractions; silent on repeat same-language run; silent on first run (no extractions yet). |

**Gates: 8/8 PASS** (plus supplementary tests 7.2b, 7.4b — 10 tests total).

## 3. Vision Compliance

- **Vision 04 §9.1 (two settings):** Output per-wiki at init (AGENTS.md + `.state/language.json`), input per-run; 7-language set; CLI flags `--input-language`/`--output-language` on both `init` and `ingest`. COMPLIANT.
- **Vision 04 §9.2 / 02 §3.4 / 06 §8 (layer rule):** Directive texts match phase §3.2 wording nearly verbatim (extractor: free-text fields in input language, mentions verbatim, folders in output language; synthesis: Layer 1 in output language, Layer 2 EXACTLY as supplied; dox: prose in output language, titles/entity names verbatim). The dox text uses `## Pages` / `## Start Here` without backticks vs the phase doc's backticked version — cosmetically different, semantically identical; non-blocking. Preservation check (verbatim substring) is untouched, so translated Layer 2 fails by design. COMPLIANT.
- **Vision 04 §9.3 / 05 §2.1 (slugs):** maps, map-before-NFD ordering, en/omitted byte-identical, titles verbatim. COMPLIANT (gate 7.1).
- **Vision 04 §9.3 (slug-forking caution):** warning condition and message match; TUI shows inline warning + explicit confirm gate. COMPLIANT.
- **Vision 04 §9.4 (mechanism):** single `{languageDirective}` placeholder per prompt, no per-language prompt files, empty-for-en/en with byte-identical cleanup (`applyLanguageDirective`). Deterministic code (extraction/chunking/materialization/validation) unchanged and language-neutral. COMPLIANT.

## 4. Specific Verifications Requested

- **Resolution order (ingest):** output = flag → `.state/language.json` → `'en'`; input = flag → `lastInputLanguage` → `'en'`. Verified in code (`getLanguage(options.outputLanguage ?? languageState.outputLanguage)` etc.). Invalid codes throw via `getLanguage`. Per-run output override is NOT persisted: both `writeWikiLanguage` calls write `languageState.outputLanguage` (the stored value), keeping the wiki's output language fixed per vision §9.1. `lastInputLanguage` persisted after every run, including the zero-PDF early return. CORRECT.
- **init:** `## Language` section added to `templates/AGENTS.md` after `## Purpose` with the exact phase §3.6 wording; `init` fills all three double-brace placeholders; no leftover `{{OUTPUT_LANGUAGE}}` (test-asserted). CORRECT.
- **TUI init screen:** Output Language dropdown (7 languages, English pre-selected at index 0) below Workspace; Title/Workspace remain the only `TextInput`s; Left/Right cycles; Enter on the dropdown submits (preserves the old Title→Tab→Tab→Enter flow); choice threaded to `init()`. COMPLIANT with §6.1.
- **TUI ingest screen:** Input + Output dropdowns pre-selected from `readWikiLanguage` whenever the selected wiki changes; warning block renders only when chosen input ≠ `lastInputLanguage` AND `.state/extracted/` has JSON; `startIngest` routes to a `confirm` status requiring explicit Enter (Escape cancels; other keys ignored); keyboard-only (Tab focus, arrows cycle). COMPLIANT with §6.2.
- **Fixture:** `test-pdfs/golden-master-da.pdf` exists; SHA-256 independently computed = `55d040c7dea6e7b797614e602b25f9c77c8c4e8d48aeb593b56ae3b279b3dd29` — matches the implementer's claim. `scripts/create-golden-master-da.ts` documents run-once provenance and content: 2 pages; persons "Søren Møller", "Åse Lindberg"; places "København", "Aarhus"; company "Møbler A/S"; Danish financial figures "12,5 millioner kr." (p1), "3,2 millioner kr." (p2). Meets phase §3.1. COMPLIANT.
- **Latent Phase 5 repair (`prompts/synthesis-topic-permissive.prompt.txt`):** VERIFIED CORRECT AND MINIMAL. The template previously lacked the `=== TOPIC DATA ===` section while `writePermissiveTopicSynthesis` → `buildTopicSynthesisValues` fills `{topicName}`, `{entities}`, `{claims}`, `{sources}`, `{context}` — placeholders that would have reached the LLM raw. The added section (lines 6–16) is byte-identical to the `=== TOPIC DATA ===` section of `synthesis-topic.prompt.txt`, and the value keys exactly match. Correct minimal repair of a real latent defect.
- **Pre-Phase-7 tests untouched:** `git status tests/` — only `tests/phase-07.test.ts` untracked; no tracked test modified. CONFIRMED.

## 5. Independent Runs (not trusting prior claims)

- `npx tsc --noEmit` — **clean, exit 0**.
- `npx vitest run tests/phase-07.test.ts` — **10/10 passed** (1.74s).
- `npx vitest run tests/tui/menu.test.tsx tests/tui/phase-01-screens.test.tsx tests/phase-01.test.ts` — **28/28 passed** (3 files).
- Full suite `npx vitest run` — 207 passed, 1 skipped, **2 failed** in `tests/phase-02.test.ts` ("extractor handles chunk with no entities", "extractor returns disambiguation for ambiguous names") — both are pre-Phase-7 LIVE-LLM tests that failed with `Anthropic API error (HTTP 529): Overloaded`. **Rerun of `tests/phase-02.test.ts` alone: 31/31 passed** — transient API overload, not a code regression. Effective full-suite status: green.
- Fixture hash — verified (see §4).

## 6. Deviations and Non-Blocking Findings

1. **`.state/phase-7-status.json` missing.** Phase doc §3.1 requires the fixture SHA-256 recorded there; §7 checklist and §9 require total Phase 7 LLM cost logged there. The file does not exist. (The hash was independently verified above, so the fixture itself is fine — the status record is the gap.) Non-blocking for gates; must be written before phase close-out per the checklist.
2. **`test-pdfs/AGENTS.md` not updated.** Phase §3.1 says record the SHA-256 in `.state/phase-7-status.json` **and** `test-pdfs/AGENTS.md`. The file's Ownership section still lists only `golden-master.pdf` (Phase 7 fixture mentioned only prospectively in Local Contracts). Same class of gap as #1.
3. **`prompts/AGENTS.md` placeholder contract not updated.** Phase §3.5 grounds the fill obligation in "the placeholder contract in `prompts/AGENTS.md`", but that file's per-prompt placeholder lists were not extended with `{languageDirective}` for the six modified prompts. The code-side obligation is fully met (gate 7.4); this is a documentation-contract gap only.
4. **Gate 7.6 literal-snippet deviation (sanctioned in-test):** title is unquoted YAML; verbatim-ness verified via parsed frontmatter instead of the literal `title: "Søren Møller"` string. Pass criterion met; documented inline in the test.
5. **Dox directive text drops the phase doc's backticks** around `## Pages` / `## Start Here` (§3.2 wording). Cosmetic; non-blocking.
6. **Pre-existing oddity (not a Phase 7 change):** tracked file `.state/debug-extractor-raw.txt` contains a captured raw LLM refusal string ("Sorry, I cannot help with that."). Unchanged by this phase; flagged for Phase 8/10 cleanup.

No Phase 8 (multi-PDF compounding) or Phase 9 (AGENTS.md updater) code exists. No production-code issues found. No blocking findings.

## 7. Verdict

**APPROVED** — all 8 gates pass against both test and production code; vision §9 / 02 §3.4 / 05 §2.1 / 06 §8 compliant; English-default surface byte-identical; the synthesis-topic-permissive repair is correct and minimal; TUI requirements met; fixture verified by independent hash. The three status/documentation gaps (findings 1–3) are non-blocking housekeeping required by the §7 checklist before the phase is formally closed; they do not affect any gate or runtime behavior.
