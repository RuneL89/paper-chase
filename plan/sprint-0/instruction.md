# Sprint 0: Foundation & CLI Scaffolding

| Attribute | Value |
|---|---|
| Sprint | 0 |
| Goal | Bootstrap the Node.js project, CLI entry point, workspace discovery, and configuration inheritance so later sprints have a stable base. |
| FRD References | FR-001, FR-019, FR-021 |
| Implements | Workspace layout, CLI command stubs, workspace/wiki config loading, plain-language errors, and non-zero exit codes. |
| Dependencies | None |
| Est. Duration | Small |

## Why This Matters

Before any PDF can be extracted or page written, the tool must exist as a runnable CLI, know where the workspace lives, discover wikis correctly, and load configuration from both workspace and wiki levels. A solid foundation prevents every later sprint from re-implementing command parsing, config merging, or error handling. This sprint also establishes the journalist-facing UX tone: clear, actionable messages instead of stack traces.

## Tasks

1. Initialize the Node.js project with `package.json`, `bin` entry, and TypeScript or JavaScript build setup.
2. Add the CLI framework (e.g., Commander.js) and create the entry point `src/cli.ts` (or `bin/llm-wiki-cli.js`).
3. Implement `--help` and per-command help stubs for `sample`, `ingest`, `ingest-all`, and `status`.
4. Implement workspace discovery: validate `<workspace>/wikis/` exists and enumerate wiki folders containing a `raw/` subfolder.
5. Implement configuration loading and merging: workspace-level `.kimi-code/config.json` overrides defaults; wiki-level `config.json` overrides workspace defaults.
6. Validate required config fields and emit plain-language errors for missing or invalid values.
7. Implement plain-language progress messages and fatal-error handling with non-zero exit codes.
8. Create a test fixture workspace with at least one sample wiki folder and write tests for the above behaviors.

## Technical Acceptance Criteria (TAC)

1. `package.json` exists with a `bin` entry named `llm-wiki-cli` and declared runtime dependencies.
2. `llm-wiki-cli --help` lists all commands with descriptions and examples.
3. Running the CLI in a directory without a `wikis/` folder emits a clear, actionable error and exits with a non-zero code.
4. A workspace with a valid wiki folder (`wikis/<slug>/raw/`) is discovered and the wiki slug is resolved correctly.
5. Config merging follows the precedence: wiki `config.json` > workspace `.kimi-code/config.json` > hard-coded defaults. Missing required fields produce a clear error before ingestion.
6. All command stubs return a non-zero exit code when invoked with invalid arguments or in an invalid workspace.

## UAT Acceptance Criteria (UAC)

1. A journalist can install the package and run `llm-wiki-cli --help` to understand the available commands.
2. Running a command in a malformed workspace produces a plain-language error message that explains what is wrong.
3. The CLI reports which wiki(s) it discovered before attempting any processing.

## LOOP ENGINEERING METHODOLOGY

### Phase A: PLAN
1. List ALL files to create/modify.
2. List ALL tests to write.
3. List ALL dependencies to install.
4. Identify risks and fallbacks.
5. Verify tech stack compatibility.
6. Plan order: backend → API → frontend → integration.

### Phase B: RED — Write Failing Tests
1. Write tests for each TAC BEFORE implementation.
2. Tests MUST fail when first run.
3. Use appropriate test frameworks.
4. Each test maps to exactly one TAC.
5. Max 10 test cases per feature. Split if more needed.

### Phase C: GREEN — Implement Minimal Code
1. Write minimum code to make tests pass.
2. After EVERY file change, run compiler/linter.
3. If compilation fails, enter Self-Correcting loop (max 5 iterations).
4. Do NOT write perfect code. Write working code.

### Phase D: EVALUATE — Score Against TAC Rubric
1. Score each TAC: 0 (fail), 0.5 (partial), 1 (pass).
2. Calculate overall percentage.
3. If < 100%, identify failures and revise.
4. Re-run tests and re-score.
5. Max 3 evaluation iterations.

### Phase E: REFACTOR — Improve Quality
1. Clean up while keeping tests green.
2. Remove dead code, console.logs, temporary comments.
3. Ensure consistent naming and organization.
4. Add inline comments only for non-obvious logic.
5. Verify no compiler warnings remain.
6. Do NOT add new features.

### Phase F: REPORT
Report back with:
- PASS/FAIL table for each TAC
- Test commands and output
- Compilation errors and resolutions
- Files created/modified (with line counts)
- Dependencies installed
- Blockers or notes for subsequent sprints
