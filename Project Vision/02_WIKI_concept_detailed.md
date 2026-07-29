# Paper Chase — Wiki Concept (Detailed)

This document explains the philosophy, requirements, and mechanics of the wiki pages produced by Paper Chase. It is written so that anyone joining the project without prior context can understand why the wiki is built the way it is, and what rules the system must follow when creating it.

---

## 1. The Core Idea

Paper Chase turns a collection of PDFs into a **wiki-of-wikis**: a set of interlinked markdown pages that together form a browseable, citation-backed knowledge base.

The central idea is borrowed from the **LLM Wiki Gist** by Andrej Karpathy:

> https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

In that gist, Karpathy observes that large texts often do not fit into an LLM's context window, and that even when they do, the model can lose track of subtle details. The solution is to split the text into many small, **self-contained wiki articles** that each contain rich context. A reader (human or AI) can then navigate from one article to another, following links and citations, without needing to read the entire original document.

This project applies that idea to investigative journalism. The source material is not a single book or manual, but a collection of confidential PDFs: leaked reports, political-donation filings, company registries, and other documents. The wiki makes the data usable by:

- Keeping every extracted detail on at least one page.
- Adding synthesized summaries, explanations, and connections written by the LLM.
- Linking every claim back to an exact source PDF and page range.
- Organizing pages into a discoverable folder structure with binding contracts.

---

## 2. What a Wiki Page Must Do

A wiki page must satisfy four requirements:

1. **Self-contained.** A reader should understand the page without reading the original PDF or any other page. The page contains enough context to stand alone.
2. **Cited.** Every factual claim has an inline citation `[^srcN]` that maps to a source entry in the frontmatter.
3. **Linked.** Pages connect to each other via `[[page-name|Page Title]]` wikilinks (Obsidian-native target|display form). No page is an island unless it is an index or source page.
4. **Preserved.** The raw extracted text, tables, and figure descriptions are preserved on the page (in the "Preserved Detail" section) so the reader can verify the synthesis against the original.

---


## 3. The Two-Layer Page

Every content page (entity, topic, document) has two layers:

### 3.1 Layer 1: LLM-Written Synthesis

At the top of the page, the LLM writes:
- A summary paragraph describing the entity/topic/chunk.
- Key claims with inline citations.
- Context, relationships, and analysis.
- Links to related pages.

This is what the journalist reads first. It is the "story" of the page.

### 3.2 Layer 2: Preserved Extracted Detail

Below the synthesis, the page contains:
- Full extracted text, organized by headings.
- Tables preserved verbatim as markdown tables.
- Figure descriptions.
- Every mention of the entity with its exact location.

This is the verification layer. If the journalist doubts a claim in the synthesis, they scroll down and find the original text.

### 3.3 Why Two Layers?

The synthesis makes the wiki readable. The preserved detail makes it trustworthy. Without synthesis, the wiki is a database dump. Without preserved detail, the wiki is a black box that the journalist cannot verify.

### 3.4 The Language of the Two Layers

Each layer has a fixed language rule (full model: `04_orchestration_detailed.md` §9):

- **Layer 1 (synthesis)** is written in the wiki's **output language** — a per-wiki setting chosen at `init` (default: English).
- **Layer 2 (preserved detail)** is always kept in the **source language, verbatim**. Quotes, mentions, claims, and extracted text are never translated or reworded.

The reason is the same verification contract as §3.3: the journalist verifies Layer 1 against Layer 2, and Layer 2 against the original PDF. A translated quote would match neither. An English wiki built from Danish PDFs therefore has English narrative with Danish evidence sections — readable at the top, verifiable at the bottom.

---

## 4. Page Completeness and Self-Containment

This section defines the standard of detail that every wiki page must meet. A page is not complete until it satisfies every criterion below.

### 4.1 The Self-Containment Rule

**Every content page must be fully understandable without the reader opening the original PDF or any other page.**

A journalist who opens a single entity page must have enough information to:
- Understand who or what the entity is.
- Know every claim made about the entity in the corpus.
- See every relationship the entity has with other entities.
- Verify every claim against its original source.
- Understand the context in which the entity appears.

The page must not assume the reader has read other pages. Wikilinks are for navigation and discovery, not for essential context.

### 4.2 What "Rich Text" Means

An entity page must contain more than a list of mentions. It must contain:

**A. Narrative Synthesis**
- A coherent paragraph (or several) that tells the story of the entity.
- Not a bullet list. Not a data dump. Readable prose.
- Example: "John Smith is the CEO of Acme Corp, a position he has held since 2019 [^src1]. Prior to Acme, he served as CFO of Beta Industries [^src2]. In 2024, Smith was mentioned in connection with a $42.5M revenue recognition dispute [^src3]."

**B. Chronological Context**
- When did events happen? Dates, years, quarters.
- The timeline must be explicit, not implied.
- Example: "Smith first appears in the 2019 annual report as a board member. By 2021, he is listed as CEO. The 2023 report notes his involvement in the offshore restructuring."

**C. Cross-Reference Context**
- How does this entity relate to the broader story?
- What other entities are connected? What topics are relevant?
- Example: "Smith's role in the offshore restructuring is discussed in detail under [[offshore-restructuring-2023|Offshore Restructuring 2023]]. His relationship with auditor [[pwc|PwC]] is documented in the [[audit-independence|Audit Independence]] topic page."

**D. Disambiguation**
- If the entity name is ambiguous (e.g., two people named "John Smith"), the page must clarify which one this is.
- Example: "This page refers to John Smith (born 1965), CEO of Acme Corp, not John Smith (born 1978), the independent director of Beta Industries."

### 4.3 What "All Relevant Details" Means

An entity page must include every piece of information from the corpus that is relevant to understanding the entity. This includes:

**A. Every Mention**
- Not just the first mention. Every mention, with context.
- Each mention must include: the exact quote or paraphrase, the page number, the source PDF, and the surrounding context.
- Example: "Page 12: 'John Smith, who joined the board in 2019, recommended the offshore restructuring.' [^src1]"

**B. Every Relationship**
- Every connection to another entity, with evidence and citation.
- Relationships must be bidirectional where possible: if Smith is CEO of Acme, the Acme page should link back to Smith.
- Example: "CEO of [[acme-corp|Acme Corp]] [^src1] | Board member of [[beta-industries|Beta Industries]] [^src2] | Donated $10,000 to [[senator-x|Senator X]] [^src3]"

**C. Every Claim**
- Every factual assertion about the entity, organized by type.
- Financial claims, legal claims, biographical claims, regulatory claims.
- Example: "Financial: Revenue under Smith's leadership grew from $30M to $42.5M [^src1]. Legal: Smith was named in a 2023 shareholder lawsuit [^src4]."

**D. Every Number and Date**
- Dollar amounts, percentages, dates, page counts, share counts.
- Numbers must include units and context.
- Example: "$42.5M (Q3 2024 revenue) [^src1] | 15% (gross margin) [^src1] | March 15, 2024 (board meeting date) [^src2]"

**E. Every Jurisdiction and Location**
- Where is the entity registered? Where does it operate?
- Example: "Acme BVI is registered in the British Virgin Islands [^src1]. Its operational headquarters is in London [^src2]."

### 4.4 What Is NOT Included on Entity/Topic Pages

**Raw extracted text from the PDF is NOT included on entity or topic pages.**

Raw extracted text belongs on:
- `document` pages (the raw chunk from the PDF).
- `source` pages (the provenance record).

Entity and topic pages contain **synthesis and structured detail**, not copy-pasted PDF text. The journalist can verify claims by following citations to the document pages, but the entity page itself must be a curated, readable article.

### 4.5 The "Journalist Test"

Before a page is considered complete, it must pass this test:

> A journalist who has never read the original PDFs opens this page. After reading it, they can explain the entity to a colleague, cite three specific facts with sources, and name two related entities. They do not need to open any other page or PDF to do this.

If the page fails this test, it is not complete. The LLM must add more detail, more context, or clearer synthesis.

### 4.6 Granularity of Pages

**One entity = one page.** Do not combine multiple entities into a single page, even if they are related.

- "John Smith" gets his own page.
- "Acme Corp" gets its own page.
- "The board of Acme Corp" is NOT a page. Each board member gets their own page, and the relationships are documented on those pages.

**One topic = one page, but topics can be granular.**

- "Revenue Recognition" is a valid topic page.
- "Revenue Recognition in Q3 2024" is also valid if the corpus justifies it.
- "Financial" is too broad. It should be a folder containing specific topic pages.

**Composite pages (amended 2026-07-29, user-ratified — the five-class rollup amendment):** the user directed (2026-07-29): *"I would rather the end-articles are longer, more detailed, more rich… I don't mind that a wiki article covers several entities if the entities logically map to each other."* This contradicts the strict reading of "One entity = one page… even if they are related" above and `05_page_types_specification.md` §6 (strict-identity merges only; never sub-unit→parent, never colocated-but-distinct). The user-resolved amendment — **composite pages are allowed ONLY within five checkable rollup classes** (member cap 2-4, sticky cluster records, manual split escape hatch, validation rejects out-of-class clusters):

1. **abbreviation/name-variant** (already legal strict identity — unchanged);
2. **brand↔generic substance** (`eliquis`↔`apixaban`);
3. **indicator↔measured concept, 1:1 only** (`indikator-1`↔`antibiotikabehandling`);
4. **facility↔city, only when the facility is the city's story** (`holbaek-hospital`↔`holbaek`);
5. **same-name different-type** (organization↔location: `region-hovedstaden`).

The graph stays entity-granular (relationships, extraction, identity); pages become cluster-granular for these classes only. A composite page (`type: composite`, see `05_page_types_specification.md` §6) pools its members' evidence into one rich article with the evidence grouped per member; member pages are not written; member names remain findable via the composite's `aliases`; member-targeted wikilinks resolve to the composite. Clusters are recorded as sticky decisions and can be dissolved by hand via the `splits` escape hatch in `.state/curation-decisions.json` (member pages rebuilt, composite removed, reversal logged). Out-of-class clustering is a validation error, never a silent judgment.

### 4.7 Page Length Guidelines

- **Minimum:** A page must contain at least one paragraph of synthesis, one mention, one relationship, and one source citation. If an entity has only one mention, the page is still valid but should be flagged as "sparse" in the frontmatter.
- **Maximum:** There is no hard maximum, but a page should not exceed 2000 words of synthesis. If an entity is so complex that it requires more, consider splitting into sub-pages (e.g., "John Smith — Early Career" and "John Smith — Acme Corp Tenure").
- **Target:** 300-800 words of synthesis, plus structured detail sections.

### 4.8 The "Sparse Page" Flag

If an entity has only one or two mentions and no significant claims or relationships, the page should include a `sparse` flag:

```yaml
---
title: "Jane Doe"
type: entity
sparse: true
---
```

The synthesis should explain: "Jane Doe is mentioned once in the corpus as a consultant to Acme Corp [^src1]. No further details are available."

This prevents the journalist from wasting time on pages that look substantial but contain no real information.

## 5. Page Types

The default page types are:

| Type | Purpose | Created by |
|---|---|---|
| `index` | Contract / navigation page | DOX Writer (deterministic) |
| `document` | One chunk of a source PDF | Layer 1 (deterministic) |
| `source` | Provenance catalog entry for a PDF | Layer 1 (deterministic) |
| `topic` | Theme or concept across the corpus | Layer 3 (Materializer) |
| `entity` | Named real-world thing | Layer 3 (Materializer) |
| `raw` | Unparseable or scanned PDF page | Layer 1 (deterministic) |

The page-type taxonomy is **not hard-coded**. The LLM may create new types (e.g., `timeline`, `claim`, `transaction`, `case`) when the corpus demands them. New types must be documented in the folder-level `index.md` and in the wiki's `AGENTS.md`.

---

## 6. Citations

### 6.1 The Core Rule

**Every factual claim on a wiki page must be traceable to a specific location in a specific source PDF.**

A "factual claim" includes:
- Numbers, dates, and amounts.
- Names and identities.
- Direct quotes.
- Assertions of fact (e.g., "X is the CEO of Y").
- Data in tables and figures.

Synthesis that is clearly the LLM's own framing (e.g., "This section discusses...") does not require a citation, but any derived conclusion should be backed by cited evidence.

### 6.2 Citation Format

Citations are inline footnote-style markers:

```markdown
The company reported revenue of $42.5M in Q3 2024 [^src1].
```

The marker `[^src1]` corresponds to a `sources` entry in the page's YAML frontmatter. The key is local to the page: `src1` on one page does not have to refer to the same source as `src1` on another page.

### 6.3 Citation Key Rules

- Citation keys are unique within a page.
- The recommended format is `[^srcN]`, where `N` is an integer starting at 1.
- Multiple claims from the same source range reuse the same key.
- A single claim supported by multiple sources can use multiple keys.

### 6.4 Source Frontmatter

```yaml
sources:
  - file: "wikis/acme/raw/annual-report-2024.pdf"
    pages: "42-43"
    extracted: "2026-07-16T10:00:00Z"
    sha256: "a1b2c3d4e5f6..."
    label: "Acme Annual Report 2024"
```

---

## 7. LLM-Written vs. Deterministic Content

The LLM is the author of all synthesized markdown content. Deterministic provenance/preservation pages (`source` and `raw` page types) are generated deterministically from extraction metadata. The local deterministic layer is responsible for:

- Extracting text, tables, and metadata from PDFs.
- Computing file hashes and managing file paths.
- Running schema and link validation.
- Orchestrating the LLM pipeline.
- Generating deterministic `source` and `raw` provenance/preservation pages.
- Writing `index.md` navigation contracts.

The LLM is responsible for:

- Deciding what entities exist and what folders they belong in.
- Extracting relationships and claims from chunks.
- Writing readable synthesis for entity, topic, and document pages.
- Updating existing pages with new evidence (in update mode).

---

## 8. Compounding Over Time

The wiki is not a one-off export. It is a living knowledge base that grows richer with each ingestion pass:

- New PDFs add new entities, topics, and claims.
- Existing entity pages are updated with new mentions and relationships.
- New links are added between pages.
- New sub-folders are created when the corpus demands them.
- The DOX contracts are regenerated to reflect the new structure.

Nothing is lost. The journalist can add a new batch of PDFs at any time and the wiki will compound.
