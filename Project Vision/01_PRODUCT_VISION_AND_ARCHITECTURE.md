# LLM Wiki CLI v2.0 — Product Vision and Architecture

| Attribute | Value |
|---|---|
| Document ID | `LLM-WIKI-CLI-ARCH-001` |
| Version | 2.0.1 |
| Status | Canonical |
| Date | 2026-07-14 |

---

## 1. Purpose

LLM Wiki CLI is a local, citation-backed research tool for investigative journalism. It converts collections of PDFs into a **wiki-of-wikis**: a network of linked markdown pages where every claim can be traced back to an exact location in the original source PDFs.

The primary user is an **investigative journalist** working with large collections of confidential documents, such as leaked reports (e.g., the Panama Papers), annual political-donation filings, company registries, and ownership-structure records. Today, cross-referencing these sources takes months or years: finding that a small-company board member also donated to a political party every election cycle and appears in a leaked offshore registry is a slow, manual process. LLM Wiki CLI ingests these PDFs once, compiles them into self-contained, interlinked wiki articles with rich context, and lets the journalist or a downstream research agent find those connections without re-reading the original documents or exploding the LLM context window.

LLM Wiki CLI is inspired by the **LLM Wiki Gist** (https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) for splitting large texts that do not fit into a single context window into self-contained wiki articles, and the **DOX Framework** (https://github.com/agent0ai/dox) for organizing knowledge into sub-folders with binding contracts. The CLI is not itself a connection-finding tool: the actual cross-corpus analysis (e.g., matching a donor across Panama Papers and donation records) is performed by the journalist or a separate research agent using the compiled wiki.

Unlike Retrieval-Augmented Generation (RAG), which computes answers on the fly from raw documents, LLM Wiki CLI compiles the corpus at ingestion time into a persistent, structured, navigable knowledge graph that journalists and research agents can browse and query.

### 1.1 Philosophy: The LLM is the Programmer, the Wiki is the Codebase

The LLM Wiki Gist frames the system as:

> "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."

In this project, that means the **human's job is to provide the raw sources and consume the compiled wiki**. The **LLM's job is everything else**: planning the wiki structure, deciding when folders need to change, writing pages, preserving extracted detail, adding citations and links, updating existing pages, and maintaining consistency. The human does not hand-write the wiki, direct the analysis, or approve structural changes; the human places the PDFs and the LLM turns them into a structured, navigable, citation-backed knowledge base. The human can then read, query, and interpret the result.

---

## 2. What the Tool Creates in the End

After a full ingestion run, the workspace contains a wiki-of-wikis:

### 2.1 Root Roadmap — `index-of-indexes.md`

The top-level entry point. It lists every wiki in the workspace, how many sources each one has, and how many pages were generated in total.

### 2.2 Wiki-Level Contract — `wikis/<slug>/index.md`

One per PDF collection. It states the scope of the collection, lists the dynamic folders inside the wiki, and explains how to navigate the content.

### 2.3 Folder-Level Contracts — `wikis/<slug>/<folder>/index.md`

The folder structure is not hard-coded. It is decided during the **sample** phase based on what the corpus actually contains. Each folder's `index.md` acts as a binding contract: it says what kind of pages live there, what the naming convention is, and how pages are linked.

Typed groups of entities (for example, `entities/people/`, `entities/organizations/`, or corpus-specific groups like `entities/regulators/`) extend the contract hierarchy one level deeper. Each entity sub-folder has its own `index.md` child contract that describes the page types and naming rules for that group.

### 2.4 LLM-Written Content Pages

The actual wiki articles. Each page is drafted by the LLM, not copied from the PDF. They contain:

- Synthesized summaries, explanations, and connections.
- Inline citations like `[^srcN]` that map back to specific PDFs and pages.
- The full extracted detail preserved underneath, so nothing is lost.

### 2.5 Source Pages

A catalog of every PDF that was ingested: file path, SHA-256, page count, metadata, warnings, and links to the document pages derived from it.

### 2.6 Raw Pages

For pages that were scanned, image-only, or otherwise unparseable, the fragment is preserved as a raw page so the user knows something was skipped.

---

## 3. Core Principles

### Principle 1: The LLM Writes All Markdown Content

The LLM does all research, planning, and writing of synthesized markdown content. This includes not only synthesized summaries, analyses, and connections, but also the faithful transcription of extracted text, tables, and figure descriptions into markdown. Local deterministic code handles PDF extraction, file I/O, hashing, schema validation, and orchestration, but it never drafts or mutates synthesized content markdown bodies. Deterministic provenance/preservation pages (`source` and `raw` page types) are generated deterministically from extraction metadata; the LLM is the sole author of all synthesized content pages (`document`, `entity`, `topic`, and derived types).

If an LLM sub-agent fails to produce valid output (empty, malformed, or failing validation), the orchestrator may retry the same LLM agent with a stricter repair prompt. It must **not** fall back to deterministic page creation, deterministic page updates, or any other deterministic authoring of wiki content. If the repair attempt also fails, the run aborts and the error is reported to the user. Deterministic code validates, repairs, and orchestrates; it never authors content as a fallback.

### Principle 2: Citation-Backed Knowledge

Every claim on a wiki page is attributable to a specific location in a specific PDF. Citations use inline `[^srcN]` markers that map to a `sources` entry in the page's YAML frontmatter.

### Principle 3: Compounding, Not Ephemeral

Every ingestion pass makes the wiki richer: new pages, new links, updated indexes, new evidence on existing pages. Existing pages are updated with new evidence and mentions; no detail is lost.

### Principle 4: LLM-Driven Structural Evolution

The system drafts plans, pages, and folder structures autonomously. The LLM may create new folders, reorganize the wiki, or evolve the page-type taxonomy as the corpus demands, without requiring human approval for each structural change. Structural changes are still documented in the `index.md` contracts and `AGENTS.md` so the human can understand them, but the LLM is the sole authority over when and how the structure evolves. New page types inside existing folders and new folders are both managed by the LLM.

### Principle 5: Context-Cautious Chunking

PDFs are processed in chunks sized to fit within the configured LLM context limit. Chunks are **page-based**: a chunk is one or more consecutive pages, and the system never splits inside a page, table, or figure. The system errs on the side of more, smaller chunks to leave ample context for the LLM's planning and writing prompts.

---

## 4. High-Level Architecture

### 4.1 Three Layers

| Layer | Description |
|---|---|
| **RAW** | Source PDFs in `wikis/<slug>/raw/`. Retained as provenance; never modified. |
| **WIKI** | Compiled markdown pages with YAML frontmatter, wikilinks, and citations. |
| **CONTRACT** | The hierarchy of `index-of-indexes.md` → wiki-level `index.md` → folder-level `index.md`. Each index is a binding contract for the pages beneath it. |

### 4.1.1 The Role of `AGENTS.md`

The project is inspired by the DOX Framework's cascading documentation, but it does **not** use `AGENTS.md` as the wiki contract. Instead, the contract is the `index.md` hierarchy described above.

`AGENTS.md` is the **per-wiki schema and system prompt** for the LLM. Following the LLM Wiki Gist, it is the file that defines the structure, conventions, and workflows the LLM must follow when writing and maintaining this wiki. It tells the LLM:

- What folder structures and page types make sense for this corpus.
- How to name files and wikilinks.
- How to handle citations, tables, figures, and extracted text.
- What special instructions apply (e.g., "donations should link to both donor and recipient").
- The workflows for `sample`, `ingest`, and ongoing maintenance.

Because each wiki's data is unique, each wiki gets its own tailored `AGENTS.md`. It is produced during the `sample` phase and updated as the wiki evolves.

In short:

- `AGENTS.md` — the LLM's schema and runbook during ingestion and maintenance.
- `index.md` — the resulting contract hierarchy that humans and research agents navigate.

### 4.2 The LLM Orchestrator

The orchestrator is a pipeline of seven LLM sub-agents that run in sequence per chunk:

1. **StructureAnalyst** — identifies document boundaries, headings, tables, and figures.
2. **EntityExtractor** — extracts named entities (people, organizations, locations, etc.).
3. **RelationshipExtractor** — identifies relationships between entities.
4. **EvidenceCollector** — collects claims and their citations.
5. **PagePlanner** — decides which pages to create or update and where they belong in the folder hierarchy.
6. **ChunkWriter** — drafts the actual markdown content for the planned pages.
7. **Critic** — reviews the output for quality, consistency, and completeness.

The pipeline also performs deterministic validation: schema validation, link checks, and citation integrity checks after the LLM agents have run.

### 4.3 Rolling Memory

The orchestrator maintains a **rolling memory** across chunks and across ingestion runs. It has two parts:

- A **compressed natural-language summary** that is passed to the LLM as context, describing what the corpus contains and which pages/entities/topics already exist.
- A **structured state object** persisted to disk that records pages, entities, relationships, evidence, and source hashes. This state is updated after each chunk and is used for deterministic validation, incremental re-ingestion, and cross-chunk consistency.

This dual memory allows the system to handle large PDFs and large document collections without losing context, and to update existing pages as new evidence is discovered.

---

## 5. Page Types

The following page types are the **minimum defaults** produced during ingestion. The LLM orchestrator may create additional page types if the corpus demands them (e.g., `timeline`, `claim`, `case`, `transaction`). The page-type taxonomy is therefore not hard-coded; it is discovered and evolved by the ingestion AI. New page types are auto-created by the LLM and added to the relevant folder-level `index.md` contract without a separate human approval gate.

| Type | Description | Example |
|---|---|---|
| `index` | Navigational/contract page | `index-of-indexes.md`, wiki-level `index.md`, folder-level `index.md` |
| `document` | LLM-drafted summary and key claims from a chunk of a PDF | `ADHD_2020-part-001.md` |
| `source` | Catalog entry for an ingested PDF | `ADHD_2020.md` |
| `topic` | LLM-drafted overview of a recurring theme across the corpus | `executive-function.md` |
| `entity` | LLM-drafted description of a named entity and its role | `russell-barkley.md` |
| `raw` | Preserved fragment from a scanned or unparseable PDF page | `page-003.md` |

Every page has YAML frontmatter with at least `title`, `type`, and `updated`. New page types introduced by the LLM must be documented in the folder-level `index.md` contract and in the wiki's `AGENTS.md` ingestion guide.

---

## 6. Citation and Provenance Model

Every factual claim, number, name, date, quote, and figure on a wiki page is attributable to a specific location in a specific PDF.

- `[^srcN]` inline references map to a `sources` entry in the YAML frontmatter.
- Each source entry specifies the file path, the page range, and the extraction timestamp.
- The full extracted text, tables, and figure descriptions are preserved on the page so that the claim can be verified.

---

## 7. Governance and Quality

### 7.1 Validation Order

1. **Critic** — LLM review of the drafted pages for quality, consistency, and completeness. If the Critic finds blocking issues, the chunk is reprocessed with feedback before the pipeline continues.
2. **Deterministic completeness check** — compare the LLM-written page against the extracted input to ensure no text, table, or figure was dropped or materially altered.
3. **Deterministic structural checks** — broken link detection, citation integrity, schema compliance.
4. **Schema validation** — all pages must match the required frontmatter schema.

### 7.2 Structural Change Log

When the existing folder hierarchy cannot accommodate the corpus, the LLM autonomously creates or reorganizes folders and updates the page-type taxonomy. The orchestrator records each structural change with:

- The reason for the change.
- The affected pages and folders.
- The new structure.
- Pros and cons.
- The contract updates that were made.

These records are written to a log (for example, `.kimi-code/proposals/` or an append-only section of `AGENTS.md`) so the human can review what changed and why. The LLM applies the change immediately and updates the affected `index.md` contracts and `AGENTS.md` without a separate approval gate. If a change proves unhelpful, the human can revert it via version control or by re-running `sample` with revised guidance.

---

## 8. The Flows

### 8.1 Initiation

A new wiki is created with an `init <slug>` command. This command:

- Creates the workspace directory structure.
- Creates the wiki folder `wikis/<slug>/` with an empty `raw/` folder.
- Writes an initial `AGENTS.md` ingestion guide tailored to the wiki's expected content.
- Creates a skeleton wiki-level `index.md`.

After `init`, the user places PDFs into `wikis/<slug>/raw/` and runs `sample` to discover the wiki's structure and content.

### 8.2 Sample

The `sample` command discovers the structure and content of the wiki. It is not a one-size-fits-all process: the sampling strategy must adapt to the nature of the documents in the corpus. The orchestrator chooses or is configured with a strategy appropriate to the document collection, such as:

- **A collection of smaller, similar documents** (e.g., annual financial reports for a bank).
- **A single very large document** (e.g., a 2,000-page leak like the Panama Papers).
- **A collection of similar but very large documents** (e.g., yearly political-donation filings covering all EU politicians).
- **A mixed corpus** combining several of the above.

The sampling strategy determines how many pages, how many documents, and which parts of the corpus are analyzed during the `sample` phase to produce the folder structure, page plan, and initial `AGENTS.md`.

For a **single very large document** (e.g., a 2,000-page leak), the LLM first looks for a Table of Contents within the first 50 pages. If a TOC is found, it is used to plan the folder structure and section boundaries. If no TOC is found, the LLM performs a **full read** of the document during the sample phase, processing it in chunks. The folder plan and `AGENTS.md` produced during sampling are not final; they can be updated during full ingestion if new groupings or page types are discovered. When the sampling strategy or `AGENTS.md` changes, the system must support re-ingesting earlier chunks so that every page is placed and written according to the latest conventions.

For a **collection of similar, manageable-sized documents** (e.g., annual reports or policy briefings), the LLM reads one document in full to understand the structure, then reads a subset of pages from each remaining document to confirm the structure applies broadly. This produces the folder plan and initial `AGENTS.md` without reading every page of every document during sampling.

For a **collection of similar but very large documents** (e.g., yearly political-donation filings for every EU politician), the LLM reads the **first document in full** to create the ingestion strategy. The remaining documents are then processed by the normal `ingest` command, chunked according to the strategy already discovered. The `sample` phase effectively ends after the first document, and the rest of the corpus is treated as a continuation of the ingestion run.

For a **mixed corpus** containing several document categories (e.g., one large leak, several annual reports, and a set of large donation filings), the LLM classifies each document into a category and applies the appropriate sampling strategy per group. The results from each group are then synthesized into a single folder plan and `AGENTS.md` that can accommodate all document types.

### 8.3 Ingestion

The `ingest` command processes the PDFs in the wiki's `raw/` folder incrementally. It tracks every PDF by SHA-256 hash and, on each run, only processes PDFs that are new, changed, or removed. Existing pages are updated with new evidence, mentions, and links as new sources are ingested. The LLM may also create new pages or folders when the corpus demands them, without requiring re-approval for page types that fit within the existing folder structure. Unchanged PDFs are skipped, so re-running `ingest` is efficient and compounding.

PDFs are ingested as **page-based chunks**. A chunk is one or more consecutive pages that fit comfortably within the configured LLM context window. The system never splits a page, table, or figure across chunks. If a document is large, it is processed as a sequence of page-based chunks, with rolling memory carrying context forward.

---

## 9. Changelog

| Version | Date | Change |
|---|---|---|
| 2.0.3 | 2026-07-14 | Removed human approval gate for structural changes; the LLM now autonomously evolves the wiki structure and records each change for human review. |
| 2.0.2 | 2026-07-14 | Added typed entity sub-folders, `entityTaxonomy`, and per-chunk page materialization with preservation-first updates to the folder-level contract hierarchy. |
| 2.0.1 | 2026-07-14 | Clarified Principle 1: if an LLM sub-agent fails, the orchestrator may retry the same LLM agent with a repair prompt, but it must never fall back to deterministic page creation, updates, or other markdown authoring. |

*This document is the canonical product vision and architecture reference for LLM Wiki CLI v2.0. Changes require explicit version bump and changelog entry.*
