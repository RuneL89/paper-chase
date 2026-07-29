/**
 * Extractor JSON schema validator (phase doc §2.4, extended per the
 * 2026-07-17 12:00 compliance-log noted adaptation 1: timeline, context,
 * per-entity significance, optional disambiguation).
 *
 * Non-throwing by design: returns `{ valid, issues }` so callers can decide
 * how to surface failures (the Extractor wraps them in an ExtractorError).
 * Validation order follows vision `04` §6: schema first, then folder
 * validation (prefix, no path traversal, depth), then page-range checks.
 *
 * Slug rules are checked against the normalized slugs — the Extractor runs
 * its deterministic slugify() normalization BEFORE calling this validator
 * (noted adaptation 5).
 *
 * Phase 23 (§2.1): the optional `tables` array (comparison tables) is
 * validated when present — `title`/`page` (in range)/`markdown` required,
 * dimensions and summary free-text, unknown entity slugs in a table's
 * `entities` warn (the additive `warnings` channel) but pass.
 */

export interface ExtractorValidation {
  valid: boolean;
  issues: string[];
  /**
   * Phase 23 (§2.1/gate 23.1): non-fatal observations — a table's `entities`
   * naming a slug the chunk did not extract warns but PASSES (tables may
   * mention unextracted names). Warnings never affect `valid` and never feed
   * the reask loop.
   */
  warnings: string[];
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const FOLDER_PREFIX_PATTERN = /^entities\/|^topics\//;
const MAX_FOLDER_SEGMENTS = 4; // entities/ or topics/ + max 3 levels below

interface PageRange {
  min: number;
  max: number;
}

/** Parse "1-3" or "1" into a min/max page range; null when unparseable. */
function parsePageRange(pageRange: string | undefined): PageRange | null {
  if (!pageRange) {
    return null;
  }
  const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(pageRange);
  if (!match) {
    return null;
  }
  const min = Number(match[1]);
  const max = match[2] !== undefined ? Number(match[2]) : min;
  return { min, max };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPageNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validatePage(
  value: unknown,
  label: string,
  range: PageRange | null,
  issues: string[],
): void {
  if (!isPageNumber(value)) {
    issues.push(`${label}: page must be a number, got ${JSON.stringify(value)}`);
    return;
  }
  if (range && (value < range.min || value > range.max)) {
    issues.push(`${label}: page ${value} is outside the chunk page range ${range.min}-${range.max}`);
  }
}

function validateFolder(value: unknown, label: string, issues: string[]): void {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(`${label}: folder must be a non-empty string`);
    return;
  }
  if (!FOLDER_PREFIX_PATTERN.test(value)) {
    issues.push(`${label}: folder "${value}" must start with "entities/" or "topics/"`);
  }
  if (value.includes('..')) {
    issues.push(`${label}: folder "${value}" must not contain ".." (path traversal)`);
  }
  const segments = value.split('/');
  if (segments.length > MAX_FOLDER_SEGMENTS) {
    issues.push(
      `${label}: folder "${value}" has ${segments.length} path segments; max is ${MAX_FOLDER_SEGMENTS} (3 levels below entities/ or topics/)`,
    );
  }
  if (segments.some((segment) => segment.length === 0)) {
    issues.push(`${label}: folder "${value}" contains an empty path segment`);
  }
}

function validateSlugList(value: unknown, label: string, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push(`${label}: must be an array of entity slugs`);
    return;
  }
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      issues.push(`${label}[${index}]: must be a string (entity slug)`);
    }
  });
}

/**
 * Validate Extractor output against the schema in phase doc §2.2/§2.4 plus
 * the binding schema extension (timeline/context/significance/disambiguation).
 * When `pageRange` is supplied and parseable ("1-3" or "1"), every `page`
 * value (mentions, relationships, claims) must fall within it.
 */
export function validateExtractorResult(data: unknown, pageRange?: string): ExtractorValidation {
  const issues: string[] = [];
  const warnings: string[] = [];
  const range = parsePageRange(pageRange);

  if (!isRecord(data)) {
    return { valid: false, issues: ['root: expected a JSON object'], warnings: [] };
  }

  // ---- entities ----
  // Phase 23 (§2.1): the chunk's own entity slugs are collected while
  // validating so a table's `entities` can warn (never reject) on names the
  // chunk did not extract.
  const knownEntitySlugs = new Set<string>();
  if (!Array.isArray(data.entities)) {
    issues.push('entities: must be an array');
  } else {
    data.entities.forEach((entity, index) => {
      const label = `entities[${index}]`;
      if (!isRecord(entity)) {
        issues.push(`${label}: must be an object`);
        return;
      }
      if (typeof entity.slug === 'string') {
        knownEntitySlugs.add(entity.slug);
      }
      if (!isNonEmptyString(entity.name)) {
        issues.push(`${label}: name must be a non-empty string`);
      }
      if (!isNonEmptyString(entity.type)) {
        issues.push(`${label}: type must be a non-empty string (got ${JSON.stringify(entity.name)})`);
      }
      if (typeof entity.slug !== 'string' || !SLUG_PATTERN.test(entity.slug)) {
        issues.push(`${label}: slug must match ${SLUG_PATTERN} (got ${JSON.stringify(entity.slug)})`);
      }
      validateFolder(entity.folder, label, issues);
      if (typeof entity.significance !== 'string') {
        issues.push(`${label}: significance must be a string`);
      }
      if (entity.disambiguation !== undefined && typeof entity.disambiguation !== 'string') {
        issues.push(`${label}: disambiguation must be a string when present`);
      }
      if (!Array.isArray(entity.mentions)) {
        issues.push(`${label}: mentions must be an array`);
      } else {
        entity.mentions.forEach((mention, mentionIndex) => {
          const mentionLabel = `${label}.mentions[${mentionIndex}]`;
          if (!isRecord(mention)) {
            issues.push(`${mentionLabel}: must be an object`);
            return;
          }
          validatePage(mention.page, mentionLabel, range, issues);
          if (typeof mention.context !== 'string') {
            issues.push(`${mentionLabel}: context must be a string`);
          }
        });
      }
    });
  }

  // ---- relationships ----
  if (!Array.isArray(data.relationships)) {
    issues.push('relationships: must be an array');
  } else {
    data.relationships.forEach((relationship, index) => {
      const label = `relationships[${index}]`;
      if (!isRecord(relationship)) {
        issues.push(`${label}: must be an object`);
        return;
      }
      for (const field of ['subject', 'predicate', 'object', 'evidence'] as const) {
        if (!isNonEmptyString(relationship[field])) {
          issues.push(`${label}: ${field} must be a non-empty string`);
        }
      }
      validatePage(relationship.page, label, range, issues);
    });
  }

  // ---- claims ----
  if (!Array.isArray(data.claims)) {
    issues.push('claims: must be an array');
  } else {
    data.claims.forEach((claim, index) => {
      const label = `claims[${index}]`;
      if (!isRecord(claim)) {
        issues.push(`${label}: must be an object`);
        return;
      }
      if (!isNonEmptyString(claim.text)) {
        issues.push(`${label}: text must be a non-empty string`);
      }
      if (!isNonEmptyString(claim.type)) {
        issues.push(`${label}: type must be a non-empty string`);
      }
      validateSlugList(claim.entities, `${label}.entities`, issues);
      validatePage(claim.page, label, range, issues);
    });
  }

  // ---- timeline (schema extension, gates 2.9) ----
  if (!Array.isArray(data.timeline)) {
    issues.push('timeline: must be an array');
  } else {
    data.timeline.forEach((event, index) => {
      const label = `timeline[${index}]`;
      if (!isRecord(event)) {
        issues.push(`${label}: must be an object`);
        return;
      }
      if (!isNonEmptyString(event.date)) {
        issues.push(`${label}: date must be a non-empty string`);
      }
      if (!isNonEmptyString(event.event)) {
        issues.push(`${label}: event must be a non-empty string`);
      }
      validateSlugList(event.entities, `${label}.entities`, issues);
    });
  }

  // ---- context (schema extension, gate 2.10) ----
  if (typeof data.context !== 'string') {
    issues.push('context: must be a string');
  }

  // ---- tables (Phase 23 §2.1, gate 23.1) ----
  // Optional at the schema level so pre-Phase-23 extraction JSON stays valid;
  // when present it must be an array of well-formed tables: `title`, `page`
  // (within the chunk range), and `markdown` non-empty are required;
  // `subject`/dimensions/`summary` are free-text; `entities` naming slugs the
  // chunk did not extract WARN but pass (tables may mention unextracted names).
  if (data.tables !== undefined) {
    if (!Array.isArray(data.tables)) {
      issues.push('tables: must be an array');
    } else {
      data.tables.forEach((table, index) => {
        const label = `tables[${index}]`;
        if (!isRecord(table)) {
          issues.push(`${label}: must be an object`);
          return;
        }
        if (!isNonEmptyString(table.title)) {
          issues.push(`${label}: title must be a non-empty string`);
        }
        validatePage(table.page, label, range, issues);
        if (!isNonEmptyString(table.markdown)) {
          issues.push(`${label}: markdown must be a non-empty string`);
        }
        if (table.subject !== undefined && typeof table.subject !== 'string') {
          issues.push(`${label}: subject must be a string when present`);
        }
        for (const field of ['rowDimension', 'colDimension', 'summary'] as const) {
          if (table[field] !== undefined && typeof table[field] !== 'string') {
            issues.push(`${label}: ${field} must be a string when present`);
          }
        }
        if (table.entities !== undefined) {
          if (!Array.isArray(table.entities)) {
            issues.push(`${label}.entities: must be an array of entity slugs`);
          } else {
            table.entities.forEach((entry, entityIndex) => {
              if (typeof entry !== 'string') {
                issues.push(`${label}.entities[${entityIndex}]: must be a string (entity slug)`);
              } else if (!knownEntitySlugs.has(entry)) {
                warnings.push(
                  `${label}.entities[${entityIndex}]: slug "${entry}" is not an entity extracted from this chunk (allowed — the table may mention an unextracted name)`,
                );
              }
            });
          }
        }
      });
    }
  }

  return { valid: issues.length === 0, issues, warnings };
}
