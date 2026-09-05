# Paper Chase — Backlog

**Document ID:** `LLM-WIKI-CLI-IMPL-BACKLOG`
**Version:** 1.0.4
**Status:** Living
**Date:** 2026-09-05

The up-next queue, open issues, and accepted residuals. Entries are **not** scheduled phases: each records the mechanism, the evidence, and the fix direction. When an item is scheduled or fixed, it moves into a `PHASE_XX_<slug>.md` doc (or is resolved directly) and is removed from this list — the phase doc and `.state/compliance-log.md` are the record.

*Last refreshed: 2026-09-05 (B25 + B8 queued **Up next** with a mandatory AskUserQuestion refinement gate before any implementation; B6 deleted — the rebuild/asset-version discipline lives in the root AGENTS.md `dist/` section).*

---

## Up next

Queued for scheduling. **Both items carry a mandatory refinement gate (user directive, 2026-09-05):** before any phase doc is written or any implementation begins, the user is interviewed in-conversation using the AskUserQuestion tool — iterating until every aspect, constraint, scope boundary, and the preferred solution is fully understood. The refinement outcomes are recorded in the item, and only then is it scheduled into a `PHASE_XX_<slug>.md` doc.

### B25. Per-chunk checkpoints so a worker crash does not restart the current PDF's ingest (user-directed, 2026-09-05)

- **Mechanism:** the Phase 26/27 per-PDF mini-pipeline checkpoints at only two levels — the per-PDF record in `.state/ingestion.json` (written only after the PDF's full pass, `src/commands/ingest.ts:1250`) and the per-page synthesis resume records (`synthesis-state.json`). There is **no per-chunk extraction checkpoint**: the chunk loop calls `extractDocumentChunk` unconditionally (no `existsSync` guard on `.state/extracted/<chunk-id>.json` anywhere in the loop), and `extractDocumentChunk` (`src/commands/extract-chunk.ts:33`) always runs the LLM. The same gap covers materialize/curation — nothing records "extraction done, curation done" for the in-flight PDF. So when a Phase 27 worker crashes mid-extraction, the auto-retry worker restarts that PDF's mini-pipeline from chunk 001, re-extracting and overwriting chunks the dead worker had already completed. The only resume protection that fires is the synthesis per-page rule, which a first-time PDF never reaches.
- **Evidence (2026-09-04/05 production rkkp run, conductor on the 1.0.30 packaged runtime):** two worker crashes with an identical signature — CPOP_2025 at 03:41 Helsinki (2026-09-04) and DAD_2025 at 09:28:54 Helsinki (2026-09-05), both exit code 1 mid-extraction, both preceded by a burst of extractor calls hitting the 32,768 output-token cap on glm-5.3-flash (`.state/crash-log.jsonl`; both `attempt 1, autoRetried: true`). The DAD retry demonstrably restarted: the fresh worker was re-extracting part-005 at 09:59 with parts 001–010 already on disk. Each crash therefore pays the partial extraction twice (dead attempt + re-extraction) — ~5–8 min per chunk of wall clock, modest token cost on the flashx extractor slot, compounding across a 37-PDF queue if the crash signature recurs.
- **Fix direction:** add fine-grained resume checkpoints inside the per-PDF mini-pipeline so an auto-retry enters where the worker died instead of restarting the PDF. (1) **Per-chunk extraction checkpoint** — skip `extractDocumentChunk` when `.state/extracted/<chunk-id>.json` already exists, guarded by validity checks: the JSON parses, its schema re-validates deterministically (no LLM call), and its recorded source sha256/page-range matches the current PDF hash (safe because the changed-PDF re-ingest path already deletes stale extraction JSONs first, `src/commands/ingest.ts:1140-1146`, so a hash-mismatched file cannot silently survive). (2) **Per-PDF stage marker** — record the in-flight PDF's completed stages (extraction/materialize/curation) in a small state file the retry reads to enter at the right stage; materialize/curation re-run can then also be skipped when their inputs are unchanged. (3) **Related telemetry gap (optional, same investigation):** both crash records' `stderrTail` contain only LLM cost lines — the actual exception is lost. Capture the last non-cost stderr line (or raise `CRASH_LOG_STDERR_TAIL_LINES` filtering cost lines) so crash causes become diagnosable.
- **Law compatibility:** the ratified "data never skipped" rule is untouched — an existing valid extraction JSON is data on disk, not skipped data; the per-PDF `ingestion.json` checkpoint and per-page synthesis resume records stay exactly as they are; the changed-PDF re-ingest path keeps deleting stale extraction JSONs before re-processing. Sequencing note: naturally folds into a Phase 27 follow-up (v1.0.2-class) rather than a new phase.

### B8. Multi-format ingestion (user-directed, 2026-07-25)

Today Layer 1 is PDF-text-only (`pdfjs-dist`). The user wants ingestion to grow to:

- **DOCX** — Word documents (parse to markdown; same chunk → Extract → Materialize pipeline downstream).
- **Non-text / scanned PDFs** — pages where `pdfjs-dist` extracts nothing (today they become `raw` placeholder pages); needs an OCR or vision-LLM extraction path so scanned pages yield real content.
- **Images** — standalone image files (photos of documents, screenshots) via the same vision path.

Design notes for when this is scheduled: it is a Layer-1 concern with downstream ripple (chunk identity, source-page provenance per format, and the vision-language rule — scanned text becomes "extracted text" that must stay verbatim in Layer 2); a vision-LLM extraction path is a new call type with its own routing-slot question; the frozen Phase 0 extraction surface (`extractText` signature) must stay additive. Start from `Project Vision/06_citation_and_provenance.md` (provenance per format) and `01` §4.4 (chunking) before writing a phase doc.

---

## Near-term fixes

### B11. Bare-slug wikilinks are ambiguous in the single-vault workspace

- **Mechanism:** entity/topic pages link by bare slug (`[[region-hovedstaden|…]]`), and `wikis/` is designed to open as one Obsidian vault (vision `03` §6: "every link resolves"). Obsidian resolves duplicate basenames by shortest path — with `.obsidian/app.json` empty (default resolution), a link written in one wiki can silently resolve to another wiki's page.
- **Evidence:** 2026-07-28 audit of `dist/wikis`: ~60 page basenames exist in 2–4 wikis (all five regions in all four wikis, ~25 hospitals, ~15 topics incl. `indikator-5`); `.obsidian/app.json` is `{}`.
- **Fix direction (needs a design decision):** wiki-qualify link targets that exist in more than one wiki (path-form links or shortest-unique-path), or pin Obsidian link resolution in the generated `.obsidian` config; the wikilink validator/repair must then check uniqueness vault-wide, not per-wiki.

### B13. Name variants merged at slug level never reach `aliases`

- **Mechanism:** `aliases` accumulate only from curation merges; name variants that slugify identically merge in the Materializer before curation runs (first name wins, `src/materializer.ts:638-645`), so the losing variant is recorded nowhere — Obsidian alias search cannot find the page by that name.
- **Evidence:** 2026-07-28: "ADHD-foreningen" (2024 report, hyphenated) is not an alias of `adhd-foreningen.md`; the variant survives only inside a Layer-2 mention quote.
- **Fix direction (small):** when a merged entity record's name differs from the canonical first-wins name, append the variant to the page's `aliases` during materialization (the same field curation already maintains).

### B15. First-wins on name/significance/disambiguation silently discards later extractor data

- **Mechanism:** vision `03` §3.2 specifies only first-*folder*-wins; the Materializer additionally applies first-wins to the entity's display name, `significance`, and `disambiguation` (`src/materializer.ts:638-645`). Later chunks' variants of these fields are dropped with no record anywhere — significance and disambiguation are extractor prose, not Layer-2 items, so the preservation check never sees them. In tension with `01` Principle 3 ("no detail is lost").
- **Evidence:** 2026-07-28 (`dist/wikis/rkkp-adhd`): the 2024 chunk's significance for `adhd-foreningen` ("Patientorganisation repræsenteret i styregruppens arbejde gennem formand Trish Nymark.") was discarded in favor of the 2023 record — the only extracted sentence naming the entity's chair. The same rule picks the canonical display name (feeding B13's alias gap) and, applied independently per wiki, produces opposite canonical choices across wikis ("LPR" in rkkp-adhd vs "Landspatientregisteret" in rkkp-akdb — the cross-wiki canonical-name fork the Phase 24 registry surfaces).
- **Fix direction:** replace first-wins with update-aware rules — prefer the record with richer evidence (or concatenate differing significances), let later disambiguation fill an empty slot, and record losing name variants in `aliases` (B13's fix covers the alias side). The discarded significance text may also name related parties the Phase 17 relationship slots never see. Note: a significance/disambiguation change alters the page's aggregate fingerprint, so affected pages re-synthesize once under the existing synthesis-resume rule.

---

## Accepted residuals (watch items)

### B4. Pathological-dense pages degrade to the structured template

- **Mechanism:** the very densest pages (`adhd-databasen`, `indikator-3`, `topic performance`) carry a Layer-2 payload that structurally exceeds the 32768 output ceiling, so strict and permissive synthesis cannot fit and the page keeps the deterministic template (bounded ~$0.65/page).
- **Options:** (A) accept — data is complete, ~2% of pages (current); (B) sub-page splitting, vision `02` §4.7's own remedy — split by source/period with an index (Phase-18-sized); (C) evidence excerpting (L6 in `Project Vision/optimizations/optimizations.md`) — biggest canon surgery.
- **Decision trigger:** revisit after the full-corpus run shows how many pages land in this bucket.

---

## Housekeeping

### B7. With-key suite profile before release

- All phase budgets were $0; the live-gated tests (Phase 2 live gates, gate 0.4, e2e) have not been re-run since Phase 11 v1.6.0. Run once with `ANTHROPIC_API_KEY` loaded (and `RUN_E2E=1` for the full e2e) before any release.

### B9. Wiki display title is slug-derived, not the init title

- **Mechanism:** the DOX Writer derives the wiki root `index.md` title (and the workspace catalog display name + workspace prose) as `titleCase(slug)` (`src/dox-writer.ts:344,798`) — the `--title` given at `init` lives only in the constitution's H1 and is never read back. `rkkp-adhd` renders as "Rkkp Adhd" where the user named it "RKKP ADHD" (same behavior as "Adhd Wiki").
- **Fix direction (small, needs a design decision):** read the display title from the constitution H1 when present, falling back to `titleCase(slug)` — noting that `init` defaults the title to the raw slug, so the fallback rule needs care (slug-looking H1 → titleCase it?). Update the DOX root-index gates accordingly.
