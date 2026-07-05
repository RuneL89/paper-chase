# Functional Requirements Document — LLM Wiki CLI (MVP v2.0)

**Document ID:** `LLM-WIKI-CLI-FRD-002`  
**Version:** 2.0  
**Date:** 2026-07-04  
**Status:** CONFIRMED

---

## 1. Executive Summary

LLM Wiki CLI is a local Node.js command-line tool for investigative journalism. It transforms collections of related PDFs into a **wiki-of-wikis**: each collection becomes its own markdown wiki with a deep, self-describing folder hierarchy, and every wiki rolls up into a top-level **index-of-indexes**. The MVP handles **PDFs only**.

The primary success criterion is **full data fidelity**. The system must preserve every page, table, figure, and note from each PDF in a way that a human researcher or a research AI agent can traverse from any claim to its exact source location, and from any source to related mentions across the same wiki. Cross-wiki connection discovery is intentionally limited to a shared index.

The tool is inspired by the **LLM Wiki gist** (persistent, compounding markdown wiki maintained by an LLM) and the **DOX Framework** (hierarchical, self-describing directories where each folder's `index.md` acts as a binding contract for agents).

---

## 2. Users & Personas

### 2.1 Primary persona: Investigative journalist (Jordan)
- **Goal:** Find hidden connections across years of company reports, legal filings, or government documents.
- **Needs:** Every claim traceable to a specific PDF page; every page preserved; every table, footnote, and figure discoverable; no relevant data dropped during chunking.
- **Pain point:** Manual review of 400+ PDFs is impossible; RAG gives inconsistent, unverifiable answers; generic chunking destroys document context.
- **Technical skill:** Comfortable with a CLI but not a software engineer. Error messages and reports must be plain-language and actionable.

### 2.2 Secondary persona: Research AI agent
- **Goal:** Reason over the compiled wiki to answer complex questions and surface connections.
- **Needs:** A machine-readable roadmap (the index-of-indexes and wiki-level indexes), deterministic page types, consistent YAML frontmatter, wikilinks, and citations that point to exact source locations.
- **Interaction pattern:** Reads the top-level index, selects a wiki, follows its wiki-level index to relevant document pages, and verifies claims against citations.

### 2.3 Tertiary persona: Technical operator (DevOps/IT)
- **Goal:** Install, configure, and run the CLI in a local environment.
- **Needs:** A single Node.js binary with clear commands, environment variables, and local file output. No server deployment in this MVP.

---

## 3. Functional Requirements

### FR-001: Wiki-of-wikis workspace layout
The CLI must accept a workspace directory that contains one or more wiki folders. Each wiki folder must contain a `raw/` subfolder with its PDFs. The CLI treats every folder as a separate wiki.

| Path | Purpose |
|---|---|
| `<workspace>/` | Root workspace. The CLI is invoked here. |
| `<workspace>/index-of-indexes.md` | Root DOX contract and top-level roadmap. |
| `<workspace>/wikis/<wiki-slug>/` | One wiki. One logical collection (e.g., `acme-annual-reports`). |
| `<workspace>/wikis/<wiki-slug>/raw/` | Source PDFs for this wiki. |
| `<workspace>/wikis/<wiki-slug>/config.json` | Wiki-specific configuration produced during sample ingestion. |
| `<workspace>/wikis/<wiki-slug>/index.md` | Wiki-level DOX child contract and catalog. |
| `<workspace>/wikis/<wiki-slug>/chunking-strategy.md` | Discovered chunking rationale produced during sample ingestion. |
| `<workspace>/wikis/<wiki-slug>/<dynamic-folders>/` | Folders and subfolders created by the orchestrator based on document content. |
| `<workspace>/wikis/<wiki-slug>/<dynamic-folders>/index.md` | Child DOX contract for that folder (catalog + navigation + contract). |

### FR-002: DOX-inspired hierarchical contracts
The wiki must be self-describing through a hierarchy of `index.md` contracts:

- The root `index-of-indexes.md` is the **root DOX contract**. It explains the wiki-of-wikis structure, lists all child wikis, and provides top-level navigation instructions for the AI agent.
- Each wiki's `index.md` is a **child DOX contract**. It contains:
  - A catalog of the wiki's pages and subfolders.
  - Navigation instructions for the AI agent.
  - The child contract: page types, entity types, citation rules, and traversal guidance for that wiki.
- Every folder inside the wiki has an `index.md` that acts as a **child DOX contract** for that folder, with catalog + navigation + contract sections.

No separate `wikis/<slug>/AGENTS.md` file is used. The contract is embedded in the `index.md` hierarchy.

### FR-003: Wiki-level index page
Each wiki must produce a markdown `index.md` that serves as the entry point for that wiki. The index must include:
- A short summary of the wiki's subject and scope.
- A catalog of all source PDFs in the wiki with file metadata (name, page count, ingestion date, any extraction warnings).
- Links to all document pages and any raw/failed-extraction pages.
- A tag list or topic map extracted from the corpus.
- Citations to every source PDF.
- Navigation instructions for the AI agent (e.g., "To understand financial connections, read the [[Entities]] folder first").
- The child contract for the wiki (page types, entity types, citation rules).

### FR-004: Top-level index-of-indexes
The workspace must produce a top-level `index-of-indexes.md` that includes:
- A list of every wiki in the workspace with title, slug, source count, page count, and a one-line scope summary.
- A link to each wiki-level `index.md`.
- A search-oriented overview so a research AI agent can choose which wiki or wikis to investigate.
- Cross-wiki entity and topic sections that surface names appearing in multiple wikis, with links to each wiki's page.
- Last-updated timestamp and overall corpus statistics.
- Navigation instructions for the AI agent traversing the wiki-of-wikis.

### FR-005: Sample ingestion command
The CLI must provide a `sample` command that accepts a wiki slug and a path to one representative PDF from that wiki's `raw/` folder. The command must:
- Detect the PDF structure (page layout, reading order, headings, tables, figures, footnotes, appendices, scanned pages).
- Identify the concepts, entities, and recurring sections that need extraction.
- Produce an individualized `chunking-strategy.md` for this report type.
- Run the orchestrator to analyze the document content sequentially chunk-by-chunk, using a custom orchestrator of LLM agents with rolling memory.
- Propose a dynamic folder hierarchy for the wiki.
- Produce the required artifacts: `chunking-strategy.md`, a wiki-level `index.md`, folder-level `index.md` files, and the first set of wiki pages.
- Print a plain-language summary for the journalist.

### FR-006: Artifact 1 — chunking-strategy.md
For every sample ingestion, the CLI must produce a `wikis/<wiki-slug>/chunking-strategy.md` report containing:
- A description of the discovered PDF structure (cover, TOC, executive summary, sections, tables, figures, footnotes, appendices, scanned pages).
- The chosen chunk boundaries (e.g., per page, per section heading, per table, per figure) and the rationale for each boundary.
- A list of content types that must never be split (e.g., tables across pages, multi-page footnotes, figure captions with their figures).
- Maximum chunk size in characters and minimum chunk size policy.
- A fallback rule for malformed or unparseable pages.
- A concrete example: at least one chunk specification with page range and content description.

### FR-007: Artifact 2 — wiki-level index.md (DOX child contract)
For every sample ingestion, the CLI must produce a `wikis/<wiki-slug>/index.md` that:
- Follows the DOX child contract format.
- Includes YAML frontmatter with title, type, wiki slug, updated timestamp, and source list.
- Contains a catalog of all top-level folders and pages.
- Provides navigation instructions for the AI agent.
- Contains the child contract: page types, entity types, relationship types, tag taxonomy, naming conventions, citation rules, and any wiki-specific conventions.
- Links to the wiki's source pages and top-level document/topic/entity/raw folders.

### FR-008: Artifact 3 — folder-level index.md files
For every sample ingestion, the CLI must produce an `index.md` in every folder it creates. Each folder-level `index.md` must:
- Follow the DOX child contract format.
- Include a catalog of the folder's pages and subfolders.
- Provide navigation instructions for the AI agent.
- Contain the child contract for that folder: page types, entity types, citation rules, and traversal guidance.
- Link to the parent folder's `index.md` and to child subfolders' `index.md` files.

### FR-009: Artifact 4 — config.json
For every sample ingestion, the CLI must produce a `wikis/<wiki-slug>/config.json` that controls full ingestion. The config must include:
- Wiki title, slug, description, and version.
- Reference to the source `chunking-strategy.md`.
- Chunking parameters (max chunk size, split boundaries, never-split rules, overlap policy if any).
- Extraction settings (PDF engine, OCR toggle, page range filter if any).
- Output paths and page-type mappings.
- A `status` field indicating whether full ingestion is approved.

### FR-010: Full ingestion command
The CLI must provide an `ingest` command that processes every PDF in a wiki's `raw/` folder according to the wiki's `config.json` and the wiki-level `index.md` contract. The command must:
- Read `config.json` and the wiki-level `index.md`.
- Apply the individualized chunking strategy discovered during sample ingestion.
- Extract every page, table, and note.
- Process each PDF sequentially chunk-by-chunk using the orchestrator with rolling memory.
- Produce document pages, source pages, topic pages, entity pages, and any raw/failed-extraction pages into the dynamic folder hierarchy.
- Write or update folder-level `index.md` files as child contracts.
- Update the wiki-level `index.md` and the top-level `index-of-indexes.md`.
- Report per-file and per-wiki statistics, warnings, and errors.
- Propose structural changes (e.g., new folder categories) when the corpus cannot be organized by the existing hierarchy; pause for human approval and restart on accept.

### FR-011: PDF extraction fidelity
The PDF extractor must:
- Preserve reading order.
- Extract text, tables, lists, and headings.
- Detect and flag scanned or image-only pages so OCR can be applied.
- Preserve page numbers as they appear in the PDF (logical page numbers) and map them to physical PDF pages.
- Capture document-level metadata (title, author, creation date, number of pages) when available.
- Never silently drop pages, tables, or footnotes.

### FR-012: Chunking rules
Chunking must follow the strategy in `config.json` and must never split at arbitrary byte or character offsets. In particular:
- Splits must occur at semantic boundaries: page boundaries, section headings, or complete tables/figures.
- Tables, figures, and their captions must not be split across chunks unless they physically span pages, in which case the strategy must describe how to preserve continuity.
- A chunk must contain enough surrounding context (e.g., section heading + paragraph) for the content to remain understandable.
- Each chunk must record its source page range and boundary type in metadata.
- Chunks below the minimum size must be flagged, not discarded.
- For large documents, the orchestrator must adapt chunk boundaries to stay within context limits while preserving semantic boundaries when feasible.

### FR-013: Page types and schema
Every generated wiki page must have a `type` field in its YAML frontmatter. The MVP must support at least these page types:

| Type | Purpose | Required frontmatter |
|---|---|---|
| `index` | Wiki-level, folder-level, or top-level roadmap. | `title`, `type`, `updated`, `wiki` |
| `document` | A page representing a chunk or full PDF. | `title`, `type`, `tags`, `sources`, `confidence` |
| `source` | A catalog page for one raw PDF file. | `title`, `type`, `file`, `pages`, `ingested`, `warnings` |
| `topic` | A concept, theme, or recurring section. | `title`, `type`, `tags`, `related` |
| `entity` | A person, organization, product, location, case, or event. | `title`, `type`, `tags`, `mentions` |
| `raw` | A failed-extraction or fragment page. | `title`, `type`, `source`, `reason`, `raw_fragment` |

### FR-014: Citation and provenance model
Every claim in a wiki page must be traceable to a specific source PDF and page range. The system must:
- Use inline footnote citations of the form `[^srcN]`.
- Map each `[^srcN]` to a `sources` entry in the YAML frontmatter.
- Each source entry must contain: `file` (relative path from workspace root), `pages` (logical page range), and `extracted` (ISO 8601 timestamp).
- Document pages must cite the originating PDF on every substantive section, table, and quotation.
- Source catalog pages must list the full provenance of the raw file, including file hash (SHA-256) and extraction warnings.

### FR-015: Wikilink model
Pages must cross-reference each other using `[[Page Title]]` wikilinks. The system must:
- Link every entity mention to its canonical entity page when one exists.
- Link every topic mention to its topic page.
- Link every document page to its source page and to the wiki-level index.
- Ensure the top-level `index-of-indexes.md` links to each wiki-level index.
- Record unresolved or ambiguous links in the lint output.

### FR-016: Malformed or unparseable content handling
If the extractor cannot parse a page, table, or region, the system must:
- Emit a `raw` page (type `raw`) containing the fragment and metadata.
- Record the reason for failure (e.g., "OCR failed", "encrypted page", "corrupted table structure").
- Preserve the original fragment as text, image reference, or base64 data when feasible.
- Surface the failure in the wiki-level index, the source page, and the CLI summary.
- Never silently drop unparseable content.

### FR-017: Source catalog pages
For every PDF ingested, the system must produce a `source` page containing:
- File path, filename, logical page count, physical page count, file size, and SHA-256 hash.
- Document metadata (title, author, subject, creation date) if extractable.
- A list of document pages derived from this PDF with links.
- A list of `raw` pages produced from this PDF with links.
- Ingestion timestamp and any extraction warnings.

### FR-018: Topic and entity pages (wiki-local)
Within a single wiki, the system must generate:
- `topic` pages for recurring themes, sections, or concepts identified during ingestion.
- `entity` pages for people, organizations, products, locations, cases, and events mentioned repeatedly.
- Each page must consolidate mentions from the wiki's own source pages and document pages.
- Entity resolution in this MVP is per-wiki only; the same name in two different wikis may produce two distinct pages. Cross-wiki resolution is deferred to a shared index.

### FR-019: Incremental updates
When a PDF is added, changed, or removed from a wiki's `raw/` folder and the CLI is re-run, the system must:
- Detect changes by file modification time and hash.
- Re-extract only changed PDFs (or their affected chunks).
- Update existing pages, source pages, indexes, and entity/topic pages.
- Preserve unchanged pages and their incoming links unless the source changed.
- Report which files were added, updated, or removed.
- Restart ingestion if a structural change is accepted during full ingestion.

### FR-020: CLI commands and UX
The CLI must expose at minimum:
- `llm-wiki-cli sample <wiki-slug> <path-to-pdf>` — run sample ingestion for a new or existing wiki.
- `llm-wiki-cli ingest <wiki-slug>` — run full ingestion for the wiki.
- `llm-wiki-cli ingest-all` — run full ingestion for every wiki in the workspace.
- `llm-wiki-cli status` — show the workspace status: wikis, source counts, page counts, last ingestion, and warnings.
- `llm-wiki-cli --help` and per-command help.

All commands must:
- Emit plain-language progress messages suitable for a journalist.
- Write a machine-readable run log to `.kimi-code/logs/YYYY-MM-DD_HH-MM-SS_<command>.json`.
- Return a non-zero exit code on fatal errors.
- Never transmit raw PDFs or extracted content over the network.

### FR-021: Configuration inheritance and defaults
The CLI must support a workspace-level `.kimi-code/config.json` for defaults (e.g., default chunk size, LLM provider, output directory). Wiki-level `config.json` must override workspace defaults. Missing required fields must produce a clear error before ingestion begins.

### FR-022: LLM usage constraints
The system may use LLMs for structure discovery, chunking strategy, and page drafting, but must:
- Never send raw PDFs to a remote LLM; only extracted text, metadata, and structure descriptions may be sent.
- Record which LLM provider and model were used in the run log.
- Support local-only operation when no LLM is configured (extraction and basic chunking still function; planning and drafting may be skipped or produce minimal output).
- Surface estimated token usage and cost for each LLM call in the run log.

### FR-023: Orchestrator-driven ingestion
The system must use a custom orchestrator of LLM agents to perform research, planning, and writing. The orchestrator must:
- Be delivered as a custom skill (`.zcode/skills/llm-wiki-orchestrator/SKILL.md`) tailored for this app.
- Process documents sequentially chunk-by-chunk for 1000+ page PDFs.
- Maintain rolling memory between chunks, combining a compressed summary and a structured state object.
- Use context-cautious chunking: adapt chunk boundaries to stay within context limits, erring on the side of more chunks with smaller context consumption.
- Run a full pipeline of sub-agents per chunk:
  - `StructureAnalyst` — identifies headings, sections, exhibits, and boundaries.
  - `EntityExtractor` — finds people, organizations, locations, cases, events, and products.
  - `RelationshipExtractor` — finds relationships between entities.
  - `EvidenceCollector` — extracts tables, figures, and key claims with exact page citations.
  - `PagePlanner` — proposes pages, links, and folder placements.
  - `ChunkWriter` — drafts markdown pages and folder `index.md` contracts.
  - `Critic` — reviews output for errors, hallucinations, and missing citations.
- Validate agent outputs in the order: per-agent `Critic` → deterministic checks → schema validation.

### FR-024: Wiki-of-wiki agent
The system must include a separate "wiki-of-wiki agent" that:
- Reads every wiki's top-level `index.md`.
- Maintains the top-level `index-of-indexes.md`.
- Surfaces cross-wiki entity and topic names that appear in multiple wikis, with links to each wiki's page.
- Does not merge or resolve cross-wiki entities; it only lists shared names and provides navigation links.

### FR-025: Structural change proposals
During full ingestion, if the orchestrator discovers that the existing folder structure cannot accommodate the corpus (e.g., a new entity category, document section, or topic), it must:
- Propose the structural change in human-readable text with pros and cons.
- Pause ingestion and wait for the user to accept or reject the proposal.
- If accepted, update the relevant `index.md` contracts and restart ingestion from the beginning.
- If rejected, continue with the existing structure and flag any data that could not be properly placed.

---

## 4. Data Model

### 4.1 Wiki workspace (file system)

```
<workspace>/
├── .kimi-code/
│   ├── config.json              # workspace defaults
│   ├── GOALS.md                 # project goal
│   ├── FRD.md                   # this document
│   └── logs/                    # run logs
├── index-of-indexes.md          # root DOX contract and top-level roadmap
└── wikis/
    └── <wiki-slug>/
        ├── config.json          # wiki config
        ├── chunking-strategy.md # chunking rationale
        ├── raw/                 # source PDFs
        ├── index.md             # wiki-level DOX child contract
        └── <dynamic-folders>/   # folders and subfolders created by the orchestrator
            ├── index.md         # folder-level DOX child contract
            └── <pages>.md       # document, source, topic, entity, raw pages
```

### 4.2 Page frontmatter schema (common fields)

```yaml
---
title: "Page Title"
created: "2026-07-04T12:00:00Z"
updated: "2026-07-04T12:00:00Z"
type: "document"        # index | document | source | topic | entity | raw
wiki: "acme-annual-reports"
tags: ["finance", "annual-report", "2024"]
confidence: "high"      # high | medium | low
sources:
  - file: "wikis/acme-annual-reports/raw/2024-annual-report.pdf"
    pages: "1-12"
    extracted: "2026-07-04T12:00:00Z"
---
```

### 4.3 Folder-level index.md contract schema

```yaml
---
title: "Financial Reports"
type: "index"
wiki: "acme-annual-reports"
updated: "2026-07-04T12:00:00Z"
parent: "../index.md"
children:
  - "2024/index.md"
  - "2025/index.md"
---

# Financial Reports

## Catalog

- [[2024 Annual Report]] — full annual report for 2024.
- [[2025 Annual Report]] — full annual report for 2025.

## Navigation

- To compare financials across years, read the [[2024 Annual Report]] and [[2025 Annual Report]] pages.
- For entity relationships, see [[../entities/organizations/index.md]].

## Contract

- Page types in this folder: `document`.
- Citation format: `[^srcN]` mapped to `sources` frontmatter.
- Every table must be preserved with its original header row.
```

### 4.4 Wiki-level index.md contract schema

```yaml
---
title: "Acme Annual Reports"
type: "index"
wiki: "acme-annual-reports"
updated: "2026-07-04T12:00:00Z"
children:
  - "documents/index.md"
  - "sources/index.md"
  - "entities/index.md"
  - "topics/index.md"
  - "raw/index.md"
---

# Acme Annual Reports

## Scope

Annual reports for Acme Corp, 2020-2024.

## Catalog

- [[documents/index.md]] — document pages by section and year.
- [[sources/index.md]] — source PDF catalog.
- [[entities/index.md]] — people, organizations, and products mentioned.
- [[topics/index.md]] — recurring themes and concepts.
- [[raw/index.md]] — scanned or unparseable fragments.

## Navigation

- To find financial data, start at [[documents/index.md]] → `financial` subfolder.
- To find related entities, start at [[entities/index.md]].

## Contract

- Page types: `document`, `source`, `topic`, `entity`, `raw`.
- Entity types: `person`, `organization`, `location`, `case`, `event`, `product`.
- Citation format: `[^srcN]`.
- Naming convention: `<slug>-part-NNN.md` for document chunks, `<entity-slug>.md` for entities.
```

### 4.5 Config.json schema

```json
{
  "wiki": {
    "slug": "acme-annual-reports",
    "title": "Acme Annual Reports",
    "description": "Annual reports for Acme Corp, 2020-2024",
    "version": "1.0"
  },
  "schema": {
    "chunking_strategy_md": "chunking-strategy.md"
  },
  "chunking": {
    "max_chunk_size": 100000,
    "min_chunk_size": 1000,
    "split_boundary": "page",
    "never_split": ["table", "figure_with_caption", "multi_page_footnote"],
    "overlap": 0
  },
  "extraction": {
    "engine": "pdfjs-dist",
    "ocr_enabled": true,
    "page_range": null
  },
  "output": {
    "dir": "output",
    "page_types": ["index", "source", "document", "topic", "entity", "raw"]
  },
  "status": "ready"
}
```

---

## 5. Tech Stack

| Layer | Technology | Purpose | Notes |
|---|---|---|---|
| Runtime | Node.js 20+ | CLI execution | Local-only. No server. |
| CLI Framework | Commander.js | Command parsing | Existing. |
| PDF extraction | pdfjs-dist | Text and metadata extraction | Preserves reading order; detects scanned pages. |
| YAML frontmatter | gray-matter | Read and write YAML frontmatter | Existing. |
| LLM client | Custom client with Kimi/OpenAI/Anthropic adapters | Structure discovery and drafting | Only extracted text and metadata sent; no raw PDFs. |
| Orchestrator | Custom skill | Agent orchestration | `.zcode/skills/llm-wiki-orchestrator/SKILL.md`. |
| Hashing | crypto | SHA-256 for file integrity | Existing. |
| Logging | Built-in JSON | Run logs | Existing. |

*Note: No SQLite, no FTS5, no web framework, no LangGraph.js in this MVP.*

---

## 6. Constraints & Non-Functional Requirements

### 6.1 Data fidelity constraints
- **NF-001:** No page, table, footnote, or figure from a PDF may be silently discarded during ingestion. If it cannot be extracted cleanly, it must appear as a `raw` page.
- **NF-002:** Chunking must use semantic boundaries only. Arbitrary byte, character, or token offsets are prohibited.
- **NF-003:** Every document page must cite the source PDF and page range for every substantive claim, table, and quotation.
- **NF-004:** Every folder must have an `index.md` that explains its contents and conventions.

### 6.2 Performance constraints
- **NF-005:** The CLI must process a single 100-page PDF in under 5 minutes on a standard laptop (without LLM calls) and in under 15 minutes with LLM-assisted drafting.
- **NF-006:** The CLI must support wikis with up to 50 PDFs (the expected MVP corpus size) without running out of memory on a machine with 16 GB RAM.
- **NF-007:** Incremental re-ingestion must complete in time proportional to the changed files, not the full corpus, unless a structural restart is required.

### 6.3 Reliability constraints
- **NF-008:** Extraction failures on one PDF must not block ingestion of other PDFs or other wikis.
- **NF-009:** The CLI must produce a valid run log for every invocation, even on partial failure.
- **NF-010:** Markdown output must be valid CommonMark with valid YAML frontmatter; invalid pages must be flagged.
- **NF-011:** Agent outputs must pass validation before being accepted; failures must trigger retry or escalation.

### 6.4 Security and privacy constraints
- **NF-012:** Raw PDFs must never be transmitted over the network.
- **NF-013:** Extracted text may be sent to a configured LLM provider, but only with explicit user opt-in and provider/model recorded in the run log.
- **NF-014:** All output remains in the local workspace; no deployment or sync to a remote server in this MVP.

### 6.5 Usability constraints
- **NF-015:** Error messages and warnings must be plain-language and actionable for a non-engineer.
- **NF-016:** The CLI must provide `--help` and per-command help with examples.
- **NF-017:** Progress output must indicate which file is being processed and what stage is running.
- **NF-018:** Structural change proposals must be presented in plain language with pros and cons, and the user must explicitly accept or reject them.

---

## 7. Non-Goals / Out of Scope

The following items are explicitly deferred to later phases:

- **NG-001:** Cross-document entity resolution across the entire workspace or across wikis beyond the shared `index-of-indexes.md` surfacing.
- **NG-002:** Cross-document connection synthesis across multiple wikis (e.g., generating a report that compares findings across wikis).
- **NG-003:** Support for file types other than PDF. CSV, PPTX, DOCX, JSON, NDJSON, images, TXT, and Markdown are out of scope for this MVP.
- **NG-004:** SQLite database, FTS5 index, or any structured database backend. Output is local markdown and JSON only.
- **NG-005:** `llm-wiki-app`, web frontend, Express backend, Researcher Agent, and customer-facing query pipeline.
- **NG-006:** Human approval gate for every page. The journalist reviews structural proposals and artifacts manually; the CLI does not pause for per-page approval.
- **NG-007:** Deploy/sync to a remote server or cloud storage.
- **NG-008:** File watcher daemon as the primary mode. Watching is optional; manual invocation is primary.
- **NG-009:** Contradiction detection, stale-page detection, and automated quality scoring beyond basic lint checks.
- **NG-010:** Multi-tenant or multi-user support.
- **NG-011:** LangGraph.js or any other external agent orchestration framework. The MVP uses the custom orchestrator skill.
- **NG-012:** Summarization that reduces data. Pages may organize and structure data, but they must not omit source content that the user could plausibly need to find a connection.

---

## 8. Quality & Acceptance Criteria

The MVP is accepted when all of the following can be demonstrated:

- **QA-001:** A new wiki can be bootstrapped with `llm-wiki-cli sample <wiki> <pdf>` and all required artifacts are produced.
- **QA-002:** The generated wiki-level `index.md` contains valid YAML frontmatter, catalog, navigation, and contract sections.
- **QA-003:** Every folder created by the orchestrator has an `index.md` with catalog + navigation + contract.
- **QA-004:** Running `llm-wiki-cli ingest <wiki>` on a wiki with 5-10 PDFs produces a wiki-level `index.md`, source pages, document pages, and an updated `index-of-indexes.md`.
- **QA-005:** Every table, figure, and page from the PDFs is either represented in a document page or recorded as a `raw` page; no source data is silently lost.
- **QA-006:** Citations in document pages can be traced back to the source PDF and page range through the YAML frontmatter and inline footnotes.
- **QA-007:** A malformed or scanned page that cannot be extracted cleanly produces a `raw` page with metadata and does not crash the ingestion.
- **QA-008:** Adding a new PDF to a wiki and re-running `ingest` updates only the affected pages and indexes unless a structural restart is accepted.
- **QA-009:** `llm-wiki-cli status` correctly reports the number of wikis, source files, generated pages, and any warnings.
- **QA-010:** A research AI agent can read `index-of-indexes.md`, choose a wiki, read the wiki-level `index.md`, follow folder-level `index.md` files, and reach document pages and source pages with citations.
- **QA-011:** The orchestrator proposes a structural change with pros/cons when the existing hierarchy cannot accommodate the corpus, and restarts ingestion on acceptance.
- **QA-012:** Agent output validation catches at least one error class and triggers a retry.
- **QA-013:** All output is local; no raw PDFs are transmitted over the network.

---

*End of FRD.*
