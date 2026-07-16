# Phase 3: Materializer (Layer 3)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-003`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0, Phase 1, Phase 2
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $0

---

## 1. Objective

Build the Materializer: deterministic code that reads all Extractor JSON files, creates folders, aggregates entity data across chunks, and writes entity pages and topic pages to disk. No LLM calls. This is the bridge between extraction and the wiki.

---

## 2. What to Build

### 2.1 Entity Page Writer

**File:** `src/pages/entity-page.ts`

```typescript
interface EntityPageData {
  title: string;
  slug: string;
  folder: string;
  type: string;
  mentions: Array<{ page: number; context: string; source: string }>;
  relationships: Array<{ subject: string; predicate: string; object: string; evidence: string; page: number; source: string }>;
  claims: Array<{ text: string; type: string; entities: string[]; page: number; source: string }>;
}

function writeEntityPage(data: EntityPageData): string;
```

**Output format (structured template, no synthesis yet):**
```markdown
---
title: "John Smith"
type: entity
wiki: test-wiki
updated: "2026-07-16T10:00:00Z"
sources:
  - file: "wikis/test-wiki/raw/golden-master.pdf"
    pages: "1-3"
tags: ["person", "executive"]
---

## Mentions

- Page 1: "John Smith, CEO of Acme Corp" [^src1]
- Page 3: "John Smith attended the board meeting" [^src2]

## Relationships

- [[Acme Corp]] — is CEO of [^src1]

## Claims

- Revenue was $42.5M in Q3 2024 [^src3]

## Sources

[^src1]: golden-master.pdf, pages 1-3
[^src2]: golden-master.pdf, pages 1-3
[^src3]: golden-master.pdf, pages 1-3
```

**Citation numbering:** `src1`, `src2`, etc. Sequential within the page. Each mention/relationship/claim gets a citation. The `sources` frontmatter lists all source files referenced on the page.

### 2.2 Topic Page Writer

**File:** `src/pages/topic-page.ts`

```typescript
interface TopicPageData {
  title: string;
  slug: string;
  folder: string;
  claims: Array<{ text: string; type: string; entities: string[]; page: number; source: string }>;
}

function writeTopicPage(data: TopicPageData): string;
```

**Topic discovery:** Group claims by `type`. For each unique claim type, create a topic page. Example: all `financial` claims go to `topics/financial/...`.

**Topic slug:** Derived from claim type + a descriptive name. If the LLM did not provide a topic name, use the claim type as the slug (e.g., `topics/financial/financial.md` for the first pass; refined in Phase 5).

### 2.3 Materializer

**File:** `src/materializer.ts`

```typescript
async function materialize(wikiSlug: string): Promise<void>;
```

**Algorithm:**
1. Read all `.state/extracted/*.json` files.
2. Build an entity map: `slug -> { name, type, folder, mentions[], relationships[], claims[] }`.
3. For each entity in the map:
   - Create the folder path (including intermediate folders).
   - Write the entity page to `entities/<folder>/<slug>.md`.
4. Build a topic map: `topicSlug -> { title, claims[] }`.
5. For each topic in the map:
   - Create the folder path.
   - Write the topic page to `topics/<folder>/<slug>.md`.
6. Update `.state/rolling-memory.json` with new entities, folders, and sources.

**Folder creation:** Use `fs.mkdirSync(path, { recursive: true })`.

### 2.4 Rolling Memory

**File:** `src/state/rolling-memory.ts`

```typescript
interface RollingMemory {
  entities: Array<{ slug: string; folder: string; mentionCount: number }>;
  topics: string[];
  sources: string[];
  folderStructure: string[];
}

async function loadRollingMemory(wikiSlug: string): Promise<RollingMemory>;
async function saveRollingMemory(wikiSlug: string, memory: RollingMemory): Promise<void>;
```

**Default (first run):**
```json
{
  "entities": [],
  "topics": [],
  "sources": [],
  "folderStructure": []
}
```

### 2.5 Update `ingest.ts`

After all chunks are extracted, call `materialize(wikiSlug)`.

---

## 3. Technical Approval Gates

### Gate 3.1: Materializer Creates Entity Pages

```typescript
test('materializer creates entity pages for all extracted entities', async () => {
  await ingest('test-wiki');
  const extracted = JSON.parse(readFileSync('wikis/test-wiki/.state/extracted/golden-master-part-001.json', 'utf-8'));
  for (const e of extracted.entities) {
    const path = `wikis/test-wiki/${e.folder}/${e.slug}.md`;
    expect(existsSync(path)).toBe(true);
  }
});
```

**Pass Criteria:** Every entity from the JSON has a corresponding markdown file.

### Gate 3.2: Entity Pages Have Valid Frontmatter

```typescript
test('entity page has valid YAML frontmatter', async () => {
  await ingest('test-wiki');
  const page = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');
  const parsed = matter(page);
  expect(parsed.data.type).toBe('entity');
  expect(parsed.data.title).toBe('John Smith');
  expect(parsed.data.sources).toBeInstanceOf(Array);
});
```

**Pass Criteria:** Valid YAML with correct type, title, and sources.

### Gate 3.3: Entity Pages Contain All Mentions

```typescript
test('entity page contains all mentions from extraction', async () => {
  await ingest('test-wiki');
  const page = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');
  const extracted = JSON.parse(readFileSync('wikis/test-wiki/.state/extracted/golden-master-part-001.json', 'utf-8'));
  const john = extracted.entities.find(e => e.slug === 'john-smith');
  for (const m of john.mentions) {
    expect(page).toContain(m.context);
  }
});
```

**Pass Criteria:** Every mention context from the JSON appears in the markdown.

### Gate 3.4: Entity Pages Have Citations

```typescript
test('entity page has citations for every mention', async () => {
  await ingest('test-wiki');
  const page = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');
  const srcMatches = page.match(/\[\^src\d+\]/g);
  expect(srcMatches.length).toBeGreaterThanOrEqual(1);
});
```

**Pass Criteria:** At least one `[^srcN]` citation exists.

### Gate 3.5: Folders Are Created Dynamically

```typescript
test('materializer creates folders dynamically', async () => {
  await ingest('test-wiki');
  expect(existsSync('wikis/test-wiki/entities/people/executives')).toBe(true);
});
```

**Pass Criteria:** The folder from the Extractor's JSON exists on disk.

### Gate 3.6: Topic Pages Are Created

```typescript
test('materializer creates topic pages', async () => {
  await ingest('test-wiki');
  const files = readdirSync('wikis/test-wiki/topics', { recursive: true });
  expect(files.length).toBeGreaterThan(0);
});
```

**Pass Criteria:** At least one topic page exists.

### Gate 3.7: Rolling Memory is Updated

```typescript
test('rolling memory contains all entities', async () => {
  await ingest('test-wiki');
  const memory = JSON.parse(readFileSync('wikis/test-wiki/.state/rolling-memory.json', 'utf-8'));
  expect(memory.entities).toBeInstanceOf(Array);
  expect(memory.entities.length).toBeGreaterThan(0);
  expect(memory.folderStructure).toBeInstanceOf(Array);
});
```

**Pass Criteria:** Rolling memory exists and contains entities and folders.

### Gate 3.8: Re-Running Ingest Updates Existing Pages

```typescript
test('re-ingesting updates existing entity pages', async () => {
  await ingest('test-wiki');
  const firstPage = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');

  // Add a second PDF to raw/
  await ingest('test-wiki');

  const secondPage = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');
  expect(secondPage).not.toBe(firstPage); // page was updated
});
```

**Pass Criteria:** Entity page is rewritten with new data.

---

## 4. User Acceptance Tests (UAT)

### UAT 3.1: I can see entity pages after ingestion

```bash
npx tsx src/cli.ts ingest test-wiki
ls wikis/test-wiki/entities/
```

**Expected:** I see sub-folders like `people/`, `companies/`. Inside `people/executives/`, I see `john-smith.md`.

### UAT 3.2: I can open an entity page

Open `wikis/test-wiki/entities/people/executives/john-smith.md` in a text editor.

**Expected:** I see YAML frontmatter with `type: entity`. I see a "Mentions" section with the exact sentences from the PDF. I see `[[Acme Corp]]` wikilinks. I see `[^src1]` citations.

### UAT 3.3: I can navigate the folder structure

```bash
find wikis/test-wiki/entities -type f -name "*.md"
```

**Expected:** I see a tree of entity pages organized into sub-folders. The structure matches the folders assigned by the Extractor.

### UAT 3.4: I can see topic pages

```bash
ls wikis/test-wiki/topics/
```

**Expected:** I see sub-folders or files for claim types like `financial/`.

### UAT 3.5: Rolling memory reflects the wiki state

```bash
cat wikis/test-wiki/.state/rolling-memory.json | jq .
```

**Expected:** I see a JSON list of all entities, their folders, and mention counts. I see the folder structure.

---



## 5. TUI Updates for This Phase

### 5.1 `entity-browser.tsx`

**File:** `src/tui/entity-browser.tsx`

A screen for browsing entity pages by folder:

```
╔══════════════════════════════════════╗
║  Browse Entities                     ║
╠══════════════════════════════════════╣
║  entities/                           ║
║  > people/                           ║
║    companies/                        ║
║    organizations/                    ║
╠══════════════════════════════════════╣
║  people/executives/                  ║
║  > john-smith.md                     ║
║    jane-doe.md                       ║
╠══════════════════════════════════════╣
║  [ Open Selected ]  [ Back ]         ║
╚══════════════════════════════════════╝
```

**Behavior:**
- Tree navigation: arrow keys move up/down, right expands folder, left collapses.
- Pressing Enter on a file opens a scrollable viewer showing the markdown content.
- Pressing Escape goes back to the parent level or menu.

### 5.2 `topic-browser.tsx`

**File:** `src/tui/topic-browser.tsx`

Same pattern as entity browser but for `topics/`.

### 5.3 Menu Updates

**File:** `src/tui/menu.tsx`

Add:
```typescript
{ label: 'Browse Entities', value: 'entity-browser' },
{ label: 'Browse Topics', value: 'topic-browser' },
```

Add to `Screen` type and `app.tsx` routes.

---

## 6. Approval Checklist

Before moving to Phase 4, verify:

- [ ] All 8 technical gates pass (`npm test` is green).
- [ ] All 5 UAT steps pass (manual verification).
- [ ] Every extracted entity has a corresponding markdown page.
- [ ] Entity pages have valid YAML frontmatter.
- [ ] Entity pages contain all mentions from the extraction JSON.
- [ ] Entity pages have citations.
- [ ] Folders are created dynamically.
- [ ] Topic pages exist.
- [ ] Rolling memory is updated.
- [ ] **TUI Entity Browser shows folder tree and page contents.**
- [ ] Total LLM cost for this phase: $0.
- [ ] No code exists for the DOX Writer or Link Checker.

---

## 7. Integration Notes
## 6. Integration Notes

### What Phase 3 Depends On (from Phase 2)
- `.state/extracted/*.json` with valid Extractor output.
- `AGENTS.md` for context (not directly used, but the folder structure must be consistent).

### What Phase 3 Produces (for Phase 4)
- `entities/<subfolder>/<slug>.md` for every entity.
- `topics/<subfolder>/<slug>.md` for every topic.
- `.state/rolling-memory.json` with the current wiki state.

### Contract with Phase 4
Phase 4 expects:
- Entity pages exist in `entities/`.
- Topic pages exist in `topics/`.
- All pages have valid YAML frontmatter.
- All pages use `[[Page Title]]` wikilinks.

Phase 4 must not modify Phase 3's behavior. Phase 4 reads all pages and checks links.

### Isolation Testing
The Materializer can be tested in isolation:
```typescript
import { materialize } from './src/materializer';

// Create fake extraction JSON manually
writeFileSync('wikis/test/.state/extracted/test.json', JSON.stringify({
  entities: [{ name: 'Test', type: 'person', slug: 'test', folder: 'entities/people', mentions: [] }],
  relationships: [],
  claims: []
}));

await materialize('test');
```

No LLM, no extraction, no pipeline. Just deterministic page generation.
