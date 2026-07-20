# Phase 10: Pluggable PDF Engine + opendataloader-pdf A/B Evaluation

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-010`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-20
**Dependencies:** Phases 0-9
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $0 for gates (all LLM-free); ≤ $2.00 for optional end-to-end A/B ingest in UAT only

---

## 1. Objective

Introduce a pluggable PDF text-extraction engine seam and ship **opendataloader-pdf** (`@opendataloader/pdf`) as an **opt-in alternative engine** alongside the existing pdfjs-dist implementation — without changing default behavior — then run a structured A/B evaluation to decide, with data, whether opendataloader-pdf should become the default engine.

Binding constraints:

- The Phase 0 surface is frozen (`src/AGENTS.md`): `extractText(pdfPath, startPage?, endPage?): Promise<string>` and `getPageCount(pdfPath): Promise<number>` must not change signature or default behavior. This phase extends; it does not break.
- **pdfjs-dist remains the default engine.** With no configuration, extraction output must be byte-identical to pre-Phase-10 output (same pattern as the Phase 7 slugify freeze).
- opendataloader-pdf is strictly **opt-in** in this phase. A default switch is a possible *outcome* of the A/B decision, not a deliverable of this phase.
- Citation provenance depends on exact 1-based page semantics (`pages: "N-M"` frontmatter). Any engine must preserve page fidelity.

---

## 2. Research Summary (decided 2026-07-20, full findings in compliance log)

Facts about opendataloader-pdf that shape the design:

- **Architecture:** Java core engine; the Node SDK `@opendataloader/pdf` is a wrapper that spawns `java -jar opendataloader-pdf-cli.jar` (JAR bundled in the package). **A JRE (Java 11+) on the user's PATH is a hard requirement** — this is the single biggest adoption risk vs. pdfjs-dist, which is pure JS with zero system dependencies.
- **License:** Apache 2.0 (core). Actively maintained (v2.x, frequent releases).
- **Relevant capabilities:** XY-Cut++ reading-order analysis (better multi-column handling), table detection, per-element bounding boxes + page numbers (JSON format), built-in OCR (80+ languages), hidden-text/prompt-injection safety filters.
- **Relevant `convert()` options:** `pages: "1,3,5-7"` (page ranges — maps directly onto `extractText`'s startPage/endPage), `format: 'text' | 'markdown' | 'json'`, `toStdout`, `quiet`, `textPageSeparator` / `markdownPageSeparator` with `%page-number%` support, `keepLineBreaks`, `readingOrder: 'xycut'` (default), `tableMethod`, `threads`.
- **Out of scope:** hybrid mode (requires a separate local docling/hancom server), Tagged-PDF accessibility output, annotated PDF, image extraction, LangChain integration.
- **Caveat:** published benchmark claims ("#1", 0.907) are self-reported by the vendor; our own A/B corpus is the arbiter.

Current pdfjs integration (the seam target): all pdfjs calls live in `src/extraction/pdf.ts`; consumers (`src/commands/ingest.ts`, tests, verify scripts) use only the two-function surface. Ingest calls `extractText` once per page, chunks pages (default 5/chunk, no overlap), runs `renderTablesAsMarkdown()` per chunk, and records `pages: "N-M"` provenance in chunk frontmatter.

---

## 3. What to Build

### 3.1 Engine Seam (`src/extraction/pdf.ts` refactor)

- Split `src/extraction/pdf.ts` into:
  - `src/extraction/pdf-pdfjs.ts` — the current implementation, moved **verbatim**.
  - `src/extraction/pdf-opendataloader.ts` — the new engine (§3.2).
  - `src/extraction/pdf.ts` — thin dispatcher preserving the exact frozen signatures of `extractText` / `getPageCount`. No behavioral change when the engine is pdfjs.
- Engine type: `type PdfEngine = 'pdfjs' | 'opendataloader'`.
- Resolution order (highest wins): CLI flag `--pdf-engine` → env var `PDF_ENGINE` → settings file `pdfEngine` → default `'pdfjs'`.
- `IngestOptions` gains an optional `pdfEngine?: PdfEngine` (plumbed from CLI/TUI), following the existing injectable-option pattern.
- Internal (non-frozen) addition allowed: engines may expose a whole-document batch extraction to avoid per-page JVM spawns (see §3.4); the frozen per-page surface delegates to it.

### 3.2 opendataloader Engine (`src/extraction/pdf-opendataloader.ts`)

- Dependency: `@opendataloader/pdf` added to `package.json`.
- `getPageCount`: pdfjs may be reused for page counting (cheap, no Java) **or** opendataloader JSON output page count — decide in implementation; document the choice. Page counts from both engines must agree (Gate 10.3).
- `extractText(path, startPage?, endPage?)`:
  - Call `convert()` with `format: 'text'` (or `'markdown'` — see §3.5 open question), `pages: "<start>-<end>"` when a range is given, `toStdout: true`, `quiet: true`.
  - Parse stdout into per-page text. Page-boundary alignment with pdfjs semantics is mandatory: page N of the PDF must map to the same chunk assignment under both engines.
  - Map Java/CLI failures to clear errors (non-zero exit, missing output, page-count mismatch).
- **JRE probe:** `java -version` (cached per process). Behavior:
  - Engine explicitly selected (`opendataloader` via flag/env/settings) + no JRE → **hard error** with an actionable message ("Install Java 11+ and ensure `java` is on PATH, or switch PDF engine to pdfjs").
  - No explicit selection + no JRE → silently pdfjs (it is the default anyway).
  - `auto` mode is **not** introduced in this phase; selection is explicit only.
- OCR, hybrid, sanitize, and content-safety options: not exposed; defaults used. Recorded as accepted scope limits.

### 3.3 Settings, CLI, and TUI Surface

- Settings schema (`src/tui/settings.ts`): add `pdfEngine?: 'pdfjs' | 'opendataloader'` (absent = pdfjs).
- Settings screen: add a "PDF Engine" row with a short inline hint ("pdfjs — default, no dependencies" / "opendataloader — better layouts/tables, requires Java"), following the Phase 11 recommendation-label pattern.
- CLI: `--pdf-engine <engine>` on `ingest` (and any command that extracts text); env var `PDF_ENGINE` honored.
- Per the 2026-07-17 user preference, the choice must be doable from the TUI — no config-file-only settings.

### 3.4 Performance Decision: Per-Page vs. Batch Invocation

pdfjs `extractText` is called once per page by ingest; spawning a JVM per page is likely unacceptable. This phase must:

- Implement an internal whole-document path for the opendataloader engine: one `convert()` call per PDF (or per chunk page-range), split into per-page strings via `textPageSeparator` with `%page-number%` (or via JSON `page` fields).
- Measure and record JVM startup + per-document wall time for both engines in the A/B report (§3.6).
- The frozen public surface keeps its per-page signature; the batch path is an internal optimization invisible to callers.

### 3.5 Interplay with `renderTablesAsMarkdown()`

opendataloader already emits markdown tables; our heuristic (`src/extraction/markdown-tables.ts`) may be redundant or harmful (double-processing) on opendataloader output. Decide in implementation, with test evidence:

- Option A: keep heuristic for both engines (assert it is a no-op on opendataloader markdown tables).
- Option B: skip the heuristic when the engine is opendataloader.
- Document the decision and rationale in the phase status file.

### 3.6 A/B Corpus and Evaluation Harness

**Corpus** (`test-pdfs/ab-corpus/`, new fixtures — golden masters stay immutable and are NOT moved):

- Multi-column layout (e.g. newsletter-style, synthetic via pdf-lib if sufficient, otherwise a real document)
- Real tables (bordered and borderless) — compare against `renderTablesAsMarkdown` output
- Headers/footers and footnotes
- Danish diacritics text (æ/ø/å) — extends the Phase 7 coverage
- A dense financial/legal page (the project's target domain)
- Optional: a scanned page (documents OCR gap honestly; expected pdfjs failure is a valid data point)
- Each fixture gets a short `README.md`/manifest entry stating what "correct" extraction looks like (expected strings, expected table shape, expected reading order).

**Harness** (`scripts/compare-pdf-engines.ts`):

- Runs both engines over every corpus fixture + the three golden masters and writes `.state/pdf-engine-ab-report.md` (+ `.json`) with per-fixture:
  - Expected-string presence (reading order / key content markers from the manifest)
  - Table fidelity (markdown table detected? row/column shape vs. manifest)
  - Diacritics integrity (æ/ø/å preserved verbatim)
  - Page-boundary alignment (per-page text non-empty where expected; page counts agree)
  - Wall time per document (and JVM startup overhead)
- Optional end-to-end mode (UAT only, costs LLM tokens): ingest the corpus into two temp wikis (one per engine) with stubbed/cheap LLM and diff chunk markdown + Layer 2 JSON (entity/alias counts, citation validity, blank-page warnings).

**Decision record:** the report plus a keep-pdfjs / switch-default recommendation is presented to the user; the decision is recorded in the compliance log and this phase's status file. Switching the default (if chosen) is a one-line settings default change + docs, executed under this phase only with explicit user approval; otherwise deferred to Phase 11.

---

## 4. Technical Approval Gates

All gates are LLM-free. Gates that need a JRE self-skip when `java` is absent (same pattern as API-key-gated tests), and the skip is reported in the test output.

### Gate 10.1: Frozen Surface Preserved

```typescript
test('pdfjs engine remains byte-identical default', async () => {
  // With PDF_ENGINE unset and no settings: extractText on golden-master.pdf
  // returns exactly the same string as the pre-refactor implementation
  // (compare against a snapshot recorded BEFORE the refactor).
});
```

### Gate 10.2: Existing Extraction Gates Pass Under Both Engines

Run the `infrastructure.test.ts` extraction assertions (known strings, page-range isolation) and `phase-01.test.ts` ingest frontmatter assertions with `PDF_ENGINE=pdfjs` and `PDF_ENGINE=opendataloader`; both must pass (opendataloader run self-skips without JRE).

### Gate 10.3: Page Semantics Agree

```typescript
test('page counts and per-page boundaries agree across engines', async () => {
  // For every corpus fixture + golden masters:
  // getPageCount equal under both engines; per-page extractText(pdf, n, n)
  // returns non-empty text for the same page set.
});
```

### Gate 10.4: Engine Selection Precedence

```typescript
test('CLI flag beats env beats settings beats default', async () => {
  // Assert resolved engine for each combination of --pdf-engine,
  // PDF_ENGINE, settings.pdfEngine, and unset (default 'pdfjs').
});
```

### Gate 10.5: Missing-JRE Handling

```typescript
test('explicit opendataloader without java fails with actionable error', async () => {
  // Simulate java absence (PATH stub): explicit selection rejects with the
  // documented message; default selection stays on pdfjs.
});
```

### Gate 10.6: A/B Corpus Integrity

```typescript
test('corpus fixtures exist with manifests and extract under both engines', async () => {
  // Every fixture in test-pdfs/ab-corpus/ has a manifest entry;
  // both engines extract without throwing (opendataloader self-skip w/o JRE).
});
```

### Gate 10.7: Comparison Harness Emits a Report

```typescript
test('compare-pdf-engines writes .state/pdf-engine-ab-report with all metrics', async () => {
  // Run harness on a small subset; assert report contains per-fixture
  // expected-string, table, diacritics, page-alignment, and timing sections.
});
```

### Gate 10.8: Full Suite Green Under Default Engine

`npm test` with no engine configuration is fully green (all pre-existing gates unchanged), proving the refactor is behavior-preserving for existing users.

---

## 5. User Acceptance Tests (UAT)

### UAT 10.1: Opt-in engine works end to end

1. Ensure Java 11+ is installed; set `PDF_ENGINE=opendataloader` (or Settings → PDF Engine).
2. Ingest `golden-master.pdf` into a fresh wiki.
3. Verify chunk pages, `pages: "1-3"` provenance frontmatter, and rendered tables match a pdfjs ingest.

### UAT 10.2: Missing-Java UX

1. On a machine/shell without `java`, select opendataloader explicitly.
2. Verify the error message clearly states the Java requirement and the pdfjs alternative; verify the app does not crash or hang.

### UAT 10.3: A/B report review

1. Run `scripts/compare-pdf-engines.ts` on the full corpus.
2. Read `.state/pdf-engine-ab-report.md`: compare reading order, tables, diacritics, and timing between engines.
3. **Decision point:** keep pdfjs as default, or approve switching the default to opendataloader. Record the decision in the compliance log + phase status.

### UAT 10.4: Danish fixture under opendataloader

1. Ingest `golden-master-da.pdf` with the opendataloader engine.
2. Verify verbatim Danish Layer 2 evidence and correct transliterated slugs (Phase 7 behavior preserved engine-independently).

---

## 6. Approval Checklist

Before moving to Phase 11, verify:

- [ ] All 8 technical gates pass (`npm test` green; JRE-gated tests run or self-skip visibly).
- [ ] All 4 UAT steps pass.
- [ ] Frozen Phase 0 surface unchanged: `extractText` / `getPageCount` signatures and default behavior byte-identical (Gate 10.1/10.8).
- [ ] pdfjs remains the default engine absent explicit configuration.
- [ ] Engine selectable from CLI flag, env var, settings file, and TUI Settings screen.
- [ ] Missing-JRE path yields the documented actionable error, never a crash.
- [ ] Page semantics (1-based, `pages: "N-M"` provenance) identical across engines.
- [ ] `renderTablesAsMarkdown` interplay decision implemented and documented.
- [ ] A/B corpus + manifest committed under `test-pdfs/ab-corpus/` (golden masters untouched).
- [ ] `.state/pdf-engine-ab-report.md` produced and presented; default-engine decision recorded in compliance log + `.state/phase-10-status.json`.
- [ ] Total LLM cost for this phase is $0 (gates) + ≤ $2.00 (optional UAT end-to-end A/B only).

---

## 7. Integration Notes

### What Phase 10 Depends On (from Phases 0-9)
- Phase 0: frozen extraction surface and golden master fixtures.
- Phase 1: ingest pipeline, chunk frontmatter provenance, `renderTablesAsMarkdown`.
- Phase 5+: settings persistence used for `pdfEngine`.
- Phase 7: multilingual fixtures and the byte-identical-default precedent.

### What Phase 10 Produces
- A pluggable PDF engine seam with pdfjs (default) and opendataloader (opt-in).
- An A/B corpus, comparison harness, and a data-backed default-engine decision.
- Documented performance characteristics (JVM startup, per-document wall time).

### Contract with Phase 11
Phase 11 (polish) expects:
- The engine decision is made and recorded; Phase 11's README documents the final engine posture (default engine, Java requirement if opendataloader is chosen, how to switch).
- If the decision was to switch the default, Phase 11 treats opendataloader as the documented default and pdfjs as the fallback.
- The Settings screen's PDF Engine row follows the same inline-recommendation pattern as Phase 11's model routing.

---

## 8. Open Questions (resolve in-phase, record in status file)

1. **Batch vs. per-page JVM spawns** — measured in §3.4; expected answer: one `convert()` per document internally.
2. **`format: 'text'` vs. `'markdown'` vs. `'json'`** as the engine's extraction format — markdown may obsolete `renderTablesAsMarkdown`; JSON adds bounding boxes for future per-element citations but requires more parsing.
3. **Page counting** — pdfjs reuse vs. opendataloader JSON; must not introduce a second JVM spawn per document.
4. **Distribution** — if opendataloader wins the A/B: keep pdfjs as permanent fallback (expected) vs. require Java; enterprise/CI environments without JRE argue for keeping pdfjs bundled regardless.
5. **Self-reported vendor benchmarks** — treat as marketing until confirmed on our corpus.
