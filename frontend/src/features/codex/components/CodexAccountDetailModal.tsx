import { Plus, RefreshCw, Trash2, X } from 'lucide-react';
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
import RateLimitRulesSection, { type RateLimitRulesAPI, type RateLimitRulesSectionHandle } from '../../accounts/components/RateLimitRulesSection';
import { OAuthModelProbeSection, type OAuthModelProbeState } from '../../accounts/components/OAuthModelProbeSection';
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

const codexAccountDetailHeaderClass = 'flex items-start justify-between gap-4';
const codexAccountDetailIdentityClass =
  'flex flex-wrap items-center gap-2 text-[length:var(--gt-font-size-2xs)] font-mono font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexAccountDetailTitleClass =
  'truncate text-lg font-semibold italic tracking-normal text-[var(--gt-ink-primary)]';
const codexAccountDetailMetaClass =
  'inline-flex max-w-full items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2.5 py-1.5';
const codexAccountDetailMetaLabelClass =
  'shrink-0 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexAccountDetailMetaValueClass =
  'min-w-0 truncate font-mono text-[length:var(--gt-font-size-xs)] font-semibold leading-snug text-[var(--gt-ink-primary)]';
const codexAccountDetailButtonClass =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-wait disabled:opacity-50';
const codexAccountDetailIconButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[var(--gt-ink-muted)] transition hover:border-[var(--gt-border-subtle)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)]';
const codexAccountDetailPrimaryButtonClass =
  `${codexAccountDetailButtonClass} border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)] hover:bg-[color-mix(in_srgb,var(--gt-ink-primary)_88%,transparent)]`;
const codexAccountDetailFooterClass =
  'flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between';
const codexAccountDetailFooterStatusClass =
  'min-w-0 text-[length:var(--gt-font-size-xs)] font-medium tracking-normal text-[var(--gt-ink-muted)] sm:max-w-[70%]';
const codexAuthFileSummaryMetaClass =
  'text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexModelRoutingPanelClass =
  'overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const codexModelRoutingHeaderClass =
  'grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexModelRoutingRowClass =
  'grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 border-b border-[var(--gt-border-subtle)] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)] last:border-b-0';
const codexModelRoutingValueClass =
  'min-w-0 break-all font-mono text-[length:var(--gt-font-size-md-compact)] font-semibold text-[var(--gt-ink-primary)]';
const codexModelRoutingArrowClass = 'text-center font-semibold text-[var(--gt-ink-muted)]';
const codexModelRoutingErrorClass =
  'rounded-md border border-[color-mix(in_srgb,var(--gt-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,var(--gt-surface-canvas))] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-status-danger)]';
const codexModelRoutingStatusClass =
  'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]';

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
    <div data-codex-account-detail-header="quiet" className={codexAccountDetailHeaderClass}>
      <div className="min-w-0 space-y-4">
        <div className={codexAccountDetailIdentityClass}>
          <span>{sourceKindLabel(t, row.sourceKind)}</span>
          <span>·</span>
          <span className="break-all">{row.id}</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h3 className={codexAccountDetailTitleClass}>
            {row.label}
          </h3>
          <AccountDetailPill tone={row.requestable ? 'success' : 'danger'}>
            {row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked')}
          </AccountDetailPill>
        </div>

        <dl
          data-codex-account-detail-header="summary"
          className="flex min-w-0 flex-wrap items-center gap-2"
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

      <button type="button" onClick={onClose} className={codexAccountDetailIconButtonClass} aria-label={t('common.close')}>
        <X className="h-4 w-4" strokeWidth={2.5} />
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
    <div className={codexAccountDetailMetaClass}>
      <dt className={codexAccountDetailMetaLabelClass}>
        {label}
      </dt>
      <dd className={codexAccountDetailMetaValueClass}>
        {value}
      </dd>
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
  oauthModelProbeState,
  onClose,
  onSaveConfig,
  onRateLimitRulesChanged,
  onSaveModelMappings,
  onFetchModelOptions,
  onOAuthModelProbe,
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
  oauthModelProbeState?: OAuthModelProbeState;
  onClose: () => void;
  onSaveConfig?: (draft: ApiKeyConfigDraft, mappings: CodexModelMappingRow[]) => Promise<void>;
  onRateLimitRulesChanged?: () => void;
  onSaveModelMappings: (mappings: CodexModelMappingRow[]) => Promise<void>;
  onFetchModelOptions?: () => void;
  onOAuthModelProbe?: (model: string) => void;
}) {
  const account = useMemo(() => buildCodexQuotaSummaryAccount(row), [row]);
  const blockedLabel = buildCodexBlockedLabel(row, t);
  const modulePlan = useMemo(() => buildCodexAccountDetailModulePlan(row), [row]);
  const isApiLikeAccount = row.sourceKind !== 'codex-auth-file';
  const readOnlyQuotaScripts = row.sourceKind === 'codex-auth-file';
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
            span="wide"
            onProxyValidityChange={setProxyRouteError}
          />
        );
      case 'auth-file-actions':
        return <CodexAuthFileSummarySection key={moduleID} account={account} />;
      case 'models':
        return <CodexAuthFileModelsSection key={moduleID} row={row} />;
      case 'model-probe': {
        const canProbeOAuthAccount = row.sourceKind === 'codex-auth-file' && row.id.startsWith('acct_');
        const probeModelOptions = buildCodexModelOptionNames([
          ...modelOptions,
          ...codexModelOptions,
          ...row.modelMappings,
        ]);
        return (
          <OAuthModelProbeSection
            key={moduleID}
            accountID={row.id}
            accountLabel={row.label}
            modelOptions={probeModelOptions}
            defaultModel={probeModelOptions[0] || 'gpt-5.4-mini'}
            disabled={!canProbeOAuthAccount || !onOAuthModelProbe}
            disabledReason={
              canProbeOAuthAccount
                ? '当前运行环境不可执行模型测试'
                : '仅支持统一账号库 acct_ OAuth 账号模型测试'
            }
            probeState={oauthModelProbeState}
            onProbe={onOAuthModelProbe}
          />
        );
      }
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
            readOnlyScripts={readOnlyQuotaScripts}
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
            readOnlyScripts={readOnlyQuotaScripts}
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
            onFetchModelOptions={onFetchModelOptions}
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
          <div data-codex-account-detail-footer className={codexAccountDetailFooterClass}>
            <div className={codexAccountDetailFooterStatusClass}>
              {missingFields.length > 0
                ? `缺少字段 ${missingFields.join(', ')}`
                : mappingError || modelMappingError || modelOptionError || (loadingModelOptions ? t('accounts.openai_provider_models_fetch_running') : hasDetailChanges ? t('codex.account_list_unsaved') : modelSectionTitle)}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveDetail()}
                disabled={savingMappings || savingDetail || missingFields.length > 0}
                className={codexAccountDetailPrimaryButtonClass}
              >
                {savingMappings || savingDetail ? t('codex.account_list_saving') : t('common.save')}
              </button>
              <button type="button" onClick={onClose} className={codexAccountDetailButtonClass}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <AccountDetailBody data-collaboration-id="MODAL_CODEX_ACCOUNT_DETAIL" data-codex-account-detail-body="true">
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

function buildCodexBlockedLabel(row: CodexAccountRow, t: (key: string) => string): string {
  if (row.blockReason === 'disabled') {
    return t('codex.account_list_block_disabled');
  }
  if (row.blockReason === 'waiting-check') {
    return t('codex.account_list_block_waiting_check');
  }
  return row.blockReason;
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
        <div className={codexAuthFileSummaryMetaClass}>
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
  onFetchModelOptions,
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
  onFetchModelOptions?: () => void;
  onUpdateMapping: (index: number, patch: Partial<CodexModelMappingRow>) => void;
  onRemoveMapping: (index: number) => void;
}) {
  const fetchingModels = loadingModelMappings || loadingModelOptions;

  return (
    <AccountDetailSection
      componentName="CodexModelRoutingSection"
      eyebrow="Model Routing"
      title={title}
      meta={showModelMappings ? String(displayedModelMappings.length) : undefined}
      span="wide"
      actions={editableModelMappings ? (
        <>
          {onFetchModelOptions ? (
            <button
              type="button"
              onClick={onFetchModelOptions}
              disabled={fetchingModels}
              className={codexAccountDetailButtonClass}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetchingModels ? 'animate-spin' : ''}`} strokeWidth={2.5} />
              {fetchingModels ? t('accounts.openai_provider_models_fetch_running') : t('accounts.openai_provider_models_fetch')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAddMapping}
            className={codexAccountDetailButtonClass}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            {t('accounts.openai_provider_add_model')}
          </button>
        </>
      ) : undefined}
    >
      <div data-codex-model-routing-section="true" className="space-y-3">
        {showModelMappings ? (
          loadingModelMappings ? (
            <AccountDetailEmptyState>
              {t('accounts.ui_loading_short')}
            </AccountDetailEmptyState>
          ) : displayedModelMappings.length > 0 ? (
            <div data-codex-model-routing-table="true" className={codexModelRoutingPanelClass}>
              <div className={codexModelRoutingHeaderClass}>
                <span>{t('codex.account_list_real_model')}</span>
                <span className="text-center">-&gt;</span>
                <span className="text-right">{t('codex.account_list_codex_model')}</span>
                <span />
              </div>
              <div>
                {displayedModelMappings.map((mapping, index) => (
                  <div
                    key={`mapping-${index}`}
                    className={codexModelRoutingRowClass}
                  >
                    {editableModelMappings ? (
                      <ModelCombobox
                        value={mapping.realModel}
                        options={modelOptionNames}
                        onChange={(value) => onUpdateMapping(index, { realModel: value })}
                        placeholder={modelOptionNames[0] || 'deepseek-v4-flash'}
                      />
                    ) : (
                      <span className={codexModelRoutingValueClass}>
                        {mapping.realModel}
                      </span>
                    )}
                    <span className={codexModelRoutingArrowClass}>-&gt;</span>
                    {editableModelMappings ? (
                      <ModelCombobox
                        value={mapping.codexModel}
                        options={codexModelOptionNames}
                        onChange={(value) => onUpdateMapping(index, { codexModel: value })}
                        placeholder={codexModelOptionNames[0] || mapping.realModel || 'deepseek-v4-flash'}
                        align="right"
                      />
                    ) : (
                      <span className={`${codexModelRoutingValueClass} text-right`}>
                        {mapping.codexModel}
                      </span>
                    )}
                    {editableModelMappings ? (
                      <button
                        type="button"
                        onClick={() => onRemoveMapping(index)}
                        className={codexAccountDetailIconButtonClass}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
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
          <div className={codexModelRoutingErrorClass}>
            {modelMappingError}
          </div>
        ) : null}

        {editableModelMappings && (loadingModelOptions || modelOptionError) ? (
          <div className={modelOptionError ? codexModelRoutingErrorClass : codexModelRoutingStatusClass}>
            {modelOptionError || t('accounts.openai_provider_models_fetch_running')}
          </div>
        ) : null}

        {editableModelMappings && mappingError ? (
          <div className={codexModelRoutingErrorClass}>
            {mappingError}
          </div>
        ) : null}
      </div>
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
