export function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) return 0;

  const matrix: number[][] = Array.from({ length: aLower.length + 1 }, () => []);
  for (let i = 0; i <= aLower.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= bLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= aLower.length; i++) {
    for (let j = 1; j <= bLower.length; j++) {
      const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[aLower.length][bLower.length];
}

export function baseSlug(slug: string): string {
  return slug.replace(/-\d+$/g, '');
}

export function areBaseSlugsEqual(a: string, b: string): boolean {
  return baseSlug(a) === baseSlug(b) && baseSlug(a) !== '';
}

export function findPotentialDuplicates(slugs: string[]): Array<{ a: string; b: string; reason: 'levenshtein' | 'slug' }> {
  const flags: Array<{ a: string; b: string; reason: 'levenshtein' | 'slug' }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = slugs[i];
      const b = slugs[j];
      const pairKey = [a, b].sort().join('|');
      if (seen.has(pairKey)) continue;

      if (levenshteinDistance(a, b) < 3) {
        seen.add(pairKey);
        flags.push({ a, b, reason: 'levenshtein' });
      } else if (areBaseSlugsEqual(a, b)) {
        seen.add(pairKey);
        flags.push({ a, b, reason: 'slug' });
      }
    }
  }

  return flags;
}

export function findCrossDuplicates(
  entitySlugs: string[],
  topicSlugs: string[],
): Array<{ a: string; b: string; reason: 'levenshtein' | 'slug' }> {
  const flags: Array<{ a: string; b: string; reason: 'levenshtein' | 'slug' }> = [];
  const seen = new Set<string>();

  for (const entity of entitySlugs) {
    for (const topic of topicSlugs) {
      const pairKey = [entity, topic].sort().join('|');
      if (seen.has(pairKey)) continue;

      if (levenshteinDistance(entity, topic) < 3) {
        seen.add(pairKey);
        flags.push({ a: entity, b: topic, reason: 'levenshtein' });
      } else if (areBaseSlugsEqual(entity, topic)) {
        seen.add(pairKey);
        flags.push({ a: entity, b: topic, reason: 'slug' });
      }
    }
  }

  return flags;
}
