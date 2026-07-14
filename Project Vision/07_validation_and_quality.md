# LLM Wiki CLI — Validation and Quality (Detailed)

This document specifies the validation and quality system of the LLM Wiki CLI. It explains how the system ensures that the generated wiki is complete, consistent, and trustworthy, and how it handles structural changes that require human judgment.

---

## 1. The Quality Philosophy

The LLM writes the wiki, but the system does not trust the LLM blindly. Every chunk of output is checked before it is committed to the wiki. The checks are layered:

1. **LLM-level review** — the Critic sub-agent reviews the LLM's own output.
2. **Deterministic checks** — local code verifies that the output matches the source material and follows the schema.
3. **Human review** — the user consumes the compiled wiki and reviews logged structural changes; the user can revert changes via version control or re-run commands with revised guidance.

This layered approach combines the flexibility of the LLM with the reliability of deterministic validation and the judgment of the human user.

---

## 2. Validation Order

For every chunk, the validation pipeline runs in this order:

### 2.1 Critic Review

The **Critic** is the seventh sub-agent in the orchestrator pipeline. It reviews the LLM-written pages and the page plan for:

- Quality and clarity of writing.
- Completeness — are all extracted tables, figures, and text preserved?
- Consistency — do wikilinks and citations make sense?
- Correctness — are claims properly attributed?
- Adherence to `AGENTS.md` — did the LLM follow the wiki's conventions?

If the Critic finds **blocking issues**, the chunk is not committed. Instead, the feedback is sent back to the earlier agents (usually the ChunkWriter, sometimes the PagePlanner) and the chunk is reprocessed. This loop continues until the Critic is satisfied or a maximum number of attempts is reached.

### 2.2 Deterministic Completeness Check

After the Critic approves, the local deterministic layer compares the LLM-written pages against the extracted input to ensure that:

- No text was dropped.
- Tables were preserved verbatim (or clearly described if they were too large).
- Figures were described.
- No material was materially altered (e.g., a number changed without a reason).

If the check fails, the chunk is reprocessed.

### 2.3 Deterministic Structural Checks

The local deterministic layer also checks:

- **Broken wikilinks** — every `[[Page Name]]` must point to an existing page.
- **Orphaned pages** — pages should have incoming links unless they are index or source pages.
- **Citation integrity** — every `[^srcN]` must map to a valid `sources` entry, and the source PDF must exist.
- **Duplicate entities** — the system flags entities with very similar names that may need to be merged.

### 2.4 Schema Validation

Every page must have valid YAML frontmatter and the required fields for its `type`. If a page is missing a required field or has an invalid value, the chunk is reprocessed.

---

## 3. Preservation-First Materialization

During `ingest`, the **ChunkMaterializer** writes or updates entity and topic pages immediately after each chunk passes the Critic and deterministic validation. Because existing pages may have been manually edited or may contain evidence from earlier chunks, the materializer follows a preservation-first protocol:

1. **Manual-edit detection.** Before calling the LLM, the materializer compares the current page content against the hash stored in `IngestionState`. If the page has been changed by a human since the last ingestion run, the materializer skips the LLM rewrite and reports the conflict.
2. **LLM update mode.** For pages that were not manually edited, the materializer passes the existing body to the LLM and asks for a regenerated body that includes the new evidence from the current chunk.
3. **Preservation check.** After the LLM returns a new body, the materializer verifies that every existing citation (`[^srcN]`) and every existing wikilink is still present. If the rewrite drops any prior content, the materializer reports the conflict and skips the update for that page.
4. **No deterministic fallback.** If the LLM update call fails, the materializer may retry the same LLM call with a stricter repair prompt. It must **not** fall back to deterministic page creation, deterministic append, or any other deterministic authoring of wiki content. If the repair also fails, the run aborts and the error is reported to the user.

Skipped updates are surfaced in the lint report and in the run log so the user knows which pages were not updated and why.

## 4. The Critic Agent

The Critic is the LLM's own quality checker. It is given:

- The extracted input for the chunk.
- The page plan produced by the PagePlanner.
- The markdown pages produced by the ChunkWriter.
- The current `AGENTS.md` and rolling memory.

The Critic produces a review report with one of two outcomes:

- **Approved** — the output is good enough to commit.
- **Blocked** — the output has issues that must be fixed before the chunk can be committed.

When blocked, the Critic's feedback includes:

- A list of issues.
- Which pages are affected.
- Suggested fixes.

The feedback is passed back to the ChunkWriter (or earlier agents), and the chunk is reprocessed. The Critic reviews the revised output again.

### 4.1 Critic Checklist

The Critic should verify at least the following:

- Does every factual claim have a citation?
- Are the citations mapped to real sources in the frontmatter?
- Are tables and figures preserved?
- Are all extracted paragraphs represented?
- Are wikilinks pointing to plausible pages?
- Does the page plan match the pages that were actually written?
- Are new page types documented in the folder-level `index.md`?
- Are the pages self-contained and readable?

---

## 5. Lint Report

After each ingestion run, the system writes a lint report to the wiki folder, at `wikis/<slug>/lint/report.json`. The report contains:

- Total page count and pages by type.
- Number of errors and warnings.
- Broken links.
- Orphaned pages.
- Citation integrity issues.
- Duplicate entity flags.
- Stale pages (pages whose source PDF has changed but which were not updated).

The lint report is for the human user. It does not block the pipeline unless configured to do so, but it highlights issues that need attention.

Example lint report structure:

```json
{
  "timestamp": "2026-07-07T10:00:00Z",
  "total_pages": 847,
  "pages_by_type": { "document": 412, "entity": 203, "topic": 89, "source": 45, "raw": 8 },
  "errors": 3,
  "warnings": 12,
  "broken_links": 2,
  "orphaned_pages": 8,
  "citation_issues": 1,
  "duplicate_entities_flagged": 4
}
```

---

## 6. Structural Change Log

When the PagePlanner discovers that the existing folder structure cannot accommodate the corpus, the LLM autonomously creates, moves, or renames folders and updates the page-type taxonomy. The orchestrator records each structural change with:

- **Reason** — why the change was needed.
- **Affected pages and folders** — what was moved or created.
- **New structure** — the new folder hierarchy or page-type taxonomy.
- **Pros and cons** — the trade-offs of the change.
- **Contract updates** — which `index.md` and `AGENTS.md` files were changed.

These records are written to a log (for example, `.kimi-code/proposals/` or an append-only section of `AGENTS.md`) so the human can review what changed after the fact. The LLM applies the change immediately and updates the affected contracts. If the human disagrees with a change, they can revert it via version control or re-run `sample` with revised guidance. There is no approval gate; the human is the consumer, not the gatekeeper, of structural evolution.

---

## 7. Re-Ingestion After Changes

When `AGENTS.md` or the folder structure changes, earlier chunks may no longer be organized correctly. The system must support **re-ingestion** of earlier chunks so that:

- Every page is placed in the correct folder.
- Every page follows the latest `AGENTS.md` conventions.
- The `index.md` contracts reflect the new structure.

Re-ingestion is efficient because the system tracks which PDFs have changed. Unchanged PDFs can be re-processed only if the structure or conventions have changed; otherwise, they are skipped.

---

## 8. Error Handling and Recovery

If a chunk, any LLM sub-agent, or the ChunkMaterializer's LLM update call fails validation or produces invalid/empty output, the system retries once with a stricter repair prompt so the LLM can correct its own output. The retry stays within the same LLM agent or materializer call; the system does **not** substitute deterministic page creation, deterministic page updates, deterministic append, or any other deterministic authoring of wiki content as a fallback. If the repaired output is still invalid, the run aborts and the error is reported to the user. The human operator must then fix the underlying issue (e.g., enable or reconfigure the LLM, adjust the prompt context, or skip the problematic source) and re-run the command.

---

## 9. Summary

Quality in the LLM Wiki CLI is enforced through three layers: the Critic reviews the LLM's output, deterministic checks verify completeness and integrity, and the human reviews the compiled wiki and logged structural changes. The lint report gives the user visibility into the wiki's health, and re-ingestion ensures that the wiki stays consistent as conventions evolve. This system makes the wiki both flexible and trustworthy: the LLM can adapt to the corpus, but it cannot silently drop details or break links.
