# Phase 2: The Extractor (Layer 2)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-002`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0 (Infrastructure), Phase 1 (Raw Document Pages)
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $5.00 (hard cap)

---

## 1. Objective

Build the Extractor agent: one LLM call per chunk that reads the raw text and returns structured JSON with entities, relationships, claims, and folder assignments. This is the only LLM call in the core pipeline. Every subsequent layer depends on the quality of this JSON.

---

## 2. What to Build

### 2.1 Extractor Prompt

**File:** `prompts/extractor.prompt.txt`

The prompt has two parts:
1. **System Instructions** (fixed, never changes) — tells the LLM how to build the wiki.
2. **Wiki Context** (injected at runtime) — the user's `AGENTS.md` + rolling memory + chunk text.

**System Instructions (fixed):**
```
You are an investigative research assistant extracting structured information from a PDF document chunk.

=== SYSTEM INSTRUCTIONS ===
You are building a citation-backed wiki. Follow these rules:

1. Extract all entities, relationships, claims, timeline events, and context from the chunk.
2. Assign each entity to the most specific sub-folder under `entities/` or `topics/`.
3. Create new sub-folders only when no existing folder fits. Use lowercase kebab-case.
4. Never create folders outside `entities/` or `topics/`. Max 3 levels deep.
5. Use `[^srcN]` citations for every factual claim.
6. Write a context paragraph describing the broader narrative this chunk belongs to.
7. Every entity must have a significance sentence explaining why it matters in this chunk.
8. If a name is ambiguous, provide disambiguation.

Page format for entities:
- Layer 1 (Synthesis): 2-4 paragraphs of readable prose with chronological context, cross-references, and significance.
- Layer 2 (Preserved Detail): Mentions, Relationships, Claims, Timeline, Sources sections.

Citation format:
- Inline: `[^srcN]` after every factual claim.
- Definition: `[^srcN]: filename.pdf, pages X-Y` in Sources section.
- Multiple claims from same source reuse the same key.
```

**Wiki Context (injected at runtime):**
```
=== WIKI CONTEXT (AGENTS.md) ===
{agentsMd}

=== CURRENT WIKI STATE ===
Existing folders: {existingFolders}
Existing entities: {existingEntities}

=== DOCUMENT CHUNK ===
Source: {sourceFile}
Pages: {pageRange}

{chunkText}
```

**The AGENTS.md is fully automatic.** Generated from the template at `init` time. The LLM reads the generic instructions and infers the corpus specifics from the content during ingestion.
### 2.2 Extractor Agent

**File:** `src/agents/extractor.ts`

```typescript
interface ExtractorResult {
  entities: Array<{
    name: string;
    type: string;
    slug: string;
    folder: string;
    mentions: Array<{ page: number; context: string }>;
  }>;
  relationships: Array<{
    subject: string;
    predicate: string;
    object: string;
    evidence: string;
    page: number;
  }>;
  claims: Array<{
    text: string;
    type: string;
    entities: string[];
    page: number;
  }>;
}

async function extractChunk(
  chunkText: string,
  pageRange: string,
  sourceFile: string,
  agentsMd: string,
  existingFolders: string[],
  existingEntities: string[]
): Promise<ExtractorResult>;
```

**Implementation:**
1. Read `prompts/extractor.prompt.txt`.
2. Replace placeholders with actual values.
3. Call `callLLM(prompt)`.
4. Parse the response as JSON.
5. Validate the JSON schema (see Gate 2.1).
6. Return the parsed result.

**Error handling:**
- If the LLM returns invalid JSON, throw `ExtractorError` with the raw response.
- If the JSON fails schema validation, throw `ExtractorError` with the validation issues.
- No retry. The user fixes the prompt or the chunk and re-runs.

### 2.3 Integration into `ingest`

Update `src/commands/ingest.ts`:
1. After writing the raw document page (Layer 1), read the document page text.
2. Load `AGENTS.md` from disk.
3. Load rolling memory (or empty for first run).
4. Call `extractChunk`.
5. Save the JSON to `.state/extracted/<chunk-id>.json`.
6. Log the extraction result: "Extracted 5 entities, 3 relationships, 2 claims from chunk 001."

### 2.4 JSON Schema Validator

**File:** `src/validation/extractor-schema.ts`

Validates that Extractor output matches the expected schema:
- `entities` is an array.
- Every entity has `name`, `type`, `slug`, `folder`, `mentions`.
- Every mention has `page` (number) and `context` (string).
- `relationships` is an array.
- Every relationship has `subject`, `predicate`, `object`, `evidence`, `page`.
- `claims` is an array.
- Every claim has `text`, `type`, `entities`, `page`.
- All `page` values are within the chunk's page range.

---

## 3. Technical Approval Gates

### Gate 2.1: Extractor Returns Valid JSON

```typescript
test('extractor returns valid JSON schema', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(
    chunkText,
    '1-3',
    'wikis/test-wiki/raw/golden-master.pdf',
    readFileSync('wikis/test-wiki/AGENTS.md', 'utf-8'),
    [],
    []
  );

  expect(result.entities).toBeInstanceOf(Array);
  expect(result.relationships).toBeInstanceOf(Array);
  expect(result.claims).toBeInstanceOf(Array);

  for (const e of result.entities) {
    expect(e.name).toBeTruthy();
    expect(e.type).toBeTruthy();
    expect(e.slug).toMatch(/^[a-z0-9-]+$/);
    expect(e.folder).toMatch(/^entities\/|^topics\//);
    expect(e.mentions).toBeInstanceOf(Array);
  }
});
```

**Pass Criteria:** JSON is valid. All schema fields are present and correct.

### Gate 2.2: Extractor Finds Every Known Entity

```typescript
test('extractor finds every entity in golden master', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', '...', '...', [], []);
  const names = result.entities.map(e => e.name);
  expect(names).toContain('John Smith');
  expect(names).toContain('Acme Corp');
});
```

**Pass Criteria:** All known entities from the golden master are found.

### Gate 2.3: Extractor Slugs are Deterministic

```typescript
test('extractor produces deterministic slugs', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const r1 = await extractChunk(chunkText, '1-3', '...', '...', [], []);
  const r2 = await extractChunk(chunkText, '1-3', '...', '...', [], []);

  const slugs1 = r1.entities.map(e => e.slug).sort();
  const slugs2 = r2.entities.map(e => e.slug).sort();
  expect(slugs1).toEqual(slugs2);
});
```

**Pass Criteria:** Same input produces same slugs.

### Gate 2.4: Extractor Assigns Valid Folders

```typescript
test('extractor assigns valid folders', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', '...', '...', [], []);
  for (const e of result.entities) {
    expect(e.folder).toMatch(/^entities\/|^topics\//);
    expect(e.folder).not.toContain('..');
    expect(e.folder.split('/').length).toBeLessThanOrEqual(4); // max depth
  }
});
```

**Pass Criteria:** All folders are valid paths under `entities/` or `topics/`.

### Gate 2.5: Extractor Finds Claims with Page Numbers

```typescript
test('extractor finds claims with valid page numbers', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', '...', '...', [], []);
  const claim = result.claims.find(c => c.text.includes('42.5'));
  expect(claim).toBeDefined();
  expect(claim.page).toBeGreaterThanOrEqual(1);
  expect(claim.page).toBeLessThanOrEqual(3);
});
```

**Pass Criteria:** Known claims are found with correct page numbers.

### Gate 2.6: Extractor JSON is Saved to Disk

```typescript
test('extractor JSON is saved to .state/extracted/', async () => {
  await ingest('test-wiki');
  expect(existsSync('wikis/test-wiki/.state/extracted/golden-master-part-001.json')).toBe(true);
  const json = JSON.parse(readFileSync('wikis/test-wiki/.state/extracted/golden-master-part-001.json', 'utf-8'));
  expect(json.entities).toBeInstanceOf(Array);
});
```

**Pass Criteria:** JSON file exists and is valid.

### Gate 2.7: Extractor Handles Empty Input

```typescript
test('extractor handles chunk with no entities', async () => {
  const result = await extractChunk('This is a blank page with no names.', '1', '...', '...', [], []);
  expect(result.entities).toHaveLength(0);
  expect(result.relationships).toHaveLength(0);
  expect(result.claims).toHaveLength(0);
});
```

**Pass Criteria:** Empty input returns empty arrays, no crash.

### Gate 2.8: Extractor Uses Rolling Memory

```typescript
test('extractor uses existing entity list from rolling memory', async () => {
  // First extraction creates "john-smith"
  const r1 = await extractChunk(chunkText, '1-3', '...', '...', [], []);

  // Second extraction with rolling memory should not duplicate
  const r2 = await extractChunk(
    chunkText,
    '1-3',
    '...',
    '...',
    ['entities/people/executives'],
    ['john-smith']
  );

  const johnSmith = r2.entities.find(e => e.slug === 'john-smith');
  expect(johnSmith).toBeDefined();
  expect(johnSmith.folder).toBe('entities/people/executives'); // same folder
});
```

**Pass Criteria:** Rolling memory prevents duplicate classification.


### Gate 2.9: Extractor Returns Timeline Events

```typescript
test('extractor returns timeline events with dates', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', '...', '...', [], []);
  expect(result.timeline).toBeInstanceOf(Array);
  // Golden master has "March 15, 2024" on page 1
  const marchEvent = result.timeline.find(t => t.date.includes('2024'));
  expect(marchEvent).toBeDefined();
  expect(marchEvent.event).toBeTruthy();
  expect(marchEvent.entities).toBeInstanceOf(Array);
});
```

**Pass Criteria:** Timeline array exists. Events have dates, descriptions, and entity references.

### Gate 2.10: Extractor Returns Context Paragraph

```typescript
test('extractor returns context paragraph', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', '...', '...', [], []);
  expect(result.context).toBeTruthy();
  expect(result.context.length).toBeGreaterThan(50); // substantial paragraph
});
```

**Pass Criteria:** Context paragraph is non-empty and describes the chunk's narrative.

### Gate 2.11: Extractor Returns Entity Significance

```typescript
test('extractor returns significance for key entities', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', '...', '...', [], []);
  const johnSmith = result.entities.find(e => e.slug === 'john-smith');
  expect(johnSmith.significance).toBeTruthy();
  expect(johnSmith.significance.length).toBeGreaterThan(20);
});
```

**Pass Criteria:** Key entities have significance sentences explaining their role.

### Gate 2.12: Extractor Returns Disambiguation When Needed

```typescript
test('extractor returns disambiguation for ambiguous names', async () => {
  // Use a chunk with an ambiguous name if available, or test that field exists
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', '...', '...', [], []);
  for (const e of result.entities) {
    // disambiguation is optional but must be a string if present
    if (e.disambiguation !== undefined) {
      expect(typeof e.disambiguation).toBe('string');
    }
  }
});
```

**Pass Criteria:** Disambiguation field exists and is a string when present.

---

## 4. User Acceptance Tests (UAT)

### UAT 2.1: I can run extraction on a single chunk

```bash
npx tsx src/cli.ts ingest test-wiki
```

**Expected:** Console shows extraction progress. After completion, `.state/extracted/` contains `golden-master-part-001.json`.

### UAT 2.2: I can inspect the extracted JSON

```bash
cat wikis/test-wiki/.state/extracted/golden-master-part-001.json | jq .
```

**Expected:** I see a JSON object with `entities`, `relationships`, and `claims` arrays. I can find "John Smith" and "Acme Corp" in the entities list. Each entity has a `folder` field like `entities/people/executives`.

### UAT 2.3: The extraction cost is reasonable

Check the console output after `ingest`.

**Expected:** The cost for one 3-page chunk is under $0.05. If it is higher, the prompt is too verbose or the chunk is too large.

### UAT 2.4: Invalid JSON is handled gracefully

Temporarily break the prompt to force invalid JSON output. Run `ingest`.

**Expected:** The system throws an error with the raw LLM response. It does not crash silently. It does not retry and burn more tokens.

---



## 5. TUI Updates for This Phase

### 5.1 `extractor-test-screen.tsx`

**File:** `src/tui/extractor-test-screen.tsx`

A screen for testing the Extractor in isolation:

```
╔══════════════════════════════════════╗
║  Test Extractor                      ║
╠══════════════════════════════════════╣
║  Select Wiki: test-wiki              ║
║  Select Chunk: golden-master-part-001║
╠══════════════════════════════════════╣
║  [ Run Extraction ]  [ Back ]        ║
╚══════════════════════════════════════╝
```

**After extraction:**
```
╔══════════════════════════════════════╗
║  Extraction Results                  ║
╠══════════════════════════════════════╣
║  Entities: 5                           ║
║  - John Smith (person)                 ║
║  - Acme Corp (company)                 ║
║  Relationships: 3                      ║
║  Claims: 2                             ║
╠══════════════════════════════════════╣
║  JSON saved to .state/extracted/       ║
║  [ View JSON ] [ Back ]              ║
╚══════════════════════════════════════╝
```

**Behavior:**
- Lists wikis and chunks from `.state/extracted/`.
- Shows entity count, relationship count, claim count.
- "View JSON" opens a scrollable JSON viewer in the TUI.

### 5.2 Menu Updates

**File:** `src/tui/menu.tsx`

Add under "Ingest PDFs":
```typescript
{ label: 'Test Extractor', value: 'extractor-test' },
```

Add to `Screen` type in `app.tsx`:
```typescript
export type Screen = 'menu' | 'init' | 'ingest' | 'test' | 'settings' | 'extractor-test' | 'exit';
```

Add route in `app.tsx`:
```tsx
{screen === 'extractor-test' && <ExtractorTestScreen onBack={() => setScreen('menu')} />}
```

---

## 6. Approval Checklist

Before moving to Phase 3, verify:

- [ ] All 12 technical gates pass (`npm test` is green).
- [ ] All 4 UAT steps pass (manual verification).
- [ ] Extractor returns valid JSON for the golden master.
- [ ] All known entities from the golden master are found.
- [ ] Slugs are deterministic.
- [ ] Folders are valid paths under `entities/` or `topics/`.
- [ ] Extraction JSON is saved to `.state/extracted/`.
- [ ] **Timeline events are extracted with dates and entity references.**
- [ ] **Context paragraph describes the chunk's narrative.**
- [ ] **Key entities have significance sentences.**
- [ ] **Disambiguation field is present when names are ambiguous.**
- [ ] **TUI Extractor Test screen runs extraction and shows results.**
- [ ] Total LLM cost for this phase is under $7.00 (increased for richer output).
- [ ] No code exists for the Materializer or DOX Writer.
- [ ] The Extractor is the ONLY LLM call in the pipeline.

---

## 7. Integration Notes
## 6. Integration Notes

### What Phase 2 Depends On (from Phase 1)
- `wikis/<slug>/documents/` with raw markdown pages.
- `wikis/<slug>/AGENTS.md` with ingestion instructions.
- `wikis/<slug>/.state/ingestion.json` with source tracking.

### What Phase 2 Produces (for Phase 3)
- `.state/extracted/<chunk-id>.json` for every chunk.
- Each JSON contains: entities, relationships, claims, folder assignments.

### Contract with Phase 3
Phase 3 expects:
- `.state/extracted/` contains valid JSON files.
- Every JSON has `entities`, `relationships`, and `claims` arrays.
- Every entity has a valid `folder` path.
- Every entity has a deterministic `slug`.

Phase 3 must not modify Phase 2's behavior. Phase 3 reads Phase 2's output and writes pages.

### Isolation Testing
The Extractor can be tested in complete isolation:
```typescript
import { extractChunk } from './src/agents/extractor';

const result = await extractChunk(
  'John Smith is the CEO of Acme Corp.',
  '1',
  'test.pdf',
  'AGENTS.md content here',
  [],
  []
);
```

No filesystem, no other agents, no pipeline. Just the function and the LLM.
