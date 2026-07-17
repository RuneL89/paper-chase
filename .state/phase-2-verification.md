# Phase 2 Verification Report — The Extractor (Layer 2)

**Verifier:** Independent Verifier sub-agent (cold check; Implementer's status file treated as unverified claims)
**Date:** 2026-07-17
**Spec:** `Implementation Plan/PHASE_02_extractor.md`
**Vision docs checked:** `Project Vision/04_orchestration_detailed.md` §1, §3.2 Step 5, §5, §6, §7; `Project Vision/05_page_types_specification.md` §1, §6, §9
**Compliance entry checked:** `.state/compliance-log.md` [2026-07-17 12:00] (8 binding noted adaptations)

---

## 1. Per-Gate Results (all evidence produced by the Verifier's own runs)

All 12 live gates re-ran in the Verifier's own `npm test` with the key loaded (.env at project root, auto-loaded by `tests/phase-02.test.ts`). Each test was read line-by-line against the phase doc §3 gate code: every assertion is verbatim or pass-criterion-equivalent; none are watered down.

| Gate | Verdict | Evidence |
|---|---|---|
| 2.1 Valid JSON | PASS | Test is verbatim from phase doc §3. Passed live (Verifier run: 3285/1585 tokens). Every entity asserted for name/type/slug-regex/folder-regex/mentions-array. |
| 2.2 Finds every known entity | PASS | Verbatim. Passed live; names contain exactly 'John Smith' and 'Acme Corp' (also confirmed in Verifier's UAT 2.1 extraction). |
| 2.3 Deterministic slugs | PASS | Verbatim (two extractions, sorted slug lists equal). Passed live, AND independently replayed by the Verifier (`vitest -t "deterministic slugs"`): passed again (2 more calls). Determinism is engineered via temperature 0 + `slugify()` normalization (binding adaptation 5), not luck. |
| 2.4 Valid folders | PASS | Verbatim. Passed live; additionally 4 deterministic validator tests cover `entities/../secrets` traversal, 5-segment rejection, 4-segment acceptance, bad prefix. |
| 2.5 Claims with page numbers | PASS | Verbatim. Claim containing '42.5' found with page 2 (within 1-3). |
| 2.6 JSON saved to disk | PASS | Pass criterion preserved (extracted JSON exists, parses, `entities` is an array). Runs hermetically in an mkdtemp workspace per binding adaptation 4 (compliance log sanctions this: repo's test-wiki is already ingested and hash-skip would block extraction). Also asserts the additive `IngestResult.extractions` summary. |
| 2.7 Empty input | PASS | Verbatim. Blank-page chunk returned empty entities/relationships/claims arrays, no crash (2962/63 tokens, $0.0033). |
| 2.8 Rolling memory | PASS | Verbatim assertions (phase doc code's unused `r1` binding is only awaited — assertion semantics unchanged): with `['entities/people/executives']` + `['john-smith']` memory, john-smith's folder is exactly `entities/people/executives`. |
| 2.9 Timeline events | PASS | Verbatim. Event with date containing '2024' ('March 15, 2024') found with truthy event text and entities array. |
| 2.10 Context paragraph | PASS | Verbatim. Context truthy, length > 50 (UAT 2.1 extraction: 474 chars). |
| 2.11 Entity significance | PASS | Verbatim. john-smith significance truthy, length > 20. |
| 2.12 Disambiguation | PASS | Verbatim. `disambiguation` asserted to be a string whenever present on any entity. |

**Gate result: 12/12 PASS on the Verifier's own run, first attempt, no re-runs needed.**

## 2. Schema / Agent / Prompt Conformance (phase doc §2.1–§2.4)

- `src/validation/extractor-schema.ts` covers every §2.4 rule: entities/relationships/claims arrays; entity name/type/slug/folder/mentions; mention page(number)/context(string); relationship subject/predicate/object/evidence/page; claim text/type/entities/page; **all page values within the chunk's parsed page range**; PLUS the sanctioned extension (timeline date/event/entities, context string, per-entity significance string, optional disambiguation string-when-present). Also enforces folder prefix, `..` traversal, ≤4 segments, no empty segments. COMPLIANT.
- `src/agents/extractor.ts` matches §2.2's signature exactly (`extractChunk(chunkText, pageRange, sourceFile, agentsMd, existingFolders, existingEntities)`). Error contract verified by reading + deterministic tests: typed `ExtractorError` carries `rawResponse` on invalid JSON, `issues` on schema failure, and there is exactly one `callLLM` invocation per call — NO retry. COMPLIANT.
- `prompts/extractor.prompt.txt` contains §2.1's fixed instructions in substance: the 8 rules verbatim, the entity page-format bullets verbatim, the citation-format bullets verbatim, and the wiki-context block with all 6 placeholders (`{agentsMd}`, `{existingFolders}`, `{existingEntities}`, `{sourceFile}`, `{pageRange}`, `{chunkText}`). Additions (OUTPUT FORMAT section, page-range rule, existing-state reuse rule, empty-chunk rule) are prompt engineering that strengthen gate reliability without contradicting the spec. COMPLIANT.

## 3. Vision Conformance (04 §1/§3.2/§5/§6/§7, 05 §1/§6/§9)

- **Extractor is the only LLM call in the pipeline:** `grep -rn "callLLM" src/` outside `llm/client.ts` hits only `src/agents/extractor.ts`. COMPLIANT.
- **No Layer 3/4 code:** `src/pages/` contains only `source-page.ts` (Phase 1); `src/agents/` contains only `extractor.ts` + `.gitkeep`. No Materializer, DOX Writer, entity-page, or topic-page code exists. COMPLIANT.
- **Rolling memory read-only:** `src/state/rolling-memory.ts` exports only a reader (absence → empty lists, malformed JSON → descriptive error). No write path exists anywhere in `src/`. COMPLIANT with 04 §5 ("updated after the Materializer finishes" — Phase 3).
- **Output location:** `src/commands/extract-chunk.ts` writes `.state/extracted/<chunk-id>.json`; confirmed live in the Verifier's UAT 2.1 run (file created, top-level keys `entities, relationships, claims, timeline, context`). COMPLIANT with 04 §3.2 Step 5 and the Phase 3 contract (every JSON has entities/relationships/claims arrays).
- **Folder constraints:** validator enforces `^entities/|^topics/`, no `..`, ≤4 segments (= 3 levels below root, matching the wiki constitution). COMPLIANT with 04 §6.
- **Unchanged PDFs skip extraction entirely:** Verifier re-ran `npx tsx src/cli.ts ingest test-wiki` after UAT 2.1: output "Skipping golden-master.pdf (unchanged)" / "0 ingested, 1 skipped" with **0 LLM Call lines**. COMPLIANT with 04 §3.1.
- **Validation order (04 §6):** schema first, then folder/traversal/depth, then page-range — matches the validator's structure. No retry on failure. COMPLIANT.
- **Who decides what (04 §7):** LLM proposes classification/folders; deterministic code does validation, slug normalization, and I/O (sanctioned by binding adaptation 5). COMPLIANT.
- **05 §1:** entity/topic pages remain Layer 3 (not built). **05 §9:** custom types flow through the Extractor's JSON (`type` is a free-form string, timeline extension present). No contradictions.

## 4. Independent Test Runs (Verifier's own, from the project root)

| Run | Result |
|---|---|
| `npx tsc --noEmit` | CLEAN (exit 0) |
| `npm test` WITH key (.env present) | **9 files, 95 passed + 1 skipped + 0 failed (96 total)** — all 12 gates green; the 1 skip is Phase 0 gate 0.4 (requires the exported var by Phase 0 precedent) |
| `npm test` WITHOUT key (`.env` moved aside, `ANTHROPIC_API_KEY` unset) | **9 files, 83 passed + 13 skipped + 0 failed (96 total)** — the 13 skips are exactly the 12 live Phase 2 gates + gate 0.4, all self-skipping via `test.skipIf` per `tests/AGENTS.md` |
| `.env` restoration | VERIFIED (`mv .env.verify-bak .env`; file present, git-ignored, no backup left) |
| Deterministic replay of gate 2.3 | PASSED again (2 calls) |
| Gate 0.4 re-run with exported key (Implementer's claim) | VERIFIED: `set -a && source .env && set +a && npx vitest run tests/infrastructure.test.ts` → 5/5 passed, 1 smoke call (17/4 tokens, $0.0000 displayed) |

**Verifier LLM spend: $0.1845 across 18 calls** — with-key suite $0.1511 (14 calls), gate 2.3 replay $0.0223 (2 calls), UAT 2.1 CLI ingest $0.0111 (1 call), gate 0.4 smoke ~$0.00004 (1 call). Combined Phase 2 total (Implementer $0.1727 + Verifier $0.1845) ≈ **$0.3572**, ~5% of the $7.00 cap.

## 5. Frozen Surfaces

- `callLLM`: diff inspected — additive third parameter `CallLLMOptions { maxTokens?, temperature? }` only; defaults byte-identical (1024 max_tokens, no temperature field unless provided). Existing callers and Phase 0 tests unaffected (gate 0.4 verified above). INTACT.
- Phase 0 `extractText`: `src/extraction/pdf.ts` is not in the Phase 2 diff at all. UNTOUCHED.
- Phase 1 `ingest` with `extract: false`: deterministic test "ingest with extract: false writes no .state/extracted/ JSON" passes in both key modes; Layer 1 output unchanged. PRESERVED.
- Phase 1 test changes: diffs inspected — every change is `extract: false` added at an ingest call site (or the additive `extract` prop on `IngestScreen`), each with an explanatory comment referencing the Phase 2 deviation. MINIMAL AND COMMENTED.

## 6. TUI (phase doc §5)

- `src/tui/extractor-test-screen.tsx` exists and implements §5.1: wiki selector, chunk selector from `documents/` (binding adaptation 6), action panel with default-focused `[ Run Extraction ]` + `[ Back ]`, results panel with counts, entity `name (type)` lines, `JSON saved to .state/extracted/<chunk-id>.json`, `[ View JSON ]` + `[ Back ]`, and a scrollable JSON viewer (Up/Down, PageUp/PageDown, line x-y of z). Escape steps json → results → chunk → wiki → menu. COMPLIANT.
- Menu has 7 items with 'Test Extractor' immediately after 'Ingest PDFs (ingest)'; 'Add PDFs' retained (binding adaptation 7). `Screen` union includes both `'extractor-test'` and `'add-pdfs'`; route exists in `app.tsx`. COMPLIANT.
- TUI tests never call the LLM: `extractChunkFn` is always stubbed in run/error/viewer tests (render-only tests never trigger a run). COMPLIANT.
- Every `useInput` in the new screen is gated `{ isActive: isRawModeSupported === true }`; a non-TTY static fallback renders the wiki list, both buttons, and "requires a TTY". COMPLIANT with src/AGENTS.md.

## 7. Status File Accuracy (spot-check vs Verifier's own results)

| Claim | Verifier result | Match? |
|---|---|---|
| gatesPassed 2.1–2.12, none failed/pending | 12/12 passed on Verifier's run | YES |
| withoutKey: 9 files, 83 passed + 13 skipped + 0 failed | Exactly reproduced | YES |
| withKey: 9 files, 95 passed + 1 skipped + 0 failed | Exactly reproduced | YES |
| tsc clean | exit 0 | YES |
| llmCost $0.1727 (14-call suite $0.1507 + 0.4 re-run + 2 CLI smoke calls) | Verifier's same 14 calls cost $0.1511 (Δ$0.0004 from output-token variance); CLI smoke reproduced at $0.0111 | YES (consistent) |
| cliSmoke "Extracted 4 entities, 4 relationships, 7 claims" | Verifier's UAT 2.1 run: identical line | YES |
| All 8 binding adaptations recorded as deviations | All 8 present and accurately described; implementation choices (extract default-true, --no-extract, shared extract-chunk path, prompt engineering, extra deterministic tests) also documented | YES |

No overclaims found. Minor note (not an overclaim): per-gate token citations in `gateStatus` are point-in-time values and vary slightly run-to-run (e.g. gate 2.1: claimed 3285/1581, Verifier saw 3285/1585).

## 8. UAT Documentation Check

- **UAT 2.1 — VERIFIED LIVE by the Verifier.** Preparatory command `rm wikis/test-wiki/.state/ingestion.json` is correct (hash-skip state removed → re-processing). `npx tsx src/cli.ts ingest test-wiki` printed exactly the documented lines: "Extracting text from golden-master.pdf...", "Chunk 1/1 (pages 1-3)", one "LLM Call | Tokens: 3147/1594 | Cost: $0.0111", "Extracted 4 entities, 4 relationships, 7 claims from chunk golden-master-part-001.", "Done!". `.state/extracted/golden-master-part-001.json` created. Cost to the Verifier: $0.0111. (Side effect, sanctioned by the brief and `wikis/AGENTS.md`: the scratch UAT wiki now holds the extracted JSON and a refreshed `ingestion.json` — the expected end state of UAT 2.1; `wikis/` content is git-ignored user data.)
- **UAT 2.2 — VERIFIED LIVE.** The jq-less node fallback from the status file ran successfully against the real extraction JSON: top-level keys `entities, relationships, claims, timeline, context`; "John Smith" → `entities/people/executives`, "Acme Corp" → `entities/companies`; all folders valid; 2 timeline events; context 474 chars.
- **UAT 2.3 — VERIFIED LIVE.** Single 3-page chunk cost $0.0111 < $0.05.
- **UAT 2.4 — verified by code reading + deterministic tests (not executed live).** Executing it requires editing `prompts/extractor.prompt.txt`, which the Verifier must not modify. The contract is deterministic-tested (`parseExtractorJson` throws `ExtractorError` carrying the raw response; schema failure carries the issue list) and code-verified (exactly one `callLLM` per extraction; `ingest` has no retry loop; `cli.ts` prints `Error: ...` and sets a non-zero exit code). The documented prepare/break/run steps are correct; the restore step has one flaw — see finding F1.

## 9. Non-Blocking Findings

- **F1:** UAT 2.4's restore step says `git checkout -- prompts/extractor.prompt.txt`, but the prompt file is new and uncommitted in this phase, so git cannot restore it. The step becomes correct once the phase is committed (the normal flow before UAT). Flag for the Reporter: run UAT after committing, or restore the edited line manually.
- **F2:** UAT 2.4 live flow was not executed by the Verifier (requires modifying the prompt file; Verifier is read-only on implementation code). Coverage: deterministic tests + code inspection confirm the no-retry, raw-response-carrying `ExtractorError` contract.
- **F3:** `gateStatus` token figures are point-in-time and vary slightly per run (see §7). Informational only.
- **F4:** The live gates read fixtures from the repo's `wikis/test-wiki` (chunk text + AGENTS.md) while `wikis/AGENTS.md` says "Tests do not use this folder". This is read-only fixture use mandated by the phase doc's own gate code (`readFileSync('wikis/test-wiki/documents/golden-master-part-001.md')`); gate 2.6's write-path test is hermetic. No conflict in practice; the wikis contract may want a "read-only fixture exception" sentence in a future DOX pass.

## 10. Verdict

**APPROVED.**

All 12 gates pass on the Verifier's independent run (both key modes behave exactly as claimed), the schema extension matches the binding compliance-log adaptation, the Extractor is the only LLM call, no Materializer/DOX Writer code exists, rolling memory is read-only, frozen surfaces are intact, the TUI matches §5 with the sanctioned adaptations, UAT 2.1–2.3 were reproduced live, the status file contains no overclaims, and combined Phase 2 spend (~$0.36) is ~5% of the $7.00 cap. No vision contradictions found.
