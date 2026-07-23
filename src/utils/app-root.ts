import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Application root — the folder that owns prompts/, templates/, and
 * node_modules/pdfjs-dist/standard_fonts/.
 *
 * Three run modes resolve to the same root:
 *  1. Dev (tsx) / tests (vitest): this module is src/utils/app-root.ts and
 *     the project root is found by walking up to the nearest package.json.
 *  2. Dev bundle / launcher child (node dist/chase.mjs): the esbuild bundle's
 *     import.meta points at its dist/ directory, so the same walk-up lands
 *     on the nearest package.json (the launcher stages a minimal one in the
 *     runtime dir — see scripts/launcher-entry.ts).
 *  3. Packaged exe (pkg): process.pkg is set and the bundle lives at
 *     <snapshotRoot>/dist/ in pkg's virtual filesystem; the root is one level
 *     up. Reads of declared pkg assets (prompts/, templates/, the pdfjs
 *     standard fonts, dist/pdf.worker.cjs) work transparently there.
 *
 * Everything user-facing (workspace wikis/, .env, .paper-chase.json) stays
 * cwd-based and never touches this root.
 */

// __dirname is a CJS-only global. Shadow the Node ambient type so the
// ESM-undefined case stays explicit.
declare const __dirname: string | undefined;

/** True when running inside a pkg-packaged executable. */
export function isPackaged(): boolean {
  return typeof (process as unknown as { pkg?: unknown }).pkg !== 'undefined';
}

function moduleDir(): string {
  if (import.meta.url) {
    return dirname(fileURLToPath(import.meta.url));
  }
  // CJS bundle: import.meta is empty; __dirname is the bundle's directory.
  if (typeof __dirname === 'string') {
    return __dirname;
  }
  return process.cwd();
}

let cachedRoot: string | undefined;

/** Absolute path of the application root (see the module comment). */
export function appRoot(): string {
  if (cachedRoot !== undefined) {
    return cachedRoot;
  }
  if (isPackaged()) {
    // <snapshotRoot>/dist/<entry> -> <snapshotRoot>
    cachedRoot = resolve(moduleDir(), '..');
    return cachedRoot;
  }
  let dir = moduleDir();
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) {
      cachedRoot = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      // Defensive fallback: no package.json above; keep cwd-based behavior.
      cachedRoot = process.cwd();
      return cachedRoot;
    }
    dir = parent;
  }
}
