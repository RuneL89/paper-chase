Rewrite README.md as a lean, progressive-disclosure document: Introduction → high-level diagram with per-step explanations → detailed diagram with per-step explanations, ending with a short get-the-app pointer and the documentation map. All prose written through the humanizer process. The README assumes the paper-chase.exe TUI user.

## 1. Render the two diagrams to PNG

No npm on this machine (node only as the vendored `dist/runtime-node.exe`), so render via browser:

- Temp HTML harness (in %TEMP%, outside the repo) loading mermaid@11 from CDN, rendering both diagrams on white background: the high-level timeline and the swimlane state machine (exact sources finalized this session; User → Code → LLM band order, labeled diamonds).
- Browser-use skill: open harness, wait for render, screenshot each diagram element at 2x device scale.
- Save as `docs/images/pipeline-high-level-timeline.png` and `docs/images/pipeline-swimlane-state-machine.png` (kebab-case per root AGENTS.md docs rule).
- Verify by reading both PNGs back: lane order intact, diamond text readable, no clipped labels, dark readable text.
- Fallback: retry with pinned mermaid version; last resort, user exports from mermaid.live.

## 2. Keep the editable mermaid sources

Add `docs/diagrams/pipeline-high-level-timeline.mmd` + `docs/diagrams/pipeline-swimlane-state-machine.mmd` (the exact sources behind the PNGs) so future pipeline changes can re-render.

## 3. New README.md structure (diagrams-only core)

1. **Title + tagline** — unchanged.
2. **Introduction** — what Paper Chase is, a "what you get" bullet list (page types, citations, validation, incremental re-runs), local-first, one sentence telling the reader the next two sections zoom in with increasing detail.
3. **The pipeline at a glance** — the timeline PNG (descriptive alt + italic caption per existing image pattern), the [USER]/[CODE]/[LLM] legend line, then a per-step explanation of every step in the diagram, grouped as the diagram groups them: the trigger, the per-PDF loop steps (Chunk, Extract, Materialize, Synthesize/Amend, Checkpoint), the finalize steps (Validate, DOX, Workspace, Cross-Wiki, Updater, Persist). 1–3 plain sentences per step.
4. **The pipeline in detail** — the swimlane PNG + caption, the "how to read it" paragraph (bands = actors, left-to-right = time, diamonds = validation gates, loop-back arrows = retries), then per-step explanations grouped by phase: trigger; per-PDF (hash check/skip, chunking, Extractor with JSON-corrector + reask); materialize (aggregation, generic-label detection); disambiguation and composite write; curation; synthesize-vs-amend per changed page (patch vocabulary, preservation checks, fallbacks); checkpoint/resume; finalize (validation, DOX writer, workspace index, cross-wiki, updater, persist). Closes with the one-line guard-rail footnote (4xx abort, 429/5xx stall ladder, reask max 3, deadlines). Diagrams ship as-is including the Phase 26 amendment flow, no caveats.
5. **Getting the app** — one short paragraph: prebuilt exe in the folder that should hold `wikis/`, double-click, five-menu TUI; link to docs/getting-started.md for the ten-minute walkthrough; one line for build-from-source and non-Windows pointing at the Documentation Map.
6. **Known Limitations** — content unchanged (earlier user choice), escape fixes only.
7. **Documentation Map** — AGENTS.md hierarchy, Project Vision/, Implementation Plan/ + BACKLOG, src/AGENTS.md for pipeline/LLM internals, docs/getting-started.md for usage.

Deleted from README: the walkthrough (moved), "Functional Architecture", "Step-by-Step Architecture" incl. ASCII diagram, "Detailed Technical Architecture", "Project Structure". Coverage of the technical content already verified in AGENTS.md/vision docs.

## 4. New docs/getting-started.md (the practical guide, moved out of README)

Contains, TUI-first and de-escaped: the exe quick start; "Your First Wiki" walkthrough (kept essentially verbatim, `chase`/`npm run cli` alternatives removed); the five-menu reference incl. the `p` review shortcut and cost expectations; where files land and reading the wiki in Obsidian (main-menu screenshot moves here); a one-line power-user note that a `chase` CLI exists (details via the repo docs).

## 5. Humanizer pass (file mode, both files)

- Keep every claim; no invented facts, numbers, or names. Prose only; code blocks, paths, and link targets untouched.
- Strip AI tells: sales language, "ensuring/highlighting" -ing phrases, forced triads, vague praise, filler, formulaic closings.
- Match the existing README's voice as the writer's sample: direct second person, concrete numbers, asides. The sample's em-dash rhythm stays at a similar rate (sample priority overrides the default dash ban).
- Final self-check: "What still sounds AI-generated?" and "Did the rewrite add or remove any fact?" before writing each file.
- Escape fixes everywhere in both files: strip literal backslashes inside code spans (`RUN\\\_E2E=1`, `dist\\paper-chase.exe`, `wikis\\<slug>\\`, `%LOCALAPPDATA%\\...`, `ANTHROPIC\_API\_KEY`) and normalize `\\\[...]` forms outside them.

## 6. DOX closeout

- Root AGENTS.md `docs/` bullet: extend to describe the folder's new contents (getting-started.md user guide, diagrams/ mermaid sources behind the README pipeline images, images/).
- If the per-model price table (deleted from README) is not already in `src/AGENTS.md`, fold it in there so it isn't lost.
- No other AGENTS.md affected; report any docs intentionally left unchanged.