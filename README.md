# LLM Wiki CLI

## 1. Introduction

**LLM Wiki CLI** is a local tool for investigative journalism: drop a folder of confidential PDFs, run two commands, and get a wiki of interlinked markdown articles where every claim is cited back to the exact page of the source PDF.

It is inspired by two ideas. **Andrej Karpathy's LLM Wiki Gist** showed that large texts should be split into small, self-contained wiki articles so a reader can navigate without losing the original context. **The DOX Framework** showed that complex knowledge bases should be organized into sub-folders with binding contracts, so you always know what belongs where. LLM Wiki CLI combines both insights and applies them to PDF collections.

It is different from both in one key way. Karpathy's gist is a pattern for splitting text; this tool is a full pipeline that *ingests* PDFs, *writes* the articles, and *preserves* every table, figure, and named entity. DOX uses `AGENTS.md` as both the LLM instruction and the human contract; this tool splits those roles: `AGENTS.md` is the LLM's ingestion guide, while a hierarchy of `index.md` files is the human-facing contract.

It is also **not RAG** (which answers on the fly from raw documents) and **not an automatic connection-finder** (which would match a donor in one corpus to a company in another). It is a *pre-compiled map*: the expensive work happens once at ingestion, producing a browseable, verifiable knowledge base that a journalist or research agent can use to find the story.

In one sentence: **your PDFs become a citation-backed wiki, written by an LLM, organized by contracts, and owned entirely by you.**


## 2. Functional Architecture (End-User View)

At the highest level, the tool works in three layers:

1. **Workspace** — a directory on your computer that holds one or more wikis.
2. **Wiki** — a logical collection of PDFs (e.g., `acme-annual-reports`) living under `wikis/<slug>/`.
3. **Pages** — markdown files generated from the PDFs, linked together with `[[Page Title]]` wikilinks and cited with `[^srcN]` footnotes.

### Typical workflow

1. Create a workspace and put PDFs in `wikis/<slug>/raw/`.
2. Run `sample <slug> <pdf>` on one representative PDF to analyze structure and generate starter config.
3. Review the generated `chunking-strategy.md` and `index.md`, then set `status: "ready"` in `config.json`.
4. Run `ingest <slug>` to process every PDF in the wiki.
5. Browse `index-of-indexes.md` (workspace roadmap) → `wikis/<slug>/index.md` (wiki contract) → `wikis/<slug>/output/index.md` (generated catalog) → individual pages.
6. Add or remove PDFs and re-run `ingest`; only changed files are reprocessed.

### Generated artifacts

| Artifact | Location | Purpose |
|---|---|---|
| `index-of-indexes.md` | workspace root | Top-level roadmap listing all wikis and cross-wiki names. |
| `wikis/<slug>/index.md` | wiki root | Wiki-level DOX contract: catalog, navigation, page-type contract. |
| `wikis/<slug>/chunking-strategy.md` | wiki root | Discovered PDF structure and chunk boundaries. |
| `wikis/<slug>/config.json` | wiki root | Wiki-level config controlling ingestion. |
| `wikis/<slug>/<folder>/index.md` | wiki root | Folder-level DOX child contract. |
| `wikis/<slug>/output/index.md` | wiki output | Generated catalog of all pages in the wiki. |
| `output/sources/` | wiki output | One catalog page per PDF with provenance. |
| `output/documents/` | wiki output | Extracted text and tables per chunk. |
| `output/entities/` | wiki output | People, organizations, products, and locations mentioned repeatedly. |
| `output/topics/` | wiki output | Recurring themes and concepts. |
| `output/raw/` | wiki output | Preserved fragments from scanned or unparseable pages. |
| `output/lint/report.json` | wiki output | Validation results: broken links, invalid citations, missing frontmatter. |
