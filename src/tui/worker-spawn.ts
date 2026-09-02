import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot, isPackaged } from '../utils/app-root';

/**
 * Phase 27 (§2.4, vision `04` §1 Worker-process isolation amendment):
 * resolve the executable + base argv that re-enters THIS application as a
 * headless `ingest-worker` child. Three run modes (the app-root precedent):
 *
 *  1. Dev (tsx / vitest): the local Node + `node_modules/tsx/dist/cli.mjs`
 *     + `src/cli.ts` (the bin/chase.js pattern — args array, no shell).
 *  2. Launcher child (node dist/chase.mjs — the packaged TUI): the runtime
 *     Node (`process.execPath`, staged by the launcher) + the staged bundle
 *     `<appRoot>/dist/chase.mjs`.
 *  3. pkg raw exe: re-exec the exe itself (`process.execPath` + no base
 *     args) — the worker is headless, so pkg's ink/render limitation does
 *     not apply (CLI subcommands work under pkg).
 *
 * `PAPER_CHASE_WORKER_CMD` overrides the executable outright (tests pass a
 * stub script; it still receives the same argv after the base args).
 *
 * A mode whose entry files are missing throws BEFORE the first spawn — a
 * mis-extracted runtime must fail fast as a configuration error, never as a
 * mid-run worker crash loop.
 */

export interface WorkerCommand {
  command: string;
  /** Arguments placed before the subcommand args (entry resolution). */
  baseArgs: string[];
}

/** Test/ops override: executable path replacing the resolved command. */
export const WORKER_CMD_ENV = 'PAPER_CHASE_WORKER_CMD';

export function resolveWorkerCommand(rootOverride?: string): WorkerCommand {
  const override = process.env[WORKER_CMD_ENV];
  if (override !== undefined && override.length > 0) {
    return { command: override, baseArgs: [] };
  }
  if (isPackaged()) {
    // pkg raw exe: argv re-enters the same executable's CLI parser.
    return { command: process.execPath, baseArgs: [] };
  }
  const root = rootOverride ?? appRoot();
  const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const srcCli = join(root, 'src', 'cli.ts');
  if (existsSync(tsxCli) && existsSync(srcCli)) {
    return { command: process.execPath, baseArgs: [tsxCli, srcCli] };
  }
  const bundle = join(root, 'dist', 'chase.mjs');
  if (existsSync(bundle)) {
    // Launcher child mode: process.execPath IS the staged runtime node.
    return { command: process.execPath, baseArgs: [bundle] };
  }
  throw new Error(
    `Worker entry not found: no tsx/src CLI at ${srcCli} and no bundle at ${bundle}. ` +
      'The packaging runtime may be stale — re-run the app installer or rebuild.',
  );
}
