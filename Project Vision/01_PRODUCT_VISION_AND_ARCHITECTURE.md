# LLM Wiki CLI v2.0 — Product Vision and Architecture

| Attribute | Value |
|---|---|
| Document ID | `LLM-WIKI-CLI-ARCH-001` |
| Version | 2.0.0 |
| Status | Canonical |
| Date | 2026-07-16 |

---

## 1. Purpose

LLM Wiki CLI is a local, citation-backed research tool for investigative journalism. It converts collections of PDFs into a **wiki-of-wikis**: a network of linked markdown pages where every claim can be traced back to an exact location in the original source PDFs.

The primary user is an **investigative journalist** working with large collections of confidential documents, such as leaked reports (e.g., the Panama Papers), annual political-donation filings, company registries, and ownership-structure records. Today, cross-referencing these sources takes months or years: finding that a small-company board member also donated to a political party every election cycle and appears in a leaked offshore registry is a slow, manual process. LLM Wiki CLI ingests these PDFs once, compiles them into self-contained, interlinked wiki articles with rich context, and lets the journalist or a downstream research agent find those connections without re-reading the original documents or exploding the LLM context window.

LLM Wiki CLI is inspired by the **LLM Wiki Gist** (https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) for splitting large texts that do not fit into a single context window into self-contained wiki articles, and the **DOX Framework** (https://github.com/agent0ai/dox) for organizing knowledge into sub-folders with binding contracts. The CLI is not itself a connection-finding tool: the actual cross-corpus analysis (e.g., matching a donor across Panama Papers and donation records) is performed by the journalist or a separate research agent using the compiled wiki.

Unlike Retrieval-Augmented Generation (RAG), which computes answers on the fly from raw documents, LLM Wiki CLI compiles the corpus at ingestion time into a persistent, structured, navigable knowledge base that journalists and research agents can browse and query.

In one sentence: **your PDFs become a citation-backed wiki, written by an LLM, organized by contracts, and owned entirely by you.**

---

## 2. Core Philosophy

### Principle 1: The LLM is the Programmer, the Wiki is the Codebase

The LLM Wiki Gist frames the system as:

> "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."

In this project, that means the **human's job is to provide the raw sources and consume the compiled wiki**. The **LLM's job is extraction, classification, and synthesis**. The **deterministic code's job is preservation, validation, and file I/O**.

The human does not write the wiki pages. The human does not decide the exact folder structure. The human places the PDFs and the LLM turns them into a structured, navigable, citation-backed knowledge base. The human then reads, verifies, and interprets the result.

This division of labor is what makes the system scalable to thousands of pages.

### Principle 2: Citation-Backed Knowledge

Every claim on a wiki page is attributable to a specific location in a specific PDF. Citations use inline `[^srcN]` markers that map to a `sources` entry in the page's YAML frontmatter.

### Principle 3: Compounding, Not Ephemeral

Every ingestion pass makes the wiki richer: new pages, new links, updated indexes, new evidence on existing pages. Existing pages are updated with new evidence and mentions; no detail is lost.

### Principle 4: LLM-Driven Structural Evolution

The system allows the LLM to dynamically create sub-folders under `entities/` and `topics/` as the corpus demands. The LLM does not need human approval for every new folder. Structural changes are logged for after-the-fact review.

---

## 3. Functional Architecture

At the highest level, the tool works in three layers:

1. **Workspace** — a directory on your computer that holds one or more wikis.
2. **Wiki** — a logical collection of PDFs (e.g., `acme-annual-reports`) living under `wikis/<slug>/`.
3. **Pages** — markdown files generated from the PDFs, linked together with `[[Page Title]]` wikilinks and cited with `[^srcN]` footnotes.

### Typical Workflow

1. **Create a workspace and a wiki.**
   ```bash
   llm-wiki-cli init acme-annual-reports --title "Acme Annual Reports" -w ./my-workspace
   ```
2. **Copy PDFs** into `my-workspace/wikis/acme-annual-reports/raw/`.
3. **AGENTS.md is generated automatically.** This is the constitution of the wiki. Every LLM call reads and follows it.
4. **Run `ingest`.**
   ```bash
   llm-wiki-cli ingest acme-annual-reports
   ```
5. **Browse the wiki** in Obsidian or any markdown viewer.

---

## 4. The Ingestion Model

### 4.1 Layered Architecture

The system is built in four layers:

| Layer | Responsibility | LLM Calls | Cost per Chunk |
|---|---|---|---|
| **Layer 1: Raw Document Pages** | Extract text from PDFs, write raw chunks to disk | 0 | $0 |
| **Layer 2: Extractor** | Read chunk, return JSON with entities, relationships, claims, folder assignments | 1 | ~$0.01 |
| **Layer 3: Materializer** | Create folders, write/update entity/topic pages, run preservation checks | 0 | $0 |
| **Layer 4: DOX Writer** | Scan completed wiki, write `index.md` navigation contracts | 0 | $0 |

**Layer 5: Synthesis Writer** (optional, Phase 6) turns structured entity pages into readable two-layer pages with LLM-written synthesis at the top.

### 4.2 Incremental Ingestion

`ingest` is incremental. It tracks every PDF by SHA-256 hash:

- **New PDFs** are processed in full.
- **Changed PDFs** are re-processed and their derived pages are updated.
- **Removed PDFs** cause their derived pages to be marked as stale.
- **Unchanged PDFs** are skipped.

This makes re-running `ingest` efficient and ensures the wiki compounds over time.

### 4.3 Rolling Memory

Because PDFs can be large and because `ingest` is incremental, the system needs to remember what it has already seen. This is done through **rolling memory** — a JSON file persisted to disk at `.state/rolling-memory.json`:

```json
{
  "entities": [
    {"slug": "john-smith", "folder": "entities/people/executives", "mentionCount": 3}
  ],
  "topics": ["financial/revenue-recognition"],
  "sources": ["annual-report-2023"],
  "folderStructure": ["entities/people/executives", "entities/companies/offshore"]
}
```

When the system starts a new chunk, it loads the rolling memory and passes it to the Extractor. When it finishes a chunk, it updates the rolling memory. This allows the system to handle very large documents and to resume or re-run ingestion efficiently.

### 4.4 Chunking Strategy

PDFs are ingested as **page-based chunks**. A chunk is one or more consecutive pages that fit comfortably within the configured LLM context window. The system never splits a page, table, or figure across chunks. If a document is large, it is processed as a sequence of page-based chunks, with rolling memory carrying context across chunks.

---

## 5. Who Decides What

| Decision | Authority | Mechanism |
|---|---|---|
| High-level wiki purpose | Human | `AGENTS.md` written at `init` time |
| Which PDFs to ingest | Human | Files placed in `raw/` |
| Exact folder structure | LLM | Extractor proposes sub-folders under `entities/` and `topics/` |
| Entity classification | LLM | Extractor assigns type and folder |
| Page content (synthesis) | LLM | Writer generates readable pages |
| Text extraction, hashing, file I/O | Deterministic code | `pdfjs-dist`, `fs`, `crypto` |
| Validation | Deterministic code | Schema checks, link checks, preservation checks |
| Navigation contracts | Deterministic code | DOX Writer reads filesystem and writes `index.md` |
| Structural change review | Human | After-the-fact via `.state/proposals/` log |

---

## 6. Target Use Cases

### Use Case 1: 25 Years of Financial Reports

A journalist receives annual reports for Acme Corp from 2000-2024. Instead of reading 5000 pages, they run `ingest`. The system creates entity pages for every executive, subsidiary, and auditor. It creates topic pages for revenue recognition, offshore structures, and regulatory investigations. The journalist clicks `[[John Smith]]` and sees every mention across 25 years, with citations to exact pages.

### Use Case 2: 2000-Page Leaked Document

A journalist receives a 2000-page leak (e.g., Panama Papers subset). The system chunks it into 40 chunks of 50 pages. The Extractor processes each chunk with rolling memory. The Materializer creates entity pages for every offshore company, director, and jurisdiction. The journalist searches for a name and finds every page where that name appears, with the surrounding context preserved.

---

## 7. Non-Goals

- **Real-time query answering.** This is not RAG. The expensive work happens at ingestion time.
- **Automatic connection finding.** The system compiles the corpus. The journalist or a separate research agent finds the connections.
- **Multi-user collaboration.** This is a single-user local tool.
- **Web interface.** This is a CLI tool. The output is markdown files viewed in Obsidian or similar.
