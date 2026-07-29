# Unified Verification — Phases 18, 19, 20 (Paper Chase v.1.0)

**Verifier:** UNIFIED VERIFIER sub-agent (cold check per `Implementation Plan/MASTER_IMPLEMENTATION_PROMPT.md` §1.3)
**Date:** 2026-07-29
**HEAD:** `993ead261f0c233b0829befc900aa0673dbfc7ff` (pre-phase commit; all phase work is uncommitted working-tree changes)
**Inputs:** the three phase contracts, vision `02` §2 / `04` §3.2-Step 6+11 / §4 / §6, `06` §1-§3/§7, `07` §2.4-§2.6/§3/§5, the three status files, compliance-log [2026-07-29 09:10]

---

## FINAL VERDICT: PHASES 18-20 VERIFIED

All 16 gates PASS on personally-checked evidence. Diff audit clean. Independent runs reproduce the claimed numbers exactly. No contradictions with canon. Failures found: **none**.

---

## 1. Diff audit (git status + git diff vs HEAD 993ead2)

| File | Owner | Verdict |
|---|---|---|
| `src/agents/synthesis.ts` | P18 | Expected — `formatCitationMap` + `citationMap` slots |
| `prompts/synthesis{,-permissive,-topic,-topic-permissive}.prompt.txt` | P18 | Expected — slot-additive only (proven §4 below) |
| `src/validation/preservation-check.ts` | P18 | Expected — `extraMarkers` additive field + detection |
| `src/materializer.ts` | P19 | Expected — `checkPageConflict` converge verdict, `convergedPages` |
| `src/validation/link-checker.ts` | P20 | Expected — shared slug-universe exports, checker consumes them |
| `src/utils/wikilink-repair.ts` (NEW) | P20 | Expected |
| `scripts/repair-wikilinks.ts` (NEW) | P20 | Expected |
| `src/commands/ingest.ts` | orchestrator | Expected — only the enumerated seams (audit §2) |
| `scripts/launcher-entry.ts` | orchestrator | Expected — VERSION 1.0.4→1.0.5 (4 prompt assets changed; root-AGENTS.md dist/ rule) |
| `tests/phase-17.test.ts` | orchestrator (enumerated) | Expected — gate 17.6 reconstruction also removes the Phase 18 `CITATION_SLOT`; intent-preserving |
| `tests/phase-{18,19,20}.test.ts` (NEW) | P18/P19/P20 | Expected |
| `AGENTS.md`, `src/AGENTS.md`, `tests/AGENTS.md`, `prompts/AGENTS.md`, `scripts/AGENTS.md`, `Implementation Plan/{AGENTS,BACKLOG,IMPLEMENTATION_PLAN_MASTER_INDEX,MASTER_IMPLEMENTATION_PROMPT}.md`, `.state/compliance-log.md` | DOX | Expected — all updates read; they document exactly the changes made (BACKLOG also marks B18/B19/B20 SCHEDULED and re-promotes B5 with the 2026-07-28/29 cost evidence) |
| `Implementation Plan/PHASE_{18,19,20}_*.md` (NEW) | plan | Expected — the three contracts themselves |
| `.state/phase-{18,19,20}-status.json` (NEW) | state | Expected |

**Outside the expected set:** none. `git status --porcelain -- dist/ templates/ test-pdfs/ wikis/` is empty. `.env` untouched (`git diff --stat -- .env` empty; file present, 171 bytes, mtime 1784495580 before and after my runs). One benign extra: untracked `.zcode/plans/` (ZCode tooling artifact, not a project file — flagged, not counted against the phases).

## 2. Orchestrator integration audit — `src/commands/ingest.ts` (full diff read; every hunk enumerated)

(a) **`preservationFeedbackErrors` extraMarkers loop** — PRESENT (diff hunk 2): type cast gains `extraMarkers?: string[]`, and after the `droppedCitations` loop each entry pushes `Off-map citation marker (remove it or replace it with a key from the CITATION KEYS list): <entry>` — byte-identical to the line gate 18.4's checker leg pins.

(b) **try/finally wrap** — PRESENT and correctly bounded: `rehashWrittenPagesFromDisk` (the hoisted Phase 8 re-hash, now at ingest.ts:954-967) is defined before the synthesis block; `try {` at line 969 opens immediately before `if (extract && synthesis && lastMaterializeResult) {` (line 970); the synthesis `if`-block closes at line 1477 and `} finally { await rehashWrittenPagesFromDisk(); }` (lines 1479-1485) replaces the old inline re-hash verbatim (same guard `extract && writtenPagePaths.size > 0`, same per-page try/catch, same `state.pageHashes = workingPageHashes; writeIngestionState` fold). Validation/DOX/workspace/updater stages remain OUTSIDE the try (line 1598+) — the wrap covers exactly the synthesis section.

(c) **`state.pageHashes = workingPageHashes` carry** — PRESENT at lines 915-916, immediately before the pre-synthesis `writeIngestionState(dir, state)` (the P2 cure-blocker; HEAD:897 lacked it — confirmed via `git show HEAD:src/commands/ingest.ts`).

(d) **`convergedPages` progress loop** — PRESENT at lines 703-709, right after the manual-edit skip lines in `runMaterialize`'s reporting.

(e) **Four `repairPageLinks(...)` write-point wraps + `buildSlugUniverse` once per run + two imports** — PRESENT: imports at lines 11-12; `const slugUniverse = await buildSlugUniverse(slug, options.workspace, { language: input })` once at line 977 inside the synthesis block (`input` is the run's resolved INPUT language code, line 566 — matches the seam contract); `repairPageLinks` closure logs `Link repair <label>: N repaired[, M unrepairable].`; wraps at the entity strict (~1097), entity permissive (~1145), topic strict (~1307), topic permissive (~1347) write points, composed as the OUTERMOST enforcement around the Phase 17 frontmatter/Sources enforcers.

**No other logic changed:** the full ingest.ts diff contains exactly the eight enumerated hunks and nothing else. Pre-fix leak mechanism independently confirmed against HEAD: per-PDF checkpoint at HEAD:868-869 persisted pre-synthesis hashes; the only reconciliation was the end-of-run re-hash at HEAD:1417-1430 — an abort between a synthesis write and that re-hash left recorded(template) ≠ disk(synthesized). The convicted stage is real, and P1+P2 close it.

## 3. Per-gate cold check

### Phase 18 — citation numbering alignment: ALL 5 GATES PASS

| Gate | Verdict | Personally-checked evidence |
|---|---|---|
| 18.1 | PASS | `tests/phase-18.test.ts:219-254`. The entity fixture (mention+outgoing src1, claim src2, incoming src3) and the deliberately-zeta-first topic fixture pin keys/order/basenames/page-ranges via `formatCitationMap(buildCitationMap(...))` AND cross-check against the independent renderers `writeEntityPage`/`writeTopicPage` `## Sources` definition lines (two independent renderers over one map). Source: `src/agents/synthesis.ts:199-225` (`formatCitationMap` sorts by assignment index, renders `[^srcN]: <basename>, pages <range>`, empty form `(none)`); both value builders call the SAME `buildCitationMap` the write points use (`synthesis.ts:240-243, 272-277`). The `{sources}` legacy block is asserted byte-present (slot-additive) with CITATION KEYS authoritative. |
| 18.2 | PASS | `tests/phase-18.test.ts:287-332` + MY OWN recomputation (§4): the slot occurs exactly once per template; removing the exact `CITATION_SLOT` string reproduces the HEAD blob BYTE-FOR-BYTE for all four templates (stronger than the hash pin — direct equality with `git show HEAD:prompts/...`); all four recorded SHA-256 pins match the HEAD blobs (c2b45de7…, 54039a6c…, 7f515370…, 5fc7346d…). Filled-prompt legs (callLLM spy) assert the map renders, `{citationMap}` is gone, LANGUAGE-block removal, `=== TASK ===`, self-sizing block, and the Phase 17 `relatedEntities` slot all intact. |
| 18.3 | PASS | `tests/phase-18.test.ts:367-448` (entity + topic legs). Off-map `[^src9]` on a src1-3 page fails with exactly `['[^src9] (first line: "Revenue later grew 40% [^src9].")']` — the phase doc's shorthand `extraMarkers: ["[^src9]"]` is encoded per §2.2's more specific "key + first line it appears on" (recorded interpretation; sound). On-map page passes with `[]`. Dedupe + first-appearance order across src9/src7 pinned; an off-map key appearing ONLY in a definition line is flagged; the citations-union leg (citations: [src1..3, src9]) is not flagged. Source: `src/validation/preservation-check.ts:27-47, 104-110, 148-151` — `findExtraMarkers` per-line `matchAll`, allowed set = `buildCitationMap` keys ∪ `originalData.citations` (entity) / claims-map keys (topic); `passed` false when non-empty. |
| 18.4 | PASS | `tests/phase-18.test.ts:456-476` (checker leg pins the exact feedback line the orchestrator wire emits — I confirmed the wire string matches byte-for-byte) and `:500-585` (pipeline leg: hermetic ingest, strict attempt 1 complete except one off-map `[^src9]` → exactly 2 attempts, attempt 2 carries non-empty feedback, corrected page written with `[^src1]` only, `result.synthesized === 1`, `metrics.feedbackRepairs === 1`). |
| 18.5 | PASS | Independent full key-less run: **375 passed + 14 skipped across 26 files (25 passed, 1 skipped)** — Phase 17 baseline (350+14/23) + phase-18 (6) + phase-19 (4) + phase-20 (15), zero unenumerated regressions; `npx tsc --noEmit` exit 0. The one enumerated pre-existing touch (phase-17 gate 17.6) is intent-preserving. |

§2.3 honored: no deterministic stripping/renumbering anywhere — I read the complete preservation-check and ingest diffs; detection + reask feedback only, exhaustion keeps the existing permissive/template fallback.

### Phase 19 — stale-pagehash convergence: ALL 5 GATES PASS

| Gate | Verdict | Personally-checked evidence |
|---|---|---|
| 19.1 | PASS | `tests/phase-19.test.ts:344-400`. The phase doc asks for a reproduction that fails pre-fix and names the leaking stage. The test is the post-fix rewrite of that reproduction (the pre-fix failure is recorded in `.state/phase-19-status.json` and I confirmed the leak mechanism against HEAD — see §2 above). The stage-proof survives the rewrite INVERTED: after the abort, recorded hashes equal sha256(disk) of the SYNTHESIZED pages and are asserted NOT equal to the deterministic TEMPLATE render of the same aggregate (rendered in an identical wiki copy with `synthesis-state.json` removed, lines 375-382) — the divergence is still pinned to pages replaced after the checkpoint, i.e. the test still proves the convicted stage (per-PDF checkpoint + post-checkpoint synthesis writes) rather than merely asserting green. The afdk exposure condition (synthesis-state.json deleted) is exercised; the completed resume false-flags nothing. |
| 19.2 | PASS | `tests/phase-19.test.ts:408-429` — flipped from `test.fails` to `test` (confirmed at line 408) after the orchestrator's P1; independent fixture: abort leaves recorded == disk for all three pages, resume has zero `(manually edited)` lines and zero conflicts.json manual-edit entries, `assertHashInvariant` green. |
| 19.3 | PASS | `tests/phase-19.test.ts:437-500`. Leg A: bogus recorded hashes over untouched tool-written entity AND topic pages converge — `convergedPages` lists both, `conflicts` empty, pages updated, writtenPages fold == disk hash, per-page convergence note logged (`Converged stale page hash for <rel>`), no conflicts.json entry. **Leg B (the protection leg): true human edits (appended journalist paragraph) STILL conflict** — both pages in `conflicts`, `convergedPages` empty, pages excluded from entityPages/topicPages, the edit survives on disk, exactly 2 manual-edit conflicts.json entries. Human-edit protection unweakened. Source: `src/materializer.ts:282-312` — 'converge' iff `current === hashContent(rendered)` (disk == current deterministic render); any other mismatch is 'conflict' exactly as before; only the two write loops call `checkPageConflict` (curation veto + fork-reconciliation paths untouched — grep-verified, callers at 1293/1385 only). |
| 19.4 | PASS | `tests/phase-19.test.ts:509-583` — two-PDF ingest with REAL curation merges (topic-b→topic-a, beta→alpha): merged-away pages deleted, survivors present, `assertHashInvariant` (recorded == sha256(disk) for every entity/topic page, no stale keys for deleted pages) green across both per-PDF checkpoints + the finally re-hash. |
| 19.5 | PASS | Same independent full-suite run as 18.5 (375+14/26; tsc clean). |

### Phase 20 — wikilink repair: ALL 6 GATES PASS

| Gate | Verdict | Personally-checked evidence |
|---|---|---|
| 20.1 | PASS | `tests/phase-20.test.ts:206-232` — real temp fixture wiki; the broken link is first proven broken through the REAL `checkLinks` (exact broken-entry shape pinned), then `[[indikator-2\|Indikator 2]]` → `[[indikator-2-ekkokardiografi\|Indikator 2]]` with FULL-STRING byte equality against the expected page (display + prose untouched), then re-checked clean through the real checker. Source: `src/utils/wikilink-repair.ts:128-180` — only the target segment is spliced, leading/trailing whitespace preserved. |
| 20.2 | PASS | `tests/phase-20.test.ts:238-281` — `[[region]]` with `region-nord`+`region-syd` pages: byte-identical output, zero repairs, reported with both candidates sorted; `[[ghost-entity]]`: unchanged, reported with `[]`. Never guessed. |
| 20.3 | PASS | `tests/phase-20.test.ts:287-365` — the real rkkp-afdk case: target `indikator-3-thyreoideastimulerende-hormon-tsh-maaling` repairs to `indikator-3-tsh-maaling` via the Danish `… måling` alias under a `da` universe, plus bare-form `[[thyreoideastimulerende-hormon]]` → `[[tsh]]`. **Language-awareness pinned both ways:** under the English-default universe the `måling` alias slugifies to `-m-ling`, the target gets ZERO candidates and is left broken (never guessed), while the ASCII alias still repairs. The phase doc says only "aliases slugifies to the target"; slugifying with the wiki's last INPUT language (vision `04` §9.3's slug-production map) is the consistent reading — recorded interpretation, sound, and it is the only reading under which the flagship real-world case is repairable. |
| 20.4 | PASS | `tests/phase-20.test.ts:371-428` — `repairWikilinksInWiki` on a seeded fixture: the modified page's `pageHashes` entry equals its NEW disk hash (and differs from the old), the two unmodified pages' entries byte-untouched, the `sources` block deep-equal, the on-disk page is exactly the repaired markdown, checker clean. Source: `wikilink-repair.ts:270-279` — re-hash from disk post-write, state written only when ≥1 page changed. |
| 20.5 | PASS | `tests/phase-20.test.ts:434-481` — the REAL script spawned (`node node_modules/tsx/dist/cli.mjs`, no-shell argv pattern): exact per-wiki report lines asserted (repair old→new `(prefix)`, unrepairable `(no candidates)`, `Unchanged pages: 2`, dry markers, `1 page(s) would be modified`) and a recursive sha256 snapshot of the whole workspace is byte-identical after. Independently reproduced by my own dry run (§5): spot-checked mtimes/sizes of a wiki page and two `ingestion.json` files unchanged. |
| 20.6 | PASS | Same independent full-suite run as 18.5 (375+14/26; tsc clean). |

Supplementary coverage read and judged real (not padding): real-mode script spawn end-to-end; `.state/language.json` pickup; scope skip (entities/topics index.md, sources/, documents/ byte-identical and never scanned); resolved/link-free pages byte-identical; whitespace-preserving splice + bare-form repair; repeated occurrences all repaired; ambiguous aliases never guessed + prefix-beats-alias order; degenerate targets (empty target untouched, unslugifiable reported with `[]`); `isRepairableContentPage` matrix; `formatWikiRepairReport` exact rendering. The link-checker refactor is semantics-preserving by construction (same walk order, same first-wins maps, the same resolution expression now shared as `resolveWikilinkTarget`; `relative` synthesized as `wikis/<slug>/<wikiRel>` — string-identical for the standard layout) and is pinned behaviorally by the phase-20 tests' before/after checkLinks legs plus the unchanged phase-04/06/17 suites in the full run.

## 4. Prompt byte-confinement (independently recomputed)

`git diff` over the four synthesis prompts shows exactly ONE pure-insertion hunk each (+6 lines, 0 removed, context unchanged): the `=== CITATION KEYS ===` section after `{relatedEntities}` (entity) / after Chunk Context `{context}` (topic), before `=== TASK ===` / the Layer-1 paragraph. My own Node recomputation:

| Template | slot occurrences | slot-removal == `git show HEAD:` blob | HEAD sha256 == recorded pin |
|---|---|---|---|
| synthesis.prompt.txt | 1 | YES (byte-for-byte) | YES (c2b45de7…) |
| synthesis-permissive.prompt.txt | 1 | YES | YES (54039a6c…) |
| synthesis-topic.prompt.txt | 1 | YES | YES (7f515370…) |
| synthesis-topic-permissive.prompt.txt | 1 | YES | YES (5fc7346d…) |

Every pre-existing section (LANGUAGE block, Phase 17 `relatedEntities` slot, legacy `{sources}` block, self-sizing block, `=== TASK ===`) is byte-identical — proven by direct blob equality, not just the tests' hash pins. No CRLF contamination.

## 5. Independent runs (real recorded output)

- `npx tsc --noEmit` → **exit 0** (clean).
- Full key-less suite (`.env` stashed to `.env.bak-verify20` with `cp -p`, keys unset via `env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY`, restored byte-identical after — 171 bytes, mtime 1784495580 verified before and after): `npx vitest run` → **Test Files 25 passed | 1 skipped (26); Tests 375 passed | 14 skipped (389)**. Exactly the expected 375+14/26. Zero failures.
- Four phase suites: `npx vitest run tests/phase-17.test.ts tests/phase-18.test.ts tests/phase-19.test.ts tests/phase-20.test.ts` → **4 files passed, 39 tests passed** (14 + 6 + 4 + 15). Exactly the expected 39.
- Remediation dry run: `npx tsx scripts/repair-wikilinks.ts dist/wikis --dry` → wrote NOTHING (spot-checked `rkkp-afdk/entities/locations/countries/danmark.md` and both `rkkp-afdk`/`rkkp-akdb` `.state/ingestion.json`: size + mtime identical before/after) and printed a sane report. Totals: **13 repaired, 20 unrepairable, 8 page(s) would be modified, 711 unchanged across 4 wikis** — per wiki: rkkp-afdk 10 repaired across 6 pages / 0 unrepairable / 217 unchanged (incl. the flagship `[[indikator-2]]` → prefix and `[[indikator-3-…-maaling]]` → Danish-alias repairs); rkkp-akdb 3 repaired across 2 pages / 1 unrepairable (`[[anaestesiolog-procedurekode|anæstesiolog]]`, no candidates — correctly never guessed) / 157 unchanged; rkkp-adhd 0/0 / 164 unchanged; rkkp-danibd 0 repaired / 19 unrepairable (all no-candidates: links to never-created pages — correctly left broken and listed) / 173 unchanged.

## 6. Compliance check (match / extend / contradict)

- `06` §1-§2 (every claim traceable; keys unique per page): **MATCH/EXTEND** — the model is now taught the page's deterministic keys, and off-map keys are a content defect; new pages cannot ship dangling model-invented markers (gate 18.3/18.4). Keys remain unique per page (single `buildCitationMap` authority).
- `06` §3/§7 (frontmatter source map; verification workflow): **MATCH** — untouched; the CITATION KEYS section states the final Sources section is rebuilt from the same list, keeping the §7 path intact.
- `07` §2.4 (preservation): **EXTEND** — `extraMarkers` is an additive field on the same check; `passed` semantics extend to the new defect class.
- `07` §2.5 (broken wikilinks reported): **EXTEND** — reporting kept; conservative repair added on top. No contradiction.
- `07` §3 (preservation-first materialization): **MATCH** — the converge path requires disk == current deterministic render (a human edit cannot byte-reproduce the render); anything else conflicts exactly as before (gate 19.3 leg B proves it). Human-edit protection NOT weakened.
- `07` §5 (fail-loud with reask): **MATCH** — off-map markers flow through the existing reask loop with the exact offending markers fed back; NEVER stripped or renumbered; exhaustion keeps the existing fallback. No silent rewriting of model prose.
- `02` §2 (no page is an island): **MATCH/EXTEND** — repair is conservative: unique-prefix/unique-alias only; ambiguity and zero matches stay broken and are reported with candidates (gates 20.2/20.3, danibd dry-run leg). Ambiguity is never guessed.
- `04` §4 (synthesis input list is "e.g." non-exhaustive): **EXTEND** — the `citationMap` slot is a new input item, as the pre-check recorded.
- `04` §6 (validation order/reask classes): **MATCH** — the new defect joins the quality-failure feedback class.
- `04` §3.2 Step 6 / Step 11 (update mode; checkpointing): **MATCH/EXTEND** — the finally-guarded re-hash extends Step 11's checkpointing contract ("an aborted run never re-extracts") to hash convergence; the P2 carry makes the pre-synthesis write consistent with the working folds.

No contradictions found. Compliance-log [2026-07-29 09:10] recorded COMPLIANT-with-EXTENSION; this cold check concurs. No unresolved contradictions in the log.

## 7. Notes for the record (not failures)

1. **Gate 19.1's form:** the phase doc's literal text asks for a test that "fails against the pre-fix code." Since the fix is applied in the same uncommitted tree, the test now runs post-fix; it preserves the conviction via the inverted stage-proof (recorded == synthesized content, != the template render of the same aggregate), and the pre-fix failure is recorded in the status file. I independently confirmed the leak exists in HEAD (checkpoint at HEAD:868, sole reconciliation at HEAD:1417-1430). Verdict: the gate's intent — the leak was found, named, and is now proven closed — is met.
2. **Dry-run totals vs. phase-doc evidence:** the phase doc cites afdk 12 / akdb 6 broken links (2026-07-28/29). The dry run finds afdk 10 repairable + 0 unrepairable and akdb 3 repairable + 1 unrepairable — the wikis changed under subsequent live ingests (BACKLOG B5's afdk repair run and akdb DOX-refresh run). The afdk `[[indikator-6]]`/`[[indikator-8]]` targets the Implementer predicted would be zero-candidate now have unique prefix candidates (`indikator-6-intrakraniel-blodning`, `indikator-8-structured-education`) and repair. These are evidence-vs-current-state deltas, not implementation defects; the dry-run numbers above are the authoritative UAT 20.1 input.
3. Untracked `.zcode/plans/` directory — ZCode tooling artifact, outside the phase file set; no action taken.

## 8. Checklist against the phase docs' Approval Checklists

- Phase 18: all 5 gates pass; tsc clean; four prompts slot-additive with byte-identical pre-existing sections (independently recomputed); no deterministic stripping; no unresolved contradictions; status file updated (verifierNote appended).
- Phase 19: leaking stage identified in the status file AND independently confirmed against HEAD; all 5 gates pass; tsc clean; human-edit conflicts still fire for true human edits (19.3 leg B); no unresolved contradictions; status file updated.
- Phase 20: all 6 gates pass; tsc clean; ambiguous targets never guessed (20.2 + danibd/akdb dry-run legs); remediation re-converges hashes (20.4 + my dry-run no-write proof); the UAT 20.1 dry-run report is attached above (§5); no unresolved contradictions; status file updated.
