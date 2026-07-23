/**
 * Windows .exe packaging build (user request 2026-07-23; ad-hoc packaging,
 * compliance-log entry [2026-07-23 03:52]).
 *
 * Step 1 of `npm run package:win`: bundles scripts/exe-entry.ts (a
 * side-effect-only wrapper around src/cli.ts) into a single ESM file — pkg
 * 6.x supports ESM entries and transforms top-level await (ink's yoga-layout
 * requires it), while the project's bin/chase.js launcher spawns an external
 * tsx and can never work inside a packaged binary. Also bundles the
 * self-contained pdf.js worker to CJS — the packaged exe require()s it so
 * globalThis.pdfjsWorker registers and the fake worker's dynamic import()
 * (unsupported under pkg) is skipped (see src/extraction/pdf.ts).
 * Step 2 is the pkg invocation in the package.json `package:win` script.
 *
 * Run via `npm run build` (tsx), never imported by src/ or tests/.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSync } from 'esbuild';

mkdirSync('dist', { recursive: true });

buildSync({
  entryPoints: ['scripts/exe-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/chase.mjs',
  // ink statically imports the optional react-devtools-core inside its
  // devtools module. The package is not installed and ink probes for it
  // behind a try-guarded import.meta.resolve, so a stub alias satisfies the
  // static import without shipping the real devtools backend.
  alias: { 'react-devtools-core': resolve('scripts/react-devtools-core-stub.js') },
  // CJS dependencies (commander, react, ...) keep runtime require() calls in
  // an ESM bundle; esbuild's __require shim delegates to a real require when
  // one is in scope (esbuild FAQ fix for "Dynamic require of X is not
  // supported").
  banner: {
    js: "import { createRequire as __paperChaseCreateRequire } from 'node:module';\nconst require = __paperChaseCreateRequire(import.meta.url);",
  },
  logLevel: 'info',
});

buildSync({
  entryPoints: ['node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: 'dist/pdf.worker.cjs',
  logLevel: 'info',
});

console.log('Built dist/chase.mjs and dist/pdf.worker.cjs');
