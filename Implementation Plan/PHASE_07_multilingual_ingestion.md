# Phase 7: Multilingual Ingestion (Input and Output Languages)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-007`
**Version:** 1.1.0
**Status:** Draft
**Date:** 2026-07-19 (v1.1.0 amendment 2026-07-20: bounded retry, §10)
**Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $3.00 (hard cap; the Danish fixture is 2 pages — one chunk, a handful of live calls)

---

## 1. Objective

Make ingestion work for documents that are not in English. The user can ingest Danish (and other European-language) PDFs, and can choose independently:

- the **input language** — what language the PDFs of one ingest run are written in (per run), and
- the **output language** — what language the wiki's generated prose is written in (per wiki).

This means an English wiki can ingest German PDFs, a Danish wiki can ingest Danish PDFs, and every combination in between — while the citation model stays intact because preserved evidence is never translated.

Canonical spec: `Project Vision/04_orchestration_detailed.md` §9 (Multilingual Ingestion), with `02_WIKI_concept_detailed.md` §3.4 (language of the two layers), `05_page_types_specification.md` §2.1 (slugs and non-ASCII names), and `06_citation_and_provenance.md` §8 (source-language evidence).

---

## 2. Language Model

Two settings, two different lifetimes:

| Setting | Scope | Chosen where | Stored where | Default |
|---|---|---|---|---|
| **Output language** | Per wiki | `init` (CLI flag / TUI selector); overridable per ingest run | Wiki `AGENTS.md` (Language section) + `wikis/<slug>/.state/language.json` | English |
| **Input language** | Per ingest run | `ingest --input-language` / TUI selector | `lastInputLanguage` in `.state/language.json` | English |

Supported languages (ISO 639-1 codes): `en` English, `da` Danish, `de` German, `fr` French, `es` Spanish, `no` Norwegian, `sv` Swedish.

**The binding layer rule** (user decision 2026-07-19, vision `04` §9.2):

- **Layer 1** (synthesis prose, DOX index descriptions) is written in the **output language**.
- **Layer 2** (mentions, relationship evidence, claim text, extracted text) always stays **verbatim in the source language** — never translated, never reworded. The Phase 5 preservation check is a verbatim substring comparison; a translated Layer 2 item fails it by design.
- The **Extractor works in the input language** (context, significance, claims, timeline written in the input language; mention quotes verbatim as always).
- **Folder taxonomy follows the output language**; existing folders are always reused first.
- **Slugs are transliterated** with the input language's map before slugifying.

---

## 3. What to Build

### 3.1 Danish Golden Master Fixture

**File:** `test-pdfs/golden-master-da.pdf` (created once in this phase; immutable thereafter, same rule as the other golden masters)

**File:** `scripts/create-golden-master-da.ts` (pdf-lib generator, run once; kept for provenance, never re-run — same contract as `scripts/create-golden-master.ts`)

A 2-page Danish document whose every word is known, containing:

- At least two person names with Danish characters (e.g. "Søren Møller", "Åse Lindberg").
- At least one place name with Danish characters (e.g. "København", "Aarhus").
- At least one company (e.g. "Møbler A/S").
- At least one financial claim with a Danish-formatted number and a `[^srcN]`-citable fact per page.

Record the fixture's SHA-256 in `.state/phase-7-status.json` and in `test-pdfs/AGENTS.md`.

### 3.2 Language Utility Module

**File:** `src/utils/language.ts` (new; no new dependencies)

```typescript
export type LanguageCode = 'en' | 'da' | 'de' | 'fr' | 'es' | 'no' | 'sv';

export interface Language {
  code: LanguageCode;
  name: string;            // English display name, e.g. 'Danish'
  nativeName: string;      // e.g. 'Dansk' (TUI labels)
  transliteration: Record<string, string>;
}

export const SUPPORTED_LANGUAGES: readonly Language[];

export function getLanguage(code: string): Language;            // throws on unsupported code
export function transliterate(text: string, code: LanguageCode): string;
export function buildLanguageDirective(
  role: 'extractor' | 'synthesis' | 'dox',
  input: LanguageCode,
  output: LanguageCode,
): string;                                                        // '' when input === 'en' && output === 'en'
```

**Transliteration maps** (vision `04` §9.3):

- `da`, `no`: `æ→ae, ø→oe, å→aa` (plus uppercase variants)
- `de`: `ä→ae, ö→oe, ü→ue, ß→ss` (plus uppercase variants)
- `sv`: `å→a, ä→a, ö→o` (Swedish convention differs from Danish — do not merge the maps)
- `en`, `fr`, `es`: no explicit map

`transliterate()` applies the explicit map first, then Unicode NFD normalization and strips combining marks (`\p{M}`) for every language — this handles French/Spanish accents (é→e, ñ→n, ç→c). The explicit map must run **before** NFD, or Danish `å` would degrade to `a` instead of `aa`.

**Directive text** — one paragraph per role, injected into prompts:

- `extractor`: "The document chunk is written in {inputName}. Write all JSON free-text fields (significance, context, claim text, timeline events, disambiguation) in {inputName}. Quote mentions verbatim from the chunk. Name any new folders in {outputName}."
- `synthesis`: "Write the Layer 1 synthesis in {outputName}. Preserve every Layer 2 item (mentions, relationships, claims, timeline, sources) EXACTLY as supplied — never translate or reword them."
- `dox`: "Write all prose (the description, `## Pages` descriptions, `## Start Here` reasons) in {outputName}. Keep page titles and entity names verbatim."

When input and output are both English, `buildLanguageDirective` returns the empty string so filled prompts are byte-identical to today.

### 3.3 Slugify Extension

**File:** `src/utils/slug.ts` (extend; no behavior change for existing callers)

```typescript
export function slugify(name: string, language?: LanguageCode): string;
```

When `language` is omitted or `'en'`, the function runs exactly the current ASCII-only path — **byte-identical output** (the Phase 0 surface freeze and every existing test depend on this). Otherwise it runs `transliterate(name, language)` first, then the existing lowercase/filter logic.

`normalizeExtractorSlugs(data)` in `src/agents/extractor.ts` gains an optional `language` parameter and passes it through to every `slugify()` call, so LLM-provided slugs like `søren-møller` normalize to `soeren-moeller`.

### 3.4 Per-Wiki Language State

**File:** `src/state/language.ts` (new)

```typescript
export interface WikiLanguageState {
  outputLanguage: LanguageCode;
  lastInputLanguage: LanguageCode;
}

export async function readWikiLanguage(wikiDir: string): Promise<WikiLanguageState>;   // absent file → { en, en }
export async function writeWikiLanguage(wikiDir: string, state: WikiLanguageState): Promise<void>;
```

Persists `wikis/<slug>/.state/language.json`. Follows the existing `.state/` module pattern (`state/rolling-memory.ts`).

### 3.5 Prompt Files: `{languageDirective}` Placeholder

Add one line to each of the six prompt templates, at a position the phase agent judges most salient (near the top of the task/rules section):

```
=== LANGUAGE ===
{languageDirective}
```

Files: `prompts/extractor.prompt.txt`, `prompts/synthesis.prompt.txt`, `prompts/synthesis-permissive.prompt.txt`, `prompts/synthesis-topic.prompt.txt`, `prompts/synthesis-topic-permissive.prompt.txt`, `prompts/dox-writer.prompt.txt`.

Every placeholder must be filled by the owning agent code before the call (empty string when both languages are English), per the placeholder contract in `prompts/AGENTS.md`.

### 3.6 Wiki Constitution Template

**File:** `templates/AGENTS.md`

Add a `## Language` section (after `## Purpose`):

```markdown
## Language

This wiki's output language is {{OUTPUT_LANGUAGE}}. Write all Layer 1 synthesis prose and all `index.md` descriptions in {{OUTPUT_LANGUAGE}}. Preserve all Layer 2 detail (mentions, relationship evidence, claim text, quotes) verbatim in the language of the source document — never translate or reword it. Folder names are written in {{OUTPUT_LANGUAGE}} (lowercase kebab-case, transliterated).
```

`init` replaces `{{OUTPUT_LANGUAGE}}` with the chosen language's English name (default `English`), alongside the existing `{{WIKI_TITLE}}`/`{{SLUG}}` replacement. The template stays compliant with `Project Vision/06_citation_and_provenance.md` and `03_DOX_concept_detailed.md` (root AGENTS.md, `templates/` index entry).

### 3.7 `init` Command and Init Screen

**`src/commands/init.ts`** — additive option:

```typescript
init(slug, { title?, workspace?, outputLanguage?: LanguageCode })
```

Writes the Language section into the generated `AGENTS.md` and persists `.state/language.json`. CLI: `init <slug> --output-language da`.

**`src/tui/init-screen.tsx`** — add an "Output Language" selector (dropdown of the 7 supported languages, English pre-selected) below the Workspace field. Title and Workspace remain the only text inputs (user decision 2026-07-18).

### 3.8 Extractor

**`src/agents/extractor.ts`** — `extractChunk(..., options?)` gains additive `language?: { input: LanguageCode; output: LanguageCode }`. The prompt fill includes `languageDirective: buildLanguageDirective('extractor', input, output)`, and `normalizeExtractorSlugs(parsed, input)` uses the input language. Absent `language` → `{ en, en }` → empty directive and byte-identical slug normalization.

### 3.9 Synthesis Writer

**`src/agents/synthesis.ts`** — all four functions (`writeEntitySynthesis`, `writePermissiveEntitySynthesis`, `writeTopicSynthesis`, `writePermissiveTopicSynthesis`) gain an additive language option and fill `languageDirective` with `buildLanguageDirective('synthesis', input, output)`.

### 3.10 DOX Writer

**`src/dox-writer.ts`** — `writeDoxContracts(wikiSlug, options?)` gains an additive `language?: { input: LanguageCode; output: LanguageCode }`; the LLM prompt fill includes `languageDirective: buildLanguageDirective('dox', input, output)`. Deterministic mode (no LLM) is unaffected.

### 3.11 `ingest` Command

**`src/commands/ingest.ts`** — additive options `inputLanguage?: LanguageCode`, `outputLanguage?: LanguageCode`. Resolution order at run start:

1. **Output language:** CLI flag → `.state/language.json` → `'en'`.
2. **Input language:** CLI flag → `lastInputLanguage` from `.state/language.json` → `'en'`.

The resolved pair is threaded into the Extractor, Synthesis Writer, and DOX Writer calls. After the run, `lastInputLanguage` is persisted.

**Input-language-change warning:** if `.state/extracted/` already contains JSON and the resolved input language differs from `lastInputLanguage`, log a visible warning before processing (vision `04` §9.3 slug-forking caution):

```
Warning: input language 'da' differs from the last run ('en'). Re-ingesting the same
names under a different language can create duplicate pages (slug forking).
```

CLI: `ingest <slug> --input-language da [--output-language en]`.

### 3.12 TUI Ingest Screen

**`src/tui/ingest-screen.tsx`** — two dropdown selectors before the ingest starts (user decision 2026-07-17: core workflows must be doable from the TUI):

- **Input Language** — the 7 supported languages; pre-selected with `lastInputLanguage`.
- **Output Language** — the 7 supported languages; pre-selected with the wiki's `outputLanguage`.

When the user picks an input language that differs from `lastInputLanguage` and the wiki already has extractions, show the slug-forking warning inline and require an explicit confirm before starting.

---

## 4. Technical Approval Gates

All gates are deterministic and LLM-free (the existing test-only injections — `extractChunkFn`, `synthesize*Fn`, `writeDoxIndexFn` — make live calls unnecessary). A live Danish smoke test runs in UAT, not in the gates.

### Gate 7.1: Transliteration Maps Are Correct

```typescript
test('transliteration maps per language', () => {
  expect(slugify('Søren Møller', 'da')).toBe('soeren-moeller');
  expect(slugify('København', 'da')).toBe('koebenhavn');
  expect(slugify('Årsrapport 2024', 'da')).toBe('aarsrapport-2024');
  expect(slugify('Müller GmbH', 'de')).toBe('mueller-gmbh');
  expect(slugify('Straße', 'de')).toBe('strasse');
  expect(slugify('Göteborg', 'sv')).toBe('goteborg');
  expect(slugify('François Migné', 'fr')).toBe('francois-migne');
});
```

**Pass Criteria:** Every expectation holds.

### Gate 7.2: English Default Is Byte-Identical

```typescript
test('no language set behaves exactly as before', () => {
  expect(slugify('Søren Møller')).toBe('s-ren-m-ller');   // documents pre-existing ASCII-only behavior
  expect(slugify('Annual Report 2024')).toBe('annual-report-2024');
  expect(buildLanguageDirective('extractor', 'en', 'en')).toBe('');
  expect(buildLanguageDirective('synthesis', 'en', 'en')).toBe('');
  expect(buildLanguageDirective('dox', 'en', 'en')).toBe('');
});
```

**Pass Criteria:** Existing behavior is unchanged when no language is set; the whole pre-Phase-7 test suite stays green without modification.

### Gate 7.3: Extractor Slug Normalization Uses the Input Language

```typescript
test('normalizeExtractorSlugs transliterates with input language', () => {
  const data = { entities: [{ slug: 'Søren Møller', /* ... */ }], relationships: [], claims: [], timeline: [] };
  normalizeExtractorSlugs(data, 'da');
  expect(data.entities[0].slug).toBe('soeren-moeller');
});
```

**Pass Criteria:** LLM-provided slugs with Danish characters normalize to transliterated kebab-case.

### Gate 7.4: Language Directive Reaches Every Prompt

```typescript
test('extractor/synthesis/dox prompts contain the directive when languages are set', async () => {
  // Mock or stub callLLM (or use the writeDoxIndexFn injection for the DOX Writer)
  // and capture the filled prompt for each agent with { input: 'da', output: 'en' }.
  expect(extractorPrompt).toContain('Danish');
  expect(synthesisPrompt).toContain('English');
  expect(doxPrompt).toContain('English');
});
```

**Pass Criteria:** Each of the three roles fills `{languageDirective}`; no prompt reaches the LLM with a raw `{languageDirective}` placeholder.

### Gate 7.5: Language State Round-Trip

```typescript
test('init and ingest persist language state', async () => {
  await init('dk-wiki', { outputLanguage: 'da' });
  expect(readFileSync('wikis/dk-wiki/AGENTS.md', 'utf-8')).toContain('Danish');
  const state = await readWikiLanguage('wikis/dk-wiki');
  expect(state.outputLanguage).toBe('da');

  await ingest('dk-wiki', { inputLanguage: 'da', extractChunkFn: stub });
  expect((await readWikiLanguage('wikis/dk-wiki')).lastInputLanguage).toBe('da');
});
```

**Pass Criteria:** The constitution records the output language and `.state/language.json` round-trips.

### Gate 7.6: End-to-End Danish Ingest (LLM-Free)

```typescript
test('Danish PDF materializes transliterated pages with verbatim Danish titles', async () => {
  // init en-wiki; copy golden-master-da.pdf; ingest with inputLanguage: 'da'
  // and an injected extractChunkFn returning Danish entities ('Søren Møller', 'København').
  expect(existsSync('wikis/en-wiki/entities/people/soeren-moeller.md')).toBe(true);
  const page = readFileSync('wikis/en-wiki/entities/people/soeren-moeller.md', 'utf-8');
  expect(page).toContain('title: "Søren Møller"');   // title stays verbatim
});
```

**Pass Criteria:** File names are transliterated; page titles keep the original Danish name.

### Gate 7.7: Cross-Language Synthesis Passes Preservation

```typescript
test('English Layer 1 + verbatim Danish Layer 2 passes the preservation check', async () => {
  // ingest with inputLanguage 'da', outputLanguage 'en', synthesis on,
  // injected synthesizeEntityFn returning English prose + the exact Danish structured detail.
  const result = await ingest('en-wiki', { inputLanguage: 'da', synthesis: true, extractChunkFn: stub, synthesizeEntityFn: englishProseDanishDetail });
  expect(result.extractions).toBeDefined();
  const page = readFileSync('wikis/en-wiki/entities/people/soeren-moeller.md', 'utf-8');
  expect(page).toContain(danishClaimText);            // Layer 2 verbatim
  expect(result.validation).toBeDefined();            // no preservation fallback occurred
});
```

**Pass Criteria:** The strict synthesis path is kept (no fallback, no conflict logged) and the Danish claim text appears verbatim on the page.

### Gate 7.8: Input-Language-Change Warning Fires

```typescript
test('ingest warns when input language differs from the last run', async () => {
  await ingest('test-wiki', { extractChunkFn: stub });                    // first run: en
  const spy = vi.spyOn(console, 'log');
  await ingest('test-wiki', { inputLanguage: 'da', extractChunkFn: stub });
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('differs from the last run'));
});
```

**Pass Criteria:** The slug-forking warning is logged (and shown in the TUI with a confirm gate).

---

## 5. User Acceptance Tests (UAT)

### UAT 7.1: I can ingest a Danish PDF into an English wiki (TUI)

1. `npx tsx src/cli.ts` → Create New Wiki (Title: `Danish Test`, Output Language: English).
2. Add PDFs → pick `test-pdfs/golden-master-da.pdf` via the native picker.
3. Start ingesting → set **Input Language: Dansk**, **Output Language: English**.

**Expected:** The ingest completes. `entities/people/soeren-moeller.md` (transliterated file name) exists; the page title is "Søren Møller" (verbatim Danish). With synthesis on, Layer 1 reads as English prose while `## Mentions` / `## Claims` keep the Danish text. `index.md` descriptions are in English.

### UAT 7.2: I can create a Danish-output wiki (CLI)

```bash
npx tsx src/cli.ts init dk-wiki --title "Dansk Wiki" --output-language da
cp test-pdfs/golden-master-da.pdf wikis/dk-wiki/raw/
npx tsx src/cli.ts ingest dk-wiki --input-language da --synthesis
```

**Expected:** `wikis/dk-wiki/AGENTS.md` states the output language is Danish. Entity pages have Danish Layer 1 prose with verbatim Danish Layer 2 detail; `index.md` files are in Danish; slugs are transliterated (`soeren-moeller.md`, `koebenhavn.md`).

### UAT 7.3: I am warned when switching input language

1. After UAT 7.1, run a second ingest with **Input Language: English** in the TUI (or `--input-language en` on the CLI).

**Expected:** The slug-forking warning appears before processing starts; the TUI requires explicit confirmation.

### UAT 7.4: I can browse the mixed wiki in Obsidian

Open `wikis/dk-wiki/` (or the UAT 7.1 wiki) as an Obsidian vault.

**Expected:** Navigation works from `index.md`; page titles show Danish names correctly (æ/ø/å render); file names are readable transliterations; clicking a citation leads to a source page for `golden-master-da.pdf`.

---

## 6. TUI Updates for This Phase

### 6.1 Init Screen: Output Language Selector

**File:** `src/tui/init-screen.tsx`

```
╔══════════════════════════════════════╗
║  Create New Wiki                     ║
╠══════════════════════════════════════╣
║  Title: [Danish Test          ]      ║
║  Workspace: [./wikis          ]      ║
║  Output Language: [English ▼]        ║
╠══════════════════════════════════════╣
║  [ Create ]  [ Back ]                ║
╚══════════════════════════════════════╝
```

**Behavior:** Dropdown with the 7 supported languages (English pre-selected). The wiki slug is still derived from the Title via `slugify` (user decision 2026-07-18). The choice is written into the wiki constitution and `.state/language.json`.

### 6.2 Ingest Screen: Input/Output Language Selectors

**File:** `src/tui/ingest-screen.tsx`

```
╔══════════════════════════════════════╗
║  Ingest PDFs — danish-test           ║
╠══════════════════════════════════════╣
║  Input Language:  [Dansk   ▼]        ║
║  Output Language: [English ▼]        ║
║                                        ║
║  ⚠ Input language differs from the     ║
║    last run (English). Slug forking    ║
║    can duplicate pages.                ║
╠══════════════════════════════════════╣
║  [ Start Ingest ]  [ Back ]          ║
╚══════════════════════════════════════╝
```

**Behavior:**
- Input Language defaults to the wiki's `lastInputLanguage`; Output Language defaults to the wiki's `outputLanguage`.
- The warning block appears only when the chosen input language differs from the last run **and** the wiki already has extractions; starting then requires an explicit confirm.
- Both selectors are keyboard-navigable dropdowns; no typed paths or codes (user decision 2026-07-17 on TUI-friendly workflows).

---

## 7. Approval Checklist

Before moving to Phase 8, verify:

- [ ] All 8 technical gates pass (`npm test` is green).
- [ ] All 4 UAT steps pass (manual verification).
- [ ] Transliteration maps are correct for all 7 supported languages.
- [ ] English default behavior is byte-identical (Gate 7.2; no pre-Phase-7 test was modified).
- [ ] All six prompt templates carry `{languageDirective}` and every agent fills it before the call.
- [ ] The wiki constitution records the output language; `.state/language.json` round-trips.
- [ ] Layer 1 in the output language, Layer 2 verbatim in the source language — cross-language synthesis passes the preservation check (Gate 7.7).
- [ ] The slug-forking warning fires on input-language change (Gate 7.8).
- [ ] **TUI init screen has the Output Language selector; ingest screen has both selectors with the confirm-gated warning.**
- [ ] `test-pdfs/golden-master-da.pdf` created once, SHA-256 recorded, never regenerated.
- [ ] **(v1.1.0)** Bounded retry: transient transport failures retried ≤3 attempts everywhere; synthesis and DOX quality failures retried ≤3 before fallback; deterministic failures (invalid JSON, schema, 4xx) never retried (gates 7.10–7.12).
- [ ] Total LLM cost for this phase is under $3.00 and logged in `.state/phase-7-status.json`.
- [ ] No code exists for multi-PDF compounding (Phase 8) or the AGENTS.md updater (Phase 9).

---

## 8. Integration Notes

### What Phase 7 Depends On (from Phase 6)
- The complete ingest pipeline: extraction, Extractor, Materializer, Synthesis Writer, validation, DOX Writer.
- The prompt-file + `{single-brace}` placeholder pattern and the `{{DOUBLE_BRACE}}` init-time template pattern.
- The test-only LLM injections (`extractChunkFn`, `synthesize*Fn`, `writeDoxIndexFn`) that make the gates LLM-free.
- The `.state/` module pattern for per-wiki state.

### What Phase 7 Produces (for Phase 8)
- Per-wiki language metadata (`.state/language.json`): `outputLanguage`, `lastInputLanguage`.
- Language-aware `slugify` / `normalizeExtractorSlugs` used by every extraction.
- Language directives threaded through all three LLM roles.

### Contract with Phase 8
Phase 8 (multi-PDF compounding) expects:
- A wiki that may contain content extracted under more than one input language.
- `.state/language.json` as the record of which input language the last run used.

Phase 8 must carry language metadata through incremental ingestion: re-processing a changed PDF uses the current run's input language, and if that differs from the language the PDF was originally extracted under, Phase 8's conflict/warning framework surfaces it (slug-forking risk, vision `04` §9.3).

### Isolation Testing
Every component is testable in isolation:
```typescript
slugify('København', 'da');                       // pure function
buildLanguageDirective('synthesis', 'da', 'en');  // pure function
await readWikiLanguage('wikis/test');             // state module only
```
Pipeline-level gates use the existing injections (`extractChunkFn`, `synthesize*Fn`, `writeDoxIndexFn`) — no live LLM calls in the gate suite.

---

## 9. v1.1.0 Amendment: Bounded Retry (user-ratified 2026-07-20)

Ratified via the contradiction protocol (compliance-log [2026-07-20 23:05]). Amends vision `04` §6 and `07` §5, which previously stated "the system does not retry". The amendment distinguishes failure classes:

- **Deterministic failures — never retried:** invalid Extractor JSON, schema-validation errors, HTTP 4xx. These fail immediately (the Phase 2 no-retry rule is unchanged for this class).
- **Transient transport failures — bounded retry:** HTTP 429/5xx, network errors, timeouts. Retried with backoff, up to 3 total attempts per call, each attempt logged.
- **Quality failures — bounded retry before fallback:** a synthesis page failing the preservation check, or a DOX Writer response that is unparseable or missing required sections. Up to 3 total attempts per page/folder before the deterministic fallback (structured template / deterministic index body). Rationale: these failures are partly LLM variance (UAT 7.2: identical extraction data produced 0 and 3 fallbacks in two runs).

### What to Build

- **`src/llm/client.ts`** — additive `CallLLMOptions.maxRetries?: number` (default `0`, preserving the frozen no-retry behavior for every existing caller). Only transient failures (429/5xx, undici network errors) are retried, with backoff; 4xx and successful responses never retry. Pipeline callers (extractor, synthesis ×4, DOX writer ×2) pass `maxRetries: 2` (3 total attempts).
- **`src/commands/ingest.ts`** — the synthesis chain retries each mode up to 3 total attempts on preservation failure before moving to the next mode: strict (≤3) → permissive (≤3) → structured template. Attempt counts are recorded in `synthesis-report.json` alongside the existing mode fields.
- **`src/dox-writer.ts`** — the per-folder LLM path and the workspace pass retry up to 3 total attempts on exception or unparseable/missing-section output before writing the deterministic contract.

### Gate 7.10: `callLLM` Retries Only Transient Failures

```typescript
test('callLLM retries 5xx with backoff, never 4xx, default is no retry', async () => {
  // Mock undici's request: 529, 529, then 200 → resolves on the 3rd attempt.
  // A 400 throws after exactly 1 attempt. Default options (maxRetries omitted)
  // make exactly 1 attempt on 529.
});
```

**Pass Criteria:** Transient → retried to success; deterministic → immediate throw; default behavior unchanged.

### Gate 7.11: Synthesis Chain Retries Quality Failures

```typescript
test('strict synthesis retries up to 3 before permissive, permissive up to 3 before template', async () => {
  // ingest with stubs: strict stub fails preservation twice then passes →
  // page written as strict-synthesis with 3 attempts recorded.
  // Second wiki: strict fails 3×, permissive fails 3× → structured-template
  // fallback, conflict logged, 6 total attempts recorded.
});
```

**Pass Criteria:** Retry counts and fallback chain match; `synthesis-report.json` records attempts.

### Gate 7.12: DOX Writer Retries Before Deterministic Fallback

```typescript
test('DOX writer retries unparseable output up to 3 attempts before fallback', async () => {
  // writeDoxIndexFn stub returns garbage twice then a valid contract →
  // the LLM body is used, 3 attempts made.
  // Second folder/wiki: stub always throws → deterministic contract after
  // exactly 3 attempts.
});
```

**Pass Criteria:** Attempt counts and fallback behavior match; deterministic enforcement (children/statistics) unaffected.

---

## 10. LLM Cost and Model Guidance (was §9)

- Use the project's default Anthropic model (configurable via `ANTHROPIC_MODEL`).
- The only live LLM usage in this phase is the Danish UAT smoke test: one 2-page fixture = one chunk, plus a few synthesis/DOX calls. Budget $3.00 hard cap; pause at $2.40 (80%) and report.
- Log every call: `LLM Call | Tokens: i/o | Cost: $x` via the existing `callLLM` client.
- Store total Phase 7 LLM cost in `.state/phase-7-status.json`.
