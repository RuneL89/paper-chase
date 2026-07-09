/**
 * Slugifies a string using Unicode NFKD normalization, lowercase conversion,
 * and replacement of non-alphanumeric characters with hyphens.
 *
 * Examples:
 *   slugify("Russell Barkley") → "russell-barkley"
 *   slugify("Électricité de France") → "electricite-de-france"
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

/**
 * Tracks slug collisions and returns disambiguated slugs.
 * The first occurrence keeps the base slug; subsequent occurrences
 * receive an incremental integer suffix (e.g., "john-smith", "john-smith-1").
 */
export class SlugRegistry {
  private counts = new Map<string, number>();

  /**
   * Registers a name and returns its canonical, disambiguated slug.
   */
  register(name: string): string {
    const base = slugify(name);
    const count = this.counts.get(base) ?? 0;
    this.counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  }

  /**
   * Returns the slug that would be assigned to a name without registering it.
   */
  peek(name: string): string {
    const base = slugify(name);
    const count = this.counts.get(base) ?? 0;
    return count === 0 ? base : `${base}-${count}`;
  }

  /**
   * Returns true if the given name has already been registered.
   */
  has(name: string): boolean {
    const base = slugify(name);
    return this.counts.has(base);
  }

  /**
   * Seeds the registry from existing slugs so that new registrations
   * continue the disambiguation sequence (e.g., john-smith, john-smith-1, john-smith-2).
   */
  seedFromSlugs(slugs: string[]): void {
    for (const slug of slugs) {
      const base = slug.replace(/-\d+$/g, '');
      const indexMatch = slug.match(/-(\d+)$/);
      const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;
      const current = this.counts.get(base) ?? 0;
      if (index + 1 > current) {
        this.counts.set(base, index + 1);
      }
    }
  }

  /**
   * Resets the registry.
   */
  clear(): void {
    this.counts.clear();
  }
}
