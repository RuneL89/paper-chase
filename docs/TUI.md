# Terminal User Interface (TUI)

The `llm-wiki-cli tui` command launches an interactive, terminal-based frontend for the LLM Wiki CLI. It wraps the same commands as the CLI (`init`, `sample`, `ingest`, `configure-llm`) in a keyboard-driven interface inspired by Claude Code and Hermes.

## Launch

```bash
llm-wiki-cli tui
llm-wiki-cli tui -w ./my-workspace
llm-wiki-cli tui --non-interactive   # renders one frame and exits (for CI)
```

## Navigation

- **↑ / ↓** — navigate lists
- **Enter** — select the highlighted item
- **Tab** — move to the next field in forms
- **Esc** — go back to the previous screen or quit from the welcome screen
- **q** — quit from the welcome screen

## Screens

### Welcome

Choose an action:

- Open the current workspace
- Choose a different workspace
- Configure the LLM connection
- Create or manage wikis
- Quit

### Workspace

Enter a workspace directory path. The directory must already exist. This becomes the root folder that contains `wikis/` and `.kimi-code/`.

### Dashboard

Lists all existing wikis in the workspace with their status (`initialized` or `ready`). From here you can:

- Select a wiki to view its details
- Create a new wiki
- Configure the LLM connection

### Create Wiki

Fill in the wiki slug, title, and description. This runs the same `init` command as the CLI and then takes you to the wiki detail screen.

### Wiki Detail

Shows the wiki status and the PDFs in `raw/`. Actions:

- **Run sample** — run the sampling orchestrator on the first PDF
- **Run full ingestion** — run the full ingestion pipeline
- **Add PDFs** — shows the path to copy files into (`wikis/<slug>/raw/`)
- **Back** — return to the dashboard

### Configure LLM

Configure the LLM provider, model, base URL, and API key. This writes to `<workspace>/.kimi-code/config.json`. The connection is tested when you save.

### Progress

During `sample` or `ingest`, the Progress screen shows live status:

- **Operation panel** — current sub-agent, source progress, and chunk progress
- **LLM Calls panel** — provider, model, estimated tokens, cost, and status of the last 10 LLM calls
- **Issues panel** — warnings, errors, and Critic issues as they appear

The screen updates automatically as the orchestrator emits progress events.

### Result

Shown when the operation completes. From here you can return to the dashboard.

## Architecture

The TUI is built with [Ink](https://github.com/vadimdemedes/ink) and React. It reuses the existing command functions (`sampleCommand`, `ingestCommand`, `initCommand`, `configureLlmCommand`) and a `CollectingReporter` to receive live progress events. No TUI code computes hashes or writes files directly; the authority boundary between deterministic code and LLM-authored markdown is preserved.

### Progress instrumentation

- `src/progress/types.ts` — `ProgressReporter` interface and event types
- `src/progress/collecting-reporter.ts` — stores events for the TUI to poll
- `src/llm/client.ts` — emits `llm-call-start`, `llm-call-end`, and `llm-call-retry`
- `src/orchestrator/index.ts` and `src/orchestrator/ingest.ts` — emit `step-start`/`step-end`, `chunk-progress`, `critic-issues`, and `proposal` events
- `src/ingestion/engine.ts` — emits `source-start`/`source-end`, `warning`, `error`, and `summary` events

## CI / non-interactive mode

The `--non-interactive` flag renders the welcome screen once using `renderToString` and exits. This is used by `tests/tui/tui.test.ts` to verify the command loads without requiring a TTY.

## Keyboard reference

| Screen | Keys |
|---|---|
| Welcome | ↑/↓ navigate, Enter select, q quit |
| Workspace | Enter confirm path, Esc back |
| Dashboard | ↑/↓ navigate, Enter select, Esc back |
| Wiki Detail | Enter run action, Esc back |
| LLM Config | Tab next field, Enter save, Esc back |
| Create Wiki | Tab next field, Enter save, Esc back |
| Progress | wait for completion |
| Result | Enter continue, Esc dashboard |
