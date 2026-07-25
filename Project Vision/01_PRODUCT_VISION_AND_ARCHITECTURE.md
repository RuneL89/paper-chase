# Paper Chase v.1.0 — Product Vision and Architecture

> Paper Chase is formerly LLM Wiki CLI (v2.0 development name).

| Attribute | Value |
|---|---|
| Document ID | `LLM-WIKI-CLI-ARCH-001` |
| Version | 2.0.0 |
| Status | Canonical |
| Date | 2026-07-16 |

---

## 1. Purpose

Paper Chase is a local, citation-backed research tool for investigative journalism. It converts collections of PDFs into a **wiki-of-wikis**: a network of linked markdown pages where every claim can be traced back to an exact location in the original source PDFs.

The primary user is an **investigative journalist** working with large collections of confidential documents, such as leaked reports (e.g., the Panama Papers), annual political-donation filings, company registries, and ownership-structure records. Today, cross-referencing these sources takes months or years: finding that a small-company board member also donated to a political party every election cycle and appears in a leaked offshore registry is a slow, manual process. Paper Chase ingests these PDFs once, compiles them into self-contained, interlinked wiki articles with rich context, and lets the journalist or a downstream research agent find those connections without re-reading the original documents or exploding the LLM context window.

Paper Chase is inspired by the **LLM Wiki Gist** (https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) for splitting large texts that do not fit into a single context window into self-contained wiki articles, and the **DOX Framework** (https://github.com/agent0ai/dox) for organizing knowledge into sub-folders with binding contracts. The CLI is not itself a connection-finding tool: the actual cross-corpus analysis (e.g., matching a donor across Panama Papers and donation records) is performed by the journalist or a separate research agent using the compiled wiki.

Unlike Retrieval-Augmented Generation (RAG), which computes answers on the fly from raw documents, Paper Chase compiles the corpus at ingestion time into a persistent, structured, navigable knowledge base that journalists and research agents can browse and query.

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
3. **Pages** — markdown files generated from the PDFs, linked together with `[[page-name|Page Title]]` wikilinks and cited with `[^srcN]` footnotes.

### Typical Workflow

1. **Create a workspace and a wiki.**
   ```bash
   chase init acme-annual-reports --title "Acme Annual Reports" -w ./my-workspace
   ```
2. **Copy PDFs** into `my-workspace/wikis/acme-annual-reports/raw/`.
3. **AGENTS.md is generated automatically.** This is the constitution of the wiki. Every LLM call reads and follows it.
4. **Run `ingest`.**
   ```bash
   chase ingest acme-annual-reports
   ```
5. **Browse the wiki** in Obsidian or any markdown viewer.

---

## 4. The Ingestion Model

### 4.1 Layered Architecture

The system is built in five layers:

| Layer | Responsibility | LLM Calls | Cost Basis |
|---|---|---|---|
| **Layer 1: Raw Document Pages** | Extract text from PDFs, write raw chunks to disk | 0 | $0 per chunk |
| **Layer 2: Extractor** | Read chunk, return JSON with entities, relationships, claims, folder assignments | 1 | ~$0.01 per chunk |
| **Layer 3: Materializer** | Create folders, write/update entity/topic pages, run preservation checks | 0 | $0 |
| **Layer 4: Synthesis Writer** | Optionally rewrite entity/topic/document pages with readable synthesis | 1 | ~$0.01 per page |
| **Layer 5: DOX Writer** | Scan completed wiki, write `index.md` navigation contracts plus the workspace-level `wikis/index-of-indexes.md` | 1 | per folder + 1 per workspace pass |

**Layer 4: Synthesis Writer** (optional, Phase 5) turns structured entity, topic, and document pages into readable two-layer pages with LLM-written synthesis at the top.

**Curation pass (amended 2026-07-23, user-ratified):** after the Materializer aggregates the extraction data and before any topic or entity page is written, two per-ingest LLM calls curate the aggregate — they may run in parallel, at a typical combined cost of ~$0.05–0.25 per ingest. The **topic-curation** call merges duplicate themes and drops meta-descriptors that are not searchable topics; the **entity-curation** call merges name variants of the same real-world thing (merge-only). Both decision lists are validated and applied deterministically; on any validation or transport failure the curation is skipped entirely (the keep-all fallback — pre-curation behavior, no data loss). Full mechanism: `04_orchestration_detailed.md` §3.2 Step 6.

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

### 4.5 Multilingual Ingestion

PDFs in several European languages can be ingested, and the wiki's prose language is independent of the source language. Two settings govern this (full spec: `04_orchestration_detailed.md` §9):

- **Output language** (per wiki, chosen at `init`, default: English) — the language of all generated prose: synthesis, DOX index descriptions, and folder names.
- **Input language** (per `ingest` run, default: English) — the language of the PDFs being ingested; drives slug transliteration (æ→ae, ø→oe, å→aa) so non-ASCII names produce readable slugs.

The binding rule: narrative prose (Layer 1) is written in the output language; preserved evidence (Layer 2) always stays verbatim in the source language, so every citation remains verifiable against the original PDF.

---

## 5. Who Decides What

| Decision | Authority | Mechanism |
|---|---|---|
| High-level wiki purpose | Human | `AGENTS.md` written at `init` time |
| Wiki output language | Human | Chosen at `init`, recorded in `AGENTS.md` (§4.5) |
| Input language per run | Human | `--input-language` flag or TUI selector (§4.5) |
| Which PDFs to ingest | Human | Files placed in `raw/` |
| Exact folder structure | LLM | Extractor proposes sub-folders under `entities/` and `topics/` |
| Entity classification | LLM | Extractor assigns type and folder |
| Topic merge/drop decisions | LLM | Per-ingest topic-curation pass; decision list validated and applied deterministically (keep-all fallback) |
| Entity identity merges | LLM | Per-ingest entity-curation pass (merge-only, strict identity); application deterministic — evidence union, aliases, wikilink rewrites |
| Page content (synthesis) | LLM | Writer generates readable pages |
| Text extraction, hashing, file I/O | Deterministic code | `pdfjs-dist`, `fs`, `crypto` |
| Validation | Deterministic code | Schema checks, link checks, preservation checks |
| Navigation contracts | LLM | DOX Writer reads finalized pages and writes `index.md` (plus `wikis/index-of-indexes.md` at the workspace level); children lists and statistics are supplied by deterministic code |
| Structural change review | Human | After-the-fact via `.state/proposals/` log |

---

## 6. Target Use Cases

### Use Case 1: 25 Years of Financial Reports

A journalist receives annual reports for Acme Corp from 2000-2024. Instead of reading 5000 pages, they run `ingest`. The system creates entity pages for every executive, subsidiary, and auditor. It creates topic pages for revenue recognition, offshore structures, and regulatory investigations. The journalist clicks `[[john-smith|John Smith]]` and sees every mention across 25 years, with citations to exact pages.

### Use Case 2: 2000-Page Leaked Document

A journalist receives a 2000-page leak (e.g., Panama Papers subset). The system chunks it into 40 chunks of 50 pages. The Extractor processes each chunk with rolling memory. The Materializer creates entity pages for every offshore company, director, and jurisdiction. The journalist searches for a name and finds every page where that name appears, with the surrounding context preserved.

---

## 7. Non-Goals

- **Real-time query answering.** This is not RAG. The expensive work happens at ingestion time.
- **Automatic connection finding.** The system compiles the corpus. The journalist or a separate research agent finds the connections.
- **Multi-user collaboration.** This is a single-user local tool.
- **Web interface.** This is a CLI tool. The output is markdown files viewed in Obsidian or similar.
