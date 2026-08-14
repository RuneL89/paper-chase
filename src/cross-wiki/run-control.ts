import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { callLLM } from '../llm/client';
import {
  CROSS_WIKI_SMALL_MAX_TOKENS,
  renderCrossWikiPrompt,
  type CrossWikiLanguage,
} from './llm';
import { readCrossWikiState, writeCrossWikiState } from './state';
import { listWorkspaceWikis } from './workspace-scan';
import { existsSync } from 'node:fs';

/**
 * Phase 24 §2.8 (user decision 2026-08-09 #12): the cross-wiki run-control.
 * A deterministic fingerprint of the workspace — wiki membership plus every
 * entity/topic content page's hash — is stored in
 * `.state/cross-wiki/run-fingerprint.json` after each full pass. Before
 * Components A–G run, the preflight compares the current workspace against
 * the fingerprint:
 *
 *   - fewer than two wikis                       → skip (the pass needs ≥2)
 *   - no fingerprint / artifacts never built     → run
 *   - wiki membership changed                    → run
 *   - entity/topic pages changed                 → run (see the probe below)
 *   - nothing changed                            → SKIP the entire pass
 *
 * When the changes are confined to exactly ONE wiki (they look local), an
 * optional cheap-LLM relevance probe judges whether the change could affect
 * cross-wiki discovery; a `not-relevant` verdict skips the full pass and
 * updates the fingerprint.
 */

export interface RunFingerprint {
  version: 1;
  recordedAt: string;
  /** Sorted member wiki slugs. */
  wikis: string[];
  /** '<wiki>/<wiki-relative path>' → content hash + stat. */
  pages: Record<string, { sha256: string; mtimeMs: number; size: number }>;
}

export type PreflightDecision =
  | { action: 'skip'; reason: 'fewer-than-two-wikis' | 'unchanged' }
  | { action: 'run'; reason: 'never-built' | 'membership-changed' | 'pages-changed' | 'forced' }
  | { action: 'probe'; reason: 'local-changes'; changedWikis: string[]; changedPages: string[] };

async function hashFile(absolute: string): Promise<string> {
  return createHash('sha256').update(await readFile(absolute)).digest('hex');
}

async function collectPages(workspace: string, wiki: string, out: Record<string, { sha256: string; mtimeMs: number; size: number }>): Promise<void> {
  for (const folder of ['entities', 'topics']) {
    const root = join(workspace, 'wikis', wiki, folder);
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const absolute = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name.toLowerCase() !== 'index.md') {
          // DOX folder indexes regenerate every run (fresh `updated:`), so they
          // are excluded — only CONTENT pages count for change detection.
          const rel = relative(join(workspace, 'wikis'), absolute).replace(/\\/g, '/');
          const stats = await stat(absolute);
          out[rel] = { sha256: await hashFile(absolute), mtimeMs: stats.mtimeMs, size: stats.size };
        }
      }
    };
    await walk(root);
  }
}

/** Compute the current workspace fingerprint (member wikis + content-page hashes). */
export async function computeRunFingerprint(workspace: string = '.'): Promise<RunFingerprint> {
  const wikis = await listWorkspaceWikis(workspace);
  const pages: RunFingerprint['pages'] = {};
  for (const wiki of wikis) {
    await collectPages(workspace, wiki, pages);
  }
  const sortedPages = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
  return { version: 1, recordedAt: new Date().toISOString(), wikis, pages: sortedPages };
}

/** Persist the fingerprint after a full pass (or a probe-skipped pass). */
export async function writeRunFingerprint(workspace: string, fingerprint: RunFingerprint): Promise<void> {
  await writeCrossWikiState(workspace, 'run-fingerprint.json', fingerprint);
}

/** Read the recorded fingerprint (null when absent/malformed). */
export async function readRunFingerprint(workspace: string): Promise<RunFingerprint | null> {
  const data = await readCrossWikiState<RunFingerprint>(workspace, 'run-fingerprint.json');
  if (data === null || typeof data !== 'object' || !Array.isArray(data.wikis) || typeof data.pages !== 'object' || data.pages === null) {
    return null;
  }
  return data;
}

/** True when the cross-wiki artifact set has been built at least once. */
export function crossWikiArtifactsExist(workspace: string): boolean {
  return existsSync(join(workspace, 'wikis', 'cross-wiki', 'index.md'));
}

/**
 * Evaluate the deterministic preflight against the CURRENT workspace state.
 * `current` is the freshly-computed fingerprint (passed in so the caller can
 * persist it after a run/skip decision).
 */
export async function preflightDecision(workspace: string, current: RunFingerprint): Promise<PreflightDecision> {
  if (current.wikis.length < 2) {
    return { action: 'skip', reason: 'fewer-than-two-wikis' };
  }
  const recorded = await readRunFingerprint(workspace);
  if (recorded === null || !crossWikiArtifactsExist(workspace)) {
    return { action: 'run', reason: 'never-built' };
  }
  const recordedWikis = [...recorded.wikis].sort((a, b) => a.localeCompare(b));
  if (recordedWikis.length !== current.wikis.length || recordedWikis.some((wiki, index) => wiki !== current.wikis[index])) {
    return { action: 'run', reason: 'membership-changed' };
  }
  const changedPages: string[] = [];
  const recordedPages = recorded.pages;
  const currentPaths = new Set(Object.keys(current.pages));
  for (const [path, entry] of Object.entries(current.pages)) {
    const previous = recordedPages[path];
    if (previous === undefined || previous.sha256 !== entry.sha256) {
      changedPages.push(path);
    }
  }
  for (const path of Object.keys(recordedPages)) {
    if (!currentPaths.has(path)) {
      changedPages.push(path);
    }
  }
  if (changedPages.length === 0) {
    return { action: 'skip', reason: 'unchanged' };
  }
  const changedWikis = Array.from(new Set(changedPages.map((path) => path.split('/')[0]))).sort((a, b) =>
    a.localeCompare(b),
  );
  if (changedWikis.length === 1) {
    return { action: 'probe', reason: 'local-changes', changedWikis, changedPages: changedPages.sort() };
  }
  return { action: 'run', reason: 'pages-changed' };
}

// ---------------------------------------------------------------------------
// Cheap-LLM relevance probe (phase doc §2.8 step 2 — optional but recommended)
// ---------------------------------------------------------------------------

export interface ChangedPageSummary {
  path: string;
  title: string;
  summary: string;
}

export type RelevanceProbeFn = (
  changes: ChangedPageSummary[],
  feedback: string | undefined,
  attempt: number,
) => Promise<string>;

export interface RelevanceProbeOptions {
  language?: CrossWikiLanguage;
  logPath?: string;
  relevanceProbeFn?: RelevanceProbeFn;
}

/**
 * The relevance probe: one batched cheap call over the changed pages' titles
 * and summaries. Returns true when the change could affect cross-wiki
 * discovery (`relevant`), false when it is obviously local (`not-relevant`).
 * A probe failure answers `relevant` (the full pass runs — fail-open keeps
 * the artifacts fresh; the pass itself stays fault-tolerant).
 */
export async function relevanceProbe(
  changes: ChangedPageSummary[],
  options: RelevanceProbeOptions = {},
): Promise<boolean> {
  const runLlm = options.relevanceProbeFn;
  let raw: string;
  if (runLlm !== undefined) {
    raw = await runLlm(changes, undefined, 1);
  } else {
    const prompt = await renderCrossWikiPrompt(
      'cross-wiki-relevance-probe.prompt.txt',
      {
        changes: changes
          .map((change) => `- ${change.path} — ${change.title}: ${change.summary}`)
          .join('\n'),
      },
      options.language,
    );
    raw = await callLLM(prompt, undefined, {
      maxTokens: CROSS_WIKI_SMALL_MAX_TOKENS,
      maxRetries: 2,
      callType: 'cross-wiki-relevance-probe',
      context: `cross-wiki relevance probe (${changes.length} changed pages)`,
      logPath: options.logPath,
    });
  }
  return !/not-relevant/i.test(raw.trim());
}
