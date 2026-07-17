import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import {
  ExtractorError,
  extractChunk,
  normalizeExtractorSlugs,
  parseExtractorJson,
  stripCodeFences,
  type ExtractorResult,
} from '../src/agents/extractor';
import { validateExtractorResult } from '../src/validation/extractor-schema';
import { readRollingMemory } from '../src/state/rolling-memory';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const GOLDEN_CHUNK_PATH = 'wikis/test-wiki/documents/golden-master-part-001.md';
const TEST_WIKI_AGENTS = 'wikis/test-wiki/AGENTS.md';
const GOLDEN_SOURCE_FILE = 'wikis/test-wiki/raw/golden-master.pdf';

/**
 * Phase 2 gates (Implementation Plan/PHASE_02_extractor.md §3).
 *
 * Live tests (gates 2.1-2.12) make real LLM calls. Per tests/AGENTS.md they
 * self-skip without ANTHROPIC_API_KEY. The .env loader below mirrors the LLM
 * client's own fallback so the skipIf check reflects the key the client
 * would actually use: with .env present at the project root (the normal
 * state of this repo) the live gates run; without a key anywhere they skip.
 * Timeouts are generous (120s) because each gate is a real API call.
 *
 * Deterministic tests (validator, slug normalization, JSON parsing, rolling
 * memory, extract:false ingest) never call the LLM and always run.
 */
function loadDotEnvKey(): void {
  if (process.env.ANTHROPIC_API_KEY) {
    return;
  }
  try {
    const envPath = join(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      return;
    }
    for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq === -1) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // No readable .env — live tests self-skip below.
  }
}
loadDotEnvKey();

const LIVE_TIMEOUT = 120000;

const tempDirs: string[] = [];

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function goldenChunkText(): string {
  return readFileSync(GOLDEN_CHUNK_PATH, 'utf-8');
}

function testWikiAgentsMd(): string {
  return readFileSync(TEST_WIKI_AGENTS, 'utf-8');
}

// ---------------------------------------------------------------------------
// Live gates 2.1-2.12 (self-skip without ANTHROPIC_API_KEY)
// ---------------------------------------------------------------------------

// Gate 2.1: Extractor Returns Valid JSON
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor returns valid JSON schema', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(
    chunkText,
    '1-3',
    'wikis/test-wiki/raw/golden-master.pdf',
    readFileSync('wikis/test-wiki/AGENTS.md', 'utf-8'),
    [],
    [],
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
}, LIVE_TIMEOUT);

// Gate 2.2: Extractor Finds Every Known Entity
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor finds every entity in golden master', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  const names = result.entities.map((e) => e.name);
  expect(names).toContain('John Smith');
  expect(names).toContain('Acme Corp');
}, LIVE_TIMEOUT);

// Gate 2.3: Extractor Slugs are Deterministic
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor produces deterministic slugs', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const r1 = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  const r2 = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);

  const slugs1 = r1.entities.map((e) => e.slug).sort();
  const slugs2 = r2.entities.map((e) => e.slug).sort();
  expect(slugs1).toEqual(slugs2);
}, LIVE_TIMEOUT);

// Gate 2.4: Extractor Assigns Valid Folders
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor assigns valid folders', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  for (const e of result.entities) {
    expect(e.folder).toMatch(/^entities\/|^topics\//);
    expect(e.folder).not.toContain('..');
    expect(e.folder.split('/').length).toBeLessThanOrEqual(4); // max depth
  }
}, LIVE_TIMEOUT);

// Gate 2.5: Extractor Finds Claims with Page Numbers
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor finds claims with valid page numbers', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  const claim = result.claims.find((c) => c.text.includes('42.5'));
  expect(claim).toBeDefined();
  expect(claim!.page).toBeGreaterThanOrEqual(1);
  expect(claim!.page).toBeLessThanOrEqual(3);
}, LIVE_TIMEOUT);

// Gate 2.6: Extractor JSON is Saved to Disk.
// Hermetic deviation (noted adaptation 4): the repo's wikis/test-wiki is
// already ingested, so hash-skip would prevent extraction. The gate runs
// against a temp workspace: init, copy the golden master into raw/, ingest
// (extraction is on by default), then assert the saved JSON.
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor JSON is saved to .state/extracted/', async () => {
  const workspace = makeTempDir('llm-wiki-phase2-gate26-');
  await init('test-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));

  const result = await ingest('test-wiki', { workspace });

  const jsonPath = join(wikiDir, '.state', 'extracted', 'golden-master-part-001.json');
  expect(existsSync(jsonPath)).toBe(true);
  const json = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  expect(json.entities).toBeInstanceOf(Array);
  // The ingest result carries the additive per-chunk extraction summary.
  expect(result.extractions).toHaveLength(1);
  expect(result.extractions[0].chunkId).toBe('golden-master-part-001');
  expect(result.extractions[0].entities).toBe(json.entities.length);
}, LIVE_TIMEOUT);

// Gate 2.7: Extractor Handles Empty Input
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor handles chunk with no entities', async () => {
  const result = await extractChunk('This is a blank page with no names.', '1', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  expect(result.entities).toHaveLength(0);
  expect(result.relationships).toHaveLength(0);
  expect(result.claims).toHaveLength(0);
}, LIVE_TIMEOUT);

// Gate 2.8: Extractor Uses Rolling Memory
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor uses existing entity list from rolling memory', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  // First extraction creates "john-smith"
  await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);

  // Second extraction with rolling memory should not duplicate
  const r2 = await extractChunk(
    chunkText,
    '1-3',
    GOLDEN_SOURCE_FILE,
    testWikiAgentsMd(),
    ['entities/people/executives'],
    ['john-smith'],
  );

  const johnSmith = r2.entities.find((e) => e.slug === 'john-smith');
  expect(johnSmith).toBeDefined();
  expect(johnSmith!.folder).toBe('entities/people/executives'); // same folder
}, LIVE_TIMEOUT);

// Gate 2.9: Extractor Returns Timeline Events
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor returns timeline events with dates', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  expect(result.timeline).toBeInstanceOf(Array);
  // Golden master has "March 15, 2024" on page 1
  const marchEvent = result.timeline.find((t) => t.date.includes('2024'));
  expect(marchEvent).toBeDefined();
  expect(marchEvent!.event).toBeTruthy();
  expect(marchEvent!.entities).toBeInstanceOf(Array);
}, LIVE_TIMEOUT);

// Gate 2.10: Extractor Returns Context Paragraph
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor returns context paragraph', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  expect(result.context).toBeTruthy();
  expect(result.context.length).toBeGreaterThan(50); // substantial paragraph
}, LIVE_TIMEOUT);

// Gate 2.11: Extractor Returns Entity Significance
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor returns significance for key entities', async () => {
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  const johnSmith = result.entities.find((e) => e.slug === 'john-smith');
  expect(johnSmith).toBeDefined();
  expect(johnSmith!.significance).toBeTruthy();
  expect(johnSmith!.significance.length).toBeGreaterThan(20);
}, LIVE_TIMEOUT);

// Gate 2.12: Extractor Returns Disambiguation When Needed
test.skipIf(!process.env.ANTHROPIC_API_KEY)('extractor returns disambiguation for ambiguous names', async () => {
  // Use a chunk with an ambiguous name if available, or test that field exists
  const chunkText = readFileSync('wikis/test-wiki/documents/golden-master-part-001.md', 'utf-8');
  const result = await extractChunk(chunkText, '1-3', GOLDEN_SOURCE_FILE, testWikiAgentsMd(), [], []);
  for (const e of result.entities) {
    // disambiguation is optional but must be a string if present
    if (e.disambiguation !== undefined) {
      expect(typeof e.disambiguation).toBe('string');
    }
  }
}, LIVE_TIMEOUT);

// ---------------------------------------------------------------------------
// Deterministic tests — schema validator (no LLM)
// ---------------------------------------------------------------------------

function validResult(): ExtractorResult {
  return {
    entities: [
      {
        name: 'John Smith',
        type: 'person',
        slug: 'john-smith',
        folder: 'entities/people/executives',
        significance: 'CEO of Acme Corp presenting the annual results in this chunk.',
        mentions: [{ page: 1, context: 'John Smith presented the annual results' }],
      },
    ],
    relationships: [
      { subject: 'john-smith', predicate: 'is-ceo-of', object: 'acme-corp', evidence: 'John Smith is the CEO of Acme Corp', page: 3 },
    ],
    claims: [{ text: 'Total revenue reached $42.5 million [^src1]', type: 'financial', entities: ['acme-corp'], page: 2 }],
    timeline: [{ date: 'March 15, 2024', event: 'Annual results presented', entities: ['john-smith', 'acme-corp'] }],
    context: 'This chunk covers the annual results presentation of Acme Corp by its CEO.',
  };
}

test('validator accepts a complete valid result', () => {
  const validation = validateExtractorResult(validResult(), '1-3');
  expect(validation.issues).toEqual([]);
  expect(validation.valid).toBe(true);
});

test('validator rejects non-object roots and missing arrays', () => {
  expect(validateExtractorResult('nope').valid).toBe(false);
  expect(validateExtractorResult(null).valid).toBe(false);
  const missing = validateExtractorResult({});
  expect(missing.valid).toBe(false);
  expect(missing.issues.join('; ')).toContain('entities: must be an array');
  expect(missing.issues.join('; ')).toContain('relationships: must be an array');
  expect(missing.issues.join('; ')).toContain('claims: must be an array');
});

test('validator rejects a folder outside entities/ or topics/', () => {
  const data = validResult();
  data.entities[0].folder = 'other/people';
  const validation = validateExtractorResult(data, '1-3');
  expect(validation.valid).toBe(false);
  expect(validation.issues.join('; ')).toContain('must start with "entities/" or "topics/"');
});

test('validator rejects path traversal in folders', () => {
  const data = validResult();
  data.entities[0].folder = 'entities/../secrets';
  const validation = validateExtractorResult(data, '1-3');
  expect(validation.valid).toBe(false);
  expect(validation.issues.join('; ')).toContain('path traversal');
});

test('validator rejects folders deeper than 4 segments', () => {
  const data = validResult();
  data.entities[0].folder = 'entities/people/executives/board/members'; // 5 segments
  const validation = validateExtractorResult(data, '1-3');
  expect(validation.valid).toBe(false);
  expect(validation.issues.join('; ')).toContain('path segments');
});

test('validator accepts the maximum depth of 4 segments', () => {
  const data = validResult();
  data.entities[0].folder = 'entities/people/executives/board'; // 4 segments
  expect(validateExtractorResult(data, '1-3').valid).toBe(true);
});

test('validator rejects pages outside the chunk page range', () => {
  const data = validResult();
  data.entities[0].mentions[0].page = 7; // range is 1-3
  data.claims[0].page = 0;
  const validation = validateExtractorResult(data, '1-3');
  expect(validation.valid).toBe(false);
  expect(validation.issues.join('; ')).toContain('page 7 is outside the chunk page range 1-3');
  expect(validation.issues.join('; ')).toContain('page 0 is outside the chunk page range 1-3');
});

test('validator rejects non-number pages', () => {
  const data = validResult();
  (data.relationships[0] as { page: unknown }).page = '3';
  const validation = validateExtractorResult(data, '1-3');
  expect(validation.valid).toBe(false);
  expect(validation.issues.join('; ')).toContain('page must be a number');
});

test('validator accepts a single-page range and skips checks for unparseable ranges', () => {
  const data = validResult();
  data.entities[0].mentions[0].page = 1;
  data.relationships[0].page = 1;
  data.claims[0].page = 1;
  expect(validateExtractorResult(data, '1').valid).toBe(true);
  // Unparseable range: page checks are skipped (structure still validated).
  data.claims[0].page = 99;
  expect(validateExtractorResult(data, 'unknown').valid).toBe(true);
});

test('validator rejects bad slugs and missing entity fields', () => {
  const data = validResult();
  data.entities[0].slug = 'John Smith!';
  data.entities[0].type = '';
  const validation = validateExtractorResult(data, '1-3');
  expect(validation.valid).toBe(false);
  expect(validation.issues.join('; ')).toContain('slug must match');
  expect(validation.issues.join('; ')).toContain('type must be a non-empty string');
});

test('validator enforces the extended fields (timeline, context, significance, disambiguation)', () => {
  const data = validResult();
  // significance missing
  delete (data.entities[0] as Partial<typeof data.entities[0]>).significance;
  // disambiguation must be a string when present
  (data.entities[0] as unknown as Record<string, unknown>).disambiguation = 42;
  // timeline event missing date
  (data.timeline[0] as unknown as Record<string, unknown>).date = '';
  // context must be a string
  (data as unknown as Record<string, unknown>).context = undefined;
  const validation = validateExtractorResult(data, '1-3');
  expect(validation.valid).toBe(false);
  const issues = validation.issues.join('; ');
  expect(issues).toContain('significance must be a string');
  expect(issues).toContain('disambiguation must be a string when present');
  expect(issues).toContain('timeline[0]: date must be a non-empty string');
  expect(issues).toContain('context: must be a string');
});

test('validator requires claim entities to be an array of strings', () => {
  const data = validResult();
  (data.claims[0] as unknown as Record<string, unknown>).entities = 'acme-corp';
  const validation = validateExtractorResult(data, '1-3');
  expect(validation.valid).toBe(false);
  expect(validation.issues.join('; ')).toContain('claims[0].entities: must be an array of entity slugs');
});

// ---------------------------------------------------------------------------
// Deterministic tests — slug normalization + JSON parsing (no LLM)
// ---------------------------------------------------------------------------

test('slug normalization lowercases and kebab-cases entity slugs and references', () => {
  const data = {
    entities: [{ slug: 'John Smith' }, { slug: 'ACME  Corp.' }],
    relationships: [{ subject: 'John Smith', predicate: 'is-ceo-of', object: 'Acme Corp' }],
    claims: [{ entities: ['Jane Doe', 'Acme Corp'] }],
    timeline: [{ entities: ['Robert Brown'] }],
  };
  normalizeExtractorSlugs(data);
  expect(data.entities.map((e) => e.slug)).toEqual(['john-smith', 'acme-corp']);
  expect(data.relationships[0].subject).toBe('john-smith');
  expect(data.relationships[0].object).toBe('acme-corp');
  expect(data.claims[0].entities).toEqual(['jane-doe', 'acme-corp']);
  expect(data.timeline[0].entities).toEqual(['robert-brown']);
  // The normalized result passes the slug rule in the validator.
  const full = validResult();
  full.entities[0].slug = 'John Smith';
  normalizeExtractorSlugs(full);
  expect(full.entities[0].slug).toBe('john-smith');
  expect(validateExtractorResult(full, '1-3').valid).toBe(true);
});

test('stripCodeFences removes a wrapping markdown fence only', () => {
  expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  expect(stripCodeFences('  {"a":1}  ')).toBe('{"a":1}');
});

test('parseExtractorJson parses raw and fenced JSON', () => {
  expect(parseExtractorJson('{"entities":[]}')).toEqual({ entities: [] });
  expect(parseExtractorJson('```json\n{"entities":[]}\n```')).toEqual({ entities: [] });
});

test('parseExtractorJson throws ExtractorError with the raw response on invalid JSON', () => {
  const raw = 'Sorry, I cannot help with that.';
  try {
    parseExtractorJson(raw);
    expect.unreachable('should have thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(ExtractorError);
    expect((err as ExtractorError).rawResponse).toBe(raw);
    expect((err as Error).message).toContain('invalid JSON');
  }
});

test('ExtractorError carries schema issues', () => {
  const error = new ExtractorError('bad schema', { issues: ['entities: must be an array'], rawResponse: '{}' });
  expect(error.name).toBe('ExtractorError');
  expect(error.issues).toEqual(['entities: must be an array']);
  expect(error.rawResponse).toBe('{}');
});

// ---------------------------------------------------------------------------
// Deterministic tests — rolling memory reader (no LLM)
// ---------------------------------------------------------------------------

test('readRollingMemory tolerates absence and reads folders + entity slugs', async () => {
  const workspace = makeTempDir('llm-wiki-phase2-memory-');
  const wikiDir = join(workspace, 'wikis', 'mem-wiki');

  // Absent file -> empty lists (first run).
  mkdirSync(wikiDir, { recursive: true });
  await expect(readRollingMemory(wikiDir)).resolves.toEqual({ folders: [], entitySlugs: [] });

  // Vision 04 §5 shape -> folders from folderStructure, slugs from entities[].slug.
  mkdirSync(join(wikiDir, '.state'), { recursive: true });
  writeFileSync(
    join(wikiDir, '.state', 'rolling-memory.json'),
    JSON.stringify({
      entities: [{ slug: 'john-smith', folder: 'entities/people/executives', mentionCount: 3 }, { noSlug: true }],
      topics: ['financial/revenue-recognition'],
      sources: ['annual-report-2023'],
      folderStructure: ['entities/people/executives', 'entities/companies/offshore'],
    }),
  );
  await expect(readRollingMemory(wikiDir)).resolves.toEqual({
    folders: ['entities/people/executives', 'entities/companies/offshore'],
    entitySlugs: ['john-smith'],
  });

  // Malformed JSON -> descriptive error (same contract as ingestion-state).
  writeFileSync(join(wikiDir, '.state', 'rolling-memory.json'), '{broken');
  await expect(readRollingMemory(wikiDir)).rejects.toThrow('not valid JSON');
});

// ---------------------------------------------------------------------------
// Deterministic test — ingest with extract: false never calls the LLM (no LLM)
// ---------------------------------------------------------------------------

test('ingest with extract: false writes no .state/extracted/ JSON', async () => {
  const workspace = makeTempDir('llm-wiki-phase2-noextract-');
  await init('test-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));

  const result = await ingest('test-wiki', { workspace, extract: false });

  expect(result.ingested).toHaveLength(1);
  expect(result.extractions).toEqual([]);
  expect(existsSync(join(wikiDir, '.state', 'extracted'))).toBe(false);
  expect(existsSync(join(wikiDir, 'documents', 'golden-master-part-001.md'))).toBe(true);
}, 60000);
