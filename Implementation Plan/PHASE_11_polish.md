# Phase 11: Polish and Productionization

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-011`
**Version:** 1.9.0
**Status:** Draft
**Date:** 2026-08-17
**Dependencies:** Phases 0-10
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $0 (no new LLM calls; productionization touches only)

**v2.0 amendment (user directive 2026-08-26):** Restored the DeepSeek and Zhipu/GLM built-in providers (reversing the 2026-08-25 removal) and added `Qwen 3.8 Flash` and `GLM-5.3-Flash` as selectable Sonnet-tier mid-tier models in the Settings bundle. The Default Provider row now cycles Anthropic ↔ OpenAI ↔ Qwen ↔ DeepSeek ↔ Zhipu (+ custom providers); API-key resolution adds `DEEPSEEK_API_KEY` and `ZAI_API_KEY`. Seeded defaults are unchanged; the new models are UI choices only. The per-step `{ provider, model }` routing, recommendation labels, and API-keys section otherwise stay unchanged.

**v1.9.0 amendment (user directive 2026-08-17):** "I want to be able to add different providers and models for specific steps in the model router setting. For example, I want to be able to use Qwen for the smaller tasks and a strong model for dox writing and Sonnet for wiki writing". **Per-step provider selection** replaces the global provider switch: each of the seven model rows is a self-describing `{ provider, model }` pair (persisted; legacy string slots migrate to `{ provider, model }` under the old global provider on load — byte-identical resolution), Left/Right cycles ONE combined list across every provider's catalog, rows whose provider differs from the Default Provider show a `Provider · Model` prefix, Enter on a row types a custom id scoped to that row's provider, and the `T` test plus recommendation labels follow the row's own provider. The Provider row becomes **Default Provider** and governs only the default slot — switching it re-seeds just the Default Model row and PRESERVES explicitly-configured rows (the v1.4.0 reset-on-switch rule is superseded). The Settings test-connection probe budget rises 16 → 256 tokens so reasoning models have room to emit visible content after hidden reasoning. Gate 11.16 (per-step routing) is added, and the approval-checklist counts grow from 12 gates / 8 UATs to **13 gates / 8 UATs**. The LLM budget stays $0 — all new gate tests use the mocked transport. Everything else is unchanged.

**v1.6.0 amendment (user directive 2026-07-23):** "at the end of the ingestion, I want a shortcut into proposed new AGENTS file to be showed. It will show the diff and I can approve or reject straight there - Approve would replace the existing AGENTS file with the proposed one - REJECT would do nothing". §2.4 gains a post-ingest review shortcut: when an ingest finishes with a written AGENTS.md update proposal, the success state offers a `p` shortcut into the restored AGENTS.md review screen (inline diff, `[A]`/`[R]`, `[V]` full diff). Accept replaces AGENTS.md with the proposal; **Reject is a no-op** (the proposal file is KEPT — this supersedes the 2026-07-21 reject-deletes preference; newest user directive wins). The review screen is FLOW-ONLY — reachable only from the post-ingest shortcut; the main menu stays at exactly five items (Gate 11.3 unregressed). Gate 11.12 and UAT 11.8 are added, and the approval-checklist counts grow from 11 gates / 7 UATs to **12 gates / 8 UATs**. The LLM budget stays $0 — all Gate 11.12 tests use fixtures and a stubbed ingest. Everything else is unchanged.

**v1.5.2 amendment (UAT-found spec bug, user-ratified fix 2026-07-23):** UAT 11.3's optional live ingest exposed that the Anthropic catalog IDs in v1.3.0–v1.5.0 were invalid — `claude-sonnet-4-5-20251001` and `claude-opus-4-20250918` return HTTP 404 (`not_found_error`). The catalog was corrected against the account's live model list (`GET /v1/models`, 2026-07-23): the Anthropic tier is now `claude-haiku-4-5-20251001` (Haiku 4.5, unchanged — the only pre-fix ID that existed), **`claude-sonnet-5`** (Sonnet 5, per user direction), and **`claude-opus-4-8`** (Opus 4.8, per user direction); Opus pricing updated to the 4.5-era $5/$25 per MTok (best-known, env-overridable). Display labels gain version numbers (Haiku 4.5 / Sonnet 5 / Opus 4.8). No gate or UAT semantics change — only the model IDs/labels/prices in §2.2 and the gate examples.

**v1.5.1 amendment (user directive 2026-07-23):** "Let's not call it \"Paper Chase v2.0\" but \"Paper Chase v.1.0\" - replace everywhere". The version shown in the brand is `v.1.0` (TUI header, welcome splash, docs) and the semver fields are `1.0.0` (`package.json`, `package-lock.json`, `program.version()`). Historical "LLM Wiki CLI (v2.0 development name)" notes and Document IDs are unchanged.

**v1.4.0 amendment (user directive 2026-07-22):** "I'd also like to be able to switch between Anthropic models and OpenAI models, so add that to the model selection. You should suggest what models to use for either Anthropic or OpenAI depending on which provider the user chooses." The model routing of §2.2 gains a provider dimension (Provider row, per-provider catalogs, reset-on-switch, provider-aware labels), Gate 11.10 and UAT 11.6 are added, and the approval-checklist counts grow from 9 gates / 5 UATs to 10 gates / 6 UATs. Everything else is unchanged.

**v1.5.0 amendment (user directive 2026-07-23):** "I want to be able to add Anthropic/openai API in Settings". §2.2 gains an **API Keys** section: per-provider keys entered in the TUI Settings screen (masked entry, source + last-4 display only), persisted per workspace in `.paper-chase.json` (gitignored — never committed), resolved per call in the order Settings-stored → environment → `.env`, with an empty submit clearing a stored key. Gate 11.11 and UAT 11.7 are added, and the approval-checklist counts grow from 10 gates / 6 UATs to **11 gates / 7 UATs**. The LLM budget stays $0 — all Gate 11.11 tests use a mocked transport and fake keys. Everything else is unchanged.

---

## 1. Objective

Polish the CLI/TUI for production use: ship v2.0 under its final brand (**Paper Chase**, command `chase`), per-call LLM model routing with suggestion labels, TUI cleanup, smoother workflow, and a complete README.md that documents the app accurately after all implementation is done.

---

## 2. What to Build

### 2.1 Rebrand: "LLM Wiki CLI" → "Paper Chase"

**Goal:** Ship v2.0 under its final brand. The product is **Paper Chase**, the CLI verb is **`chase`**, and the machine-readable form is **`paper-chase`**. "Run `chase` on the leak" is the product promise; the verb is built into the brand.

**Naming rules (binding):**

- Humans: **Paper Chase** (two words, title case) — README, TUI header/splash, documentation, conversation.
- Machines: **`paper-chase`** (hyphenated, lowercase) — npm package name, GitHub repo.
- Command: **`chase`** — the CLI verb:
  ```
  chase init panama-subset --title "Panama Papers Subset"
  chase ingest panama-subset
  chase ingest --synthesis
  ```
- Forbidden forms: `paperchase`, `PaperChase`, `PaperCase`. Never, anywhere.
- Internal vocabulary is unchanged: wiki, source, entity, topic, citation, DOX contract keep their names. The theme decorates the vocabulary; it never replaces it (no "case files" for wikis, no "suspects" for entities).
- Document IDs (e.g. `LLM-WIKI-CLI-IMPL-PHASE-011`) are stable identifiers, not branding; they keep their existing prefix.
- Historical records stay untouched: everything under `.state/` (phase status files, verification reports, compliance log) and already-generated wikis under `wikis/<slug>/` (they pick up the new brand when regenerated from templates).

**Code changes:**

- `package.json` — `"name": "paper-chase"`; `"description": "The paper chase, automated. Turn PDFs into citation-backed markdown wikis."`; add `"bin": { "chase": "bin/chase.js" }`.
- `bin/chase.js` (new) — thin launcher that runs the TypeScript CLI through tsx (no build step in this phase): spawn `npx tsx <pkgRoot>/src/cli.ts` with forwarded args, `stdio: 'inherit'`, and `shell: true` on Windows (Node ≥ 20.12.2 refuses to spawn `.cmd` files without a shell — same workaround as the `test` command in `src/cli.ts`). `npm link` puts `chase` on the PATH for local use.
- `src/cli.ts` — `program.name('chase')`; description becomes "The paper chase, automated. Turn PDFs into citation-backed markdown wikis.".
- `src/tui/components/header.tsx` — header text `LLM Wiki CLI v2.0` → `Paper Chase v.1.0`.
- `src/tui/settings.ts` — config file renamed to `.paper-chase.json`; the loader falls back to reading legacy `.llm-wiki-cli.json` when the new file is absent (read-only fallback); save always writes the new name.
- `src/tui/settings-screen.tsx`, `src/tui/ingest-screen.tsx` — update user-facing strings and comments that name the config file.
- `package-lock.json` — refresh the root `"name"` field (run `npm install` once after the `package.json` edit).

**Documentation sweep (living docs only):**

- Root `AGENTS.md` — project name line; canonical remote → `https://github.com/RuneL89/paper-chase`.
- `Project Vision/` — all seven vision docs + `AGENTS.md`; `01_PRODUCT_VISION_AND_ARCHITECTURE.md` gains a one-line "formerly LLM Wiki CLI (v2.0 development name)" note.
- `Implementation Plan/` — `IMPLEMENTATION_PLAN_MASTER_INDEX.md`, `MASTER_IMPLEMENTATION_PROMPT.md`, `START_PHASE_PROMPT.md`, `PHASE_00`–`PHASE_09` docs and `PHASE_11_polish.md`, `AGENTS.md`. (This document was updated as part of Phase 11 planning.)
- `src/AGENTS.md`, `tests/AGENTS.md`, `templates/AGENTS.md`, `wikis/AGENTS.md` — name references only; `templates/AGENTS.md` stays compliant with its wiki-constitution role.
- Excluded from the sweep: `.state/**`, `wikis/<slug>/**`, `node_modules/**`, and `package-lock.json` beyond the root name field.

**GitHub repo rename (manual step, not scriptable):**

1. Rename the repo to `paper-chase` in GitHub settings.
2. `git remote set-url origin https://github.com/RuneL89/paper-chase`.
3. Confirm the canonical-remote line in root `AGENTS.md` matches.

### 2.2 Per-Call LLM Model Routing

**Goal:** Let the user choose a different Anthropic model for each LLM call type (Extractor, Synthesis Writer, DOX Writer). **v1.4.0:** …or switch the whole routing table to OpenAI and choose a different GPT model per call type.

**Settings screen additions:**

```
╔══════════════════════════════════════╗
║  Settings                            ║
╠══════════════════════════════════════╣
║  Chunk Size: [5          ]           ║
║  Synthesis: [ON ] / OFF                ║
║  Update Agents: ON / [OFF]             ║
╠══════════════════════════════════════╣
║  LLM Model Routing                     ║
║  Provider: [Anthropic ▼]    (v1.4.0)  ║
║  Default Model: [Haiku ▼]              ║
║  Extractor Model: [Same as default ▼] ║
║  Synthesis Writer Model: [Sonnet ▼]   ║
║  DOX Writer Model: [Opus ▼]            ║
╠══════════════════════════════════════╣
║  API Keys                     (v1.5.0) ║
║  Anthropic API Key: [configured ••••ab12] ║
║  OpenAI API Key: [not set]             ║
║  Qwen API Key: [not set]               ║
║  DeepSeek API Key: [not set]             ║
║  Zhipu API Key: [not set]                ║
╠══════════════════════════════════════╣
║  [ Save ]  [ Back ]                  ║
╚══════════════════════════════════════╝
```

**Provider dimension (v1.4.0, user directive 2026-07-22; per-step providers v1.9.0, user directive 2026-08-17):**

  - A **Default Provider** row (v1.9.0; was "Provider" through v1.8.x) sits directly above **Default Model** and cycles Anthropic ↔ OpenAI ↔ Qwen ↔ DeepSeek ↔ Zhipu (+ any custom providers) with Left/Right (same dropdown idiom as the model rows). Since v1.9.0 it defines ONLY the default slot: the Default Model row's provider and what "Same as default" resolves to.
  - **Per-provider model catalogs** — the dropdown choices follow the selected provider:
    - Anthropic: `claude-haiku-4-5-20251001` (Haiku), `claude-sonnet-5` (Sonnet), `claude-opus-4-8` (Opus)
    - OpenAI (GPT-5.6 family, lineup and prices verified against live OpenAI docs 2026-07-22 — see the compliance log): `gpt-5.6-luna` (GPT-5.6 Luna, $1/$6 per MTok), `gpt-5.6-terra` (GPT-5.6 Terra, $2.50/$15), `gpt-5.6-sol` (GPT-5.6 Sol, $5/$30)
    - Qwen (DashScope, 2026-08-04; v2.0 adds Qwen 3.8 Flash as a Sonnet-tier option): `qwen-plus`, `qwen3.7-max`, `qwen3.8-max`, `qwen3.8-flash`
    - DeepSeek (v2.0): `deepseek-v4-pro`
    - Zhipu/GLM (v2.0): `glm-4.7-flash`, `glm-4.7-flashx`, `glm-5.2`, `glm-5.3`, `glm-5.3-flash`
    - Custom providers: any provider id configured in `.paper-chase.json` or typed in the Default Provider row (e.g. `openrouter`, `fireworks`) appears in the combined catalog with its own endpoint/key resolved from env/`.env`.
- **Per-step provider selection (v1.9.0, supersedes reset-on-switch):** each of the seven model rows (Default, Extractor, Synthesis Writer, DOX Writer, Curation, Cross-Wiki Bulk, Cross-Wiki Judgment) is a self-describing `{ provider, model }` pair persisted in `.paper-chase.json` (null = "Same as default"); legacy STRING slot values migrate to `{ provider, model }` pairs under the old global provider on load. Left/Right cycles ONE combined list across every provider's catalog; rows whose provider differs from the Default Provider show a `Provider · Model` prefix (e.g. `Qwen · Qwen-Plus`); Enter on a row opens a custom-id editor scoped to that row's provider; the per-row `T` connection test and the inline recommendation labels follow the row's OWN (effective) provider. Switching the Default Provider re-seeds only the Default Model row — explicitly-configured rows are preserved because each carries its own provider, so a mixed table (Qwen Extractor + Anthropic Synthesis Writer + OpenAI DOX Writer) can never desync.
- **Provider-aware recommendation labels** — the wording mirrors across providers:
  - Anthropic — Extractor: "Haiku — cheapest, good for structured JSON extraction"; Synthesis Writer: "Sonnet — better prose, fewer preservation failures"; DOX Writer: "Sonnet/Opus — strong contract writing for navigation"
  - OpenAI — Extractor: "GPT-5.6 Luna — cheapest, good for structured JSON extraction"; Synthesis Writer: "GPT-5.6 Terra — better prose, fewer preservation failures"; DOX Writer: "GPT-5.6 Terra/Sol — strong contract writing for navigation"
  - Qwen — Extractor: "Qwen-Plus — cheapest, good for structured JSON extraction"; Synthesis Writer: "Qwen 3.8 Flash — Sonnet-tier prose, fewer preservation failures"; DOX Writer: "Qwen 3.8 Flash — Sonnet-tier; structural navigation, correctness re-imposed deterministically"
  - DeepSeek — Extractor: "DeepSeek-V4-Pro — good for structured JSON extraction"; Synthesis Writer: "DeepSeek-V4-Pro — Sonnet-tier prose, fewer preservation failures"; DOX Writer: "DeepSeek-V4-Pro — Sonnet-tier; structural navigation, correctness re-imposed deterministically"
  - Zhipu/GLM — Extractor: "GLM-4.7-Flash — free tier, good for structured JSON extraction"; Synthesis Writer: "GLM-5.3-Flash — Sonnet-tier prose, fewer preservation failures"; DOX Writer: "GLM-5.3-Flash — Sonnet-tier; structural navigation, correctness re-imposed deterministically"
- **OpenAI transport (all verified 2026-07-22):** `POST https://api.openai.com/v1/chat/completions` with `Authorization: Bearer $OPENAI_API_KEY`; body `{ model, max_completion_tokens, messages }` — `max_tokens` is deprecated and never sent; `temperature` is never sent (GPT-5.6 reasoning models reject it); the system prompt goes in a leading `{ role: 'system' }` message; the response is parsed from `choices[0].message.content` with usage from `prompt_tokens`/`completion_tokens`. Retry semantics are identical to Anthropic (429/5xx/network transient; other 4xx deterministic, never retried).
- Anthropic remains the **default provider**: config files without a `provider` field load as `'anthropic'` with byte-identical legacy behavior. The `ANTHROPIC_MODEL` env fallback stays anthropic-scoped; there is deliberately no `OPENAI_MODEL` env fallback (OpenAI models are configured via Settings only — keeps scope tight).

**Inline recommendation labels:**

Each dropdown shows a short suggestion:

- **Extractor:** "Haiku — cheapest, good for structured JSON extraction"
- **Synthesis Writer:** "Sonnet — better prose, fewer preservation failures"
- **DOX Writer:** "Sonnet/Opus — strong contract writing for navigation"

(v1.4.0: these labels follow the selected provider — see the provider-dimension list above.)

**Config persistence:**

- Save to `.paper-chase.json` under `models` (v1.4.0: with `provider`):
  ```json
  {
    "models": {
      "provider": "anthropic",
      "default": "claude-haiku-4-5-20251001",
      "extractor": null,
      "synthesis": "claude-sonnet-5",
      "dox": "claude-opus-4-8"
    }
  }
  ```
  or, with OpenAI selected:
  ```json
  {
    "models": {
      "provider": "openai",
      "default": "gpt-5.6-luna",
      "extractor": null,
      "synthesis": "gpt-5.6-terra",
      "dox": "gpt-5.6-sol"
    }
  }
  ```
- `null` means "use default"; a missing `provider` means `'anthropic'` (legacy configs).
- `callLLM` reads the model from the config via `process.env.ANTHROPIC_MODEL` as fallback (anthropic-scoped).
  - LLM keys: `ANTHROPIC_API_KEY` for Anthropic, `OPENAI_API_KEY` for OpenAI, `DASHSCOPE_API_KEY` for Qwen, `DEEPSEEK_API_KEY` for DeepSeek, `ZAI_API_KEY` for Zhipu/GLM (v1.5.0: stored in Settings, or via the environment or the project-root `.env` fallback — see the API Keys section below).

**API Keys in Settings (v1.5.0, user directive 2026-07-23):**

  - **Storage shape.** `.paper-chase.json` gains a top-level block alongside `models`:
    ```json
    {
      "apiKeys": { "anthropic": "sk-ant-…", "openai": null, "qwen": null, "deepseek": null, "zhipu": null }
    }
    ```
    `null` means "not stored". Config files written before v1.5.0 (no `apiKeys` block) load as `{ anthropic: null, openai: null, qwen: null, deepseek: null, zhipu: null }`; saved configs always carry the block. There is deliberately **no format validation** — a malformed key fails loud at call time with the provider's own auth error.
  - **Resolution order (per call, per provider).** (1) the Settings-stored key from the routing config → (2) `process.env.ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `DASHSCOPE_API_KEY` / `DEEPSEEK_API_KEY` / `ZAI_API_KEY` (the existing project-root `.env` fallback loader still populates `process.env` first) → (3) the missing-key error, which now names all five sources: `ANTHROPIC_API_KEY is not set. Add it in Settings, export it in your environment, or add it to a .env file in the project root.` (same shape for the other four providers). The five providers resolve independently. `ingest()` picks stored keys up through the existing single integration point (`loadSettings` → `setModelRouting`); the routing config carries them via its additive `apiKeys` field.
  - **UI contract.** A new **API Keys** section sits BELOW the LLM Model Routing rows and ABOVE `[ Save ]` / `[ Back ]`, with one row per provider (`Anthropic API Key`, `OpenAI API Key`, `Qwen API Key`, `DeepSeek API Key`, `Zhipu API Key`) integrated into the focus order. A row that is not being edited shows only the key SOURCE plus the last 4 characters of the resolved key: `[configured ••••ab12]` when a key is stored, `[from environment ••••ab12]` when resolvable via the environment/.env only, `[not set]` otherwise. Enter on a key row opens a masked `TextInput` (ink-text-input `mask` prop) on that row with an empty draft (the stored key is never pre-filled); Enter with a non-empty value STAGES the key into screen state, Enter with an EMPTY value stages a CLEAR (null), Escape cancels the edit. Staged values persist only via the existing `[ Save ]` button — the same semantics as every other row. The footer help names the key-row controls; the non-TTY static fallback lists the five rows with their masked status strings.
- **Masking/clear semantics helper.** The client exports `getApiKeyStatus(provider, storedKey): { source: 'stored' | 'environment' | 'none'; last4: string | null }`. It triggers the same one-time `.env` load as `callLLM` before checking the environment; a stored key wins (matching call-time resolution); `last4` is the last 4 characters of the RESOLVED key, null when none. The full key is never returned.
- **SECURITY (absolute).** Full API keys are NEVER rendered in the TUI (masked display only), NEVER written to any log (`llm-calls.json`, `metrics.json`, console — the log-entry field set is unchanged: timestamp/callType/context/provider/model/inputTokens/outputTokens/cost), and NEVER committed to git. `.paper-chase.json` is gitignored (`.gitignore` covers it since this amendment was pre-checked); the file must never be added to the index. On the wire the key travels ONLY in the request auth header (`x-api-key` for Anthropic, `Authorization: Bearer` for OpenAI) — nothing else changes.

**Files to modify:**
- `src/tui/settings-screen.tsx` — add model routing section with dropdowns and labels; v1.4.0: the Provider row, per-provider catalogs/labels, reset-on-switch; v1.5.0: the API Keys section (masked rows + masked editor)
- `src/tui/settings.ts` — extend settings schema with `models`; v1.4.0: `provider`, `MODEL_CATALOG`, provider-aware defaults, `seedModelsForProvider`; v1.5.0: the `apiKeys` block (tolerant load, always saved)
- `src/llm/client.ts` — accept a model override per call or read from a global config setter; v1.4.0: multi-provider transport branches, price-table entries per built-in provider, `provider` in the call log; v1.5.0: routing-carried `apiKeys`, per-call key resolution (stored → env → extended error), `getApiKeyStatus`
- `src/agents/extractor.ts` — use extractor model
- `src/agents/synthesis.ts` — use synthesis model
- `src/dox-writer.ts` (Phase 6) — use DOX model when implemented

### 2.3 TUI Cleanup

**Remove:**
- "Run Tests" screen and menu item
- "Test Extractor" screen and menu item
- "View Validation Report" menu item
- "Browse Entities" menu item
- "Browse Topics" menu item
- "Browse DOX Contracts" menu item
- Any development-only debug screens

**Keep:**
- Create New Wiki
- Add PDFs
- Ingest PDFs
- Settings
- Exit

**Menu item order (production):**
1. Create New Wiki
2. Add PDFs
3. Ingest PDFs
4. Settings
5. Exit

### 2.4 Smoother Workflow

**Result banners:**
- After `init`: "Wiki '<slug>' created at `wikis/<slug>/`."
- After `add-pdfs`: "Copied N file(s) to `wikis/<slug>/raw/`."
- After `ingest`: "Ingest complete: X ingested, Y skipped. Synthesis: A pages written (B strict, C permissive), D conflicts."
- After `validation`: "Validation passed" or "Validation found issues".

**Progress bars / ETAs:**
- During `ingest`, show a simple textual progress indicator:
  ```
  Extracting text from report.pdf...
  [████████░░] Chunk 2/12
  ```
- No external progress-bar library; use plain text.

**Welcome splash:**
- On first launch (no config file), show a one-line welcome:
  ```
  Paper Chase v.1.0 — the paper chase, automated.
  Create a wiki, add PDFs, then ingest.
  ```

**Continuous workflow:**
- After **Create New Wiki** succeeds, immediately go to **Add PDFs** (do not return to menu).
- After **Add PDFs** succeeds, ask "Start ingesting now? [Y/n]".
  - If yes, go to **Ingest PDFs** with the wiki pre-selected.
  - If no, return to menu.

**Post-ingest AGENTS.md review shortcut (v1.6.0, user directive 2026-07-23):**
- When an ingest completes with an AGENTS.md update proposal written to `.state/proposed-agents.md` (the *Propose AGENTS.md Updates* toggle / `--update-agents`), the success state shows an extra line: `AGENTS.md update proposed — press [P] to review the diff.` When no proposal was written there is no hint and `p` does nothing.
- Pressing `p` opens the restored **Review AGENTS.md Updates** screen for the ingested wiki: an inline compact diff between the current AGENTS.md and the proposal with `[A]ccept` / `[R]eject` on the same screen, `[V]` expanding to a scrollable full diff (A/R still available there), Escape collapsing/leaving.
- **Accept** copies the proposal over `wikis/<slug>/AGENTS.md` (the proposal file stays on disk — accept semantics unchanged). **Reject** does NOTHING: AGENTS.md is untouched and the proposal file is KEPT for later manual review (supersedes the 2026-07-21 reject-deletes preference).
- The review screen is FLOW-ONLY: it is reachable only from this post-ingest shortcut (and programmatically); it is NOT a main-menu item — the menu stays at exactly five items (Gate 11.3). After Accept/Reject, `onBack` returns to the menu, where the ingest summary persists as the `Last:` line. The non-TTY fallback never renders the hint.

### 2.5 Full README.md

**File:** `README.md` at the project root.

**Required structure:**

1. **Introduction** — elevator pitch of what the app is (one paragraph).
2. **Functional Architecture** — end-user friendly description of how the app works from the user's perspective (init → add PDFs → ingest → browse).
3. **Step-by-Step Architecture / Flow** — mid-level developer explanation of the agent flow, orchestration, rejection loops, and rejection criteria.
4. **Detailed Technical Architecture** — senior developer explanation of the entire app, sufficient to understand the codebase without reading other files.
5. **Project Structure** — description of all folders and files (`src/`, `tests/`, `wikis/`, `prompts/`, `.state/`, `templates/`, `test-pdfs/`, `scripts/`).

**Branding rules:**
- Title is `# Paper Chase` with the primary tagline: **"The paper chase, automated."**
- Secondary taglines allowed in intro copy: "You bring the documents. It does the chasing." / "Every claim, chased back to its source page." / "Compile the paper trail into a wiki."
- Include a one-line note: "formerly LLM Wiki CLI (v2.0 development name)".
- All command examples use `chase` (`chase init …`, `chase ingest …`, `chase ingest --synthesis`).
- State the naming rules once: `paper-chase` for machines (package, repo), "Paper Chase" for humans; never `paperchase` or `PaperChase`.

**Content rules:**
- Describe **implemented behavior**, not planned behavior.
- Include the synthesis fallback chain (strict → permissive → structured template).
- Include the per-call model routing configuration.
- Include the `.state/` log files (`llm-calls.json`, `synthesis-report.json`, `validation-report.json`, `conflicts.json`).
- Include test commands and expected outputs.

### 2.6 Performance Metrics and Logging

**File:** `src/metrics.ts`

Track and report metrics for each ingestion run:
- Chunks processed, skipped, failed.
- Entities extracted: new, updated.
- Relationships extracted.
- Claims extracted: by type.
- Pages created/updated: by type.
- Folders created.
- Broken links, orphaned pages.
- Conflicts: manual-edit, preservation-check.
- Total LLM tokens consumed.
- Total cost.
- Wall-clock time.

**Output:** `.state/metrics.json` and console summary.

### 2.7 E2E Test Suite

**File:** `tests/e2e.test.ts`

One end-to-end test that runs the full pipeline:
1. `init` a wiki.
2. Copy 2-3 PDFs to `raw/`.
3. Run `ingest`.
4. Verify all expected pages exist.
5. Verify all links resolve.
6. Verify all citations are valid.
7. Verify metrics are reasonable.

This test uses real PDFs and real LLM calls. It is slow and expensive. Run it only before releases, not in CI.

---

## 3. Technical Approval Gates

### Gate 11.1: Model Routing Settings Persist

```typescript
test('settings screen saves model routing to .paper-chase.json', async () => {
  // Render settings screen, select models, save, read config file.
  expect(config.models.extractor).toBe('claude-haiku-4-5-20251001');
  expect(config.models.synthesis).toBe('claude-sonnet-5');
});
```

### Gate 11.2: Model Routing Is Applied to LLM Calls

```typescript
test('extractor uses the configured extractor model', async () => {
  // Mock callLLM and verify it receives the extractor model when set.
});
```

### Gate 11.3: Non-Production Menu Items Removed

```typescript
test('menu only shows production items: Create New Wiki, Add PDFs, Ingest PDFs, Settings, Exit', async () => {
  // Render menu and assert the removed items are absent.
});
```

### Gate 11.4: Continuous Workflow After Init

```typescript
test('after init, TUI goes to Add PDFs then prompts for ingest', async () => {
  // Drive init flow and assert next screen is Add PDFs.
});
```

### Gate 11.5: README.md Exists and Has Required Sections

```typescript
test('README.md contains all required sections', () => {
  const readme = readFileSync('README.md', 'utf-8');
  expect(readme).toContain('# Paper Chase');
  expect(readme).toContain('The paper chase, automated.');
  expect(readme).toContain('## Introduction');
  expect(readme).toContain('## Functional Architecture');
  expect(readme).toContain('## Step-by-Step Architecture');
  expect(readme).toContain('## Detailed Technical Architecture');
  expect(readme).toContain('## Project Structure');
});
```

### Gate 11.6: Metrics Are Saved

```typescript
test('metrics are saved to .state/metrics.json', async () => {
  await ingest('test-wiki');
  expect(existsSync('wikis/test-wiki/.state/metrics.json')).toBe(true);
  const metrics = JSON.parse(readFileSync('wikis/test-wiki/.state/metrics.json', 'utf-8'));
  expect(metrics.chunksProcessed).toBeDefined();
  expect(metrics.totalCost).toBeDefined();
});
```

### Gate 11.7: Branding Sweep Is Complete

```typescript
test('no old branding remains in living docs or src', () => {
  // Scan: src/, tests/, templates/, scripts/, Project Vision/, Implementation Plan/,
  //   root AGENTS.md, README.md, package.json, wikis/AGENTS.md.
  // Exclusions: .state/**, wikis/<slug>/**, node_modules/**, package-lock.json,
  //   lines containing "formerly LLM Wiki CLI" (allowed historical note),
  //   and "Document ID:" lines (stable IDs keep their prefix).
  // Fail on /llm[-_ ]wiki[-_ ]cli/i and on forbidden forms /paperchase|PaperChase|PaperCase/.
  expect(offenders).toEqual([]);
});
```

### Gate 11.8: CLI Identifies as `chase`

```typescript
test('commander program is named chase', async () => {
  const { program } = await import('../src/cli');
  expect(program.name()).toBe('chase');
});
```

### Gate 11.9: Legacy Config Fallback Works

```typescript
test('settings load from legacy .llm-wiki-cli.json and save to .paper-chase.json', async () => {
  // In a temp workspace containing only .llm-wiki-cli.json:
  // loadSettings returns its values; saveSettings writes .paper-chase.json.
});
```

### Gate 11.10: Provider Switching Persists and Routes (v1.4.0)

```typescript
test('provider persists and routes; the OpenAI request shape is correct (mocked transport)', async () => {
  // 1. Save/load round-trips models.provider: 'openai' to .paper-chase.json;
  //    a legacy config without provider loads as 'anthropic'.
  // 2. Routing { provider: 'openai', default: 'gpt-5.6-luna',
  //    synthesis: 'gpt-5.6-terra', dox: 'gpt-5.6-sol', extractor: null }:
  //    extractor → luna (null → default), synthesis family → terra,
  //    dox-writer → sol, everything else → default.
  // 3. With provider openai and undici's request mocked: the call posts to
  //    https://api.openai.com/v1/chat/completions with
  //    `authorization: Bearer <OPENAI_API_KEY>`; the body carries
  //    `max_completion_tokens` (never `max_tokens`), never carries
  //    `temperature` even when options.temperature is set, and places the
  //    system prompt in a leading role:'system' message; the response text
  //    and token usage parse from choices[0].message.content /
  //    prompt_tokens / completion_tokens; cost logging uses the OpenAI
  //    price table; the llm-calls.json entry carries provider: 'openai'.
  // 4. Missing OPENAI_API_KEY with provider openai throws
  //    'OPENAI_API_KEY is not set. Export it in your environment or add it to a .env file in the project root.'
// 5. Switching the Default Provider in Settings re-seeds ONLY the Default
//    Model row (anthropic→openai: gpt-5.6-luna; back: haiku) while
//    explicitly configured per-step slots preserve their { provider, model }
//    pairs byte-for-byte.
// 6. Anthropic regression: the request body stays byte-identical to the
//    pre-extension shape (model / max_tokens / messages [/system] [/temperature]).
  // All LLM-free: the transport is mocked; no live calls.
});
```

### Gate 11.11: API Keys in Settings (v1.5.0)

```typescript
test('API keys persist, resolve stored → env → error, mask in the UI, and never touch logs (mocked transport, fake keys)', async () => {
  // 1. Round-trip: save/load persists `apiKeys` to .paper-chase.json; a
  //    config without the block loads as { anthropic: null, openai: null }.
  // 2. Resolution per provider (undici mocked, FAKE keys only): a stored key
  //    beats the env var (the auth header carries the stored fake key); the
  //    env var is used when nothing is stored; neither → the exact
  //    missing-key error '…is not set. Add it in Settings, export it in your
  //    environment, or add it to a .env file in the project root.'
  // 3. getApiKeyStatus: stored → 'stored' + last4; env-only → 'environment'
  //    + last4; neither → 'none' + null; the return never carries more than
  //    4 characters of key material.
  // 4. Screen masking: with a stored fake key the rendered output contains
  //    '••••' + last4 and NEVER the full key (including while the masked
  //    editor has typed input).
  // 5. Stage/clear flow (screen-driven): stage a key → Save → config has it;
  //    Escape cancels an edit (junk never staged); empty submit → Save →
  //    config null.
  // 6. Log hygiene: after a mocked call with a stored key, the llm-calls.json
  //    entry is exactly the pre-v1.5.0 field set (timestamp/callType/context/
  //    provider/model/inputTokens/outputTokens/cost) and contains no key
  //    material; the console cost line is clean too.
  // 7. Gate 11.1's keystroke sequence was updated ONLY because the two new
  //    rows (after the model rows, before [ Save ]) moved the [ Save ] focus
  //    index from 7 to 9 (same pattern as v1.4.0's update; the Down-counts
  //    to the model rows are unchanged).
  // All LLM-free: the transport is mocked; every key is a fake test string.
});
```

### Gate 11.12: Post-Ingest AGENTS.md Proposal Review Shortcut (v1.6.0)

```typescript
test('post-ingest review shortcut: hint only when proposed, p routes to the review, accept replaces, reject is a no-op', async () => {
  // All LLM-free: the ingest screen/App run with a stubbed ingestFn; the
  // wiki fixture is a temp workspace with AGENTS.md + a differing
  // .state/proposed-agents.md.
  // 1. Shortcut visibility: stub returns agentsUpdateProposed: true -> the
  //    success state shows 'AGENTS.md update proposed — press [P] to review
  //    the diff.'; stub returns false/absent -> no hint, and `p` does
  //    nothing (the review callback never fires).
  // 2. Routing (app-level): menu -> Ingest PDFs -> run the stubbed ingest
  //    -> `p` routes the app to the flow-only review screen for the
  //    ingested wiki ('Review AGENTS.md Updates', 'Wiki: <slug>').
  // 3. Diff: the rendered output contains line-diff markers/context from
  //    the proposal ('+ Proposed addition: ...', '[A] Accept', '[R] Reject').
  // 4. Accept: pressing `a` replaces wikis/<slug>/AGENTS.md with the
  //    proposal BYTE-IDENTICALLY; the proposal file stays on disk (accept
  //    semantics unchanged).
  // 5. Reject: pressing `r` leaves AGENTS.md AND .state/proposed-agents.md
  //    BYTE-IDENTICAL (the v1.6.0 no-op; the proposal is kept for later
  //    manual review) and shows 'Rejected proposed AGENTS.md updates for
  //    <wiki>. No changes made.'
  // 6. Menu regression: MENU_ITEMS is exactly
  //    [init, add-pdfs, ingest, settings, exit] — 'agents-review' absent;
  //    Gate 11.3 passes unmodified.
});
```

### Gate 11.16: Per-Step Provider + Model Routing (v1.9.0)

```typescript
test('mixed-provider tables route each call type to its own API; legacy strings migrate; slots survive a Default Provider switch', async () => {
  // 1. resolveSlotFromRouting / resolveProviderForCall with
  //    { provider: 'anthropic', default: 'claude-haiku-4-5-20251001',
  //      extractor: { qwen, qwen-plus }, synthesis: { anthropic, claude-sonnet-5 },
  //      dox: { openai, gpt-5.6-sol } }: extractor → qwen,
  //    synthesis family → anthropic, dox-writer → openai, everything else
  //    → the anthropic default slot; resolveModel mirrors the model strings.
  // 2. callLLM with that table (mocked transport, stored keys per provider):
  //    the extractor call posts to the DashScope URL with the qwen key, the
  //    synthesis call posts to the Anthropic URL with x-api-key, the
  //    dox-writer call posts to the OpenAI URL with the openai key —
  //    three calls, three providers, no cross-provider key reuse.
  // 3. Legacy migration: a .paper-chase.json with STRING slot values under
  //    provider qwen loads as { provider: 'qwen', model: '<string>' } pairs
  //    and re-saves in the composite shape; normalizeModelSlot accepts
  //    composite pairs, migrates strings, coerces unknown provider strings
  //    to 'anthropic', and rejects null/empty/malformed values.
  // 4. Screen-driven: switching the Default Provider re-seeds ONLY the
  //    Default Model row — a pre-set extractor slot survives the switch
  //    byte-for-byte; the non-TTY/rendered frame shows 'Default Provider',
  //    the 'Qwen · Qwen-Plus' provider prefix on off-default slots, and
  //    'Same as default' on null slots.
  // 5. Enter on a model row opens the custom-id editor scoped to that row's
  //    provider and persists { provider, model: <typed id> }.
});
```

---

## 4. User Acceptance Tests (UAT)

### UAT 11.1: Model routing works in Settings

1. `chase` → Settings
2. Change Synthesis Writer model to Sonnet
3. Save
4. Verify `.paper-chase.json` contains the model.

### UAT 11.2: Production menu only

1. `chase`
2. Verify menu shows only: Create New Wiki, Add PDFs, Ingest PDFs, Settings, Exit — in that order.
3. Verify "Run Tests", "Test Extractor", "View Validation Report", "Browse Entities", "Browse Topics", and "Browse DOX Contracts" are not present.

### UAT 11.3: Continuous workflow feels smooth

1. `chase` → Create New Wiki
2. After success, verify it goes directly to Add PDFs.
3. After adding PDFs, verify it asks to start ingesting.

### UAT 11.4: README is complete

Open `README.md` and verify it explains the app, flow, architecture, and project structure.

### UAT 11.5: Brand is Paper Chase end to end

1. `npm link`, then `chase --help` — description reads "The paper chase, automated…" and commands are listed under `chase`.
2. `chase` with no args — TUI header shows "Paper Chase v.1.0"; on first launch the splash shows "Paper Chase v.1.0 — the paper chase, automated."; no "LLM Wiki CLI" anywhere in the UI.
3. Open `README.md` — titled "Paper Chase", primary tagline present, all examples use `chase`.

### UAT 11.6: Provider switch works in Settings (v1.4.0/v1.9.0, LLM-free)

1. `chase` → Settings → cycle the **Default Provider** row to **OpenAI**.
2. Verify the **Default Model** row re-seeds immediately (shows GPT-5.6 Luna) and the per-call-type rows show "Same as default"; explicitly configured rows are preserved. Verify the recommendation labels switch to the OpenAI wording (GPT-5.6 Luna / Terra / Terra/Sol).
3. Save → `.paper-chase.json` shows `"provider": "openai"` with `gpt-5.6-*` ids on the Default Model row.
4. Switch the Default Provider row back to **Anthropic** → Save → the config shows `"provider": "anthropic"` with the Haiku default restored.
5. No API keys and no LLM calls are involved — this UAT touches only the Settings screen and the config file.

### UAT 11.7: API key entry works in Settings (v1.5.0, LLM-free with a fake key)

1. `chase` → Settings → focus the **Anthropic API Key** row (in the API Keys section below the model rows) → Enter.
2. Type a FAKE key (e.g. `sk-ant-test-0000-ab12`) — verify the editor masks every character; Enter to keep. The row re-renders as `Anthropic API Key: [configured ••••ab12]` — the full key is never shown.
3. Save → `.paper-chase.json` contains the key under `apiKeys.anthropic` (`apiKeys.openai` and `apiKeys.qwen` stay null).
4. Re-open Settings: the row still shows `configured ••••ab12`. Enter on the row, then Enter again on the EMPTY editor (clear) → Save → `apiKeys.anthropic` is null and the row shows the environment/not-set status again.
5. Escape mid-edit cancels without staging (the row keeps its previous status).
6. No LLM calls are involved. **Optional variant (user may skip):** repeat step 2 with a REAL key, run one tiny `chase ingest` on a wiki with a single small PDF, and confirm the call succeeds with no env var set; then clear the key via step 4. This variant spends real tokens (~$0.01) and is explicitly optional.
7. SECURITY reminder: `.paper-chase.json` is gitignored — never commit it; the UI and the logs only ever show the last 4 characters.

### UAT 11.8: Post-ingest AGENTS.md review shortcut (v1.6.0)

**Optional-cost warning:** the full live variant runs a REAL ingest (with *Propose AGENTS.md Updates* ON), which spends real money (a small wiki with one small PDF is typically ~$0.01–0.05). A dry fixture-based variant is NOT possible in the TUI (the hint only appears after a real `agentsUpdateProposed` result), so the UAT is framed around an optional real ingest — OR around accepting/rejecting a PREVIOUS proposal if `.state/proposed-agents.md` already exists from an earlier run. Use a throwaway wiki.

1. `chase` → Ingest PDFs → select a throwaway wiki → toggle *Propose AGENTS.md Updates* ON (A) → Enter. (Skip to step 3 if a previous `.state/proposed-agents.md` already exists for the wiki — but then the hint at step 2 only appears after SOME ingest that writes a proposal.)
2. When the ingest completes, verify the success state shows the extra line `AGENTS.md update proposed — press [P] to review the diff.` — and that this line is ABSENT after an ingest where no proposal was written.
3. Press `p` → the **Review AGENTS.md Updates** screen opens for the ingested wiki and shows the proposed changes with an inline diff (`+`/`-` lines, `[A] Accept  [R] Reject  [V] View Full Diff`). Press `V` for the scrollable full diff; Escape collapses back.
4. Press `a` (Accept) → `Accepted proposed AGENTS.md updates for <wiki>.` → verify `wikis/<slug>/AGENTS.md` now equals the proposal (and `.state/proposed-agents.md` still exists). Enter returns to the menu, where the ingest summary persists as the `Last:` line.
5. Repeat an ingest with the toggle ON (or restore a proposal fixture), press `p`, then press `r` (Reject) → `Rejected proposed AGENTS.md updates for <wiki>. No changes made.` → verify NOTHING changed: AGENTS.md is untouched and `.state/proposed-agents.md` is still on disk for later manual review.
6. Verify the main menu still shows exactly five items — the review screen has no menu entry and is reachable only via the post-ingest `p` shortcut.

---

## 5. Approval Checklist

Before moving to final sign-off, verify:

- [ ] All 13 technical gates pass (`npm test` is green) — 11.1–11.14 plus 11.16 (per-step provider + model routing, v1.9.0).
- [ ] All 8 UAT steps pass — 11.1–11.8.
- [ ] Branding sweep complete across living docs and `src/` (Gate 11.7 green); forbidden forms (`paperchase`, `PaperChase`, `PaperCase`) absent.
- [ ] `chase` bin works via `npm link`; `program.name()` is `chase`.
- [ ] Settings write `.paper-chase.json`; legacy `.llm-wiki-cli.json` still loads via fallback.
- [ ] GitHub repo renamed to `paper-chase`; canonical remote in root `AGENTS.md` updated.
- [ ] Internal vocabulary unchanged (wiki / source / entity / topic / citation / DOX); `.state/` records and generated `wikis/<slug>/` content untouched.
- [ ] Model routing settings persist and are applied — per-call `{ provider, model }` pairs for any built-in or custom provider; switching the Default Provider re-seeds only the Default Model row, preserving explicitly configured slots.
- [ ] API keys manageable in Settings (v1.5.0): masked entry (source + last 4 shown only), stored per workspace in `.paper-chase.json` (gitignored, never committed, never logged), resolution Settings-stored → env → `.env`, empty submit clears a stored key.
- [ ] Production menu is clean: only Create New Wiki, Add PDFs, Ingest PDFs, Settings, Exit; removed items absent.
- [ ] Post-ingest AGENTS.md review shortcut (v1.6.0): hint only when a proposal was written, `p` opens the flow-only review screen, Accept replaces AGENTS.md, Reject does nothing (proposal kept).
- [ ] Continuous workflow after init → add PDFs → ingest.
- [ ] README.md exists with all 5 required sections, Paper Chase title, and tagline.
- [ ] Metrics file written.
- [ ] No new LLM calls in this phase; budget $0.
- [ ] No code for Phase 8/9 (multi-PDF compounding, AGENTS.md updater) unless already implemented.

---

## 6. Integration Notes

### What Phase 11 Depends On (from Phases 0-10)
- All core pipeline components implemented.
- Settings persistence already exists (Phase 5) — renamed to `.paper-chase.json` in this phase with legacy fallback.
- TUI screens and menu already exist.

### What Phase 11 Produces
- Final brand shipped: **Paper Chase** — `chase` command, `paper-chase` package and repo, `.paper-chase.json` config.
- Production-ready TUI.
- Per-call model routing (multi-provider since v1.4.0: Anthropic default, OpenAI and Qwen optional; per-step provider/model pairs since v1.9.0).
- Complete README.md for new users and contributors.
- Performance metrics and logging.

### Contract with Final Acceptance
- All tests green.
- All UAT passed.
- Branding sweep gate green; GitHub repo renamed to `paper-chase`.
- README.md is accurate and complete.
- Compliance log shows no unresolved contradictions.
