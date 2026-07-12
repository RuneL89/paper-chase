import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { SlugRegistry } from '../../src/utils/slug.js';
import { writeEntityPage, entityPageTitle, type EntityMention } from '../../src/entities/index.js';
import type { Config } from '../../src/config.js';

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'wiki-entities-'));
}

function makeConfig(slug: string): Config {
  return {
    wiki: {
      slug,
      title: `${slug} Wiki`,
      description: `Wiki for ${slug}`,
      version: '1.0',
    },
    schema: {
      wiki_index_md: 'index.md',
      chunking_strategy_md: 'chunking-strategy.md',
    },
    chunking: {
      max_chunk_size: 100000,
      min_chunk_size: 1000,
      split_boundary: 'page',
      never_split: ['table'],
      overlap: 0,
    },
    extraction: {
      engine: 'pdfjs-dist',
      ocr_enabled: true,
      page_range: null,
    },
    output: {
      dir: '.',
      page_types: ['index', 'source', 'document', 'topic', 'entity', 'raw'],
    },
    ingestion: {
      entity_threshold: 2,
      topic_threshold: 2,
      max_entities: 50,
      max_topics: 50,
    },
    status: 'ready',
    resilience: {
      recoveryMode: 'abort',
      circuitBreakerThreshold: 0.3,
      circuitBreakerWindowMs: 300000,
    },
  };
}

function entityFileNameWithRegistry(entity: EntityMention, registry: SlugRegistry): string {
  const base = entity.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const disambiguated = registry.register(entity.name);
  return disambiguated === base ? `${base}.md` : `${disambiguated}.md`;
}

describe('TAC-001: entity slug collisions are resolved with incremental suffixes', () => {
  it('first entity keeps base slug, second gets -1, third gets -2', () => {
    const registry = new SlugRegistry();
    expect(registry.register('John Smith')).toBe('john-smith');
    expect(registry.register('John Smith')).toBe('john-smith-1');
    expect(registry.register('John Smith')).toBe('john-smith-2');
  });

  it('writes two entities with the same slug to different files', () => {
    const tempDir = makeTempDir();
    try {
      const registry = new SlugRegistry();
      const config = makeConfig('acme');
      const mentions: any[] = [];

      const entity1: EntityMention = { name: 'John Smith', type: 'person', count: 1 };
      const entity2: EntityMention = { name: 'John-Smith', type: 'organization', count: 1 };

      const file1 = entityFileNameWithRegistry(entity1, registry);
      const file2 = entityFileNameWithRegistry(entity2, registry);

      expect(file1).toBe('john-smith.md');
      expect(file2).toBe('john-smith-1.md');
      expect(file1).not.toBe(file2);

      writeEntityPage(path.join(tempDir, file1), entity1, config, mentions, undefined, '# Entity: John Smith');
      writeEntityPage(path.join(tempDir, file2), entity2, config, mentions, undefined, '# Entity: John-Smith');

      const content1 = matter(readFileSync(path.join(tempDir, file1), 'utf-8'));
      const content2 = matter(readFileSync(path.join(tempDir, file2), 'utf-8'));

      expect(content1.data.title).toBe(entityPageTitle(entity1));
      expect(content2.data.title).toBe(entityPageTitle(entity2));
      expect(content1.data.wiki).toBe('acme');
      expect(content2.data.wiki).toBe('acme');
      expect(content1.data.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(content2.data.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
