import { spawn } from 'node:child_process';

/**
 * OS-native graphical folder picker (user-directed refinement 2026-08-24,
 * extending the 2026-07-17 native-picker preference to the Create New Wiki
 * screen): choosing the parent folder for a new wiki is done graphically,
 * not by typing/pasting paths.
 *
 * Implementation mirrors utils/file-dialog.ts: spawns Windows PowerShell with
 * a script that shows a System.Windows.Forms FolderBrowserDialog owned by a
 * topmost form so it never hides behind the terminal. The dialog prints the
 * selected folder path on stdout; cancel prints nothing.
 *
 * Windows shellout rule (src/AGENTS.md): spawn is called with an args array
 * and `shell: false` — no string concatenation into a shell. The optional
 * initial folder is passed through an environment variable (never spliced
 * into the script) so arbitrary user paths cannot break the script.
 */

/** Dialog blocks while the user browses, so the timeout is generous. */
const DIALOG_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * PowerShell script. Kept as a single Node string passed via `-Command` (one
 * argv element; the API tokenizes arguments, it is not a shell). The dialog
 * description doubles as the in-dialog user guide: only the PARENT folder is
 * chosen — the wiki folder itself is created automatically inside it. When
 * PC_FOLDER_DIALOG_INITIAL is set (and names an existing folder), the dialog
 * opens there. On OK the selected path is written as a single line; on cancel
 * nothing is written and the exit code stays 0.
 */
const DIALOG_SCRIPT = [
  'Add-Type -AssemblyName System.Windows.Forms',
  '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog',
  "$dlg.Description = 'Choose the folder where your wikis live. The wiki folder itself is created automatically inside it.'",
  'if ($env:PC_FOLDER_DIALOG_INITIAL) { $dlg.SelectedPath = $env:PC_FOLDER_DIALOG_INITIAL }',
  "$owner = New-Object System.Windows.Forms.Form -Property @{TopMost=$true; TopLevel=$true}",
  '$result = $dlg.ShowDialog($owner)',
  'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.WriteLine($dlg.SelectedPath) }',
].join('; ');

/**
 * Parse the dialog's stdout into the selected folder path. Pure and exported
 * for tests. Handles Windows `\r\n` line endings; blank lines are skipped;
 * the first non-empty line is the selection; empty output (user cancelled)
 * yields `null`.
 */
export function parseSelectedPath(stdout: string): string | null {
  const picked = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return picked.length > 0 ? picked[0] : null;
}

/**
 * Show the native FolderBrowserDialog and resolve with the chosen folder.
 *
 * - `initial` optionally pre-selects a folder in the dialog tree (the caller
 *   passes the current Workspace value; passing a non-existent path is
 *   pointless, so callers should only pass directories that exist).
 * - Resolves with `string` (the absolute selected path) when the user
 *   confirms; empty stdout maps to `null`.
 * - Resolves with `null` when the user cancels.
 * - Rejects with a descriptive Error when PowerShell cannot be spawned, exits
 *   non-zero, or the 10-minute timeout elapses.
 */
export function pickFolder(initial?: string): Promise<string | null> {
  return new Promise((resolvePromise, rejectPromise) => {
    let child;
    try {
      child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', DIALOG_SCRIPT],
        {
          shell: false,
          windowsHide: true,
          env:
            initial !== undefined && initial.length > 0
              ? { ...process.env, PC_FOLDER_DIALOG_INITIAL: initial }
              : process.env,
        },
      );
    } catch (err) {
      rejectPromise(new Error(`Could not open the folder picker: ${(err as Error).message}`));
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        rejectPromise(new Error('The folder picker timed out after 10 minutes.'));
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
      fail(`Could not open the folder picker: ${err.message}`);
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
            `The folder picker failed (PowerShell exited with code ${code})${detail ? `: ${detail}` : ''}`,
          ),
        );
        return;
      }
      resolvePromise(parseSelectedPath(stdout));
    });
  });
}
