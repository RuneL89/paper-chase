# E2E Bug Report

**Date:** 2026-07-15
**Status:** Phase 1 (code review + fixes) complete; build green, 248/248 tests pass. Phase 2 (live E2E) in progress.
**Note:** The user explicitly authorized dirtying the working tree in this run; all fixes are applied directly to the working tree for review.

## Bug 1: Test suite overwrites committed fixture PDFs, dirtying the working tree (Phase 1, regression from previous run — still present)

- **Severity:** Blocking for E2E (violates the hard constraint that the CLI repository must remain clean during the run).
- **Phase/step:** Phase 1 code review, before the live run.
- **Observed behavior:** `tests/fixtures/pdf-helpers.ts` wrote generated PDFs (`five-page.pdf`, `ten-page.pdf`, `hundred-page.pdf`, `table.pdf`, `multi-page-table.pdf`, `scanned.pdf`, `medium-scan.pdf`, `malformed.pdf`) directly into `tests/fixtures/` via `fixturePath()` = `__dirname`. These files are git-tracked, and `pdf-lib` output is not byte-identical across runs, so every `npm run test` run modified the tracked PDFs and dirtied the working tree. This was Bug 1 of the 2026-07-14 E2E run and had not been fixed.
- **Expected behavior per Project Vision / AGENTS.md:** E2E runs must leave the repository untouched; only the dedicated workspace under `C:\temp` (plus `plan/` artifacts and required fixes) may change.
- **Root cause:** `fixturePath()` resolved into the committed fixtures directory; the generator helpers regenerate the PDFs on every suite run with non-deterministic bytes (embedded creation timestamps/IDs).
- **Affected files:** `tests/fixtures/pdf-helpers.ts`; consumers `tests/extractor.test.ts`, `tests/extractor/pdf.test.ts`, `tests/chunking/chunker.test.ts`, `tests/writers.test.ts`, `tests/integration.test.ts`.
- **Fix applied:** `fixturePath()` now resolves into a per-run temp directory (`mkdtempSync(os.tmpdir()/wiki-generated-fixtures-)`). All generator helpers return the temp path, which is what every consumer test uses. The committed PDFs remain in `tests/fixtures/` untouched for the tests that read them by literal path (`tests/sample.test.ts`, `tests/ingest.test.ts`). Verified: focused test run passes and `git status` shows no fixture modifications.
- **Vision alignment:** The Project Vision does not govern test fixtures; the fix touches no LLM/deterministic authorship boundary, adds no fallback, and no approval gate. It matches prior fix suggestion 1A (95% confidence) from the 2026-07-14 run.

---

## Phase 1 code-review findings and fixes (all verified against Project Vision before implementation)

Four parallel review agents audited the implementation against `Project Vision/` (01, 02, 03, 04, 05, 06, 07). Findings below are numbered Bug 2..N. Every fix was checked against the vision text before being applied; two reported findings were **rejected as non-bugs** because the vision explicitly sanctions the behavior (see "Rejected findings").

## Bug 2: `refreshPageState` re-baselines manually edited pages, silently disabling manual-edit protection across runs

- **Severity:** Critical (vision violation — preservation-first).
- **Observed:** After every ingest/reingest, `src/ingestion/state.ts` re-hashed EVERY page on disk as the new "generated" baseline — including pages just skipped because a human edited them. Protection lasted one run; the next run would feed the human's page to the LLM for rewrite.
- **Expected (07 §3.1, 04 Step 6):** Manually edited pages are skipped and reported, never LLM-rewritten; the stored hash is the last generated version.
- **Fix:** `refreshPageState` now takes the set of paths the system wrote this run; a page whose content differs from its stored hash and was not written this run keeps its old baseline, so the conflict stays detectable forever. `engine.ts` passes the written-path set.

## Bug 3: Page-state tracking of root-level files would delete `AGENTS.md` / move `chunking-strategy.md` during reingest

- **Severity:** Critical (latent data loss).
- **Observed:** `refreshPageState` tracked root-level files. `AGENTS.md` (type `agents-guide`) maps to no folder in any hierarchy, so `runReingest` after a structural change would take the "page type removed → delete" branch and **delete the wiki's AGENTS.md**; `chunking-strategy.md` (no frontmatter, defaulting to type `document`) would be **moved into `documents/`**.
- **Fix:** Root-level files are excluded from page-state tracking (they are contracts/guides, not content pages); `.state/` and `lint/` directories are skipped from the walk.

## Bug 4: Legacy entity migration bypassed manual-edit detection and orphaned page state

- **Severity:** High (vision violation — manual edits could be LLM-rewritten).
- **Observed:** `chunk-materializer.ts` renamed legacy flat `entities/<slug>.md` files into typed sub-folders BEFORE the manual-edit check, then looked up state under the NEW path (no entry → "not manually edited"), so a human-edited legacy page went straight to the LLM rewrite. The old state entry was never re-keyed.
- **Fix:** The manual-edit check now runs against the legacy path before any rename; manually edited legacy pages are skipped with a conflict report (no migration, no rewrite). On migration, the state entry is re-keyed via a new `movePageState` helper so detection continues on the new path.

## Bug 5: Partial LLM writer output silently dropped chunk evidence

- **Severity:** High (vision violation — 07 §8).
- **Observed:** If the EntityTopicPageWriter returned bodies for only some requested pages, the missing pages were skipped with a warning. The vision's only sanctioned skips are manual-edit conflicts and preservation failures; incomplete LLM output must get one stricter repair retry, then abort.
- **Fix:** `callEntityTopicWriterWithRetry` validates completeness (every requested entity/topic has a non-empty body); a shortfall triggers the single repair retry naming the missing pages, outputs are merged, and a remaining shortfall aborts the run with `CLIError`. Name matching is case-insensitive to avoid spurious mismatches.

## Bug 6: `skipManualEdits: false` escape hatch allowed overwriting/deleting manually edited pages

- **Severity:** Medium (latent — no production caller used it).
- **Fix:** The option was removed from `reingest.ts`; manual edits are always skipped and reported. Tests asserting overwrite behavior were updated.

## Bug 7: Chunks that failed validation were committed to the wiki anyway

- **Severity:** Critical (vision violation — 07 §8, 06 §6).
- **Observed:** After exhausting the Critic/completeness retry loop, `orchestrator/ingest.ts` wrote the chunk's document page regardless, demoting blocking issues (unmapped citations, dropped tables) to warnings.
- **Expected:** "If the repaired output is still invalid, the run aborts and the error is reported."
- **Fix:** After the retry loop, remaining Critic blocking issues or deterministic validation failures now abort the run with the full issue list. Non-blocking advisory issues remain warnings.

## Bug 8: Deterministic code fabricated LLM-owned frontmatter (`tags`, `related`)

- **Severity:** High (vision violation — Principle 1; 05 §6.1/§7.1 show corpus-specific LLM-authored values).
- **Observed:** Entity pages got hard-coded `tags: [<type>, 'entity']`; topic pages got `tags: ['topic', 'theme']` and `related` silently derived from mention sources; `normalizePagePlan` injected fabricated `related` entries into LLM topic plans.
- **Fix:** The EntityTopicPageWriter contract now requires the LLM to author `tags` (entities and topics) and `related` (topics); the parser rejects entries missing them (routing through repair-then-abort); the writers (`entities/index.ts`, `topics/index.ts`) refuse to write pages without LLM-authored values; all deterministic fabrication and injection was removed.

## Bug 9: Frontmatter schema contradicted the vision (closed taxonomy, wrong `mentions` type, missing `updated`, unvalidated `sources`)

- **Severity:** High (05 §1 open taxonomy; 05 §6.1 `mentions` count; 05 §2 universal minimum; 06 §3.1 source entries).
- **Observed:** `validation/schema.ts` rejected any page type outside the six defaults (making LLM-created types like `timeline` impossible end-to-end); required entity `mentions` to be an **array** while the system's own writer emits a **number** (every entity page failed its own schema); did not require `updated` on topic/entity/source/raw; validated `sources` only as "is an array".
- **Fix:** Unknown page types are validated against the universal minimum (`title`, `type`, `updated`) instead of rejected (contract declaration is lint's job); `mentions` validates as a number; `updated` is required for all six default types (writers already emit it); each `sources` entry must have `file` + `pages`. The lint required-field map gained `updated` accordingly.

## Bug 10: PagePlanner never saw the chunk list; a deterministic default page plan papered over the gap

- **Severity:** High (vision violation — the LLM plans all pages; 07 §8 repair-then-abort).
- **Observed:** The PagePlanner context contained no chunk ids, so its document-page plans could not match `documents/<chunk-id>.md`; `chunkWriterForChunk` then silently fabricated a deterministic default plan for every chunk — deterministic code, not the LLM, was effectively planning all document pages.
- **Fix:** The PagePlanner context now lists every chunk (id, page range, title, required fileName); plan completeness is validated with one repair retry naming missing chunks, then abort. The deterministic default plan was deleted; a missing plan at write time is now a hard error. The `page-planner.md` prompt states the per-chunk requirement explicitly.

## Bug 11: Deterministic n-gram topic extraction decided which topic pages exist

- **Severity:** High (vision violation — 02 §4 "the LLM decides what synthesized content pages exist").
- **Observed:** `extractTopics` (a capitalized-phrase frequency counter) seeded rolling-memory topics per chunk and drove which topic pages the materializer created. Deterministic heuristics in `normalizePagePlan` also silently dropped LLM-planned topic pages (generic-heading and entity-overlap filters).
- **Fix:** Topics are seeded exclusively from the LLM PagePlanner's topic plans before the chunk loop; the materializer matches chunk content against LLM-decided topics only (with a last-chunk catch-all so every planned topic page materializes at least once per source); the silent topic-drop heuristics were removed — quality objections belong to the Critic loop.

## Bug 12: EntityCritic prompt/parser mismatch aborted runs on prompt-compliant output; no repair retry

- **Severity:** High (E2E reliability; 07 §8 mandates one repair retry).
- **Observed:** `entity-critic.md` declared `issues` optional, but the parser required it; an LLM that followed the prompt aborted the whole run, with no repair attempt. `chunkingPlanner` likewise had no repair retry.
- **Fix:** The parser defaults `issues` to `[]`; EntityCritic now goes through `callAgentWithRepair` (one stricter retry, then abort); ChunkingPlanner got the same repair pattern; the prompt now says `issues` may be empty but must be present.

## Bug 13: ChunkingPlanner hardcoded Kimi-only `model: 'k2.6'` for every provider

- **Severity:** High for non-Kimi providers (request for a nonexistent model → run abort).
- **Fix:** The lightweight-model/thinking override is now gated on `llmClient.provider() === 'kimi'`; a `provider()` accessor was added to `LLMClient`.

## Bug 14: ChunkWriter contract fragility (the previous run's Bug 2 hot spot)

- **Severity:** High (E2E reliability; Principle 2 citation integrity).
- **Observed:** Required frontmatter was conveyed only via a JSON example; `sources[].id` — the join key for `[^srcN]` citation integrity — was never stated as required and never validated, so an id-less sources entry passed validation and then every citation on the page failed lint, burning the retry budget.
- **Fix:** The prompt now has an explicit "Required frontmatter fields" list including the `id` join-key rule; `normalizePageUpdate` validates that every sources entry carries a non-empty `id`.

## Bug 15: Critic prompt contained a false scope note and ran at temperature 1.0

- **Severity:** Medium (quality enforcement weakened).
- **Observed:** `critic.md` told the Critic that preserved tables/extracted detail "are appended by deterministic code after drafting, so do not flag their absence" — false (nothing is appended; that would violate Principle 1 if true), and it instructed the Critic to wave through pages missing preserved detail. The Critic also ran at temperature 1.0 vs 0.2 for every other agent.
- **Fix:** The scope note now states the ChunkWriter alone owns preserved detail and missing detail is a blocking issue; Critic temperature set to 0.2.

## Bug 16: Structural-change log inaccuracies and stale approval-era code

- **Severity:** Medium (07 §6 record quality; vocabulary hygiene).
- **Observed:** Folder removals were logged inside records renamed `…-applied.md` although removals are never applied; pros/cons were identical boilerplate; "Required contract updates" was future-tense though the updates are made immediately. Dead approval-era code lingered (`isSimpleProposal`, `getApprovedProposalPaths`, an always-true `approved` return, a "has been approved" comment, dead imports), and the PagePlanner runtime context said "do not silently create a new folder," contradicting the actual mechanism (new folders go in `folderPlacements`).
- **Fix:** Proposals now carry `removedFolders`, rendered honestly as "Folders absent from the latest plan (NOT removed)" with an explicit no-removal-by-omission note; pros/cons name the specific folders; the section is now "Contract updates made"; dead approval-era code, dead imports, and the contradictory prompt wording were removed; error messages no longer advise setting `provider: "test"`; the stale `isEnabled()` comment ("fall back to local-only processing") was corrected; provider error bodies are redacted for API-key-shaped tokens before entering logs.

## Bug 17 (Phase 2, live run): ChunkWriter output truncated at `max_tokens` — the previous run's blocking "unparseable output" failure, root-caused

- **Severity:** Blocking (this was Bug 2 of the 2026-07-14 run; it reproduced immediately on `sample abstract-examples`).
- **Phase/step:** Phase 2, `sample abstract-examples` against the live Kimi LLM.
- **Observed:** `ChunkWriter returned invalid or unparseable output after one repair attempt.` With the new parse-failure diagnostics (head/tail snippets added to the error), both responses were **valid, schema-compliant JSON cut off mid-body**: first attempt 27,826 chars ending mid-table-row, repair attempt 19,789 chars ending mid-sentence. The model was complying; its reply hit the output-token cap.
- **Root cause:** The ChunkWriter must embed the chunk's full "Preserved Extracted Detail" inside a JSON string (vision 02 §2: all extracted data must be included), but the call capped `max_tokens` at 8,500 — and Kimi's `thinking` tokens also consume that budget. Meanwhile the default `max_chunk_size` was 100,000 characters (~25,000 output tokens of content alone), which cannot fit under any such cap. `Abstract-Examples.pdf` is a single 3-page chunk (a multi-page table spans all pages, so it cannot be split smaller), so chunk-size reduction alone could not fix this PDF either.
- **Fix applied (both sides, checked against the vision):**
  1. `max_tokens` for the two body-writing agents (ChunkWriter, EntityTopicPageWriter) raised 8,500 → 32,000, including their validation-repair calls. Output budgeting is deterministic orchestration configuration; no authorship boundary is affected.
  2. Default `max_chunk_size` lowered 100,000 → 30,000 characters, directly implementing vision Principle 5 ("errs on the side of more, smaller chunks"), so chunk content plus synthesis fits comfortably in the output budget.
  3. Permanent observability: `callAgentWithRepair` now includes response length + head/tail snippets in its failure message (the 2026-07-14 run's suggestion 2C), so any future parse failure is diagnosable from the error alone.
- **Verification:** full test suite green after the change; `sample abstract-examples` rerun against the live LLM (see Phase 2 outcomes).

## Bug 18 (Phase 2, live run): AGENTS.md writer called the LLM with the default 1,024-token budget and no repair retry

- **Severity:** Blocking (aborted `sample abstract-examples` immediately after the Bug 17 fix unblocked the ChunkWriter).
- **Observed:** `LLM returned an empty AGENTS.md body.` The per-wiki AGENTS.md generator (`src/writers/agents.ts`) was the only call site in the codebase invoking `llmClient.call(prompt)` with no options — inheriting the 1,024-token default. Kimi's thinking tokens draw from the same budget, so the model produced no text block at all. The empty result also aborted without the single repair retry the vision mandates (07 §8).
- **Fix applied:** The call now uses `maxTokens: 16000, temperature: 0.2`, and an empty/invalid body triggers one stricter repair prompt before aborting. No deterministic fallback body is ever substituted; the guide remains LLM-authored.
- **Vision alignment:** Output budgeting is deterministic orchestration; the retry-then-abort pattern is exactly 07 §8. Verified no other bare `llmClient.call(prompt)` call sites remain.

## Bug 19 (Phase 2, live run): PagePlanner aborted on empty `folderPlacements` without the mandated repair retry

- **Severity:** Blocking (aborted `sample abstract-examples` after the Bug 18 fix).
- **Observed:** `PagePlanner returned no folder placements.` The model returned schema-valid JSON with an empty `folderPlacements` array, and the code threw immediately — no repair attempt, contrary to 07 §8. Contributing prompt cause: the context said "Use the default folders: documents, sources, topics, entities, raw," which the model plausibly read as "the defaults already exist; no need to re-list them."
- **Fix applied:** Semantic plan validation (empty `folderPlacements`, chunks without document-page plans) now shares one repair path: the specific problems are named in a stricter repair prompt, and only a second failure aborts. The planner context now states explicitly that every folder the wiki uses — including the defaults — must be listed in `folderPlacements` and that an empty array is invalid.
- **Vision alignment:** Exactly the 07 §8 retry-once-then-abort protocol; the LLM remains the sole planner.

## Bug 20 (Phase 2, live run): Kimi thinking tokens starve/truncate large structured-output replies

- **Severity:** Blocking (aborted `ingest abstract-examples` at the ChunkWriter even after the Bug 17 budget raise; `sample` had succeeded nondeterministically).
- **Observed:** With `max_tokens: 32000`, the ChunkWriter's first reply truncated at only ~11k chars and the repair reply was **completely empty**. In the Anthropic message format Kimi's `thinking` tokens draw from the same `max_tokens` budget as the reply; on long analytical prompts the model can think through most or all of the budget, starving the JSON reply.
- **Root cause verified by direct probe:** `k2.7-code` accepts `thinking: { type: "disabled" }` (the same override the ChunkingPlanner already used) and returns text normally with it.
- **Fix applied:** A `structuredOutputOptions(llmClient)` helper disables thinking (Kimi only, gated on `provider()`). Initially applied to the three largest writers, but the same starvation then hit the PagePlanner on wiki #2 (empty first response, truncated repair), so the option is now applied inside `callAgentWithRepair` itself — every JSON-returning agent is covered uniformly. PagePlanner's budget was also raised 8,500 → 16,000 (its plan JSON for multi-chunk documents is sizable).
- **Vision alignment:** Provider-call configuration is deterministic orchestration; no authorship boundary affected; no deterministic fallback introduced.

## Bug 21 (Phase 2, live run): the Critic reviewed an 800-character preview instead of the full drafted pages

- **Severity:** Blocking (with the Bug 7 abort in place, every substantial chunk failed validation "after 4 attempts" on false-positive blocking issues).
- **Observed:** `ingest abstract-examples` aborted with 8 blocking Critic findings claiming the page lacked citations, source frontmatter, preserved detail, and tables — while the drafted page actually contained all of them. `buildCriticContext` passed the Critic only `body.slice(0, 800)` as a "Body preview", no frontmatter at all, and 2,000 chars of whole-document source text. Everything beyond 800 characters was invisible to the reviewer, so its checklist could never pass on a real page.
- **Expected (07 §4):** "The Critic is given: the extracted input for the chunk, the page plan produced by the PagePlanner, the markdown pages produced by the ChunkWriter, the current AGENTS.md and rolling memory."
- **Fix applied:** The Critic now receives each drafted page in full (frontmatter as JSON plus the complete body) and, for per-chunk reviews, the chunk's full extracted input. The whole-document fallback preview was raised to 8,000 chars for the sample-flow batch review.
- **Vision alignment:** This is a literal implementation of 07 §4. Previously the Critic layer was effectively disabled for any page longer than 800 characters.

## Bug 22 (Phase 2, live run): deterministic table-preservation check compared normalized text against non-normalized text

- **Severity:** High (false "table not preserved" on every table whose pipe spacing differed from extraction).
- **Observed:** `checkCompleteness` normalized the extracted table header (whitespace collapsed) but searched for it in the RAW lowercased body. Any table the LLM re-rendered with aligned pipes or different spacing was flagged "not preserved in the markdown body" — three false positives on this PDF, which fed the retry loop and then the abort.
- **Fix applied:** The comparison now runs normalized-against-normalized, with the word-overlap fallback (`isRepresented`) as a final check. The check still fails when a table is genuinely dropped.
- **Vision alignment:** 07 §2.2 requires the completeness check to verify real preservation; whitespace differences are not material alterations.

## Bug 23 (Phase 2, live run): Critic's known-wikilink list diverged from the ChunkWriter's — mandated links flagged as invented

- **Severity:** Blocking (unwinnable retry deadlock: the writer is instructed to end every page with `[[<Wiki Title> Index]]` and link `[[Source: <file>]]`, but the Critic's known-titles list was built without those augmentations, so it flagged the mandated links as invented on every attempt).
- **Fix applied:** The Critic context now augments the known-title list identically to the ChunkWriter (source page title and wiki index title), passed via a new `config` parameter. Also hardened the ChunkWriter prompt on two legitimate Critic demands so retries converge faster: the frontmatter `title` must exactly match the page-plan title, and synthesis factual statements must carry `[^srcN]` citations.
- **Vision alignment:** Deterministic consistency between reviewer and writer inputs; the Critic retains full authority to block.

## Bug 24 (Phase 2, live run): topic wikilinks written from lowercased memory keys; persistent piped/invented links

- **Severity:** Medium (6 lint-flagged broken wikilinks in wiki #1; a blocking wikilink deadlock on wiki #2 chunk 1).
- **Observed:** (a) The EntityTopicPageWriter's "Known topics" list presented rolling memory's lowercased topic keys, so topic pages cross-linked `[[Topic: dementia caregiving]]` while real page titles are title-cased — every such link broke. (b) On wiki #2 the ChunkWriter repeatedly emitted piped links (`[[X|Y]]`) and links to concepts with no page (`[[Lead Independent Director]]`) across all 4 attempts.
- **Fix applied (prompt/feedback only — deterministic rewriting of LLM bodies is forbidden by Principle 1):** the Known-topics list now presents exact title-cased page titles; the writer rules demand exact-title links, plain text for anything not in the known list, and a final self-scan for piped/unknown links; Critic retry feedback now leads with an explicit re-check instruction covering the three recurring failure classes.
- **Vision alignment:** All enforcement stays in the LLM + Critic loop; lint continues to surface any surviving broken links to the human.

## Bug 25 (Phase 2, live run): generated per-wiki AGENTS.md invented alternative citation/wikilink syntaxes, deadlocking the Critic against the ChunkWriter

- **Severity:** Blocking (wiki #2 chunk 1 failed all 4 attempts: the Critic — correctly enforcing the wiki's AGENTS.md per 07 §2.1 — demanded slug-style `[[entity-organization-...]]` links, while the ChunkWriter — correctly following the system contract — produced `[[Entity: Name]]` links).
- **Root cause:** The AGENTS.md-writer prompt let the LLM invent conventions that the vision fixes system-wide. Wiki #2's generated guide declared `[[page-N]]`/`[[table-N-M]]`/`[[entity-slug]]` citation-links, contradicting vision 06 §2 (`[^srcN]` inline citations mapped to `sources` frontmatter) and the exact-title wikilink model.
- **Fix applied:** `buildAgentsMdPrompt` now embeds the vision's system-wide invariants (inline `[^srcN]` citations mapped to `sources` frontmatter; wikilinks are exact page titles, never file slugs or piped; kebab-case slugs are file names only) and requires the generated guide to restate them without contradiction, while remaining free to tailor folder structure, page types, and special instructions to the corpus. Wiki #2's AGENTS.md was regenerated by re-running `sample`.
- **Vision alignment:** 02 §7 makes AGENTS.md the corpus-specific guide, but the citation format and link model are canonical (06 §2, 01 Principle 2). Constraining the guide's syntax section to the canonical model is enforcing the vision, not limiting LLM authority over structure.
- **Second iteration:** The regenerated guide stopped inventing link syntax but still invented `sources` field names (`file_path`/`page_range`) and a `page-01.md` document naming scheme, which the Critic then enforced. The invariants now pin the exact `sources` field names (`id`, `file`, `pages`, optional `extracted`/`sha256`/`label`) and state that document file names are assigned by the deterministic chunker (`documents/<source-slug>-part-NNN.md`).

## Bug 26 (Phase 2, live run): verbatim preservation unreliable on large chunks

- **Severity:** Blocking on wiki #2 (chunk covering pages 1–7: the ChunkWriter's preserved-detail section contained only page 1 and ended mid-sentence, across 4 attempts; the Critic and the deterministic completeness check independently agreed).
- **Root cause:** Reproducing many thousands of tokens of extracted text verbatim inside a JSON string degrades in reliability as chunk size grows, independent of the output-token cap.
- **Fix applied:** Default `max_chunk_size` reduced 30,000 → 15,000 characters (vision Principle 5: "errs on the side of more, smaller chunks"), keeping each chunk's verbatim-reproduction burden modest. Full test suite remained green.

## Bug 27 (Phase 2, live run): artificial "no piped wikilinks" prohibition fought the model instead of serving the vision

- **Severity:** Blocking on wiki #2 (final remaining blocker: a single `[[Topic: Board Operations|Board Leadership]]` link the model kept producing across 4 attempts despite prompt rules, self-scan instructions, and named feedback).
- **Analysis:** The Project Vision never forbids piped links — 07 §2.3 requires that every wikilink point to an existing page. The piped link's target was a real planned page; the prohibition was prompt-level dogma, and both deterministic link validators (`lint.checkWikilinks`, `findUnknownWikilinks`) already parse the target before the pipe correctly. The rule was fighting standard wiki syntax the model naturally produces, burning the whole retry budget.
- **Fix applied:** Piped links are now permitted everywhere as long as the target (text before the pipe) exactly matches a known page title: ChunkWriter rules, Critic checklist (`critic.md`), retry feedback, and the AGENTS.md system invariants. No code changes were needed in the validators — they already handled pipes.
- **Vision alignment:** Enforces exactly what 07 §2.3 demands (valid targets) and drops a constraint the vision never imposed.

## Bug 28 (Phase 2, live run): Critic's table check was stricter than the vision, failing faithful transcriptions of noisy PDF extraction

- **Severity:** Blocking on wiki #2 (the Critic rejected the chunk across 4 attempts because the model's clean markdown transcription "loses structural information" — empty cells and column layout of heuristically extracted PDF tables).
- **Analysis:** Vision 07 §2.2 and 02 §10 rule 3 require tables preserved "verbatim **or clearly described**"; the intent is that no DATA is lost. PDF table extraction is itself a noisy reconstruction; demanding formatting-level fidelity to it exceeds the vision and blocks legitimate output.
- **Fix applied:** `critic.md`'s `tables-figures-preserved` check now instructs judging data completeness (every row and value present; fail on missing/altered data), explicitly allowing layout normalization of noisy extraction. The ChunkWriter rules gained the mirror-image instruction (include every row/value; normalize layout when the extraction is malformed; never drop or change values).
- **Vision alignment:** Restates the vision's own "verbatim or clearly described" standard; the deterministic completeness check (which verifies data presence) remains in force as the hard backstop.
- **Second iteration:** Wiki #2's final chunk (pages 7–9) has a genuinely unreconstructable extracted table; the model kept forcing broken markdown transcriptions. The ChunkWriter rules now spell out the vision's describe-option: when a table is too malformed to reconstruct confidently, preserve the raw extracted text verbatim plus a prose description with a `Source: [^srcN]` caption instead of forcing a broken table.

## Bug 29 (Phase 2, live run): LLM hallucinated the source PDF path in `sources.file`, breaking citation integrity

- **Severity:** Blocking on wiki #2 (26 deterministic citation-integrity failures per attempt: `sources.file` pointed to an invented, cleaner-looking path `raw/corporate-governance-guidelines-2025-02-20.pdf` instead of the real file).
- **Analysis:** The LLM cannot know true on-disk paths — it never performs file I/O (authority matrix). The chunk's source file path and SHA-256 are extractor ground truth: deterministic provenance in the same category as `created`/`updated`/`type`/`char_count`, which deterministic code already sets. The LLM's citation authorship is WHICH claims carry WHICH `[^srcN]` markers and their page sub-ranges — that stays LLM-owned.
- **Fix applied:** After LLM-output validation, `enforceSourceProvenance` sets each sources entry's `file` (and `sha256`) from the chunk's extraction record, preserving the LLM's `id` and `pages` values. The prompt also now instructs copying the path verbatim from the Source PDF section.
- **Vision alignment:** Principle 2 (citations must resolve to real sources) and the authority matrix (deterministic code owns extraction/provenance). This is provenance correction, not authorship of synthesized content, and it is not a fallback — the LLM still authors all citations and content.

## Bug 30 (Phase 2, live run): EvidenceCollector output unbounded — truncated on large documents

- **Severity:** Blocking on wiki #3 (the 90-page WIPO financial report: both attempts truncated ~26.8k chars into full-document claim dumps with complete table reproductions).
- **Analysis:** The EvidenceCollector's output is planning input — the PagePlanner consumes counts and the top 5 claims; table preservation happens later, per chunk, by the ChunkWriter from extractor ground truth. Reproducing every table body in the evidence JSON scales with document size and cannot fit any fixed budget.
- **Fix applied:** The prompt now bounds output to the 40 most significant claims with short evidence excerpts, and tables carry `page`/`caption`/header-row only (bodies explicitly excluded as the ChunkWriter's job); the call budget was raised 8,500 → 16,000 for headroom.
- **Vision alignment:** 04 §4.4.4 assigns the EvidenceCollector claim/evidence collection for planning; the preservation guarantee (02 §2) lives in the ChunkWriter + deterministic completeness check, unaffected by this bound.

## Bug 31 (Phase 2, live run): Node fetch 300-second transport timeout killed long LLM calls on large documents

- **Severity:** Blocking on wiki #3 (`fetch failed` — an opaque transport error aborting `sample` on the 90-page WIPO report).
- **Analysis:** Node's built-in fetch (undici) defaults to 300s headers/body timeouts. The EvidenceCollector already measured 270s on a 9-page document; whole-document calls on the WIPO report exceed the transport ceiling regardless of application-level retries (which then also time out the same way).
- **Fix applied:** `undici` added as a dependency; `src/cli.ts` sets a global dispatcher with 30-minute headers/body timeouts, matching the E2E requirement that single-document ingestion may legitimately take 10–30+ minutes.
- **Vision alignment:** Pure transport configuration; the vision's 90-minute ingestion-timeout expectation is now actually reachable.

## Bug 32 (Phase 2, live run): ChunkWriter degenerate repetition loop on wide, mostly-empty financial tables

- **Severity:** Blocking on wiki #3 chunk part-003 (both attempts ran to ~56k chars ending in an unbroken `| | | | | …` sequence — a repetition pathology triggered while transcribing wide financial tables whose extraction is mostly empty cells).
- **Fix applied (prompt-level; deterministic body mutation is forbidden):** The ChunkWriter rules now forbid emitting runs of empty table cells/rows (empty cells carry no data — omit them; keep only cells with values) and instruct breaking out of any noticed repetition. This is layout normalization within the vision's "verbatim or clearly described" standard; the deterministic completeness check still verifies real values are present.
- **Second iteration (part-003 passed; part-008 degenerated the same way):** A probe confirmed the extracted input is clean (166k chars / 56 pages, no whitespace pathology) — the loop is a low-entropy sampling attractor at temperature 0.2 with thinking disabled. Two additional counters: (1) ChunkWriter temperature raised 0.2 → 0.6 (moderate entropy breaks repetition attractors; the Critic and deterministic checks gate quality), and (2) `callAgentWithRepair` now detects a degenerate filler tail (>90% pipes/whitespace in the final 600 chars) and names the pathology explicitly in the repair prompt.
- **Third iteration (root-cause elimination):** Temperature alone shifted which chunk degenerated (part-001 emitted a 100k-char `--- |` separator loop for an invented ultra-wide table). The trigger is markdown-pipe-table GENERATION itself on columnar financial text. The vision requires verbatim preservation, not markdown conversion, so the ChunkWriter now copies tabular text verbatim into Preserved Extracted Detail (markdown tables allowed only as optional presentation for small/simple tables in the synthesis area), and the Critic's table check prefers exactly that form. This removes the degeneration trigger by construction while strengthening literal verbatim preservation (02 §2).

## Rejected findings (vision-sanctioned, intentionally NOT changed)

- **Deterministic type-based entity-taxonomy fallback** (`buildTypeBasedTaxonomy`, `resolveEntitySubFolder`): explicitly sanctioned by 05 §6.3–6.4 — "if the LLM returns none, or if the returned taxonomy is empty, the system falls back to the type-based defaults."
- **Deterministic `source`/`raw` page generation**: explicitly allowed by Principle 1 (deterministic provenance/preservation pages).
- **Layered retries** (JSON-repair inside a semantic-repair wrapper, worst case 3–4 LLM calls before abort): stays within the same LLM agent and always terminates in abort; the vision's "may retry once with a stricter repair prompt" is read per failure class. Documented rather than changed.

## Tooling incident during Phase 1 (self-inflicted, fixed)

A PowerShell-based bulk edit of `src/llm/client.ts` mangled nine em-dash characters into mojibake (PowerShell 5.1 read the BOM-less UTF-8 file as ANSI), breaking the test provider's prompt parsers. All nine were repaired with UTF-8-safe edits and verified by grep; the file has no remaining mojibake.

