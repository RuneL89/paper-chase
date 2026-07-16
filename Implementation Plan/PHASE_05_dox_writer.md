# Phase 5: DOX Writer (Layer 4)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-005`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4
**Estimated Time:** 3-4 hours
**LLM Token Budget:** $0

---

## 1. Objective

Build the DOX Writer: deterministic code that scans the completed wiki tree and writes `index.md` navigation contracts for every folder and the wiki root. This is the map that makes the wiki navigable. No LLM calls.

---

## 2. What to Build

### 2.1 DOX Writer

**File:** `src/dox-writer.ts`

```typescript
async function writeDoxContracts(wikiSlug: string): Promise<void>;
```

**Algorithm:**
1. Scan `wikis/<slug>/` recursively (excluding `.state/` and `raw/`).
2. Build a tree of folders and files.
3. For each folder that contains `.md` files or sub-folders:
   - Write `index.md` with: title, type, children list, description, navigation, statistics.
4. Write the wiki-level `index.md` at `wikis/<slug>/index.md`.

### 2.2 Folder-Level `index.md` Format

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

This folder contains people who hold executive positions (CEO, CFO, board members) in companies mentioned in the corpus.

## Pages

- [[John Smith]] — CEO of Acme Corp
- [[Jane Doe]] — CFO of Acme Corp

## Navigation

- Parent: [[People]]
- Sibling: [[Politicians]]
```

**Description generation:** The DOX Writer generates a generic description based on the folder name. For example, "people/executives" becomes "people who hold executive positions." It does not read the content of pages to generate descriptions (that would require LLM calls). The description is a simple template.

**Statistics:** Count of pages, sub-folders, and sources in the folder.

### 2.3 Wiki-Level `index.md` Format

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

[Description from AGENTS.md purpose section]

## Start Here

- [[Executives]] — Key people across all reports
- [[Financial]] — Financial themes and claims

## Statistics

- Sources: 1
- Document pages: 1
- Entity pages: 5
- Topic pages: 2
```

### 2.4 Integration into `ingest.ts`

After validation (Phase 4), call `writeDoxContracts(wikiSlug)`.

---

## 3. Technical Approval Gates

### Gate 5.1: Every Folder Has an `index.md`

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

### Gate 5.2: `index.md` Lists All Children

```typescript
test('index.md lists all pages in folder', async () => {
  await ingest('test-wiki');
  const index = readFileSync('wikis/test-wiki/entities/people/executives/index.md', 'utf-8');
  const parsed = matter(index);
  expect(parsed.data.children).toContain('john-smith.md');
});
```

**Pass Criteria:** `index.md` children list includes all pages in the folder.

### Gate 5.3: Wiki-Level `index.md` Links to Top Folders

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

### Gate 5.4: `index.md` Has Valid Frontmatter

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

### Gate 5.5: `index.md` Statistics Are Accurate

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

### Gate 5.6: Re-Running Ingest Regenerates Contracts

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

---

## 4. User Acceptance Tests (UAT)

### UAT 5.1: I can open the wiki index

```bash
npx tsx src/cli.ts ingest test-wiki
cat wikis/test-wiki/index.md
```

**Expected:** I see a markdown file with a title, description, and links to `entities/`, `topics/`, `documents/`, and `sources/`.

### UAT 5.2: I can navigate folders via index.md

```bash
cat wikis/test-wiki/entities/index.md
cat wikis/test-wiki/entities/people/executives/index.md
```

**Expected:** Each `index.md` lists the pages in that folder. I can follow `[[John Smith]]` to the entity page.

### UAT 5.3: I can open the wiki in Obsidian

Open `wikis/test-wiki/` as a vault in Obsidian.

**Expected:** I see the folder structure. I can click `index.md` and navigate to any folder. I can click `[[John Smith]]` and see the entity page.

---



## 5. TUI Updates for This Phase

### 5.1 `dox-browser.tsx`

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

### 5.2 Menu Updates

**File:** `src/tui/menu.tsx`

Add:
```typescript
{ label: 'Browse DOX Contracts', value: 'dox-browser' },
```

---

## 6. Approval Checklist

Before moving to Phase 6, verify:

- [ ] All 6 technical gates pass (`npm test` is green).
- [ ] All 3 UAT steps pass (manual verification).
- [ ] Every folder has an `index.md`.
- [ ] `index.md` files list all children.
- [ ] Wiki-level `index.md` links to all top folders.
- [ ] `index.md` has valid frontmatter.
- [ ] Statistics are accurate.
- [ ] **TUI DOX Browser shows the full contract hierarchy.**
- [ ] Total LLM cost for this phase: $0.
- [ ] No code exists for the Writer (synthesis).

---

## 7. Integration Notes
## 6. Integration Notes

### What Phase 5 Depends On (from Phase 4)
- Validated entity pages, topic pages, document pages, source pages.
- All links resolve.
- All citations are valid.

### What Phase 5 Produces (for Phase 6)
- Complete `index.md` hierarchy.
- A navigable wiki.

### Contract with Phase 6
Phase 6 expects:
- A complete wiki with all pages and contracts.
- The DOX Writer does not modify content pages.

Phase 6 adds synthesis to entity pages. It does not change the DOX structure.

### Isolation Testing
The DOX Writer can be tested in isolation:
```typescript
import { writeDoxContracts } from './src/dox-writer';

// Create fake folder structure manually
await writeDoxContracts('test');
```
