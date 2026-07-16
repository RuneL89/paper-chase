# Phase 4: Link Checker and Validation (Deterministic)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-004`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3
**Estimated Time:** 2-3 hours
**LLM Token Budget:** $0

---

## 1. Objective

Build deterministic validation that runs after materialization. It checks that all wikilinks resolve to existing files, all citations map to valid sources, and no orphaned pages exist. This is the quality gate before the DOX Writer runs.

---

## 2. What to Build

### 2.1 Link Checker

**File:** `src/validation/link-checker.ts`

```typescript
interface LinkCheckResult {
  broken: Array<{ page: string; link: string }>;
  orphaned: string[]; // pages with no incoming links (excluding index and source pages)
  totalLinks: number;
  totalPages: number;
}

async function checkLinks(wikiSlug: string): Promise<LinkCheckResult>;
```

**Algorithm:**
1. Scan all `.md` files in `wikis/<slug>/` (excluding `.state/`).
2. Find all `[[Page Title]]` wikilinks using regex `/\[\[([^\]]+)\]\]/g`.
3. For each link, check if a file exists with that title (case-insensitive, slug matching).
4. Find all `.md` files and count incoming links for each.
5. Report pages with zero incoming links as orphaned (except `index.md` and `sources/*.md`).

**Slug matching:** A link `[[John Smith]]` should resolve to `john-smith.md`. The checker converts the link text to a slug and looks for a file with that slug in any folder.

### 2.2 Citation Checker

**File:** `src/validation/citation-checker.ts`

```typescript
interface CitationCheckResult {
  invalid: Array<{ page: string; citation: string }>;
  missingSource: Array<{ page: string; citation: string }>;
  totalCitations: number;
}

async function checkCitations(wikiSlug: string): Promise<CitationCheckResult>;
```

**Algorithm:**
1. Scan all content pages (not `index.md`).
2. Find all `[^srcN]` citations.
3. For each citation, check that a corresponding `[^srcN]:` definition exists in the page body.
4. Check that the source file referenced in the definition exists in `raw/`.

### 2.3 Schema Validator

**File:** `src/validation/schema-validator.ts`

```typescript
interface SchemaCheckResult {
  invalid: Array<{ page: string; issue: string }>;
  totalPages: number;
}

async function validateSchema(wikiSlug: string): Promise<SchemaCheckResult>;
```

**Algorithm:**
1. Scan all `.md` files.
2. Parse YAML frontmatter with `gray-matter`.
3. Check required fields: `title`, `type`, `updated`.
4. Check `type` is one of the known types or documented in `index.md`.
5. Check `updated` is a valid ISO 8601 timestamp.

### 2.4 Integration into `ingest.ts`

After `materialize()`, run:
1. `checkLinks()`
2. `checkCitations()`
3. `validateSchema()`

Log results to console. If any broken links or invalid citations are found, log warnings but do not abort. The wiki is still usable; the journalist can fix links manually.

---

## 3. Technical Approval Gates

### Gate 4.1: Link Checker Finds All Links

```typescript
test('link checker finds all wikilinks in wiki', async () => {
  await ingest('test-wiki');
  const result = await checkLinks('test-wiki');
  expect(result.totalLinks).toBeGreaterThan(0);
});
```

**Pass Criteria:** At least one link is found.

### Gate 4.2: All Links Resolve to Existing Files

```typescript
test('all wikilinks resolve to existing files', async () => {
  await ingest('test-wiki');
  const result = await checkLinks('test-wiki');
  expect(result.broken).toHaveLength(0);
});
```

**Pass Criteria:** Zero broken links.

### Gate 4.3: Citation Checker Validates Citations

```typescript
test('all citations map to valid source definitions', async () => {
  await ingest('test-wiki');
  const result = await checkCitations('test-wiki');
  expect(result.invalid).toHaveLength(0);
  expect(result.missingSource).toHaveLength(0);
});
```

**Pass Criteria:** Zero invalid or missing-source citations.

### Gate 4.4: Schema Validator Checks Frontmatter

```typescript
test('all pages have valid frontmatter', async () => {
  await ingest('test-wiki');
  const result = await validateSchema('test-wiki');
  expect(result.invalid).toHaveLength(0);
});
```

**Pass Criteria:** Zero schema violations.

### Gate 4.5: Orphaned Pages Are Detected

```typescript
test('orphaned pages are detected', async () => {
  // Create a page with no incoming links
  writeFileSync('wikis/test-wiki/entities/orphan.md', '---\ntitle: Orphan\ntype: entity\nupdated: 2026-07-16T10:00:00Z\n---\n\nOrphan page.');
  const result = await checkLinks('test-wiki');
  expect(result.orphaned).toContain('wikis/test-wiki/entities/orphan.md');
});
```

**Pass Criteria:** Orphaned page is detected and reported.

### Gate 4.6: Validation Results Are Logged

```typescript
test('validation results are logged to console', async () => {
  const consoleSpy = vi.spyOn(console, 'log');
  await ingest('test-wiki');
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Link check'));
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Citation check'));
});
```

**Pass Criteria:** Console shows validation summary.

---

## 4. User Acceptance Tests (UAT)

### UAT 4.1: I see validation output after ingest

```bash
npx tsx src/cli.ts ingest test-wiki
```

**Expected:** Console shows a summary like:
```
Link check: 15 links, 0 broken, 0 orphaned
Citation check: 12 citations, 0 invalid
Schema check: 8 pages, 0 invalid
```

### UAT 4.2: I can verify links manually

```bash
grep -r "\[\[" wikis/test-wiki/entities/ | head -5
```

**Expected:** I see wikilinks like `[[Acme Corp]]`. I can follow them to the corresponding file.

### UAT 4.3: I can verify citations manually

Open `wikis/test-wiki/entities/people/executives/john-smith.md`.

**Expected:** I see `[^src1]` in the text. At the bottom, I see `[^src1]: golden-master.pdf, pages 1-3`. I can open `wikis/test-wiki/sources/golden-master.md` and verify the source exists.

---



## 5. TUI Updates for This Phase

### 5.1 `validation-report-screen.tsx`

**File:** `src/tui/validation-report-screen.tsx`

A screen showing validation results after ingestion:

```
╔══════════════════════════════════════╗
║  Validation Report                   ║
╠══════════════════════════════════════╣
║  Link Check:                           ║
║  ✓ 15 links, 0 broken, 0 orphaned    ║
║                                        ║
║  Citation Check:                       ║
║  ✓ 12 citations, 0 invalid           ║
║                                        ║
║  Schema Check:                         ║
║  ✓ 8 pages, 0 invalid                ║
╠══════════════════════════════════════╣
║  [ Back to Menu ]                    ║
╚══════════════════════════════════════╝
```

**If errors exist:**
```
║  Link Check:                           ║
║  ✗ 15 links, 2 broken                  ║
║  - entities/people/executives/john-smith.md
║    Broken: [[Jane Doe]] → not found    ║
```

**Behavior:**
- Runs validation automatically after ingestion.
- Shows green checkmarks for passing checks.
- Shows red X and details for failing checks.
- Scrollable if the report is long.

### 5.2 Menu Updates

**File:** `src/tui/menu.tsx`

Add:
```typescript
{ label: 'View Validation Report', value: 'validation-report' },
```

---

## 6. Approval Checklist

Before moving to Phase 5, verify:

- [ ] All 6 technical gates pass (`npm test` is green).
- [ ] All 3 UAT steps pass (manual verification).
- [ ] Link checker finds all wikilinks.
- [ ] Zero broken links.
- [ ] Zero invalid citations.
- [ ] Zero schema violations.
- [ ] Orphaned pages are detected.
- [ ] Validation results are logged.
- [ ] **TUI Validation Report shows green checkmarks for all checks.**
- [ ] Total LLM cost for this phase: $0.

---

## 7. Integration Notes
## 6. Integration Notes

### What Phase 4 Depends On (from Phase 3)
- `entities/<subfolder>/<slug>.md` for every entity.
- `topics/<subfolder>/<slug>.md` for every topic.
- `documents/` and `sources/` pages from Phase 1.

### What Phase 4 Produces (for Phase 5)
- Validation reports (logged to console, not persisted).
- Confidence that the wiki is internally consistent.

### Contract with Phase 5
Phase 5 expects:
- All pages have valid frontmatter.
- All links resolve.
- All citations are valid.

Phase 5 must not modify Phase 4's behavior. Phase 5 reads the validated wiki and writes `index.md` files.

### Isolation Testing
Each validator can be tested in isolation:
```typescript
import { checkLinks } from './src/validation/link-checker';

// Create fake wiki pages manually
const result = await checkLinks('test');
```
