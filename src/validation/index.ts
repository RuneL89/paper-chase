import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkLinks, type LinkCheckResult } from './link-checker';
import { checkCitations, type CitationCheckResult } from './citation-checker';
import { validateSchema, type SchemaCheckResult } from './schema-validator';

export { checkLinks, checkCitations, validateSchema };
export type { LinkCheckResult, CitationCheckResult, SchemaCheckResult };

export interface ValidationSummary {
  wikiSlug: string;
  links: LinkCheckResult;
  citations: CitationCheckResult;
  schema: SchemaCheckResult;
}

/**
 * Run all deterministic validation checks for a wiki and return the results.
 *
 * Does not throw for validation failures; callers decide whether to abort.
 * This is the shared implementation used by the CLI ingest command and the
 * TUI validation report screen.
 */
export async function validateWiki(wikiSlug: string, workspace: string = '.'): Promise<ValidationSummary> {
  const [links, citations, schema] = await Promise.all([
    checkLinks(wikiSlug, workspace),
    checkCitations(wikiSlug, workspace),
    validateSchema(wikiSlug, workspace),
  ]);
  return { wikiSlug, links, citations, schema };
}

function formatLinkSummary(links: LinkCheckResult): string {
  return `Link check: ${links.totalLinks} links, ${links.broken.length} broken, ${links.orphaned.length} orphaned, ${links.islands.length} islands`;
}

function formatCitationSummary(citations: CitationCheckResult): string {
  const bad =
    citations.invalid.length + citations.missingSource.length + citations.missingFrontmatterSource.length;
  return `Citation check: ${citations.totalCitations} citations, ${bad} invalid`;
}

function formatSchemaSummary(schema: SchemaCheckResult): string {
  return `Schema check: ${schema.totalPages} pages, ${schema.invalid.length} invalid`;
}

export async function writeValidationReport(wikiDir: string, summary: ValidationSummary): Promise<void> {
  try {
    const reportDir = join(wikiDir, '.state');
    await mkdir(reportDir, { recursive: true });
    await writeFile(
      join(reportDir, 'validation-report.json'),
      JSON.stringify(summary, null, 2) + '\n',
      'utf-8',
    );
  } catch {
    // Best-effort file write; do not let logging obscure validation failures.
  }
}

async function writeValidationReportFile(wikiDir: string, summary: ValidationSummary): Promise<void> {
  await writeValidationReport(wikiDir, summary);
}

/**
 * Log a concise validation summary to the console. Warnings are printed when
 * broken links, invalid citations, or schema violations are found, but the
 * function never throws. If `wikiDir` is provided, the full summary is also
 * written to `wikis/<slug>/.state/validation-report.json`.
 */
export async function logValidation(
  summary: ValidationSummary,
  wikiDir?: string,
): Promise<void> {
  console.log(formatLinkSummary(summary.links));
  console.log(formatCitationSummary(summary.citations));
  console.log(formatSchemaSummary(summary.schema));

  for (const broken of summary.links.broken) {
    console.warn(`Broken link in ${broken.page}: [[${broken.link}]]`);
  }
  for (const orphan of summary.links.orphaned) {
    console.warn(`Orphaned page: ${orphan}`);
  }
  // Phase 17 (B12b): islands reported in the same posture as orphans.
  for (const island of summary.links.islands) {
    console.warn(`Island page (no outgoing links): ${island}`);
  }
  for (const invalid of summary.citations.invalid) {
    console.warn(`Invalid citation in ${invalid.page}: ${invalid.citation}`);
  }
  for (const missing of summary.citations.missingSource) {
    console.warn(`Missing source in ${missing.page}: ${missing.citation}`);
  }
  // Phase 17 (§2.6): frontmatter-coverage warnings, same posture as missingSource.
  for (const missing of summary.citations.missingFrontmatterSource) {
    console.warn(`Citation not covered by frontmatter sources in ${missing.page}: ${missing.citation}`);
  }
  for (const violation of summary.schema.invalid) {
    console.warn(`Schema violation in ${violation.page}: ${violation.issue}`);
  }

  if (wikiDir) {
    await writeValidationReportFile(wikiDir, summary);
  }
}

export { formatLinkSummary, formatCitationSummary, formatSchemaSummary };
