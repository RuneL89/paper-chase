# Compliance Log

[2026-07-17 00:00] Phase 0 Compliance Check
  Changed: (none yet — pre-implementation check)
  Vision Docs Checked: `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md`
  Sections Checked:
    - §3 Functional Architecture (workspace/wiki/pages, `init`/`ingest` command signatures)
    - §4.1 Layered Architecture (Layer 1 = deterministic PDF extraction, $0 LLM)
    - §4.2 Incremental Ingestion (SHA-256 tracking of PDFs)
    - §4.4 Chunking Strategy (never split a page)
    - §5 Who Decides What (text extraction, hashing, file I/O = deterministic code: pdfjs-dist, fs, crypto)
    - §7 Non-Goals (no web interface)
  Comparison:
    - CLI `init <slug> --title -w <workspace>` and `ingest <slug>` signatures match §3 workflow exactly. COMPLIANT.
    - `extractText` (pdfjs-dist) and "never splits a page" match §4.4 and §5. COMPLIANT.
    - `sha256` (crypto) supports §4.2 hash-tracked incremental ingestion. COMPLIANT.
    - TUI (Ink, terminal UI) does not violate §7 "no web interface" — it is not a web UI; the tool remains a CLI. COMPLIANT.
    - `callLLM` wrapper is infrastructure for Layer 2 (§4.1). COMPLIANT.
    - Golden master PDF fixture is test infrastructure not mentioned in vision — EXTENSION, no conflict.
    - Phase 0 builds no init/ingest/agent logic, consistent with the layered plan. COMPLIANT.
  Result: COMPLIANT (with one noted EXTENSION: test fixtures)
  Checked By: Main agent (phase orchestrator)
  Notes / risks (not contradictions, flagged for Implementer):
    1. Gate 0.3 shells out to `shasum -a 256` — platform is Windows/Git Bash; if `shasum` is not executable from the test runner's shell, the Implementer may adapt the comparison method and must document the deviation in the status file.
    2. Gate 0.4 requires a live LLM call, but no API key env vars are set and the phase LLM budget is $0. Awaiting user decision on provider/key before that gate can pass.

[2026-07-17 00:47] Phase 0 Post-Implementation Check
  Changed: src/, tests/, test-pdfs/, templates/, prompts/, scripts/, package.json, tsconfig.json, vitest.config.ts, .gitignore, .state/phase-0-status.json (full list in git commit 6c0f4e5)
  Vision Docs Checked: `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md`
  Sections Checked: §3, §4.1/4.2/4.4, §5, §7 (same mapping as pre-implementation check)
  User Decisions Recorded:
    - LLM provider: Anthropic Messages API (key via ANTHROPIC_API_KEY, git-ignored .env fallback)
    - Gate 0.4: one live smoke call allowed as de-minimis exception to the $0 phase budget
  Result: COMPLIANT (deviations are implementation adaptations, not vision conflicts: certutil fallback for Gate 0.3, Gate 0.8 test restructured for Ink 7, .env fallback in LLM client — all documented in .state/phase-0-status.json `deviations`)
  Checked By: Main agent (phase orchestrator); independent Verifier sub-agent check in progress
  Gate 0.4 Evidence: `LLM Call | Tokens: 17/4 | Cost: $0.0000` (~$0.00004 actual); full suite 10/10 green with key loaded

[2026-07-17 00:55] Phase 0 DOX Closeout
  Changed: Root `AGENTS.md` (Child DOX Index), new child contracts: `src/AGENTS.md`, `tests/AGENTS.md`, `test-pdfs/AGENTS.md`, `prompts/AGENTS.md`, `scripts/AGENTS.md`, `.state/AGENTS.md`
  Decision: `templates/` cannot hold a DOX contract at `templates/AGENTS.md` because that path is the wiki constitution template artifact required by `PHASE_00_infrastructure.md` §2.1; the folder's rules are recorded inline in the root Child DOX Index instead
  Docs intentionally left unchanged: `Implementation Plan/AGENTS.md` (its statement that implementation subfolders are indexed in the root AGENTS.md remains accurate); `Project Vision/AGENTS.md` (no vision content changed)
  Result: COMPLIANT — DOX hierarchy now matches the Phase 0 tree
  Checked By: Main agent (phase orchestrator)

[2026-07-17 01:35] Template Update: `templates/AGENTS.md` replaced with merged user-provided template
  Changed: `templates/AGENTS.md`
  Vision Docs Checked:
    - `01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 (AGENTS.md = constitution; every LLM call follows it)
    - `03_DOX_concept_detailed.md` §3 (folder hierarchy, naming rules), §5 (structural change logging), §6 (DOX Writer)
    - `05_page_types_specification.md` §1 (6 default types), §2 (frontmatter rules), §6 (two-layer entity page), §8 (raw type), §9 (custom types)
    - `06_citation_and_provenance.md` §1-3 (citation format, sources frontmatter schema), §5-7 (page sections, integrity, verification path)
  Notes:
    - Base: user-provided template (`Downloads/templates_AGENTS.md`). It is MORE vision-compliant than the Phase 0 version: fixes a latent contradiction (old template's `pages/`/`raw-pages/` vs `03` §3.1's `raw/`/`documents/`/`sources/`/`entities/`/`topics/`) and matches `05`'s page-type taxonomy and two-layer entity format.
    - Preserved from the Phase 0 template: constitution/binding framing, `{{WIKI_TITLE}}`/`{{SLUG}}` double-brace placeholders, `sources` frontmatter schema, preserve-existing-citations-and-human-edits rule, "never invent sources/page numbers/quotes".
    - Added per user request: the Journalist Test (aligns with `01` journalist user + `06` §7) and a Disambiguation bullet (aligns with the Extractor's `disambiguation` field, `04`).
    - Corrections applied to the user's version: `raw` page type added (`05` §8); entity/topic "Created By" reworded to "your content, assembled by the Materializer" (`05` §1); wiki-root files noted (`03` §3.1); custom-type rule added (`05` §9).
    - Dropped: "log every LLM call (tokens and cost)" — cost logging is the deterministic client's job, not the LLM's.
    - Placeholder contract for Phase 1 `init`: substitute ALL `{{WIKI_TITLE}}` and `{{SLUG}}` occurrences (including inside the frontmatter example).
  Result: COMPLIANT (user-directed EXTENSION that increases vision compliance)
  Checked By: Main agent (phase orchestrator)

[2026-07-17 02:10] Phase 1 Pre-Implementation Compliance Check
  Changed: (none yet — pre-implementation check)
  Vision Docs Checked: `Project Vision/02_WIKI_concept_detailed.md`, `Project Vision/06_citation_and_provenance.md` (mapping per MASTER_IMPLEMENTATION_PROMPT.md §4)
  Sections Checked:
    - `02` §2 (page requirements), §5 (page types: document/source = Layer 1 deterministic), §7 (LLM vs deterministic split)
    - `06` §1-2 (core citation rule, format), §3 (sources frontmatter schema), §4 (provenance/source pages), §6 (citation integrity)
  Comparison:
    - Phase 1 `init`/`ingest` produce `document` and `source` pages deterministically with $0 LLM — matches `02` §5 "Created by: Layer 1 (deterministic)" and §7 deterministic responsibilities (extraction, hashing, source/raw provenance pages). COMPLIANT.
    - Document page frontmatter (phase doc §2.2: `title`, `type: document`, `wiki`, `sources: [{file, pages}]`, `updated`) matches `06` §3 schema — `file`/`pages` required, `extracted`/`sha256`/`label` optional. Implementer SHOULD include optional `extracted` + `sha256` to strengthen provenance (schema-permitted). COMPLIANT.
    - Source page (phase doc §2.4) covers every `06` §4 element: filename/path, SHA-256, page count, `warnings: []`, links to document pages, path to source PDF. COMPLIANT.
    - Chunking (5-page default, never split a page/table/figure) matches vision chunking rule (01 §4.4, verified in Phase 0) and uses frozen Phase 0 `extractText` range API. COMPLIANT.
    - No LLM calls this phase; budget $0 — matches the layered architecture (Layer 1 = deterministic). COMPLIANT.
  Noted adaptations (not vision contradictions):
    1. Phase doc §2.1 says `init` replaces `{wiki-title}`; the actual template artifact uses double-brace `{{WIKI_TITLE}}` and `{{SLUG}}` (root AGENTS.md templates rule + compliance log 2026-07-17 01:35 placeholder contract: substitute ALL occurrences of both). The newer template contract governs; record as a deviation in the phase status file.
    2. Vision `02` §5 `raw` page type (unparseable/scanned pages) is not built in Phase 1; extraction problems surface via the source page `warnings` field per phase doc §2.4. Phase plan defers `raw` pages; no conflict.
    3. Phase doc has a cosmetic heading-numbering glitch (§6 Approval Checklist followed by §7/§6 Integration Notes); content is unambiguous.
    4. TUI menu items (§5.3) already exist verbatim from Phase 0 scaffolding; only init/ingest screens need real implementations.
  Result: COMPLIANT
  Checked By: Main agent (phase orchestrator)

[2026-07-17 03:20] Phase 1 Post-Implementation Check
  Changed: src/commands/{init,ingest}.ts, src/state/ingestion-state.ts, src/pages/source-page.ts, src/extraction/markdown-tables.ts, src/utils/{slug,paths}.ts, src/tui/{init-screen,ingest-screen}.tsx, src/tui/hooks/use-wiki-details.ts, src/cli.ts, src/extraction/pdf.ts (additive getPageCount only), tests/phase-01.test.ts, tests/tui/phase-01-screens.test.tsx, wikis/AGENTS.md, DOX updates (root/src/tests/wikis AGENTS.md)
  Vision Docs Checked: `02_WIKI_concept_detailed.md` §5/§7, `06_citation_and_provenance.md` §3/§4 (same mapping as pre-implementation check)
  Result: COMPLIANT — no contradictions. Independent Verifier APPROVED all 9 gates with self-produced evidence (`.state/phase-1-verification.md`): npm test 33 passed + 1 by-design skip, tsc clean, E2E in temp workspace, zero `{{` placeholders in generated AGENTS.md, markdown-tables renderer proven lossless (word-multiset equality) and deterministic, frozen Phase 0 surface intact, no LLM calls ($0.00 spend), no new dependencies, no Extractor/Materializer/DOX Writer code.
  Deviations: all implementation adaptations (placeholder contract `{wiki-title}` → `{{WIKI_TITLE}}`/`{{SLUG}}` per the 2026-07-17 01:35 entry, hermetic temp-workspace tests, additive `-w` flag and `getPageCount`, deterministic markdown-table renderer for gate 1.4, TUI selector simplification) recorded in `.state/phase-1-status.json`; none conflict with vision.
  Non-blocking findings for later phases: F1 no-op re-ingest rewrites ingestion.json mtime; F2 markdown-tables comment overstates guard strength; F3 trailing blank lines at EOF normalized.
  Checked By: Verifier sub-agent (independent) + Main agent (orchestrator)

[2026-07-17 10:20] Phase 1 User-Directed Extension: TUI "Add PDFs"
  Changed: (pending implementation — pre-check)
  Vision Docs Checked: `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 (Typical Workflow step 2: copy PDFs into raw/), §7 (Non-Goals: no web interface)
  User Request (2026-07-17): "alter the TUI so I can also copy files into the raw folder — I want to do everything in a user friendly manner all from the TUI"
  Comparison: A TUI screen that copies PDFs into `wikis/<slug>/raw/` performs exactly workflow step 2; it is terminal UI, not a web interface. The phase doc §5 did not include this screen — this is a user-directed scope EXTENSION, not a contradiction. Menu grows from 5 to 6 items; the Phase 0 gate 0.7 test (menu shows 5 options) will be updated to match the new product surface and the deviation recorded.
  Result: COMPLIANT (user-directed EXTENSION)
  Checked By: Main agent (phase orchestrator)

[2026-07-17 10:55] Phase 1 Extension Refinement: native graphical file picker
  Changed: (pending implementation — pre-check)
  Vision Docs Checked: `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md` §3 (workflow), §7 (Non-Goals: no web interface, single-user local tool)
  User Request (2026-07-17): replace typed/pasted file paths in the Add PDFs screen with graphical folder navigation ("navigate the folders on my disk graphically and actually pick the file").
  Comparison: Launching the OS-native file-open dialog (Windows OpenFileDialog via PowerShell, PDF-filtered, multi-select) from the TUI is still a local single-user CLI workflow, not a web interface. Manual path entry stays only as a fallback when the dialog is unavailable. DOX platform rule (Windows/Git Bash, no UNIX-only shellouts) is satisfied: the shellout IS the Windows path; non-Windows/failure fallback = manual input.
  Result: COMPLIANT (user-directed refinement of the 10:20 EXTENSION)
  Checked By: Main agent (phase orchestrator)
