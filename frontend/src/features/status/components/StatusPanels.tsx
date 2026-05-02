import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { main } from '../../../../wailsjs/go/models';
import ActionSelect, { type ActionSelectOption } from '../../../components/ui/ActionSelect';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import { RelayModelEditorModal } from './RelayEditors';
import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
  CodexFeatureStageFilter,
} from '../model/codexFeatureConfig';
import {
  buildClaudeCodeSettingsDiff,
  buildCodexLocalApplyDiff,
  resolveUnifiedDiffLineTone,
  type ClaudeCodeLocalApplyDraft,
  type RelayModelEditorState,
} from '../model/relayLocalState';
import type { RelayResolvedModelOption } from '../model/relayModelCatalog';
import { sortRelayModelCatalogByNameDesc } from '../model/relayModelCatalog';
import type { RelayProviderOption } from '../model/relayProviderCatalog';

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
  onDeleteRelayProviderOption: (id: string) => void;
  onSelectRelayReasoningEffort: (value: string) => void;
  onCommitRelayModelSelection: (value: string) => void;
  onCopyText: (value: string, successMessage?: string) => void;
  relayKeyDisplayName: (value: string, index: number) => string;
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
  onDeleteRelayProviderOption,
  onSelectRelayReasoningEffort,
  onCommitRelayModelSelection,
  onCopyText,
  relayKeyDisplayName,
}: StatusApplyLocalSectionProps) {
  type LocalCliPanelTarget = 'codex' | 'claude';

  const [activeTarget, setActiveTarget] = useState<LocalCliPanelTarget>('codex');
  const [modelEditorTarget, setModelEditorTarget] = useState<LocalCliPanelTarget | null>(null);
  const [modelEditor, setModelEditor] = useState<RelayModelEditorState | null>(null);
  const [claudeDraft, setClaudeDraft] = useState<ClaudeCodeLocalApplyDraft>(() => ({
    relayKeyIndex: selectedKeyIndex,
    baseUrl: selectedEndpointBaseUrl,
    model: selectedRelayModel.startsWith('claude') ? selectedRelayModel : 'claude-sonnet-4-5',
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
      }),
    [
      selectedEndpointBaseUrl,
      selectedRelayKey,
      selectedRelayModel,
      selectedRelayProvider.id,
      selectedRelayProvider.name,
      selectedRelayReasoningEffort,
    ]
  );
  const claudeDiff = useMemo(
    () =>
      buildClaudeCodeSettingsDiff({
        apiKey: selectedClaudeRelayKey,
        baseUrl: selectedEndpointBaseUrl,
        model: claudeDraft.model,
        authField: claudeDraft.authField,
      }),
    [claudeDraft.authField, claudeDraft.model, selectedEndpointBaseUrl, selectedClaudeRelayKey]
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
  const claudeModelOptions = Array.from(
    new Set([
      claudeDraft.model || 'claude-sonnet-4-5',
      'claude-sonnet-4-5',
      'claude-opus-4-5',
      'claude-haiku-4-5',
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

  function openModelEditor(target: LocalCliPanelTarget, value: string) {
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

    if (modelEditorTarget === 'codex') {
      onCommitRelayModelSelection(nextModel);
    } else {
      updateClaudeDraft({ model: nextModel });
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

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                <StatusModelPicker
                  t={t}
                  value={selectedRelayModel}
                  options={relayModelSelectOptionNames}
                  onSelect={onCommitRelayModelSelection}
                  onCreate={() => openModelEditor('codex', selectedRelayModel)}
                />

                <label className="grid gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('status.local_cli_wire_api')}
                  </span>
                  <input value="responses" readOnly className="input-swiss w-full" />
                </label>
              </div>

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
                  disabled={isApplyingToLocal || !isReady || !selectedRelayKey.trim()}
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
                  value={claudeDraft.model || claudeModelOptions[0]}
                  options={claudeModelOptions}
                  onSelect={(value) => updateClaudeDraft({ model: value })}
                  onCreate={() => openModelEditor('claude', claudeDraft.model || claudeModelOptions[0])}
                />
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
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  onCreate: () => void;
}

function StatusModelPicker({
  t,
  value,
  options,
  onSelect,
  onCreate,
}: StatusModelPickerProps) {
  const selectOptions = options.includes(value) ? options : [value, ...options].filter(Boolean);

  return (
    <ActionSelect
      title={t('status.model_name_title')}
      value={value}
      options={selectOptions.map((model) => ({ value: model, label: model }))}
      onSelect={onSelect}
      onCreate={onCreate}
    />
  );
}

const codexFeatureStageFilters: CodexFeatureStageFilter[] = [
  'all',
  'recommended',
  'stable',
  'experimental',
  'advanced',
  'compat',
  'unknown',
  'unsupported',
];

function resolveCodexFeatureDescription(t: (key: string) => string, row: CodexFeatureRow) {
  const translationKey = `status.codex_feature_descriptions.${row.key}`;
  const translated = t(translationKey);
  if (translated !== translationKey) {
    return translated;
  }
  return row.description || t('status.codex_features_no_description');
}

interface StatusCodexFeaturesSectionProps {
  t: (key: string) => string;
  snapshot: CodexFeatureConfigSnapshot | null;
  rows: CodexFeatureRow[];
  preview: CodexFeaturePreview | null;
  message: string;
  query: string;
  stageFilter: CodexFeatureStageFilter;
  dirtyCount: number;
  isLoading: boolean;
  isSaving: boolean;
  onReload: () => void;
  onChangeQuery: (value: string) => void;
  onChangeStageFilter: (value: CodexFeatureStageFilter) => void;
  onToggleFeature: (key: string, value: boolean) => void;
  onPreview: () => void;
  onSave: () => void;
  onReset: () => void;
}

export function StatusCodexFeaturesSection({
  t,
  snapshot,
  rows,
  preview,
  message,
  query,
  stageFilter,
  dirtyCount,
  isLoading,
  isSaving,
  onReload,
  onChangeQuery,
  onChangeStageFilter,
  onToggleFeature,
  onPreview,
  onSave,
  onReset,
}: StatusCodexFeaturesSectionProps) {
  const visibleCount = rows.length;
  const totalCount = snapshot?.items.length || 0;
  const isBusy = isLoading || isSaving;

  return (
    <section className="relative overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div className="grid gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="text-[0.625rem] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
            {t('status.codex_features_title')}
          </div>
          <div className="mt-1 break-all font-mono text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
            {snapshot?.configPath || t('status.codex_features_unavailable')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {visibleCount}/{totalCount} {t('status.codex_features_visible')}
          </div>
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {dirtyCount} {t('status.codex_features_changed')}
          </div>
          <button
            type="button"
            onClick={onReload}
            disabled={isBusy}
            className="btn-swiss !px-3 !py-1 !text-[0.5625rem] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? t('status.codex_features_loading') : t('common.refresh')}
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b-2 border-[var(--border-color)] p-4">
        <div className="flex flex-wrap gap-2">
          {codexFeatureStageFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onChangeStageFilter(filter)}
              className={`border-2 px-2.5 py-1.5 text-[0.5625rem] font-black uppercase tracking-[0.18em] ${
                stageFilter === filter
                  ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              {t(`status.codex_features_filter_${filter}`)}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
          className="input-swiss w-full"
          placeholder={t('status.codex_features_search_placeholder')}
        />
      </div>

      {message ? (
        <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
          {message}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <thead>
            <tr className="bg-[var(--bg-main)]">
              <th className="border-b-2 border-[var(--border-color)] px-4 py-2 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('status.codex_features_key')}
              </th>
              <th className="w-32 border-b-2 border-l-2 border-[var(--border-color)] px-3 py-2 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('status.codex_features_stage')}
              </th>
              <th className="w-36 border-b-2 border-l-2 border-[var(--border-color)] px-3 py-2 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('status.codex_features_switch')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`${row.stage === 'unknown' || row.stage === 'unsupported' ? 'bg-[var(--bg-main)]' : ''}`}
              >
                <td className="border-b-2 border-[var(--border-color)] px-4 py-3 align-top">
                  <div className="break-all font-mono text-[0.75rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                    {row.key}
                  </div>
                  <div className="mt-1 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {resolveCodexFeatureDescription(t, row)}
                  </div>
                  {row.legacyAliases.length > 0 ? (
                    <div className="mt-2 inline-flex max-w-full border-2 border-dashed border-[var(--border-color)] px-2 py-1 text-[0.5625rem] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                      <span className="truncate">
                        {t('status.codex_features_legacy_alias')}: {row.legacyAliases.join(', ')}
                      </span>
                    </div>
                  ) : null}
                  {row.unsupported ? (
                    <div className="mt-2 text-[0.5625rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {t('status.codex_features_unsupported_hint')}
                    </div>
                  ) : null}
                </td>
                <td className="border-b-2 border-l-2 border-[var(--border-color)] px-3 py-3 align-top">
                  <span
                    className={`inline-flex border-2 px-2 py-1 text-[0.5625rem] font-black uppercase tracking-[0.16em] ${
                      row.stage === 'unknown' || row.stage === 'unsupported' || row.stage === 'removed'
                        ? 'border-[var(--border-color)] bg-[var(--bg-surface)] text-red-600'
                        : 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                    }`}
                  >
                    {t(`status.codex_features_stage_${row.stage}`)}
                  </span>
                  {row.hiddenByDefault ? (
                    <div className="mt-2 text-[0.5625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
                      {t('status.codex_features_hidden_default')}
                    </div>
                  ) : null}
                </td>
                <td className="w-24 border-b-2 border-l-2 border-[var(--border-color)] px-3 py-3 text-center align-middle">
                  <button
                    type="button"
                    role="switch"
                    aria-label={row.key}
                    aria-checked={row.draftValue}
                    onClick={() => onToggleFeature(row.key, !row.draftValue)}
                    disabled={row.readOnly || isBusy}
                    className="mx-auto flex h-9 w-16 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      className={`relative h-7 w-14 shrink-0 overflow-hidden border-2 border-[var(--border-color)] transition-colors duration-200 ease-out ${
                        row.draftValue ? 'bg-green-600' : 'bg-[var(--bg-surface)]'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 border-2 border-[var(--border-color)] transition-transform duration-200 ease-out ${
                          row.draftValue ? 'translate-x-7 bg-[var(--bg-main)]' : 'translate-x-0 bg-[var(--text-primary)]'
                        }`}
                      ></span>
                    </span>
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="border-b-2 border-[var(--border-color)] px-4 py-8 text-center text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]"
                >
                  {isLoading ? t('status.codex_features_loading') : t('status.codex_features_empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {preview ? (
        <div className="border-t-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <div className="text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {t('status.codex_features_preview_title')}: {preview.summary}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {preview.changes.map((change) => (
              <div
                key={`${change.key}-${change.kind}`}
                className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]"
              >
                <span className="font-mono">{change.key}</span>
                <span className="text-[var(--text-muted)]"> / {change.kind} / </span>
                <span>{String(change.before ?? '-')} -&gt; {String(change.after)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3">
        <div className="text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
          {t('status.codex_features_save_hint')}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={isBusy || !snapshot}
            className="btn-swiss !px-3 !py-1.5 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('status.codex_features_reset')}
          </button>
          <button
            type="button"
            onClick={onPreview}
            disabled={isBusy || dirtyCount === 0}
            className="btn-swiss !px-3 !py-1.5 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('status.codex_features_preview')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isBusy || dirtyCount === 0}
            className="btn-swiss bg-[var(--border-color)] !px-3 !py-1.5 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? t('status.codex_features_saving') : t('common.save')}
          </button>
        </div>
      </div>
    </section>
  );
}

interface StatusSnippetPanelProps {
  title: string;
  content: string;
  onCopy?: () => void;
  headerAction?: ReactNode;
  preClassName?: string;
}

export function StatusSnippetPanel({
  title,
  content,
  onCopy,
  headerAction,
  preClassName = '',
}: StatusSnippetPanelProps) {
  const lines = content.split('\n');

  function lineClassName(line: string) {
    const tone = resolveUnifiedDiffLineTone(line);
    switch (tone) {
      case 'add':
        return 'border-l-4 border-green-600 bg-green-600/10 pl-2 text-green-700';
      case 'remove':
        return 'border-l-4 border-red-600 bg-red-600/10 pl-2 text-red-700';
      case 'hunk':
        return 'text-[var(--text-muted)]';
      case 'file':
        return 'font-black text-[var(--text-primary)]';
      case 'meta':
        return 'text-[var(--text-muted)]';
      default:
        return 'text-[var(--text-primary)]';
    }
  }

  return (
    <div className="overflow-hidden border-2 border-[var(--border-color)]">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-2">
        <div className="font-mono text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-primary)]">
          {title}
        </div>
        {onCopy || headerAction ? (
          <div className="flex items-center gap-2">
            {onCopy ? (
              <button onClick={onCopy} className="btn-swiss !px-3 !py-1 !text-[0.5625rem]">
                复制
              </button>
            ) : null}
            {headerAction}
          </div>
        ) : null}
      </div>
      <pre className={`overflow-x-auto bg-[var(--bg-surface)] p-4 text-xs font-bold leading-6 ${preClassName}`}>
        {lines.map((line, index) => (
          <code key={`${index}-${line}`} className={`block min-h-6 whitespace-pre ${lineClassName(line)}`}>
            {line || ' '}
          </code>
        ))}
      </pre>
    </div>
  );
}
