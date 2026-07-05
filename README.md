# LLM Wiki CLI (MVP)

## Elevator Pitch

LLM Wiki CLI is a local Node.js command-line tool that transforms collections of related PDFs into a **wiki-of-wikis**: each collection becomes its own markdown wiki with its own index, and every wiki index rolls up into a top-level **index-of-indexes**. It is built for investigative journalism and research, where every claim must be traceable to an exact source location and no relevant data can be silently dropped.

The MVP supports **PDFs only**. It runs entirely on your local machine — no server, no database, and no raw files transmitted over the network.

## Features

- **Wiki-of-wikis workspace layout**: organize source PDFs into separate wikis under `wikis/<wiki-slug>/raw/`.
- **Sample ingestion**: analyze one representative PDF and produce four starter artifacts — `chunking-strategy.md`, `AGENTS.md`, `config.json`, and a generated wiki page.
- **Full ingestion**: process every PDF in a wiki according to its `config.json`, producing document pages, source pages, topic pages, entity pages, and raw/failed-extraction pages.
- **Full PDF extraction fidelity**: preserves reading order, extracts text, detects tables, flags scanned pages, and maps logical/physical page numbers.
- **Semantic chunking**: splits only at page or section boundaries; tables, figures, and captions are never split across arbitrary offsets.
- **Citation and provenance**: every substantive claim is backed by inline `[^srcN]` citations mapped to YAML frontmatter source entries with file path, page range, and extraction timestamp.
- **Wikilink graph**: cross-references between document pages, source pages, entity pages, topic pages, and indexes using `[[Page Title]]` links.
- **Incremental updates**: detects added, changed, or removed PDFs by SHA-256 and mtime, and re-ingests only the affected files.
- **Top-level index-of-indexes**: auto-generated roadmap summarizing every wiki and linking to each wiki-level index.
- **Run logs**: every command writes a machine-readable JSON log to `.kimi-code/logs/` for reproducibility and debugging.
- **Local linting**: checks for broken wikilinks, invalid citations, and missing frontmatter, writing a `lint/report.json` per wiki.
- **Optional LLM enhancement**: structure discovery and drafting can use OpenAI or Anthropic, but only extracted text and metadata are sent — never raw PDFs.

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | >= 20.0.0 |
| Language | TypeScript | ^5.5.0 |
| CLI Framework | Commander.js | ^12.1.0 |
| PDF Extraction | pdfjs-dist | ^4.10.38 |
| YAML Frontmatter | gray-matter | ^4.0.3 |
| Dev Runner | tsx | ^4.15.0 |
| Testing | Vitest | ^1.6.0 |
| Hashing | Node.js `crypto` | built-in |

## Prerequisites

- **Node.js 20 or higher** (the tool requires `>=20.0.0`).
- **npm** (installed with Node.js).
- A local file system with read/write access for the workspace directory.
- Optional: an OpenAI or Anthropic API key if you want LLM-assisted structure discovery.

## Installation

1. **Clone the repository** (or copy the project folder):

   ```bash
   git clone <repository-url> wiki-project
   cd wiki-project
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the TypeScript source**:

   ```bash
   npm run build
   ```

4. **(Optional) Link the CLI globally** so you can run `llm-wiki-cli` from anywhere:

   ```bash
   npm link
   ```

   Otherwise, run the CLI from the project root using the built entry point:

   ```bash
   node dist/cli.js --help
   ```

   Or use the dev runner:

   ```bash
   npm run dev -- --help
   ```

5. **Create a workspace directory** for your wikis:

   ```bash
   mkdir my-workspace
   cd my-workspace
   ```

## Configuration

LLM Wiki CLI is primarily config-file based. Two levels of configuration exist:

### 1. Workspace defaults — `.kimi-code/config.json`

Place this file in your workspace root to set defaults for all wikis in that workspace. Example:

```json
{
  "chunking": {
    "max_chunk_size": 40000,
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
  "llm": {
    "enabled": false,
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1"
  }
}
```

Supported `llm.provider` values: `openai`, `anthropic`, `openai-compatible`, `kimi`, `test`.

> **Security note:** Do not commit API keys. Store them in a local `.env` file or enter them temporarily; see `.env.example` for the recommended format. The current MVP reads the API key from `.kimi-code/config.json` only, so you can copy a value from `.env` when running sample ingestion.

### Configure LLM from the CLI (interactive wizard)

The easiest way to set up the LLM is the built-in wizard. It prompts you for the provider, model, base URL, and API key, then optionally tests the connection:

```bash
llm-wiki-cli configure-llm -w ./my-workspace
```

You will see prompts like this:

```text
LLM Configuration Wizard
========================

Supported providers: openai, anthropic, openai-compatible, kimi, test

Provider (kimi): kimi
Model (k2.7-code): k2.7-code
Base URL (https://api.kimi.com/coding): https://api.kimi.com/coding
API key: ***

Test the connection now? [Y/n]: Y
```

The API key is hidden while you type. The wizard saves everything to `.kimi-code/config.json` and then runs `test-llm` if you choose.

> **Note:** If `test-llm` prints `Connection successful.` but the response text is empty, the model may have returned only a non-text block (e.g., a thinking block). Run `test-llm --verbose` to inspect the raw response.

For scripts or CI, you can still pass flags directly:

```bash
llm-wiki-cli configure-llm --provider kimi --api-key "sk-kimi-..." -w ./my-workspace
llm-wiki-cli configure-llm --provider openai --model gpt-4o --api-key "sk-..." -w ./my-workspace
```

> **Security warning:** Passing an API key on the command line may leave it in your shell history. Prefer the interactive wizard for manual setup.

### Kimi example

```json
{
  "llm": {
    "enabled": true,
    "provider": "kimi",
    "model": "k2.7-code",
    "apiKey": "<paste from .env or environment>",
    "baseUrl": "https://api.kimi.com/coding"
  }
}
```

### 2. Wiki-level configuration — `wikis/<slug>/config.json`

This file is generated automatically by `llm-wiki-cli sample`. It overrides workspace defaults and controls how the wiki is ingested. Required fields include `wiki.slug`, `wiki.title`, `wiki.description`, `wiki.version`, `chunking.*`, `extraction.engine`, and `output.*`. The `status` field is `draft` after sample ingestion; change it to `ready` when you want to allow full ingestion.

### 3. Generated schema and strategy files

- `wikis/<slug>/AGENTS.md` — page type taxonomy, naming conventions, tag taxonomy, and citation rules for the wiki.
- `wikis/<slug>/chunking-strategy.md` — the discovered PDF structure and chosen chunk boundaries.

## Usage

All commands accept a `-w, --workspace <path>` option. It defaults to the current working directory.

### Show help

```bash
llm-wiki-cli --help
llm-wiki-cli sample --help
```

### Check workspace status

Shows every discovered wiki, source counts, generated page counts, and any lint warnings.

```bash
llm-wiki-cli status -w ./my-workspace
```

Example output:

```text
Discovered 1 wiki(s) in this workspace:

Wiki: Acme Annual Reports (acme)
  Description: Annual reports for Acme Corp, 2020-2024
  Sources: 5
  Generated pages: 12 (8 documents, 2 entities, 1 topic, 1 raw)
  Last ingestion: 2026-07-04T23:18:10.000Z
```

### Bootstrap a wiki with sample ingestion

Analyze one representative PDF to produce the chunking strategy, schema, config, and a sample wiki page.

```bash
# Create the wiki folder and place a PDF in its raw/ directory
mkdir -p ./my-workspace/wikis/acme/raw
cp annual-report-2024.pdf ./my-workspace/wikis/acme/raw/

# Run sample ingestion
llm-wiki-cli sample acme wikis/acme/raw/annual-report-2024.pdf -w ./my-workspace
```

Artifacts produced:

- `wikis/acme/chunking-strategy.md`
- `wikis/acme/AGENTS.md`
- `wikis/acme/config.json`
- `wikis/acme/output/documents/<pdf-slug>-part-001.md`
- `wikis/acme/output/sources/<pdf-slug>.md`
- `wikis/acme/output/raw/<pdf-slug>-page-NNN.md` (for scanned pages)

After reviewing the artifacts, edit `wikis/acme/config.json` and set `status` to `"ready"` to enable full ingestion.

### Run full ingestion for one wiki

```bash
llm-wiki-cli ingest acme -w ./my-workspace
```

This processes every PDF in `wikis/acme/raw/`, applies the wiki's chunking strategy, writes document/source/topic/entity/raw pages, and updates the wiki-level index and the top-level `index-of-indexes.md`.

### Run full ingestion for every wiki

```bash
llm-wiki-cli ingest-all -w ./my-workspace
```

Each wiki is processed independently; a failure in one wiki does not block the others. The top-level index-of-indexes is refreshed at the end.

### Re-ingest after adding or removing PDFs

Place a new PDF in `wikis/<slug>/raw/` and run `ingest` again. Only changed or new files are re-extracted, and stale output from deleted PDFs is removed automatically.

```bash
# Add a new PDF
cp annual-report-2025.pdf ./my-workspace/wikis/acme/raw/

# Re-ingest incrementally
llm-wiki-cli ingest acme -w ./my-workspace
```

## Project Structure

```
<workspace>/
├── .kimi-code/
│   ├── config.json              # workspace defaults
│   ├── FRD.md                   # functional requirements
│   ├── GOALS.md                 # project goal
│   └── logs/                    # JSON run logs
├── index-of-indexes.md          # top-level roadmap
└── wikis/
    └── <wiki-slug>/
        ├── config.json          # wiki-level config
        ├── AGENTS.md            # schema and conventions
        ├── chunking-strategy.md # chunking rationale
        ├── raw/                 # source PDFs
        └── output/
            ├── index.md         # wiki-level index
            ├── lint/
            │   └── report.json  # lint issues
            ├── sources/         # source catalog pages
            ├── documents/       # document chunk pages
            ├── topics/          # topic pages
            ├── entities/        # entity pages
            └── raw/             # failed/scanned extraction pages
```

Source code layout (in the project root, not the workspace):

```
llm-wiki-cli/
├── src/                         # TypeScript source
│   ├── cli.ts                   # CLI entry point
│   ├── commands/                # sample, ingest, ingest-all, status
│   ├── config.ts                # config loading/merging
│   ├── extractor/               # PDF extraction and batch runner
│   ├── chunking/                # chunking analyzer and strategy writer
│   ├── ingestion/               # full ingestion engine and state
│   ├── writers/                 # markdown writers
│   ├── entities/                # entity extraction and pages
│   ├── topics/                  # topic extraction and pages
│   ├── wikilinks/               # link helpers
│   ├── lint/                    # lint checks
│   ├── llm/                     # LLM client abstraction
│   └── log.ts                   # run log builder
├── dist/                        # compiled JavaScript (after build)
├── tests/                       # Vitest test suite
├── package.json
├── tsconfig.json
└── README.md
```

## Development Scripts

| Script | Command | Description |
|---|---|---|
| Build | `npm run build` | Compile TypeScript to `dist/` using `tsc`. |
| Dev | `npm run dev -- <args>` | Run the CLI via `tsx` without compiling. |
| Test | `npm run test` | Run the full Vitest test suite. |
| Local install | `npm link` | Make `llm-wiki-cli` available globally. |

Example development workflow:

```bash
npm run build
npm run test
npm run dev -- status -w ./my-workspace
```

## Security

- **Raw PDFs never leave your machine.** The CLI reads PDFs locally and writes only markdown and JSON to the workspace. No raw file is transmitted over the network.
- **LLM usage is opt-in.** The LLM client is disabled by default. When enabled, only extracted text, metadata, and structure descriptions are sent — never raw PDF bytes or buffers.
- **No remote server or database.** All output is local. There is no sync, deployment, or cloud storage in this MVP.
- **Run logs are local.** Logs are written to `.kimi-code/logs/` and contain file paths, page ranges, warnings, and optional LLM provider/model names — never API keys or raw content.
- **API key handling.** API keys are read from `.kimi-code/config.json`. Treat that file as sensitive and do not commit it.

## License

TODO: Add a license (e.g., MIT, Apache-2.0, or proprietary) before distribution.
