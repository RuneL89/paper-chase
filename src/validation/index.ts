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
  return `Link check: ${links.totalLinks} links, ${links.broken.length} broken, ${links.orphaned.length} orphaned`;
}

function formatCitationSummary(citations: CitationCheckResult): string {
  const bad = citations.invalid.length + citations.missingSource.length;
  return `Citation check: ${citations.totalCitations} citations, ${bad} invalid`;
}

function formatSchemaSummary(schema: SchemaCheckResult): string {
  return `Schema check: ${schema.totalPages} pages, ${schema.invalid.length} invalid`;
}

/**
 * Log a concise validation summary to the console. Warnings are printed when
 * broken links, invalid citations, or schema violations are found, but the
 * function never throws.
 */
export function logValidation(summary: ValidationSummary): void {
  console.log(formatLinkSummary(summary.links));
  console.log(formatCitationSummary(summary.citations));
  console.log(formatSchemaSummary(summary.schema));

  for (const broken of summary.links.broken) {
    console.warn(`Broken link in ${broken.page}: [[${broken.link}]]`);
  }
  for (const orphan of summary.links.orphaned) {
    console.warn(`Orphaned page: ${orphan}`);
  }
  for (const invalid of summary.citations.invalid) {
    console.warn(`Invalid citation in ${invalid.page}: ${invalid.citation}`);
  }
  for (const missing of summary.citations.missingSource) {
    console.warn(`Missing source in ${missing.page}: ${missing.citation}`);
  }
  for (const violation of summary.schema.invalid) {
    console.warn(`Schema violation in ${violation.page}: ${violation.issue}`);
  }
}

export { formatLinkSummary, formatCitationSummary, formatSchemaSummary };
