import { useEffect, useMemo, useState } from 'react';
import type { main } from '../../../../wailsjs/go/models';
import ActionSelect, { type ActionSelectOption } from '../../../components/ui/ActionSelect';
import FormField, { FieldLabel, SelectField, TextInputField } from '../../../components/ui/FormField';
import ModalFrame from '../../../components/ui/ModalFrame';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import { RelayModelEditorModal } from './RelayEditors';
import StatusSnippetPanel from './StatusSnippetPanel';
import type { StatusQuotaEvidenceSectionState } from '../model/quotaEvidenceSection';
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
import { resolveRelayModelCatalogSlug, sortRelayModelCatalogByNameDesc } from '../model/relayModelCatalog';
import type { RelayProviderOption } from '../model/relayProviderCatalog';
import { RELAY_CODEX_DEFAULT_MODEL } from '../../accounts/model/accountConfig';

type LocalCliPanelTarget = 'codex' | 'claude';

export function StatusQuotaEvidenceSection({ state }: { state: StatusQuotaEvidenceSectionState }) {
  if (state.items.length === 0 && !state.notice) {
    return null;
  }

  return (
    <section
      className="card-swiss grid gap-4 p-4"
      data-status-quota-evidence-section="true"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            QUOTA EVIDENCE
          </div>
          <div className="mt-1 font-mono text-[length:var(--font-size-ui-md)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
            Runtime authority facts
          </div>
        </div>
        <div className="shrink-0 border-2 border-[var(--border-color)] px-3 py-1 text-right font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
          {state.items.length} FACT{state.items.length === 1 ? '' : 'S'}
        </div>
      </div>

      {state.notice ? (
        <div
          className="grid gap-2 border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-3"
          data-status-quota-evidence-empty="true"
        >
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {state.notice.eyebrow}
          </div>
          <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">
            {state.notice.title}
          </div>
          <div className="font-mono text-[length:var(--font-size-ui-sm)] text-[var(--text-muted)]">
            {state.notice.description}
          </div>
          {state.notice.unscopedMissingFactCount > 0 ? (
            <div
              className="grid gap-1 border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2"
              data-status-quota-evidence-missing-unscoped="true"
            >
              <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                UNSCOPED PAYLOADS MISSING EXPLICIT FACT
              </div>
              <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
                {state.notice.unscopedMissingFactCount} UNSCOPED PAYLOAD
                {state.notice.unscopedMissingFactCount === 1 ? '' : 'S'} MISSING EXPLICIT FACT
              </div>
              {state.notice.unscopedMissingFactSamples?.length ? (
                <div className="grid gap-2 pt-1" data-status-quota-evidence-unscoped-samples="true">
                  <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    UNSCOPED TRACE SAMPLES
                  </div>
                  <ul className="grid gap-1">
                    {state.notice.unscopedMissingFactSamples.map((label) => (
                      <li
                        key={label}
                        className="break-all font-mono text-[length:var(--font-size-ui-sm)] text-[var(--text-primary)]"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                  <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    NON-AUTHORITATIVE TRACE
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {state.notice.accountKeys?.length ? (
            <div className="grid gap-2 border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
              <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                MISSING EXPLICIT FACT
              </div>
              <ul className="grid gap-1" data-status-quota-evidence-missing-accounts="true">
                {state.notice.accountKeys.map((accountKey) => (
                  <li
                    key={accountKey}
                    className="break-all font-mono text-[length:var(--font-size-ui-sm)] text-[var(--text-primary)]"
                  >
                    {accountKey}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3">
        {state.items.map((item) => {
          const { evidence } = item;
          const rows = [
            ['STATE', evidence.view.stateLabel],
            ['SOURCE', evidence.view.sourceLabel],
            ['FRESHNESS', evidence.view.freshnessLabel],
            ['CONFIDENCE', evidence.view.confidenceLabel],
            ['RISK', evidence.view.riskLabel],
            ['SUMMARY', evidence.summary],
          ];

          return (
            <article
              key={`${item.accountKey || 'unknown'}:${item.updatedAt || evidence.summary}`}
              className="grid gap-3 border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3"
              data-status-quota-evidence-item="true"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {evidence.title}
                  </div>
                  <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">
                    {item.accountKey || 'UNSCOPED'}
                  </div>
                </div>
                {item.updatedAt ? (
                  <div className="shrink-0 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    UPDATED {item.updatedAt}
                  </div>
                ) : null}
              </div>

              <dl className="grid gap-2 md:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div key={label} className="grid gap-1 border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
                    <dt className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {label}
                    </dt>
                    <dd className="font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {evidence.view.explanation ? (
                <div className="grid gap-1 border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
                  <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    EXPLANATION
                  </div>
                  <div className="font-mono text-[length:var(--font-size-ui-sm)] text-[var(--text-primary)]">
                    {evidence.view.explanation}
                  </div>
                </div>
              ) : null}

              {evidence.view.evidenceRefs.length > 0 ? (
                <div className="grid gap-2 border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
                  <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    EVIDENCE REFS
                  </div>
                  <ul className="grid gap-1">
                    {evidence.view.evidenceRefs.map((ref) => (
                      <li
                        key={ref}
                        className="break-all font-mono text-[length:var(--font-size-ui-sm)] text-[var(--text-primary)]"
                      >
                        {ref}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function formatRelayProviderSelectLabel(provider: RelayProviderOption) {
  const providerID = provider.id.trim();
  return providerID;
}

interface StatusApplyLocalSectionProps {
  t: (key: string) => string;
  localApplyMessage: string;
  claudeApplyMessage: string;
  isLANAccessEnabled: boolean;
  isApplyingToLocal: boolean;
  isApplyingClaude: boolean;
  isReady: boolean;
  codexLocalConfigLoaded?: boolean;
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
  localCodexProviderWebsocketRisk: boolean;
  onToggleSupportsWebsockets: () => void;
  syncCodexModelCatalog: boolean;
  isDisablingModelCatalog: boolean;
  onChangeSyncCodexModelCatalog: (checked: boolean) => void;
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
  codexLocalConfigLoaded = true,
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
  localCodexProviderWebsocketRisk,
  onToggleSupportsWebsockets,
  syncCodexModelCatalog,
  isDisablingModelCatalog,
  onChangeSyncCodexModelCatalog,
  initialActiveTarget = 'codex',
}: StatusApplyLocalSectionProps) {
  type ClaudeCodeModelField = 'model' | 'defaultHaikuModel' | 'defaultSonnetModel' | 'defaultOpusModel' | 'smallFastModel';
  type ModelEditorTarget = { target: 'codex' } | { target: 'claude'; field: ClaudeCodeModelField };

  const [activeTarget, setActiveTarget] = useState<LocalCliPanelTarget>(initialActiveTarget);
  const [modelEditorTarget, setModelEditorTarget] = useState<ModelEditorTarget | null>(null);
  const [modelEditor, setModelEditor] = useState<RelayModelEditorState | null>(null);
  const [modelCatalogPreviewOpen, setModelCatalogPreviewOpen] = useState(false);
  const fieldPairGridClass = 'grid gap-3 md:grid-cols-2';
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
    claudeCodeAttributionHeader: false,
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
  const modelCatalogPreviewModels = useMemo(() => {
    const seen = new Set<string>();
    return sortedRelayModels
      .map((model) => {
        const slug = resolveRelayModelCatalogSlug(model);
        const name = (model.name || '').trim();
        if (!slug || seen.has(slug)) {
          return null;
        }
        seen.add(slug);
        return {
          slug,
          name,
          alias: (model.alias || '').trim(),
          reasoning: model.supportedReasoningEfforts.length > 0 ? model.supportedReasoningEfforts.join(' / ') : '-',
        };
      })
      .filter((model): model is { slug: string; name: string; alias: string; reasoning: string } => model !== null);
  }, [sortedRelayModels]);
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
        isCodexConfigLoaded: codexLocalConfigLoaded,
        selectedRelayKey,
        selectedProviderID: selectedRelayProvider.id,
        providerOptions: relayProviderOptions,
        preflight: codexLocalPreflight,
      }),
    [
      codexLocalPreflight,
      isApplyingToLocal,
      isReady,
      codexLocalConfigLoaded,
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
        claudeCodeAttributionHeader: claudeDraft.claudeCodeAttributionHeader,
        authField: claudeDraft.authField,
      }),
    [
      claudeDraft.apiTimeoutMs,
      claudeDraft.authField,
      claudeDraft.claudeCodeAttributionHeader,
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
    : [{ name: selectedRelayModel || RELAY_CODEX_DEFAULT_MODEL }, ...sortedRelayModels];
  const relayModelSelectOptionNames = relayModelSelectOptions.map((model) => model.name);
  const relayProviderSelectOptions = relayProviderOptions.map((provider) => ({
    value: provider.id,
    label: formatRelayProviderSelectLabel(provider),
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
      : codexLocalApplyState.disabledReason === 'loading_codex_config'
        ? t('status.codex_local_apply_blocked_loading_config')
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
                selectedRelayKey={selectedRelayKey}
                relayKeysLength={relayKeyItems.length}
                relayKeyOptions={relayKeyOptions}
                isReady={isReady}
                onSelect={onSelectKeyIndex}
                onCreate={onOpenCreateRelayKeyEditor}
                onCopySelectedRelayKey={() => onCopyText(selectedRelayKey, t('status.service_key_copied'))}
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

              <div className={fieldPairGridClass}>
                <ActionSelect
                  title={t('status.provider_title')}
                  value={selectedRelayProviderID}
                  options={relayProviderSelectOptions}
                  onSelect={onSelectRelayProviderID}
                  onCreate={onOpenCreateRelayProviderEditor}
                  onDelete={() => onDeleteRelayProviderOption(selectedRelayProviderID)}
                  deleteDisabled={relayProviderOptions.length <= 1}
                />

                <SelectField
                  title={t('status.reasoning_effort_title')}
                  value={selectedRelayReasoningEffort}
                  options={relayReasoningEffortOptions.map((effort) => ({ value: effort, label: effort }))}
                  onChange={onSelectRelayReasoningEffort}
                />
              </div>

              <div className={fieldPairGridClass}>
                <SelectField
                  title={t('status.auth_strategy_title')}
                  value={codexLocalAuthStrategy}
                  options={codexLocalAuthStrategyOptions}
                  onChange={(value) => onSelectCodexLocalAuthStrategy(value as CodexLocalAuthStrategy)}
                />

                <FormField title={t('status.codex_local_auth_state_title')} as="div">
                  <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-[length:var(--font-size-ui-md-compact)] font-semibold text-[var(--text-primary)]">
                    <div>{codexLocalAuthSummary}</div>
                    {localCodexAuthState?.accountEmail ? (
                      <div className="mt-1 font-mono text-[length:var(--font-size-ui-sm)] text-[var(--text-muted)]">
                        {localCodexAuthState.accountEmail}
                      </div>
                    ) : null}
                  </div>
                </FormField>
              </div>

              <div className={fieldPairGridClass}>
                <StatusModelPicker
                  t={t}
                  value={selectedRelayModel}
                  options={relayModelSelectOptionNames}
                  onSelect={onCommitRelayModelSelection}
                  onCreate={() => openModelEditor({ target: 'codex' }, selectedRelayModel)}
                />

                <TextInputField title={t('status.local_cli_wire_api')} value="responses" readOnly />
              </div>

              {selectedRelayProvider.id !== 'openai' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[length:var(--font-size-ui-lg)] font-bold tracking-[0.08em] text-[var(--text-primary)]">
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
                  {localCodexProviderWebsocketRisk ? (
                    <div className="border-2 border-[var(--color-status-danger)] bg-[var(--bg-main)] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-bold leading-snug text-[var(--color-status-danger)]">
                      {supportsWebsockets
                        ? t('status.local_cli_websocket_risk_opt_in')
                        : t('status.local_cli_websocket_risk_detected')}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="preview sync_model_catalog"
                  className="min-w-0 text-left active:scale-95"
                  onClick={() => setModelCatalogPreviewOpen(true)}
                >
                  <span className="text-[length:var(--font-size-ui-lg)] font-bold tracking-[0.08em] text-[var(--text-primary)] underline-offset-4 hover:underline">
                    sync_model_catalog
                    {isDisablingModelCatalog ? (
                      <span className="ml-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        正在停用
                      </span>
                    ) : null}
                  </span>
                </button>
                <ToggleSwitch
                  label="sync_model_catalog"
                  checked={syncCodexModelCatalog}
                  disabled={isApplyingToLocal || isDisablingModelCatalog}
                  className="h-9 w-16"
                  onChange={onChangeSyncCodexModelCatalog}
                />
              </div>

              {codexLocalAuthStrategy === 'preserve_chatgpt_auth' && codexLocalCanApply ? (
                <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black tracking-wide text-[var(--text-primary)]">
                  {t('status.codex_local_preserve_hint')}
                  {localCodexAuthState?.warnings?.length ? ` / ${localCodexAuthState.warnings.join(' / ')}` : ''}
                </div>
              ) : null}

              {codexLocalApplyGuidance ? (
                <div className="grid gap-3 border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="text-[length:var(--font-size-ui-sm)] font-black tracking-wide text-[var(--text-primary)]">
                    {codexLocalApplyGuidance}
                    {localCodexAuthState?.warnings?.length ? ` / ${localCodexAuthState.warnings.join(' / ')}` : ''}
                  </div>
                  {codexLocalApplyState.recoveryAction === 'create_relay_key' ? (
                    <button
                      type="button"
                      className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                      onClick={onOpenCreateRelayKeyEditor}
                    >
                      {t('status.codex_local_recovery_create_key')}
                    </button>
                  ) : codexLocalApplyState.recoveryAction === 'switch_auth_to_apikey' ? (
                    <button
                      type="button"
                      className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                      onClick={() => onSelectCodexLocalAuthStrategy('replace_auth_with_apikey')}
                    >
                      {t('status.codex_local_recovery_use_apikey')}
                    </button>
                  ) : codexLocalApplyState.recoveryAction === 'switch_to_custom_provider' &&
                    codexLocalApplyState.nextProviderID ? (
                    <button
                      type="button"
                      className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                      onClick={() => onSelectRelayProviderID(codexLocalApplyState.nextProviderID || '')}
                    >
                      {t('status.codex_local_recovery_switch_provider')}{' '}
                      {codexLocalRecoveryProvider?.name || codexLocalApplyState.nextProviderID}
                    </button>
                  ) : codexLocalApplyState.recoveryAction === 'create_provider' ? (
                    <button
                      type="button"
                      className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                      onClick={onOpenCreateRelayProviderEditor}
                    >
                      {t('status.codex_local_recovery_create_provider')}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {localApplyMessage ? (
                <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black tracking-wide text-[var(--text-primary)]">
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
                  className="btn-swiss bg-[var(--border-color)] !px-3 !py-1 !text-[length:var(--font-size-ui-xs)] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
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
                selectedRelayKey={selectedClaudeRelayKey}
                relayKeysLength={relayKeyItems.length}
                relayKeyOptions={relayKeyOptions}
                isReady={isReady}
                onSelect={(index) => updateClaudeDraft({ relayKeyIndex: index })}
                onCreate={onOpenCreateRelayKeyEditor}
                onCopySelectedRelayKey={() => onCopyText(selectedClaudeRelayKey, t('status.service_key_copied'))}
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

              <div className={fieldPairGridClass}>
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

              <div className={fieldPairGridClass}>
                <TextInputField
                  title={t('status.claude_max_output_tokens')}
                  value={claudeDraft.maxOutputTokens}
                  onChange={(event) => updateClaudeDraft({ maxOutputTokens: event.target.value })}
                  inputMode="numeric"
                  placeholder="6000"
                />
                <TextInputField
                  title={t('status.claude_api_timeout_ms')}
                  value={claudeDraft.apiTimeoutMs}
                  onChange={(event) => updateClaudeDraft({ apiTimeoutMs: event.target.value })}
                  inputMode="numeric"
                  placeholder="600000"
                />
              </div>

              <div className={fieldPairGridClass}>
                <div className="flex items-center justify-between gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 md:min-h-[2.875rem]">
                  <span className="text-[length:var(--font-size-ui-sm)] font-black tracking-[0.12em] text-[var(--text-primary)]">
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
                <div className="flex items-center justify-between gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 md:min-h-[2.875rem]">
                  <span className="text-[length:var(--font-size-ui-sm)] font-black tracking-[0.12em] text-[var(--text-primary)]">
                    {t('status.claude_code_attribution_header')}
                  </span>
                  <ToggleSwitch
                    label={t('status.claude_code_attribution_header')}
                    checked={claudeDraft.claudeCodeAttributionHeader}
                    disabled={isApplyingClaude}
                    className="h-8 w-14"
                    onChange={(checked) => updateClaudeDraft({ claudeCodeAttributionHeader: checked })}
                  />
                </div>
              </div>

              {claudeApplyMessage ? (
                <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black tracking-wide text-[var(--text-primary)]">
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
                  className="btn-swiss bg-[var(--border-color)] !px-3 !py-1 !text-[length:var(--font-size-ui-xs)] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
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
      {modelCatalogPreviewOpen ? (
        <ModalFrame
          size="lg"
          ariaLabel="Codex /model 模型目录预览"
          onClose={() => setModelCatalogPreviewOpen(false)}
          panelClassName="!w-fit !max-w-[calc(100vw-3rem)]"
          header={
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  CODEX MODEL CATALOG
                </div>
                <h3 className="mt-1 text-sm font-black uppercase italic tracking-normal text-[var(--text-primary)]">
                  Codex /model 模型目录预览
                </h3>
              </div>
              <button type="button" onClick={() => setModelCatalogPreviewOpen(false)} className="btn-swiss active:scale-95">
                关闭
              </button>
            </div>
          }
          bodyClassName="bg-[var(--bg-surface)]"
        >
          <table className="w-max min-w-full border-collapse">
            <thead className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)]">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  /model slug
                </th>
                <th scope="col" className="px-4 py-2 text-left font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  real model
                </th>
                <th scope="col" className="px-4 py-2 text-left font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  reasoning
                </th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[var(--border-color)]">
              {modelCatalogPreviewModels.map((model) => (
                <tr key={model.slug}>
                  <td className="px-4 py-3 align-top">
                    <div className="whitespace-nowrap font-mono text-[length:var(--font-size-ui-sm)] font-black tracking-wide text-[var(--text-primary)]">
                      {model.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="whitespace-nowrap font-mono text-[length:var(--font-size-ui-sm)] font-semibold tracking-wide text-[var(--text-primary)]">
                      {model.name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="whitespace-nowrap font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {model.reasoning}
                    </div>
                  </td>
                </tr>
              ))}
              {modelCatalogPreviewModels.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    暂无可同步模型
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </ModalFrame>
      ) : null}
    </>
  );
}

interface StatusRelayKeyPickerProps {
  t: (key: string) => string;
  value: number;
  selectedRelayKey: string;
  relayKeysLength: number;
  relayKeyOptions: ActionSelectOption[];
  isReady: boolean;
  onSelect: (index: number) => void;
  onCreate: () => void;
  onCopySelectedRelayKey: () => void;
}

function StatusRelayKeyPicker({
  t,
  value,
  selectedRelayKey,
  relayKeysLength,
  relayKeyOptions,
  isReady,
  onSelect,
  onCreate,
  onCopySelectedRelayKey,
}: StatusRelayKeyPickerProps) {
  const selectedIndex = Math.min(Math.max(0, value), Math.max(0, relayKeysLength - 1));

  return (
    <ActionSelect
      title={t('status.local_cli_relay_key')}
      value={String(selectedIndex)}
      options={relayKeyOptions}
      onSelect={(nextValue) => onSelect(Number(nextValue))}
      onCreate={onCreate}
      onCopy={onCopySelectedRelayKey}
      copyDisabled={!selectedRelayKey.trim()}
      copyTitle={t('status.service_key_copy')}
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
        <FieldLabel>{t('status.endpoint_title')}</FieldLabel>
        <button
          type="button"
          onClick={onToggleLANAccess}
          className={`btn-swiss !px-2.5 !py-1.5 !text-[length:var(--font-size-ui-sm)] ${
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
              className={`border-2 px-2.5 py-1.5 text-[length:var(--font-size-ui-xs)] font-black tracking-[0.18em] ${
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
        <span className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black tracking-wide text-[var(--text-primary)]">
          {selectedEndpointBaseUrl}
        </span>
        <button type="button" onClick={onCopyEndpointBaseUrl} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-xs)]">
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
