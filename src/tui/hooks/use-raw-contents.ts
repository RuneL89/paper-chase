import { useEffect, useState } from 'react';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Lists the current contents of a wiki's raw/ folder (sorted entry names).
 * Returns null while loading, and an empty array when the wiki has no raw/
 * folder yet (the add-pdf helper creates it on the first copy).
 * `refreshKey` re-triggers the load (bump it after each successful add).
 */
export function useRawContents(workspace: string, wiki: string | undefined, refreshKey = 0): string[] | null {
  const [files, setFiles] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!wiki) {
      setFiles(null);
      return;
    }

    (async () => {
      try {
        const entries = await readdir(join(workspace, 'wikis', wiki, 'raw'));
        if (!cancelled) {
          setFiles(entries.sort());
        }
      } catch {
        if (!cancelled) {
          setFiles([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace, wiki, refreshKey]);

  return files;
}
