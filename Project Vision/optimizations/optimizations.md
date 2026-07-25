# Ingest Optimizations — Analysis & Decision Record

**Status: discussion record — promoted decisions are canon.** This document gathers the evidence from the 2026-07-23 production ingest post-mortem and the optimization levers derived from it, and records the user's decisions as they are made. A decision recorded here takes effect only after it is promoted into the canonical vision documents (`04_orchestration_detailed.md`, `07_validation_and_quality.md`, `03_DOX_concept_detailed.md`) through the contradiction/amendment protocol. **All ratified decisions in the §4 Decision log were promoted into the canon docs on 2026-07-23** (compliance-log entry "Optimization decisions promoted to canon"; target sections in the log's "Promoted to canon" column). Implementation is phased as `Implementation Plan/PHASE_13` (caps + prompts + sparse), `PHASE_14` (curation), `PHASE_15` (synthesis concurrency).

## 1. Background: the 2026-07-23 adhd-wiki ingest

First full-scale production run (packaged `dist/paper-chase.exe`, Anthropic provider).

**Input:** 5 Danish ADHD quality-database annual-report PDFs (`adhd-2020` … `adhd-2024`), split into 61 extraction chunks (13+12+10+11+15).

**Output produced:** 270 entity pages, 57 topic pages, 61 document pages, 89 `index.md` DOX contracts, workspace `index-of-indexes.md` segment, `.state/proposed-agents.md`. The wiki is rich and the run completed end-to-end without process failure — the MVP works.

**The cost:**

| Phase | Model | Calls (of which retries) | Cost | Wall time |
|---|---|---|---|---|
| Extraction, 61 chunks | Haiku 4.5 | 61 (0) | **$2.88** | 0:44 |
| Entity synthesis, 270 pages | Sonnet 5 | 578 (260) | $63.93 | 6:55 |
| Topic synthesis, 57 pages | Sonnet 5 | 136 (66) | $16.22 | 1:51 |
| DOX contracts, 88 folders + workspace | **Opus 4.8** | 241 (150) | $61.90 | 1:20 |
| AGENTS.md updater | Haiku 4.5 | 1 (0) | $0.02 | <0:01 |
| **Total** | | **1,017 (476)** | **$144.95** | **~11:00** (08:38→19:33) |

**Synthesis outcomes (final):** entities 270 = 222 strict-pass + 11 permissive-pass + 37 template-fallback; topics 57 = 44 strict-pass + 5 permissive-pass + 8 template-fallback.

### The two structural numbers

1. **Retries were 62.1% of all spend.** 476 retry calls (`#attempt2/3`), $89.96 of $144.95. All first attempts combined cost $54.99.
2. **73.6% of the entire bill was spent on calls that hit a hard output-token cap** ($106.73 across 468 capped calls). A capped call is a *guaranteed* failure: truncated output always fails validation (unparseable or missing sections), triggering the Phase 12 reask loop with validator feedback appended — the model writes the same length again, truncates again, and after ≤3 strict + ≤3 permissive attempts the page falls back to the deterministic structured template.

**45 pages paid the full ~6-attempt retry tax (~$25) and still ended as non-LLM templates** — the worst output at the highest price.

**Causality evidence that caps — not model quality — drive the retry storms:**

* DOX writer cap = **2048 tokens** (`src/dox-writer.ts:167`): 225 of 241 calls (93%) hit it. A folder contract must list every child with link text; `documents/` alone has 61 children.
* Synthesis caps = **8192 tokens** (`src/agents/synthesis.ts:211,241,267,293`): dense entities carry 30–70K tokens of evidence that the preservation rule requires to reappear in Layer 2 — unwritable in 8192. Example: `adhd-databasen` burned 6 calls, every one truncated at exactly 8192 output tokens, $1.88 → template fallback.
* Counter-evidence: the Extractor cap is **16384** (`src/agents/extractor.ts:95`) — and it had **zero retries in 61 calls** all day.
* Reask amplifies cost: feedback is appended to the full prompt, so retry inputs grow (e.g. 50K→70K tokens), making attempts 2–3 more expensive than attempt 1.

**Model routing used (`.paper-chase.json`):** Extractor → Haiku, Synthesis → Sonnet, DOX → Opus, Updater → Haiku. Price table (`src/llm/client.ts:32-40`): Haiku $1/$5, Sonnet $3/$15, Opus 4.8 **$5/$25** per Mtok (in/out) — a 66% premium over Sonnet.

**Entity size distribution (rolling memory):** 270 entities — 78 with 1 mention, 54 with 2, 59 with 3–5, 38 with 6–10, 31 with 11–25, 10 with 26+. Synthesis cost by bucket: ≤2 mentions = 132 pages / **$6.07 total**; 11–25 mentions = 31 pages / $24.98; 26+ = 10 pages / $14.18. Money and retries concentrate in the 41 densest entities.

**Topic quality:** of 57 synthesized topics, roughly 30 are real content topics; the rest are near-duplicates or pure abstractions — e.g. `quality`/`quality-standard`/`clinical-quality`/`quality-indicator-definition`; `performance`/`performance-metric`/`performance-target`/`regional-performance`/`departmental-performance`; `causal`/`causal-analysis`; `definition`/`definitional`; `clinical-procedure`/`procedural`/`procedural-requirement`; `observation`/`clinical-observation`/`operational-observation`; `external-factor` **and** `external-factors`; `temporal`, `statistical`, `trend`, `volume`, `context`, `decision`, `historical`, `methodological`, `regulatory`. Each junk topic cost a Sonnet synthesis (with retries) **and** an Opus folder contract (with retries).

**User standing preferences (constraint on all levers):** Sonnet remains the writing model for reader-facing prose (entity/topic synthesis) — Haiku has proven too weak for writing in the user's experience. Opus on DOX is acknowledged as overkill by the user.

## 2. Levers, ranked by projected saving

Each lever: evidence → proposal → trade-offs/open questions → decision (pending discussion).

### L1 — Raise the output-token caps (biggest lever)

* **Evidence:** §1 numbers 1–2; 93% DOX truncation rate; 42+ page fallbacks after full retry tax; extractor's 16384 cap had zero retries.
* **Proposal:** synthesis family 8192 → **32768** (or conservative 16384); DOX writer 2048 → **8192**. Four call sites in `src/agents/synthesis.ts`, three in `src/dox-writer.ts` (constant `DOX_WRITER_MAX_TOKENS`).
* **Projected saving:** ~$55–70 of the ~$90 retry spend; also the main quality fix (45 fallbacks become real synthesized pages).
* **Trade-offs / open questions:** (a) verify Sonnet 5 / Opus 4.8 max supported output (Sonnet-class models support ≥64K); (b) successful long pages cost slightly more output tokens than before — trivial vs eliminated retries; (c) some preservation failures are genuine content drops, not truncation — those retries remain, correctly; (d) does a bigger DOX cap change the deterministic re-imposition step? (No — re-imposition overwrites children/statistics deterministically regardless.)
* **Decision (2026-07-23): RATIFIED — synthesis 8192→32768, DOX 2048→8192, no per-language split.** Rationale: caps are a safety ceiling, not a length controller (models never see `max_tokens`; a low cap yields truncated output, never shorter output); worst-case per-call cost is already bounded by the ≤3+3 retry limits. The prompt-level length/content conflicts this surfaces (the `2000 words total` rule vs preservation; DOX section requirements scaling with folder size) are split out as lever **L1b** below — under discussion, must be resolved together with L1 before implementation.

### L1b — Prompt length/content rules that conflict with the hard gates (ratified 2026-07-23)

Surfaced while ratifying L1: the caps were only half the trap; the prompts' own length rules contradict what the validators enforce. Must be amended in the same pass as L1 or the conflict reappears under the higher ceiling.

**The enforcement stack (what is actually checked):**

| Rule | Where | Enforced? |
|---|---|---|
| Every mention context, relationship evidence, claim text present **as verbatim substring** | `src/validation/preservation-check.ts:24-97` | **Hard gate** — drives the ≤3+3 reask loop |
| Every citation marker `[^srcN]` present | same | **Hard gate** |
| DOX required headings (`## Pages`, `## Statistics`, `## Start Here`, title) | `src/dox-writer.ts:419-435` | **Hard gate** — children/statistics then deterministically re-imposed |
| "At least 300 words of synthesis (Layer 1)" | all 4 synthesis prompts | prompt-only, never validated |
| "**No more than 2000 words total**" | `prompts/synthesis.prompt.txt:52` **only** (strict entity) | prompt-only, never validated |
| DOX prose: description "2-5 sentences", per-entry "one specific, content-based description" | `prompts/dox-writer.prompt.txt:69-71` | prompt-only |

**The three conflicts:**

* **C1 — the 2000-word ceiling vs the preservation gate (strict entity prompt).** The gate requires the full Layer-2 payload (all mention contexts + evidence + claim texts, verbatim) to appear as substrings — so output size is structurally ≥ the evidence size, regardless of prose style. For dense entities the payload alone far exceeds 2000 words. The validator enforces preservation, *not* the word count, so the model rationally violates the word rule, hits the token cap, truncates, fails. Notably the permissive prompt (`synthesis-permissive.prompt.txt:27,45`) — written for "very dense" material — has **no upper bound at all**: the codebase already contains the honest pattern.
* **C2 — the 300-word floor vs "do not invent facts" (all synthesis prompts).** A 1–2-mention stub entity cannot honestly fill 300 words; the floor pressures the model to pad or speculate. Yesterday 132 of 270 entities were stubs.
* **C3 — DOX output is structurally data-sized.** The `## Pages` catalog requires one line per page+sub-folder, `## Navigation` one line per sibling; only the description paragraph is creative prose (bounded at 2-5 sentences). No fixed token budget can fit both a 2-child and a 61-child folder — the 2048 cap was never viable for `documents/` (61 pages) by construction.

**The canon-misread discovery (2026-07-23):** the word counts in the prompts are *distortions of the vision*, not implementations of it. Vision `02` §4.7 sets a **target of 300–800 words of *synthesis* (Layer 1 only)**, a soft maximum of 2000 words **of synthesis** with sub-page splitting as the remedy, and a minimum of *one paragraph* plus a `sparse` flag for thin entities (§4.8, with model honesty text: *"Jane Doe is mentioned once in the corpus… No further details are available."*). The prompt flattened all of this into "at least 300 words" + "no more than 2000 words **total**" — importing Layer 2 into the ceiling and hardening the floor. Conflicts C1/C2 are prompt bugs; the canon was already quality-based. Related gap: the §4.8 `sparse` frontmatter flag was never implemented (no `sparse` anywhere in `src/`); the prompt amendment below adopts the sparse *behavior* without requiring the flag.

* **Decision (2026-07-23): RATIFIED (user directive, wording approved 100% as proposed).** Remove **all** word-count requirements — floor and ceiling — from the four synthesis prompts. User rationale: word counts are the worst kind of double-edged sword — a minimum forces hallucination on information-poor pages, a maximum forces detail loss on information-rich ones. Replace with quality-based self-sizing: the agent decides length from the entity/topic context, guided by the vision's quality criteria. Options A/C rejected; B superseded by the stronger formulation below, which the user ratified verbatim. Also ratified as part of the package: (a) the DOX `## Pages` catalog-line quality rule below, and (b) implementing the vision `02` §4.8 `sparse: true` frontmatter flag in code (small companion item — the flag does not exist in `src/` today; the synthesis prompt's sparse *behavior* does not depend on it).

**Ratified replacement block for the four synthesis prompts** (replaces every word-count line; topic variants adjust the completeness list):

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

**DOX prompt:** no word counts existed there; nothing to remove. The earlier optional ~15-words-per-catalog-entry bound is **withdrawn** (same anti-word-count principle); replaced by the **ratified** quality-based catalog-line rule: "each `## Pages` line must tell the reader something the page title alone does not." The 2–5-sentence description paragraph stays — it is a shape rule for the only creative unit, consistent with vision `03`'s concise-contract canon.

**Canon-alignment note for promotion:** this amendment *restores* fidelity to `02` §4.7/§4.8 rather than changing the vision; the vision text itself needs no edit for L1b. Separately, `02` §4.7's soft 2000-word Layer-1 maximum + sub-page splitting remedy is a Materializer concern, unaffected by this prompt change.

**Input-side observation (candidate lever L6):** the DOX prompt includes **full, untruncated page contents** (`src/dox-writer.ts:748-756`) — for `documents/` that is all 61 document pages in the prompt. DOX input tokens were 10.0M ≈ $50 of the $61.90 Opus bill. After L1 kills the retries (which re-send that input 2–3×), input falls to ~4M tokens; excerpt-based `pageContents` (title + first N tokens) could cut it further at some risk to catalog-description quality. Deferred for separate discussion.

### L2 — DOX writer: Opus → Sonnet

* **Evidence:** DOX = $61.90 at Opus; identical call pattern at Sonnet pricing = $37.14. DOX contracts are structured navigation (children lists, link texts), not reader-facing prose; the deterministic re-imposition guarantees structural correctness regardless of model.
* **Proposal:** change the `dox` slot default to `claude-sonnet-5` (user already flagged Opus-on-DOX as overkill).
* **Projected saving:** ~$25 standalone; combined with L1 the DOX phase drops to roughly **$8–12** total.
* **Trade-offs / open questions:** prose quality of folder contracts slightly lower — acceptable for navigation pages; settings UI default change only, users can still opt into Opus.
* **Decision (2026-07-23): RATIFIED — as SETTINGS GUIDANCE, not a code/default change.** The user changes the DOX slot in the TUI Settings themselves; nothing in the codebase changes. The guidance replaces the DOX part of the 2026-07-18 Phase 11 routing preference ("DOX Writer → strong contract-writing model") and applies to both providers:

**Ratified per-slot model guidance (both providers):**

| Slot | Anthropic | OpenAI | Why |
|---|---|---|---|
| Extractor | Haiku 4.5 ($1/$5) | GPT-5.6 Luna ($1/$6) | structured JSON extraction; cheapest tier proved sufficient (61 calls, $2.88, zero retries) |
| Synthesis (entities/topics) | Sonnet 5 ($3/$15) | GPT-5.6 Terra ($2.5/$15) | reader-facing prose; user requires a strong writing model (Haiku/Luna too weak for prose, by experience) |
| **DOX Writer** | **Sonnet 5 ($3/$15)** | **GPT-5.6 Terra ($2.5/$15)** | structural navigation contracts; correctness is deterministically re-imposed — top tier buys nothing |
| `default` (covers AGENTS.md updater) | Haiku 4.5 | GPT-5.6 Luna | single cheap call ($0.02 in the reference run) |
| ~~Avoid as defaults~~ | Opus 4.8 ($5/$25) | GPT-5.6 Sol ($5/$30) | premium tier (+66% Anthropic / +100% OpenAI token price over mid-tier) with no measured benefit in the reference run |

When the optimization package is eventually implemented in code, the TUI's inline recommendation label for the DOX slot should be updated to match this guidance (it currently recommends the strong model per the Phase 11 preference).

### L3 — Topic hygiene: LLM topic-curation pass

* **Root cause (confirmed in code + canon, 2026-07-23):** topics are **claim types**. `04_orchestration_detailed.md` Step 6 specifies "Group claims by type and create/update topic pages"; `src/pages/topic-page.ts:51-52` implements it literally ("The first-pass topic slug is the claim type itself"). The Extractor prompt contains **zero guidance on claim `type` values** (`prompts/extractor.prompt.txt` — no taxonomy, no constraints), so Haiku invents a free-form adjective per claim per chunk — `temporal`, `statistical`, `trend`, `definitional`… — and every invented type becomes a topic page + folder + DOX contract. Meanwhile `05_page_types_specification.md` §7 defines a topic as "a theme, concept, or legal issue that appears across the corpus" and `02` §4.6 wants granular *themes* — the claim-type mechanism with an unconstrained vocabulary structurally violates that semantics. Yesterday's junk topics are the canon mechanism working as specified against a vocabulary nobody constrained.
* **Compliance read for the fix (user directive: solve all three classes with an LLM checker):**
  * `04` §1 frames the pipeline as "two LLM calls per chunk … and one LLM pass at the end" — an LLM curation pass is a **new LLM stage** → requires a vision amendment to `04` Step 6 (same amendment route as the bounded-retry precedent).
  * Preservation contract is safe: `02` §1 requires every extracted detail on *at least one page* — claims live on entity pages and document pages as well as topic pages, so merging/dropping topic pages loses no evidence.
  * An LLM checker is *more* vision-compliant than a fixed claim-type taxonomy, because `05` §1/`02` want emergent, corpus-driven vocabularies, not hard-coded lists.
  * Insertion point: **after the Materializer aggregates topics, before Synthesis/DOX** — culled topics then never get synthesized or indexed, which is where the money is saved.
* **Proposal (under discussion): one Topic Curation call per ingest — "curate-then-write".**

**Exact flow:**
1. **Aggregate (unchanged):** the Materializer groups claims by type in memory, producing candidate topics — no topic pages written yet.
2. **Build curation input:** for every candidate topic **and** every existing on-disk topic (update runs — otherwise duplicates accumulate across ingests): slug, title, folder, claim count, up to 3 sample claims (truncated ~200 chars). ~60–150 tokens per topic.
3. **LLM curation call** with a dedicated prompt grounded in `05` §7: merge = same theme under different wording/plural/form (classes 1+2); drop = not a theme/concept/issue a journalist would search for — meta-descriptors of the documents' rhetoric are not topics (class 3); keep = everything else. Output: strict JSON `{ merge: [{from: [slugs], into: slug}], drop: [slugs], keep: [slugs] }`, same `{languageDirective}` convention as the other agent prompts.
4. **Deterministic validation of the decision list:** (a) every slug mentioned exists in the input set; (b) every input slug appears in exactly one bucket; (c) every `into` is itself kept (not dropped, not merged-away); (d) no self-merges. Violations → bounded reask with the exact offending entries (Phase 12 pattern); exhaustion → **keep-all fallback** (no data loss, worst case = today's behavior).
5. **Deterministic application:** merge unions the `from` topics' claims into the `into` topic (identical claim texts deduped, title kept from `into`); drop discards the candidate (its claims remain on entity/document pages — preservation contract intact per `02` §1); only then are topic pages written and rolling memory updated. Update-mode extras: merging away or dropping an *existing* topic deletes its page/folder deterministically and re-materializes the `into` page (re-entering synthesis normally).
6. **Downstream** (content validation, synthesis, DOX, workspace index) only ever sees the curated set — which is where the money is saved.

**Link surface (verified 2026-07-23 against the produced adhd-wiki):** content pages never wikilink to topic slugs — no entity, document, or topic page links to any of the junk-topic slugs; topic links appear only in DOX index contracts, which are regenerated every run. Merge/drop therefore needs **no link rewriting**.

**Scaling — is one call enough?** (user question)
- Per-topic payload ≈ 60–150 tokens ⇒ a single call comfortably handles **~250–300 topics** (~30–40K input, ~5–8K output — well inside the ratified 32K cap). Yesterday's 57 topics is one call, ~$0.05 at mid-tier.
- Above the threshold, a **two-round scheme**: Round 1 buckets topics deterministically by lexical stems (language-agnostic; transliterated slugs) so likely duplicates share a bucket, one call per bucket (parallel-safe). Application shrinks the set (yesterday: 57 → ~30). Round 2 is a single reconciliation call over all survivors — global view catches cross-bucket duplicates. Converges because every round strictly shrinks the set; each round is independently validated with its own keep-all fallback.
- **Entities do not affect the checker at all** — it reads only topic summaries. Entity scale drives synthesis cost (L1/L4 territory), not curation.
- Cost ceiling example: 1,000 topics ≈ 100K input ≈ $0.30 at Sonnet + 1–2 reconciliation calls — still **<$1 total**, versus the ~$150+ those 1,000 topics would cost downstream in synthesis + DOX contracts if left uncurated.

* **Cost:** one call per ingest (~$0.05 at mid-tier) vs ~$8–12 saved plus root/workspace index cleanliness.

**The keep-all fallback, expanded (user-requested):**
* **What it is:** curation is skipped entirely and the Materializer writes all candidate topics exactly as it does today (pre-L3 behavior). Decisions are applied **all-or-nothing** — validation runs on the complete decision list before anything is applied, so a malformed list can never half-merge or wrongly delete anything.
* **When it triggers:** (a) the decision list fails deterministic validation after ≤3 reask attempts; (b) transient transport exhaustion (429/5xx/network after bounded retries); (c) deterministic failure (HTTP 4xx — never retried per the bounded-retry amendment; curation falls back immediately, consistent with synthesis→template and DOX→deterministic-index fallbacks).
* **What state results:** the wiki is exactly today's wiki — junk topics possible, zero data loss, no partial merges. Claims remain on entity/document pages regardless.
* **Observability:** logged like the other fallbacks — console warning, `.state` curation report entry, metrics counter.
* **Self-healing:** curation is idempotent and its input includes *existing* on-disk topics, so the next successful ingest re-curates everything — a failed curation repairs itself on the following run.

**Decisions (2026-07-23, user-ratified):**
1. **Model tier: mid (Sonnet 5 / GPT-5.6 Terra), user-settable in Settings.** Implementation adds a fifth routing slot (`curation`) with mid-tier defaults per provider, alongside extractor/synthesis/dox/default (TUI Settings + `.paper-chase.json`).
2. **Keep-all fallback: ratified** as specified above.
3. **Amendment map (full vision-doc scan, 2026-07-23):**
   * `01` §4.1 five-layer table (lines 84–92) — annotate the curation pass (one LLM call per ingest, between Layer 3 aggregation and Layer 4 synthesis); add a responsibility-table row near line 147 (topic merge/drop decisions: LLM; application: deterministic).
   * `02` — **no edit needed**; curation restores the §4.6 granularity semantics.
   * `03` — **no edit needed**; DOX describes whatever topics/ exists after curation (§3.2 dynamic sub-folders unchanged).
   * `04` — §1 pipeline sentence + diagram ("one LLM pass at the end" → plus one topic-curation call after materialization); Step 6 line 136 (group-by-type gains aggregate→curate→apply→write); Step 6/§5 rolling-memory update after curation; §6 quality-failure list gains the decision-list validation + keep-all fallback among the enumerated deterministic fallbacks; §9 — curation prompt carries `{languageDirective}`, output-language slugs (claim types become folder names, which follow the output language per `05` §2.1).
   * `05` §7 — add the explicit eligibility rule the checker enforces: a topic must be a theme/concept/issue a journalist would search for; meta-descriptors of the documents' rhetoric (statistical, temporal, methodological…) are not topics and are pruned at materialization.
   * `06` — **no edit needed**; claims/citations are regrouped, never altered.
   * `07` — §1 layered-checks list + §2 validation order gain the decision-list validation (after aggregation, before topic page writes); §5 fail-loud section enumerates the keep-all fallback. **Must also address §1 line 17's no-Critic note:** the original vision removed the LLM Critic agent ("complexity and cost without proportional reliability gains"); the curation pass is philosophically a narrow critic, and the amendment should state why it differs — one bounded structured-output call, deterministic validation, safe deterministic fallback — rather than a free-floating critic.

* **Decision:** **RATIFIED (2026-07-23)** — LLM topic-curation pass as specified: curate-then-write placement, one call per ingest with two-round scaling above ~250–300 topics, mid-tier model in a new user-settable `curation` Settings slot, keep-all fallback, amendment map as above.

### L3e — Entity curation (extension of L3, ratified 2026-07-23)

* **Evidence (rolling memory, 2026-07-23):** entity forking is rampant. ONE institution (Børne- og Ungdomspsykiatrisk Ambulatorium, Odense) exists as **9 entity pages** — `odense-boerne-ungdomspsykiatrisk-ambulatorium` (18 mentions), `odense-boerne-og-ungdomspsykiatrisk-ambulatorium` (13), `boerne-ungdomspsykiatrisk-ambulatorium-odense` (6), `boerne-og-ungdomspsykiatrisk-ambulatorium-odense` (3), `odense-bu-ambulatorium` (2), `psy-boerne-og-ungdomspsykiatrisk-ambulatorium-odense` (2), `bup-odense` (1), `boerne-ungdomspsykiatri-odense` (1), `odense-child-youth-psychiatric-clinic` (1, English translation) — **47 mentions fragmented over 9 pages and 4 different folders** (`psychiatric-departments`, `healthcare-facilities`, `clinics`, `healthcare`). Aabenraa shows the same pattern (3 variants + a distinct day-unit). Cause: the Extractor names the same thing differently across chunks (word order, dropped "og", abbreviations, language switching) and rolling-memory slug reuse doesn't catch variants it can't recognize.

* **Pipeline placement (same seam as L3 — curate-then-write):** inside Materialization, between aggregation and page-writing:
  1. Materializer reads all `.state/extracted/*.json` and aggregates per entity slug (mentions, relationships, claims, timeline) — as today, but no pages written yet.
  2. **Build curation input** for every candidate entity + every existing on-disk entity: slug, title, type, folder, mention count, significance, disambiguation, **plus 1–2 sample mention contexts (truncated)** — identity judgment needs evidence text, not just names (~250 tokens/entity ⇒ 270 entities ≈ 68K input, ~$0.20 at mid-tier; >~300 entities → L3's two-round scheme, with the caveat that translation variants don't share lexical stems, so round-2 global reconciliation is what catches them).
  3. **Entity curation call (separate from the topic call — different judgment standard, different prompt; the two can run in parallel).** Output `{ merge: [{from: [slugs], into: slug}], keep: [slugs] }`. **Merge-only — never drop.** Strict-identity rule: merge only name variants/abbreviations/translations/word-order of the SAME real-world thing; never sub-units into parents, never colocated-but-distinct things (`odense-bup-auditorium` the room ≠ the clinic; `aabenraa-bu-doegnafsnit` the day unit ≠ the ambulatorium). Optional `unsure` bucket → treated as keep (**asymmetry: a false merge is far worse than a false keep**).
  4. **Deterministic validation:** every slug exists; every slug in exactly one bucket; `into` is kept; no self-merges; merge chains resolved (union-find, so A→B, B→C collapses deterministically rather than erroring). Violations → bounded reask; exhaustion → keep-all fallback (today's behavior).
  5. **Deterministic application:** union mentions/claims/timeline into the `into` entity; rewrite `subject`/`object` slugs in all relationship records; accumulate all variant titles as `aliases`; canonical folder = the `into` folder (resolves folder drift); then normal page assembly proceeds on the merged aggregate. **Wikilink rewrite pass** across all content pages: `[[from-slug|Display]]` → `[[into-slug|Display]]`, bare `[[from-slug]]` → `[[into-slug|From Title]]` — matching the **exact target segment only** (a plain substring replace would corrupt `[[odense-bup-auditorium|…]]` when rewriting `[[odense]]`).
  6. **Update-mode rules:** an existing `from` page that was manually edited (hash mismatch, `07` preservation-first) is **skipped and logged as a conflict**, never auto-merged. Merges recorded in `.state/curation-report.json` (applied merges, skips, fallback events) for audit.
  7. Downstream (synthesis, DOX, workspace index) sees only the merged set — fewer, richer pages; stub count drops as duplicate stubs combine.

* **Risks (honest assessment of the proposal's own weaknesses):**
  1. **Wrong merge (false positive) — the cardinal risk.** Merging two DISTINCT entities interleaves their evidence on one page — the only lever in this package where an LLM error silently *corrupts durable content* rather than wasting money. Counterweights: strict-identity prompt with evidence samples; `unsure`→keep asymmetry; merge-only monotonicity; audit report. **Full reversibility:** `.state/extracted/*.json` is immutable per-chunk truth, so any merge can be undone by re-materializing without it — curation never touches the source of truth.
  2. **Sticky errors / no un-merge path.** Merge-only prevents oscillation but makes wrong merges permanent within the run's output. Proposed mitigation (open item): a human-editable `.state/curation-overrides.json` (never-merge pairs) honored by the checker on subsequent runs.
  3. **Judgment without evidence would be unreliable** — names alone can't separate a day-unit from a clinic; hence sample mention contexts in the input (costs more input tokens; accepted).
  4. **Link-rewrite edge cases:** bare vs pipe-form links, prefix-slug collisions (exact-segment matching required), links inside document pages (covered by the all-content-pages pass). Mechanical but must be exact.
  5. **Language-crossing variants** (`odense-child-youth-psychiatric-clinic`) evade lexical bucketing in the >300 scaling path — reconciled only in the global round; if the set never triggers round 2 in bucketed mode, some survive. Accepted residual.
  6. **Chain/cascade merges** — handled by union-find in validation; noted so it isn't implemented as reject-and-reask, which would loop on legitimate chains.
  7. **Mid-tier judgment variance** — merge decisions may differ run to run; monotonic merge-only + recorded decisions keep the wiki convergent rather than oscillating.

* **Compliance:** honors `02` §4.6 ("one entity = one page" — merging variants *restores* it); aliases preserve findability (`05` §2); folded into the same vision amendment as L3 (`04` Step 6 gains entity curation; `05` §6 gains the identity rule; `07` validation lists it; `01` §4.1 same annotation).
* **Cost:** ~$0.15–0.20 per run at 270 entities; saves duplicate synthesis/DOX spend; primary win is page richness (user's stated goal).
* **Decision:** **RATIFIED (2026-07-23) — risks accepted by the user.** As specified: merge-only (never drop), strict-identity prompt with 1–2 sample mention contexts per entity, `unsure`→keep asymmetry, union-find chain resolution, exact-segment wikilink rewrite, manual-edit skip + `.state/curation-report.json` audit, human-editable `.state/curation-overrides.json` never-merge list, keep-all fallback, full reversibility via immutable `.state/extracted/*.json`, mid-tier model via the same `curation` Settings slot as L3. Accepted residual risks: R2 (no un-merge UX beyond overrides + re-materialization), R3 (translation variants in bucketed mode), R4 (run-to-run merge variance), R6 (sub-unit traps) — mitigated, not eliminated.

### L4 — Stub-entity templating (≤2 mentions skip LLM synthesis)

* **The initially discovered issue (post-mortem, 2026-07-23):** the Extractor is exhaustive — 5 PDFs produced 270 entities, and 132 of them (49%) have ≤2 mentions (78 with one, 54 with two). Under the old pipeline every one of them received the full treatment: a Sonnet synthesis call + preservation validation + potential retries, sequentially (~40s each). Costs by bucket: 1-mention $2.96, 2-mention $3.11 — **$6.07 total, ~1.5–2 hours of wall time**. Worse than the cost was the quality trap: the old prompt forced ≥300 words of Layer 1 onto a 1-mention entity — an engraved invitation to hallucinate padding — while the pages themselves diluted the wiki (half the entity tree is stubs, inflating folders, DOX contracts, and indexes).
* **What the ratifications already fixed:**
  * **L1b (sparse honesty + `sparse` flag) killed the quality issue.** Stubs now get a few honest sentences ("mentioned once… no further details are available") instead of forced padding — arguably the *best* possible stub page, and one no template can beat. The `sparse: true` flag (ratified in the L1b package) makes them identifiable in Obsidian.
  * **L1 (caps) is neutral for stubs** — they were never truncated; they were already cheap (~$0.04 avg) and mostly first-attempt passes. The retry storms lived on dense pages, not stubs.
  * **L2 (mid-tier DOX)** marginally cheapens the folder contracts stubs sit in. **L3** is topic-side, no effect.
* **What remains unfixed:** (a) **wall time** — ~132 sequential calls ≈ ~1–1.5h, though L5 concurrency absorbs most of this (stubs share the worker pool; total run drops to ~1.5–2h regardless); (b) **~$6/run** — negligible; (c) **clutter preference** — half the entity tree is thin pages. But the vision *wants* them: `02` §1 ("every extracted detail on at least one page") + §4.6 ("one entity = one page") + the Journalist-search use case (a name mentioned once must still be findable with its context). Deleting stubs would violate canon; templating them keeps findability but discards the honest-context prose L1b just bought.
* **The remaining decision space:** (a) **reject L4 entirely** — stubs keep L1b sparse prose; cost/time absorbed by L5; (b) **reduce to 1-mention only** (78 pages, ~$3, ~45 min saved) — loses prose on exactly the pages where one sentence of context helps most; (c) **keep as designed** (≤2 mentions → template) — now contradicts the ratified sparse philosophy.
* **Decision (2026-07-23): REJECTED (Option A ratified).** All entities keep LLM synthesis regardless of mention count. Rationale: L1b's sparse honesty + `sparse: true` flag solved the stub quality problem better than templating; cost was always trivial (~$6/run); wall time is absorbed by L5; vision `02` §1/§4.6 requires every entity findable with context; L3e shrinks the stub count organically by merging duplicate stubs into richer pages. The lever is closed — no threshold routing, no templating change.

### L5 — Concurrency in the synthesis/DOX loops

* **Evidence:** `src/commands/ingest.ts:744,827` — sequential `for…of` awaits; 1,017 calls × ~40s ≈ 11 h wall time.
* **Proposal:** bounded worker pool (4–6 parallel) for entity synthesis, topic synthesis, and DOX folder contracts; serialize `llm-calls.json` appends; keep per-page ordering deterministic in reports.
* **Projected saving:** no cost change; wall time 11 h → ~2.5–3.5 h (→ ~1.5–2 h combined with L1's call-count reduction).
* **Trade-offs / open questions:** rate-limit/backoff interplay (429 retry machinery already exists); TUI progress reporting must aggregate workers; `synthesis-report.json`/`conflicts.json` writes need serialization; per-page independence makes this safe in principle — pages do not read each other.
* **Decision (2026-07-23): RATIFIED with user-narrowed scope.** Parallelize **only entity synthesis and topic synthesis** — a bounded worker pool with a hard cap of **4 concurrent calls** (fixed, not a Settings field). DOX contracts, extraction, curation, workspace index, and updater all stay sequential: DOX because bottom-up level dependencies make intra-level parallelism the only safe shape and the user prefers it sequential; extraction because parallel chunks lose rolling-memory cross-chunk context (more entity forking → more L3e merge risk). Design constraints carried into implementation: shared state files (`llm-calls.json`, `synthesis-report.json`, `conflicts.json`) funnel through a single serialized writer; reports collected and written in original page order (deterministic, diff-friendly output); per-page fallback semantics unchanged (each page independently strict→permissive→template); TUI progress becomes an aggregate counter ("142/338 pages, 4 workers"). Rate-limit note: existing 429/backoff machinery handles pool pressure at cap 4.

## 3. Projection with the ratified package applied (same 5 PDFs)

| Scenario | Cost | Wall time |
|---|---|---|
| As-run (2026-07-23) | $144.95 | ~11 h |
| **Ratified package — L1+L1b+L2+L3+L3e+L5 (L4 rejected)** | **~$45–55** | **~2.5–3.5 h** |

Breakdown of the projection: extraction $2.88 / 44 min (unchanged, sequential); curation ~$0.25 / ~2 min (2 parallel calls); entity synthesis ~$25–30 / ~45–60 min (~235–270 pages post-merge, ×4 pool, few retries under the 32K cap); topic synthesis ~$3 / ~8 min (~30 curated topics, ×4 pool); DOX ~$10–15 / ~50–60 min (mid-tier per L2, 8192 cap, sequential per L5 scope); workspace+updater ~$0.10. Quality also improves: the 45 template fallbacks become real synthesized pages, forked entities merge into rich pages, junk topics disappear.

## 4. Decision log

| Date | Lever | Decision | Rationale | Promoted to canon |
|---|---|---|---|---|
| 2026-07-23 | L1 | **Ratified**: synthesis 8192→32768, DOX 2048→8192, no per-language split | Caps are safety ceilings, not length controllers; retry limits already bound spend; extractor's 16384 cap had zero retries | **PROMOTED 2026-07-23** — `04` §6 + `07` §5 (output-token ceilings notes); code change in Phase 13. **Amended 2026-07-24** (user-ratified): Extractor 16384→32768 after the live test run proved a dense chunk's JSON structurally exceeds 16384 (adhd-2024-part-013 — 3 reask attempts truncated at the cap, fail-loud; the "zero retries in 61 calls" calibration was boundary luck, not headroom) |
| 2026-07-23 | L2 | **Ratified as SETTINGS GUIDANCE** (no code/default change; user flips the TUI slot): DOX Writer → mid-tier — Sonnet 5 (Anthropic) / GPT-5.6 Terra (OpenAI); full four-slot guidance table in L2 section | DOX contracts are structural navigation with deterministically re-imposed correctness; premium tier (+66%/+100% token price) bought nothing — 93% of Opus calls truncated anyway | **PROMOTED 2026-07-23** — no canon edit by design (settings guidance; recorded as root AGENTS.md preference 2026-07-23 "Model-routing guidance revised"); TUI inline label update in Phase 13 |
| 2026-07-23 | L1b | **Ratified** (user directive, wording approved verbatim): remove ALL word counts (floor+ceiling) from the 4 synthesis prompts; replace with quality-based self-sizing block (text in L1b section). Package includes: DOX `## Pages` catalog-line quality rule; `sparse: true` frontmatter flag implementation (vision `02` §4.8) | Word counts are a double-edged sword: floors force hallucination on thin pages, ceilings force detail loss on dense pages. Restores canon fidelity to `02` §4.7/§4.8 (prompts had distorted the vision's layer-scoped targets) | **PROMOTED 2026-07-23** — `05` §2 (sparse frontmatter field); `02` needed no edit (§4.7/§4.8 already quality-based); prompt + code changes in Phase 13. **Extended 2026-07-24** (user-ratified, same doctrine): the residual "2-4 paragraphs" Layer-1 floor removed from `templates/AGENTS.md`, all four synthesis prompts' Layer-1 format lines, `extractor.prompt.txt`, and `05` §7.2; existing wikis' constitutions patched to match |
| 2026-07-23 | L3 | **Ratified**: LLM topic-curation pass (curate-then-write, one call/ingest, two-round scaling >~300 topics, mid-tier in new user-settable `curation` Settings slot, keep-all fallback) | Topics are unconstrained claim types (`04` Step 6 + `topic-page.ts:51`) — LLM checker enforces `05` §7 semantics; preservation safe (claims live on entity/document pages); no link-rewrite surface (verified) | **PROMOTED 2026-07-23** — `01` §4.1+§5, `04` §1+Step 6+§6+§9.4, `05` §7, `07` §1+§2.3+§5 (`02`/`03`/`06` untouched); implementation in Phase 14 |
| 2026-07-23 | L3e | **Ratified — risks accepted**: entity curation (merge-only, strict-identity + evidence samples, unsure→keep, union-find, exact-segment link rewrite, manual-edit skip, curation-report audit, curation-overrides never-merge list, same `curation` slot) | Entity forking splits one real-world thing across pages (Odense clinic: 9 pages/47 mentions/4 folders); merging restores `02` §4.6 and produces fewer, richer pages; reversibility via immutable extracted JSON | **PROMOTED 2026-07-23** — same pass (`04` Step 6, `05` §6+§2, `07` §2.3+§5, `01` §4.1+§5); implementation in Phase 14 |
| 2026-07-23 | L4 | **REJECTED** — all entities keep LLM synthesis regardless of mention count | L1b sparse honesty + `sparse` flag solved stub quality better than templating; cost trivial (~$6); time absorbed by L5; vision `02` §1/§4.6 wants every entity findable; L3e shrinks stubs organically | n/a — no canon or code change |
| 2026-07-23 | L5 | **Ratified with user-narrowed scope**: parallelize ONLY entity+topic synthesis, hard cap 4 concurrent calls (fixed) | Sequential `for…of` awaits made wall time = Σ(call latencies); pages are independent; DOX/extraction stay sequential (level dependencies; rolling-memory context) | **PROMOTED 2026-07-23** — `04` §1 (concurrency note); implementation in Phase 15 |

## 5. Evidence appendix

* `dist/wikis/adhd-wiki/.state/llm-calls.json` — 1,017 JSONL call records (timestamp, callType, context, model, tokens, cost)
* `dist/wikis/adhd-wiki/.state/synthesis-report.json` — 327 page outcomes (strict/permissive/fallback + attempt counts)
* `dist/wikis/adhd-wiki/.state/conflicts.json` — dropped citations/mentions from preservation checks (429 KB)
* `dist/wikis/adhd-wiki/.state/rolling-memory.json` — entity mention counts
* Caps: `src/agents/synthesis.ts:211,241,267,293` (8192), `src/dox-writer.ts:167` (2048), `src/agents/extractor.ts:95` (16384)
* Prices: `src/llm/client.ts:32-40`; retry driver: `src/commands/ingest.ts:242` (`SYNTHESIS_MAX_ATTEMPTS = 3`), `:744-891` (strict→permissive→template)
* Model routing config: `dist/.paper-chase.json` (gitignored; contains API keys — never commit, never quote)
