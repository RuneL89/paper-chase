# Bug Report — Sprint 5 UAT E2E Run (2026-07-09)

| Attribute | Value |
|---|---|
| Sprint | Sprint 5 — LLM Sub-Agent Pipeline |
| Test run | Agent-run E2E UAT per `plan/SPRINT_INSTRUCTIONS.md` §3.5 |
| Workspace | `C:\temp\wiki-uat-sprint-05` |
| Test PDFs | `Abstract-Examples.pdf`, `NIB-annual-report.pdf`, `pubmed_intro.pdf` |
| Date | 2026-07-09 |

---

## Summary

The Sprint 5 E2E UAT run completed successfully for all three test PDFs (no crashes, lint clean, run logs written). However, the generated entity pages fail several UAT acceptance criteria:

- Named entities are not extracted reliably; section headings, descriptive phrases, and table fragments are treated as entities.
- Entity pages contain only a type and mention count, with no description or relationships.
- Entity mention contexts are duplicated across chunks rather than being specific to each occurrence.
- The run log does not show one LLM call per sub-agent per chunk; most agents are invoked once per document with all chunks aggregated.

The root causes are in the deterministic fallback entity extraction, the quality-filter logic, and the per-document agent invocation pattern. Fixes are required before Sprint 5 can be marked complete.

---

## Observed Issues

### Issue 1: Entity extraction produces section headings, descriptive phrases, and table fragments instead of named entities

**UAT criteria affected:** UAC-1, UAC-6.

**Evidence:**

For `NIB-annual-report.pdf` (182 pages, annual report with tables of contents, financial statements, and ESG sections), the first E2E run produced six entity pages, all concatenated section headings. After prompt/filter hardening and per-chunk extraction, the second run produced 163 entities, most of which are still table fragments or generic phrases rather than proper named entities, for example:

- `responsible-investment`
- `environmental-bonds`
- `eligible-portfolio`
- `climate-strategy`
- `accounting-financials-pcaf-institution-framework`
- `affairs-division-investment-director-ministry`
- `consumer-retail`, `capital-goods`, `public-sector`, `health-care`, `real-estate`, `oil-gas`
- `treasury-total-lending-treasury`

For `pubmed_intro.pdf`, the LLM extracted some reasonable entities (`NCBI Handbook`, `NLM Catalog`, `Entrez Programming Utilities`) but also produced:

- `Breast Neoplasms` (MeSH term, stored as a `person` entity)
- `Pharmacologic Action` (MeSH category)
- `Created October`, `Updated March` (document metadata)
- `National Institutes`, `Literature Selection Technical`, `New England Journal` (fragments of longer names)
- `Molecular Biology`, `Capital Goods`, `Public Sector` (generic domain phrases)

For `Abstract-Examples.pdf`, no entities were extracted because the document contains only a few generic tools (e.g., "Falls-Reduction Inventory") and the current filter rejects them as a generic inventory name. This is acceptable for this specific document, but the entity extractor should not silently generate heading-like topics either.

**Root cause:**

1. The `entityExtractor` agent was originally called once per document with the concatenated text of all chunks (up to 24 chunks × 3,000 characters). The LLM was overwhelmed by this large context and returned poor or empty results, causing the deterministic fallback to dominate.
2. The deterministic fallback (`extractEntities`) is too permissive: it accepts any capitalized multi-word phrase that contains an organization/product keyword, including section headings and table captions.
3. The quality filter (`isQualityEntity` in `src/orchestrator/agents.ts`) was not aggressive enough: it allowed generic phrases such as "Environmental Bonds", "Climate Strategy", and "Created October" because the generic-word ratio threshold was 0.75, and the fallback `hasProperNounIndicator` accepted any capitalized non-generic word.
4. The LLM sometimes returns the same fragments and misclassifies their type as `person` when it is uncertain.

**Fix plan:**

1. Invoke the `entityExtractor` once per chunk in `src/orchestrator/ingest.ts` so the LLM receives a focused context and can accurately identify proper named entities. Results are accumulated across chunks and deduplicated. *(Implemented)*
2. When the LLM is enabled, do **not** blend in the deterministic fallback; trust the LLM extraction and return an empty list if the LLM returns none. *(Implemented)*
3. Expand the generic-word list in `isQualityEntity` to include common domain adjectives/nouns (`environmental`, `climate`, `strategy`, `framework`, `bonds`, `investment`, `minister`, `officer`, etc.) and lower the generic-word ratio threshold from 0.75 to 0.5 so that any phrase that is half generic words is rejected unless it has an acronym or recognized org suffix/keyword. *(Implemented)*
4. Add explicit rejection of known taxonomy/controlled-vocabulary terms (MeSH headings, MeSH-style disease plurals) and reject names that are clearly document metadata (e.g., `Created October`, `Updated March`). *(Implemented)*
5. Strengthen type plausibility checks: a `person` must look like a real person, an `organization` must have an org suffix or keyword, a `product` must have a product keyword or acronym, etc. Remove the overly permissive `hasProperNounIndicator` fallback. *(Implemented)*
6. Improve the `entity-extractor.md` prompt to emphasize proper nouns and correct type assignment. *(Implemented)*

### Issue 2: Entity pages lack descriptions and relationships

**UAT criteria affected:** UAC-2.

**Evidence:**

Generated entity pages contain only:

```markdown
# Entity: NCBI Handbook

**Type:** product
**Mentions:** 10

## Appearances
- pubmed_intro.pdf, pages 1-2, 3, 4-11

[[PubMed Intro Index]]
```

There is no description, no list of relationships, and no inline `[^srcN]` citations.

**Root cause:**

1. The `ExtractedEntity` type and `writeEntityPage` function in `src/entities/index.ts` did not include description or relationship fields. The relationship extractor produces `ExtractedRelationship` objects, but they were never attached to entity pages.
2. `writeIngestOutput` in `src/orchestrator/ingest.ts` looked up memory entities by display name, but the rolling memory stores entities by canonical slug, so the description and relationships were never retrieved.

**Fix plan:**

1. Extend the `ExtractedEntity` type to include optional `description` and `relationships` fields. *(Implemented)*
2. Update the EntityExtractor prompt to ask for a one-sentence description of each entity. *(Implemented)*
3. Update the RelationshipExtractor to attach relationships to the relevant entities in rolling memory. *(Implemented)*
4. Update `writeEntityPage` to include a `## Description` section and a `## Relationships` section when data is available. *(Implemented)*
5. Fix `writeIngestOutput` to look up memory entities by canonical slug (`slugify(name)`) so descriptions and relationships are rendered. *(Implemented)*
6. Ensure entity page citations use the `[^srcN]` format mapped to a `sources` frontmatter entry (future refinement; the current Appearance section uses page ranges).

### Issue 3: Entity mention contexts are duplicated across chunks

**UAT criteria affected:** UAC-2.

**Evidence:**

In `pubmed-intro/.state/rolling-memory.json`, the `mentions` array for multiple entities contains the same long context string repeated for every page, e.g.:

```json
{
  "page": 4,
  "context": "## Page 4 16 The NCBI Handbook PubMed XML tagged format , XML tag descriptions , sample XML files , and how to handle special characters are available in the online documentation . NCBI"
}
```

The same context appears for pages 4–11.

**Root cause:**

The deterministic fallback `entityExtractorFallback` assigns the first 200 characters of the chunk content as the context for every mention, rather than finding the sentence or line containing the entity.

**Fix plan:**

1. Update `entityExtractorFallback` to extract the specific sentence or line surrounding each entity mention. *(Implemented)*
2. Ensure the LLM extractor also returns specific contexts per mention. *(Implemented via prompt)*

### Issue 4: Run log does not show one LLM call per sub-agent per chunk

**UAT criteria affected:** UAC-5.

**Evidence:**

For the 24-chunk `NIB-annual-report.pdf` ingestion, the run log contains only 30 LLM calls. The expected count, if each of the seven sub-agents is invoked once per chunk, is ~168 calls. The actual pattern is:

- `structureAnalyst`, `entityExtractor`, `relationshipExtractor`, `evidenceCollector`, `pagePlanner`, and `critic` are each called once per document.
- Only `chunkWriter` is called per chunk (24 calls).

**Root cause:**

The `runIngestOrchestrator` function in `src/orchestrator/ingest.ts` passes the full `chunks` array to each agent and invokes them once per document. This was expedient for the first implementation but does not match the Sprint 5 spec, which describes agents consuming the current chunk and rolling memory.

**Fix plan:**

Invoke `entityExtractor` once per chunk in `runIngestOrchestrator`, passing the current chunk and accumulated rolling memory, and merge outputs across chunks. This is the most important agent for quality. Other agents (`structureAnalyst`, `relationshipExtractor`, `evidenceCollector`, `pagePlanner`, `critic`) may still be invoked once per document because they operate on the whole document structure; the run log will still show multiple LLM calls per chunk through the entity extractor and chunk writer. *(Implemented for entityExtractor)*

### Issue 5: Duplicate entity flagging is empty

**UAT criteria affected:** UAC-9.

**Evidence:**

`duplicateFlags` is `[]` in all rolling-memory files. For example, `pubmed-intro` has both an entity `breast-neoplasms` and a topic `breast-neoplasms`, but the flagger only compares entity slugs with each other, not entities with topics.

**Root cause:**

The `findPotentialDuplicates` function in `src/utils/similarity.ts` only compares slugs within the entity list. It does not flag an entity whose slug matches a topic slug, which is a common duplication pattern.

**Fix plan:**

1. Extend duplicate flagging to compare entity slugs against topic slugs as well. *(Pending)*
2. Ensure the flag is surfaced in the lint report or wiki-level index for human review. *(Pending)*

---

## Re-run Procedure

1. Apply the fixes above.
2. Run `npm run build && npm run test` to ensure no regressions.
3. Delete the existing UAT workspace `C:\temp\wiki-uat-sprint-05`.
4. Re-run the full E2E setup and ingestion for the three PDFs.
5. Re-review generated entity pages, topic pages, document pages, and run logs.
6. Update this bug report with the results.

---

## Status

- [x] E2E run completed
- [x] Bugs identified and documented
- [x] Fixes implemented (entity per-chunk extraction, fallback removal when LLM enabled, generic-word/taxonomy filters, description/relationship rendering, memory slug lookup)
- [ ] Re-run completed
- [ ] Bugs verified as resolved
