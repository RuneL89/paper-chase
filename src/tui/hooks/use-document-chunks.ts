import { useEffect, useState } from 'react';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Lists a wiki's document-page chunks (documents/*.md, sorted, extension
 * stripped — e.g. "golden-master-part-001"). These are the Extractor's
 * inputs. Returns null while loading, [] when the wiki has no documents/
 * folder yet. `refreshKey` re-triggers the load.
 *
 * Note (2026-07-17 12:00 compliance-log, noted adaptation 6): chunks are
 * listed from documents/, not .state/extracted/ — un-extracted chunks only
 * exist as document pages; extraction results are SAVED to .state/extracted/.
 */
export function useDocumentChunks(workspace: string, wiki: string | undefined, refreshKey = 0): string[] | null {
  const [chunks, setChunks] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!wiki) {
      setChunks(null);
      return;
    }

    (async () => {
      try {
        const entries = await readdir(join(workspace, 'wikis', wiki, 'documents'));
        const chunkIds = entries
          .filter((name) => name.toLowerCase().endsWith('.md'))
          .map((name) => name.replace(/\.md$/i, ''))
          .sort();
        if (!cancelled) {
          setChunks(chunkIds);
        }
      } catch {
        if (!cancelled) {
          setChunks([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace, wiki, refreshKey]);

  return chunks;
}
