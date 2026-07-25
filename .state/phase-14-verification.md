# Phase 14 Verification Report — Topic & Entity Curation (L3 + L3e)

**Verifier:** cold-check sub-agent (no knowledge of implementer rationale; all claims re-derived from spec + code + own test runs)
**Date:** 2026-07-23
**Spec:** `Implementation Plan/PHASE_14_topic_and_entity_curation.md` v1.0.0
**Canon re-read:** vision `04` §1 + §3.2 Step 6 + §6 + §9.4; vision `05` §2 + §6 + §7; vision `07` §1 + §2.3 + §5; vision `01` §4.1 + §5; `optimizations.md` L3 + L3e (ratified 2026-07-23, residual risks R2/R3/R4/R6 accepted).

**Verdict: PHASE 14 VERIFIED** — all 14 gates PASS with file/line evidence, independent key-less regression matches the claimed numbers exactly, scope clean, checklist satisfied. Two documentation nits (non-blocking) listed at the end.

---

## Independent test runs (my own, not the implementer's)

| Run | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, zero output |
| `.env` stash protocol | `.env` present (171 bytes) → `mv .env .env.bak-verify14` → confirmed absent → `npm test` → `mv` back → **restored, verified 171 bytes, no `.env.bak-*` left behind** |
| Key-less `npm test` | **Test Files 19 passed \| 1 skipped (20); Tests 307 passed \| 14 skipped (321)**, exit 0, 22.19s. `ANTHROPIC_API_KEY is not set` lines in output confirm the key-less profile was genuinely in effect — zero live calls, $0 |
| `npx vitest run tests/phase-14.test.ts` (standalone) | **37/37 passed** |

Numbers match the status file's claims exactly (Phase 13 baseline 270+14 across 19 files + 37 new = 307+14 across 20 files).

## Per-gate findings

### Gate 14.1 — validation rule classes — **PASS**
`src/agents/curation.ts` `validateDecisionList` (lines 401–576) implements every class, and `tests/phase-14.test.ts` exercises each (8 tests):
- unknown slug in all five positions (merge.from / merge.into / drop / keep / unsure) → `unknown slug '<slug>' …` naming the slug (curation.ts:414–438; test lines 488–501).
- slug in two buckets (keep+drop and into+keep) → `slug '<slug>' appears in multiple buckets (<buckets>)` (curation.ts:537–543).
- input slug missing from every bucket → error names the missing slugs sorted (curation.ts:544–548; test asserts both `delta` and `gamma` appear).
- `into` dropped → `merge target '<slug>' is dropped` (curation.ts:552–556); `into` merged-away → union-find "no unique survivor" rejection (curation.ts:488–494, gate 14.2 cycle test).
- self-merge → `self-merge <entry> — a slug cannot merge into itself` (curation.ts:441–445).
- Entity merge-only: non-empty `drop` rejected deterministically (curation.ts:380–382). Malformed JSON / non-object / wrong bucket shape rejected; fenced JSON parses via `stripCodeFences`. Valid lists pass; `unsure` folds into keep; an `into` counts as kept.

### Gate 14.2 — union-find chain resolution — **PASS**
UnionFind with path compression (curation.ts:299–322); components collapse to the member used as `into` but never as `from` (curation.ts:484–497). Test: A→B, B→C collapses to `{from:['a-x','b-x'], into:'c-x'}` with `keep:['c-x','d-x']` (canonical survivor kept); a pure cycle (A↔B) is rejected with `no unique survivor`; a legitimate chain through `curateTopics` passes on the FIRST attempt (1 prompt, 1 attempt, no fallback) — no reask loop.

### Gate 14.3 — reask → keep-all — **PASS**
- Attempt-2 prompt = base prompt + `\n\n=== CORRECTION REQUIRED ===` block containing the exact offending entry (`unknown slug 'ghost'`) — verified against `runWithFeedbackRetry` + `buildCorrectionBlock` (`src/llm/reask.ts:64–77,117–143`) and the curation call site appending `\n\n${feedback}` (curation.ts:656). Contexts `curation-topics` → `curation-topics#attempt2`. Bound = 3 total attempts.
- All-attempts-invalid → `decisions: null`, cause `validation-exhaustion`.
- HTTP 400 with REAL `callLLM` against `vi.mock('undici')`: exactly **1 transport call** — `isTransientStatus` (client.ts:403–405) excludes 4xx≠429, so `callLLM` throws immediately (client.ts:514–515) and the reask helper propagates (reask.ts:112–116). Cause `http-4xx`.
- 429: exactly **3 transport calls** (maxRetries 2 + 1), cause `transport-exhaustion`. `classifyFallbackCause` (curation.ts:600–610) explicitly excludes 429 from the `http-4xx` branch — confirmed by reading, matching `callLLM`'s transient class.
- Materialize level: fallback warns (`console.warn` with `topic curation keep-all fallback`), writes every candidate as-is (5 topics + 4 entities all present), `removedPages` empty, report records the fallback. Ingest level: `metrics.curationFallbacks === 1`.

### Gate 14.4 — all-or-nothing — **PASS**
`materialize()` only ever applies validated decision lists; an invalid list can never reach the apply stage (validation is inside `curateSingleCall` before return; null → keep-all). Test proves curation ON-with-fallback is byte-identical to curation OFF: full `entities/|topics/|documents/` tree snapshots (`updated:` stripped — the only run-varying bytes) plus byte-identical `rolling-memory.json`. A 90%-valid list structurally cannot partially apply.

### Gate 14.5 — topic merge/drop — **PASS**
Merge unions claims deduped by identical claim TEXT (materializer.ts:984–990 — the implementer's recorded decision 1 is correct: the write-time composite key `text|type|…` cannot catch same-text-different-type); title/folder from `into`. Test fixture files the same text under `financial` + `financials`; merged page contains it exactly once. Dropped `statistical` never written; its claim survives on the `acme-corp` entity page and in document page data (preservation contract). `financials`/`statistical` folders absent.

### Gate 14.6 — entity merge — **PASS**
Odense-fork fixture (3 variants, cross-relationships, self-loop). Result: one page at `entities/organizations/health/odense-bup.md`; mentions unioned 2+1+1=4; relationships unioned with subject/object repointed — including the self-loop (`located-in` subject AND object both `odense-bup`) and the unmerged entity's outbound reference (`acme-corp.relationships[0].object === 'odense-bup'`); claims/timeline unioned and remapped (`['acme-corp','odense-bup']`); every variant title in `mergedAliases` (pageData) AND frontmatter `aliases` (via `combinedAliases`, entity-page.ts:304); old pages absent. Repoint code: materializer.ts:1013–1031 covers relationships, claim entity lists, timeline event entity lists, and topic-claim entity lists.

### Gate 14.7 — exact-segment wikilink rewrite — **PASS**
Read `rewriteWikilinkTargets` (`src/utils/wikilinks.ts:91–106`): regex `/\[\[([^\[\]]+)\]\]/g` → `parseWikilinkTarget` (split on FIRST pipe) → map lookup by the EXACT full target segment → `formatWikilink(into, display ?? fromTitle)`. Mentally constructed the prefix collisions against this code: rewriting `odense` looks up target `odense-bup-auditorium` (from `[[odense-bup-auditorium|X]]`) and `odense-2` — neither is a map key, both untouched. Bare `[[odense]]` → `[[odense-bup|Odense]]`; pipe form keeps its display. Frontmatter/citation markers contain no `[[...]]` spans and are untouched (integration test asserts `[^src1]` + frontmatter survive). Document pages covered (integration test). **Topic merges also register rewrites** (materializer.ts:997–1002, same `mergeRewrites` map — recorded implementation decision 2; code-verified, see nits for test-coverage note). Freshly-written pages skipped (they render from the curated aggregate); conflict-skipped pages DO get rewritten.

### Gate 14.8 — manual-edit skip — **PASS**
Hash-mismatch (or untracked → treated as edited, the fork-reconciliation precedent) from-pages are vetoed per-location in `filterMerges`/`filterDrops` (materializer.ts:842–916): skipped, logged to `.state/conflicts.json` with a curation-specific reason (`Curation entities merge of 'odense' into 'odense-bup' …`), reported in `manualEditSkips`, and the merge applies nothing when its only `from` is vetoed (treated as keep). Test asserts the manual edit survives byte-for-byte and `entityMerges`/`removedPages` are empty.

### Gate 14.9 — update-mode deletions — **PASS**
Run 1 (curation OFF) writes all pages; run 2 (ON) merges/drops → `removedPages` = exactly the 4 on-disk pages of merged-away/dropped slugs, deleted via `rm` + `pruneEmptyFolderChain` (materializer.ts:1037–1059); empty chains pruned (`entities/places` gone) but non-empty siblings kept (`entities/organizations` survives, `topics/` root survives). Into pages re-materialized (and thereby re-enter synthesis downstream). `.state/extracted/*.json` byte-identical across a merge run (gate 14.13 test — reversibility). Rolling memory built AFTER curation from the curated maps (materializer.ts:1300–1314, `saveRollingMemory` at 1386; test asserts memory = curated set). Report records deletions.

### Gate 14.10 — the `curation` slot — **PASS**
`resolveModel('curation')` → `routing.curation` → falls through to `default` when null; explicit override wins (client.ts:146–149). `setModelRouting` normalizes absent/empty to null (client.ts:98–99) — legacy config without the field resolves byte-identically (test: legacy table → `resolveModel('curation') === default`, other call types unaffected). `normalizeModels` in settings.ts:135 null-fills the absent slot (phase-11 gate 11.9 shape gains `curation: null`). TUI `modelCuration` row exists in the SettingRow union + ROW_ORDER after `modelDox` (settings-screen.tsx:32,45,416,449–450) with provider defaults `claude-sonnet-5` / `gpt-5.6-terra` and the exact ratified recommendation labels; render test shows both. Provider switch re-seeds all five slots (`seedModelsForProvider`, settings.ts:85–94; phase-11 gate 11.10 drives 8 DOWNs and asserts `curation: GPT_TERRA`/`curation: SONNET` both directions).

### Gate 14.11 — overrides — **PASS**
`readCurationOverrides` (state/curation-overrides.ts): absent → created `{neverMerge: []}` (only write the tool ever performs); malformed JSON → warning + empty; wrong shape → warning + empty; never crashes. `neverMerge` pairs veto matching merge edges into keep BEFORE union-find collapsing (curation.ts:450–466, 526–530, 565–569) — the pair is validated like any other entry (bucket accounting still enforced). Test: the stub LLM merges `odense`→`odense-bup`, the override forces both into keep, veto recorded, no fallback. Materializer passes the file through to BOTH calls.

### Gate 14.12 — two-round scaling — **PASS**
`CURATION_SINGLE_CALL_LIMIT = 250` (curation.ts:161). `bucketStem` lowercases, strips per-segment trailing plural `s` (length > 3), drops trailing pure-digit segments; `bucketCandidates` sorts stems and packs consecutively to 250 — deterministic (test calls it twice, identical buckets). 260 single-stem candidates → buckets [250, 10] + one reconciliation over 260 survivors (contexts `curation-topics-bucket-1/-2/-reconciliation`). Reconciliation transport failure → keep-all for THAT scope while round-1's merge survives (survivors 259, `merges:[{from:['topic-001'],into:'topic-002']}` intact, `keep` 259, final set ≤ input). `composeDecisions` (curation.ts:782–856) unions edges across rounds, collapses via union-find, and a dropped canonical takes its whole component.

### Gate 14.13 — language/prompt contracts — **PASS**
Both prompts carry `=== LANGUAGE ===\n{languageDirective}\n\n` near the top (verified on disk; `grep -c "=== LANGUAGE ==="` = 1 in exactly the 8 carrier files) plus `{agentsMd}` and `{candidates}`. `applyLanguageDirective` (language.ts:89–98) removes the whole block byte-identically when the directive is empty (en/en filled prompt contains no `=== LANGUAGE ===`); da/da fills the curation directive — `buildLanguageDirective('curation', …)` (language.ts:134–144) carries the vision `04` §9.4 rule: identities in the output language, sample texts verbatim source evidence, translation-of-same-name is a merge signal. Curation input includes on-disk topics/entities with `onDisk` flags (materializer.ts:748–768; test: run 2 input includes a hand-written on-disk-only topic `manual-review` with claimCount 1 — self-healing). `.state/extracted/*.json` byte-identical across the run. Rolling memory written after curation, reflecting it.

### Gate 14.14 — curation-OFF byte-identity (THE CRITICAL ONE) — **PASS**
Enablement wiring read personally: `materialize()` runs curation iff `options?.curation === true && extractionFiles.length > 0` (materializer.ts:745), plus a no-candidate guard (770); `ingest()` passes `curation: synthesis === true` (ingest.ts:558) — curation rides the synthesis flag exactly per phase doc §2.4 ("same enablement as synthesis"). **No new CLI flag** (`src/cli.ts` untouched in the diff; `--synthesis` is Phase 5's) and **no new TUI toggle** (DEFAULT_SETTINGS shape unchanged — synthesis/updateAgents/models/apiKeys only). When skipped: `entitySlugRemap`/`mergeRewrites` empty, `curationSummary` null → no rewrite pass, no report, `result.curation` undefined, `folderStructure` untouched, `remapSlug` is the identity — byte-identical to pre-Phase-14. Empirically proven by gate 14.4 (fallback == OFF, tree + rolling-memory bytes) and by the unmodified pre-existing materializer suites (phase-03/phase-08) passing in my run.

### The six touched phase-11.test.ts sites — **all legitimate**
Verified hunk-by-hunk against `git diff HEAD`:
1. **11.1 navigation** — +1 DOWN (Save index 9→10): the Curation Model row sits before the API-key rows; comments updated; assertion intent (reach Anthropic API Key row, save persists) unchanged.
2. **11.9 legacy loadSettings shape** — `toEqual` gains `curation: null`: forced by `normalizeModels` null-filling the additive slot; intent (legacy tolerance) unchanged.
3. **11.10 seedModelsForProvider** — `toEqual` gains `curation: GPT_TERRA`/`SONNET`: five-slot seed; intent unchanged.
4. **11.10 provider-switch** — 7→8 DOWNs (both switch directions), type annotations + assertions gain `curation`; test renamed "four"→"five model slots"; intent (reset on switch) preserved and strengthened.
5. **11.11 masking loop** — 7→8 DOWNs to the same target row.
6. **11.11 focusAnthropicKeyRow** — 7→8 DOWNs, same reason.
Every site traces to the additive fifth model slot and nothing else. Grep of the suite confirms no other whole-shape `models` assertions exist.

## Scope sweep — **CLEAN**

`git status --short` + `git diff HEAD --stat` (my own runs). Every path accounted for (the tree also carries Phase 13, verified separately in `.state/phase-13-verification.md` — shared files' diffs are the union of the two verified phases):
- **Phase 14 scope:** the two new prompts, `src/agents/curation.ts`, `src/state/curation-report.ts`, `src/state/curation-overrides.ts`, `tests/phase-14.test.ts` (new); `src/materializer.ts`, `src/llm/client.ts`, `src/tui/settings.ts`, `src/tui/settings-screen.tsx`, `src/commands/ingest.ts`, `src/pages/entity-page.ts`, `src/state/metrics.ts`, `src/utils/aliases.ts`, `src/utils/wikilinks.ts`, `src/utils/language.ts` (the `curation` role, 13 lines); the six phase-11 sites; DOX (root/src/prompts/tests/wikis AGENTS.md + README.md); `.state/phase-14-status.json`, compliance-log entries.
- **Phase 13 scope (previously verified):** the four synthesis prompts + extractor prompt self-sizing line + dox-writer prompt line, `src/agents/synthesis.ts`, `src/dox-writer.ts`, `templates/AGENTS.md` (sparse/self-sizing), `tests/phase-13.test.ts`, phase-13 state files.
- **Framework/canon:** vision 01/04/05/07 + `Project Vision/optimizations/` (the L3/L3e promotion, ratified pre-implementation), Implementation Plan index files + PHASE_13/14/15 docs, `.state/phase-12-status.json` bookkeeping, `.zcode/` tooling noise.
- **Untouched as required:** `scripts/`, `dist/`, `wikis/` runtime content, `package.json`/`package-lock.json` (no new dependencies), `vitest.config.ts`, `tsconfig.json`, `test-pdfs/` golden masters, `tests/snapshots/`, `.env` (stash-restored, 171 bytes verified).

## DOX-pass quality — **PASS**

- `prompts/AGENTS.md`: carrier count now **eight** ("all eight agent prompts (extractor, both entity synthesis, both topic synthesis, dox-writer, both Phase 14 curation prompts)") — matches my on-disk grep (8 files, exactly one block each); the workspace/workspace-entry/updater prompts correctly remain non-carriers. The retained "all six templates" phrase on the Phase-7 line accurately describes the phase-07 tests' scope (the two new carriers are covered by the gate-14.13 line right below) — not a contradiction.
- `src/AGENTS.md`: curation.ts contract, materializer aggregate→curate→apply→write paragraph, ingest wiring (enablement pin, seams, metrics, mergedAliases extras), state-module entries — all accurate against the code I read; no contradictions with neighboring bullets.
- `tests/AGENTS.md`: phase-14 entry enumerates all 14 gates accurately; Verification counts (307+14 / 20 files) match my own run exactly; six-site enumeration matches the diff.
- `wikis/AGENTS.md`: `.state` gains `curation-report.json` + `curation-overrides.json` with accurate shapes. Root `AGENTS.md`: curation agent + prompts index lines accurate.
- `README.md`: Layer-3 curation paragraph, routing JSON example + per-role lists + both provider suggestion rows + call-type map + legacy null-fill note + state-file list + metrics line + agents/ structure line — all accurate (one gloss nit below).
- Compliance log: Phase-14 pre-check (COMPLIANT), implementation close-out entry (COMPLIANT), and the **clerical correction entry [2026-07-24 14:20]** about the close-out's timestamp — present and legitimate (append-not-rewrite per `.state/AGENTS.md`). No unresolved contradictions.

## Checklist audit (phase doc §5)

| # | Item | Result |
|---|---|---|
| 1 | All 14 technical gates pass; full suite unregressed with curation stubbed off | **Met** — verifier-run 307+14/20 files, 37/37 standalone; OFF byte-identity proven (14.4/14.14) |
| 2 | All UAT steps pass (14.2 may be demonstrated by gate evidence) | **Met for verification** — UAT 14.1/14.2 are user live steps documented in §4; 14.2's behavior is gate-proven (HTTP 4xx → immediate fallback + warning + `curationFallbacks` increment); 14.3 deferred to package UAT by the phase doc itself |
| 3 | Merge-only entities; strict-identity prompt with evidence samples; `unsure` → keep | **Met** — non-empty entity `drop` rejected deterministically; prompt carries 1–2 sample mention contexts; unsure folds into keep in validation |
| 4 | Validated before application; all-or-nothing; union-find; reask ≤3 with exact offenders; keep-all on every failure class | **Met** — gates 14.1–14.4 |
| 5 | Exact-segment link rewrite proven against prefix collisions | **Met** — gate 14.7 unit + integration |
| 6 | Manual-edit pages never auto-merged; `.state/extracted/` immutable; report + overrides behave as specified | **Met** — gates 14.8/14.13/14.11/14.9 |
| 7 | `curation` slot additive with mid-tier defaults; legacy byte-identical | **Met** — gate 14.10 + phase-11 11.9/11.10 |
| 8 | Both prompts carry `{languageDirective}`; rolling memory post-curation | **Met** — gate 14.13 + code order (memory built at materializer.ts:1300 after the curation block) |
| 9 | Compliance log shows no unresolved contradictions | **Met** — pre-check + close-out COMPLIANT + legitimate clerical correction |
| 10 | No new LLM calls in testing; budget $0 | **Met** — all 37 tests stub-injected or undici-mocked; key-less run confirmed; $0 |

## Nits (non-blocking, for the record)

1. **README.md line 85 gloss:** "resets the five model slots … (cheapest tier as the default model, "Same as default" elsewhere)" — the parenthetical is stale: the `curation` slot seeds to the provider's MID-TIER (`claude-sonnet-5`/`gpt-5.6-terra`), not "Same as default". Behavior is correct per the ratified spec (`seedModelsForProvider` + gate 11.10 assertions); only the README gloss is imprecise. Suggest a one-line fix at the next DOX touch.
2. **Topic-merge link-rewrite test coverage:** gate 14.7's integration test exercises an entity merge; topic merges register into the same `mergeRewrites` map (materializer.ts:1001) and flow through the identical rewrite pass — code-verified, but no dedicated integration assertion for a topic-merge link rewrite. Coverage nit only; the shared code path is fully tested.

## Final verdict

**PHASE 14 VERIFIED.** All 14 gates independently confirmed with file/line evidence; verifier-run key-less regression matches the claimed numbers exactly (307 passed + 14 skipped across 20 files; phase-14 file 37/37; tsc clean; `.env` restored at 171 bytes, no bak files left); scope clean; checklist satisfied; LLM cost $0. Recommended status: `verified-awaiting-uat` (UAT 14.1–14.3 for the user; 14.3 is the package-UAT re-ingest by design). The with-key profile was correctly NOT re-run (projected 319 passed + 2 skipped) — verify with the key loaded before any release.
