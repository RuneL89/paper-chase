export function parseStructuredJson<T>(text: string): T | undefined {
  if (typeof text !== 'string') return undefined;
  const cleaned = stripMarkdownFences(text);
  try {
    const parsed = JSON.parse(cleaned) as T;
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    // Fall through to heuristic extraction and repair.
  }

  const largest = findLargestJsonObject(cleaned);
  if (largest) {
    try {
      const parsed = JSON.parse(largest) as T;
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch {
      const repaired = tryRepairJson(largest);
      if (repaired) {
        try {
          const parsed = JSON.parse(repaired) as T;
          if (typeof parsed === 'object' && parsed !== null) {
            return parsed;
          }
        } catch {
          // Could not repair; return undefined.
        }
      }
    }
  }

  return undefined;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/gim, '')
    .replace(/```\s*$/gim, '')
    .trim();
}

function findLargestJsonObject(text: string): string | undefined {
  let best = '';
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      if (depth > 0) {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          if (candidate.length > best.length) {
            best = candidate;
          }
        }
      }
    }
  }

  return best || undefined;
}

function tryRepairJson(text: string): string | undefined {
  const { openBraces, openBrackets } = countStructuralBraces(text);
  if (openBraces < 0 || openBrackets < 0) {
    return undefined;
  }
  let repaired = removeTrailingCommas(text);
  repaired += ']'.repeat(openBrackets);
  repaired += '}'.repeat(openBraces);
  return repaired;
}

function countStructuralBraces(text: string): { openBraces: number; openBrackets: number } {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (const char of text) {
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      openBraces++;
    } else if (char === '}') {
      openBraces--;
    } else if (char === '[') {
      openBrackets++;
    } else if (char === ']') {
      openBrackets--;
    }
  }

  return { openBraces, openBrackets };
}

function removeTrailingCommas(text: string): string {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      result += char;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
    } else if (char === ',' && text.slice(i + 1).trim().match(/^[\]\}]/)) {
      // Drop trailing commas before structural closers.
    } else {
      result += char;
    }
  }

  return result;
}

export function parseArrayFromJson<T>(text: string, key: string): T[] | undefined {
  const parsed = parseStructuredJson<Record<string, unknown>>(text);
  if (!parsed || !(key in parsed)) return undefined;
  const value = parsed[key];
  return Array.isArray(value) ? (value as T[]) : undefined;
}
