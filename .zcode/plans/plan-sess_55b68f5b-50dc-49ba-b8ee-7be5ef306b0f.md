## Plan: merge multi-provider branch, re-add DeepSeek/Zhipu/GLM, and add Qwen3.8-Flash + GLM-5.3-Flash

### 1. Merge `feat/multi-provider-and-429-stall` into `Ox-alpha`
- Run `git merge feat/multi-provider-and-429-stall` on the current `Ox-alpha` branch.
- This reintroduces the DeepSeek and Zhipu/GLM built-in providers.
- Expected conflicts: `src/llm/client.ts`, `src/tui/settings.ts`, `src/tui/settings-screen.tsx`, test files, and docs.

### 2. Resolve merge conflicts
- Keep DeepSeek/Zhipu provider support from `feat/multi-provider-and-429-stall`.
- Keep Phase 16 v1.0.4/v1.0.5 improvements from `Ox-alpha`: transport-stalls audit log, JSON corrector, per-attempt deadlines, `Retry-After` clamp.
- Keep Phase 24 cross-wiki work from `Ox-alpha`.

### 3. Add `qwen3.8-flash` to the Qwen built-in catalog
- File: `src/tui/settings.ts`
- Add `{ id: 'qwen3.8-flash', label: 'Qwen 3.8 Flash' }` to `MODEL_CATALOG.qwen` as a Sonnet-tier option.
- Do **not** change `DEFAULT_MODEL_FOR_PROVIDER.qwen` or `CURATION_MODEL_FOR_PROVIDER.qwen`.

### 4. Add `glm-5.3-flash` to the Zhipu/GLM built-in catalog
- File: `src/tui/settings.ts`
- Add `{ id: 'glm-5.3-flash', label: 'GLM-5.3-Flash' }` to `MODEL_CATALOG.zhipu` as a Sonnet-tier option.
- Do **not** change `DEFAULT_MODEL_FOR_PROVIDER.zhipu` or `CURATION_MODEL_FOR_PROVIDER.zhipu`.

### 5. Update price table
- File: `src/llm/client.ts` (`PRICE_PER_MTOK`)
- Add:
  - `'qwen3.8-flash': { input: 0.16, output: 0.47 }`
  - `'glm-5.3-flash': { input: 0.15, output: 0.5 }`

### 6. Update TUI recommendation labels
- File: `src/tui/settings-screen.tsx` (`RECOMMENDATIONS`)
- For Qwen, update the Sonnet-tier rows (Synthesis Writer, DOX Writer, Curation, Cross-Wiki Judgment) to point at `Qwen 3.8 Flash` as the recommended mid-tier choice.
- For Zhipu/GLM, add recommendation labels for the same Sonnet-tier rows pointing at `GLM-5.3-Flash`.
- Existing seed defaults stay unchanged; these labels are UI guidance only.

### 7. Verify
- Run TypeScript compilation (`tsc --noEmit` or equivalent).
- Run the vitest suite, focusing on `tests/phase-11.test.ts` and any provider-related tests.
- Update affected docs (`AGENTS.md`, `Implementation Plan/PHASE_11_polish.md`) if the provider list or user preferences changed.

### 8. Release packaging (if requested)
- Bump `VERSION` in `scripts/launcher-entry.ts` because the settings bundle changed.
- Rebuild `dist/paper-chase.exe` via `npm run package:win`.

### Pricing supplied by user
- Qwen3.8-Flash: `$0.16` input / `$0.47` output per million tokens.
- GLM-5.3-Flash: `$0.15` input / `$0.50` output per million tokens.

### Out-of-scope / user-confirmed
- New models will **not** become the seeded default or curation model.
- DeepSeek will be restored alongside Zhipu/GLM because it lives in the same merged branch.