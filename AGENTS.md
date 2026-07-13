# LLM Wiki CLI — Agent Notes

> **Two meanings of `AGENTS.md`:** this file (`<workspace>/AGENTS.md`) is the workspace-level handbook for *ZCode agents editing the CLI codebase*. Each wiki that the CLI ingests also gets its own `AGENTS.md`, which is a per-wiki **LLM ingestion guide** (not the human contract). When working on source code, this file applies; when working on the wiki format, see the per-wiki `AGENTS.md` concept in `Project Vision/02_WIKI_concept_detailed.md`.

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text immediately
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md.

## Quick reference

- **Run CLI locally:** `npm run dev -- <command> [args]` (uses `tsx src/cli.ts`)
- **Build:** `npm run build` (runs `tsc`; there is no separate `typecheck` or `lint` script)
- **Test:** `npm run test` (runs the full Vitest suite with `--pool=forks --poolOptions.forks.singleFork`)
- **Focused test:** `npx vitest run --pool=forks --poolOptions.forks.singleFork tests/<file>.test.ts`
- **Hard boundary:** deterministic code writes only DOX index/contract files and orchestration metadata; the LLM authors all wiki page bodies. LLM agents never compute SHA-256 or perform file I/O directly.
- **Imports:** all ESM import paths end in `.js`, even from `.ts` source files (`NodeNext` resolution).
- **Paths:** store relative paths with forward slashes using `toRelativePath` from `workspace.ts`.

## Project purpose

Local Node.js/TypeScript CLI that converts collections of PDFs into a **wiki-of-wikis**: each collection is a markdown wiki with its own index, and all wiki indexes roll up into a top-level **index-of-indexes**. Built for research where every claim must be traceable to an exact source location.

## Core philosophy

- **LLM is the programmer; the wiki is the codebase.** The LLM writes all markdown content (synthesized summaries, transcriptions, tables, and connections), while deterministic local code handles extraction, I/O, hashing, validation, and orchestration.
- **Citation-backed.** Every factual claim on a wiki page must cite an exact PDF and page range via `[^srcN]` markers mapped to YAML `sources`.
- **Compounding, not ephemeral.** Each ingestion pass enriches existing pages and creates new ones; nothing is lost.

## Tech stack

- **Runtime:** Node.js >= 20.0.0
- **Language:** TypeScript 5.5+ (strict, ESM, `NodeNext` module resolution)
- **CLI:** Commander.js
- **PDF extraction:** `pdfjs-dist` legacy build (no worker)
- **Frontmatter:** `gray-matter`
- **Tests:** Vitest
- **Dev runner:** `tsx src/cli.ts`

## Common commands

```bash
npm run dev -- <command> [args]   # run CLI without compiling
npm run build                     # compile src/ → dist/ with tsc
npm run test                      # run Vitest suite
```

## CLI commands

```bash
llm-wiki-cli init <slug> [--title <title>] [--description <description>] [--force]
llm-wiki-cli sample <slug> [path-to-pdf]
llm-wiki-cli ingest <slug> [--yes] [--resume]
llm-wiki-cli ingest-all [--yes]
llm-wiki-cli status
llm-wiki-cli configure-llm
llm-wiki-cli test-llm [--verbose]
llm-wiki-cli apply-proposal <slug> <proposal-file> [--skip-manual-edits]
llm-wiki-cli tui [--non-interactive]
```

## E2E / verification runs

When the user asks for an E2E run, smoke test, or verification of the CLI against a workspace, the agent is **only** allowed to run commands and report results. Source-code changes are **forbidden** during these runs.

- **Do not modify source code.** This includes `src/`, `tests/`, `docs/`, `plan/`, or any other tracked file in the repo.
- **Do not modify tests.** Verification runs must use the codebase as-is.
- **Do not modify documentation or the bug report.** If a bug is found, report it in the conversation; do not write it into `plan/e2e-bug-report.md` or any other file.
- **Do not add fallbacks, workarounds, defensive fixes, or retries.** If a step fails, stop and report the failure.
- **Do not proceed past the first failure.** The E2E stops at the first failing command; the agent reports where it stopped and why.
- **Verify the working tree is clean before starting.** Run `git status --short` and confirm it prints nothing. If it does not, report the modified files and stop.
- **If the working tree becomes dirty during the run, stop immediately.** Report the unexpected change and do not continue.
- The only permissible changes are to the **E2E workspace data** (e.g., `C:\temp\wiki-e2e` or another explicitly named workspace), not to the CLI repository.

## Workspace layout

A workspace is a directory that contains:

```
<workspace>/
├── .kimi-code/
│   ├── config.json              # workspace defaults (LLM, chunking, extraction)
│   ├── FRD.md                   # functional requirements document
│   └── logs/                    # JSON run logs
├── index-of-indexes.md          # top-level roadmap; updated by ingest/ingest-all
└── wikis/
    └── <wiki-slug>/
        ├── config.json          # wiki-level config (generated by sample)
        ├── index.md             # wiki-level DOX child contract
        ├── chunking-strategy.md # discovered chunking rationale
        ├── AGENTS.md            # per-wiki LLM ingestion guide
        ├── documents/           # document chunk pages
        │   └── index.md         # folder-level DOX contract
        ├── sources/             # source catalog pages
        │   └── index.md         # folder-level DOX contract
        ├── topics/              # topic pages
        │   └── index.md         # folder-level DOX contract
        ├── entities/            # entity pages, grouped by typed sub-folders
        │   ├── index.md         # parent contract listing sub-folders
        │   └── <subfolder>/    # e.g., people/, organizations/, regulators/
        │       └── index.md     # folder-level DOX contract
        ├── raw/                 # source PDFs and failed/scanned extraction pages
        │   └── index.md         # folder-level DOX contract (optional)
        ├── lint/
        │   └── report.json      # lint issues
        └── .state/
            ├── rolling-memory.json    # structured rolling memory
            ├── memory-summary.md      # compressed natural-language summary
            └── chunks/                # per-chunk state for resume
```

Content pages are co-located with their folder-level `index.md` contracts per the DOX framework. There is no separate `output/` content layer; generated pages live directly in their respective root folders.

## Source-code layout

```
src/
├── cli.ts                 # Commander entry point; register commands here
├── commands/              # init, sample, ingest, ingest-all, status, configure-llm, test-llm, apply-proposal, tui
├── config.ts              # default config, buildConfig, loadConfig, mergeConfig, validateConfig
├── workspace.ts           # wiki discovery, path helpers, inside-raw checks
├── extractor/             # PDF extraction (pdf.ts) and batch runner (batch.ts)
├── chunking/              # structure analyzer, chunker, strategy writer
├── ingestion/             # engine.ts, state.ts (incremental state), chunk-materializer.ts (per-chunk entity/topic updates), resume.ts, reingest.ts
├── writers/               # markdown writers for pages, source, index, config, log
├── entities/              # entity extraction, taxonomy helpers, and page writing
├── topics/                # topic extraction and page writing
├── wikilinks/             # link helpers
├── lint/                  # link/citation/frontmatter checks
├── llm/                   # LLM client abstraction, types, adapters
├── progress/              # structured progress events and reporters for TUI/logs
├── tui/                   # interactive terminal UI (Ink)
├── log.ts                 # run-log builder/writer
├── prompt.ts              # interactive prompt utility (hidden API-key input)
└── errors.ts              # CLIError class for expected failures
```

## Orchestrator module

The custom multi-agent orchestrator lives in `src/orchestrator/` and drives both `sample` and `ingest`:

```
src/orchestrator/
├── agents.ts              # sub-agents: StructureAnalyst, EntityExtractor, EntityCritic, RelationshipExtractor, EvidenceCollector, PagePlanner, ChunkWriter, Critic; plus entity/topic page writer and memory helpers
├── contracts.ts           # DOX contract writers for wiki-level and folder-level index.md
├── index.ts               # runSampleOrchestrator entry point
├── ingest.ts              # runIngestOrchestrator and rolling-memory integration
├── memory.ts              # rolling memory persistence and compaction
├── proposals.ts           # structural-change proposal detection, approval, and application
├── sampling.ts            # corpus sampling strategies
├── types.ts               # orchestrator shared types (memory, folder plans, critic)
├── validation.ts          # deterministic validation helpers
├── wiki-of-wiki.ts        # cross-wiki name discovery agent
├── prompt-loader.ts       # prompt file loader
└── prompts/               # markdown prompt files for each sub-agent
```

The sub-agents run in order during `sample` and `ingest`:
1. **StructureAnalyst** — derives headings, sections, and chunk boundaries from the PDF structure.
2. **EntityExtractor** — surfaces people, organizations, locations, cases, events, and products.
3. **EntityCritic** — audits the extracted entity list for false positives and hallucinations.
4. **RelationshipExtractor** — captures relationships between entities (uses the global entity list from rolling memory so cross-chunk links are visible; during `ingest` a per-chunk variant catches relationships across chunk boundaries).
5. **EvidenceCollector** — extracts key claims, tables, and figures.
6. **PagePlanner** — proposes a folder hierarchy, page plan, and typed entity sub-folder taxonomy (LLM-assisted, deterministic fallback).
7. **ChunkWriter** — records the planned files; existing writers materialize the markdown.
8. **Critic** — deterministic review of plan completeness, schema, and folder placement.

During `ingest`, after the Critic approves a chunk, the **ChunkMaterializer** (`src/ingestion/chunk-materializer.ts`) immediately writes or updates the affected entity and topic pages. It reads existing pages, detects manual edits via `IngestionState` hashes, and uses an LLM update mode with a deterministic preservation check (every old citation and wikilink must survive the rewrite). If preservation fails or the page was manually edited, the materializer falls back to deterministic append-only.

Rolling memory is accumulated across PDFs during full ingestion and persisted in `.state/rolling-memory.json` (structured state) and `.state/memory-summary.md` (compressed natural-language summary).

## Terminal User Interface (TUI)

A keyboard-driven terminal UI lives in `src/tui/` and is launched with `llm-wiki-cli tui`:

```
src/tui/
├── index.ts               # entry point; renderToString for --non-interactive mode
├── app.tsx                # main Ink component, screen routing, global key handler
├── types.ts               # TUI screen and wiki summary types
├── screens/               # welcome, workspace, dashboard, wiki-detail, create-wiki, llm-config, progress, result
└── components/            # Panel, ProgressBar, StatusBar
```

The TUI reuses the existing command functions (`initCommand`, `sampleCommand`, `ingestCommand`, `configureLlmCommand`) and passes a `ProgressReporter` so the live operation screen can show the current sub-agent, LLM calls, source/chunk progress, and Critic issues. TUI components must not compute SHA-256 hashes or perform file I/O directly; they delegate to the command layer.

## Progress instrumentation

A structured progress layer in `src/progress/` emits events without changing the return values of existing functions:

```
src/progress/
├── types.ts               # ProgressEvent union and ProgressReporter interface
├── collecting-reporter.ts # stores events for testing and the TUI
└── index.ts               # public re-exports
```

Key events:

- `step-start` / `step-end` — sub-agent boundaries
- `llm-call-start` / `llm-call-end` / `llm-call-retry` — provider, model, tokens, cost, status
- `source-start` / `source-end` — per-PDF progress
- `chunk-progress` — per-chunk entity extraction
- `critic-issues` — issues surfaced by the Critic
- `proposal` — structural change proposals
- `warning` / `error` — runtime issues
- `summary` — final ingestion counts
- `status` — human-readable status messages

`LLMClient`, `runSampleOrchestrator`, `runIngestOrchestrator`, and `runIngestion` accept an optional `ProgressReporter`. When none is provided, a `NoOpReporter` is used so existing commands continue to work unchanged.

## Coding conventions

- **ESM imports:** import paths must end in `.js` even though source files are `.ts`.
- **Strict TypeScript:** no implicit any; enable `strict`.
- **Path handling:** always use `path.join`, `path.resolve`, and `toRelativePath` from `workspace.ts`. Forward slashes are used in stored relative paths.
- **Error handling:** throw `CLIError` for user-facing errors; unexpected errors bubble to `main()` and exit non-zero.
- **Logging:** every command writes a JSON run log to `.kimi-code/logs/` via `buildRunLog`/`writeRunLog`.

## LLM configuration

- LLM config lives in `.kimi-code/config.json` under the `llm` key.
- Supported providers: `openai`, `anthropic`, `openai-compatible`, `kimi`, `test`.
- **Kimi Code** uses the Anthropic messages format, POST to `{baseUrl}/v1/messages`, with `x-api-key` and `anthropic-version: 2023-06-01` headers.
- Default Kimi settings: `provider: "kimi"`, `model: "k2.7-code"`, `baseUrl: "https://api.kimi.com/coding"`.
- The LLM only receives extracted text and metadata — **never raw PDF bytes**.
- Use `test-llm --verbose` to debug empty responses; Kimi may return `thinking` blocks before the `text` block.

## Key architectural rules

- **PDF extraction:** `src/extractor/pdf.ts` uses `pdfjs-dist/legacy/build/pdf.mjs` with `useSystemFonts: true`. It reads the whole file into memory (`Uint8Array`).
- **Chunking:** chunks are built by grouping pages, never splitting inside tables or figures. Scanned pages are skipped from document chunks and written as `raw/` pages.
- **Incremental ingestion:** `ingestion/state.ts` tracks per-source SHA-256, so re-running `ingest` only processes changed/added/removed PDFs.
- **Config precedence:** wiki `config.json` overrides workspace `.kimi-code/config.json` overrides `defaultConfig` in `src/config.ts`.
- **Status gate:** `ingest` warns if wiki status is not `"ready"`; run `sample` first.
- **DOX contracts:** `index-of-indexes.md` → `wikis/<slug>/index.md` → `<folder>/index.md`. Folder-level indexes are child contracts that describe the folder's page types and navigation. For typed entity groups, the chain continues into `entities/<subfolder>/index.md` child contracts.
- **Entity sub-folders:** each wiki maintains an `entityTaxonomy` in rolling memory. Entity pages are written as `entities/<subfolder>/<entity-slug>.md`, where `<subfolder>` is either proposed by the LLM during sampling or derived from the entity type. The built-in convention does not require a structural-change proposal.
- **Structural-change approval:** creating new folders or changing the wiki's organization requires a human-approved proposal with reason, pros, cons, and required contract updates. New page types inside existing folders do not require approval.
- **Markdown authorship:** deterministic code must not draft or mutate wiki page bodies; the LLM is the sole author of all markdown content pages.
- **Preservation-first updates:** when `ingest` updates an existing entity/topic page, the LLM regenerates the body in update mode but must keep every existing citation and wikilink. A deterministic preservation check rejects rewrites that drop prior content; manually edited pages receive append-only updates.

## Authority matrix

| Role | Authority |
|---|---|
| **User (human)** | High-level purpose, PDF curation, structural approval, when to run commands. |
| **LLM Orchestrator** | Folder structure, page content, entities, links, citations, new page types. |
| **Local deterministic code** | Extraction, hashing, validation, orchestration, file I/O. |
| **Critic** | Whether LLM output is good enough to commit. |

No deterministic code may draft or mutate markdown bodies; no LLM agent may compute SHA-256 hashes or manage file I/O directly. Code reviews enforce this boundary.

## Naming and citation conventions

- **Slugification:** use Unicode NFKD normalization, lowercase, replace non-alphanumeric characters with hyphens, collapse consecutive hyphens, and trim trailing hyphens. Example: `Électricité de France` → `electricite-de-france`.
- **Disambiguation:** when two canonical names collide, append an incremental integer (`john-smith`, `john-smith-1`, `john-smith-2`).
- **Canonical names:** the rolling memory structured state maps every extracted entity name to its canonical slug; aliases resolve to the same slug.
- **Entity page layout:** entity pages live under `entities/<subfolder>/<entity-slug>.md`, where `<subfolder>` comes from the wiki's entity taxonomy.
- **Path-aware disambiguation:** the same `<entity-slug>.md` base name may legitimately exist in different entity sub-folders; lint compares the relative path under `entities/` rather than the base name alone.
- **Citations:** every factual claim uses `[^srcN]` markers mapped to a `sources` frontmatter entry. Multi-source claims cite all sources (`[^src1] [^src2]`). Table captions include a citation (`Source: [^src1]`). Claims from scanned pages are either omitted or explicitly marked as needing verification.

## Testing

- Tests are in `tests/` and run with Vitest.
- Fixtures are in `tests/fixtures/`; include valid/bad workspaces and generated PDFs.
- When adding new CLI commands or LLM providers, add tests in `tests/` and keep `npm run test` green.

## Security reminders

- Do not commit API keys. The `.kimi-code/config.json` file is treated as sensitive.
- No raw PDFs are transmitted over the network; only extracted text goes to remote LLMs.
- Run logs never include API keys or raw content.

## Known gotchas

- **ESM imports:** every import path must end in `.js`, even though the source files are `.ts`. TypeScript resolves these with `NodeNext` module resolution.
- **No raw PDF bytes to the LLM:** the LLM only ever receives extracted text and metadata. Never pass raw PDF buffers to an LLM call.
- **`init` → `sample` → `ingest`:** `ingest` warns if the wiki status is not `"ready"`. Run `init` to create the wiki, then `sample` to generate the folder plan and `AGENTS.md`, then `ingest` to process PDFs.
- **Scanned pages go to `raw/`:** image-only or unparseable pages are preserved as `raw` pages and skipped from normal document chunks.
- **Legacy entity migration:** flat `entities/<slug>.md` files are automatically moved into `entities/<subfolder>/<slug>.md` the first time an entity is re-ingested. Existing content is preserved; manual-edit detection continues on the new path.
- **Kimi `thinking` blocks:** Kimi Code may return `thinking` blocks before the final `text` block. If the CLI appears to get an empty response, use `test-llm --verbose` to inspect the raw LLM output.
- **Forward slashes in stored paths:** always normalize stored relative paths to forward slashes via `toRelativePath` from `workspace.ts`, even on Windows.

## Documentation to read before major changes

- `README.md` — user-facing overview, usage, and examples
- `docs/QUICKSTART.md` — beginner-friendly setup guide
- `docs/USAGE.md` — detailed command reference
- `.kimi-code/FRD.md` — product vision, architecture, and requirements
- `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` — canonical product vision and architecture from recent requirements sessions
- `Project Vision/02_WIKI_concept_detailed.md` — detailed wiki concept, page types, and `AGENTS.md` ingestion-guide role
- `Project Vision/03_DOX_concept_detailed.md` — DOX-inspired cascading `index.md` contract hierarchy
- `Project Vision/04_orchestration_detailed.md` — sampling and ingestion orchestrator flows
- `Project Vision/05_page_types_specification.md` — frontmatter schemas and content structures for default page types
- `Project Vision/06_citation_and_provenance.md` — citation format, `sources` frontmatter, and provenance rules
- `Project Vision/07_validation_and_quality.md` — validation order, Critic, lint, and structural-change approval
- `plan/SPRINT_INSTRUCTIONS.md` — sprint plans and implementation tracker

## Child DOX Index

- `src/AGENTS.md` — source code conventions, module boundaries, and the orchestrator/ingestion pipeline.
- `tests/AGENTS.md` — test conventions, fixtures, and how to keep the Vitest suite green.
- `docs/AGENTS.md` — user-facing documentation, quickstart, and command references.
- `Project Vision/AGENTS.md` — product vision, architecture, page-type specifications, and citation/provenance rules.
- `plan/AGENTS.md` — sprint plans, implementation tracker, and UAT documents.
