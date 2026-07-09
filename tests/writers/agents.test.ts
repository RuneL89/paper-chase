import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { writeAgentsMd, updateAgentsMd } from '../../src/writers/agents.js';
import type { PdfStructure } from '../../src/chunking/types.js';
import type { SamplingStrategy } from '../../src/chunking/types.js';
import type { FolderPlan } from '../../src/orchestrator/types.js';

function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'agents-writer-'));
}

function makeStructure(): PdfStructure {
  return {
    hasCover: false,
    hasToc: true,
    headings: [],
    sections: [],
    tables: [{ page: 2, rows: 2, cols: 2 }],
    figures: [],
    multiPageObjects: [],
    footnotePages: [],
    appendixPages: [],
    scannedPages: [5],
    totalPages: 10,
    textDensity: 1000,
    summary: 'Test PDF with TOC and tables.',
  };
}

function makeStrategy(): SamplingStrategy {
  return {
    category: 'similar-manageable',
    largePageThreshold: 500,
    pageBudget: 50,
    reason: 'Small similar documents.',
    readFirstFully: true,
    sampleRemaining: true,
  };
}

function makeFolders(): FolderPlan[] {
  return [
    { folder: 'documents', title: 'Documents', description: 'Document chunks.', pageTypes: ['document'], children: [] },
    { folder: 'sources', title: 'Sources', description: 'Source pages.', pageTypes: ['source'], children: [] },
  ];
}

describe('writeAgentsMd', () => {
  it('writes all required AGENTS.md sections with valid frontmatter', async () => {
    const dir = tempDir();
    const filePath = path.join(dir, 'AGENTS.md');
    const context = {
      slug: 'test-wiki',
      title: 'Test Wiki',
      description: 'A test wiki.',
      structure: makeStructure(),
      samplingStrategy: makeStrategy(),
      folderPlacements: makeFolders(),
    };

    await writeAgentsMd(filePath, context);

    const raw = readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);

    expect(parsed.data.title).toBe('AGENTS.md — Test Wiki');
    expect(parsed.data.type).toBe('agents-guide');
    expect(parsed.data.wiki).toBe('test-wiki');
    expect(parsed.data.updated).toBeDefined();

    const body = parsed.content;
    expect(body).toContain('## Purpose and Scope');
    expect(body).toContain('## Folder Structure');
    expect(body).toContain('## Page Types');
    expect(body).toContain('## Naming Conventions');
    expect(body).toContain('## Citation Rules');
    expect(body).toContain('## Content Rules');
    expect(body).toContain('## Special Instructions');
    expect(body).toContain('## Workflows');
    expect(body).toContain('## Lint / Quality Rules');
    expect(body).toContain('## Authority Matrix');
    expect(body).toContain('similar-manageable');
    expect(body).toContain('documents/');
  });

  it('preserves existing created timestamp on update', async () => {
    const dir = tempDir();
    const filePath = path.join(dir, 'AGENTS.md');
    writeFileSync(filePath, '---\ncreated: 2020-01-01T00:00:00.000Z\n---\n\n# Old');

    const context = {
      slug: 'test-wiki',
      title: 'Test Wiki',
      description: 'A test wiki.',
      structure: makeStructure(),
      samplingStrategy: makeStrategy(),
    };

    await writeAgentsMd(filePath, context);

    const parsed = matter(readFileSync(filePath, 'utf-8'));
    expect(parsed.data.created).toBe('2020-01-01T00:00:00.000Z');
    expect(parsed.data.updated).toBeDefined();
  });
});

describe('updateAgentsMd', () => {
  it('updates the sampling strategy section without rewriting the whole file', () => {
    const dir = tempDir();
    const filePath = path.join(dir, 'AGENTS.md');
    const context = {
      slug: 'test-wiki',
      title: 'Test Wiki',
      description: 'A test wiki.',
      structure: makeStructure(),
      samplingStrategy: makeStrategy(),
      folderPlacements: makeFolders(),
    };
    writeAgentsMd(filePath, context);

    updateAgentsMd(filePath, {
      slug: 'test-wiki',
      title: 'Test Wiki',
      description: 'A test wiki.',
      samplingStrategy: {
        category: 'single-very-large',
        largePageThreshold: 500,
        pageBudget: 50,
        reason: 'Updated reason.',
        tocSearch: { enabled: true, firstPages: 50 },
      },
      folderPlacements: makeFolders(),
    });

    const parsed = matter(readFileSync(filePath, 'utf-8'));
    expect(parsed.content).toContain('single-very-large');
    expect(parsed.content).toContain('Updated reason.');
    expect(parsed.content).toContain('## Folder Structure');
  });
});
