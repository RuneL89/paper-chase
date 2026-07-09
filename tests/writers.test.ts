import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { writeSourcePage } from '../src/writers/source.js';
import { writeRawPage } from '../src/writers/raw.js';
import { createFivePagePdf, createScannedPdf } from './fixtures/pdf-helpers.js';
import { extractPdf } from '../src/extractor/pdf.js';

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'wiki-writers-'));
}

describe('TAC-002: source page frontmatter', () => {
  let filePath: string;
  let tempDir: string;

  beforeAll(async () => {
    filePath = await createFivePagePdf();
    tempDir = makeTempDir();
  });

  it('writes a source page whose YAML frontmatter contains all required fields', async () => {
    const result = await extractPdf(filePath);
    const outputPath = path.join(tempDir, 'source.md');

    writeSourcePage(outputPath, result, [], [], 'test-wiki');

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data).toMatchObject({
      title: expect.any(String),
      type: 'source',
      wiki: 'test-wiki',
      file: expect.any(String),
      sha256: expect.any(String),
      logical_pages: expect.any(Number),
      physical_pages: expect.any(Number),
      size_bytes: expect.any(Number),
      metadata: expect.any(Object),
      ingested: expect.any(String),
      warnings: expect.any(Array),
      label: expect.any(String),
      created: expect.any(String),
      updated: expect.any(String),
    });

    expect(parsed.data.physical_pages).toBe(5);
    expect(parsed.data.logical_pages).toBe(5);
    expect(parsed.data.sha256).toHaveLength(64);
    expect(parsed.data.label).toBe('Five Page');
    expect(new Date(parsed.data.created).getTime()).not.toBeNaN();
  });

  it('preserves an existing created timestamp on the source page', async () => {
    const result = await extractPdf(filePath);
    const outputPath = path.join(tempDir, 'source-preserved.md');
    const existingCreated = '2026-01-01T00:00:00.000Z';
    writeFileSync(
      outputPath,
      matter.stringify('# Existing source\n', {
        title: 'Source: existing.pdf',
        type: 'source',
        created: existingCreated,
      }),
    );

    writeSourcePage(outputPath, result, [], [], 'test-wiki');

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.created).toBe(existingCreated);
    expect(parsed.data.updated).not.toBe(existingCreated);
  });
});

describe('TAC-003: raw page for scanned page', () => {
  let filePath: string;
  let tempDir: string;

  beforeAll(async () => {
    filePath = await createScannedPdf();
    tempDir = makeTempDir();
  });

  it('writes a raw page whose YAML frontmatter contains required fields and confidence low', async () => {
    const result = await extractPdf(filePath);
    const scannedPage = result.pages.find((p) => p.isScanned);
    expect(scannedPage).toBeDefined();

    const outputPath = path.join(tempDir, 'raw-page.md');
    writeRawPage(outputPath, result, scannedPage!, 'test-wiki');

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data).toMatchObject({
      type: 'raw',
      wiki: 'test-wiki',
      source: expect.any(String),
      pages: expect.any(String),
      reason: expect.any(String),
      confidence: 'low',
      created: expect.any(String),
      updated: expect.any(String),
    });

    expect(parsed.data.type).toBe('raw');
    expect(parsed.data.confidence).toBe('low');
    expect(parsed.data.raw_fragment).toBeTruthy();
    expect(parsed.content.length).toBeGreaterThan(0);
  });

  it('preserves an existing created timestamp on the raw page', async () => {
    const result = await extractPdf(filePath);
    const scannedPage = result.pages.find((p) => p.isScanned);
    expect(scannedPage).toBeDefined();

    const outputPath = path.join(tempDir, 'raw-preserved.md');
    const existingCreated = '2026-01-01T00:00:00.000Z';
    writeFileSync(
      outputPath,
      matter.stringify('# Existing raw\n', {
        title: 'Raw fragment: existing.pdf, page 1',
        type: 'raw',
        created: existingCreated,
      }),
    );

    writeRawPage(outputPath, result, scannedPage!, 'test-wiki');

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data.created).toBe(existingCreated);
    expect(parsed.data.updated).not.toBe(existingCreated);
  });
});
