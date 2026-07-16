# src/ — DOX contract

## Purpose

All TypeScript source for LLM Wiki CLI v2.0: CLI entry point, TUI (Ink), PDF extraction, LLM client, utilities, and (in later phases) commands, state, and agents.

## Ownership

* `cli.ts` — Commander entry point; named `program` export; `program.parse()` only runs when executed directly (guarded), never on import
* `tui/` — Ink TUI: `app.tsx` (screen router), `menu.tsx` (main menu + exported `resolveMenuSelection`), screen per command, `components/` (header, footer, spinner, error-box, success-box), `hooks/use-wiki-list.ts`
* `extraction/pdf.ts` — `extractText(pdfPath, startPage?, endPage?)` via pdfjs-dist legacy build; never splits a page
* `llm/client.ts` — `callLLM(prompt, system?)`; Anthropic Messages API; logs `LLM Call | Tokens: i/o | Cost: $x` for every call; no retries, throws on failure
* `utils/hash.ts` — `sha256(filePath)` streaming helper
* `commands/`, `state/`, `agents/` — empty scaffolding for Phases 1+ (`.gitkeep`)

## Local Contracts

* Phase 0 public surface is frozen per `Implementation Plan/PHASE_00_infrastructure.md` §7: `extractText`, `callLLM`, `sha256`, and the TUI framework must not change signature/behavior after Phase 0 approval; later phases extend, they do not break
* `init`/`ingest` command actions and everything in `agents/` remain placeholders until their implementing phase; no business logic may land here outside its phase
* LLM provider is Anthropic (user decision 2026-07-17): key from `ANTHROPIC_API_KEY` with `.env` fallback, model from `ANTHROPIC_MODEL` (default `claude-haiku-4-5-20251001`), prices overridable via env
* Every LLM call must log tokens and cost; product LLM spend is tracked per phase in `.state/phase-N-status.json`
* TUI conventions (Ink 7): every `useInput` is gated `isActive: isRawModeSupported === true`; components must render correctly in non-TTY contexts (static fallbacks); Escape = back, Enter = select
* ESM only (`"type": "module"`); strict TypeScript; no new dependencies without recording the reason in the phase status file

## Work Guidance

* Follow the phase document for the phase being implemented; check compliance against the mapped vision documents before writing code (root AGENTS.md + `Implementation Plan/AGENTS.md`)
* Windows/Git Bash environment: no UNIX-only shellouts in committed code without a Windows fallback

## Verification

* `npm test` (vitest) must be green; `npx tsc --noEmit` must be clean
* Each phase's gates in its phase document are the acceptance tests for code here

## Child DOX Index

No child folders with their own contracts yet.
