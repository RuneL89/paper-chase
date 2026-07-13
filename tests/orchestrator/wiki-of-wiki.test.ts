import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { runWikiOfWikiAgent } from '../../src/orchestrator/wiki-of-wiki.js';

describe('wiki-of-wiki cross-wiki name discovery', () => {
  let workspace: string;

  beforeAll(() => {
    workspace = mkdtempSync(path.join(os.tmpdir(), 'wiki-of-wiki-'));
  });

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('discovers entities inside typed sub-folders, not just flat entity files', () => {
    const acmeDir = path.join(workspace, 'wikis', 'acme', 'entities', 'organizations');
    const globexDir = path.join(workspace, 'wikis', 'globex', 'entities', 'organizations');
    mkdirSync(acmeDir, { recursive: true });
    mkdirSync(globexDir, { recursive: true });

    writeFileSync(
      path.join(acmeDir, 'acme-corp.md'),
      matter.stringify('Entity page for Acme.', { title: 'Acme Corp', type: 'entity', wiki: 'acme' }),
    );
    writeFileSync(
      path.join(globexDir, 'acme-corp.md'),
      matter.stringify('Entity page for Acme in Globex.', { title: 'Acme Corp', type: 'entity', wiki: 'globex' }),
    );

    const result = runWikiOfWikiAgent(workspace, [
      { slug: 'acme', title: 'Acme Wiki', description: 'Acme', sourceCount: 1, documentCount: 1, entityCount: 1, topicCount: 0, rawCount: 0 },
      { slug: 'globex', title: 'Globex Wiki', description: 'Globex', sourceCount: 1, documentCount: 1, entityCount: 1, topicCount: 0, rawCount: 0 },
    ]);

    expect(result.crossWikiNames).toHaveLength(1);
    expect(result.crossWikiNames[0].name).toBe('Acme Corp');
    expect(result.crossWikiNames[0].type).toBe('entity');
    expect(result.crossWikiNames[0].wikis.map((w) => w.slug).sort()).toEqual(['acme', 'globex']);
  });
});
