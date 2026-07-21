# Phase 9: AGENTS.md Generation and Living Updates

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-009`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0-8
**Estimated Time:** 3-4 hours
**LLM Token Budget:** $2.00 (hard cap)

---

## 1. Objective

Build the AGENTS.md updater: a single LLM call that runs after ingestion completes. It reads the current `AGENTS.md` and the completed wiki structure, then proposes updates to `AGENTS.md` based on what was discovered. The proposal is saved to `.state/proposed-agents.md` for human review. The original `AGENTS.md` is not overwritten automatically.

**Note:** Since `AGENTS.md` is generated automatically at `init` time and the human does not edit it, the updater is the primary mechanism for evolving the document. The human reviews and applies updates, but never writes the initial version.

---

## 2. What to Build

### 2.1 AGENTS.md Updater Prompt

**File:** `prompts/agents-updater.prompt.txt`

```
You are a wiki architect. You have been given the current AGENTS.md for a wiki and the completed wiki structure after ingestion.

=== CURRENT AGENTS.md ===
{currentAgentsMd}

=== WIKI STRUCTURE ===
{wikiStructure}

=== NEW FOLDERS CREATED ===
{newFolders}

=== NEW PAGE TYPES DISCOVERED ===
{newPageTypes}

=== TASK ===
Propose updates to AGENTS.md based on what was discovered during ingestion. Focus on:
1. Adding new folder examples to the "Folder Structure" section.
2. Adding new page types to the "Page Types" section.
3. Updating rules or conventions that were discovered to be incomplete.
4. Preserving the "Language" section (the wiki's output language, Phase 7) verbatim.

Return the complete updated AGENTS.md as markdown. Do not explain your changes.
```

### 2.2 AGENTS.md Updater Agent

**File:** `src/agents/agents-updater.ts`

```typescript
async function proposeAgentsUpdate(wikiSlug: string): Promise<string>;
```

**Implementation:**
1. Read current `AGENTS.md`.
2. Read wiki structure (folders, page types from `index.md` files).
3. Read `.state/proposals/structural-changes.json` for new folders.
4. Build the prompt.
5. Call `callLLM(prompt)`.
6. Save the response to `.state/proposed-agents.md`.
7. Print a message: "Proposed AGENTS.md updates saved to .state/proposed-agents.md. Review and apply manually."

### 2.3 Integration into `ingest.ts`

After `writeDoxContracts()`, add:

```typescript
if (config.updateAgents) {
  await proposeAgentsUpdate(wikiSlug);
}
```

**Default:** `updateAgents` is `false`. The journalist can enable it with `llm-wiki-cli ingest --update-agents`.

### 2.4 Structural Change Log

**File:** `src/state/structural-changes.ts`

Already partially built in Phase 3 (Materializer). Ensure it logs:
- New folders created.
- New page types introduced.
- Entity reclassifications (if any).

Log format: `.state/proposals/structural-changes.json`.

---

## 3. Technical Approval Gates

### Gate 9.1: Updater Proposes Valid AGENTS.md

```typescript
test('updater proposes valid AGENTS.md', async () => {
  await ingest('test-wiki');
  const proposal = await proposeAgentsUpdate('test-wiki');
  expect(proposal).toContain('Folder Structure');
  expect(proposal).toContain('Page Types');
  expect(proposal).toContain('Ingest Workflow');
});
```

**Pass Criteria:** Proposal contains all required sections.

### Gate 9.2: Proposal Includes New Folders

```typescript
test('proposal includes new folders discovered during ingestion', async () => {
  await ingest('test-wiki');
  const proposal = await proposeAgentsUpdate('test-wiki');
  const changes = JSON.parse(readFileSync('wikis/test-wiki/.state/proposals/structural-changes.json', 'utf-8'));
  for (const change of changes.changes) {
    if (change.type === 'new-folder') {
      expect(proposal).toContain(change.path);
    }
  }
});
```

**Pass Criteria:** Proposal mentions all new folders.

### Gate 9.3: Proposal Is Saved to Disk

```typescript
test('proposal is saved to .state/proposed-agents.md', async () => {
  await ingest('test-wiki');
  await proposeAgentsUpdate('test-wiki');
  expect(existsSync('wikis/test-wiki/.state/proposed-agents.md')).toBe(true);
});
```

**Pass Criteria:** Proposal file exists.

### Gate 9.4: Original AGENTS.md Is Not Overwritten

```typescript
test('original AGENTS.md is not overwritten', async () => {
  const original = readFileSync('wikis/test-wiki/AGENTS.md', 'utf-8');
  await proposeAgentsUpdate('test-wiki');
  const after = readFileSync('wikis/test-wiki/AGENTS.md', 'utf-8');
  expect(after).toBe(original);
});
```

**Pass Criteria:** Original file is unchanged.

### Gate 9.5: Updater Does Not Run by Default

```typescript
test('updater does not run without --update-agents flag', async () => {
  await ingest('test-wiki');
  expect(existsSync('wikis/test-wiki/.state/proposed-agents.md')).toBe(false);
});
```

**Pass Criteria:** Without flag, no proposal is generated.

---

## 4. User Acceptance Tests (UAT)

### UAT 9.1: I can generate a proposal

```bash
npx tsx src/cli.ts ingest test-wiki --update-agents
```

**Expected:** Console shows "Proposed AGENTS.md updates saved to .state/proposed-agents.md."

### UAT 9.2: I can review the proposal

```bash
cat wikis/test-wiki/.state/proposed-agents.md
```

**Expected:** I see an updated AGENTS.md that includes new folder examples discovered during ingestion. The changes are sensible.

### UAT 9.3: I can apply the proposal manually

```bash
cp wikis/test-wiki/.state/proposed-agents.md wikis/test-wiki/AGENTS.md
```

**Expected:** The updated AGENTS.md is now the active instruction set for future ingestion runs.

### UAT 9.4: I can see structural changes

```bash
cat wikis/test-wiki/.state/proposals/structural-changes.json | jq .
```

**Expected:** I see a JSON log of every new folder created, with timestamps and reasons.

---



## 5. TUI Updates for This Phase

### 5.1 `agents-review-screen.tsx`

**File:** `src/tui/agents-review-screen.tsx`

A screen for reviewing and applying proposed AGENTS.md updates:

```
╔══════════════════════════════════════╗
║  Review AGENTS.md Updates            ║
╠══════════════════════════════════════╣
║  Proposed changes:                     ║
║                                        ║
║  + Added folder: entities/companies/   ║
║    offshore                            ║
║  + Added page type: transaction        ║
║                                        ║
║  Diff: 3 lines added, 0 removed        ║
╠══════════════════════════════════════╣
║  [ Apply Changes ]  [ Discard ]        ║
║  [ View Full Diff ]                  ║
╚══════════════════════════════════════╝
```

**Behavior:**
- Shows a summary of proposed changes (new folders, new page types).
- "View Full Diff" opens a scrollable diff viewer.
- "Apply Changes" copies `.state/proposed-agents.md` to `AGENTS.md`.
- "Discard" deletes the proposal file.

### 5.2 `structural-changes-screen.tsx`

**File:** `src/tui/structural-changes-screen.tsx`

A screen for viewing the structural change log:

```
╔══════════════════════════════════════╗
║  Structural Changes                  ║
╠══════════════════════════════════════╣
║  2026-07-16 14:30                      ║
║  New folder: entities/companies/     ║
║  offshore                              ║
║  Reason: 47 offshore entities found  ║
║                                        ║
║  2026-07-16 14:31                      ║
║  New folder: topics/legal/           ║
║  litigation                            ║
║  Reason: 3 legal cases found           ║
╠══════════════════════════════════════╣
║  [ Back ]                            ║
╚══════════════════════════════════════╝
```

### 5.3 Menu Updates

**File:** `src/tui/menu.tsx`

Add:
```typescript
{ label: 'Review AGENTS.md Updates', value: 'agents-review' },
{ label: 'View Structural Changes', value: 'structural-changes' },
```

---

## 6. Approval Checklist

Before moving to Phase 11, verify:

- [ ] All 5 technical gates pass (`npm test` is green).
- [ ] All 4 UAT steps pass (manual verification).
- [ ] Updater proposes valid AGENTS.md updates.
- [ ] Proposal includes new folders and page types.
- [ ] Proposal is saved to `.state/proposed-agents.md`.
- [ ] Original `AGENTS.md` is not overwritten.
- [ ] Updater is opt-in (`--update-agents` flag).
- [ ] **TUI AGENTS.md Review screen shows proposed changes and allows apply/discard.**
- [ ] Total LLM cost for this phase is under $2.00.

---

## 7. Integration Notes

### What Phase 9 Depends On (from Phase 8)
- Complete wiki with multiple PDFs.
- Structural change log exists.
- DOX contracts are complete.

### What Phase 9 Produces (for Later Phases)
- AGENTS.md update proposal framework.
- Living documentation model.

### Contract with Phase 11
Phase 11 (polish) expects:
- The system can propose AGENTS.md updates.
- The journalist controls when to apply them.

Phase 11 is the final polish and performance optimization phase.
