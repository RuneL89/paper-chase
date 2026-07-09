import type { PageUpdate } from '../orchestrator/types.js';

export interface ExtractedTable {
  page: number;
  caption?: string;
  markdown: string;
}

export interface ExtractedFigure {
  page: number;
  caption?: string;
  description: string;
}

export interface CompletenessIssue {
  kind: 'paragraph' | 'table' | 'figure' | 'claim';
  message: string;
  detail?: string;
}

export interface CompletenessResult {
  ok: boolean;
  missing: CompletenessIssue[];
  paragraphsChecked: number;
  tablesChecked: number;
  figuresChecked: number;
}

interface ChunkLike {
  content: string;
  pageRange: string;
}

/**
 * Normalizes text for comparison by collapsing whitespace and trimming.
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\[\^src\d+\]/g, '')
    .trim()
    .toLowerCase();
}

function parsePageRange(range: string): number[] {
  const match = range.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return [];
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : start;
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

function extractParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30 && !p.startsWith('|') && !p.startsWith('#'));
}

function extractTableHeaderRow(tableMarkdown: string): string {
  const lines = tableMarkdown.split('\n').map((l) => l.trim()).filter(Boolean);
  // First line is the header, second is the separator.
  return lines[0] ? normalizeText(lines[0]) : '';
}

/**
 * Checks whether the markdown body preserves the extracted content from a chunk.
 *
 * - Paragraphs: every non-trivial paragraph should be represented (rephrased is fine).
 * - Tables: the table header or full table should be preserved.
 * - Figures: the figure caption or a description of the figure should appear.
 */
export function checkCompleteness(
  chunk: ChunkLike,
  pageUpdate: Pick<PageUpdate, 'body'>,
  tables: ExtractedTable[] = [],
  figures: ExtractedFigure[] = [],
): CompletenessResult {
  const missing: CompletenessIssue[] = [];
  const bodyLower = normalizeText(pageUpdate.body);
  const bodyOriginal = pageUpdate.body.toLowerCase();
  const chunkPages = parsePageRange(chunk.pageRange);

  const paragraphs = extractParagraphs(chunk.content);
  let paragraphsChecked = 0;
  for (const paragraph of paragraphs) {
    paragraphsChecked++;
    const normalized = normalizeText(paragraph);
    if (normalized.length < 15) continue;
    // A paragraph is considered preserved if a substantial substring appears
    // in the body. This allows for LLM rephrasing while still catching omissions.
    if (!isRepresented(normalized, bodyLower)) {
      missing.push({
        kind: 'paragraph',
        message: 'Extracted paragraph is not represented in the markdown body',
        detail: paragraph.slice(0, 120),
      });
    }
  }

  let tablesChecked = 0;
  for (const table of tables) {
    if (chunkPages.length > 0 && !chunkPages.includes(table.page)) continue;
    tablesChecked++;
    const tableMarkdown = table.markdown?.trim();
    if (!tableMarkdown) continue;
    const header = extractTableHeaderRow(tableMarkdown);
    if (header && !bodyOriginal.includes(header) && !bodyOriginal.includes(normalizeText(tableMarkdown))) {
      missing.push({
        kind: 'table',
        message: 'Table from the extracted chunk is not preserved in the markdown body',
        detail: table.caption || tableMarkdown.slice(0, 120),
      });
    }
  }

  let figuresChecked = 0;
  for (const figure of figures) {
    if (chunkPages.length > 0 && !chunkPages.includes(figure.page)) continue;
    figuresChecked++;
    const caption = figure.caption?.trim().toLowerCase() ?? '';
    const description = figure.description?.trim().toLowerCase() ?? '';
    if (!caption && !description) continue;
    const represented =
      (caption.length > 0 && bodyOriginal.includes(caption)) ||
      (description.length > 0 && bodyOriginal.includes(description)) ||
      (caption.length > 0 && isRepresented(caption, bodyLower));
    if (!represented) {
      missing.push({
        kind: 'figure',
        message: 'Figure from the extracted chunk is not described in the markdown body',
        detail: figure.caption || figure.description?.slice(0, 120),
      });
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    paragraphsChecked,
    tablesChecked,
    figuresChecked,
  };
}

/**
 * Returns true if a normalized text is represented in the body. A text is
 * represented if it appears verbatim, or if enough words are present in order.
 */
function isRepresented(normalized: string, bodyLower: string): boolean {
  if (bodyLower.includes(normalized)) return true;
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return true;

  // Require 60% of the words to be present, with at least one 4-word ordered run.
  const bodyWords = bodyLower.split(/\s+/).filter((w) => w.length > 0);
  let matchedWords = 0;
  for (const word of words) {
    if (bodyWords.includes(word)) matchedWords++;
  }
  if (matchedWords / words.length < 0.6) return false;

  // Look for an ordered 3-gram match.
  if (words.length >= 3) {
    for (let i = 0; i <= words.length - 3; i++) {
      const ngram = words.slice(i, i + 3).join(' ');
      if (bodyLower.includes(ngram)) return true;
    }
  }

  // For short texts, require the whole normalized text.
  return words.length < 3 && bodyLower.includes(normalized);
}
