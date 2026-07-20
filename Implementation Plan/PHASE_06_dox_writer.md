# Phase 6: DOX Writer (Layer 6)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-006`
**Version:** 1.2.0
**Status:** Reopened (2026-07-21 amendment: per-wiki workspace segments)
**Date:** 2026-07-16
**Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5
**Estimated Time:** 4-6 hours
**LLM Token Budget:** Quality-first; no hard cap. Use the cheapest model that produces reliable prose, and log every call.

> **Amendment 2026-07-21 (user-ratified, compliance-log [2026-07-21 00:10]/[2026-07-21 00:20]):** the workspace index becomes **per-wiki owned**. The cross-wiki LLM prose is kept, but it is composed of per-wiki prose segments — each written by that wiki's own ingest, in that run's output language — and an ingest rewrites ONLY its own wiki's segments (its prose contribution and its `## Wikis` catalog line); every other wiki's segments are preserved byte-for-byte. Supersedes the whole-file regeneration model. New: Gates 6.12–6.14.
>
> **Amendment 2026-07-20 (user-ratified, compliance-log [2026-07-20 02:30]):** the workspace-level `wikis/index-of-indexes.md` — previously specced as deterministic in vision `03` §4.1 / `05` §3.3 but never implemented — is now a **DOX Writer output**, written the same way as every other index level: LLM prose with deterministic children/statistics re-imposition and deterministic fallback. New: §3.6, Gates 6.9–6.11, UAT 6.4.

---

## 1. Objective

Build the **DOX Writer**: an LLM-driven component that runs after the wiki's content pages are completely written and validated, and produces rich, human-readable `index.md` navigation contracts for every folder and the wiki root. The DOX Writer reads the actual pages, the wiki's `AGENTS.md` constitution, and the rolling memory, so the descriptions reflect the real content and follow the wiki's writing rules.

At the end of every ingest, the DOX Writer also runs a **workspace pass**: one LLM call that writes the ingested wiki's own contribution to `wikis/index-of-indexes.md`, the workspace-level contract listing every wiki. The workspace index is **the topmost parent in the same bottom-up chain** — folder indexes (deepest-first) → wiki root index → workspace index — and follows the same rule as every other parent: it synthesizes **only** the freshly-written root `index.md` contract of the triggering wiki, never the content pages inside any wiki. Since the 2026-07-21 amendment the file is **per-wiki owned**: each wiki's prose segment and catalog line are written by that wiki's own ingest in its own output language, and every other wiki's segments are preserved byte-for-byte.

This is the final layer of the ingest pipeline: **no DOX contract can be written until the wiki pages exist.**

---

## 2. Pipeline Placement

```
Extract PDFs → Extractor → Materializer → Synthesis Writer → Validate content pages → DOX Writer → Re-validate wiki
```

The DOX Writer runs **after** the Synthesis Writer (Phase 5) has finalized the content pages and after those pages have been validated. It then writes the `index.md` files, and a final validation pass checks that the new DOX pages themselves are valid (frontmatter, links, citations).

---

## 3. What to Build

### 3.1 DOX Writer

**File:** `src/dox-writer.ts`

```typescript
async function writeDoxContracts(wikiSlug: string, options?: { workspace?: string }): Promise<void>;
async function writeWorkspaceIndex(options?: { workspace?: string }): Promise<void>;
```

**Algorithm (per-wiki contracts):**
1. Scan `wikis/<slug>/` recursively (excluding `.state/` and `raw/`).
2. Build a tree of folders and content files.
3. For each folder that contains `.md` files or sub-folders, and for the wiki root:
   - Extract the accurate structure: children list, sub-folders, page titles, and statistics.
   - Read the full markdown content of every page in that folder.
   - Read the wiki's `AGENTS.md` and rolling memory.
   - Call the LLM once per folder with a structured prompt asking it to write a rich `index.md`.
   - Write the LLM-generated markdown to `index.md` inside the folder, ensuring the deterministic children list and statistics are preserved.
4. After all DOX pages are written, run a final `validateWiki()` pass to catch any broken links, invalid citations, or schema issues introduced by the LLM.

**Algorithm (workspace pass, amendment 2026-07-21 — per-wiki segments):**

The workspace index is composed of per-wiki segments and re-composed deterministically at the end of every ingest. The workspace pass's only content input is the **triggering wiki's** freshly-written root `index.md` (summary-of-summaries); it must NOT read the content pages inside any wiki, and it never rewrites another wiki's segments.

1. List every directory in `wikis/` that contains a root `index.md`.
2. Parse the existing `wikis/index-of-indexes.md` (when present) into per-wiki prose segments and per-wiki catalog lines, keyed by slug. First run after this amendment: seed missing segments from the existing catalog lines so nothing is lost.
3. Call the LLM once with the triggering wiki's root contract to write that wiki's description (in the run's output language), used for both its prose segment and its `## Wikis` catalog line.
4. Re-compose the file deterministically: per-wiki prose segments in slug order (triggering wiki fresh, every other preserved byte-for-byte, removed wikis dropped, missing segments get a deterministic placeholder), the `## Wikis` catalog with the same per-line ownership, the exact children list (`<slug>/index.md` per wiki), and the statistics (wiki count plus corpus totals) — the last two computed over ALL wikis every run.
5. Any LLM failure falls back to a deterministic segment for the **triggering wiki only**; other wikis' segments are untouched.
6. The workspace index sits inside `wikis/` so the whole `wikis/` folder can be opened as one Obsidian vault where its `[[<slug>/index|<Wiki Title>]]` links resolve natively. It is outside every single-wiki vault, so `validateWiki()` does not check it.
7. Each segment is written in the output language of the wiki it describes, so a mixed-language workspace index is normal and correct.

**Input to the LLM for each folder:**
- Folder path and list of child files and sub-folders.
- Full content of every page in that folder.
- The wiki's `AGENTS.md` (including writing rules).
- The rolling memory (`wikis/<slug>/.state/rolling-memory.json`).
- The exact children list and statistics that must appear in the output.

**Output from the LLM:**
- Complete markdown content for the folder's `index.md`, including YAML frontmatter and body.
- The body must contain: title, rich description, `## Pages` catalog, `## Navigation`, and `## Statistics`.
- The LLM must follow the writing rules from `AGENTS.md`: plain language, journalist test, no invented facts, `[[Page Title]]` wikilinks for related pages.

### 3.2 Prompt File

**File:** `prompts/dox-writer.prompt.txt`

The prompt is loaded by `src/dox-writer.ts` and sent to the LLM for each folder. It must:
- Explain the role of the DOX Writer (map, not territory).
- Provide the exact output format (frontmatter + body sections).
- Instruct the LLM to use the supplied children list and statistics verbatim.
- Instruct the LLM to follow the writing rules from the supplied `AGENTS.md`.
- Show an example of a rich folder-level `index.md` and a rich wiki-level `index.md`.

**File:** `prompts/dox-writer-workspace.prompt.txt` (amendment 2026-07-20; repurposed 2026-07-21)

The workspace-pass variant, loaded for the single per-ingest workspace call. Since the 2026-07-21 amendment it is a **per-wiki entry prompt**: its only content input is the triggering wiki's freshly-written root `index.md` contract, and its output is a short description of THAT wiki (1–3 sentences, no headings, no lists, no wikilinks — deterministic code adds the `[[<slug>/index|<Title>]]` link and stitches the segments). A language directive names the run's output language. Same rules: map-not-territory, no invented facts.

### 3.3 Folder-Level `index.md` Format

```markdown
---
title: "Executives"
type: index
wiki: test-wiki
updated: "2026-07-16T10:00:00Z"
children:
  - john-smith.md
  - jane-doe.md
  - index.md
---

# Executives

This folder contains people who hold executive positions (CEO, CFO, board members) in companies mentioned in the corpus. The pages were assembled from the source documents and include every mention, relationship, and claim about each person, with citations back to the original PDF pages.

## Pages

- [[John Smith]] — CEO of Acme Corp
- [[Jane Doe]] — CFO of Acme Corp

## Navigation

- Parent: [[People]]
- Sibling: [[Politicians]]

## Statistics

- Pages: 2
- Sub-folders: 0
- Sources: 0
```

**Description generation:** The LLM generates the description based on the actual content of the pages in the folder, the wiki's `AGENTS.md`, and the rolling memory. It does not use a generic folder-name template.

**Statistics:** Count of pages, sub-folders, and sources in the folder. These are supplied by deterministic code and must appear verbatim.

### 3.4 Wiki-Level `index.md` Format

```markdown
---
title: "Test Wiki"
type: index
wiki: test-wiki
updated: "2026-07-16T10:00:00Z"
children:
  - entities/index.md
  - topics/index.md
  - documents/index.md
  - sources/index.md
---

# Test Wiki

This wiki was generated from the ingested PDF corpus. It contains source documents, provenance records, named entities (people, companies, organizations), and cross-cutting topics. The entity and topic pages were assembled by the Materializer from the Extractor's structured output, and every factual claim is traceable to a page in the original PDFs.

## Start Here

- [[Executives]] — Key people across all reports
- [[Financial]] — Financial themes and claims

## Statistics

- Sources: 1
- Document pages: 1
- Entity pages: 5
- Topic pages: 2
```

### 3.5 Integration into `ingest.ts`

The ingest pipeline is:

1. Run `materialize()` to write structured entity and topic pages.
2. Optionally run the Synthesis Writer (Phase 5) if `--synthesis` is enabled.
3. Run `validateWiki()` on the content pages.
4. Log the first validation summary.
5. Call `writeDoxContracts(wikiSlug)` to generate the DOX pages.
6. Run `validateWiki()` again to validate the final wiki, including the new DOX pages.
7. Log the final validation summary.
8. Call `writeWorkspaceIndex()` to regenerate `wikis/index-of-indexes.md` from every wiki's root `index.md` (amendment 2026-07-20; runs in both extract and non-extract modes, and in deterministic mode when `doxLlm` is off).

### 3.6 Workspace-Level `index-of-indexes.md` Format

```markdown
---
title: "Index of Indexes"
type: index
aliases: ["Index of Indexes"]
updated: "2026-07-20T02:30:00Z"
children:
  - acme-reports/index.md
  - test-wiki/index.md
---

# Index of Indexes

This workspace holds two citation-backed wikis. Acme Reports covers 25 years of Acme Corp financial filings — executives, subsidiaries, auditors, and the financial and regulatory topics that connect them — while Test Wiki is a small fixture wiki built from the golden-master PDF used to verify the ingest pipeline.

## Wikis

- [[acme-reports/index|Acme Reports]] — 25 years of Acme Corp filings: entities, topics, documents, and sources
- [[test-wiki/index|Test Wiki]] — Pipeline fixture wiki from the golden-master PDF

## Statistics

- Wikis: 2
- Sources: 26
- Document pages: 126
- Entity pages: 52
- Topic pages: 14
```

**Frontmatter exceptions (vision `03` §4.2 / `05` §3.4):** no `wiki` field — the workspace index governs every wiki; `children` are `<slug>/index.md` paths relative to `wikis/`; the file is named `index-of-indexes.md`, not `index.md`.

**Deterministic ground truth:** the children list and statistics are computed by code and re-imposed over the LLM output, exactly as for per-folder indexes. Wiki links use the pipe form `[[<slug>/index|<Wiki Title>]]` so they resolve when `wikis/` is opened as an Obsidian vault.

---

## 4. Technical Approval Gates

### Gate 6.1: Every Folder Has an `index.md`

```typescript
test('every folder has an index.md', async () => {
  await ingest('test-wiki');
  const folders = globSync('wikis/test-wiki/**/', { ignore: 'wikis/test-wiki/.state/**' });
  for (const folder of folders) {
    expect(existsSync(`${folder}/index.md`)).toBe(true);
  }
});
```

**Pass Criteria:** Every folder has an `index.md`.

### Gate 6.2: `index.md` Lists All Children

```typescript
test('index.md lists all pages in folder', async () => {
  await ingest('test-wiki');
  const index = readFileSync('wikis/test-wiki/entities/people/executives/index.md', 'utf-8');
  const parsed = matter(index);
  expect(parsed.data.children).toContain('john-smith.md');
});
```

**Pass Criteria:** `index.md` children list includes all pages in the folder.

### Gate 6.3: Wiki-Level `index.md` Links to Top Folders

```typescript
test('wiki-level index.md links to all top folders', async () => {
  await ingest('test-wiki');
  const index = readFileSync('wikis/test-wiki/index.md', 'utf-8');
  expect(index).toContain('entities/');
  expect(index).toContain('topics/');
  expect(index).toContain('documents/');
  expect(index).toContain('sources/');
});
```

**Pass Criteria:** Wiki-level index links to all four top folders.

### Gate 6.4: `index.md` Has Valid Frontmatter

```typescript
test('index.md has valid YAML frontmatter', async () => {
  await ingest('test-wiki');
  const index = readFileSync('wikis/test-wiki/index.md', 'utf-8');
  const parsed = matter(index);
  expect(parsed.data.type).toBe('index');
  expect(parsed.data.title).toBeTruthy();
  expect(parsed.data.children).toBeInstanceOf(Array);
});
```

**Pass Criteria:** Valid YAML with type, title, children.

### Gate 6.5: `index.md` Statistics Are Accurate

```typescript
test('index.md statistics are accurate', async () => {
  await ingest('test-wiki');
  const index = readFileSync('wikis/test-wiki/index.md', 'utf-8');
  // Count actual pages
  const entityCount = globSync('wikis/test-wiki/entities/**/*.md').length;
  expect(index).toContain(`Entity pages: ${entityCount}`);
});
```

**Pass Criteria:** Statistics match actual file counts.

### Gate 6.6: Re-Running Ingest Regenerates Contracts

```typescript
test('re-ingest regenerates index.md files', async () => {
  await ingest('test-wiki');
  const firstIndex = readFileSync('wikis/test-wiki/index.md', 'utf-8');

  // Add new entity page manually
  writeFileSync('wikis/test-wiki/entities/people/executives/new-person.md', '---\n...');

  await ingest('test-wiki');
  const secondIndex = readFileSync('wikis/test-wiki/index.md', 'utf-8');
  expect(secondIndex).not.toBe(firstIndex);
});
```

**Pass Criteria:** `index.md` is regenerated and reflects new pages.

### Gate 6.7: DOX Pages Pass Final Validation

```typescript
test('DOX pages pass final validation', async () => {
  const result = await ingest('test-wiki');
  expect(result.finalValidation.links.broken).toHaveLength(0);
  expect(result.finalValidation.schema.invalid).toHaveLength(0);
});
```

**Pass Criteria:** After the DOX Writer runs, the final validation pass shows no broken links and no invalid schema.

### Gate 6.8: Descriptions Are Content-Based

```typescript
test('folder index description reflects actual content', async () => {
  await ingest('test-wiki');
  const index = readFileSync('wikis/test-wiki/entities/people/executives/index.md', 'utf-8');
  expect(index.toLowerCase()).toContain('executive');
  expect(index).not.toContain('This folder contains pages and sub-folders related to executives.');
});
```

**Pass Criteria:** Folder descriptions are richer than the generic template and reflect the folder's actual content.

### Gate 6.9: Workspace Index Exists and Lists All Wikis (amendment 2026-07-20)

```typescript
test('workspace index-of-indexes.md exists and lists all wikis', async () => {
  await ingest('test-wiki');
  const index = readFileSync('wikis/index-of-indexes.md', 'utf-8');
  const parsed = matter(index);
  expect(parsed.data.type).toBe('index');
  expect(parsed.data.children).toContain('test-wiki/index.md');
  expect(index).toContain('[[test-wiki/index|');
});
```

**Pass Criteria:** `wikis/index-of-indexes.md` exists with valid index frontmatter, a children entry per ingested wiki, and a pipe-form link to each wiki root.

### Gate 6.10: Workspace Index Statistics Are Accurate (amendment 2026-07-20)

```typescript
test('workspace index statistics are accurate', async () => {
  await ingest('test-wiki');
  const index = readFileSync('wikis/index-of-indexes.md', 'utf-8');
  expect(index).toContain('Wikis: 1');
  const entityCount = globSync('wikis/test-wiki/entities/**/*.md')
    .filter((f) => !f.endsWith('index.md')).length;
  expect(index).toContain(`Entity pages: ${entityCount}`);
});
```

**Pass Criteria:** The `## Statistics` section reports the true wiki count and corpus totals.

### Gate 6.11: Workspace Index Falls Back Deterministically (amendment 2026-07-20)

```typescript
test('workspace index falls back to the deterministic contract on LLM failure', async () => {
  await ingest('test-wiki', { doxLlm: true, writeWorkspaceIndexFn: async () => { throw new Error('no key'); } });
  const index = readFileSync('wikis/index-of-indexes.md', 'utf-8');
  expect(index).toContain('## Wikis');
  expect(index).toContain('Wikis: 1');
});
```

**Pass Criteria:** An LLM failure (or unparseable output) still produces a valid deterministic workspace index; with an injected LLM stub, the prose is used while children/statistics remain the deterministic values.

---

### Gate 6.12: Workspace Pass Rewrites Only the Triggering Wiki's Segments (amendment 2026-07-21)

```typescript
test('ingest of wiki B rewrites only wiki B segments; wiki A segments are byte-identical', async () => {
  // Ingest wiki A (English stub entry), snapshot its prose segment and catalog
  // line, then ingest wiki B (Danish stub entry). Wiki A's segment and line
  // are byte-identical afterwards; wiki B's are present and Danish.
});
```

**Pass Criteria:** Per-wiki ownership holds — the non-triggering wiki's prose segment and catalog line are preserved byte-for-byte across another wiki's ingest.

### Gate 6.13: Mixed-Language Workspace Index Survives (amendment 2026-07-21)

```typescript
test('a Danish entry survives an English wiki ingest', async () => {
  // Ingest a Danish-output wiki (stub returns Danish description), then an
  // English-output wiki (stub returns English description). The final file
  // contains the Danish text for the Danish wiki AND the English text for
  // the English wiki; children and statistics cover both.
});
```

**Pass Criteria:** Each segment keeps the output language of the wiki it describes; a later ingest in a different language does not translate existing segments.

### Gate 6.14: Workspace Fallback Is Per-Wiki and Removals Drop Segments (amendment 2026-07-21)

```typescript
test('LLM failure writes a deterministic segment for the triggering wiki only; a removed wiki loses its segments', async () => {
  // With writeWorkspaceIndexFn throwing: the workspace index is valid, the
  // triggering wiki's segment is the deterministic placeholder, and a
  // previously-present wiki's segment is preserved. Then delete that wiki's
  // folder, re-run: its segment and children entry are gone, statistics
  // recomputed.
});
```

**Pass Criteria:** Fallback is scoped to the triggering wiki; recomposition reflects the current directory scan.

---

## 5. User Acceptance Tests (UAT)

### UAT 6.1: I can open the wiki index

```bash
npx tsx src/cli.ts ingest test-wiki
cat wikis/test-wiki/index.md
```

**Expected:** I see a markdown file with a rich title, description, and links to `entities/`, `topics/`, `documents/`, and `sources/`.

### UAT 6.2: I can navigate folders via index.md

```bash
cat wikis/test-wiki/entities/index.md
cat wikis/test-wiki/entities/people/executives/index.md
```

**Expected:** Each `index.md` lists the pages in that folder with rich descriptions. I can follow `[[John Smith]]` to the entity page.

### UAT 6.3: I can open the wiki in Obsidian

Open `wikis/test-wiki/` as a vault in Obsidian.

**Expected:** I see the folder structure. I can click `index.md` and navigate to any folder. I can click `[[John Smith]]` and see the entity page.

### UAT 6.4: I can open the whole workspace in Obsidian (amendment 2026-07-20)

Open `wikis/` as a vault in Obsidian and click `index-of-indexes.md`.

**Expected:** I see a rich workspace contract listing every wiki with a content-based description. I can click `[[test-wiki/index|Test Wiki]]` and land on that wiki's root index, and navigate onward into its folders from there.

---

## 6. TUI Updates for This Phase

### 6.1 `dox-browser.tsx`

**File:** `src/tui/dox-browser.tsx`

A screen for navigating the DOX contract hierarchy:

```
╔══════════════════════════════════════╗
║  DOX Contracts                       ║
╠══════════════════════════════════════╣
║  test-wiki/                            ║
║  > index.md                            ║
║  > entities/index.md                   ║
║    > people/index.md                   ║
║      > executives/index.md             ║
║  > topics/index.md                     ║
║  > documents/index.md                  ║
║  > sources/index.md                    ║
╠══════════════════════════════════════╣
║  [ Open Selected ]  [ Back ]         ║
╚══════════════════════════════════════╝
```

**Behavior:**
- Tree navigation through the `index.md` hierarchy.
- Selecting an `index.md` shows its content: title, description, children list, statistics.
- Selecting a content page (e.g., `john-smith.md`) opens the entity page viewer.

### 6.2 Menu Updates

**File:** `src/tui/menu.tsx`

Add:
```typescript
{ label: 'Browse DOX Contracts', value: 'dox-browser' },
```

---

## 7. Approval Checklist

Before moving to Phase 7, verify:

- [ ] All 11 technical gates pass (`npm test` is green).
- [ ] All 4 UAT steps pass (manual verification).
- [ ] Every folder has an `index.md`.
- [ ] `index.md` files list all children.
- [ ] Wiki-level `index.md` links to all top folders.
- [ ] `index.md` has valid frontmatter.
- [ ] Statistics are accurate.
- [ ] Final validation pass after the DOX Writer shows no broken links or schema errors.
- [ ] Folder descriptions are content-based, not generic templates.
- [ ] **TUI DOX Browser shows the full contract hierarchy.**
- [ ] LLM cost is logged per call and per phase in `.state/phase-6-status.json`.
- [ ] No code exists for multilingual ingestion, multi-PDF compounding, or the AGENTS.md updater.

### Amendment 2026-07-20 (workspace index)

- [ ] Gates 6.9–6.11 pass (`npm test` is green).
- [ ] UAT 6.4 passes (manual verification).
- [ ] `wikis/index-of-indexes.md` is regenerated at the end of every ingest.
- [ ] Workspace index children list and statistics are deterministic ground truth, re-imposed over LLM output.
- [ ] LLM failure on the workspace pass falls back to a valid deterministic contract.
- [ ] TUI DOX Browser shows the workspace level above the per-wiki contracts.

### Amendment 2026-07-21 (per-wiki workspace segments)

- [ ] Gates 6.12–6.14 pass (`npm test` is green); gates 6.9–6.11 reworked for segment semantics stay green.
- [ ] An ingest rewrites ONLY the triggering wiki's prose segment and catalog line; every other wiki's segments are preserved byte-for-byte.
- [ ] Each segment is written in the output language of the wiki it describes — a mixed-language workspace index survives subsequent ingests in any language.
- [ ] LLM failure on the workspace pass falls back to a deterministic description for the triggering wiki only; removed wikis lose their segments.
- [ ] The workspace entry prompt's only content input is the triggering wiki's root contract.

---

## 8. Integration Notes

### What Phase 6 Depends On (from Phase 5)
- Finalized entity pages, topic pages, document pages, source pages.
- All links resolve on content pages.
- All citations are valid on content pages.
- Synthesis (if enabled) has completed and passed preservation checks.
- Rolling memory is up to date after materialization.

### What Phase 6 Produces (for Phase 7)
- Complete `index.md` hierarchy with rich descriptions.
- A navigable wiki.
- Final validation pass confirming the DOX pages are healthy.
- The prompt-file + `{single-brace}` placeholder pattern and the test-only LLM injections (`extractChunkFn`, `synthesize*Fn`, `writeDoxIndexFn`).

### Contract with Phase 7
Phase 7 expects:
- A complete wiki with all pages and contracts.
- The DOX Writer does not modify content pages.

Phase 7 adds multilingual ingestion: per-run input language and per-wiki output language, language directives in every prompt, and transliterated slugs (vision `04` §9).

### Isolation Testing
The DOX Writer can be tested in isolation:
```typescript
import { writeDoxContracts } from './src/dox-writer';

// Create fake folder structure manually
await writeDoxContracts('test');
```

Use an injected `callLLM` or `writeDoxIndexFn` in tests to avoid live LLM calls for the deterministic gates.

---

## 9. LLM Cost and Model Guidance

- Use the project's default Anthropic model (configurable via `ANTHROPIC_MODEL`).
- The DOX Writer makes one LLM call per folder plus one for the wiki root, plus one for the workspace pass (`index-of-indexes.md`) at the end of every ingest.
- For the test-wiki fixture (one PDF, ~5-10 folders), expect a small number of calls.
- Log every call: `LLM Call | Tokens: i/o | Cost: $x` via the existing `callLLM` client.
- Store total Phase 6 LLM cost in `.state/phase-6-status.json`.
