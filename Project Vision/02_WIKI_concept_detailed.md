# LLM Wiki CLI — Wiki Concept (Detailed)

This document explains the philosophy, requirements, and mechanics of the wiki pages produced by the LLM Wiki CLI. It is written so that anyone joining the project without prior context can understand why the wiki is built the way it is, and what rules the LLM must follow when creating it.

---

## 1. The Core Idea

The LLM Wiki CLI turns a collection of PDFs into a **wiki-of-wikis**: a set of interlinked markdown pages that together form a browseable, citation-backed knowledge base.

The central idea is borrowed from the **LLM Wiki Gist** by Andrej Karpathy:

> https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

In that gist, Karpathy observes that large texts often do not fit into an LLM's context window, and that even when they do, the model can lose track of subtle details. The solution is to split the text into many small, **self-contained wiki articles** that each contain rich context. A reader (human or AI) can then navigate from one article to another, following links and citations, without needing to read the entire original document.

This project applies that idea to investigative journalism. The source material is not a single book or manual, but a collection of confidential PDFs: leaked reports, political-donation filings, company registries, and other documents. The wiki makes the data usable by:

- Keeping every extracted detail on at least one page.
- Adding synthesized summaries, explanations, and connections written by the LLM.
- Linking every claim back to an exact source PDF and page range.
- Organizing pages into a discoverable folder structure with binding contracts.

### 1.1 Philosophy: The LLM is the Programmer, the Wiki is the Codebase

The LLM Wiki Gist frames the system as:

> "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."

This means the human's job is to **provide the raw sources and consume the compiled wiki**. The LLM's job is **everything else**: writing pages, adding links, updating content, deciding when the folder structure needs to change, maintaining the folder structure, and keeping the wiki consistent.

The human does not write the wiki pages. The human does not decide the exact folder structure or approve structural changes. The human places the PDFs and the LLM turns them into a structured, navigable, citation-backed knowledge base. The human then reads, verifies, and interprets the result.

This division of labor is what makes the system scalable. A journalist can throw a thousand-page leak at the CLI, ask it to "organize this by company and jurisdiction," and the LLM will do the mechanical work. The journalist can then focus on the story.

---

## 2. The Unskippable Requirement: All Data Must Be Included

The most important rule of the wiki is that **no extracted data may be left out**.

When the CLI ingests a PDF, the local deterministic layer extracts every page of text, every table, every figure caption, and every detected heading. The LLM must then turn this extracted material into markdown pages. It is not allowed to skip a section because it seems unimportant, to summarize it in a way that removes detail, or to omit a table because it is complicated.

Specifically:

- **Every page of every PDF** must be represented somewhere in the wiki.
- **Every table** must be preserved, either in a document page or in a topic/entity page that references it.
- **Every figure or image** must be described and preserved.
- **Every named entity** (person, organization, company, location, etc.) that appears in the corpus should be considered for an entity page.
- **Every recurring theme** should be considered for a topic page.

If the LLM cannot place a piece of extracted data into an existing page, it must create a new page or a new page type for it. This is why the page-type taxonomy is not hard-coded: the LLM must have the freedom to create new containers when the corpus demands them.

The only exception is scanned or unparseable pages, which are placed in `raw` pages so the user knows the material exists but could not be read.

---

## 3. Self-Contained Articles with Rich Context

Each wiki page should be **self-contained**. A reader should be able to open any page and understand it without first reading the original PDF or every other wiki page.

This means:

- A page does not just list a name and a link; it explains what the thing is.
- An entity page does not just say "John Smith is mentioned on pages 12, 45, and 78." It describes who John Smith is in this corpus, what role he plays, what relationships he has, and what claims are made about him.
- A document page does not just dump the extracted text. It begins with an LLM-written summary and key claims, then preserves the full text, tables, and figures below.
- A topic page does not just list related pages. It explains the theme, why it matters, and how it connects the sources.

At the same time, every page is **richly linked**: citations point to source PDFs, and wikilinks (`[[Page Name]]`) point to related entity, topic, and document pages. The reader can drill down or follow connections without losing the original context.

---

## 4. LLM-Written vs. Deterministic Content

The LLM is the author of all synthesized markdown content. Deterministic provenance/preservation pages (`source` and `raw` page types) are generated deterministically from extraction metadata. The local deterministic layer is only responsible for:

- Extracting text, tables, and metadata from PDFs.
- Computing file hashes and managing file paths.
- Running schema and link validation.
- Orchestrating the LLM pipeline.
- Generating deterministic `source` and `raw` provenance/preservation pages.

The LLM is responsible for:

- Deciding what synthesized content pages exist (`document`, `entity`, `topic`, and derived types).
- Writing summaries and analyses.
- Transcribing extracted text into markdown.
- Preserving tables and figures.
- Adding citations and wikilinks.
- Updating existing synthesized content pages when new evidence arrives.
- Discovering new page types and folder structures when needed.

Because the LLM writes both the synthesized and the extracted content, a deterministic completeness check compares the final markdown against the extracted input to make sure nothing was dropped or materially altered.

---

## 5. Page Structure

Every wiki page is a markdown file with YAML frontmatter and a markdown body.

### 5.1 Frontmatter

At minimum, the frontmatter contains:

```yaml
---
title: "Page Title"
type: document | entity | topic | source | raw | index | ...
updated: "2026-07-07T10:00:00Z"
---
```

Additional fields depend on the page type:

- `document` pages: `tags`, `sources`, `confidence`.
- `entity` pages: `tags`, `mentions`.
- `topic` pages: `tags`, `related`.
- `source` pages: `file`, `pages`, `ingested`, `warnings`.

The `type` field is not a hard-coded enum. The default types are `index`, `document`, `source`, `topic`, `entity`, and `raw`, but the LLM may introduce new types when the corpus demands them.

### 5.2 Body

The body of a content page typically has two layers:

1. **LLM-written synthesis** — summary, key claims, context, relationships, and analysis.
2. **Preserved extracted detail** — the full text, tables, figure descriptions, and other material extracted from the PDFs.

The synthesis is at the top so the reader can quickly understand the page. The extracted detail is preserved below so the reader can verify every claim and find details that the synthesis did not foreground.

### 5.3 Citations

Every factual claim in the synthesis must be followed by an inline citation:

```markdown
The company reported revenue of $42.5M in Q3 2024 [^src1].
```

The citation maps to a `sources` entry in the frontmatter, which specifies the source PDF and the exact page range. The full extracted text is also preserved on the page so the claim can be verified without opening the PDF.

---

## 6. Page Types in Detail

### 6.1 `document` Pages

A `document` page represents one chunk of a PDF (or a small PDF in its entirety). It contains:

- An LLM-written summary of the chunk.
- Key claims extracted from the chunk, with citations.
- The full extracted text, organized by headings and paragraphs.
- Tables from the PDF, preserved as markdown tables.
- Figure descriptions.
- Links to the source page, related entities, and related topics.

Document pages are the primary containers for the raw material of the corpus. They ensure that every page of every PDF is preserved in the wiki.

### 6.2 `entity` Pages

An `entity` page is about a named real-world thing: a person, organization, company, location, product, or any other recurring named object.

It contains:

- An LLM-written description of what the entity is and its role in the corpus.
- A list of the entity's relationships (e.g., board memberships, ownership, donations received).
- A complete list of every mention of the entity across the corpus, with citations.

Entity pages are grouped under typed sub-folders inside `entities/` (for example, `entities/people/`, `entities/organizations/`, or corpus-specific groups proposed by the LLM). The wiki's `entityTaxonomy` records which sub-folder each entity belongs to. This grouping keeps the entity namespace organized and makes it easier for a research agent to browse all people, companies, or other related groups in one place.

The entity page is the canonical reference for that entity. Every other page that mentions the entity should link to it.

### 6.3 `topic` Pages

A `topic` page is about a theme, concept, or recurring subject that spans multiple documents.

It contains:

- An LLM-written overview of the theme.
- Connections to related entities, documents, and other topics.
- A summary of the key evidence about the theme across the corpus.
- Citations to every source that contributes to the topic.

Examples might include "political donations," "offshore ownership structures," or "executive compensation."

### 6.4 `source` Pages

A `source` page is a deterministic catalog entry for a PDF. It contains:

- The filename and relative path.
- The SHA-256 hash.
- Page count and metadata.
- Extraction warnings (e.g., scanned pages).
- Links to the document pages derived from the source.

The `source` page is the provenance anchor for every citation in the wiki.

### 6.5 `raw` Pages

A `raw` page preserves material from a PDF page that could not be parsed cleanly, such as a scanned image or a malformed page. It contains:

- The source PDF and page number.
- The reason the page was placed in `raw`.
- Any text or image metadata that could be extracted.
- A placeholder indicating that the content may need manual review.

### 6.6 New Page Types

The LLM may discover that the corpus needs additional page types, such as:

- `timeline` — a chronological sequence of events.
- `claim` — a specific assertion made in the sources.
- `case` — a legal case or investigation.
- `transaction` — a financial transaction.
- `relationship` — a focused description of a connection between two entities.

New page types are created automatically when the LLM determines they are useful, as long as they fit within the existing folder structure. They must be documented in the folder-level `index.md` and in the wiki's `AGENTS.md` ingestion guide.

---

## 7. The `AGENTS.md` Schema / Ingestion Guide

`AGENTS.md` is the **schema file** for a wiki. In the LLM Wiki Gist, this role is called `AGENTS.md` (for Codex) or `CLAUDE.md` (for Claude Code): a single file that defines the structure, conventions, and workflows for the LLM working on this knowledge base. It is the closest thing the wiki has to a "system prompt" for the LLM.

In the LLM Wiki CLI, the contract that humans and research agents read is the `index.md` hierarchy, but the instructions that the LLM follows when writing and maintaining the wiki are in `AGENTS.md`. This split keeps the human-facing contract clean while giving the LLM a detailed, corpus-specific guide.

### 7.1 What `AGENTS.md` Contains

`AGENTS.md` tells the LLM:

- **Purpose and scope** — what kind of documents are in this wiki and what the human wants to get out of it.
- **Folder structure** — what folders exist, what each folder contains, and how folders relate to each other.
- **Page types** — the default and allowed page types, and how each should be structured.
- **Naming conventions** — how files and wikilinks should be named.
- **Citation rules** — how to format `[^srcN]` citations and the `sources` frontmatter entries.
- **Content rules** — how to preserve tables, figures, and extracted text; how much synthesis is expected.
- **Special instructions** — corpus-specific rules (e.g., "donations should be linked to both the donor entity and the recipient politician").
- **Workflows** — how to handle `sample`, `ingest`, and ongoing maintenance. This can include a reminder to update the `index.md` contracts after creating new pages, to check for contradictions, and to keep the wiki compounding.
- **Lint / quality rules** — what the LLM should check before considering a chunk complete (e.g., every factual claim has a citation, every table is preserved, no orphaned pages).

Because each wiki's data is unique, `AGENTS.md` is tailored to that specific corpus. It is produced during the `sample` phase and updated as the wiki evolves. When the LLM discovers a new pattern or a new page type, it updates `AGENTS.md` so that future chunks follow the same convention.

### 7.2 `AGENTS.md` as the LLM's System Prompt

When the LLM ingests a new PDF, it should read the current `AGENTS.md` first. The document acts as the LLM's memory of the project's conventions. If the LLM is unsure whether to create a `transaction` page or a `donation` page, it checks `AGENTS.md`. If it is unsure whether to link a donor to a politician or only to a party, it checks `AGENTS.md`.

This mirrors the Gist's idea that the LLM is the programmer and the wiki is the codebase. `AGENTS.md` is the style guide, the architecture decision record, and the runbook for that codebase.

### 7.3 Example `AGENTS.md` Snippet

```markdown
# AGENTS.md: Political Donations Wiki

## Purpose
This wiki contains annual political-donation filings. The goal is to make every donor, recipient, and donation searchable and linkable, so a journalist can find connections between donors, politicians, and companies.

## Folder Structure
- `documents/` — one page per source PDF or per chunk of a large PDF.
- `donors/` — entity pages for individuals and organizations that made donations.
- `recipients/` — entity pages for politicians and parties that received donations.
- `donations/` — topic pages for notable donation patterns and years.
- `raw/` — pages for scanned or unparseable filings.

## Page Types
- `document` — one page per PDF chunk; includes summary + full extracted text.
- `entity` — one page per donor or recipient; includes description + all mentions.
- `topic` — one page per theme or pattern; includes overview + key evidence.
- `source` — deterministic provenance page for each PDF.
- `raw` — deterministic page for unparseable PDF pages.

## Naming Conventions
- Document pages: `YYYY-filing-part-NNN.md`.
- Donor pages: `<slug>.md` based on the donor's normalized name.
- Recipient pages: `<slug>.md` based on the recipient's normalized name.

## Citation Rules
- Every donation amount, date, and name must be cited with `[^srcN]`.
- Citation keys map to the `sources` frontmatter list on each page.
- Each source entry must include the PDF file path and the exact page range.

## Content Rules
- Preserve tables from the filings verbatim.
- Do not summarize away any row, column, or value.
- Every factual claim must have a citation.
- Every named entity should be linked to its canonical entity page.

## Workflows
- When a new PDF is added, run `ingest`. Update existing entity/topic pages with new mentions.
- When the corpus reveals a new pattern (e.g., shell companies used as donors), create a new folder or page type and update this file.
- After creating new pages, update the relevant `index.md` contracts.
- Before finishing a chunk, run the Critic: check for missing citations, broken links, and incomplete tables.
```

### 7.4 Optional: `log.md` as an Append-Only Record

Following the Gist's pattern, the wiki may also maintain a `log.md` file. This is an append-only chronological record of ingestion runs, structural changes, and notable decisions made by the LLM or the human. It is not a substitute for the contracts or the content pages, but it can help a human or a research agent understand what has changed and why.

For example:

```markdown
- 2026-07-07: Added `shell-companies/` folder after discovering repeated offshore donors.
- 2026-07-07: Ingested 2019 political-donation filing; added 12 donor pages and 3 topic pages.
```

`log.md` is optional, but it is useful for compounding and debugging.

### 7.5 Living Document

`AGENTS.md` is a living document. If the LLM discovers during ingestion that the structure needs to change, it updates `AGENTS.md` to reflect the new convention. If the change requires a new folder or a change to the wiki-level organization, the LLM applies the change autonomously and records it in the structural change log, as described in the product vision.

---

## 8. The Ingestion Loop: Sample → Ingest → Update

The wiki is not created in a single pass. It grows through a loop:

1. **`init <slug>`** — Create the wiki workspace, an empty `raw/` folder, and a skeleton `AGENTS.md`.
2. **`sample`** — The user places PDFs in `raw/`. The LLM analyzes the corpus using the appropriate sampling strategy for the document types. It produces the folder structure, page plan, and an updated `AGENTS.md`.
3. **`ingest`** — The LLM reads the current `AGENTS.md`, processes every PDF in chunks, runs the seven sub-agents, and writes or updates pages. Existing pages are updated with new evidence; new pages are created when needed. If the LLM discovers a new convention or page type, it updates `AGENTS.md` and the relevant `index.md` contracts.
4. **Re-run `ingest`** — When new PDFs arrive or existing PDFs change, `ingest` runs again. It uses SHA-256 hashes to skip unchanged PDFs and only processes the diff. The LLM re-reads `AGENTS.md` at the start of each run to ensure it is following the latest conventions.


Because the wiki is updated incrementally, it becomes richer over time without losing earlier work. This is the **compounding** property: every new source adds more pages, links, and evidence.

---

## 9. What the Wiki Is Not

The wiki is not:

- A **RAG system** that retrieves chunks at query time. The expensive work happens at ingestion time.
- A **connection-finding tool** that automatically links a donor in one corpus to a company in another. That cross-corpus analysis is done by the journalist or a separate research agent using the compiled wiki.
- A **human-maintained wiki** that requires manual updates. The LLM maintains it.

The wiki is a **pre-compiled map** of the corpus. It makes the original documents discoverable, verifiable, and navigable without replacing the human judgment needed to interpret the findings.

---

## 10. Summary of Rules for the LLM

When writing wiki pages, the LLM must:

1. Include **all extracted data** somewhere in the wiki.
2. Write **self-contained pages** with rich context and summaries.
3. Preserve extracted text, tables, and figures **verbatim** or with clear descriptions.
4. Add an inline citation for **every factual claim**.
5. Link every entity mention to its canonical entity page.
6. Update existing pages when new evidence arrives, without losing existing detail.
7. Create new page types or folders when the corpus demands them.
8. Treat the wiki's `AGENTS.md` as the schema and system prompt: read it before writing, and update it when conventions change.
9. Maintain the `index.md` contracts as the human-facing map of the wiki.
10. Pass the Critic and deterministic validation checks before moving to the next chunk.

If the LLM follows these rules, the resulting wiki will be a faithful, comprehensive, and navigable representation of the original corpus.
