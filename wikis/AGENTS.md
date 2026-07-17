# wikis/ — DOX contract

## Purpose

Runtime workspace for generated wikis. `llm-wiki-cli init <slug>` creates `wikis/<slug>/` here (or under a custom `-w` workspace); `ingest` fills it with document pages, source pages, and state.

## Ownership

* `<slug>/` — one generated wiki: `raw/` (source PDFs, never modified), `documents/` (raw extracted chunks), `sources/` (provenance pages), `entities/`, `topics/`, `.state/` (tooling state, e.g. `ingestion.json`), and a generated `AGENTS.md` constitution (from `templates/AGENTS.md`; binding for every LLM call in that wiki, managed by the CLI — never hand-edited)

## Local Contracts

* This folder holds generated data, not source code; the repo only tracks the folder itself (`.gitkeep`) — wiki contents are user data
* Tests do not use this folder; they run against temp workspaces (see `tests/AGENTS.md`)
* Each wiki's `AGENTS.md` is that wiki's constitution (a generated artifact per `templates/AGENTS.md`), not a DOX contract for this repo; DOX contracts for generated wikis arrive with the DOX Writer in a later phase

## Work Guidance

## Verification

* Phase gates in `tests/` exercise init/ingest against temp workspaces; manual UAT steps per phase status files in `.state/`

## Child DOX Index

Generated wikis carry their own constitutions; no DOX child contracts yet.
