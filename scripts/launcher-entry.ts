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
// 1.0.5 (2026-07-29): Phase 18 synthesis prompt changes (the
// === CITATION KEYS === section + {citationMap} slot in all four synthesis
// prompts) — all four are extracted assets.
// 1.0.6 (2026-07-29): Phase 21 curation prompt changes (the PROPOSED PAIRS
// section + confirm/deny pairs output in curation-entities.prompt.txt and
// curation-topics.prompt.txt) — both are extracted assets.
// 1.0.7 (2026-07-29): Phase 22 — the two NEW composite synthesis prompts
// (composite.prompt.txt + composite-permissive.prompt.txt) and the
// PROPOSED CLUSTERS section in curation-entities.prompt.txt — all three are
// extracted assets (covered by the "prompts/**/*" asset glob in
// pkg.config.launcher.json and pkg.config.json).
// 1.0.9 (2026-08-04): Built-in OpenAI/Qwen now send `max_tokens` instead of
// `max_completion_tokens` (src/llm/client.ts bundle change), so the packaged
// runtime must re-extract assets on first run.
// 1.0.10 (2026-08-04): Test-connection probe raised from 1 to 16 tokens
// (src/llm/client.ts bundle change) so Anthropic Sonnet/Opus return text.
// 1.0.11 (2026-08-10): Phase 24 — the seven NEW cross-wiki discovery prompts
// (cross-wiki-entity-context, -entity-match, -entity-uncertain-review,
// -predicate-normalize, -topic-cluster, -hypothesis, -relevance-probe) plus
// the client.ts mid-tier call-type mapping (bundle change) — the prompts are
// extracted assets covered by the "prompts/**/*" glob in both pkg configs.
// 1.0.12 (2026-08-10): Phase 24 cross-wiki model routing Option B — added
// Cross-Wiki Bulk / Judgment model rows in Settings (src/tui/settings-screen.tsx
// + settings.ts bundle change) and the client.ts routing slots. The packaged
// runtime must re-extract so users see the new Settings rows.
// 1.0.13 (2026-08-14): Phase 24 `--force-cross-wiki` CLI flag + TUI `F`
// toggle (src/cli.ts and src/tui/ingest-screen.tsx bundle change). The
// packaged runtime must re-extract so users see the new flag and toggle.
// 1.0.16 (2026-08-20): Phase 16 v1.1.0 extraction transport fallback build —
// rolled back the same day (never a release).
// 1.0.17 (2026-08-20): ROLLBACK release — src/commands/ingest.ts returns to the
// pre-amendment extraction loop (per-chunk transport fallback removed), while
// src/llm/client.ts KEEPS the option-3 changes (attempt count in exhausted
// transport errors + Retry-After honoring on 429). The bundle is an extracted
// asset: installs that extracted the prior release must re-extract to drop the
// rejected fallback and gain Retry-After honoring.
// 1.0.18 (2026-08-20): Phase 16 v1.0.2 reactive 429 stall — the client bundle
// gains the stall (RATE_LIMIT_MAX_ATTEMPTS + rateLimitStallDelayMs) and the
// setRateLimitWaitReporter seam, and ingest.ts gains the reporter-wiring
// wrapper. The bundle is an extracted asset: installs must re-extract to get
// the stall behavior and the live stall progress lines.
// 1.0.20 (2026-08-22): Phase 16 v1.0.3/v1.0.4 — the Settings bundle
// (src/llm/client.ts, src/tui/settings.ts, src/tui/settings-screen.tsx,
// src/commands/ingest.ts) gains the 429/5xx stall ladder (1/5/15/45/90 min;
// TRANSIENT_MAX_ATTEMPTS/transientStallDelayMs/setStallWaitReporter) and the
// 429/5xx stall audit log (`.state/transport-stalls.jsonl` per wiki). The
// packaged runtime must re-extract so users get stall ladder behavior and
// auditable stall records.
// 1.0.22 (2026-08-23): Phase 16 v1.0.5 — the NEW prompts/json-corrector.prompt.txt
// (an extracted asset via the "prompts/**/*" glob) and the bundle gains the
// JSON-corrector recovery loop (src/llm/json-corrector.ts + the reask
// feedbackEnhancer + the extractor/curation/cross-wiki wiring), the
// per-attempt absolute deadline + Retry-After clamp + finish-reason tap
// (src/llm/client.ts), and the JSON Corrector Model Settings row
// (src/tui/settings.ts + settings-screen.tsx). The packaged runtime must
// re-extract so users get the new prompt file and the new Settings row.
// 1.0.23 (2026-08-24): Create New Wiki folder picker (user directive) — the
// bundle gains the NEW src/utils/folder-dialog.ts (native FolderBrowserDialog)
// and the init-screen changes (the [ Browse... ] stop + the always-on
// resolved-target breadcrumb in src/tui/init-screen.tsx). The packaged runtime
// must re-extract so users see the folder picker and the breadcrumb.
// 1.0.24 (2026-08-25): DeepSeek/Zhipu/GLM built-in providers removed from the
// Settings bundle (src/llm/client.ts, src/tui/settings.ts,
// src/tui/settings-screen.tsx). The packaged runtime must re-extract so
// installed runtimes drop the removed provider rows, catalogs, and API-key
// fields.
// 1.0.25 (2026-08-26): DeepSeek/Zhipu/GLM built-in providers restored and
// Qwen 3.8 Flash + GLM-5.3-Flash added as selectable Sonnet-tier models in
// the Settings bundle. The packaged runtime must re-extract so installed
// runtimes restore the provider rows/catalogs/API-key fields and show the
// new model choices.
// 1.0.26 (2026-08-27): Phase 25 — the NEW prompts/disambiguation.prompt.txt
// (an extracted asset via the same prompts/**/* globs in both pkg configs)
// plus the disambiguation bundle (src/agents/disambiguation.ts, the
// materializer detection/sticky pass, src/agents/pre-merge.ts, the
// curation-decisions sourceMap, the class-6 composite writers, the schema
// validator, the client.ts 'disambiguate' curation-slot routing). The
// packaged runtime must re-extract so the generic-label disambiguation pass
// can load its prompt.
// 1.0.27 (2026-08-27): Phase 26 — the NEW prompts/amendment.prompt.txt (an
// extracted asset via the same prompts/**/* globs in both pkg configs) plus
// the amendment bundle (src/agents/amendment.ts, src/llm/patch.ts,
// src/state/amendment-log.ts, the ingest.ts per-PDF loop restructure, the
// materializer evidence-key exports, the synthesis-state baselineKeys/
// pageKind extension, the client.ts 'synthesis-amend' routing). The packaged
// runtime must re-extract so the per-PDF patch-amendment pass can load its
// prompt.
const VERSION = '1.0.27';

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
