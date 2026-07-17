import { useEffect, useState } from 'react';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface WikiDetails {
  /** Number of PDFs in the wiki's raw/ folder; null while loading or on error. */
  pdfCount: number | null;
  /** Latest ingestedAt timestamp from .state/ingestion.json; null when never ingested. */
  lastIngest: string | null;
}

/**
 * Loads display details for one wiki: the number of PDFs in raw/ and the
 * most recent ingestion timestamp from `.state/ingestion.json`.
 * `refreshKey` re-triggers the load (bump it after running ingest).
 */
export function useWikiDetails(workspace: string, wiki: string | undefined, refreshKey = 0): WikiDetails {
  const [details, setDetails] = useState<WikiDetails>({ pdfCount: null, lastIngest: null });

  useEffect(() => {
    let cancelled = false;

    if (!wiki) {
      setDetails({ pdfCount: null, lastIngest: null });
      return;
    }

    (async () => {
      let pdfCount: number | null = null;
      let lastIngest: string | null = null;

      try {
        const entries = await readdir(join(workspace, 'wikis', wiki, 'raw'));
        pdfCount = entries.filter((name) => name.toLowerCase().endsWith('.pdf')).length;
      } catch {
        pdfCount = null;
      }

      try {
        const raw = await readFile(join(workspace, 'wikis', wiki, '.state', 'ingestion.json'), 'utf-8');
        const state = JSON.parse(raw) as { sources?: Record<string, { ingestedAt?: string }> };
        const timestamps = Object.values(state.sources ?? {})
          .map((source) => source.ingestedAt)
          .filter((value): value is string => typeof value === 'string');
        lastIngest = timestamps.length > 0 ? timestamps.sort()[timestamps.length - 1] : null;
      } catch {
        lastIngest = null;
      }

      if (!cancelled) {
        setDetails({ pdfCount, lastIngest });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace, wiki, refreshKey]);

  return details;
}
