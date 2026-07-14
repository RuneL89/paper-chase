# E2E Bug Report

**Date:** 2026-07-14
**E2E workspace:** `C:\temp\wiki-e2e-20260714-204333`
**Status:** Run stopped at first blocking failure.

## Summary

The independent E2E verification run was stopped before completing any `sample` or `ingest` step because the working tree became dirty during the run and the first `sample` command failed with an unparseable LLM response. No further PDFs were processed.

---

## Bug 1: Working tree becomes dirty during the E2E run

- **Severity:** Blocking (violates E2E constraint that the CLI repository must remain clean).
- **E2E step:** Discovered after `npm run test` and again after `npm run dev -- sample abstract-examples ...`.
- **Observed behavior:**
  - Initial `git status --short` was clean.
  - After `npm run test`, then again after the failed sample, `git status --short` showed:
    ```
     M AGENTS.md
     M "Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md"
     M "Project Vision/07_validation_and_quality.md"
     M tests/fixtures/five-page.pdf
     M tests/fixtures/hundred-page.pdf
     M tests/fixtures/medium-scan.pdf
     M tests/fixtures/multi-page-table.pdf
     M tests/fixtures/scanned.pdf
     M tests/fixtures/table.pdf
     M tests/fixtures/ten-page.pdf
    ```
- **Expected behavior per Project Vision / AGENTS.md:** The E2E run must leave the CLI repository untouched. Only the dedicated E2E workspace under `C:\temp` may be modified.
- **Root-cause analysis:**
  - **Test fixtures:** `tests/fixtures/pdf-helpers.ts` writes generated PDFs directly into `tests/fixtures/` whenever the helpers are invoked. `pdf-lib` does not appear to produce byte-identical output across runs, so the committed PDFs are overwritten with different bytes every time the test suite runs. This is the confirmed cause of the fixture modifications.
  - **AGENTS.md and Project Vision files:** The modifications are new documentation clauses about LLM fallback behavior. Their exact provenance during this run is unclear; they were not produced by any E2E command (`init`, `sample`, etc.) or by the `npm run test` output, yet they appeared with timestamps during the run. They nonetheless dirty the working tree and block a clean E2E verification.
- **Affected files/commands:** `tests/fixtures/pdf-helpers.ts`; `tests/fixtures/*.pdf`; `AGENTS.md`; `Project Vision/01_PRODUCT_VISION_AND_ARCHITECTURE.md`; `Project Vision/07_validation_and_quality.md`; `npm run test`.

---

## Bug 2: `sample` fails for `abstract-examples` with unparseable ChunkWriter output

- **Severity:** Blocking (first E2E `sample` step failed; no document pages were produced).
- **E2E step:** `npm run dev -- sample abstract-examples -w "C:\temp\wiki-e2e-20260714-204333"`.
- **Observed behavior:**
  - Command exited with code 1 and the error:
    ```
    ChunkWriter returned invalid or unparseable output after one repair attempt.
    ```
  - The E2E workspace shows only the artifacts written before the orchestrator failed:
    - `chunking-strategy.md` (written)
    - `config.json` (written)
    - `AGENTS.md` (written by `init`)
    - `documents/` directory exists but is empty
    - `sources/` directory exists but is empty
    - `entities/` and `topics/` directories were not created
- **Expected behavior per Project Vision:**
  - `sample` should produce a complete set of starter artifacts including document pages in `documents/`, a source page in `sources/`, and folder-level `index.md` contracts for `documents/`, `sources/`, `topics/`, and `entities/` (with typed sub-folders).
  - The LLM is the sole author of markdown content; deterministic code orchestrates and validates.
- **Root-cause analysis:**
  - `callAgentWithRepair` in `src/orchestrator/agents.ts` calls the LLM once, and if `parseChunkWriterJson` fails it issues one repair prompt. If the second call is also unparseable, it throws the observed error.
  - `parseChunkWriterJson` requires a valid JSON object containing a `pages` array. The LLM response did not satisfy this after two attempts.
  - The LLM configuration and connectivity are functional: `test-llm --verbose` succeeded and returned a text block after a thinking block. Therefore the failure is specific to the ChunkWriter prompt/task.
  - Possible contributing factors:
    1. The LLM returned a malformed or non-JSON response for the `Abstract-Examples.pdf` content.
    2. The JSON schema/request in the prompt is not sufficiently explicit for the model to follow reliably.
    3. The LLM returned only a `thinking` block with no `text` block, or an empty `text` block, causing the client to hand an empty string to the parser.
  - The CLI currently does not log the raw LLM response on ChunkWriter parse failures, so the exact response cannot be inspected without adding instrumentation.
- **Affected files/commands:**
  - `src/orchestrator/agents.ts` (`chunkWriter`, `chunkWriterForChunk`, `callAgentWithRepair`, `parseChunkWriterJson`, `buildChunkWriterPrompt`)
  - `src/llm/client.ts` (text extraction)
  - `src/llm/json.ts` (JSON parsing)
  - Command: `llm-wiki-cli sample <slug>`

---

## Stopped steps

Because of the blocking failure above, the following E2E steps were **not executed**:

- `sample` for `corporate-governance-guidelines-as-of-february-20-2025`
- `sample` for `wipo-pub-rn2021-18e`
- `ingest` for any wiki
- Cross-wiki/index-of-indexes inspection

## Notes

- No code changes were made by the verification agent during the run.
- The E2E workspace data (`C:\temp\wiki-e2e-20260714-204333`) may be discarded; it contains a partial `abstract-examples` wiki with only the failed sample artifacts.
- API key used during the run was the one provided in `C:\Users\atavi\Documents\config.json`; it is masked in this report and was not logged in any repo file.
