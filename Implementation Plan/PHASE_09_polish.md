# Phase 9: Polish, Performance, and Production Readiness

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-009`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** Phase 0-8
**Estimated Time:** 4-6 hours
**LLM Token Budget:** $0 (unless testing performance with large PDFs)

---

## 1. Objective

Polish the CLI for production use. Add performance optimizations, error handling, logging, configuration files, and documentation. This phase does not add new features. It makes the existing features robust and user-friendly.

---

## 2. What to Build

### 2.1 Configuration File

**File:** `src/config.ts`

Support a `.llm-wiki-cli.json` config file in the workspace root:

```json
{
  "chunkSize": 5,
  "llmProvider": "fable",
  "llmModel": "default",
  "synthesis": false,
  "updateAgents": false,
  "maxFolderDepth": 3
}
```

**CLI flags override config file:**
```bash
llm-wiki-cli ingest test-wiki --chunk-size 10 --synthesis
```

### 2.2 Progress Logging

**File:** `src/log.ts`

Replace `console.log` with a structured logger:
- `info`: Normal progress messages.
- `warn`: Warnings (e.g., skipped PDFs, conflicts).
- `error`: Errors (e.g., extraction failures, invalid JSON).
- `debug`: Detailed debug output (enabled with `--verbose`).

**Log format:**
```
[2026-07-16T10:00:00Z] INFO: Processing golden-master.pdf (3 pages)
[2026-07-16T10:00:01Z] INFO: Extracted 5 entities, 3 relationships, 2 claims
[2026-07-16T10:00:02Z] WARN: Skipping golden-master.pdf (unchanged)
[2026-07-16T10:00:03Z] ERROR: Extractor returned invalid JSON for chunk 001
```

### 2.3 Error Handling

**File:** `src/errors.ts`

Define custom error classes:
- `ExtractionError`: PDF extraction failed.
- `ExtractorError`: LLM Extractor returned invalid output.
- `ValidationError`: Schema or link validation failed.
- `MaterializerError`: File I/O or folder creation failed.

Each error includes:
- Error message.
- Affected file/chunk.
- Suggested fix.
- Whether the error is fatal (abort) or non-fatal (log and continue).

### 2.4 Performance: Large PDF Handling

**File:** `src/chunking/page-chunker.ts`

Optimize chunking for large PDFs:
- Estimate token count per page (heuristic: 1 page ≈ 500 tokens).
- Adjust chunk size dynamically to fit within the LLM context window.
- Never split a table or figure across chunks.
- Process chunks sequentially (not in parallel) to maintain rolling memory consistency.

### 2.5 Performance Metrics

**File:** `src/metrics.ts`

Track and report metrics for each ingestion run:
- Chunks processed, skipped, failed.
- Entities extracted: new, updated.
- Relationships extracted.
- Claims extracted: by type.
- Pages created/updated: by type.
- Folders created.
- Broken links, orphaned pages.
- Conflicts: manual-edit, preservation-check.
- Total LLM tokens consumed.
- Total cost.
- Wall-clock time.

**Output:** `.state/metrics.json` and console summary.

### 2.6 README and Documentation

**File:** `README.md`

Write a user-facing README:
- What the tool does.
- Installation instructions.
- Quick start guide.
- Configuration options.
- Troubleshooting.
- Example use cases.

### 2.7 E2E Test Suite

**File:** `tests/e2e.test.ts`

One end-to-end test that runs the full pipeline:
1. `init` a wiki.
2. Copy 2-3 PDFs to `raw/`.
3. Run `ingest`.
4. Verify all expected pages exist.
5. Verify all links resolve.
6. Verify all citations are valid.
7. Verify metrics are reasonable.

This test uses real PDFs and real LLM calls. It is slow and expensive. Run it only before releases, not in CI.

---

## 3. Technical Approval Gates

### Gate 9.1: Config File Is Loaded

```typescript
test('config file is loaded and respected', async () => {
  writeFileSync('.llm-wiki-cli.json', JSON.stringify({ chunkSize: 10 }));
  const config = await loadConfig();
  expect(config.chunkSize).toBe(10);
});
```

**Pass Criteria:** Config file values are loaded.

### Gate 9.2: CLI Flags Override Config

```typescript
test('CLI flags override config file', async () => {
  writeFileSync('.llm-wiki-cli.json', JSON.stringify({ chunkSize: 10 }));
  const config = await loadConfig({ chunkSize: 20 });
  expect(config.chunkSize).toBe(20);
});
```

**Pass Criteria:** CLI flag takes precedence.

### Gate 9.3: Logger Outputs Structured Messages

```typescript
test('logger outputs structured messages', async () => {
  const consoleSpy = vi.spyOn(console, 'log');
  log.info('Test message');
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}/));
});
```

**Pass Criteria:** Log messages include timestamps.

### Gate 9.4: Errors Are Caught and Reported

```typescript
test('extraction errors are caught and reported', async () => {
  // Force an extraction error
  const consoleSpy = vi.spyOn(console, 'error');
  await ingest('test-wiki');
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
});
```

**Pass Criteria:** Errors are logged with "ERROR" prefix.

### Gate 9.5: Metrics Are Saved

```typescript
test('metrics are saved to .state/metrics.json', async () => {
  await ingest('test-wiki');
  expect(existsSync('wikis/test-wiki/.state/metrics.json')).toBe(true);
  const metrics = JSON.parse(readFileSync('wikis/test-wiki/.state/metrics.json', 'utf-8'));
  expect(metrics.chunksProcessed).toBeDefined();
  expect(metrics.totalCost).toBeDefined();
});
```

**Pass Criteria:** Metrics file exists with expected fields.

### Gate 9.6: E2E Test Passes

```typescript
test('e2e test passes with multiple PDFs', async () => {
  // This test uses real LLM calls and is slow
  await e2eTest();
}, 60000); // 60 second timeout
```

**Pass Criteria:** E2E test completes successfully.

---

## 4. User Acceptance Tests (UAT)

### UAT 9.1: I can configure the tool

```bash
cat > .llm-wiki-cli.json << 'EOF'
{
  "chunkSize": 10,
  "synthesis": true
}
EOF
npx tsx src/cli.ts ingest test-wiki
```

**Expected:** The tool uses a chunk size of 10 pages and enables synthesis.

### UAT 9.2: I can see progress

```bash
npx tsx src/cli.ts ingest test-wiki --verbose
```

**Expected:** Console shows detailed progress: "Processing chunk 1/5...", "Extracted 5 entities...", "Writing entity pages...", etc.

### UAT 9.3: I can see metrics

```bash
cat wikis/test-wiki/.state/metrics.json | jq .
```

**Expected:** I see a JSON object with counts of entities, relationships, claims, pages, cost, and time.

### UAT 9.4: I can read the README

```bash
cat README.md
```

**Expected:** I see clear installation instructions, a quick start guide, and configuration options.

---



## 5. TUI Updates for This Phase

### 5.1 `settings-screen.tsx` (Full Implementation)

**File:** `src/tui/settings-screen.tsx`

A comprehensive settings screen:

```
╔══════════════════════════════════════╗
║  Settings                            ║
╠══════════════════════════════════════╣
║  General                               ║
║  ─────────                             ║
║  Chunk Size:        [5       ▲▼]     ║
║  Max Folder Depth:  [3       ▲▼]     ║
║                                        ║
║  LLM                                   ║
║  ─────                                 ║
║  Provider:          [Fable    ▼]     ║
║  Model:             [default  ▼]     ║
║  API Key:           [••••••••]       ║
║                                        ║
║  Features                              ║
║  ────────                              ║
║  Synthesis:         [ON ] / OFF        ║
║  Update Agents:     ON / [OFF]         ║
║  Verbose Logging:   [ON ] / OFF        ║
║                                        ║
║  Costs                                 ║
║  ─────                                 ║
║  Total spent: $12.45                   ║
║  This session: $0.23                   ║
╠══════════════════════════════════════╣
║  [ Save ]  [ Back ]                  ║
╚══════════════════════════════════════╝
```

**Behavior:**
- All settings editable via arrow keys and text input.
- Changes saved to `.llm-wiki-cli.json`.
- Cost tracking read from `.state/metrics.json`.

### 5.2 `metrics-screen.tsx`

**File:** `src/tui/metrics-screen.tsx`

A screen showing ingestion metrics:

```
╔══════════════════════════════════════╗
║  Metrics                               ║
╠══════════════════════════════════════╣
║  Last Run: 2026-07-16 14:30            ║
║                                        ║
║  Chunks:  5 processed, 0 skipped       ║
║  Entities: 12 new, 3 updated           ║
║  Relationships: 8                      ║
║  Claims: 15 (10 financial, 5 legal)    ║
║  Pages: 20 created, 5 updated            ║
║  Folders: 3 new                        ║
║  Links: 45 total, 0 broken             ║
║  Conflicts: 0                          ║
║                                        ║
║  Tokens: 12,450 input, 3,200 output    ║
║  Cost: $0.23                           ║
║  Time: 45 seconds                      ║
╠══════════════════════════════════════╣
║  [ Back ]                            ║
╚══════════════════════════════════════╝
```

### 5.3 Menu Updates

**File:** `src/tui/menu.tsx`

Add:
```typescript
{ label: 'View Metrics', value: 'metrics' },
```

Ensure Settings is already present from Phase 0.

---

## 6. Approval Checklist

Before declaring the project complete, verify:

- [ ] All 6 technical gates pass (`npm test` is green).
- [ ] All 4 UAT steps pass (manual verification).
- [ ] Config file is loaded and CLI flags override it.
- [ ] Logger outputs structured, timestamped messages.
- [ ] Errors are caught and reported clearly.
- [ ] Metrics are saved and accurate.
- [ ] E2E test passes with multiple PDFs.
- [ ] README is complete and accurate.
- [ ] **TUI Settings screen allows editing all config options.**
- [ ] **TUI Metrics screen shows all ingestion statistics.**
- [ ] Total LLM cost for this phase is $0 (unless testing E2E).
- [ ] The system is ready for a journalist to use.

---

## 7. Integration Notes
## 6. Integration Notes

### What Phase 9 Depends On (from Phase 8)
- Complete wiki with multiple PDFs.
- AGENTS.md update framework.
- All previous phases are stable.

### What Phase 9 Produces
- A production-ready CLI tool.
- User-facing documentation.
- Performance metrics and logging.
- Configuration system.

### Final Architecture

```
PDF → Chunker → Layer 1 (Raw Pages) → Layer 2 (Extractor) → Layer 3 (Materializer) → Validation → Layer 4 (DOX Writer) → Optional: Layer 5 (Writer)
                                    ↓
                              Rolling Memory
                                    ↓
                              .state/ (hashes, extractions, memory, metrics, conflicts, proposals)
```

This is the complete system. Every layer is tested. Every layer is optional except Layer 1 and Layer 2. The journalist can use the raw document pages (Layer 1) even if every LLM call fails.
