import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import {
  buildTypeBasedTaxonomy,
  entityFilePath,
  resolveEntitySubFolder,
  migrateLegacyEntityPage,
  removeLegacyEntityPage,
  type EntityMention,
} from '../../src/entities/index.js';

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'wiki-entity-taxonomy-'));
}

describe('entity taxonomy helpers', () => {
  it('buildTypeBasedTaxonomy creates sub-folders and assignments by entity type', () => {
    const entities: EntityMention[] = [
      { name: 'Acme Corp', type: 'organization', count: 2 },
      { name: 'Bob Smith', type: 'person', count: 1 },
      { name: 'New York', type: 'location', count: 1 },
    ];

    const taxonomy = buildTypeBasedTaxonomy(entities);

    expect(taxonomy.subFolders.map((f) => f.slug).sort()).toEqual([
      'locations',
      'organizations',
      'people',
    ]);
    expect(taxonomy.assignments['acme-corp']).toBe('organizations');
    expect(taxonomy.assignments['bob-smith']).toBe('people');
    expect(taxonomy.assignments['new-york']).toBe('locations');
  });

  it('entityFilePath returns the typed sub-folder path', () => {
    const entity: EntityMention = { name: 'Acme Corp', type: 'organization', count: 2 };
    const taxonomy = buildTypeBasedTaxonomy([entity]);

    expect(entityFilePath(entity, taxonomy)).toBe('entities/organizations/acme-corp.md');
  });

  it('resolveEntitySubFolder falls back to a type-based sub-folder and adds it', () => {
    const entity: EntityMention = { name: 'Acme Corp', type: 'organization', count: 2 };
    const taxonomy = buildTypeBasedTaxonomy([]);

    const subFolder = resolveEntitySubFolder(entity, taxonomy);

    expect(subFolder).toBe('organizations');
    expect(taxonomy.assignments['acme-corp']).toBe('organizations');
    expect(taxonomy.subFolders.some((f) => f.slug === 'organizations')).toBe(true);
  });

  it('resolveEntitySubFolder preserves an existing LLM assignment', () => {
    const entity: EntityMention = { name: 'Acme Corp', type: 'organization', count: 2 };
    const taxonomy = buildTypeBasedTaxonomy([]);
    taxonomy.subFolders.push({ slug: 'regulators', title: 'Regulators', description: 'Regulatory bodies.' });
    taxonomy.assignments['acme-corp'] = 'regulators';

    const subFolder = resolveEntitySubFolder(entity, taxonomy);

    expect(subFolder).toBe('regulators');
    expect(taxonomy.subFolders.length).toBe(1);
  });

  it('migrateLegacyEntityPage renames a flat entity page into its sub-folder', () => {
    const tempDir = makeTempDir();
    try {
      const entity: EntityMention = { name: 'Acme Corp', type: 'organization', count: 2 };
      const taxonomy = buildTypeBasedTaxonomy([entity]);
      const legacyPath = path.join(tempDir, 'entities', 'acme-corp.md');
      mkdirSync(path.dirname(legacyPath), { recursive: true });
      writeFileSync(legacyPath, matter.stringify('# Entity: Acme Corp', { title: 'Entity: Acme Corp' }));

      const { filePath, existingBody } = migrateLegacyEntityPage(tempDir, entity, taxonomy);

      expect(filePath).toBe(path.join(tempDir, 'entities', 'organizations', 'acme-corp.md'));
      expect(existsSync(filePath)).toBe(true);
      expect(existsSync(legacyPath)).toBe(false);
      expect(existingBody).toContain('Entity: Acme Corp');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('migrateLegacyEntityPage returns the existing sub-folder path without touching legacy', () => {
    const tempDir = makeTempDir();
    try {
      const entity: EntityMention = { name: 'Acme Corp', type: 'organization', count: 2 };
      const taxonomy = buildTypeBasedTaxonomy([entity]);
      const newPath = path.join(tempDir, 'entities', 'organizations', 'acme-corp.md');
      const legacyPath = path.join(tempDir, 'entities', 'acme-corp.md');
      mkdirSync(path.dirname(newPath), { recursive: true });
      writeFileSync(newPath, matter.stringify('# Entity: Acme Corp', { title: 'Entity: Acme Corp' }));
      mkdirSync(path.dirname(legacyPath), { recursive: true });
      writeFileSync(legacyPath, matter.stringify('# Legacy', { title: 'Legacy' }));

      const { filePath, existingBody } = migrateLegacyEntityPage(tempDir, entity, taxonomy);

      expect(filePath).toBe(newPath);
      expect(existingBody).toBeUndefined();
      expect(existsSync(legacyPath)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('removeLegacyEntityPage deletes a flat entity page if present', () => {
    const tempDir = makeTempDir();
    try {
      const entity: EntityMention = { name: 'Acme Corp', type: 'organization', count: 2 };
      const legacyPath = path.join(tempDir, 'entities', 'acme-corp.md');
      mkdirSync(path.dirname(legacyPath), { recursive: true });
      writeFileSync(legacyPath, matter.stringify('# Legacy', { title: 'Legacy' }));

      removeLegacyEntityPage(tempDir, entity);

      expect(existsSync(legacyPath)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
