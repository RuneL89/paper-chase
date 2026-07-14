import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import matter from 'gray-matter';
import { loadState, statePath } from '../../src/ingestion/state.js';
import {
  detectStructuralProposals,
  isSimpleProposal,
  writeProposalFile,
  parseProposalMarkdown,
  applyProposal,
  applyStructuralChanges,
  detectNewPageTypes,
  updateFolderIndexForNewPageTypes,
  updateAgentsMdForNewPageTypes,
  collectPageTypesPerFolder,
  syncFolderPageTypes,
  folderPlacementsFromProposal,
} from '../../src/orchestrator/proposals.js';
import type { FolderPlan, PagePlan } from '../../src/orchestrator/types.js';
import type { Config } from '../../src/config.js';

function makeConfig(slug: string): Config {
  return {
    wiki: { slug, title: 'Test Wiki', description: 'Test.' },
    output: { page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'] },
    ingestion: { entity_threshold: 1, topic_threshold: 1, max_entities: 50, max_topics: 50 },
    llm: { provider: 'test', enabled: false },
  } as Config;
}

function makeFolderPlan(folder: string, title: string, pageTypes: string[] = ['document']): FolderPlan {
  return { folder, title, description: `Folder ${folder}`, pageTypes, children: [] };
}

describe('proposals', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(path.join(tmpdir(), 'proposals-'));
  });

  afterEach(() => {
    // Node does not provide recursive rmSync in older versions; tests rely on temp cleanup.
  });

  it('detects a new-folder proposal', () => {
    const previous = { documents: makeFolderPlan('documents', 'Documents') };
    const current = [
      makeFolderPlan('documents', 'Documents'),
      makeFolderPlan('timeline', 'Timeline', ['timeline']),
    ];
    const proposals = detectStructuralProposals(previous, current);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].type).toBe('new-folder');
    expect(proposals[0].newFolderPlans).toHaveLength(1);
    expect(proposals[0].newFolderPlans[0].folder).toBe('timeline');
  });

  it('detects a restructure when multiple folders are added', () => {
    const previous = { documents: makeFolderPlan('documents', 'Documents') };
    const current = [
      makeFolderPlan('documents', 'Documents'),
      makeFolderPlan('timeline', 'Timeline'),
      makeFolderPlan('cases', 'Cases'),
    ];
    const proposals = detectStructuralProposals(previous, current);
    expect(proposals[0].type).toBe('restructure');
  });

  it('returns no proposals when the hierarchy is unchanged', () => {
    const previous = { documents: makeFolderPlan('documents', 'Documents') };
    const current = [makeFolderPlan('documents', 'Documents')];
    expect(detectStructuralProposals(previous, current)).toHaveLength(0);
  });

  it('returns no proposals when the previous hierarchy is empty', () => {
    const current = [makeFolderPlan('documents', 'Documents')];
    expect(detectStructuralProposals({}, current)).toHaveLength(0);
  });

  it('classifies a single new folder as simple', () => {
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline')],
    )[0];
    expect(isSimpleProposal(proposal)).toBe(true);
  });

  it('classifies a restructure as not simple', () => {
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [
        makeFolderPlan('documents', 'Documents'),
        makeFolderPlan('timeline', 'Timeline'),
        makeFolderPlan('cases', 'Cases'),
      ],
    )[0];
    expect(isSimpleProposal(proposal)).toBe(false);
  });

  it('writes and parses a proposal file with applied status', () => {
    const slug = 'acme';
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline', ['timeline'])],
    )[0];
    const filePath = writeProposalFile(workspace, slug, proposal);
    expect(existsSync(filePath)).toBe(true);

    const parsed = matter(readFileSync(filePath, 'utf-8'));
    expect(parsed.data.status).toBe('applied');
    expect(parsed.content).toContain('Structural Change Log');

    const parsedProposal = parseProposalMarkdown(readFileSync(filePath, 'utf-8'));
    expect(parsedProposal).toBeDefined();
    expect(parsedProposal!.type).toBe('new-folder');
    expect(parsedProposal!.newFolderPlans[0].folder).toBe('timeline');
  });

  it('applies a proposal by creating the new folder index', () => {
    const slug = 'acme';
    const wikiDir = path.join(workspace, 'wikis', slug);
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline', ['timeline'])],
    )[0 ];
    const filePath = writeProposalFile(workspace, slug, proposal);

    const state = loadState(statePath(wikiDir));
    const memory = state.memory || {
      rollingSummary: '',
      historicalSummary: '',
      summaryOnly: false,
      state: {
        document: { title: '', totalPages: 0, currentChunk: 0, boundaryType: 'page' },
        entities: {},
        topics: {},
        relationships: [],
        sources: {},
        folderHierarchy: {},
        entityTaxonomy: { subFolders: [], assignments: {} },
        rawFragments: [],
        duplicateFlags: [],
        sourceEntities: {},
        sourceTopics: {},
      },
    };

    const { approved } = applyProposal(workspace, slug, filePath, makeConfig(slug), state, memory);
    expect(approved).toBe(true);

    const folderIndexPath = path.join(wikiDir, 'timeline', 'index.md');
    expect(existsSync(folderIndexPath)).toBe(true);
    const indexParsed = matter(readFileSync(folderIndexPath, 'utf-8'));
    expect(indexParsed.data.type).toBe('index');
    expect(indexParsed.content).toContain('Timeline');
  });

  it('applies a proposal regardless of prior status', () => {
    const slug = 'acme';
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline')],
    )[0];
    const filePath = writeProposalFile(workspace, slug, proposal);
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    parsed.data.status = 'rejected';
    writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));

    const wikiDir = path.join(workspace, 'wikis', slug);
    const state = loadState(statePath(wikiDir));
    const memory = state.memory || {
      rollingSummary: '',
      historicalSummary: '',
      summaryOnly: false,
      state: {
        document: { title: '', totalPages: 0, currentChunk: 0, boundaryType: 'page' },
        entities: {},
        topics: {},
        relationships: [],
        sources: {},
        folderHierarchy: {},
        entityTaxonomy: { subFolders: [], assignments: {} },
        rawFragments: [],
        duplicateFlags: [],
        sourceEntities: {},
        sourceTopics: {},
      },
    };

    const { approved } = applyProposal(workspace, slug, filePath, makeConfig(slug), state, memory);
    expect(approved).toBe(true);
    expect(existsSync(filePath.replace('-structural-change.md', '-structural-change-applied.md'))).toBe(true);
  });

  it('applies structural changes during ingest', () => {
    const slug = 'acme';
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline', ['timeline'])],
    )[0];

    const wikiDir = path.join(workspace, 'wikis', slug);
    mkdirSync(wikiDir, { recursive: true });
    const state = loadState(statePath(wikiDir));
    const memory = state.memory || {
      rollingSummary: '',
      historicalSummary: '',
      summaryOnly: false,
      state: {
        document: { title: '', totalPages: 0, currentChunk: 0, boundaryType: 'page' },
        entities: {},
        topics: {},
        relationships: [],
        sources: {},
        folderHierarchy: {},
        entityTaxonomy: { subFolders: [], assignments: {} },
        rawFragments: [],
        duplicateFlags: [],
        sourceEntities: {},
        sourceTopics: {},
      },
    };

    const applied = applyStructuralChanges(workspace, slug, proposal, makeConfig(slug), memory, state);
    expect(applied.applied).toBe(true);

    const folderIndexPath = path.join(wikiDir, 'timeline', 'index.md');
    expect(existsSync(folderIndexPath)).toBe(true);
    expect(memory.state.folderHierarchy['timeline']).toBeDefined();
  });

  it('updates a folder index with new page types', () => {
    const folderIndexPath = path.join(workspace, 'index.md');
    writeFileSync(
      folderIndexPath,
      matter.stringify(
        [
          '# Documents',
          '',
          '## Purpose',
          '',
          'Test.',
          '',
          '## Page Types',
          '',
          '- `document`',
          '',
          '## Naming Convention',
          '',
          'Default naming.',
          '',
        ].join('\n'),
        { title: 'Documents', type: 'index' },
      ),
    );
    updateFolderIndexForNewPageTypes(folderIndexPath, ['claim']);
    const parsed = matter(readFileSync(folderIndexPath, 'utf-8'));
    expect(parsed.content).toContain('`document`');
    expect(parsed.content).toContain('`claim`');
    expect(parsed.content).toContain('`claim` pages follow the folder naming convention.');
  });

  it('updates AGENTS.md with new page types', () => {
    const agentsPath = path.join(workspace, 'AGENTS.md');
    writeFileSync(
      agentsPath,
      matter.stringify(
        [
          '## Page Types',
          '',
          '| Type | Purpose | Required frontmatter |',
          '|------|---------|----------------------|',
          '| `document` | Document chunk | `title`, `type` |',
          '',
        ].join('\n'),
        { title: 'AGENTS', type: 'agents-guide' },
      ),
    );
    updateAgentsMdForNewPageTypes(agentsPath, 'documents', ['claim', 'document']);
    const parsed = matter(readFileSync(agentsPath, 'utf-8'));
    expect(parsed.content).toContain('`claim`');
    expect(parsed.content).toContain('Auto-discovered page type in `documents/`');
  });

  it('collects page types per folder', () => {
    const pages: PagePlan[] = [
      { pageType: 'document', title: 'A', fileName: 'a.md', folder: 'documents', tags: [], citations: [], wikilinks: [], related: [] },
      { pageType: 'claim', title: 'B', fileName: 'b.md', folder: 'documents', tags: [], citations: [], wikilinks: [], related: [] },
      { pageType: 'entity', title: 'C', fileName: 'c.md', folder: 'entities', tags: [], citations: [], wikilinks: [], related: [] },
    ];
    const map = collectPageTypesPerFolder(pages);
    expect(map.get('documents')).toEqual(new Set(['document', 'claim']));
    expect(map.get('entities')).toEqual(new Set(['entity']));
  });

  it('syncs folder page types from pages', () => {
    const folders: FolderPlan[] = [makeFolderPlan('documents', 'Documents', ['document'])];
    const pages: PagePlan[] = [
      { pageType: 'document', title: 'A', fileName: 'a.md', folder: 'documents', tags: [], citations: [], wikilinks: [], related: [] },
      { pageType: 'claim', title: 'B', fileName: 'b.md', folder: 'documents', tags: [], citations: [], wikilinks: [], related: [] },
    ];
    syncFolderPageTypes(folders, pages);
    expect(folders[0].pageTypes).toContain('document');
    expect(folders[0].pageTypes).toContain('claim');
  });

  it('merges folder placements from a proposal', () => {
    const previous = { documents: makeFolderPlan('documents', 'Documents') };
    const proposal = detectStructuralProposals(
      previous,
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline')],
    )[0];
    const merged = folderPlacementsFromProposal(previous, proposal);
    const folders = merged.map((f) => f.folder);
    expect(folders).toContain('documents');
    expect(folders).toContain('timeline');
  });

  it('merges folder placements with renamed folders', () => {
    const previous = { documents: makeFolderPlan('documents', 'Documents') };
    const proposal: import('../../src/orchestrator/types.js').StructuralProposal = {
      type: 'restructure',
      reason: 'Renamed documents to timeline.',
      currentFolders: ['documents'],
      proposedFolders: ['timeline'],
      newFolderPlans: [],
      renamedFolders: [
        {
          from: 'documents',
          to: 'timeline',
          title: 'Timeline',
          description: 'Chronological documents.',
          pageTypes: ['document'],
          children: [],
        },
      ],
    };
    const merged = folderPlacementsFromProposal(previous, proposal);
    const folders = merged.map((f) => f.folder);
    expect(folders).not.toContain('documents');
    expect(folders).toContain('timeline');
  });
});
