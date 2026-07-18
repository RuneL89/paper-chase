# Phase 1: Raw Document Pages (Layer 1)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-001`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0 (Infrastructure)
**Estimated Time:** 3-5 hours
**LLM Token Budget:** $0

---

## 1. Objective

Implement the `init` and `ingest` commands so that every PDF in `raw/` is extracted into raw markdown document pages with valid YAML frontmatter. No LLM is involved. This is the preservation layer: if everything else fails, the journalist still has every word from the PDF in searchable markdown.

---

## 2. What to Build

### 2.1 `init` Command

**File:** `src/commands/init.ts`

**What it does:**
1. Creates `wikis/<slug>/` directory.
2. Creates subdirectories: `raw/`, `documents/`, `sources/`, `entities/`, `topics/`, `.state/`.
3. Copies `templates/AGENTS.md` to `wikis/<slug>/AGENTS.md`, replacing `{wiki-title}` with the provided title or slug.
4. Prints a message: "Wiki '<slug>' created. Place PDFs in wikis/<slug>/raw/ and run ingest."

**What the user provides:**
- **Nothing in `AGENTS.md`.** The file is generated automatically from the template.
- The wiki title (optional, via `--title` flag or derived from slug).

**What the user does NOT provide:**
- Purpose description. The LLM infers this from the corpus content during ingestion.
- Seed folders. The LLM discovers these from the actual content.
- Corpus-specific rules. The LLM learns these from the content and proposes updates later.

The `AGENTS.md` is **fully automatic**. The human does not edit it. The LLM uses the generic instructions and discovers the specifics during ingestion. If the LLM discovers patterns that should be documented, the AGENTS.md Updater (Phase 9) proposes updates.

**CLI signature:**
```bash
llm-wiki-cli init <slug> [--title <title>] [-w <workspace>]
```

**TUI equivalent:**
- Select "Create New Wiki" from menu.
- Enter slug (text input).
- Enter title (optional, text input).
- Press "Create". AGENTS.md is generated automatically.

### 2.2 `ingest` Command (Layer 1 Only)

**File:** `src/commands/ingest.ts`

**What it does (this phase only):**
1. Reads all PDFs from `wikis/<slug>/raw/`.
2. For each PDF:
   - Compute SHA-256 hash.
   - Extract text page by page.
   - Split into chunks of N pages (default: 5 pages per chunk, configurable).
   - Never split a page, table, or figure across chunks.
   - Write each chunk to `documents/<source-slug>-part-001.md`.
3. Write source provenance to `.state/ingestion.json`.

**Chunking rules:**
- A chunk is a consecutive range of pages.
- Default chunk size: 5 pages.
- If a PDF has fewer than 5 pages, it is one chunk.
- Never split a page. If a table spans pages 4-5, the chunk includes both pages.

**Document page format:**
```markdown
---
title: "annual-report-2024-part-001"
type: document
wiki: acme-reports
sources:
  - file: "wikis/acme-reports/raw/annual-report-2024.pdf"
    pages: "1-5"
updated: "2026-07-16T10:00:00Z"
---

[Raw extracted text here]
```

### 2.3 State Tracking

**File:** `src/state/ingestion-state.ts`

Reads/writes `.state/ingestion.json`:
```json
{
  "sources": {
    "annual-report-2024": {
      "hash": "a1b2c3...",
      "documentPages": ["documents/annual-report-2024-part-001.md"],
      "ingestedAt": "2026-07-16T10:00:00Z"
    }
  }
}
```

### 2.4 Source Pages

**File:** `src/pages/source-page.ts`

Deterministically writes `sources/<source-slug>.md`:
```markdown
---
title: "Source: annual-report-2024.pdf"
type: source
wiki: acme-reports
file: "wikis/acme-reports/raw/annual-report-2024.pdf"
sha256: "a1b2c3..."
pages: 120
ingested: "2026-07-16T10:00:00Z"
updated: "2026-07-16T10:00:00Z"
warnings: []
---

# Source: annual-report-2024.pdf

| Field | Value |
|---|---|
| File | `wikis/acme-reports/raw/annual-report-2024.pdf` |
| Pages | 120 |
| SHA-256 | `a1b2c3...` |
| Ingested | 2026-07-16 |

## Document Pages

- [[annual-report-2024-part-001]]
- [[annual-report-2024-part-002]]
```

---

## 3. Technical Approval Gates

### Gate 1.1: `init` Creates Correct Structure

```typescript
test('init creates wiki structure', async () => {
  await init('test-wiki');
  expect(existsSync('wikis/test-wiki/raw')).toBe(true);
  expect(existsSync('wikis/test-wiki/documents')).toBe(true);
  expect(existsSync('wikis/test-wiki/sources')).toBe(true);
  expect(existsSync('wikis/test-wiki/entities')).toBe(true);
  expect(existsSync('wikis/test-wiki/topics')).toBe(true);
  expect(existsSync('wikis/test-wiki/.state')).toBe(true);
  expect(existsSync('wikis/test-wiki/AGENTS.md')).toBe(true);
});
```

**Pass Criteria:** All folders and AGENTS.md exist.

### Gate 1.2: `ingest` Writes Document Pages

```typescript
test('ingest writes document pages for each chunk', async () => {
  // Copy golden master to raw/
  copyFileSync('test-pdfs/golden-master.pdf', 'wikis/test-wiki/raw/golden-master.pdf');
  await ingest('test-wiki');
  expect(existsSync('wikis/test-wiki/documents/golden-master-part-001.md')).toBe(true);
});
```

**Pass Criteria:** Document page exists.

### Gate 1.3: Document Page Contains All Raw Text

```typescript
test('document page contains all text from PDF', async () => {
  const doc = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  expect(doc).toContain('John Smith');
  expect(doc).toContain('Acme Corp');
  expect(doc).toContain('March 15, 2024');
  expect(doc).toContain('$42.5 million');
  expect(doc).toContain('Board Members');
});
```

**Pass Criteria:** All known strings from the golden master are present.

### Gate 1.4: Document Page Preserves Tables

```typescript
test('document page preserves table from PDF', async () => {
  const doc = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  expect(doc).toContain('|');  // markdown table syntax
  expect(doc).toContain('Revenue'); // table header from golden master
});
```

**Pass Criteria:** Markdown table syntax is present.

### Gate 1.5: Document Page Has Valid Frontmatter

```typescript
test('document page has valid YAML frontmatter', async () => {
  const doc = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const parsed = matter(doc);
  expect(parsed.data.type).toBe('document');
  expect(parsed.data.sources[0].file).toContain('golden-master.pdf');
  expect(parsed.data.sources[0].pages).toBe('1-3'); // or '1-5' depending on chunk size
});
```

**Pass Criteria:** Valid YAML, correct type, correct source file and page range.

### Gate 1.6: Source Page Has Correct Hash

```typescript
test('source page contains correct SHA-256', async () => {
  const source = readFileSync('wikis/test-wiki/sources/golden-master.md', 'utf-8');
  const expectedHash = await sha256('test-pdfs/golden-master.pdf');
  expect(source).toContain(expectedHash);
});
```

**Pass Criteria:** Hash in source page matches actual file hash.

### Gate 1.7: Re-Running Ingest is Idempotent

```typescript
test('re-running ingest does not duplicate pages', async () => {
  await ingest('test-wiki'); // first run
  await ingest('test-wiki'); // second run
  const files = readdirSync('wikis/test-wiki/documents');
  expect(files.filter(f => f.startsWith('golden-master'))).toHaveLength(1);
});
```

**Pass Criteria:** Only one document page per chunk. No duplicates.

### Gate 1.8: Re-Running Ingest is Fast for Unchanged PDFs

```typescript
test('re-running ingest skips unchanged PDFs', async () => {
  await ingest('test-wiki');
  const start = Date.now();
  await ingest('test-wiki');
  expect(Date.now() - start).toBeLessThan(1000); // should be near-instant
});
```

**Pass Criteria:** Second run completes in under 1 second.

### Gate 1.9: State File is Valid JSON

```typescript
test('ingestion state is valid JSON', async () => {
  const state = JSON.parse(readFileSync('wikis/test-wiki/.state/ingestion.json', 'utf-8'));
  expect(state.sources['golden-master']).toBeDefined();
  expect(state.sources['golden-master'].hash).toBeTruthy();
  expect(state.sources['golden-master'].documentPages).toHaveLength(1);
});
```

**Pass Criteria:** Valid JSON with correct structure.

---

## 4. User Acceptance Tests (UAT)

### UAT 1.1: I can create a wiki

```bash
npx tsx src/cli.ts init test-wiki
```

**Expected:** Console prints "Wiki 'test-wiki' created." The directory `wikis/test-wiki/` exists with all subfolders and an `AGENTS.md` file.

### UAT 1.2: I can ingest a PDF

```bash
cp test-pdfs/golden-master.pdf wikis/test-wiki/raw/
npx tsx src/cli.ts ingest test-wiki
```

**Expected:** Console shows progress. After completion, `wikis/test-wiki/documents/` contains `golden-master-part-001.md`. `wikis/test-wiki/sources/` contains `golden-master.md`.

### UAT 1.3: I can read the raw document page

Open `wikis/test-wiki/documents/golden-master-part-001.md` in a text editor.

**Expected:** I see the YAML frontmatter at the top. Below it, I see the full text from the PDF. I can find "John Smith", "Acme Corp", the table, and "Board Members". The table is formatted as a markdown table with `|` characters.

### UAT 1.4: I can verify the source page

Open `wikis/test-wiki/sources/golden-master.md`.

**Expected:** I see the SHA-256 hash. I can verify it matches `shasum -a 256 test-pdfs/golden-master.pdf`.

### UAT 1.5: Re-running ingest does nothing

```bash
npx tsx src/cli.ts ingest test-wiki
```

**Expected:** Console shows "Skipping golden-master.pdf (unchanged)". No new files are created. Existing files are not modified.

### UAT 1.6: I can search the corpus with grep

```bash
grep -r "John Smith" wikis/test-wiki/documents/
```

**Expected:** Results show the document page containing the name. This proves the corpus is searchable even without LLM processing.

---



## 5. TUI Updates for This Phase

### 5.1 `init-screen.tsx`

**File:** `src/tui/init-screen.tsx`

A form-based screen for creating a new wiki:

```
╔══════════════════════════════════════╗
║  Create New Wiki                     ║
╠══════════════════════════════════════╣
║  Wiki Slug: [test-wiki     ]         ║
║  Title:     [Test Wiki     ]         ║
║  Workspace: [./             ]         ║
╠══════════════════════════════════════╣
║  [ Create Wiki ]  [ Back ]           ║
╚══════════════════════════════════════╝
```

**Fields:**
- Wiki Slug (text input, required)
- Title (text input, optional)
- Workspace (text input, default: `./`)

**Behavior:**
- Pressing Tab moves between fields.
- Pressing Enter on "Create Wiki" runs `init()` and shows success/error box.
- Pressing Escape or selecting "Back" returns to menu.

### 5.2 `ingest-screen.tsx`

**File:** `src/tui/ingest-screen.tsx`

A screen for running ingestion:

```
╔══════════════════════════════════════╗
║  Ingest PDFs                         ║
╠══════════════════════════════════════╣
║  Select Wiki:                        ║
║  > test-wiki                         ║
║    another-wiki                      ║
╠══════════════════════════════════════╣
║  PDFs in raw/: 3 files               ║
║  Last ingest: 2026-07-16 10:00       ║
╠══════════════════════════════════════╣
║  [ Run Ingest ]  [ Back ]           ║
╚══════════════════════════════════════╝
```

**Behavior:**
- Lists existing wikis from `wikis/` directory.
- Shows count of PDFs in `raw/`.
- Shows last ingestion timestamp from `.state/ingestion.json`.
- Pressing Enter on "Run Ingest" starts `ingest()` with a progress spinner.
- Shows real-time progress: "Extracting text...", "Chunk 1/3...", "Done!"

### 5.3 Menu Updates

**File:** `src/tui/menu.tsx`

Add menu items for Phase 1 features:
```typescript
const items = [
  { label: 'Create New Wiki (init)', value: 'init' },
  { label: 'Ingest PDFs (ingest)', value: 'ingest' },
  { label: 'Run Tests', value: 'test' },
  { label: 'Settings', value: 'settings' },
  { label: 'Exit', value: 'exit' },
];
```

### 5.4 TUI Tests

```typescript
test('init screen renders form fields', async () => {
  const { render } = await import('ink');
  const { InitScreen } = await import('../src/tui/init-screen');
  const { lastFrame } = render(<InitScreen onBack={() => {}} onResult={() => {}} />);
  expect(lastFrame()).toContain('Wiki Slug');
  expect(lastFrame()).toContain('Title');
});

test('ingest screen lists existing wikis', async () => {
  // Create a fake wiki
  mkdirSync('wikis/fake-wiki', { recursive: true });
  const { render } = await import('ink');
  const { IngestScreen } = await import('../src/tui/ingest-screen');
  const { lastFrame } = render(<IngestScreen onBack={() => {}} onResult={() => {}} />);
  expect(lastFrame()).toContain('fake-wiki');
});
```

---

## 6. Approval Checklist

Before moving to Phase 2, verify:

- [ ] All 9 technical gates pass (`npm test` is green).
- [ ] All 6 UAT steps pass (manual verification).
- [ ] `init` creates the correct folder structure.
- [ ] `ingest` writes document pages with valid frontmatter.
- [ ] Document pages contain all text from the PDF.
- [ ] Tables are preserved as markdown tables.
- [ ] Source pages contain correct SHA-256 hashes.
- [ ] Re-running `ingest` skips unchanged PDFs.
- [ ] **TUI `init` screen creates a wiki successfully.**
- [ ] **TUI `ingest` screen runs ingestion with progress display.**
- [ ] No LLM calls were made in this phase. Total cost: $0.
- [ ] No code exists for the Extractor, Materializer, or DOX Writer.

---

## 7. Integration Notes
## 6. Integration Notes

### What Phase 1 Depends On (from Phase 0)
- `extractText` from `src/extraction/pdf.ts`
- `sha256` from `src/utils/hash.ts`
- `test-pdfs/golden-master.pdf`

### What Phase 1 Produces (for Phase 2)
- `wikis/<slug>/` folder structure
- `wikis/<slug>/documents/` with raw markdown pages
- `wikis/<slug>/sources/` with provenance pages
- `wikis/<slug>/.state/ingestion.json` with hash tracking
- `wikis/<slug>/AGENTS.md` (skeleton, user-edited)

### Contract with Phase 2
Phase 2 expects:
- Document pages exist in `documents/` with valid YAML frontmatter.
- Source pages exist in `sources/` with SHA-256 hashes.
- `.state/ingestion.json` tracks which PDFs have been processed.
- `AGENTS.md` exists and contains instructions for the LLM.

Phase 2 must not modify Phase 1's behavior. Phase 2 adds Layer 2 on top of Layer 1.
