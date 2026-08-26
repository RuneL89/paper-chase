/**
 * set-icon.ts — packaging step 3: patch the app icon into dist/paper-chase.exe.
 *
 * @yao-pkg/pkg has no icon support, so the icon is applied post-build with the
 * vendored rcedit (scripts/vendor/rcedit-x64.exe — committed; this build machine
 * has no standalone npm to install @electron/rcedit). The .ico is a committed
 * asset (assets/icon.ico, regenerated from the SVGs by scripts/build-icon.ts).
 *
 * CRITICAL: rcedit rewrites the PE and DROPS pkg's appended payload overlay
 * (the snapshot with all extracted assets) — a bare `rcedit --set-icon` leaves
 * the exe ~57 MB instead of ~190 MB and it dies on first run with
 * "Pkg: Error reading from file." Worse, pkg bakes PAYLOAD_POSITION (its own
 * section-table end) into the prelude at build time, so the payload must be
 * restored at the ORIGINAL offset. This script therefore captures the overlay,
 * runs rcedit, pads zeros over the section-table gap rcedit's re-packing
 * leaves, and re-appends the overlay at the original baked position — the
 * final file keeps the fresh pkg output's exact byte size (verified
 * empirically 2026-08-24: payload-at-rewritten-end exes boot degraded and
 * "extract" live project files instead of the snapshot).
 *
 * Runs on a FRESH pkg output only (which is always the case inside
 * `npm run package:win`); don't re-run it on an already-patched exe.
 *
 * Run (via the project tsx, or any node with tsx):  npx tsx scripts/set-icon.ts
 * Called automatically at the end of `npm run package:win`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = path.join(ROOT, 'dist', 'paper-chase.exe')
const ICON = path.join(ROOT, 'assets', 'icon.ico')
const RCEDIT = path.join(ROOT, 'scripts', 'vendor', 'rcedit-x64.exe')

if (process.platform !== 'win32') {
  console.error('[set-icon] this step is Windows-only (PE resources on paper-chase.exe)')
  process.exit(1)
}
for (const [label, p] of [
  ['paper-chase.exe', TARGET],
  ['assets/icon.ico', ICON],
  ['scripts/vendor/rcedit-x64.exe', RCEDIT],
] as const) {
  if (!existsSync(p)) {
    console.error(
      `[set-icon] ${label} missing (${path.relative(ROOT, p)})` +
        (label === 'assets/icon.ico' ? ' — run `npx tsx scripts/build-icon.ts` first' : ''),
    )
    process.exit(1)
  }
}

/** End of the last PE section's raw data (the pkg payload overlay starts here). */
function lastRawEnd(buf: Buffer): number {
  const eLfanew = buf.readUInt32LE(0x3c)
  if (buf.toString('ascii', eLfanew, eLfanew + 4) !== 'PE\x00\x00') {
    throw new Error('not a PE file (missing PE signature)')
  }
  const sectionCount = buf.readUInt16LE(eLfanew + 6)
  const optSize = buf.readUInt16LE(eLfanew + 20)
  let end = 0
  for (let i = 0; i < sectionCount; i++) {
    const s = eLfanew + 24 + optSize + i * 40
    const rawSize = buf.readUInt32LE(s + 16)
    const rawAddr = buf.readUInt32LE(s + 20)
    end = Math.max(end, rawAddr + rawSize)
  }
  return end
}

const original = readFileSync(TARGET)
const originalEnd = lastRawEnd(original)
const overlay = original.subarray(originalEnd)
if (overlay.length === 0) {
  console.error(
    '[set-icon] paper-chase.exe has no pkg payload overlay to preserve — refusing to patch (bare rcedit would break the exe)',
  )
  process.exit(1)
}

const res = spawnSync(RCEDIT, [TARGET, '--set-icon', ICON], {
  stdio: 'pipe',
  encoding: 'utf8',
  windowsHide: true,
})
if (res.status !== 0) {
  console.error(`[set-icon] rcedit failed (exit ${res.status}):\n${res.stderr || res.stdout}`)
  process.exit(1)
}

// rcedit dropped the overlay AND re-packed the sections (its rewrite ends the
// last section earlier than pkg's output did). The pkg bootstrap reads the
// payload at PAYLOAD_POSITION — a literal BAKED into the prelude at pkg build
// time (pkg's own original section end), not derived from the rewritten table.
// So pad the gap with zeros and re-append the overlay at the ORIGINAL offset;
// the final file keeps the fresh pkg output's exact size.
const patched = readFileSync(TARGET)
const patchedEnd = lastRawEnd(patched)
if (patchedEnd > originalEnd) {
  console.error(
    `[set-icon] rcedit grew the sections past the pkg payload position (${patchedEnd} > ${originalEnd}) — refusing to patch`,
  )
  process.exit(1)
}
writeFileSync(TARGET, Buffer.concat([patched, Buffer.alloc(originalEnd - patchedEnd), overlay]))
console.log(
  `[set-icon] icon applied to ${path.relative(ROOT, TARGET)} ` +
    `(payload ${overlay.length} bytes restored at baked position ${originalEnd}; size ${originalEnd + overlay.length} == pkg output)`,
)
