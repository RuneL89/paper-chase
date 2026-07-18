import { buildCitationMap } from '../pages/entity-page';
import type { EntityPageData } from '../pages/entity-page';
import type { TopicPageData } from '../pages/topic-page';

export interface PreservationCheckResult {
  passed: boolean;
  droppedMentions: string[];
  droppedRelationships: string[];
  droppedClaims: string[];
  droppedCitations: string[];
}

export interface TopicPreservationCheckResult {
  passed: boolean;
  droppedClaims: string[];
  droppedCitations: string[];
}

/**
 * Verify that a synthesized entity page preserves every mention context,
 * relationship evidence, claim text, and source citation from the original
 * structured data.
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

  const passed =
    droppedMentions.length === 0 &&
    droppedRelationships.length === 0 &&
    droppedClaims.length === 0 &&
    droppedCitations.length === 0;

  return { passed, droppedMentions, droppedRelationships, droppedClaims, droppedCitations };
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

  const passed = droppedClaims.length === 0 && droppedCitations.length === 0;

  return { passed, droppedClaims, droppedCitations };
}
