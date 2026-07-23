# Phase 0: Infrastructure

**Document ID:** `LLM-WIKI-CLI-IMPL-PHASE-000`
**Version:** 1.0.0
**Status:** Draft
**Date:** 2026-07-16
**Dependencies:** None
**Estimated Time:** 4-6 hours (includes TUI setup)
**LLM Token Budget:** $0

---

## 1. Objective

Set up the project repository, build system, test framework, LLM client, and **Terminal User Interface (TUI)**. Create a controlled test fixture (golden master PDF) that never changes. This phase produces zero wiki output but establishes the foundation every subsequent phase depends on.

**The TUI is not optional.** Every command must be accessible through both the CLI and the TUI. The TUI is the primary interface for users who are not comfortable with PowerShell commands.

---

## 2. What to Build

### 2.1 Repository Structure

All files and folders below are created **directly in this project folder** (`Wiki v5/` — the folder that contains `Implementation Plan/` and `Project Vision/`). Do **not** create a separate project directory here or anywhere else.

```
Wiki v5/                            # ← this project folder; build in place
├── test-pdfs/
│   └── golden-master.pdf          # Your 3-page control document
├── prompts/
│   └── (empty for now)
├── src/
│   ├── cli.ts                     # Commander entry point (CLI commands)
│   ├── tui/
│   │   ├── app.tsx                # Main TUI app (Ink root)
│   │   ├── menu.tsx               # Main menu screen
│   │   ├── init-screen.tsx        # TUI for init command
│   │   ├── ingest-screen.tsx      # TUI for ingest command
│   │   ├── test-screen.tsx        # TUI for running tests
│   │   ├── settings-screen.tsx    # TUI for config/settings
│   │   ├── components/
│   │   │   ├── header.tsx         # App header with title
│   │   │   ├── footer.tsx         # Status bar / help text
│   │   │   ├── spinner.tsx        # Loading indicator
│   │   │   ├── error-box.tsx      # Error display
│   │   │   └── success-box.tsx    # Success confirmation
│   │   └── hooks/
│   │       └── use-wiki-list.ts   # Hook to list existing wikis
│   ├── commands/                  # CLI command implementations
│   │   └── (empty for now)
│   ├── extraction/
│   │   └── pdf.ts                 # pdfjs-dist wrapper
│   ├── llm/
│   │   └── client.ts              # Single API call wrapper
│   ├── state/
│   │   └── (empty for now)
│   ├── utils/
│   │   └── hash.ts                # SHA-256 helper
│   └── agents/
│       └── (empty for now)
├── tests/
│   ├── infrastructure.test.ts     # Tests for this phase only
│   └── tui/
│       └── menu.test.tsx          # TUI component tests
├── templates/
│   └── AGENTS.md                  # Template for wiki AGENTS.md
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 2.2 TUI Framework

**Technology:** [Ink](https://github.com/vadimdemedes/ink) — React for terminal.

**Dependencies to add to `package.json`:**
```json
{
  "dependencies": {
    "commander": "^12.1.0",
    "gray-matter": "^4.0.3",
    "ink": "^7.1.0",
    "ink-select-input": "^6.2.0",
    "ink-spinner": "^5.0.0",
    "ink-text-input": "^6.0.0",
    "pdfjs-dist": "^4.10.38",
    "react": "^19.0.0",
    "undici": "^8.7.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^19.2.17",
    "pdf-lib": "^1.17.1",
    "tsx": "^4.15.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

### 2.3 TUI Entry Point

**File:** `src/tui/app.tsx`

```tsx
import React, { useState } from 'react';
import { Box } from 'ink';
import { MenuScreen } from './menu';
import { InitScreen } from './init-screen';
import { IngestScreen } from './ingest-screen';
import { TestScreen } from './test-screen';
import { SettingsScreen } from './settings-screen';

export type Screen = 'menu' | 'init' | 'ingest' | 'test' | 'settings' | 'exit';

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [lastResult, setLastResult] = useState<string>('');

  if (screen === 'exit') {
    return <Box>Goodbye!</Box>;
  }

  return (
    <Box flexDirection="column">
      {screen === 'menu' && <MenuScreen onSelect={setScreen} lastResult={lastResult} />}
      {screen === 'init' && <InitScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'ingest' && <IngestScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'test' && <TestScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
      {screen === 'settings' && <SettingsScreen onBack={() => setScreen('menu')} onResult={setLastResult} />}
    </Box>
  );
}
```

### 2.4 TUI Menu Screen

**File:** `src/tui/menu.tsx`

The main menu is a selectable list:

```
╔══════════════════════════════════════╗
║     Paper Chase v.1.0                 ║
╠══════════════════════════════════════╣
║  > Create New Wiki (init)            ║
║    Ingest PDFs (ingest)              ║
║    Run Tests                         ║
║    Settings                          ║
║    Exit                              ║
╠══════════════════════════════════════╣
║  Last: Wiki 'test' created           ║
╚══════════════════════════════════════╝
```

Use `ink-select-input` for the menu. Arrow keys to navigate, Enter to select, Escape to go back.

### 2.5 TUI Components

**File:** `src/tui/components/header.tsx`
- App title and version.
- Current wiki (if any).

**File:** `src/tui/components/spinner.tsx`
- Loading indicator using `ink-spinner`.
- Shows during PDF extraction, LLM calls, and file I/O.

**File:** `src/tui/components/error-box.tsx`
- Red-bordered box for errors.
- Shows error message and "Press any key to continue".

**File:** `src/tui/components/success-box.tsx`
- Green-bordered box for success messages.
- Shows result summary.

### 2.6 CLI Entry Point

**File:** `src/cli.ts`

```typescript
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App } from './tui/app';

const program = new Command();

program
  .name('chase')
  .description('Turn PDFs into citation-backed markdown wikis')
  .version('2.0.0');

// TUI mode (default: no subcommand)
program.action(() => {
  render(<App />);
});

// CLI commands (for power users and scripts)
program
  .command('init <slug>')
  .description('Create a new wiki')
  .option('--title <title>', 'Wiki title')
  .option('-w, --workspace <workspace>', 'Workspace directory', '.')
  .action(async (slug, options) => {
    // Phase 1 implementation
  });

program
  .command('ingest <slug>')
  .description('Ingest PDFs into a wiki')
  .option('--synthesis', 'Enable LLM synthesis')
  .option('--update-agents', 'Update AGENTS.md')
  .option('--verbose', 'Verbose output')
  .action(async (slug, options) => {
    // Phase 1+ implementation
  });

program
  .command('test')
  .description('Run the test suite')
  .action(async () => {
    // Run vitest
  });

program.parse();
```

**Running the TUI:**
```bash
npx tsx src/cli.ts          # Opens TUI
npx tsx src/cli.ts init     # CLI mode
npx tsx src/cli.ts ingest   # CLI mode
```

### 2.7 PDF Extraction

**File:** `src/extraction/pdf.ts`
- Function: `extractText(pdfPath: string, startPage?: number, endPage?: number): Promise<string>`
- Uses `pdfjs-dist` to extract text from a PDF.
- Never splits a page. If `startPage` and `endPage` are provided, extracts only that range.
- Returns plain text with line breaks preserved.

### 2.8 LLM Client

**File:** `src/llm/client.ts`
- Function: `callLLM(prompt: string, system?: string): Promise<string>`
- Wraps your API (Fable, OpenAI, etc.).
- Logs every call to console: `LLM Call | Tokens: {input}/{output} | Cost: ${amount}`
- Returns the raw response string.
- No retry logic. If the API fails, throw.

### 2.9 Hash Utility

**File:** `src/utils/hash.ts`
- Function: `sha256(filePath: string): Promise<string>`
- Returns SHA-256 hex string of the file.

### 2.10 Golden Master PDF

Create `test-pdfs/golden-master.pdf`. A 3-page document you control completely. Include:

- **Page 1:** A heading (e.g., "Executive Summary"), one paragraph of text, one named person (e.g., "John Smith"), one named company (e.g., "Acme Corp"), one date (e.g., "March 15, 2024").
- **Page 2:** A table with at least 3 rows and 3 columns (e.g., "Revenue by Quarter"), one paragraph with a number (e.g., "$42.5 million").
- **Page 3:** A heading (e.g., "Board Members"), a list of 2-3 names, one paragraph mentioning a relationship (e.g., "John Smith is the CEO of Acme Corp").

You must know every word on every page. This PDF never changes for the lifetime of the project.

---

## 3. Technical Approval Gates

### Gate 0.1: PDF Extraction Works

```typescript
// tests/infrastructure.test.ts
test('extractText returns all text from golden master', async () => {
  const text = await extractText('test-pdfs/golden-master.pdf');
  expect(text).toContain('John Smith');      // known name from page 1
  expect(text).toContain('Acme Corp');        // known company from page 1
  expect(text).toContain('March 15, 2024');   // known date from page 1
  expect(text).toContain('$42.5 million');    // known number from page 2
  expect(text).toContain('Board Members');    // known heading from page 3
});
```

**Pass Criteria:** Test passes. Text contains all known strings.

### Gate 0.2: Page-Range Extraction Works

```typescript
test('extractText with page range returns only those pages', async () => {
  const text = await extractText('test-pdfs/golden-master.pdf', 1, 1);
  expect(text).toContain('John Smith');
  expect(text).not.toContain('Board Members'); // page 3 content
});
```

**Pass Criteria:** Test passes. Page 1 text is present; page 3 text is absent.

### Gate 0.3: SHA-256 Hashing Works

```typescript
test('sha256 returns correct hash', async () => {
  const hash = await sha256('test-pdfs/golden-master.pdf');
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  // Verify against shasum command line
  const expected = execSync('shasum -a 256 test-pdfs/golden-master.pdf')
    .toString().split(' ')[0];
  expect(hash).toBe(expected);
});
```

**Pass Criteria:** Test passes. Hash matches command-line `shasum`.

### Gate 0.4: LLM Client Logs Cost

```typescript
test('callLLM logs cost and returns response', async () => {
  const consoleSpy = vi.spyOn(console, 'log');
  const response = await callLLM('Say "hello"', 'You are a test assistant.');
  expect(response).toBeTruthy();
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('LLM Call'));
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cost:'));
});
```

**Pass Criteria:** Test passes. Console shows cost logging.

### Gate 0.5: CLI Commands Exist

```typescript
test('CLI has init, ingest, and test commands', async () => {
  const { program } = await import('../src/cli');
  expect(program.commands.map(c => c.name())).toContain('init');
  expect(program.commands.map(c => c.name())).toContain('ingest');
  expect(program.commands.map(c => c.name())).toContain('test');
});
```

**Pass Criteria:** Test passes. All commands are registered.

### Gate 0.6: TUI Renders Without Crashing

```typescript
test('TUI renders without crashing', async () => {
  const { render } = await import('ink');
  const { App } = await import('../src/tui/app');
  const { unmount } = render(<App />);
  unmount();
});
```

**Pass Criteria:** TUI renders and unmounts without errors.

### Gate 0.7: TUI Menu Shows All Options

```typescript
test('TUI menu shows all options', async () => {
  const { render } = await import('ink');
  const { MenuScreen } = await import('../src/tui/menu');
  const { lastFrame } = render(<MenuScreen onSelect={() => {}} lastResult="" />);
  const frame = lastFrame();
  expect(frame).toContain('Create New Wiki');
  expect(frame).toContain('Ingest PDFs');
  expect(frame).toContain('Run Tests');
  expect(frame).toContain('Settings');
  expect(frame).toContain('Exit');
});
```

**Pass Criteria:** Menu shows all 5 options.

### Gate 0.8: TUI Can Navigate Screens

```typescript
test('TUI can navigate between screens', async () => {
  const { render } = await import('ink');
  const { App } = await import('../src/tui/app');
  const { stdin } = render(<App />);

  // Simulate pressing Enter on first menu item
  stdin.write('
');

  const { lastFrame } = render(<App />);
  // Should show init screen
  expect(lastFrame()).toContain('Create New Wiki');
});
```

**Pass Criteria:** Menu selection navigates to the correct screen.

---

## 4. User Acceptance Tests (UAT)

### UAT 0.1: I can run the test suite via CLI

```bash
npm install
npm test
```

**Expected:** All tests pass. No errors.

### UAT 0.2: I can run the test suite via TUI

```bash
npx tsx src/cli.ts
```

**Expected:** TUI opens. I select "Run Tests" with arrow keys and press Enter. Tests run and results are displayed in the TUI.

### UAT 0.3: I can extract text from the golden master via CLI

```bash
npx tsx -e "import { extractText } from './src/extraction/pdf'; extractText('test-pdfs/golden-master.pdf').then(t => console.log(t))"
```

**Expected:** Console shows the full text of all 3 pages. I can read "John Smith", "Acme Corp", the table, and "Board Members".

### UAT 0.4: I can call the LLM via CLI

```bash
npx tsx -e "import { callLLM } from './src/llm/client'; callLLM('Say hello').then(r => console.log(r))"
```

**Expected:** Console shows the LLM response and a cost line like `LLM Call | Tokens: 15/5 | Cost: $0.0003`.

### UAT 0.5: I can compute a hash via CLI

```bash
npx tsx -e "import { sha256 } from './src/utils/hash'; sha256('test-pdfs/golden-master.pdf').then(h => console.log(h))"
```

**Expected:** Console shows a 64-character hex string. Running `shasum -a 256 test-pdfs/golden-master.pdf` shows the same string.

### UAT 0.6: I can open the TUI

```bash
npx tsx src/cli.ts
```

**Expected:** The terminal clears and shows a menu with "Create New Wiki", "Ingest PDFs", "Run Tests", "Settings", and "Exit". I can navigate with arrow keys. I can exit by selecting "Exit" or pressing Escape.

---

## 5. Approval Checklist

Before moving to Phase 1, verify:

- [ ] All 8 technical gates pass (`npm test` is green).
- [ ] All 6 UAT steps pass (manual verification).
- [ ] Golden master PDF is committed to git and never modified.
- [ ] `templates/AGENTS.md` exists and is committed.
- [ ] TUI renders without crashing.
- [ ] TUI menu shows all options.
- [ ] TUI can navigate between screens.
- [ ] No code exists for `init`, `ingest`, or any agent implementation. This phase is infrastructure only.
- [ ] Total LLM cost for this phase: $0.

---

## 6. TUI Architecture Notes

### TUI Design Principles

1. **Every CLI command has a TUI equivalent.** The TUI is not a separate app. It is a visual wrapper around the same functions.
2. **Arrow keys to navigate, Enter to select, Escape to go back.** No memorization required.
3. **Progress is always visible.** Spinners during long operations. Success/error boxes when done.
4. **Results are displayed in the TUI.** After `init`, the TUI shows "Wiki 'test' created at wikis/test/". After `ingest`, it shows metrics.
5. **The TUI never hides errors.** If a command fails, the error is shown in a red box with the full message.

### TUI Screen Map (Future Phases)

| Phase | Screen | Description |
|---|---|---|
| 1 | `init-screen.tsx` | Form to enter wiki slug and title. Creates wiki. |
| 1 | `ingest-screen.tsx` | Select wiki, show PDF list, run ingest with progress. |
| 2 | `extractor-test-screen.tsx` | Run Extractor against a chunk and show JSON output. |
| 3 | `entity-browser.tsx` | Browse entity pages by folder. |
| 4 | `validation-report-screen.tsx` | Show link check, citation check, schema validation results. |
| 5 | `dox-browser.tsx` | Navigate `index.md` contracts. |
| 6 | `synthesis-toggle.tsx` | Toggle synthesis on/off in settings. |
| 7 | `compounding-log-screen.tsx` | Show what changed in the last ingest run. |
| 8 | `agents-review-screen.tsx` | Review and apply proposed AGENTS.md updates. |
| 9 | `settings-screen.tsx` | Configure chunk size, LLM provider, flags. |
| 9 | `metrics-screen.tsx` | View ingestion metrics and costs. |

---

## 7. Integration Notes

Phase 0 has no integration with other phases. It is pure infrastructure. Every subsequent phase depends on:
- `extractText` from `src/extraction/pdf.ts`
- `callLLM` from `src/llm/client.ts`
- `sha256` from `src/utils/hash.ts`
- `test-pdfs/golden-master.pdf`
- TUI framework (`src/tui/app.tsx`, `src/tui/menu.tsx`, components)

These must not change after Phase 0 is approved.

**TUI files that must be updated in future phases:**
- `src/tui/menu.tsx` — Add new menu items as features are built.
- `src/tui/app.tsx` — Add new screens to the screen router.
- `src/tui/components/` — Add new reusable components as needed.
