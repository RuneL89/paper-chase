# E2E Bug Report — LLM Wiki CLI v2.0 Final Verification

| Date | 2026-07-09 |
|---|---|
| Trigger | Full code/product analysis + E2E verification per `plan/SPRINT_INSTRUCTIONS.md` |
| Baseline commit | `fe74494` (current HEAD at time of report) |
| Review spec | `plan/IMPLEMENTATION_PLAN.md`, `plan/SPRINT_INSTRUCTIONS.md`, `Project Vision/01`–`07` |
| E2E workspace | `C:\temp\e2e-wiki-analysis` |

## Summary

A two-axis code review (Standards + Spec) and a full E2E run on the three required PDFs (`Abstract-Examples.pdf`, `NIB-annual-report.pdf`, `pubmed_intro.pdf`) were completed. The implementation now matches the Project Vision on the code/spec axis: the LLM is the primary author of all markdown bodies, deterministic validation gates commits before they are written, state/lint live under `output/`, and all commands emit run logs. The most recent verification focused on two E2E-level fixes:

1. **Invalid entity/topic citations** — entity and topic pages now include a `sources` frontmatter entry that matches every inline `[^srcN]` citation.
2. **Broken source-page wikilinks** — the Critic’s known-title map now includes the source page title (`Source: <fileName>`), so links from document pages to source pages resolve.

The remaining E2E warnings are **LLM authoring-quality issues** (orphaned topic/entity pages, table-preservation flags) rather than deterministic code/spec violations. They are surfaced by the existing lint/Critic pipeline exactly as designed.

## Code/Spec Issues Reviewed

| # | Issue | Severity | Status | Notes |
|---|---|---|---|---|
| 1 | Lint source-file path resolution | High | **FIXED** | `checkCitations` now resolves source files against the workspace root (`path.resolve(workspace, sourceFile)`). E2E no longer reports `missing-source-file` errors. |
| 2 | State/lint under `output/` | High | **FIXED** | `statePath()` points to `output/.state/ingest-state.json`; `saveMemory`/`saveMemorySummary` and `writeLintReport` use `output/.state` and `output/lint`. `status` now reads from these paths. |
| 3 | Entity/topic bodies LLM-authored | Critical | **FIXED** | `writeEntityPage`/`writeTopicPage` accept an LLM `body`; the orchestrator calls `entityTopicPageWriter` and passes the result. Deterministic fallback is only used when the LLM is disabled or returns invalid output. |
| 4 | Document fallback/merge LLM-authored | High | **FIXED** | `writeDocumentPage` uses LLM-provided content when available; `mergeLlmContentWithChunk` only enforces required frontmatter fields and preserves the LLM body. No extracted detail is appended after the fact. |
| 5 | Remove `repairWikilinks` post-processing | High | **FIXED** | `repairWikilinks` was removed from the ingestion pipeline. Broken links are reported by `lintWiki` and the Critic, not silently rewritten. |
| 6 | Critic feedback to ChunkWriter retry | High | **FIXED** | `writeAndValidateChunks` builds `buildWriterFeedback` from Critic issues, blocking issues, and completeness/schema failures, and passes it to the next `chunkWriter` call on retry. |
| 7 | Pre-commit structural checks | High | **FIXED** | Schema, citation, and wikilink checks run on `pageUpdates` inside `writeAndValidateChunks` before `writeIngestOutput` persists pages. Lint is still written post-run for visibility. |
| 8 | Test provider structured JSON | High | **FIXED** | `generateMockResponse` returns role-aware JSON for every sub-agent (`ChunkWriter`, `EntityTopicPageWriter`, `StructureAnalyst`, `EntityExtractor`, `RelationshipExtractor`, `EvidenceCollector`, `PagePlanner`, `Critic`). |
| 9 | Corpus-centric `sample` | Medium | **FIXED** | `sample` accepts an optional PDF path; when omitted, it discovers all PDFs in `raw/`, classifies the corpus via `classifyCorpus`, and selects a representative PDF. The old single-PDF path remains backward-compatible. |
| 10 | Move/rename proposals | Medium | **FIXED** | `StructuralProposal` carries `renamedFolders` and `movedFolders`; `apply-proposal` handles directory moves/renames, state path updates, and `folderHierarchy` updates. |
| 11 | Missing run logs | Medium | **FIXED** | `ingest`, `apply-proposal`, `configure-llm`, and `test-llm` now write JSON run logs via `buildRunLog`/`writeRunLog` on success and failure. |
| 12 | Workspace-level `.kimi-code` structure | Low | **FIXED** | `initCommand` creates `.kimi-code/` and `.kimi-code/logs/` at the workspace root. |
| 13 | Slug/path helper consistency | Low | **FIXED** | `entityFileName`/`topicFileName` use `slugify`; `toRelativePathFromDir` replaced repeated `path.relative(...).replace(/\\/g, '/')` in state, reingest, and lint. |
| 14 | CLIError in proposals | Low | **FIXED** | User-facing proposal failures in `src/orchestrator/proposals.ts` now throw `CLIError`. |

## E2E Verification Results

### Workspace

```
C:\temp\e2e-wiki-analysis
├── .kimi-code/
│   └── config.json          # copied from C:\Users\atavi\Documents\config.json
├── wikis/
│   ├── abstract-examples/
│   ├── nib-annual-report/
│   └── pubmed-intro/
└── index-of-indexes.md
```

### Abstract Examples (`abstract-examples`)

- **Source:** `Abstract-Examples.pdf` (3 pages)
- **Generated pages:** 6 (1 document, 5 topics)
- **Warnings after re-run:** 5 orphaned-topic warnings
- **Fixed since initial run:** broken source-page wikilink and any invalid citations were eliminated by the source-title map fix.

### PubMed Introduction (`pubmed-intro`)

- **Source:** `pubmed_intro.pdf` (12 pages, mostly scanned)
- **Generated pages:** 8 (3 documents, 4 entities, 1 raw)
- **Warnings after re-run:** 2 orphaned-entity warnings
- **Fixed since initial run:** invalid citations on `harold-varmus.md` and `national-institutes-of-health.md` were fixed by adding `sources` frontmatter entries.

### NIB Annual Report (`nib-annual-report`)

- **Source:** `NIB-annual-report.pdf` (long annual report)
- **Generated pages:** 82 (24 documents, 44 entities, 13 topics, 1 raw)
- **Warnings after re-run:** 82 (quality flags only)
- **Key cleanup:** no invalid citations and no missing source files were reported.
- **Notable quality warnings:**
  - 3 broken wikilinks to `[[Topic: Risk Management]]` from document pages; the generated topic page is titled `Topic: Risk Management Policy`. This is an LLM title-matching issue, not a deterministic link-resolution bug.
  - Many orphaned entity/topic pages (the LLM did not link them from document pages).
  - Several duplicate-entity flags for IFRS S1/S2 variants that differ by paragraph number.

### Remaining Observations (Quality, Not Bugs)

1. **Orphaned topic/entity pages** — the Critic/lint correctly flags pages that the LLM did not link into the document graph. These are authoring-quality warnings, not code defects.
2. **Broken wikilink title mismatches** — in the NIB wiki, the LLM linked to `[[Topic: Risk Management]]` while the generated page title is `Topic: Risk Management Policy`. The deterministic link checker correctly reports this as a broken wikilink; the fix must come from the LLM using exact page titles.
3. **Table-preservation warnings** — for some chunks, the Critic reports that extracted tables were not fully rendered as markdown tables. The extracted text is still preserved in the chunk content; the warning indicates that the LLM should improve table formatting.
4. **Duplicate-entity flags** — the lint similarity checker surfaces pairs of entities that may be aliases (e.g., IFRS S1/S2 variants, EMTN vs MTN Program). Tuning the similarity threshold is a quality refinement, not a spec mismatch.
5. **“No pages planned”** — for the PubMed source, the LLM PagePlanner returned no pages for one chunk because every page was flagged as scanned; the deterministic fallback still created the necessary document pages from text-bearing chunks.

## Final Verdict

All deterministic code/spec mismatches identified in the initial review have been fixed. The three required PDFs ingest end-to-end, `ingest-all` and `status` refresh the top-level `index-of-indexes.md`, and the Vitest suite remains green (207 tests). The remaining warnings are LLM-authoring quality issues surfaced by the existing deterministic validation layer; none are code defects or spec violations. No further code changes are required to satisfy the Project Vision.

## Next Steps (Optional)

1. Tune the Critic/lint thresholds or prompts if the volume of orphaned-topic/entity, duplicate-entity, or title-mismatch warnings needs to be reduced for production corpora.
2. Add prompt-level guidance to the ChunkWriter/EntityTopicPageWriter to use exact page titles in wikilinks, which would eliminate title-mismatch broken-link warnings.
3. Consider a post-processing alias map for common abbreviations (e.g., `IFRS S1` ↔ `IFRS S1-29`) only as an LLM guidance, not a deterministic rewrite.
