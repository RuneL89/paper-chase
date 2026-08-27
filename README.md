# Paper Chase

**The paper chase, automated.** You bring the documents. It does the chasing.

## Introduction

Paper Chase is a local CLI/TUI that ingests a pile of PDFs (reports, filings, transcripts, letters) and produces a structured markdown wiki. Everything runs on your machine; the LLM calls go to whichever provider you configured, and the wiki is plain files you own.

What you end up with:

* one page per entity (people, organizations, places, …), with every mention, relationship, and claim gathered on it
* topic pages that roll entities up
* composite pages that pool logically-mapped entities into one article
* comparison articles that preserve multi-subject data tables verbatim
* a document page for every ingested PDF
* `AGENTS.md` navigation contracts (the DOX contract) throughout, so both humans and agents can navigate the wiki
* a citation of the form `[Source Name, p. N]` on every entity, relationship, and claim; it jumps you to the exact PDF page
* a deterministic validation pass that checks every link resolves, every citation points at a real source page, and every page matches its schema
* incremental re-runs: unchanged PDFs (by SHA-256) are skipped, new information is merged into existing pages, and manual edits are never overwritten; they are logged as conflicts instead

The rest of this page shows how the ingestion pipeline works, twice: first at a glance, then in detail. If you just want to run it, skip to [Getting the app](#getting-the-app).

![The Paper Chase main menu with its five items: Create New Wiki, Add PDFs, Ingest PDFs, Settings, Exit](docs/images/tui-main-menu.png)

*The main menu: five items, and everything a wiki needs starts here.*

## The pipeline at a glance

![The Paper Chase ingestion pipeline at a glance: a vertical timeline from dropping PDFs into raw/ through the per-PDF loop (chunk, extract, materialize, synthesize or amend, checkpoint) to the finalize steps (validate, DOX, workspace index, cross-wiki, updater, persist), each step tagged USER, CODE, or LLM](docs/images/pipeline-high-level-timeline.png)

*The whole pipeline in one picture: orange steps are you, the middle section repeats once per PDF, and the last section runs once per ingest.*

Legend: **[USER]** = a human action · **[CODE]** = deterministic code · **[LLM]** = a call to a language model, prompted to do one job.

### The trigger (USER)

**Drop PDFs into wiki/raw/.** The wiki's input folder. Copy in as many PDFs as you like; nothing is processed until you ingest.

**Press "Ingest PDFs".** From the TUI's five-item menu. The pipeline loads its settings, the wiki's `AGENTS.md` constitution, its rolling memory of everything extracted so far, and the state of previous runs.

### The per-PDF loop (repeats for every new or changed PDF)

**Chunk [CODE].** The PDF is split into page-size chunks. A single page is never split across chunks, so every citation can point at an exact PDF page later.

**Extract [LLM].** The Extractor reads each chunk, the constitution, and the rolling memory, and returns strict JSON: entities, relationships, claims, and tables, every item cited. Invalid output is fed back for correction up to three times; if the JSON fails to parse, a JSON-corrector call diagnoses the break first. If the Extractor never produces valid output, the run aborts loudly rather than skip data.

**Materialize [CODE].** All extractions are aggregated across chunks and prior PDFs. Duplicate identities are curated, generic labels (an `indikator-2` that means different things in different sources) get a disambiguation judgment, and candidate pages are written. Pages you edited by hand are detected and left alone.

**Synthesize or amend [LLM].** A new page is written as a readable article: prose on top, the verbatim evidence underneath. A page that already exists and only gained new evidence is *amended* instead: a structured patch (add evidence, add section, add member, edit prose, flag a contradiction) that adds without deleting or rewriting what is there. Both paths pass a preservation check: no evidence may be dropped. Failures are retried, and a page that never passes falls back to the deterministic template, so data is never lost.

**Checkpoint [CODE].** The PDF's state is saved; the loop moves to the next PDF. An interrupted run resumes here without redoing finished PDFs.

### Finalize (once per ingest)

**Validate [CODE].** Links, citations, frontmatter, and preservation are checked across the whole wiki.

**DOX [LLM].** Navigation contracts (`index.md`) are written for every folder and the wiki root, with children and statistics re-imposed deterministically.

**Workspace [LLM].** The workspace-level index gains this wiki's segment; every other wiki's bytes are preserved.

**Cross-Wiki [LLM].** Only when the workspace holds two or more wikis: an entity registry, relationship graph, and topic clusters across wikis. It never edits per-wiki pages and never aborts the ingest.

**Updater [LLM].** Optional. Proposes an update to the wiki's `AGENTS.md` constitution; the proposal is applied only by an explicit human action.

**Persist [CODE].** Metrics and final state files are written; the wiki is ready to read.

## The pipeline in detail

![The detailed Paper Chase ingestion pipeline as a swimlane diagram: three horizontal bands (USER on top, CODE in the middle, LLM at the bottom), the flow running left to right, yellow diamonds marking validation gates, loop-back arrows marking retries, and two orange user nodes at the far right end](docs/images/pipeline-swimlane-state-machine.png)

*The same pipeline, one level deeper: three bands say who acts, left to right says when.*

How to read it: the three horizontal bands are the actors. Human is orange, deterministic code is green, LLM calls are blue. Vertical position tells you who is acting; left to right is time. Every blue box states what that LLM is prompted to do. Every yellow diamond is a deterministic check, and the labeled arrows leaving it say what happens on each outcome, including the loop-backs that retry with the validator's feedback (max 3), the unchanged-PDF skip at the start, and the two orange nodes at the far right that only a human can perform.

### Trigger

Pressing "Ingest PDFs" (top band) loads settings, the constitution, rolling memory, and prior state. For each PDF in `raw/` the first gate asks whether its SHA-256 hash is already on record; an unchanged PDF is skipped outright and the loop moves on.

### Per PDF: extract

The chunker (green band) splits the PDF, and each chunk goes to the Extractor (blue band) in sequence, one call per chunk. Its JSON is validated against a schema; on failure a JSON-corrector call diagnoses the parse error, and the Extractor is re-asked up to three times with the exact violations listed. Extractor exhaustion aborts the ingest; data is never skipped.

### Per PDF: materialize and curate

The Materializer aggregates all chunk extractions together with what previous runs already knew, and watches for one specific trap: a generic label (a slug like `indikator-2`) whose evidence from different sources does not overlap in meaning. The Disambiguation call judges whether the sources mean the same thing; if they do not, one composite page is written at the generic slug with a section per meaning, and a sticky source-to-member map means no later run re-litigates it. The Curation call then confirms or denies each proposed merge, drop, and cluster; routine pairs (transliterations, exact aliases) are merged for free by code, and every decision is recorded and pre-applied on later runs, so a merge is paid for once. Candidate pages are written at this point; pages you edited by hand are detected by hash and never overwritten.

### Per page: synthesize or amend

Every changed page reaches the gate that asks whether it already has a successful synthesis. New or reshaped pages go to the Synthesis Writer: prose in the output language, evidence verbatim underneath, and a preservation check that every mention, claim, and citation survived. Failures are re-asked up to three times; a final failure lands on the deterministic structured template (all data, no prose). Pages that only gained evidence go to the Amendment Writer instead: it emits a structured patch that may add evidence, sections, or members, edit prose, or flag a contradiction. It never deletes and never rewrites. An invalid patch is re-asked up to three times, and if patching never succeeds the page falls back to full synthesis, so a page is never left half-patched. Pages that pass are fingerprinted and skipped on later runs; nothing already written is re-bought. Synthesis runs through a bounded pool of four workers; per-page outcomes are identical to sequential processing.

### Checkpoint and resume

When a PDF's pages are done, its state is checkpointed. An interrupted run picks up from there: finished PDFs are never re-extracted, finished pages are never re-synthesized, and unchanged PDFs are skipped by hash.

### Finalize

Validation sweeps the whole wiki: links, citations, frontmatter. The DOX Writer writes each folder's `index.md` navigation contract, with children and statistics re-imposed by code, and the workspace index gains this wiki's segment with every other wiki's bytes untouched. With two or more wikis, the Cross-Wiki pass builds the entity registry, relationship graph, and topic clusters; uncertain matches are held for human review, and the pass never aborts the ingest on failure. If enabled, the Updater drafts an `AGENTS.md` proposal, applied only when you press `P` and accept the diff (or left on disk for later). Metrics, the LLM call log, and the stall log are persisted, and the wiki is ready.

### Guard rails (apply to every LLM call)

HTTP 4xx fails immediately. That is a configuration problem, and retrying will not fix it. HTTP 429/5xx ride a stall ladder of up to six attempts with waiting floors of 1, 5, 15, 45, and 90 minutes, so a throttled free-tier provider can clear its window; network errors get three attempts. Content defects (bad JSON, dropped evidence) are re-asked up to three times with the validator's exact errors. Every call carries an absolute deadline (5 minutes, 15 for large-output calls) so a dead connection cannot hang the run.

## Getting the app

Paper Chase ships as a standalone Windows executable: put `paper-chase.exe` in the folder that should hold your `wikis\` workspace and double-click it. The ten-minute walkthrough (settings, your first wiki, the first ingest, reading the result in Obsidian) lives in [docs/getting-started.md](docs/getting-started.md). Building from source (Node.js ≥ 20) and non-Windows use are covered in the Documentation Map below.

## Known Limitations (from the Backlog)

Need-to-know only; the full list with mechanisms and fix plans lives in [`Implementation Plan/BACKLOG.md`](Implementation%20Plan/BACKLOG.md).

* **PDF text only (for now):** DOCX, scanned/image-only PDFs, and standalone images are on the backlog as a future multi-format ingestion track.
* **The very densest pages stay templates:** an entity/topic whose preserved evidence exceeds the model's output ceiling keeps the deterministic structured template (all data, no prose), which is rare (~2% of pages).
* **API keys live in `.paper-chase.json`** (gitignored); never commit it.

## Documentation Map

* [`docs/getting-started.md`](docs/getting-started.md): get the exe, your first wiki in ten minutes, the five menu items, where the files land.
* [`AGENTS.md`](AGENTS.md): the repo's binding work contracts. Every folder has one, and together they document the whole codebase: pipeline internals, the LLM client, model routing, retries, and state files.
* [`Project Vision/`](Project%20Vision/): the canon. It states what Paper Chase is and what every part must do.
* [`Implementation Plan/`](Implementation%20Plan/): the phased build plan, the master index, and [`BACKLOG.md`](Implementation%20Plan/BACKLOG.md), the full limitations list.
* [`docs/diagrams/`](docs/diagrams/): the editable Mermaid sources behind the two pipeline images above; edit these and re-render.
