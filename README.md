# LLM Wiki CLI

## 1. Introduction

**LLM Wiki CLI** is a local Node.js command-line tool that transforms collections of related PDFs into a **wiki-of-wikis**: each collection becomes its own markdown wiki with its own index, and every wiki index rolls up into a top-level **index-of-indexes**. It is built for investigative journalism and research, where every claim must be traceable to an exact source location and no relevant data can be silently dropped.

The MVP handles **PDFs only**. It runs entirely on your local machine — no server, no database, and no raw files transmitted over the network. An optional LLM can assist with structure discovery, but only extracted text and metadata are sent; raw PDF bytes are never transmitted.

In one sentence: **drop a folder of PDFs, run two commands, and get a cross-linked, citation-backed markdown research wiki.**

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

## 3. App Flow and Orchestration (Developer View)

This section explains the pipeline step-by-step for a mid-level developer.

### Commands

The CLI exposes six commands via `src/cli.ts`:

- `sample <slug> <pdf>` — analyzes one PDF and bootstraps the wiki.
- `ingest <slug>` — processes every PDF in the wiki.
- `ingest-all` — processes every wiki in the workspace.
- `status` — reports workspace state.
- `configure-llm` — interactive LLM setup wizard.
- `test-llm` — tests the LLM connection with an optional prompt.

### Per-command flow

#### `sample`

1. Validate the PDF is inside `wikis/<slug>/raw/`.
2. Extract the PDF with `pdfjs-dist` (`src/extractor/pdf.ts`).
3. Analyze structure and chunk the content (`src/chunking/chunker.ts`).
4. Write `chunking-strategy.md` and `config.json`.
5. Run the **sample orchestrator** (`src/orchestrator/index.ts`) over the chunks.
6. The orchestrator produces the wiki-level `index.md` and folder-level `index.md` contracts.
7. Write the first document pages, source page, and raw pages.
8. Write a JSON run log to `.kimi-code/logs/`.

#### `ingest`

1. Load the wiki `config.json` and warn if `status` is not `"ready"`.
2. Discover all PDFs in `wikis/<slug>/raw/`.
3. Compare each PDF's SHA-256 to the last run in `output/.state/ingest-state.json`.
4. For each changed PDF:
   - Extract and chunk it.
   - Run the **ingest orchestrator** (`src/orchestrator/ingest.ts`), passing the accumulated rolling memory.
   - Write document, source, and raw pages using the existing writers.
   - Extract entities and topics for the corpus.
5. Write or update entity and topic pages.
6. Write or update folder-level `index.md` contracts and the wiki-level `index.md`.
7. Write the generated `output/index.md`.
8. Run the **wiki-of-wiki agent** (`src/orchestrator/wiki-of-wiki.ts`) to surface cross-wiki names and update `index-of-indexes.md`.
9. Run deterministic lint and write `output/lint/report.json`.
10. Write a JSON run log.

### The seven-agent pipeline

Both `sample` and `ingest` share the same orchestrator pipeline (`src/orchestrator/agents.ts`):

1. **StructureAnalyst** — derives headings, sections, and chunk boundaries from `ExtractionResult` and `Chunk[]`.
2. **EntityExtractor** — regex-based extraction of people, organizations, locations, cases, events, and products.
3. **RelationshipExtractor** — captures co-occurrence relationships between extracted entities.
4. **EvidenceCollector** — surfaces key claims, tables, and figures.
5. **PagePlanner** — proposes a folder hierarchy and page plan. Uses the configured LLM if enabled; otherwise falls back to deterministic defaults.
6. **ChunkWriter** — records the planned page files. The actual markdown is materialized by the existing writers in `src/writers/`.
7. **Critic** — deterministic review of the plan. Flags missing titles, invalid page types, missing folders, and schema issues.

### Rejection loop and criteria

The **Critic** and `validatePagePlan` (`src/orchestrator/validation.ts`) form the rejection loop:

- **Schema issues**: a page missing `title`, `folder`, or using an unknown `pageType`.
- **Missing content**: zero pages or zero folder placements.
- **Citation issues**: invalid `[^srcN]` mappings detected by the lint module.
- **Wikilink issues**: broken `[[Page Title]]` links detected by the lint module.

If the Critic reports high-severity issues, the orchestrator still returns the plan with a `confidence: "low"` flag, and the issues are surfaced in the CLI summary and run log. The command does **not** abort; the plan is applied with warnings so the user can inspect and fix the output.

### Structural change proposals

During full ingestion, `runIngestOrchestrator` compares the current folder plan against the accumulated hierarchy in rolling memory. If new folders are needed (e.g., a new entity type appears), a `StructuralProposal` is generated. The current implementation logs the proposal and applies the new hierarchy automatically, keeping the CLI non-interactive. Future versions can add an interactive prompt or `--yes` flag to pause for approval.

### Incremental updates

`src/ingestion/state.ts` tracks per-source SHA-256. Re-running `ingest` with unchanged PDFs skips extraction entirely and updates only the top-level indexes. Added, changed, or removed PDFs trigger selective reprocessing; stale output from removed PDFs is deleted automatically.

## 4. Detailed Technical Architecture

This section is intended for senior developers who need to understand, modify, or extend the entire system.

### Module responsibilities

- **`src/cli.ts`** — Commander.js entry point. Registers commands, parses options, and dispatches to `commands/`.
- **`src/commands/`** — One module per command. Handles user-facing validation, prints summaries, and writes run logs via `src/log.ts`.
- **`src/config.ts`** — Default configuration, `loadConfig`, `buildConfig`, `mergeConfig`, and `validateConfig`. Config precedence: wiki `config.json` → workspace `.kimi-code/config.json` → `defaultConfig`.
- **`src/workspace.ts`** — Wiki discovery, path helpers, and `toRelativePath`. All stored paths use forward slashes.
- **`src/extractor/`** — `pdf.ts` wraps `pdfjs-dist/legacy/build/pdf.mjs` with `useSystemFonts: true`. It reads the whole PDF into a `Uint8Array` and returns `ExtractionResult`. `batch.ts` provides `safeExtractPdf` for malformed files.
- **`src/chunking/`** — `chunker.ts` runs `analyzeAndChunk`, grouping pages into semantic chunks. The strategy writer produces `chunking-strategy.md`.
- **`src/ingestion/`** — `engine.ts` implements `runIngestion`. `state.ts` implements `IngestionState` with SHA-256 tracking and now an optional `memory` field for the orchestrator.
- **`src/writers/`** — Markdown writers for source, document, raw, index, and config files.
- **`src/entities/`** and **`src/topics/`** — Regex/statistical extraction of named entities and themes, plus page writers.
- **`src/wikilinks/`** — Link helpers (currently minimal).
- **`src/lint/`** — Deterministic validation of YAML frontmatter, citation source resolution, and wikilink existence.
- **`src/llm/`** — Client abstraction supporting OpenAI, Anthropic, Kimi, OpenAI-compatible, and test providers. Kimi uses the Anthropic messages format with `x-api-key` and `anthropic-version: 2023-06-01` headers.
- **`src/log.ts`** — Builds and writes JSON run logs to `.kimi-code/logs/`.
- **`src/prompt.ts`** — Hidden input utility for API keys.
- **`src/errors.ts`** — `CLIError` for expected failures.

### Orchestrator internals

- **`src/orchestrator/types.ts`** — Shared types: `ExtractedEntity`, `ExtractedRelationship`, `PagePlan`, `FolderPlan`, `OrchestratorMemory`, `CriticReview`, `OrchestratorResult`.
- **`src/orchestrator/agents.ts`** — Implements the seven sub-agents plus `createInitialMemory`, `updateMemory`, and `defaultFolderPlacements`.
- **`src/orchestrator/index.ts`** — `runSampleOrchestrator`: runs the agents, writes wiki-level and folder-level contract indexes.
- **`src/orchestrator/ingest.ts`** — `runIngestOrchestrator`: runs the agents per PDF, merges rolling memory, detects structural proposals, and writes the full hierarchy contracts.
- **`src/orchestrator/contracts.ts`** — `writeWikiIndexContract` and `writeFolderIndexContract`; produce DOX-style child contracts with YAML frontmatter.
- **`src/orchestrator/validation.ts`** — `validatePagePlan` and helper checks.
- **`src/orchestrator/wiki-of-wiki.ts`** — Reads entity/topic page titles across all wikis and surfaces names appearing in more than one wiki.

### Data flow

```
PDF files (raw/)
  → pdfjs-dist extraction (Uint8Array, in-memory)
  → structural analysis + chunking
  → seven-agent orchestrator (plan + memory + critic)
  → existing writers (markdown pages)
  → wiki-of-wiki agent (cross-wiki name discovery)
  → index writers (index-of-indexes + wiki indexes + folder indexes)
  → lint (deterministic validation)
  → run log (JSON)
```

### Citation and provenance model

- Inline citations use `[^srcN]` footnotes.
- Each citation maps to a `sources` entry in the YAML frontmatter with `file`, `pages`, and `extracted` (ISO 8601 timestamp).
- Source pages record SHA-256, logical/physical page counts, file size, metadata, and extraction warnings.
- Wikilinks use `[[Page Title]]` and are resolved by title within the same wiki. Unresolved links are recorded in `lint/report.json`.

### Incremental state model

`IngestionState` (version 1.0) stores:
- `lastRun`: ISO timestamp.
- `sources`: map of relative file path → `SourceState` (sha256, mtime, sourcePage, documentPages, rawPages, entities, topics, chunkCount).
- `memory`: optional `OrchestratorMemory` for rolling memory across runs.

### LLM integration

- The LLM client is disabled by default. It is enabled only when `.kimi-code/config.json` contains a valid `llm` object with `enabled: true` and a known provider.
- The LLM receives only strings: prompts composed of extracted text, metadata, and structure summaries. The client explicitly rejects non-string prompts to prevent accidental PDF transmission.
- Kimi provider: POST to `{baseUrl}/v1/messages`, headers `x-api-key` and `anthropic-version: 2023-06-01`, body Anthropic messages format. The response parser finds the first `type: "text"` content block to handle `thinking` blocks.

### Testing strategy

- Vitest test suite in `tests/`.
- Tests run against the compiled `dist/cli.js`.
- Fixtures include valid/bad workspaces and generated PDFs via `tests/fixtures/pdf-helpers.js`.
- Coverage includes: happy path, missing config, malformed PDF, scanned page, incremental update, LLM config, cross-wiki names, and broken citation/wikilink detection.

## 5. Project Structure

### Repository layout

```
llm-wiki-cli/
├── AGENTS.md              # This file: developer notes and conventions
├── README.md              # User-facing overview and architecture
├── package.json           # Node dependencies and scripts
├── tsconfig.json          # TypeScript configuration (strict, ESM, NodeNext)
├── .env.example           # Example environment variables for API keys
├── dist/                  # Compiled JavaScript (generated by `npm run build`)
├── docs/
│   ├── QUICKSTART.md      # Beginner-friendly step-by-step guide
│   └── USAGE.md           # Detailed command reference for researchers
├── plan/
│   ├── SPRINT_INSTRUCTIONS.md   # Sprint tracker and status
│   ├── sprint-5/through sprint-10/# Sprint plans and validation notes
├── src/
│   ├── cli.ts             # Commander entry point; registers all commands
│   ├── commands/
│   │   ├── sample.ts      # `sample` command implementation
│   │   ├── ingest.ts      # `ingest` command implementation
│   │   ├── ingest-all.ts  # `ingest-all` command implementation
│   │   ├── status.ts      # `status` command implementation
│   │   ├── configure-llm.ts # LLM configuration wizard
│   │   └── test-llm.ts    # LLM connection test command
│   ├── config.ts          # Configuration loading, merging, and validation
│   ├── workspace.ts       # Wiki discovery and path helpers
│   ├── errors.ts          # CLIError class for expected failures
│   ├── log.ts             # JSON run log builder/writer
│   ├── prompt.ts          # Hidden-input prompt utility
│   ├── extractor/
│   │   ├── pdf.ts         # Core PDF extraction using pdfjs-dist
│   │   ├── batch.ts       # Batch runner with safe extraction fallback
│   │   └── types.ts       # Extraction result and failure types
│   ├── chunking/
│   │   ├── chunker.ts     # Semantic chunking logic
│   │   ├── analyzer.ts    # Structure analysis
│   │   ├── strategy-writer.ts # chunking-strategy.md writer
│   │   └── types.ts       # Chunk and strategy types
│   ├── ingestion/
│   │   ├── engine.ts      # Full ingestion engine
│   │   └── state.ts       # Incremental state tracking
│   ├── orchestrator/
│   │   ├── agents.ts      # Seven sub-agents and memory helpers
│   │   ├── contracts.ts   # DOX index contract writers
│   │   ├── index.ts       # Sample orchestrator entry point
│   │   ├── ingest.ts      # Ingest orchestrator entry point
│   │   ├── wiki-of-wiki.ts # Cross-wiki name discovery agent
│   │   ├── validation.ts  # Deterministic plan validation
│   │   └── types.ts       # Orchestrator shared types
│   ├── writers/
│   │   ├── index.ts       # Wiki index and index-of-indexes writers
│   │   ├── document.ts    # Document page writer
│   │   ├── source.ts      # Source page writer
│   │   ├── raw.ts         # Raw/failure page writer
│   │   └── config.ts      # Wiki config writer
│   ├── entities/
│   │   └── index.ts       # Entity extraction and page writer
│   ├── topics/
│   │   └── index.ts       # Topic extraction and page writer
│   ├── wikilinks/
│   │   └── index.ts       # Wikilink helpers
│   ├── lint/
│   │   └── index.ts       # Frontmatter, citation, and wikilink validator
│   └── llm/
│       ├── client.ts      # LLM client implementation
│       ├── types.ts       # LLM config and response types
│       └── adapters.ts    # Provider-specific adapters (if any)
├── tests/
│   ├── fixtures/          # Test fixtures and generated PDF helpers
│   ├── cli.test.ts        # CLI-level tests
│   ├── sample.test.ts     # Sample command tests
│   ├── ingest.test.ts     # Ingest command tests
│   ├── sprint4.test.ts    # Sprint 4+ integration tests (index, lint, LLM, cross-wiki)
│   ├── integration.test.ts # Extraction and malformed-PDF tests
│   ├── extractor.test.ts  # PDF extraction tests
│   ├── writers.test.ts    # Writer unit tests
│   └── llm-config.test.ts # LLM configuration tests
```

### Runtime workspace layout

```
<workspace>/
├── .kimi-code/
│   ├── config.json              # workspace defaults (LLM, chunking, extraction)
│   ├── FRD.md                   # functional requirements (copied/created by user)
│   └── logs/                    # JSON run logs
├── index-of-indexes.md          # top-level roadmap
└── wikis/
    └── <wiki-slug>/
        ├── config.json          # wiki-level config
        ├── index.md             # wiki-level DOX child contract
        ├── chunking-strategy.md # discovered chunking rationale
        ├── raw/                 # source PDFs
        └── output/
            ├── index.md         # generated wiki index
            ├── sources/         # source catalog pages
            ├── documents/       # document chunk pages
            ├── topics/          # topic pages
            ├── entities/        # entity pages
            ├── raw/             # failed/scanned extraction pages
            ├── lint/
            │   └── report.json  # validation issues
            └── .state/
                └── ingest-state.json # incremental state + rolling memory
```

## License

TODO: Add a license (e.g., MIT, Apache-2.0, or proprietary) before distribution.
