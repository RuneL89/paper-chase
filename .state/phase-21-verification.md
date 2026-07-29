# Phase 21 Verification — Curation Overhaul (Deterministic Pre-Merge, Confirm-Deny, Sticky Decisions)

**Verifier:** cold-verify sub-agent (no knowledge of Implementer rationale beyond the status file)
**Date:** 2026-07-29
**Contract:** `Implementation Plan/PHASE_21_curation_overhaul.md` §2.1–§2.3, gates 21.1–21.9
**Canon checked:** `Project Vision/04_orchestration_detailed.md` §3.2 Step 6, `05_page_types_specification.md` §6/§7, `07_validation_and_quality.md` §2.3/§5
**Implementer account:** `.state/phase-21-status.json` (claims 9/9 gates, 402+14/27 key-less, tsc clean, $0)

---

## 1. Diff audit (HEAD = dcb60b4)

**Verdict: IN SCOPE.** Enumerated working-tree changes:

| Path | Verdict |
|---|---|
| `src/agents/pre-merge.ts` (NEW), `src/state/curation-decisions.ts` (NEW), `tests/phase-21.test.ts` (NEW) | §2.1/§2.3/gates — in scope |
| `src/agents/curation.ts`, `src/materializer.ts`, `src/state/curation-report.ts` | §2.2/§2.3 — in scope |
| `prompts/curation-entities.prompt.txt`, `prompts/curation-topics.prompt.txt` | §2.2 — in scope (slot-additive, LF-only verified: zero CR bytes in both files) |
| `scripts/launcher-entry.ts` | VERSION 1.0.5→1.0.6, exactly one increment, dated comment; root AGENTS.md dist/ rule updated to match — in scope |
| `AGENTS.md`, `src/AGENTS.md`, `prompts/AGENTS.md`, `tests/AGENTS.md`, `wikis/AGENTS.md`, `Implementation Plan/*` (AGENTS.md, BACKLOG.md, master index, MASTER_IMPLEMENTATION_PROMPT.md), `.state/compliance-log.md` | DOX pass + planning bookkeeping — in scope |
| `.state/phase-21-status.json` (NEW) | the Implementer's account — in scope |
| `Implementation Plan/PHASE_21_curation_overhaul.md` (NEW) | the phase doc itself — in scope |
| `Implementation Plan/PHASE_22*.md`, `PHASE_23*.md`, `.state/phase-22-status.json`, `phase-23-status.json` | planning artifacts of the ratified 21–23 arc (compliance-log [2026-07-29 12:30] planned all three); status files are `scheduled` placeholders — NOT Phase 21 implementation scope creep |
| `.zcode/` (untracked, `plans/`) | session tooling artifact; not part of the implementation; flagged as noise |

**Untouched as required:** `dist/`, `templates/`, `test-pdfs/` — `git diff --stat` empty for all three. `.env` present at **171 bytes**, mtime 2026-07-20 00:13, gitignored, `git diff --stat -- .env` empty. **Zero pre-existing test files modified** (verified via git status — only `tests/AGENTS.md` + the new `tests/phase-21.test.ts`).

## 2. Independent runs (personally executed)

| Run | Expected | Actual | Verdict |
|---|---|---|---|
| `npx tsc --noEmit` | clean | **clean** | PASS |
| Full key-less suite (`.env` stashed to `.env.bak-verify21`, `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` unset) `npx vitest run` | 402 passed + 14 skipped / 27 files | **402 passed + 14 skipped / 27 files (26 passed, 1 skipped)** | PASS |
| `npx vitest run tests/phase-21.test.ts` | 27 passed | **27 passed** | PASS |
| `.env` restored | byte-identical | 171 bytes + mtime 2026-07-20 00:13:00 verified post-restore; no `.env.bak-verify21` left behind | PASS |

Baseline arithmetic checks: 375 (Phase 18-20) + 27 (phase-21) = 402; 26 + 1 = 27 files. Zero unenumerated regressions.

## 3. Per-gate cold check

**Gate 21.1 (signal families fire; zero false positives) — PASS.** 10 tests pin every family on the phase-doc fixtures (Godstrup transliteration da-auto/en-edit-distance-propose; `landspatientregistret`/`sundhedsvaesenet` edit-distance; `lpr` alias; `Landspatientregisteret (LPR)` corpus abbreviation; `peter-olsen-svenningsen` subsequence; `moeller-m-h` initials; 5 regions × 3 forms = 15 region-form pairs; `indikator-2-ct-skanning` indicator family; `echocardiography`/`ekkokardiografi` glossary) plus a 14-control zero-false-positive test. Source check of `src/agents/pre-merge.ts` confirms the precision controls are real, not test-theater: subsequence requires ≥2 tokens on the shorter side and rejects org-unit-word (`hospital`, `afdeling`, `ambulatorium`, …) and pure-digit extras (`odense` ⊆ `odense-bup`, `odense-2` cannot fire); edit-distance requires ≥10-char slugs, rejects digit-only diffs (`indikator-2` ✗ `indikator-3`) and <50% common-prefix pairs (`ct-skanning` ✗ `mr-skanning`); initials require a letter-initial alignment with a name token (`morten-moller` ✗ `peter-moller`, `topic-a` ✗ `topic-b`); indicator family never pairs differing numbers or differing names; the abbreviation regex is capitalization-bounded with a small connector list so leading prose words never join the match.

**Gate 21.2 (auto tier is EXACTLY transliteration + alias-exact) — PASS.** `AUTO_APPLY_SIGNALS = new Set(['transliteration', 'alias'])` (pre-merge.ts line 60) is the single tiering point in `detectPreMergePairs`; every other signal is structurally propose-only. The mixed 15-candidate fixture asserts the exact two auto pairs and the exact six proposed pairs; two materialize-level legs prove the alias (`lpr`→`landspatientregisteret`) and transliteration (Godstrup fork, da) merges apply with the stubbed model receiving only the survivor (`seenCandidates` exact), evidence unioned, from-page deleted, decision recorded with its signal. Alias-exact is genuinely exact: case-insensitive title equality AND `slugify(alias) === variant.slug`. Transliteration requires post-collapse slug identity with a ≥6-char guard and the digraph-carrying (properly transliterated) form surviving.

**Gate 21.3 (confirm-deny path) — PASS.** Prompt section renders pairs with signal + evidence and is stripped when empty (`stripProposedPairsBlock` verified against the template bytes — removal reproduces the pre-Phase-21 section spacing); pair members are absent from the CANDIDATES block. Validation pins: judgments must copy a proposed pair exactly, at most once; unproposed/duplicate judgments rejected; pair slugs rejected from merge/drop/keep/unsure buckets; unjudged = denial. A stubbed confirm produces a **byte-identical content tree** (updated-stripped, whole-tree comparison) to the same merge returned as an open model decision — confirm ≡ model merge, through the same `applyEntityMergeToMaps`/`applyTopicMergeToMaps` closures. Deny leaves both pages and records the denial; a denial is not stuck.

**Gate 21.4 (sticky pre-application) — PASS.** Two-run test: run 2's model input contains NO decided pair (`seenCandidates` exact, `seenPairs` empty), the survivor is pre-merged deterministically (3 mentions re-unioned), the merged-away page is not recreated, the report distinguishes `fromSticky` vs `decidedThisRun`, and nothing new is recorded on a keep-all run. Source confirms candidates are built AFTER the sticky pre-application (materializer.ts lines 1253–1256) and detection runs on post-sticky candidates, so a stuck pair cannot even be re-proposed.

**Gate 21.5 (sticky drops) — PASS.** Dropped `statistical` topic never re-enters the candidates on run 2 (exact candidate-set assertion), the page stays deleted, and the preservation contract holds — the claim text remains on the entity page. Source: sticky drops only `topicMap.delete(drop)`; claims live on entity/document pages.

**Gate 21.6 (oscillation impossible) — PASS.** After the Odense-fork merge sticks (recorded at edge level, 2 records), a keep-all pass cannot recreate `odense.md`/`odense-2.md`; the survivor carries the re-aggregated union and relationship references stay repointed (the sticky application seeds `entitySlugRemap`/`mergeRewrites` through the same closures as every tier).

**Gate 21.7 (split escape hatch) — PASS.** Hand-edited `splits: ['peter-olsen-svenningsen']` un-applies the record on the next materialize: both pages rebuilt, `splitReversals` logged (reason `split`), pair back in the OPEN candidates, the alias auto-tier vetoed (`vetoSlugs` — the survivor's accumulated `Peter Olsen Svenningsen` alias would otherwise instantly re-merge the pair; recorded as a veto). The split slug is NOT consumed while the model decides nothing, and IS consumed on re-decision (run 3: `splits: []`, merge re-sticks). Consumption keys off the pre-dedupe applied set in `appendCurationDecisions`, so a same-key re-merge still consumes — the oscillation path is closed.

**Gate 21.8 (neverMerge wins over all three tiers) — PASS.** Three legs personally traced: (a) auto tier — neverMerge moves the pair to `vetoed`, never applied, both pages written, nothing recorded; (b) confirm tier — the deterministic validator vetoes a stubbed confirm into keep (curation.ts lines 808–815); (c) sticky tier — a neverMerge pair un-applies the recorded merge with a logged `splitReversals` entry (reason `neverMerge`) and both pages are rebuilt (materializer.ts lines 1000–1007). neverMerge is absolute.

**Gate 21.9 (full key-less suite + tsc) — PASS.** Independent numbers in §2 (not the Implementer's): 402+14/27, tsc clean.

## 4. High-value probes mandated by the brief

(a) **Auto tier is exactly transliteration + alias-exact — CONFIRMED.** Single source of truth (`AUTO_APPLY_SIGNALS`), dedupe keeps the highest-precision signal per pair so a transliteration-identical pair can never be recorded under a lesser signal, and the phase doc's "everything else is proposed" holds structurally.

(b) **neverMerge beats auto-apply, confirm, AND sticky — CONFIRMED** (gate 21.8's three legs; three independent code paths).

(c) **Splits mechanism (Implementer's design decision: vetoSlugs + consumption on re-decision) — SOUND.** Without the auto-tier veto the split would instantly reverse itself through the survivor's accumulated aliases (the Implementer reports gate 21.7 caught this in development; the mechanism is visible in the test). A pair CANNOT be stranded merged-away: the split holds every run until re-decided, and even in >250-candidate sets the single reconciliation call co-locates all survivors, so open discovery can always re-decide. The inverse — a split holding forever when the model keeps denying — is the documented safe direction (permanence belongs in `neverMerge`; wikis/AGENTS.md says so). One residual edge (not a gate issue): a hand-split followed by an open-discovery re-merge in the OPPOSITE direction leaves two opposite-edge records on file; `collapseStickyMerges`' no-unique-survivor fallback then picks the lexicographically last member — deterministic but arbitrary. Reachable only via manual split + reversed re-merge; identity (merged state) is preserved, only canonical-slug choice could flip. Low severity; worth a sentence in a future hardening pass.

(d) **Sticky pre-application: model never re-judges a decided pair; keep-all cannot recreate a stuck page — CONFIRMED** (gates 21.4/21.6; the candidate builders run after pre-application; deletions cover the sticky and auto tiers).

(e) **Prompt changes slot-additive, LF preserved — CONFIRMED.** Both diffs are pure additions (Proposed-pairs rules block, PROPOSED PAIRS section, one `"pairs"` schema member + one bullet); both files are LF-only; gates 14.13/16.9's prompt contracts (LANGUAGE slot, `{agentsMd}`/`{candidates}`, no-`"keep":`, justification cap) are untouched and green in my run. One cosmetic overstatement: curation.ts's header claims "with no proposed pairs the prompt … stay[s] byte-identical" — true only for the PROPOSED PAIRS section; the rules block and the extended OUTPUT FORMAT example line remain in the filled prompt when empty. Behavior is unaffected (validation requires nothing pair-related when no pairs are proposed; the phase doc does not require byte-identical prompts). Doc-comment inaccuracy only.

(f) **VERSION exactly one increment — CONFIRMED** (1.0.5→1.0.6, dated comment, root AGENTS.md dist/ rule names the same bump).

## 5. Compliance against canon

- **04 §3.2 Step 6 — MATCH/EXTEND (consistent with pre-check [2026-07-29 12:30] item a).** The keep-all fallback is intact (null decision list → all candidates written as-is; validated per scope) and is strictly STRONGER now: a fallback run still pre-applies the sticky record deterministically, so the wiki converges even with the LLM down. Re-curate-everything self-healing is preserved for everything that needs it: sticky pre-application is deterministic and cannot fail, and every NEW/unstuck candidate (aggregate ∪ on-disk, minus stuck) still reaches the model on the next successful run — verified in `buildTopic/EntityCandidates` (on-disk union intact) and the stage flow. Stuck decisions no longer need healing; the `splits` hatch is the documented manual reversal. All-or-nothing validated application, union-find chains, no self-merge, neverMerge, and the no-`keep`-bucket sizing rules are all preserved and extended to the `"pairs"` output.
- **05 §6 (strict identity) — MATCH.** The deterministic tier can never merge colocated-but-distinct things: transliteration requires post-collapse slug identity (a sub-unit's extra tokens break it), alias requires the candidate's exact title to BE another page's frontmatter alias (aliases are variant titles by the page contract), and both are guarded by neverMerge + the manual-edit veto. The propose tier only proposes; the model judges under the same strict-identity prompt rules, now with an explicit "when in doubt, DENY" for pairs. The 14-control zero-FP test pins the sub-unit/numbered-fork/shared-surname/lettered-series/modality/city-vs-hospital classes.
- **05 §7 (topic eligibility) — MATCH.** Drops stay model-only (the deterministic tier never drops); sticky drops preserve evidence on entity/document pages (gate 21.5).
- **07 §2.3 (decision-list validation) — MATCH/EXTEND.** Slugs-exist (pair slugs are added to the validation candidate set), exactly-one-bucket (pair members are bucket-off-limits and land in the derived keep), merge-target-kept, no-self-merge (pair judgments checked), union-find chains, neverMerge vetoes (extended to confirms), feedback-retry then keep-all. Nothing weakened.
- **07 §5 (error handling) — MATCH.** Curation failures never lose data; the fallback is logged; malformed `curation-decisions.json` degrades to a warning + empty record (fail-safe direction: nothing stuck, everything re-judged) with corrupt bytes backed up on append.
- **Approval checklist extras:** split escape hatch documented in BOTH the decisions-file contract (curation-decisions.ts header) and wikis/AGENTS.md Local Contracts — present. Compliance log shows no unresolved contradictions for Phase 21.

## 6. Residual observations (none gate-blocking)

1. curation.ts header "byte-identical prompt when no pairs" is overstated at template level (see probe e) — comment only.
2. `bucketCandidatesSized`'s signal-aware path packs components per-candidate, so a component can straddle a bucket-count boundary in the defensive path; in the production flow pair members never reach bucketing (removed from open candidates, judged in exactly one call), so the spec's "proposed pairs always co-located" holds by the stronger mechanism.
3. Split + opposite-direction re-merge leaves dual-edge records → lexicographic survivor fallback (see probe c). Low severity.
4. Legacy report field `merges` now lists model-decided merges only; auto-applied merges live in `autoApplied`/`decidedThisRun.merges` (shape frozen, semantics shifted — the phase doc's required `fromSticky`/`decidedThisRun` distinction makes this explicit).

## 7. Verdict

**PHASE 21 VERIFIED.** All 9 gates pass on personally-checked evidence: the tests genuinely pin the requirements, the implementation satisfies them in source, the diff is in scope, my independent runs reproduce the claimed numbers exactly (402 passed + 14 skipped / 27 files key-less; 27/27 phase-21; `npx tsc --noEmit` clean), `.env` is byte-identical post-run (171 bytes, mtime 2026-07-20 00:13), and the build matches or soundly extends canon 04 Step 6 / 05 §6/§7 / 07 §2.3/§5 with no contradictions. Four low-severity residual observations recorded in §6 for the hardening backlog. LLM cost $0. UAT 21.1/21.2 (live re-ingest) remain for post-acceptance per the status file's nextAction.

Checked by: Verifier sub-agent (cold verification per MASTER_IMPLEMENTATION_PROMPT.md §1.3)
