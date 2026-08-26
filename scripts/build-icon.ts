/**
 * build-icon.ts — regenerates assets/icon.ico from assets/icon.svg + assets/icon-small.svg.
 *
 * Zero npm dependencies (this build machine has no standalone Node/npm on PATH — see
 * assets/AGENTS.md): SVG rasterization is done by headless Chrome/Edge (transparency via
 * --default-background-color=00000000) and the multi-size .ico is packed by hand
 * (ICONDIR + ICONDIRENTRY + embedded PNG frames, the Vista+ PNG-compressed ico form).
 *
 * Run (via the project tsx, or any node with tsx):  npx tsx scripts/build-icon.ts
 * The .ico output is committed; this script is only needed when the SVG sources change.
 * Also writes throwaway review previews (512px + pixelated small-size strip) to the OS
 * temp dir and prints their paths.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ICON_SVG = path.join(ROOT, 'assets', 'icon.svg')
const SMALL_SVG = path.join(ROOT, 'assets', 'icon-small.svg')
const OUT_ICO = path.join(ROOT, 'assets', 'icon.ico')

// 32px and up use the full design; 24/16px use the simplified variant for legibility
const FRAMES: Array<{ size: number; svg: string }> = [
  { size: 256, svg: ICON_SVG },
  { size: 128, svg: ICON_SVG },
  { size: 64, svg: ICON_SVG },
  { size: 48, svg: ICON_SVG },
  { size: 32, svg: ICON_SVG },
  { size: 24, svg: SMALL_SVG },
  { size: 16, svg: SMALL_SVG },
]

if (process.platform !== 'win32') {
  console.error('[build-icon] this pipeline is Windows-only (exe icon for paper-chase.exe)')
  process.exit(1)
}
for (const f of [ICON_SVG, SMALL_SVG]) {
  if (!existsSync(f)) throw new Error(`missing ${path.relative(ROOT, f)}`)
}

function findBrowser(): string {
  const candidates: string[] = []
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH)
  candidates.push(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  )
  for (const base of [
    'C:\\Program Files (x86)\\Microsoft\\EdgeCore',
    'C:\\Program Files\\Microsoft\\EdgeCore',
  ]) {
    if (existsSync(base)) {
      for (const entry of readdirSync(base)) {
        const p = path.join(base, entry, 'msedge.exe')
        if (existsSync(p)) candidates.push(p)
      }
    }
  }
  const found = candidates.find(existsSync)
  if (!found) {
    throw new Error('no Chrome/Edge found — set CHROME_PATH to a Chromium browser executable')
  }
  return found
}

const BROWSER = findBrowser()
const WORK = path.join(tmpdir(), 'paper-chase-build-icon')

/** Rasterize an SVG (or PNG) at an exact pixel size via a headless screenshot. */
function shoot(src: string, out: string, size: number): void {
  const htmlName = `page-${path.basename(src, '.svg')}-${size}.html`
  const htmlPath = path.join(WORK, htmlName)
  writeFileSync(
    htmlPath,
    `<html><head><style>html,body{margin:0;padding:0;background:transparent}img{display:block}</style></head>` +
      `<body><img src="${src.replace(/\\/g, '/')}" width="${size}" height="${size}"></body></html>`,
  )
  const profile = path.join(WORK, `profile-${size}-${path.basename(src)}`)
  const res = spawnSync(
    BROWSER,
    [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--user-data-dir=${profile}`,
      `--screenshot=${out}`,
      `--window-size=${size},${size}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`,
    ],
    { stdio: 'pipe', encoding: 'utf8', windowsHide: true },
  )
  rmSync(profile, { recursive: true, force: true })
  if (res.status !== 0 || !existsSync(out)) {
    throw new Error(`headless screenshot failed at ${size}px (status ${res.status}): ${res.stderr}`)
  }
  const png = readFileSync(out)
  if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size || png[25] !== 6) {
    throw new Error(`unexpected PNG output at ${size}px (not ${size}x${size} RGBA)`)
  }
}

/** Pack PNG frames into a multi-size .ico (PNG-compressed frames, Vista+). */
function packIco(frames: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(frames.length, 4)
  const entries = Buffer.alloc(16 * frames.length)
  let offset = header.length + entries.length
  frames.forEach((f, i) => {
    const e = 16 * i
    entries[e] = f.size >= 256 ? 0 : f.size // width (0 = 256)
    entries[e + 1] = f.size >= 256 ? 0 : f.size // height
    entries[e + 2] = 0 // palette colors
    entries[e + 3] = 0 // reserved
    entries.writeUInt16LE(1, e + 4) // color planes
    entries.writeUInt16LE(32, e + 6) // bits per pixel
    entries.writeUInt32LE(f.png.length, e + 8)
    entries.writeUInt32LE(offset, e + 12)
    offset += f.png.length
  })
  return Buffer.concat([header, entries, ...frames.map((f) => f.png)])
}

function main(): void {
  rmSync(WORK, { recursive: true, force: true })
  mkdirSync(WORK, { recursive: true })

  const rendered: Array<{ size: number; png: Buffer; pngPath: string }> = []
  for (const frame of FRAMES) {
    const out = path.join(WORK, `icon-${frame.size}.png`)
    shoot(path.relative(WORK, frame.svg).replace(/\\/g, '/'), out, frame.size)
    rendered.push({ size: frame.size, png: readFileSync(out), pngPath: out })
    console.log(`[build-icon] rendered ${frame.size}px from ${path.relative(ROOT, frame.svg)}`)
  }

  writeFileSync(OUT_ICO, packIco(rendered.map(({ size, png }) => ({ size, png }))))
  console.log(`[build-icon] wrote ${path.relative(ROOT, OUT_ICO)} (${FRAMES.map((f) => f.size).join('/')} px)`)

  // Review previews: full-size render + honest pixelated look at the small ico frames
  const preview512 = path.join(WORK, 'preview-512.png')
  shoot(path.relative(WORK, ICON_SVG).replace(/\\/g, '/'), preview512, 512)

  const cells = [16, 24, 32, 48]
    .map((size) => {
      const r = rendered.find((x) => x.size === size)!
      const up = size * 8
      return `<div style="text-align:center"><img src="icon-${size}.png" style="width:${up}px;height:${up}px;image-rendering:pixelated">` +
        `<div style="font:14px sans-serif;color:#333;margin-top:8px">${size}px (shown x8)</div></div>`
    })
    .join('')
  writeFileSync(
    path.join(WORK, 'strip.html'),
    `<html><head><style>html,body{margin:0;padding:0;background:#fff}.row{display:flex;align-items:flex-end;gap:28px;padding:24px}</style></head>` +
      `<body><div class="row">${cells}</div></body></html>`,
  )
  const strip = path.join(WORK, 'preview-strip.png')
  const res = spawnSync(
    BROWSER,
    [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--window-size=1100,460',
      `--user-data-dir=${path.join(WORK, 'profile-strip')}`,
      `--screenshot=${strip}`,
      `file:///${path.join(WORK, 'strip.html').replace(/\\/g, '/')}`,
    ],
    { stdio: 'pipe', encoding: 'utf8', windowsHide: true },
  )
  rmSync(path.join(WORK, 'profile-strip'), { recursive: true, force: true })
  if (res.status !== 0) throw new Error(`strip screenshot failed: ${res.stderr}`)
  console.log(`[build-icon] previews (temp, for review only):\n  ${preview512}\n  ${strip}`)
}

main()
