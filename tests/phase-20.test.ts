import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, expect, test } from 'vitest';
import { readIngestionState, writeIngestionState } from '../src/state/ingestion-state';
import { writeWikiLanguage } from '../src/state/language';
import { sha256 } from '../src/utils/hash';
import type { LanguageCode } from '../src/utils/language';
import {
  formatWikiRepairReport,
  isRepairableContentPage,
  repairWikilinksInMarkdown,
  repairWikilinksInWiki,
  type WikiWikilinkRepairReport,
} from '../src/utils/wikilink-repair';
import {
  buildSlugUniverse,
  checkLinks,
  type SlugUniverse,
  type SlugUniversePage,
} from '../src/validation/link-checker';

/**
 * Phase 20 gates 20.1–20.6 (wikilink repair + one-time remediation, phase doc
 * §3; canon: vision `02` §2, `07` §2.5, `05` §2; backlog B20). EVERY gate is
 * LLM-free ($0): fixture wikis are hand-written markdown in temp workspaces,
 * the repair pass is a pure function over the link checker's shared slug
 * universe, and the remediation script is exercised by spawning the real
 * `tsx scripts/repair-wikilinks.ts` (the bin/chase.js no-shell argv pattern).
 *
 * Gate 20.6 (full key-less suite: Phase 17/18/19 baselines plus these tests,
 * zero unenumerated regressions; `npx tsc --noEmit` clean) is encoded by this
 * file being part of the suite — the full-suite run itself is the
 * orchestrator's unified-verification leg.
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

function writePage(wikiDir: string, wikiRelative: string, content: string): void {
  const absolute = join(wikiDir, wikiRelative);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, 'utf-8');
}

/** rel-path -> sha256 hex of every file under `rootDir` (recursive). */
function snapshotTree(rootDir: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const absolute = join(current, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
      } else {
        const rel = relative(rootDir, absolute).replace(/\\/g, '/');
        snapshot.set(rel, createHash('sha256').update(readFileSync(absolute)).digest('hex'));
      }
    }
  };
  walk(rootDir);
  return snapshot;
}

/** In-memory universe for the pure-function unit legs (no fs). */
function syntheticUniverse(
  pages: Array<{ slug: string; aliases?: string[]; wikiRelative?: string }>,
  language?: LanguageCode,
): SlugUniverse {
  const universePages: SlugUniversePage[] = pages.map((page) => {
    const wikiRelative = page.wikiRelative ?? `entities/test/${page.slug}.md`;
    return {
      absolute: join('/virtual', wikiRelative),
      relative: `wikis/test-wiki/${wikiRelative}`,
      slug: page.slug,
      wikiRelative,
      aliases: page.aliases ?? [],
    };
  });
  const slugToPage = new Map<string, SlugUniversePage>();
  const pathToPage = new Map<string, SlugUniversePage>();
  for (const page of universePages) {
    if (!slugToPage.has(page.slug)) {
      slugToPage.set(page.slug, page);
    }
    const pathKey = page.wikiRelative.replace(/\.md$/i, '');
    if (!pathToPage.has(pathKey)) {
      pathToPage.set(pathKey, page);
    }
  }
  return {
    wikiSlug: 'test-wiki',
    pages: universePages,
    slugToPage,
    pathToPage,
    ...(language ? { language } : {}),
  };
}

const execFileAsync = promisify(execFile);

/** Spawn the real remediation script (no shell — the bin/chase.js pattern). */
async function runRepairScript(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(
    process.execPath,
    [join('node_modules', 'tsx', 'dist', 'cli.mjs'), join('scripts', 'repair-wikilinks.ts'), ...args],
    { cwd: process.cwd(), maxBuffer: 16 * 1024 * 1024, encoding: 'utf-8' },
  );
  return result as { stdout: string; stderr: string };
}

// ---------------------------------------------------------------------------
// Shared fixture pages (hand-written for byte control).
// ---------------------------------------------------------------------------

const INDIKATOR_2_PAGE = [
  '---',
  'title: "Indikator 2: Ekkokardiografi"',
  'type: entity',
  'aliases:',
  '  - "Indikator 2: Ekkokardiografi"',
  'wiki: test-wiki',
  'updated: "2026-07-29T00:00:00.000Z"',
  '---',
  '',
  '# Indikator 2: Ekkokardiografi',
  '',
  'Share of newly diagnosed patients with an echocardiography.',
  '',
].join('\n');

const LINKING_PAGE_BROKEN = [
  '---',
  'title: "Region Midtjylland"',
  'type: entity',
  'wiki: test-wiki',
  'updated: "2026-07-29T00:00:00.000Z"',
  '---',
  '',
  '# Region Midtjylland',
  '',
  'The region reports on [[indikator-2|Indikator 2]] every year.',
  '',
].join('\n');

const LINKING_PAGE_REPAIRED = [
  '---',
  'title: "Region Midtjylland"',
  'type: entity',
  'wiki: test-wiki',
  'updated: "2026-07-29T00:00:00.000Z"',
  '---',
  '',
  '# Region Midtjylland',
  '',
  'The region reports on [[indikator-2-ekkokardiografi|Indikator 2]] every year.',
  '',
].join('\n');

const CLEAN_TOPIC_PAGE = [
  '---',
  'title: "Indikator 5"',
  'type: topic',
  'wiki: test-wiki',
  'updated: "2026-07-29T00:00:00.000Z"',
  '---',
  '',
  '# Indikator 5',
  '',
  'A clean page with a valid link to [[indikator-2-ekkokardiografi|Indikator 2]].',
  '',
].join('\n');

const REGION_MIDTJYLLAND = 'entities/organizations/regions/region-midtjylland.md';
const INDIKATOR_2 = 'entities/quality-indicator/indikator-2-ekkokardiografi.md';
const INDIKATOR_5 = 'topics/quality-indicator/indikator-5.md';

// ---------------------------------------------------------------------------
// Gate 20.1 — unique-prefix repair.
// ---------------------------------------------------------------------------

test('gate 20.1: unique-prefix repair rewrites only the target, display and prose byte-identical, and the repaired link resolves in the checker', async () => {
  const workspace = makeTempDir('paper-chase-phase20-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  writePage(wikiDir, INDIKATOR_2, INDIKATOR_2_PAGE);
  writePage(wikiDir, REGION_MIDTJYLLAND, LINKING_PAGE_BROKEN);

  // Fixture sanity: the link is broken under the checker's exact semantics.
  const before = await checkLinks('test-wiki', workspace);
  expect(before.broken).toEqual([
    { page: `wikis/test-wiki/${REGION_MIDTJYLLAND}`, link: 'indikator-2|Indikator 2' },
  ]);

  const universe = await buildSlugUniverse('test-wiki', workspace);
  const result = repairWikilinksInMarkdown(LINKING_PAGE_BROKEN, universe);

  expect(result.repairs).toEqual([
    { from: 'indikator-2', to: 'indikator-2-ekkokardiografi', display: 'Indikator 2', rule: 'prefix' },
  ]);
  expect(result.unrepairable).toEqual([]);
  // Display text and every surrounding byte are untouched.
  expect(result.markdown).toBe(LINKING_PAGE_REPAIRED);

  // The repaired link resolves in the real checker.
  writePage(wikiDir, REGION_MIDTJYLLAND, result.markdown);
  const after = await checkLinks('test-wiki', workspace);
  expect(after.broken).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 20.2 — ambiguity and zero matches stay broken, never guessed.
// ---------------------------------------------------------------------------

test('gate 20.2: ambiguous and zero-match targets are left byte-identical and reported with candidates', async () => {
  const workspace = makeTempDir('paper-chase-phase20-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  const regionPage = (title: string) =>
    [
      '---',
      `title: "${title}"`,
      'type: entity',
      'aliases:',
      `  - "${title}"`,
      'wiki: test-wiki',
      'updated: "2026-07-29T00:00:00.000Z"',
      '---',
      '',
      `# ${title}`,
      '',
    ].join('\n');
  writePage(wikiDir, 'entities/organizations/regions/region-nord.md', regionPage('Region Nord'));
  writePage(wikiDir, 'entities/organizations/regions/region-syd.md', regionPage('Region Syd'));

  const linking = [
    '---',
    'title: "Overview"',
    'type: topic',
    'wiki: test-wiki',
    'updated: "2026-07-29T00:00:00.000Z"',
    '---',
    '',
    '# Overview',
    '',
    'A [[region]] mention and a [[ghost-entity]] mention.',
    '',
  ].join('\n');

  const universe = await buildSlugUniverse('test-wiki', workspace);
  const result = repairWikilinksInMarkdown(linking, universe);

  expect(result.markdown).toBe(linking); // nothing guessed — byte-identical
  expect(result.repairs).toEqual([]);
  expect(result.unrepairable).toEqual([
    { from: 'region', candidates: ['region-nord', 'region-syd'] },
    { from: 'ghost-entity', candidates: [] },
  ]);
});

// ---------------------------------------------------------------------------
// Gate 20.3 — alias-based repair (slugified aliases, input-language map).
// ---------------------------------------------------------------------------

test('gate 20.3: a target matching a page alias (slugified with the wiki input language) repairs to that page slug', async () => {
  const workspace = makeTempDir('paper-chase-phase20-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  // Mirrors the real rkkp-afdk page: the alias carries Danish `måling`, the
  // model's broken target carries the transliterated `-maaling` form.
  writePage(wikiDir, 'entities/quality-indicator/indikator-3-tsh-maaling.md', [
    '---',
    'title: "Indikator 3: Thyreoideastimulerende hormon (TSH) måling"',
    'type: entity',
    'aliases:',
    '  - "Indikator 3: Thyreoideastimulerende hormon (TSH) måling"',
    'wiki: test-wiki',
    'updated: "2026-07-29T00:00:00.000Z"',
    '---',
    '',
    '# Indikator 3: Thyreoideastimulerende hormon (TSH) måling',
    '',
  ].join('\n'));
  writePage(wikiDir, 'entities/hormones/tsh.md', [
    '---',
    'title: "TSH"',
    'type: entity',
    'aliases:',
    '  - "TSH"',
    '  - "Thyreoideastimulerende hormon"',
    'wiki: test-wiki',
    'updated: "2026-07-29T00:00:00.000Z"',
    '---',
    '',
    '# TSH',
    '',
  ].join('\n'));

  const linking = [
    '---',
    'title: "Thyroid Workup"',
    'type: topic',
    'wiki: test-wiki',
    'updated: "2026-07-29T00:00:00.000Z"',
    '---',
    '',
    '# Thyroid Workup',
    '',
    'See [[indikator-3-thyreoideastimulerende-hormon-tsh-maaling|Indikator 3: Thyreoideastimulerende hormon (TSH) måling]] and [[thyreoideastimulerende-hormon]] below.',
    '',
  ].join('\n');

  // Danish universe (the wiki's last input language): both links repair.
  const daUniverse = await buildSlugUniverse('test-wiki', workspace, { language: 'da' });
  const da = repairWikilinksInMarkdown(linking, daUniverse);
  expect(da.unrepairable).toEqual([]);
  expect(da.repairs).toEqual([
    {
      from: 'indikator-3-thyreoideastimulerende-hormon-tsh-maaling',
      to: 'indikator-3-tsh-maaling',
      display: 'Indikator 3: Thyreoideastimulerende hormon (TSH) måling',
      rule: 'alias',
    },
    { from: 'thyreoideastimulerende-hormon', to: 'tsh', rule: 'alias' },
  ]);
  expect(da.markdown).toBe(
    linking
      .replace(
        '[[indikator-3-thyreoideastimulerende-hormon-tsh-maaling|',
        '[[indikator-3-tsh-maaling|',
      )
      .replace('[[thyreoideastimulerende-hormon]]', '[[tsh]]'),
  );

  // English-default universe: the `måling` alias slugifies to `-m-ling`, so
  // the first target has ZERO candidates (never guessed); the ASCII alias
  // still repairs — this pins the input-language awareness of the alias rule.
  const enUniverse = await buildSlugUniverse('test-wiki', workspace);
  const en = repairWikilinksInMarkdown(linking, enUniverse);
  expect(en.repairs).toEqual([{ from: 'thyreoideastimulerende-hormon', to: 'tsh', rule: 'alias' }]);
  expect(en.unrepairable).toEqual([
    { from: 'indikator-3-thyreoideastimulerende-hormon-tsh-maaling', display: 'Indikator 3: Thyreoideastimulerende hormon (TSH) måling', candidates: [] },
  ]);
});

// ---------------------------------------------------------------------------
// Gate 20.4 — hash re-convergence after remediation (no B19-class flags).
// ---------------------------------------------------------------------------

test('gate 20.4: remediation re-converges pageHashes for modified pages only; unmodified entries and sources untouched', async () => {
  const workspace = makeTempDir('paper-chase-phase20-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  writePage(wikiDir, INDIKATOR_2, INDIKATOR_2_PAGE);
  writePage(wikiDir, REGION_MIDTJYLLAND, LINKING_PAGE_BROKEN);
  writePage(wikiDir, INDIKATOR_5, CLEAN_TOPIC_PAGE);

  const preHashes: Record<string, string> = {};
  for (const rel of [INDIKATOR_2, REGION_MIDTJYLLAND, INDIKATOR_5]) {
    preHashes[rel] = await sha256(join(wikiDir, rel));
  }
  const sources = {
    'source-one': {
      hash: 'abc123',
      documentPages: ['documents/source-one-part-001.md'],
      ingestedAt: '2026-07-29T00:00:00.000Z',
      language: 'en',
    },
  };
  await writeIngestionState(wikiDir, { sources, pageHashes: { ...preHashes } });

  const report = await repairWikilinksInWiki(wikiDir, 'test-wiki');

  expect(report.dry).toBe(false);
  expect(report.repaired).toEqual([
    {
      page: REGION_MIDTJYLLAND,
      from: 'indikator-2',
      to: 'indikator-2-ekkokardiografi',
      display: 'Indikator 2',
      rule: 'prefix',
    },
  ]);
  expect(report.unrepairable).toEqual([]);
  expect(report.modifiedPages).toEqual([REGION_MIDTJYLLAND]);
  expect(report.unchangedPages).toBe(2);
  expect(report.pageHashesUpdated).toBe(1);

  // The page on disk is exactly the repaired markdown.
  expect(readFileSync(join(wikiDir, REGION_MIDTJYLLAND), 'utf-8')).toBe(LINKING_PAGE_REPAIRED);

  // pageHashes: modified page re-converged to its NEW disk hash (no false
  // "manual edit" flag on the next ingest); the other entries byte-untouched.
  const state = await readIngestionState(wikiDir);
  expect(state.sources).toEqual(sources);
  expect(Object.keys(state.pageHashes ?? {}).sort()).toEqual(
    [INDIKATOR_2, REGION_MIDTJYLLAND, INDIKATOR_5].sort(),
  );
  const newDiskHash = await sha256(join(wikiDir, REGION_MIDTJYLLAND));
  expect(state.pageHashes?.[REGION_MIDTJYLLAND]).toBe(newDiskHash);
  expect(state.pageHashes?.[REGION_MIDTJYLLAND]).not.toBe(preHashes[REGION_MIDTJYLLAND]);
  expect(state.pageHashes?.[INDIKATOR_2]).toBe(preHashes[INDIKATOR_2]);
  expect(state.pageHashes?.[INDIKATOR_5]).toBe(preHashes[INDIKATOR_5]);

  // The wiki now validates clean.
  const after = await checkLinks('test-wiki', workspace);
  expect(after.broken).toEqual([]);
});

// ---------------------------------------------------------------------------
// Gate 20.5 — remediation dry-run prints the exact report without writing.
// ---------------------------------------------------------------------------

test(
  'gate 20.5: the remediation script dry-run prints the full per-wiki report without writing a byte',
  async () => {
    const workspace = makeTempDir('paper-chase-phase20-');
    const wikiDir = join(workspace, 'wikis', 'test-wiki');
    writePage(wikiDir, INDIKATOR_2, INDIKATOR_2_PAGE);
    writePage(wikiDir, REGION_MIDTJYLLAND, LINKING_PAGE_BROKEN);
    writePage(wikiDir, 'topics/misc/notes.md', [
      '---',
      'title: "Notes"',
      'type: topic',
      'wiki: test-wiki',
      'updated: "2026-07-29T00:00:00.000Z"',
      '---',
      '',
      '# Notes',
      '',
      'An unfixable link: [[indikator-6|Indikator 6]].',
      '',
    ].join('\n'));
    await writeIngestionState(wikiDir, {
      sources: {},
      pageHashes: { [REGION_MIDTJYLLAND]: await sha256(join(wikiDir, REGION_MIDTJYLLAND)) },
    });

    const before = snapshotTree(workspace);
    const { stdout } = await runRepairScript([join(workspace, 'wikis'), '--dry']);
    const after = snapshotTree(workspace);

    // The exact per-wiki report: repairs old -> new, unrepairable with
    // candidates, unchanged count, dry markers.
    expect(stdout).toContain('Wiki test-wiki:');
    expect(stdout).toContain('  Repaired 1 link(s) across 1 page(s):');
    expect(stdout).toContain(
      `    ${REGION_MIDTJYLLAND}: [[indikator-2|Indikator 2]] -> [[indikator-2-ekkokardiografi|Indikator 2]] (prefix)`,
    );
    expect(stdout).toContain('  Unrepairable 1 link(s) (left unchanged):');
    expect(stdout).toContain('    topics/misc/notes.md: [[indikator-6|Indikator 6]] (no candidates)');
    expect(stdout).toContain('  Unchanged pages: 2');
    expect(stdout).toContain('  (dry run — no files written)');
    expect(stdout).toContain('1 page(s) would be modified');
    expect(stdout).toContain('Dry run — no files written.');

    // Not a byte was written — every file under the workspace is identical.
    expect(after).toEqual(before);
  },
  { timeout: 120_000 },
);

// ---------------------------------------------------------------------------
// Supplementary: the script's real mode repairs and re-converges end-to-end.
// ---------------------------------------------------------------------------

test(
  'supplementary: the remediation script real mode rewrites pages and re-converges pageHashes',
  async () => {
    const workspace = makeTempDir('paper-chase-phase20-');
    const wikiDir = join(workspace, 'wikis', 'test-wiki');
    writePage(wikiDir, INDIKATOR_2, INDIKATOR_2_PAGE);
    writePage(wikiDir, REGION_MIDTJYLLAND, LINKING_PAGE_BROKEN);
    const preHash = await sha256(join(wikiDir, REGION_MIDTJYLLAND));
    await writeIngestionState(wikiDir, { sources: {}, pageHashes: { [REGION_MIDTJYLLAND]: preHash } });

    const { stdout } = await runRepairScript([join(workspace, 'wikis')]);

    expect(stdout).toContain('Wiki test-wiki:');
    expect(stdout).toContain('  pageHashes re-converged: 1 page(s)');
    expect(stdout).toContain('1 page(s) modified');
    expect(stdout).not.toContain('DRY RUN');

    expect(readFileSync(join(wikiDir, REGION_MIDTJYLLAND), 'utf-8')).toBe(LINKING_PAGE_REPAIRED);
    const state = await readIngestionState(wikiDir);
    expect(state.pageHashes?.[REGION_MIDTJYLLAND]).toBe(await sha256(join(wikiDir, REGION_MIDTJYLLAND)));
    expect(state.pageHashes?.[REGION_MIDTJYLLAND]).not.toBe(preHash);
    const after = await checkLinks('test-wiki', workspace);
    expect(after.broken).toEqual([]);
  },
  { timeout: 120_000 },
);

// ---------------------------------------------------------------------------
// Supplementary: the remediation core picks up the wiki's input language.
// ---------------------------------------------------------------------------

test('supplementary: repairWikilinksInWiki reads .state/language.json so Danish aliases repair', async () => {
  const workspace = makeTempDir('paper-chase-phase20-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  writePage(wikiDir, 'entities/quality-indicator/indikator-3-tsh-maaling.md', [
    '---',
    'title: "Indikator 3: Thyreoideastimulerende hormon (TSH) måling"',
    'type: entity',
    'aliases:',
    '  - "Indikator 3: Thyreoideastimulerende hormon (TSH) måling"',
    'wiki: test-wiki',
    'updated: "2026-07-29T00:00:00.000Z"',
    '---',
    '',
    '# Indikator 3',
    '',
  ].join('\n'));
  writePage(wikiDir, 'topics/misc/notes.md', [
    '---',
    'title: "Notes"',
    'type: topic',
    'wiki: test-wiki',
    'updated: "2026-07-29T00:00:00.000Z"',
    '---',
    '',
    '# Notes',
    '',
    'See [[indikator-3-thyreoideastimulerende-hormon-tsh-maaling|Indikator 3]].',
    '',
  ].join('\n'));
  await writeWikiLanguage(wikiDir, { outputLanguage: 'da', lastInputLanguage: 'da' });

  const report = await repairWikilinksInWiki(wikiDir, 'test-wiki');
  expect(report.repaired).toEqual([
    {
      page: 'topics/misc/notes.md',
      from: 'indikator-3-thyreoideastimulerende-hormon-tsh-maaling',
      to: 'indikator-3-tsh-maaling',
      display: 'Indikator 3',
      rule: 'alias',
    },
  ]);
  expect(report.unrepairable).toEqual([]);
});

// ---------------------------------------------------------------------------
// Supplementary: remediation scope — index/sources/documents pages untouched.
// ---------------------------------------------------------------------------

test('supplementary: remediation skips index.md, sources/, and documents/ pages entirely', async () => {
  const workspace = makeTempDir('paper-chase-phase20-');
  const wikiDir = join(workspace, 'wikis', 'test-wiki');
  writePage(wikiDir, INDIKATOR_2, INDIKATOR_2_PAGE);
  writePage(wikiDir, REGION_MIDTJYLLAND, LINKING_PAGE_BROKEN);
  const brokenBody = '---\ntitle: "X"\ntype: index\nupdated: "2026-07-29T00:00:00.000Z"\n---\n\n# X\n\nLinks [[indikator-2|Indikator 2]] here.\n';
  writePage(wikiDir, 'entities/index.md', brokenBody);
  writePage(wikiDir, 'topics/index.md', brokenBody);
  writePage(wikiDir, 'sources/source-one.md', brokenBody);
  writePage(wikiDir, 'documents/source-one-part-001.md', brokenBody);
  await writeIngestionState(wikiDir, { sources: {}, pageHashes: {} });

  const report = await repairWikilinksInWiki(wikiDir, 'test-wiki');

  expect(report.modifiedPages).toEqual([REGION_MIDTJYLLAND]);
  expect(report.unchangedPages).toBe(1); // only the clean indikator page
  // Out-of-scope pages are never even scanned for unrepairable links.
  expect(report.unrepairable).toEqual([]);
  for (const rel of ['entities/index.md', 'topics/index.md', 'sources/source-one.md', 'documents/source-one-part-001.md']) {
    expect(readFileSync(join(wikiDir, rel), 'utf-8')).toBe(brokenBody);
  }
});

// ---------------------------------------------------------------------------
// Supplementary: pure-function unit legs (synthetic universes, no fs).
// ---------------------------------------------------------------------------

test('supplementary: resolved links and link-free pages stay byte-identical', () => {
  const universe = syntheticUniverse([{ slug: 'alpha' }, { slug: 'beta' }]);
  const resolved = 'See [[alpha|Alpha]] and [[beta]] and [[entities/test/alpha|Alpha by path]].\n';
  const result = repairWikilinksInMarkdown(resolved, universe);
  expect(result.markdown).toBe(resolved);
  expect(result.repairs).toEqual([]);
  expect(result.unrepairable).toEqual([]);

  const linkFree = '---\ntitle: "No links"\n---\n\n# No links\n\nNothing here.\n';
  expect(repairWikilinksInMarkdown(linkFree, universe).markdown).toBe(linkFree);
});

test('supplementary: whitespace inside the link and bare forms are preserved exactly', () => {
  const universe = syntheticUniverse([{ slug: 'indikator-2-ekkokardiografi' }]);
  const spaced = 'A [[ indikator-2 | Indikator 2 ]] link.\n';
  expect(repairWikilinksInMarkdown(spaced, universe).markdown).toBe(
    'A [[ indikator-2-ekkokardiografi | Indikator 2 ]] link.\n',
  );

  const bare = 'A [[indikator-2]] link.\n';
  const bareResult = repairWikilinksInMarkdown(bare, universe);
  expect(bareResult.markdown).toBe('A [[indikator-2-ekkokardiografi]] link.\n');
  expect(bareResult.repairs).toEqual([
    { from: 'indikator-2', to: 'indikator-2-ekkokardiografi', rule: 'prefix' },
  ]);
});

test('supplementary: every occurrence of a repeated broken link is repaired and reported', () => {
  const universe = syntheticUniverse([{ slug: 'indikator-2-ekkokardiografi' }]);
  const repeated = '[[indikator-2|Indikator 2]] then [[indikator-2|Indikator 2]] again.\n';
  const result = repairWikilinksInMarkdown(repeated, universe);
  expect(result.markdown).toBe(
    '[[indikator-2-ekkokardiografi|Indikator 2]] then [[indikator-2-ekkokardiografi|Indikator 2]] again.\n',
  );
  expect(result.repairs).toHaveLength(2);
  expect(result.unrepairable).toEqual([]);
});

test('supplementary: ambiguous aliases are never guessed; prefix rule beats the alias rule', () => {
  const ambiguous = syntheticUniverse([
    { slug: 'hormon-a', aliases: ['Thyreoideastimulerende hormon'] },
    { slug: 'hormon-b', aliases: ['Thyreoideastimulerende hormon'] },
  ]);
  const ambiguousResult = repairWikilinksInMarkdown('A [[thyreoideastimulerende-hormon]] link.\n', ambiguous);
  expect(ambiguousResult.markdown).toBe('A [[thyreoideastimulerende-hormon]] link.\n');
  expect(ambiguousResult.repairs).toEqual([]);
  expect(ambiguousResult.unrepairable).toEqual([
    { from: 'thyreoideastimulerende-hormon', candidates: ['hormon-a', 'hormon-b'] },
  ]);

  // Unique prefix match wins over a unique alias match on another page.
  const prefixWins = syntheticUniverse([
    { slug: 'region-nord' },
    { slug: 'aliased', aliases: ['Region'] },
  ]);
  const prefixResult = repairWikilinksInMarkdown('A [[region]] link.\n', prefixWins);
  expect(prefixResult.markdown).toBe('A [[region-nord]] link.\n');
  expect(prefixResult.repairs).toEqual([{ from: 'region', to: 'region-nord', rule: 'prefix' }]);
});

test('supplementary: degenerate targets are safe (empty target untouched, unslugifiable reported)', () => {
  const universe = syntheticUniverse([{ slug: 'alpha' }]);
  const emptyTarget = 'A [[|Display]] link.\n';
  expect(repairWikilinksInMarkdown(emptyTarget, universe).markdown).toBe(emptyTarget);

  const unslugifiable = repairWikilinksInMarkdown('A [[!!!]] link.\n', universe);
  expect(unslugifiable.markdown).toBe('A [[!!!]] link.\n');
  expect(unslugifiable.repairs).toEqual([]);
  expect(unslugifiable.unrepairable).toEqual([{ from: '!!!', candidates: [] }]);
});

test('supplementary: isRepairableContentPage scopes exactly entity/topic content pages', () => {
  const page = (wikiRelative: string) => ({ wikiRelative });
  expect(isRepairableContentPage(page('entities/people/john-smith.md'))).toBe(true);
  expect(isRepairableContentPage(page('topics/financial/revenue.md'))).toBe(true);
  expect(isRepairableContentPage(page('entities/index.md'))).toBe(false);
  expect(isRepairableContentPage(page('topics/financial/index.md'))).toBe(false);
  expect(isRepairableContentPage(page('index.md'))).toBe(false);
  expect(isRepairableContentPage(page('sources/source-one.md'))).toBe(false);
  expect(isRepairableContentPage(page('documents/source-one-part-001.md'))).toBe(false);
});

test('supplementary: formatWikiRepairReport renders repairs, candidates, unchanged count, and mode lines', () => {
  const report: WikiWikilinkRepairReport = {
    wikiSlug: 'afdk',
    dry: true,
    repaired: [
      {
        page: 'entities/a/x.md',
        from: 'indikator-2',
        to: 'indikator-2-ekkokardiografi',
        display: 'Indikator 2',
        rule: 'prefix',
      },
      { page: 'entities/a/y.md', from: 'old-name', to: 'canonical-slug', rule: 'alias' },
    ],
    unrepairable: [
      { page: 'topics/b/z.md', from: 'region', candidates: ['region-nord', 'region-syd'] },
      { page: 'topics/b/z.md', from: 'ghost', display: 'Ghost', candidates: [] },
    ],
    unchangedPages: 7,
    modifiedPages: ['entities/a/x.md', 'entities/a/y.md'],
    pageHashesUpdated: 0,
  };
  expect(formatWikiRepairReport(report)).toBe(
    [
      'Wiki afdk:',
      '  Repaired 2 link(s) across 2 page(s):',
      '    entities/a/x.md: [[indikator-2|Indikator 2]] -> [[indikator-2-ekkokardiografi|Indikator 2]] (prefix)',
      '    entities/a/y.md: [[old-name]] -> [[canonical-slug]] (alias)',
      '  Unrepairable 2 link(s) (left unchanged):',
      '    topics/b/z.md: [[region]] (candidates: region-nord, region-syd)',
      '    topics/b/z.md: [[ghost|Ghost]] (no candidates)',
      '  Unchanged pages: 7',
      '  (dry run — no files written)',
    ].join('\n'),
  );

  const realReport: WikiWikilinkRepairReport = {
    ...report,
    dry: false,
    repaired: [],
    unrepairable: [],
    unchangedPages: 9,
    modifiedPages: [],
    pageHashesUpdated: 3,
  };
  expect(formatWikiRepairReport(realReport)).toBe(
    [
      'Wiki afdk:',
      '  Repaired: none',
      '  Unrepairable: none',
      '  Unchanged pages: 9',
      '  pageHashes re-converged: 3 page(s)',
    ].join('\n'),
  );
});
