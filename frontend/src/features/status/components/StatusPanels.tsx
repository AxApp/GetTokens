import { useEffect, useMemo, useState } from 'react';
import type { main } from '../../../../wailsjs/go/models';
import ActionSelect, { type ActionSelectOption } from '../../../components/ui/ActionSelect';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import { RelayModelEditorModal } from './RelayEditors';
import StatusSnippetPanel from './StatusSnippetPanel';
import {
  buildClaudeCodeSettingsDiff,
  buildCodexLocalApplyDiff,
  getCodexLocalApplyPreflight,
  resolveCodexLocalApplyState,
  type CodexLocalAuthStrategy,
  type ClaudeCodeLocalApplyDraft,
  type LocalCodexAuthStateLike,
  type RelayModelEditorState,
} from '../model/relayLocalState';
import type { RelayResolvedModelOption } from '../model/relayModelCatalog';
import { sortRelayModelCatalogByNameDesc } from '../model/relayModelCatalog';
import type { RelayProviderOption } from '../model/relayProviderCatalog';

type LocalCliPanelTarget = 'codex' | 'claude';

interface StatusApplyLocalSectionProps {
  t: (key: string) => string;
  localApplyMessage: string;
  claudeApplyMessage: string;
  isLANAccessEnabled: boolean;
  isApplyingToLocal: boolean;
  isApplyingClaude: boolean;
  isReady: boolean;
  relayKeyItems: main.RelayServiceAPIKeyItem[];
  selectedKeyIndex: number;
  visibleRelayEndpoints: main.RelayServiceEndpoint[];
  selectedEndpointID: string;
  selectedEndpointBaseUrl: string;
  relayProviderOptions: RelayProviderOption[];
  selectedRelayProviderID: string;
  codexLocalAuthStrategy: CodexLocalAuthStrategy;
  localCodexAuthState: LocalCodexAuthStateLike | null;
  codexLocalCanApply: boolean;
  codexLocalApplyBlockedMessage: string;
  relayReasoningEffortOptions: string[];
  selectedRelayReasoningEffort: string;
  selectedRelayModel: string;
  resolvedRelayModels: RelayResolvedModelOption[];
  onOpenCreateRelayKeyEditor: () => void;
  onToggleLANAccess: () => void;
  onApplyRelayConfigToLocal: () => void;
  onApplyClaude: (draft: ClaudeCodeLocalApplyDraft) => void;
  onSelectKeyIndex: (index: number) => void;
  onSelectEndpointID: (id: string) => void;
  onCopyEndpointBaseUrl: () => void;
  onOpenCreateRelayProviderEditor: () => void;
  onSelectRelayProviderID: (id: string) => void;
  onSelectCodexLocalAuthStrategy: (value: CodexLocalAuthStrategy) => void;
  onDeleteRelayProviderOption: (id: string) => void;
  onSelectRelayReasoningEffort: (value: string) => void;
  onCommitRelayModelSelection: (value: string) => void;
  onCopyText: (value: string, successMessage?: string) => void;
  relayKeyDisplayName: (value: string, index: number) => string;
  supportsWebsockets: boolean;
  onToggleSupportsWebsockets: () => void;
  initialActiveTarget?: LocalCliPanelTarget;
}

export function StatusApplyLocalSection({
  t,
  localApplyMessage,
  claudeApplyMessage,
  isLANAccessEnabled,
  isApplyingToLocal,
  isApplyingClaude,
  isReady,
  relayKeyItems,
  selectedKeyIndex,
  visibleRelayEndpoints,
  selectedEndpointID,
  selectedEndpointBaseUrl,
  relayProviderOptions,
  selectedRelayProviderID,
  codexLocalAuthStrategy,
  localCodexAuthState,
  codexLocalCanApply,
  codexLocalApplyBlockedMessage,
  relayReasoningEffortOptions,
  selectedRelayReasoningEffort,
  selectedRelayModel,
  resolvedRelayModels,
  onOpenCreateRelayKeyEditor,
  onToggleLANAccess,
  onApplyRelayConfigToLocal,
  onApplyClaude,
  onSelectKeyIndex,
  onSelectEndpointID,
  onCopyEndpointBaseUrl,
  onOpenCreateRelayProviderEditor,
  onSelectRelayProviderID,
  onSelectCodexLocalAuthStrategy,
  onDeleteRelayProviderOption,
  onSelectRelayReasoningEffort,
  onCommitRelayModelSelection,
  onCopyText,
  relayKeyDisplayName,
  supportsWebsockets,
  onToggleSupportsWebsockets,
  initialActiveTarget = 'codex',
}: StatusApplyLocalSectionProps) {
  type ClaudeCodeModelField = 'model' | 'defaultHaikuModel' | 'defaultSonnetModel' | 'defaultOpusModel' | 'smallFastModel';
  type ModelEditorTarget = { target: 'codex' } | { target: 'claude'; field: ClaudeCodeModelField };

  const [activeTarget, setActiveTarget] = useState<LocalCliPanelTarget>(initialActiveTarget);
  const [modelEditorTarget, setModelEditorTarget] = useState<ModelEditorTarget | null>(null);
  const [modelEditor, setModelEditor] = useState<RelayModelEditorState | null>(null);
  const [claudeDraft, setClaudeDraft] = useState<ClaudeCodeLocalApplyDraft>(() => ({
    relayKeyIndex: selectedKeyIndex,
    baseUrl: selectedEndpointBaseUrl,
    model: selectedRelayModel.startsWith('claude') ? selectedRelayModel : 'claude-sonnet-4-5',
    defaultHaikuModel: 'claude-haiku-4-5',
    defaultSonnetModel: selectedRelayModel.startsWith('claude') ? selectedRelayModel : 'claude-sonnet-4-5',
    defaultOpusModel: 'claude-opus-4-5',
    smallFastModel: 'claude-haiku-4-5',
    maxOutputTokens: '',
    apiTimeoutMs: '',
    disableNonEssentialTraffic: false,
    authField: 'ANTHROPIC_API_KEY',
  }));
  const selectedRelayKey = relayKeyItems[selectedKeyIndex]?.value || '';
  const selectedClaudeRelayKey = relayKeyItems[claudeDraft.relayKeyIndex]?.value || '';
  const selectedRelayProvider =
    relayProviderOptions.find((option) => option.id === selectedRelayProviderID) ||
    relayProviderOptions[0] || {
      id: selectedRelayProviderID,
      name: selectedRelayProviderID,
    };
  const localCliTargetOptions = useMemo(
    () => [
      { id: 'codex' as const, label: t('status.local_cli_tab_codex') },
      { id: 'claude' as const, label: t('status.local_cli_tab_claude') },
    ],
    [t]
  );
  const sortedRelayModels = useMemo(
    () => sortRelayModelCatalogByNameDesc(resolvedRelayModels),
    [resolvedRelayModels]
  );
  const codexDiff = useMemo(
    () =>
      buildCodexLocalApplyDiff({
        apiKey: selectedRelayKey,
        baseUrl: selectedEndpointBaseUrl,
        model: selectedRelayModel,
        reasoningEffort: selectedRelayReasoningEffort,
        providerID: selectedRelayProvider.id,
        providerName: selectedRelayProvider.name,
        supportsWebsockets,
        authStrategy: codexLocalAuthStrategy,
      }),
    [
      codexLocalAuthStrategy,
      selectedEndpointBaseUrl,
      selectedRelayKey,
      selectedRelayModel,
      selectedRelayProvider.id,
      selectedRelayProvider.name,
      selectedRelayReasoningEffort,
      supportsWebsockets,
    ]
  );
  const codexLocalPreflight = useMemo(
    () =>
      getCodexLocalApplyPreflight({
        authStrategy: codexLocalAuthStrategy,
        providerID: selectedRelayProvider.id,
        authState: localCodexAuthState,
      }),
    [codexLocalAuthStrategy, localCodexAuthState, selectedRelayProvider.id]
  );
  const codexLocalApplyState = useMemo(
    () =>
      resolveCodexLocalApplyState({
        isApplyingToLocal,
        isReady,
        selectedRelayKey,
        selectedProviderID: selectedRelayProvider.id,
        providerOptions: relayProviderOptions,
        preflight: codexLocalPreflight,
      }),
    [
      codexLocalPreflight,
      isApplyingToLocal,
      isReady,
      relayProviderOptions,
      selectedRelayKey,
      selectedRelayProvider.id,
    ]
  );
  const claudeDiff = useMemo(
    () =>
      buildClaudeCodeSettingsDiff({
        apiKey: selectedClaudeRelayKey,
        baseUrl: selectedEndpointBaseUrl,
        model: claudeDraft.model,
        defaultHaikuModel: claudeDraft.defaultHaikuModel,
        defaultSonnetModel: claudeDraft.defaultSonnetModel,
        defaultOpusModel: claudeDraft.defaultOpusModel,
        smallFastModel: claudeDraft.smallFastModel,
        maxOutputTokens: claudeDraft.maxOutputTokens,
        apiTimeoutMs: claudeDraft.apiTimeoutMs,
        disableNonEssentialTraffic: claudeDraft.disableNonEssentialTraffic,
        authField: claudeDraft.authField,
      }),
    [
      claudeDraft.apiTimeoutMs,
      claudeDraft.authField,
      claudeDraft.defaultHaikuModel,
      claudeDraft.defaultOpusModel,
      claudeDraft.defaultSonnetModel,
      claudeDraft.disableNonEssentialTraffic,
      claudeDraft.maxOutputTokens,
      claudeDraft.model,
      claudeDraft.smallFastModel,
      selectedEndpointBaseUrl,
      selectedClaudeRelayKey,
    ]
  );

  useEffect(() => {
    setClaudeDraft((prev) => {
      const maxIndex = Math.max(0, relayKeyItems.length - 1);
      const nextIndex = Math.min(prev.relayKeyIndex, maxIndex);
      return nextIndex === prev.relayKeyIndex ? prev : { ...prev, relayKeyIndex: nextIndex };
    });
  }, [relayKeyItems.length]);

  function updateClaudeDraft(patch: Partial<ClaudeCodeLocalApplyDraft>) {
    setClaudeDraft((prev) => ({
      ...prev,
      ...patch,
    }));
  }

  const relayModelSelectOptions = sortedRelayModels.some((model) => model.name === selectedRelayModel)
    ? sortedRelayModels
    : [{ name: selectedRelayModel || 'GT' }, ...sortedRelayModels];
  const relayModelSelectOptionNames = relayModelSelectOptions.map((model) => model.name);
  const relayProviderSelectOptions = relayProviderOptions.map((provider) => ({
    value: provider.id,
    label: provider.name === provider.id ? provider.id : `${provider.name} / ${provider.id}`,
  }));
  const codexLocalAuthStrategyOptions = [
    { value: 'replace_auth_with_apikey', label: t('status.auth_strategy_replace_apikey') },
    { value: 'preserve_chatgpt_auth', label: t('status.auth_strategy_preserve_chatgpt') },
  ];
  const codexLocalAuthSummary =
    !localCodexAuthState || !localCodexAuthState.hasAuthFile
      ? t('status.codex_local_auth_missing')
      : localCodexAuthState.authMode === 'chatgpt'
        ? t('status.codex_local_auth_chatgpt_ready')
        : localCodexAuthState.authMode === 'chatgpt_auth_tokens'
          ? t('status.codex_local_auth_chatgpt_tokens')
          : localCodexAuthState.authMode === 'apikey'
            ? t('status.codex_local_auth_apikey')
            : t('status.codex_local_auth_unknown');
  const codexLocalApplyGuidance =
    codexLocalApplyState.disabledReason === 'service_not_ready'
      ? t('status.codex_local_apply_blocked_not_ready')
      : codexLocalApplyState.disabledReason === 'missing_relay_key'
        ? t('status.codex_local_apply_blocked_missing_key')
        : codexLocalApplyState.disabledReason === 'requires_custom_provider'
          ? codexLocalApplyBlockedMessage || t('status.codex_local_preserve_requires_custom_provider')
          : codexLocalApplyState.disabledReason === 'missing_chatgpt_auth'
            ? codexLocalApplyBlockedMessage || t('status.codex_local_preserve_requires_chatgpt')
            : '';
  const codexLocalRecoveryProvider = relayProviderOptions.find(
    (provider) => provider.id === codexLocalApplyState.nextProviderID
  );
  const claudeModelOptions = Array.from(
    new Set([
      claudeDraft.model || 'claude-sonnet-4-5',
      claudeDraft.defaultHaikuModel,
      claudeDraft.defaultSonnetModel,
      claudeDraft.defaultOpusModel,
      claudeDraft.smallFastModel,
      'claude-sonnet-4-5',
      'claude-opus-4-5',
      'claude-haiku-4-5',
      ...sortedRelayModels.map((model) => model.name).filter((name) => name.toLowerCase().includes('claude')),
    ].filter(Boolean))
  );

  const relayKeyOptions =
    relayKeyItems.length > 0
      ? relayKeyItems.map((item, index) => ({
          value: String(index),
          label: `${relayKeyDisplayName(item.value, index)} / ${item.value}`,
        }))
      : [
          {
            value: '0',
            label: t('status.local_cli_no_relay_key'),
          },
        ];

  function openModelEditor(target: ModelEditorTarget, value: string) {
    setModelEditorTarget(target);
    setModelEditor({
      value,
      error: '',
    });
  }

  function submitModelEditor() {
    if (!modelEditor || !modelEditorTarget) {
      return;
    }

    const nextModel = modelEditor.value.trim();
    if (!nextModel) {
      setModelEditor({ ...modelEditor, error: t('status.model_name_required') });
      return;
    }

    if (modelEditorTarget.target === 'codex') {
      onCommitRelayModelSelection(nextModel);
    } else {
      updateClaudeDraft({ [modelEditorTarget.field]: nextModel } as Partial<ClaudeCodeLocalApplyDraft>);
    }
    setModelEditor(null);
    setModelEditorTarget(null);
  }

  return (
    <>
      <div className="mb-2 flex w-full">
        <SegmentedControl options={localCliTargetOptions} value={activeTarget} onChange={setActiveTarget} />
      </div>
      <section className="relative overflow-visible border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
        {activeTarget === 'codex' ? (
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <StatusRelayKeyPicker
                t={t}
                value={selectedKeyIndex}
                relayKeysLength={relayKeyItems.length}
                relayKeyOptions={relayKeyOptions}
                isReady={isReady}
                onSelect={onSelectKeyIndex}
                onCreate={onOpenCreateRelayKeyEditor}
              />

              <StatusEndpointPicker
                t={t}
                isLANAccessEnabled={isLANAccessEnabled}
                visibleRelayEndpoints={visibleRelayEndpoints}
                selectedEndpointID={selectedEndpointID}
                selectedEndpointBaseUrl={selectedEndpointBaseUrl}
                onToggleLANAccess={onToggleLANAccess}
                onSelectEndpointID={onSelectEndpointID}
                onCopyEndpointBaseUrl={onCopyEndpointBaseUrl}
              />

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                <ActionSelect
                  title={t('status.provider_title')}
                  value={selectedRelayProviderID}
                  options={relayProviderSelectOptions}
                  onSelect={onSelectRelayProviderID}
                  onCreate={onOpenCreateRelayProviderEditor}
                  onDelete={() => onDeleteRelayProviderOption(selectedRelayProviderID)}
                  deleteDisabled={relayProviderOptions.length <= 1}
                />

                <label className="grid gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('status.reasoning_effort_title')}
                  </span>
                  <select
                    value={selectedRelayReasoningEffort}
                    onChange={(event) => onSelectRelayReasoningEffort(event.target.value)}
                    className="select-swiss"
                  >
                    {relayReasoningEffortOptions.map((effort) => (
                      <option key={effort} value={effort}>
                        {effort}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <label className="grid gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('status.auth_strategy_title')}
                  </span>
                  <select
                    value={codexLocalAuthStrategy}
                    onChange={(event) =>
                      onSelectCodexLocalAuthStrategy(event.target.value as CodexLocalAuthStrategy)
                    }
                    className="select-swiss"
                  >
                    {codexLocalAuthStrategyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('status.codex_local_auth_state_title')}
                  </span>
                  <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-[0.6875rem] font-semibold text-[var(--text-primary)]">
                    <div>{codexLocalAuthSummary}</div>
                    {localCodexAuthState?.accountEmail ? (
                      <div className="mt-1 font-mono text-[0.625rem] text-[var(--text-muted)]">
                        {localCodexAuthState.accountEmail}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                <StatusModelPicker
                  t={t}
                  value={selectedRelayModel}
                  options={relayModelSelectOptionNames}
                  onSelect={onCommitRelayModelSelection}
                  onCreate={() => openModelEditor({ target: 'codex' }, selectedRelayModel)}
                />

                <label className="grid gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('status.local_cli_wire_api')}
                  </span>
                  <input value="responses" readOnly className="input-swiss w-full" />
                </label>
              </div>

              {selectedRelayProvider.id !== 'openai' ? (
                <div className="flex items-center justify-between">
                  <span className="text-[0.875rem] font-bold uppercase tracking-[0.08em] text-[var(--text-primary)]">
                    supports_websockets
                  </span>
                  <ToggleSwitch
                    label="supports_websockets"
                    checked={supportsWebsockets}
                    disabled={isApplyingToLocal}
                    className="h-9 w-16"
                    onChange={onToggleSupportsWebsockets}
                  />
                </div>
              ) : null}

              {codexLocalAuthStrategy === 'preserve_chatgpt_auth' && codexLocalCanApply ? (
                <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                  {t('status.codex_local_preserve_hint')}
                  {localCodexAuthState?.warnings?.length ? ` / ${localCodexAuthState.warnings.join(' / ')}` : ''}
                </div>
              ) : null}

              {codexLocalApplyGuidance ? (
                <div className="grid gap-3 border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                    {codexLocalApplyGuidance}
                    {localCodexAuthState?.warnings?.length ? ` / ${localCodexAuthState.warnings.join(' / ')}` : ''}
                  </div>
                  {codexLocalApplyState.recoveryAction === 'create_relay_key' ? (
                    <button
                      type="button"
                      className="btn-swiss !px-3 !py-1.5 !text-[0.5625rem]"
                      onClick={onOpenCreateRelayKeyEditor}
                    >
                      {t('status.codex_local_recovery_create_key')}
                    </button>
                  ) : codexLocalApplyState.recoveryAction === 'switch_auth_to_apikey' ? (
                    <button
                      type="button"
                      className="btn-swiss !px-3 !py-1.5 !text-[0.5625rem]"
                      onClick={() => onSelectCodexLocalAuthStrategy('replace_auth_with_apikey')}
                    >
                      {t('status.codex_local_recovery_use_apikey')}
                    </button>
                  ) : codexLocalApplyState.recoveryAction === 'switch_to_custom_provider' &&
                    codexLocalApplyState.nextProviderID ? (
                    <button
                      type="button"
                      className="btn-swiss !px-3 !py-1.5 !text-[0.5625rem]"
                      onClick={() => onSelectRelayProviderID(codexLocalApplyState.nextProviderID || '')}
                    >
                      {t('status.codex_local_recovery_switch_provider')}{' '}
                      {codexLocalRecoveryProvider?.name || codexLocalApplyState.nextProviderID}
                    </button>
                  ) : codexLocalApplyState.recoveryAction === 'create_provider' ? (
                    <button
                      type="button"
                      className="btn-swiss !px-3 !py-1.5 !text-[0.5625rem]"
                      onClick={onOpenCreateRelayProviderEditor}
                    >
                      {t('status.codex_local_recovery_create_provider')}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {localApplyMessage ? (
                <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                  {localApplyMessage}
                </div>
              ) : null}

            </div>

            <StatusSnippetPanel
              title={t('status.codex_local_diff')}
              content={codexDiff}
              onCopy={() => onCopyText(codexDiff, t('status.codex_local_diff_copied'))}
              headerAction={
                <button
                  type="button"
                  onClick={onApplyRelayConfigToLocal}
                  disabled={!codexLocalApplyState.canApply}
                  className="btn-swiss bg-[var(--border-color)] !px-3 !py-1 !text-[0.5625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApplyingToLocal ? t('status.applying_local') : t('status.apply_local_codex')}
                </button>
              }
              preClassName="max-h-[38rem]"
            />
          </div>
        ) : (
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <StatusRelayKeyPicker
                t={t}
                value={claudeDraft.relayKeyIndex}
                relayKeysLength={relayKeyItems.length}
                relayKeyOptions={relayKeyOptions}
                isReady={isReady}
                onSelect={(index) => updateClaudeDraft({ relayKeyIndex: index })}
                onCreate={onOpenCreateRelayKeyEditor}
              />

              <StatusEndpointPicker
                t={t}
                isLANAccessEnabled={isLANAccessEnabled}
                visibleRelayEndpoints={visibleRelayEndpoints}
                selectedEndpointID={selectedEndpointID}
                selectedEndpointBaseUrl={selectedEndpointBaseUrl}
                onToggleLANAccess={onToggleLANAccess}
                onSelectEndpointID={onSelectEndpointID}
                onCopyEndpointBaseUrl={onCopyEndpointBaseUrl}
              />

              <div className="grid gap-3">
                <StatusModelPicker
                  t={t}
                  title={t('status.model_name_title')}
                  value={claudeDraft.model || claudeModelOptions[0]}
                  options={claudeModelOptions}
                  onSelect={(value) => updateClaudeDraft({ model: value })}
                  onCreate={() =>
                    openModelEditor({ target: 'claude', field: 'model' }, claudeDraft.model || claudeModelOptions[0])
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <StatusModelPicker
                  t={t}
                  title={t('status.claude_default_haiku_model')}
                  value={claudeDraft.defaultHaikuModel || 'claude-haiku-4-5'}
                  options={claudeModelOptions}
                  onSelect={(value) => updateClaudeDraft({ defaultHaikuModel: value })}
                  onCreate={() =>
                    openModelEditor(
                      { target: 'claude', field: 'defaultHaikuModel' },
                      claudeDraft.defaultHaikuModel || 'claude-haiku-4-5'
                    )
                  }
                />
                <StatusModelPicker
                  t={t}
                  title={t('status.claude_default_sonnet_model')}
                  value={claudeDraft.defaultSonnetModel || 'claude-sonnet-4-5'}
                  options={claudeModelOptions}
                  onSelect={(value) => updateClaudeDraft({ defaultSonnetModel: value })}
                  onCreate={() =>
                    openModelEditor(
                      { target: 'claude', field: 'defaultSonnetModel' },
                      claudeDraft.defaultSonnetModel || 'claude-sonnet-4-5'
                    )
                  }
                />
                <StatusModelPicker
                  t={t}
                  title={t('status.claude_default_opus_model')}
                  value={claudeDraft.defaultOpusModel || 'claude-opus-4-5'}
                  options={claudeModelOptions}
                  onSelect={(value) => updateClaudeDraft({ defaultOpusModel: value })}
                  onCreate={() =>
                    openModelEditor(
                      { target: 'claude', field: 'defaultOpusModel' },
                      claudeDraft.defaultOpusModel || 'claude-opus-4-5'
                    )
                  }
                />
                <StatusModelPicker
                  t={t}
                  title={t('status.claude_small_fast_model')}
                  value={claudeDraft.smallFastModel || 'claude-haiku-4-5'}
                  options={claudeModelOptions}
                  onSelect={(value) => updateClaudeDraft({ smallFastModel: value })}
                  onCreate={() =>
                    openModelEditor(
                      { target: 'claude', field: 'smallFastModel' },
                      claudeDraft.smallFastModel || 'claude-haiku-4-5'
                    )
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <label className="grid gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('status.claude_max_output_tokens')}
                  </span>
                  <input
                    value={claudeDraft.maxOutputTokens}
                    onChange={(event) => updateClaudeDraft({ maxOutputTokens: event.target.value })}
                    className="input-swiss w-full"
                    inputMode="numeric"
                    placeholder="6000"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('status.claude_api_timeout_ms')}
                  </span>
                  <input
                    value={claudeDraft.apiTimeoutMs}
                    onChange={(event) => updateClaudeDraft({ apiTimeoutMs: event.target.value })}
                    className="input-swiss w-full"
                    inputMode="numeric"
                    placeholder="600000"
                  />
                </label>
                <div className="flex items-center justify-between gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 md:min-h-[2.875rem]">
                  <span className="text-[0.625rem] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                    {t('status.claude_disable_nonessential_traffic')}
                  </span>
                  <ToggleSwitch
                    label={t('status.claude_disable_nonessential_traffic')}
                    checked={claudeDraft.disableNonEssentialTraffic}
                    disabled={isApplyingClaude}
                    className="h-8 w-14"
                    onChange={(checked) => updateClaudeDraft({ disableNonEssentialTraffic: checked })}
                  />
                </div>
              </div>

              {claudeApplyMessage ? (
                <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                  {claudeApplyMessage}
                </div>
              ) : null}

            </div>

            <StatusSnippetPanel
              title={t('status.claude_settings_diff')}
              content={claudeDiff}
              onCopy={() => onCopyText(claudeDiff, t('status.claude_settings_diff_copied'))}
              headerAction={
                <button
                  type="button"
                  onClick={() => onApplyClaude({ ...claudeDraft, baseUrl: selectedEndpointBaseUrl })}
                  disabled={isApplyingClaude || !isReady || !selectedClaudeRelayKey.trim()}
                  className="btn-swiss bg-[var(--border-color)] !px-3 !py-1 !text-[0.5625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApplyingClaude ? t('status.applying_local') : t('status.apply_local_claude')}
                </button>
              }
              preClassName="max-h-[38rem]"
            />
          </div>
        )}
      </section>
      {modelEditor ? (
        <RelayModelEditorModal
          editor={modelEditor}
          t={t}
          onClose={() => {
            setModelEditor(null);
            setModelEditorTarget(null);
          }}
          onChange={setModelEditor}
          onSubmit={submitModelEditor}
        />
      ) : null}
    </>
  );
}

interface StatusRelayKeyPickerProps {
  t: (key: string) => string;
  value: number;
  relayKeysLength: number;
  relayKeyOptions: ActionSelectOption[];
  isReady: boolean;
  onSelect: (index: number) => void;
  onCreate: () => void;
}

function StatusRelayKeyPicker({
  t,
  value,
  relayKeysLength,
  relayKeyOptions,
  isReady,
  onSelect,
  onCreate,
}: StatusRelayKeyPickerProps) {
  const selectedIndex = Math.min(Math.max(0, value), Math.max(0, relayKeysLength - 1));

  return (
    <ActionSelect
      title={t('status.local_cli_relay_key')}
      value={String(selectedIndex)}
      options={relayKeyOptions}
      onSelect={(nextValue) => onSelect(Number(nextValue))}
      onCreate={onCreate}
      createDisabled={!isReady}
      selectDisabled={relayKeysLength === 0}
    />
  );
}

interface StatusEndpointPickerProps {
  t: (key: string) => string;
  isLANAccessEnabled: boolean;
  visibleRelayEndpoints: main.RelayServiceEndpoint[];
  selectedEndpointID: string;
  selectedEndpointBaseUrl: string;
  onToggleLANAccess: () => void;
  onSelectEndpointID: (id: string) => void;
  onCopyEndpointBaseUrl: () => void;
}

function StatusEndpointPicker({
  t,
  isLANAccessEnabled,
  visibleRelayEndpoints,
  selectedEndpointID,
  selectedEndpointBaseUrl,
  onToggleLANAccess,
  onSelectEndpointID,
  onCopyEndpointBaseUrl,
}: StatusEndpointPickerProps) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {t('status.endpoint_title')}
        </span>
        <button
          type="button"
          onClick={onToggleLANAccess}
          className={`btn-swiss !px-2.5 !py-1.5 !text-[0.625rem] ${
            isLANAccessEnabled ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''
          }`}
        >
          {isLANAccessEnabled ? t('status.lan_access_on') : t('status.lan_access_off')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleRelayEndpoints.map((endpoint) => {
          const isSelected = selectedEndpointID === endpoint.id;
          const endpointLabel =
            endpoint.kind === 'localhost'
              ? t('status.endpoint_localhost')
              : endpoint.kind === 'hostname'
                ? t('status.endpoint_hostname')
                : t('status.endpoint_lan');

          return (
            <button
              key={endpoint.id}
              type="button"
              onClick={() => onSelectEndpointID(endpoint.id)}
              className={`border-2 px-2.5 py-1.5 text-[0.5625rem] font-black uppercase tracking-[0.18em] ${
                isSelected
                  ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              {endpointLabel}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
        <span className="truncate font-mono text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
          {selectedEndpointBaseUrl}
        </span>
        <button type="button" onClick={onCopyEndpointBaseUrl} className="btn-swiss !px-2 !py-1 !text-[0.5625rem]">
          {t('common.copy')}
        </button>
      </div>
    </div>
  );
}

interface StatusModelPickerProps {
  t: (key: string) => string;
  title?: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  onCreate: () => void;
}

function StatusModelPicker({
  t,
  title,
  value,
  options,
  onSelect,
  onCreate,
}: StatusModelPickerProps) {
  const selectOptions = options.includes(value) ? options : [value, ...options].filter(Boolean);

  return (
    <ActionSelect
      title={title || t('status.model_name_title')}
      value={value}
      options={selectOptions.map((model) => ({ value: model, label: model }))}
      onSelect={onSelect}
      onCreate={onCreate}
    />
  );
}

export { default as StatusSnippetPanel } from './StatusSnippetPanel';
