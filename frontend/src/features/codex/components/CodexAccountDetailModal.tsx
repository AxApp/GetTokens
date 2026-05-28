import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import AccountDetailModalFrame from '../../accounts/components/AccountDetailModalFrame';
import {
  AccountBillingSection,
  AccountCredentialVerifySection,
  AccountQuotaSection,
  type APIKeyVerifyState,
} from '../../accounts/components/AccountDetailSections';
import {
  AccountDetailBody,
  AccountDetailEmptyState,
  AccountDetailModuleStack,
  AccountDetailNotice,
  AccountDetailPill,
  AccountDetailSection,
} from '../../accounts/components/AccountDetailPrimitives';
import AccountProxyRouteSection from '../../accounts/components/AccountProxyRouteSection';
import RateLimitRulesSection, { type RateLimitRulesAPI, type RateLimitRulesSectionHandle } from '../../accounts/components/RateLimitRulesSection';
import {
  buildApiKeyConfigDraft,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
  type ApiKeyConfigDraft,
} from '../../accounts/model/accountDetailConfig';
import { buildQuotaDisplay, extractBilling } from '../../accounts/model/accountQuota';
import type { AccountUsageSummary } from '../../accounts/model/accountUsage';
import type { RateLimitState, RateLimitStrategyMeta } from '../../accounts/model/rateLimit';
import type { CodexQuotaState } from '../../accounts/model/types';
import { toErrorMessage } from '../../../utils/error';
import { ModelCombobox } from './ModelCombobox';
import { buildEndpointLabel } from './codexAccountPresentation';
import {
  buildCodexAccountDetailModulePlan,
  buildCodexQuotaSummaryAccount,
  buildCodexModelAliasOptionNames,
  buildCodexModelOptionNames,
  canEditCodexModelMappings,
  type CodexAccountRow,
  type CodexModelMappingRow,
} from '../model/codexAccountList';
import { sourceKindLabel } from './codexAccountPresentation';

export function CodexAccountDetailHeader({
  row,
  t,
  onClose,
}: {
  row: CodexAccountRow;
  t: (key: string) => string;
  onClose: () => void;
}) {
  const endpointLabel = buildEndpointLabel(row);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[length:var(--font-size-ui-2xs)] font-mono uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <span>{sourceKindLabel(t, row.sourceKind)}</span>
          <span>·</span>
          <span className="break-all">{row.id}</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h3 className="truncate text-lg font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
            {row.label}
          </h3>
          <AccountDetailPill tone={row.requestable ? 'success' : 'danger'}>
            {row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked')}
          </AccountDetailPill>
        </div>

        <dl
          data-codex-account-detail-header="summary"
          className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-5"
        >
          <AccountDetailHeaderMeta label={t('common.type')} value={sourceKindLabel(t, row.sourceKind)} />
          <AccountDetailHeaderMeta label={t('common.status')} value={row.status || '—'} />
          <AccountDetailHeaderMeta label={t('codex.account_list_route')} value={endpointLabel || '—'} />
          <AccountDetailHeaderMeta
            label={t('codex.account_list_priority')}
            value={row.priority === undefined ? '—' : `#${row.priority}`}
          />
          <AccountDetailHeaderMeta
            label={t('common.enable')}
            value={row.disabled ? t('common.no') : t('common.yes')}
          />
        </dl>
      </div>

      <button type="button" onClick={onClose} className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]" aria-label={t('common.close')}>
        <X className="h-4 w-4" strokeWidth={4} />
      </button>
    </div>
  );
}

function AccountDetailHeaderMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
      <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 break-words font-mono text-[length:var(--font-size-ui-xs)] font-bold leading-snug text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

export function CodexAccountDetailModal({
  row,
  t,
  quotaState,
  usageSummary,
  rateLimitStatus,
  rateLimitStrategies,
  rateLimitRulesAPI,
  verifyState,
  savingMappings,
  loadingModelMappings,
  modelMappingError,
  modelOptions,
  codexModelOptions,
  loadingModelOptions,
  modelOptionError,
  onClose,
  onSaveConfig,
  onRateLimitRulesChanged,
  onSaveModelMappings,
}: {
  row: CodexAccountRow;
  t: (key: string) => string;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  verifyState?: APIKeyVerifyState;
  savingMappings: boolean;
  loadingModelMappings: boolean;
  modelMappingError: string;
  modelOptions: CodexModelMappingRow[];
  codexModelOptions: CodexModelMappingRow[];
  loadingModelOptions: boolean;
  modelOptionError: string;
  onClose: () => void;
  onSaveConfig?: (draft: ApiKeyConfigDraft, mappings: CodexModelMappingRow[]) => Promise<void>;
  onRateLimitRulesChanged?: () => void;
  onSaveModelMappings: (mappings: CodexModelMappingRow[]) => Promise<void>;
}) {
  const account = useMemo(() => buildCodexQuotaSummaryAccount(row), [row]);
  const blockedLabel = row.blockReason === 'disabled' ? t('codex.account_list_block_disabled') : row.blockReason;
  const modulePlan = useMemo(() => buildCodexAccountDetailModulePlan(row), [row]);
  const isApiLikeAccount = row.sourceKind !== 'codex-auth-file';
  const [configDraft, setConfigDraft] = useState<ApiKeyConfigDraft>(() => buildApiKeyConfigDraft(account));
  const [mappingDraft, setMappingDraft] = useState<CodexModelMappingRow[]>(() => buildEditableModelMappings(row));
  const [mappingError, setMappingError] = useState('');
  const [proxyRouteError, setProxyRouteError] = useState('');
  const [rateLimitDirty, setRateLimitDirty] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const rateLimitRulesRef = useRef<RateLimitRulesSectionHandle>(null);
  const editableModelMappings = canEditCodexModelMappings(row.sourceKind);
  const showModelMappings = editableModelMappings;
  const displayedModelMappings = editableModelMappings ? mappingDraft : row.modelMappings;
  const modelOptionNames = buildCodexModelOptionNames(modelOptions);
  const codexModelOptionNames = buildCodexModelAliasOptionNames([
    ...codexModelOptions,
    ...modelOptions,
    ...mappingDraft,
  ]);
  const quotaDisplay = useMemo(
    () => buildQuotaDisplay(account, quotaState),
    [account, quotaState],
  );
  const billing = useMemo(
    () => (quotaState?.quota ? extractBilling(quotaState.quota) : undefined),
    [quotaState],
  );
  const configDirty = useMemo(
    () => (isApiLikeAccount ? hasApiKeyConfigChanges(account, configDraft) : false),
    [account, configDraft, isApiLikeAccount],
  );
  const mappingDirty = useMemo(
    () => JSON.stringify(buildEditableModelMappings(row)) !== JSON.stringify(mappingDraft),
    [mappingDraft, row],
  );
  const missingFields = useMemo(() => {
    if (!isApiLikeAccount) {
      return proxyRouteError ? [proxyRouteError] : [];
    }
    const fields = listApiKeyConfigMissingFields(configDraft);
    if (proxyRouteError) {
      fields.push(proxyRouteError);
    }
    return fields;
  }, [configDraft, isApiLikeAccount, proxyRouteError]);
  const hasDetailChanges = configDirty || mappingDirty || rateLimitDirty;
  const modelSectionTitle = t('codex.account_list_model_mapping');

  useEffect(() => {
    setConfigDraft(buildApiKeyConfigDraft(account));
    setMappingDraft(buildEditableModelMappings(row));
    setMappingError('');
    setProxyRouteError('');
    setRateLimitDirty(false);
  }, [account, row]);

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

  async function saveDetail() {
    if (savingDetail || savingMappings || missingFields.length > 0) {
      return;
    }

    setSavingDetail(true);
    try {
      setMappingError('');
      if (configDirty && onSaveConfig) {
        await onSaveConfig(configDraft, mappingDraft);
      } else if (mappingDirty) {
        await onSaveModelMappings(mappingDraft);
      }
      if (rateLimitDirty) {
        await rateLimitRulesRef.current?.save();
      }
    } catch (error) {
      setMappingError(toErrorMessage(error));
      throw error;
    } finally {
      setSavingDetail(false);
    }
  }

  function renderDetailModule(moduleID: ReturnType<typeof buildCodexAccountDetailModulePlan>[number]) {
    switch (moduleID) {
      case 'credentials':
        return (
          <AccountCredentialVerifySection
            key={moduleID}
            draft={configDraft}
            setDraft={setConfigDraft}
            verifyState={verifyState}
            modelNames={modelOptionNames}
          />
        );
      case 'auth-file-actions':
        return <CodexAuthFileSummarySection key={moduleID} account={account} />;
      case 'models':
        return <CodexAuthFileModelsSection key={moduleID} row={row} />;
      case 'proxy-route':
        return (
          <AccountProxyRouteSection
            key={moduleID}
            proxyUrl={configDraft.proxyUrl}
            onProxyUrlChange={(nextProxyURL) => setConfigDraft((prev) => ({ ...prev, proxyUrl: nextProxyURL }))}
            onValidityChange={setProxyRouteError}
          />
        );
      case 'rate-limit':
        return (
          <CodexRateLimitSection
            key={moduleID}
            row={row}
          rateLimitStatus={rateLimitStatus}
          rateLimitStrategies={rateLimitStrategies}
          rateLimitRulesAPI={rateLimitRulesAPI}
          rateLimitRulesRef={rateLimitRulesRef}
            onRateLimitDirtyChange={setRateLimitDirty}
            onRateLimitRulesChanged={onRateLimitRulesChanged}
            t={t}
          />
        );
      case 'quota':
        return (
          <AccountQuotaSection
            key={moduleID}
            account={account}
            draft={configDraft}
            setDraft={setConfigDraft}
            quotaState={quotaState}
            quotaDisplay={quotaDisplay}
          />
        );
      case 'billing':
        return (
          <AccountBillingSection
            key={moduleID}
            account={account}
            draft={configDraft}
            setDraft={setConfigDraft}
            liveBilling={billing}
          />
        );
      case 'model-routing':
        return (
          <CodexModelRoutingSection
            key={moduleID}
            t={t}
            row={row}
            title={modelSectionTitle}
            editableModelMappings={editableModelMappings}
            showModelMappings={showModelMappings}
            displayedModelMappings={displayedModelMappings}
            loadingModelMappings={loadingModelMappings}
            modelMappingError={modelMappingError}
            loadingModelOptions={loadingModelOptions}
            modelOptionError={modelOptionError}
            mappingError={mappingError}
            modelOptionNames={modelOptionNames}
            codexModelOptionNames={codexModelOptionNames}
            onAddMapping={addMappingDraft}
            onUpdateMapping={updateMappingDraft}
            onRemoveMapping={removeMappingDraft}
          />
        );
      default:
        return null;
    }
  }

  return (
    <AccountDetailModalFrame
      onClose={onClose}
      header={<CodexAccountDetailHeader row={row} t={t} onClose={onClose} />}
      footer={
        isApiLikeAccount || editableModelMappings || rateLimitDirty ? (
          <>
            <div className="min-w-0 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] sm:max-w-[70%]">
              {missingFields.length > 0
                ? `缺少字段 ${missingFields.join(', ')}`
                : mappingError || modelMappingError || modelOptionError || (loadingModelOptions ? t('accounts.openai_provider_models_fetch_running') : hasDetailChanges ? t('codex.account_list_unsaved') : modelSectionTitle)}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveDetail()}
                disabled={savingMappings || savingDetail || missingFields.length > 0}
                className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] disabled:cursor-wait disabled:opacity-50"
              >
                {savingMappings || savingDetail ? t('codex.account_list_saving') : t('common.save')}
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

        <AccountDetailModuleStack layout="cards">
          {modulePlan.map(renderDetailModule)}
        </AccountDetailModuleStack>
      </AccountDetailBody>
    </AccountDetailModalFrame>
  );
}

function CodexRateLimitSection({
  row,
  rateLimitStatus,
  rateLimitStrategies,
  rateLimitRulesAPI,
  rateLimitRulesRef,
  onRateLimitDirtyChange,
  onRateLimitRulesChanged,
  t,
}: {
  row: CodexAccountRow;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  rateLimitRulesRef: RefObject<RateLimitRulesSectionHandle>;
  onRateLimitDirtyChange: (dirty: boolean) => void;
  onRateLimitRulesChanged?: () => void;
  t: (key: string) => string;
}) {
  return (
    <RateLimitRulesSection
      ref={rateLimitRulesRef}
      accountKey={row.id}
      rateLimitStatus={rateLimitStatus}
      rateLimitStrategies={rateLimitStrategies ?? []}
      rateLimitRulesAPI={rateLimitRulesAPI}
      onDirtyChange={onRateLimitDirtyChange}
      onRateLimitRulesChanged={onRateLimitRulesChanged ?? (() => {})}
      t={t}
    />
  );
}

function CodexAuthFileSummarySection({ account }: { account: ReturnType<typeof buildCodexQuotaSummaryAccount> }) {
  return (
    <AccountDetailSection componentName="CodexAuthFileSummarySection" eyebrow="Auth File" title="文件摘要">
      <div className="grid gap-3">
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {account.name || account.displayName || account.id}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <AccountDetailPill>OAUTH</AccountDetailPill>
          <AccountDetailPill>{account.email || 'NO EMAIL'}</AccountDetailPill>
          <AccountDetailPill>{account.planType || 'UNKNOWN PLAN'}</AccountDetailPill>
        </div>
      </div>
    </AccountDetailSection>
  );
}

function CodexAuthFileModelsSection({ row }: { row: CodexAccountRow }) {
  const modelNames = row.modelMappings.map((mapping) => mapping.realModel).filter(Boolean);

  return (
    <AccountDetailSection
      componentName="CodexAuthFileModelsSection"
      eyebrow="Model Catalog"
      title="模型目录"
      meta={modelNames.length > 0 ? `${modelNames.length} 个模型` : undefined}
    >
      {modelNames.length === 0 ? (
        <AccountDetailEmptyState>暂无模型数据</AccountDetailEmptyState>
      ) : (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-auto pr-1">
          {modelNames.map((modelName) => (
            <AccountDetailPill key={modelName}>
              {modelName}
            </AccountDetailPill>
          ))}
        </div>
      )}
    </AccountDetailSection>
  );
}

function CodexModelRoutingSection({
  t,
  row,
  title,
  editableModelMappings,
  showModelMappings,
  displayedModelMappings,
  loadingModelMappings,
  modelMappingError,
  loadingModelOptions,
  modelOptionError,
  mappingError,
  modelOptionNames,
  codexModelOptionNames,
  onAddMapping,
  onUpdateMapping,
  onRemoveMapping,
}: {
  t: (key: string) => string;
  row: CodexAccountRow;
  title: string;
  editableModelMappings: boolean;
  showModelMappings: boolean;
  displayedModelMappings: CodexModelMappingRow[];
  loadingModelMappings: boolean;
  modelMappingError: string;
  loadingModelOptions: boolean;
  modelOptionError: string;
  mappingError: string;
  modelOptionNames: string[];
  codexModelOptionNames: string[];
  onAddMapping: () => void;
  onUpdateMapping: (index: number, patch: Partial<CodexModelMappingRow>) => void;
  onRemoveMapping: (index: number) => void;
}) {
  return (
    <AccountDetailSection
      componentName="CodexModelRoutingSection"
      eyebrow="Model Routing"
      title={title}
      meta={showModelMappings ? String(displayedModelMappings.length) : undefined}
      span="wide"
      actions={editableModelMappings ? (
        <button
          type="button"
          onClick={onAddMapping}
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
                      onChange={(value) => onUpdateMapping(index, { realModel: value })}
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
                      onChange={(value) => onUpdateMapping(index, { codexModel: value })}
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
                      onClick={() => onRemoveMapping(index)}
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
  );
}

function buildEditableModelMappings(row: Pick<CodexAccountRow, 'sourceKind' | 'modelMappings'>): CodexModelMappingRow[] {
  if (!canEditCodexModelMappings(row.sourceKind)) {
    return [];
  }
  if (row.sourceKind === 'codex-auth-file' && row.modelMappings.length === 0) {
    return [];
  }
  return row.modelMappings.length > 0
    ? row.modelMappings.map((mapping) => ({ ...mapping }))
    : [{ realModel: '', codexModel: '' }];
}
