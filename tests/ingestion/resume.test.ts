import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { createTextPdfInDir } from '../fixtures/pdf-helpers.js';
import { ingestCommand } from '../../src/commands/ingest.js';
import { initCommand } from '../../src/commands/init.js';
import { sampleCommand } from '../../src/commands/sample.js';
import { runIngestion } from '../../src/ingestion/engine.js';
import { loadRunManifest, runManifestPath } from '../../src/ingestion/resume.js';
import { loadConfig } from '../../src/config.js';
import type { Config } from '../../src/config.js';

function makeTempWorkspace(): string {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'wiki-resume-'));
  mkdirSync(path.join(tmp, '.kimi-code'), { recursive: true });
  writeFileSync(
    path.join(tmp, '.kimi-code', 'config.json'),
    JSON.stringify({
      llm: { provider: 'test', model: 'test', enabled: true },
    }),
  );
  return tmp;
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
      max_chunk_size: 40000,
      min_chunk_size: 100,
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

describe('resume', () => {
  let workspace: string;
  let wikiDir: string;
  const slug = 'acme';

  beforeEach(async () => {
    workspace = makeTempWorkspace();
    await initCommand({ workspace, slug, title: 'Acme Wiki', description: 'Test' });
    wikiDir = path.join(workspace, 'wikis', slug);
    await createTextPdfInDir(path.join(wikiDir, 'raw'), 'annual-report.pdf', [
      { header: 'Annual Report', body: 'Acme Corp reported record earnings this year.' },
    ]);
    await sampleCommand(workspace, slug, path.join(wikiDir, 'raw', 'annual-report.pdf'));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('TAC-001: writes per-chunk state and a run manifest during normal ingest', async () => {
    const config = loadConfig(workspace, slug);
    await runIngestion(workspace, slug, config, false);

    const manifest = loadRunManifest(runManifestPath(wikiDir, config.output.dir));
    expect(manifest.chunks.length).toBeGreaterThan(0);
    expect(manifest.chunks.every((c) => c.status === 'completed')).toBe(true);
  });

  it('TAC-002: resume skips all chunks when everything is completed', async () => {
    const config = loadConfig(workspace, slug);
    await runIngestion(workspace, slug, config, false);

    const docDir = path.join(wikiDir, 'documents');
    const originalFiles = readdirSync(docDir).filter((f) => f.endsWith('.md') && f !== 'index.md');
    expect(originalFiles.length).toBeGreaterThan(0);

    // Overwrite the generated document page with a marker so we can tell if it was re-written.
    const docPath = path.join(docDir, originalFiles[0]);
    writeFileSync(docPath, matter.stringify('# marker content\n', matter(readFileSync(docPath, 'utf-8')).data));

    const result = await runIngestion(workspace, slug, config, true);
    expect(result.documentPages).toBe(0);

    const content = readFileSync(docPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.content).toContain('marker content');
  });

  it('TAC-003: resume re-processes a failed chunk', async () => {
    const config = loadConfig(workspace, slug);
    await runIngestion(workspace, slug, config, false);

    const manifestPath = runManifestPath(wikiDir, config.output.dir);
    const manifest = loadRunManifest(manifestPath);
    expect(manifest.chunks.length).toBeGreaterThan(0);

    // Mark the first chunk as failed and write it back.
    manifest.chunks[0].status = 'failed';
    manifest.chunks[0].updatedAt = new Date().toISOString();
    const stateDir = path.join(wikiDir, 'output', '.state', 'chunks');
    const stateFile = path.join(stateDir, `${manifest.chunks[0].source}-${manifest.chunks[0].chunkId}.json`);
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    state.status = 'failed';
    state.updatedAt = new Date().toISOString();
    writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    const result = await runIngestion(workspace, slug, config, true);
    expect(result.documentPages).toBeGreaterThan(0);

    const resumedManifest = loadRunManifest(manifestPath);
    const chunk = resumedManifest.chunks.find((c) => c.chunkId === manifest.chunks[0].chunkId);
    expect(chunk?.status).toBe('completed');
  });
});
