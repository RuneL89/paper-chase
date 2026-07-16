import { describe, it, expect, beforeEach } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import matter from 'gray-matter';
import {
  runReingest,
  buildReingestPlan,
  applyReingestFromProposal,
} from '../../src/ingestion/reingest.js';
import {
  loadState,
  saveState,
  statePath,
  hashPageContent,
  type IngestionState,
  type PageState,
} from '../../src/ingestion/state.js';
import type { Config } from '../../src/config.js';
import type { FolderPlan } from '../../src/orchestrator/types.js';

function makeFolderPlan(folder: string, title: string, pageTypes: string[] = ['document']): FolderPlan {
  return { folder, title, description: `Folder ${folder}`, pageTypes, children: [] };
}

function makeConfig(slug: string): Config {
  return {
    wiki: { slug, title: 'Test Wiki', description: 'Test.', version: '1.0' },
    schema: { wiki_index_md: 'index.md', chunking_strategy_md: 'chunking-strategy.md' },
    chunking: {
      max_chunk_size: 100000,
      min_chunk_size: 1000,
      split_boundary: 'page',
      never_split: ['table'],
      overlap: 0,
    },
    extraction: { engine: 'pdfjs-dist', ocr_enabled: true, page_range: null },
    output: { page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'] },
    ingestion: { entity_threshold: 1, topic_threshold: 1, max_entities: 50, max_topics: 50 },
    sampling: { large_page_threshold: 500, strategy_page_budget: 50, similarity_metadata_keys: ['title'] },
    resilience: { recoveryMode: 'abort', circuitBreakerThreshold: 0.3, circuitBreakerWindowMs: 300000 },
    status: 'ready',
  } as Config;
}

function writePage(wikiDir: string, pagePath: string, pageType: string, body = 'Body.'): void {
  const fullPath = path.join(wikiDir, pagePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  const content = matter.stringify(body, {
    title: path.basename(pagePath, '.md'),
    type: pageType,
    wiki: 'acme',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  });
  writeFileSync(fullPath, content);
}

function seedState(wikiDir: string, config: Config, pages: Record<string, PageState>, sourcePages: string[] = []): void {
  const state: IngestionState = {
    version: '1.1',
    lastRun: new Date().toISOString(),
    sources: {
      'raw/source.pdf': {
        sha256: 'abc',
        mtime: 1,
        sourcePage: 'sources/source.md',
        documentPages: sourcePages,
        rawPages: [],
        entities: {},
        topics: {},
        chunkCount: 1,
      },
    },
    pages,
  };
  saveState(statePath(wikiDir), state);
}

describe('reingest', () => {
  let workspace: string;
  let wikiDir: string;
  let config: Config;

  beforeEach(() => {
    workspace = mkdtempSync(path.join(tmpdir(), 'reingest-'));
    wikiDir = path.join(workspace, 'wikis', 'acme');
    mkdirSync(path.join(wikiDir, 'raw'), { recursive: true });
    mkdirSync(path.join(wikiDir, 'documents'), { recursive: true });
    mkdirSync(path.join(wikiDir, 'sources'), { recursive: true });
    config = makeConfig('acme');
  });

  it('buildReingestPlan flags pages whose folder is removed', () => {
    writePage(wikiDir, 'documents/old.md', 'document');
    const pages: Record<string, PageState> = {
      'documents/old.md': { folder: 'documents', pageType: 'document', generatedHash: hashPageContent(readFileSync(path.join(wikiDir, 'documents/old.md'), 'utf-8')), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/old.md']);
    const state = loadState(statePath(wikiDir));

    const hierarchy: Record<string, FolderPlan> = {
      sources: makeFolderPlan('sources', 'Sources'),
    };
    const plan = buildReingestPlan(state, hierarchy, wikiDir);
    expect(plan.affectedPages.has('documents/old.md')).toBe(true);
  });

  it('buildReingestPlan flags pages whose page type is removed', () => {
    writePage(wikiDir, 'documents/legacy.md', 'legacy');
    const pages: Record<string, PageState> = {
      'documents/legacy.md': { folder: 'documents', pageType: 'legacy', generatedHash: hashPageContent(readFileSync(path.join(wikiDir, 'documents/legacy.md'), 'utf-8')), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/legacy.md']);
    const state = loadState(statePath(wikiDir));

    const hierarchy: Record<string, FolderPlan> = {
      documents: makeFolderPlan('documents', 'Documents', ['document']),
    };
    const plan = buildReingestPlan(state, hierarchy, wikiDir);
    expect(plan.affectedPages.has('documents/legacy.md')).toBe(true);
  });

  it('buildReingestPlan flags pages whose page type moved to a different folder', () => {
    writePage(wikiDir, 'documents/timeline.md', 'timeline');
    const pages: Record<string, PageState> = {
      'documents/timeline.md': { folder: 'documents', pageType: 'timeline', generatedHash: hashPageContent(readFileSync(path.join(wikiDir, 'documents/timeline.md'), 'utf-8')), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/timeline.md']);
    const state = loadState(statePath(wikiDir));

    const hierarchy: Record<string, FolderPlan> = {
      documents: makeFolderPlan('documents', 'Documents', ['document']),
      timeline: makeFolderPlan('timeline', 'Timeline', ['timeline']),
    };
    const plan = buildReingestPlan(state, hierarchy, wikiDir);
    expect(plan.affectedPages.has('documents/timeline.md')).toBe(true);
  });

  it('buildReingestPlan leaves unchanged pages alone', () => {
    writePage(wikiDir, 'documents/unchanged.md', 'document');
    const pages: Record<string, PageState> = {
      'documents/unchanged.md': { folder: 'documents', pageType: 'document', generatedHash: hashPageContent(readFileSync(path.join(wikiDir, 'documents/unchanged.md'), 'utf-8')), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/unchanged.md']);
    const state = loadState(statePath(wikiDir));

    const hierarchy: Record<string, FolderPlan> = {
      documents: makeFolderPlan('documents', 'Documents', ['document']),
      timeline: makeFolderPlan('timeline', 'Timeline', ['timeline']),
    };
    const plan = buildReingestPlan(state, hierarchy, wikiDir);
    expect(plan.affectedPages.has('documents/unchanged.md')).toBe(false);
  });

  it('buildReingestPlan detects manual edits and always skips them', () => {
    writePage(wikiDir, 'documents/timeline.md', 'timeline');
    const originalContent = readFileSync(path.join(wikiDir, 'documents/timeline.md'), 'utf-8');
    const pages: Record<string, PageState> = {
      'documents/timeline.md': { folder: 'documents', pageType: 'timeline', generatedHash: hashPageContent(originalContent), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/timeline.md']);

    // Simulate a manual edit by appending text to the page body.
    const editedContent = originalContent + '\n\nManual edit.';
    writeFileSync(path.join(wikiDir, 'documents/timeline.md'), editedContent);

    const state = loadState(statePath(wikiDir));
    const hierarchy: Record<string, FolderPlan> = {
      documents: makeFolderPlan('documents', 'Documents', ['document']),
      timeline: makeFolderPlan('timeline', 'Timeline', ['timeline']),
    };

    const plan = buildReingestPlan(state, hierarchy, wikiDir);
    expect(plan.affectedPages.has('documents/timeline.md')).toBe(true);
    expect(plan.manualEditWarnings.length).toBe(1);
    expect(plan.manualEditWarnings[0]).toContain('skipped');
    expect(plan.pagesToSkip.has('documents/timeline.md')).toBe(true);
  });

  it('runReingest moves an affected page to the new folder and preserves LLM-authored content', async () => {
    const originalTitle = 'Original Timeline';
    const originalBody = 'Original LLM-authored body.';
    const filePath = path.join(wikiDir, 'documents/timeline.md');
    mkdirSync(path.dirname(filePath), { recursive: true });
    const originalContent = matter.stringify(originalBody, {
      title: originalTitle,
      type: 'timeline',
      wiki: 'acme',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    });
    writeFileSync(filePath, originalContent);

    const pages: Record<string, PageState> = {
      'documents/timeline.md': { folder: 'documents', pageType: 'timeline', generatedHash: hashPageContent(originalContent), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/timeline.md']);

    const hierarchy: Record<string, FolderPlan> = {
      documents: makeFolderPlan('documents', 'Documents', ['document']),
      timeline: makeFolderPlan('timeline', 'Timeline', ['timeline']),
    };

    const result = await runReingest(workspace, 'acme', config, hierarchy);
    expect(result.affectedPages).toContain('documents/timeline.md');
    expect(result.pagesMoved).toContain('documents/timeline.md -> timeline/timeline.md');
    expect(existsSync(path.join(wikiDir, 'documents/timeline.md'))).toBe(false);
    expect(existsSync(path.join(wikiDir, 'timeline/timeline.md'))).toBe(true);

    const movedContent = readFileSync(path.join(wikiDir, 'timeline/timeline.md'), 'utf-8');
    expect(movedContent).toBe(originalContent);
    const movedParsed = matter(movedContent);
    expect(movedParsed.data.title).toBe(originalTitle);
    expect(movedParsed.content.trim()).toBe(originalBody);

    const state = loadState(statePath(wikiDir));
    expect(state.pages!['timeline/timeline.md']).toBeDefined();
    expect(state.pages!['timeline/timeline.md'].folder).toBe('timeline');
    expect(state.pages!['documents/timeline.md']).toBeUndefined();
    expect(state.sources['raw/source.pdf'].documentPages).toContain('timeline/timeline.md');
  });

  it('runReingest skips moving manually edited pages', async () => {
    const originalBody = 'Original LLM-authored body.';
    writePage(wikiDir, 'documents/timeline.md', 'timeline', originalBody);
    const originalContent = readFileSync(path.join(wikiDir, 'documents/timeline.md'), 'utf-8');
    const pages: Record<string, PageState> = {
      'documents/timeline.md': { folder: 'documents', pageType: 'timeline', generatedHash: hashPageContent(originalContent), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/timeline.md']);

    // Simulate a manual edit.
    const editedContent = originalContent + '\n\nManual edit.';
    writeFileSync(path.join(wikiDir, 'documents/timeline.md'), editedContent);

    const hierarchy: Record<string, FolderPlan> = {
      documents: makeFolderPlan('documents', 'Documents', ['document']),
      timeline: makeFolderPlan('timeline', 'Timeline', ['timeline']),
    };

    const result = await runReingest(workspace, 'acme', config, hierarchy);
    expect(result.affectedPages).toContain('documents/timeline.md');
    expect(result.pagesMoved).not.toContain('documents/timeline.md -> timeline/timeline.md');
    expect(result.skippedPages).toContain('documents/timeline.md');
    expect(existsSync(path.join(wikiDir, 'documents/timeline.md'))).toBe(true);
    expect(existsSync(path.join(wikiDir, 'timeline/timeline.md'))).toBe(false);
    expect(readFileSync(path.join(wikiDir, 'documents/timeline.md'), 'utf-8')).toBe(editedContent);
  });

  it('runReingest deletes pages whose page type is removed', async () => {
    writePage(wikiDir, 'documents/legacy.md', 'legacy');
    const pages: Record<string, PageState> = {
      'documents/legacy.md': { folder: 'documents', pageType: 'legacy', generatedHash: hashPageContent(readFileSync(path.join(wikiDir, 'documents/legacy.md'), 'utf-8')), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/legacy.md']);

    const hierarchy: Record<string, FolderPlan> = {
      documents: makeFolderPlan('documents', 'Documents', ['document']),
    };

    const result = await runReingest(workspace, 'acme', config, hierarchy);
    expect(result.pagesDeleted).toContain('documents/legacy.md');
    expect(existsSync(path.join(wikiDir, 'documents/legacy.md'))).toBe(false);
    const state = loadState(statePath(wikiDir));
    expect(state.pages!['documents/legacy.md']).toBeUndefined();
  });

  it('runReingest leaves unaffected pages unchanged', async () => {
    writePage(wikiDir, 'documents/keep.md', 'document', 'Keep me.');
    writePage(wikiDir, 'documents/timeline.md', 'timeline');
    const pages: Record<string, PageState> = {
      'documents/keep.md': { folder: 'documents', pageType: 'document', generatedHash: hashPageContent(readFileSync(path.join(wikiDir, 'documents/keep.md'), 'utf-8')), updatedAt: new Date().toISOString() },
      'documents/timeline.md': { folder: 'documents', pageType: 'timeline', generatedHash: hashPageContent(readFileSync(path.join(wikiDir, 'documents/timeline.md'), 'utf-8')), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/keep.md', 'documents/timeline.md']);

    const hierarchy: Record<string, FolderPlan> = {
      documents: makeFolderPlan('documents', 'Documents', ['document']),
      timeline: makeFolderPlan('timeline', 'Timeline', ['timeline']),
    };

    const originalContent = readFileSync(path.join(wikiDir, 'documents/keep.md'), 'utf-8');
    await runReingest(workspace, 'acme', config, hierarchy);
    expect(readFileSync(path.join(wikiDir, 'documents/keep.md'), 'utf-8')).toBe(originalContent);
    expect(existsSync(path.join(wikiDir, 'timeline/timeline.md'))).toBe(true);
  });

  it('applyReingestFromProposal merges new folders and updates contracts', async () => {
    writePage(wikiDir, 'documents/keep.md', 'document', 'Keep me.');
    const pages: Record<string, PageState> = {
      'documents/keep.md': { folder: 'documents', pageType: 'document', generatedHash: hashPageContent(readFileSync(path.join(wikiDir, 'documents/keep.md'), 'utf-8')), updatedAt: new Date().toISOString() },
    };
    seedState(wikiDir, config, pages, ['documents/keep.md']);
    mkdirSync(path.join(wikiDir, 'documents'), { recursive: true });
    writeFileSync(path.join(wikiDir, 'index.md'), matter.stringify('# Acme\n', { title: 'Acme', type: 'index' }));
    writeFileSync(path.join(wikiDir, 'AGENTS.md'), matter.stringify('## Page Types\n\n| Type | Purpose | Required frontmatter |\n|------|---------|----------------------|\n| `document` | Document chunk | `title`, `type` |\n', { title: 'AGENTS', type: 'agents-guide' }));

    const proposal = {
      type: 'new-folder' as const,
      reason: 'Need a timeline folder.',
      currentFolders: ['documents'],
      proposedFolders: ['documents', 'timeline'],
      newFolderPlans: [makeFolderPlan('timeline', 'Timeline', ['timeline'])],
    };

    await applyReingestFromProposal(workspace, 'acme', config, proposal);

    expect(existsSync(path.join(wikiDir, 'timeline', 'index.md'))).toBe(true);
    const indexParsed = matter(readFileSync(path.join(wikiDir, 'index.md'), 'utf-8'));
    expect(indexParsed.data.children).toContain('timeline/index.md');
    const agentsContent = readFileSync(path.join(wikiDir, 'AGENTS.md'), 'utf-8');
    expect(agentsContent).toContain('timeline');
  });
});
