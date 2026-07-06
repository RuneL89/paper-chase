# LLM Wiki CLI — User Guide for Researchers

This guide explains how to use **LLM Wiki CLI** from the perspective of an investigative journalist or researcher. You do not need to be a software engineer to use it, but you should be comfortable running a few commands in a terminal.

## What the tool does

LLM Wiki CLI turns a folder of source PDFs into a structured markdown wiki. Each collection of PDFs is called a **wiki**. Every PDF in a wiki becomes:

- a **source page** with file metadata and provenance,
- one or more **document pages** containing extracted text and tables,
- **entity pages** for people, organizations, products, and locations mentioned repeatedly,
- **topic pages** for recurring themes or concepts, and
- **raw pages** for any pages that could not be extracted cleanly.

All of these pages are cross-linked with `[[Page Title]]` wikilinks and cited with `[^srcN]` footnotes that point back to the exact PDF and page range.

## The workspace layout

Everything happens inside a **workspace directory**. A workspace is just a folder on your computer with this structure:

```
my-workspace/
├── .kimi-code/
│   └── config.json          # optional workspace defaults
├── index-of-indexes.md      # top-level roadmap
└── wikis/
    └── acme-annual-reports/
        ├── raw/             # drop PDFs here
        ├── config.json      # created by sample ingestion
        ├── index.md         # wiki-level schema and conventions
        ├── chunking-strategy.md
        └── output/          # generated wiki pages
            ├── index.md
            ├── sources/
            ├── documents/
            ├── topics/
            ├── entities/
            └── raw/
```

You can have as many wikis as you want under `wikis/`. For example:

```
wikis/
├── acme-annual-reports/
├── government-filings/
└── legal-depositions/
```

## Typical workflow

### 1. Prepare your workspace

Create the workspace and the first wiki folder:

```bash
mkdir -p my-workspace/wikis/acme-annual-reports/raw
```

### 2. Add your source PDFs

Copy or move the PDFs you want to ingest into the wiki's `raw/` folder:

```bash
cp ~/Downloads/acme-2022-annual.pdf my-workspace/wikis/acme-annual-reports/raw/
cp ~/Downloads/acme-2023-annual.pdf my-workspace/wikis/acme-annual-reports/raw/
```

### 3. Pick one representative PDF and run sample ingestion

This analyzes the PDF structure and writes the starter configuration files.

```bash
cd llm-wiki-cli-project
npm run dev -- sample acme-annual-reports wikis/acme-annual-reports/raw/acme-2022-annual.pdf -w ../my-workspace
```

After it runs, open these files in your text editor:

- `wikis/acme-annual-reports/chunking-strategy.md` — how the PDF is structured and how it will be split into chunks.
- `wikis/acme-annual-reports/index.md` — the page types and conventions for this wiki.
- `wikis/acme-annual-reports/config.json` — the wiki configuration.
- `wikis/acme-annual-reports/output/documents/` — the generated document page(s).

### 4. Enable full ingestion

In `wikis/acme-annual-reports/config.json`, change the status from `"draft"` to `"ready"`:

```json
{
  "status": "ready"
}
```

This confirms you have reviewed the sample output and are ready to process the rest of the PDFs.

### 5. Run full ingestion

```bash
npm run dev -- ingest acme-annual-reports -w ../my-workspace
```

This processes every PDF in the wiki's `raw/` folder. It will tell you:

- how many sources it processed,
- how many document, entity, topic, and raw pages it generated,
- which PDFs were added, changed, or removed,
- any warnings or errors.

### 6. Explore the wiki

Open the wiki-level contract first:

```
my-workspace/wikis/acme-annual-reports/index.md
```

This explains the wiki's page types and conventions. Then open the generated catalog:

```
my-workspace/wikis/acme-annual-reports/output/index.md
```

From there, follow the `[[...]]` links to source pages, document pages, entity pages, and topic pages. Folder-level indexes such as `output/documents/index.md` and `output/entities/index.md` describe the pages in each folder.

Then open the top-level roadmap:

```
my-workspace/index-of-indexes.md
```

This lists every wiki in the workspace, links to each wiki-level index, and highlights any entity or topic names that appear in multiple wikis.

### 7. Re-ingest when files change

Add a new PDF, remove an old one, or replace a PDF, then run the ingest command again. The CLI will detect the changes and update only the affected pages.

```bash
npm run dev -- ingest acme-annual-reports -w ../my-workspace
```

## Understanding the generated pages

### Source pages

A source page is created for every ingested PDF. It contains:

- file name and relative path,
- SHA-256 hash,
- logical and physical page counts,
- file size,
- PDF metadata (title, author, subject, creation date) if available,
- links to all document pages derived from the PDF,
- links to any raw pages produced from the PDF,
- extraction warnings, such as scanned pages.

### Document pages

Document pages contain the actual extracted text and tables from a PDF. Each page represents one chunk (usually one page or a small page range). The page YAML frontmatter includes:

- `title` — the chunk title,
- `type` — always `document`,
- `tags` — keywords for this chunk,
- `confidence` — `high`, `medium`, or `low`,
- `sources` — the source PDF and exact page range.

Inline `[^srcN]` footnotes connect claims in the text back to the source entry in the frontmatter.

### Entity pages

Entity pages are created for people, organizations, products, and locations mentioned multiple times in the wiki. They list every source and page range where the entity appears, making it easy to spot connections across documents.

### Topic pages

Topic pages work like entity pages but for recurring concepts, themes, or section names.

### Raw pages

If a PDF page is scanned, image-only, or otherwise unparseable, the CLI preserves it as a **raw page** rather than dropping it. The raw page contains a reason for the failure, the original fragment if extractable, and links back to the source PDF.

## Reading the output as a research agent

If you are an AI research agent, the recommended traversal path is:

1. Read `index-of-indexes.md` to discover the wikis in the workspace.
2. Select a wiki and read its `output/index.md`.
3. Follow `[[...]]` wikilinks to source pages, document pages, entity pages, and topic pages.
4. Verify every claim against the inline `[^srcN]` citations and the corresponding `sources` frontmatter entry.
5. Check `output/lint/report.json` for broken wikilinks, invalid citations, or missing frontmatter.

## Troubleshooting

**The CLI says "Workspace not found."**
: Make sure the `-w` path points to a directory that exists and contains a `wikis/` folder.

**The CLI says "This folder does not have a wikis/ directory."**
: Create at least one wiki folder with a `raw/` subfolder.

**The CLI says "Wiki is not marked as ready."**
: Run `sample` first, then edit `config.json` and set `"status": "ready"`.

**No document pages were generated.**
: Check the source page for warnings. If all pages were scanned or the PDF is encrypted, the content will be preserved as raw pages instead.

**Wikilinks are flagged as broken.**
: The lint report lists unresolved links. Most broken links are harmless during a first run and are resolved as more pages are generated.

## Run logs

Every command writes a JSON log to `.kimi-code/logs/`. These logs contain:

- the command that was run,
- the timestamp,
- the source files processed,
- the page counts,
- warnings and errors,
- the LLM provider and model if one was used,
- estimated token usage and cost if an LLM was called.

You can read these logs to understand what happened during a run or to reproduce the same output later.

## Staying local

Everything the CLI generates stays on your computer. No PDF is uploaded, no extracted text is sent anywhere unless you explicitly enable an LLM provider, and even then only text and metadata are sent — never raw PDF bytes.
