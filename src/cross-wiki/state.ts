import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Phase 24: the workspace-level `.state/cross-wiki/` JSON mirrors (phase doc
 * §2 — entity summaries, entity registry, predicate map, relationship graph,
 * topic clusters, proposed signals, entity-match candidates, run fingerprint)
 * plus `.state/proposed-cross-wiki-matches.json`. All paths are relative to
 * the WORKSPACE root (the runtime workspace, not a wiki).
 */

/** Absolute path of a workspace-level cross-wiki state file. */
export function crossWikiStatePath(workspace: string | undefined, fileName: string): string {
  return join(workspace ?? '.', '.state', 'cross-wiki', fileName);
}

/** Absolute path of `.state/proposed-cross-wiki-matches.json`. */
export function proposedCrossWikiMatchesPath(workspace: string | undefined): string {
  return join(workspace ?? '.', '.state', 'proposed-cross-wiki-matches.json');
}

/** Write a JSON state file (creating `.state/cross-wiki/` if needed), trailing newline included. */
export async function writeCrossWikiState(workspace: string | undefined, fileName: string, data: unknown): Promise<void> {
  const path = crossWikiStatePath(workspace, fileName);
  await mkdir(join(workspace ?? '.', '.state', 'cross-wiki'), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Read a JSON state file; returns null when absent or malformed (never throws). */
export async function readCrossWikiState<T>(workspace: string | undefined, fileName: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(crossWikiStatePath(workspace, fileName), 'utf-8')) as T;
  } catch {
    return null;
  }
}

/** Write `.state/proposed-cross-wiki-matches.json` (creating `.state/` if needed). */
export async function writeProposedCrossWikiMatches(workspace: string | undefined, data: unknown): Promise<void> {
  const path = proposedCrossWikiMatchesPath(workspace);
  await mkdir(join(workspace ?? '.', '.state'), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
