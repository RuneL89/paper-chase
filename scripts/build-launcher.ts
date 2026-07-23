/**
 * Assembly step for the launcher exe (`npm run package:win`), compliance-log
 * entry [2026-07-23 03:52].
 *
 * Requires `npm run build` first (produces dist/chase.mjs and
 * dist/pdf.worker.cjs). Stages the remaining runtime files the launcher
 * embeds as pkg assets — the ESM pdf.js worker (loaded by the child's fake
 * worker via pdf.js's default relative import) and a real Node executable
 * (the build machine's own, matching the bundle's node22 target) — then
 * bundles scripts/launcher-entry.ts to plain CJS (pkg's most mature mode;
 * no ESM transform, no top-level await anywhere in the launcher).
 *
 * Run via tsx, never imported by src/ or tests/.
 */
import { copyFileSync } from 'node:fs';
import { buildSync } from 'esbuild';

// ESM worker for the launcher child (real Node, default pdf.js resolution).
copyFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', 'dist/pdf.worker.mjs');
// Real Node runtime for the launcher child.
copyFileSync(process.execPath, 'dist/runtime-node.exe');

buildSync({
  entryPoints: ['scripts/launcher-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: 'dist/launcher.cjs',
  logLevel: 'info',
});

console.log('Staged dist/pdf.worker.mjs, dist/runtime-node.exe; built dist/launcher.cjs');
