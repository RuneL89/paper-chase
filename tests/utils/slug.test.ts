import { describe, it, expect } from 'vitest';
import { slugify, SlugRegistry } from '../../src/utils/slug.js';

describe('slug utility', () => {
  it('TAC-001: slugifies common names', () => {
    expect(slugify('Russell Barkley')).toBe('russell-barkley');
    expect(slugify('John Smith')).toBe('john-smith');
  });

  it('TAC-002: normalizes Unicode characters', () => {
    expect(slugify('Électricité de France')).toBe('electricite-de-france');
  });

  it('TAC-003: collapses and trims hyphens', () => {
    expect(slugify('Hello   World!!!')).toBe('hello-world');
    expect(slugify('---leading')).toBe('leading');
    expect(slugify('trailing---')).toBe('trailing');
  });

  it('TAC-004: SlugRegistry resolves collisions with incremental suffixes', () => {
    const registry = new SlugRegistry();
    expect(registry.register('John Smith')).toBe('john-smith');
    expect(registry.register('John Smith')).toBe('john-smith-1');
    expect(registry.register('John Smith')).toBe('john-smith-2');
  });

  it('TAC-005: SlugRegistry treats names with the same slug as collisions', () => {
    const registry = new SlugRegistry();
    expect(registry.register('John Smith')).toBe('john-smith');
    expect(registry.register('john smith')).toBe('john-smith-1');
  });

  it('TAC-006: SlugRegistry peek and has work', () => {
    const registry = new SlugRegistry();
    expect(registry.peek('John Smith')).toBe('john-smith');
    registry.register('John Smith');
    expect(registry.has('John Smith')).toBe(true);
    expect(registry.peek('John Smith')).toBe('john-smith-1');
  });
});
