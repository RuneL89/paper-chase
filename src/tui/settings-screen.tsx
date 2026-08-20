import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { SuccessBox } from './components/success-box';
import { ErrorBox } from './components/error-box';
import {
  loadSettings,
  saveSettings,
  seedModelsForProvider,
  getModelCatalog,
  getDefaultModelForProvider,
  createCustomProvider,
  MODEL_CATALOG,
  type Provider,
  type TuiSettings,
} from './settings';
import { getApiKeyStatus, resolveApiKeyForTest, resolveSlotFromRouting, testModelConnection } from '../llm/client';
import type { ModelSlot } from '../llm/client';
import type { ScreenProps } from './init-screen';

export interface SettingsScreenProps extends ScreenProps {
  /** Workspace directory containing `.paper-chase.json` (default '.'). */
  workspace?: string;
}

type StaticSettingRow =
  | 'synthesis'
  | 'updateAgents'
  | 'provider'
  | 'modelDefault'
  | 'modelExtractor'
  | 'modelSynthesis'
  | 'modelDox'
  | 'modelCuration'
  | 'modelCrossWiki'
  | 'modelCrossWikiJudgment'
  | 'apiKeyAnthropic'
  | 'apiKeyOpenai'
  | 'apiKeyQwen'
  | 'apiKeyDeepseek'
  | 'apiKeyZhipu'
  | 'customProviderBaseUrl'
  | 'customProviderApiKey'
  | 'addCustomProviderHeader'
  | 'customProviderRequestTemplate'
  | 'customProviderResponseTextPath'
  | 'customProviderResponseInputTokensPath'
  | 'customProviderResponseOutputTokensPath'
  | 'addCustomProviderModel'
  | 'addCustomProvider'
  | 'deleteCustomProvider'
  | 'save'
  | 'back';

type SettingRow = StaticSettingRow | `customProviderHeader:${number}` | `customProviderModel:${number}`;

/**
 * Build the row order dynamically. When a custom provider is selected, its
 * configuration rows are injected before the built-in API-key rows.
 */
function buildRowOrder(settings: TuiSettings): SettingRow[] {
  const order: SettingRow[] = [
    'synthesis',
    'updateAgents',
    'provider',
    'modelDefault',
    'modelExtractor',
    'modelSynthesis',
    'modelDox',
    'modelCuration',
    'modelCrossWiki',
    'modelCrossWikiJudgment',
  ];
  const provider = settings.models.provider ?? 'anthropic';
  if (provider.startsWith('custom:')) {
    const cp = settings.customProviders.find((c) => c.id === provider.slice(7));
    if (cp) {
      order.push('customProviderBaseUrl');
      order.push('customProviderApiKey');
      order.push('addCustomProviderHeader');
      cp.headers.forEach((_, i) => order.push(`customProviderHeader:${i}`));
      order.push('customProviderRequestTemplate');
      order.push('customProviderResponseTextPath');
      order.push('customProviderResponseInputTokensPath');
      order.push('customProviderResponseOutputTokensPath');
      order.push('addCustomProviderModel');
      cp.models.forEach((_, i) => order.push(`customProviderModel:${i}`));
      order.push('deleteCustomProvider');
    }
  }
  order.push('addCustomProvider');
  order.push('apiKeyAnthropic');
  order.push('apiKeyOpenai');
  order.push('apiKeyQwen');
  order.push('apiKeyDeepseek');
  order.push('apiKeyZhipu');
  order.push('save');
  order.push('back');
  return order;
}

type SettingsStatus = 'idle' | 'saving' | 'success' | 'error';

/** Compute the selectable providers from the current settings. */
function providerList(settings: TuiSettings): readonly Provider[] {
  return [
    'anthropic',
    'openai',
    'qwen',
    'deepseek',
    'zhipu',
    ...settings.customProviders.map((cp) => `custom:${cp.id}` as const),
  ];
}

/** Display label for any provider. */
function providerLabel(provider: Provider, customProviders: TuiSettings['customProviders']): string {
  if (provider.startsWith('custom:')) {
    return customProviders.find((cp) => cp.id === provider.slice(7))?.name ?? provider;
  }
  return PROVIDER_LABELS[provider as 'anthropic' | 'openai' | 'qwen' | 'deepseek' | 'zhipu'];
}

const PROVIDER_LABELS: Record<'anthropic' | 'openai' | 'qwen' | 'deepseek' | 'zhipu', string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  qwen: 'Qwen',
  deepseek: 'DeepSeek',
  zhipu: 'Zhipu',
};

/** Short display names for the UI across built-in catalogs; the persisted value is the full model id. */
const MODEL_SHORT_NAMES: Record<string, string> = Object.fromEntries(
  [
    ...MODEL_CATALOG.anthropic,
    ...MODEL_CATALOG.openai,
    ...MODEL_CATALOG.qwen,
    ...MODEL_CATALOG.deepseek,
    ...MODEL_CATALOG.zhipu,
  ].map(({ id, label }) => [id, label]),
);

/**
 * Inline recommendation labels (phase doc §2.2 + the v1.4.0 provider
 * extension), rendered dim under a row. The wording mirrors across
 * providers: cheapest tier for structured extraction, mid tier for prose.
 * Phase 13 (2026-07-23 model-routing preference, root AGENTS.md; decision
 * record `Project Vision/optimizations/optimizations.md` L2): the DOX slot
 * recommends the MID tier — DOX contracts are structural navigation whose
 * correctness is deterministically re-imposed, so the premium tier buys
 * nothing. Phase 14 (phase doc §2.6): the Curation slot carries the ratified
 * mid-tier merge/drop-judgment label.
 */
const RECOMMENDATIONS: Record<'anthropic' | 'openai' | 'qwen' | 'zhipu', Partial<Record<SettingRow, string>>> = {
  anthropic: {
    modelExtractor: 'Haiku — cheapest, good for structured JSON extraction',
    modelSynthesis: 'Sonnet — better prose, fewer preservation failures',
    modelDox: 'Sonnet — mid-tier; structural navigation, correctness re-imposed deterministically',
    modelCuration: 'Sonnet — mid-tier judgment for merge/drop decisions',
    modelCrossWiki: 'Haiku — cheapest for bulk cross-wiki tasks (summaries, matching, clustering)',
    modelCrossWikiJudgment: 'Sonnet — mid-tier review for uncertain cross-wiki matches and hypothesis signals',
  },
  openai: {
    modelExtractor: 'GPT-5.6 Luna — cheapest, good for structured JSON extraction',
    modelSynthesis: 'GPT-5.6 Terra — better prose, fewer preservation failures',
    modelDox: 'GPT-5.6 Terra — mid-tier; structural navigation, correctness re-imposed deterministically',
    modelCuration: 'GPT-5.6 Terra — mid-tier judgment for merge/drop decisions',
    modelCrossWiki: 'GPT-5.6 Luna — cheapest for bulk cross-wiki tasks (summaries, matching, clustering)',
    modelCrossWikiJudgment: 'GPT-5.6 Terra — mid-tier review for uncertain cross-wiki matches and hypothesis signals',
  },
  qwen: {
    modelExtractor: 'Qwen-Plus — cheapest, good for structured JSON extraction',
    modelSynthesis: 'Qwen 3.7 Max — better prose, fewer preservation failures',
    modelDox: 'Qwen 3.7 Max — mid-tier; structural navigation, correctness re-imposed deterministically',
    modelCuration: 'Qwen 3.7 Max — mid-tier judgment for merge/drop decisions',
    modelCrossWiki: 'Qwen-Plus — cheapest for bulk cross-wiki tasks (summaries, matching, clustering)',
    modelCrossWikiJudgment: 'Qwen 3.7 Max — mid-tier review for uncertain cross-wiki matches and hypothesis signals',
  },
  zhipu: {
    modelExtractor: 'GLM-4.7-Flash — free; 1-request concurrency fits the sequential steps',
    modelSynthesis: 'GLM-5.3 — flagship prose; mandatory reasoning raises token use',
    modelDox: 'GLM-5.2 — mid-tier for structural navigation',
    modelCuration: 'GLM-5.2 — mid-tier judgment for merge/drop decisions',
    modelCrossWiki: 'GLM-4.7-Flash — free for bulk cross-wiki tasks',
    modelCrossWikiJudgment: 'GLM-5.2 — mid-tier review for uncertain cross-wiki matches',
  },
};

/**
 * Recommendation for a row under the row's EFFECTIVE provider (the slot's own
 * provider, or the default provider when the slot is "Same as default").
 * DeepSeek and custom providers have no labels: DeepSeek carries a single
 * model (nothing to guide), and custom providers are user-defined.
 */
function recommendationFor(row: SettingRow, provider: Provider): string | null {
  if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'qwen' && provider !== 'zhipu') {
    return null;
  }
  return RECOMMENDATIONS[provider][row] ?? null;
}

function displayName(modelId: string): string {
  return MODEL_SHORT_NAMES[modelId] ?? modelId;
}

/**
 * Phase 11 v1.5.0: the masked status string for an API-key row. Only ever
 * shows the key SOURCE plus the last 4 characters of the resolved key —
 * 'configured ••••ab12' (stored) / 'from environment ••••ab12' (env/.env) /
 * 'not set'. The full key is never rendered.
 */
function keyStatusText(provider: Provider, storedKey: string | null): string {
  const status = getApiKeyStatus(provider, storedKey);
  if (status.source === 'stored') {
    return `configured ••••${status.last4}`;
  }
  if (status.source === 'environment') {
    return `from environment ••••${status.last4}`;
  }
  return 'not set';
}

function cycle<T>(choices: readonly T[], current: T, delta: 1 | -1): T {
  const index = choices.indexOf(current);
  const next = (index === -1 ? 0 : (index + delta + choices.length) % choices.length) % choices.length;
  return choices[next];
}

/** Provider for the current settings state; absent (legacy) means anthropic. */
function currentProvider(settings: TuiSettings): Provider {
  return settings.models.provider ?? 'anthropic';
}

/**
 * Settings screen (Phase 5): toggles for synthesis and AGENTS.md update
 * proposals, plus the Phase 11 "LLM Model Routing" section (phase doc §2.2,
 * v1.4.0 multi-provider extension; Qwen extension 2026-08-04; DeepSeek
 * extension + per-step provider selection v1.9.0, user directive 2026-08-17)
 * and the "API Keys" section (v1.5.0, user directive 2026-07-23).
 *
 * A Default Provider row (Anthropic / OpenAI / Qwen / DeepSeek / Zhipu /
 * custom)
 * sits above the model rows and defines the DEFAULT slot: the Default Model
 * row's provider and what "Same as default" resolves to for every other
 * row. Since v1.9.0 each of the seven model rows (Default, Extractor,
 * Synthesis Writer, DOX Writer, Curation — Phase 14 §2.6, Cross-Wiki Bulk,
 * Cross-Wiki Judgment — Phase 24) is a self-describing
 * `{ provider, model }` pair (persisted as null = "Same as default"):
 * Left/Right cycles ONE combined list across every provider's catalog, and
 * Enter on the row opens a custom-id editor scoped to that row's provider
 * (a raw off-catalog id is pre-filled for editing). A row whose provider
 * differs from the Default Provider shows the provider prefix
 * (e.g. `Qwen · Qwen-Plus`). Switching the Default Provider re-seeds only
 * the Default Model row; explicitly-configured rows are preserved because
 * each carries its own provider, so a mixed-provider table (Qwen Extractor,
 * Sonnet Synthesis, DeepSeek DOX) can never desync.
 *
 * API Keys section (v1.5.0): one row per provider BELOW the model rows.
 * A row only ever shows the key SOURCE + last 4 characters ('configured
 * ••••ab12' when stored, 'from environment ••••ab12' when resolvable via the
 * environment/.env, 'not set' otherwise) — the full key is NEVER rendered,
 * logged, or written anywhere but `.paper-chase.json` (gitignored). Enter on
 * a key row opens a masked editor on that row: Enter with a non-empty value
 * STAGES the key, Enter with an EMPTY value stages a CLEAR (null), Escape
 * cancels the edit. Staged values persist only via [ Save ], like every
 * other row.
 *
 * Up/Down moves between rows. Space or Left/Right toggles the boolean
 * options; Left/Right cycles the provider and model dropdowns. Enter on
 * "Save" persists to `.paper-chase.json`.
 */
export function SettingsScreen({ onBack, onResult, workspace = '.' }: SettingsScreenProps) {
  const { isRawModeSupported } = useStdin();
  const [settings, setSettings] = useState<TuiSettings>({
    synthesis: false,
    updateAgents: false,
    models: seedModelsForProvider('anthropic'),
    apiKeys: { anthropic: null, openai: null, qwen: null, deepseek: null, zhipu: null },
    customProviders: [],
  });
  const [loaded, setLoaded] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [status, setStatus] = useState<SettingsStatus>('idle');
  const [message, setMessage] = useState('');
  /** Provider whose key row is currently being edited (null = not editing). */
  const [editingKey, setEditingKey] = useState<Provider | null>(null);
  /** Draft text of the in-progress key edit (masked on screen). */
  const [keyDraft, setKeyDraft] = useState('');
  /** Model row currently in custom-model edit mode (null = not editing). */
  const [editingCustomModel, setEditingCustomModel] = useState<{ row: SettingRow; provider: Provider } | null>(null);
  /** Draft text of the in-progress custom model id. */
  const [customDraft, setCustomDraft] = useState('');
  /** Test-connection status for the per-row model test. */
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  /** Test-connection message shown in the dedicated result area. */
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    loadSettings(workspace)
      .then((s) => {
        if (mounted) {
          setSettings(s);
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (mounted) {
          setStatus('error');
          setMessage(`Could not load settings: ${(err as Error).message}`);
          setLoaded(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [workspace]);

  // Clamp the focus index when the row order changes (e.g., after adding or
  // deleting a custom provider) so it never points past the end of the list.
  useEffect(() => {
    const rowOrder = buildRowOrder(settings);
    setFocusIndex((prev) => (prev >= rowOrder.length ? rowOrder.length - 1 : prev));
  }, [settings]);

  const save = async () => {
    setStatus('saving');
    try {
      await saveSettings(workspace, settings);
      setStatus('success');
      const msg = `Settings saved to ${workspace}/.paper-chase.json`;
      setMessage(msg);
      onResult?.(msg);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setStatus('error');
      setMessage(`Error saving settings: ${errorMessage}`);
      onResult?.(`Error: ${errorMessage}`);
    }
  };

  const cycleProvider = (delta: 1 | -1) => {
    setSettings((prev) => {
      const providers = providerList(prev);
      const next = cycle(providers, currentProvider(prev), delta);
      if (next === currentProvider(prev)) {
        return prev;
      }
      // v1.9.0: only the DEFAULT slot follows the Default Provider row —
      // the Default Model re-seeds to the new provider's cheapest tier.
      // Explicitly-configured slots are self-describing { provider, model }
      // pairs, so they are preserved (and null slots follow the new default
      // automatically).
      return {
        ...prev,
        models: {
          ...prev.models,
          provider: next,
          default: getDefaultModelForProvider(next, prev.customProviders),
        },
      };
    });
  };

  const cycleModel = (row: SettingRow, delta: 1 | -1) => {
    setSettings((prev) => {
      const getCurrent = (): ModelSlot | null => {
        if (row === 'modelDefault') {
          return { provider: currentProvider(prev), model: prev.models.default };
        }
        if (row === 'modelExtractor') return prev.models.extractor;
        if (row === 'modelSynthesis') return prev.models.synthesis;
        if (row === 'modelDox') return prev.models.dox;
        if (row === 'modelCuration') return prev.models.curation ?? null;
        if (row === 'modelCrossWiki') return prev.models.crossWiki ?? null;
        if (row === 'modelCrossWikiJudgment') return prev.models.crossWikiJudgment ?? null;
        return null;
      };

      const current = getCurrent();
      // v1.9.0: one combined choice list across every provider's catalog —
      // "Same as default" first (not for the Default Model row), then each
      // provider's models. Raw custom ids typed for a provider ride at the
      // end of that provider's group so they stay cyclable. Enter on the row
      // (not the cycle) opens the custom-id editor.
      const choices: Array<{ provider: Provider; modelId: string | null }> = [];
      if (row !== 'modelDefault') {
        choices.push({ provider: currentProvider(prev), modelId: null });
      }
      for (const p of providerList(prev)) {
        const ids = getModelCatalog(p, prev.customProviders).map((entry) => entry.id);
        for (const id of ids) {
          if (id !== '__custom__') {
            choices.push({ provider: p, modelId: id });
          }
        }
        if (current !== null && current.provider === p && !ids.includes(current.model)) {
          choices.push({ provider: p, modelId: current.model });
        }
      }

      const currentChoice =
        current === null
          ? choices.find((c) => c.modelId === null)
          : choices.find((c) => c.modelId === current.model && c.provider === current.provider);
      const next = cycle(choices, currentChoice ?? choices[0], delta);

      const models = { ...prev.models };
      if (row === 'modelDefault') {
        models.default = next.modelId as string;
      } else {
        const nextSlot: ModelSlot | null =
          next.modelId === null ? null : { provider: next.provider, model: next.modelId };
        if (row === 'modelExtractor') {
          models.extractor = nextSlot;
        } else if (row === 'modelSynthesis') {
          models.synthesis = nextSlot;
        } else if (row === 'modelDox') {
          models.dox = nextSlot;
        } else if (row === 'modelCuration') {
          models.curation = nextSlot;
        } else if (row === 'modelCrossWiki') {
          models.crossWiki = nextSlot;
        } else if (row === 'modelCrossWikiJudgment') {
          models.crossWikiJudgment = nextSlot;
        }
      }
      return { ...prev, models };
    });
  };

  /** The effective { provider, model } slot a model row resolves to. */
  const slotForRow = (row: SettingRow): ModelSlot => {
    const fallback: ModelSlot = { provider, model: settings.models.default };
    if (row === 'modelDefault') return fallback;
    if (row === 'modelExtractor') return settings.models.extractor ?? fallback;
    if (row === 'modelSynthesis') return settings.models.synthesis ?? fallback;
    if (row === 'modelDox') return settings.models.dox ?? fallback;
    if (row === 'modelCuration') return settings.models.curation ?? fallback;
    if (row === 'modelCrossWiki') return settings.models.crossWiki ?? fallback;
    if (row === 'modelCrossWikiJudgment') return settings.models.crossWikiJudgment ?? fallback;
    return fallback;
  };

  /**
   * Stage a key edit into component state (persisted only via [ Save ]).
   * A non-empty value stages the key; an empty submit stages a CLEAR (null).
   */
  const submitKeyEdit = (provider: Provider, value: string) => {
    const trimmed = value.trim();
    setSettings((prev) => {
      if (provider.startsWith('custom:')) {
        const id = provider.slice(7);
        return {
          ...prev,
          customProviders: prev.customProviders.map((cp) =>
            cp.id === id ? { ...cp, apiKey: trimmed === '' ? null : trimmed } : cp,
          ),
        };
      }
      return {
        ...prev,
        apiKeys: { ...prev.apiKeys, [provider]: trimmed === '' ? null : trimmed },
      };
    });
    setEditingKey(null);
    setKeyDraft('');
  };

  /** Row → call type mapping for the per-row model test. */
  const rowToCallType = (row: SettingRow): string | undefined => {
    switch (row) {
      case 'modelDefault':
        return undefined;
      case 'modelExtractor':
        return 'extractor';
      case 'modelSynthesis':
        return 'synthesis';
      case 'modelDox':
        return 'dox-writer';
      case 'modelCuration':
        return 'curation';
      case 'modelCrossWiki':
        return 'cross-wiki-relevance-probe';
      case 'modelCrossWikiJudgment':
        return 'cross-wiki-hypothesis';
      default:
        return undefined;
    }
  };

  /** Cancel an in-progress custom model edit, keeping the previous value. */
  const cancelCustomModel = () => {
    setEditingCustomModel(null);
    setCustomDraft('');
  };

  /** Submit the custom model id for the editing provider: a non-empty value
   * stages a `{ provider, model }` slot, empty cancels. */
  const submitCustomModel = (row: SettingRow, provider: Provider, value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') {
      cancelCustomModel();
      return;
    }
    setSettings((prev) => {
      const models = { ...prev.models };
      const slot: ModelSlot = { provider, model: trimmed };
      if (row === 'modelDefault') {
        models.default = trimmed;
      } else if (row === 'modelExtractor') {
        models.extractor = slot;
      } else if (row === 'modelSynthesis') {
        models.synthesis = slot;
      } else if (row === 'modelDox') {
        models.dox = slot;
      } else if (row === 'modelCuration') {
        models.curation = slot;
      } else if (row === 'modelCrossWiki') {
        models.crossWiki = slot;
      } else if (row === 'modelCrossWikiJudgment') {
        models.crossWikiJudgment = slot;
      }
      return { ...prev, models };
    });
    cancelCustomModel();
  };

  /**
   * Run the per-row model test: resolve the row's OWN slot (provider +
   * model — v1.9.0) + that provider's API key, then call
   * `testModelConnection`. The result is shown in a dedicated area that
   * never interferes with the save status.
   */
  const runModelTest = async (row: SettingRow) => {
    const callType = rowToCallType(row);
    const slot = resolveSlotFromRouting(settings.models, callType);
    const apiKey = resolveApiKeyForTest(
      slot.provider,
      slot.provider.startsWith('custom:')
        ? settings.customProviders.find((c) => c.id === slot.provider.slice(7))?.apiKey ?? null
        : settings.apiKeys[slot.provider as 'anthropic' | 'openai' | 'qwen' | 'deepseek'],
      settings.customProviders,
    );
    if (!apiKey) {
      setTestStatus('error');
      setTestMessage('No API key set for this provider.');
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    try {
      const result = await testModelConnection(slot.provider, slot.model, apiKey, settings.customProviders);
      setTestStatus(result.ok ? 'success' : 'error');
      setTestMessage(result.message);
    } catch (err) {
      setTestStatus('error');
      setTestMessage(`Unexpected error: ${(err as Error).message}`);
    }
  };

  useInput(
    (_input, key) => {
      if (status === 'saving') {
        return;
      }
      // While a custom-model row is being edited the TextInput owns the
      // keystrokes (Enter submits via onSubmit); Escape cancels the edit here.
      if (editingCustomModel !== null) {
        if (key.escape) {
          cancelCustomModel();
        }
        return;
      }
      // While a key row is being edited the TextInput owns the keystrokes
      // (Enter submits via onSubmit); Escape cancels the edit here.
      if (editingKey !== null) {
        if (key.escape) {
          setEditingKey(null);
          setKeyDraft('');
        }
        return;
      }
      if (key.escape) {
        onBack();
        return;
      }
      if (status === 'success' || status === 'error') {
        if (key.return) {
          onBack();
        }
        return;
      }
      const rowOrder = buildRowOrder(settings);
      if (key.upArrow) {
        setFocusIndex((focusIndex + rowOrder.length - 1) % rowOrder.length);
        return;
      }
      if (key.downArrow) {
        setFocusIndex((focusIndex + 1) % rowOrder.length);
        return;
      }

      const row = rowOrder[focusIndex];
      if (row === 'synthesis' || row === 'updateAgents') {
        if (_input === ' ' || key.leftArrow || key.rightArrow) {
          setSettings((prev) => ({ ...prev, [row]: !prev[row] }));
        }
      }
      if (row === 'provider') {
        if (key.leftArrow || key.rightArrow) {
          cycleProvider(key.rightArrow ? 1 : -1);
        }
      }
      if (
        row === 'modelDefault' ||
        row === 'modelExtractor' ||
        row === 'modelSynthesis' ||
        row === 'modelDox' ||
        row === 'modelCuration' ||
        row === 'modelCrossWiki' ||
        row === 'modelCrossWikiJudgment'
      ) {
        if (key.leftArrow || key.rightArrow) {
          cycleModel(row, key.rightArrow ? 1 : -1);
        }
        if (_input === 't' || _input === 'T') {
          void runModelTest(row);
        }
      }

      if (key.return) {
        if (row === 'save') {
          void save();
        } else if (row === 'back') {
          onBack();
        } else if (row === 'apiKeyAnthropic') {
          // Open the masked editor with an EMPTY draft — the stored key is
          // never pre-filled, so it never appears even in masked echo state.
          setEditingKey('anthropic');
          setKeyDraft('');
        } else if (row === 'apiKeyOpenai') {
          setEditingKey('openai');
          setKeyDraft('');
        } else if (row === 'apiKeyQwen') {
          setEditingKey('qwen');
          setKeyDraft('');
        } else if (row === 'apiKeyDeepseek') {
          setEditingKey('deepseek');
          setKeyDraft('');
        } else if (row === 'apiKeyZhipu') {
          setEditingKey('zhipu');
          setKeyDraft('');
        } else if (
          row === 'modelDefault' ||
          row === 'modelExtractor' ||
          row === 'modelSynthesis' ||
          row === 'modelDox' ||
          row === 'modelCuration' ||
          row === 'modelCrossWiki' ||
          row === 'modelCrossWikiJudgment'
        ) {
          // v1.9.0: Enter on a model row opens the custom-id editor scoped
          // to the row's effective provider. A raw (off-catalog) current id
          // is pre-filled so it can be edited; catalog ids start empty.
          const slot = slotForRow(row);
          const catalogIds = getModelCatalog(slot.provider, settings.customProviders).map(
            (entry) => entry.id,
          );
          setEditingCustomModel({ row, provider: slot.provider });
          setCustomDraft(catalogIds.includes(slot.model) ? '' : slot.model);
        } else if (row === 'customProviderApiKey' && currentCustomProvider) {
          setEditingKey(`custom:${currentCustomProvider.id}`);
          setKeyDraft('');
        } else if (row === 'addCustomProvider') {
          addCustomProvider();
        } else if (row === 'deleteCustomProvider') {
          deleteCustomProvider();
        } else if (row === 'addCustomProviderHeader' && currentCustomProvider) {
          setEditingKey(`custom:${currentCustomProvider.id}-addHeader`);
          setKeyDraft('');
        } else if (row.startsWith('customProviderHeader:')) {
          const index = Number(row.split(':')[1]);
          removeCustomProviderHeader(index);
        } else if (row === 'addCustomProviderModel' && currentCustomProvider) {
          setEditingKey(`custom:${currentCustomProvider.id}-addModel`);
          setKeyDraft('');
        } else if (row.startsWith('customProviderModel:')) {
          const index = Number(row.split(':')[1]);
          removeCustomProviderModel(index);
        } else if (row === 'customProviderBaseUrl' && currentCustomProvider) {
          setEditingKey(`custom:${currentCustomProvider.id}-baseUrl`);
          setKeyDraft(currentCustomProvider.baseUrl);
        } else if (row === 'customProviderRequestTemplate' && currentCustomProvider) {
          setEditingKey(`custom:${currentCustomProvider.id}-requestTemplate`);
          setKeyDraft(currentCustomProvider.requestTemplate);
        } else if (row === 'customProviderResponseTextPath' && currentCustomProvider) {
          setEditingKey(`custom:${currentCustomProvider.id}-responseTextPath`);
          setKeyDraft(currentCustomProvider.responseTemplate.textPath);
        } else if (row === 'customProviderResponseInputTokensPath' && currentCustomProvider) {
          setEditingKey(`custom:${currentCustomProvider.id}-responseInputTokensPath`);
          setKeyDraft(currentCustomProvider.responseTemplate.inputTokensPath ?? '');
        } else if (row === 'customProviderResponseOutputTokensPath' && currentCustomProvider) {
          setEditingKey(`custom:${currentCustomProvider.id}-responseOutputTokensPath`);
          setKeyDraft(currentCustomProvider.responseTemplate.outputTokensPath ?? '');
        }
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const rowOrder = buildRowOrder(settings);
  const focus = rowOrder[focusIndex] ?? rowOrder[0];
  const provider = currentProvider(settings);

  const renderToggle = (row: 'synthesis' | 'updateAgents', label: string) => {
    const active = focus === row;
    const on = settings[row];
    return (
      <Box key={row}>
        <Text inverse={active} color={active ? 'cyan' : undefined}>
          {active ? '> ' : '  '}
          {label}: [{on ? 'ON' : 'OFF'}]
        </Text>
      </Box>
    );
  };

  const renderProviderRow = () => {
    const active = focus === 'provider';
    return (
      <Box key="provider">
        <Text inverse={active} color={active ? 'cyan' : undefined}>
          {active ? '> ' : '  '}
          Default Provider: [‹ {providerLabel(provider, settings.customProviders)} ›]
        </Text>
      </Box>
    );
  };

  const renderModelRow = (row: SettingRow, label: string, value: ModelSlot | null) => {
    const active = focus === row;
    const shown =
      value === null
        ? 'Same as default'
        : value.provider === provider
          ? displayName(value.model)
          : `${providerLabel(value.provider, settings.customProviders)} · ${displayName(value.model)}`;
    const recommendation = recommendationFor(row, value?.provider ?? provider);
    const editing = editingCustomModel !== null && editingCustomModel.row === row;
    return (
      <Box key={row} flexDirection="column">
        {editing ? (
          <Box>
            <Text inverse={active} color={active ? 'cyan' : undefined}>
              {active ? '> ' : '  '}
              {label}:{' '}
            </Text>
            <TextInput
              value={customDraft}
              onChange={setCustomDraft}
              onSubmit={(v) => submitCustomModel(row, editingCustomModel.provider, v)}
              placeholder="model id"
              focus
            />
          </Box>
        ) : (
          <Text inverse={active} color={active ? 'cyan' : undefined}>
            {active ? '> ' : '  '}
            {label}: [‹ {shown} ›]
          </Text>
        )}
        {recommendation ? <Text dimColor>    {recommendation}</Text> : null}
      </Box>
    );
  };

  /**
   * Phase 11 v1.5.0 API-key row. Not editing: masked status string only
   * (source + last 4). Editing: a masked TextInput replaces the status —
   * the draft never echoes in clear.
   */
  const renderKeyRow = (row: SettingRow, keyProvider: Provider, label: string) => {
    const active = focus === row;
    const editing = editingKey === keyProvider;
    const storedKey = keyProvider.startsWith('custom:')
      ? settings.customProviders.find((c) => c.id === keyProvider.slice(7))?.apiKey ?? null
      : settings.apiKeys[keyProvider as 'anthropic' | 'openai' | 'qwen' | 'deepseek'];
    return (
      <Box key={row}>
        <Text inverse={active} color={active ? 'cyan' : undefined}>
          {active ? '> ' : '  '}
          {label}:{' '}
        </Text>
        {editing ? (
          <TextInput
            value={keyDraft}
            onChange={setKeyDraft}
            onSubmit={(value) => submitKeyEdit(keyProvider, value)}
            mask="•"
            placeholder="paste key — Enter: keep, empty: clear, Esc: cancel"
            focus
          />
        ) : (
          <Text inverse={active} color={active ? 'cyan' : undefined}>
            [{keyStatusText(keyProvider, storedKey)}]
          </Text>
        )}
      </Box>
    );
  };

  /** Current custom provider config (when provider is custom:*). */
  const currentCustomProvider = provider.startsWith('custom:')
    ? settings.customProviders.find((c) => c.id === provider.slice(7))
    : undefined;

  /** Update a field of the currently selected custom provider. */
  const updateCurrentCustomProvider = (updates: Partial<import('./settings').CustomProviderConfig>) => {
    setSettings((prev) => ({
      ...prev,
      customProviders: prev.customProviders.map((cp) =>
        cp.id === currentCustomProvider?.id ? { ...cp, ...updates } : cp,
      ),
    }));
  };

  /** Add a new custom provider with OpenAI-compatible defaults and switch to it. */
  const addCustomProvider = () => {
    setSettings((prev) => {
      const existingIds = prev.customProviders.map((cp) => cp.id);
      const name = `Custom Provider ${existingIds.length + 1}`;
      const cp = createCustomProvider(name, existingIds);
      return {
        ...prev,
        customProviders: [...prev.customProviders, cp],
        models: seedModelsForProvider(`custom:${cp.id}`, [...prev.customProviders, cp]),
      };
    });
  };

  /** Delete the currently selected custom provider and switch back to anthropic. */
  const deleteCustomProvider = () => {
    setSettings((prev) => ({
      ...prev,
      customProviders: prev.customProviders.filter((cp) => cp.id !== currentCustomProvider?.id),
      models: seedModelsForProvider('anthropic'),
    }));
  };

  /** Add a header to the current custom provider (parsed as `key: value`). */
  const addCustomProviderHeader = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') {
      return;
    }
    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      return;
    }
    const key = trimmed.slice(0, colon).trim();
    const headerValue = trimmed.slice(colon + 1).trim();
    updateCurrentCustomProvider({
      headers: [...(currentCustomProvider?.headers ?? []), { key, value: headerValue }],
    });
  };

  /** Remove a header by index from the current custom provider. */
  const removeCustomProviderHeader = (index: number) => {
    updateCurrentCustomProvider({
      headers: (currentCustomProvider?.headers ?? []).filter((_, i) => i !== index),
    });
  };

  /** Add a model to the current custom provider. */
  const addCustomProviderModel = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') {
      return;
    }
    updateCurrentCustomProvider({
      models: [...(currentCustomProvider?.models ?? []), { id: trimmed, label: trimmed }],
    });
  };

  /** Remove a model by index from the current custom provider. */
  const removeCustomProviderModel = (index: number) => {
    updateCurrentCustomProvider({
      models: (currentCustomProvider?.models ?? []).filter((_, i) => i !== index),
    });
  };

  const renderTextRow = (
    row: SettingRow,
    label: string,
    value: string,
    placeholder: string,
    onSubmit: (value: string) => void,
    editing: boolean,
    draft: string,
    setDraft: (value: string) => void,
  ) => {
    const active = focus === row;
    return (
      <Box key={row}>
        <Text inverse={active} color={active ? 'cyan' : undefined}>
          {active ? '> ' : '  '}
          {label}:{' '}
        </Text>
        {editing ? (
          <TextInput
            value={draft}
            onChange={setDraft}
            onSubmit={onSubmit}
            placeholder={placeholder}
            focus
          />
        ) : (
          <Text inverse={active} color={active ? 'cyan' : undefined}>
            [{value}]
          </Text>
        )}
      </Box>
    );
  };

  const renderCustomProviderRows = () => {
    if (!currentCustomProvider) {
      return null;
    }
    return (
      <>
        {renderTextRow(
          'customProviderBaseUrl',
          'Base URL',
          currentCustomProvider.baseUrl,
          'https://api.example.com/v1/chat/completions',
          (v) => updateCurrentCustomProvider({ baseUrl: v }),
          editingKey === `custom:${currentCustomProvider.id}-baseUrl`,
          keyDraft,
          setKeyDraft,
        )}
        {renderKeyRow('customProviderApiKey', `custom:${currentCustomProvider.id}`, `${currentCustomProvider.name} API Key`)}
        <Box>
          <Text inverse={focus === 'addCustomProviderHeader'} color={focus === 'addCustomProviderHeader' ? 'cyan' : undefined}>
            {focus === 'addCustomProviderHeader' ? '> ' : '  '}
            Add Header: [Enter to type]
          </Text>
        </Box>
        {currentCustomProvider.headers.map((h, i) => (
          <Box key={`customProviderHeader:${i}`}>
            <Text inverse={focus === `customProviderHeader:${i}`} color={focus === `customProviderHeader:${i}` ? 'cyan' : undefined}>
              {focus === `customProviderHeader:${i}` ? '> ' : '  '}
              Header {i + 1}: [{h.key}: {h.value}] (Enter to delete)
            </Text>
          </Box>
        ))}
        {renderTextRow(
          'customProviderRequestTemplate',
          'Request Template',
          currentCustomProvider.requestTemplate,
          '{"model":"{{model}}","messages":{{messages}}}',
          (v) => updateCurrentCustomProvider({ requestTemplate: v }),
          editingKey === `custom:${currentCustomProvider.id}-requestTemplate`,
          keyDraft,
          setKeyDraft,
        )}
        {renderTextRow(
          'customProviderResponseTextPath',
          'Response Text Path',
          currentCustomProvider.responseTemplate.textPath,
          'choices[0].message.content',
          (v) => updateCurrentCustomProvider({ responseTemplate: { ...currentCustomProvider.responseTemplate, textPath: v } }),
          editingKey === `custom:${currentCustomProvider.id}-responseTextPath`,
          keyDraft,
          setKeyDraft,
        )}
        {renderTextRow(
          'customProviderResponseInputTokensPath',
          'Input Tokens Path',
          currentCustomProvider.responseTemplate.inputTokensPath ?? '',
          'usage.prompt_tokens',
          (v) => updateCurrentCustomProvider({ responseTemplate: { ...currentCustomProvider.responseTemplate, inputTokensPath: v || undefined } }),
          editingKey === `custom:${currentCustomProvider.id}-responseInputTokensPath`,
          keyDraft,
          setKeyDraft,
        )}
        {renderTextRow(
          'customProviderResponseOutputTokensPath',
          'Output Tokens Path',
          currentCustomProvider.responseTemplate.outputTokensPath ?? '',
          'usage.completion_tokens',
          (v) => updateCurrentCustomProvider({ responseTemplate: { ...currentCustomProvider.responseTemplate, outputTokensPath: v || undefined } }),
          editingKey === `custom:${currentCustomProvider.id}-responseOutputTokensPath`,
          keyDraft,
          setKeyDraft,
        )}
        <Box>
          <Text inverse={focus === 'addCustomProviderModel'} color={focus === 'addCustomProviderModel' ? 'cyan' : undefined}>
            {focus === 'addCustomProviderModel' ? '> ' : '  '}
            Add Model: [Enter to type]
          </Text>
        </Box>
        {currentCustomProvider.models.map((m, i) => (
          <Box key={`customProviderModel:${i}`}>
            <Text inverse={focus === `customProviderModel:${i}`} color={focus === `customProviderModel:${i}` ? 'cyan' : undefined}>
              {focus === `customProviderModel:${i}` ? '> ' : '  '}
              Model {i + 1}: [{m.id}] (Enter to delete)
            </Text>
          </Box>
        ))}
        <Box>
          <Text inverse={focus === 'deleteCustomProvider'} color={focus === 'deleteCustomProvider' ? 'cyan' : undefined}>
            {focus === 'deleteCustomProvider' ? '> ' : '  '}
            [ Delete Custom Provider ]
          </Text>
        </Box>
      </>
    );
  };

  /** Display string for one routing slot: "Same as default", or the model
   * label with a provider prefix when the slot's provider differs from the
   * Default Provider (e.g. `Qwen · Qwen-Plus`). */
  const slotLabel = (value: ModelSlot | null): string =>
    value === null
      ? 'Same as default'
      : value.provider === provider
        ? displayName(value.model)
        : `${providerLabel(value.provider, settings.customProviders)} · ${displayName(value.model)}`;

  /** Recommendation line for a row under its effective provider (null = none). */
  const recLine = (row: SettingRow, value: ModelSlot | null) => {
    const recommendation = recommendationFor(row, value?.provider ?? provider);
    return recommendation ? <Text dimColor>  {recommendation}</Text> : null;
  };

  return (
    <Box flexDirection="column">
      <Header />
      <Text bold>Settings</Text>
      {isRawModeSupported ? (
        <Box flexDirection="column" marginTop={1}>
          {renderToggle('synthesis', 'Synthesis')}
          {renderToggle('updateAgents', 'Update Agents')}
          <Box flexDirection="column" marginTop={1}>
            <Text bold>LLM Model Routing</Text>
            {renderProviderRow()}
            {renderModelRow('modelDefault', 'Default Model', { provider, model: settings.models.default })}
            {renderModelRow('modelExtractor', 'Extractor Model', settings.models.extractor)}
            {renderModelRow('modelSynthesis', 'Synthesis Writer Model', settings.models.synthesis)}
            {renderModelRow('modelDox', 'DOX Writer Model', settings.models.dox)}
            {renderModelRow('modelCuration', 'Curation Model', settings.models.curation ?? null)}
            {renderModelRow('modelCrossWiki', 'Cross-Wiki Bulk Model', settings.models.crossWiki ?? null)}
            {renderModelRow('modelCrossWikiJudgment', 'Cross-Wiki Judgment Model', settings.models.crossWikiJudgment ?? null)}
          </Box>
          {renderCustomProviderRows()}
          <Box>
            <Text inverse={focus === 'addCustomProvider'} color={focus === 'addCustomProvider' ? 'cyan' : undefined}>
              {focus === 'addCustomProvider' ? '> ' : '  '}
              [ Add Custom Provider ]
            </Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>API Keys</Text>
            {renderKeyRow('apiKeyAnthropic', 'anthropic', 'Anthropic API Key')}
            {renderKeyRow('apiKeyOpenai', 'openai', 'OpenAI API Key')}
            {renderKeyRow('apiKeyQwen', 'qwen', 'Qwen API Key')}
            {renderKeyRow('apiKeyDeepseek', 'deepseek', 'DeepSeek API Key')}
            {renderKeyRow('apiKeyZhipu', 'zhipu', 'Zhipu API Key')}
          </Box>
          {testStatus !== 'idle' && (
            <Box marginTop={1}>
              {testStatus === 'testing' ? (
                <Text dimColor>Testing model connection...</Text>
              ) : testStatus === 'success' ? (
                <SuccessBox message={`Test connection: ${testMessage}`} />
              ) : (
                <ErrorBox message={`Test connection: ${testMessage}`} />
              )}
            </Box>
          )}
          <Box marginTop={1} gap={2}>
            <Text inverse={focus === 'save'} color={focus === 'save' ? 'cyan' : undefined}>
              [ Save ]
            </Text>
            <Text inverse={focus === 'back'} color={focus === 'back' ? 'cyan' : undefined}>
              [ Back ]
            </Text>
          </Box>
        </Box>
      ) : (
        // Non-TTY fallback (piped output, test runner): list every row —
        // toggles, the provider row, the model routing rows, AND the API key
        // rows (masked status strings only) — statically (same contract as
        // the interactive render).
        <Box flexDirection="column" marginTop={1}>
          <Text>Synthesis: {settings.synthesis ? 'ON' : 'OFF'}</Text>
          <Text>Update Agents: {settings.updateAgents ? 'ON' : 'OFF'}</Text>
          <Text bold>LLM Model Routing</Text>
          <Text>Default Provider: {providerLabel(provider, settings.customProviders)}</Text>
          <Text>Default Model: {displayName(settings.models.default)}</Text>
          <Text>Extractor Model: {slotLabel(settings.models.extractor)}</Text>
          {recLine('modelExtractor', settings.models.extractor)}
          <Text>Synthesis Writer Model: {slotLabel(settings.models.synthesis)}</Text>
          {recLine('modelSynthesis', settings.models.synthesis)}
          <Text>DOX Writer Model: {slotLabel(settings.models.dox)}</Text>
          {recLine('modelDox', settings.models.dox)}
          <Text>Curation Model: {slotLabel(settings.models.curation ?? null)}</Text>
          {recLine('modelCuration', settings.models.curation ?? null)}
          <Text>Cross-Wiki Bulk Model: {slotLabel(settings.models.crossWiki ?? null)}</Text>
          {recLine('modelCrossWiki', settings.models.crossWiki ?? null)}
          <Text>Cross-Wiki Judgment Model: {slotLabel(settings.models.crossWikiJudgment ?? null)}</Text>
          {recLine('modelCrossWikiJudgment', settings.models.crossWikiJudgment ?? null)}
          {currentCustomProvider && (
            <>
              <Text>Base URL: {currentCustomProvider.baseUrl}</Text>
              <Text>Headers: {currentCustomProvider.headers.map((h) => `${h.key}: ${h.value}`).join(', ')}</Text>
              <Text>Request Template: {currentCustomProvider.requestTemplate}</Text>
              <Text>Response Text Path: {currentCustomProvider.responseTemplate.textPath}</Text>
              <Text>Input Tokens Path: {currentCustomProvider.responseTemplate.inputTokensPath ?? ''}</Text>
              <Text>Output Tokens Path: {currentCustomProvider.responseTemplate.outputTokensPath ?? ''}</Text>
              <Text>Models: {currentCustomProvider.models.map((m) => m.id).join(', ')}</Text>
            </>
          )}
          <Text bold>API Keys</Text>
          <Text>Anthropic API Key: {keyStatusText('anthropic', settings.apiKeys.anthropic)}</Text>
          <Text>OpenAI API Key: {keyStatusText('openai', settings.apiKeys.openai)}</Text>
          <Text>Qwen API Key: {keyStatusText('qwen', settings.apiKeys.qwen)}</Text>
          <Text>DeepSeek API Key: {keyStatusText('deepseek', settings.apiKeys.deepseek)}</Text>
          <Text>Zhipu API Key: {keyStatusText('zhipu', settings.apiKeys.zhipu)}</Text>
          {currentCustomProvider && (
            <Text>{currentCustomProvider.name} API Key: {keyStatusText(`custom:${currentCustomProvider.id}`, currentCustomProvider.apiKey)}</Text>
          )}
          <Text dimColor>Interactive settings require a TTY.</Text>
        </Box>
      )}
      {!loaded && <Text dimColor>Loading settings...</Text>}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Up/Down: select | Space/Left/Right: toggle | Left/Right: cycle model (all providers) | Enter on model row: custom id | T: test model | Enter: save/back/edit key (empty clears/cancels, Esc cancels) | Escape: back" />
    </Box>
  );
}
