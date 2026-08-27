# Paper Chase — Validation and Quality (Detailed)

This document specifies the validation and quality system of Paper Chase. It explains how the system ensures that the generated wiki is complete, consistent, and trustworthy, and how it handles structural changes that require human judgment.

---

## 1. The Quality Philosophy

The LLM writes the wiki, but the system does not trust the LLM blindly. Every chunk of output is checked before it is committed to the wiki. The checks are layered:

1. **Schema validation** — Is the Extractor JSON valid and complete?
2. **Deterministic checks** — Local code verifies that the output matches the source material and follows the schema, including the per-ingest curation decision lists (topic merge/drop/keep, entity merges), which are validated entry-by-entry before anything is applied (§2.3).
3. **Human review** — The user consumes the compiled wiki and reviews logged structural changes; the user can revert changes via version control or re-run commands with revised guidance.

This layered approach combines the flexibility of the LLM with the reliability of deterministic validation and the judgment of the human user.

**Note:** The original vision included an LLM-level Critic agent. This architecture removes the Critic in favor of deterministic validation and prompt engineering. The Critic added complexity and cost without proportional reliability gains for a solo developer. The per-ingest curation pass (amended 2026-07-23, §2.3) is not the Critic returning: it is one bounded structured-output call per concern (topics, entities) whose decision list is validated deterministically and whose every failure mode lands on a deterministic keep-all fallback — no free-floating judgment over page content, at a cost of pennies per ingest.

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

If schema validation fails, the chunk is rejected and the error is logged (after the feedback-retry loop of §5 is exhausted).

### 2.2 Folder Validation

Before the Materializer creates folders, the system checks:

- Every entity `folder` starts with `entities/` or `topics/`.
- No path traversal (`../`, absolute paths).
- Folder depth does not exceed 3 levels below `entities/` or `topics/`.
- No duplicate slugs within the same folder.

If folder validation fails, the chunk is rejected (after the feedback-retry loop of §5 is exhausted).

### 2.3 Curation Decision-List Validation

After the Materializer aggregates the extraction data and before any topic or entity page is written, the per-ingest curation calls (topic merge/drop/keep; entity merge-only — `04_orchestration_detailed.md` §3.2 Step 6) return strict JSON decision lists. Deterministic code validates the complete list before anything is applied:

- Every slug mentioned exists in the candidate set (which includes the existing on-disk topics and entities).
- Every candidate slug appears in exactly one bucket — the `keep` bucket is derived by code as the complement (input minus merges, drops, and `unsure`), never listed in the output, so the decision list stays within its output-token ceiling (amended 2026-07-25, user-ratified); candidate sets whose estimated decision-list size approaches the ceiling are split into lexical-stem buckets before the call.
- Every merge target is itself kept — not dropped, not merged away.
- No self-merges; merge chains are resolved by union-find rather than rejected.

Violations are fed back to the LLM with the exact offending entries (the §5 feedback-retry loop). If the list still fails, curation is skipped entirely — the keep-all fallback, exactly the pre-curation behavior. Decisions are applied all-or-nothing, so a malformed list can never half-merge or wrongly delete anything.

### 2.4 Deterministic Completeness Check

After the Synthesis Writer (Phase 5+) generates a synthesized page, the system compares the LLM-written page against the structured data to ensure:

- Every mention from the structured data appears in the markdown.
- Every relationship from the structured data appears in the markdown.
- Every claim from the structured data appears in the markdown.
- Tables from the original PDF are preserved verbatim (or clearly described if too large).
- Figures are described.
- No material was materially altered (e.g., a number changed without a reason).

The check is a **verbatim substring comparison**. Because preserved detail (Layer 2) is always kept in the source language (`02_WIKI_concept_detailed.md` §3.4), the Synthesis Writer must never translate or reword Layer 2 items — a translated mention or claim fails this check and the page falls back to the structured template.

If the check fails, the synthesized page is rejected and the structured template is kept instead.

### 2.5 Deterministic Structural Checks

The system also checks:

- **Broken wikilinks** — every `[[Page Name]]` must point to an existing page.
- **Orphaned pages** — pages should have incoming links unless they are index or source pages.
- **Citation integrity** — every `[^srcN]` must map to a valid `sources` entry, and the source PDF must exist.
- **Duplicate entities** — the system flags entities with very similar names that may need to be merged.

### 2.6 Schema Validation (Pages)

Every page must have valid YAML frontmatter and the required fields for its `type`. If a page is missing a required field or has an invalid value, the error is logged.

---

## 3. Preservation-First Materialization

During `ingest`, the Materializer writes or updates entity and topic pages. Because existing pages may have been manually edited or may contain evidence from earlier chunks, the materializer follows a preservation-first protocol:

1. **Manual-edit detection.** Before updating a page, the materializer compares the current page content against the hash stored in `.state/ingestion.json`. If the page has been changed by a human since the last ingestion run, the materializer skips the update and reports the conflict.

2. **Merge, don't replace.** For pages that were not manually edited, the materializer merges new evidence into the existing page structure. It does not regenerate the entire page from scratch unless the Writer is invoked (Phase 6+).

3. **Preservation check.** After updating a page (or after the Writer regenerates it), the materializer verifies that every existing citation (`[^srcN]`) and every existing wikilink is still present. If the update drops any prior content, the materializer reports the conflict and skips the update for that page.

   **Patched pages (added 2026-08-26, user-ratified):** when a page is amended by a patch (per-PDF loop, `04_orchestration_detailed.md` Step 9), the preservation check runs over the MERGED page and must find, verbatim, every evidence item the page already preserved AND every item of the new evidence the patch was supposed to add. A patch that drops prior content, mangles an anchor, or fails to land its own additions is a content defect: it reenters the reask loop, and on exhaustion the page is re-synthesized in full — a page is never left half-patched.

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

The system follows a **fail loud** philosophy, with a bounded-retry amendment (user-ratified 2026-07-20) and a feedback-retry carve-out (user-ratified 2026-07-23):

- If the Extractor returns invalid JSON or schema-violating output, the error is logged and the output is **fed back to the LLM with the validator's exact error list** for correction (the "reask" pattern), up to 3 total attempts; if still failing, the chunk is rejected and the error is logged.
- If the Writer drops content after the bounded feedback retries below, the synthesized page is rejected and the structured template is kept.
- If a preservation check fails after the bounded retries below, the update is skipped and the conflict is logged.
- **Deterministic failures are never retried** — HTTP 4xx responses fail immediately. Retrying those would mask configuration problems and burn tokens.
- **Transient transport failures** (HTTP 429/5xx, network errors, timeouts) are retried with backoff, up to 3 total attempts per call, each attempt logged. At the per-page synthesis stages, a transport failure still throwing after those retries falls back per page to the deterministic structured template (logged loudly, counted in metrics — amended 2026-07-25, user-ratified), and the run aborts only when the outage detector fires: 5 consecutive transport-failed pages, or more than 10% of a stage's pages. HTTP 4xx never falls back per page — it aborts immediately, as a configuration problem must never silently template a wiki.
- **Quality failures** — a preservation-check failure, an unparseable/incomplete DOX Writer or workspace-pass response, or an incomplete AGENTS.md Updater response — are retried up to 3 total attempts **with the validator's exact findings fed back** (dropped mentions/relationships/claims/citations, missing sections) before the deterministic fallback, because they are partly LLM variance rather than prompt defects. A curation decision list that fails deterministic validation (§2.3) follows the same loop with the exact offending entries fed back. A patch output that is unparseable, anchors nowhere, or whose merged page fails preservation follows the same loop and falls back to full synthesis (added 2026-08-26, user-ratified — `04_orchestration_detailed.md` §6).
- **Curation failures never lose data** — if a curation decision list still fails validation after the bounded feedback retries, or the curation call fails transiently after backoff, or it fails deterministically (HTTP 4xx), the curation pass is skipped for that run (the keep-all fallback): every candidate topic and entity is written exactly as the uncurated aggregate produced it. The fallback is logged, and the next successful ingest re-curates everything, because the curation input includes the existing on-disk topics and entities.
- An elevated feedback-repair rate in a run (more than 25% of the run's LLM calls, or 5 or more repairs) triggers a prompt-quality warning.

After the bounded retries are exhausted, the user fixes the prompt, the PDF, or the `AGENTS.md` and re-runs `ingest`.

**Output-token ceilings (amended 2026-07-23, user-ratified):** per-call output-token caps are safety ceilings, not length controllers (synthesis family 32768, DOX Writer 8192, Extractor 32768 — raised from 16384 on 2026-07-24, user-ratified). A response that hits its ceiling is truncated and is therefore treated as the quality failure it surfaces as — unparseable or missing content — under the rules above.

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
