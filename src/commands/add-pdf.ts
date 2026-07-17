import { copyFile, mkdir, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';

/**
 * Typed error thrown by addPdfToWiki. The message is user-displayable, so the
 * TUI screen can show it verbatim in an ErrorBox.
 */
export class AddPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddPdfError';
  }
}

export interface AddPdfResult {
  /** Filesystem path of the copied PDF inside the wiki's raw/ folder. */
  destPath: string;
  /** Destination file name (kept identical to the source file name). */
  fileName: string;
}

/**
 * Normalize a typed/pasted path: trim whitespace and strip layers of matching
 * surrounding quotes. Windows users drag-drop a file into the terminal, which
 * pastes the path wrapped in quotes (e.g. "C:\My Documents\report.pdf").
 */
export function cleanPastedPath(input: string): string {
  let value = input.trim();
  while (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

/**
 * Copy a PDF into `<wikiDir>/raw/` (user-directed Phase 1 extension,
 * 2026-07-17: "do everything in a user friendly manner all from the TUI").
 *
 * - Strips surrounding quotes/whitespace from the pasted path.
 * - Validates existence and the .pdf extension (case-insensitive).
 * - Creates raw/ when missing; the destination file name stays as-is.
 * - Re-adding the same name overwrites (refreshing the PDF is intentional).
 * - Dropping a file that already lives at its raw/ destination is a no-op
 *   success instead of a confusing same-file copy error.
 *
 * Pure filesystem logic with no TUI imports, so it is unit-testable and a
 * future `add-pdf` CLI command can reuse it. Throws AddPdfError with a
 * descriptive message on validation/copy failure.
 */
export async function addPdfToWiki(wikiDir: string, sourcePath: string): Promise<AddPdfResult> {
  const cleaned = cleanPastedPath(sourcePath);
  if (cleaned.length === 0) {
    throw new AddPdfError('No file path provided. Type or paste the path to a PDF file.');
  }

  let stats;
  try {
    stats = await stat(cleaned);
  } catch {
    throw new AddPdfError(`File not found: ${cleaned}`);
  }
  if (!stats.isFile()) {
    throw new AddPdfError(`Not a file: ${cleaned} - provide the path to a PDF file.`);
  }

  const fileName = basename(cleaned);
  if (extname(fileName).toLowerCase() !== '.pdf') {
    throw new AddPdfError(`Not a PDF file: ${fileName}. Only .pdf files can be added to raw/.`);
  }

  const rawDir = join(wikiDir, 'raw');
  await mkdir(rawDir, { recursive: true });
  const destPath = join(rawDir, fileName);

  if (resolve(cleaned) !== resolve(destPath)) {
    try {
      await copyFile(cleaned, destPath);
    } catch (err) {
      throw new AddPdfError(`Failed to copy ${fileName}: ${(err as Error).message}`);
    }
  }

  return { destPath, fileName };
}
