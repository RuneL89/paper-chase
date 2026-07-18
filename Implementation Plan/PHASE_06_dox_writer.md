# Phase 6: DOX Writer (Layer 6)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-006`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5
**Estimated Time:** 4-6 hours
**LLM Token Budget:** Quality-first; no hard cap. Use the cheapest model that produces reliable prose, and log every call.

---

## 1. Objective

Build the **DOX Writer**: an LLM-driven component that runs after the wiki's content pages are completely written and validated, and produces rich, human-readable `index.md` navigation contracts for every folder and the wiki root. The DOX Writer reads the actual pages, the wiki's `AGENTS.md` constitution, and the rolling memory, so the descriptions reflect the real content and follow the wiki's writing rules.

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
```

**Algorithm:**
1. Scan `wikis/<slug>/` recursively (excluding `.state/` and `raw/`).
2. Build a tree of folders and content files.
3. For each folder that contains `.md` files or sub-folders, and for the wiki root:
   - Extract the accurate structure: children list, sub-folders, page titles, and statistics.
   - Read the full markdown content of every page in that folder.
   - Read the wiki's `AGENTS.md` and rolling memory.
   - Call the LLM once per folder with a structured prompt asking it to write a rich `index.md`.
   - Write the LLM-generated markdown to `index.md` inside the folder, ensuring the deterministic children list and statistics are preserved.
4. After all DOX pages are written, run a final `validateWiki()` pass to catch any broken links, invalid citations, or schema issues introduced by the LLM.

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

- [ ] All 8 technical gates pass (`npm test` is green).
- [ ] All 3 UAT steps pass (manual verification).
- [ ] Every folder has an `index.md`.
- [ ] `index.md` files list all children.
- [ ] Wiki-level `index.md` links to all top folders.
- [ ] `index.md` has valid frontmatter.
- [ ] Statistics are accurate.
- [ ] Final validation pass after the DOX Writer shows no broken links or schema errors.
- [ ] Folder descriptions are content-based, not generic templates.
- [ ] **TUI DOX Browser shows the full contract hierarchy.**
- [ ] LLM cost is logged per call and per phase in `.state/phase-6-status.json`.
- [ ] No code exists for multi-PDF compounding or the AGENTS.md updater.

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

### Contract with Phase 7
Phase 7 expects:
- A complete wiki with all pages and contracts.
- The DOX Writer does not modify content pages.

Phase 7 adds multi-PDF compounding and rolling memory improvements.

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
- The DOX Writer makes one LLM call per folder plus one for the wiki root.
- For the test-wiki fixture (one PDF, ~5-10 folders), expect a small number of calls.
- Log every call: `LLM Call | Tokens: i/o | Cost: $x` via the existing `callLLM` client.
- Store total Phase 6 LLM cost in `.state/phase-6-status.json`.
