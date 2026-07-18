import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SynthesisAttemptReport {
  /** Whether this synthesis mode was tried for the entity. */
  attempted: boolean;
  /** Whether the preservation check passed for this attempt. */
  passed: boolean;
}

export interface SynthesisReportEntry {
  /** ISO 8601 timestamp of the final decision. */
  timestamp: string;
  /** Page type this synthesis ran on. */
  pageType: 'entity' | 'topic';
  /** Entity or topic slug. */
  slug: string;
  /** Strict synthesis attempt result. */
  strict: SynthesisAttemptReport;
  /** Permissive synthesis fallback attempt result. */
  permissive: SynthesisAttemptReport;
  /** Final mode used: the page now contains strict synthesis, permissive synthesis, or the structured template. */
  finalMode: 'strict-synthesis' | 'permissive-synthesis' | 'structured-template';
}

export interface SynthesisReportState {
  entries: SynthesisReportEntry[];
}

function reportPath(wikiDir: string): string {
  return join(wikiDir, '.state', 'synthesis-report.json');
}

async function readReport(wikiDir: string): Promise<SynthesisReportState> {
  try {
    const raw = await readFile(reportPath(wikiDir), 'utf-8');
    const parsed = JSON.parse(raw) as SynthesisReportState;
    if (Array.isArray(parsed.entries)) {
      return parsed;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
  return { entries: [] };
}

async function writeReport(wikiDir: string, state: SynthesisReportState): Promise<void> {
  await mkdir(join(wikiDir, '.state'), { recursive: true });
  await writeFile(reportPath(wikiDir), JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

/**
 * Append a synthesis outcome to the per-wiki synthesis report.
 *
 * The report records, for each entity, whether strict synthesis passed, whether
 * the permissive fallback was tried and passed, and what final page mode was kept.
 */
export async function logSynthesisReport(
  wikiDir: string,
  entry: SynthesisReportEntry,
): Promise<void> {
  const state = await readReport(wikiDir);
  state.entries.push(entry);
  await writeReport(wikiDir, state);
}

export { readReport as readSynthesisReport };
