# LLM Wiki CLI — Page Types Specification (Detailed)

This document specifies the page types produced by the LLM Wiki CLI. It is written for implementers and contributors who need to know exactly what frontmatter, content, and naming conventions each page type requires. A reader with no prior context should be able to produce a valid page of each type after reading this document.

---

## 1. Overview

The LLM Wiki CLI generates a wiki of interlinked markdown pages. Each page has a `type` field in its YAML frontmatter. The default page types are:

| Type | Purpose | Created by |
|---|---|---|
| `index` | Contract / navigation page | `sample` and `ingest` |
| `document` | One chunk of a source PDF | `ingest` |
| `source` | Provenance catalog entry for a PDF | `ingest` |
| `topic` | Theme or concept across the corpus | `ingest` |
| `entity` | Named real-world thing | `ingest` |
| `raw` | Unparseable or scanned PDF page | `ingest` |

The page-type taxonomy is **not hard-coded**. The LLM may create new types (e.g., `timeline`, `claim`, `transaction`, `case`) when the corpus demands them. New types must be documented in the folder-level `index.md` and in the wiki's `AGENTS.md`.

---

## 2. Common Frontmatter Rules

Every page, regardless of type, must have:

```yaml
---
title: "Page Title"
type: "document"  # or another valid type
updated: "2026-07-07T10:00:00Z"
---
```

Optional but common fields:

- `created` — ISO 8601 timestamp of first creation.
- `wiki` — the wiki slug this page belongs to.
- `tags` — a list of tags for indexing and navigation.
- `confidence` — `high`, `medium`, or `low`, indicating how confident the LLM is in the extracted content.

The `type` field is free-form but must be declared in the folder-level `index.md` contract if it is not one of the six default types.

---

## 3. The `index` Page Type

`index` pages are contracts, not content. They tell the reader how the wiki or folder is organized and what to expect inside.

### 3.1 Frontmatter

```yaml
---
title: "Adhd"
type: index
wiki: adhd
updated: "2026-07-07T10:00:00Z"
children:
  - documents/index.md
  - sources/index.md
  - entities/index.md
  - topics/index.md
  - raw/index.md
---
```

### 3.2 Content Structure

An `index` page typically contains:

- **Title and scope** — what this wiki or folder is about.
- **Catalog** — a list of folders or pages inside.
- **Navigation** — guidance on where to start.
- **Contract** — the rules that pages inside this folder must follow (page types, naming conventions, citation format).
- **Statistics** — counts of sources, pages, and page types.

### 3.3 Levels of Index

| Level | File | Purpose |
|---|---|---|
| Workspace | `index-of-indexes.md` | Lists all wikis in the workspace. |
| Wiki | `wikis/<slug>/index.md` | Lists all folders and the wiki's scope. |
| Folder | `wikis/<slug>/<folder>/index.md` | Lists pages in the folder and the folder's contract. |

### 3.4 Naming Convention

`index.md` inside the folder it governs. No slug needed.

---

## 4. The `document` Page Type

A `document` page represents one chunk of a source PDF. It is the primary container for the raw material of the corpus.

### 4.1 Frontmatter

```yaml
---
title: "Part 1: ADHD_2020"
type: document
wiki: adhd
tags: ["adhd", "diagnosis", "2020"]
confidence: high
sources:
  - file: "wikis/adhd/raw/ADHD_2020.pdf"
    pages: "1-15"
    extracted: "2026-07-07T10:00:00Z"
updated: "2026-07-07T10:00:00Z"
---
```

### 4.2 Content Structure

A `document` page has two layers:

1. **LLM-written synthesis** at the top:
   - Summary of the chunk.
   - Key claims with citations.
   - Links to related entities, topics, and sources.

2. **Preserved extracted detail** below:
   - Full text, organized by headings.
   - Tables preserved verbatim as markdown tables.
   - Figure descriptions.

### 4.3 Naming Convention

For a source with slug `adhd-2020` and chunk number `001`:

```
documents/adhd-2020-part-001.md
```

For a small PDF that fits in one chunk:

```
documents/<source-slug>.md
```

---

## 5. The `source` Page Type

A `source` page is a deterministic provenance record for one PDF.

### 5.1 Frontmatter

```yaml
---
title: "Source: ADHD_2020.pdf"
type: source
wiki: adhd
file: "wikis/adhd/raw/ADHD_2020.pdf"
sha256: "a1b2c3d4e5f6..."
pages: 120
ingested: "2026-07-07T10:00:00Z"
updated: "2026-07-07T10:00:00Z"
warnings:
  - "Pages 3, 48 appear to be scanned or image-only."
---
```

### 5.2 Content Structure

A `source` page contains:

- A brief description of the PDF.
- A table of metadata (file path, size, page count, hash, extraction timestamp).
- A list of warnings (e.g., scanned pages, malformed text).
- Links to the document pages derived from this source.
- Links to the source PDF file for direct access.

### 5.3 Naming Convention

```
sources/<source-slug>.md
```

The source slug is derived from the filename without extension.

---

## 6. The `entity` Page Type

An `entity` page is about a named real-world thing: a person, organization, company, location, product, etc.

### 6.1 Frontmatter

```yaml
---
title: "Russell Barkley"
type: entity
wiki: adhd
tags: ["researcher", "adhd", "psychologist"]
mentions: 23
updated: "2026-07-07T10:00:00Z"
---
```

### 6.2 Content Structure

An `entity` page contains:

- An LLM-written description of who or what the entity is.
- The entity's role in the corpus.
- A list of relationships (e.g., "employee of X," "donor to Y").
- A complete list of every mention of the entity across the corpus, with citations.

### 6.3 Naming Convention

```
entities/<normalized-name-slug>.md
```

The slug is derived from the normalized entity name. For example, "Russell Barkley" becomes `russell-barkley.md`.

---

## 7. The `topic` Page Type

A `topic` page is about a theme or concept that appears across multiple sources.

### 7.1 Frontmatter

```yaml
---
title: "Executive Function"
type: topic
wiki: adhd
tags: ["cognitive", "symptom", "adhd"]
related:
  - documents/adhd-2020-part-001.md
  - entities/russell-barkley.md
updated: "2026-07-07T10:00:00Z"
---
```

### 7.2 Content Structure

A `topic` page contains:

- An LLM-written overview of the theme.
- Why the theme matters in this corpus.
- Key evidence and claims about the theme, with citations.
- Links to related entities, documents, and other topics.

### 7.3 Naming Convention

```
topics/<topic-slug>.md
```

---

## 8. The `raw` Page Type

A `raw` page preserves material from a PDF page that could not be parsed cleanly.

### 8.1 Frontmatter

```yaml
---
title: "Raw: ADHD_2020.pdf page 003"
type: raw
wiki: adhd
source: "ADHD_2020.pdf"
page: 3
reason: "scanned / image-only"
updated: "2026-07-07T10:00:00Z"
---
```

### 8.2 Content Structure

A `raw` page contains:

- The source PDF and page number.
- The reason the page was placed in `raw`.
- Any OCR text or image metadata that could be extracted.
- A note that the content may need manual review.

### 8.3 Naming Convention

```
raw/<source-slug>-page-<NNN>.md
```

---

## 9. New Page Types

The LLM may create new page types when the corpus demands them. The process is:

1. The PagePlanner identifies the need for a new type.
2. If the new type fits inside an existing folder, it is auto-created.
3. The new type is documented in the folder-level `index.md` and in `AGENTS.md`.
4. If the new type requires a new folder, the orchestrator proposes a structural change for human approval.

Examples of new page types:

| Type | Use case |
|---|---|
| `timeline` | A chronological sequence of events |
| `claim` | A specific assertion made in the sources |
| `case` | A legal case or investigation |
| `transaction` | A financial transaction |
| `relationship` | A focused connection between two entities |

New page types should follow the same two-layer structure: LLM-written synthesis at the top, preserved extracted detail below, with citations throughout.

---

## 10. Page Type Discovery Checklist

When the LLM processes a chunk, it should ask:

- Does this chunk belong to an existing `document` page or a new one?
- Does it mention any entities that should have `entity` pages?
- Does it introduce or reinforce any themes that should have `topic` pages?
- Does it contain any tables or figures that must be preserved?
- Are there any pages that should be `raw` because they are unparseable?
- Does the corpus demand a new page type?

If the answer to any question is yes, the PagePlanner creates or updates the appropriate page.

---

## 11. Summary

The six default page types cover the essential structure of the wiki: contracts (`index`), raw content (`document`), provenance (`source`), themes (`topic`), named things (`entity`), and unparseable fragments (`raw`). The LLM can extend this taxonomy as needed, as long as each new type is documented in the folder-level contracts and `AGENTS.md`. Every page must have valid YAML frontmatter, a self-contained body, and citations for every factual claim.
