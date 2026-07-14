# LLM Wiki CLI

## 1. Introduction

**LLM Wiki CLI** is a local command-line tool that turns a folder of PDFs into a citation-backed markdown wiki. It is built for investigative research, compliance reviews, and any workflow where every claim must be traceable to an exact page in the original source document.

Drop a collection of PDFs into a wiki, run two commands, and you get a network of interlinked markdown articles. Each article contains synthesized summaries, extracted tables and figures, named entities, recurring topics, and inline citations like `[^src1]` that map back to the exact PDF and page range.

The tool is inspired by two ideas:

- **Andrej Karpathy's LLM Wiki Gist** — large texts should be split into small, self-contained wiki articles so readers can navigate without losing context.
- **The DOX Framework** — complex knowledge bases should be organized into sub-folders with binding contracts so you always know what belongs where.

LLM Wiki CLI combines both insights and applies them to PDF collections. It differs from **RAG** (which answers questions on the fly from raw documents) and from automatic connection-finders (which would blindly match names across corpora). It is a *pre-compiled map*: the expensive work happens once at ingestion, producing a browseable, verifiable knowledge base that a journalist, analyst, or research agent can use to find the story.

In one sentence: **your PDFs become a citation-backed wiki, written by an LLM, organized by contracts, and owned entirely by you.**

### Core philosophy

- **The LLM is the programmer; the wiki is the codebase.** The LLM plans the structure, writes the pages, adds links and citations, and maintains consistency. Local deterministic code handles PDF extraction, hashing, validation, file I/O, and orchestration.
- **Citation-backed.** Every factual claim uses an inline `[^srcN]` marker that maps to a YAML `sources` entry, which records the exact PDF and page range.
- **Compounding, not ephemeral.** Each ingestion run enriches existing pages and creates new ones. Nothing is lost.
- **LLM-driven structural evolution.** The LLM autonomously creates new folders, reorganizes the wiki, and evolves the page-type taxonomy as the corpus demands. Each structural change is recorded in a log for after-the-fact human review.

---

## 2. Functional Architecture (End-User View)

At the highest level, the tool works in three layers:

1. **Workspace** — a directory on your computer that holds one or more wikis.
2. **Wiki** — a logical collection of PDFs (e.g., `acme-annual-reports`) living under `wikis/<slug>/`.
3. **Pages** — markdown files generated from the PDFs, linked together with `[[Page Title]]` wikilinks and cited with `[^srcN]` footnotes.

### Typical workflow

1. **Create a workspace and a wiki.**
   ```bash
   llm-wiki-cli init acme-annual-reports --title "Acme Annual Reports" -w ./my-workspace
   ```
2. **Copy PDFs** into `my-workspace/wikis/acme-annual-reports/raw/`.
3. **Run `sample`** on one representative PDF to discover structure and generate the starter artifacts.
   ```bash
   llm-wiki-cli sample acme-annual-reports -w ./my-workspace
   ```
4. **Review** the generated `chunking-strategy.md`, `AGENTS.md`, and `index.md`.
5. **Run `ingest`** to process every PDF in the wiki.
   ```bash
   llm-wiki-cli ingest acme-annual-reports -w ./my-workspace
   ```
6. **Browse** the wiki starting from `index-of-indexes.md` → `wikis/<slug>/index.md` → folder-level `index.md` files → individual pages.
7. **Add or remove PDFs** and re-run `ingest`; only changed files are reprocessed.

### Generated artifacts

| Artifact | Location | Purpose |
|---|---|---|
| `index-of-indexes.md` | workspace root | Top-level roadmap listing all wikis and cross-wiki names. |
| `wikis/<slug>/index.md` | wiki root | Wiki-level DOX contract: catalog, navigation, page-type contract. |
| `wikis/<slug>/chunking-strategy.md` | wiki root | Discovered PDF structure and chunk boundaries. |
| `wikis/<slug>/config.json` | wiki root | Wiki-level config controlling ingestion. |
| `wikis/<slug>/AGENTS.md` | wiki root | LLM ingestion guide for this specific corpus. |
| `wikis/<slug>/documents/index.md` | wiki root | Folder-level DOX child contract for document chunks. |
| `wikis/<slug>/documents/<chunk>.md` | wiki root | Extracted text and synthesis per chunk. |
| `wikis/<slug>/sources/index.md` | wiki root | Folder-level DOX child contract for source pages. |
| `wikis/<slug>/sources/<pdf>.md` | wiki root | One catalog page per PDF with provenance. |
| `wikis/<slug>/entities/index.md` | wiki root | Parent contract listing entity sub-folders. |
| `wikis/<slug>/entities/<subfolder>/<slug>.md` | wiki root | Individual entity pages, grouped by type. |
| `wikis/<slug>/topics/index.md` | wiki root | Folder-level DOX child contract for topic pages. |
| `wikis/<slug>/topics/<slug>.md` | wiki root | Recurring themes and concepts. |
| `wikis/<slug>/raw/<pdf>-page-N.md` | wiki root | Preserved fragments from scanned or unparseable pages. |
| `wikis/<slug>/lint/report.json` | wiki root | Validation results: broken links, invalid citations, duplicate entities, missing frontmatter. |
| `wikis/<slug>/.state/rolling-memory.json` | wiki root | Structured rolling memory of entities, topics, relationships, and hierarchy. |
| `wikis/<slug>/.state/memory-summary.md` | wiki root | Compressed natural-language summary of the same memory. |
| `wikis/<slug>/.kimi-code/logs/*.json` | wiki root | JSON run logs for every command. |

### The two roles of documentation

- **`AGENTS.md`** — the **LLM's runbook**. It tells the LLM how to write pages, name files, cite sources, and handle this specific corpus. It is produced during `sample` and updated as the wiki evolves.
- **`index.md` hierarchy** — the **human contract**. The `index-of-indexes.md` → `wikis/<slug>/index.md` → `<folder>/index.md` cascade tells a reader what each folder contains and how to navigate the wiki.

### Setup and usage

#### Requirements

- Node.js >= 20.0.0
- npm

#### Install dependencies

```bash
npm install
```

#### Build the TypeScript source

```bash
npm run build
```

#### Run in development mode

```bash
npm run dev -- <command> [args]
```

#### Configure the LLM

The agent pipeline is LLM-driven. Configure a provider before running `sample` or `ingest`:

```bash
llm-wiki-cli configure-llm -w ./my-workspace
```

Supported providers: `openai`, `anthropic`, `openai-compatible`, `kimi`, and `test`. Use the `test` provider with `enabled: true` for deterministic mock responses during testing.

Test the connection with:

```bash
llm-wiki-cli test-llm -w ./my-workspace
```

#### Full example workflow

```bash
# 1. Create a workspace and a wiki
llm-wiki-cli init acme-annual-reports -w ./my-workspace

# 2. Copy PDFs into the wiki's raw folder
#    my-workspace/wikis/acme-annual-reports/raw/

# 3. Sample one representative PDF
llm-wiki-cli sample acme-annual-reports -w ./my-workspace

# 4. Review chunking-strategy.md, AGENTS.md, and index.md

# 5. Ingest the full wiki
llm-wiki-cli ingest acme-annual-reports -w ./my-workspace

# 6. Ingest all wikis in the workspace
llm-wiki-cli ingest-all -w ./my-workspace

# 7. Check workspace status
llm-wiki-cli status -w ./my-workspace

# 8. Launch the interactive TUI
llm-wiki-cli tui -w ./my-workspace
```

### Security notes

- Never commit `.kimi-code/config.json`; it contains API keys.
- No raw PDF bytes are sent over the network. Only extracted text and metadata go to remote LLMs.
- JSON run logs never include API keys or raw content.

---

## 3. Step-by-Step Architecture / Flow (Mid-Level Developer View)

The CLI is a pipeline of **seven sub-agents** plus deterministic validation. The sub-agents run during `sample` and `ingest`; the validation layer runs during `ingest`.

### The seven sub-agents

1. **StructureAnalyst** — reads the PDF and identifies headings, sections, tables, figures, and logical chunk boundaries.
2. **EntityExtractor** — extracts people, organizations, locations, cases, events, and products mentioned in the text, then merges them with rolling memory.
3. **EntityCritic** — audits the extracted entity list and rejects false positives or hallucinations.
4. **RelationshipExtractor** — identifies relationships between entities (e.g., "John Smith is the CEO of Acme Corp"). During `ingest` it also runs per-chunk to catch cross-chunk relationships.
5. **EvidenceCollector** — collects claims, numbers, dates, tables, and figures, each with its source location.
6. **PagePlanner** — proposes the folder structure, page types, filenames, and the entity taxonomy (sub-folders under `entities/`).
7. **ChunkWriter** — drafts the markdown pages: synthesized summaries, extracted text, citations, and wikilinks.

A separate **EntityTopicPageWriter** agent writes and updates entity and topic pages, preserving existing content.

### The `sample` flow

1. Read the current `AGENTS.md` (usually a skeleton written during `init`).
2. Classify the corpus: single very large document, similar manageable documents, similar very large documents, or mixed corpus.
3. Apply a sampling strategy based on the classification (e.g., read one manageable document fully, sample the rest).
4. Run the seven sub-agents on the sampled material.
5. If the PagePlanner proposes a folder structure different from the existing one, the structural change is applied automatically and recorded in `.kimi-code/proposals/` for after-the-fact review.
6. Write the wiki-level `index.md`, folder-level `index.md` contracts, `entities/<subfolder>/index.md` child contracts, the updated `AGENTS.md`, and the sample document/source pages.
7. Transition the wiki status from `initialized` to `ready` so `ingest` can run.

### The `ingest` flow

1. Read `AGENTS.md` and the wiki `config.json`.
2. Compare each PDF in `raw/` to the last ingestion state by SHA-256. Skip unchanged PDFs; reprocess added, changed, or removed PDFs.
3. For each changed PDF, extract text, tables, and figures with `pdfjs-dist`.
4. Chunk the PDF using the strategy discovered during `sample`. Chunks are page-based; the system never splits inside a table or figure.
5. Run the agents. Page planning happens once per source so the folder structure is stable; entity and topic extraction are refined per-chunk.
6. Detect structural changes relative to the existing folder hierarchy. New folders or reorganizations are applied automatically and logged in `.kimi-code/proposals/` for after-the-fact review. Existing pages are then aligned with the new hierarchy via selective re-ingest.
7. Run the validation pipeline:
   - **Critic review** — LLM quality check with an eight-item checklist and blocking issues.
   - **Completeness check** — deterministic comparison of the LLM-written page to the extracted input to ensure no text, tables, or figures were dropped.
   - **Structural checks** — broken wikilinks, orphaned pages, citation integrity, duplicate entities.
   - **Schema validation** — required YAML frontmatter fields per page type.
8. If validation fails, reprocess the chunk with feedback (up to the configured maximum attempts).
9. Write the final pages, update the folder-level and wiki-level `index.md` contracts, update `index-of-indexes.md`, and write `lint/report.json`.

### Rolling memory

Across multiple PDFs, the orchestrator maintains **rolling memory** (`.state/rolling-memory.json` and `.state/memory-summary.md`). This memory stores canonical entity names, aliases, topics, relationships, the folder hierarchy, and the entity taxonomy so that later PDFs can link back to entities discovered in earlier PDFs and avoid duplicate pages. If the memory grows too large, the oldest 20% of entities, topics, relationships, and summary text are archived into the historical summary.

### Structural-change log

If `ingest` discovers that the corpus needs a new folder structure (e.g., a new `timeline/` folder), the orchestrator applies the change immediately and writes a structural-change log. The log includes the reason, affected folders, pros and cons, and required contract updates. These logs are stored in `.kimi-code/proposals/` for after-the-fact human review; there is no approval gate. The `apply-proposal` command remains available for re-applying an older log if needed.

### Rejection / reprocessing loop

The Critic and the deterministic completeness check can block a chunk. When that happens, the feedback is sent back to the ChunkWriter and the chunk is re-drafted. If a chunk still fails after the maximum number of attempts, the run aborts and the error is reported.

---

## 4. Detailed Technical Architecture (Senior Developer View)

### Tech stack

- **Runtime:** Node.js >= 20.0.0
- **Language:** TypeScript 5.5+ (strict, ESM, `NodeNext` module resolution)
- **CLI framework:** Commander.js
- **PDF extraction:** `pdfjs-dist` legacy build (no worker), `useSystemFonts: true`
- **Frontmatter:** `gray-matter`
- **Tests:** Vitest
- **Dev runner:** `tsx src/cli.ts`
- **TUI:** Ink (React for terminals)

### Module layout

```
src/
├── cli.ts                      # Commander entry point; registers all commands
├── config.ts                   # default config, validation, merge logic
├── workspace.ts                # wiki discovery, path helpers, toRelativePath
├── errors.ts                   # CLIError class
├── prompt.ts                   # interactive prompt utility
├── log.ts                      # JSON run-log builder/writer
├── llm/                        # LLM client abstraction, adapters, JSON parsing
├── extractor/                  # PDF extraction and batch runner
├── chunking/                   # structure analyzer, chunker, strategy writer
├── ingestion/                  # engine, incremental state, resume, reingest, materializer
├── orchestrator/               # sub-agents, memory, contracts, validation, sampling, proposals
├── entities/                   # entity extraction, taxonomy helpers, and page writing
├── topics/                     # topic extraction and page writing
├── wikilinks/                  # link helpers and repair
├── lint/                       # link/citation/frontmatter checks and report writer
├── validation/                 # deterministic validation: completeness, schema
├── writers/                    # markdown writers for pages, source, index, config, log
├── progress/                   # structured progress events for TUI and logs
├── tui/                        # interactive terminal UI
└── utils/                      # slugification, similarity
```

### Key design rules

- **ESM imports end in `.js`** even though source files are `.ts`. TypeScript resolves them with `NodeNext` module resolution.
- **No raw PDF bytes go to the LLM.** The LLM only receives extracted text and metadata.
- **Deterministic code never drafts markdown bodies.** The LLM is the sole author of all content pages.
- **Forward slashes in stored paths.** All relative paths stored in state or frontmatter are normalized to forward slashes via `toRelativePath` from `workspace.ts`, even on Windows.
- **Path handling** uses `path.join`, `path.resolve`, and `toRelativePath` everywhere.

### Configuration precedence

```
wiki config.json > workspace .kimi-code/config.json > src/config.ts defaultConfig
```

### Incremental ingestion

`ingestion/state.ts` tracks per-source SHA-256, per-page metadata (folder, page type, source, last SHA-256), and a run manifest. Re-running `ingest` only processes added, changed, or removed PDFs. Selective re-ingestion (`ingestion/reingest.ts`) is triggered after an approved structural change to move or rewrite only the affected pages.

### Validation pipeline details

1. **Critic (`orchestrator/agents.ts`)** — receives the drafted pages, page plan, extracted input, `AGENTS.md`, and rolling memory. Returns `approved` or `blocked`, an `issues` array, a `checks` array covering the eight checklist items, and a `blockingIssues` array. The eight checklist items are:
   - factual claims cited
   - citations mapped to sources
   - tables and figures preserved
   - paragraphs represented
   - wikilinks plausible
   - page plan matches output
   - new page types documented
   - pages self-contained and readable
2. **Completeness (`validation/completeness.ts`)** — normalizes text, checks that every extracted paragraph is represented in the markdown body, that table headers are preserved, and that figures are described.
3. **Structural checks (`lint/index.ts`)** — broken wikilinks, orphaned pages, citation integrity, duplicate entities, stale pages, missing source files.
4. **Schema validation (`validation/schema.ts`)** — required frontmatter fields per page type.

### Recovery mode

Configured in `config.json` under `resilience.recoveryMode`. The only supported mode is `abort`: if the LLM is disabled, fails, or returns invalid/empty output, the command stops and reports the error. Deterministic content fallbacks are not produced.

### Cross-wiki discovery

After all wikis in a workspace are ingested, `orchestrator/wiki-of-wiki.ts` recursively compares entity and topic names across wikis and surfaces cross-wiki names. `writers/index.ts` writes the workspace-level `index-of-indexes.md` with these names and links to each wiki-level `index.md`.

### Claim verification path

A reader can verify any claim in five steps:

1. Find the inline citation on the wiki page, e.g., `[^src1]`.
2. Look at the `sources` entry for `src1` in the page's YAML frontmatter.
3. Note the source PDF and page range.
4. Open the `source` page for that PDF to confirm provenance.
5. Open the original PDF at the cited page range to verify the claim.

Because the full extracted text is also preserved on the wiki page, the reader can often verify the claim without leaving the wiki.

### Development commands

```bash
npm run build     # compile src/ → dist/ with tsc
npm run test      # run the Vitest suite
npm run dev --    # run the CLI without compiling
```

---

## 5. Project Structure

### Top-level folders

| Folder / File | Purpose |
|---|---|
| `src/` | TypeScript source code. |
| `tests/` | Vitest test suite, including fixtures and generated PDFs. |
| `docs/` | User documentation: `QUICKSTART.md` for beginners, `USAGE.md` for researchers. |
| `plan/` | Sprint plans and implementation tracker. |
| `Project Vision/` | Canonical product vision and architecture documents. |
| `dist/` | Compiled JavaScript output (produced by `npm run build`). |
| `README.md` | This file. |
| `package.json` | Project metadata, scripts, and dependencies. |
| `tsconfig.json` | TypeScript configuration. |

### `src/` folder details

| File / Folder | Responsibility |
|---|---|
| `cli.ts` | Commander entry point; registers all commands. |
| `commands/` | One module per CLI command: `init`, `sample`, `ingest`, `ingest-all`, `status`, `configure-llm`, `test-llm`, `apply-proposal`, `tui`. |
| `config.ts` | Default configuration, `buildConfig`, `loadConfig`, `mergeConfig`, `validateConfig`. |
| `workspace.ts` | Wiki discovery, path helpers, inside-raw checks, `toRelativePath`. |
| `extractor/pdf.ts` | PDF text extraction using `pdfjs-dist` legacy build. |
| `extractor/batch.ts` | Batch PDF extraction runner. |
| `extractor/types.ts` | Shared extraction types. |
| `chunking/analyzer.ts` | PDF structure analysis: headings, tables, figures, scanned pages. |
| `chunking/chunker.ts` | Chunking logic: page-based boundaries, never split inside tables/figures. |
| `chunking/strategy-writer.ts` | Writes `chunking-strategy.md`. |
| `chunking/types.ts` | Chunk and chunking-strategy types. |
| `ingestion/engine.ts` | Main ingestion engine orchestrating extraction, chunking, and writing. |
| `ingestion/state.ts` | Incremental ingestion state: SHA-256, per-page metadata, manifests. |
| `ingestion/resume.ts` | Resume support for interrupted ingestion runs. |
| `ingestion/reingest.ts` | Selective re-ingestion after approved structural changes. |
| `ingestion/chunk-materializer.ts` | Per-chunk writer for document, entity, and topic pages. |
| `orchestrator/agents.ts` | The seven sub-agents: StructureAnalyst, EntityExtractor, EntityCritic, RelationshipExtractor, EvidenceCollector, PagePlanner, ChunkWriter, plus Critic and EntityTopicPageWriter. |
| `orchestrator/index.ts` | `runSampleOrchestrator` entry point. |
| `orchestrator/ingest.ts` | `runIngestOrchestrator` and `writeIngestOutput`. |
| `orchestrator/memory.ts` | Rolling memory persistence and compaction. |
| `orchestrator/contracts.ts` | `index.md` contract writers. |
| `orchestrator/validation.ts` | Deterministic page-plan validation. |
| `orchestrator/proposals.ts` | Structural change detection, autonomous application, and logging. |
| `orchestrator/sampling.ts` | Corpus sampling strategies. |
| `orchestrator/wiki-of-wiki.ts` | Cross-wiki name discovery. |
| `orchestrator/types.ts` | Shared orchestrator types. |
| `orchestrator/prompt-loader.ts` | Prompt file loader. |
| `orchestrator/prompts/` | Markdown prompt files for each sub-agent. |
| `entities/index.ts` | Entity extraction, taxonomy helpers, page title/file-name helpers, and entity page writer. |
| `topics/index.ts` | Topic extraction and topic page writer. |
| `wikilinks/` | Wikilink helpers and broken-link repair. |
| `lint/index.ts` | Lint pass: broken links, citations, orphans, duplicate entities, stale pages, missing source files, report writer. |
| `validation/completeness.ts` | Deterministic completeness check against extracted input. |
| `validation/schema.ts` | YAML frontmatter schema validation. |
| `llm/client.ts` | LLM client factory and provider adapters. |
| `llm/json.ts` | JSON extraction from LLM responses. |
| `llm/types.ts` | LLM configuration and response types. |
| `writers/document.ts` | Document page writer. |
| `writers/source.ts` | Source page writer. |
| `writers/raw.ts` | Raw page writer. |
| `writers/index.ts` | Wiki-level and top-level index writers. |
| `writers/agents.ts` | `AGENTS.md` writer. |
| `writers/config.ts` | Wiki config writer. |
| `writers/log.ts` | Append-only `log.md` writer. |
| `writers/preservation.ts` | Helpers for preserving existing content. |
| `progress/types.ts` | Progress event types and `ProgressReporter` interface. |
| `progress/collecting-reporter.ts` | In-memory reporter for tests and TUI. |
| `tui/index.ts` | TUI entry point and non-interactive render. |
| `tui/app.tsx` | Main Ink component, screen routing, key handler. |
| `tui/screens/` | Welcome, workspace, dashboard, wiki-detail, create-wiki, LLM config, progress, result screens. |
| `tui/components/` | Panel, ProgressBar, StatusBar. |
| `utils/slug.ts` | Unicode NFKD slugification and slug registry. |
| `utils/similarity.ts` | Levenshtein and slug-based similarity for duplicate detection. |
| `errors.ts` | `CLIError` for user-facing errors. |
| `prompt.ts` | Interactive prompt utility (e.g., hidden API-key input). |
| `log.ts` | JSON run-log builder and writer. |
