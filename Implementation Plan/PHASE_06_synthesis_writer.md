# Phase 6: Synthesis Writer (Layer 5)

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-006`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $10.00 (hard cap)

---

## 1. Objective

Add the Writer agent: an optional LLM call that turns structured entity pages into readable two-layer pages with LLM-written synthesis at the top and preserved detail below. This makes the wiki readable, not just a data dump. The Writer runs per entity page after the Materializer has aggregated the data.

---

## 2. What to Build

### 2.1 Writer Prompt

**File:** `prompts/writer.prompt.txt`

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

### 2.2 Writer Agent

**File:** `src/agents/writer.ts`

```typescript
async function writeEntitySynthesis(
  entityData: EntityPageData,
  agentsMd: string
): Promise<string>;
```

**Implementation:**
1. Read `prompts/writer.prompt.txt`.
2. Replace placeholders with entity data.
3. Call `callLLM(prompt)`.
4. Return the markdown string.

### 2.3 Preservation Check

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
1. Check that every `mention.context` from the original data appears in the written page.
2. Check that every `relationship.evidence` appears in the written page.
3. Check that every `claim.text` appears in the written page.
4. Check that every existing citation `[^srcN]` from the previous version is still present.

### 2.4 Integration into `ingest.ts`

After `materialize()` and before `writeDoxContracts()`, add an optional step:

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
}
```

**Default:** `synthesis` is `false` for the first MVP. The journalist can enable it with `llm-wiki-cli ingest --synthesis`.

---

## 3. Technical Approval Gates

### Gate 6.1: Writer Returns Readable Markdown

```typescript
test('writer returns readable markdown with synthesis', async () => {
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

### Gate 6.2: Writer Includes All Mentions

```typescript
test('writer includes all mentions from data', async () => {
  const data = createTestEntityData();
  const page = await writeEntitySynthesis(data, 'AGENTS.md content');
  for (const m of data.mentions) {
    expect(page).toContain(m.context);
  }
});
```

**Pass Criteria:** Every mention context appears in the written page.

### Gate 6.3: Writer Includes All Relationships

```typescript
test('writer includes all relationships from data', async () => {
  const data = createTestEntityData();
  const page = await writeEntitySynthesis(data, 'AGENTS.md content');
  for (const r of data.relationships) {
    expect(page).toContain(r.evidence);
  }
});
```

**Pass Criteria:** Every relationship evidence appears in the written page.

### Gate 6.4: Writer Includes All Claims

```typescript
test('writer includes all claims from data', async () => {
  const data = createTestEntityData();
  const page = await writeEntitySynthesis(data, 'AGENTS.md content');
  for (const c of data.claims) {
    expect(page).toContain(c.text);
  }
});
```

**Pass Criteria:** Every claim text appears in the written page.

### Gate 6.5: Preservation Check Catches Drops

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

### Gate 6.6: Preservation Check Passes for Good Output

```typescript
test('preservation check passes for complete output', async () => {
  const data = createTestEntityData();
  const goodPage = buildCompletePage(data); // deterministic builder
  const check = checkPreservation(data, goodPage);
  expect(check.passed).toBe(true);
});
```

**Pass Criteria:** Preservation check passes when all content is present.

### Gate 6.7: Writer Does Not Run by Default

```typescript
test('writer does not run without --synthesis flag', async () => {
  await ingest('test-wiki'); // no --synthesis
  const page = readFileSync('wikis/test-wiki/entities/people/executives/john-smith.md', 'utf-8');
  // Check that page is structured template, not synthesized prose
  expect(page.indexOf('## Mentions')).toBeLessThan(100); // mentions section is near top
});
```

**Pass Criteria:** Without `--synthesis`, pages remain structured templates.

---

## 4. User Acceptance Tests (UAT)

### UAT 6.1: I can enable synthesis

```bash
npx tsx src/cli.ts ingest test-wiki --synthesis
```

**Expected:** Console shows "Writing synthesis for 5 entity pages..." and progress. After completion, entity pages have readable prose at the top.

### UAT 6.2: I can read a synthesized entity page

Open `wikis/test-wiki/entities/people/executives/john-smith.md`.

**Expected:** The page starts with 2-4 paragraphs of readable prose (the synthesis). Below that, I see the "Mentions", "Relationships", and "Claims" sections with all the raw data preserved.

### UAT 6.3: Preservation check protects my data

If the Writer drops a mention, the system should keep the structured template.

**Expected:** Console shows a warning like "Preservation check failed for john-smith. Keeping structured template." The entity page is not corrupted.

### UAT 6.4: Synthesis cost is reasonable

Check the console output after `ingest --synthesis`.

**Expected:** Cost per entity page is under $0.05. Total cost for 5 entity pages is under $0.25.

---



## 5. TUI Updates for This Phase

### 5.1 `synthesis-toggle.tsx` (Settings Sub-screen)

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

### 5.2 `ingest-screen.tsx` Update

Add a checkbox for synthesis:
```
║  [✓] Enable Synthesis                ║
```

When checked, `ingest` runs with `--synthesis`.

### 5.3 Menu Updates

No new menu items. Settings screen is updated.

---

## 6. Approval Checklist

Before moving to Phase 7, verify:

- [ ] All 7 technical gates pass (`npm test` is green).
- [ ] All 4 UAT steps pass (manual verification).
- [ ] Writer returns readable markdown with synthesis (300+ words).
- [ ] All mentions, relationships, claims, AND timeline events are preserved.
- [ ] Synthesis includes chronological context from timeline data.
- [ ] Synthesis includes entity significance.
- [ ] Synthesis includes disambiguation when provided.
- [ ] Preservation check catches dropped content.
- [ ] Preservation check passes for complete output.
- [ ] Writer is opt-in (`--synthesis` flag), not default.
- [ ] **TUI Settings screen has a Synthesis toggle.**
- [ ] Total LLM cost for this phase is under $12.00 (increased for richer output).
- [ ] No code exists for multi-PDF compounding or AGENTS.md updater.

---

## 7. Integration Notes
## 6. Integration Notes

### What Phase 6 Depends On (from Phase 5)
- Complete wiki with structured entity pages.
- Validated links and citations.
- Complete DOX contracts.

### What Phase 6 Produces (for Phase 7)
- Optional synthesized entity pages.
- Preservation check framework.

### Contract with Phase 7
Phase 7 expects:
- Entity pages exist (structured or synthesized).
- Preservation check framework is in place.

Phase 7 adds multi-PDF compounding and rolling memory improvements.

### Isolation Testing
The Writer can be tested in isolation:
```typescript
import { writeEntitySynthesis } from './src/agents/writer';

const data = {
  title: 'Test Entity',
  mentions: [{ page: 1, context: 'Test mention' }],
  relationships: [],
  claims: []
};

const page = await writeEntitySynthesis(data, 'AGENTS.md');
```

No filesystem, no pipeline. Just the function and the LLM.
