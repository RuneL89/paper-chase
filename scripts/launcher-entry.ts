/**
 * paper-chase.exe launcher (Windows packaging, compliance-log entry
 * [2026-07-23 03:52]).
 *
 * Why a launcher: pkg's patched Node runtime segfaults inside
 * react-reconciler's commit path when ink renders (exhaustively isolated —
 * not yoga/WASM/stdio/MessageChannel/bytecode/JIT; plain Node runs the same
 * bundle flawlessly). So this small pkg executable — CLI-only, no ink, which
 * pkg runs fine — extracts a real Node runtime plus the esbuild app bundle
 * and assets to a version-stamped dir ONCE, then hands off to real Node,
 * which also gives ink a true TTY for the interactive TUI.
 *
 * Assets are read from the pkg snapshot (__dirname-relative) and extracted
 * to %LOCALAPPDATA%\paper-chase\runtime\<version> (tmpdir fallback). The
 * extraction is marker-guarded so a partial extract is always redone.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// Extraction-set version (NOT the app version): bump whenever the runtime
// asset set or layout changes so existing installs re-extract.
// 1.0.3 (2026-07-25): DOX Writer prompt navigation fix (complete index-chain
// catalogs) — the prompt is an extracted asset, so the marker guard must not
// reuse the stale 1.0.2 runtime.
// 1.0.4 (2026-07-28): Phase 17 entity-synthesis prompt changes (the
// {relatedEntities} slot + updated wikilink rule in synthesis.prompt.txt and
// synthesis-permissive.prompt.txt) — both are extracted assets.
const VERSION = '1.0.4';

/** Snapshot root: pkg assets are laid out project-relative (see pkg.config.launcher.json). */
const SNAPSHOT_ROOT = join(__dirname, '..');

/** [snapshot-relative source, runtime-relative destination] */
const FILES: ReadonlyArray<readonly [string, string]> = [
  ['dist/chase.mjs', 'dist/chase.mjs'],
  ['dist/pdf.worker.mjs', 'dist/pdf.worker.mjs'],
  ['dist/runtime-node.exe', 'node.exe'],
  ['templates/AGENTS.md', 'templates/AGENTS.md'],
];
const DIRS: ReadonlyArray<readonly [string, string]> = [
  ['prompts', 'prompts'],
  ['node_modules/pdfjs-dist/standard_fonts', 'node_modules/pdfjs-dist/standard_fonts'],
  // pdfjs's optional native canvas (present in dev): silences the four
  // startup warnings and restores the DOMMatrix/ImageData/Path2D polyfills.
  ['node_modules/@napi-rs/canvas', 'node_modules/@napi-rs/canvas'],
  ['node_modules/@napi-rs/canvas-win32-x64-msvc', 'node_modules/@napi-rs/canvas-win32-x64-msvc'],
];

function runtimeRoot(): string {
  const base = process.env.LOCALAPPDATA && existsSync(process.env.LOCALAPPDATA)
    ? process.env.LOCALAPPDATA
    : tmpdir();
  return join(base, 'paper-chase', 'runtime', VERSION);
}

function copyDirRecursive(srcRel: string, dstRel: string, root: string): void {
  const srcDir = join(SNAPSHOT_ROOT, srcRel);
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcSub = `${srcRel}/${entry.name}`;
    const dstSub = `${dstRel}/${entry.name}`;
    if (entry.isDirectory()) {
      copyDirRecursive(srcSub, dstSub, root);
    } else {
      const target = join(root, dstSub);
      if (!existsSync(target)) {
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(SNAPSHOT_ROOT, srcSub), target);
      }
    }
  }
}

const root = runtimeRoot();
const marker = join(root, '.extracted-ok');
if (!existsSync(marker)) {
  process.stderr.write(`Paper Chase: extracting runtime to ${root} (first run only)...\n`);
  mkdirSync(root, { recursive: true });
  try {
    for (const [srcRel, dstRel] of FILES) {
      const target = join(root, dstRel);
      if (!existsSync(target)) {
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(SNAPSHOT_ROOT, srcRel), target);
      }
    }
    for (const [srcRel, dstRel] of DIRS) {
      copyDirRecursive(srcRel, dstRel, root);
    }
    // The child's appRoot() walks up from dist/chase.mjs to this package.json.
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'paper-chase-runtime', type: 'module', private: true }, null, 2) + '\n',
    );
    writeFileSync(marker, new Date().toISOString() + '\n');
  } catch (err) {
    console.error(`Paper Chase: runtime extraction failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

const result = spawnSync(join(root, 'node.exe'), [join(root, 'dist', 'chase.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
});
if (result.error) {
  console.error(`Paper Chase: failed to launch runtime: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
