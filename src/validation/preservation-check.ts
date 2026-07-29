import { buildCitationMap } from '../pages/entity-page';
import type { EntityPageData } from '../pages/entity-page';
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
