import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface TuiSettings {
  /** Phase 5: pre-check the "Enable Synthesis" option in the ingest screen. */
  synthesis: boolean;
  /** Future: pre-check the "Update AGENTS.md" option. */
  updateAgents: boolean;
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
 * on first run.
 */
export async function loadSettings(workspace: string = '.'): Promise<TuiSettings> {
  try {
    const raw = await readFile(settingsPath(workspace), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TuiSettings>;
    return {
      synthesis: Boolean(parsed.synthesis),
      updateAgents: Boolean(parsed.updateAgents),
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
