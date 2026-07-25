# Phase 13: Output Caps & Prompt Self-Sizing (L1 + L1b + L2 label)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-013`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-23
**Dependencies:** Phases 0-9, 11, 12
**Estimated Time:** 2-3 hours
**LLM Token Budget:** $0 (all gate tests are LLM-free — mocked transport or injected stubs; live verification only during real ingests at the user's discretion)

**Canon basis (user-ratified 2026-07-23, promoted compliance-log [2026-07-23 23:59]):** `Project Vision/04_orchestration_detailed.md` §6 (output-token ceilings), `Project Vision/07_validation_and_quality.md` §5 (same note), `Project Vision/02_WIKI_concept_detailed.md` §4.7/§4.8 (layer-scoped length targets + the `sparse` flag — this phase restores prompt fidelity to them), `Project Vision/05_page_types_specification.md` §2 (`sparse` frontmatter field), and the root AGENTS.md 2026-07-23 model-routing preference (DOX slot → mid-tier). Decision record: `Project Vision/optimizations/optimizations.md` levers L1, L1b, L2. This phase implements exactly those ratifications — no more, no less.

---

## 1. Objective

Kill the retry-storm trap that drove 62% of the 2026-07-23 production ingest spend: output-token caps that truncated guaranteed-failure responses, and prompt word-count rules that contradicted the hard validation gates. Raise the synthesis/DOX caps to their ratified ceilings, remove every word-count floor/ceiling from the four synthesis prompts and replace them with the ratified quality-based self-sizing block, add the ratified `## Pages` catalog-line quality rule to the DOX prompt, implement the vision-`02` §4.8 `sparse: true` frontmatter flag in code (specified since Phase 5, never built), and update the TUI's DOX-slot recommendation label to the ratified mid-tier guidance.

---

## 2. What to Build

### 2.1 Output-token ceilings (L1)

**Files:** `src/agents/synthesis.ts`, `src/dox-writer.ts`

- In `src/agents/synthesis.ts`, replace the four `maxTokens: 8192` literals (currently at lines 211, 241, 267, 293) with one shared module constant:
  ```typescript
  const SYNTHESIS_MAX_TOKENS = 32768;
  ```
  All four synthesis call sites (strict entity, permissive entity, strict topic, permissive topic) use the constant. No per-language split (ratified).
- In `src/dox-writer.ts`, change `DOX_WRITER_MAX_TOKENS` (line 167) from `2048` to `8192`. The constant already serves all three DOX call sites (lines 916, 1320, 1343).
- `EXTRACTION_MAX_TOKENS = 16384` (`src/agents/extractor.ts:95`) is **unchanged** — zero retries in 61 calls in the reference run.
- Rationale recorded in canon (`04` §6): caps are safety ceilings, not length controllers; the model never sees `max_tokens`, so a low cap yields truncated output, never shorter output. Worst-case per-call cost stays bounded by the ≤3+3 retry limits (vision `04` §6).

### 2.2 Synthesis prompt self-sizing (L1b)

**Files:** `prompts/synthesis.prompt.txt`, `prompts/synthesis-permissive.prompt.txt`, `prompts/synthesis-topic.prompt.txt`, `prompts/synthesis-topic-permissive.prompt.txt`

In each of the four prompts, the word-count line is the LAST bullet of the rules list, immediately after `- Write in clear, plain language suitable for a journalist.`:

- `synthesis.prompt.txt:52` — `- The page must be at least 300 words of synthesis (Layer 1) and no more than 2000 words total.`
- `synthesis-permissive.prompt.txt:45` — `- The page must be at least 300 words of synthesis (Layer 1).`
- `synthesis-topic.prompt.txt:39` — `- The page must be at least 300 words of synthesis (Layer 1).`
- `synthesis-topic-permissive.prompt.txt:31` — `- The page must be at least 300 words of synthesis (Layer 1).`

**Remove all four lines entirely** (floor AND ceiling — ratified: word counts are a double-edged sword; floors force hallucination on thin pages, ceilings force detail loss on dense ones). In their place, insert the **verbatim-ratified** replacement block (user approved the wording 100%; entity variants below — the two topic prompts use the same block with the completeness list adjusted to topic content, marked ⓣ):

```
Length is not a target — completeness is. Write until this page passes the
Journalist Test and the points below are covered by the evidence, then stop.

- Let the evidence set the length. A richly documented entity earns several
  paragraphs; an entity mentioned once earns a few honest sentences. Never
  pad with filler, speculation, or repetition to make a page look
  substantial — and never compress away substance (dates, numbers,
  relationships, context) to make a page look tidy.
- A complete synthesis covers, when the evidence supports it: who/what this
  entity is and why it matters; chronology with explicit dates; how it fits
  the broader story (cross-references to related pages); disambiguation of
  the name; the key claims and relationships. When the evidence answers all
  of these, the synthesis is complete — stop writing.
- If the data is thin (one or two mentions, no significant claims or
  relationships), say exactly that, e.g. "Jane Doe is mentioned once in the
  corpus as a consultant to Acme Corp [^src1]. No further details are
  available." An honest sparse page is a correct page, not a failure.
- Layer 2's length is determined by the data, never by style: list every
  mention, relationship, claim, and timeline event from the data above,
  verbatim. Never drop, shorten, merge, or paraphrase evidence to save
  space.
```

ⓣ **Topic-prompt adjustments** (both topic prompts): in bullet 1, "entity" → "topic" ("A richly documented topic earns several paragraphs; a topic supported by a single claim earns a few honest sentences"); in bullet 2, the completeness list becomes topic content — "what this topic is and why it matters across the corpus; which key entities are involved and how; chronology with explicit dates when the evidence supports it; the key claims. When the evidence answers all of these, the synthesis is complete — stop writing."; in bullet 3, "one or two mentions" → "one or two claims"; bullet 4's Layer-2 list for topics is "every claim from the data above" (topics carry claims + sources only). The block's first paragraph (before the bullets) is byte-identical in all four prompts.

Placement: the block replaces the word-count bullet at the end of the rules list in each prompt. Nothing else in the four prompt files changes — every other line stays byte-identical (the Phase 7 `{languageDirective}` block, the wikilink rule, the preservation rules, the data sections).

### 2.3 DOX prompt catalog-line quality rule (L1b package)

**File:** `prompts/dox-writer.prompt.txt`

No word counts exist in the DOX prompt; none are removed. Add the ratified quality rule to the `## Pages` requirements (near lines 69-71, where the 2-5-sentence description and per-entry description rules live):

```
- Each `## Pages` line must tell the reader something the page title alone does not.
```

The 2-5-sentence description-paragraph rule stays unchanged (a shape rule for the only creative unit, consistent with vision `03`). No other DOX prompt text changes.

### 2.4 The `sparse: true` frontmatter flag (L1b package, vision `02` §4.8)

**Files:** `src/pages/entity-page.ts`, `src/materializer.ts` (data plumbing only), `src/commands/ingest.ts`

The flag is computed **deterministically from the aggregate** — never by the LLM:

- Rule (vision `02` §4.8 + `05` §2): an entity page gets `sparse: true` when its aggregate has **≤2 mentions AND no claims AND no relationships**. All other entity pages omit the field (no `sparse: false` — the field is absent unless true).
- `src/pages/entity-page.ts`: the frontmatter writer emits `sparse: true` (after `aliases`, before `sources` — matching the existing field-order conventions) when the rule holds. Entity pages are re-derived from the full extraction set every run (Phase 8 update mode), so the flag is recomputed correctly on every ingest — a stub that gains mentions loses the flag automatically.
- `src/materializer.ts`: the per-entity structured page data (`MaterializeResult.entityPages` entries) gains a `sparse: boolean` field computed from the same aggregate, so downstream consumers see it.
- `src/commands/ingest.ts`: the synthesis-replacement paths must not lose the flag. The existing UAT 6.3 precedent re-imposes `aliases` over the model-written page via `enforceAliasesInMarkdown` (ingest.ts ~line 761): extend that enforcement so `sparse: true` is re-imposed the same way whenever the structured page data carries it (strict pass, permissive pass — the template-fallback path keeps the materializer-written page, which already has the flag). The LLM's own frontmatter is never trusted for the flag, exactly as with aliases.
- Synthesis prompt interplay: none needed — the sparse *behavior* (honest thin pages) is already in the §2.2 block; the flag does not appear in prompts.

### 2.5 TUI DOX-slot recommendation label (L2 guidance)

**File:** `src/tui/settings-screen.tsx`

Update the `RECOMMENDATIONS` map's `modelDox` entries (lines 75, 80) to the ratified mid-tier guidance:

- Anthropic: `Sonnet — mid-tier; structural navigation, correctness re-imposed deterministically`
- OpenAI: `GPT-5.6 Terra — mid-tier; structural navigation, correctness re-imposed deterministically`

This replaces the Phase 11 "strong contract writing" label per the 2026-07-23 model-routing preference (root AGENTS.md). It is a label-only change: no defaults, no routing behavior, no code path changes — the user sets the slot themselves (L2 was ratified as settings guidance, not a code change).

---

## 3. Technical Approval Gates

All gates are LLM-free (mocked transport, injected stubs, or static prompt-file assertions).

### Gate 13.1: Cap constants

`src/agents/synthesis.ts` contains exactly one `SYNTHESIS_MAX_TOKENS = 32768` constant and all four synthesis call sites pass it (no `8192` literal remains in the file); `DOX_WRITER_MAX_TOKENS` is `8192` and serves all three DOX call sites; `EXTRACTION_MAX_TOKENS` stays `16384`. Behavior proof: a stubbed `callLLM` capture at each of the four synthesis sites and the DOX folder path shows the new values in the request options.

### Gate 13.2: Synthesis prompts carry no word counts + the ratified block

Static assertions over all four prompt files: (a) no line matches any word-count floor/ceiling pattern (`at least N words`, `no more than N words`, `word count`, numeric `words` limits); (b) the block's anchor lines are present verbatim — `Length is not a target — completeness is.`, `Let the evidence set the length.`, `An honest sparse page is a correct page, not a failure.`, `Layer 2's length is determined by the data, never by style`; (c) the first block paragraph is byte-identical across all four files; (d) the topic files contain the ⓣ topic-adjusted completeness list and the entity files the entity list.

### Gate 13.3: Prompt diff is confined to the amendment

For each of the four synthesis prompts, the filled-prompt diff against the pre-Phase-13 template contains ONLY the removed word-count bullet and the inserted block — every other line byte-identical (the `{languageDirective}` block, wikilink rule, preservation rules, data sections, placeholders). The DOX prompt diff contains ONLY the added catalog-line rule.

### Gate 13.4: Sparse flag written by the Materializer

Materialize a fixture wiki (existing Phase 3/8 harness, no LLM): a 1-mention entity with no claims/relationships → frontmatter contains `sparse: true`; a 2-mention entity with a claim → no `sparse` field; an entity with 3+ mentions → no `sparse` field. Update-mode re-run: after a second extraction adds a third mention, the flag disappears from the re-derived page.

### Gate 13.5: Sparse survives synthesis replacement

Stubbed synthesis (existing `synthesize*Fn` injection seams): a sparse entity's synthesized page still carries `sparse: true` after the strict pass AND after the permissive pass (deterministic re-imposition over model-written frontmatter); a non-sparse entity's synthesized page has no `sparse` field even if the stubbed LLM emits one.

### Gate 13.6: TUI labels

Settings-screen test (existing ink-testing-library harness): with provider Anthropic the DOX row's recommendation names `Sonnet` and not `Opus`; with provider OpenAI it names `GPT-5.6 Terra` and not `Sol`. No other row labels changed.

### Gate 13.7: Full-suite regression

`npx tsc --noEmit` clean; key-less `npm test` green with zero unexpected changes. Any pre-existing test that asserted the removed word-count lines or the old cap values (e.g. `tests/phase-11.test.ts:627,644` uses a `maxTokens: 2048` fixture — verify it is fixture-local) is updated to the new canon with its assertion intent preserved; every update is enumerated in the status file.

---

## 4. User Acceptance Tests (UAT)

### UAT 13.1: Inspect the amended prompts

1. Open `prompts/synthesis.prompt.txt` and `prompts/synthesis-topic.prompt.txt`.
2. Expected: no `300 words` / `2000 words` lines; the self-sizing block is present at the end of the rules list; nothing else changed. `prompts/dox-writer.prompt.txt` carries the new `## Pages` catalog-line rule.

### UAT 13.2: Sparse flag on a small live ingest (optional, small cost)

1. Ingest a small wiki (e.g. golden-master.pdf, synthesis on).
2. Expected: any 1-2-mention entity page carries `sparse: true` in frontmatter — including after LLM synthesis replaced the page; dense entity pages carry no `sparse` field. In Obsidian, sparse pages are identifiable at a glance.

### UAT 13.3: Settings label

1. `chase` → Settings; inspect the DOX Writer model row under both providers.
2. Expected: the inline recommendation reads `Sonnet — mid-tier; structural navigation, correctness re-imposed deterministically` (Anthropic) / `GPT-5.6 Terra — …` (OpenAI).

(UAT note: the full cost/quality effect of the raised caps is measured by the package UAT after Phase 15 — the adhd-wiki re-ingest — not here.)

---

## 5. Approval Checklist

- [ ] All 7 technical gates pass (`npm test` green; full suite unregressed).
- [ ] All 3 UAT steps pass (13.2 may be demonstrated by gate evidence).
- [ ] Synthesis caps 32768, DOX cap 8192, Extractor cap unchanged; no per-language split.
- [ ] Zero word-count requirements remain in any of the four synthesis prompts; the ratified block is verbatim (topic variants per ⓣ).
- [ ] Prompt diffs confined to the amendments (Gate 13.3 evidence).
- [ ] `sparse: true` written deterministically for ≤2-mention claim-less/relationship-less entities; survives synthesis replacement; absent elsewhere.
- [ ] TUI DOX labels recommend mid-tier on both providers; no defaults changed.
- [ ] Compliance log shows no unresolved contradictions.
- [ ] No new LLM calls in implementation testing; budget $0.

---

## 6. Integration Notes

### What Phase 13 Depends On
- The Phase 12 reask machinery (`src/llm/reask.ts`) is untouched — higher caps simply make truncation-driven reasks rare; genuine content-defect reasks remain, correctly.
- The `enforceAliasesInMarkdown` deterministic frontmatter post-processor (UAT 6.3 precedent) is the seam for the sparse re-imposition.
- Phase 5 synthesis prompt structure (rules list ends with the word-count bullet) is the amendment point.

### What Phase 13 Produces
- `SYNTHESIS_MAX_TOKENS = 32768`; `DOX_WRITER_MAX_TOKENS = 8192`.
- Four self-sizing synthesis prompts + the DOX catalog-line rule.
- The `sparse` frontmatter flag end-to-end (Materializer → synthesis re-imposition).
- Mid-tier DOX recommendation labels in Settings.

### Contract with Later Phases
- Phase 14's curation pass runs before synthesis; its prompts are new files, unaffected by these amendments. Phase 15's worker pool wraps the synthesis loops unchanged. The adhd-wiki package UAT (after Phase 15) measures this phase's cap effect: the 45 template fallbacks from the 2026-07-23 run should become real synthesized pages.
- Frozen surfaces untouched: golden masters, Extractor prompt, updater prompt, workspace prompts. DOX pass required on completion: `prompts/AGENTS.md` (synthesis prompt bullets — word-count rule removed, self-sizing block added; DOX bullet — catalog-line rule), `src/AGENTS.md` (cap constants, sparse flow), `tests/AGENTS.md` (phase-13 entry), root AGENTS.md (phase index line if applicable), README (sparse flag + caps if documented there).
