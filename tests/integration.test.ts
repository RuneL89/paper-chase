import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { processPdfs } from '../src/extractor/batch.js';
import { createFivePagePdf, createMalformedPdf, createScannedPdf } from './fixtures/pdf-helpers.js';
import { isExtractionFailure, type ExtractionFailure } from '../src/extractor/types.js';
import { writeFailureRawPage } from '../src/writers/raw.js';

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'wiki-integration-'));
}

describe('TAC-004: malformed PDF resilience', () => {
  let validPath: string;
  let malformedPath: string;

  beforeAll(async () => {
    validPath = await createFivePagePdf();
    malformedPath = createMalformedPdf();
  });

  it('emits a failure for the malformed PDF, writes a raw page, and still processes the valid PDF', async () => {
    const outcomes = await processPdfs([malformedPath, validPath]);

    expect(outcomes).toHaveLength(2);

    const failed = outcomes.find((o) => o.filePath === malformedPath);
    const success = outcomes.find((o) => o.filePath === validPath);

    expect(failed).toBeDefined();
    expect(success).toBeDefined();
    expect(isExtractionFailure(failed!)).toBe(true);
    expect(isExtractionFailure(success!)).toBe(false);

    const tempDir = makeTempDir();
    try {
      const rawPath = path.join(tempDir, 'malformed-raw.md');
      writeFailureRawPage(rawPath, failed as ExtractionFailure);

      const content = readFileSync(rawPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data).toMatchObject({
        type: 'raw',
        source: malformedPath,
        reason: expect.any(String),
        raw_fragment: expect.any(String),
        confidence: 'low',
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('UAC-002: scanned pages persisted as raw pages', () => {
  let scannedPath: string;
  let rawDir: string;

  beforeAll(async () => {
    scannedPath = await createScannedPdf();
    rawDir = makeTempDir();
  });

  afterAll(() => {
    rmSync(rawDir, { recursive: true, force: true });
  });

  it('writes a raw page for each scanned page during batch extraction', async () => {
    const outcomes = await processPdfs([scannedPath], rawDir);

    expect(outcomes).toHaveLength(1);
    expect(isExtractionFailure(outcomes[0])).toBe(false);

    const rawPagePath = path.join(rawDir, 'scanned-page-1.md');
    expect(existsSync(rawPagePath)).toBe(true);

    const content = readFileSync(rawPagePath, 'utf-8');
    const parsed = matter(content);
    expect(parsed.data).toMatchObject({
      type: 'raw',
      source: scannedPath,
      pages: '1',
      confidence: 'low',
    });
  });
});
