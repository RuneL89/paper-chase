# Phase 1 Verification Report — Raw Document Pages (Layer 1)

**Verifier:** independent Verifier sub-agent (cold check; Implementer's status file treated as claims)
**Date:** 2026-07-17
**Spec:** `Implementation Plan/PHASE_01_raw_document_pages.md` (gates 1.1–1.9, UAT 1.1–1.6, TUI §5, Checklist §6)
**Implementer claims:** `.state/phase-1-status.json`

All evidence below was produced by the Verifier: own `npm test`/`tsc` runs, own end-to-end CLI run in a temp workspace (destroyed after), own hash computations, own heuristic probes of the table renderer.

---

## 1. Test Suite (run independently)

| Check | Command | Observed |
|---|---|---|
| Full suite | `npm test` | **5 files passed (5); 33 passed + 1 skipped (34 total); 0 failed** — phase-01.test.ts 17, tui/phase-01-screens.test.tsx 6, infrastructure.test.ts 5 (1 skipped), tui/menu.test.tsx 5, tui/test-screen-spawn.test.tsx 1. The skip is the Phase 0 live-LLM Gate 0.4, self-skipping without `ANTHROPIC_API_KEY` (by design). |
| Types | `npx tsc --noEmit` | **Clean** (no output, exit 0). |

Counts match the Implementer's claim exactly.

## 2. Gate-by-Gate (test code read line-by-line; assertions verified as genuine)

| Gate | Verdict | Evidence (mine) |
|---|---|---|
| 1.1 init structure | **PASS** | `tests/phase-01.test.ts:54-62` asserts all 6 subdirs + AGENTS.md verbatim from the phase doc. E2E: `init verify-wiki` printed the exact §2.1 message and produced raw/, documents/, sources/, entities/, topics/, .state/, AGENTS.md. |
| 1.2 ingest writes pages | **PASS** | Lines 65-67 assert `documents/golden-master-part-001.md` exists. E2E confirmed the file exists after one ingest. |
| 1.3 all raw text | **PASS** | Lines 70-77 assert all 5 strings verbatim. I additionally rendered the golden master through the real pipeline and confirmed all 5 strings (`John Smith`, `Acme Corp`, `March 15, 2024`, `$42.5 million`, `Board Members`) appear verbatim in the rendered text and in the E2E document page. |
| 1.4 tables preserved | **PASS** | Lines 80-89 assert `|`, `Revenue`, plus exact rows `| Quarter | Revenue | Growth |` and `| Q1 | $9.8M | +4% |`. E2E page shows the real 3-column markdown table. Not vacuous. |
| 1.5 valid frontmatter | **PASS** | Lines 92-104 parse with gray-matter: `type: document`, `sources[0].file` contains golden-master.pdf, `sources[0].pages === '1-3'` (correct for the 3-page PDF under the 5-page default). E2E frontmatter identical in shape; `extracted` + `sha256` also present (vision `06` §3 optional fields). |
| 1.6 source page hash | **PASS** | Lines 107-111 compare against `sha256('test-pdfs/golden-master.pdf')` — the real hash, not a hardcoded string. I independently computed the hash with **node:crypto and certutil**: `1e4f2cbec74a83bf8ae56f3a45035827ec405bd02989d6b38f08929b80ac339d` — matches the source page frontmatter and field table exactly. |
| 1.7 idempotent | **PASS** | Lines 114-119 run ingest twice more and assert exactly 1 `golden-master*` file — a genuine idempotency proof. E2E: second and third CLI runs created no files; documents/ still holds exactly 1 page. |
| 1.8 fast re-run | **PASS** | Lines 122-126 time a re-run and assert `< 1000 ms`; passed in my run. The skip path (hash compare, no extraction) makes this structural, not a lucky timing. |
| 1.9 state valid JSON | **PASS** | Lines 129-134 `JSON.parse` the state and assert `sources['golden-master'].hash` truthy + `documentPages` length 1. E2E state file matches §2.3 shape exactly (`hash`, `documentPages`, `ingestedAt`). |

Supplementary tests (8 in phase-01.test.ts) are real: placeholder substitution, slug validation/path-escape rejection, missing-wiki error, skip message on the progress channel, 12-page chunking into 3 whole-page chunks, configurable chunk size, changed-PDF stale-chunk cleanup, empty-page warnings. TUI tests (6) drive a fake-TTY stdin end-to-end and assert on-disk results.

## 3. End-to-End Spot Check (temp workspace, destroyed after)

`init verify-wiki -w <tmp>` → copy golden master → `ingest` → `ingest` again:

- Document page exists; frontmatter valid (`type: document`, `pages: 1-3`); body contains all gate-1.3 strings and a real `|`-table with `Revenue`.
- Second run printed exactly `Skipping golden-master.pdf (unchanged)`; no new files; document and source pages untouched (mtimes identical).
- `.state/ingestion.json` matches §2.3 exactly; content byte-identical after a no-op re-run (see Finding F1: the file is still rewritten, changing only its mtime).
- Generated `AGENTS.md`: **0 occurrences of `{{` or `}}`** (counted via node string split; the template's 6 placeholders — 2 `{{WIKI_TITLE}}`, 4 `{{SLUG}}` — all substituted).
- `grep -r "John Smith" documents/` hits the document page (UAT 1.6 searchability).

## 4. `src/extraction/markdown-tables.ts` — Hard Scrutiny (deviation 3)

Empirical probes (script run against the real module, then deleted):

- **Deterministic:** pure function of input; two runs on the golden-master extract byte-identical. No I/O, time, or randomness anywhere in the file (read in full).
- **No word loss on the real corpus:** word multiset of raw `extractText` output vs. rendered output — **92 words before, 92 after, sorted arrays exactly equal**. Only pure table-syntax tokens (`|`, `---`) are added.
- **Guards verified:** prose with sentence punctuation, bullet lists, numbered lists, comma-laden prose, 2-line aligned pairs, and headings are all passed through **byte-unchanged**.
- **Heuristic limit (documented, lossless):** a run of ≥3 punctuation-free lines with identical token counts and ≥2 trailing digit-bearing lines *is* converted — I produced such a case. Even then, every word survives (verified multiset equality); only multi-word phrases spanning cell boundaries lose contiguity. This does not affect gate 1.3/1.4 validity for the golden master — all gate strings verified verbatim in the rendered output — and the preservation-layer invariant (no word dropped or altered) holds.
- **Verdict: gates 1.3/1.4 are meaningful.** The renderer cannot corrupt content on the golden master; residual risk is cosmetic re-celling of pathological punctuation-free prose in other PDFs, with zero word loss.

## 5. Frozen Phase 0 Surface

- `git diff HEAD -- src/extraction/pdf.ts`: `extractText` body and loader options **identical** (refactored into a shared `openDocument`); `getPageCount` is additive only.
- `src/utils/hash.ts`, `src/llm/`, `prompts/`: **no diff**.
- `src/cli.ts`: parse guard and named `program` export intact; init/ingest actions wired; `--synthesis`/`--update-agents` accepted as documented no-ops.
- All Phase 0 tests pass unchanged (infrastructure 5, menu 5, test-screen-spawn 1).

## 6. Negative Requirements

- `callLLM` referenced only in `src/llm/` and the Phase 0 live test — **no LLM calls in any Phase 1 path** ($0 cost confirmed).
- `src/agents/` is `.gitkeep`-only; no Extractor/Materializer/DOX Writer code anywhere.
- `git diff HEAD -- package.json` is **empty** — no new dependencies.
- `prompts/` untouched.

## 7. Vision Compliance (`02` §5/§7, `06` §3/§4)

- Document frontmatter: `file` + `pages` (required) present; `extracted` + `sha256` (optional) present — matches `06` §3.
- Source page: filename, relative path, SHA-256, page count, `warnings: []`, links to document pages, PDF path — **every `06` §4 element verified present** on the E2E page.
- Page types used: only `document` and `source` — both "Layer 1 (deterministic)" per `02` §5. Consistent with `02` §7's deterministic responsibilities.
- **No contradictions with the vision docs found.**

## 8. TUI (§5)

- `init-screen.tsx`: slug/title/workspace fields, Tab/arrow focus, Create runs `init()`, success/error boxes, Escape/Back — all present; `useInput` gated on `isRawModeSupported === true`; static non-TTY fallback.
- `ingest-screen.tsx`: wiki list, PDF count, last-ingest timestamp, spinner, live progress lines (`Extracting text...`/`Chunk X/Y`/`Done!`); same gating/fallback contracts. The §5.3 menu items exist verbatim.
- TUI tests pass (6/6) and genuinely exercise form input → on-disk wiki creation and UI-driven ingest with progress assertions.

## 9. DOX

`src/AGENTS.md`, `tests/AGENTS.md`, root `AGENTS.md` (Child DOX Index includes `wikis/`), and new `wikis/AGENTS.md` all exist and accurately describe the new files; `tests/AGENTS.md`'s stated counts (34 total: 33 + 1 skipped) match my observed run. No stale claims found.

## 10. Deviation Verdicts

| # | Deviation | Verdict |
|---|---|---|
| 1 | `{{WIKI_TITLE}}`/`{{SLUG}}` instead of `{wiki-title}` | **Approve** — binding per compliance log 2026-07-17 01:35; substitution verified complete. |
| 2 | Hermetic temp-workspace tests | **Approve** — gate assertions verbatim; repo unpolluted; permitted by `tests/AGENTS.md`. |
| 3 | markdown-tables renderer | **Approve** — deterministic, lossless on the golden master, guards verified; gate 1.4 genuinely met (notes F2/F3 below). |
| 4 | `-w/--workspace` on ingest | **Approve** — additive, symmetric with init. |
| 5 | Additive `getPageCount` | **Approve** — `extractText` frozen; Phase 0 tests green. |
| 6 | `## Extracted Text: Pages X-Y` body heading | **Approve** — additive; vision `06` §5 pattern. |
| 7 | Source-page `## Warnings` only when non-empty | **Approve** — frontmatter `warnings` field exactly per §2.4. |
| 8 | State `ingestedAt` = last ingest | **Approve** — §2.3 shape unchanged; source page preserves first ingest. |
| 9 | Extra utils/hook files | **Approve** — no new deps; all recorded in `src/AGENTS.md`. |
| 10 | TUI list-is-selector simplification | **Approve** — all §5.2 elements present; documented. |

## 11. Findings (non-blocking; for later phases, not fixes now)

- **F1:** `ingest` rewrites `.state/ingestion.json` even when every PDF is skipped. Content is byte-identical, but the mtime changes — a strict reading of UAT 1.5's "existing files are not modified" is met content-wise only. Cosmetic; consider a conditional write later.
- **F2:** `markdown-tables.ts`'s doc comment overstates its guard ("prose, headings, and lists are never converted") — punctuation-free equal-token-count digit-ending prose blocks do convert (losslessly). Comment should say "conservatively"; the code is fine.
- **F3:** The renderer strips trailing blank lines at EOF even when no table was rendered (its comment claims only introduced blanks are removed). Whitespace-only; no word loss.

## 12. Overall Verdict

**APPROVE.** Gates 1.1–1.9 all pass with genuine assertions; UAT 1.1–1.6 behaviors independently reproduced; frozen Phase 0 surface intact; all negative requirements hold; vision compliance confirmed; deviations are documented adaptations, not vision conflicts. Phase 1 is complete; the user may proceed to manual UAT and Phase 2.

---

# Add-PDFs Extension Verification (2026-07-17)

**Verifier:** independent Verifier sub-agent (cold check of the user-directed Phase 1 extension; no implementation code modified)
**Scope approved by:** `.state/compliance-log.md` entry "2026-07-17 10:20" (COMPLIANT user-directed EXTENSION: TUI screen copying PDFs into `wikis/<slug>/raw/`; menu 5 → 6 items)
**Claims checked:** `.state/phase-1-status.json` (`lastAction`, deviations #11–#12, test counts)

## 1. Test suite and typecheck (run independently)

| Check | Command | Observed | Verdict |
|---|---|---|---|
| Full suite | `npm test` | **Test Files 6 passed (6); Tests 44 passed + 1 skipped (45); 0 failed.** Per file: add-pdfs-screen.test.tsx 11, phase-01-screens.test.tsx 6, menu.test.tsx 5, infrastructure.test.ts 5 (1 skipped — the by-design Phase 0 live-LLM gate 0.4, `test.skipIf(!ANTHROPIC_API_KEY)`), phase-01.test.ts 17, test-screen-spawn.test.tsx 1. | **PASS** — counts match the claim exactly |
| Types | `npx tsc --noEmit` | No output, exit 0. | **PASS** |

## 2. Tests are not vacuous (every new test read line-by-line)

**Helper tests (`tests/tui/add-pdfs-screen.test.tsx` lines 282–360):** PASS.
- Byte-identical proven by hash comparison: `sha256(dest) === GOLDEN_SHA256` (`1e4f2cbe…ac339d`, the gate-1.6 digest) after copying the real golden master — and the source's own hash is re-asserted unchanged (test-pdfs/AGENTS.md immutability honored).
- Quote-stripping: `cleanPastedPath` asserted directly for double quotes, single quotes, and surrounding whitespace; then real copies performed with double- and single-quoted absolute paths.
- Missing file: rejects with `/not found/i`; empty/whitespace input rejects with `/no file path/i`.
- Non-PDF: a real `notes.txt` rejects with `/not a pdf/i` and the test asserts nothing landed in `raw/`.
- Spaces: golden master copied to `folder with spaces/my report.pdf`, added via a quoted path, dest hash equals the golden digest; file name kept verbatim.

**Screen tests (lines 145–280):** PASS. They follow the Ink 7 non-TTY conventions from tests/AGENTS.md exactly: fake-stdout frame capture with assertions after `unmount()`, fake-TTY stdin (`PassThrough` + `isTTY`/`setRawMode`/`ref`/`unref` stubs), ANSI stripping, hermetic temp workspaces (`mkdtemp`, removed in `afterAll`). The interactive flow test genuinely drives Enter → paste quoted path → Enter and asserts the exact result string, on-disk dest existence, dest hash, the success frame, the cleared input (pasted path absent from the frame), and the refreshed raw/ listing. The error-path test asserts the ErrorBox text and zero bytes copied. The Escape test proves the two-level contract (input → selector: `backCount` stays 0; selector → menu: `backCount` becomes 1). The non-TTY test (`tty: false`) asserts the static fallback renders wiki + raw/ contents + the "require a TTY" notice.

## 3. E2E smoke (temp workspace, destroyed after)

Performed entirely outside the repo in `%TEMP%\llm-wiki-verify-smoke-20260717` (removed afterwards; verified gone):

1. `npx tsx src/cli.ts init smoke-wiki -w <tmp>` printed the exact phase-doc message and created the full wiki tree — Phase 1 CLI behavior intact.
2. Scratch script (deleted with the workspace) called `addPdfToWiki` directly: **7/7 checks passed** — a real PDF at a double-quoted path with spaces (`folder with spaces/my report.pdf`, extra surrounding whitespace) landed in `raw/` with its name kept; `sha256` of the copy computed with `node:crypto` equals the golden master digest (`1e4f2cbe…ac339d`) — byte-identical; golden master itself unmodified; a `.txt` rejected with `Not a PDF file: notes.txt. Only .pdf files can be added to raw/.` and nothing copied; a missing path rejected with `File not found: …`.

**Verdict: PASS.**

## 4. Regression

- **Menu shows 6 items in the right order:** PASS — observed live in the `npm test` output frame: `Create New Wiki (init)` / `Ingest PDFs (ingest)` / `Add PDFs (copy into raw/)` / `Run Tests` / `Settings` / `Exit`. Matches `MENU_ITEMS` in `src/tui/menu.tsx:13-22` (Add PDFs inserted after Ingest, per the compliance entry).
- **`resolveMenuSelection` covers all 6:** PASS — exported unchanged (`menu.tsx:28-31`, lookup over `MENU_ITEMS`); `menu.test.tsx:155-169` asserts every mapping plus the exact order array `['init','ingest','add-pdfs','test','settings','exit']`.
- **Gate 0.7 update carries the citation comment:** PASS — `menu.test.tsx:110-115` comment: "UPDATED 2026-07-17 (user-directed extension) … compliance log entry \"2026-07-17 10:20\" … deviation recorded in .state/phase-1-status.json". The assertion now checks all 6 labels.
- **No extension edits to Phase 0/1 files:** PASS — Phase 1 is not yet committed, so `git diff` cannot isolate the extension; used mtimes instead: `src/commands/init.ts` (09:17), `src/commands/ingest.ts` (09:18), `src/extraction/pdf.ts` (09:14), `src/extraction/markdown-tables.ts` (09:15), `src/state/ingestion-state.ts` (09:16), `src/pages/source-page.ts` (09:16), `src/cli.ts` (09:19), `init-screen.tsx`/`ingest-screen.tsx` (09:24) all predate the Phase 1 verification (09:52) and the extension window; every extension file (`add-pdf.ts`, `add-pdfs-screen.tsx`, `use-raw-contents.ts`, `menu.tsx`, `app.tsx`, the two test/AGENTS.md updates) is stamped 10:24–10:30, after the 10:20 compliance pre-check. All Phase 0/1 tests (34) still pass unchanged.

## 5. Contracts

- **`useInput` gated on raw mode:** PASS — `add-pdfs-screen.tsx:146` and `menu.tsx:48` both use `{ isActive: isRawModeSupported === true }`; the third-party `TextInput` is only mounted inside the raw-mode `add` branch (non-TTY renders the static branch, proven by the passing non-TTY test).
- **Non-TTY fallback renders:** PASS — `add-pdfs-screen.tsx:160-171` static branch (wiki list + raw/ contents + "require a TTY" notice); test asserts it.
- **Escape = back:** PASS — two-level Escape in code (`add-pdfs-screen.tsx:114-126`) and proven by test.
- **No LLM calls:** PASS — no `callLLM`/`llm/client` reference in any extension file (grep clean); `src/llm/` untouched. $0 spend.
- **No new dependencies:** PASS — `git diff HEAD -- package.json` is empty; extension uses only `node:fs/promises`, `node:path`, and already-installed `ink-text-input`.
- **No files outside the project root:** PASS — all extension files are under `src/` and `tests/` (git status confirms); my own smoke artifacts lived in `%TEMP%` and were deleted.

## 6. DOX

- `src/AGENTS.md` accurately documents `commands/add-pdf.ts`, `tui/add-pdfs-screen.tsx`, `hooks/use-raw-contents.ts`, and the **6-item** menu (`tui/` ownership line). PASS.
- `tests/AGENTS.md` accurately documents `tui/add-pdfs-screen.test.tsx`, the gate-0.7 supersession, and the Verification counts (45 total: 44 passed + 1 self-skipped) — matches my observed run. PASS.
- Root `AGENTS.md` User Preferences carries the 2026-07-17 entry ("All core workflows must be doable from the TUI…"). PASS.
- Stale-count grep over both AGENTS.md files, `src/`, and `tests/`: the only "5 options" mentions are the deliberate supersession notes in `tests/AGENTS.md` and `menu.test.tsx`; every current claim says 6. **No stale counts.** PASS.

## Findings (non-blocking; pre-existing, not caused by this extension)

- **FE1:** `tests/AGENTS.md` Ownership omits `tui/test-screen-spawn.test.tsx` (created by Phase 0 commit `86633e8`; HEAD's version of the doc already omitted it). Cosmetic index gap; fix on the next DOX pass.
- **FE2:** `wikis/test-wiki/` (09:58) and `wikis/tui-wiki/` (10:10) are runtime artifacts from post-verification UAT runs, sitting untracked and **not gitignored** (`.gitignore` has no `wikis/*` entry). They are inside the designated runtime folder so no contract is violated, but a blanket `git add -A` would commit them. Consider ignoring `wikis/*/` except `AGENTS.md`/`.gitkeep`.
- **FE3:** Two stale `%TEMP%\llm-wiki-cli-uat-*` directories from earlier manual UAT remain outside the repo (not from this extension; the extension's own tests clean up via `afterAll`). Housekeeping only.

## Extension Verdict

**APPROVE.** All 6 verification items pass with independently produced evidence: 44 passed + 1 by-design skip (45 total, 6 files, 0 failed), `tsc` clean, non-vacuous tests following the Ink 7 conventions, a 7/7 E2E smoke proving byte-identical copies from quoted space-containing paths plus readable rejections, the 6-item menu wired end-to-end with the gate-0.7 supersession documented, frozen Phase 0/1 surfaces untouched, all TUI/LLM/dependency contracts held, and DOX accurate with no stale counts.

---

# Native File Picker Refinement Verification (2026-07-17)

**Verifier:** independent Verifier sub-agent (cold check of the user-directed refinement; no implementation code modified)
**Scope approved by:** `.state/compliance-log.md` entries "2026-07-17 10:20" and "2026-07-17 10:55" (COMPLIANT: native OpenFileDialog primary, manual path entry as fallback only); root `AGENTS.md` User Preferences (both 2026-07-17 entries, confirmed present at lines 90–91)
**Claims checked:** `.state/phase-1-status.json` (`lastAction`, deviation #13, test counts)

## 1. Test suite and typecheck (run independently)

| Check | Command | Observed | Verdict |
|---|---|---|---|
| Full suite | `npm test` | **Test Files 7 passed (7); Tests 56 passed + 1 skipped (57 total); 0 failed.** Per file (my own run, 11:23): file-dialog.test.ts 7, add-pdfs-screen.test.tsx 16, phase-01.test.ts 17, phase-01-screens.test.tsx 6, menu.test.tsx 5, infrastructure.test.ts 5 (1 skipped — the by-design Phase 0 live-LLM gate 0.4), test-screen-spawn.test.tsx 1. Sum: 7+16+17+6+5+5+1 = 57. | **PASS** — counts match the claim exactly |
| Types | `npx tsc --noEmit` | No output, exit 0. | **PASS** |

## 2. `src/utils/file-dialog.ts` line-by-line — PASS

- **No shell injection surface:** `spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', DIALOG_SCRIPT], { shell: false, windowsHide: true })` (lines 63–67). Args array, `shell: false`, so each element is a single argv token, never a shell command line. `DIALOG_SCRIPT` (lines 27–36) is a fixed compile-time string array joined with `'; '` — **zero user input is interpolated anywhere**; picked paths flow back only via stdout into `parseDialogOutput`, never into a command line.
- **PDF filter:** line 30, `$dlg.Filter = 'PDF files (*.pdf)|*.pdf'`. **Multiselect:** line 31, `$dlg.Multiselect = $true`. **Topmost owner trick:** lines 33–34, hidden `Form` with `TopMost=$true; TopLevel=$true` passed to `ShowDialog($owner)` so the dialog cannot hide behind the terminal.
- **Cancel → `null`:** on OK each FileName is printed on its own line; cancel prints nothing and exit code stays 0; line 120 resolves `picked.length > 0 ? picked : null`.
- **Timeout present:** `DIALOG_TIMEOUT_MS = 10 * 60 * 1000` (line 18); the timer kills the child and rejects (lines 77–83); `timer.unref?.()` (line 85) so the timeout can never hold the Node process open. `settled` guard prevents double-settle between timeout/error/close paths.
- **Failure paths:** spawn throw (lines 68–71), `error` event (lines 101–103), and non-zero exit (lines 110–117, stderr appended as detail) all reject with descriptive messages.
- **`parseDialogOutput` correctness:** split on `/\r?\n/`, trim, drop empties (lines 43–48) — handles `\r\n`, bare LF, blank lines, and paths with spaces. Proven headless (item 7).
- **No injection or correctness issue found.** One non-blocking doc nit (FN1 below).

## 3. Tests non-vacuous; no real dialog spawned — PASS

- `tests/file-dialog.test.ts` (7 tests): imports **only** `parseDialogOutput` (line 2) — `pickPdfFiles` is never imported, so nothing can spawn. Assertions are exact `toEqual` array comparisons plus a `not.toContain('\r')` sweep.
- `tests/tui/add-pdfs-screen.test.tsx` (16 tests): every interactive test that reaches the picker injects a `pickFiles` stub — browse flow (line 331), cancel (lines 365–368), picker failure (lines 396–399), mixed results (line 432). The browse-UI test (line 296) passes no stub but never presses Enter on Browse; the manual-entry tests type first, which auto-jumps focus to the manual input, so the default `pickPdfFiles` is never invoked either. **No test can spawn a real dialog.**
- Assertions are genuine: exact result strings (`Added 2 file(s) to add-me/raw/: first doc.pdf, second.pdf`), on-disk existence, dest `sha256` equality with the golden digest `1e4f2cbe…ac339d`, and negative assertions (cancel frame contains no `Error`; missing.pdf absent from raw/; pasted path absent from the frame after a successful add).

## 4. Screen review (`src/tui/add-pdfs-screen.tsx`) — PASS

- **Browse is primary/focused after wiki selection:** `focus` initialised to `'browse'` (line 87) and reset on entering add mode (line 219); renders as `> [ Browse for PDFs... ]` with cyan + bold when focused (lines 290–292); Enter on it runs the picker (lines 228–229).
- **Manual path input demoted to a fallback row:** labeled "Fallback: enter path manually", dimmed unless focused (lines 294–307); typing while Browse is focused auto-focuses it and carries the text (lines 232–238) — the previous paste flow keeps working.
- **Cancel is neutral:** `No files selected.` dim notice, not an ErrorBox (lines 143–148); test asserts the frame contains no `Error`.
- **Dialog failure points at the manual fallback:** `The file picker could not be opened: … Use the fallback manual path entry below instead.` (lines 136–140); test asserts all three fragments.
- **Escape contract:** add controls → wiki selector (resetting focus/feedback/path, lines 194–199), selector → menu via `onBack` (line 201); Escape test proves `backCount` stays 0 then becomes 1.
- **Gated `useInput`:** `{ isActive: isRawModeSupported === true }` (line 245); busy gate at handler top (lines 189–191) blocks input while the dialog/copy is in flight; TextInput `focus` also gated on `status !== 'busy'` (line 303).
- **Non-TTY static fallback renders both controls:** lines 264–273 render the wiki list, raw/ contents, `[ Browse for PDFs... ]`, the fallback manual row, and the "require a TTY" notice; the `tty: false` test asserts all of them.

## 5. Regression — PASS

- **Manual-entry flow tests from the 10:20 iteration still exist and pass:** select-and-paste flow (with sha256-verified copy), missing-file error, two-level Escape, non-TTY fallback — all green in my run. (Phase 1 is uncommitted, so a byte diff vs the 10:20 iteration is impossible; the assertions/pass criteria match what the prior verification window recorded, and the status file records only the additive +5 picker tests.)
- **Menu still 6 items:** `src/tui/menu.tsx:14–21` (init / ingest / add-pdfs / test / settings / exit), also observed live in the `npm test` output frame; `menu.test.tsx` asserts the 6-item order with the gate-0.7 supersession comment.
- **`git diff HEAD -- package.json` empty** (no output, exit 0) — no new dependencies; the refinement uses only `node:child_process`.
- **No LLM references:** per-file grep of all five refinement files found only `llm-wiki-*` temp-dir name prefixes; no `callLLM`/Anthropic/LLM-client imports. $0 spend.
- **Phase 0/1 command/extraction/state/pages files untouched by this refinement (mtime evidence):** init.ts 09:17, ingest.ts 09:18, ingestion-state.ts 09:16, source-page.ts 09:16, markdown-tables.ts 09:15, pdf.ts 09:14, slug.ts 09:12, paths.ts 09:12, cli.ts 09:19, init/ingest screens 09:24, phase-01 tests 09:26–09:29 — all predate both extension windows. The 10:20-extension files (menu.tsx/app.tsx/menu.test.tsx 10:25–10:26, add-pdf.ts 10:24, use-raw-contents.ts 10:24) were not touched by this refinement either; refinement files are stamped 11:05–11:20 (file-dialog.ts, add-pdfs-screen.tsx, both test files, both AGENTS.md updates, status file). All 40 non-refinement tests still pass unchanged.

## 6. DOX — PASS

- `src/AGENTS.md` records the native-picker contract and the new helper accurately: `utils/file-dialog.ts` ownership bullet (args array + `shell: false`, topmost PDF-filtered multi-select OpenFileDialog, 10-minute timeout, `null` on cancel, `parseDialogOutput` exported for tests), the "Native-picker contract" Local Contract (primary picker / demoted fallback / neutral cancel / input gating), and the Windows shellout rule. The `tui/` ownership line records the injectable `pickFiles` and the demoted manual input.
- `tests/AGENTS.md` lists `file-dialog.test.ts` with an accurate description of all 7 parser tests and the never-spawn-the-dialog rule; the `add-pdfs-screen.test.tsx` entry records the 5 new picker tests and the kept manual/Escape flows; Verification states "57 total: 56 passed + 1 self-skipped" — matches my observed run exactly.
- Root `AGENTS.md` User Preferences carries both 2026-07-17 entries (TUI-first workflows; native picker primary, manual entry fallback only).
- No stale claims found; the earlier FE1 gap (`test-screen-spawn.test.tsx` missing from the tests index) is fixed — it is now listed.

## 7. Headless functional spot check — PASS

Ran `parseDialogOutput` via `npx tsx` on a temp script outside the repo (deleted afterwards; `pickPdfFiles` deliberately NOT invoked — the real dialog is user UAT):

- Input `'C:\My Documents\report final.pdf\r\nD:\pdfs\second file.pdf\r\n\r\nE:\x.pdf\r\n'` → `["C:\My Documents\report final.pdf","D:\pdfs\second file.pdf","E:\x.pdf"]` — COUNT=3, HAS_CR=false (multi-path, spaces preserved, blank line skipped, no `\r` leakage).
- `''` → `[]`; `'  \r\n  '` → `[]` (cancel shape → empty array → `null` upstream).

## Findings (non-blocking)

- **FN1 (doc nit):** the `pickPdfFiles` JSDoc says it rejects when PowerShell "writes to stderr", but the implementation rejects only on non-zero exit (stderr is used as error detail). The behavior is arguably the right one — PowerShell can emit benign warnings on stderr with exit 0 — so only the comment overstates. Cosmetic; fix on a future pass.

## Refinement Verdict

**APPROVE.** All 7 verification items pass with independently produced evidence: 7 test files, **56 passed + 1 by-design skip (57 total), 0 failed**; `tsc` clean; `file-dialog.ts` has no shell-injection surface (args array, `shell: false`, fixed script with zero interpolation) and implements the full approved contract (PDF filter, multiselect, topmost owner, cancel → `null`, 10-minute timeout, robust CRLF parser); no test spawns a real dialog; the screen makes Browse the primary focused control with a neutral cancel, a fallback-pointing failure path, the two-level Escape contract, gated input, and a complete non-TTY fallback; all regression surfaces (6-item menu, manual-entry tests, package.json, Phase 0/1 files) are intact; DOX is accurate. The only remaining validation is the user's UAT of the real dialog interaction.
