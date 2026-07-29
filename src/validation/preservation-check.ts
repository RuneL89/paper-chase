import { buildCitationMap } from '../pages/entity-page';
import type { EntityPageData } from '../pages/entity-page';
import { buildCompositeCitationMap } from '../pages/composite-page';
import type { CompositePageData } from '../pages/composite-page';
import {
  buildComparisonCitationMap,
  comparisonRowValues,
  type ComparisonPageData,
  type ComparisonTableSection,
} from '../pages/comparison-page';
import type { TopicPageData } from '../pages/topic-page';

export interface PreservationCheckResult {
  passed: boolean;
  droppedMentions: string[];
  droppedRelationships: string[];
  droppedClaims: string[];
  droppedCitations: string[];
  /**
   * Phase 18 (B18, vision `06` §2 + `07` §2.4): every distinct `[^srcN]`
   * marker in the written page whose key is NOT in the page's deterministic
   * citation map — one entry per off-map key, in first-appearance order,
   * each formatted `[^srcN] (first line: "<the full first line it appears
   * on, trimmed>")`. Non-empty ⇒ `passed` is false (a content defect for the
   * reask loop; off-map markers are NEVER stripped or renumbered
   * deterministically — phase doc §2.3).
   */
  extraMarkers: string[];
}

export interface TopicPreservationCheckResult {
  passed: boolean;
  droppedClaims: string[];
  droppedCitations: string[];
  /** Phase 18 (B18): same shape and semantics as the entity result's. */
  extraMarkers: string[];
}

/**
 * Phase 18 (B18): collect every distinct `[^srcN]` marker in the written
 * page whose key is not in `allowedKeys` — one entry per off-map key, in
 * first-appearance order, naming the key and the first line it appears on
 * (definition lines count too: an off-map key is off-map wherever it
 * appears).
 */
function findExtraMarkers(writtenPage: string, allowedKeys: ReadonlySet<string>): string[] {
  const firstLineByKey = new Map<string, string>();
  for (const line of writtenPage.split('\n')) {
    for (const match of line.matchAll(/\[\^src\d+\]/g)) {
      const key = match[0].slice(2, -1); // "[^src9]" → "src9"
      if (!allowedKeys.has(key) && !firstLineByKey.has(key)) {
        firstLineByKey.set(key, line.trim());
      }
    }
  }
  return Array.from(firstLineByKey.entries()).map(
    ([key, firstLine]) => `[^${key}] (first line: "${firstLine}")`,
  );
}

/**
 * Verify that a synthesized entity page preserves every mention context,
 * relationship evidence (outgoing and — Phase 17 — incoming), claim text,
 * and source citation from the original structured data.
 */
export function checkPreservation(
  originalData: EntityPageData,
  writtenPage: string,
): PreservationCheckResult {
  const droppedMentions: string[] = [];
  const droppedRelationships: string[] = [];
  const droppedClaims: string[] = [];
  const droppedCitations: string[] = [];

  for (const mention of originalData.mentions) {
    if (!writtenPage.includes(mention.context)) {
      droppedMentions.push(mention.context);
    }
  }

  for (const relationship of originalData.relationships) {
    if (!writtenPage.includes(relationship.evidence)) {
      droppedRelationships.push(relationship.evidence);
    }
  }

  // Phase 17 (B10, vision `02` §4.3 B): incoming relationship evidence is
  // preserved exactly like outgoing evidence — the object page tells both
  // sides of the story, verbatim (data-driven; no structural change beyond
  // the new field).
  for (const relationship of originalData.incomingRelationships ?? []) {
    if (!writtenPage.includes(relationship.evidence)) {
      droppedRelationships.push(relationship.evidence);
    }
  }

  for (const claim of originalData.claims) {
    if (!writtenPage.includes(claim.text)) {
      droppedClaims.push(claim.text);
    }
  }

  const { keys } = buildCitationMap(originalData);
  const existingCitations = originalData.citations ?? keys;
  for (const key of existingCitations) {
    const marker = `[^${key}]`;
    if (!writtenPage.includes(marker)) {
      droppedCitations.push(marker);
    }
  }

  // Phase 18 (B18, vision `06` §2): off-map markers are a content defect.
  // The allowed set is the deterministic keys UNION any pre-existing page
  // citations — a citation the droppedCitations rule REQUIRES can never be
  // flagged as extra by the same check.
  const extraMarkers = findExtraMarkers(
    writtenPage,
    new Set([...keys, ...(originalData.citations ?? [])]),
  );

  const passed =
    droppedMentions.length === 0 &&
    droppedRelationships.length === 0 &&
    droppedClaims.length === 0 &&
    droppedCitations.length === 0 &&
    extraMarkers.length === 0;

  return { passed, droppedMentions, droppedRelationships, droppedClaims, droppedCitations, extraMarkers };
}

/**
 * Verify that a synthesized topic page preserves every claim text and source
 * citation from the original topic data.
 */
export function checkTopicPreservation(
  originalData: TopicPageData,
  writtenPage: string,
): TopicPreservationCheckResult {
  const droppedClaims: string[] = [];
  const droppedCitations: string[] = [];

  for (const claim of originalData.claims) {
    if (!writtenPage.includes(claim.text)) {
      droppedClaims.push(claim.text);
    }
  }

  const { keys } = buildCitationMap({ mentions: [], relationships: [], claims: originalData.claims });
  for (const key of keys) {
    const marker = `[^${key}]`;
    if (!writtenPage.includes(marker)) {
      droppedCitations.push(marker);
    }
  }

  // Phase 18 (B18, vision `06` §2): off-map markers are a content defect.
  const extraMarkers = findExtraMarkers(writtenPage, new Set(keys));

  const passed = droppedClaims.length === 0 && droppedCitations.length === 0 && extraMarkers.length === 0;

  return { passed, droppedClaims, droppedCitations, extraMarkers };
}

export interface CompositePreservationCheckResult {
  passed: boolean;
  droppedMentions: string[];
  droppedRelationships: string[];
  droppedClaims: string[];
  droppedCitations: string[];
  /** Phase 18 (B18): same shape and semantics as the entity result's. */
  extraMarkers: string[];
}

/**
 * Phase 22 (§2.4, the five-class rollup amendment; vision `07` §2.4): verify
 * that a synthesized COMPOSITE page preserves every member's evidence — the
 * same verbatim-substring mechanism as the entity check, iterated per
 * member: every mention context, every relationship evidence (outgoing and
 * incoming), every claim text, and every citation key of the unioned
 * deterministic map. A single dropped item of ANY member fails the page.
 */
export function checkCompositePreservation(
  originalData: CompositePageData,
  writtenPage: string,
): CompositePreservationCheckResult {
  const droppedMentions: string[] = [];
  const droppedRelationships: string[] = [];
  const droppedClaims: string[] = [];
  const droppedCitations: string[] = [];

  for (const group of originalData.memberEvidence) {
    for (const mention of group.mentions) {
      if (!writtenPage.includes(mention.context)) {
        droppedMentions.push(mention.context);
      }
    }
    for (const relationship of group.relationships) {
      if (!writtenPage.includes(relationship.evidence)) {
        droppedRelationships.push(relationship.evidence);
      }
    }
    for (const relationship of group.incomingRelationships) {
      if (!writtenPage.includes(relationship.evidence)) {
        droppedRelationships.push(relationship.evidence);
      }
    }
    for (const claim of group.claims) {
      if (!writtenPage.includes(claim.text)) {
        droppedClaims.push(claim.text);
      }
    }
  }

  const { keys } = buildCompositeCitationMap(originalData);
  for (const key of keys) {
    const marker = `[^${key}]`;
    if (!writtenPage.includes(marker)) {
      droppedCitations.push(marker);
    }
  }

  // Phase 18 (B18, vision `06` §2): off-map markers are a content defect.
  const extraMarkers = findExtraMarkers(writtenPage, new Set(keys));

  const passed =
    droppedMentions.length === 0 &&
    droppedRelationships.length === 0 &&
    droppedClaims.length === 0 &&
    droppedCitations.length === 0 &&
    extraMarkers.length === 0;

  return { passed, droppedMentions, droppedRelationships, droppedClaims, droppedCitations, extraMarkers };
}

export interface ComparisonPreservationCheckResult {
  passed: boolean;
  /**
   * Phase 23 (§2.3/§2.4, gate 23.5): every MISSING or ALTERED row key value —
   * formatted `<source>, p. <page> row "<row subject>": value "<number>"`
   * (or `: the row itself is missing` when the row subject is gone) — fed
   * verbatim into the reask correction block.
   */
  droppedRowValues: string[];
  droppedCitations: string[];
  /** Phase 18 (B18): same shape and semantics as the entity result's. */
  extraMarkers: string[];
}

function sourceBaseName(file: string): string {
  return file.split('/').pop() ?? file;
}

/**
 * The written page's section for one table: the `## Table:` heading naming
 * the table's source basename and page (`p. 16` never matches `p. 160`), up
 * to the next `##` heading. When the model renamed the heading the whole
 * page is the scope — the row values are still checked (the heading's exact
 * form is the shell's contract, not the check's).
 */
function comparisonSectionScope(writtenPage: string, table: ComparisonTableSection): string {
  const file = sourceBaseName(table.source);
  const pagePattern = new RegExp(`p\\. ${table.page}\\b`);
  const lines = writtenPage.split('\n');
  let start = -1;
  for (let index = 0; index < lines.length; index++) {
    if (/^##\s+Table:/.test(lines[index]) && lines[index].includes(file) && pagePattern.test(lines[index])) {
      start = index;
      break;
    }
  }
  if (start === -1) {
    return writtenPage;
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^## /.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

/**
 * Phase 23 (§2.3, gate 23.5; vision `07` §2.4): ROW-VALUE preservation for
 * comparison pages — NOT byte-substring. The markdown structure of a table
 * is the extractor's reconstruction (pdfjs destroys table geometry), so a
 * synthesized page may reflow the table's formatting; what must survive are
 * the PDF's own VALUES: for every data row of every dated table section,
 * the row subject (first cell) and each of the row's numbers must appear in
 * the emitted section. A dropped row, a dropped value, or an ALTERED number
 * (the original value no longer appears) is a content defect in the reask
 * loop; a reformatted-but-value-complete section passes. Citations and
 * off-map markers follow the entity/composite checks exactly.
 */
export function checkComparisonPreservation(
  originalData: ComparisonPageData,
  writtenPage: string,
): ComparisonPreservationCheckResult {
  const droppedRowValues: string[] = [];
  const droppedCitations: string[] = [];

  for (const table of originalData.tables) {
    const rows = comparisonRowValues(table.markdown);
    if (rows.length === 0) {
      continue;
    }
    const scope = comparisonSectionScope(writtenPage, table);
    const label = `${sourceBaseName(table.source)}, p. ${table.page}`;
    for (const row of rows) {
      if (row.subject !== '' && !scope.includes(row.subject)) {
        droppedRowValues.push(`${label} row "${row.subject}": the row itself is missing`);
        // The row's values are unreachable too — one finding per row is the
        // actionable feedback (restore the row), not one per cell.
        continue;
      }
      for (const number of row.numbers) {
        if (!scope.includes(number)) {
          droppedRowValues.push(`${label} row "${row.subject}": value "${number}"`);
        }
      }
    }
  }

  const { keys } = buildComparisonCitationMap(originalData);
  for (const key of keys) {
    const marker = `[^${key}]`;
    if (!writtenPage.includes(marker)) {
      droppedCitations.push(marker);
    }
  }

  // Phase 18 (B18, vision `06` §2): off-map markers are a content defect.
  const extraMarkers = findExtraMarkers(writtenPage, new Set(keys));

  const passed =
    droppedRowValues.length === 0 &&
    droppedCitations.length === 0 &&
    extraMarkers.length === 0;

  return { passed, droppedRowValues, droppedCitations, extraMarkers };
}
