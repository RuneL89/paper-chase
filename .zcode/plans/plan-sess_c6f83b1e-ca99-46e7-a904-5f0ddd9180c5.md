# Revised Plan: Qwen + custom model names + test connection + multiple custom providers

## Summary
This is a large, cohesive Settings/TUI expansion with four parts:
1. **Qwen** as a built-in third provider (DashScope OpenAI-compatible endpoint).
2. **Custom model names** for every provider via a `Custom model...` dropdown item.
3. **Per-row model test** on each model slot, validating provider/key + selected model.
4. **Multiple, fully configurable custom providers** with user-defined base URL, API key, headers, request/response JSON templates, and model list.

Custom providers are OpenAI-compatible by default but use a JSON template with placeholders, so they can target OpenRouter, local vLLM, Groq, Azure OpenAI, etc.

Because the scope is large, I recommend implementing in the phases below, but the final architecture is designed for all four features to work together.

## Assumptions to confirm
- A custom provider's **base URL is the full POST endpoint** (e.g., `https://api.example.com/v1/chat/completions`). You can include any path.
- Custom providers use **JSON request bodies** with `{{model}}`, `{{messages}}`, `{{maxTokens}}`, `{{temperature}}` (optional), `{{apiKey}}` placeholders, and dot/bracket JSON paths for response extraction.
- Default headers on a new custom provider: `Authorization: Bearer {{apiKey}}`, `Content-Type: application/json`. You can edit/delete them.
- Default request template: `{"model":"{{model}}","messages":{{messages}},"max_tokens":{{maxTokens}}}`.
- Default response paths: `choices[0].message.content`, `usage.prompt_tokens`, `usage.completion_tokens`.
- Custom provider API keys are stored inside the provider config in `.paper-chase.json` (the file is already gitignored).
- Each custom model has an `id` and optional `label` (label defaults to id).
- Custom providers use default pricing fallback for cost display.

## Phase 1: Qwen (smallest, lowest-risk)

### Files changed
- `src/llm/client.ts`: add `'qwen'` to `Provider`; add `QWEN_API_URL`; dispatch Qwen through the OpenAI-compatible builder; add `DASHSCOPE_API_KEY` resolution; add placeholder `PRICE_PER_MTOK` entries.
- `src/tui/settings.ts`: add `qwen` to `ApiKeys`; add Qwen model block to `MODEL_CATALOG` (`qwen-plus`, `qwen3.7-max`, `qwen3.8-max`); add Qwen defaults; add `__custom__` sentinel to every catalog.
- `src/tui/settings-screen.tsx`: add Qwen provider label and API key row; add Qwen recommendation strings; update non-TTY fallback.
- `tests/phase-11.test.ts` + `tests/phase-14.test.ts`: Qwen routing, request-shape, and seed-model tests.
- `.state/compliance-log.md`: Qwen entry.

## Phase 2: Custom model names + per-row test connection (all providers)

### Data model changes
- `MODEL_CATALOG` gains a `__custom__` sentinel per provider. The actual persisted value is always a raw string, never `__custom__`.
- `ModelRouting` model slots remain `string | null` (custom strings fit naturally).
- `ApiKeys` adds `qwen: string | null` (Phase 1) and is used only for built-in providers.

### `src/llm/client.ts` changes
- Export `resolveModelFromRouting(routing, callType?, override?)` (pure version of `resolveModel`).
- Export `resolveApiKeyForTest(provider, storedKey?)` returning the full key from Settings → env → `.env`.
- Export `testModelConnection(provider, model, apiKey): Promise<{ ok: boolean; message: string }>`.
  - For built-in providers: builds a tiny request with the same builder as production, `maxTokens: 1`, minimal prompt.
  - Uses `undici` directly, no retries, short timeout.
  - Returns success if the response is HTTP 2xx and contains text, otherwise the API error message.
- `callLLM` keeps its existing retry logic and dispatches to the same builders.

### `src/tui/settings-screen.tsx` changes
- Add per-row model test state (`testStatus`, `testMessage`).
- Pressing `T` on a model row resolves the slot's model and provider key, runs `testModelConnection`, and shows the result in a dedicated test-result box (independent of save status).
- Footer help text adds `T: test model`.
- Custom model editing:
  - `editingCustomModel: SettingRow | null` + `customDraft: string`.
  - Cycling to `__custom__` opens a `TextInput` for the raw model id.
  - Submit stores the raw id; Escape cancels; empty submit cancels.
  - When a slot already holds a custom raw id, the cycle list includes that id just before `__custom__` so you can cycle back to it or to `__custom__` to edit.
- Non-TTY fallback displays custom ids and the Qwen key row; test actions are TTY-only.

### Tests
- Custom model persistence, cycling, and reset-on-provider-switch.
- Test connection success, 401/400 errors, and missing key for built-in providers.
- Update existing Settings row-order tests to include the Qwen key row.

## Phase 3: Multiple custom providers (largest change)

### Data model changes

```ts
type BuiltInProvider = 'anthropic' | 'openai' | 'qwen';
type Provider = BuiltInProvider | `custom:${string}`;

interface CustomProviderHeader { key: string; value: string; }
interface CustomProviderResponseTemplate {
  textPath: string;
  inputTokensPath?: string;
  outputTokensPath?: string;
}
interface CustomProviderModel { id: string; label: string; }
interface CustomProviderConfig {
  id: string;        // slug derived from name
  name: string;       // display name
  baseUrl: string;
  apiKey: string | null;
  headers: CustomProviderHeader[];
  requestTemplate: string;            // JSON with {{model}}/{{messages}}/{{maxTokens}}/{{temperature}}/{{apiKey}}
  responseTemplate: CustomProviderResponseTemplate;
  models: CustomProviderModel[];
}

interface TuiSettings {
  synthesis: boolean;
  updateAgents: boolean;
  models: ModelRouting;
  apiKeys: ApiKeys;                 // anthropic, openai, qwen only
  customProviders: CustomProviderConfig[];
}
```

- `ModelRouting.provider` becomes `Provider`.
- Legacy config files without `customProviders` load as `[]`.

### `src/llm/client.ts` changes
- Add helper `isBuiltInProvider(p)` and `parseCustomProviderId(p)`.
- `resolveProvider()` and `resolveModel()` handle custom providers.
- `resolveApiKey(provider, storedKey?)` for built-in remains unchanged; for custom it reads from the matching `CustomProviderConfig.apiKey`.
- Add `buildCustomProviderRequest(config, model, prompt, system, options, apiKey)`:
  - Fills `{{model}}`, `{{messages}}` (JSON array string), `{{maxTokens}}`, `{{temperature}}` (replaced with the value or `null` if omitted), `{{apiKey}}`.
  - Applies headers, filling `{{apiKey}}` in header values.
  - Returns `{ url: config.baseUrl, headers, body }`.
- Add `parseCustomProviderResponse(json, config.responseTemplate)` using a small `getPath(obj, dotBracketPath)` JSON-path helper.
- Add `testModelConnection` support for custom providers (same template/response paths).
- Update `callLLM` dispatch table:
  - `anthropic` → Anthropic builder + parser
  - `openai` / `qwen` → OpenAI-compatible builder + parser (different URLs/keys)
  - `custom:${id}` → custom builder + parser
- `LlmCallLogEntry.provider` now records the full provider string (e.g., `'custom:openrouter'`).

### `src/tui/settings.ts` changes
- Add `CustomProviderConfig`, `CustomProviderModel`, `CustomProviderHeader`, `CustomProviderResponseTemplate` types.
- `TuiSettings` gains `customProviders: CustomProviderConfig[]`.
- `MODEL_CATALOG` becomes a function `getModelCatalog(provider, customProviders)`.
- `DEFAULT_MODEL_FOR_PROVIDER` and `CURATION_MODEL_FOR_PROVIDER` become functions that look up the custom provider's first/second model.
- `seedModelsForProvider(provider, customProviders)` computes custom defaults.
- `normalizeModels` accepts custom providers so it can validate/fallback provider names.
- Add helper functions: `findCustomProvider`, `createCustomProvider(name)`, `deleteCustomProvider`, `addCustomProviderModel`, `removeCustomProviderModel`, etc.
- Update `DEFAULT_SETTINGS` and `normalizeApiKeys`.

### `src/tui/settings-screen.tsx` changes
- Replace the static `ROW_ORDER` with a dynamic `buildRowOrder(settings)` function.
- `SettingRow` type expands to include dynamic rows via template literals:
  ```ts
  type SettingRow =
    | 'synthesis' | 'updateAgents' | 'provider'
    | 'modelDefault' | 'modelExtractor' | 'modelSynthesis' | 'modelDox' | 'modelCuration'
    | 'apiKeyAnthropic' | 'apiKeyOpenai' | 'apiKeyQwen'
    | 'customProviderBaseUrl' | 'customProviderApiKey'
    | 'addCustomProviderHeader' | `customProviderHeader:${number}`
    | 'customProviderRequestTemplate'
    | 'customProviderResponseTextPath'
    | 'customProviderResponseInputTokensPath'
    | 'customProviderResponseOutputTokensPath'
    | 'addCustomProviderModel' | `customProviderModel:${number}`
    | 'addCustomProvider' | 'deleteCustomProvider'
    | 'save' | 'back';
  ```
- When a custom provider is selected, the row order injects configuration rows before the built-in API-key rows.
- Focus handling: recompute the row order after any structural change (add/delete model/header/provider) and preserve/clamp the focus index.
- New UI actions:
  - `addCustomProvider`: type a name, slugify it, create provider with OpenAI-compatible defaults, switch to it.
  - `deleteCustomProvider`: remove current custom provider and switch back to `anthropic`.
  - `customProviderBaseUrl`: edit base URL.
  - `customProviderApiKey`: edit masked API key.
  - `addCustomProviderHeader`: type `key: value`, add to list.
  - `customProviderHeader:${i}`: display header; Enter to delete.
  - `customProviderRequestTemplate`: edit single-line JSON template.
  - `customProviderResponseTextPath` / input/output paths: edit dot/bracket paths.
  - `addCustomProviderModel`: type model id, then optional label; add to list.
  - `customProviderModel:${i}`: display model; Enter to delete.
- Provider row now cycles through `[anthropic, openai, qwen, ...custom provider ids]`. Labels are dynamic (`PROVIDER_LABELS` becomes a function).
- Custom model support and test connection (`T`) work for custom providers exactly like built-in providers.
- Non-TTY fallback: static display of the current custom provider's base URL, headers, template, models, and key (masked).

### `src/commands/ingest.ts` changes
- No logic change; it already passes `models` + `apiKeys` to `setModelRouting`. It will also pass `customProviders` (or `setModelRouting` can read them from the routing object). Since custom provider keys live inside `customProviders`, the routing object needs to carry the whole `TuiSettings` or at least `customProviders` so `resolveApiKey` can find the key.
- Decision: extend `setModelRouting` to accept `customProviders` alongside `apiKeys`, or change `setModelRouting` to accept the full `TuiSettings` and keep `ModelRouting` unchanged for legacy callers. I'll extend `ModelRouting` with an optional `customProviders` field so `setModelRouting({ ...models, apiKeys, customProviders })` works.

## Tests (Phase 3 additions)
- Custom provider creation, deletion, and persistence in `.paper-chase.json`.
- Default/fallback model selection for custom providers.
- Template filling (`{{model}}`, `{{messages}}`, `{{maxTokens}}`, `{{apiKey}}`, headers).
- Response extraction with dot/bracket paths.
- Custom provider test connection with mocked response and error cases.
- Row-order rebuilding when models/headers/providers are added/removed.
- Switching from a custom provider to built-in and back.
- Custom model id and test connection for a custom provider.

## Documentation (`AGENTS.md` trail)
- Update `src/AGENTS.md` to document the new provider model, custom provider template syntax, custom model override, and per-row test connection.
- Update root `AGENTS.md` to record the durable user preference: the model-routing tier guidance applies to all built-in providers and custom providers; custom providers are configured inline in Settings.
- Update `.state/compliance-log.md` with entries for Qwen, custom model override, test connection, and custom providers.

## Packaging / dependencies
- No new npm dependencies. The custom provider template engine, JSON-path helper, and dynamic UI are implemented with existing tools (`undici`, `ink`, `ink-text-input`).
- No changes to `bin/chase.js`, `pkg.config.*`, or `.gitignore` (`.paper-chase.json` is already gitignored).

## Risks and notes
- The custom provider feature is a significant TUI refactor (dynamic row order, dynamic provider list, template engine). It is the highest-risk phase.
- Qwen model IDs (`qwen-plus`, `qwen3.8-max`) are not confirmed on every Alibaba docs page; if they fail, a quick settings-file edit or a custom provider can target the exact regional endpoint.
- Placeholder Qwen prices are approximate; a TODO comment will mark where to update them.
- Single-line JSON templates in the TUI are usable but not ideal for very complex bodies. For complex cases, users can edit `.paper-chase.json` directly and the TUI will read it.

## Suggested implementation order
1. **Phase 1 (Qwen)** — small, self-contained, adds the third built-in provider.
2. **Phase 2 (custom model names + test connection)** — refactor model rows, add `T` test, add `__custom__` sentinel; works for all existing and future providers.
3. **Phase 3 (multiple custom providers)** — dynamic providers, template engine, inline TUI config.

You can approve the whole plan or ask me to start with Phase 1 only. After any phase, I will run `npm test` and update the `AGENTS.md` trail before moving on.