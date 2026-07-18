# Phase 5: Synthesis Writer (Layer 5)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-005`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $15.00 (hard cap)

---

## 1. Objective

Add the Synthesis Writer: an optional LLM call that turns structured entity, topic, and document pages into readable two-layer pages with LLM-written synthesis at the top and preserved detail below. This makes the wiki readable, not just a data dump. The Synthesis Writer runs per page after the Materializer has aggregated the data, and before the DOX Writer describes the final wiki.

---

## 2. Pipeline Placement

```
Extract PDFs → Extractor → Materializer → Synthesis Writer → Validate content pages → DOX Writer → Re-validate wiki
```

The Synthesis Writer runs after materialization and before the final content-page validation. This ensures the DOX Writer (Phase 6) can describe the fully synthesized pages.

---

## 3. What to Build

### 3.1 Synthesis Prompts

#### Entity Synthesis Prompt

**File:** `prompts/synthesis.prompt.txt`

```
You are an investigative research assistant writing a wiki article for an entity.

=== ENTITY DATA ===
Name: {entityName}
Type: {entityType}
Significance: {significance}
Disambiguation: {disambiguation}
Mentions:
{mentions}

Relationships:
{relationships}

Claims:
{claims}

Timeline:
{timeline}

Chunk Context:
{context}

=== TASK ===
Write a readable markdown article about this entity. The article must be completely self-contained and pass the "Journalist Test": a reader who has never seen the original PDFs must be able to explain this entity to a colleague, cite three specific facts with sources, and name two related entities.

The article must have two layers:

Layer 1 (Synthesis): 2-4 paragraphs of readable prose that tell the story of this entity. This is NOT a bullet list. It must include:
- Narrative flow: who/what this entity is and why they matter.
- Chronological context: explicit dates and timeline of events (use the Timeline data).
- Cross-reference context: how this entity fits the broader story (use the Chunk Context).
- Disambiguation: clarify if the name is ambiguous (use the Disambiguation data).
- Key claims, relationships, and significance (use the Significance data).
- Every factual claim must have a citation [^srcN].

Layer 2 (Preserved Detail): Below the synthesis, include the following sections:
- ## Mentions (list every mention with page number, exact quote, and citation)
- ## Relationships (list every relationship with evidence and citation)
- ## Claims (list every claim organized by type, with citation)
- ## Timeline (chronological list of events involving this entity, with citations)
- ## Sources (list all source definitions)

Rules:
- Do not drop any mention, relationship, claim, or timeline event from the data above.
- Do not invent facts not present in the data.
- Every citation [^srcN] must have a corresponding [^srcN]: definition in the Sources section.
- Use [[Page Title]] wikilinks for related entities.
- Write in clear, plain language suitable for a journalist.
- The page must be at least 300 words of synthesis (Layer 1) and no more than 2000 words total.
```

#### Topic Synthesis Prompt

**File:** `prompts/synthesis-topic.prompt.txt`

```
You are an investigative research assistant writing a wiki article for a topic or theme.

=== TOPIC DATA ===
Topic: {topicName}
Related Entities: {entities}
Claims:
{claims}

Sources:
{sources}

Chunk Context:
{context}

=== TASK ===
Write a readable markdown article about this topic. The article must be completely self-contained and pass the "Journalist Test": a reader who has never seen the original PDFs must be able to explain this topic to a colleague, cite three specific facts with sources, and name two related entities.

The article must have two layers:

Layer 1 (Synthesis): 2-4 paragraphs of readable prose that explain how this topic appears across the corpus, why it matters, and how it relates to key entities. This is NOT a bullet list. It must include:
- Narrative flow: what this topic is and why it matters.
- Cross-reference context: how this topic connects to broader themes and entities.
- Key claims and relationships (use the Claim data).
- Every factual claim must have a citation [^srcN].

Layer 2 (Preserved Detail): Below the synthesis, include the following sections:
- ## Claims (list every claim related to this topic, organized by source and page, with citation)
- ## Sources (list all source definitions)

Rules:
- Do not drop any claim from the data above.
- Do not invent facts not present in the data.
- Every citation [^srcN] must have a corresponding [^srcN]: definition in the Sources section.
- Use [[Page Title]] wikilinks for related entities.
- Write in clear, plain language suitable for a journalist.
- The page must be at least 300 words of synthesis (Layer 1).
```

#### Document Synthesis Prompt

**File:** `prompts/synthesis-document.prompt.txt`

```
You are an investigative research assistant writing a summary of a document chunk.

=== DOCUMENT DATA ===
Document Title: {title}
Source File: {sourceFile}
Page Range: {pageRange}
Extracted Text:
{extractedText}

Entities Mentioned:
{entities}

Claims in this Chunk:
{claims}

=== TASK ===
Write a readable markdown summary of this document chunk. The summary must be self-contained: a reader should understand what this chunk contains without reading the original PDF.

The page must have two layers:

Layer 1 (Synthesis): 2-4 paragraphs of readable prose at the top of the page that summarize:
- What this chunk is and where it comes from.
- The key entities, claims, and events discussed.
- Why this chunk matters in the broader corpus.
- Every factual claim must have a citation [^srcN].

Layer 2 (Preserved Detail): Below the synthesis, preserve the original extracted text, including:
- ## Extracted Text (the full text of the chunk, organized by headings)
- ## Tables (any tables preserved verbatim as markdown tables)
- ## Figures (descriptions of any figures or images)
- ## Sources (source definitions)

Rules:
- Do not drop any extracted text, table, or figure description from the data above.
- Do not invent facts not present in the data.
- Every citation [^srcN] must have a corresponding [^srcN]: definition in the Sources section.
- Use [[Page Title]] wikilinks for mentioned entities.
- Write in clear, plain language suitable for a journalist.
- The page must be at least 300 words of synthesis (Layer 1).
```

### 3.2 Synthesis Agent

**File:** `src/agents/synthesis.ts`

```typescript
async function writeEntitySynthesis(
  entityData: EntityPageData,
  agentsMd: string
): Promise<string>;

async function writeTopicSynthesis(
  topicData: TopicPageData,
  agentsMd: string
): Promise<string>;

async function writeDocumentSynthesis(
  documentData: DocumentPageData,
  agentsMd: string
): Promise<string>;
```

**Implementation:**
1. Read the appropriate prompt for the page type (`synthesis.prompt.txt`, `synthesis-topic.prompt.txt`, or `synthesis-document.prompt.txt`).
2. Replace placeholders with the page data.
3. Call `callLLM(prompt)`.
4. Return the markdown string.

### 3.3 Preservation Check

**File:** `src/validation/preservation-check.ts`

```typescript
interface PreservationCheckResult {
  passed: boolean;
  droppedMentions: string[];
  droppedRelationships: string[];
  droppedClaims: string[];
  droppedCitations: string[];
}

function checkPreservation(
  originalData: EntityPageData,
  writtenPage: string
): PreservationCheckResult;
```

**Algorithm:**

For entity pages:
1. Check that every `mention.context` from the original data appears in the written page.
2. Check that every `relationship.evidence` appears in the written page.
3. Check that every `claim.text` appears in the written page.
4. Check that every existing citation `[^srcN]` from the previous version is still present.

For topic pages:
1. Check that every `claim.text` from the original data appears in the written page.
2. Check that every existing citation `[^srcN]` is still present.

For document pages:
1. Check that the full extracted text (or its tables and figure descriptions) is still present.
2. Check that every existing citation `[^srcN]` is still present.
3. Check that no factual claims were materially altered.

### 3.4 Integration into `ingest.ts`

After `materialize()` and before the content-page validation, add an optional step:

```typescript
if (config.synthesis) {
  for (const entityPage of entityPages) {
    const structuredData = parseEntityPage(entityPage); // extract data from the structured template
    const synthesized = await writeEntitySynthesis(structuredData, agentsMd);
    const check = checkPreservation(structuredData, synthesized);

    if (check.passed) {
      writeFileSync(entityPage.path, synthesized);
    } else {
      console.warn(`Preservation check failed for ${entityPage.slug}. Keeping structured template.`);
      logConflict(entityPage.slug, check);
    }
  }

  for (const topicPage of topicPages) {
    const structuredData = parseTopicPage(topicPage);
    const synthesized = await writeTopicSynthesis(structuredData, agentsMd);
    const check = checkTopicPreservation(structuredData, synthesized);

    if (check.passed) {
      writeFileSync(topicPage.path, synthesized);
    } else {
      console.warn(`Preservation check failed for ${topicPage.slug}. Keeping structured template.`);
      logConflict(topicPage.slug, check);
    }
  }

  for (const documentPage of documentPages) {
    const structuredData = parseDocumentPage(documentPage);
    const synthesized = await writeDocumentSynthesis(structuredData, agentsMd);
    const check = checkDocumentPreservation(structuredData, synthesized);

    if (check.passed) {
      writeFileSync(documentPage.path, synthesized);
    } else {
      console.warn(`Preservation check failed for ${documentPage.slug}. Keeping structured template.`);
      logConflict(documentPage.slug, check);
    }
  }
}
```

**Default:** `synthesis` is `false` for the first MVP. The journalist can enable it with `llm-wiki-cli ingest --synthesis`.

---

## 4. Technical Approval Gates

### Gate 5.1: Synthesis Returns Readable Markdown

```typescript
test('synthesis returns readable markdown with synthesis', async () => {
  const data = createTestEntityData(); // fake entity data with timeline, context, significance
  const page = await writeEntitySynthesis(data, 'AGENTS.md content');
  expect(page).toContain('## Mentions');
  expect(page).toContain('## Relationships');
  expect(page).toContain('## Claims');
  expect(page).toContain('## Timeline');
  expect(page).toContain('## Sources');
  // Synthesis should be at the top, before the first heading
  const firstHeading = page.indexOf('##');
  const synthesisLength = firstHeading > 0 ? firstHeading : page.length;
  expect(synthesisLength).toBeGreaterThan(300); // synthesis is at least 300 words
  // Check for chronological context
  expect(page).toContain(data.timeline[0].date);
  // Check for significance
  expect(page).toContain(data.significance);
});
```

**Pass Criteria:** Page has synthesis at top, then structured sections.

### Gate 5.2: Synthesis Includes All Mentions

```typescript
test('synthesis includes all mentions from data', async () => {
  const data = createTestEntityData();
  const page = await writeEntitySynthesis(data, 'AGENTS.md content');
  for (const m of data.mentions) {
    expect(page).toContain(m.context);
  }
});
```

**Pass Criteria:** Every mention context appears in the written page.

### Gate 5.3: Synthesis Includes All Relationships

```typescript
test('synthesis includes all relationships from data', async () => {
  const data = createTestEntityData();
  const page = await writeEntitySynthesis(data, 'AGENTS.md content');
  for (const r of data.relationships) {
    expect(page).toContain(r.evidence);
  }
});
```

**Pass Criteria:** Every relationship evidence appears in the written page.

### Gate 5.4: Synthesis Includes All Claims

```typescript
test('synthesis includes all claims from data', async () => {
  const data = createTestEntityData();
  const page = await writeEntitySynthesis(data, 'AGENTS.md content');
  for (const c of data.claims) {
    expect(page).toContain(c.text);
  }
});
```

**Pass Criteria:** Every claim text appears in the written page.

### Gate 5.5: Preservation Check Catches Drops

```typescript
test('preservation check catches dropped content', async () => {
  const data = createTestEntityData();
  const badPage = 'This page is missing most content.';
  const check = checkPreservation(data, badPage);
  expect(check.passed).toBe(false);
  expect(check.droppedMentions.length).toBeGreaterThan(0);
});
```

**Pass Criteria:** Preservation check fails when content is dropped.

### Gate 5.6: Preservation Check Passes for Good Output

```typescript
test('preservation check passes for complete output', async () => {
  const data = createTestEntityData();
  const goodPage = buildCompletePage(data); // deterministic builder
  const check = checkPreservation(data, goodPage);
  expect(check.passed).toBe(true);
});
```

**Pass Criteria:** Preservation check passes when all content is present.

### Gate 5.7: Synthesis Does Not Run by Default

```typescript
test('synthesis does not run without --synthesis flag', async () => {
  await ingest('test-wiki'); // no --synthesis
  const page = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');
  // Check that page is structured template, not synthesized prose
  expect(page.indexOf('## Mentions')).toBeLessThan(100); // mentions section is near top
});
```

**Pass Criteria:** Without `--synthesis`, pages remain structured templates.

### Gate 5.8: Topic Synthesis Returns Readable Markdown

```typescript
test('topic synthesis returns readable markdown with synthesis', async () => {
  const data = createTestTopicData(); // fake topic data with claims and related entities
  const page = await writeTopicSynthesis(data, 'AGENTS.md content');
  expect(page).toContain('## Claims');
  expect(page).toContain('## Sources');
  // Synthesis should be at the top, before the first heading
  const firstHeading = page.indexOf('##');
  const synthesisLength = firstHeading > 0 ? firstHeading : page.length;
  expect(synthesisLength).toBeGreaterThan(300); // synthesis is at least 300 words
});
```

**Pass Criteria:** Topic page has synthesis at top, then structured sections.

### Gate 5.9: Topic Synthesis Includes All Claims

```typescript
test('topic synthesis includes all claims from data', async () => {
  const data = createTestTopicData();
  const page = await writeTopicSynthesis(data, 'AGENTS.md content');
  for (const c of data.claims) {
    expect(page).toContain(c.text);
  }
});
```

**Pass Criteria:** Every claim text appears in the written topic page.

### Gate 5.10: Document Synthesis Returns Readable Markdown

```typescript
test('document synthesis returns readable markdown with synthesis', async () => {
  const data = createTestDocumentData(); // fake document chunk with extracted text
  const page = await writeDocumentSynthesis(data, 'AGENTS.md content');
  expect(page).toContain('## Extracted Text');
  expect(page).toContain('## Sources');
  // Synthesis should be at the top, before the first heading
  const firstHeading = page.indexOf('##');
  const synthesisLength = firstHeading > 0 ? firstHeading : page.length;
  expect(synthesisLength).toBeGreaterThan(300); // synthesis is at least 300 words
});
```

**Pass Criteria:** Document page has synthesis at top, then preserved extracted text.

### Gate 5.11: Document Synthesis Preserves Extracted Text

```typescript
test('document synthesis preserves extracted text from data', async () => {
  const data = createTestDocumentData();
  const page = await writeDocumentSynthesis(data, 'AGENTS.md content');
  expect(page).toContain(data.extractedText);
});
```

**Pass Criteria:** The original extracted text is preserved in the synthesized document page.

### Gate 5.12: Preservation Check Catches Dropped Topic Claims

```typescript
test('topic preservation check catches dropped claims', async () => {
  const data = createTestTopicData();
  const badPage = 'This topic is important.';
  const check = checkTopicPreservation(data, badPage);
  expect(check.passed).toBe(false);
  expect(check.droppedClaims.length).toBeGreaterThan(0);
});
```

**Pass Criteria:** Topic preservation check fails when claims are dropped.

### Gate 5.13: Preservation Check Catches Dropped Document Text

```typescript
test('document preservation check catches dropped text', async () => {
  const data = createTestDocumentData();
  const badPage = 'This document contains information.';
  const check = checkDocumentPreservation(data, badPage);
  expect(check.passed).toBe(false);
  expect(check.droppedText.length).toBeGreaterThan(0);
});
```

**Pass Criteria:** Document preservation check fails when extracted text is dropped.

---

## 5. User Acceptance Tests (UAT)

### UAT 5.1: I can enable synthesis

```bash
npx tsx src/cli.ts ingest test-wiki --synthesis
```

**Expected:** Console shows "Writing synthesis for 5 content page(s)..." and progress. After completion, entity, topic, and document pages have readable prose at the top.

### UAT 5.2: I can read a synthesized entity page

Open `wikis/test-wiki/entities/people/executives/john-smith.md`.

**Expected:** The page starts with 2-4 paragraphs of readable prose (the synthesis). Below that, I see the "Mentions", "Relationships", and "Claims" sections with all the raw data preserved.

### UAT 5.3: Preservation check protects my data

If the Synthesis Writer drops a mention, the system should keep the structured template.

**Expected:** Console shows a warning like "Preservation check failed for john-smith. Keeping structured template." The entity page is not corrupted.

### UAT 5.4: Synthesis cost is reasonable

Check the console output after `ingest --synthesis`.

**Expected:** Cost per content page is under $0.05. Total cost scales with the number of entity, topic, and document pages synthesized.

### UAT 5.5: I can read a synthesized topic page

Open `wikis/test-wiki/topics/financial/revenue-recognition.md` (or a topic generated from the test corpus).

**Expected:** The page starts with 2-4 paragraphs of readable prose explaining the topic across the corpus. Below that, I see a "Claims" section with every related claim preserved.

### UAT 5.6: I can read a synthesized document page

Open `wikis/test-wiki/documents/<source-slug>-part-001.md`.

**Expected:** The page starts with 2-4 paragraphs summarizing the chunk. Below that, I see the preserved extracted text, tables, and figure descriptions.

---

## 6. TUI Updates for This Phase

### 6.1 `synthesis-toggle.tsx` (Settings Sub-screen)

**File:** `src/tui/settings-screen.tsx`

Add a synthesis toggle to the settings screen:

```
╔══════════════════════════════════════╗
║  Settings                            ║
╠══════════════════════════════════════╣
║  Chunk Size: [5          ]           ║
║  LLM Provider: [Fable    ]           ║
║  Synthesis: [ON ] / OFF                ║
║  Update Agents: ON / [OFF]             ║
╠══════════════════════════════════════╣
║  [ Save ]  [ Back ]                  ║
╚══════════════════════════════════════╝
```

**Behavior:**
- Toggles saved to `.llm-wiki-cli.json`.
- When "Synthesis" is ON, the `ingest` screen shows a checkbox for "Enable synthesis" that is pre-checked.

### 6.2 `ingest-screen.tsx` Update

Add a checkbox for synthesis:
```
║  [✓] Enable Synthesis                ║
```

When checked, `ingest` runs with `--synthesis`.

### 6.3 Menu Updates

No new menu items. Settings screen is updated.

---

## 7. Approval Checklist

Before moving to Phase 6, verify:

- [ ] All 13 technical gates pass (`npm test` is green).
- [ ] All 6 UAT steps pass (manual verification).
- [ ] Entity synthesis returns readable markdown with synthesis (300+ words).
- [ ] Topic synthesis returns readable markdown with synthesis (300+ words).
- [ ] Document synthesis returns readable markdown with synthesis (300+ words).
- [ ] All mentions, relationships, claims, AND timeline events are preserved on entity pages.
- [ ] All claims are preserved on topic pages.
- [ ] Extracted text, tables, and figure descriptions are preserved on document pages.
- [ ] Entity synthesis includes chronological context from timeline data.
- [ ] Entity synthesis includes entity significance.
- [ ] Entity synthesis includes disambiguation when provided.
- [ ] Preservation check catches dropped content for entity, topic, and document pages.
- [ ] Preservation check passes for complete output for all three page types.
- [ ] Synthesis is opt-in (`--synthesis` flag), not default.
- [ ] **TUI Settings screen has a Synthesis toggle.**
- [ ] Total LLM cost for this phase is under $15.00 (increased for richer output across three page types).
- [ ] No code exists for the DOX Writer (Phase 6) or multi-PDF compounding.

---

## 8. Integration Notes

### What Phase 5 Depends On (from Phase 4)
- Complete wiki with structured entity, topic, and document pages.
- Validated links and citations on content pages.
- Rolling memory is up to date after materialization.

### What Phase 5 Produces (for Phase 6)
- Optional synthesized entity, topic, and document pages.
- Preservation check framework for all three page types.
- Fully finalized wiki pages ready for DOX contract generation.

### Contract with Phase 6
Phase 6 (DOX Writer) expects:
- Entity, topic, and document pages exist (structured or synthesized).
- Preservation check framework is in place.
- Content pages are finalized before DOX contracts are written.

Phase 6 writes the rich `index.md` navigation contracts that describe the finalized pages.

### Isolation Testing
The Synthesis Writer can be tested in isolation:
```typescript
import { writeEntitySynthesis } from './src/agents/synthesis';

const data = {
  title: 'Test Entity',
  mentions: [{ page: 1, context: 'Test mention' }],
  relationships: [],
  claims: []
};

const page = await writeEntitySynthesis(data, 'AGENTS.md');
```

No filesystem, no pipeline. Just the function and the LLM.
