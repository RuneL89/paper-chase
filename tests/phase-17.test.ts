import { createHash } from 'node:crypto';
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
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import { ingest } from '../src/commands/ingest';
import { init } from '../src/commands/init';
import { materialize } from '../src/materializer';
import {
  buildCitationMap,
  enforceFrontmatterInMarkdown,
  enforceSourcesSectionInMarkdown,
  isSparseEntity,
  writeEntityPage,
  type EntityPageData,
} from '../src/pages/entity-page';
import {
  enforceTopicFrontmatterInMarkdown,
  enforceTopicSourcesSectionInMarkdown,
  type TopicPageData,
} from '../src/pages/topic-page';
import { checkPreservation } from '../src/validation/preservation-check';
import { checkLinks } from '../src/validation/link-checker';
import { checkCitations } from '../src/validation/citation-checker';
import {
  buildRelatedEntities,
  formatRelatedEntities,
  formatRelationships,
  writeEntitySynthesis,
  writePermissiveEntitySynthesis,
} from '../src/agents/synthesis';
import * as llmClient from '../src/llm/client';
import type { ChunkExtraction } from '../src/commands/extract-chunk';
import type { ExtractorResult } from '../src/agents/extractor';
import type { CurationOutcome } from '../src/agents/curation';

/**
 * Phase 17 gates 17.1–17.13 (entity graph and citation integrity, phase doc
 * §3; canon: vision `02` §2/§4.3 B/§4.5/§4.8, `04` §3.2 Step 6 + §4, `05`
 * §2/§6, `06` §1–§3/§7, `07` §2.5/§2.6; backlog B1/B2/B10/B12). EVERY gate
 * is LLM-free ($0): materialize/writeEntityPage fixtures are deterministic,
 * prompt gates capture filled prompts via a `callLLM` spy, and the two
 * ingest-level gates (17.10's checkCitations leg and 17.12's resume
 * byte-stability) run hermetic temp workspaces with injected stubs exactly
 * like the phase-15/16 harnesses. Every ingest call passes
 * `poolStaggerMs: 0` and the Phase 14 keep-all curation stubs.
 *
 * Gate 17.13 (full-suite regression: `npx tsc --noEmit` clean + key-less
 * `npm test` green, pre-existing tests untouched except the enumerated
 * updates recorded in `.state/phase-17-status.json`) is encoded by this
 * file being part of the suite.
 */

const GOLDEN_MASTER_PDF = 'test-pdfs/golden-master.pdf';
const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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

function wikiPath(workspace: string, ...parts: string[]): string {
  return join(workspace, 'wikis', 'test-wiki', ...parts);
}

/** Install one chunk's document page + extraction JSON (phase-03/14 harness). */
function installChunk(
  wikiDir: string,
  chunkId: string,
  extraction: ExtractorResult,
  sourceFile: string,
  pages: string,
): void {
  const documentsDir = join(wikiDir, 'documents');
  const extractedDir = join(wikiDir, '.state', 'extracted');
  mkdirSync(documentsDir, { recursive: true });
  mkdirSync(extractedDir, { recursive: true });
  const frontmatter = {
    title: chunkId,
    type: 'document',
    sources: [{ file: sourceFile, pages }],
    updated: new Date().toISOString(),
  };
  const body = `\n## Extracted Text: Pages ${pages}\n\nFake chunk content.\n`;
  writeFileSync(join(documentsDir, `${chunkId}.md`), matter.stringify(body, frontmatter), 'utf-8');
  writeFileSync(join(extractedDir, `${chunkId}.json`), JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
}

const SOURCE_ONE = 'wikis/test-wiki/raw/source-one.pdf';
const SOURCE_TWO = 'wikis/test-wiki/raw/source-two.pdf';

/**
 * The gate-17.1/17.2 fixture: two chunks, each with one `alpha — rel → beta`
 * relationship from a DISTINCT source + page range. Chunk 1 also carries the
 * entities and the self-loop (`beta → beta`); chunk 2 adds a relationship
 * naming an UNKNOWN object (`ghost`).
 */
function installBidirectionalFixture(wikiDir: string): void {
  installChunk(
    wikiDir,
    'source-one-part-001',
    {
      entities: [
        {
          name: 'Alpha',
          type: 'person',
          slug: 'alpha',
          folder: 'entities/people',
          significance: 'The chair of Beta.',
          mentions: [{ page: 1, context: 'Alpha addressed the board' }],
        },
        {
          name: 'Beta',
          type: 'organization',
          slug: 'beta',
          folder: 'entities/organizations',
          significance: 'The chaired organization.',
          mentions: [{ page: 2, context: 'Beta published its annual report' }],
        },
      ],
      relationships: [
        {
          subject: 'alpha',
          predicate: 'is-chair-of',
          object: 'beta',
          evidence: 'Alpha chairs the Beta board',
          page: 1,
        },
        {
          subject: 'beta',
          predicate: 'self-reports',
          object: 'beta',
          evidence: 'Beta reports on itself',
          page: 3,
        },
      ],
      claims: [],
      timeline: [],
      context: 'Phase 17 bidirectional fixture, chunk one.',
    },
    SOURCE_ONE,
    '1-3',
  );
  installChunk(
    wikiDir,
    'source-two-part-001',
    {
      entities: [],
      relationships: [
        {
          subject: 'alpha',
          predicate: 'funds',
          object: 'beta',
          evidence: 'Alpha funds Beta operations',
          page: 5,
        },
        {
          subject: 'alpha',
          predicate: 'mentions',
          object: 'ghost',
          evidence: 'Alpha mentions Ghost in passing',
          page: 5,
        },
      ],
      claims: [],
      timeline: [],
      context: 'Phase 17 bidirectional fixture, chunk two.',
    },
    SOURCE_TWO,
    '4-6',
  );
}

async function materializedFixture(workspace: string) {
  const wikiDir = wikiPath(workspace);
  installBidirectionalFixture(wikiDir);
  return materialize('test-wiki', { workspace });
}

// ---------------------------------------------------------------------------
// Gate 17.1: Incoming attachment (phase doc §3, B10)
// ---------------------------------------------------------------------------
test('gate 17.1: relationships mirror-attach incoming records to the object entity (unknown object skipped; self-loop outgoing only)', async () => {
  const workspace = makeTempDir('paper-chase-g17-1-');
  init('test-wiki', { workspace });
  const result = await materializedFixture(workspace);

  const alpha = result.entityPages.find((page) => page.slug === 'alpha');
  const beta = result.entityPages.find((page) => page.slug === 'beta');
  expect(alpha).toBeDefined();
  expect(beta).toBeDefined();

  // The alpha page carries BOTH outgoing records (one per chunk) with
  // verbatim evidence, page, source, and pages.
  expect(alpha?.relationships).toEqual([
    {
      subject: 'alpha',
      predicate: 'is-chair-of',
      object: 'beta',
      evidence: 'Alpha chairs the Beta board',
      page: 1,
      source: SOURCE_ONE,
      pages: '1-3',
    },
    {
      subject: 'alpha',
      predicate: 'funds',
      object: 'beta',
      evidence: 'Alpha funds Beta operations',
      page: 5,
      source: SOURCE_TWO,
      pages: '4-6',
    },
    {
      subject: 'alpha',
      predicate: 'mentions',
      object: 'ghost',
      evidence: 'Alpha mentions Ghost in passing',
      page: 5,
      source: SOURCE_TWO,
      pages: '4-6',
    },
  ]);

  // The beta page carries BOTH incoming records (one per chunk), with the
  // object field implicit (the object is beta itself).
  expect(beta?.incomingRelationships).toEqual([
    {
      subject: 'alpha',
      predicate: 'is-chair-of',
      evidence: 'Alpha chairs the Beta board',
      page: 1,
      source: SOURCE_ONE,
      pages: '1-3',
    },
    {
      subject: 'alpha',
      predicate: 'funds',
      evidence: 'Alpha funds Beta operations',
      page: 5,
      source: SOURCE_TWO,
      pages: '4-6',
    },
  ]);

  // A relationship naming an UNKNOWN object is skipped on the incoming side:
  // no page exists for ghost and no incoming record anywhere references it.
  expect(result.entityPages.some((page) => page.slug === 'ghost')).toBe(false);
  expect(existsSync(wikiPath(workspace, 'entities', 'people', 'ghost.md'))).toBe(false);
  for (const page of result.entityPages) {
    for (const incoming of page.incomingRelationships ?? []) {
      expect(incoming.subject).not.toBe('ghost');
    }
  }

  // The self-loop attaches ONCE, as outgoing only: beta has exactly one
  // self-reports record and it is NOT in the incoming list.
  expect(beta?.relationships).toEqual([
    {
      subject: 'beta',
      predicate: 'self-reports',
      object: 'beta',
      evidence: 'Beta reports on itself',
      page: 3,
      source: SOURCE_ONE,
      pages: '1-3',
    },
  ]);
  expect(
    (beta?.incomingRelationships ?? []).some((incoming) => incoming.predicate === 'self-reports'),
  ).toBe(false);
});

// ---------------------------------------------------------------------------
// Gate 17.2: Template renders both directions (phase doc §3, B10)
// ---------------------------------------------------------------------------
test('gate 17.2: writeEntityPage renders the outgoing line unchanged and the incoming line with marker, verbatim evidence, and correct keys', async () => {
  const workspace = makeTempDir('paper-chase-g17-2-');
  init('test-wiki', { workspace });
  const result = await materializedFixture(workspace);
  const beta = result.entityPages.find((page) => page.slug === 'beta');
  expect(beta).toBeDefined();

  const page = writeEntityPage(beta!);
  expect(page).toContain('## Relationships');

  // Outgoing line — the unchanged pre-Phase-17 format.
  expect(page).toContain('- [[beta|Beta]] — Self Reports [^src1]');
  // Incoming lines — the `(incoming)` marker and the evidence quote verbatim.
  expect(page).toContain('- [[alpha|Alpha]] — Is Chair Of (incoming) — "Alpha chairs the Beta board" [^src1]');
  expect(page).toContain('- [[alpha|Alpha]] — Funds (incoming) — "Alpha funds Beta operations" [^src2]');

  // The citation map covers the incoming records' sources: source-two is on
  // beta's page ONLY because of the incoming `funds` record (beta's mention
  // and self-loop are both source-one).
  const { citationMap } = buildCitationMap(beta!);
  expect(citationMap.get(`${SOURCE_TWO}|4-6`)).toBe(2);
  expect(page).toContain('[^src2]: source-two.pdf, pages 4-6');

  // The frontmatter sources aggregation covers the incoming sources too.
  const frontmatter = matter(page).data;
  expect(frontmatter.sources).toEqual([
    { file: SOURCE_ONE, pages: '1-3' },
    { file: SOURCE_TWO, pages: '4-6' },
  ]);
});

// ---------------------------------------------------------------------------
// Gate 17.3: Sparse scope (phase doc §3; RATIFIED design decision: incoming
// relationships do NOT clear sparse — isSparseEntity reads outgoing only)
// ---------------------------------------------------------------------------
test('gate 17.3: an entity with only incoming relationships keeps sparse: true; one outgoing relationship clears it', () => {
  const base: EntityPageData = {
    title: 'ADHD Foreningen',
    slug: 'adhd-foreningen',
    folder: 'entities/organizations',
    type: 'organization',
    wiki: 'test-wiki',
    mentions: [
      { page: 4, context: 'ADHD-Foreningen arrangerer caféaften', source: SOURCE_ONE, pages: '1-3' },
    ],
    relationships: [],
    claims: [],
    incomingRelationships: [
      {
        subject: 'pia-jensen',
        predicate: 'is-chair-of',
        evidence: 'Pia Jensen er formand for ADHD-Foreningen',
        page: 4,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
    slugToTitle: { 'pia-jensen': 'Pia Jensen' },
  };

  // <=2 mentions, no claims, ONLY incoming relationships → still sparse.
  expect(isSparseEntity(base)).toBe(true);
  expect(matter(writeEntityPage(base)).data.sparse).toBe(true);

  // The same entity with ONE outgoing relationship → no sparse field.
  const withOutgoing: EntityPageData = {
    ...base,
    relationships: [
      {
        subject: 'adhd-foreningen',
        predicate: 'hosts',
        object: 'cafe-aften',
        evidence: 'ADHD-Foreningen hosts the café evening',
        page: 4,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
  };
  expect(isSparseEntity(withOutgoing)).toBe(false);
  expect(matter(writeEntityPage(withOutgoing)).data.sparse).toBeUndefined();
});

// ---------------------------------------------------------------------------
// Gate 17.4: Preservation covers incoming (phase doc §3, B10)
// ---------------------------------------------------------------------------
test('gate 17.4: checkPreservation fails a page that drops incoming evidence (named in droppedRelationships) and passes a complete page', () => {
  const data: EntityPageData = {
    title: 'Beta',
    slug: 'beta',
    folder: 'entities/organizations',
    type: 'organization',
    wiki: 'test-wiki',
    mentions: [],
    relationships: [],
    claims: [],
    incomingRelationships: [
      {
        subject: 'alpha',
        predicate: 'is-chair-of',
        evidence: 'Alpha chairs the Beta board',
        page: 1,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
    slugToTitle: { alpha: 'Alpha' },
  };

  const dropping = checkPreservation(data, 'A thin summary with none of the evidence.');
  expect(dropping.passed).toBe(false);
  expect(dropping.droppedRelationships).toEqual(['Alpha chairs the Beta board']);

  const complete = checkPreservation(
    data,
    '- [[alpha|Alpha]] — Is Chair Of (incoming) — "Alpha chairs the Beta board" [^src1]\n\n[^src1]: source-one.pdf, pages 1-3',
  );
  expect(complete.passed).toBe(true);
  expect(complete.droppedRelationships).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 17.5: relatedEntities computation (phase doc §3, B12a)
// ---------------------------------------------------------------------------
test('gate 17.5: relatedEntities is the deduplicated, sorted union of relationship subjects/objects and claim co-entities minus the page itself', () => {
  const data: EntityPageData = {
    title: 'Self',
    slug: 'self',
    folder: 'entities/people',
    type: 'person',
    wiki: 'test-wiki',
    mentions: [],
    relationships: [
      {
        subject: 'self',
        predicate: 'knows',
        object: 'obj-a',
        evidence: 'Self knows Obj A',
        page: 1,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
    incomingRelationships: [
      {
        subject: 'subj-b',
        predicate: 'employs',
        evidence: 'Subj B employs Self',
        page: 2,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
    claims: [
      {
        text: 'Self and Co C signed with Obj A',
        type: 'governance',
        entities: ['self', 'co-c', 'obj-a'],
        page: 3,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
    slugToTitle: { self: 'Self', 'obj-a': 'Obj A', 'subj-b': 'Subj B', 'co-c': 'Co C' },
  };

  // obj-a appears in BOTH a relationship and a claim — listed once; the page
  // itself is excluded even though it appears in the claim's entity list.
  expect(buildRelatedEntities(data)).toEqual([
    { slug: 'co-c', title: 'Co C' },
    { slug: 'obj-a', title: 'Obj A' },
    { slug: 'subj-b', title: 'Subj B' },
  ]);
  expect(formatRelatedEntities(buildRelatedEntities(data))).toBe(
    '- co-c — Co C\n- obj-a — Obj A\n- subj-b — Subj B',
  );

  // Unknown slugs fall back to the slug as the title.
  const withUnknown: EntityPageData = {
    ...data,
    relationships: [
      { subject: 'self', predicate: 'met', object: 'mystery', evidence: 'Self met Mystery', page: 1, source: SOURCE_ONE, pages: '1-3' },
    ],
    incomingRelationships: [],
    claims: [],
  };
  expect(buildRelatedEntities(withUnknown)).toEqual([{ slug: 'mystery', title: 'mystery' }]);

  // Empty data yields the documented empty form.
  const empty: EntityPageData = { ...data, relationships: [], incomingRelationships: [], claims: [] };
  expect(buildRelatedEntities(empty)).toEqual([]);
  expect(formatRelatedEntities(buildRelatedEntities(empty))).toBe('(none)');
});

// ---------------------------------------------------------------------------
// Gate 17.6: Prompt slots (phase doc §3, B12a; PROMPT DISCIPLINE: slot-
// additive only — every pre-existing section stays byte-identical)
// ---------------------------------------------------------------------------

const RELATED_SLOT = '\n\nRelated Entities (the only legal wikilink targets — slug — title):\n{relatedEntities}';
// Phase 18 (B18): the entity prompts gained the slot-additive
// === CITATION KEYS === section + {citationMap} slot (tests/phase-18.test.ts
// gate 18.2); the reconstruction must remove it too to reproduce the
// pre-Phase-17 templates byte-for-byte.
const CITATION_SLOT =
  '=== CITATION KEYS ===\n' +
  "The only legal citation keys for this page, with the exact source each key refers to (the page's final Sources section is rebuilt from exactly this list):\n" +
  '{citationMap}\n' +
  '\n' +
  'Every citation [^srcN] in the article MUST use exactly these keys for these sources — cite the key whose listed source and pages contain the fact. No other [^srcN] keys may appear anywhere in the output.\n' +
  '\n';
const NEW_WIKILINK_RULE =
  "- Use Obsidian-native wikilinks for related entities: [[<entity-slug>|<Page Title>]] — the target MUST come from the Related Entities list above (the entity's slug), the display text is its title (e.g. [[acme-corp|Acme Corp]]). When Layer 1 names an entity from that list, link it on first mention. Use the bare form [[name]] only when the display text is identical to the target.";
const OLD_WIKILINK_RULE =
  "- Use Obsidian-native wikilinks for related entities: [[<entity-slug>|<Page Title>]] — the target is the entity's slug from the data above, the display text is its title (e.g. [[acme-corp|Acme Corp]]). Use the bare form [[name]] only when the display text is identical to the target.";

/**
 * SHA-256 of each entity-synthesis template as it existed BEFORE Phase 17
 * (verified byte-equal to `git show HEAD:<path>` at implementation time —
 * recompute with `git show HEAD:prompts/<file> | sha256sum` if a later phase
 * legitimately edits these prompts).
 */
const PRE_PHASE_17_PROMPT_SHA256: Record<string, string> = {
  'prompts/synthesis.prompt.txt': '44d3e0c43c26a6c0a15799beece2fa9dbbede3f31ef8e9844f18ecbaee7f3417',
  'prompts/synthesis-permissive.prompt.txt': 'd5045acc8bc475d0cb9557a1e54277e40d96b157f2c390d65ef3dd6eec68c4c6',
};

test('gate 17.6: both entity prompts carry the relatedEntities slot and the updated wikilink rule; every pre-existing section is byte-identical', async () => {
  for (const path of Object.keys(PRE_PHASE_17_PROMPT_SHA256)) {
    const template = readFileSync(path, 'utf-8');

    // The slot and the updated wikilink rule are present, exactly once each.
    expect(template.match(/Related Entities \(the only legal wikilink targets — slug — title\):\n\{relatedEntities\}/g), path).toHaveLength(1);
    expect(template, path).toContain(NEW_WIKILINK_RULE);
    expect(template, path).not.toContain(OLD_WIKILINK_RULE);

    // Byte-confinement: removing the slot and restoring the old rule yields
    // EXACTLY the pre-Phase-17 template — every pre-existing section
    // (including the `=== LANGUAGE ===` / `{languageDirective}` block) is
    // byte-identical.
    expect(template, path).toContain('=== LANGUAGE ===\n{languageDirective}\n\n');
    const reconstructed = template.split(RELATED_SLOT).join('').split(CITATION_SLOT).join('').split(NEW_WIKILINK_RULE).join(OLD_WIKILINK_RULE);
    const hash = createHash('sha256').update(reconstructed, 'utf-8').digest('hex');
    expect(hash, path).toBe(PRE_PHASE_17_PROMPT_SHA256[path]);
  }

  // The filled prompt (fixture data) renders the slot with the deterministic
  // related-entity lines, and the en/en LANGUAGE block is still removed
  // byte-identically (the Phase 7 contract).
  const data: EntityPageData = {
    title: 'Self',
    slug: 'self',
    folder: 'entities/people',
    type: 'person',
    wiki: 'test-wiki',
    mentions: [],
    relationships: [
      { subject: 'self', predicate: 'knows', object: 'obj-a', evidence: 'Self knows Obj A', page: 1, source: SOURCE_ONE, pages: '1-3' },
    ],
    incomingRelationships: [
      { subject: 'subj-b', predicate: 'employs', evidence: 'Subj B employs Self', page: 2, source: SOURCE_ONE, pages: '1-3' },
    ],
    claims: [],
    slugToTitle: { self: 'Self', 'obj-a': 'Obj A', 'subj-b': 'Subj B' },
  };
  const prompts: string[] = [];
  vi.spyOn(llmClient, 'callLLM').mockImplementation(async (prompt: string) => {
    prompts.push(prompt);
    return 'stub output';
  });
  await writeEntitySynthesis(data, 'TEST CONSTITUTION');
  await writePermissiveEntitySynthesis(data, 'TEST CONSTITUTION');
  expect(prompts).toHaveLength(2);
  for (const prompt of prompts) {
    expect(prompt).toContain('Related Entities (the only legal wikilink targets — slug — title):\n- obj-a — Obj A\n- subj-b — Subj B');
    expect(prompt).toContain(NEW_WIKILINK_RULE);
    expect(prompt).not.toContain('{relatedEntities}');
    expect(prompt).not.toContain('{languageDirective}');
    expect(prompt).not.toContain('=== LANGUAGE ===');
    // Pre-existing sections survive byte-for-byte in the filled prompt.
    expect(prompt).toContain('=== TASK ===');
    expect(prompt).toContain('Length is not a target — completeness is.');
    // The incoming direction is presented with a clear direction label.
    expect(prompt).toContain('Incoming (this entity is the OBJECT of these relationships):');
    expect(prompt).toContain('Outgoing (this entity is the SUBJECT of these relationships):');
  }
});

// ---------------------------------------------------------------------------
// Supplementary (§2.1 prompt formatting): formatRelationships direction
// labels stay byte-identical when there is no incoming data.
// ---------------------------------------------------------------------------
test('supplementary §2.1: formatRelationships presents both directions with labels and keeps the no-incoming form byte-identical', () => {
  const outgoing = [
    { subject: 'a', predicate: 'knows', object: 'b', evidence: 'A knows B', page: 1, source: SOURCE_ONE, pages: '1-3' },
  ];
  const legacy = '- Subject: a\n  Predicate: knows\n  Object: b\n  Evidence: "A knows B"\n  Page: 1\n  Source: wikis/test-wiki/raw/source-one.pdf, pages 1-3';
  expect(formatRelationships(outgoing)).toBe(legacy);
  expect(formatRelationships([])).toBe('(none)');
  expect(formatRelationships([], [])).toBe('(none)');

  const incoming = [
    { subject: 'c', predicate: 'employs', evidence: 'C employs A', page: 2, source: SOURCE_TWO, pages: '4-6' },
  ];
  const both = formatRelationships(outgoing, incoming);
  expect(both).toBe(
    `Outgoing (this entity is the SUBJECT of these relationships):\n${legacy}\n\nIncoming (this entity is the OBJECT of these relationships):\n- Subject: c\n  Predicate: employs\n  Object: (this entity)\n  Evidence: "C employs A"\n  Page: 2\n  Source: wikis/test-wiki/raw/source-two.pdf, pages 4-6`,
  );
  expect(formatRelationships([], incoming)).toBe(
    'Incoming (this entity is the OBJECT of these relationships):\n- Subject: c\n  Predicate: employs\n  Object: (this entity)\n  Evidence: "C employs A"\n  Page: 2\n  Source: wikis/test-wiki/raw/source-two.pdf, pages 4-6',
  );
});

// ---------------------------------------------------------------------------
// Gate 17.7: Island detection (phase doc §3, B12b)
// ---------------------------------------------------------------------------
test('gate 17.7: islands lists exactly the zero-outgoing entity/topic pages; orphaned is unchanged; index/sources/documents are exempt', async () => {
  const workspace = makeTempDir('paper-chase-g17-7-');
  const wikiDir = wikiPath(workspace);
  mkdirSync(join(wikiDir, 'entities', 'people'), { recursive: true });
  mkdirSync(join(wikiDir, 'topics', 'topic-x'), { recursive: true });
  mkdirSync(join(wikiDir, 'documents'), { recursive: true });
  mkdirSync(join(wikiDir, 'sources'), { recursive: true });

  const page = (type: string, title: string, body: string): string =>
    matter.stringify(`\n${body}\n`, { title, type, updated: new Date().toISOString() });

  // One linked entity page — outgoing links to the island entity and the
  // document page (the document page therefore has an incoming link and is
  // not orphaned either; orphan semantics stay untouched).
  writeFileSync(
    join(wikiDir, 'entities', 'people', 'linked-entity.md'),
    page('entity', 'Linked Entity', 'See [[island-entity|Island Entity]] and [[doc-one-part-001|Doc One Part 001]].'),
    'utf-8',
  );
  // One zero-outgoing entity page WITH an incoming link.
  writeFileSync(
    join(wikiDir, 'entities', 'people', 'island-entity.md'),
    page('entity', 'Island Entity', 'This page names no wikilinks at all.'),
    'utf-8',
  );
  // One zero-outgoing topic page.
  writeFileSync(
    join(wikiDir, 'topics', 'topic-x', 'topic-x.md'),
    page('topic', 'Topic X', 'A topic page with no outgoing links.'),
    'utf-8',
  );
  // Exempt pages: the wiki root index, a sources page, a documents page —
  // none carries outgoing links and none may be listed as an island.
  writeFileSync(join(wikiDir, 'index.md'), page('index', 'Test Wiki', 'Root index with no links.'), 'utf-8');
  writeFileSync(join(wikiDir, 'sources', 'source-one.md'), page('source', 'Source One', 'Provenance page with no links.'), 'utf-8');
  writeFileSync(
    join(wikiDir, 'documents', 'doc-one-part-001.md'),
    page('document', 'doc-one-part-001', 'Raw chunk text with no links.'),
    'utf-8',
  );

  const result = await checkLinks('test-wiki', workspace);
  expect([...result.islands].sort()).toEqual([
    'wikis/test-wiki/entities/people/island-entity.md',
    'wikis/test-wiki/topics/topic-x/topic-x.md',
  ]);
  // Orphaned semantics unchanged by the new tally: the island entity HAS an
  // incoming link and is not orphaned; the zero-incoming pages (the linked
  // entity itself and the topic page) are, exactly as pre-Phase-17.
  expect([...result.orphaned].sort()).toEqual([
    'wikis/test-wiki/entities/people/linked-entity.md',
    'wikis/test-wiki/topics/topic-x/topic-x.md',
  ]);
  // Exemptions hold for both lists.
  for (const exempt of ['index.md', 'sources/source-one.md', 'documents/doc-one-part-001.md']) {
    expect(result.islands.some((path) => path.endsWith(exempt))).toBe(false);
    expect(result.orphaned.some((path) => path.endsWith(exempt))).toBe(false);
  }
});

// ---------------------------------------------------------------------------
// Gate 17.8 fixture: a rich entity page data + a model-written page whose
// frontmatter carries the constitution's example `updated`, partial sources,
// and a fabricated field.
// ---------------------------------------------------------------------------
const CONSTITUTION_EXAMPLE_DATE = '2026-07-16T10:00:00Z';
const PINNED_WRITE_TIME = new Date('2026-07-28T12:34:56.789Z');

function richEntityData(): EntityPageData {
  return {
    title: 'John Smith',
    slug: 'john-smith',
    folder: 'entities/people',
    type: 'person',
    wiki: 'test-wiki',
    mentions: [
      { page: 1, context: 'John Smith presented the results', source: SOURCE_ONE, pages: '1-3' },
      { page: 2, context: 'Smith answered questions', source: SOURCE_ONE, pages: '1-3' },
    ],
    relationships: [
      {
        subject: 'john-smith',
        predicate: 'is-ceo-of',
        object: 'acme-corp',
        evidence: 'John Smith is the CEO of Acme Corp',
        page: 1,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
    claims: [
      {
        text: 'Revenue was $42.5M in Q3 2024',
        type: 'financial',
        entities: ['acme-corp'],
        page: 2,
        source: SOURCE_TWO,
        pages: '4-6',
      },
    ],
    incomingRelationships: [
      {
        subject: 'acme-corp',
        predicate: 'employs',
        evidence: 'Acme Corp employs John Smith as CEO',
        page: 5,
        source: SOURCE_TWO,
        pages: '4-6',
      },
    ],
    slugToTitle: { 'john-smith': 'John Smith', 'acme-corp': 'Acme Corp' },
  };
}

const MODEL_PAGE_BAD_FRONTMATTER = [
  '---',
  'title: "John Smith"',
  'type: entity',
  `updated: ${CONSTITUTION_EXAMPLE_DATE}`,
  'confidence: high',
  'sources:',
  '  - file: "wikis/test-wiki/raw/source-one.pdf"',
  '    pages: "1-3"',
  '---',
  '',
  'John Smith is the CEO of Acme Corp [^src1]. Acme Corp employs John Smith as CEO [^src2].',
  'John Smith is the CEO of Acme Corp. Revenue was $42.5M in Q3 2024 [^src2].',
  '',
  '## Mentions',
  '',
  '- Page 1: "John Smith presented the results" [^src1]',
  '- Page 2: "Smith answered questions" [^src1]',
  '',
  '## Sources',
  '',
  '[^src1]: wikis/test-wiki/raw/source-one.pdf, pages 1-3',
  '[^src2]: wikis/test-wiki/raw/source-two.pdf, pages 4-6',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// Gate 17.8: Frontmatter re-imposition over LLM frontmatter (phase doc §3,
// B1 Defect B + B2)
// ---------------------------------------------------------------------------
test('gate 17.8: enforcement replaces model frontmatter with the complete deterministic block (real updated, full sources, no fabricated fields)', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_WRITE_TIME);

  const data = richEntityData();
  const enforced = enforceFrontmatterInMarkdown(MODEL_PAGE_BAD_FRONTMATTER, data);
  const frontmatter = matter(enforced).data;

  // `updated` is the REAL write time, never the constitution's example date.
  expect(frontmatter.updated).toBe(PINNED_WRITE_TIME.toISOString());
  // title/type/wiki/aliases match the page data; not sparse (has claims +
  // relationships); the full deterministic sources aggregation — including
  // the incoming record's source; the model's fabricated field is gone.
  expect(frontmatter.title).toBe('John Smith');
  expect(frontmatter.type).toBe('entity');
  expect(frontmatter.wiki).toBe('test-wiki');
  expect(frontmatter.aliases).toEqual(['John Smith']);
  expect(frontmatter.sparse).toBeUndefined();
  expect(frontmatter.sources).toEqual([
    { file: SOURCE_ONE, pages: '1-3' },
    { file: SOURCE_TWO, pages: '4-6' },
  ]);
  expect('confidence' in frontmatter).toBe(false);

  // The enforced block is EXACTLY the deterministic writer's frontmatter.
  expect(frontmatter).toEqual(matter(writeEntityPage(data)).data);

  // The body is preserved byte-for-byte.
  expect(matter(enforced).content).toBe(matter(MODEL_PAGE_BAD_FRONTMATTER).content);
});

// ---------------------------------------------------------------------------
// Gate 17.9: Frontmatter creation when absent (phase doc §3, B1 Defect B —
// the run-5 53-page class; the sparse `adhd-foreningen` case)
// ---------------------------------------------------------------------------
test('gate 17.9: enforcement creates the complete block on a page with no frontmatter, body untouched, sparse: true on the textbook-sparse fixture', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_WRITE_TIME);

  const sparseData: EntityPageData = {
    title: 'ADHD Foreningen',
    slug: 'adhd-foreningen',
    folder: 'entities/organizations',
    type: 'organization',
    wiki: 'test-wiki',
    mentions: [
      { page: 4, context: 'ADHD-Foreningen arrangerer caféaften', source: SOURCE_ONE, pages: '1-3' },
    ],
    relationships: [],
    claims: [],
    incomingRelationships: [
      {
        subject: 'pia-jensen',
        predicate: 'is-chair-of',
        evidence: 'Pia Jensen er formand for ADHD-Foreningen',
        page: 4,
        source: SOURCE_ONE,
        pages: '1-3',
      },
    ],
    slugToTitle: { 'pia-jensen': 'Pia Jensen' },
  };
  const modelPageNoFrontmatter = [
    'ADHD Foreningen is mentioned once in the corpus [^src1]. Pia Jensen er formand for ADHD-Foreningen.',
    '',
    '## Mentions',
    '',
    '- Page 4: "ADHD-Foreningen arrangerer caféaften" [^src1]',
    '',
    '## Sources',
    '',
    '[^src1]: source-one.pdf, pages 1-3',
    '',
  ].join('\n');

  const enforced = enforceFrontmatterInMarkdown(modelPageNoFrontmatter, sparseData);
  expect(enforced.startsWith('---\n')).toBe(true);
  const frontmatter = matter(enforced).data;
  expect(frontmatter.title).toBe('ADHD Foreningen');
  expect(frontmatter.type).toBe('entity');
  expect(frontmatter.wiki).toBe('test-wiki');
  expect(frontmatter.updated).toBe(PINNED_WRITE_TIME.toISOString());
  // The sparse flag is honest even though the only relationship is incoming
  // (the ratified outgoing-only scope, gate 17.3).
  expect(frontmatter.sparse).toBe(true);
  expect(frontmatter.aliases).toEqual(['ADHD Foreningen']);
  expect(frontmatter.sources).toEqual([{ file: SOURCE_ONE, pages: '1-3' }]);
  expect(frontmatter).toEqual(matter(writeEntityPage(sparseData)).data);

  // The body is byte-identical: enforcement only PREPENDS the block.
  expect(enforced.endsWith(modelPageNoFrontmatter)).toBe(true);
  expect(matter(enforced).content).toBe(modelPageNoFrontmatter);
});

// ---------------------------------------------------------------------------
// Gate 17.10: Sources-definition normalization (phase doc §3, B1 Defect A)
// ---------------------------------------------------------------------------
test('gate 17.10: full-workspace-path definitions are rebuilt basename-form with deterministic ranges, markers byte-identical, checkCitations clean', async () => {
  const data = richEntityData();
  const { citationMap } = buildCitationMap(data);
  const enforced = enforceSourcesSectionInMarkdown(MODEL_PAGE_BAD_FRONTMATTER, citationMap);

  // Basename-form definitions with the deterministic page ranges. (The
  // frontmatter `sources` block legitimately carries workspace-relative
  // paths — vision `06` §3 — so the no-full-path assertion is scoped to the
  // `## Sources` section.)
  expect(enforced).toContain('[^src1]: source-one.pdf, pages 1-3');
  expect(enforced).toContain('[^src2]: source-two.pdf, pages 4-6');
  const sourcesSection = enforced.split('## Sources')[1];
  expect(sourcesSection).not.toContain('wikis/test-wiki/raw/');

  // In-prose markers and the rest of the body are byte-identical — only the
  // `## Sources` section content changed.
  const proseBefore = MODEL_PAGE_BAD_FRONTMATTER.split('## Sources')[0];
  expect(enforced.split('## Sources')[0]).toBe(proseBefore);

  // checkCitations reports zero missingSource (and zero invalid) on the
  // enforced page with the sources present in raw/.
  const workspace = makeTempDir('paper-chase-g17-10-');
  init('test-wiki', { workspace });
  mkdirSync(wikiPath(workspace, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'source-one.pdf'));
  copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'source-two.pdf'));
  mkdirSync(wikiPath(workspace, 'entities', 'people'), { recursive: true });
  writeFileSync(wikiPath(workspace, 'entities', 'people', 'john-smith.md'), enforced, 'utf-8');
  const citations = await checkCitations('test-wiki', workspace);
  expect(citations.missingSource).toEqual([]);
  expect(citations.invalid).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 17.11: Topic pages enforced (phase doc §3, B1 — the topic write
// points get the same guarantees)
// ---------------------------------------------------------------------------
test('gate 17.11: topic enforcement creates the frontmatter when absent and normalizes the definitions', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_WRITE_TIME);

  const topicData: TopicPageData = {
    title: 'Financial',
    slug: 'financial',
    folder: 'topics/financial',
    wiki: 'test-wiki',
    claims: [
      {
        text: 'Revenue was $42.5M in Q3 2024',
        type: 'financial',
        entities: ['acme-corp'],
        page: 2,
        source: SOURCE_ONE,
        pages: '1-3',
      },
      {
        text: 'Operating expenses were $12M in Q3 2024',
        type: 'financial',
        entities: ['acme-corp'],
        page: 4,
        source: SOURCE_TWO,
        pages: '4-6',
      },
    ],
    slugToTitle: { 'acme-corp': 'Acme Corp' },
  };
  const modelTopicPage = [
    'Financial topics cover revenue and expenses [^src1] [^src2]. Revenue was $42.5M in Q3 2024. Operating expenses were $12M in Q3 2024.',
    '',
    '## Claims',
    '',
    '- Revenue was $42.5M in Q3 2024 [^src1]',
    '- Operating expenses were $12M in Q3 2024 [^src2]',
    '',
    '## Sources',
    '',
    '[^src1]: wikis/test-wiki/raw/source-one.pdf, pages 1-3',
    '[^src2]: wikis/test-wiki/raw/source-two.pdf, pages 4-6',
    '',
  ].join('\n');

  // Frontmatter created when absent — complete, deterministic, and never
  // sparse (the entity-only rule).
  const enforced = enforceTopicFrontmatterInMarkdown(modelTopicPage, topicData);
  expect(enforced.startsWith('---\n')).toBe(true);
  const frontmatter = matter(enforced).data;
  expect(frontmatter.title).toBe('Financial');
  expect(frontmatter.type).toBe('topic');
  expect(frontmatter.wiki).toBe('test-wiki');
  expect(frontmatter.updated).toBe(PINNED_WRITE_TIME.toISOString());
  expect(frontmatter.sources).toEqual([
    { file: SOURCE_ONE, pages: '1-3' },
    { file: SOURCE_TWO, pages: '4-6' },
  ]);
  expect('sparse' in frontmatter).toBe(false);
  expect(enforced.endsWith(modelTopicPage)).toBe(true);

  // Definitions normalized to the resolvable basename form; prose untouched.
  // (The frontmatter `sources` block legitimately carries workspace-relative
  // paths, so the no-full-path assertion is scoped to the `## Sources`
  // section.)
  const normalized = enforceTopicSourcesSectionInMarkdown(
    enforced,
    buildCitationMap({ mentions: [], relationships: [], claims: topicData.claims }).citationMap,
  );
  expect(normalized).toContain('[^src1]: source-one.pdf, pages 1-3');
  expect(normalized).toContain('[^src2]: source-two.pdf, pages 4-6');
  expect(normalized.split('## Sources')[1]).not.toContain('wikis/test-wiki/raw/');
  expect(normalized).toContain('Financial topics cover revenue and expenses [^src1] [^src2].');
});

// ---------------------------------------------------------------------------
// Supplementary (§2.6): the citation consistency check — body keys must be
// covered by the page's frontmatter sources (report-only).
// ---------------------------------------------------------------------------
test('supplementary §2.6: missingFrontmatterSource flags body keys uncovered by frontmatter sources on entity/topic pages only', async () => {
  const workspace = makeTempDir('paper-chase-g17-2-6-');
  const wikiDir = wikiPath(workspace);
  mkdirSync(join(wikiDir, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, join(wikiDir, 'raw', 'source-one.pdf'));
  mkdirSync(join(wikiDir, 'entities', 'people'), { recursive: true });
  mkdirSync(join(wikiDir, 'documents'), { recursive: true });

  // Covered page: frontmatter sources include source-one.pdf.
  writeFileSync(
    join(wikiDir, 'entities', 'people', 'covered.md'),
    matter.stringify('\nCited [^src1].\n\n[^src1]: source-one.pdf, pages 1-3\n', {
      title: 'Covered',
      type: 'entity',
      updated: new Date().toISOString(),
      sources: [{ file: 'wikis/test-wiki/raw/source-one.pdf', pages: '1-3' }],
    }),
    'utf-8',
  );
  // Uncovered page: the key's definition names source-one.pdf but the
  // frontmatter sources list is absent.
  writeFileSync(
    join(wikiDir, 'entities', 'people', 'uncovered.md'),
    matter.stringify('\nCited [^src1].\n\n[^src1]: source-one.pdf, pages 1-3\n', {
      title: 'Uncovered',
      type: 'entity',
      updated: new Date().toISOString(),
    }),
    'utf-8',
  );
  // A document page with the same shape is NOT checked (entity/topic scope).
  writeFileSync(
    join(wikiDir, 'documents', 'doc-one-part-001.md'),
    matter.stringify('\nCited [^src1].\n\n[^src1]: source-one.pdf, pages 1-3\n', {
      title: 'doc-one-part-001',
      type: 'document',
      updated: new Date().toISOString(),
    }),
    'utf-8',
  );

  const result = await checkCitations('test-wiki', workspace);
  expect(result.missingFrontmatterSource).toEqual([
    { page: 'wikis/test-wiki/entities/people/uncovered.md', citation: '[^src1]' },
  ]);
  // The pre-existing checks are untouched: both entity pages resolve their
  // definitions and the file exists in raw/.
  expect(result.invalid).toEqual([]);
  expect(result.missingSource).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 17.12: Resume byte-stability (phase doc §3 — the Phase 16 contract:
// enforcement runs ONLY at synthesis/materialize write points; skip-eligible
// pages are never touched)
// ---------------------------------------------------------------------------

/** Injected Layer 2 stub: writes the extraction JSON exactly like the real path. */
function makeExtractChunkFnStub(extraction: ExtractorResult) {
  return async (wikiDir: string, chunkId: string): Promise<ChunkExtraction> => {
    const jsonPath = join(wikiDir, '.state', 'extracted', `${chunkId}.json`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, JSON.stringify(extraction, null, 2) + '\n', 'utf-8');
    return { chunkId, result: extraction, jsonPath, jsonRelativePath: `.state/extracted/${chunkId}.json` };
  };
}

/** Phase 14 keep-all curation stub, injected at every ingest (phase-15 harness). */
function keepAllOutcome(): CurationOutcome {
  return { decisions: { merges: [], drops: [], keep: [] }, attempts: 1, fallbacks: [], vetoes: [] };
}

const CURATION_STUBS = {
  curateTopicsFn: async () => keepAllOutcome(),
  curateEntitiesFn: async () => keepAllOutcome(),
};

/** Preservation-passing synthesized entity page, Phase 17 shape (incoming evidence + citation markers). */
function passingEntityPage(data: EntityPageData): string {
  const { keys } = buildCitationMap(data);
  const markers = keys.map((key) => `[^${key}]`).join(' ');
  return [
    `Synthesis prose for ${data.title}.`,
    '',
    ...data.mentions.map((mention) => `- Page ${mention.page}: "${mention.context}" ${markers}`),
    ...data.relationships.map((relationship) => `- ${relationship.evidence} ${markers}`),
    ...(data.incomingRelationships ?? []).map((relationship) => `- ${relationship.evidence} ${markers}`),
    ...data.claims.map((claim) => `- ${claim.text} ${markers}`),
    '',
    '## Sources',
    '',
    ...keys.map((key) => `[^${key}]: golden-master.pdf, pages 1-3`),
    '',
  ].join('\n');
}

test('gate 17.12: a skip-eligible page is preserved byte-for-byte across a re-materialize + re-synthesize-skip — enforcement never touches it', async () => {
  const workspace = makeTempDir('paper-chase-g17-12-');
  init('test-wiki', { workspace });
  mkdirSync(wikiPath(workspace, 'raw'), { recursive: true });
  copyFileSync(GOLDEN_MASTER_PDF, wikiPath(workspace, 'raw', 'golden-master.pdf'));

  // Two entities with one relationship between them, so BOTH pages carry
  // relationship data (outgoing on alpha, incoming on beta) and the Phase 17
  // enforcement exercised them at run 1's write points.
  const extraction: ExtractorResult = {
    entities: [
      {
        name: 'Alpha',
        type: 'person',
        slug: 'alpha',
        folder: 'entities/people',
        significance: 'The chair of Beta.',
        mentions: [{ page: 1, context: 'Alpha addressed the board' }],
      },
      {
        name: 'Beta',
        type: 'organization',
        slug: 'beta',
        folder: 'entities/organizations',
        significance: 'The chaired organization.',
        mentions: [{ page: 2, context: 'Beta published its annual report' }],
      },
    ],
    relationships: [
      { subject: 'alpha', predicate: 'is-chair-of', object: 'beta', evidence: 'Alpha chairs the Beta board', page: 1 },
    ],
    claims: [],
    timeline: [],
    context: 'Phase 17 resume fixture.',
  };

  let entityStubCalls = 0;
  const synthesizeEntityFn = async (data: EntityPageData): Promise<string> => {
    entityStubCalls += 1;
    return passingEntityPage(data);
  };

  const run1 = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: makeExtractChunkFnStub(extraction),
    synthesizeEntityFn,
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async () => 'topic stub (never called)',
    synthesizeTopicPermissiveFn: async () => 'topic permissive stub (never called)',
  });
  expect(run1.synthesized).toBe(2);
  expect(entityStubCalls).toBe(2);

  const alphaPath = wikiPath(workspace, 'entities', 'people', 'alpha.md');
  const betaPath = wikiPath(workspace, 'entities', 'organizations', 'beta.md');
  const alphaAfterRun1 = readFileSync(alphaPath, 'utf-8');
  const betaAfterRun1 = readFileSync(betaPath, 'utf-8');
  // Run 1's write points DID enforce: complete frontmatter and basename-form
  // definitions on the synthesized pages.
  expect(matter(alphaAfterRun1).data.updated).toBeDefined();
  expect(matter(alphaAfterRun1).data.sources).toEqual([
    { file: 'wikis/test-wiki/raw/golden-master.pdf', pages: '1-3' },
  ]);
  expect(alphaAfterRun1).toContain('[^src1]: golden-master.pdf, pages 1-3');
  // Beta's page carries the incoming relationship's evidence (preservation,
  // gate 17.4) and stays sparse: true — the ratified outgoing-only sparse
  // scope (gate 17.3) applied live at the write point.
  expect(betaAfterRun1).toContain('- Alpha chairs the Beta board [^src1]');
  expect(matter(betaAfterRun1).data.sparse).toBe(true);

  // Run 2: identical corpus — both pages are skip-eligible (strict pass,
  // unchanged aggregate fingerprint incl. the incoming records), so the
  // synthesis stage makes ZERO calls and the enforcement never runs.
  entityStubCalls = 0;
  const run2 = await ingest('test-wiki', {
    workspace,
    synthesis: true,
    poolStaggerMs: 0,
    ...CURATION_STUBS,
    extractChunkFn: makeExtractChunkFnStub(extraction),
    synthesizeEntityFn,
    synthesizeEntityPermissiveFn: async (data) => passingEntityPage(data),
    synthesizeTopicFn: async () => 'topic stub (never called)',
    synthesizeTopicPermissiveFn: async () => 'topic permissive stub (never called)',
  });
  expect(run2.synthesisSkipped).toBe(2);
  expect(entityStubCalls).toBe(0);

  // Byte-stability: the finished pages are untouched by the re-materialize +
  // re-synthesize-skip (the Phase 16 contract holds with the Phase 17
  // enforcement in place).
  expect(readFileSync(alphaPath, 'utf-8')).toBe(alphaAfterRun1);
  expect(readFileSync(betaPath, 'utf-8')).toBe(betaAfterRun1);
});
