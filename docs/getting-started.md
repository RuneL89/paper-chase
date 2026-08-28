# Getting Started with Paper Chase

The practical guide: get the app, build your first wiki, browse the result. The [README](../README.md) explains what the pipeline does; this page tells you how to drive it. Everything below happens in the terminal UI — no command line needed.

## Get the app (Windows .exe)

You don't need Node.js to *run* Paper Chase, only to build the exe once:

1. Build it with `npm install` + `npm run package:win` → `dist\paper-chase.exe` (or take a prebuilt copy).
2. Put the exe in the folder that should hold your `wikis\` workspace and double-click it. The first launch unpacks its runtime once (to `%LOCALAPPDATA%\paper-chase\runtime\<version>`), then the terminal UI opens; later launches start immediately.
3. **Create New Wiki → Add PDFs → Ingest PDFs**, then browse the generated `wikis\<slug>\` folder in Obsidian or any markdown viewer. (`paper-chase.exe init` / `ingest` also work from a terminal.)

Two things worth knowing: the exe is unsigned, so Windows SmartScreen may ask for a one-time confirmation, and it embeds the code it was built from — **rebuild it after upgrading** (`npm run package:win` refreshes it). On other operating systems, run from source with Node.js ≥ 20 (see the [README's Documentation Map](../README.md#documentation-map)).

Your wikis don't have to share one folder: whenever you create a wiki in any folder you pick (or type), that folder is registered and remembered, and the **Add PDFs** and **Ingest PDFs** screens list the wikis of every registered folder in one selector, each labeled with its folder. The list is a live scan of those folders — delete a wiki folder and it disappears from the selectors on the next visit; nothing needs unregistering.

![The Paper Chase main menu — Create New Wiki, Add PDFs, Ingest PDFs, Settings, Exit](images/tui-main-menu.png)

*The main menu — five items, and everything a wiki needs starts here.*

## Your First Wiki — a Friendly Walkthrough

Never used Paper Chase? You have a pile of PDFs and ten minutes. Here's the whole thing, end to end.

**0. Launch it.** Double-click `paper-chase.exe`. A menu appears with five items — everything happens from there.

**1. Settings (once).** Open **Settings** from the menu.

* **API key:** scroll to the **API Keys** section, press Enter on your provider's row, paste your key, and **Save**. It's stored locally in `.paper-chase.json`, shown only as `••••last4` — never in full, never in logs. (Prefer the environment? `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `DASHSCOPE_API_KEY` work too, no Settings entry needed. Custom providers keep their key in the provider config.)
* **Models:** the defaults are sensible — a cheap model for extraction and a stronger one for writing, with an inline recommendation label under each role. No changes needed to start.
* **Toggles:** make sure **Synthesis** is **on** — that's what turns raw extractions into readable prose pages.

**2. Create your wiki.** **Create New Wiki** → give it a **Title** (the folder slug is derived automatically) and a **Workspace** (the folder your wikis live in; the `[ Browse... ]` button opens the normal Windows folder picker). Pick the **Output Language** — the language *you want to read the wiki in* (default English). Done: your wiki now exists with a `raw/` folder and its own `AGENTS.md` constitution. The app offers to take you straight to adding PDFs.

**3. Add PDFs.** **Add PDFs** → **Browse…** opens your system's normal file picker — select one or many PDFs at once. They're copied into the wiki's `raw/` folder. When asked **Start ingesting now? [Y/n]**, say yes (or come back to **Ingest PDFs** anytime).

**4. Ingest.** Select your wiki, then set the **Input Language** — the language *the PDFs are written in* (Danish reports? Pick Dansk). This matters for clean names and page slugs; the output language was already fixed when you created the wiki. Press Enter and watch it work: text extraction → a quick **curation** pass that folds duplicate names together (most routine ones for free, deterministically; decisions stick between runs) → prose writing (`Synthesis: N/M pages complete (4 workers)`) → navigation contracts. It ends with `Ingest complete: X ingested, Y skipped.` — plus what it cost (`.state/metrics.json`; a dense two-PDF run with synthesis is roughly tens of dollars and ~1–2 hours, small ones are pennies and minutes). Unchanged PDFs are skipped automatically on later runs, and anything already written is never re-bought.

**5. The AGENTS.md proposal (if offered).** After an ingest, the app may have learned new structure and drafted an update to your wiki's constitution. The success screen says `press [P] to review the diff` — read the proposed changes inline, then **A** to apply them or **R** to keep the proposal on disk for later (nothing is ever applied without you).

**6. Read your wiki in Obsidian.** This is the recommended way to browse: open the `wikis/` folder as an Obsidian vault (or just your one wiki's folder). Everything is plain markdown — entity, topic, composite (several logically-mapped entities as one rich article), comparison (verbatim data tables), and cross-wiki pages with prose up top and verbatim evidence below, `[[links]]` between pages, and a citation like `[^src1]` behind every claim that jumps you to the exact PDF page. When your workspace has more than one wiki, the `cross-wiki/` folder holds a workspace-level entity registry, relationship graph, topic clusters, and hypothesis signals. Thin pages are honestly marked `sparse: true` so you never waste time on them.

*Feeding it more later:* drop new PDFs into `raw/` and ingest again — Paper Chase only processes what's new and merges it into the pages you already have.

## The five menu items

1. **Create New Wiki** — name a wiki; Paper Chase scaffolds `wikis/<slug>/` with a `raw/` folder and the root `AGENTS.md` contract.
2. **Add PDFs** — copy PDFs into `wikis/<slug>/raw/` using the native file picker (or by pasting a path). Afterwards the app offers to start ingesting immediately.
3. **Ingest PDFs** — run the pipeline over every new or changed PDF in `raw/`, with live progress (`[██████████] Chunk 1/1 ...`) and a closing summary: `Ingest complete: X ingested, Y skipped. Synthesis: A pages written (B strict, C permissive), D conflicts. Validation passed.` If the run wrote an AGENTS.md update proposal, the success screen offers a `p` shortcut into a diff review: `A` replaces the wiki's AGENTS.md with the proposal, `R` does nothing (the proposal stays on disk for later manual review). The review screen is flow-only — it has no menu entry. Cost calibration (July 2026, Anthropic mid-tier routing): a dense two-PDF Danish ingest with synthesis ran **~$34 and ~95 minutes** end-to-end — extraction is cheap (~$0.05/chunk), synthesis of prose is most of the bill, and curation costs pennies.
4. **Settings** — toggle synthesis and AGENTS.md update proposals, pick the LLM provider (Anthropic, OpenAI, Qwen, or a custom OpenAI-compatible provider), choose which model each pipeline role uses (Default, Extractor, Synthesis Writer, DOX Writer, Curation, Cross-Wiki Bulk, Cross-Wiki Judgment), and enter API keys (masked, stored locally). Settings persist to `.paper-chase.json`.
5. **Exit**.

## Where the files land

`index.md` at the wiki root links the workspace-level index; entity pages live under `entities/`, topic pages under `topics/`, per-PDF pages under `documents/`, and source records under `sources/`. Thin entity pages (one or two mentions, no significant claims or relationships) carry `sparse: true` in frontmatter and say so honestly in prose — an honest sparse page is a correct page, never padded to look substantial. Pages that absorbed name variants of the same real-world thing (curation merges) list the old names in `aliases`, so they still find the page.

## Power users

The same operations exist as plain commands for scripts: `chase` launches the TUI, `chase init <slug>` creates a wiki, `chase ingest <slug>` ingests everything new in `raw/` (flags like `--synthesis`, `--update-agents`, `--no-cross-wiki` mirror the Settings toggles). Without `npm link`, the equivalent is `npm run cli -- …`. The internals behind these commands live in the repo's AGENTS.md documentation — see the [README's Documentation Map](../README.md#documentation-map).
