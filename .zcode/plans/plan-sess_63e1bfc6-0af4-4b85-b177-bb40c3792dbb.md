# Create New Wiki: native folder browse + always-on target breadcrumb

## Goal
On the Create New Wiki screen, the Workspace row gets a graphical folder picker (like the Add PDFs OpenFileDialog flow) plus an **always-visible breadcrumb** showing the resolved absolute `wikis\` folder the wiki will land in — visible from the moment the screen opens, before typing anything, so the user immediately knows whether the current selection is right or needs changing. Manual path typing stays as fallback (per the 2026-07-17 picker preference pattern).

Default screen state:
```
Title:
Workspace: [ Browse... ] .
  → Wikis will be created in: C:\Users\atavi\Projects\Wiki v5\wikis\<title-slug>
Output Language: [‹ English (English) ›]
```
The breadcrumb resolves `.` (or any typed path) to its absolute form live; `<title-slug>` fills in as soon as Title forms a valid slug.

## 1. New utility `src/utils/folder-dialog.ts` (ports `src/utils/file-dialog.ts`)
- PowerShell `System.Windows.Forms.FolderBrowserDialog` shown via a topmost owner Form (same trick as the existing dialog so it never hides behind the terminal).
- `Description` on the dialog itself: "Choose the folder that will contain your wikis\ folder — the wiki folder itself is created automatically." (the in-dialog part of the user guide).
- `pickFolder(initial?: string): Promise<string | null>` — single stdout line = selected path; empty stdout → `null` (cancel is neutral). SelectedPath pre-seeded with the current workspace value when it resolves to an existing directory, passed via an env var (e.g. `PC_FOLDER_DIALOG_INITIAL`) — no dynamic string splicing into the PS script.
- Identical transport discipline: `powershell.exe -NoProfile -NonInteractive -Command <script>` with an args array, `shell: false`, `windowsHide: true`; 10-minute unref'd timeout; spawn-error and non-zero-exit rejections with trimmed stderr detail; settled guard (src/AGENTS.md Windows shellout rule).
- Export the pure parser (`parseSelectedPath(stdout): string | null`) for tests, mirroring `parseDialogOutput`.

## 2. `src/tui/init-screen.tsx`
- `FIELD_ORDER` becomes `['title', 'workspace', 'browse', 'language', 'create', 'back']` — a `[ Browse... ]` button on the Workspace row, right after the text input.
- Injected prop `pickFolder?: (initial?: string) => Promise<string | null>` defaulting to the real implementation — tests stub it, never spawn the dialog (add-pdfs pattern).
- Enter on Browse: gate input, `LoadingSpinner "Opening folder picker..."`; picked path replaces the Workspace field value (absolute), focus stays on Browse; cancel → dim notice "No folder selected — workspace unchanged."; throw → ErrorBox pointing at the manual field, which stays fully editable.
- **Always-on breadcrumb/preview** (dim line under the Workspace row): `→ Wikis will be created in: <resolve(workspace || '.')>\wikis\<slug>` — rendered from screen open with the `<title-slug>` placeholder until Title yields a valid slug; workspace resolved to absolute so `.` reads as the real cwd path; updates live on every keystroke and after every browse pick.
- Update footer help and the JSDoc; the non-TTY static fallback render includes the Browse button and the breadcrumb line (Ink convention: correct non-TTY render).

## 3. Tests
- `tests/tui/phase-01-screens.test.tsx` (owns init-screen tests): fix Tab counts for the inserted stop; add cases — Browse renders, breadcrumb visible on open showing the resolved absolute `wikis\` path, Enter on Browse calls the stub and fills the field (breadcrumb follows), cancel is neutral, failure shows the error and leaves the field editable, busy gating, slug fills in as Title is typed, non-TTY fallback.
- `tests/phase-11.test.ts` gate 11.4 continuous-workflow flow: add the extra Tab.
- New `tests/folder-dialog.test.ts`: pure parser only (spaces in path, CRLF, empty → null) — the real dialog is user-UAT only.
- Record the user-directive extension in `.state/phase-1-status.json` (2026-07-17 add-pdfs precedent) for gate traceability.
- Verify: `npm test` green, `npx tsc --noEmit` clean; refresh the verification record in tests/AGENTS.md.

## 4. DOX pass
- `src/AGENTS.md`: extend the init-screen ownership entry (Browse stop, always-on breadcrumb, Tab-order change); extend the 2026-07-17 native-picker contract to cover the Create New Wiki folder picker; add folder-dialog.ts to the utils listing.
- `tests/AGENTS.md`: update phase-01-screens entry, add folder-dialog.test.ts entry, refresh the verification record.
- Root `AGENTS.md` User Preferences: new dated entry (2026-08-24) recording this directive (graphical folder picker + always-on resolved-target breadcrumb on Create New Wiki; manual entry fallback).
- `scripts/launcher-entry.ts`: `VERSION` '1.0.22' → '1.0.23' with a dated comment (TUI bundle change → installs must re-extract). No pkg-config change needed — esbuild bundles src; asset globs untouched.

## 5. Rebuild the exe
- `npm run package:win` → `dist/paper-chase.exe` at VERSION 1.0.23, so the feature is immediately usable from dist. No commit unless you ask for one.