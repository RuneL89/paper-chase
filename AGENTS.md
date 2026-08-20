# DOX framework

* DOX is highly performant AGENTS.md hierarchy installed here
* Agent must follow DOX instructions across any edits

## Project

* This folder is the project root for **Paper Chase v.1.0** — a CLI that turns PDFs into citation-backed markdown wikis (formerly LLM Wiki CLI, the v2.0 development name)
* Canonical remote: `https://github.com/RuneL89/paper-chase` — `main` carries v2.0 history; the previous v1 codebase is archived on branch `archive/v1-main`
* Canonical vision documents live in `Project Vision/`; the phased implementation plan lives in `Implementation Plan/`
* All implementation artifacts (`src/`, `tests/`, `test-pdfs/`, `templates/`, `prompts/`, `wikis/`, `package.json`, etc.) are created directly in this project root. Never create a separate project directory here or elsewhere

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

* 2026-07-16: All new files and folders must be created in this project folder (`Wiki v5/`). Do not create or reference another project directory.
* 2026-07-17: All core workflows must be doable from the TUI in a user-friendly manner (no manual file copying in Explorer). Established with the Phase 1 "Add PDFs" screen; applies to future phases' features too.
* 2026-07-17: File selection in the TUI must use a graphical/native file picker (Windows OpenFileDialog), never typed or pasted paths as the primary interaction; manual path entry is only a fallback.
* 2026-07-18: Phase 11 (Polish) productionization requirements: implement per-call LLM model routing in Settings with inline recommendation labels (Extractor → cheaper structured model, Synthesis Writer → stronger prose model, DOX Writer → strong contract-writing model); remove the 'Run Tests' and 'Test Extractor' screens from the TUI; add smoother TUI touches including result banners, progress bars/ETAs, welcome splash, and a continuous workflow where creating a new wiki immediately flows into 'Add PDFs' and then prompts to start ingesting without returning to the main menu.
* 2026-07-18: Create New Wiki screen simplified: only Title and Workspace fields; the wiki slug is derived from the Title via `slugify` (lowercase, spaces → hyphens). No separate slug field.
* 2026-07-19: Multilingual ingestion (Phase 7): two independent language settings — per-wiki **output language** (chosen at `init`, default English) and per-run **input language** (chosen at ingest, default English). Binding rule: Layer 1 prose is written in the output language; Layer 2 evidence always stays verbatim in the source language (never translated). Slugs are transliterated with the input language's map (æ→ae, ø→oe, å→aa) before slugifying; the English default keeps byte-identical pre-Phase-7 behavior. Supported set: en, da, de, fr, es, no, sv.
* 2026-07-19: This project folder (`Wiki v5/`) contains only the Paper Chase project. Cross-project reusable tooling (skills, template kits) is created outside this folder (e.g. `~/.agents/skills/`); the 2026-07-16 "create everything here" preference applies to project artifacts only.
* 2026-07-20: The workspace-level `wikis/index-of-indexes.md` is a DOX Writer output written like any other parent index — the topmost step of the bottom-up chain (folder indexes → wiki root index → workspace index), synthesizing only the freshly-written child contracts (never the wikis' content pages), with deterministic children/statistics re-imposition and deterministic fallback. Regenerated at the end of every ingest; prose in the triggering ingest's output language. Ratified as a vision amendment (compliance-log [2026-07-20 02:30]); implemented under reopened Phase 6 (gates 6.9–6.11).
* 2026-07-20: Bounded retry amendment (user-ratified via the contradiction protocol, vision 04 §6 + 07 §5 amended): transient transport failures (429/5xx/network) retried ≤3 total attempts with backoff; quality failures (synthesis preservation, unparseable DOX output) retried ≤3 per page/folder before the deterministic fallback; deterministic failures (invalid JSON, schema, HTTP 4xx) are NEVER retried. Applies to ALL languages — it is pipeline-level, with no language condition (user clarification 2026-07-20). Implemented as Phase 7 v1.1.0 (gates 7.10–7.12). 2026-08-20 addendum (Phase 16 v1.0.1, user directive option 3 — the option-4 chunk-skip fallback was rolled back the same day): the exhausted transient-transport error message now includes the attempt count, and HTTP 429 retries honor the provider's `Retry-After` header (delay = max(exponential backoff, header seconds)). 2026-08-20 (Phase 16 v1.0.2, user-ratified): HTTP 429 retries get 6 total attempts with an escalating stall floor (60s/120s/240s/480s/960s — ~31 min; delay = max(exponential backoff, Retry-After, floor), ALL providers) so a throttled free-tier model (GLM-4.7-Flash) clears its window and the run completes — cheap completion over speed, data never skipped. The ≤3-attempt rule still governs every OTHER transient class; `maxRetries: 0` keeps the frozen no-retry default; the stall is surfaced live on the ingest progress channel (`Rate limited by provider (HTTP 429) — waiting Ns before retry (attempt X/6)...`); exhausted stalls still abort loudly with the actual attempt count.
* 2026-07-21: Per-wiki workspace segments (user-ratified amendment, vision 03 §6 + 04 Step 10 amended, Phase 6 v1.2.0): the cross-wiki LLM prose in `wikis/index-of-indexes.md` is KEPT, but it is composed of per-wiki segments — each written by that wiki's own ingest in that run's output language. A wiki's DOX Writer ONLY writes its own contribution (its prose segment and its `## Wikis` catalog line); every other wiki's segments are preserved byte-for-byte. Supersedes the whole-file regeneration part of the 2026-07-20 workspace-index preference. Refined 2026-07-21 (01:10, user choice): the top workspace PROSE is a coherent cross-wiki LLM synthesis over ALL wikis' root contracts, regenerated ONLY when the wiki set changes (add/remove) or is missing — routine ingests preserve it byte-for-byte so it is never re-translated; the `## Wikis` catalog lines stay per-wiki owned as above.
* 2026-07-21: AGENTS.md update proposals (Phase 9) are reviewed with an inline diff and applied only by an explicit human action — Accept replaces the wiki's `AGENTS.md` with the proposal. **Superseded 2026-07-23 (Phase 11 v1.6.0 user directive):** Reject now does NOTHING — the proposal file is KEPT on disk for later manual review and `AGENTS.md` is untouched (the 2026-07-21 reject-deletes-the-proposal rule no longer applies). The TUI review screen (removed in Phase 11 per the five-item menu preference below) was RESTORED in v1.6.0 as a FLOW-ONLY screen reachable only from the post-ingest `p` shortcut (the success state of an ingest that wrote `.state/proposed-agents.md` shows `AGENTS.md update proposed — press [P] to review the diff.`); the five-item main menu is unchanged. The durable rule stands: `.state/proposed-agents.md` is applied only by an explicit human action, never automatically.
* 2026-07-21: Phase 11 TUI main menu (final) keeps only five items, in order: Create New Wiki, Add PDFs, Ingest PDFs, Settings, Exit. View Validation Report, Browse Entities, Browse Topics, and Browse DOX Contracts are removed from the main menu.
* 2026-07-22: Model routing is multi-provider (Anthropic default, OpenAI optional; Qwen optional added 2026-08-04; DeepSeek added 2026-08-17): Settings has a Provider row (relabeled **Default Provider** on 2026-08-17 — see below); model catalogs and inline recommendation labels follow the selected provider (Anthropic: Haiku/Sonnet/Opus; OpenAI: GPT-5.6 Luna/Terra/Sol; Qwen: Qwen-Plus/Qwen 3.7 Max/Qwen 3.8 Max; DeepSeek: DeepSeek-V4-Pro only for now); OPENAI_API_KEY / DASHSCOPE_API_KEY / DEEPSEEK_API_KEY via env or .env. **Superseded 2026-08-17:** the reset-on-switch rule — switching the Default Provider no longer resets the seven model slots; it re-seeds only the Default Model row (per-step provider selection below).
* 2026-07-23: API keys are manageable in the TUI Settings screen (API Keys section, per provider): masked entry showing only source + last 4 chars, stored per-workspace in .paper-chase.json (gitignored — never commit), resolution order Settings → env var → .env, empty submit clears a stored key.
* 2026-07-23: Validation feedback retry (reask): content-defect failures (Extractor JSON/schema, synthesis preservation, DOX/workspace/updater missing-sections) are retried ≤3 total attempts with the validator's exact errors fed back for correction; HTTP 4xx never retried; transient unchanged; Extractor exhaustion aborts; metrics.feedbackRepairs + prompt-quality warning at ≥5 repairs or >25% of run calls.
* 2026-07-23: Model-routing guidance revised (decision record `Project Vision/optimizations/optimizations.md` L2): the DOX Writer slot should use the **mid-tier** model — Anthropic Sonnet 5 / OpenAI GPT-5.6 Terra / Qwen 3.7 Max — not the premium tier (Opus 4.8 / GPT-5.6 Sol / Qwen 3.8 Max); DOX contracts are structural navigation whose correctness is deterministically re-imposed, so the premium tier buys nothing. Extractor and `default` (updater) slots → cheap tier (Haiku/Luna/Qwen-Plus); Synthesis slot → mid-tier (user requires strong prose, Haiku too weak for writing). This supersedes the DOX "strong contract-writing model" part of the 2026-07-18 Phase 11 preference; applied by the user via TUI Settings, no code/default change.
* 2026-08-09: Phase 24 Cross-Wiki Discovery (user-ratified vision amendments 2026-08-09, phase doc v1.2.1): a workspace-level post-DOX pass produces derived, read-only artifacts in `wikis/cross-wiki/` (entity registry, relationship graph, topic clusters) plus `.state/cross-wiki/*.json` mirrors, running after the workspace DOX pass and before the AGENTS.md Updater — auto-run in production (CLI/TUI default-on, `--no-cross-wiki` opt-out) only when ≥2 wikis exist, gated by a deterministic run fingerprint + optional cheap relevance probe. It NEVER edits per-wiki content pages, never aborts an ingest on failure, holds uncertain entity matches for human review (`.state/proposed-cross-wiki-matches.json`), and publishes hypothesis signals only to `.state/cross-wiki/proposed-signals.json` (never wiki pages). Cross-wiki matching is workspace-wide and cross-language.

* 2026-08-10: Phase 24 cross-wiki model routing (Option B): the TUI Settings screen exposes two explicit model rows — "Cross-Wiki Bulk Model" (routes the cheap `cross-wiki-*` calls to the `crossWiki` slot, falling back to the Default slot) and "Cross-Wiki Judgment Model" (routes the mid-tier `cross-wiki-uncertain-review` and `cross-wiki-hypothesis` calls to the `crossWikiJudgment` slot, falling back to the Synthesis Writer slot then the Default slot). Both slots are persisted in `.paper-chase.json` under `models.crossWiki` and `models.crossWikiJudgment`; absent legacy configs normalize to null so the original default/synthesis fallback is preserved.

* 2026-08-17: DeepSeek provider + per-step provider/model routing (user directive): **DeepSeek** is a built-in provider — catalog `deepseek-v4-pro` only for now (more models later), OpenAI-compatible endpoint `https://api.deepseek.com` (`/v1/chat/completions`), key via `DEEPSEEK_API_KEY` (Settings → env → .env, like the other providers), price-table entry at the peak $1.32/$3.96 per MTok. **Each of the seven model rows now picks its OWN provider + model** (`{ provider, model }` pairs persisted in `.paper-chase.json`; legacy string slots migrate to pairs under the old global provider on load): Left/Right cycles one combined list across every provider's catalog, rows whose provider differs from the Default Provider show a `Provider · Model` prefix (e.g. `Qwen · Qwen-Plus`), Enter on a row types a custom model id scoped to that row's provider, and the `T` test + recommendation labels follow the row's own provider. The old global Provider row became **Default Provider** and governs only the default slot: switching it re-seeds just the Default Model row and preserves explicitly-configured rows (supersedes the reset-on-switch part of the 2026-07-22 preference). Example per the user: Qwen for the Extractor (small tasks), DeepSeek-V4-Pro for the DOX Writer, Anthropic Sonnet for the Synthesis Writer — all in one routing table. Note: DeepSeek-V4-Pro is a reasoning model (its hidden `reasoning_content` consumes `max_tokens` before the visible answer), so the Settings test-connection probe uses a 256-token budget.
* 2026-08-19: Zhipu provider (user directive): **Zhipu (GLM)** is a built-in provider using the INTERNATIONAL Z.ai endpoint only (`https://api.z.ai/api/paas/v4/chat/completions` — user requirement: never the China BigModel host), key via `ZAI_API_KEY` (Settings → env → .env); catalog `glm-4.7-flash` (GLM-4.7-Flash — FREE, $0/$0 per MTok, free tier limited to 1 concurrent request so it belongs on the sequential steps only), `glm-5.2` (GLM-5.2), `glm-5.3` (GLM-5.3 — mandatory reasoning, so real token use runs higher); GLM-5.2/5.3 both $1.40/$4.40 per MTok. Seeded tiers: default/cheapest = GLM-4.7-Flash, curation/mid = GLM-5.2, premium = GLM-5.3.

## Child DOX Index

* `Project Vision/` — canonical vision and specification documents for Paper Chase v.1.0; the source of truth for implementation compliance. See `Project Vision/AGENTS.md`
* `Implementation Plan/` — phased implementation plan (Phases 0–9, 11–23), master index, and agent prompts. See `Implementation Plan/AGENTS.md`
* `src/` — all TypeScript source (CLI, TUI, extraction, LLM client, Extractor agent, Materializer, Synthesis Writer, DOX Writer, AGENTS.md Updater, Curation agent since Phase 14, validation, commands, state, utils; the Cross-Wiki Discovery pass since Phase 24 — `src/cross-wiki/` + `src/pages/cross-wiki/`). See `src/AGENTS.md`
* `tests/` — vitest suites; each phase's technical gates encoded as tests. See `tests/AGENTS.md`
* `test-pdfs/` — controlled PDF fixtures; golden masters are immutable. See `test-pdfs/AGENTS.md`
* `templates/` — templates for generated wiki artifacts. Special case: `templates/AGENTS.md` is the **wiki constitution template artifact** required by `PHASE_00_infrastructure.md` §2.1, not a DOX contract, so this folder's rules live here: template must keep covering wiki purpose, page structure, `[^srcN]` + `sources` citation rules, the LLM-must-follow rule, and (since Phase 7) the `## Language` section binding the wiki's output language and the verbatim-Layer-2 rule; since the Phase 13 closeout (user-ratified 2026-07-24) it must also stay floor-free — Layer 1 is quality-sized by the evidence with sparse honesty (no paragraph/word minimums) — and document the deterministic `sparse` frontmatter field alongside `aliases`; since Phase 23 it also documents the `comparison` page type and the `comparisons/` top-level folder (the ratified `03` §3.1 extension); placeholders use `{{DOUBLE_BRACE}}`; changes must stay compliant with `Project Vision/06_citation_and_provenance.md` and `03_DOX_concept_detailed.md`
* `prompts/` — LLM prompt files for the agent pipeline (`extractor.prompt.txt` since Phase 2, Synthesis Writer prompts since Phase 5, `dox-writer.prompt.txt` + `dox-writer-workspace.prompt.txt` since Phase 6, `agents-updater.prompt.txt` since Phase 9, the two curation prompts since Phase 14, the two composite synthesis prompts since Phase 22, the comparison synthesis prompt since Phase 23, the seven cross-wiki discovery prompts since Phase 24; the eleven pipeline agent prompts carry the Phase 7 `{languageDirective}` placeholder and the seven cross-wiki prompts carry it with the Phase 24 `cross-wiki` role — the updater and workspace prompts do not, see `prompts/AGENTS.md`). See `prompts/AGENTS.md`
* `scripts/` — one-off fixture generator/verifier scripts; never re-run the golden master generator. See `scripts/AGENTS.md`
* `bin/` — the `chase` launcher (`bin/chase.js`, Phase 11). Special case: no separate child doc — this folder's rules live here: the launcher resolves the local `node_modules/tsx/dist/cli.mjs` and spawns `process.execPath` with an args array and NO shell (spaced-path-safe on Windows), falling back to `npx tsx` with `shell: true` on win32 only when the local tsx is missing; it must forward argv verbatim and propagate the child exit code
* `dist/` — packaging output (force-included for release; the two large binaries `paper-chase.exe` and `runtime-node.exe` are tracked via Git LFS). `dist/` still appears in `.gitignore` for development, but the directory was force-added for release. Ad-hoc Windows packaging 2026-07-23 (compliance-log entries [2026-07-23 03:52] + closeout). Special case: no child doc — rules here: **`npm run package:win` builds `dist/paper-chase.exe`** — a pkg launcher that embeds a real Node runtime + the esbuild app bundle + assets (prompts, template, pdfjs fonts, native canvas, pdf.js workers) and on first run extracts them to `%LOCALAPPDATA%\paper-chase\runtime\<asset-version>` (marker-guarded, version-stamped on asset-set changes). **The asset version is the `VERSION` constant in `scripts/launcher-entry.ts` — bump it on EVERY asset-affecting change (prompts, template, bundle, fonts, workers) or the marker guard silently reuses the stale extraction** (the 2026-07-25 1.0.1→1.0.2 bump: curation prompts were added without a bump and the stale runtime lacked them; same-day 1.0.2→1.0.3: DOX Writer prompt navigation fix — complete index-chain catalogs; 2026-07-28 1.0.3→1.0.4: Phase 17 entity-synthesis prompts — the `{relatedEntities}` slot + updated wikilink rule; 2026-07-29 1.0.4→1.0.5: Phase 18 — the `=== CITATION KEYS ===` section + `{citationMap}` slot in all four synthesis prompts; 2026-07-29 1.0.5→1.0.6: Phase 21 — the `=== PROPOSED PAIRS ===` section + confirm/deny `"pairs"` output in both curation prompts; 2026-07-29 1.0.6→1.0.7: Phase 22 — the two NEW composite synthesis prompts (`composite.prompt.txt` + `composite-permissive.prompt.txt`) and the `=== PROPOSED CLUSTERS ===` section in `curation-entities.prompt.txt`; all three are covered by the `prompts/**/*` asset globs in both pkg configs; 2026-07-29 1.0.7→1.0.8: Phase 23 — the NEW comparison synthesis prompt (`comparison.prompt.txt`) and the extractor prompt's new `tables` output section in `extractor.prompt.txt`; both covered by the same `prompts/**/*` globs; 2026-08-10 1.0.10→1.0.11: Phase 24 — the seven NEW cross-wiki discovery prompts (`cross-wiki-entity-context`/`-entity-match`/`-entity-uncertain-review`/`-predicate-normalize`/`-topic-cluster`/`-hypothesis`/`-relevance-probe`) plus the client.ts mid-tier call-type mapping; the prompts are covered by the same `prompts/**/*` globs; 2026-08-10 1.0.11→1.0.12: Phase 24 cross-wiki model routing Option B — the Settings bundle (`src/tui/settings-screen.tsx`, `src/tui/settings.ts`, `src/llm/client.ts`) adds the Cross-Wiki Bulk / Judgment model rows and slots; the bundle is an extracted asset; 2026-08-17 1.0.13→1.0.14: DeepSeek provider + per-step provider/model routing — the same Settings bundle (`src/llm/client.ts`, `src/tui/settings.ts`, `src/tui/settings-screen.tsx`) gains the DeepSeek provider, the composite per-slot routing schema, the combined catalog cycle, and the DeepSeek API Key row; the bundle is an extracted asset; 2026-08-19 1.0.14→1.0.15: Zhipu (GLM) provider — the same Settings bundle gains the Zhipu provider, the GLM catalog, the international Z.ai endpoint, and the Zhipu API Key row; the bundle is an extracted asset; 2026-08-20 1.0.15→1.0.16: Phase 16 v1.1.0 extraction transport fallback build — rolled back the same day, never a release; 2026-08-20 1.0.16→1.0.17: ROLLBACK release — ingest.ts back to the pre-amendment extraction loop (per-chunk transport fallback removed); client.ts keeps the option-3 changes (attempt count in exhausted transport errors + Retry-After honoring on 429); installs that extracted 1.0.15 or 1.0.16 must re-extract to drop the rejected fallback and gain Retry-After honoring; 2026-08-20 1.0.17→1.0.18: Phase 16 v1.0.2 reactive 429 stall — the client.ts bundle gains the stall (`RATE_LIMIT_MAX_ATTEMPTS`/`rateLimitStallDelayMs`) + the `setRateLimitWaitReporter` seam, and ingest.ts gains the reporter-wiring wrapper; the bundle is an extracted asset; the bundle is an extracted asset). This shape exists because pkg's patched Node runtime segfaults inside react-reconciler's commit when ink renders (exhaustively isolated; plain Node runs the same bundle cleanly) — the TUI must run under real Node. `npm run package:win:raw` builds the direct pkg exe (CLI subcommands work; the TUI crashes under pkg's runtime — kept for non-interactive use). Build steps: `scripts/build-exe.ts` → `scripts/build-launcher.ts`; asset lists: `pkg.config.launcher.json` (launcher), `pkg.config.json` (raw); tooling: esbuild + `@yao-pkg/pkg` (the maintained fork — classic pkg's node20 runtime is too old for ink 7 and pdfjs v4's `process.getBuiltinModule`)
* `.state/` — phase status files, compliance log, verification reports; the project's durable memory. See `.state/AGENTS.md`
* `docs/` — documentation assets. Special case: no child doc — this folder's rules live here: `docs/images/` holds images referenced by `README.md` and other docs (commit them; keep names descriptive kebab-case, e.g. `tui-main-menu.png`)
* `wikis/` — runtime workspace for generated wikis (Phase 1+ output of `init`/`ingest`); Phase 24 adds the derived `wikis/cross-wiki/` artifact set (cross-wiki entity registry, relationship graph, topic clusters — read-only, created only when ≥2 wikis exist). See `wikis/AGENTS.md`


