import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PdfEngine } from '../extraction/engine';

export interface TuiSettings {
  /** Phase 5: pre-check the "Enable Synthesis" option in the ingest screen. */
  synthesis: boolean;
  /** Future: pre-check the "Update AGENTS.md" option. */
  updateAgents: boolean;
  /**
   * Phase 10: PDF text-extraction engine. Absent (or any unknown value) =
   * pdfjs, the zero-dependency default. 'opendataloader' is strictly opt-in
   * and requires Java 11+ on PATH.
   */
  pdfEngine?: PdfEngine;
}

const DEFAULT_SETTINGS: TuiSettings = {
  synthesis: false,
  updateAgents: false,
};

export function settingsPath(workspace: string): string {
  return join(workspace, '.llm-wiki-cli.json');
}

/**
 * Load TUI settings from `.llm-wiki-cli.json` in the workspace root.
 *
 * Missing or malformed files fall back to the defaults so the TUI never crashes
 * on first run. An unknown `pdfEngine` value is treated as absent (pdfjs).
 */
export async function loadSettings(workspace: string = '.'): Promise<TuiSettings> {
  try {
    const raw = await readFile(settingsPath(workspace), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TuiSettings>;
    return {
      synthesis: Boolean(parsed.synthesis),
      updateAgents: Boolean(parsed.updateAgents),
      ...(parsed.pdfEngine === 'pdfjs' || parsed.pdfEngine === 'opendataloader'
        ? { pdfEngine: parsed.pdfEngine }
        : {}),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist TUI settings to `.llm-wiki-cli.json`. */
export async function saveSettings(workspace: string, settings: TuiSettings): Promise<void> {
  await mkdir(workspace, { recursive: true });
  await writeFile(settingsPath(workspace), JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

export { DEFAULT_SETTINGS };
