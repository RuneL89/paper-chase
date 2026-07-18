# Phase 9: Polish and Productionization

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-009`
**Version:** 1.1.0
**Status:** Draft
**Date:** 2026-07-18
**Dependencies:** Phases 0-8
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $0 (no new LLM calls; productionization touches only)

---

## 1. Objective

Polish the CLI/TUI for production use: per-call LLM model routing with suggestion labels, TUI cleanup, smoother workflow, and a complete README.md that documents the app accurately after all implementation is done.

---

## 2. What to Build

### 2.1 Per-Call LLM Model Routing

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

- Save to `.llm-wiki-cli.json` under `models`:
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

### 2.2 TUI Cleanup

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

### 2.3 Smoother Workflow

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
  LLM Wiki CLI v2.0 — turn PDFs into citation-backed wikis.
  Create a wiki, add PDFs, then ingest.
  ```

**Continuous workflow:**
- After **Create New Wiki** succeeds, immediately go to **Add PDFs** (do not return to menu).
- After **Add PDFs** succeeds, ask "Start ingesting now? [Y/n]".
  - If yes, go to **Ingest PDFs** with the wiki pre-selected.
  - If no, return to menu.

### 2.4 Full README.md

**File:** `README.md` at the project root.

**Required structure:**

1. **Introduction** — elevator pitch of what the app is (one paragraph).
2. **Functional Architecture** — end-user friendly description of how the app works from the user's perspective (init → add PDFs → ingest → browse).
3. **Step-by-Step Architecture / Flow** — mid-level developer explanation of the agent flow, orchestration, rejection loops, and rejection criteria.
4. **Detailed Technical Architecture** — senior developer explanation of the entire app, sufficient to understand the codebase without reading other files.
5. **Project Structure** — description of all folders and files (`src/`, `tests/`, `wikis/`, `prompts/`, `.state/`, `templates/`, `test-pdfs/`, `scripts/`).

**Content rules:**
- Describe **implemented behavior**, not planned behavior.
- Include the synthesis fallback chain (strict → permissive → structured template).
- Include the per-call model routing configuration.
- Include the `.state/` log files (`llm-calls.json`, `synthesis-report.json`, `validation-report.json`, `conflicts.json`).
- Include test commands and expected outputs.

### 2.5 Performance Metrics and Logging

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

### 2.6 E2E Test Suite

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

### Gate 9.1: Model Routing Settings Persist

```typescript
test('settings screen saves model routing to .llm-wiki-cli.json', async () => {
  // Render settings screen, select models, save, read config file.
  expect(config.models.extractor).toBe('claude-haiku-4-5-20251001');
  expect(config.models.synthesis).toBe('claude-sonnet-4-5-20251001');
});
```

### Gate 9.2: Model Routing Is Applied to LLM Calls

```typescript
test('extractor uses the configured extractor model', async () => {
  // Mock callLLM and verify it receives the extractor model when set.
});
```

### Gate 9.3: Test Screens Removed

```typescript
test('menu does not show Run Tests or Test Extractor', async () => {
  // Render menu and assert those items are absent.
});
```

### Gate 9.4: Continuous Workflow After Init

```typescript
test('after init, TUI goes to Add PDFs then prompts for ingest', async () => {
  // Drive init flow and assert next screen is Add PDFs.
});
```

### Gate 9.5: README.md Exists and Has Required Sections

```typescript
test('README.md contains all required sections', () => {
  const readme = readFileSync('README.md', 'utf-8');
  expect(readme).toContain('## Introduction');
  expect(readme).toContain('## Functional Architecture');
  expect(readme).toContain('## Step-by-Step Architecture');
  expect(readme).toContain('## Detailed Technical Architecture');
  expect(readme).toContain('## Project Structure');
});
```

### Gate 9.6: Metrics Are Saved

```typescript
test('metrics are saved to .state/metrics.json', async () => {
  await ingest('test-wiki');
  expect(existsSync('wikis/test-wiki/.state/metrics.json')).toBe(true);
  const metrics = JSON.parse(readFileSync('wikis/test-wiki/.state/metrics.json', 'utf-8'));
  expect(metrics.chunksProcessed).toBeDefined();
  expect(metrics.totalCost).toBeDefined();
});
```

---

## 4. User Acceptance Tests (UAT)

### UAT 9.1: Model routing works in Settings

1. `npx tsx src/cli.ts` → Settings
2. Change Synthesis Writer model to Sonnet
3. Save
4. Verify `.llm-wiki-cli.json` contains the model.

### UAT 9.2: Test screens are gone

1. `npx tsx src/cli.ts`
2. Verify menu does not show "Run Tests" or "Test Extractor".

### UAT 9.3: Continuous workflow feels smooth

1. `npx tsx src/cli.ts` → Create New Wiki
2. After success, verify it goes directly to Add PDFs.
3. After adding PDFs, verify it asks to start ingesting.

### UAT 9.4: README is complete

Open `README.md` and verify it explains the app, flow, architecture, and project structure.

---

## 5. Approval Checklist

Before moving to final sign-off, verify:

- [ ] All 6 technical gates pass (`npm test` is green).
- [ ] All 4 UAT steps pass.
- [ ] Model routing settings persist and are applied.
- [ ] Test screens removed from TUI.
- [ ] Continuous workflow after init → add PDFs → ingest.
- [ ] README.md exists with all 5 required sections.
- [ ] Metrics file written.
- [ ] No new LLM calls in this phase; budget $0.
- [ ] No code for Phase 7/8 (multi-PDF compounding, AGENTS.md updater) unless already implemented.

---

## 6. Integration Notes

### What Phase 9 Depends On (from Phases 0-8)
- All core pipeline components implemented.
- `.llm-wiki-cli.json` settings persistence already exists (Phase 5).
- TUI screens and menu already exist.

### What Phase 9 Produces
- Production-ready TUI.
- Per-call model routing.
- Complete README.md for new users and contributors.
- Performance metrics and logging.

### Contract with Final Acceptance
- All tests green.
- All UAT passed.
- README.md is accurate and complete.
- Compliance log shows no unresolved contradictions.
