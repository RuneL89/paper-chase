import { describe, it, expect } from 'vitest';
import { validateFrontmatter, isKnownPageType, requiredFieldsForType } from '../../src/validation/schema.js';

describe('frontmatter schema validation', () => {
  it('TAC-001: accepts a valid index page', () => {
    const result = validateFrontmatter({
      title: 'Wiki Index',
      type: 'index',
      updated: '2026-07-08T00:00:00Z',
      wiki: 'donations',
      children: [],
    });
    expect(result.valid).toBe(true);
    expect(result.type).toBe('index');
    expect(result.issues).toHaveLength(0);
  });

  it('TAC-002: rejects a document page missing sources', () => {
    const result = validateFrontmatter({
      title: 'Part 1',
      type: 'document',
      tags: ['finance'],
      confidence: 'high',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'sources' && i.message.includes('missing'))).toBe(true);
  });

  it('TAC-003: rejects invalid confidence value', () => {
    const result = validateFrontmatter({
      title: 'Part 1',
      type: 'document',
      tags: ['finance'],
      sources: [{ file: 'sample.pdf', pages: '1-5' }],
      confidence: 'certain',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'confidence')).toBe(true);
  });

  it('TAC-004: rejects unknown page type', () => {
    const result = validateFrontmatter({
      title: 'Unknown',
      type: 'unknown-type',
      updated: '2026-07-08T00:00:00Z',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'type')).toBe(true);
  });

  it('TAC-005: rejects missing type', () => {
    const result = validateFrontmatter({
      title: 'No Type',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'type')).toBe(true);
  });

  it('TAC-006: validates a complete source page', () => {
    const result = validateFrontmatter({
      title: 'Source: report.pdf',
      type: 'source',
      file: 'wikis/donations/raw/report.pdf',
      pages: 12,
      ingested: '2026-07-08T00:00:00Z',
      warnings: [],
    });
    expect(result.valid).toBe(true);
  });

  it('TAC-007: isKnownPageType recognizes default types', () => {
    expect(isKnownPageType('index')).toBe(true);
    expect(isKnownPageType('document')).toBe(true);
    expect(isKnownPageType('source')).toBe(true);
    expect(isKnownPageType('entity')).toBe(true);
    expect(isKnownPageType('topic')).toBe(true);
    expect(isKnownPageType('raw')).toBe(true);
    expect(isKnownPageType('timeline')).toBe(false);
  });

  it('TAC-008: requiredFieldsForType returns expected fields', () => {
    expect(requiredFieldsForType('index')).toContain('title');
    expect(requiredFieldsForType('index')).toContain('updated');
    expect(requiredFieldsForType('document')).toContain('sources');
    expect(requiredFieldsForType('raw')).toContain('raw_fragment');
  });
});
