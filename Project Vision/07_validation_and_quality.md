# LLM Wiki CLI — Validation and Quality (Detailed)

This document specifies the validation and quality system of the LLM Wiki CLI. It explains how the system ensures that the generated wiki is complete, consistent, and trustworthy, and how it handles structural changes that require human judgment.

---

## 1. The Quality Philosophy

The LLM writes the wiki, but the system does not trust the LLM blindly. Every chunk of output is checked before it is committed to the wiki. The checks are layered:

1. **LLM-level review** — the Critic sub-agent reviews the LLM's own output.
2. **Deterministic checks** — local code verifies that the output matches the source material and follows the schema.
3. **Human approval** — the user approves structural changes that would alter the wiki's organization.

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

## 3. The Critic Agent

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

### 3.1 Critic Checklist

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

## 4. Lint Report

After each ingestion run, the system writes a lint report to the wiki's output folder, typically `output/lint/report.json`. The report contains:

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

## 5. Structural Change Proposals

When the PagePlanner discovers that the existing folder structure cannot accommodate the corpus, it creates a **structural change proposal**. The proposal includes:

- **Reason** — why the change is needed.
- **Affected pages and folders** — what would be moved or created.
- **Proposed new structure** — the new folder hierarchy or page-type taxonomy.
- **Pros and cons** — the trade-offs of accepting the change.
- **Required contract updates** — which `index.md` and `AGENTS.md` files need to change.

### 5.1 Approval Process

The approval process is **hybrid**:

- **Simple changes** (e.g., adding a single folder or a few new page types) are presented interactively in the CLI. The user approves or rejects on the spot.
- **Complex changes** (e.g., reorganizing the entire wiki or introducing a new top-level category) are written to a proposal file in `.kimi-code/proposals/` for the user to review and edit later. The user approves the file, and the change is applied on the next `sample` or `ingest` run.

If the user rejects a proposal, the system falls back to the existing structure. If the user accepts, the system:

1. Updates the affected `index.md` contracts.
2. Updates `AGENTS.md` to reflect the new conventions.
3. Re-ingests earlier chunks if necessary so that all pages follow the new structure.

### 5.2 When a Proposal Is Required

A proposal is required for:

- Creating a new folder.
- Moving a folder.
- Renaming a folder.
- Changing the wiki-level page-type taxonomy in a way that affects multiple folders.

A proposal is **not** required for:

- Creating a new page inside an existing folder.
- Creating a new page type inside an existing folder.
- Adding a page to an existing topic or entity page.

---

## 6. Re-Ingestion After Changes

When `AGENTS.md` or the folder structure changes, earlier chunks may no longer be organized correctly. The system must support **re-ingestion** of earlier chunks so that:

- Every page is placed in the correct folder.
- Every page follows the latest `AGENTS.md` conventions.
- The `index.md` contracts reflect the new structure.

Re-ingestion is efficient because the system tracks which PDFs have changed. Unchanged PDFs can be re-processed only if the structure or conventions have changed; otherwise, they are skipped.

---

## 7. Error Handling and Recovery

If a chunk fails validation repeatedly, the system has several options:

1. **Quarantine the chunk** — Write the extracted material to a `raw/` or `failed/` page for manual review, and continue with the next chunk.
2. **Fallback to deterministic extraction** — If the LLM cannot produce valid markdown, the system writes the extracted text verbatim with minimal markdown formatting.
3. **Abort the run** — For severe issues (e.g., a corrupted PDF or a persistent LLM failure), the system may abort and report the error to the user.

The chosen behavior is configurable per wiki in `AGENTS.md` or the workspace config.

---

## 8. Summary

Quality in the LLM Wiki CLI is enforced through three layers: the Critic reviews the LLM's output, deterministic checks verify completeness and integrity, and the human approves structural changes. The lint report gives the user visibility into the wiki's health, and re-ingestion ensures that the wiki stays consistent as conventions evolve. This system makes the wiki both flexible and trustworthy: the LLM can adapt to the corpus, but it cannot silently drop details or break links.
