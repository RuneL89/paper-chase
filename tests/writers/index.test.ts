import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { writeIndexOfIndexes } from '../../src/writers/index.js';

describe('index-of-indexes writer', () => {
  let workspace: string;

  beforeAll(() => {
    workspace = mkdtempSync(path.join(os.tmpdir(), 'wiki-index-writer-'));
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('TAC-001: frontmatter uses type index, wiki workspace, and children', () => {
    writeIndexOfIndexes(workspace, [
      {
        slug: 'acme',
        title: 'Acme Wiki',
        description: 'Annual reports for Acme',
        sourceCount: 2,
        documentCount: 5,
        entityCount: 3,
        topicCount: 1,
        rawCount: 0,
      },
    ]);

    const filePath = path.join(workspace, 'index-of-indexes.md');
    expect(existsSync(filePath)).toBe(true);
    const parsed = matter(readFileSync(filePath, 'utf-8'));
    expect(parsed.data.type).toBe('index');
    expect(parsed.data.wiki).toBe('workspace');
    expect(Array.isArray(parsed.data.children)).toBe(true);
    expect(parsed.data.children).toContain('wikis/acme/index.md');
  });

  it('TAC-002: body lists every wiki with source and page counts', () => {
    writeIndexOfIndexes(workspace, [
      {
        slug: 'acme',
        title: 'Acme Wiki',
        description: 'Annual reports for Acme',
        sourceCount: 2,
        documentCount: 5,
        entityCount: 3,
        topicCount: 1,
        rawCount: 0,
      },
      {
        slug: 'globex',
        title: 'Globex Wiki',
        description: 'Filings for Globex',
        sourceCount: 1,
        documentCount: 2,
        entityCount: 1,
        topicCount: 0,
        rawCount: 1,
      },
    ]);

    const content = readFileSync(path.join(workspace, 'index-of-indexes.md'), 'utf-8');
    expect(content).toContain('Acme Wiki');
    expect(content).toContain('Globex Wiki');
    expect(content).toContain('2 sources');
    expect(content).toContain('1 sources');
  });
});
