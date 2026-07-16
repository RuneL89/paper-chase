# Phase 0 Verification Report

**Verifier:** Verifier sub-agent (independent, cold review — no trust in Implementer claims)
**Date:** 2026-07-17
**Spec:** `Implementation Plan/PHASE_00_infrastructure.md` §2 (What to Build), §3 (Gates 0.1–0.8), §5 (Approval Checklist)
**Vision:** `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3, §4, §5, §7
**Claims under review:** `.state/phase-0-status.json` (commit `6c0f4e5` + status commit `fe28186`)

All evidence below was produced by the Verifier running commands itself, not copied from the status file.

---

## 1. Per-Gate Results

| Gate | Verdict | Evidence (independently reproduced) |
|---|---|---|
| 0.1 PDF Extraction Works | **PASS** | `npm test` green. Verifier ran `extractText('test-pdfs/golden-master.pdf')` directly and saw with its own eyes: `John Smith`, `Acme Corp`, `March 15, 2024`, `$42.5 million`, `Board Members`, plus the full `Revenue by Quarter` table (Q1 $9.8M +4% / Q2 $10.4M +6% / Q3 $11.1M +7%) and the page-3 name list (John Smith, Jane Doe, Robert Brown) and the "John Smith is the CEO of Acme Corp" relationship sentence. |
| 0.2 Page-Range Extraction | **PASS** | Verifier ran `extractText(..., 1, 1)` directly: output contains `John Smith`, `Acme Corp`, `March 15, 2024`; does NOT contain `Board Members`, `$42.5 million`, or the table. Test also green. |
| 0.3 SHA-256 Hashing | **PASS** (deviation accepted, see §2) | Test green. `shasum` is genuinely unavailable on this machine (stderr `'shasum' is not recognized` observed in the test run); the test falls back to `certutil -hashfile ... SHA256`. Verifier independently recomputed with `sha256sum`: `1e4f2cbec74a83bf8ae56f3a45035827ec405bd02989d6b38f08929b80ac339d` — exact match with the status file's recorded hash. |
| 0.4 LLM Client Logs Cost | **PENDING** (sanctioned) | Test is committed as `test.skipIf(!process.env.ANTHROPIC_API_KEY)` and self-skipped in the Verifier's own run (`9 passed, 1 skipped, 0 failed`). `ANTHROPIC_API_KEY` is NOT set in the process environment. A `.env` file exists in the project root containing `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` (values not inspected; file is gitignored and untracked — confirmed via `git check-ignore` and `git ls-files`). The skip predicate reads process env only, NOT the `.env` fallback the client loads — so `npm test` alone will keep skipping even with `.env` present. No live call was made by the Verifier ($0 budget). Client code reviewed statically (see §3). |
| 0.5 CLI Commands Exist | **PASS** | Test green. Verifier ran `npx tsx src/cli.ts --help`, `init --help`, `ingest --help`, `test --help`: `init <slug>` with `--title` / `-w, --workspace` (default `.`), `ingest <slug>` with `--synthesis` / `--update-agents` / `--verbose`, and `test` all registered. Signatures match vision §3 and spec §2.6 exactly. |
| 0.6 TUI Renders Without Crashing | **PASS** | Test green: `render(<App />)` mounts and unmounts without error. |
| 0.7 TUI Menu Shows All Options | **PASS** | Test green; menu frame observed in test output containing all 5 options: `Create New Wiki (init)`, `Ingest PDFs (ingest)`, `Run Tests`, `Settings`, `Exit`. |
| 0.8 TUI Can Navigate Screens | **PASS** (deviation accepted, see §2) | Test green. Restructured test drives Ink's real input pipeline via a fake-TTY stdin (PassThrough + `isTTY`/`setRawMode` stubs), writes `\r` on the first menu item, and asserts the post-navigation frame contains `Press Escape to go back` — a string that exists ONLY in the init screen's footer (the menu footer says `Arrow keys to navigate, Enter to select, Escape to exit`), so the assertion genuinely proves navigation. |

**Suite totals (Verifier's own run):** 2 test files passed, 9 tests passed, 1 skipped (Gate 0.4), 0 failed. `npx tsc --noEmit` exit 0. Working tree clean (`git status --porcelain` empty).

**Approval checklist cross-check:**
- Golden master committed: YES (`git log --oneline -- test-pdfs/golden-master.pdf` → `6c0f4e5`), hash matches status file.
- `templates/AGENTS.md` committed: YES (same commit).
- No `init`/`ingest`/agent business logic: CONFIRMED — `src/cli.ts` init/ingest actions are empty (`// Phase 1 implementation` comments only); `src/commands/`, `src/agents/`, `src/state/` contain only `.gitkeep`; all TUI screens are placeholders ("Coming in Phase 1 / Phase 9"). The `test` command spawning `npm test` and `TestScreen` running it is the spec's own §2.6 requirement, not business logic.
- Total LLM cost $0: CONSISTENT — suite self-skipped the only live test; Verifier made no LLM call.
- Structure per §2.1: every listed file/folder exists (empty dirs use `.gitkeep`); nothing created outside the project root (`scripts/` is inside root and declared as a deviation).
- Dependencies: all 15 spec-pinned packages installed at versions satisfying §2.2 ranges exactly (ink 7.1.1, ink-select-input 6.2.0, ink-spinner 5.0.0, ink-text-input 6.0.0, undici 8.7.0, pdfjs-dist 4.10.38, commander 12.1.0, react 19.2.7, gray-matter 4.0.3; vitest 1.6.1, tsx 4.23.1, typescript 5.9.3, @types/node 20.19.43, @types/react 19.2.17, pdf-lib 1.17.1).

---

## 2. Deviation Verdicts

1. **Gate 0.3: `shasum` → `certutil` fallback chain — ACCEPTED.**
   The pass criterion's intent is "hash matches an independent command-line reference." `shasum` is genuinely not executable on this Windows machine (Verifier observed the failure). `certutil -hashfile SHA256` is the platform-native equivalent; a final `node:crypto` one-shot reference is a sane last resort. Verifier independently confirmed the hash via `sha256sum`. The criterion is satisfied in substance. Cosmetic note: the failed `shasum` attempt prints stderr noise in the test run; harmless.

2. **Gate 0.8: restructured navigation test — ACCEPTED.**
   The spec's literal test is vacuous: it renders a SECOND fresh `<App />` and asserts `lastFrame()` contains `Create New Wiki` — a fresh App shows the menu, whose first item is `Create New Wiki (init)`, so the spec test would pass even if navigation were completely broken (and Ink 7's `render()` no longer returns `lastFrame()` at all, so it could not run as written). The replacement (a) drives the real Ink input pipeline through a fake-TTY stdin, (b) asserts init-screen-only text (`Press Escape to go back`) after Enter, (c) unit-tests the exported `resolveMenuSelection` mapping for all 5 items, and (d) renders each screen directly. This is strictly stronger than the spec test and satisfies the actual pass criterion ("menu selection navigates to the correct screen").

3. **Ink 7 test adaptations (no `lastFrame()`, capture-after-`unmount()` via fake stdout, static menu list when raw mode unsupported, `isActive` guards on `useInput`) — ACCEPTED.**
   These are test-harness adaptations to Ink 7 realities, verified accurate: Ink 7.1.1 is installed, and the guards only alter behavior in non-TTY contexts (test runner, piped output). In a real terminal (the UAT 0.6 use case) raw mode is supported and `ink-select-input` is used. Product behavior is not degraded for the actual user.

4. **Gate 0.4 skip reads process env only — ACCEPTED.**
   Sanctioned by the orchestrator brief and consistent with the recorded user decision (de-minimis smoke call allowed when the user provides a key). The env-only skip is documented in the status file. Consequence the orchestrator must know: the client loads `.env`, but the test skip does not — a key present only in `.env` (which is the current on-disk state) will NOT make the gate run. The key must be exported into the shell environment before `npm test`.

5. **`src/cli.ts` parse guard (`!process.env.VITEST` + argv/import.meta comparison) — ACCEPTED.**
   Required for Gate 0.5 to import `{ program }` without hanging or rendering the TUI. Verifier confirmed direct execution still works (all `--help` smoke tests). Minor, documented, non-conflicting.

6. **Extra files `scripts/create-golden-master.ts` and `scripts/verify-golden-master.ts` — ACCEPTED.**
   The generator is how the controlled fixture was produced (required for reproducibility — every word of the PDF is visible in source); the verifier script is a read-only helper. Both committed, both inside the project root, both typechecked (included in `tsconfig.json`). Non-conflicting extension.

7. **Dependency versions (claimed "NONE") — CONFIRMED NOT A DEVIATION.**
   All installed versions satisfy the spec's pinned ranges; `npm install` needed no flags.

---

## 3. LLM Client Static Review (`src/llm/client.ts`) — not executed

- Targets the Anthropic Messages API: `POST https://api.anthropic.com/v1/messages`, `x-api-key` header, `anthropic-version: 2023-06-01`. Matches the recorded user decision.
- Key from `process.env.ANTHROPIC_API_KEY` with a hand-rolled `.env` fallback parser (no dotenv dependency, keys not already in env only). Matches the decision.
- Model from `ANTHROPIC_MODEL`, default `claude-haiku-4-5-20251001`; cost computed from response `usage` with a Haiku 4.5 price table ($1/$5 per MTok) overridable via env vars. Matches the decision.
- Logs exactly `LLM Call | Tokens: {input}/{output} | Cost: ${amount}` per call. Matches spec §2.8.
- No retry logic; throws on missing key and on non-2xx HTTP. Matches spec §2.8.
- Returns raw response text (concatenated `text` content blocks). Matches spec §2.8.

## 4. `templates/AGENTS.md` vs Vision §3

Present and committed. Contains: constitution framing ("binding for every page", "this file wins"), purpose section, page structure with YAML frontmatter including `sources` entries (`id: srcN`, `pdf`, `pages`), `[^srcN]` inline citation rules with no-invented-sources rule, and the LLM-must-read-and-follow rule. Matches vision §3 (AGENTS.md as the wiki's constitution) and Principle 2 (citation-backed knowledge). COMPLIANT.

---

## 5. Compliance Verdict

**COMPLIANT** (with non-conflicting extensions).

- CLI `init <slug> --title -w <workspace>` / `ingest <slug>` signatures match vision §3 workflow exactly. COMPLIANT.
- `extractText` (pdfjs-dist, deterministic, never splits a page, 1-based inclusive page ranges) matches vision §4.1 Layer 1, §4.4, §5. COMPLIANT.
- `sha256` (node:crypto streaming) supports §4.2 hash-tracked incremental ingestion. COMPLIANT.
- `callLLM` is Layer 2 infrastructure; deterministic vs LLM responsibilities per §5 are respected. COMPLIANT.
- TUI (Ink) is a terminal UI, not a web interface; vision §7 non-goal not violated. COMPLIANT.
- No `init`/`ingest`/agent implementation exists — Phase 0 is infrastructure only, per the approval checklist. COMPLIANT.
- Golden master PDF + `scripts/` + root `AGENTS.md` (project DOX file, committed in `6c0f4e5`): EXTENSIONS, documented, no conflict with any vision section.
- LLM spend: $0 confirmed as far as verifiable (no live test executed; Verifier made none).

---

## 6. Blockers Before Phase 0 Can Be Approved

1. **Gate 0.4 PENDING — requires the user to export `ANTHROPIC_API_KEY` into the shell environment and re-run `npm test`.** A `.env` with the key exists on disk (gitignored, untracked), but the gate's skip predicate reads process env only, so `.env` alone will never trigger the test. Exact step: `export ANTHROPIC_API_KEY=... && npm test` (Git Bash). Expected cost ~$0.001, sanctioned by the 2026-07-17 user decision. Until this runs green, Gate 0.4 — and therefore Phase 0 — cannot be marked fully approved.
2. **UAT 0.2 and UAT 0.6 (interactive TUI navigation in a real terminal) cannot be verified by automation in a non-TTY shell** and remain manual user checks per the approval checklist. The automated gates (0.6–0.8) cover rendering and navigation logic, but the human interactive pass is still outstanding.

**Non-blocking observations:**
- Gate 0.3 test prints `'shasum' is not recognized...` stderr noise on Windows before the certutil fallback engages; cosmetic only.
- The `.env`-vs-process-env mismatch between the client (loads `.env`) and the Gate 0.4 skip predicate (process env only) is documented but should be remembered in later phases: any future live-LLM test gated on env presence must export the key.
