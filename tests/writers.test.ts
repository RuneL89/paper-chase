import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
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

    writeSourcePage(outputPath, result);

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data).toMatchObject({
      file: expect.any(String),
      sha256: expect.any(String),
      logical_pages: expect.any(Number),
      physical_pages: expect.any(Number),
      size_bytes: expect.any(Number),
      metadata: expect.any(Object),
      ingested: expect.any(String),
      warnings: expect.any(Array),
    });

    expect(parsed.data.physical_pages).toBe(5);
    expect(parsed.data.logical_pages).toBe(5);
    expect(parsed.data.sha256).toHaveLength(64);
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
    writeRawPage(outputPath, result, scannedPage!);

    const content = readFileSync(outputPath, 'utf-8');
    const parsed = matter(content);

    expect(parsed.data).toMatchObject({
      type: 'raw',
      source: expect.any(String),
      pages: expect.any(String),
      reason: expect.any(String),
      confidence: 'low',
    });

    expect(parsed.data.type).toBe('raw');
    expect(parsed.data.confidence).toBe('low');
    expect(parsed.data.raw_fragment).toBeTruthy();
    expect(parsed.content.length).toBeGreaterThan(0);
  });
});
