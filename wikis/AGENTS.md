# wikis/ — DOX contract

## Purpose

Runtime workspace for generated wikis. `llm-wiki-cli init <slug>` creates `wikis/<slug>/` here (or under a custom `-w` workspace); `ingest` fills it with document pages, source pages, and state.

## Ownership

* `<slug>/` — one generated wiki: `raw/` (source PDFs, never modified), `documents/` (raw extracted chunks), `sources/` (provenance pages), `entities/`, `topics/`, `.state/` (tooling state, e.g. `ingestion.json`, `language.json` — the Phase 7 per-wiki language record: `outputLanguage`, `lastInputLanguage`), and a generated `AGENTS.md` constitution (from `templates/AGENTS.md`; binding for every LLM call in that wiki, managed by the CLI — never hand-edited; includes the wiki's `## Language` section since Phase 7)
* `index-of-indexes.md` — the workspace-level DOX contract (Phase 6, 2026-07-20 amendment; per-wiki segments 2026-07-21): lists every wiki that has a root `index.md`; composed of a coherent cross-wiki prose block (marked `<!-- workspace-prose -->`, regenerated only when the wiki set changes) and per-wiki catalog lines (each written by that wiki's own ingest in its own output language and preserved byte-for-byte otherwise); re-composed by the DOX Writer's workspace pass at the end of every ingest; managed by the CLI — never hand-edited

## Local Contracts

* This folder holds generated data, not source code; the repo only tracks the folder itself (`.gitkeep`) — wiki contents are user data
* Tests do not create or modify wikis here; they run against temp workspaces (see `tests/AGENTS.md`). Sole exception: Phase 2 gate tests READ the committed `test-wiki` fixtures (`documents/golden-master-part-001.md`, `AGENTS.md`) as extractor input — read-only, never written by tests
* Each wiki's `AGENTS.md` is that wiki's constitution (a generated artifact per `templates/AGENTS.md`), not a DOX contract for this repo; DOX contracts for generated wikis arrive with the DOX Writer in a later phase
* Opening `wikis/` as a single Obsidian vault is the supported way to navigate across wikis: `index-of-indexes.md` is the vault-root contract and its `[[<slug>/index|<Wiki Title>]]` links resolve by pure file lookup

## Work Guidance

## Verification

* Phase gates in `tests/` exercise init/ingest against temp workspaces; manual UAT steps per phase status files in `.state/`

## Child DOX Index

Generated wikis carry their own constitutions; no DOX child contracts yet.
