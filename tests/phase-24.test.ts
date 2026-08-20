import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test, vi } from 'vitest';
import matter from 'gray-matter';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync, readFileSync, copyFileSync } from 'node:fs';

import { scanEntityPages, scanTopicPages, listWorkspaceWikis } from '../src/cross-wiki/workspace-scan';
import { summarizeEntities, type EntitySummary } from '../src/cross-wiki/entity-context-summarizer';
import { resolveEntities } from '../src/cross-wiki/entity-resolver';
import { normalizePredicates } from '../src/cross-wiki/predicate-normalizer';
import { buildRelationshipGraph } from '../src/cross-wiki/relationship-graph';
import { clusterTopics } from '../src/cross-wiki/topic-clusterer';
import { buildSignalBatches, generateHypothesisSignals } from '../src/cross-wiki/hypothesis-generator';
import { runCrossWikiPass } from '../src/cross-wiki/index';
import { validateCrossWikiSchema } from '../src/validation/cross-wiki-schema';
import { validateSchema } from '../src/validation/schema-validator';
import { checkCrossWikiLinks } from '../src/validation/link-checker';
import { writeWorkspaceIndex, updateWorkspaceCrossWikiSection } from '../src/dox-writer';
import { resolveModelFromRouting } from '../src/llm/client';
import * as llmClient from '../src/llm/client';
import { applyLanguageDirective } from '../src/utils/language';
import { init } from '../src/commands/init';
import { ingest } from '../src/commands/ingest';
import { appRoot } from '../src/utils/app-root';
import type { ScannedEntityPage } from '../src/cross-wiki/workspace-scan';

/**
 * Phase 24 gates 24.1–24.15 (cross-wiki discovery layer; phase doc §3; canon:
 * vision `03` §3.1/§4.1/§4.2/§6, `04` §3.2 Step 10, `05` §9.1, `07` §2.5/§2.6
 * — all amended 2026-08-09). EVERY gate is LLM-free ($0): the exact tier,
 * graph, preflight, DOX pass, and validation are deterministic; every LLM
 * component runs through injected stubs or a `callLLM` spy.
 *
 * Gate 24.14 (full key-less suite: the Phase 23 baseline plus these tests,
 * zero unenumerated regressions; `npx tsc --noEmit` clean) is encoded by this
 * file being part of the suite — the full-suite run itself is the
 * Implementer's unified-verification leg (recorded in
 * `.state/phase-24-status.json`).
 */

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UPDATED = '2026-08-09T12:00:00.000Z';

/** A wiki root index.md (the workspace-membership marker). */
async function writeWikiRoot(workspace: string, slug: string, title?: string): Promise<void> {
  const dir = join(workspace, 'wikis', slug);
  await mkdir(dir, { recursive: true });
  const body = `\n# ${title ?? slug}\n\nA test wiki.\n`;
  await writeFile(
    join(dir, 'index.md'),
    matter.stringify(body, { title: title ?? slug, type: 'index', updated: UPDATED, children: [] }),
    'utf-8',
  );
}

interface EntityFixture {
  title: string;
  entityType?: string;
  aliases?: string[];
  sourceFile?: string;
  firstParagraph?: string;
  relationships?: Array<{
    target: string;
    display?: string;
    predicate: string; // kebab-case, as the extractor produced it
    incoming?: boolean;
    evidence?: string;
  }>;
}

/** `is-ceo-of` → `Is Ceo Of` (the entity page's rendered predicate form). */
function readablePredicate(predicate: string): string {
  return predicate
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Write one deterministic entity page (the writeEntityPage line shapes). */
async function writeEntityPageFixture(
  workspace: string,
  wiki: string,
  rel: string, // e.g. 'people/john-smith' (under entities/, without .md)
  fixture: EntityFixture,
): Promise<void> {
  const dir = join(workspace, 'wikis', wiki, 'entities', ...rel.split('/').slice(0, -1));
  await mkdir(dir, { recursive: true });
  const sourceFile = fixture.sourceFile ?? `${wiki}-report.pdf`;
  const lines: string[] = [];
  lines.push(fixture.firstParagraph ?? `${fixture.title} is a test entity.`, '');
  if (fixture.relationships && fixture.relationships.length > 0) {
    lines.push('## Relationships', '');
    for (const rel of fixture.relationships) {
      const link = rel.display ? `[[${rel.target}|${rel.display}]]` : `[[${rel.target}]]`;
      const predicate = readablePredicate(rel.predicate);
      if (rel.incoming) {
        lines.push(`- ${link} — ${predicate} (incoming) — "${rel.evidence ?? ''}" [^src1]`);
      } else if (rel.evidence !== undefined) {
        lines.push(`- ${link} — ${predicate} — "${rel.evidence}" [^src1]`);
      } else {
        lines.push(`- ${link} — ${predicate} [^src1]`);
      }
    }
    lines.push('');
  }
  lines.push('## Sources', '', `[^src1]: ${sourceFile}, pages 1-2`, '');
  const frontmatter: Record<string, unknown> = {
    title: fixture.title,
    type: 'entity',
    ...(fixture.aliases && fixture.aliases.length > 0 ? { aliases: fixture.aliases } : {}),
    wiki,
    updated: UPDATED,
    sources: [{ file: `wikis/${wiki}/raw/${sourceFile}`, pages: '1-2' }],
    tags: [fixture.entityType ?? 'person'],
  };
  await writeFile(
    join(workspace, 'wikis', wiki, 'entities', `${rel}.md`),
    matter.stringify(`\n${lines.join('\n')}\n`, frontmatter),
    'utf-8',
  );
}

/** Write one deterministic topic page. */
async function writeTopicPageFixture(
  workspace: string,
  wiki: string,
  rel: string, // e.g. 'health/patient-education'
  fixture: { title: string; aliases?: string[]; firstParagraph?: string },
): Promise<void> {
  const dir = join(workspace, 'wikis', wiki, 'topics', ...rel.split('/').slice(0, -1));
  await mkdir(dir, { recursive: true });
  const lines: string[] = [];
  lines.push(fixture.firstParagraph ?? `${fixture.title} topic paragraph.`, '');
  lines.push('## Sources', '', `[^src1]: ${wiki}-report.pdf, pages 1-2`, '');
  const slug = rel.split('/').pop() ?? rel;
  const frontmatter: Record<string, unknown> = {
    title: fixture.title,
    type: 'topic',
    ...(fixture.aliases && fixture.aliases.length > 0 ? { aliases: fixture.aliases } : {}),
    wiki,
    updated: UPDATED,
    sources: [{ file: `wikis/${wiki}/raw/${wiki}-report.pdf`, pages: '1-2' }],
    tags: [slug],
  };
  await writeFile(
    join(workspace, 'wikis', wiki, 'topics', `${rel}.md`),
    matter.stringify(`\n${lines.join('\n')}\n`, frontmatter),
    'utf-8',
  );
}

/** Scan all wikis' entity pages. */
async function scanAllEntities(workspace: string, wikis: string[]): Promise<ScannedEntityPage[]> {
  const pages: ScannedEntityPage[] = [];
  for (const wiki of wikis) {
    pages.push(...(await scanEntityPages(workspace, wiki)));
  }
  return pages;
}

/** Parse a markdown table's data rows into trimmed cell arrays (splits on ' | ' so wikilink pipes survive). */
function tableRows(markdown: string): string[][] {
  return matter(markdown)
    .content.split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| ---'))
    .slice(1) // skip the header row
    .map((line) =>
      line
        .replace(/^\|\s*/, '')
        .replace(/\s*\|\s*$/, '')
        .split(' | ')
        .map((cell) => cell.trim()),
    );
}

/** The identity predicate-map stub (covers every input predicate). */
async function identityPredicateStub(predicates: string[]): Promise<string> {
  return JSON.stringify({ groups: predicates.map((predicate) => ({ canonical: predicate, variants: [predicate] })) });
}

// ---------------------------------------------------------------------------
// Gate 24.1 — exact-match entity resolver
// ---------------------------------------------------------------------------

test('gate 24.1: exact-match resolver clusters multi-wiki entities, excludes single-wiki, JSON mirror matches the table', async () => {
  const workspace = makeTempDir('paper-chase-g24-1-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', { title: 'John Smith' });
  await writeEntityPageFixture(workspace, 'alpha', 'companies/acme-corp', {
    title: 'Acme Corporation',
    entityType: 'company',
    aliases: ['Acme Corp'],
  });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smith', { title: 'John Smith' });
  await writeEntityPageFixture(workspace, 'beta', 'companies/acme-corp', {
    title: 'Acme Corp',
    entityType: 'company',
  });
  // Single-wiki entity — must be excluded.
  await writeEntityPageFixture(workspace, 'beta', 'people/jane-doe', { title: 'Jane Doe' });

  const pages = await scanAllEntities(workspace, ['alpha', 'beta']);
  const result = await resolveEntities(pages, {}, {
    workspace,
    matchEntitiesFn: async () => {
      throw new Error('fuzzy tier must not run — every cross-wiki pair is exact-matched');
    },
  });

  // Two clusters: John Smith (identical titles) and Acme (alias-exact).
  expect(result.entries).toHaveLength(2);
  const john = result.entries.find((entry) => entry.canonicalTitle === 'John Smith');
  expect(john).toBeDefined();
  expect(john!.wikis).toEqual(['alpha', 'beta']);
  expect(john!.members.map((member) => member.path)).toEqual([
    'alpha/entities/people/john-smith',
    'beta/entities/people/john-smith',
  ]);
  expect(john!.match).toBe('exact');
  const acme = result.entries.find((entry) => entry.canonicalTitle === 'Acme Corp');
  expect(acme).toBeDefined();
  expect(acme!.members).toHaveLength(2);
  // Jane Doe appears in no entry (single-wiki exclusion).
  expect(result.entries.every((entry) => entry.members.every((member) => member.slug !== 'jane-doe'))).toBe(true);
  expect(result.stats.exactClusters).toBe(2);
  expect(result.stats.candidateClusters).toBe(0);

  // The markdown table and the JSON mirror carry the same rows.
  const markdown = await readFile(join(workspace, 'wikis', 'cross-wiki', 'entities.md'), 'utf-8');
  expect(matter(markdown).data.type).toBe('cross-wiki-index');
  const registry = JSON.parse(
    await readFile(join(workspace, '.state', 'cross-wiki', 'entity-registry.json'), 'utf-8'),
  ) as { entities: Array<{ canonicalTitle: string; members: Array<{ wiki: string; path: string; title: string }> }> };
  const rows = tableRows(markdown);
  const jsonMembers = registry.entities.flatMap((entry) =>
    entry.members.map((member) => ({ canonicalTitle: entry.canonicalTitle, ...member })),
  );
  expect(rows).toHaveLength(jsonMembers.length);
  for (const member of jsonMembers) {
    const row = rows.find(
      (cells) => cells[0] === member.canonicalTitle && cells[1] === member.wiki && cells[2].includes(`[[${member.path}|`),
    );
    expect(row, `table row for ${member.path}`).toBeDefined();
  }
  expect(markdown).not.toContain('jane-doe');
});

// ---------------------------------------------------------------------------
// Gate 24.2 — relationship graph
// ---------------------------------------------------------------------------

test('gate 24.2: graph includes registry-subject and cross-wiki edges, excludes intra-wiki, JSON mirror matches', async () => {
  const workspace = makeTempDir('paper-chase-g24-2-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    relationships: [{ target: 'acme-corp', display: 'Acme Corp', predicate: 'is-ceo-of' }],
  });
  await writeEntityPageFixture(workspace, 'alpha', 'companies/acme-corp', { title: 'Acme Corp', entityType: 'company' });
  await writeEntityPageFixture(workspace, 'alpha', 'people/jane-doe', {
    title: 'Jane Doe',
    relationships: [
      // Intra-wiki edge, subject NOT cross-wiki → excluded.
      { target: 'acme-corp', display: 'Acme Corp', predicate: 'audits' },
      // Object exists only in beta → cross-wiki edge → included.
      { target: 'unique-corp', display: 'Unique Corp', predicate: 'advises', evidence: 'Jane Doe advises Unique Corp' },
    ],
  });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smith', {
    title: 'John Smith',
    relationships: [{ target: 'globex-inc', display: 'Globex Inc', predicate: 'chairs', evidence: 'John chairs Globex' }],
  });
  await writeEntityPageFixture(workspace, 'beta', 'companies/globex-inc', { title: 'Globex Inc', entityType: 'company' });
  await writeEntityPageFixture(workspace, 'beta', 'companies/unique-corp', { title: 'Unique Corp', entityType: 'company' });

  const pages = await scanAllEntities(workspace, ['alpha', 'beta']);
  const resolution = await resolveEntities(pages, {}, { workspace });
  expect(resolution.entries).toHaveLength(1); // only John Smith is cross-wiki

  const edges = await buildRelationshipGraph(
    pages,
    resolution.entries,
    [{ canonical: 'is-ceo-of', variants: ['is-ceo-of'] }, { canonical: 'audits', variants: ['audits'] }, { canonical: 'advises', variants: ['advises'] }, { canonical: 'chairs', variants: ['chairs'] }],
    { workspace },
  );

  expect(edges).toHaveLength(3);
  const keys = edges.map((edge) => `${edge.subject.wiki}/${edge.subject.slug} -${edge.predicate}-> ${edge.object.wiki}/${edge.object.slug}`);
  expect(keys).toContain('alpha/john-smith -is-ceo-of-> alpha/acme-corp'); // subject in registry
  expect(keys).toContain('beta/john-smith -chairs-> beta/globex-inc'); // subject in registry
  expect(keys).toContain('alpha/jane-doe -advises-> beta/unique-corp'); // cross-wiki span
  expect(keys).not.toContain('alpha/jane-doe -audits-> alpha/acme-corp'); // intra-wiki, non-registry subject

  // JSON mirror matches the markdown table.
  const markdown = await readFile(join(workspace, 'wikis', 'cross-wiki', 'relationships.md'), 'utf-8');
  const graph = JSON.parse(
    await readFile(join(workspace, '.state', 'cross-wiki', 'relationship-graph.json'), 'utf-8'),
  ) as { edges: Array<{ subject: { path: string }; predicate: string; object: { path: string } }> };
  const rows = tableRows(markdown);
  expect(rows).toHaveLength(graph.edges.length);
  for (const edge of graph.edges) {
    const row = rows.find(
      (cells) =>
        cells[0].includes(`[[${edge.subject.path}|`) && cells[1] === edge.predicate && cells[2].includes(`[[${edge.object.path}|`),
    );
    expect(row, `table row for ${edge.subject.path} ${edge.predicate}`).toBeDefined();
  }
});

// ---------------------------------------------------------------------------
// Gate 24.3 — topic clusterer
// ---------------------------------------------------------------------------

test('gate 24.3: topic clusterer keeps multi-wiki clusters (cross-language), excludes single-wiki clusters', async () => {
  const workspace = makeTempDir('paper-chase-g24-3-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeTopicPageFixture(workspace, 'alpha', 'health/patient-education', { title: 'Patient Education' });
  await writeTopicPageFixture(workspace, 'alpha', 'finance/budgets', { title: 'Budgets' });
  await writeTopicPageFixture(workspace, 'alpha', 'finance/taxes', { title: 'Taxes' });
  // Cross-language candidate (Danish title) — the same theme in another language.
  await writeTopicPageFixture(workspace, 'beta', 'sundhed/patientundervisning', { title: 'Patientundervisning' });
  await writeTopicPageFixture(workspace, 'beta', 'tech/ai', { title: 'AI' });

  const topics = [
    ...(await scanTopicPages(workspace, 'alpha')),
    ...(await scanTopicPages(workspace, 'beta')),
  ];
  let seenTopicCount = 0;
  const clusters = await clusterTopics(topics, {
    workspace,
    clusterTopicsFn: async (input) => {
      seenTopicCount = input.length;
      return JSON.stringify({
        clusters: [
          {
            clusterId: 'patient-education',
            title: 'Patient Education',
            description: 'Both topics cover patient education across the two wikis.',
            mappedTopics: [
              { id: 'alpha/topics/health/patient-education', label: 'Patient Education' },
              { id: 'beta/topics/sundhed/patientundervisning', label: 'Patientundervisning' },
            ],
            confidence: 'high',
          },
          {
            // Single-wiki cluster — excluded by the deterministic filter.
            clusterId: 'alpha-only',
            title: 'Alpha Only',
            description: 'Both members live in alpha.',
            mappedTopics: [
              { id: 'alpha/topics/finance/budgets', label: 'Budgets' },
              { id: 'alpha/topics/finance/taxes', label: 'Taxes' },
            ],
            confidence: 'low',
          },
        ],
      });
    },
  });

  expect(seenTopicCount).toBe(5);
  expect(clusters).toHaveLength(1);
  expect(clusters[0].clusterId).toBe('patient-education');
  expect(clusters[0].mappedTopics.map((topic) => topic.page)).toEqual([
    'alpha/topics/health/patient-education',
    'beta/topics/sundhed/patientundervisning',
  ]);

  // The cluster page: cross-wiki-topic frontmatter, path-qualified members, no wiki/sources fields.
  const pagePath = join(workspace, 'wikis', 'cross-wiki', 'topics', 'patient-education.md');
  const page = await readFile(pagePath, 'utf-8');
  const parsed = matter(page);
  expect(parsed.data.type).toBe('cross-wiki-topic');
  expect(parsed.data.clusterId).toBe('patient-education');
  expect(parsed.data.members).toEqual([
    'alpha/topics/health/patient-education.md',
    'beta/topics/sundhed/patientundervisning.md',
  ]);
  expect(parsed.data.wiki).toBeUndefined();
  expect(parsed.data.sources).toBeUndefined();
  expect(parsed.content).toContain('[[alpha/topics/health/patient-education|Patient Education]]');
  expect(parsed.content).toContain('[[beta/topics/sundhed/patientundervisning|Patientundervisning]]');

  // The JSON mirror carries the richer mappedTopics array.
  const mirror = JSON.parse(
    await readFile(join(workspace, '.state', 'cross-wiki', 'topic-clusters.json'), 'utf-8'),
  ) as { clusters: Array<{ clusterId: string; mappedTopics: Array<{ wiki: string; page: string; label: string }> }> };
  expect(mirror.clusters).toHaveLength(1);
  expect(mirror.clusters[0].mappedTopics).toEqual([
    { wiki: 'alpha', page: 'alpha/topics/health/patient-education', label: 'Patient Education' },
    { wiki: 'beta', page: 'beta/topics/sundhed/patientundervisning', label: 'Patientundervisning' },
  ]);
});

// ---------------------------------------------------------------------------
// Gate 24.4 — cluster page prompt contract
// ---------------------------------------------------------------------------

test('gate 24.4: cluster page prompt is slot-additive, generic, carries {languageDirective}, forbids factual claims', async () => {
  const prompt = await readFile(join(appRoot(), 'prompts', 'cross-wiki-topic-cluster.prompt.txt'), 'utf-8');
  // Carries the Phase 7 language block and the topics slot.
  expect(prompt).toContain('=== LANGUAGE ===\n{languageDirective}\n\n');
  expect(prompt).toContain('{topics}');
  // Instructs the model to make no factual claims.
  expect(prompt).toMatch(/no factual claims/i);
  // Generic: no corpus/registry-specific vocabulary.
  expect(prompt).not.toMatch(/rkkp|registry|register|danish|dansk|denmark|region|patient education|indicator|klinisk|clinical/i);
  // en/en removal: the LANGUAGE block disappears byte-identically.
  const stripped = applyLanguageDirective(prompt, '');
  expect(stripped).not.toContain('=== LANGUAGE ===');
  expect(stripped).not.toContain('{languageDirective}');
  const filled = applyLanguageDirective(prompt, 'DIRECTIVE');
  expect(filled).toContain('DIRECTIVE');
});

// ---------------------------------------------------------------------------
// Gate 24.5 — Cross-Wiki DOX Writer + workspace section
// ---------------------------------------------------------------------------

/** Shared full-pass fixture: two wikis, one exact entity pair, one edge, two topics. */
async function buildPassFixture(prefix: string): Promise<string> {
  const workspace = makeTempDir(prefix);
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    relationships: [{ target: 'acme-corp', display: 'Acme Corp', predicate: 'is-ceo-of' }],
  });
  await writeEntityPageFixture(workspace, 'alpha', 'companies/acme-corp', { title: 'Acme Corp', entityType: 'company' });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smith', { title: 'John Smith' });
  await writeTopicPageFixture(workspace, 'alpha', 'health/patient-education', { title: 'Patient Education' });
  await writeTopicPageFixture(workspace, 'beta', 'sundhed/patientundervisning', { title: 'Patientundervisning' });
  return workspace;
}

function passStubs() {
  return {
    summarizeEntityFn: async (input: { title: string }) => `Summary of ${input.title}.`,
    normalizePredicatesFn: identityPredicateStub,
    clusterTopicsFn: async () =>
      JSON.stringify({
        clusters: [
          {
            clusterId: 'patient-education',
            title: 'Patient Education',
            description: 'Both topics cover patient education.',
            mappedTopics: [
              { id: 'alpha/topics/health/patient-education', label: 'Patient Education' },
              { id: 'beta/topics/sundhed/patientundervisning', label: 'Patientundervisning' },
            ],
            confidence: 'high',
          },
        ],
      }),
    generateSignalsFn: async () => JSON.stringify({ hypotheses: [] }),
  };
}

test('gate 24.5: cross-wiki DOX pass writes both indexes and the workspace section with deterministic children/statistics', async () => {
  const workspace = await buildPassFixture('paper-chase-g24-5-');
  // The workspace index exists BEFORE the cross-wiki pass (pipeline order).
  await writeWorkspaceIndex({ workspace, wikiSlug: 'alpha' });
  let workspaceIndex = await readFile(join(workspace, 'wikis', 'index-of-indexes.md'), 'utf-8');
  expect(workspaceIndex).not.toContain('## Cross-Wiki Discovery');

  const result = await runCrossWikiPass({
    workspace,
    wikiSlug: 'alpha',
    language: { input: 'en', output: 'en' },
    ...passStubs(),
  });
  expect(result.ran).toBe(true);
  expect(result.entities).toBe(1);
  expect(result.edges).toBe(1);
  expect(result.clusters).toBe(1);

  // wikis/cross-wiki/index.md — root contract, deterministic children + stats.
  const indexPage = matter(await readFile(join(workspace, 'wikis', 'cross-wiki', 'index.md'), 'utf-8'));
  expect(indexPage.data.type).toBe('cross-wiki-index');
  expect(indexPage.data.children).toEqual(['entities.md', 'relationships.md', 'topics/index.md']);
  expect(indexPage.data.entityCount).toBe(1);
  expect(indexPage.data.edgeCount).toBe(1);
  expect(indexPage.data.wiki).toBeUndefined();
  expect(indexPage.content).toContain('[[cross-wiki/entities|Cross-Wiki Entity Registry]]');
  expect(indexPage.content).toContain('[[cross-wiki/relationships|Cross-Wiki Relationship Graph]]');
  expect(indexPage.content).toContain('[[cross-wiki/topics/index|Cross-Wiki Topic Clusters]]');
  expect(indexPage.content).toContain('- Cross-wiki entities: 1');
  expect(indexPage.content).toContain('- Relationship edges: 1');
  expect(indexPage.content).toContain('- Topic clusters: 1');

  // wikis/cross-wiki/topics/index.md — cluster catalog.
  const topicsIndex = matter(await readFile(join(workspace, 'wikis', 'cross-wiki', 'topics', 'index.md'), 'utf-8'));
  expect(topicsIndex.data.type).toBe('cross-wiki-index');
  expect(topicsIndex.data.children).toEqual(['patient-education.md']);
  expect(topicsIndex.content).toContain('[[cross-wiki/topics/patient-education|Patient Education]]');

  // The workspace index gains the section linking cross-wiki/index.md.
  workspaceIndex = await readFile(join(workspace, 'wikis', 'index-of-indexes.md'), 'utf-8');
  expect(workspaceIndex).toContain('## Cross-Wiki Discovery');
  expect(workspaceIndex).toContain('[[cross-wiki/index|Cross-Wiki Discovery]]');
  expect(workspaceIndex.indexOf('## Cross-Wiki Discovery')).toBeLessThan(workspaceIndex.indexOf('## Statistics'));

  // A later workspace re-composition (another wiki's ingest) preserves the
  // section byte-for-byte and never lists cross-wiki as a wiki.
  const before = workspaceIndex;
  await writeWorkspaceIndex({ workspace, wikiSlug: 'beta' });
  const after = await readFile(join(workspace, 'wikis', 'index-of-indexes.md'), 'utf-8');
  const sectionOf = (text: string): string => {
    const start = text.indexOf('## Cross-Wiki Discovery');
    const end = text.indexOf('## Statistics');
    return text.slice(start, end);
  };
  expect(sectionOf(after)).toBe(sectionOf(before));
  expect(matter(after).data.children).toEqual(['alpha/index.md', 'beta/index.md']);
  // The ## Wikis catalog never lists cross-wiki as a wiki.
  const wikisSection = after.slice(after.indexOf('## Wikis'), after.indexOf('## Cross-Wiki Discovery'));
  expect(wikisSection).not.toContain('cross-wiki');

  // Section omitted when the artifacts are gone.
  await rm(join(workspace, 'wikis', 'cross-wiki'), { recursive: true, force: true });
  await updateWorkspaceCrossWikiSection(workspace);
  const removed = await readFile(join(workspace, 'wikis', 'index-of-indexes.md'), 'utf-8');
  expect(removed).not.toContain('## Cross-Wiki Discovery');
});

// ---------------------------------------------------------------------------
// Gate 24.6 — schema validation
// ---------------------------------------------------------------------------

test('gate 24.6: schema validators accept the cross-wiki types and reject missing required fields', async () => {
  const workspace = await buildPassFixture('paper-chase-g24-6-');
  await runCrossWikiPass({ workspace, wikiSlug: 'alpha', language: { input: 'en', output: 'en' }, ...passStubs() });

  // Every generated artifact is valid.
  const clean = await validateCrossWikiSchema(workspace);
  expect(clean.invalid).toEqual([]);
  expect(clean.totalPages).toBe(5); // index.md, entities.md, relationships.md, topics/index.md, topics/patient-education.md

  // Rejections: missing fields, wiki field, unknown type.
  const crossWikiDir = join(workspace, 'wikis', 'cross-wiki');
  const badTopic = matter.stringify('\n# Bad\n', {
    title: 'Bad Cluster',
    type: 'cross-wiki-topic',
    updated: UPDATED,
    members: ['alpha/topics/health/patient-education.md'],
  });
  await writeFile(join(crossWikiDir, 'topics', 'bad.md'), badTopic, 'utf-8');
  const badIndex = matter.stringify('\n# Bad\n', { title: 'Bad Index', type: 'cross-wiki-index', updated: UPDATED });
  await writeFile(join(crossWikiDir, 'bad-index.md'), badIndex, 'utf-8');
  const wikiField = matter.stringify('\n# Bad\n', {
    title: 'Bad Wiki Field',
    type: 'cross-wiki-index',
    updated: UPDATED,
    children: [],
    wiki: 'alpha',
  });
  await writeFile(join(crossWikiDir, 'bad-wiki.md'), wikiField, 'utf-8');
  const unknownType = matter.stringify('\n# Bad\n', { title: 'Bad Type', type: 'cross-wiki-banana', updated: UPDATED });
  await writeFile(join(crossWikiDir, 'bad-type.md'), unknownType, 'utf-8');

  const result = await validateCrossWikiSchema(workspace);
  const issues = result.invalid.map((entry) => `${entry.page}: ${entry.issue}`);
  expect(issues.some((issue) => issue.includes('bad.md') && issue.includes('clusterId'))).toBe(true);
  expect(issues.some((issue) => issue.includes('bad-index.md') && issue.includes('children'))).toBe(true);
  expect(issues.some((issue) => issue.includes('bad-wiki.md') && issue.includes('wiki'))).toBe(true);
  expect(issues.some((issue) => issue.includes('bad-type.md') && issue.includes('cross-wiki-banana'))).toBe(true);

  // The per-wiki schema validator knows the new types (no 'Unknown page type').
  const wikiDir = join(workspace, 'wikis', 'schema-wiki');
  await mkdir(wikiDir, { recursive: true });
  await writeFile(
    join(wikiDir, 'ok.md'),
    matter.stringify('\n# OK\n', {
      title: 'OK',
      type: 'cross-wiki-topic',
      clusterId: 'x',
      members: ['alpha/topics/health/patient-education.md'],
      updated: UPDATED,
    }),
    'utf-8',
  );
  await writeFile(
    join(wikiDir, 'broken.md'),
    matter.stringify('\n# Broken\n', { title: 'Broken', type: 'cross-wiki-topic', updated: UPDATED }),
    'utf-8',
  );
  const wikiSchema = await validateSchema('schema-wiki', workspace);
  expect(wikiSchema.invalid.some((entry) => entry.issue.includes('Unknown page type'))).toBe(false);
  expect(wikiSchema.invalid.some((entry) => entry.page.includes('broken.md') && entry.issue.includes('clusterId'))).toBe(true);
  expect(wikiSchema.invalid.some((entry) => entry.page.includes('broken.md') && entry.issue.includes('members'))).toBe(true);
});

// ---------------------------------------------------------------------------
// Gate 24.7 — link checker
// ---------------------------------------------------------------------------

test('gate 24.7: link checker resolves path-qualified wikilinks from cross-wiki pages to per-wiki pages', async () => {
  const workspace = await buildPassFixture('paper-chase-g24-7-');
  await runCrossWikiPass({ workspace, wikiSlug: 'alpha', language: { input: 'en', output: 'en' }, ...passStubs() });

  const clean = await checkCrossWikiLinks(workspace);
  expect(clean.broken).toEqual([]);
  expect(clean.totalLinks).toBeGreaterThan(0);

  // A bogus path-qualified target is reported broken.
  await writeFile(
    join(workspace, 'wikis', 'cross-wiki', 'bogus.md'),
    '\n# Bogus\n\nSee [[alpha/entities/people/no-such-page|Nope]] and [[beta/topics/sundhed/patientundervisning|Patientundervisning]].\n',
    'utf-8',
  );
  const result = await checkCrossWikiLinks(workspace);
  expect(result.broken).toHaveLength(1);
  expect(result.broken[0].link).toBe('alpha/entities/people/no-such-page|Nope');
  expect(result.broken[0].page).toBe('wikis/cross-wiki/bogus.md');
});

// ---------------------------------------------------------------------------
// Gate 24.8 — resume fingerprint
// ---------------------------------------------------------------------------

test('gate 24.8: fingerprint skips an unchanged workspace and re-runs on a new wiki or an updated content page', async () => {
  const workspace = await buildPassFixture('paper-chase-g24-8-');
  let summaries = 0;
  const stubs = {
    ...passStubs(),
    summarizeEntityFn: async (input: { title: string }) => {
      summaries++;
      return `Summary of ${input.title}.`;
    },
    relevanceProbeFn: async () => 'relevant',
  };
  const first = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', language: { input: 'en', output: 'en' }, ...stubs });
  expect(first.ran).toBe(true);
  const summariesAfterFirst = summaries;
  expect(summariesAfterFirst).toBeGreaterThan(0);
  const fingerprintPath = join(workspace, '.state', 'cross-wiki', 'run-fingerprint.json');
  const recorded = await readFile(fingerprintPath, 'utf-8');

  // Unchanged workspace → the layer is skipped; no LLM stub is called.
  const second = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', language: { input: 'en', output: 'en' }, ...stubs });
  expect(second.ran).toBe(false);
  expect(second.reason).toBe('unchanged');
  expect(summaries).toBe(summariesAfterFirst);
  expect(await readFile(fingerprintPath, 'utf-8')).toBe(recorded);

  // A new wiki → membership change → full re-run.
  await writeWikiRoot(workspace, 'gamma', 'Gamma');
  await writeEntityPageFixture(workspace, 'gamma', 'people/john-smith', { title: 'John Smith' });
  const third = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', language: { input: 'en', output: 'en' }, ...stubs });
  expect(third.ran).toBe(true);
  expect(third.reason).toBe('membership-changed');
  expect(summaries).toBeGreaterThan(summariesAfterFirst);

  // An updated content page → full re-run (single-wiki change passes the probe).
  const summariesAfterThird = summaries;
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    firstParagraph: 'John Smith is a test entity with updated prose.',
    relationships: [{ target: 'acme-corp', display: 'Acme Corp', predicate: 'is-ceo-of' }],
  });
  const fourth = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', language: { input: 'en', output: 'en' }, ...stubs });
  expect(fourth.ran).toBe(true);
  expect(fourth.reason).toBe('probe-relevant');
  expect(summaries).toBeGreaterThan(summariesAfterThird);
});

// ---------------------------------------------------------------------------
// Gate 24.9 — uncertain matches are isolated
// ---------------------------------------------------------------------------

test('gate 24.9: uncertain matches go to proposed-cross-wiki-matches.json, never to entities.md', async () => {
  const workspace = makeTempDir('paper-chase-g24-9-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', { title: 'John Smith' });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smyth', { title: 'John Smyth' });

  const pages = await scanAllEntities(workspace, ['alpha', 'beta']);
  const result = await resolveEntities(pages, {}, {
    workspace,
    matchEntitiesFn: async (cluster) =>
      JSON.stringify({
        matches: [],
        noMatch: [],
        uncertain: [{ members: cluster.members.map((member) => member.id), reason: 'close but unconfirmed' }],
      }),
    reviewUncertainFn: async (groups) =>
      JSON.stringify({
        reviews: groups.map((group) => ({
          members: group.members.map((member) => member.path),
          verdict: 'uncertain',
          reason: 'still not settled',
        })),
      }),
  });

  expect(result.entries).toHaveLength(0);
  expect(result.uncertain).toHaveLength(1);

  // Not in entities.md / registry JSON.
  const markdown = await readFile(join(workspace, 'wikis', 'cross-wiki', 'entities.md'), 'utf-8');
  expect(markdown).not.toContain('john-smith|');
  expect(markdown).not.toContain('john-smyth|');
  expect(markdown).toContain('No cross-wiki entities found');
  const registry = JSON.parse(await readFile(join(workspace, '.state', 'cross-wiki', 'entity-registry.json'), 'utf-8'));
  expect(registry.entities).toEqual([]);

  // Isolated for human review and for the downstream agent.
  const proposed = JSON.parse(await readFile(join(workspace, '.state', 'proposed-cross-wiki-matches.json'), 'utf-8'));
  expect(proposed.proposals).toHaveLength(1);
  expect(proposed.proposals[0].status).toBe('uncertain');
  expect(proposed.proposals[0].source).toBe('review');
  expect(proposed.proposals[0].members.map((m: { path: string }) => m.path)).toEqual([
    'alpha/entities/people/john-smith',
    'beta/entities/people/john-smyth',
  ]);
  const candidates = JSON.parse(await readFile(join(workspace, '.state', 'cross-wiki', 'entity-match-candidates.json'), 'utf-8'));
  expect(candidates.candidates).toHaveLength(1);
  expect(candidates.candidates[0].verdict).toBe('uncertain');
  expect(candidates.candidates[0].approved).toBe(false);
});

// ---------------------------------------------------------------------------
// Gate 24.10 — entity context summarizer
// ---------------------------------------------------------------------------

test('gate 24.10: summaries are stored per entity page and flow into the registry JSON and the review prompt', async () => {
  const workspace = makeTempDir('paper-chase-g24-10-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', { title: 'John Smith', entityType: 'person' });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smith', { title: 'John Smith', entityType: 'person' });

  const pages = await scanAllEntities(workspace, ['alpha', 'beta']);
  const summaries = await summarizeEntities(pages, {
    workspace,
    summarizeEntityFn: async (input) => `${input.title} is the CEO of Green Solutions.`,
  });
  const stored = JSON.parse(await readFile(join(workspace, '.state', 'cross-wiki', 'entity-summaries.json'), 'utf-8'));
  expect(Object.keys(stored)).toEqual([
    'alpha/entities/people/john-smith',
    'beta/entities/people/john-smith',
  ]);
  expect(stored['alpha/entities/people/john-smith']).toEqual({
    title: 'John Smith',
    summary: 'John Smith is the CEO of Green Solutions.',
    type: 'person',
    sources: ['alpha-report.pdf pages 1-2'],
  });

  // The registry JSON includes the per-member summary.
  const resolution = await resolveEntities(pages, summaries, { workspace });
  expect(resolution.entries[0].members[0].summary).toBe('John Smith is the CEO of Green Solutions.');
});

// ---------------------------------------------------------------------------
// Gate 24.11 — predicate normalizer
// ---------------------------------------------------------------------------

test('gate 24.11: predicate normalizer groups variants, writes predicate-map.json, graph uses canonical predicates', async () => {
  const workspace = makeTempDir('paper-chase-g24-11-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    relationships: [{ target: 'acme-corp', display: 'Acme Corp', predicate: 'leads' }],
  });
  await writeEntityPageFixture(workspace, 'alpha', 'companies/acme-corp', { title: 'Acme Corp', entityType: 'company' });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smith', { title: 'John Smith' });

  const predicates = ['is-ceo-of', 'leads', 'is-chief-executive-of', 'donated-to'];
  let calls = 0;
  const groups = await normalizePredicates(predicates, {
    workspace,
    normalizePredicatesFn: async (input, feedback, attempt) => {
      calls++;
      expect(input).toEqual([...predicates].sort((a, b) => a.localeCompare(b)));
      if (attempt === 1) {
        // Invalid: 'donated-to' is missing from every group → reask.
        return JSON.stringify({
          groups: [{ canonical: 'is-ceo-of', variants: ['is-ceo-of', 'leads', 'is-chief-executive-of'] }],
        });
      }
      expect(feedback).toContain('donated-to');
      return JSON.stringify({
        groups: [
          { canonical: 'is-ceo-of', variants: ['is-ceo-of', 'leads', 'is-chief-executive-of'] },
          { canonical: 'donated-to', variants: ['donated-to'] },
        ],
      });
    },
  });
  expect(calls).toBe(2);
  const map = JSON.parse(await readFile(join(workspace, '.state', 'cross-wiki', 'predicate-map.json'), 'utf-8'));
  expect(map).toEqual([
    { canonical: 'is-ceo-of', variants: ['is-ceo-of', 'leads', 'is-chief-executive-of'] },
    { canonical: 'donated-to', variants: ['donated-to'] },
  ]);

  // The relationship graph rewrites 'leads' to the canonical 'is-ceo-of'.
  const pages = await scanAllEntities(workspace, ['alpha', 'beta']);
  const resolution = await resolveEntities(pages, {}, { workspace });
  const edges = await buildRelationshipGraph(pages, resolution.entries, groups, { workspace });
  expect(edges).toHaveLength(1);
  expect(edges[0].predicate).toBe('is-ceo-of');
  const markdown = await readFile(join(workspace, 'wikis', 'cross-wiki', 'relationships.md'), 'utf-8');
  expect(markdown).toContain('| is-ceo-of |');
  expect(markdown).not.toContain('| leads |');
});

// ---------------------------------------------------------------------------
// Gate 24.12 — uncertain-review escalation (callLLM spy: real prompt path)
// ---------------------------------------------------------------------------

test('gate 24.12: uncertain verdicts escalate to the mid-tier review; match joins the registry, routing is cheap→mid', async () => {
  const workspace = makeTempDir('paper-chase-g24-12-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', { title: 'John Smith' });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smyth', { title: 'John Smyth' });

  const summaries: Record<string, EntitySummary> = {
    'alpha/entities/people/john-smith': {
      title: 'John Smith',
      summary: 'John Smith is the CEO of Green Solutions.',
      type: 'person',
      sources: ['alpha-report.pdf pages 1-2'],
    },
    'beta/entities/people/john-smyth': {
      title: 'John Smyth',
      summary: 'John Smyth leads Green Solutions.',
      type: 'person',
      sources: ['beta-report.pdf pages 3-4'],
    },
  };

  const spy = vi.spyOn(llmClient, 'callLLM').mockImplementation(async (prompt) => {
    if (prompt.includes('=== CANDIDATES ===')) {
      // The cheap fuzzy call sees the context summaries.
      expect(prompt).toContain('John Smith is the CEO of Green Solutions.');
      return JSON.stringify({
        matches: [],
        noMatch: [],
        uncertain: [
          { members: ['alpha/entities/people/john-smith', 'beta/entities/people/john-smyth'], reason: 'close but unconfirmed' },
        ],
      });
    }
    if (prompt.includes('=== UNCERTAIN GROUPS ===')) {
      return JSON.stringify({
        reviews: [
          {
            members: ['alpha/entities/people/john-smith', 'beta/entities/people/john-smyth'],
            verdict: 'match',
            canonicalTitle: 'John Smith',
            aliases: ['John Smyth'],
            reason: 'same person, spelling variant',
          },
        ],
      });
    }
    throw new Error('unexpected prompt');
  });
  try {
    const pages = await scanAllEntities(workspace, ['alpha', 'beta']);
    const result = await resolveEntities(pages, summaries, { workspace });

    // Escalation order: cheap fuzzy call first, mid-tier review second.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][2]?.callType).toBe('cross-wiki-entity-match');
    expect(spy.mock.calls[1][2]?.callType).toBe('cross-wiki-uncertain-review');
    // The review prompt carries the full context summaries and provenance.
    const reviewPrompt = spy.mock.calls[1][0];
    expect(reviewPrompt).toContain('John Smith is the CEO of Green Solutions.');
    expect(reviewPrompt).toContain('beta-report.pdf pages 3-4');

    // The match verdict joins the registry.
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].canonicalTitle).toBe('John Smith');
    expect(result.entries[0].match).toBe('review');
    expect(result.entries[0].aliases).toContain('John Smyth');
    expect(result.uncertain).toHaveLength(0);
  } finally {
    spy.mockRestore();
  }

  // Routing: cheap-tier cross-wiki call types fall to the default slot (legacy
  // configs); the two judgment call types fall to the synthesis slot (legacy
  // configs) or to the dedicated crossWikiJudgment slot when set.
  const routing = {
    default: 'cheap-model',
    extractor: null,
    synthesis: { provider: 'anthropic' as const, model: 'mid-model' },
    dox: null,
    curation: null,
    crossWiki: null,
    crossWikiJudgment: null,
  };
  expect(resolveModelFromRouting(routing, 'cross-wiki-entity-match')).toBe('cheap-model');
  expect(resolveModelFromRouting(routing, 'cross-wiki-entity-context')).toBe('cheap-model');
  expect(resolveModelFromRouting(routing, 'cross-wiki-predicate-normalize')).toBe('cheap-model');
  expect(resolveModelFromRouting(routing, 'cross-wiki-topic-cluster')).toBe('cheap-model');
  expect(resolveModelFromRouting(routing, 'cross-wiki-relevance-probe')).toBe('cheap-model');
  expect(resolveModelFromRouting(routing, 'cross-wiki-uncertain-review')).toBe('mid-model');
  expect(resolveModelFromRouting(routing, 'cross-wiki-hypothesis')).toBe('mid-model');

  // Phase 24 explicit slots override the fallbacks.
  const explicitRouting = {
    ...routing,
    crossWiki: { provider: 'anthropic' as const, model: 'bulk-model' },
    crossWikiJudgment: { provider: 'anthropic' as const, model: 'judgment-model' },
  };
  expect(resolveModelFromRouting(explicitRouting, 'cross-wiki-entity-match')).toBe('bulk-model');
  expect(resolveModelFromRouting(explicitRouting, 'cross-wiki-entity-context')).toBe('bulk-model');
  expect(resolveModelFromRouting(explicitRouting, 'cross-wiki-uncertain-review')).toBe('judgment-model');
  expect(resolveModelFromRouting(explicitRouting, 'cross-wiki-hypothesis')).toBe('judgment-model');
  // Non-cross-wiki calls are unaffected by the new slots.
  expect(resolveModelFromRouting(explicitRouting, 'synthesis')).toBe('mid-model');
  expect(resolveModelFromRouting(explicitRouting, 'extractor')).toBe('cheap-model');
});

// ---------------------------------------------------------------------------
// Gate 24.13 — hypothesis signal generator
// ---------------------------------------------------------------------------

test('gate 24.13: hypothesis generator writes structured signals grounded in the source artifacts', async () => {
  const workspace = makeTempDir('paper-chase-g24-13-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    relationships: [{ target: 'unique-corp', display: 'Unique Corp', predicate: 'advises', evidence: 'John advises Unique Corp' }],
  });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smith', { title: 'John Smith' });
  await writeEntityPageFixture(workspace, 'beta', 'companies/unique-corp', { title: 'Unique Corp', entityType: 'company' });
  await writeTopicPageFixture(workspace, 'alpha', 'health/patient-education', { title: 'Patient Education' });
  await writeTopicPageFixture(workspace, 'beta', 'sundhed/patientundervisning', { title: 'Patientundervisning' });

  const pages = await scanAllEntities(workspace, ['alpha', 'beta']);
  const resolution = await resolveEntities(pages, {}, { workspace });
  const edges = await buildRelationshipGraph(pages, resolution.entries, [{ canonical: 'advises', variants: ['advises'] }], { workspace });
  expect(edges).toHaveLength(1);

  const cluster = {
    clusterId: 'patient-education',
    title: 'Patient Education',
    description: 'Shared theme.',
    mappedTopics: [
      { wiki: 'alpha', page: 'alpha/topics/health/patient-education', label: 'Patient Education' },
      { wiki: 'beta', page: 'beta/topics/sundhed/patientundervisning', label: 'Patientundervisning' },
    ],
    confidence: 'high',
  };

  // One connected cross-wiki subgraph qualifies as a batch.
  const batches = buildSignalBatches(resolution.entries, edges, [cluster]);
  expect(batches).toHaveLength(1);
  expect(batches[0].relationships).toHaveLength(1);
  expect(batches[0].topicClusters).toHaveLength(1);

  let calls = 0;
  const signals = await generateHypothesisSignals(resolution.entries, edges, [cluster], {}, {
    workspace,
    generateSignalsFn: async (batch, feedback, attempt) => {
      calls++;
      expect(batch.entities[0].canonicalTitle).toBe('John Smith');
      if (attempt === 1) {
        // Grounding violation: the evidence wiki is not part of the subgraph.
        return JSON.stringify({
          hypotheses: [
            {
              summary: 'John Smith advises Unique Corp across two wikis.',
              type: 'person-cross-wiki-role',
              confidence: 'high',
              entities: ['john-smith', 'unique-corp'],
              wikis: ['alpha', 'gamma'],
              evidence: [{ wiki: 'gamma', relationship: 'john-smith → advises → unique-corp' }],
            },
          ],
        });
      }
      expect(feedback).toContain('gamma');
      return JSON.stringify({
        hypotheses: [
          {
            summary: 'John Smith advises Unique Corp across two wikis.',
            type: 'person-cross-wiki-role',
            confidence: 'high',
            entities: ['john-smith', 'unique-corp'],
            wikis: ['alpha', 'beta'],
            evidence: [{ wiki: 'alpha', relationship: 'john-smith → advises → unique-corp' }],
          },
        ],
      });
    },
  });
  expect(calls).toBe(2);
  expect(signals).toHaveLength(1);
  const stored = JSON.parse(await readFile(join(workspace, '.state', 'cross-wiki', 'proposed-signals.json'), 'utf-8'));
  expect(stored.hypotheses).toHaveLength(1);
  expect(stored.hypotheses[0].confidence).toBe('high');
  expect(stored.hypotheses[0].wikis).toEqual(['alpha', 'beta']);
  expect(stored.hypotheses[0].evidence).toEqual([{ wiki: 'alpha', relationship: 'john-smith → advises → unique-corp' }]);
  // Signals are never published as wiki pages.
  expect(existsSync(join(workspace, 'wikis', 'cross-wiki', 'signals.md'))).toBe(false);
});

test('gate 24.13b: single-wiki subgraphs produce no batches and an empty signals file without an LLM call', async () => {
  const workspace = makeTempDir('paper-chase-g24-13b-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  // Cross-wiki entity, but its only edges are intra-wiki → no qualifying batch.
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    relationships: [{ target: 'acme-corp', display: 'Acme Corp', predicate: 'is-ceo-of' }],
  });
  await writeEntityPageFixture(workspace, 'alpha', 'companies/acme-corp', { title: 'Acme Corp', entityType: 'company' });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smith', { title: 'John Smith' });

  const pages = await scanAllEntities(workspace, ['alpha', 'beta']);
  const resolution = await resolveEntities(pages, {}, { workspace });
  const edges = await buildRelationshipGraph(pages, resolution.entries, [{ canonical: 'is-ceo-of', variants: ['is-ceo-of'] }], { workspace });
  expect(edges).toHaveLength(1);
  expect(buildSignalBatches(resolution.entries, edges, [])).toHaveLength(0);

  let called = false;
  const signals = await generateHypothesisSignals(resolution.entries, edges, [], {}, {
    workspace,
    generateSignalsFn: async () => {
      called = true;
      return JSON.stringify({ hypotheses: [] });
    },
  });
  expect(called).toBe(false);
  expect(signals).toEqual([]);
  const stored = JSON.parse(await readFile(join(workspace, '.state', 'cross-wiki', 'proposed-signals.json'), 'utf-8'));
  expect(stored.hypotheses).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 24.15 — preflight run-control
// ---------------------------------------------------------------------------

test('gate 24.15: preflight skips unchanged, runs on relevant changes, probe skips obviously-local changes', async () => {
  const workspace = await buildPassFixture('paper-chase-g24-15-');
  const stubs = passStubs();

  // Single-wiki workspace → skip.
  const solo = makeTempDir('paper-chase-g24-15-solo-');
  await writeWikiRoot(solo, 'alpha', 'Alpha');
  const soloResult = await runCrossWikiPass({ workspace: solo, wikiSlug: 'alpha', ...stubs });
  expect(soloResult.ran).toBe(false);
  expect(soloResult.reason).toBe('fewer-than-two-wikis');

  // First run builds the artifacts + fingerprint.
  const first = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', ...stubs });
  expect(first.ran).toBe(true);

  // Obviously-local single-wiki change: the probe says not-relevant → skip,
  // and the fingerprint is updated so the next run sees no changes.
  let probeCalls = 0;
  const probeStubs = {
    ...stubs,
    relevanceProbeFn: async (changes: Array<{ path: string }>) => {
      probeCalls++;
      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('alpha/entities/people/john-smith.md');
      return 'not-relevant';
    },
  };
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    firstParagraph: 'John Smith is a test entity with a typo fixed.',
    relationships: [{ target: 'acme-corp', display: 'Acme Corp', predicate: 'is-ceo-of' }],
  });
  const second = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', ...probeStubs });
  expect(probeCalls).toBe(1);
  expect(second.ran).toBe(false);
  expect(second.reason).toBe('probe-not-relevant');
  // The fingerprint now records the edited page; a further no-change run skips.
  const third = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', ...probeStubs });
  expect(third.ran).toBe(false);
  expect(third.reason).toBe('unchanged');
  expect(probeCalls).toBe(1);

  // A change spanning two wikis never probes — the full pass runs.
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    firstParagraph: 'Changed again.',
    relationships: [{ target: 'acme-corp', display: 'Acme Corp', predicate: 'is-ceo-of' }],
  });
  await writeEntityPageFixture(workspace, 'beta', 'people/john-smith', {
    title: 'John Smith',
    firstParagraph: 'Beta page changed too.',
  });
  const fourth = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', ...probeStubs });
  expect(fourth.ran).toBe(true);
  expect(fourth.reason).toBe('pages-changed');
  expect(probeCalls).toBe(1);
});

// ---------------------------------------------------------------------------
// Gate 24.15b — force cross-wiki bypass
// ---------------------------------------------------------------------------

test('gate 24.15b: forceCrossWiki bypasses preflight and relevance probe when ≥2 wikis exist', async () => {
  const workspace = await buildPassFixture('paper-chase-g24-15b-');
  const stubs = passStubs();

  // First run builds artifacts + fingerprint.
  const first = await runCrossWikiPass({ workspace, wikiSlug: 'alpha', ...stubs });
  expect(first.ran).toBe(true);

  // A single-wiki edit would normally trigger the probe and be skipped as
  // not-relevant. With forceCrossWiki the probe never runs and the full pass
  // runs (recorded reason is 'forced').
  let probeCalls = 0;
  const probeStubs = {
    ...stubs,
    relevanceProbeFn: async () => {
      probeCalls++;
      return 'not-relevant';
    },
  };
  await writeEntityPageFixture(workspace, 'alpha', 'people/john-smith', {
    title: 'John Smith',
    firstParagraph: 'A local-only tweak.',
    relationships: [{ target: 'acme-corp', display: 'Acme Corp', predicate: 'is-ceo-of' }],
  });

  const forced = await runCrossWikiPass({
    workspace,
    wikiSlug: 'alpha',
    forceCrossWiki: true,
    ...probeStubs,
  });
  expect(forced.ran).toBe(true);
  expect(forced.reason).toBe('forced');
  expect(probeCalls).toBe(0);

  // forceCrossWiki is ignored when the workspace holds fewer than two wikis.
  const solo = makeTempDir('paper-chase-g24-15b-solo-');
  await writeWikiRoot(solo, 'alpha', 'Alpha');
  const soloForced = await runCrossWikiPass({
    workspace: solo,
    wikiSlug: 'alpha',
    forceCrossWiki: true,
    ...stubs,
  });
  expect(soloForced.ran).toBe(false);
  expect(soloForced.reason).toBe('fewer-than-two-wikis');
});

// ---------------------------------------------------------------------------
// Pipeline integration (phase doc §2.8 + §6; UAT 24.4 analog)
// ---------------------------------------------------------------------------

test('gate 24.8b/integration: ingest wires the pass after the workspace index and before the updater; failures never abort', async () => {
  const workspace = makeTempDir('paper-chase-g24-int-');
  await init('alpha', { workspace });
  await init('beta', { workspace });
  // One real PDF (the golden master) so the run reaches the post-workspace
  // stages; extraction is stubbed, the cross-wiki pass is stubbed.
  copyFileSync('test-pdfs/golden-master.pdf', join(workspace, 'wikis', 'alpha', 'raw', 'golden-master.pdf'));
  const extractChunkFn = async (wikiDir: string, chunkId: string) => ({
    chunkId,
    result: { entities: [], relationships: [], claims: [], timeline: [], context: '' },
    jsonPath: join(wikiDir, '.state', 'extracted', `${chunkId}.json`),
    jsonRelativePath: `.state/extracted/${chunkId}.json`,
  });

  const lines: string[] = [];
  const result = await ingest('alpha', {
    workspace,
    extractChunkFn,
    crossWiki: true,
    updateAgents: true,
    runCrossWikiPassFn: async () => ({ ran: false, reason: 'test-skip' }),
    proposeAgentsUpdateFn: async () => 'proposal',
    onProgress: (line) => lines.push(line),
  });
  expect(result.crossWiki).toEqual({ ran: false, reason: 'test-skip' });
  const workspaceLine = lines.findIndex((line) => line === 'Workspace index updated.');
  const crossWikiLine = lines.findIndex((line) => line.startsWith('Cross-wiki discovery'));
  const updaterLine = lines.findIndex((line) => line.startsWith('Proposed AGENTS.md updates'));
  expect(workspaceLine).toBeGreaterThanOrEqual(0);
  expect(crossWikiLine).toBeGreaterThan(workspaceLine);
  expect(updaterLine).toBeGreaterThan(crossWikiLine);

  // Failure leg: a throwing pass is caught — the ingest completes and the
  // per-wiki artifacts are intact (UAT 24.4 analog).
  const failure = await ingest('alpha', {
    workspace,
    extractChunkFn,
    crossWiki: true,
    runCrossWikiPassFn: async () => {
      throw new Error('simulated cross-wiki failure');
    },
    onProgress: (line) => lines.push(line),
  });
  expect(failure.crossWiki?.ran).toBe(false);
  expect(failure.crossWiki?.reason).toBe('error');
  expect(failure.crossWiki?.error).toContain('simulated cross-wiki failure');
  expect(existsSync(join(workspace, 'wikis', 'alpha', 'index.md'))).toBe(true);
  expect(lines.some((line) => line.includes('cross-wiki discovery pass failed'))).toBe(true);

  // Disabled: the pass never runs and the result carries no crossWiki field.
  const disabled = await ingest('alpha', {
    workspace,
    extractChunkFn,
    runCrossWikiPassFn: async () => {
      throw new Error('must not run');
    },
  });
  expect(disabled.crossWiki).toBeUndefined();

  // forceCrossWiki is forwarded through ingest() to runCrossWikiPass().
  let receivedOptions: import('../src/cross-wiki/index').CrossWikiPassOptions | undefined;
  await ingest('alpha', {
    workspace,
    extractChunkFn,
    crossWiki: true,
    forceCrossWiki: true,
    runCrossWikiPassFn: async (options) => {
      receivedOptions = options;
      return { ran: true, reason: 'forced' };
    },
    onProgress: () => {},
  });
  expect(receivedOptions?.forceCrossWiki).toBe(true);
  expect(receivedOptions?.wikiSlug).toBe('alpha');
});

// ---------------------------------------------------------------------------
// Supplementary: workspace wiki enumeration ignores cross-wiki
// ---------------------------------------------------------------------------

test('supplementary: listWorkspaceWikis excludes the cross-wiki folder and init-only wikis', async () => {
  const workspace = makeTempDir('paper-chase-g24-enum-');
  await writeWikiRoot(workspace, 'alpha', 'Alpha');
  await writeWikiRoot(workspace, 'beta', 'Beta');
  await mkdir(join(workspace, 'wikis', 'cross-wiki'), { recursive: true });
  await writeFile(join(workspace, 'wikis', 'cross-wiki', 'index.md'), '# Cross-Wiki\n', 'utf-8');
  await mkdir(join(workspace, 'wikis', 'init-only'), { recursive: true });
  expect(await listWorkspaceWikis(workspace)).toEqual(['alpha', 'beta']);
});
