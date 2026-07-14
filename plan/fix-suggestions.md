# Fix Suggestions — Independent E2E Verification Run

This document lists candidate fixes for each issue in `plan/e2e-bug-report.md`. Each suggestion includes a description, pros and cons rooted in the Project Vision, and a confidence score. Suggestions that would violate the vision or fall below 80% confidence were rejected.

---

## Issue 1 — Working tree becomes dirty during the E2E run

### Suggestion 1A: Generate test fixtures in temp directories instead of `tests/fixtures/`

- **What it does:** Refactor `tests/fixtures/pdf-helpers.ts` so that `createTextPdf`, `createTablePdf`, `createScannedPdf`, etc. write generated PDFs into a per-test temp directory (e.g., `os.tmpdir()` or a directory created by the Vitest setup) and return that path. Tests that need the fixture path should reference the generated file directly or copy it to a temp workspace.
- **Confidence:** 95% — Removing the `writeFileSync` calls into `tests/fixtures/` guarantees the committed files are no longer overwritten by the test suite.
- **Verification:** Run `npm run test`, then `git status --short`; confirm no `tests/fixtures/*.pdf` modifications appear. Add a test that asserts the generated PDF is written outside the repo.
- **Pros:**
  - Preserves the committed working tree, satisfying the E2E constraint that the repository must remain clean.
  - Isolates tests from one another; each test works with its own artifacts.
  - Aligns with the existing pattern in the test suite of using `mkdtempSync` for temp workspaces.
- **Cons:**
  - Requires updating every test that imports fixture paths to either call the helper or use a shared temp-fixture setup.
  - Slightly increases test setup time because fixtures are generated per run instead of reused from disk.

### Suggestion 1B: Ignore generated PDFs under `tests/fixtures/` and generate them in a test-setup hook

- **What it does:** Add `tests/fixtures/*.pdf` to `.gitignore`, remove the committed binary PDFs from the repository, and add a lightweight setup script or Vitest global setup that regenerates the fixtures before tests run.
- **Confidence:** 90% — If the PDFs are no longer tracked, `git status` cannot report them as dirty regardless of `pdf-lib` non-determinism.
- **Verification:** Delete the committed PDFs, add the ignore rule, run the setup and `npm run test`, then confirm `git status --short` is clean.
- **Pros:**
  - Eliminates dirty-working-tree noise from fixture generation with minimal test-file changes.
  - Keeps the helper API unchanged; tests still call the same functions.
- **Cons:**
  - New contributors must run the test setup to generate fixtures; the repository no longer contains them.
  - Deviation from the current practice of committed fixtures; CI must explicitly run the setup step.

---

## Issue 2 — `sample` fails for `abstract-examples` with unparseable ChunkWriter output

### Suggestion 2A: Simplify the ChunkWriter output schema by moving deterministic fields out of the LLM response

- **What it does:** Change the ChunkWriter contract so the LLM returns only the human-authored fields (`title`, `body`, `tags`, `confidence`, and optional `citations`), while deterministic code constructs the `sources` array, `created`/`updated` timestamps, and the `type`/`wiki` frontmatter fields from the `ExtractionResult` and `Config`. The prompt would be updated to request only this simpler JSON shape.
- **Confidence:** 85% — A smaller, more focused schema reduces the chance that the LLM emits malformed JSON, while the deterministic frontmatter fields are already known from the extraction result.
- **Verification:** Add a unit test that mocks an LLM response missing `sources` and `created`/`updated`; confirm `normalizePageUpdate` fills them in and the resulting `PageUpdate` passes `validateFrontmatter`. Run the E2E on `Abstract-Examples.pdf` and confirm ChunkWriter no longer fails.
- **Pros:**
  - Keeps the LLM as the sole author of the markdown body and human-authored metadata.
  - Deterministic fields remain deterministic, which aligns with the Project Vision’s authority matrix (deterministic code handles validation, hashing, and provenance).
  - Reduces token consumption and model confusion by removing redundant fields from the LLM response.
- **Cons:**
  - Requires a contract change between the LLM and `normalizePageUpdate`.
  - The LLM can no longer override `sources` if it wants to cite a narrower page range, though the existing code already defaults to the full source range when `sources` is missing.

### Suggestion 2B: Strengthen the ChunkWriter prompt and repair prompt with explicit JSON-only instructions and a compact example

- **What it does:** Rewrite `buildChunkWriterPrompt` to include:
  - A stronger, repeated instruction to return **only** a single JSON object and no markdown, no explanation, and no trailing commas.
  - A minimal, correct example of the expected JSON with realistic values.
  - A negative example of what **not** to return (e.g., prose wrapped in markdown fences or JSON with missing `pages`).
  - The repair prompt should be a short, focused version of the same instructions rather than the full original prompt plus a generic note.
- **Confidence:** 85% — Prompt clarity is a common cause of unparseable LLM output; a compact example and explicit negative example significantly improve JSON adherence.
- **Verification:** Run the E2E on `Abstract-Examples.pdf` with the updated prompt. If it still fails, inspect the newly logged raw response (see Suggestion 2C) to confirm whether the prompt change moved the response closer to valid JSON.
- **Pros:**
  - No code contract changes; the LLM remains the author of the full frontmatter and body.
  - Directly addresses the most likely root cause: schema confusion or prose wrapping.
- **Cons:**
  - May not help if the root cause is prompt overload or an empty text block.
  - Increases prompt length (though the example can be compact).

### Suggestion 2C (supplementary): Log raw LLM responses on ChunkWriter parse failures

- **What it does:** In `callAgentWithRepair`, when the second parse attempt fails, record the original and repaired LLM responses (with API keys and raw content redacted) in the run log or a dedicated debug artifact so the exact failure mode can be diagnosed.
- **Confidence:** 95% — Better observability is always correct; it does not change LLM behavior and directly enables targeted fixes.
- **Verification:** Add a test with a mock LLM client that returns malformed JSON; confirm the run log contains the raw response text and that no API key is present.
- **Pros:**
  - Aligns with the `AGENTS.md` known gotcha about inspecting Kimi thinking blocks with `test-llm --verbose`.
  - Supports all future ChunkWriter fixes by revealing whether the model returns empty text, thinking-only content, malformed JSON, or a wrong schema.
- **Cons:**
  - Does not by itself fix the parse failure; it is a diagnostic improvement.
  - Log files may grow larger; must ensure no sensitive content is logged.

---

## Summary Table

| Issue | Primary Recommendation | Confidence | Vision Impact |
|---|---|---|---|
| 1 — Dirty working tree | 1A — Generate fixtures in temp directories | 95% | Keeps repository clean during tests/E2E |
| 1 — Dirty working tree | 1B — Ignore and regenerate generated PDFs | 90% | Keeps repository clean, minimal test changes |
| 2 — ChunkWriter failure | 2A — Simplify LLM response schema | 85% | Preserves LLM authorship of bodies while reducing JSON failures |
| 2 — ChunkWriter failure | 2B — Strengthen prompt with explicit examples | 85% | Keeps LLM authorship, reduces schema confusion |

**No source-code changes have been made.** These suggestions are ready for review and explicit approval before implementation.
