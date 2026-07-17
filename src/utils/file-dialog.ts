import { spawn } from 'node:child_process';

/**
 * OS-native graphical PDF file picker (user-directed refinement, compliance
 * log entry "2026-07-17 10:55"): the primary way to add PDFs to a wiki is
 * navigating the disk graphically, not typing/pasting paths.
 *
 * Implementation: spawns Windows PowerShell with a script that shows a
 * System.Windows.Forms OpenFileDialog (PDF-filtered, multi-select, owned by a
 * topmost form so it never hides behind the terminal). The dialog prints each
 * selected file name on its own stdout line; cancel prints nothing.
 *
 * Windows shellout rule (src/AGENTS.md): spawn is called with an args array
 * and `shell: false` — no string concatenation into a shell.
 */

/** Dialog blocks while the user browses, so the timeout is generous. */
const DIALOG_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * PowerShell script. Kept as a single Node string passed via `-Command` (one
 * argv element; the API tokenizes arguments, it is not a shell). The dialog is
 * shown with a topmost owner Form so it appears in front of the terminal
 * window. On OK each FileName is written on its own line; on cancel nothing
 * is written and the exit code stays 0.
 */
const DIALOG_SCRIPT = [
  "Add-Type -AssemblyName System.Windows.Forms",
  "$dlg = New-Object System.Windows.Forms.OpenFileDialog",
  "$dlg.Filter = 'PDF files (*.pdf)|*.pdf'",
  "$dlg.Multiselect = $true",
  "$dlg.Title = 'Select PDF files to add to the wiki'",
  "$owner = New-Object System.Windows.Forms.Form -Property @{TopMost=$true; TopLevel=$true}",
  "$result = $dlg.ShowDialog($owner)",
  "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { $dlg.FileNames | ForEach-Object { [Console]::Out.WriteLine($_) } }",
].join('; ');

/**
 * Parse the dialog's stdout into a list of file paths. Pure and exported for
 * tests. Handles Windows `\r\n` line endings, skips blank lines; empty output
 * (user cancelled) yields an empty array.
 */
export function parseDialogOutput(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Show the native OpenFileDialog and resolve with the chosen PDF paths.
 *
 * - Resolves with `string[]` (one entry per picked file) when the user
 *   confirms; the array is non-empty by construction (empty stdout = cancel).
 * - Resolves with `null` when the user cancels.
 * - Rejects with a descriptive Error when PowerShell cannot be spawned, exits
 *   non-zero, writes to stderr, or the 10-minute timeout elapses.
 */
export function pickPdfFiles(): Promise<string[] | null> {
  return new Promise((resolvePromise, rejectPromise) => {
    let child;
    try {
      child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', DIALOG_SCRIPT],
        { shell: false, windowsHide: true },
      );
    } catch (err) {
      rejectPromise(new Error(`Could not open the file picker: ${(err as Error).message}`));
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        rejectPromise(new Error('The file picker timed out after 10 minutes.'));
      }
    }, DIALOG_TIMEOUT_MS);
    // Never let the dialog timeout keep the Node process alive on its own.
    timer.unref?.();

    const fail = (message: string) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        rejectPromise(new Error(message));
      }
    };

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      fail(`Could not open the file picker: ${err.message}`);
    });
    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const detail = stderr.trim();
        rejectPromise(
          new Error(
            `The file picker failed (PowerShell exited with code ${code})${detail ? `: ${detail}` : ''}`,
          ),
        );
        return;
      }
      const picked = parseDialogOutput(stdout);
      resolvePromise(picked.length > 0 ? picked : null);
    });
  });
}
