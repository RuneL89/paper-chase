# assets/ — DOX contract

## Purpose

Committed build assets for the Windows packaging icon (the `paper-chase.exe` app icon).

## Ownership

* `icon.svg` — the full icon design: paper stack → wiki link-graph, phosphor green on a dark rounded terminal plate; used for the 32/48/64/128/256 px ico frames
* `icon-small.svg` — the simplified small-size variant (thicker strokes, fewer nodes, lighter sheet tones); used for the 16/24 px ico frames
* `icon.ico` — GENERATED multi-size ico (16/24/32/48/64/128/256) packed from the two SVGs by `scripts/build-icon.ts`; committed, never hand-edited

## Local Contracts

* The design concept (paper stack → wiki, terminal-green palette, rounded plate) is user-approved 2026-08-24; the SVGs change only after showing a new preview for approval
* `icon.ico` is regenerated with `npx tsx scripts/build-icon.ts` whenever the SVGs change. The pipeline is dependency-free on purpose: this build machine has no standalone npm on PATH (verified 2026-08-24), so the SVGs are rasterized by headless Chrome/Edge and the ico is packed by a hand-rolled packer — do not rewrite `build-icon.ts` around npm-only tooling
* Vendored build tooling is NOT here — `rcedit-x64.exe` lives under `scripts/vendor/` (see `scripts/AGENTS.md`)

## Work Guidance

## Verification

* `build-icon.ts` verifies every rendered frame is exactly the requested pixel size and RGBA before packing it
* The final exe's icon is verified by extracting it from `dist/paper-chase.exe` (`Icon.ExtractAssociatedIcon`) and pixel-comparing the 32 px frame against the packed PNG (0 mismatches required)

## Child DOX Index

No child folders.
