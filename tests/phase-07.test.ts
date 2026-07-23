import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import * as llmClient from '../src/llm/client';
import { callLLM } from '../src/llm/client';
import { request as undiciRequest } from 'undici';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { extractChunk, normalizeExtractorSlugs } from '../src/agents/extractor';
import type { ExtractorResult } from '../src/agents/extractor';
import { writeEntitySynthesis, writeTopicSynthesis } from '../src/agents/synthesis';
import { writeDoxContracts, writeWorkspaceIndex } from '../src/dox-writer';
import { readWikiLanguage } from '../src/state/language';
import { readSynthesisReport } from '../src/state/synthesis-report';
import { slugify } from '../src/utils/slug';
import {
  applyLanguageDirective,
  buildLanguageDirective,
  getLanguage,
  transliterate,
} from '../src/utils/language';
import type { EntityPageData } from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';
import type { ChunkExtraction } from '../src/commands/extract-chunk';

// Gate 7.10 mocks the HTTP layer: undici's native exports cannot be spied on
// ("Cannot redefine property"), so the module is mocked (hoisted by vitest).
vi.mock('undici', () => ({ request: vi.fn() }));
const mockUndiciRequest = vi.mocked(undiciRequest);

const GOLDEN_MASTER_DA_PDF = 'test-pdfs/golden-master-da.pdf';
const tempDirs: string[] = [];

afterAll(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * Danish extraction fixture with RAW (un-normalized) LLM-style slugs — the
 * real Extractor normalizes them with the input language before validation,
 * which is exactly what gates 7.3/7.6 exercise.
 */
function danishExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Søren Møller',
        type: 'person',
        slug: 'Søren Møller',
        folder: 'entities/people',
        significance: 'Adm. direktør for Møbler A/S',
        mentions: [{ page: 1, context: 'Søren Møller præsenterede årsresultatet for Møbler A/S den' }],
      },
      {
        name: 'København',
        type: 'location',
        slug: 'København',
        folder: 'entities/places',
        significance: 'Hovedkontorets by',
        mentions: [{ page: 1, context: 'på hovedkontoret i København' }],
      },
      {
        name: 'Møbler A/S',
        type: 'company',
        slug: 'Møbler A/S',
        folder: 'entities/companies',
        significance: 'Selskabet bag årsrapporten',
        mentions: [{ page: 1, context: 'årsresultatet for Møbler A/S den' }],
      },
    ],
    relationships: [
      {
        subject: 'Søren Møller',
        predicate: 'is-ceo-of',
        object: 'Møbler A/S',
        evidence: 'Søren Møller præsenterede årsresultatet for Møbler A/S',
        page: 1,
      },
    ],
    claims: [
      {
        text: 'Virksomheden omsatte for 12,5 millioner kr. i 2024',
        type: 'financial',
        entities: ['Søren Møller', 'Møbler A/S'],
        page: 1,
      },
    ],
    timeline: [
      {
        date: '2025-03-12',
        event: 'Søren Møller præsenterede årsresultatet i København',
        entities: ['Søren Møller'],
      },
    ],
    context: 'Årsrapport 2024 for Møbler A/S.',
  };
}

/** Test-only extractChunkFn that persists the extracted JSON like the real path. */
function stubExtractChunkFn(extraction: ExtractorResult) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const extractedDir = join(wikiDir, '.state', 'extracted');
    mkdirSync(extractedDir, { recursive: true });
    const jsonPath = join(extractedDir, `${chunkId}.json`);
    writeFileSync(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return {
      chunkId,
      result: extraction,
      jsonPath,
      jsonRelativePath: `.state/extracted/${chunkId}.json`,
    };
  };
}

/**
 * Pre-normalized Danish fixture for stub-based tests: the stub bypasses
 * extractChunk (where slug normalization lives), so it must persist slugs
 * exactly as the real Extractor would have written them (vision `04` §9.3).
 */
function normalizedDanishExtraction(): ExtractorResult {
  const extraction = danishExtraction() as unknown as Record<string, unknown>;
  normalizeExtractorSlugs(extraction, 'da');
  return extraction as unknown as ExtractorResult;
}

// ---------------------------------------------------------------------------
// Gate 7.1: Transliteration Maps Are Correct
// ---------------------------------------------------------------------------
test('gate 7.1: transliteration maps per language', () => {
  expect(slugify('Søren Møller', 'da')).toBe('soeren-moeller');
  expect(slugify('København', 'da')).toBe('koebenhavn');
  expect(slugify('Årsrapport 2024', 'da')).toBe('aarsrapport-2024');
  expect(slugify('Müller GmbH', 'de')).toBe('mueller-gmbh');
  expect(slugify('Straße', 'de')).toBe('strasse');
  expect(slugify('Göteborg', 'sv')).toBe('goteborg');
  expect(slugify('François Migné', 'fr')).toBe('francois-migne');

  // Supplementary: the remaining languages and the map-before-NFD ordering.
  expect(slugify('Blåbær', 'no')).toBe('blaabaer'); // Norwegian shares the Danish map
  expect(slugify('Smörgås', 'sv')).toBe('smorgas'); // Swedish å→a, NOT å→aa
  expect(slugify('España', 'es')).toBe('espana'); // NFD stripping covers ñ
  expect(slugify('Æblegrød', 'da')).toBe('aeblegroed'); // uppercase variants
  // The explicit map must run BEFORE NFD, or Danish å would degrade to 'a'.
  expect(transliterate('Å', 'da')).toBe('Aa');
  expect(transliterate('å', 'sv')).toBe('a');
  expect(getLanguage('da').nativeName).toBe('Dansk');
  expect(() => getLanguage('jp')).toThrow("Unsupported language code 'jp'");
});

// ---------------------------------------------------------------------------
// Gate 7.2: English Default Is Byte-Identical
// ---------------------------------------------------------------------------
test('gate 7.2: no language set behaves exactly as before', () => {
  expect(slugify('Søren Møller')).toBe('s-ren-m-ller'); // pre-existing ASCII-only behavior
  expect(slugify('Annual Report 2024')).toBe('annual-report-2024');
  expect(buildLanguageDirective('extractor', 'en', 'en')).toBe('');
  expect(buildLanguageDirective('synthesis', 'en', 'en')).toBe('');
  expect(buildLanguageDirective('dox', 'en', 'en')).toBe('');
});

test('gate 7.2b: empty directive removes the LANGUAGE block byte-for-byte', () => {
  // All six prompt templates carry the block; filling it with the empty
  // directive must restore the pre-Phase-7 prompt exactly (vision `04` §9.4).
  const templates = [
    'extractor.prompt.txt',
    'synthesis.prompt.txt',
    'synthesis-permissive.prompt.txt',
    'synthesis-topic.prompt.txt',
    'synthesis-topic-permissive.prompt.txt',
    'dox-writer.prompt.txt',
  ];
  for (const file of templates) {
    const template = readFileSync(join('prompts', file), 'utf-8');
    expect(template, file).toContain('=== LANGUAGE ===\n{languageDirective}\n\n');
    const stripped = applyLanguageDirective(template, '');
    expect(stripped, file).not.toContain('LANGUAGE');
    expect(stripped, file).not.toContain('{languageDirective}');
    expect(stripped, file).toBe(template.split('=== LANGUAGE ===\n{languageDirective}\n\n').join(''));
    const filled = applyLanguageDirective(template, 'DIRECTIVE-TEXT');
    expect(filled, file).toContain('=== LANGUAGE ===\nDIRECTIVE-TEXT');
    expect(filled, file).not.toContain('{languageDirective}');
  }
});

// ---------------------------------------------------------------------------
// Gate 7.3: Extractor Slug Normalization Uses the Input Language
// ---------------------------------------------------------------------------
test('gate 7.3: normalizeExtractorSlugs transliterates with input language', () => {
  const data = {
    entities: [{ slug: 'Søren Møller' }],
    relationships: [{ subject: 'Søren Møller', object: 'Møbler A/S' }],
    claims: [{ entities: ['Søren Møller', 'København'] }],
    timeline: [{ entities: ['Åse Lindberg'] }],
  };
  normalizeExtractorSlugs(data, 'da');
  expect(data.entities[0].slug).toBe('soeren-moeller');
  expect(data.relationships[0].subject).toBe('soeren-moeller');
  expect(data.relationships[0].object).toBe('moebler-a-s');
  expect(data.claims[0].entities).toEqual(['soeren-moeller', 'koebenhavn']);
  expect(data.timeline[0].entities).toEqual(['aase-lindberg']);

  // Omitted language keeps the byte-identical pre-Phase-7 behavior.
  const englishData = { entities: [{ slug: 'Søren Møller' }], relationships: [], claims: [], timeline: [] };
  normalizeExtractorSlugs(englishData);
  expect(englishData.entities[0].slug).toBe('s-ren-m-ller');
});

// ---------------------------------------------------------------------------
// Gate 7.9 (UAT 7.2 extension): Folder Names and Claim Types Are Transliterated
// UAT 7.2 surfaced that entity.folder and claim.type (the topic slug source)
// bypassed transliteration — a Danish folder landed on disk as raw
// 'entities/companies/møbler'. Vision `05` §2.1 requires transliterated
// kebab-case folders.
// ---------------------------------------------------------------------------
test('gate 7.9: folder segments and claim types transliterate with input language', () => {
  const data = {
    entities: [{ slug: 'Møbler A/S', folder: 'entities/companies/Møbler' }],
    relationships: [],
    claims: [{ type: 'Økonomi', entities: [] }],
    timeline: [],
  };
  normalizeExtractorSlugs(data, 'da');
  expect(data.entities[0].folder).toBe('entities/companies/moebler');
  expect(data.claims[0].type).toBe('oekonomi');

  // End-to-end: a Danish-folder extraction never creates a non-ASCII folder.
  const endToEnd = {
    entities: [
      { slug: 'København', folder: 'entities/locations/Danske Byer' },
      { slug: 'Aarhus', folder: 'entities/locations/Danske Byer' },
    ],
    relationships: [],
    claims: [{ type: 'Fast Ejendom', entities: ['København'] }],
    timeline: [],
  };
  normalizeExtractorSlugs(endToEnd, 'da');
  expect(endToEnd.entities[0].folder).toBe('entities/locations/danske-byer');
  expect(endToEnd.claims[0].type).toBe('fast-ejendom');

  // ASCII kebab-case folders/types pass through unchanged (existing-folder
  // reuse and the byte-identical English path are unaffected).
  const ascii = {
    entities: [{ slug: 'x', folder: 'entities/people/executives' }],
    relationships: [],
    claims: [{ type: 'financial', entities: [] }],
    timeline: [],
  };
  normalizeExtractorSlugs(ascii, 'da');
  expect(ascii.entities[0].folder).toBe('entities/people/executives');
  expect(ascii.claims[0].type).toBe('financial');
});

// ---------------------------------------------------------------------------
// Gate 7.4: Language Directive Reaches Every Prompt
// ---------------------------------------------------------------------------
test('gate 7.4: extractor/synthesis/dox prompts contain the directive when languages are set', async () => {
  const captured: Array<{ prompt: string; callType?: string }> = [];
  vi.spyOn(llmClient, 'callLLM').mockImplementation(
    async (prompt: string, _system?: string, options?: { callType?: string }) => {
      captured.push({ prompt, callType: options?.callType });
      return JSON.stringify({ entities: [], relationships: [], claims: [], timeline: [], context: '' });
    },
  );

  const language = { input: 'da' as const, output: 'en' as const };

  // Extractor
  await extractChunk('Søren Møller præsenterede årsresultatet.', '1-2', 'golden-master-da.pdf', 'AGENTS', [], [], {
    language,
  });
  const extractorPrompt = captured.find((call) => call.callType === 'extractor')!.prompt;
  expect(extractorPrompt).toContain('Danish');
  expect(extractorPrompt).toContain('=== LANGUAGE ===');
  expect(extractorPrompt).not.toContain('{languageDirective}');

  // Synthesis Writer (entity)
  const entityData = {
    title: 'Søren Møller',
    slug: 'soeren-moeller',
    folder: 'entities/people',
    type: 'person',
    wiki: 'en-wiki',
    significance: 'Adm. direktør',
    mentions: [],
    relationships: [],
    claims: [],
    timeline: [],
    slugToTitle: {},
  } as unknown as EntityPageData;
  await writeEntitySynthesis(entityData, 'AGENTS', undefined, language);
  const synthesisPrompt = captured.find((call) => call.callType === 'synthesis')!.prompt;
  expect(synthesisPrompt).toContain('English');
  expect(synthesisPrompt).not.toContain('{languageDirective}');

  // Synthesis Writer (topic — shares the same prompt builder)
  const topicData = {
    title: 'Financial',
    slug: 'financial',
    folder: 'topics/financial',
    wiki: 'en-wiki',
    claims: [],
    entities: [],
    slugToTitle: {},
  } as unknown as TopicPageData;
  await writeTopicSynthesis(topicData, 'AGENTS', undefined, language);
  const topicPrompt = captured.find((call) => call.callType === 'topic-synthesis')!.prompt;
  expect(topicPrompt).toContain('English');
  expect(topicPrompt).not.toContain('{languageDirective}');

  // DOX Writer (LLM mode on a minimal wiki)
  const workspace = makeTempDir('p7-directive-');
  await init('dox-wiki', { workspace });
  const peopleDir = join(workspace, 'wikis', 'dox-wiki', 'entities', 'people');
  mkdirSync(peopleDir, { recursive: true });
  writeFileSync(
    join(peopleDir, 'soeren-moeller.md'),
    matter.stringify('\nPage body.\n', {
      title: 'Søren Møller',
      type: 'entity',
      updated: new Date().toISOString(),
    }),
    'utf-8',
  );
  await writeDoxContracts('dox-wiki', { workspace, doxLlm: true, language });
  const doxPrompts = captured.filter((call) => call.callType === 'dox-writer');
  expect(doxPrompts.length).toBeGreaterThan(0);
  for (const call of doxPrompts) {
    expect(call.prompt).toContain('English');
    expect(call.prompt).not.toContain('{languageDirective}');
  }
});

test('gate 7.4b: English/English prompts carry no LANGUAGE block at all', async () => {
  const captured: string[] = [];
  vi.spyOn(llmClient, 'callLLM').mockImplementation(async (prompt: string) => {
    captured.push(prompt);
    return JSON.stringify({ entities: [], relationships: [], claims: [], timeline: [], context: '' });
  });
  await extractChunk('John Smith presented the results.', '1-2', 'golden-master.pdf', 'AGENTS', [], []);
  expect(captured[0]).not.toContain('LANGUAGE');
  expect(captured[0]).not.toContain('{languageDirective}');
});

// ---------------------------------------------------------------------------
// Gate 7.5: Language State Round-Trip
// ---------------------------------------------------------------------------
test('gate 7.5: init and ingest persist language state', async () => {
  const workspace = makeTempDir('p7-state-');
  await init('dk-wiki', { workspace, outputLanguage: 'da' });
  const wikiDir = join(workspace, 'wikis', 'dk-wiki');

  const constitution = readFileSync(join(wikiDir, 'AGENTS.md'), 'utf-8');
  expect(constitution).toContain('Danish');
  expect(constitution).not.toContain('{{OUTPUT_LANGUAGE}}');

  let state = await readWikiLanguage(wikiDir);
  expect(state.outputLanguage).toBe('da');
  expect(state.lastInputLanguage).toBe('en');

  copyFileSync(GOLDEN_MASTER_DA_PDF, join(wikiDir, 'raw', 'golden-master-da.pdf'));
  const result = await ingest('dk-wiki', {
    workspace,
    inputLanguage: 'da',
    extractChunkFn: stubExtractChunkFn(normalizedDanishExtraction()),
  });
  // Output language resolved from the wiki's stored state (no flag passed).
  expect(result.languages).toEqual({ input: 'da', output: 'da' });

  state = await readWikiLanguage(wikiDir);
  expect(state.lastInputLanguage).toBe('da');
  expect(state.outputLanguage).toBe('da');

  // Absent file (pre-Phase-7 wiki) → English defaults.
  const legacyDir = makeTempDir('p7-legacy-');
  const legacy = await readWikiLanguage(legacyDir);
  expect(legacy).toEqual({ outputLanguage: 'en', lastInputLanguage: 'en' });
});

// ---------------------------------------------------------------------------
// Gate 7.6: End-to-End Danish Ingest (LLM-Free)
// Drives the REAL Extractor path (prompt fill, JSON parse, slug normalization
// with the input language, schema validation) with a mocked callLLM, so the
// transliteration happens in production code, not in the fixture.
// ---------------------------------------------------------------------------
test('gate 7.6: Danish PDF materializes transliterated pages with verbatim Danish titles', async () => {
  const workspace = makeTempDir('p7-e2e-');
  await init('en-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'en-wiki');
  copyFileSync(GOLDEN_MASTER_DA_PDF, join(wikiDir, 'raw', 'golden-master-da.pdf'));

  vi.spyOn(llmClient, 'callLLM').mockImplementation(async () => JSON.stringify(danishExtraction()));

  await ingest('en-wiki', { workspace, inputLanguage: 'da' });

  const personPath = join(wikiDir, 'entities', 'people', 'soeren-moeller.md');
  const placePath = join(wikiDir, 'entities', 'places', 'koebenhavn.md');
  const companyPath = join(wikiDir, 'entities', 'companies', 'moebler-a-s.md');
  expect(existsSync(personPath)).toBe(true);
  expect(existsSync(placePath)).toBe(true);
  expect(existsSync(companyPath)).toBe(true);

  // Deviation from the gate's literal `title: "Søren Møller"` expectation: the
  // entity-page writer only quotes YAML-sensitive titles (escapeYamlString),
  // so the title is written unquoted. The pass criterion — file names
  // transliterated, titles verbatim — is verified via the parsed frontmatter.
  const page = readFileSync(personPath, 'utf-8');
  expect(matter(page).data.title).toBe('Søren Møller');
  expect(page).toContain('Søren Møller præsenterede årsresultatet'); // Layer 2 verbatim Danish
  expect(matter(readFileSync(placePath, 'utf-8')).data.title).toBe('København');
});

// ---------------------------------------------------------------------------
// Gate 7.7: Cross-Language Synthesis Passes Preservation
// ---------------------------------------------------------------------------
test('gate 7.7: English Layer 1 + verbatim Danish Layer 2 passes the preservation check', async () => {
  const workspace = makeTempDir('p7-cross-');
  await init('en-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'en-wiki');
  copyFileSync(GOLDEN_MASTER_DA_PDF, join(wikiDir, 'raw', 'golden-master-da.pdf'));

  // Single-entity fixture so one canned synthesis page serves every call.
  const extraction: ExtractorResult = {
    entities: [danishExtraction().entities[0]],
    relationships: danishExtraction().relationships,
    claims: [
      {
        text: 'Virksomheden omsatte for 12,5 millioner kr. i 2024',
        type: 'financial',
        entities: ['Søren Møller'],
        page: 1,
      },
    ],
    timeline: danishExtraction().timeline,
    context: 'Årsrapport 2024 for Møbler A/S.',
  };
  const danishClaimText = 'Virksomheden omsatte for 12,5 millioner kr. i 2024';

  const now = new Date().toISOString();
  const englishProseDanishDetailEntity = [
    '---',
    'title: "Søren Møller"',
    'type: entity',
    'wiki: en-wiki',
    `updated: ${now}`,
    '---',
    '',
    'English synthesis prose: Søren Møller presented the annual results of Møbler A/S in Copenhagen. [^src1]',
    '',
    '## Mentions',
    '',
    '- Page 1: "Søren Møller præsenterede årsresultatet for Møbler A/S den" [^src1]',
    '',
    '## Relationships',
    '',
    '- [[moebler-a-s]] — Is Ceo Of: "Søren Møller præsenterede årsresultatet for Møbler A/S" [^src1]',
    '',
    '## Claims',
    '',
    `- ${danishClaimText} [^src1]`,
    '',
    '## Timeline',
    '',
    '- 2025-03-12: Søren Møller præsenterede årsresultatet i København',
    '',
    '## Sources',
    '',
    '[^src1]: golden-master-da.pdf, pages 1-2',
    '',
  ].join('\n');
  const englishProseDanishDetailTopic = [
    '---',
    'title: "Financial"',
    'type: topic',
    'wiki: en-wiki',
    `updated: ${now}`,
    '---',
    '',
    'English topic synthesis prose covering the financial claims. [^src1]',
    '',
    '## Claims',
    '',
    `- ${danishClaimText} [^src1]`,
    '',
    '## Sources',
    '',
    '[^src1]: golden-master-da.pdf, pages 1-2',
    '',
  ].join('\n');

  vi.spyOn(llmClient, 'callLLM').mockImplementation(
    async (_prompt: string, _system?: string, options?: { callType?: string }) => {
      if (options?.callType === 'extractor') {
        return JSON.stringify(extraction);
      }
      if (options?.callType === 'topic-synthesis' || options?.callType === 'permissive-topic-synthesis') {
        return englishProseDanishDetailTopic;
      }
      return englishProseDanishDetailEntity;
    },
  );

  const result = await ingest('en-wiki', { workspace, inputLanguage: 'da', synthesis: true });
  expect(result.extractions).toBeDefined();
  expect(result.extractions.length).toBe(1);
  expect(result.validation).toBeDefined();
  // Strict synthesis passed for every page — no permissive fallback, no conflict.
  expect(result.synthesized).toBe(1);
  expect(result.synthesizedPermissive).toBe(0);
  expect(result.synthesisConflicts).toBe(0);
  expect(result.synthesizedTopics).toBe(1);
  expect(result.topicConflicts).toBe(0);

  const page = readFileSync(join(wikiDir, 'entities', 'people', 'soeren-moeller.md'), 'utf-8');
  expect(page).toContain('English synthesis prose'); // Layer 1 in the output language
  expect(page).toContain(danishClaimText); // Layer 2 verbatim Danish
  expect(page).toContain('Søren Møller præsenterede årsresultatet for Møbler A/S den');
});

// ---------------------------------------------------------------------------
// Gate 7.8: Input-Language-Change Warning Fires
// ---------------------------------------------------------------------------
test('gate 7.8: ingest warns when input language differs from the last run', async () => {
  const workspace = makeTempDir('p7-warn-');
  await init('test-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  copyFileSync(GOLDEN_MASTER_DA_PDF, join(wikiDir, 'raw', 'golden-master-da.pdf'));

  const stub = stubExtractChunkFn(normalizedDanishExtraction());
  await ingest('test-wiki', { workspace, extractChunkFn: stub }); // first run: en

  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  await ingest('test-wiki', { workspace, inputLanguage: 'da', extractChunkFn: stub });
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('differs from the last run'));
  spy.mockRestore();

  // Supplementary: NO warning when the input language matches the last run,
  // and none on the very first run (no extractions yet).
  const spyQuiet = vi.spyOn(console, 'log').mockImplementation(() => {});
  await ingest('test-wiki', { workspace, inputLanguage: 'da', extractChunkFn: stub });
  expect(spyQuiet).not.toHaveBeenCalledWith(expect.stringContaining('differs from the last run'));
  spyQuiet.mockRestore();

  const fresh = makeTempDir('p7-warn-first-');
  await init('first-wiki', { workspace: fresh });
  copyFileSync(GOLDEN_MASTER_DA_PDF, join(fresh, 'wikis', 'first-wiki', 'raw', 'golden-master-da.pdf'));
  const spyFirst = vi.spyOn(console, 'log').mockImplementation(() => {});
  await ingest('first-wiki', {
    workspace: fresh,
    inputLanguage: 'da',
    extractChunkFn: stubExtractChunkFn(normalizedDanishExtraction()),
  });
  expect(spyFirst).not.toHaveBeenCalledWith(expect.stringContaining('differs from the last run'));
  spyFirst.mockRestore();
});

// ---------------------------------------------------------------------------
// v1.1.0 AMENDMENT: Bounded Retry (user-ratified 2026-07-20; vision 04 §6 /
// 07 §5). Language-agnostic — applies to every ingest in every wiki.
// ---------------------------------------------------------------------------

// Gate 7.10: callLLM Retries Only Transient Failures
// ---------------------------------------------------------------------------
test('gate 7.10: callLLM retries 429/5xx with backoff, never 4xx, default is no retry', async () => {
  process.env.ANTHROPIC_API_KEY = 'gate-7-10-key';
  const successBody = () => ({
    statusCode: 200,
    body: { json: async () => ({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } }) },
  });
  const errorBody = (statusCode: number) => ({
    statusCode,
    body: { json: async () => ({ error: { message: `status ${statusCode}` } }) },
  });
  try {
    // Transient 529 x2 then success → resolves on the 3rd attempt.
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(errorBody(529) as never)
      .mockResolvedValueOnce(errorBody(529) as never)
      .mockResolvedValueOnce(successBody() as never);
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(3);

    // 429 is transient too: succeeds on the 2nd attempt.
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(errorBody(429) as never)
      .mockResolvedValueOnce(successBody() as never);
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(2);

    // Deterministic 400 → immediate throw, exactly 1 attempt.
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(errorBody(400) as never)
      .mockResolvedValueOnce(successBody() as never);
    await expect(callLLM('p', undefined, { maxRetries: 2 })).rejects.toThrow('HTTP 400');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);

    // Default (maxRetries omitted) → frozen no-retry behavior: 1 attempt.
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockResolvedValueOnce(errorBody(529) as never)
      .mockResolvedValueOnce(successBody() as never);
    await expect(callLLM('p')).rejects.toThrow('HTTP 529');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(1);

    // Network error (undici throws) → retried, then succeeds.
    mockUndiciRequest.mockReset();
    mockUndiciRequest
      .mockRejectedValueOnce(new Error('socket hang up') as never)
      .mockResolvedValueOnce(successBody() as never);
    await expect(callLLM('p', undefined, { maxRetries: 2 })).resolves.toBe('ok');
    expect(mockUndiciRequest).toHaveBeenCalledTimes(2);

    mockUndiciRequest.mockReset();
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
  }
}, 30000);

// Gate 7.11: Synthesis Chain Retries Quality Failures
// ---------------------------------------------------------------------------
function singleEntityExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'John Smith',
        type: 'person',
        slug: 'john-smith',
        folder: 'entities/people',
        significance: 'CEO of Acme Corp',
        mentions: [{ page: 1, context: 'John Smith, CEO of Acme Corp' }],
      },
    ],
    relationships: [],
    claims: [
      { text: 'Revenue was $42.5M in Q3 2024', type: 'financial', entities: ['john-smith'], page: 2 },
    ],
    timeline: [],
    context: 'Annual results.',
  };
}

function completePage(wiki: string): string {
  return [
    '---',
    'title: "John Smith"',
    'type: entity',
    `wiki: ${wiki}`,
    `updated: ${new Date().toISOString()}`,
    '---',
    '',
    'Synthesis prose. [^src1]',
    '',
    '## Mentions',
    '',
    '- Page 1: "John Smith, CEO of Acme Corp" [^src1]',
    '',
    '## Claims',
    '',
    '- Revenue was $42.5M in Q3 2024 [^src1]',
    '',
    '## Sources',
    '',
    '[^src1]: golden-master.pdf, pages 1-3',
    '',
  ].join('\n');
}

const INCOMPLETE_PAGE = [
  '---',
  'title: "John Smith"',
  'type: entity',
  'wiki: w',
  `updated: ${new Date().toISOString()}`,
  '---',
  '',
  'Prose that drops the claim entirely. [^src1]',
  '',
  '## Mentions',
  '',
  '- Page 1: "John Smith, CEO of Acme Corp" [^src1]',
  '',
  '## Sources',
  '',
  '[^src1]: golden-master.pdf, pages 1-3',
  '',
].join('\n');

test('gate 7.11: strict retries up to 3 before permissive, permissive up to 3 before template', async () => {
  // Wiki A: strict fails preservation twice, passes on the 3rd attempt.
  const wsA = makeTempDir('p7-retry-a-');
  await init('wiki-a', { workspace: wsA });
  copyFileSync('test-pdfs/golden-master.pdf', join(wsA, 'wikis', 'wiki-a', 'raw', 'golden-master.pdf'));
  let strictCallsA = 0;
  await ingest('wiki-a', {
    workspace: wsA,
    synthesis: true,
    extractChunkFn: stubExtractChunkFn(singleEntityExtraction()),
    synthesizeEntityFn: async () => {
      strictCallsA++;
      return strictCallsA < 3 ? INCOMPLETE_PAGE : completePage('wiki-a');
    },
    synthesizeEntityPermissiveFn: async () => {
      throw new Error('permissive must not be reached when strict succeeds on retry');
    },
    synthesizeTopicFn: async () => completePage('wiki-a'),
  });
  expect(strictCallsA).toBe(3);
  const reportA = await readSynthesisReport(join(wsA, 'wikis', 'wiki-a'));
  const entityEntryA = reportA.entries.find((entry) => entry.pageType === 'entity');
  expect(entityEntryA?.finalMode).toBe('strict-synthesis');
  expect(entityEntryA?.strict.attempts).toBe(3);
  expect(entityEntryA?.permissive.attempted).toBe(false);

  // Wiki B: strict fails 3x, permissive fails 3x → structured template.
  const wsB = makeTempDir('p7-retry-b-');
  await init('wiki-b', { workspace: wsB });
  copyFileSync('test-pdfs/golden-master.pdf', join(wsB, 'wikis', 'wiki-b', 'raw', 'golden-master.pdf'));
  let strictCallsB = 0;
  let permissiveCallsB = 0;
  const resultB = await ingest('wiki-b', {
    workspace: wsB,
    synthesis: true,
    extractChunkFn: stubExtractChunkFn(singleEntityExtraction()),
    synthesizeEntityFn: async () => {
      strictCallsB++;
      return INCOMPLETE_PAGE;
    },
    synthesizeEntityPermissiveFn: async () => {
      permissiveCallsB++;
      return INCOMPLETE_PAGE;
    },
    synthesizeTopicFn: async () => completePage('wiki-b'),
  });
  expect(strictCallsB).toBe(3);
  expect(permissiveCallsB).toBe(3);
  expect(resultB.synthesisConflicts).toBe(1);
  const reportB = await readSynthesisReport(join(wsB, 'wikis', 'wiki-b'));
  const entityEntryB = reportB.entries.find((entry) => entry.pageType === 'entity');
  expect(entityEntryB?.finalMode).toBe('structured-template');
  expect(entityEntryB?.strict.attempts).toBe(3);
  expect(entityEntryB?.permissive.attempts).toBe(3);
});

// Gate 7.12: DOX Writer Retries Before Deterministic Fallback
// ---------------------------------------------------------------------------
async function setupDoxWiki(prefix: string): Promise<{ workspace: string; wikiDir: string }> {
  const workspace = makeTempDir(prefix);
  await init('dox-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'dox-wiki');
  const peopleDir = join(wikiDir, 'entities', 'people');
  mkdirSync(peopleDir, { recursive: true });
  writeFileSync(
    join(peopleDir, 'john-smith.md'),
    matter.stringify('\nPage body.\n', { title: 'John Smith', type: 'entity', updated: new Date().toISOString() }),
    'utf-8',
  );
  return { workspace, wikiDir };
}

// One body that satisfies hasRequiredSections for every level (folder:
// Pages+Navigation; root: Start Here; all: title + Statistics).
const VALID_DOX_BODY =
  '# People\n\nRich description of the people folder.\n\n## Pages\n\n- [[john-smith|John Smith]] — a person\n\n## Navigation\n\n- parent\n\n## Start Here\n\n- [[entities/index|Entities]] — browse\n\n## Statistics\n\n- stub counts';

test('gate 7.12: DOX writer retries unparseable output up to 3 attempts before fallback', async () => {
  // Case 1: garbage, garbage, then a valid contract → LLM body used.
  const { workspace: ws1 } = await setupDoxWiki('p7-doxretry-1-');
  let calls1 = 0;
  await writeDoxContracts('dox-wiki', {
    workspace: ws1,
    doxLlm: true,
    writeDoxIndexFn: async () => {
      calls1++;
      return calls1 <= 2 ? 'total garbage with no sections' : VALID_DOX_BODY;
    },
  });
  // Deepest folder (entities/people) consumes 2 garbage + 1 valid attempt;
  // its parent entities and the root then succeed on their first attempts.
  expect(calls1).toBe(5);
  const peopleIndex = readFileSync(join(ws1, 'wikis', 'dox-wiki', 'entities', 'people', 'index.md'), 'utf-8');
  expect(peopleIndex).toContain('Rich description of the people folder.');

  // Case 2: the stub always throws → deterministic contract after exactly 1
  // attempt per target (3 targets: people, entities, root → 3 calls).
  // Phase 12 (vision `04` §6): a THROWN LLM error is a deterministic transport
  // failure (HTTP 4xx class) — never re-asked — so each target catches it once
  // and falls straight to the deterministic contract. Only content-defect
  // failures (unparseable / missing-section output) are re-asked up to 3
  // total attempts; that path is covered by Case 1 and by Phase 12 gate 12.5.
  const { workspace: ws2 } = await setupDoxWiki('p7-doxretry-2-');
  let calls2 = 0;
  await writeDoxContracts('dox-wiki', {
    workspace: ws2,
    doxLlm: true,
    writeDoxIndexFn: async () => {
      calls2++;
      throw new Error('API down');
    },
  });
  expect(calls2).toBe(3);
  const peopleIndex2 = readFileSync(join(ws2, 'wikis', 'dox-wiki', 'entities', 'people', 'index.md'), 'utf-8');
  expect(peopleIndex2).not.toContain('Rich description');
  expect(peopleIndex2).toContain('## Pages'); // deterministic contract written

  // Case 3: the workspace entry pass applies the same Phase 12 rule — a thrown
  // error is caught once and falls back to the deterministic description (never
  // re-asked). (2026-07-21 per-wiki segments: the entry call returns the
  // triggering wiki's plain description text.)
  const ws3 = makeTempDir('p7-doxretry-3-');
  await init('dox-wiki', { workspace: ws3 });
  await writeDoxContracts('dox-wiki', { workspace: ws3 }); // root index exists (deterministic)
  let calls3 = 0;
  const warnSpy3 = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await writeWorkspaceIndex({
      workspace: ws3,
      wikiSlug: 'dox-wiki',
      doxLlm: true,
      writeWorkspaceIndexFn: async () => {
        calls3++;
        throw new Error('API overloaded');
      },
    });
  } finally {
    warnSpy3.mockRestore();
  }
  // Phase 12: exactly 1 attempt — the throw is not quality-retried.
  expect(calls3).toBe(1);
  const workspaceIndex = readFileSync(join(ws3, 'wikis', 'index-of-indexes.md'), 'utf-8');
  expect(workspaceIndex).toContain('## Wikis'); // deterministic workspace contract written
});
