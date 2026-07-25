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
  MODEL_CATALOG,
  type Provider,
  type TuiSettings,
} from './settings';
import { getApiKeyStatus } from '../llm/client';
import type { ScreenProps } from './init-screen';

export interface SettingsScreenProps extends ScreenProps {
  /** Workspace directory containing `.paper-chase.json` (default '.'). */
  workspace?: string;
}

type SettingRow =
  | 'synthesis'
  | 'updateAgents'
  | 'provider'
  | 'modelDefault'
  | 'modelExtractor'
  | 'modelSynthesis'
  | 'modelDox'
  | 'modelCuration'
  | 'apiKeyAnthropic'
  | 'apiKeyOpenai'
  | 'save'
  | 'back';
const ROW_ORDER: SettingRow[] = [
  'synthesis',
  'updateAgents',
  'provider',
  'modelDefault',
  'modelExtractor',
  'modelSynthesis',
  'modelDox',
  'modelCuration',
  'apiKeyAnthropic',
  'apiKeyOpenai',
  'save',
  'back',
];

type SettingsStatus = 'idle' | 'saving' | 'success' | 'error';

/** Phase 11 v1.4.0: the selectable providers, cycled Left/Right like the model rows. */
const PROVIDERS: readonly Provider[] = ['anthropic', 'openai'];

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

/** Short display names for the UI across both catalogs; the persisted value is the full model id. */
const MODEL_SHORT_NAMES: Record<string, string> = Object.fromEntries(
  [...MODEL_CATALOG.anthropic, ...MODEL_CATALOG.openai].map(({ id, label }) => [id, label]),
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
const RECOMMENDATIONS: Record<Provider, Partial<Record<SettingRow, string>>> = {
  anthropic: {
    modelExtractor: 'Haiku — cheapest, good for structured JSON extraction',
    modelSynthesis: 'Sonnet — better prose, fewer preservation failures',
    modelDox: 'Sonnet — mid-tier; structural navigation, correctness re-imposed deterministically',
    modelCuration: 'Sonnet — mid-tier judgment for merge/drop decisions',
  },
  openai: {
    modelExtractor: 'GPT-5.6 Luna — cheapest, good for structured JSON extraction',
    modelSynthesis: 'GPT-5.6 Terra — better prose, fewer preservation failures',
    modelDox: 'GPT-5.6 Terra — mid-tier; structural navigation, correctness re-imposed deterministically',
    modelCuration: 'GPT-5.6 Terra — mid-tier judgment for merge/drop decisions',
  },
};

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
 * v1.4.0 multi-provider extension) and the "API Keys" section (v1.5.0, user
 * directive 2026-07-23). A Provider row (Anthropic / OpenAI) sits above the
 * model rows; below it one Left/Right-cycling dropdown per LLM call type
 * (Default, Extractor, Synthesis Writer, DOX Writer, Curation — Phase 14
 * §2.6) with inline recommendation labels that follow the selected provider.
 * Switching the provider RESETS all five model slots to the new provider's
 * defaults (cheapest tier + mid-tier curation + "Same as default") so stale
 * cross-provider model ids can never persist. The per-call-type dropdowns
 * offer "Same as default" (persisted as null) plus the selected provider's
 * catalog ids.
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
    apiKeys: { anthropic: null, openai: null },
  });
  const [loaded, setLoaded] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [status, setStatus] = useState<SettingsStatus>('idle');
  const [message, setMessage] = useState('');
  /** Provider whose key row is currently being edited (null = not editing). */
  const [editingKey, setEditingKey] = useState<Provider | null>(null);
  /** Draft text of the in-progress key edit (masked on screen). */
  const [keyDraft, setKeyDraft] = useState('');

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
      const next = cycle(PROVIDERS, currentProvider(prev), delta);
      if (next === currentProvider(prev)) {
        return prev;
      }
      // Reset-on-switch: all five slots re-seed to the new provider's
      // defaults immediately (cheapest tier + mid-tier curation + nulls) so a
      // stale model id from the other provider can never be saved.
      return { ...prev, models: seedModelsForProvider(next) };
    });
  };

  const cycleModel = (row: SettingRow, delta: 1 | -1) => {
    setSettings((prev) => {
      const provider = currentProvider(prev);
      const ids = MODEL_CATALOG[provider].map((entry) => entry.id);
      const optionalChoices: Array<string | null> = [null, ...ids];
      const models = { ...prev.models };
      if (row === 'modelDefault') {
        models.default = cycle(ids, models.default, delta);
      } else if (row === 'modelExtractor') {
        models.extractor = cycle(optionalChoices, models.extractor, delta);
      } else if (row === 'modelSynthesis') {
        models.synthesis = cycle(optionalChoices, models.synthesis, delta);
      } else if (row === 'modelDox') {
        models.dox = cycle(optionalChoices, models.dox, delta);
      } else if (row === 'modelCuration') {
        models.curation = cycle(optionalChoices, models.curation ?? null, delta);
      }
      return { ...prev, models };
    });
  };

  /**
   * Stage a key edit into component state (persisted only via [ Save ]).
   * A non-empty value stages the key; an empty submit stages a CLEAR (null).
   */
  const submitKeyEdit = (provider: Provider, value: string) => {
    const trimmed = value.trim();
    setSettings((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: trimmed === '' ? null : trimmed },
    }));
    setEditingKey(null);
    setKeyDraft('');
  };

  useInput(
    (_input, key) => {
      if (status === 'saving') {
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
      if (key.upArrow) {
        setFocusIndex((focusIndex + ROW_ORDER.length - 1) % ROW_ORDER.length);
        return;
      }
      if (key.downArrow) {
        setFocusIndex((focusIndex + 1) % ROW_ORDER.length);
        return;
      }

      const row = ROW_ORDER[focusIndex];
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
      if (row === 'modelDefault' || row === 'modelExtractor' || row === 'modelSynthesis' || row === 'modelDox' || row === 'modelCuration') {
        if (key.leftArrow || key.rightArrow) {
          cycleModel(row, key.rightArrow ? 1 : -1);
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
        }
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const focus = ROW_ORDER[focusIndex];
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
          Provider: [‹ {PROVIDER_LABELS[provider]} ›]
        </Text>
      </Box>
    );
  };

  const renderModelRow = (row: SettingRow, label: string, value: string | null) => {
    const active = focus === row;
    const shown = value === null ? 'Same as default' : displayName(value);
    const recommendation = RECOMMENDATIONS[provider][row];
    return (
      <Box key={row} flexDirection="column">
        <Text inverse={active} color={active ? 'cyan' : undefined}>
          {active ? '> ' : '  '}
          {label}: [‹ {shown} ›]
        </Text>
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
            [{keyStatusText(keyProvider, settings.apiKeys[keyProvider])}]
          </Text>
        )}
      </Box>
    );
  };

  const optionalLabel = (value: string | null): string => (value === null ? 'Same as default' : displayName(value));

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
            {renderModelRow('modelDefault', 'Default Model', settings.models.default)}
            {renderModelRow('modelExtractor', 'Extractor Model', settings.models.extractor)}
            {renderModelRow('modelSynthesis', 'Synthesis Writer Model', settings.models.synthesis)}
            {renderModelRow('modelDox', 'DOX Writer Model', settings.models.dox)}
            {renderModelRow('modelCuration', 'Curation Model', settings.models.curation ?? null)}
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text bold>API Keys</Text>
            {renderKeyRow('apiKeyAnthropic', 'anthropic', 'Anthropic API Key')}
            {renderKeyRow('apiKeyOpenai', 'openai', 'OpenAI API Key')}
          </Box>
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
          <Text>Provider: {PROVIDER_LABELS[provider]}</Text>
          <Text>Default Model: {displayName(settings.models.default)}</Text>
          <Text>Extractor Model: {optionalLabel(settings.models.extractor)}</Text>
          <Text dimColor>  {RECOMMENDATIONS[provider].modelExtractor}</Text>
          <Text>Synthesis Writer Model: {optionalLabel(settings.models.synthesis)}</Text>
          <Text dimColor>  {RECOMMENDATIONS[provider].modelSynthesis}</Text>
          <Text>DOX Writer Model: {optionalLabel(settings.models.dox)}</Text>
          <Text dimColor>  {RECOMMENDATIONS[provider].modelDox}</Text>
          <Text>Curation Model: {optionalLabel(settings.models.curation ?? null)}</Text>
          <Text dimColor>  {RECOMMENDATIONS[provider].modelCuration}</Text>
          <Text bold>API Keys</Text>
          <Text>Anthropic API Key: {keyStatusText('anthropic', settings.apiKeys.anthropic)}</Text>
          <Text>OpenAI API Key: {keyStatusText('openai', settings.apiKeys.openai)}</Text>
          <Text dimColor>Interactive settings require a TTY.</Text>
        </Box>
      )}
      {!loaded && <Text dimColor>Loading settings...</Text>}
      {status === 'success' && <SuccessBox message={message} />}
      {status === 'error' && <ErrorBox message={message} />}
      <Footer helpText="Up/Down: select | Space/Left/Right: toggle | Left/Right: cycle provider/model | Enter: save/back/edit key (empty clears, Esc cancels) | Escape: back" />
    </Box>
  );
}
