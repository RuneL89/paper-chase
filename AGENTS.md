# DOX framework

* DOX is highly performant AGENTS.md hierarchy installed here
* Agent must follow DOX instructions across any edits

## Project

* This folder is the project root for **LLM Wiki CLI v2.0** — a CLI that turns PDFs into citation-backed markdown wikis
* Canonical remote: `https://github.com/RuneL89/llm-wiki-cli` — `main` carries v2.0 history; the previous v1 codebase is archived on branch `archive/v1-main`
* Canonical vision documents live in `Project Vision/`; the phased implementation plan lives in `Implementation Plan/`
* All implementation artifacts (`src/`, `tests/`, `test-pdfs/`, `templates/`, `prompts/`, `wikis/`, `package.json`, etc.) are created directly in this project root. Never create a separate project directory (e.g. `llm-wiki-cli-v2/`) here or elsewhere

## Core Contract

* AGENTS.md files are binding work contracts for their subtrees
* Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

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

* purpose, scope, ownership, or responsibilities
* durable structure, contracts, workflows, or operating rules
* required inputs, outputs, permissions, constraints, side effects, or artifacts
* user preferences about behavior, communication, process, organization, or quality
* AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

* Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
* Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
* Each parent explains what its direct children cover and what stays owned by the parent
* The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

* Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
* Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
* Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:

* Purpose
* Ownership
* Local Contracts
* Work Guidance
* Verification
* Child DOX Index

## Style

* Keep docs concise, current, and operational
* Document stable contracts, not diary entries
* Put broad rules in parent docs and concrete details in child docs
* Prefer direct bullets with explicit names
* Do not duplicate rules across many files unless each scope needs a local version
* Delete stale notes instead of explaining history
* Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text immediately
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

* 2026-07-16: All new files and folders must be created in this project folder (`Wiki v5/`). Do not create or reference another project directory; older docs that pointed at `llm-wiki-cli-v2/` / `llm-wiki-cli-v2-vision/` were corrected.
* 2026-07-17: All core workflows must be doable from the TUI in a user-friendly manner (no manual file copying in Explorer). Established with the Phase 1 "Add PDFs" screen; applies to future phases' features too.
* 2026-07-17: File selection in the TUI must use a graphical/native file picker (Windows OpenFileDialog), never typed or pasted paths as the primary interaction; manual path entry is only a fallback.

## Child DOX Index

* `Project Vision/` — canonical vision and specification documents for LLM Wiki CLI v2.0; the source of truth for implementation compliance. See `Project Vision/AGENTS.md`
* `Implementation Plan/` — phased implementation plan (Phases 0-9), master index, and agent prompts. See `Implementation Plan/AGENTS.md`
* `src/` — all TypeScript source (CLI, TUI, extraction, LLM client, Extractor agent, validation, commands, state, utils; Materializer/DOX Writer still scaffolding). See `src/AGENTS.md`
* `tests/` — vitest suites; each phase's technical gates encoded as tests. See `tests/AGENTS.md`
* `test-pdfs/` — controlled PDF fixtures; golden masters are immutable. See `test-pdfs/AGENTS.md`
* `templates/` — templates for generated wiki artifacts. Special case: `templates/AGENTS.md` is the **wiki constitution template artifact** required by `PHASE_00_infrastructure.md` §2.1, not a DOX contract, so this folder's rules live here: template must keep covering wiki purpose, page structure, `[^srcN]` + `sources` citation rules, and the LLM-must-follow rule; placeholders use `{{DOUBLE_BRACE}}`; changes must stay compliant with `Project Vision/06_citation_and_provenance.md` and `03_DOX_concept_detailed.md`
* `prompts/` — LLM prompt files for the agent pipeline (`extractor.prompt.txt` since Phase 2; DOX Writer/Synthesis Writer prompts arrive with their phases). See `prompts/AGENTS.md`
* `scripts/` — one-off fixture generator/verifier scripts; never re-run the golden master generator. See `scripts/AGENTS.md`
* `.state/` — phase status files, compliance log, verification reports; the project's durable memory. See `.state/AGENTS.md`
* `wikis/` — runtime workspace for generated wikis (Phase 1+ output of `init`/`ingest`). See `wikis/AGENTS.md`


