# Paper Chase — Validation and Quality (Detailed)

This document specifies the validation and quality system of Paper Chase. It explains how the system ensures that the generated wiki is complete, consistent, and trustworthy, and how it handles structural changes that require human judgment.

---

## 1. The Quality Philosophy

The LLM writes the wiki, but the system does not trust the LLM blindly. Every chunk of output is checked before it is committed to the wiki. The checks are layered:

1. **Schema validation** — Is the Extractor JSON valid and complete?
2. **Deterministic checks** — Local code verifies that the output matches the source material and follows the schema.
3. **Human review** — The user consumes the compiled wiki and reviews logged structural changes; the user can revert changes via version control or re-run commands with revised guidance.

This layered approach combines the flexibility of the LLM with the reliability of deterministic validation and the judgment of the human user.

**Note:** The original vision included an LLM-level Critic agent. This architecture removes the Critic in favor of deterministic validation and prompt engineering. The Critic added complexity and cost without proportional reliability gains for a solo developer.

---

## 2. Validation Order

For every chunk, the validation pipeline runs in this order:

### 2.1 Schema Validation

After the Extractor returns JSON, the system validates:

- The JSON is parseable.
- Every entity has: `name`, `type`, `slug`, `folder`, `mentions`.
- Every relationship has: `subject`, `predicate`, `object`, `evidence`, `page`.
- Every claim has: `text`, `type`, `entities`, `page`.
- All `page` values are within the chunk's page range.
- All `subject` and `object` values in relationships reference existing entity slugs.

If schema validation fails, the chunk is rejected and the error is logged.

### 2.2 Folder Validation

Before the Materializer creates folders, the system checks:

- Every entity `folder` starts with `entities/` or `topics/`.
- No path traversal (`../`, absolute paths).
- Folder depth does not exceed 3 levels below `entities/` or `topics/`.
- No duplicate slugs within the same folder.

If folder validation fails, the chunk is rejected.

### 2.3 Deterministic Completeness Check

After the Synthesis Writer (Phase 5+) generates a synthesized page, the system compares the LLM-written page against the structured data to ensure:

- Every mention from the structured data appears in the markdown.
- Every relationship from the structured data appears in the markdown.
- Every claim from the structured data appears in the markdown.
- Tables from the original PDF are preserved verbatim (or clearly described if too large).
- Figures are described.
- No material was materially altered (e.g., a number changed without a reason).

The check is a **verbatim substring comparison**. Because preserved detail (Layer 2) is always kept in the source language (`02_WIKI_concept_detailed.md` §3.4), the Synthesis Writer must never translate or reword Layer 2 items — a translated mention or claim fails this check and the page falls back to the structured template.

If the check fails, the synthesized page is rejected and the structured template is kept instead.

### 2.4 Deterministic Structural Checks

The system also checks:

- **Broken wikilinks** — every `[[Page Name]]` must point to an existing page.
- **Orphaned pages** — pages should have incoming links unless they are index or source pages.
- **Citation integrity** — every `[^srcN]` must map to a valid `sources` entry, and the source PDF must exist.
- **Duplicate entities** — the system flags entities with very similar names that may need to be merged.

### 2.5 Schema Validation (Pages)

Every page must have valid YAML frontmatter and the required fields for its `type`. If a page is missing a required field or has an invalid value, the error is logged.

---

## 3. Preservation-First Materialization

During `ingest`, the Materializer writes or updates entity and topic pages. Because existing pages may have been manually edited or may contain evidence from earlier chunks, the materializer follows a preservation-first protocol:

1. **Manual-edit detection.** Before updating a page, the materializer compares the current page content against the hash stored in `.state/ingestion.json`. If the page has been changed by a human since the last ingestion run, the materializer skips the update and reports the conflict.

2. **Merge, don't replace.** For pages that were not manually edited, the materializer merges new evidence into the existing page structure. It does not regenerate the entire page from scratch unless the Writer is invoked (Phase 6+).

3. **Preservation check.** After updating a page (or after the Writer regenerates it), the materializer verifies that every existing citation (`[^srcN]`) and every existing wikilink is still present. If the update drops any prior content, the materializer reports the conflict and skips the update for that page.

4. **Conflict logging.** All conflicts are logged to `.state/conflicts.json` for human review.

---

## 4. Handling Structural Changes

When the LLM proposes a new folder or reorganizes the taxonomy:

1. The proposal is validated (folder rules, no duplicates).
2. If valid, the folder is created and the change is logged in `.state/proposals/structural-changes.json`.
3. The change is applied immediately. The human reviews it after the fact.
4. If the human disagrees, they can revert via version control or edit `AGENTS.md` and re-run `ingest`.

There is no human approval gate during ingestion. The system is designed for batch processing of large corpora where stopping for approval is impractical.

---

## 5. Error Handling Philosophy

The system follows a **fail loud** philosophy, with a bounded-retry amendment (user-ratified 2026-07-20):

- If the Extractor returns invalid JSON, the chunk is rejected and the error is logged.
- If the Writer drops content, the synthesized page is rejected and the structured template is kept.
- If a preservation check fails after the bounded retries below, the update is skipped and the conflict is logged.
- **Deterministic failures are never retried** — invalid JSON, schema-validation errors, and HTTP 4xx responses fail immediately. Retrying those would mask prompt problems and burn tokens.
- **Transient transport failures** (HTTP 429/5xx, network errors, timeouts) are retried with backoff, up to 3 total attempts per call, each attempt logged.
- **Quality failures** — a preservation-check failure or an unparseable/incomplete DOX Writer response — are retried up to 3 total attempts before the deterministic fallback, because they are partly LLM variance rather than prompt defects.

After the bounded retries are exhausted, the user fixes the prompt, the PDF, or the `AGENTS.md` and re-runs `ingest`.

---

## 6. Quality Metrics

The system tracks these metrics for each ingestion run:

- **Chunks processed:** Total chunks, skipped chunks, failed chunks.
- **Entities extracted:** New entities, updated entities.
- **Relationships extracted:** New relationships.
- **Claims extracted:** By type (financial, legal, regulatory, etc.).
- **Pages created/updated:** By type.
- **Folders created:** New sub-folders under `entities/` and `topics/`.
- **Broken links:** Count and list.
- **Conflicts:** Manual-edit conflicts, preservation-check failures.
- **Token cost:** Total LLM tokens consumed.

These metrics are printed to the console at the end of `ingest` and saved to `.state/metrics.json`.
