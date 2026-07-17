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

[2026-07-17 12:00] Phase 2 Pre-Implementation Compliance Check
  Changed: (none yet — pre-implementation check)
  Vision Docs Checked: `Project Vision/04_orchestration_detailed.md`, `Project Vision/05_page_types_specification.md` (mapping per MASTER_IMPLEMENTATION_PROMPT.md §4)
  Sections Checked:
    - `04` §1 (pipeline layers, Extractor = only LLM call in core pipeline), §3.2 Step 5 (Extractor input: chunk text, page range, full AGENTS.md, rolling memory; output JSON to .state/extracted/<chunk-id>.json), §5 (rolling memory shape, loaded per chunk, updated after Materializer), §6 (validation order: schema, folder, no path traversal; no retry on failure), §7 (LLM decides classification/folders; deterministic code does validation + I/O)
    - `05` §1 (page types; entity/topic created by Layer 3 Materializer), §2 (frontmatter rules), §6 (entity page two-layer format, `entities/<subfolder>/<slug>.md` naming), §7 (topic), §9 (custom page types: "The Extractor includes it in the JSON output")
    - Cross-check: `templates/AGENTS.md` wiki constitution (already compliance-logged 2026-07-17 01:35) — its ingest instructions demand timeline, context paragraph, folder assignment, disambiguation from the Extractor; citation rules match the phase doc's fixed prompt text.
  Comparison:
    - Phase doc §2.2 `extractChunk` signature (chunkText, pageRange, sourceFile, agentsMd, existingFolders, existingEntities) carries exactly the `04` §3.2 Step 5 inputs. COMPLIANT.
    - JSON saved to `.state/extracted/<chunk-id>.json` during ingest (phase doc §2.3) matches `04` §3.2 Step 5 output location. COMPLIANT.
    - Entities/relationships/claims schema (phase doc §2.2) matches the `04` example JSON field-for-field (name/type/slug/folder/mentions{page,context}; subject/predicate/object/evidence/page; text/type/entities/page). COMPLIANT.
    - Gates 2.9-2.12 additionally require `timeline`, `context`, per-entity `significance`, optional `disambiguation` — fields absent from the `04` example JSON. This is an EXTENSION, not a contradiction: the `04` JSON is illustrative ("It does everything" = one call doing all extraction), `05` §6.2 + the wiki constitution require Timeline sections and disambiguation on entity pages, and the constitution explicitly instructs timeline/context extraction. The Materializer (Phase 3) can only get this data from the Extractor (the only LLM call). Recorded as noted adaptation 1.
    - Folder validation (gates 2.4: `^entities/|^topics/`, no `..`, ≤4 segments) matches `04` §6 folder validation + the constitution's "maximum 3 levels below entities/ or topics/" (= 4 path segments total). COMPLIANT.
    - Error handling "throw ExtractorError, no retry" matches `04` §6 "The system does not retry." COMPLIANT.
    - Rolling memory: phase loads existing folders/entities (empty on first run) and passes them to the Extractor; updating rolling-memory.json remains a Materializer (Phase 3) job per `04` §5. Phase 2 only reads it if present. COMPLIANT.
    - TUI Extractor Test screen (phase doc §5) is terminal UI, not a web interface (`01` §7, per prior entries). COMPLIANT.
  Noted adaptations (not vision contradictions — binding for the Implementer, to be recorded as deviations in the phase status file):
    1. Schema EXTENSION: ExtractorResult gains `timeline: Array<{date, event, entities[]}>`, `context: string`, per-entity `significance: string`, optional per-entity `disambiguation?: string` (gates 2.9-2.12 supersede the §2.2 interface sketch; grounds above).
    2. Budget inconsistency in the phase doc: header says $5.00 hard cap, Approval Checklist says "under $7.00 (increased for richer output)", MASTER §5 example says $7.00. The Checklist + Master Prompt govern: $7.00 cap, pause at $5.60 (80%).
    3. Live LLM tests: gates 2.1-2.12 make real LLM calls. Per tests/AGENTS.md they self-skip without ANTHROPIC_API_KEY and are run deliberately with the key loaded (.env present at project root), same precedent as Phase 0 gate 0.4.
    4. Hermetic workspaces: gate 2.6's `ingest('test-wiki')` runs against a temp workspace (Phase 1 precedent) because the repo's wikis/test-wiki is already ingested and hash-skip would prevent extraction; pass criteria unchanged.
    5. Deterministic slugs (gate 2.3): LLM output at default temperature cannot guarantee identical slugs across runs; deterministic slug normalization via the existing slugify() is the architecture-sanctioned way (`04` §7: deterministic code does the boring parts). Implementer may also make an additive, non-breaking extension to the frozen callLLM (optional maxTokens/temperature options object) — 1024 default max_tokens risks truncating the richer JSON; raising it for extraction calls does not change existing callers' behavior.
    6. TUI screen chunk listing: phase doc §5.1 says "Lists wikis and chunks from .state/extracted/" but un-extracted chunks live in documents/; the screen lists chunks from documents/ and saves results to .state/extracted/ (the save location is what §5.1's results panel shows).
    7. Menu/Screen wiring is additive to the current 6-item menu (user-directed add-pdfs item stays); gate 0.7's successor assertion grows to 7 items, recorded in the status file.
    8. UAT 2.2's `jq` may be absent on Windows; UAT documents a node-based fallback.
  Result: COMPLIANT (with one noted schema EXTENSION, grounds recorded)
  Checked By: Main agent (phase orchestrator)

[2026-07-17 15:10] Phase 2 Post-Implementation Check
  Changed: prompts/extractor.prompt.txt, src/agents/extractor.ts, src/validation/extractor-schema.ts, src/state/rolling-memory.ts, src/commands/extract-chunk.ts, src/commands/ingest.ts, src/llm/client.ts, src/cli.ts, src/tui/{menu,app,ingest-screen,extractor-test-screen}.tsx, src/tui/hooks/use-document-chunks.ts, tests/phase-02.test.ts, tests/tui/extractor-test-screen.test.tsx, tests/{phase-01.test.ts,tui/menu.test.tsx,tui/phase-01-screens.test.tsx}, DOX updates (root/src/tests/prompts/wikis AGENTS.md)
  Vision Docs Checked: `04_orchestration_detailed.md` §1/§3.2 Step 5/§5/§6/§7, `05_page_types_specification.md` §1/§6/§9 (same mapping as pre-implementation check)
  Result: COMPLIANT — no contradictions. Independent Verifier APPROVED all 12 gates with self-produced evidence (`.state/phase-2-verification.md`): npm test with key 95 passed + 1 by-design skip (all 12 gates green, replay of gate 2.3 deterministic), without key 83 passed + 13 self-skipped, tsc clean, frozen callLLM/extractText surfaces intact (additive CallLLMOptions defaults identical), Extractor is the only callLLM consumer, no Materializer/DOX Writer code, rolling memory read-only, unchanged PDFs skip extraction (verified live: 0 LLM calls on re-ingest), folders constrained (prefix/no-`..`/≤4 segments), no new dependencies.
  Schema EXTENSION (pre-logged 12:00, noted adaptation 1) confirmed compliant: timeline/context/significance/disambiguation feed the `05` §6.2 + constitution-mandated page sections and can only originate from the Extractor.
  Deviations: all 8 binding noted adaptations plus Implementer choices (extract?: boolean default-true with Phase 1 tests pinned to extract:false, shared extractDocumentChunk path, --no-extract CLI flag, prompt engineering for gate reliability) recorded in `.state/phase-2-status.json`; none conflict with vision.
  LLM cost: Implementer $0.1727 + Verifier $0.1845 ≈ $0.36 of the $7.00 cap (~5%).
  Non-blocking findings for later phases (from the Verifier): UAT 2.4's `git checkout --` restore works only after the prompt file is committed; UAT 2.4 verified by code+deterministic tests, not executed live; per-gate token figures vary run-to-run.
  Checked By: Verifier sub-agent (independent) + Main agent (orchestrator)

[2026-07-17 15:20] Phase 3 Pre-Implementation Compliance Check
  Changed: (none yet — pre-implementation check)
  Vision Docs Checked: `Project Vision/05_page_types_specification.md`, `Project Vision/03_DOX_concept_detailed.md` (mapping per MASTER_IMPLEMENTATION_PROMPT.md §4)
  Sections Checked:
    - `05` §1 (page types; entity/topic created by Layer 3 Materializer), §2 (common frontmatter rules), §6 (entity page frontmatter + two-layer content), §7 (topic page frontmatter + content)
    - `03` §3.1 (top-level folder layout: entities/, topics/, .state/), §3.2 (dynamic sub-folders), §3.3 (folder naming rules), §4 (index.md contract hierarchy — generated by DOX Writer, not Materializer), §5 (structural change logging), §6 (DOX Writer is separate deterministic component)
    - `04` §1 (pipeline layers; Extractor is the only LLM call in the core pipeline), §5 (rolling memory shape, updated after Materializer finishes)
  Comparison:
    - Phase 3 Materializer is deterministic code (no LLM), reading `.state/extracted/*.json` and writing `entities/` and `topics/` pages — matches `05` §1 "Created by: Layer 3 (Materializer)" and `04` §1 layer responsibilities. COMPLIANT.
    - Entity page format (frontmatter: title/type/wiki/tags/updated/sources; body: Mentions, Relationships, Claims, Sources) matches `05` §6.2. COMPLIANT.
    - Topic page format (frontmatter: title/type/wiki/tags/updated/sources; body: claims by source/page) matches `05` §7.2. COMPLIANT.
    - Citation format `[^srcN]` sequential within a page, with source definitions in `## Sources` section, matches `05` §6.2 and the constitution's citation rules. COMPLIANT.
    - Folder paths under `entities/`/`topics/` with prefix rule, no `..`, max 4 segments (3 levels below) match `03` §3.3 and the Phase 2 validator. COMPLIANT.
    - `index.md` files are NOT created by the Materializer; they are the DOX Writer's responsibility (`03` §4, §6). The Materializer only writes content pages. COMPLIANT.
    - Rolling memory update after materialization matches `04` §5 ("updated after the Materializer finishes"). COMPLIANT.
    - No LLM calls this phase; budget $0 — matches the layered architecture (Materializer = deterministic Layer 3). COMPLIANT.
    - TUI Entity/Topic Browsers (§5.1-5.2) are terminal UI, not a web interface (`01` §7). COMPLIANT.
  Noted adaptations (to be recorded in the phase status file if implemented):
    - Phase doc interfaces (EntityPageData, TopicPageData) omit some `ExtractorResult` fields (significance, disambiguation, timeline, context) from the entity page writer interface. The Materializer is free to include or defer them; the phase doc example shows only mentions/relationships/claims in the entity page body. The constitution's two-layer entity page requires a Timeline section, so including timeline data from the Extractor is preferred. This is an implementation detail, not a contradiction.
    - Gate 3.8's "add a second PDF to raw/" in the literal snippet is an illustrative intent; the actual pass criterion is that re-ingesting updates the entity page. Running ingest again with a changed PDF or forcing re-processing satisfies the criterion without requiring a second fixture in the repo's test-wiki.
  Result: COMPLIANT
  Checked By: Main agent (phase orchestrator)
  Changed: Root `AGENTS.md` (Child DOX Index: src/ + prompts/ entries), `src/AGENTS.md` (Extractor, validation, rolling-memory, extract-chunk, extractor-test screen, CallLLMOptions, Layer-2 ingest, 7-item menu, updated agent-phase contracts), `tests/AGENTS.md` (phase-02 + extractor-test-screen suites, 7-item menu note, both-modes verification counts), `prompts/AGENTS.md` (owns extractor.prompt.txt; placeholder + prompt-behavior contracts), `wikis/AGENTS.md` (read-only test-wiki fixture exception for Phase 2 gate tests)
  Docs intentionally left unchanged: `.state/AGENTS.md` (already covers phase-N status/verification records), `Implementation Plan/AGENTS.md` (no plan structure changed), `Project Vision/AGENTS.md` (no vision content changed), `templates/` rules (template artifact untouched), `test-pdfs/AGENTS.md` + `scripts/AGENTS.md` (fixtures untouched)

[2026-07-17 15:40] Phase 3 Post-Implementation Check
  Changed: src/pages/entity-page.ts, src/pages/topic-page.ts, src/materializer.ts, src/state/rolling-memory.ts, src/commands/ingest.ts, src/tui/entity-browser.tsx, src/tui/topic-browser.tsx, src/tui/components/tree-browser.tsx, src/tui/menu.tsx, src/tui/app.tsx, tests/phase-03.test.ts, tests/tui/entity-browser.test.tsx, tests/tui/topic-browser.test.tsx, tests/tui/menu.test.tsx, .state/phase-3-status.json
  Vision Docs Checked: `Project Vision/05_page_types_specification.md` §1/§2/§6/§7, `Project Vision/03_DOX_concept_detailed.md` §3.1/§3.2/§3.3/§4/§6, `Project Vision/04_orchestration_detailed.md` §1/§5
  Comparison:
    - Materializer reads `.state/extracted/*.json` and writes deterministic `entities/` and `topics/` pages; no LLM calls. COMPLIANT.
    - Entity pages have frontmatter (title/type/wiki/tags/updated/sources) and body sections (Mentions, Relationships, Claims, Sources) per `05` §6.2. COMPLIANT.
    - Topic pages have frontmatter and claim grouping per `05` §7.2. COMPLIANT.
    - Citations are sequential `[^srcN]` with source definitions in the Sources section; a stripCitations fix prevents duplicate markers when extractor output already contains them. COMPLIANT.
    - Folder hierarchy respects prefix/no-`..`/max-4-segment rules. COMPLIANT.
    - Rolling memory updated after materialization matches `04` §5. COMPLIANT.
    - `index.md` creation is not performed by the Materializer; deferred to DOX Writer (`03` §4). COMPLIANT.
    - TUI Entity/Topic Browsers use a shared tree-browser component, raw-mode-gated input, and non-TTY fallbacks; they are terminal UI. COMPLIANT.
    - Ingest wiring calls `materialize` after each source's chunk loop when `extract` is true, consistent with Layer 3 determinism and no extra LLM cost. COMPLIANT.
  Noted adaptations from pre-check remain accurate: entity/topic page writer interfaces intentionally omit some extractor fields (significance, disambiguation, timeline, context); the current implementation includes timeline data where present; no contradiction. Gate 3.8 re-ingest update verified by appending a second fake extraction JSON in the test, not by adding a second PDF fixture.
  Result: COMPLIANT
  Checked By: Implementer + in-process verification (npx tsc --noEmit clean, npm test 112 passed + 1 skipped)
[2026-07-17 15:50] Phase 3 Wikilink Format Fix
  Changed: src/pages/entity-page.ts, src/pages/topic-page.ts, src/materializer.ts, tests/phase-03.test.ts
  Vision Docs Checked: `Project Vision/05_page_types_specification.md` §6.2/§7.2, `Implementation Plan/PHASE_03_materializer.md` §2.1/§7, UAT 3.2
  Comparison:
    - Materializer now builds a slug-to-title map from entityMap and passes it to both page writers. COMPLIANT.
    - Entity-page relationships render `[[Acme Corp]]` instead of `[[acme-corp]]`. COMPLIANT.
    - Entity-page claim entities render `[[Acme Corp]]` / `[[John Smith]]` instead of slugs. COMPLIANT.
    - Topic-page claim entities render `[[Acme Corp]]` instead of `[[acme-corp]]`. COMPLIANT.
    - Unknown entity slugs fall back to `[[slug]]` so the link is not lost. COMPLIANT (defensive).
    - Predicate rendering left unchanged per Verifier (non-blocking stylistic issue). COMPLIANT.
  Result: CONTRADICTION RESOLVED — wikilinks now match the Phase 4 contract and vision documents.
  Checked By: Fix Agent (Phase 3)
  LLM cost: $0.00 (no LLM calls by the fix; existing Phase 2 tests made LLM calls during `npm test`)
  Tests: npx tsc --noEmit clean, npx vitest run tests/phase-03.test.ts 11 passed, TUI browser tests 8 passed, npm test 114 passed + 1 skipped
  Artifacts: wikis/test-wiki re-materialized; generated pages confirmed to use title-form wikilinks.

[2026-07-17 16:45] Phase 3 DOX Closeout
  Changed: Root `AGENTS.md` (Child DOX Index: src/ now lists Materializer as implemented), `src/AGENTS.md` (Materializer, entity-page, topic-page, entity-browser, topic-browser, tree-browser component, rolling-memory writer, updated ingest contract already reflected), `tests/AGENTS.md` (phase-03 + entity/topic browser tests, verification counts updated to 114 passed + 1 skipped with key), `wikis/test-wiki/entities/.../john-smith.md` and `wikis/test-wiki/topics/.../financial.md` regenerated with title-form wikilinks
  Docs intentionally left unchanged: `Implementation Plan/AGENTS.md` (no plan structure changed), `Project Vision/AGENTS.md` (no vision content changed), `templates/` rules (template artifact untouched), `test-pdfs/AGENTS.md` + `scripts/AGENTS.md` (fixtures untouched), `prompts/AGENTS.md` (no new prompts this phase)
  Result: COMPLIANT — DOX hierarchy now matches the Phase 3 tree; the wikilink-format contradiction found by the independent Verifier has been resolved and re-verified APPROVED
  Checked By: Main agent (phase orchestrator)

[2026-07-17 16:45] Phase 3 Final Approval
  Changed: `.state/phase-3-status.json` updated to reflect final approval and Reporter handoff
  Independent Verifier re-check: APPROVED; all 8 gates pass; tests 114 passed + 1 skipped; generated artifacts verified with title-form wikilinks
  Result: COMPLIANT — no unresolved contradictions
  LLM cost: $0.00 for Phase 3 implementation/verification/fixes (existing Phase 2 regression tests made LLM calls during `npm test` with .env key present, counted against prior Phase 2 budget, not Phase 3)
  Checked By: Main agent (phase orchestrator)


