# Paper Chase — Backlog

**Document ID:** `LLM-WIKI-CLI-IMPL-BACKLOG`
**Version:** 1.0.0
**Status:** Living
**Date:** 2026-07-25

Open issues, accepted residuals, and future tracks. Entries are **not** scheduled phases: each records the mechanism, the evidence, and the fix direction. When an item is scheduled, it moves into a `PHASE_XX_<slug>.md` doc and is struck through here with the phase reference.

---

## Near-term fixes (Phase 17 candidates)

B1–B3 are validation-noise classes found by the 2026-07-25 live test run (run 5) and share one theme: LLM-written output is trusted where a deterministic re-imposition already exists for sibling fields.

### ~~B5. Curation judgment variance across passes/runs — HIGH PRIORITY~~ — FIXED 2026-07-29, implemented + independently verified (9/9 gates): [PHASE_21](PHASE_21_curation_overhaul.md)

- **Mechanism:** per-ingest curation passes can disagree (run 5: pass 1 merged `clinical-assessment → clinical`, pass 2 did not, and the materializer re-created the topic from the unchanged extraction data). Merge-only entity monotonicity holds within a run, but merge/drop judgments oscillate across passes/runs; the "self-healing" property assumes stable judgments.
- **Cost evidence (2026-07-28/29, three consecutive runs):** afdk main run curated one way; the afdk repair run's curation made 46 further merge/drop decisions → 54 pages re-synthesized → a planned ~$0.30 follow-up cost **$41.44**. The akdb DOX-refresh run's curation made 45 more (27 entity + 18 topic) → 28 pages re-synthesized → **$19.88** instead of ~$6. ≈$60 of the day's $163 traces to re-judged identities. The merges were *correct* each time (`lpr → landspatientregisteret`, registry name-variants unified) — the wiki improves every pass, but the same discovery is paid for repeatedly at full synthesis price.
- **Fix direction:** sticky decisions — record each run's merges as constraints the next curation pass must honor (like auto-recorded overrides alongside `curation-overrides.json`), so a merge is paid for once and later passes build on it instead of re-deciding it. Alternative: one end-of-run curation pass (removes intra-run variance; restructures the materialize flow). Priority rationale: it fired on all three runs in one day and is the single biggest avoidable cost driver observed.

### ~~B1. Post-synthesis pages are trusted for citation definitions and frontmatter (`missingSource` + schema flags)~~ — FIXED 2026-07-28: [PHASE_17](PHASE_17_entity_graph_and_citation_integrity.md) §2.4-§2.6 (gates 17.8-17.11 + §2.6 supplementary)

- **Root cause (mechanism corrected 2026-07-28):** a passing synthesis page REPLACES the deterministic page wholesale (`src/commands/ingest.ts:1032-1039` strict, `1069-1074` permissive); the only deterministic post-processing is `enforceAliasesInMarkdown` + `enforceSparseInMarkdown`, and both no-op when the model omitted the frontmatter block entirely (`src/pages/entity-page.ts:109-116`: "never invents a frontmatter block"). `title`/`type`/`wiki`/`updated`/`sources` are never re-imposed; the `## Sources` definition format is never normalized.
- **Defect A — `missingSource` flags (NOT a frontmatter issue):** the citation checker never reads frontmatter — it parses body definitions, takes the text before the first comma as the filename, and requires it under `wikis/<slug>/raw/` (`src/validation/citation-checker.ts:53-58, 107-118`). The deterministic template writes basename-only definitions (`entity-page.ts:272`); the LLM freely writes either form — basename (`adhd-foreningen.md`, 0 flags) or full workspace path copied from the mention annotations (`trish-nymark.md`: `[^src1]: wikis/rkkp-adhd/raw/ADHD_2023.pdf, …` → joined under `raw/` → nonexistent → 2 flags).
- **Defect B — frontmatter absent or untrusted:** a large share of synthesized pages have no frontmatter at all (title/type/updated/aliases/sparse/sources all missing); where LLM frontmatter exists, nothing verifies its `sources` cover the body citation keys, and `updated` may be the constitution's example date (B2).
- **Evidence (run 5 report, `dist/wikis/rkkp-adhd/.state/validation-report.json`):** 176 `missingSource` flags across 53 pages (all Defect A); 315 `schema.invalid` flags — 161 missing/invalid `updated`, 77 missing `title`, 77 missing `type` (the 77 = pages with no frontmatter at all, entities+topics). 2026-07-28 audit: 53 of 119 entity pages have no frontmatter; `adhd-foreningen.md` (textbook `02` §4.8 sparse case) has no `sparse` flag. Earlier observation stands: `region-hovedstaden.md` has 2 frontmatter `sources` entries for 22 body keys (Defect B — unmeasured by any validator).
- **Fix direction:** one deterministic post-synthesis pass for entity and topic pages: (1) `enforceFrontmatterInMarkdown(page, pageData)` — write the complete frontmatter from the deterministic page data (title, type, wiki, real `updated` — carries B2's fix — aliases, sparse, and the full aggregated `sources` list via the existing `sourceRanges` logic at `entity-page.ts:277-299`), creating the block when absent; (2) rebuild the `## Sources` definitions deterministically from `buildCitationMap` + `sourceFileName` (basename + page ranges), keeping the model's in-prose markers; (3) optional hardening: a body-keys-vs-frontmatter-sources consistency check in the citation checker, meaningful once re-imposition guarantees the map exists.

### ~~B2. Synthesized pages can carry the constitution's example `updated` date~~ — FIXED 2026-07-28: [PHASE_17](PHASE_17_entity_graph_and_citation_integrity.md) §2.4 (gate 17.8 — `updated` is always the real write time)

- **Mechanism:** same un-re-imposed frontmatter — the model copies the wiki constitution's *example* frontmatter (`updated: "2026-07-17T10:00:00Z"`).
- **Evidence:** 64 of 159 pages in run 5 carry that exact example date.
- **Fix direction:** same pass as B1 — always re-impose `updated` with the real write time. (See B1's 2026-07-28 evidence: the example-date pages are the LLM-frontmatter half of a class whose other half is pages with no frontmatter at all.)

### ~~B3. DOX folder catalogs can self-link the index instead of the page (orphaned topics)~~ — FIXED 2026-07-25

- **Mechanism:** on folders where page title == folder title (every claim-type topic folder), the DOX model sometimes writes the `## Pages` catalog entry pointing at the folder's own `index` instead of the page; the link *resolves*, so the wikilink repair keeps it, and the page gets zero incoming links (flagged orphaned).
- **Evidence:** run 5, 10 orphaned topics — e.g. `topics/database-expansion/index.md` catalogs `[[topics/database-expansion/index|Database Expansion]]`, never `[[database-expansion|Database Expansion]]`.
- **Fix direction:** extend the DOX deterministic enforcement (already re-imposes children/statistics) to re-impose page-catalog targets: every direct page must appear in `## Pages` with its canonical basename link; a self-index link in a `## Pages` entry fails validation and reasks.
- **Resolution (2026-07-25, unscheduled — user-reported on `dist/wikis/rkkp-adhd`):** fixed exactly per the fix direction, plus the sibling defect found in the same audit (the wiki-root index catalogued only curated `## Start Here` picks, leaving `entities/index` and `topics/index` unlinked). The DOX enforcement now requires every supplied catalog target (direct pages + child-folder indexes, the root's four top-area indexes included) to appear as a wikilink target in the body and bans self-referential index links — both are content defects fed back by the Phase 12 reask loop before the (fully-catalogued) deterministic fallback; the root body gains a complete `## Pages` catalog alongside the curated Start Here (prompt, deterministic body, and wiki-level example updated). Gates 6.17a–6.17d.

### ~~B10. Relationships are single-direction: the object page never shows them (user-directed, 2026-07-28)~~ — FIXED 2026-07-28: [PHASE_17](PHASE_17_entity_graph_and_citation_integrity.md) §2.1 (gates 17.1-17.4)

- **Mechanism:** the Materializer attaches each extracted relationship only to the *subject* entity's page data (`entityMap.get(relationship.subject)`, `src/materializer.ts:662-670`); the object entity's `relationships` slot stays empty unless it is itself the subject of another relationship. The synthesis prompt then receives `Relationships: (none)`, so the Synthesis Writer writes "No specific relationships…" and cannot even name the related party — the relationship is absent from the object page's entire context. Compounded by first-significance-wins (`src/materializer.ts:638`): a later chunk's significance naming the related party is discarded.
- **Evidence:** `dist/wikis/rkkp-adhd/entities/organizations/patient-organizations/adhd-foreningen.md` shows `## Relationships (none)` and never names Trish Nymark, the association's chair — while `entities/people/patient-advocates/trish-nymark.md` carries both `trish-nymark — is-chair-of → adhd-foreningen` relationships (2023 p. 41, 2024 p. 61) with verbatim evidence. Found 2026-07-28 during an article-context walkthrough of the run-5 wiki.
- **Fix direction:** make relationships bi-directional in the materialized page data — index each relationship on the object page too (as incoming), render incoming relationships in the object's `## Relationships` section with direction made explicit, and feed them to the synthesis slot so Layer 1 can name the related party with citation. Design care: the Phase 12 preservation validator compares Layer 2 against the supplied data, so the data shape, prompt, and validator must move together; incoming relationships also give the object page a real incoming-wikilink path (less orphan noise).

### B11. Bare-slug wikilinks are ambiguous in the single-vault workspace

- **Mechanism:** entity/topic pages link by bare slug (`[[region-hovedstaden|…]]`), and `wikis/` is designed to open as one Obsidian vault (vision `03` §6: "every link resolves"). Obsidian resolves duplicate basenames by shortest path — with `.obsidian/app.json` empty (default resolution), a link written in one wiki can silently resolve to another wiki's page.
- **Evidence:** 2026-07-28 audit of `dist/wikis`: ~60 page basenames exist in 2–4 wikis (all five regions in all four wikis, ~25 hospitals, ~15 topics incl. `indikator-5`); `.obsidian/app.json` is `{}`.
- **Fix direction (needs a design decision):** wiki-qualify link targets that exist in more than one wiki (path-form links or shortest-unique-path), or pin Obsidian link resolution in the generated `.obsidian` config; the wikilink validator/repair must then check uniqueness vault-wide, not per-wiki.

### ~~B12. No outgoing-link validation: synthesized entity pages can be islands (pairs with B10)~~ — FIXED 2026-07-28: [PHASE_17](PHASE_17_entity_graph_and_citation_integrity.md) §2.2-§2.3 (gates 17.5-17.7)

- **Mechanism:** vision `02` §2 requires "No page is an island unless it is an index or source page" and `02` §4.2 C expects cross-reference context with working links; but the synthesis input carries no entity slugs beyond the page's own (chunk contexts are slug-less prose; relationships/claims slots are often `(none)`), so the model cannot form wikilinks (prompt rule: the target must be "the entity's slug from the data above"). Validation (`07` §2.5) checks only incoming links (orphans) — outgoing-link absence is never measured.
- **Evidence:** 2026-07-28: `dist/wikis/rkkp-adhd/entities/organizations/patient-organizations/adhd-foreningen.md` names ADHD-databasen and Sundhedsvæsenets Kvalitetsinstitut in prose but contains zero wikilinks, and passes all checks (one incoming link saves it from the orphan list).
- **Fix direction:** supply linkable slugs with the synthesis context (a related-entities slug list resolved from same-chunk entities), and add an outgoing-link check to the validation report (zero-outgoing content pages flagged, like orphans).

### B13. Name variants merged at slug level never reach `aliases`

- **Mechanism:** `aliases` accumulate only from curation merges; name variants that slugify identically merge in the Materializer before curation runs (first name wins, `src/materializer.ts:638-645`), so the losing variant is recorded nowhere — Obsidian alias search cannot find the page by that name.
- **Evidence:** 2026-07-28: "ADHD-foreningen" (2024 report, hyphenated) is not an alias of `adhd-foreningen.md`; the variant survives only inside a Layer-2 mention quote.
- **Fix direction (small):** when a merged entity record's name differs from the canonical first-wins name, append the variant to the page's `aliases` during materialization (the same field curation already maintains).

### B15. First-wins on name/significance/disambiguation silently discards later extractor data

- **Mechanism:** vision `03` §3.2 specifies only first-*folder*-wins; the Materializer additionally applies first-wins to the entity's display name, `significance`, and `disambiguation` (`src/materializer.ts:638-645`). Later chunks' variants of these fields are dropped with no record anywhere — significance and disambiguation are extractor prose, not Layer-2 items, so the preservation check never sees them. In tension with `01` Principle 3 ("no detail is lost").
- **Evidence:** 2026-07-28 (`dist/wikis/rkkp-adhd`): the 2024 chunk's significance for `adhd-foreningen` ("Patientorganisation repræsenteret i styregruppens arbejde gennem formand Trish Nymark.") was discarded in favor of the 2023 record — the only extracted sentence naming the entity's chair. The same rule picks the canonical display name (feeding B13's alias gap) and, applied independently per wiki, produces opposite canonical choices across wikis ("LPR" in rkkp-adhd vs "Landspatientregisteret" in rkkp-akdb — B14's canonical-name fork).
- **Fix direction:** replace first-wins with update-aware rules — prefer the record with richer evidence (or concatenate differing significances), let later disambiguation fill an empty slot, and record losing name variants in `aliases` (B13's fix covers the alias side). Interacts with B10 (the discarded text may name related parties) and B14 (cross-wiki canonical forks). Note: a significance/disambiguation change alters the page's aggregate fingerprint, so affected pages re-synthesize once under the existing synthesis-resume rule.

### ~~B18. The synthesis model is never shown the deterministic citation numbering~~ — FIXED 2026-07-29, user-accepted: [PHASE_18](PHASE_18_citation_numbering_alignment.md)

- **Mechanism:** the deterministic citation map assigns `[^srcN]` keys by order of first appearance in a page's evidence, but the synthesis prompt never shows that map to the model — so the model improvises markers. The preservation check pins only that deterministic keys *appear*; extra model-invented markers sail through and dangle (no definition, no frontmatter coverage). Also a contributor to the ~30% reask rate.
- **Evidence:** 2026-07-28/29 live runs: 33 dangling markers on ~13 afdk topic pages, 19 in akdb — every one caught by the Phase 17 §2.6 consistency check (`invalid`/`missingFrontmatterSource`). Predicted by the Phase 17 Verifier (design note g).
- **Fix direction:** show the model the deterministic citation map in the synthesis prompts (all four synthesis templates); make extra/off-map markers a content defect fed into the Phase 12 reask loop.

### ~~B19. Stale `pageHashes` make the manual-edit guard false-flag tool-written pages~~ — FIXED 2026-07-29, user-accepted: [PHASE_19](PHASE_19_stale_pagehash_convergence.md)

- **Mechanism:** the Phase 8 manual-edit guard compares each page's on-disk hash against the recorded hash in `.state/ingestion.json`; for 8 afdk topic pages the recorded hash did not match the pipeline's own final write, so the guard treated tool output as a human edit and refused to update the pages — self-perpetuating until repaired by hand (keys deleted 2026-07-28). Root-cause stage not yet located (candidates: end-of-run re-hash coverage, per-PDF checkpoint ordering, curation link-rewrite folding). Normally masked by the Phase 16 skip-eligibility/preservedPages convergence; exposed when `synthesis-state.json` is absent.
- **Evidence:** 2026-07-28 afdk re-ingest: 8 topic pages conflict-skipped with disk≠recorded (3 template + 5 strict pages); akdb showed 0 — the leak is stage/content-specific, not universal.
- **Fix direction:** locate the leak with a failing-test reproduction first; make the leaking stage fold hashes; add a hash-consistency invariant (after any ingest, every tool-written content page's recorded hash equals its disk hash); add a safe convergence path so a provably tool-written page converges instead of false-flagging.

### ~~B20. Model wikilinks use near-miss slugs; broken links are reported but never repaired~~ — FIXED 2026-07-29, user-accepted: [PHASE_20](PHASE_20_wikilink_repair.md)

- **Mechanism:** the synthesis model writes wikilinks to slugs that almost exist (`[[indikator-2]]` vs the real `indikator-2-ekkokardiografi`); the link checker reports broken links but nothing repairs them. The `relatedEntities` slot (Phase 17) gives exact slugs, but the model still paraphrases.
- **Evidence:** 2026-07-28/29 live runs: 12 broken links in afdk, 6 in akdb — all short-form/paraphrased variants of real indicator/topic slugs.
- **Fix direction:** deterministic repair pass — unique-prefix and alias matching against the wiki's slug set at the synthesis write points; ambiguous targets stay broken and reported. Includes a one-time remediation over the current `dist/wikis` (repairs existing broken links AND re-converges `pageHashes` for every modified page so the fix cannot create B19-class false-flags). User-directed: the existing links must be fixed by the tool, not by hand.

---

## Accepted residuals (watch items)

### B4. Pathological-dense pages degrade to the structured template

- **Mechanism:** the very densest pages (`adhd-databasen`, `indikator-3`, `topic performance`) carry a Layer-2 payload that structurally exceeds the 32768 output ceiling, so strict and permissive synthesis cannot fit and the page keeps the deterministic template (bounded ~$0.65/page).
- **Options:** (A) accept — data is complete, ~2% of pages (current); (B) sub-page splitting, vision `02` §4.7's own remedy — split by source/period with an index (Phase-18-sized); (C) evidence excerpting (L6 in `Project Vision/optimizations/optimizations.md`) — biggest canon surgery.
- **Decision trigger:** revisit after the full-corpus run shows how many pages land in this bucket.


---

## Housekeeping

### B6. Packaged exe staleness

- `dist/paper-chase.exe` embeds the code it was built from (2026-07-23, pre-Phase-13). Rebuild with `npm run package:win` after any pipeline change intended for exe use.

### B7. With-key suite profile before release

- All phase budgets were $0; the live-gated tests (Phase 2 live gates, gate 0.4, e2e) have not been re-run since Phase 11 v1.6.0. Run once with `ANTHROPIC_API_KEY` loaded (and `RUN_E2E=1` for the full e2e) before any release.

### B9. Wiki display title is slug-derived, not the init title

- **Mechanism:** the DOX Writer derives the wiki root `index.md` title (and the workspace catalog display name + workspace prose) as `titleCase(slug)` (`src/dox-writer.ts:344,798`) — the `--title` given at `init` lives only in the constitution's H1 and is never read back. `rkkp-adhd` renders as "Rkkp Adhd" where the user named it "RKKP ADHD" (same behavior as "Adhd Wiki").
- **Fix direction (small, needs a design decision):** read the display title from the constitution H1 when present, falling back to `titleCase(slug)` — noting that `init` defaults the title to the raw slug, so the fallback rule needs care (slug-looking H1 → titleCase it?). Update the DOX root-index gates accordingly.

---

## Future tracks

### B8. Multi-format ingestion (user-directed, 2026-07-25)

Today Layer 1 is PDF-text-only (`pdfjs-dist`). The user wants ingestion to grow to:

- **DOCX** — Word documents (parse to markdown; same chunk → Extract → Materialize pipeline downstream).
- **Non-text / scanned PDFs** — pages where `pdfjs-dist` extracts nothing (today they become `raw` placeholder pages); needs an OCR or vision-LLM extraction path so scanned pages yield real content.
- **Images** — standalone image files (photos of documents, screenshots) via the same vision path.

Design notes for when this is scheduled: it is a Layer-1 concern with downstream ripple (chunk identity, source-page provenance per format, and the vision-language rule — scanned text becomes "extracted text" that must stay verbatim in Layer 2); a vision-LLM extraction path is a new call type with its own routing-slot question; the frozen Phase 0 extraction surface (`extractText` signature) must stay additive. Start from `Project Vision/06_citation_and_provenance.md` (provenance per format) and `01` §4.4 (chunking) before writing a phase doc.

### ~~B21. Comparison-table articles~~ — FIXED 2026-07-29, implemented + independently verified (8/8 gates): [PHASE_23](PHASE_23_comparison_articles.md)

The PDFs contain structured comparison tables (e.g. national/region/hospital rows × indicator performance, with standard-met flags, confidence intervals, and multi-year columns). Their data reaches the wiki only dissolved: atomic claims on entity pages + synthesized prose on topic pages (good, keep it) — but the complete, scannable table exists nowhere as an independent article (only inside raw document-chunk dumps). The user wants such tables to become independent articles AUTOMATICALLY whenever a corpus contains them — never hard-coded to a specific PDF structure.

- **Evidence (verified 2026-07-29, `dist/wikis/rkkp-afdk`):** `documents/afdk-2023-part-004.md` holds a full indicator table (Danmark 79.2% / Hovedstaden 70.9% / Sjælland 75.9% / Syddanmark 82.2% / Midtjylland 88.5% / Nordjylland 78.7% + per-hospital rows + 2020/21–2022/23 columns); the extractor dissolved it into 36 atomic claims (`clinical-performance`, per region/hospital); the topic page narrates the leaders/laggards but no page carries the table.
- **Design notes:** (1) Extractor gains a generic `tables` output array (title, page, dimensions, entities mentioned, verbatim table markdown, summary) — corpus-driven detection inside the existing call; schema validation extends. (2) New `comparison` page type via the vision `05` §9 custom-type extension point — recommended top-level `comparisons/` folder (extends `03` §3.1; alternative `topics/comparisons/` if no structural amendment is wanted). (3) One article per comparison SUBJECT accumulating the same table across sources/years (compounding — `01` Principle 3), slug from the subject; the deterministic shell preserves the table markdown verbatim (preservation-checked), `## Sources` per chunk. (4) New comparison synthesis prompt — generic comparison language (leaders/trailers, standard met/not, trends, outliers), carrying the Phase 7 `{languageDirective}` and Phase 18 `{citationMap}` slots; NOT RKKP-specific. (5) Surfaces: extractor prompt + `extractor-schema.ts`, new `src/pages/comparison-page.ts` + writer + materialize assembly, `prompts/comparison.prompt.txt`, schema/link/citation validators, DOX folder index in the bottom-up chain, `templates/AGENTS.md` documents the new type per `05` §9. (6) TUI unchanged (Obsidian browsing per the five-item menu preference).
- **Sequencing:** independent of Phase 21 (sticky curation); shares page-kind machinery with Option C composites — a self-contained phase after Phase 21 (Phase 22/23 candidate).
- **Open decisions (user):** folder placement (`comparisons/` vs `topics/comparisons/`); article identity (per-subject accumulating years — recommended — vs per-source-table); extractor-emitted detection (recommended) vs deterministic Layer-1 table detection (fragile on pdfjs text layout).

### ~~B22. Composite pages — rich multi-entity articles for logically-mapped entities~~ — FIXED 2026-07-29, implemented + independently verified (10/10 gates): [PHASE_22](PHASE_22_composite_pages.md)

- **User directive (2026-07-29):** "I would rather the end-articles are longer, more detailed, more rich… I don't mind that a wiki article covers several entities if the entities logically map to each other." Contradicts vision `02` §4.6 (one entity = one page) and `05` §6 (strict-identity merges only) — user-resolved as a ratified-class amendment recorded in the Phase 22 doc and compliance-log [2026-07-29 12:30].
- **Design (Option C from the 2026-07-29 exploration):** the graph stays entity-granular (relationships, extraction, identity); pages become cluster-granular within five checkable rollup classes — abbreviation/name-variant (already legal), brand↔generic substance, indicator↔measured-concept (1:1), facility↔city when the facility is the city's story, same-name different-type (org↔location). Member cap 2-4; sticky cluster records (Phase 21 machinery) prevent member-page oscillation; manual `splits` escape hatch; out-of-class clusters are validation errors. Member-tagged evidence union on one page (`type: composite`), aliases union so every member name finds the page, one rich Layer-1 article, per-member Layer 2 groups.
- **Evidence from live runs:** `eliquis→apixaban` brand↔generic merges (afdk), `indikator-N`↔concept merges (akdb), region name-forms ×3 (all wikis), and four hospital→city merges that were canon-violations under strict identity but legitimate rollups under the user's rule.
- **Honest tensions recorded:** composites push pages toward the 32768 output ceiling (B4 territory — mitigated by the 2-4 cap); over-clustering pressure (answered by class validation); composite-vs-topic boundary (composites cluster named real-world things; topics stay claim-type themes); largest single change since Phase 3.

### B14. Cross-wiki identity surface (user-directed, 2026-07-28)

The user's stated end-use: connect several wikis via `index-of-indexes.md` to find cross-wiki entity connections. The vision defers connection-finding to the journalist or a research agent (`01` §7, non-goal) — but the identity substrate that agent would match on forks per wiki, and nothing ever reconciles it.

- **Observed divergence of the same real-world entity across the four RKKP wikis** (2026-07-28 audit of `dist/wikis`, ~60 shared page basenames; all four wikis en-output/da-input, so this is pure per-wiki LLM variance): slug fork (`lpr` in rkkp-adhd vs `landspatientregisteret` in rkkp-afdk/akdb — the abbreviation won canonical status in one wiki, the full name in another); canonical-name fork ("LPR" vs "Landspatientregisteret"); alias coverage never unioned (akdb has `LPR`, afdk has only the typo variant `Landspatientregistret`); type fork (`region-hovedstaden` is an *organization* in adhd/afdk, a *location* in akdb/danibd); folder fork (regions under `regional-government` / `regions` / `danish-regions` / bare `locations/`; topics under `quality-indicator` vs `quality-indicators`). Entity curation is per-ingest per-wiki (`04` §3.2 Step 6); the workspace index is wiki-granular by design (`03` §6) and its prose regenerates only on wiki-set changes, so entity-level overlap never surfaces at workspace level even when new PDFs create it.
- **Design notes for when scheduled:** options range from a deterministic cross-wiki slug/alias overlap report written at workspace-pass time (cheap, read-only, no LLM), through a shared identity registry that per-wiki entity curations consult, to a workspace-level curation pass (biggest — a new call type with its own routing and fallback questions). Interacts with B11 (link qualification), B10/B12 (within-wiki graph completeness is a prerequisite), and B13 (alias coverage); language adds another fork axis the day a non-English-output wiki exists (folder names follow output language, `05` §2.1). Start from `03_DOX_concept_detailed.md` §6 and `05_page_types_specification.md` §6 before writing a phase doc — this is a vision amendment, not a bug fix.
