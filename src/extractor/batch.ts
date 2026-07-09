import { extractPdf } from './pdf.js';
import { isExtractionFailure, type ExtractionFailure, type ExtractionOutcome, type ExtractionResult } from './types.js';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { writeRawPage } from '../writers/raw.js';

export async function safeExtractPdf(filePath: string, rawOutputDir?: string, wikiSlug?: string): Promise<ExtractionOutcome> {
  console.log(`Extracting ${path.basename(filePath)}…`);
  try {
    const result = await extractPdf(filePath);
    writeScannedRawPages(result, rawOutputDir, wikiSlug);
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return createFailure(filePath, reason);
  }
}

export async function processPdfs(filePaths: string[], rawOutputDir?: string, wikiSlug?: string): Promise<ExtractionOutcome[]> {
  const outcomes: ExtractionOutcome[] = [];
  for (const filePath of filePaths) {
    outcomes.push(await safeExtractPdf(filePath, rawOutputDir, wikiSlug));
  }
  return outcomes;
}

function writeScannedRawPages(result: ExtractionResult, rawOutputDir?: string, wikiSlug?: string): void {
  const scannedPages = result.pages.filter((page) => page.isScanned);
  if (scannedPages.length === 0) {
    return;
  }

  const outputDir = rawOutputDir ?? path.join(path.dirname(result.filePath), '..', 'raw');
  mkdirSync(outputDir, { recursive: true });

  const baseSlug = path.basename(result.filePath, path.extname(result.filePath));
  const slug = wikiSlug ?? 'unknown';
  for (const page of scannedPages) {
    const rawPath = path.join(outputDir, `${baseSlug}-page-${page.physicalPage}.md`);
    writeRawPage(rawPath, result, page, slug);
  }
}

function createFailure(filePath: string, reason: string): ExtractionFailure {
  const sizeBytes = statSync(filePath).size;
  return {
    filePath,
    fileName: path.basename(filePath),
    sizeBytes,
    sha256: createHash('sha256').update(readFileSync(filePath)).digest('hex'),
    reason,
    ingested: new Date().toISOString(),
  };
}

export function successfulOutcomes(outcomes: ExtractionOutcome[]): ExtractionResult[] {
  return outcomes.filter((o): o is ExtractionResult => !isExtractionFailure(o));
}
