# Independent E2E Verification Prompt

**Role:** Independent verification agent. You have access only to the project folders on this machine.

**Goal:** Verify the LLM Wiki CLI against the `Project Vision/` documents by first reviewing the implementation, then running the CLI end-to-end against a fresh workspace. If the E2E run reveals issues, root-cause them and apply fixes that **strictly align** with the Project Vision.

---

## Sources of Truth (Read Before Starting)

- `C:\Users\atavi\Projects\Wiki v4\AGENTS.md` — workspace rules, including the Vision Authority for Changes and Fixes policy and the E2E two-phase process.
- `C:\Users\atavi\Projects\Wiki v4\Project Vision\` — canonical product vision, architecture, page types, citation rules, and validation expectations.

Read these first. Any action you take must be consistent with them. If a proposed fix would violate the Project Vision, reject it and report the conflict instead.

---

## Hard Constraints (Apply to Both Phases)

- **No deterministic fallbacks for LLM failures.** The LLM is the sole author of synthesized content. If an LLM sub-agent fails, retry once with a stricter repair prompt, then abort. Never substitute deterministic page creation, updates, append, or repair.
- **No human approval gates for structural changes.** Structural changes are applied autonomously by the LLM and logged for after-the-fact review.
- **Preservation-first updates.** Manually edited pages and rewrites that drop citations/wikilinks are skipped, not overwritten.
- **No raw PDF bytes to the LLM.** Only extracted text and metadata go to remote LLMs.
- **No LLM agent performs file I/O or computes hashes.** Deterministic code owns extraction, hashing, validation, and file I/O.
- **Project Vision is the top authority.** Before any code change or fix, re-read the relevant `Project Vision/` files and confirm the proposal aligns.
- **Do not add workarounds, defensive retries, or silent repairs that contradict the vision.** If the only fix violates the vision, stop and escalate.

---

## Phase 0: Clear Prior E2E Artifacts

Before starting the review, clear the previous E2E artifacts so old fixed bugs are not included in the analysis:

- `C:\Users\atavi\Projects\Wiki v4\plan\e2e-bug-report.md` — if this file exists, clear its contents before writing new findings.
- `C:\Users\atavi\Projects\Wiki v4\plan\fix-suggestions.md` — if this file exists, clear its contents before writing new suggestions.

After clearing the artifacts, proceed to Phase 1.

---

## Phase 1: Code Review Against the Project Vision

Before touching a live workspace, review the implementation code that will be exercised and check it against the relevant `Project Vision/` documents.

### Phase 1.1 Files to review

At minimum, inspect:

- `src/ingestion/chunk-materializer.ts` — preservation check, no deterministic fallback, manual-edit handling.
- `src/orchestrator/proposals.ts` and `src/orchestrator/ingest.ts` — autonomous structural changes, no approval gate, change logging.
- `src/writers/agents.ts` — generated per-wiki `AGENTS.md` uses autonomous structural-change language.
- `src/ingestion/reingest.ts` — preservation-first by default, moves preserve content, manual edits skipped.
- `src/orchestrator/agents.ts` and `src/writers/document.ts` — required frontmatter is LLM-authored, no deterministic repair.
- `src/llm/client.ts` and orchestrator prompts — no raw PDF bytes, no deterministic fallback.
- `src/validation/schema.ts` — schema enforces vision-compliant frontmatter.

### Phase 1.2 Checklist

For each file, verify:

1. Does the code contradict any Project Vision principle?
2. Does the code contain any deterministic fallback for LLM-authored content?
3. Does the code require or imply human approval for structural changes?
4. Does the code overwrite manually edited pages by default?
5. Does the code silently repair missing or invalid LLM frontmatter?

### Phase 1.3 Outcome

- If any code violates the vision, fix it **before** Phase 2.
- Document the violation and the fix in `plan/e2e-bug-report.md`.
- If the code is clean, proceed to Phase 2.

---

## Phase 2: Live E2E Run

Run the CLI end-to-end against a fresh workspace.

### Phase 2.1 Test Setup

- **Source PDFs:** `C:\Users\atavi\Documents\test-ingest`
- **Target workspace:** Create a new folder in `C:\temp` (e.g., `C:\temp\wiki-e2e-<timestamp>`).
- **Wikis:** Create one wiki per PDF.
- **LLM configuration:** `C:\Users\atavi\Documents\config.json`
- **Timeout:** Set ingestion timeout to **90 minutes**. Large documents can take 10–30 minutes or more. Do not interrupt or restart just because a single file takes longer than 10 minutes.

### Phase 2.2 Procedure

1. In the CLI repository (`C:\Users\atavi\Projects\Wiki v4`):
   - Run `git status --short` and confirm a clean working tree.
   - Run `npm run build` and confirm it succeeds.
   - Run `npm run test` and confirm the full Vitest suite passes.
2. For each PDF in `C:\Users\atavi\Documents\test-ingest`:
   - Create a wiki using the CLI `init` command.
   - Run the CLI `sample` command.
   - Run the CLI `ingest` command.
3. Inspect the generated workspace and compare against `Project Vision/`:
   - Each wiki has the expected structure: `index.md`, `AGENTS.md`, `chunking-strategy.md`, `documents/`, `sources/`, `topics/`, `entities/`, `raw/`, `lint/`, and `.state/`.
   - Folder-level `index.md` contracts are co-located with content pages.
   - Factual claims cite exact PDF sources via `[^srcN]` markers.
   - The top-level workspace has an `index-of-indexes.md`.
   - Entity pages are grouped under typed sub-folders inside `entities/`.
   - Cross-wiki links and the index-of-indexes are populated if applicable.
   - Output matches the expected quality and quantity described in the Project Vision.

### Phase 2.3 When an Issue Is Found

Do not stop at the first failure and walk away. Instead:

1. **Stop the run.** Do not continue past an unanalyzed failure.
2. **Root-cause the issue.** Identify the command, file, and line(s) responsible.
3. **Check the proposed fix against the Project Vision.** Re-read the relevant `Project Vision/` files before writing any code.
4. **Apply the fix only if it aligns with the vision.** If the only fix violates the vision, stop and report the conflict to the user.
5. **Re-verify.** After the fix, rerun the failing step and continue the E2E run.
6. **Document the issue and fix.** Write both into `plan/e2e-bug-report.md` and update `plan/fix-suggestions.md` if alternative fixes were considered.

### Phase 2.4 Hard Constraints for the Live Run

- **Verify the working tree is clean before starting.** If it is not, stop and report.
- **If the working tree becomes dirty during the run, stop immediately** and report the unexpected change.
- **Only E2E workspace data may be modified.** Do not touch the CLI repository except for the required fix.
- **Do not run commands as background tasks.** Run each command synchronously and report the result before proceeding.
- **No raw PDF bytes to the LLM.** Confirm only extracted text/metadata is sent.

---

## Phase 3: Bug Reporting

For each issue found in either phase:

1. **Write a Bug Report** at `C:\Users\atavi\Projects\Wiki v4\plan\e2e-bug-report.md`.
2. **For each bug**, include:
   - Clear title and severity.
   - Phase and step where it was found.
   - Observed behavior.
   - Expected behavior per the Project Vision.
   - Root-cause analysis.
   - Affected files or commands.
   - Fix applied (if any) and how it aligns with the vision.
3. **Update the bug report as you discover more issues.** Do not wait until the end.

---

## Phase 4: Fix Suggestions

After the E2E run is complete (or stopped due to a vision conflict that must be escalated):

1. For **each bug** in the bug report, create at least **two fix suggestions** if more than one vision-aligned path exists.
2. Each suggestion must include:
   - A description of the proposed fix.
   - **Pros** rooted in the Project Vision.
   - **Cons** describing any deviation from the Project Vision, even a slight one.
   - A **confidence score** (0–100%) of how likely the fix is to resolve the issue.
3. **Verify each suggestion.** Before presenting it, confirm it would actually fix the issue and does not violate the Project Vision.
4. If any suggestion has a confidence score below **80%**, or if it violates the Project Vision in any way, reject it and replace it with a better one. Continue until you have at least two valid suggestions per issue, or one if only one vision-aligned path exists.
5. Write the final fix suggestions to `C:\Users\atavi\Projects\Wiki v4\plan\fix-suggestions.md`.

---

## Phase 5: Output to Present

When you are done, present a summary that includes:

1. Whether the working tree remained clean throughout (except for the required `plan/` artifacts).
2. Whether `npm run build` and `npm run test` passed.
3. Phase 1 code-review findings and any fixes applied before the E2E run.
4. The outcome of each E2E step (`init` / `sample` / `ingest`) for each PDF.
5. A summary of the bug report findings and the fixes applied during the run.
6. The fix suggestions with pros, cons, and confidence scores.
7. A clear statement: **all applied fixes were checked against the Project Vision before implementation.**

---

## Phase 6: Final Rule

**Never apply a fix that contradicts the Project Vision.** If the only apparent fix would violate the vision, stop and report the conflict to the user. The Project Vision is the highest authority for any change or fix in this project.
