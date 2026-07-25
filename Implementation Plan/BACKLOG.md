# Paper Chase — Backlog

**Document ID:** `LLM-WIKI-CLI-IMPL-BACKLOG`
**Version:** 1.0.0
**Status:** Living
**Date:** 2026-07-25

Open issues, accepted residuals, and future tracks. Entries are **not** scheduled phases: each records the mechanism, the evidence, and the fix direction. When an item is scheduled, it moves into a `PHASE_XX_<slug>.md` doc and is struck through here with the phase reference.

---

## Near-term fixes (Phase 17 candidates)

All three are validation-noise classes found by the 2026-07-25 live test run (run 5) and share one theme: LLM-written output is trusted where a deterministic re-imposition already exists for sibling fields.

### B1. Synthesized pages' `sources` frontmatter under-covers body citations (`missingSource` flags)

- **Mechanism:** the Materializer writes complete `sources` frontmatter; the Synthesis Writer's replacement page carries LLM-written frontmatter, and only `aliases` (UAT 6.3) and `sparse` (Phase 13) are deterministically re-imposed. The preservation check verifies body citation *markers*, never the frontmatter map.
- **Evidence:** run 5: ~200 flags (`region-hovedstaden.md`: 2 frontmatter entries for 22 body keys). Pre-existing: the 2026-07-23 baseline wiki has 131.
- **Fix direction:** extend the deterministic re-imposition (aliases/sparse pattern) to `sources` — the Materializer's computed complete list over the LLM's frontmatter, post-synthesis.

### B2. Synthesized pages can carry the constitution's example `updated` date

- **Mechanism:** same un-re-imposed frontmatter — the model copies the wiki constitution's *example* frontmatter (`updated: "2026-07-17T10:00:00Z"`).
- **Evidence:** 64 of 159 pages in run 5 carry that exact example date.
- **Fix direction:** same pass as B1 — always re-impose `updated` with the real write time.

### B3. DOX folder catalogs can self-link the index instead of the page (orphaned topics)

- **Mechanism:** on folders where page title == folder title (every claim-type topic folder), the DOX model sometimes writes the `## Pages` catalog entry pointing at the folder's own `index` instead of the page; the link *resolves*, so the wikilink repair keeps it, and the page gets zero incoming links (flagged orphaned).
- **Evidence:** run 5, 10 orphaned topics — e.g. `topics/database-expansion/index.md` catalogs `[[topics/database-expansion/index|Database Expansion]]`, never `[[database-expansion|Database Expansion]]`.
- **Fix direction:** extend the DOX deterministic enforcement (already re-imposes children/statistics) to re-impose page-catalog targets: every direct page must appear in `## Pages` with its canonical basename link; a self-index link in a `## Pages` entry fails validation and reasks.

---

## Accepted residuals (watch items)

### B4. Pathological-dense pages degrade to the structured template

- **Mechanism:** the very densest pages (`adhd-databasen`, `indikator-3`, `topic performance`) carry a Layer-2 payload that structurally exceeds the 32768 output ceiling, so strict and permissive synthesis cannot fit and the page keeps the deterministic template (bounded ~$0.65/page).
- **Options:** (A) accept — data is complete, ~2% of pages (current); (B) sub-page splitting, vision `02` §4.7's own remedy — split by source/period with an index (Phase-18-sized); (C) evidence excerpting (L6 in `Project Vision/optimizations/optimizations.md`) — biggest canon surgery.
- **Decision trigger:** revisit after the full-corpus run shows how many pages land in this bucket.

### B5. Curation judgment variance across passes/runs (R4/R7 residual)

- **Mechanism:** per-PDF curation passes can disagree (run 5: pass 1 merged `clinical-assessment → clinical`, pass 2 did not, and the materializer re-created the topic from the unchanged extraction data). Merge-only entity monotonicity holds within a run, but topic merge/drop can oscillate across passes/runs; the "self-healing" property assumes stable judgments.
- **Candidate strengtheners (if oscillation is observed in practice):** sticky decisions (the checker honors previous runs' merges as constraints, like auto-recorded overrides), or one end-of-run curation pass instead of per-PDF passes (cheaper and removes intra-run variance; restructures the materialize flow).

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
