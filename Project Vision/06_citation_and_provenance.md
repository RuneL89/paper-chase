# Paper Chase — Citation and Provenance Model (Detailed)

This document specifies how citations and provenance work in Paper Chase. It is written for implementers and contributors who need to understand exactly how a claim on a wiki page is traced back to an exact location in a source PDF, and how the system ensures that traceability remains intact over time.

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
title: "Part 1: Annual Report 2024"
type: document
sources:
  - file: "wikis/acme-reports/raw/annual-report-2024.pdf"
    pages: "1-15"
    extracted: "2026-07-16T10:00:00Z"
updated: "2026-07-16T10:00:00Z"
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
    extracted: "2026-07-16T10:00:00Z"
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
- Extraction warnings (e.g., scanned pages, malformed text).
- Links to the document pages derived from this source.
- Links to the source PDF file for direct access.

When a reader clicks a citation like `[^src1]`, they can follow the source entry to the `source` page, and from there to the original PDF.

---

## 5. Where Citations Appear

Citations should appear in two places:

1. **In the LLM-written synthesis** — Every factual claim in the summary or analysis section must have a citation.
2. **In the preserved extracted detail** — When a paragraph, table, or figure comes from a specific page range, the page range should be noted, either inline or at the section boundary.

For example, a document page might have a section header like:

```markdown
## Extracted Text: Pages 1–15
```

And an entity page might have:

```markdown
## Mentions

- Page 3: "John Smith, CEO of Acme Corp" [^src1]
- Page 47: "John Smith previously served as CFO of Beta Industries" [^src2]
```

---

## 6. Citation Integrity Over Time

When a page is updated with new evidence (e.g., a new PDF mentions the same entity), the Materializer must:

1. Preserve all existing citations and their source mappings.
2. Add new citations for new evidence.
3. Re-number citation keys if necessary to maintain sequential order.
4. Update the `sources` frontmatter to include the new source PDF.

The **preservation check** verifies that every existing citation from the old page still exists in the updated page. If a citation is dropped, the update is rejected and the conflict is logged.

---

## 7. Verification Workflow

A journalist verifying a claim follows this path:

1. Read the claim on the entity page: "Revenue was $42.5M in Q3 2024 [^src1]."
2. Scroll to the `sources` section at the bottom of the page.
3. Find `[^src1]: annual-report-2024.pdf, pages 12-15`.
4. Open the `source` page for `annual-report-2024.pdf`.
5. Click the link to the original PDF.
6. Open the PDF to pages 12-15 and verify the claim.

This path must work for every citation on every page. Broken citations are treated as bugs.

---

## 8. Source-Language Evidence

The citation model is language-anchored: **evidence is always preserved in the language of the source PDF, verbatim.**

- Mention quotes, relationship evidence, claim text, and extracted passages are never translated or reworded, whatever the wiki's output language is.
- Synthesis prose (Layer 1) may be written in the wiki's output language, but it cites — and never replaces — the source-language evidence below it.
- The verification workflow (§7) depends on this: a reader opening the PDF to pages 12–15 must find the quoted words. A translated quote would fail that check.

Cross-reference: the full input/output language model is specified in `04_orchestration_detailed.md` §9.
