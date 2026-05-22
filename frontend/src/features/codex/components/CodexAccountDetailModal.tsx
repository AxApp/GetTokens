import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AccountDetailModalFrame from '../../accounts/components/AccountDetailModalFrame';
import { AccountRuntimeSnapshotSection } from '../../accounts/components/AccountDetailSections';
import {
  AccountDetailBody,
  AccountDetailEvidenceGrid,
  AccountDetailEmptyState,
  AccountDetailModuleStack,
  AccountDetailNotice,
  AccountDetailOverviewGrid,
  AccountDetailPill,
  AccountDetailSection,
} from '../../accounts/components/AccountDetailPrimitives';
import { buildQuotaDisplay, extractBilling } from '../../accounts/model/accountQuota';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { CodexQuotaState } from '../../accounts/model/types';
import { toErrorMessage } from '../../../utils/error';
import { ModelCombobox } from './ModelCombobox';
import { buildEndpointLabel, sourceKindLabel } from './codexAccountPresentation';
import {
  buildCodexQuotaSummaryAccount,
  buildCodexModelAliasOptionNames,
  buildCodexModelOptionNames,
  type CodexAccountRow,
  type CodexModelMappingRow,
} from '../model/codexAccountList';

export function CodexAccountDetailModal({
  row,
  t,
  quotaState,
  usageSummary,
  savingMappings,
  loadingModelMappings,
  modelMappingError,
  modelOptions,
  codexModelOptions,
  loadingModelOptions,
  modelOptionError,
  onClose,
  onSaveModelMappings,
}: {
  row: CodexAccountRow;
  t: (key: string) => string;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  savingMappings: boolean;
  loadingModelMappings: boolean;
  modelMappingError: string;
  modelOptions: CodexModelMappingRow[];
  codexModelOptions: CodexModelMappingRow[];
  loadingModelOptions: boolean;
  modelOptionError: string;
  onClose: () => void;
  onSaveModelMappings: (mappings: CodexModelMappingRow[]) => Promise<void>;
}) {
  const endpointLabel = buildEndpointLabel(row);
  const blockedLabel = row.blockReason === 'disabled' ? t('codex.account_list_block_disabled') : row.blockReason;
  const [mappingDraft, setMappingDraft] = useState<CodexModelMappingRow[]>(() => buildEditableModelMappings(row));
  const [mappingError, setMappingError] = useState('');
  const editableModelMappings = row.sourceKind === 'openai-compatible' || row.sourceKind === 'codex-auth-file';
  const showModelMappings = editableModelMappings;
  const displayedModelMappings = editableModelMappings ? mappingDraft : row.modelMappings;
  const modelOptionNames = buildCodexModelOptionNames(modelOptions);
  const codexModelOptionNames = buildCodexModelAliasOptionNames([
    ...codexModelOptions,
    ...modelOptions,
    ...mappingDraft,
  ]);
  const quotaDisplay = useMemo(
    () => buildQuotaDisplay(buildCodexQuotaSummaryAccount(row), quotaState),
    [quotaState, row],
  );
  const billing = useMemo(
    () => (quotaState?.quota ? extractBilling(quotaState.quota) : undefined),
    [quotaState],
  );
  const modelSectionTitle = t('codex.account_list_model_mapping');
  const evidenceRows: Array<{ label: string; value: string; title?: string }> = [
    ['Asset', row.id],
    [t('common.type'), sourceKindLabel(t, row.sourceKind)],
    [t('common.status'), row.status || '—'],
    [t('codex.account_list_route'), endpointLabel || '—'],
    [t('codex.account_list_priority'), row.priority === undefined ? '—' : String(row.priority)],
    [
      t('codex.account_list_request_state'),
      row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked'),
    ],
    [t('common.enable'), row.disabled ? t('common.no') : t('common.yes')],
  ].map(([label, value]) => ({ label, value, title: value }));

  useEffect(() => {
    setMappingDraft(buildEditableModelMappings(row));
    setMappingError('');
  }, [row.id, row.modelMappings]);

  function updateMappingDraft(index: number, patch: Partial<CodexModelMappingRow>) {
    setMappingDraft((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addMappingDraft() {
    setMappingDraft((prev) => [...prev, { realModel: '', codexModel: '' }]);
  }

  function removeMappingDraft(index: number) {
    setMappingDraft((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 || row.sourceKind === 'codex-auth-file' ? next : [{ realModel: '', codexModel: '' }];
    });
  }

  async function saveMappingDraft() {
    try {
      setMappingError('');
      await onSaveModelMappings(mappingDraft);
    } catch (error) {
      setMappingError(toErrorMessage(error));
    }
  }

  return (
    <AccountDetailModalFrame
      onClose={onClose}
      header={
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('codex.account_list_detail_title')}
            </div>
            <h3 className="truncate text-lg font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {row.label}
            </h3>
            <div className="flex flex-wrap gap-2">
              <AccountDetailPill>
                {sourceKindLabel(t, row.sourceKind)}
              </AccountDetailPill>
              <AccountDetailPill tone={row.requestable ? 'success' : 'danger'}>
                {row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked')}
              </AccountDetailPill>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]" aria-label={t('common.close')}>
            <X className="h-4 w-4" strokeWidth={4} />
          </button>
        </div>
      }
      footer={
        editableModelMappings ? (
          <>
            <div className="min-w-0 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] sm:max-w-[70%]">
              {mappingError || modelMappingError || modelOptionError || (loadingModelOptions ? t('accounts.openai_provider_models_fetch_running') : modelSectionTitle)}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveMappingDraft()}
                disabled={savingMappings}
                className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] disabled:cursor-wait disabled:opacity-50"
              >
                {savingMappings ? t('codex.account_list_saving') : t('common.save')}
              </button>
              <button type="button" onClick={onClose} className="btn-swiss">
                {t('common.cancel')}
              </button>
            </div>
          </>
        ) : undefined
      }
    >
      <AccountDetailBody data-collaboration-id="MODAL_CODEX_ACCOUNT_DETAIL">
        {!row.requestable ? (
          <AccountDetailNotice tone="danger">
            {blockedLabel}
          </AccountDetailNotice>
        ) : null}

        <AccountDetailOverviewGrid
          runtime={
            <AccountRuntimeSnapshotSection
              usageSummary={usageSummary}
              quotaDisplay={quotaDisplay}
              billing={billing}
            />
          }
          evidence={<CodexAccountEvidenceSection rows={evidenceRows} />}
        />

        <AccountDetailModuleStack layout="cards">
          <AccountDetailSection
            componentName="CodexModelRoutingSection"
            eyebrow="Model Routing"
            title={modelSectionTitle}
            meta={showModelMappings ? String(displayedModelMappings.length) : undefined}
            span="wide"
            actions={editableModelMappings ? (
              <button
                type="button"
                onClick={addMappingDraft}
                className="btn-swiss inline-flex items-center gap-2 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={4} />
                {t('accounts.openai_provider_add_model')}
              </button>
            ) : undefined}
          >
          {showModelMappings ? (
            loadingModelMappings ? (
              <AccountDetailEmptyState>
                {t('accounts.ui_loading_short')}
              </AccountDetailEmptyState>
            ) : displayedModelMappings.length > 0 ? (
              <div className="border-2 border-[var(--border-color)]">
                <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span>{t('codex.account_list_real_model')}</span>
                  <span className="text-center">-&gt;</span>
                  <span className="text-right">{t('codex.account_list_codex_model')}</span>
                  <span />
                </div>
                <div className="divide-y divide-[var(--border-color)]">
                  {displayedModelMappings.map((mapping, index) => (
                    <div
                      key={`mapping-${index}`}
                      className="grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 px-3 py-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-primary)]"
                    >
                      {editableModelMappings ? (
                        <ModelCombobox
                          value={mapping.realModel}
                          options={modelOptionNames}
                          onChange={(value) => updateMappingDraft(index, { realModel: value })}
                          placeholder={modelOptionNames[0] || 'deepseek-chat'}
                        />
                      ) : (
                        <span className="min-w-0 break-all font-mono text-[length:var(--font-size-ui-md-compact)] font-black text-[var(--text-primary)]">
                          {mapping.realModel}
                        </span>
                      )}
                      <span className="text-center font-black text-[var(--text-muted)]">-&gt;</span>
                      {editableModelMappings ? (
                        <ModelCombobox
                          value={mapping.codexModel}
                          options={codexModelOptionNames}
                          onChange={(value) => updateMappingDraft(index, { codexModel: value })}
                          placeholder={codexModelOptionNames[0] || mapping.realModel || 'codex-deepseek'}
                          align="right"
                        />
                      ) : (
                        <span className="min-w-0 break-all text-right font-mono text-[length:var(--font-size-ui-md-compact)] font-black text-[var(--text-primary)]">
                          {mapping.codexModel}
                        </span>
                      )}
                      {editableModelMappings ? (
                        <button
                          type="button"
                          onClick={() => removeMappingDraft(index)}
                          className="btn-swiss !p-1.5 !shadow-none hover:bg-[var(--bg-surface)]"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={3} />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <AccountDetailEmptyState>
                {row.sourceKind === 'codex-auth-file'
                  ? t('codex.account_list_oauth_passthrough_mapping')
                  : editableModelMappings
                    ? t('codex.account_list_no_model_mapping')
                    : t('codex.account_list_default_model_mapping')}
              </AccountDetailEmptyState>
            )
          ) : (
            <AccountDetailEmptyState>
              {t('codex.account_list_default_model_mapping')}
            </AccountDetailEmptyState>
          )}

          {modelMappingError ? (
            <div className="border-l-2 border-[var(--accent-red)] pl-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--accent-red)]">
              {modelMappingError}
            </div>
          ) : null}

          {editableModelMappings && (loadingModelOptions || modelOptionError) ? (
            <div
              className={`border-l-2 pl-3 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide ${
                modelOptionError
                  ? 'border-[var(--accent-red)] text-[var(--accent-red)]'
                  : 'border-[var(--border-color)] text-[var(--text-muted)]'
              }`}
            >
              {modelOptionError || t('accounts.openai_provider_models_fetch_running')}
            </div>
          ) : null}

          {editableModelMappings && mappingError ? (
            <div className="border-l-2 border-[var(--accent-red)] pl-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--accent-red)]">
              {mappingError}
            </div>
          ) : null}
          </AccountDetailSection>
        </AccountDetailModuleStack>
      </AccountDetailBody>
    </AccountDetailModalFrame>
  );
}

function CodexAccountEvidenceSection({
  rows,
}: {
  rows: Array<{ label: string; value: string; title?: string }>;
}) {
  return (
    <AccountDetailSection componentName="CodexAccountEvidenceSection" density="dense" muted eyebrow="Audit" title="EVIDENCE">
      <AccountDetailEvidenceGrid rows={rows} />
    </AccountDetailSection>
  );
}

function buildEditableModelMappings(row: Pick<CodexAccountRow, 'sourceKind' | 'modelMappings'>): CodexModelMappingRow[] {
  if (row.sourceKind !== 'openai-compatible' && row.sourceKind !== 'codex-auth-file') {
    return [];
  }
  if (row.sourceKind === 'codex-auth-file' && row.modelMappings.length === 0) {
    return [];
  }
  return row.modelMappings.length > 0
    ? row.modelMappings.map((mapping) => ({ ...mapping }))
    : [{ realModel: '', codexModel: '' }];
}
