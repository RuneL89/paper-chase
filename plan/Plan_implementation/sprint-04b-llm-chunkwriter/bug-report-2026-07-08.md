 Sprint 4b — Automated E2E UAT Bug Report

Date: 2026-07-08
Tester: ZCode Agent
Workspace: C:\temp\llm-wiki-workspace-llm-v2
Source PDFs: Abstract-Examples.pdf, NIB-annual-report.pdf, pubmed_intro.pdf (from C:\Users\atavi\Documents)
LLM Config: Kimi k2.7-code via C:\Users\atavi\Documents\config.json

---

## 1. Executive Summary

The Sprint 4b E2E UAT run produced LLM-written synthesis on all three wikis and preserved the full extracted text, satisfying the core UAT requirements. However, the generated wikis contain a large number of broken wikilinks because the LLM ChunkWriter links to entities and topics that the deterministic extraction layer never created. In addition, source and wiki-index pages still reference the old deterministic chunk titles, even though the LLM rewrites document page titles.

These issues violate the Sprint 4b UAT expectation that entity names in the summary are linked to valid pages, and the Project Vision requirement that wikilinks match exact page titles.

---

## 2. Bugs Found

### Bug 1: LLM links to non-existent entity/topic pages

**Severity:** High
**UAT/TAC affected:** Sprint 4b UAT 3, Project Vision `06_citation_and_provenance.md` §6, `07_validation_and_quality.md` §2.3
**Symptom:** Document pages contain `[[Entity: ...]]` and `[[Topic: ...]]` links to pages that do not exist, causing the lint report to list dozens of broken links.
**Examples:**
- `pubmed-intro/documents/pubmed_intro-part-001.md` links to `[[Entity: National Center for Biotechnology Information]]`, `[[Topic: MEDLINE]]`, `[[Topic: Entrez]]`, etc., but no such pages exist in `pubmed-intro/entities/` or `pubmed-intro/topics/`.
- `nib-annual-report/documents/NIB-annual-report-part-002.md` links to `[[Entity: Global Reporting Initiative]]`, `[[Entity: Taskforce on Nature-related Financial Disclosures]]`, etc., but those pages do not exist.

**Root cause:** The ChunkWriter prompt does not tell the LLM which entity/topic pages will actually be generated. The deterministic entity extractor in `src/entities/index.ts` is too narrow (only matches organizations with a small set of suffixes), and the topic extractor produces fragmented, low-quality topics that do not match the names the LLM uses. The LLM is therefore inventing links to pages that are never created.

**Fix plan:**
1. Compute the exact list of entity/topic page titles that will be generated for this wiki and pass it to the ChunkWriter prompt.
2. Instruct the LLM to link only to titles from that list, and to omit the link if the exact title is not known.
3. Expand the deterministic entity extractor to capture multi-word organizations and products that appear in the corpus (e.g., `National Center for Biotechnology Information`, `Falls-Reduction Inventory`) so the list of known titles is richer.

---

### Bug 2: Source and wiki-index pages link to old deterministic titles

**Severity:** High
**UAT/TAC affected:** Sprint 4b UAT 3, Project Vision `03_DOX_concept_detailed.md` §5, `06_citation_and_provenance.md` §6
**Symptom:** After the LLM rewrites document titles, `sources/<source>.md` and `wikis/<slug>/index.md` still use the deterministic `chunk.title` values (e.g., `Part 1: pubmed_intro`), breaking links to the actual document pages.
**Examples:**
- `pubmed-intro/sources/pubmed_intro.md` links to `[[Part 1: pubmed_intro]]`, but the page title is `PubMed: The Bibliographic Database (pages 1–2)`.
- `nib-annual-report/index.md` links to `[[Part 2: NIB-annual-report]]`, but the page title is `Reporting ESG ratings (p. 47)`.

**Root cause:** `src/writers/source.ts` and the wiki-index builder in `src/writers/index.ts` use the deterministic `chunk.title` from `buildDocumentPageInfos` instead of reading the actual `title` frontmatter from the written document pages.

**Fix plan:**
1. After all document pages are written, read their frontmatter titles and pass those titles to `writeSourcePage` and `writeWikiIndex` instead of `chunk.title`.
2. Alternatively, store the final document page titles in `ProcessedSource` so the source and index writers can use them without re-reading files.

---

### Bug 3: LLM calls are not recorded in the run log

**Severity:** Medium
**UAT/TAC affected:** Sprint 4b TAC 8
**Symptom:** Every `ingest` log contains `"llmCalls": []`, even though the LLM was called for every chunk.
**Root cause:** The run-log builder (`src/log.ts`) does not capture the LLM call records returned by `LLMClient.toRecord()`.

**Fix plan:**
1. Track LLM calls during `ingest` and append them to the run log via `buildRunLog`.
2. Ensure the log records provider, model, estimated tokens, and estimated cost, but never raw PDF bytes or API keys.

---

### Bug 4: Entity page frontmatter/body mismatch

**Severity:** Low
**UAT/TAC affected:** Sprint 4b TAC 6, Project Vision `05_page_types_specification.md` §6.1
**Symptom:** The generated entity page `nib-annual-report/entities/nordic-environment-finance-corporation.md` has `type: person` (should be `organization`), frontmatter `mentions: 1`, and body `**Mentions:** 4`.
**Root cause:** The type inference in `src/orchestrator/agents.ts` is separate from the type in `src/entities/index.ts`, and the `mentions` count in the frontmatter counts unique source/page-range locations while the body shows the total entity count.

**Fix plan:**
1. Use the same type inference logic in both the orchestrator and the writer.
2. Make the frontmatter `mentions` field consistent with the body's `**Mentions:**` value, or clarify the distinction (e.g., `mentions` = number of chunks/sources, `count` = total occurrences).

---

## 3. What Already Passed

- LLM-written synthesis appears at the top of every document page.
- Every synthesis uses inline `[^srcN]` citations mapped to `sources` frontmatter entries.
- Full extracted text is preserved below the synthesis.
- The deterministic fallback is used when a per-chunk LLM call fails or returns invalid JSON.
- `confidence` and `tags` fields are present on document pages.
- Per-chunk state files (`chunk-state.json`) and `run-manifest.json` are created.
- Scanned NIB page 1 is correctly preserved as a raw page.

---

## 4. Reproduction Steps

1. Run the ingestion pipeline with LLM enabled:
   ```bash
   node dist/cli.js init abstract-examples -w C:\temp\llm-wiki-workspace-llm-v2
   node dist/cli.js sample abstract-examples C:\Users\atavi\Documents\Abstract-Examples.pdf -w C:\temp\llm-wiki-workspace-llm-v2
   node dist/cli.js ingest abstract-examples -w C:\temp\llm-wiki-workspace-llm-v2
   ```
   (Repeat for pubmed-intro and nib-annual-report.)
2. Inspect `wikis/<slug>/lint/report.json` — it contains broken-wikilink issues.
3. Inspect `wikis/<slug>/sources/<source>.md` and `wikis/<slug>/index.md` — links use old deterministic titles.
4. Inspect `wikis/<slug>/.kimi-code/logs/<timestamp>_ingest.json` — `llmCalls` is empty.

---

## 5. Fix Verification Plan

After implementing the fixes above, re-run the full E2E test in a fresh workspace. The sprint passes when:

1. No broken-wikilink issues remain in `lint/report.json`, or the only broken links are documented out-of-scope items.
2. `sources/<source>.md` and `wikis/<slug>/index.md` link to the actual LLM-written document page titles.
3. `llmCalls` is populated in every `ingest` log.
4. Entity page `type` and `mentions` fields are internally consistent.
5. All existing `npm run test` tests continue to pass.

---

## 6. Resolution

All four bugs were fixed and verified in a fresh E2E UAT run on 2026-07-09.

| Bug | Fix Summary | Verification |
|---|---|---|
| Broken links to non-existent entity/topic pages | Prompt now lists exact known page titles; deterministic sanitizer strips/rewrites unknown/piped wikilinks; entity/topic extraction expanded for multi-word organizations and products; `collectKnownPageTitles` filters by the same threshold used for page generation. | `lint/report.json` shows 0 broken links for all three wikis. |
| Source/index pages link to old deterministic titles | `ProcessedSource` now carries `documentLinks` read from the written document page frontmatter; `writeSourcePage` and `writeWikiIndex` use the actual LLM-written titles. | `sources/<source>.md` and `wikis/<slug>/index.md` use the same titles as the document page frontmatter. |
| LLM calls not logged | `LLMClient` now accumulates `LLMCallRecord`s internally and exposes them via `getRecords()`; `writeIngestRunLog` includes them in every `ingest` log. | Every `ingest` log contains populated `llmCalls` with provider, model, tokens, and cost. |
| Entity page type/mentions mismatch | Entity types are now preserved from `extractEntities` through `ProcessedSource.entityTypes` and resolved by majority vote before page generation; frontmatter `mentions` now matches body `**Mentions:**` (both use `entity.count`). | `nordic-investment-bank.md` now shows `type: organization` and `mentions: 83` consistently. |

E2E UAT workspace: `C:\temp\llm-wiki-workspace-sprint4b-e2e`
Test suite: `npm run build` and `npm run test` both pass (139/139 tests).
