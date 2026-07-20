# Phase 11: Polish and Productionization

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-011`
**Version:** 1.2.0
**Status:** Draft
**Date:** 2026-07-18
**Dependencies:** Phases 0-10
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $0 (no new LLM calls; productionization touches only)

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
- `src/tui/components/header.tsx` — header text `LLM Wiki CLI v2.0` → `Paper Chase v2.0`.
- `src/tui/settings.ts` — config file renamed to `.paper-chase.json`; the loader falls back to reading legacy `.llm-wiki-cli.json` when the new file is absent (read-only fallback); save always writes the new name.
- `src/tui/settings-screen.tsx`, `src/tui/ingest-screen.tsx` — update user-facing strings and comments that name the config file.
- `package-lock.json` — refresh the root `"name"` field (run `npm install` once after the `package.json` edit).

**Documentation sweep (living docs only):**

- Root `AGENTS.md` — project name line; canonical remote → `https://github.com/RuneL89/paper-chase`.
- `Project Vision/` — all seven vision docs + `AGENTS.md`; `01_PRODUCT_VISION_AND_ARCHITECTURE.md` gains a one-line "formerly LLM Wiki CLI (v2.0 development name)" note.
- `Implementation Plan/` — `IMPLEMENTATION_PLAN_MASTER_INDEX.md`, `MASTER_IMPLEMENTATION_PROMPT.md`, `START_PHASE_PROMPT.md`, `PHASE_00`–`PHASE_10` docs, `AGENTS.md`. (This document was updated as part of Phase 11 planning.)
- `src/AGENTS.md`, `tests/AGENTS.md`, `templates/AGENTS.md`, `wikis/AGENTS.md` — name references only; `templates/AGENTS.md` stays compliant with its wiki-constitution role.
- Excluded from the sweep: `.state/**`, `wikis/<slug>/**`, `node_modules/**`, and `package-lock.json` beyond the root name field.

**GitHub repo rename (manual step, not scriptable):**

1. Rename the repo to `paper-chase` in GitHub settings.
2. `git remote set-url origin https://github.com/RuneL89/paper-chase`.
3. Confirm the canonical-remote line in root `AGENTS.md` matches.

### 2.2 Per-Call LLM Model Routing

**Goal:** Let the user choose a different Anthropic model for each LLM call type (Extractor, Synthesis Writer, DOX Writer).

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
║  Default Model: [Haiku ▼]              ║
║  Extractor Model: [Same as default ▼] ║
║  Synthesis Writer Model: [Sonnet ▼]   ║
║  DOX Writer Model: [Opus ▼]            ║
╠══════════════════════════════════════╣
║  [ Save ]  [ Back ]                  ║
╚══════════════════════════════════════╝
```

**Inline recommendation labels:**

Each dropdown shows a short suggestion:

- **Extractor:** "Haiku — cheapest, good for structured JSON extraction"
- **Synthesis Writer:** "Sonnet — better prose, fewer preservation failures"
- **DOX Writer:** "Sonnet/Opus — strong contract writing for navigation"

**Config persistence:**

- Save to `.paper-chase.json` under `models`:
  ```json
  {
    "models": {
      "default": "claude-haiku-4-5-20251001",
      "extractor": null,
      "synthesis": "claude-sonnet-4-5-20251001",
      "dox": "claude-opus-4-20250918"
    }
  }
  ```
- `null` means "use default".
- `callLLM` reads the model from the config via `process.env.ANTHROPIC_MODEL` as fallback.

**Files to modify:**
- `src/tui/settings-screen.tsx` — add model routing section with dropdowns and labels
- `src/tui/settings.ts` — extend settings schema with `models`
- `src/llm/client.ts` — accept a model override per call or read from a global config setter
- `src/agents/extractor.ts` — use extractor model
- `src/agents/synthesis.ts` — use synthesis model
- `src/dox-writer.ts` (Phase 6) — use DOX model when implemented

### 2.3 TUI Cleanup

**Remove:**
- "Run Tests" screen and menu item
- "Test Extractor" screen and menu item
- Any development-only debug screens

**Keep:**
- Create New Wiki
- Add PDFs
- Ingest PDFs
- View Validation Report
- Browse Entities
- Browse Topics
- Browse DOX Contracts
- Settings
- Exit

**Menu item order (production):**
1. Create New Wiki
2. Add PDFs
3. Ingest PDFs
4. View Validation Report
5. Browse Entities
6. Browse Topics
7. Browse DOX Contracts
8. Settings
9. Exit

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
  Paper Chase v2.0 — the paper chase, automated.
  Create a wiki, add PDFs, then ingest.
  ```

**Continuous workflow:**
- After **Create New Wiki** succeeds, immediately go to **Add PDFs** (do not return to menu).
- After **Add PDFs** succeeds, ask "Start ingesting now? [Y/n]".
  - If yes, go to **Ingest PDFs** with the wiki pre-selected.
  - If no, return to menu.

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
  expect(config.models.synthesis).toBe('claude-sonnet-4-5-20251001');
});
```

### Gate 11.2: Model Routing Is Applied to LLM Calls

```typescript
test('extractor uses the configured extractor model', async () => {
  // Mock callLLM and verify it receives the extractor model when set.
});
```

### Gate 11.3: Test Screens Removed

```typescript
test('menu does not show Run Tests or Test Extractor', async () => {
  // Render menu and assert those items are absent.
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

---

## 4. User Acceptance Tests (UAT)

### UAT 11.1: Model routing works in Settings

1. `chase` → Settings
2. Change Synthesis Writer model to Sonnet
3. Save
4. Verify `.paper-chase.json` contains the model.

### UAT 11.2: Test screens are gone

1. `chase`
2. Verify menu does not show "Run Tests" or "Test Extractor".

### UAT 11.3: Continuous workflow feels smooth

1. `chase` → Create New Wiki
2. After success, verify it goes directly to Add PDFs.
3. After adding PDFs, verify it asks to start ingesting.

### UAT 11.4: README is complete

Open `README.md` and verify it explains the app, flow, architecture, and project structure.

### UAT 11.5: Brand is Paper Chase end to end

1. `npm link`, then `chase --help` — description reads "The paper chase, automated…" and commands are listed under `chase`.
2. `chase` with no args — TUI header shows "Paper Chase v2.0"; on first launch the splash shows "Paper Chase v2.0 — the paper chase, automated."; no "LLM Wiki CLI" anywhere in the UI.
3. Open `README.md` — titled "Paper Chase", primary tagline present, all examples use `chase`.

---

## 5. Approval Checklist

Before moving to final sign-off, verify:

- [ ] All 9 technical gates pass (`npm test` is green).
- [ ] All 5 UAT steps pass.
- [ ] Branding sweep complete across living docs and `src/` (Gate 11.7 green); forbidden forms (`paperchase`, `PaperChase`, `PaperCase`) absent.
- [ ] `chase` bin works via `npm link`; `program.name()` is `chase`.
- [ ] Settings write `.paper-chase.json`; legacy `.llm-wiki-cli.json` still loads via fallback.
- [ ] GitHub repo renamed to `paper-chase`; canonical remote in root `AGENTS.md` updated.
- [ ] Internal vocabulary unchanged (wiki / source / entity / topic / citation / DOX); `.state/` records and generated `wikis/<slug>/` content untouched.
- [ ] Model routing settings persist and are applied.
- [ ] Test screens removed from TUI.
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
- Per-call model routing.
- Complete README.md for new users and contributors.
- Performance metrics and logging.

### Contract with Final Acceptance
- All tests green.
- All UAT passed.
- Branding sweep gate green; GitHub repo renamed to `paper-chase`.
- README.md is accurate and complete.
- Compliance log shows no unresolved contradictions.
