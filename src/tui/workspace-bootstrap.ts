import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadSettings, saveSettings, settingsPath, legacySettingsPath, type TuiSettings } from './settings';

/**
 * 2026-08-28 (user-reported bug fix): the workspace bootstrap — how the TUI
 * remembers which folders hold wikis across launches. The registry lives in
 * the LAUNCH folder's `.paper-chase.json` (the `workspace` last-used pointer
 * + the `workspaces` list of absolute folder paths). Wiki names are NEVER
 * stored: every selector re-scans each registered folder's `wikis/` live, so
 * a deleted wiki folder simply stops appearing.
 *
 * Both helpers take `bootDir` (the launch folder; default '.' = the process
 * cwd) explicitly so tests exercise them hermetically against temp dirs, and
 * both are best-effort — a broken or unreadable config never crashes the TUI.
 */

export interface WorkspaceRegistry {
  /** Every known workspace folder, most recently registered last. */
  workspaces: string[];
  /** The last-used workspace (Create New Wiki's pre-filled default). */
  active: string;
}

/**
 * Read the registry from the launch folder's config. A pre-registry
 * `workspace` pointer back-seeds the list so the single-folder configs the
 * TUI wrote before this fix still resolve to their workspace.
 */
export async function loadWorkspaceRegistry(bootDir: string = '.'): Promise<WorkspaceRegistry> {
  const settings = await loadSettings(bootDir);
  const active = settings.workspace?.trim() || '.';
  const workspaces = [...(settings.workspaces ?? [])];
  if (active !== '.' && !workspaces.includes(active)) {
    workspaces.push(active);
  }
  return { workspaces, active };
}

/**
 * Activate a workspace: dedupe-add it to the registry (most recently used
 * last), set the `workspace` pointer (cleared when the workspace resolves to
 * the launch folder itself — '.' stays the implicit default), and migrate the
 * launch folder's settings into the workspace's own `.paper-chase.json` ONCE
 * (models, API keys, toggles follow the workspace; an existing config is
 * never overwritten; the copy strips the pointer/registry fields). Idempotent
 * and best-effort — the session works even when nothing can be persisted.
 */
export async function registerWorkspace(workspace: string, bootDir: string = '.'): Promise<void> {
  const resolvedBoot = resolve(bootDir);
  const resolved = resolve(workspace.trim().length > 0 ? workspace.trim() : bootDir);

  if (
    resolved !== resolvedBoot &&
    !existsSync(settingsPath(resolved)) &&
    !existsSync(legacySettingsPath(resolved))
  ) {
    try {
      const boot = await loadSettings(resolvedBoot);
      const inherited: TuiSettings = { ...boot };
      delete inherited.workspace;
      delete inherited.workspaces;
      await saveSettings(resolved, inherited);
    } catch {
      // Best-effort: a failing migration just means the workspace starts
      // with default settings (environment keys still apply at call time).
    }
  }

  try {
    const boot = await loadSettings(resolvedBoot);
    const nextWorkspace = resolved !== resolvedBoot ? resolved : undefined;
    const nextList = (boot.workspaces ?? []).filter((entry) => entry !== resolved);
    if (resolved !== resolvedBoot) {
      nextList.push(resolved);
    }
    const pointerChanged = (nextWorkspace ?? undefined) !== (boot.workspace ?? undefined);
    const registryChanged = JSON.stringify(nextList) !== JSON.stringify(boot.workspaces ?? []);
    if (pointerChanged || registryChanged) {
      await saveSettings(resolvedBoot, {
        ...boot,
        workspace: nextWorkspace,
        workspaces: nextList.length > 0 ? nextList : undefined,
      });
    }
  } catch {
    // Best-effort: the registry just isn't remembered; nothing else fails.
  }
}
