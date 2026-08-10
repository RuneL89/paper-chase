import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import React from 'react';
import { render, type Instance } from 'ink';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import * as llmClient from '../src/llm/client';
import {
  writeEntitySynthesis,
  writePermissiveEntitySynthesis,
  writeTopicSynthesis,
  writePermissiveTopicSynthesis,
} from '../src/agents/synthesis';
import { writeDoxContracts } from '../src/dox-writer';
import { ingest } from '../src/commands/ingest';
import { init } from '../src/commands/init';
import { materialize } from '../src/materializer';
import {
  enforceSparseInMarkdown,
  isSparseEntity,
  type EntityPageData,
} from '../src/pages/entity-page';
import type { TopicPageData } from '../src/pages/topic-page';
import type { ExtractorResult } from '../src/agents/extractor';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import { SettingsScreen } from '../src/tui/settings-screen';

/**
 * Phase 13 gates 13.1–13.7 (output caps & prompt self-sizing, phase doc §3;
 * canon: vision `04` §6 + `07` §5 output-token ceilings, vision `02`
 * §4.7/§4.8 + `05` §2 the sparse flag, the 2026-07-23 model-routing
 * preference). EVERY gate is LLM-free ($0): `callLLM` is spied/mocked and the
 * ingest-level gates drive the injected `extractChunkFn`/`synthesize*Fn`
 * seams, so no live call can happen even with a key present.
 *
 * Gate 13.7 (full-suite regression: `npx tsc --noEmit` clean + key-less
 * `npm test` green) is encoded by this file being part of the suite — its
 * pass/fail evidence is recorded in `.state/phase-13-status.json`. The
 * phase-11 `maxTokens: 2048` fixture (tests/phase-11.test.ts:627,644) was
 * verified fixture-local (a caller-supplied option exercising the OpenAI
 * request-body mapping, not tied to DOX_WRITER_MAX_TOKENS) and left
 * unchanged; no pre-existing test asserted the removed word-count lines or
 * the old caps.
 */

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
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

// ---------------------------------------------------------------------------
// Byte-exact ratified blocks (phase doc §2.2; em-dashes are U+2014)
// ---------------------------------------------------------------------------

const JOURNALIST_LINE = '- Write in clear, plain language suitable for a journalist.';

const BLOCK_FIRST_PARAGRAPH =
  'Length is not a target — completeness is. Write until this page passes the\n' +
  'Journalist Test and the points below are covered by the evidence, then stop.';

const EXPECTED_ENTITY_BLOCK = `${BLOCK_FIRST_PARAGRAPH}

- Let the evidence set the length. A richly documented entity earns several
  paragraphs; an entity mentioned once earns a few honest sentences. Never
  pad with filler, speculation, or repetition to make a page look
  substantial — and never compress away substance (dates, numbers,
  relationships, context) to make a page look tidy.
- A complete synthesis covers, when the evidence supports it: who/what this
  entity is and why it matters; chronology with explicit dates; how it fits
  the broader story (cross-references to related pages); disambiguation of
  the name; the key claims and relationships. When the evidence answers all
  of these, the synthesis is complete — stop writing.
- If the data is thin (one or two mentions, no significant claims or
  relationships), say exactly that, e.g. "Jane Doe is mentioned once in the
  corpus as a consultant to Acme Corp [^src1]. No further details are
  available." An honest sparse page is a correct page, not a failure.
- Layer 2's length is determined by the data, never by style: list every
  mention, relationship, claim, and timeline event from the data above,
  verbatim. Never drop, shorten, merge, or paraphrase evidence to save
  space.`;

const EXPECTED_TOPIC_BLOCK = `${BLOCK_FIRST_PARAGRAPH}

- Let the evidence set the length. A richly documented topic earns several
  paragraphs; a topic supported by a single claim earns a few honest
  sentences. Never pad with filler, speculation, or repetition to make a
  page look substantial — and never compress away substance (dates,
  numbers, relationships, context) to make a page look tidy.
- A complete synthesis covers, when the evidence supports it: what this
  topic is and why it matters across the corpus; which key entities are
  involved and how; chronology with explicit dates when the evidence
  supports it; the key claims. When the evidence answers all of these, the
  synthesis is complete — stop writing.
- If the data is thin (one or two claims, no significant claims or
  relationships), say exactly that, e.g. "Jane Doe is mentioned once in the
  corpus as a consultant to Acme Corp [^src1]. No further details are
  available." An honest sparse page is a correct page, not a failure.
- Layer 2's length is determined by the data, never by style: list every
  claim from the data above, verbatim. Never drop, shorten, merge, or
  paraphrase evidence to save space.`;

const SYNTHESIS_PROMPT_FILES = [
  { path: 'prompts/synthesis.prompt.txt', kind: 'entity' as const },
  { path: 'prompts/synthesis-permissive.prompt.txt', kind: 'entity' as const },
  { path: 'prompts/synthesis-topic.prompt.txt', kind: 'topic' as const },
  { path: 'prompts/synthesis-topic-permissive.prompt.txt', kind: 'topic' as const },
];

/** Whitespace-collapsed text so wrap differences never affect substring checks. */
function collapsed(text: string): string {
  return text.replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * The Phase 13 sparse fixture: jane-doe is sparse (1 mention, no claims, no
 * relationships), john-smith has 2 mentions + a claim (NOT sparse — the
 * 2-mention-with-claim boundary), acme-corp has 3 mentions (NOT sparse).
 */
function sparseExtraction(): ExtractorResult {
  return {
    entities: [
      {
        name: 'Jane Doe',
        type: 'person',
        slug: 'jane-doe',
        folder: 'entities/people',
        significance: 'A consultant mentioned in passing.',
        mentions: [{ page: 1, context: 'Jane Doe consulted for Acme Corp' }],
      },
      {
        name: 'John Smith',
        type: 'person',
        slug: 'john-smith',
        folder: 'entities/people',
        significance: 'CEO of Acme Corp',
        mentions: [
          { page: 1, context: 'John Smith presented the annual results' },
          { page: 2, context: 'John Smith signed the quarterly filing' },
        ],
      },
      {
        name: 'Acme Corp',
        type: 'company',
        slug: 'acme-corp',
        folder: 'entities/companies',
        significance: 'The company whose results are presented',
        mentions: [
          { page: 1, context: 'Acme Corp announced its annual results' },
          { page: 2, context: 'Acme Corp filed the quarterly report' },
          { page: 3, context: 'Acme Corp hired outside consultants' },
        ],
      },
    ],
    relationships: [],
    claims: [
      {
        text: 'Revenue was $42.5M in Q3 2024',
        type: 'financial',
        entities: ['john-smith'],
        page: 2,
      },
    ],
    timeline: [],
    context: 'Fake extraction fixture for Phase 13 sparse tests.',
  };
}

/** Install one chunk's document page + extraction JSON (phase-05 harness). */
function installChunk(
  wikiDir: string,
  chunkId: string,
  extraction: ExtractorResult,
  pages = '1-3',
): void {
  const documentsDir = join(wikiDir, 'documents');
  const extractedDir = join(wikiDir, '.state', 'extracted');
  mkdirSync(documentsDir, { recursive: true });
  mkdirSync(extractedDir, { recursive: true });
  const frontmatter = {
    title: chunkId,
    type: 'document',
    sources: [{ file: 'wikis/test-wiki/raw/golden-master.pdf', pages }],
    updated: new Date().toISOString(),
  };
  const body = `\n## Extracted Text: Pages ${pages}\n\nFake chunk content.\n`;
  writeFileSync(join(documentsDir, `${chunkId}.md`), matter.stringify(body, frontmatter), 'utf-8');
  writeFileSync(
    join(extractedDir, `${chunkId}.json`),
    JSON.stringify(extraction, null, 2) + '\n',
    'utf-8',
  );
}

/** Injected Layer 2 stub for the ingest-level gates (phase-12 harness). */
function makeExtractChunkFnStub(extraction: ExtractorResult) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return {
      chunkId,
      result: extraction,
      jsonPath,
      jsonRelativePath: `.state/extracted/${chunkId}.json`,
    };
  };
}

/** Init a wiki and copy the golden master into raw/ (no ingest). */
function setupWikiWithPdf(): string {
  const workspace = makeTempDir('paper-chase-g13-');
  init('test-wiki', { workspace });
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'golden-master.pdf'));
  return workspace;
}

function wikiPath(workspace: string, ...parts: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...parts);
}

/**
 * A preservation-passing synthesized entity page: frontmatter plus every
 * verbatim string the preservation check looks for (mention contexts,
 * relationship evidence, claim texts) and the [^src1] citation marker (the
 * fixture's single source+pages pair maps to src1). `emitSparse` simulates a
 * model that hallucinates a `sparse: true` field.
 */
function entityStubPage(data: EntityPageData, options?: { emitSparse?: boolean }): string {
  const lines: string[] = [
    '---',
    `title: ${JSON.stringify(data.title)}`,
    'type: entity',
    `wiki: ${data.wiki}`,
    `updated: ${new Date().toISOString()}`,
    ...(options?.emitSparse ? ['sparse: true'] : []),
    '---',
    '',
    `Synthesis prose for ${data.title}.`,
    '',
    ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}" [^src1]`),
    ...data.relationships.map((relationship) => `- ${relationship.evidence} [^src1]`),
    ...data.claims.map((claim) => `- ${claim.text} [^src1]`),
    '',
    '[^src1]: golden-master.pdf, pages 1-3',
    '',
  ];
  return lines.join('\n');
}

/** A preservation-passing synthesized topic page (claim texts + [^src1]). */
function topicStubPage(data: TopicPageData): string {
  return [
    '---',
    `title: ${JSON.stringify(data.title)}`,
    'type: topic',
    `wiki: ${data.wiki}`,
    `updated: ${new Date().toISOString()}`,
    '---',
    '',
    `Topic synthesis for ${data.title}.`,
    '',
    ...data.claims.map((claim) => `- ${claim.text} [^src1]`),
    '',
    '[^src1]: golden-master.pdf, pages 1-3',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Gate 13.1: Cap constants
// ---------------------------------------------------------------------------

test('gate 13.1 (static): one 32768 synthesis constant at all four sites, DOX 8192 at all three sites, extractor 32768', () => {
  const synthesisSource = readFileSync('src/agents/synthesis.ts', 'utf-8');
  expect(synthesisSource.match(/const SYNTHESIS_MAX_TOKENS = 32768;/g)).toHaveLength(1);
  // Phase 22 amendment (enumerated touch): the count grows 4 → 6 — the two
  // composite synthesis writers (composite + composite-permissive) use the
  // same shared ceiling constant at their call sites.
  // Phase 23 amendment (enumerated touch): the count grows 6 → 8 — the two
  // comparison synthesis writers (comparison strict + permissive legs) use
  // the same shared ceiling constant at their call sites.
  expect(synthesisSource.match(/maxTokens: SYNTHESIS_MAX_TOKENS/g)).toHaveLength(8);
  expect(synthesisSource).not.toMatch(/\b8192\b/);

  const doxSource = readFileSync('src/dox-writer.ts', 'utf-8');
  expect(doxSource.match(/const DOX_WRITER_MAX_TOKENS = 8192;/g)).toHaveLength(1);
  expect(doxSource.match(/maxTokens: DOX_WRITER_MAX_TOKENS/g)).toHaveLength(3);
  expect(doxSource).not.toMatch(/\b2048\b/);

  // Extractor: frozen at 16384 by L1 (2026-07-23), raised to 32768 by the
  // 2026-07-24 user-ratified amendment (live-run truncation at adhd-2024-part-013).
  const extractorSource = readFileSync('src/agents/extractor.ts', 'utf-8');
  expect(extractorSource).toContain('const EXTRACTION_MAX_TOKENS = 32768;');
});

test('gate 13.1 (behavior): stubbed callLLM captures 32768 at the four synthesis sites and 8192 on the DOX folder path', async () => {
  const workspace = makeTempDir('paper-chase-g13-1-');
  const entityData: EntityPageData = {
    title: 'Jane Doe',
    slug: 'jane-doe',
    folder: 'entities/people',
    type: 'person',
    wiki: 'test-wiki',
    mentions: [
      {
        page: 1,
        context: 'Jane Doe consulted for Acme Corp',
        source: 'wikis/test-wiki/raw/golden-master.pdf',
        pages: '1-3',
      },
    ],
    relationships: [],
    claims: [],
    slugToTitle: { 'jane-doe': 'Jane Doe' },
  };
  const topicData: TopicPageData = {
    title: 'Financial',
    slug: 'financial',
    folder: 'topics/financial',
    wiki: 'test-wiki',
    claims: [
      {
        text: 'Revenue was $42.5M in Q3 2024',
        type: 'financial',
        entities: ['john-smith'],
        page: 2,
        source: 'wikis/test-wiki/raw/golden-master.pdf',
        pages: '1-3',
      },
    ],
    slugToTitle: {},
  };

  const captured: Array<{ callType?: string; context?: string; maxTokens?: number }> = [];
  vi.spyOn(llmClient, 'callLLM').mockImplementation(
    async (_prompt: string, _system?: string, options?: { callType?: string; context?: string; maxTokens?: number }) => {
      captured.push(options ?? {});
      return 'stub output';
    },
  );

  await writeEntitySynthesis(entityData, 'AGENTS', join(workspace, 'llm-calls.json'));
  await writePermissiveEntitySynthesis(entityData, 'AGENTS', join(workspace, 'llm-calls.json'));
  await writeTopicSynthesis(topicData, 'AGENTS', join(workspace, 'llm-calls.json'));
  await writePermissiveTopicSynthesis(topicData, 'AGENTS', join(workspace, 'llm-calls.json'));

  expect(captured.map((call) => call.callType)).toEqual([
    'synthesis',
    'permissive-synthesis',
    'topic-synthesis',
    'permissive-topic-synthesis',
  ]);
  for (const call of captured) {
    expect(call.maxTokens).toBe(32768);
  }

  // The DOX folder path (real prompt, stubbed transport). Empty folders are
  // skipped by the DOX Writer (`hasContent` guard), so the wiki needs real
  // pages — one installed chunk + materialize gives documents/ and entity
  // sub-folders content.
  captured.length = 0;
  init('test-wiki', { workspace });
  installChunk(wikiPath(workspace), 'golden-master-part-001', sparseExtraction());
  await materialize('test-wiki', { workspace });
  // Build a VALID body from the filled prompt itself (2026-07-25 catalog
  // completeness): every supplied link target appears in `## Pages`, so the
  // body passes on attempt 1 at every level without retries.
  const bodyForPrompt = (prompt: string): string => {
    const links = [...prompt.matchAll(/link as (\[\[[^\]]+\]\])/g)].map((match) => `- ${match[1]} — entry`);
    const isRoot = prompt.includes('Folder: (root)');
    return [
      '# Placeholder',
      '',
      'Complete prose.',
      '',
      ...(isRoot ? ['## Start Here', '', ...links, ''] : []),
      '## Pages',
      '',
      ...links,
      '',
      ...(isRoot ? [] : ['## Navigation', '', '- up', '']),
      '## Statistics',
      '',
      '- placeholder',
      '',
    ].join('\n');
  };
  vi.mocked(llmClient.callLLM).mockImplementation(
    async (prompt: string, _system?: string, options?: { callType?: string; context?: string; maxTokens?: number }) => {
      captured.push(options ?? {});
      return bodyForPrompt(prompt);
    },
  );
  await writeDoxContracts('test-wiki', { workspace, doxLlm: true });

  const folderCalls = captured.filter((call) => call.context !== '(root)');
  const rootCalls = captured.filter((call) => call.context === '(root)');
  expect(captured.length).toBeGreaterThanOrEqual(2);
  expect(folderCalls.length).toBeGreaterThanOrEqual(1);
  expect(rootCalls).toHaveLength(1);
  for (const call of captured) {
    expect(call.callType).toBe('dox-writer');
    expect(call.maxTokens).toBe(8192);
  }
});

// ---------------------------------------------------------------------------
// Gate 13.2: Synthesis prompts carry no word counts + the ratified block
// ---------------------------------------------------------------------------

test('gate 13.2: no word-count rules remain; the ratified block anchors are verbatim; first paragraph byte-identical; topic variant correct', () => {
  const firstParagraphs: string[] = [];
  for (const { path, kind } of SYNTHESIS_PROMPT_FILES) {
    const text = readFileSync(path, 'utf-8');

    // (a) no word-count floor/ceiling pattern survives.
    expect(text, path).not.toMatch(/at least [\d,]+ words/i);
    expect(text, path).not.toMatch(/no more than [\d,]+ words/i);
    expect(text, path).not.toMatch(/word count/i);
    expect(text, path).not.toMatch(/\b\d[\d,]* words\b/i);
    expect(text, path).not.toContain('- The page must be at least 300 words');

    // (b) the block's anchor lines are present verbatim.
    expect(text, path).toContain('Length is not a target — completeness is.');
    expect(text, path).toContain('- Let the evidence set the length.');
    expect(text, path).toContain('An honest sparse page is a correct page, not a failure.');
    expect(text, path).toContain("- Layer 2's length is determined by the data, never by style");

    // (c) the first block paragraph (byte-extracted per file).
    const start = text.indexOf('Length is not a target');
    expect(start, path).toBeGreaterThanOrEqual(0);
    const paragraph = text.slice(start, text.indexOf('\n\n', start));
    firstParagraphs.push(paragraph);

    // (d) the kind-specific bullets (whitespace-collapsed so the wraps in the
    // files are compared as logical sentences).
    const flat = collapsed(text);
    if (kind === 'entity') {
      expect(flat, path).toContain(
        'A richly documented entity earns several paragraphs; an entity mentioned once earns a few honest sentences.',
      );
      expect(flat, path).toContain(
        'who/what this entity is and why it matters; chronology with explicit dates; how it fits the broader story (cross-references to related pages); disambiguation of the name; the key claims and relationships.',
      );
      expect(flat, path).toContain('(one or two mentions, no significant claims or relationships)');
      expect(flat, path).toContain(
        'list every mention, relationship, claim, and timeline event from the data above, verbatim.',
      );
    } else {
      expect(flat, path).toContain(
        'A richly documented topic earns several paragraphs; a topic supported by a single claim earns a few honest sentences.',
      );
      expect(flat, path).toContain(
        'what this topic is and why it matters across the corpus; which key entities are involved and how; chronology with explicit dates when the evidence supports it; the key claims.',
      );
      expect(flat, path).toContain('(one or two claims, no significant claims or relationships)');
      expect(flat, path).toContain('list every claim from the data above, verbatim.');
      expect(flat, path).not.toContain('an entity mentioned once');
      expect(flat, path).not.toContain('one or two mentions');
    }
  }

  // (c) byte-identical across all four files and equal to the ratified text.
  for (const paragraph of firstParagraphs) {
    expect(paragraph).toBe(BLOCK_FIRST_PARAGRAPH);
  }
});

// ---------------------------------------------------------------------------
// Gate 13.3: Prompt diff is confined to the amendment
// ---------------------------------------------------------------------------

test('gate 13.3: each synthesis prompt is byte-confined to the amendment (exact block tail; every other contract line intact)', () => {
  // Phase 17 (B12a): the ENTITY prompts' wikilink rule now requires targets
  // from the new Related Entities slot and first-mention linking (the
  // slot-additive Phase 17 change); the TOPIC prompts keep the pre-Phase-17
  // rule byte-identically (Phase 17 scope is the two entity prompts only).
  const WIKILINK_LINE_ENTITY =
    "- Use Obsidian-native wikilinks for related entities: [[<entity-slug>|<Page Title>]] — the target MUST come from the Related Entities list above (the entity's slug), the display text is its title (e.g. [[acme-corp|Acme Corp]]). When Layer 1 names an entity from that list, link it on first mention. Use the bare form [[name]] only when the display text is identical to the target.";
  const WIKILINK_LINE_TOPIC =
    "- Use Obsidian-native wikilinks for related entities: [[<entity-slug>|<Page Title>]] — the target is the entity's slug from the data above, the display text is its title (e.g. [[acme-corp|Acme Corp]]). Use the bare form [[name]] only when the display text is identical to the target.";

  for (const { path, kind } of SYNTHESIS_PROMPT_FILES) {
    const text = readFileSync(path, 'utf-8');
    const block = kind === 'entity' ? EXPECTED_ENTITY_BLOCK : EXPECTED_TOPIC_BLOCK;

    // The file ends EXACTLY with: the journalist bullet, a blank line, the
    // byte-exact block, and the trailing newline — nothing else changed or
    // follows (the removed word-count bullet used to sit at that position).
    expect(text.endsWith(`${JOURNALIST_LINE}\n\n${block}\n`), path).toBe(true);
    expect(text.match(/Length is not a target/g), path).toHaveLength(1);

    // The unchanged carrier lines, byte-identical: the Phase 7
    // {languageDirective} block, the wikilink rule, the preservation rules,
    // and the data-section placeholders.
    expect(text, path).toContain('=== LANGUAGE ===\n{languageDirective}\n');
    expect(text, path).toContain(kind === 'entity' ? WIKILINK_LINE_ENTITY : WIKILINK_LINE_TOPIC);
    expect(text, path).toContain('\nRules:\n');
    if (kind === 'entity') {
      expect(text, path).toContain(
        'Name: {entityName}\nType: {entityType}\nSignificance: {significance}\nDisambiguation: {disambiguation}\nMentions:\n{mentions}\n\nRelationships:\n{relationships}\n\nClaims:\n{claims}\n\nTimeline:\n{timeline}\n\nChunk Context:\n{context}',
      );
      expect(text, path).toContain(
        '- Do not drop any mention, relationship, claim, or timeline event from the data above.',
      );
      if (path === 'prompts/synthesis.prompt.txt') {
        expect(text).toContain('- Do not invent facts not present in the data.');
      } else {
        expect(text).toContain(
          '- In Layer 1, you may summarize and paraphrase; in Layer 2, preserve the exact strings from the data.',
        );
      }
    } else {
      expect(text, path).toContain(
        'Topic: {topicName}\nRelated Entities: {entities}\nClaims:\n{claims}\n\nSources:\n{sources}\n\nChunk Context:\n{context}',
      );
      expect(text, path).toContain('- Do not drop any claim from the data above.');
    }
  }
});

test('gate 13.3: the DOX prompt diff is confined to the added catalog-line rule', () => {
  const text = readFileSync('prompts/dox-writer.prompt.txt', 'utf-8');
  const NEW_RULE = '- Each `## Pages` line must tell the reader something the page title alone does not.';
  const PAGES_BULLET =
    '- If FOLDER is NOT `(root)`: a `## Pages` section cataloguing every direct page AND every child folder';
  const STATS_BULLET = '- A `## Statistics` section reproducing the EXACT statistics lines supplied above';

  // The rule is present exactly once, seated between the pre-existing
  // `## Pages` requirement and the `## Statistics` requirement.
  expect(text.match(/Each `## Pages` line must tell the reader/g)).toHaveLength(1);
  const pagesIdx = text.indexOf(PAGES_BULLET);
  const ruleIdx = text.indexOf(NEW_RULE);
  const statsIdx = text.indexOf(STATS_BULLET);
  expect(pagesIdx).toBeGreaterThanOrEqual(0);
  expect(ruleIdx).toBeGreaterThan(pagesIdx);
  expect(statsIdx).toBeGreaterThan(ruleIdx);

  // The 2-5-sentence description rule and the Phase 7 language block stay.
  expect(text).toContain('One rich description paragraph (2-5 sentences)');
  expect(text).toContain('=== LANGUAGE ===\n{languageDirective}\n');
});

// ---------------------------------------------------------------------------
// Gate 13.4: Sparse flag written by the Materializer
// ---------------------------------------------------------------------------

test('gate 13.4: the materializer writes sparse: true for a 1-mention claim-less entity only, and update mode drops it at 3 mentions', async () => {
  const workspace = makeTempDir('paper-chase-g13-4-');
  init('test-wiki', { workspace });
  const wikiDir = wikiPath(workspace);
  installChunk(wikiDir, 'golden-master-part-001', sparseExtraction());

  const result = await materialize('test-wiki', { workspace });

  // MaterializeResult.entityPages exposes the flag per entity.
  const bySlug = new Map(result.entityPages.map((page) => [page.slug, page]));
  expect(bySlug.get('jane-doe')?.sparse).toBe(true);
  expect(bySlug.get('john-smith')?.sparse).toBe(false); // 2 mentions + a claim
  expect(bySlug.get('acme-corp')?.sparse).toBe(false); // 3 mentions

  // Frontmatter: sparse entity carries `sparse: true` (parsed + raw), seated
  // after aliases and before sources; the others carry NO sparse field at all
  // (never `sparse: false`).
  const janeRaw = readFileSync(wikiPath(workspace, 'entities', 'people', 'jane-doe.md'), 'utf-8');
  expect(janeRaw).toMatch(/^sparse: true$/m);
  expect(matter(janeRaw).data.sparse).toBe(true);
  const aliasesIdx = janeRaw.indexOf('aliases:');
  const sparseIdx = janeRaw.indexOf('sparse:');
  const sourcesIdx = janeRaw.indexOf('sources:');
  expect(aliasesIdx).toBeGreaterThanOrEqual(0);
  expect(sparseIdx).toBeGreaterThan(aliasesIdx);
  expect(sourcesIdx).toBeGreaterThan(sparseIdx);

  for (const slugPath of [
    ['entities', 'people', 'john-smith.md'],
    ['entities', 'companies', 'acme-corp.md'],
  ]) {
    const raw = readFileSync(wikiPath(workspace, ...slugPath), 'utf-8');
    expect(raw).not.toMatch(/^sparse:/m);
    expect('sparse' in matter(raw).data).toBe(false);
  }

  // Update mode: a second chunk adds a SECOND jane mention (total 2 — still
  // sparse: the ≤2 boundary), a third chunk adds the third (flag disappears).
  const chunk2 = sparseExtraction();
  chunk2.entities = chunk2.entities.map((entity) =>
    entity.slug === 'jane-doe'
      ? { ...entity, mentions: [{ page: 4, context: 'Jane Doe attended the board hearing' }] }
      : entity,
  );
  installChunk(wikiDir, 'golden-master-part-002', chunk2, '4-6');
  const result2 = await materialize('test-wiki', { workspace });
  expect(result2.entityPages.find((page) => page.slug === 'jane-doe')?.sparse).toBe(true);
  expect(readFileSync(wikiPath(workspace, 'entities', 'people', 'jane-doe.md'), 'utf-8')).toMatch(
    /^sparse: true$/m,
  );

  const chunk3 = sparseExtraction();
  chunk3.entities = chunk3.entities.map((entity) =>
    entity.slug === 'jane-doe'
      ? { ...entity, mentions: [{ page: 7, context: 'Jane Doe left the consultancy in June' }] }
      : entity,
  );
  installChunk(wikiDir, 'golden-master-part-003', chunk3, '7-9');
  const result3 = await materialize('test-wiki', { workspace });
  expect(result3.entityPages.find((page) => page.slug === 'jane-doe')?.sparse).toBe(false);
  const janeFinal = readFileSync(wikiPath(workspace, 'entities', 'people', 'jane-doe.md'), 'utf-8');
  expect(janeFinal).not.toMatch(/^sparse:/m);
  expect('sparse' in matter(janeFinal).data).toBe(false);
  // The re-derived page really did accumulate all three mentions.
  expect(result3.entityPages.find((page) => page.slug === 'jane-doe')?.mentions).toHaveLength(3);
});

test('gate 13.4 (unit): isSparseEntity rule boundaries and enforceSparseInMarkdown both directions', () => {
  const base = { mentions: [], relationships: [], claims: [] };
  const mention = { page: 1, context: 'x', source: 's', pages: '1-3' };
  const claim = { text: 'c', type: 't', entities: [], page: 1, source: 's', pages: '1-3' };
  const relationship = {
    subject: 'a',
    predicate: 'p',
    object: 'b',
    evidence: 'e',
    page: 1,
    source: 's',
    pages: '1-3',
  };

  expect(isSparseEntity(base)).toBe(true);
  expect(isSparseEntity({ ...base, mentions: [mention, mention] })).toBe(true);
  expect(isSparseEntity({ ...base, mentions: [mention, mention, mention] })).toBe(false);
  expect(isSparseEntity({ ...base, mentions: [mention, mention], claims: [claim] })).toBe(false);
  expect(isSparseEntity({ ...base, mentions: [mention], relationships: [relationship] })).toBe(
    false,
  );

  // Enforcement sets the flag on a sparse page lacking it ...
  const withoutFlag = entityStubPage({
    title: 'Jane Doe',
    slug: 'jane-doe',
    folder: 'entities/people',
    type: 'person',
    wiki: 'test-wiki',
    mentions: [
      { page: 1, context: 'Jane Doe consulted for Acme Corp', source: 's', pages: '1-3' },
    ],
    relationships: [],
    claims: [],
    slugToTitle: {},
  });
  expect(withoutFlag).not.toMatch(/^sparse:/m);
  const imposed = enforceSparseInMarkdown(withoutFlag, true);
  expect(imposed).toMatch(/^sparse: true$/m);
  expect(matter(imposed).data.sparse).toBe(true);

  // ... and strips a model-emitted flag from a non-sparse page.
  const hallucinated = enforceSparseInMarkdown(imposed, false);
  expect(hallucinated).not.toMatch(/^sparse:/m);
  expect('sparse' in matter(hallucinated).data).toBe(false);
  // Pages without a frontmatter block are returned unchanged.
  expect(enforceSparseInMarkdown('no frontmatter here', true)).toBe('no frontmatter here');
});

// ---------------------------------------------------------------------------
// Gate 13.5: Sparse survives synthesis replacement
// ---------------------------------------------------------------------------

test('gate 13.5: strict synthesis re-imposes sparse for the sparse entity and strips a model-emitted flag from non-sparse entities', async () => {
  const workspace = setupWikiWithPdf();
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    extractChunkFn: makeExtractChunkFnStub(sparseExtraction()),
    synthesizeEntityFn: async (data) =>
      // The model NEVER writes the flag for the sparse entity (it must be
      // re-imposed) and HALLUCINATES it for john-smith (it must be removed).
      entityStubPage(data, { emitSparse: data.slug === 'john-smith' }),
    synthesizeEntityPermissiveFn: async () => 'permissive stub (never called)',
    synthesizeTopicFn: async (data) => topicStubPage(data),
    synthesizeTopicPermissiveFn: async () => 'topic permissive stub (never called)',
  });

  expect(result.synthesized).toBe(3);

  const jane = readFileSync(wikiPath(workspace, 'entities', 'people', 'jane-doe.md'), 'utf-8');
  expect(jane).toMatch(/^sparse: true$/m);
  expect(matter(jane).data.sparse).toBe(true);

  const john = readFileSync(wikiPath(workspace, 'entities', 'people', 'john-smith.md'), 'utf-8');
  expect(john).not.toMatch(/^sparse:/m);
  expect('sparse' in matter(john).data).toBe(false);

  const acme = readFileSync(wikiPath(workspace, 'entities', 'companies', 'acme-corp.md'), 'utf-8');
  expect(acme).not.toMatch(/^sparse:/m);
  expect('sparse' in matter(acme).data).toBe(false);
});

test('gate 13.5: permissive synthesis re-imposes sparse the same way (deterministic over model frontmatter)', async () => {
  const workspace = setupWikiWithPdf();
  const result = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    extractChunkFn: makeExtractChunkFnStub(sparseExtraction()),
    synthesizeEntityFn: async (data) => {
      // jane-doe and john-smith fail strict preservation on every attempt so
      // the chain reaches the permissive write point; acme-corp passes.
      if (data.slug === 'acme-corp') {
        return entityStubPage(data);
      }
      return 'A thin summary that preserves none of the required verbatim strings.';
    },
    synthesizeEntityPermissiveFn: async (data) =>
      entityStubPage(data, { emitSparse: data.slug === 'john-smith' }),
    synthesizeTopicFn: async (data) => topicStubPage(data),
    synthesizeTopicPermissiveFn: async () => 'topic permissive stub (never called)',
  });

  expect(result.synthesized).toBe(1); // acme-corp strict
  expect(result.synthesizedPermissive).toBe(2); // jane-doe + john-smith permissive

  const jane = readFileSync(wikiPath(workspace, 'entities', 'people', 'jane-doe.md'), 'utf-8');
  expect(jane).toMatch(/^sparse: true$/m);
  expect(matter(jane).data.sparse).toBe(true);

  const john = readFileSync(wikiPath(workspace, 'entities', 'people', 'john-smith.md'), 'utf-8');
  expect(john).not.toMatch(/^sparse:/m);
  expect('sparse' in matter(john).data).toBe(false);
});

// ---------------------------------------------------------------------------
// Gate 13.6: TUI labels
// ---------------------------------------------------------------------------

type FakeStdin = PassThrough & {
  isTTY: boolean;
  setRawMode: (mode: boolean) => void;
  ref: () => FakeStdin;
  unref: () => FakeStdin;
};
type FakeStdout = PassThrough & { isTTY: boolean; columns: number; rows: number };

function createFakeStdin(): FakeStdin {
  const stdin = new PassThrough() as FakeStdin;
  stdin.isTTY = true;
  stdin.setRawMode = () => {};
  stdin.ref = () => stdin;
  stdin.unref = () => stdin;
  return stdin;
}

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}(?:\\[[0-?]*[ -/]*[@-~]|[@-Z\\\\-_])`, 'g');

/** Render the Settings screen on the fake-TTY harness (phase-11 pattern). */
async function renderSettingsOutput(workspace: string): Promise<string> {
  const stdin = createFakeStdin();
  const stdout = new PassThrough() as FakeStdout;
  stdout.isTTY = false;
  stdout.columns = 120;
  stdout.rows = 40;
  let output = '';
  stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  const instance: Instance = render(
    React.createElement(SettingsScreen, { onBack: () => {}, workspace }),
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
    },
  );
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 600));
  instance.unmount();
  return output.replace(ANSI_PATTERN, '');
}

test('gate 13.6: Anthropic DOX row recommends mid-tier Sonnet (never Opus); other rows unchanged', async () => {
  const workspace = makeTempDir('paper-chase-g13-6a-');
  const output = await renderSettingsOutput(workspace);

  expect(output).toContain(
    'Sonnet — mid-tier; structural navigation, correctness re-imposed deterministically',
  );
  expect(output).not.toContain('Sonnet/Opus');
  expect(output).not.toContain('strong contract writing');
  // No other row labels changed.
  expect(output).toContain('Haiku — cheapest, good for structured JSON extraction');
  expect(output).toContain('Sonnet — better prose, fewer preservation failures');
}, 30000);

test('gate 13.6: OpenAI DOX row recommends mid-tier GPT-5.6 Terra (never Sol); other rows unchanged', async () => {
  const workspace = makeTempDir('paper-chase-g13-6b-');
  writeFileSync(
    join(workspace, '.paper-chase.json'),
    JSON.stringify({
      synthesis: true,
      updateAgents: false,
      models: {
        provider: 'openai',
        default: 'gpt-5.6-luna',
        extractor: null,
        synthesis: null,
        dox: null, crossWiki: null, crossWikiJudgment: null,
      },
      apiKeys: { anthropic: null, openai: null, qwen: null },
    }),
    'utf-8',
  );
  const output = await renderSettingsOutput(workspace);

  expect(output).toContain(
    'GPT-5.6 Terra — mid-tier; structural navigation, correctness re-imposed deterministically',
  );
  expect(output).not.toContain('Terra/Sol');
  expect(output).not.toContain('strong contract writing');
  // No other row labels changed.
  expect(output).toContain('GPT-5.6 Luna — cheapest, good for structured JSON extraction');
  expect(output).toContain('GPT-5.6 Terra — better prose, fewer preservation failures');
}, 30000);
