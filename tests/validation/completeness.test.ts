import { describe, it, expect } from 'vitest';
import { checkCompleteness } from '../../src/validation/completeness.js';

describe('completeness check', () => {
  it('TAC-001: passes when all paragraphs are represented', () => {
    const chunk = {
      content: 'Acme Corp reported record earnings for the fiscal year.\n\nGlobex Inc announced a partnership.',
      pageRange: '1',
    };
    const pageUpdate = {
      body: 'This chunk discusses Acme Corp, which reported record earnings for the fiscal year, and Globex Inc, which announced a partnership.',
    };
    const result = checkCompleteness(chunk, pageUpdate);
    expect(result.ok).toBe(true);
    expect(result.paragraphsChecked).toBe(2);
  });

  it('TAC-002: fails when an extracted paragraph is missing from the body', () => {
    const chunk = {
      content: 'Acme Corp reported record earnings for the fiscal year.\n\nGlobex Inc announced a partnership.',
      pageRange: '1',
    };
    const pageUpdate = {
      body: 'This chunk is about Acme Corp.',
    };
    const result = checkCompleteness(chunk, pageUpdate);
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.kind === 'paragraph')).toBe(true);
  });

  it('TAC-003: checks tables that fall within the chunk page range', () => {
    const chunk = {
      content: 'See the table below.',
      pageRange: '1',
    };
    const pageUpdate = {
      body: 'A table was present in the source.',
    };
    const tables = [{ page: 1, markdown: '| Year | Revenue |\n|------|------|\n| 2024 | 10M |', caption: 'Revenue' }];
    const result = checkCompleteness(chunk, pageUpdate, tables);
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.kind === 'table')).toBe(true);
  });

  it('TAC-004: ignores tables outside the chunk page range', () => {
    const chunk = {
      content: 'Page one content.',
      pageRange: '1',
    };
    const pageUpdate = {
      body: 'Page one content.',
    };
    const tables = [{ page: 2, markdown: '| Year | Revenue |', caption: 'Revenue' }];
    const result = checkCompleteness(chunk, pageUpdate, tables);
    expect(result.ok).toBe(true);
    expect(result.tablesChecked).toBe(0);
  });

  it('TAC-005: checks figures that fall within the chunk page range', () => {
    const chunk = {
      content: 'See figure 1.',
      pageRange: '1-2',
    };
    const pageUpdate = {
      body: 'A figure was present.',
    };
    const figures = [{ page: 2, caption: 'Growth Chart', description: 'Line chart showing growth' }];
    const result = checkCompleteness(chunk, pageUpdate, [], figures);
    expect(result.ok).toBe(false);
    expect(result.missing.some((m) => m.kind === 'figure')).toBe(true);
  });

  it('TAC-006: passes when figure caption is present in the body', () => {
    const chunk = {
      content: 'See figure 1.',
      pageRange: '1',
    };
    const pageUpdate = {
      body: 'The Growth Chart illustrates the trend.',
    };
    const figures = [{ page: 1, caption: 'Growth Chart', description: 'Line chart' }];
    const result = checkCompleteness(chunk, pageUpdate, [], figures);
    expect(result.ok).toBe(true);
  });
});
