import { useEffect, useState } from 'react';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Lists existing wikis (subdirectories of `<workspace>/wikis/`).
 * Returns an empty array when the wikis directory does not exist.
 * Phase 24: the derived `cross-wiki/` folder is not a wiki — it is excluded
 * from every wiki list (ingest/add-pdfs targets are real wikis only).
 */
export function useWikiList(workspace: string = '.'): string[] {
  const [wikis, setWikis] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const entries = await readdir(join(workspace, 'wikis'), { withFileTypes: true });
        if (!cancelled) {
          setWikis(entries.filter((e) => e.isDirectory() && e.name !== 'cross-wiki').map((e) => e.name));
        }
      } catch {
        if (!cancelled) {
          setWikis([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace]);

  return wikis;
}
