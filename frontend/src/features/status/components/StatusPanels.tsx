import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button, Input, Segmented, Select, Space, Switch } from 'antd';
import type { main } from '../../../../wailsjs/go/models';
import FormField, { FieldLabel } from '../../../components/ui/FormField';
import ModalFrame from '../../../components/ui/ModalFrame';
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

const statusPanelClass =
  'rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const statusMutedPanelClass = 'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const statusInsetPanelClass = 'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)]';
const statusFieldBoxClass =
  'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2';
const statusEyebrowClass = 'text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]';
const statusTitleClass = 'text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]';
const statusMetaClass = 'font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const statusValueClass = 'font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]';
const statusNoticeClass =
  'rounded border border-dashed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]';
const statusToggleRowClass =
  'flex items-center justify-between gap-3 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 md:min-h-[2.875rem]';
const statusLocalCliSummaryItemClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2';
const statusLocalCliRailClass =
  'grid min-w-0 gap-4 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] p-4';
const statusLocalCliCapabilityRowClass =
  'grid gap-3 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center';
const statusLocalCliPlanStatusClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-3 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]';

interface StatusSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface StatusActionSelectProps {
  title: string;
  value: string;
  options: readonly StatusSelectOption[];
  onSelect: (value: string) => void;
  onCreate: () => void;
  onCopy?: () => void;
  createDisabled?: boolean;
  copyDisabled?: boolean;
  selectDisabled?: boolean;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  copyLabel?: string;
  copyTitle?: string;
}

function StatusActionSelect({
  title,
  value,
  options,
  onSelect,
  onCreate,
  onCopy,
  createDisabled = false,
  copyDisabled = false,
  selectDisabled = false,
  onDelete,
  deleteDisabled = false,
  copyLabel = 'Copy',
  copyTitle,
}: StatusActionSelectProps) {
  return (
    <FormField title={title} as="div">
      <Space.Compact block>
        <Select
          size="middle"
          value={value}
          options={options.map((option) => ({ value: option.value, label: option.label, disabled: option.disabled }))}
          onChange={onSelect}
          disabled={selectDisabled}
          popupMatchSelectWidth={false}
          className="min-w-0 flex-1"
        />
        {onCopy ? (
          <Button
            type="default"
            size="middle"
            onClick={onCopy}
            disabled={copyDisabled}
            aria-label={copyTitle}
            title={copyTitle}
          >
            {copyLabel}
          </Button>
        ) : null}
        <Button
          type="default"
          size="middle"
          onClick={onCreate}
          disabled={createDisabled}
          aria-label={`Create ${title}`}
          title={`Create ${title}`}
        >
          +
        </Button>
        {onDelete ? (
          <Button
            type="default"
            size="middle"
            onClick={onDelete}
            disabled={deleteDisabled}
            aria-label={`Delete ${title}`}
            title={`Delete ${title}`}
          >
            ×
          </Button>
        ) : null}
      </Space.Compact>
    </FormField>
  );
}

function StatusSelectField({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: readonly StatusSelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <FormField title={title} as="div">
      <Select
        size="middle"
        value={value}
        options={options.map((option) => ({ value: option.value, label: option.label, disabled: option.disabled }))}
        onChange={onChange}
        className="w-full"
      />
    </FormField>
  );
}

function StatusTextInputField({
  title,
  value,
  onChange,
  inputMode,
  placeholder,
  readOnly,
}: {
  title: string;
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  inputMode?: 'numeric';
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <FormField title={title} as="div">
      <Input
        size="middle"
        value={value}
        onChange={onChange}
        inputMode={inputMode}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </FormField>
  );
}

export function StatusQuotaEvidenceSection({ state }: { state: StatusQuotaEvidenceSectionState }) {
  if (state.items.length === 0 && !state.notice) {
    return null;
  }

  return (
    <section
      className={`${statusPanelClass} grid gap-4 p-4`}
      data-status-quota-evidence-section="true"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className={statusEyebrowClass}>
            QUOTA EVIDENCE
          </div>
          <div className="mt-1 text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]">
            Runtime authority facts
          </div>
        </div>
        <div className={`${statusMutedPanelClass} shrink-0 px-3 py-1 text-right ${statusMetaClass}`}>
          {state.items.length} FACT{state.items.length === 1 ? '' : 'S'}
        </div>
      </div>

      {state.notice ? (
        <div
          className={`${statusMutedPanelClass} grid gap-2 px-4 py-3`}
          data-status-quota-evidence-empty="true"
        >
          <div className={statusEyebrowClass}>
            {state.notice.eyebrow}
          </div>
          <div className={statusTitleClass}>
            {state.notice.title}
          </div>
          <div className="font-mono text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)]">
            {state.notice.description}
          </div>
          {state.notice.unscopedMissingFactCount > 0 ? (
            <div
              className={`${statusInsetPanelClass} grid gap-1 px-3 py-2`}
              data-status-quota-evidence-missing-unscoped="true"
            >
              <div className={statusEyebrowClass}>
                UNSCOPED PAYLOADS MISSING EXPLICIT FACT
              </div>
              <div className={statusValueClass}>
                {state.notice.unscopedMissingFactCount} UNSCOPED PAYLOAD
                {state.notice.unscopedMissingFactCount === 1 ? '' : 'S'} MISSING EXPLICIT FACT
              </div>
              {state.notice.unscopedMissingFactSamples?.length ? (
                <div className="grid gap-2 pt-1" data-status-quota-evidence-unscoped-samples="true">
                  <div className={statusEyebrowClass}>
                    UNSCOPED TRACE SAMPLES
                  </div>
                  <ul className="grid gap-1">
                    {state.notice.unscopedMissingFactSamples.map((label) => (
                      <li
                        key={label}
                        className="break-all font-mono text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-primary)]"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                  <div className={statusMetaClass}>
                    NON-AUTHORITATIVE TRACE
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {state.notice.accountKeys?.length ? (
            <div className={`${statusInsetPanelClass} grid gap-2 px-3 py-2`}>
              <div className={statusEyebrowClass}>
                MISSING EXPLICIT FACT
              </div>
              <ul className="grid gap-1" data-status-quota-evidence-missing-accounts="true">
                {state.notice.accountKeys.map((accountKey) => (
                  <li
                    key={accountKey}
                    className="break-all font-mono text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-primary)]"
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
              className={`${statusInsetPanelClass} grid gap-3 p-3`}
              data-status-quota-evidence-item="true"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className={statusEyebrowClass}>
                    {evidence.title}
                  </div>
                  <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                    {item.accountKey || 'UNSCOPED'}
                  </div>
                </div>
                {item.updatedAt ? (
                  <div className={`${statusMetaClass} shrink-0`}>
                    UPDATED {item.updatedAt}
                  </div>
                ) : null}
              </div>

              <dl className="grid gap-2 md:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div key={label} className={`${statusMutedPanelClass} grid gap-1 px-3 py-2`}>
                    <dt className={statusEyebrowClass}>
                      {label}
                    </dt>
                    <dd className={statusValueClass}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {evidence.view.explanation ? (
                <div className={`${statusMutedPanelClass} grid gap-1 px-3 py-2`}>
                  <div className={statusEyebrowClass}>
                    EXPLANATION
                  </div>
                  <div className="font-mono text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-primary)]">
                    {evidence.view.explanation}
                  </div>
                </div>
              ) : null}

              {evidence.view.evidenceRefs.length > 0 ? (
                <div className={`${statusMutedPanelClass} grid gap-2 px-3 py-2`}>
                  <div className={statusEyebrowClass}>
                    EVIDENCE REFS
                  </div>
                  <ul className="grid gap-1">
                    {evidence.view.evidenceRefs.map((ref) => (
                      <li
                        key={ref}
                        className="break-all font-mono text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-primary)]"
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
  const fieldPairGridClass = 'grid gap-3';
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

  const activeTargetLabel =
    localCliTargetOptions.find((option) => option.id === activeTarget)?.label || t('status.local_cli_tab_codex');
  const activeRelayKey = activeTarget === 'codex' ? selectedRelayKey : selectedClaudeRelayKey;
  const activeRelayKeyLabel = activeRelayKey.trim()
    ? relayKeyDisplayName(activeRelayKey, activeTarget === 'codex' ? selectedKeyIndex : claudeDraft.relayKeyIndex)
    : t('status.local_cli_no_relay_key');
  const activeApplyReady =
    activeTarget === 'codex'
      ? codexLocalApplyState.canApply
      : isReady && Boolean(selectedClaudeRelayKey.trim()) && !isApplyingClaude;
  const activePreflightMessage =
    activeTarget === 'codex'
      ? codexLocalApplyGuidance || t('status.local_cli_preflight_ready')
      : !isReady
        ? t('status.codex_local_apply_blocked_not_ready')
        : !selectedClaudeRelayKey.trim()
          ? t('status.codex_local_apply_blocked_missing_key')
          : t('status.local_cli_preflight_ready');
  const activePlanStateLabel = activeApplyReady
    ? t('status.local_cli_plan_ready')
    : t('status.local_cli_plan_blocked');

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
      <section
        className={[statusPanelClass, 'relative overflow-visible'].join(' ')}
        data-status-local-cli-panel="true"
        data-status-local-cli-target={activeTarget}
      >
        <div className="grid gap-4 border-b border-[var(--gt-border-subtle)] p-4" data-status-local-cli-summary="true">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <div className={statusEyebrowClass}>
                {t('status.local_cli_target_label')}
              </div>
              <div className="mt-1 text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]">
                {activeTargetLabel}
              </div>
              <div className="mt-1 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
                {t('status.local_cli_workbench_hint')}
              </div>
            </div>
            <Segmented
              block
              className="w-full sm:w-56"
              options={localCliTargetOptions.map((option) => ({ label: option.label, value: option.id }))}
              value={activeTarget}
              onChange={(value) => setActiveTarget(value as LocalCliPanelTarget)}
            />
          </div>
          <dl className="grid gap-2 md:grid-cols-3">
            <div className={statusLocalCliSummaryItemClass}>
              <dt className={statusEyebrowClass}>{t('status.local_cli_relay_key')}</dt>
              <dd className="mt-1 truncate font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                {activeRelayKeyLabel}
              </dd>
            </div>
            <div className={statusLocalCliSummaryItemClass}>
              <dt className={statusEyebrowClass}>{t('status.endpoint_title')}</dt>
              <dd className="mt-1 truncate font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                {selectedEndpointBaseUrl}
              </dd>
            </div>
            <div className={statusLocalCliSummaryItemClass}>
              <dt className={statusEyebrowClass}>{t('status.local_cli_plan_state_title')}</dt>
              <dd className="mt-1 font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                {activePlanStateLabel}
              </dd>
            </div>
          </dl>
        </div>
        {activeTarget === 'codex' ? (
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className={statusLocalCliRailClass} data-status-local-cli-config-rail="true">
              <div>
                <div className={statusEyebrowClass}>
                  {t('status.local_cli_config_input_title')}
                </div>
                <div className="mt-1 text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                  {t('status.local_cli_config_codex_title')}
                </div>
              </div>
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
                <StatusActionSelect
                  title={t('status.provider_title')}
                  value={selectedRelayProviderID}
                  options={relayProviderSelectOptions}
                  onSelect={onSelectRelayProviderID}
                  onCreate={onOpenCreateRelayProviderEditor}
                  onDelete={() => onDeleteRelayProviderOption(selectedRelayProviderID)}
                  deleteDisabled={relayProviderOptions.length <= 1}
                />

                <StatusSelectField
                  title={t('status.reasoning_effort_title')}
                  value={selectedRelayReasoningEffort}
                  options={relayReasoningEffortOptions.map((effort) => ({ value: effort, label: effort }))}
                  onChange={onSelectRelayReasoningEffort}
                />
              </div>

              <div className={fieldPairGridClass}>
                <StatusSelectField
                  title={t('status.auth_strategy_title')}
                  value={codexLocalAuthStrategy}
                  options={codexLocalAuthStrategyOptions}
                  onChange={(value) => onSelectCodexLocalAuthStrategy(value as CodexLocalAuthStrategy)}
                />

                <FormField title={t('status.codex_local_auth_state_title')} as="div">
                  <div className={`${statusFieldBoxClass} text-[length:var(--gt-font-size-md-compact)] font-normal text-[var(--gt-ink-primary)]`}>
                    <div>{codexLocalAuthSummary}</div>
                    {localCodexAuthState?.accountEmail ? (
                      <div className="mt-1 font-mono text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)]">
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

                <StatusTextInputField title={t('status.local_cli_wire_api')} value="responses" readOnly />
              </div>

              {selectedRelayProvider.id !== 'openai' ? (
                <div className={statusLocalCliCapabilityRowClass}>
                  <div className="min-w-0">
                    <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                      {t('status.local_cli_capability_websocket_title')}
                    </div>
                    <div className="mt-1 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                      {supportsWebsockets
                        ? t('status.local_cli_capability_websocket_on')
                        : t('status.local_cli_capability_websocket_off')}
                    </div>
                    {localCodexProviderWebsocketRisk ? (
                      <div className="mt-2 text-[length:var(--gt-font-size-xs)] font-normal leading-snug text-[var(--gt-status-danger)]">
                        {supportsWebsockets
                          ? t('status.local_cli_websocket_risk_opt_in')
                          : t('status.local_cli_websocket_risk_detected')}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-end">
                    <Switch
                      checked={supportsWebsockets}
                      disabled={isApplyingToLocal}
                      onChange={onToggleSupportsWebsockets}
                    />
                  </div>
                </div>
              ) : null}

              <div className={statusLocalCliCapabilityRowClass}>
                <div className="min-w-0">
                  <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                    {t('status.local_cli_capability_model_catalog_title')}
                    {isDisablingModelCatalog ? (
                      <span className="ml-2 font-mono text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">
                        {t('status.local_cli_model_catalog_disabling')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                    {syncCodexModelCatalog
                      ? t('status.local_cli_capability_model_catalog_on')
                      : t('status.local_cli_capability_model_catalog_off')}
                  </div>
                  <Button
                    type="link"
                    size="small"
                    aria-label="preview sync_model_catalog"
                    className="!mt-2 !h-auto !p-0 !text-[length:var(--gt-font-size-xs)] !font-semibold"
                    onClick={() => setModelCatalogPreviewOpen(true)}
                  >
                    {t('status.local_cli_model_catalog_preview')}
                  </Button>
                </div>
                <div className="flex justify-end">
                    <Switch
                      checked={syncCodexModelCatalog}
                      disabled={isApplyingToLocal || isDisablingModelCatalog}
                      onChange={onChangeSyncCodexModelCatalog}
                    />
                </div>
              </div>

              {codexLocalAuthStrategy === 'preserve_chatgpt_auth' && codexLocalCanApply ? (
                <div className={statusNoticeClass}>
                  {t('status.codex_local_preserve_hint')}
                  {localCodexAuthState?.warnings?.length ? ` / ${localCodexAuthState.warnings.join(' / ')}` : ''}
                </div>
              ) : null}

              {localApplyMessage ? (
                <div className={statusNoticeClass}>
                  {localApplyMessage}
                </div>
              ) : null}

            </div>

            <div className={statusLocalCliRailClass} data-status-local-cli-plan-rail="true">
              <div>
                <div className={statusEyebrowClass}>
                  {t('status.local_cli_apply_plan_title')}
                </div>
                <div className="mt-1 text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                  {t('status.codex_local_diff')}
                </div>
              </div>
              <div className={statusLocalCliPlanStatusClass} data-status-local-cli-plan-status="true">
                <div className={statusEyebrowClass}>
                  {t('status.local_cli_preflight_title')}
                </div>
                <div className="mt-1 leading-snug">
                  {activePreflightMessage}
                  {activeTarget === 'codex' && localCodexAuthState?.warnings?.length ? ` / ${localCodexAuthState.warnings.join(' / ')}` : ''}
                </div>
                {activeTarget === 'codex' && codexLocalApplyState.recoveryAction ? (
                  <div className="mt-3">
                    {codexLocalApplyState.recoveryAction === 'create_relay_key' ? (
                      <Button type="default" size="small" onClick={onOpenCreateRelayKeyEditor}>
                        {t('status.codex_local_recovery_create_key')}
                      </Button>
                    ) : codexLocalApplyState.recoveryAction === 'switch_auth_to_apikey' ? (
                      <Button
                        type="default"
                        size="small"
                        onClick={() => onSelectCodexLocalAuthStrategy('replace_auth_with_apikey')}
                      >
                        {t('status.codex_local_recovery_use_apikey')}
                      </Button>
                    ) : codexLocalApplyState.recoveryAction === 'switch_to_custom_provider' && codexLocalApplyState.nextProviderID ? (
                      <Button
                        type="default"
                        size="small"
                        onClick={() => onSelectRelayProviderID(codexLocalApplyState.nextProviderID || '')}
                      >
                        {t('status.codex_local_recovery_switch_provider')} {codexLocalRecoveryProvider?.name || codexLocalApplyState.nextProviderID}
                      </Button>
                    ) : codexLocalApplyState.recoveryAction === 'create_provider' ? (
                      <Button type="default" size="small" onClick={onOpenCreateRelayProviderEditor}>
                        {t('status.codex_local_recovery_create_provider')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <StatusSnippetPanel
                title={t('status.codex_local_diff')}
                content={codexDiff}
                onCopy={() => onCopyText(codexDiff, t('status.codex_local_diff_copied'))}
                copyLabel={t('common.copy')}
                headerAction={
                  <Button
                    type="primary"
                    size="small"
                    onClick={onApplyRelayConfigToLocal}
                    disabled={!codexLocalApplyState.canApply}
                  >
                    {isApplyingToLocal ? t('status.applying_local') : t('status.apply_local_codex')}
                  </Button>
                }
                preClassName="max-h-[32rem]"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className={statusLocalCliRailClass} data-status-local-cli-config-rail="true">
              <div>
                <div className={statusEyebrowClass}>
                  {t('status.local_cli_config_input_title')}
                </div>
                <div className="mt-1 text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                  {t('status.local_cli_config_claude_title')}
                </div>
              </div>
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
                <StatusTextInputField
                  title={t('status.claude_max_output_tokens')}
                  value={claudeDraft.maxOutputTokens}
                  onChange={(event) => updateClaudeDraft({ maxOutputTokens: event.target.value })}
                  inputMode="numeric"
                  placeholder="6000"
                />
                <StatusTextInputField
                  title={t('status.claude_api_timeout_ms')}
                  value={claudeDraft.apiTimeoutMs}
                  onChange={(event) => updateClaudeDraft({ apiTimeoutMs: event.target.value })}
                  inputMode="numeric"
                  placeholder="600000"
                />
              </div>

              <div className={fieldPairGridClass}>
                <div className={statusToggleRowClass}>
                  <span className="text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]">
                    {t('status.claude_disable_nonessential_traffic')}
                  </span>
                  <Switch
                    checked={claudeDraft.disableNonEssentialTraffic}
                    disabled={isApplyingClaude}
                    onChange={(checked) => updateClaudeDraft({ disableNonEssentialTraffic: checked })}
                  />
                </div>
                <div className={statusToggleRowClass}>
                  <span className="text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]">
                    {t('status.claude_code_attribution_header')}
                  </span>
                  <Switch
                    checked={claudeDraft.claudeCodeAttributionHeader}
                    disabled={isApplyingClaude}
                    onChange={(checked) => updateClaudeDraft({ claudeCodeAttributionHeader: checked })}
                  />
                </div>
              </div>

              {claudeApplyMessage ? (
                <div className={statusNoticeClass}>
                  {claudeApplyMessage}
                </div>
              ) : null}

            </div>

            <div className={statusLocalCliRailClass} data-status-local-cli-plan-rail="true">
              <div>
                <div className={statusEyebrowClass}>
                  {t('status.local_cli_apply_plan_title')}
                </div>
                <div className="mt-1 text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                  {t('status.claude_settings_diff')}
                </div>
              </div>
              <div className={statusLocalCliPlanStatusClass} data-status-local-cli-plan-status="true">
                <div className={statusEyebrowClass}>
                  {t('status.local_cli_preflight_title')}
                </div>
                <div className="mt-1 leading-snug">
                  {activePreflightMessage}
                </div>
              </div>
              <StatusSnippetPanel
                title={t('status.claude_settings_diff')}
                content={claudeDiff}
                onCopy={() => onCopyText(claudeDiff, t('status.claude_settings_diff_copied'))}
                copyLabel={t('common.copy')}
                headerAction={
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => onApplyClaude({ ...claudeDraft, baseUrl: selectedEndpointBaseUrl })}
                    disabled={isApplyingClaude || !isReady || !selectedClaudeRelayKey.trim()}
                  >
                    {isApplyingClaude ? t('status.applying_local') : t('status.apply_local_claude')}
                  </Button>
                }
                preClassName="max-h-[32rem]"
              />
            </div>
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
                <div className={statusEyebrowClass}>
                  CODEX MODEL CATALOG
                </div>
                <h3 className="mt-1 text-sm font-semibold text-[var(--gt-ink-primary)]">
                  Codex /model 模型目录预览
                </h3>
              </div>
              <Button type="default" size="small" onClick={() => setModelCatalogPreviewOpen(false)}>
                关闭
              </Button>
            </div>
          }
          bodyClassName="bg-[var(--gt-surface-canvas)]"
        >
          <table className="w-max min-w-full border-collapse">
            <thead className="border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                  /model slug
                </th>
                <th scope="col" className="px-4 py-2 text-left font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                  real model
                </th>
                <th scope="col" className="px-4 py-2 text-left font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                  reasoning
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--gt-border-subtle)]">
              {modelCatalogPreviewModels.map((model) => (
                <tr key={model.slug}>
                  <td className="px-4 py-3 align-top">
                    <div className="whitespace-nowrap font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                      {model.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="whitespace-nowrap font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                      {model.name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className={statusMetaClass}>
                      {model.reasoning}
                    </div>
                  </td>
                </tr>
              ))}
              {modelCatalogPreviewModels.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center font-mono text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
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
  relayKeyOptions: StatusSelectOption[];
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
    <StatusActionSelect
      title={t('status.local_cli_relay_key')}
      value={String(selectedIndex)}
      options={relayKeyOptions}
      onSelect={(nextValue) => onSelect(Number(nextValue))}
      onCreate={onCreate}
      onCopy={onCopySelectedRelayKey}
      copyLabel={t('common.copy')}
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
        <Button
          type="default"
          size="small"
          onClick={onToggleLANAccess}
        >
          {isLANAccessEnabled ? t('status.lan_access_on') : t('status.lan_access_off')}
        </Button>
      </div>
      <Segmented
        size="small"
        value={selectedEndpointID}
        options={visibleRelayEndpoints.map((endpoint) => ({
          value: endpoint.id,
          label:
            endpoint.kind === 'localhost'
              ? t('status.endpoint_localhost')
              : endpoint.kind === 'hostname'
                ? t('status.endpoint_hostname')
                : t('status.endpoint_lan'),
        }))}
        onChange={(value) => onSelectEndpointID(String(value))}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border border-dashed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2">
        <span className="truncate font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
          {selectedEndpointBaseUrl}
        </span>
        <Button type="default" size="small" onClick={onCopyEndpointBaseUrl}>
          {t('common.copy')}
        </Button>
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
    <StatusActionSelect
      title={title || t('status.model_name_title')}
      value={value}
      options={selectOptions.map((model) => ({ value: model, label: model }))}
      onSelect={onSelect}
      onCreate={onCreate}
    />
  );
}

export { default as StatusSnippetPanel } from './StatusSnippetPanel';
