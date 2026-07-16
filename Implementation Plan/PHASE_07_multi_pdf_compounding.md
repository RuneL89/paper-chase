# Phase 7: Multi-PDF Compounding and Incremental Ingestion

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-007`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0-6
**Estimated Time:** 4-5 hours
**LLM Token Budget:** $5.00 (for testing with second PDF)

---

## 1. Objective

Prove that the wiki compounds correctly when multiple PDFs are ingested over time. A journalist must be able to add a new batch of documents and see the wiki grow richer without losing earlier work. This phase tests the incremental ingestion model, rolling memory, and update mode for existing pages.

---

## 2. What to Build

### 2.1 Second Golden Master PDF

Create `test-pdfs/golden-master-2.pdf`. A 2-page document that:
- Mentions at least one entity from the first golden master (e.g., "John Smith" again, but in a new context).
- Introduces at least one new entity (e.g., "Jane Doe").
- Contains at least one new claim type (e.g., "legal" instead of "financial").

You must know every word on every page. This PDF never changes.

### 2.2 Incremental Ingestion Logic

Update `src/commands/ingest.ts`:

1. Before processing, compare each PDF's SHA-256 against `.state/ingestion.json`.
2. **Unchanged PDFs:** Skip entirely. Log: "Skipping {filename} (unchanged)."
3. **New PDFs:** Process fully (Layer 1 → Layer 2 → Layer 3).
4. **Changed PDFs:** Re-process fully. The old document pages are overwritten. The old extraction JSON is replaced. The Materializer updates affected entity pages.
5. **Removed PDFs:** Detect files in `raw/` that are no longer present. Log a warning. Do not delete pages (the journalist may want to review before removal).

### 2.3 Update Mode for Entity Pages

Update `src/materializer.ts`:

When an entity page already exists:
1. Load the existing page content.
2. Parse the existing structured data (mentions, relationships, claims).
3. Merge new data from the new extraction JSON.
4. Rewrite the page with the merged data.
5. If synthesis was enabled (Phase 6), re-run the Writer with the merged data.

**Merge rules:**
- Mentions: Append new mentions. Do not deduplicate (same text on different pages is valid).
- Relationships: Append new relationships. Dedupe by `(subject, predicate, object)`.
- Claims: Append new claims. Dedupe by `text`.
- Sources: Append new sources to the frontmatter.

### 2.4 Rolling Memory Update

Update `src/state/rolling-memory.ts`:

After materialization:
1. Add new entities to the memory.
2. Update `mentionCount` for existing entities.
3. Add new folders to `folderStructure`.
4. Add new sources to `sources`.
5. Add new topics to `topics`.

### 2.5 Conflict Detection

Update `src/materializer.ts`:

Before updating an entity page:
1. Compute the hash of the current page content.
2. Compare against the hash stored in `.state/ingestion.json`.
3. If the hashes differ, the page was manually edited. Skip the update and log a conflict.

**Conflict log:** `.state/conflicts.json`:
```json
{
  "conflicts": [
    {
      "timestamp": "2026-07-16T10:00:00Z",
      "type": "manual-edit",
      "page": "entities/people/executives/john-smith.md",
      "reason": "Page was manually edited since last ingestion. Skipping update."
    }
  ]
}
```

---

## 3. Technical Approval Gates

### Gate 7.1: New PDF Adds New Entities

```typescript
test('new PDF adds new entities to wiki', async () => {
  await ingest('test-wiki'); // first PDF
  copyFileSync('test-pdfs/golden-master-2.pdf', 'wikis/test-wiki/raw/golden-master-2.pdf');
  await ingest('test-wiki'); // second PDF

  expect(existsSync('wikis/test-wiki/entities/people/executives/jane-doe.md')).toBe(true);
});
```

**Pass Criteria:** New entity from second PDF has a page.

### Gate 7.2: New PDF Updates Existing Entity Pages

```typescript
test('new PDF updates existing entity pages', async () => {
  await ingest('test-wiki');
  const firstPage = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');

  copyFileSync('test-pdfs/golden-master-2.pdf', 'wikis/test-wiki/raw/golden-master-2.pdf');
  await ingest('test-wiki');
  const secondPage = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');

  expect(secondPage.length).toBeGreaterThan(firstPage.length); // more content
  expect(secondPage).toContain('golden-master-2.pdf'); // new source mentioned
});
```

**Pass Criteria:** Existing entity page is longer and contains new source.

### Gate 7.3: Unchanged PDFs Are Skipped

```typescript
test('unchanged PDFs are skipped on re-ingest', async () => {
  await ingest('test-wiki');
  const consoleSpy = vi.spyOn(console, 'log');
  await ingest('test-wiki');
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping'));
});
```

**Pass Criteria:** Console shows "Skipping" for unchanged PDFs.

### Gate 7.4: Rolling Memory Reflects Both PDFs

```typescript
test('rolling memory contains entities from both PDFs', async () => {
  await ingest('test-wiki');
  copyFileSync('test-pdfs/golden-master-2.pdf', 'wikis/test-wiki/raw/golden-master-2.pdf');
  await ingest('test-wiki');

  const memory = JSON.parse(readFileSync('wikis/test-wiki/.state/rolling-memory.json', 'utf-8'));
  const slugs = memory.entities.map(e => e.slug);
  expect(slugs).toContain('john-smith');
  expect(slugs).toContain('jane-doe');
});
```

**Pass Criteria:** Rolling memory contains entities from both PDFs.

### Gate 7.5: Manual Edit Conflict is Detected

```typescript
test('manual edit conflict is detected', async () => {
  await ingest('test-wiki');

  // Manually edit an entity page
  const edited = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8') + '\n\nManual edit.';
  writeFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', edited);

  // Add new PDF
  copyFileSync('test-pdfs/golden-master-2.pdf', 'wikis/test-wiki/raw/golden-master-2.pdf');
  await ingest('test-wiki');

  const conflicts = JSON.parse(readFileSync('wikis/test-wiki/.state/conflicts.json', 'utf-8'));
  expect(conflicts.conflicts.length).toBeGreaterThan(0);
});
```

**Pass Criteria:** Conflict is logged when manual edit is detected.

### Gate 7.6: No Duplicate Entity Pages

```typescript
test('no duplicate entity pages for same slug', async () => {
  await ingest('test-wiki');
  copyFileSync('test-pdfs/golden-master-2.pdf', 'wikis/test-wiki/raw/golden-master-2.pdf');
  await ingest('test-wiki');

  const files = globSync('wikis/test-wiki/entities/**/*.md');
  const johnSmithFiles = files.filter(f => f.includes('john-smith'));
  expect(johnSmithFiles).toHaveLength(1);
});
```

**Pass Criteria:** Only one entity page per slug, even across multiple PDFs.

---

## 4. User Acceptance Tests (UAT)

### UAT 7.1: I can add a second PDF

```bash
cp test-pdfs/golden-master-2.pdf wikis/test-wiki/raw/
npx tsx src/cli.ts ingest test-wiki
```

**Expected:** Console shows "Processing golden-master-2.pdf" and "Skipping golden-master.pdf (unchanged)." The wiki now has more entity pages.

### UAT 7.2: Existing entity pages are richer

Open `wikis/test-wiki/entities/people/executives/john-smith.md`.

**Expected:** The page now contains mentions from both PDFs. The "Sources" section lists both `golden-master.pdf` and `golden-master-2.pdf`.

### UAT 7.3: New entity pages exist

```bash
ls wikis/test-wiki/entities/people/executives/
```

**Expected:** I see `jane-doe.md` (or whatever new entity was in the second PDF).

### UAT 7.4: I can see conflicts

```bash
cat wikis/test-wiki/.state/conflicts.json | jq .
```

**Expected:** If I manually edited a page, I see a conflict entry explaining which page was skipped and why.

---



## 5. TUI Updates for This Phase

### 5.1 `compounding-log-screen.tsx`

**File:** `src/tui/compounding-log-screen.tsx`

A screen showing what changed in the last ingest run:

```
╔══════════════════════════════════════╗
║  Ingestion Log                       ║
╠══════════════════════════════════════╣
║  Run: 2026-07-16 14:30                 ║
║                                        ║
║  New PDFs: 1                           ║
║  - golden-master-2.pdf                 ║
║                                        ║
║  New Entities: 1                       ║
║  - Jane Doe (entities/people/exec)     ║
║                                        ║
║  Updated Entities: 1                   ║
║  - John Smith (+2 mentions)            ║
║                                        ║
║  Conflicts: 0                          ║
║                                        ║
║  Total Cost: $0.03                     ║
╠══════════════════════════════════════╣
║  [ Back ]                            ║
╚══════════════════════════════════════╝
```

**Behavior:**
- Reads `.state/metrics.json` and `.state/conflicts.json`.
- Shows a human-readable summary of what changed.
- Scrollable if the log is long.

### 5.2 `ingest-screen.tsx` Update

After ingestion completes, the screen automatically shows the compounding log:
```
║  Ingestion Complete!                   ║
║  Viewing results...                    ║
```

### 5.3 Menu Updates

**File:** `src/tui/menu.tsx`

Add:
```typescript
{ label: 'View Ingestion Log', value: 'compounding-log' },
```

---

## 6. Approval Checklist

Before moving to Phase 8, verify:

- [ ] All 6 technical gates pass (`npm test` is green).
- [ ] All 4 UAT steps pass (manual verification).
- [ ] New PDFs add new entities.
- [ ] New PDFs update existing entity pages.
- [ ] Unchanged PDFs are skipped.
- [ ] Rolling memory reflects all PDFs.
- [ ] Manual edits are detected and conflicts are logged.
- [ ] No duplicate entity pages exist.
- [ ] **TUI Ingestion Log shows what changed in the last run.**
- [ ] Total LLM cost for this phase is under $5.00.

---

## 7. Integration Notes
## 6. Integration Notes

### What Phase 7 Depends On (from Phase 6)
- Entity pages exist (structured or synthesized).
- Preservation check framework is in place.
- DOX contracts are complete.

### What Phase 7 Produces (for Phase 8)
- Proven incremental ingestion model.
- Conflict detection framework.
- Multi-PDF rolling memory.

### Contract with Phase 8
Phase 8 expects:
- The wiki compounds correctly over multiple ingestion runs.
- Conflicts are logged and reviewable.

Phase 8 adds AGENTS.md generation and updates.
