import { describe, it, expect, beforeAll } from 'vitest';
import { extractPdf } from '../../src/extractor/pdf.js';
import { analyzePdfStructure } from '../../src/chunking/analyzer.js';
import {
  createTenPagePdf,
  createScannedPdf,
  createMultiPageTablePdf,
  createMediumScanConfidencePdf,
  createFivePagePdf,
} from '../fixtures/pdf-helpers.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

describe('TAC-001: ten-page PDF extraction', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createTenPagePdf();
  });

  it('extracts all physical pages with stable logical page numbers', async () => {
    const result = await extractPdf(filePath);

    expect(result.physicalPages).toBe(10);
    expect(result.pages).toHaveLength(10);
    expect(result.logicalPages).toBe(10);

    for (let i = 0; i < 10; i++) {
      const page = result.pages[i];
      expect(page.physicalPage).toBe(i + 1);
      expect(page.logicalPage).toBe(i + 1);
      expect(page.text.length).toBeGreaterThan(0);
      expect(page.text).toContain(`Page ${i + 1}`);
    }
  });

  it('computes a stable SHA-256 hash for the file', async () => {
    const result = await extractPdf(filePath);
    const expected = createHash('sha256').update(readFileSync(filePath)).digest('hex');
    expect(result.sha256).toBe(expected);
  });
});

describe('TAC-002: scanned page detection', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createScannedPdf();
  });

  it('flags an image-only page as scanned with low confidence', async () => {
    const result = await extractPdf(filePath);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].isScanned).toBe(true);
    expect(result.pages[0].scanConfidence).toBe('low');
    expect(result.isScanned).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('TAC-003: multi-page table detection', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createMultiPageTablePdf();
  });

  it('detects a multi-page table from consecutive pages with matching structure', async () => {
    const result = await extractPdf(filePath);
    const structure = analyzePdfStructure(result);

    expect(result.physicalPages).toBe(2);
    expect(result.tables.length).toBeGreaterThanOrEqual(1);
    const tableObject = structure.multiPageObjects.find((o) => o.type === 'table');
    expect(tableObject).toBeDefined();
    expect(tableObject!.startPage).toBe(1);
    expect(tableObject!.endPage).toBe(2);
  });
});

describe('TAC-004: medium scan confidence', () => {
  let filePath: string;

  beforeAll(async () => {
    filePath = await createMediumScanConfidencePdf();
  });

  it('assigns medium confidence when the page is image-dominant but has some text', async () => {
    const result = await extractPdf(filePath);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].isScanned).toBe(false);
    expect(result.pages[0].scanConfidence).toBe('medium');
  });
});

describe('TAC-005: SHA-256 stability', () => {
  it('returns the same SHA-256 for identical file contents', async () => {
    const filePath = await createFivePagePdf();
    const result1 = await extractPdf(filePath);
    const result2 = await extractPdf(filePath);
    expect(result1.sha256).toBe(result2.sha256);
  });
});
