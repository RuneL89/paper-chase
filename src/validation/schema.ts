import type { WikiStatus } from '../config.js';

export type PageType =
  | 'index'
  | 'document'
  | 'source'
  | 'topic'
  | 'entity'
  | 'raw'
  | string;

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  type: PageType;
  issues: ValidationIssue[];
}

interface FieldSchema {
  name: string;
  required: boolean;
  validate?: (value: unknown) => string | undefined;
}

interface PageSchema {
  type: PageType;
  fields: FieldSchema[];
}

const isNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'must be a non-empty string';
  }
  return undefined;
};

const isStringOrNumber = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 'must be a string or number';
  }
  return undefined;
};

const isArray = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) {
    return 'must be an array';
  }
  return undefined;
};

const isConfidence = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !['high', 'medium', 'low'].includes(value)) {
    return 'must be one of: high, medium, low';
  }
  return undefined;
};

const isWikiStatus = (value: unknown): string | undefined => {
  const allowed: WikiStatus[] = ['initialized', 'sampled', 'ready', 'draft'];
  if (typeof value !== 'string' || !allowed.includes(value as WikiStatus)) {
    return 'must be a valid wiki status';
  }
  return undefined;
};

const isValidDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return 'must be an ISO 8601 timestamp string';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'must be a valid ISO 8601 timestamp';
  }
  return undefined;
};

const schemas: PageSchema[] = [
  {
    type: 'index',
    fields: [
      { name: 'title', required: true, validate: isNonEmptyString },
      { name: 'type', required: true, validate: isNonEmptyString },
      { name: 'updated', required: true, validate: isValidDate },
      { name: 'wiki', required: true, validate: isNonEmptyString },
      { name: 'created', required: true, validate: isValidDate },
      { name: 'children', required: false, validate: isArray },
    ],
  },
  {
    type: 'document',
    fields: [
      { name: 'title', required: true, validate: isNonEmptyString },
      { name: 'type', required: true, validate: isNonEmptyString },
      { name: 'tags', required: true, validate: isArray },
      { name: 'sources', required: true, validate: isArray },
      { name: 'confidence', required: true, validate: isConfidence },
      { name: 'wiki', required: true, validate: isNonEmptyString },
      { name: 'created', required: true, validate: isValidDate },
    ],
  },
  {
    type: 'source',
    fields: [
      { name: 'title', required: true, validate: isNonEmptyString },
      { name: 'type', required: true, validate: isNonEmptyString },
      { name: 'file', required: true, validate: isNonEmptyString },
      { name: 'pages', required: true, validate: isStringOrNumber },
      { name: 'sha256', required: true, validate: isNonEmptyString },
      { name: 'ingested', required: true, validate: isValidDate },
      { name: 'warnings', required: true, validate: isArray },
      { name: 'wiki', required: true, validate: isNonEmptyString },
      { name: 'created', required: true, validate: isValidDate },
      { name: 'label', required: false, validate: isNonEmptyString },
    ],
  },
  {
    type: 'topic',
    fields: [
      { name: 'title', required: true, validate: isNonEmptyString },
      { name: 'type', required: true, validate: isNonEmptyString },
      { name: 'tags', required: true, validate: isArray },
      { name: 'related', required: true, validate: isArray },
      { name: 'wiki', required: true, validate: isNonEmptyString },
      { name: 'created', required: true, validate: isValidDate },
    ],
  },
  {
    type: 'entity',
    fields: [
      { name: 'title', required: true, validate: isNonEmptyString },
      { name: 'type', required: true, validate: isNonEmptyString },
      { name: 'tags', required: true, validate: isArray },
      { name: 'mentions', required: true, validate: isArray },
      { name: 'wiki', required: true, validate: isNonEmptyString },
      { name: 'created', required: true, validate: isValidDate },
    ],
  },
  {
    type: 'raw',
    fields: [
      { name: 'title', required: true, validate: isNonEmptyString },
      { name: 'type', required: true, validate: isNonEmptyString },
      { name: 'source', required: true, validate: isNonEmptyString },
      { name: 'reason', required: true, validate: isNonEmptyString },
      { name: 'raw_fragment', required: true, validate: isNonEmptyString },
      { name: 'wiki', required: true, validate: isNonEmptyString },
      { name: 'created', required: true, validate: isValidDate },
    ],
  },
];

const schemaByType = new Map(schemas.map((s) => [s.type, s]));

const knownPageTypes = new Set(schemas.map((s) => s.type));

/**
 * Validates YAML frontmatter data against the page-type schema.
 * Returns a structured result with all issues found.
 */
export function validateFrontmatter(data: Record<string, unknown>): ValidationResult {
  const type = String(data.type ?? '');
  const schema = schemaByType.get(type);

  const issues: ValidationIssue[] = [];

  if (!schema) {
    if (type === '') {
      issues.push({ field: 'type', message: 'missing page type' });
    } else {
      issues.push({ field: 'type', message: `unknown page type "${type}"` });
    }
  } else {
    for (const field of schema.fields) {
      const value = data[field.name];
      if (field.required && (value === undefined || value === null || value === '')) {
        issues.push({ field: field.name, message: `missing required field` });
      } else if (value !== undefined && value !== null && field.validate) {
        const error = field.validate(value);
        if (error) {
          issues.push({ field: field.name, message: error });
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    type,
    issues,
  };
}

/**
 * Returns true if the given string is a known default page type.
 */
export function isKnownPageType(type: string): boolean {
  return knownPageTypes.has(type);
}

/**
 * Returns the list of required fields for a known page type.
 */
export function requiredFieldsForType(type: string): string[] {
  const schema = schemaByType.get(type);
  return schema?.fields.filter((f) => f.required).map((f) => f.name) ?? [];
}

/**
 * Validates that the supplied YAML frontmatter has a type that is one of the default page types.
 */
export function validateDefaultPageType(data: Record<string, unknown>): ValidationResult {
  const type = String(data.type ?? '');
  if (!isKnownPageType(type)) {
    return {
      valid: false,
      type,
      issues: [{ field: 'type', message: `must be one of the default page types: ${Array.from(knownPageTypes).join(', ')}` }],
    };
  }
  return validateFrontmatter(data);
}

export { isValidDate, isWikiStatus };
