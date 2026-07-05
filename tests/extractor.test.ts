import { describe, it, expect, beforeAll } from 'vitest';
import { extractPdf } from '../src/extractor/pdf.js';
import {
  createFivePagePdf,
  createHundredPagePdf,
  createScannedPdf,
  createTablePdf,
  fixturePath,
} from './fixtures/pdf-helpers.js';

describe('TAC-001: five-page PDF extraction', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createFivePagePdf();
  });

  it('extracts text for every physical page with no silently dropped pages', async () => {
    const result = await extractPdf(filePath);

    expect(result.physicalPages).toBe(5);
    expect(result.pages).toHaveLength(5);

    for (let i = 0; i < 5; i++) {
      const page = result.pages[i];
      expect(page.physicalPage).toBe(i + 1);
      expect(page.text.length).toBeGreaterThan(0);
      expect(page.text).toContain(`Page ${i + 1}`);
    }
  });
});

describe('TAC-003: scanned page detection', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createScannedPdf();
  });

  it('flags an image-only page as scanned with low confidence', async () => {
    const result = await extractPdf(filePath);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].isScanned).toBe(true);
    expect(result.pages[0].scanConfidence).toBe('low');
  });
});

describe('TAC-005: 100-page PDF performance', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createHundredPagePdf();
  });

  it('extracts a 100-page PDF in under five minutes', async () => {
    const start = Date.now();
    const result = await extractPdf(filePath);
    const elapsed = Date.now() - start;

    expect(result.physicalPages).toBe(100);
    expect(result.pages).toHaveLength(100);
    expect(elapsed).toBeLessThan(5 * 60 * 1000);
  });
});

describe('TAC-006: table and figure preservation', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createTablePdf();
  });

  it('represents an extracted table as a markdown table or structured description', async () => {
    const result = await extractPdf(filePath);

    const tablePresent =
      result.tables.length > 0 ||
      result.pages.some((page) => page.text.includes('|') && page.text.includes('Quarterly'));

    expect(tablePresent).toBe(true);
  });
});
