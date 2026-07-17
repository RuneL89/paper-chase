/**
 * Deterministic plaintext-table detection and markdown rendering.
 *
 * The frozen Phase 0 extractor (pdfjs-dist) collapses column-aligned
 * whitespace, so a table drawn in the PDF arrives as runs of plain lines
 * whose whitespace-separated token counts match (e.g. the golden master's
 * 'Quarter Revenue Growth' / 'Q1 $9.8M +4%' rows). This module converts such
 * runs back into GitHub-flavoured markdown tables so document pages preserve
 * tables as markdown (vision 02 §3.2, phase Gate 1.4).
 *
 * The heuristic is deliberately conservative — it only fires when EVERY
 * guard holds, so prose, headings, and list items are never converted:
 *
 *  - a run of >= 3 consecutive lines with the same token count N (N >= 2)
 *  - no run line starts with a list marker ('-', '*', '•', '1.' / '1)')
 *  - no run token contains sentence punctuation (',' ';' ':') or ends with '.'
 *  - the run ends with >= 2 consecutive digit-bearing lines (data rows)
 *
 * Within a matching run, the table header is the line immediately before the
 * trailing digit-bearing rows; earlier lines of the run stay plain text.
 * Every word of the source text is preserved — conversion only inserts
 * markdown table syntax around the existing tokens.
 */

export interface TableRenderResult {
  text: string;
  tablesFound: number;
}

const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])/;
const SENTENCE_PUNCTUATION = /[,;:]/;
const ENDS_WITH_PERIOD = /\.$/;
const CONTAINS_DIGIT = /\d/;

function tokenize(line: string): string[] {
  const trimmed = line.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

function isTableCandidateLine(line: string, tokenCount: number): boolean {
  const tokens = tokenize(line);
  if (tokens.length !== tokenCount || tokens.length < 2) {
    return false;
  }
  if (LIST_MARKER.test(line)) {
    return false;
  }
  return !tokens.some((token) => SENTENCE_PUNCTUATION.test(token) || ENDS_WITH_PERIOD.test(token));
}

function escapeCell(token: string): string {
  return token.replace(/\|/g, '\\|');
}

function renderMarkdownTable(header: string, rows: string[]): string[] {
  const headerCells = tokenize(header).map(escapeCell);
  const tableLines = [
    `| ${headerCells.join(' | ')} |`,
    `| ${headerCells.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    tableLines.push(`| ${tokenize(row).map(escapeCell).join(' | ')} |`);
  }
  return tableLines;
}

/**
 * Replace detected plaintext table runs in `text` with markdown tables.
 * Returns the rendered text and how many tables were detected.
 */
export function renderTablesAsMarkdown(text: string): TableRenderResult {
  const lines = text.split('\n');
  const out: string[] = [];
  let tablesFound = 0;
  let i = 0;

  while (i < lines.length) {
    const tokenCount = tokenize(lines[i]).length;

    if (tokenCount >= 2 && isTableCandidateLine(lines[i], tokenCount)) {
      // Grow the maximal run of candidate lines with the same token count.
      const run: string[] = [];
      let j = i;
      while (j < lines.length && isTableCandidateLine(lines[j], tokenCount)) {
        run.push(lines[j]);
        j++;
      }

      // Count the trailing digit-bearing lines (candidate data rows).
      let dataRowCount = 0;
      while (dataRowCount < run.length && CONTAINS_DIGIT.test(run[run.length - 1 - dataRowCount])) {
        dataRowCount++;
      }

      if (run.length >= 3 && dataRowCount >= 2) {
        const headerIndex = Math.max(run.length - dataRowCount - 1, 0);
        for (let k = 0; k < headerIndex; k++) {
          out.push(run[k]);
        }
        if (out.length > 0 && out[out.length - 1].trim() !== '') {
          out.push('');
        }
        out.push(...renderMarkdownTable(run[headerIndex], run.slice(headerIndex + 1)));
        out.push('');
        tablesFound++;
      } else {
        out.push(...run);
      }
      i = j;
    } else {
      out.push(lines[i]);
      i++;
    }
  }

  // Collapse any trailing blank lines introduced after a table at EOF.
  while (out.length > 0 && out[out.length - 1].trim() === '') {
    out.pop();
  }

  return { text: out.join('\n'), tablesFound };
}
