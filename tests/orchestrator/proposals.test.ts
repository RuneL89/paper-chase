import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import matter from 'gray-matter';
import {
  detectStructuralProposals,
  isSimpleProposal,
  writeProposalFile,
  parseProposalMarkdown,
  applyProposal,
  detectNewPageTypes,
  updateFolderIndexForNewPageTypes,
  updateAgentsMdForNewPageTypes,
  collectPageTypesPerFolder,
  syncFolderPageTypes,
  promptProposalApproval,
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

  it('writes and parses a proposal file', () => {
    const slug = 'acme';
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline', ['timeline'])],
    )[0];
    const filePath = writeProposalFile(workspace, slug, proposal);
    expect(existsSync(filePath)).toBe(true);

    const parsed = parseProposalMarkdown(readFileSync(filePath, 'utf-8'));
    expect(parsed).toBeDefined();
    expect(parsed!.type).toBe('new-folder');
    expect(parsed!.newFolderPlans[0].folder).toBe('timeline');
  });

  it('auto-approves a simple proposal when requested', async () => {
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline')],
    )[0];
    const approved = await promptProposalApproval(proposal, { autoApprove: true });
    expect(approved).toBe(true);
  });

  it('rejects a simple proposal when interactive is false', async () => {
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline')],
    )[0];
    const approved = await promptProposalApproval(proposal, { interactive: false });
    expect(approved).toBe(false);
  });

  it('applies an approved proposal by creating the new folder index', () => {
    const slug = 'acme';
    const wikiDir = path.join(workspace, 'wikis', slug);
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline', ['timeline'])],
    )[0 ];
    const filePath = writeProposalFile(workspace, slug, proposal);
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    parsed.data.status = 'approved';
    writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));

    applyProposal(workspace, slug, filePath, makeConfig(slug));

    const folderIndexPath = path.join(wikiDir, 'timeline', 'index.md');
    expect(existsSync(folderIndexPath)).toBe(true);
    const indexParsed = matter(readFileSync(folderIndexPath, 'utf-8'));
    expect(indexParsed.data.type).toBe('index');
    expect(indexParsed.content).toContain('Timeline');
  });

  it('rejects a proposal by renaming the file', () => {
    const slug = 'acme';
    const proposal = detectStructuralProposals(
      { documents: makeFolderPlan('documents', 'Documents') },
      [makeFolderPlan('documents', 'Documents'), makeFolderPlan('timeline', 'Timeline')],
    )[0];
    const filePath = writeProposalFile(workspace, slug, proposal);
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    parsed.data.status = 'rejected';
    writeFileSync(filePath, matter.stringify(parsed.content, parsed.data));

    applyProposal(workspace, slug, filePath, makeConfig(slug));
    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(filePath.replace('-structural-change.md', '-structural-change-rejected.md'))).toBe(true);
  });

  it('detects new page types inside existing folders', () => {
    const hierarchy = { documents: makeFolderPlan('documents', 'Documents', ['document']) };
    const pages: PagePlan[] = [
      { pageType: 'document', title: 'A', fileName: 'a.md', folder: 'documents', tags: [], citations: [], wikilinks: [], related: [] },
      { pageType: 'claim', title: 'B', fileName: 'b.md', folder: 'documents', tags: [], citations: [], wikilinks: [], related: [] },
    ];
    const newTypes = detectNewPageTypes(hierarchy, pages);
    expect(newTypes.get('documents')).toEqual(new Set(['claim']));
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
});
