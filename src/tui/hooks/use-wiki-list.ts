import { useEffect, useState } from 'react';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * One wiki in the selector: the workspace folder it lives in plus its slug.
 * 2026-08-28 (user-reported bug fix): wikis from EVERY registered workspace
 * appear in one combined list, so the workspace must travel with each entry
 * (two workspaces can each hold a wiki with the same slug).
 */
export interface WikiRef {
  workspace: string;
  slug: string;
}

/**
 * Lists existing wikis across every registered workspace (the `wikis/`
 * subdirectories of each folder). The list is a LIVE filesystem scan and is
 * never persisted — a deleted wiki folder stops appearing on the next screen
 * entry, and a workspace that no longer exists (or is unreadable) is skipped
 * silently (stale registry entries are harmless). Phase 24: the derived
 * `cross-wiki/` folder is not a wiki — it is excluded from every wiki list.
 * Entries sort by slug then workspace so the list is deterministic.
 */
export function useWikiList(workspaces: string[] = ['.']): WikiRef[] {
  const [wikis, setWikis] = useState<WikiRef[]>([]);
  // Depend on the JOINED list, not the array identity — callers commonly
  // build the array inline, and a fresh identity would re-fire every render.
  const workspacesKey = workspaces.join('\u0000');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const found: WikiRef[] = [];
      for (const workspace of workspaces) {
        try {
          const entries = await readdir(join(workspace, 'wikis'), { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name !== 'cross-wiki') {
              found.push({ workspace, slug: entry.name });
            }
          }
        } catch {
          // Workspace missing/unreadable — skip it.
        }
      }
      if (!cancelled) {
        found.sort((a, b) =>
          a.slug !== b.slug ? a.slug.localeCompare(b.slug) : a.workspace.localeCompare(b.workspace),
        );
        setWikis(found);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacesKey]);

  return wikis;
}
