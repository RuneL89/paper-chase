# LLM Wiki CLI — Citation and Provenance Model (Detailed)

This document specifies how citations and provenance work in the LLM Wiki CLI. It is written for implementers and contributors who need to understand exactly how a claim on a wiki page is traced back to an exact location in a source PDF, and how the system ensures that traceability remains intact over time.

---

## 1. The Core Rule

**Every factual claim on a wiki page must be traceable to a specific location in a specific source PDF.**

This is what makes the wiki different from a RAG system or a generic summary. A reader (human or AI) should be able to look at any claim, see where it came from, and verify it against the original source.

A "factual claim" includes:

- Numbers, dates, and amounts.
- Names and identities.
- Direct quotes.
- Assertions of fact (e.g., "X is the CEO of Y").
- Data in tables and figures.

Synthesis that is clearly the LLM's own framing (e.g., "This section discusses...") does not require a citation, but any derived conclusion should be backed by cited evidence.

---

## 2. Citation Format

Citations are inline footnote-style markers:

```markdown
The company reported revenue of $42.5M in Q3 2024 [^src1].
```

The marker `[^src1]` corresponds to a `sources` entry in the page's YAML frontmatter. The key is local to the page: `src1` on one page does not have to refer to the same source as `src1` on another page.

### 2.1 Citation Key Rules

- Citation keys are unique within a page.
- The recommended format is `[^srcN]`, where `N` is an integer starting at 1.
- Multiple claims from the same source range reuse the same key:

```markdown
Revenue was $42.5M [^src1], and gross margin was 68% [^src1].
```

- A single claim supported by multiple sources can use multiple keys:

```markdown
The donation was $10,000 [^src1] [^src2].
```

---

## 3. Source Frontmatter Schema

The `sources` field in the frontmatter is a list of source entries. Each entry identifies the source PDF and the exact page range that the citation refers to.

```yaml
---
title: "Part 1: ADHD_2020"
type: document
sources:
  - file: "wikis/adhd/raw/ADHD_2020.pdf"
    pages: "1-15"
    extracted: "2026-07-07T10:00:00Z"
updated: "2026-07-07T10:00:00Z"
---
```

### 3.1 Required Fields

| Field | Description |
|---|---|
| `file` | Relative path to the source PDF. |
| `pages` | Page range in the PDF that the cited material comes from. Use comma-separated ranges for disjoint pages (e.g., `"1-5, 8, 12-15"`). |

### 3.2 Optional Fields

| Field | Description |
|---|---|
| `extracted` | ISO 8601 timestamp of when the PDF was extracted. |
| `sha256` | SHA-256 hash of the source PDF at the time of extraction. |
| `label` | A human-readable label for the source (e.g., "2024 Annual Report"). |

### 3.3 Example

```yaml
sources:
  - file: "wikis/donations/raw/eu_donations_2024.pdf"
    pages: "42-43"
    extracted: "2026-07-07T10:00:00Z"
    sha256: "a1b2c3d4e5f6..."
    label: "EU Political Donations 2024"
```

---

## 4. Provenance Pages

Every source PDF has a corresponding `source` page. The `source` page is the provenance anchor for all citations to that PDF.

A `source` page contains:

- The filename and relative path.
- The SHA-256 hash of the file.
- Page count and metadata.
- Extraction warnings (e.g., scanned pages).
- Links to the document pages derived from the source.

When a reader clicks a citation like `[^src1]`, they can follow the source entry to the `source` page, and from there to the original PDF.

---

## 5. Where Citations Appear

Citations should appear in two places:

1. **In the LLM-written synthesis** — Every factual claim in the summary or analysis section must have a citation.
2. **In the preserved extracted detail** — When a paragraph, table, or figure comes from a specific page range, the page range should be noted, either inline or at the section boundary.

For example, a document page might have a section header like:

```markdown
## Extracted Text: Pages 1–15

[^src1]: wikis/adhd/raw/ADHD_2020.pdf, pages 1-15
```

---

## 6. Citation Integrity

The deterministic validation layer checks citation integrity:

- Every `[^srcN]` in the body must map to a `sources` entry in the frontmatter.
- Every `sources` entry must point to a PDF that exists in the wiki's `raw/` folder.
- The page range must be valid for that PDF.
- The source page for that PDF must exist.

If any check fails, the chunk is reprocessed.

---

## 7. Re-Ingestion and Citation Updates

When a PDF is changed and re-ingested:

- The SHA-256 hash changes, so the system detects the change.
- The derived document pages are updated.
- Citations on those pages are updated if the page ranges changed.
- Entity and topic pages that reference the old source are updated with the new citations.

When a PDF is removed:

- The derived document pages are marked as stale or removed.
- Citations pointing to that source are flagged in the lint report for human review.

---

## 8. Verifying a Claim

A reader verifying a claim should follow this path:

1. Find the inline citation on the wiki page, e.g., `[^src1]`.
2. Look at the `sources` entry for `src1` in the frontmatter.
3. Note the source PDF and page range.
4. Open the `source` page for that PDF to confirm provenance.
5. Open the original PDF at the cited page range to verify the claim.

Because the full extracted text is also preserved on the wiki page, the reader can often verify the claim without leaving the wiki.

---

## 9. Special Cases

### 9.1 Claims Spanning Multiple Sources

If a claim is synthesized from multiple sources, cite all of them:

```markdown
The total donations exceeded €1M across the 2022 and 2023 filings [^src1] [^src2].
```

### 9.2 Tables and Figures

Every cell in a table that comes from a PDF should be traceable to the source. The table itself is preserved on the page, and the table caption or section header includes the citation:

```markdown
| Year | Donor | Amount |
|------|-------|--------|
| 2022 | Acme  | €10,000 |
| 2023 | Acme  | €15,000 |

Source: [^src1]
```

### 9.3 Scanned Pages

If a PDF page is scanned and cannot be parsed, the material is placed in a `raw` page. Any claim that would have come from that page is either not made or is explicitly marked as needing verification. The `raw` page itself does not contain citations, but it links to the source page for the PDF.

---

## 10. Summary

The citation model is the foundation of the wiki's trustworthiness. Every factual claim is backed by an inline `[^srcN]` citation, which maps to a `sources` entry in the frontmatter, which points to a specific PDF and page range. A `source` page provides the provenance anchor, and a deterministic validation layer ensures that citations remain valid as the corpus evolves. The reader can verify any claim by following the citation back to the original source.
