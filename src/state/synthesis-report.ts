import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SynthesisAttemptReport {
  /** Whether this synthesis mode was tried for the entity. */
  attempted: boolean;
  /** Whether the preservation check passed for this attempt. */
  passed: boolean;
  /**
   * Phase 7 v1.1.0 (bounded retry amendment): number of LLM calls made in
   * this mode (≤3 on quality failures). Absent for entries written before
   * the amendment.
   */
  attempts?: number;
}

export interface SynthesisReportEntry {
  /** ISO 8601 timestamp of the final decision. */
  timestamp: string;
  /** Page type this synthesis ran on (Phase 22 gate 22.10: 'composite' added; Phase 23: 'comparison' added). */
  pageType: 'entity' | 'topic' | 'composite' | 'comparison';
  /** Entity or topic slug. */
  slug: string;
  /** Strict synthesis attempt result. */
  strict: SynthesisAttemptReport;
  /** Permissive synthesis fallback attempt result. */
  permissive: SynthesisAttemptReport;
  /**
   * Final mode used: the page now contains strict synthesis, permissive
   * synthesis, or the structured template. Phase 16 (vision `04` §6):
   * 'transport-fallback' records a page that landed on the structured
   * template because a transient transport error was still throwing after
   * the bounded retries (the per-page transport fallback).
   */
  finalMode: 'strict-synthesis' | 'permissive-synthesis' | 'structured-template' | 'transport-fallback';
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
 * Append synthesis outcomes to the per-wiki synthesis report in one
 * read-modify-write.
 *
 * The report records, for each entity, whether strict synthesis passed, whether
 * the permissive fallback was tried and passed, and what final page mode was kept.
 * Phase 15 (vision `04` §1): pool runs COLLECT their entries in memory and
 * append them here once per stage, in original page order (deterministic,
 * diff-friendly output regardless of completion order).
 */
export async function appendSynthesisReportEntries(
  wikiDir: string,
  entries: SynthesisReportEntry[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  const state = await readReport(wikiDir);
  state.entries.push(...entries);
  await writeReport(wikiDir, state);
}

/**
 * Append a single synthesis outcome to the per-wiki synthesis report
 * (sequential callers; pool stages use `appendSynthesisReportEntries`).
 */
export async function logSynthesisReport(
  wikiDir: string,
  entry: SynthesisReportEntry,
): Promise<void> {
  await appendSynthesisReportEntries(wikiDir, [entry]);
}

export { readReport as readSynthesisReport };
