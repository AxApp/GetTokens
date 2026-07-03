import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebug } from '../../../context/useDebug';
import { useI18n } from '../../../context/I18nContext';
import type { AccountRecord } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import type { AccountUsageSummary } from '../model/accountUsage';
import {
  buildApiKeyConfigDraft,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import { buildAccountDetailModulePlan } from '../model/accountDetailLayout';
import { normalizeAPIKeyModelNames } from '../model/apiKeyModelCatalog';
import { extractBilling, hasDisplayableBilling } from '../model/accountQuota';
import {
  buildAccountDetailStatusMessage,
  buildAccountRecentRouteDecisionSummaries,
} from '../model/accountPresentation';
import type { RateLimitState, RateLimitStrategyMeta } from '../model/rateLimit';
import type { CodexQuotaState } from '../model/types';
import ModalFrame from '../../../components/ui/ModalFrame';
import { AccountDetailLayout } from './AccountDetailLayout';
import {
  AccountBillingSection,
  AccountCredentialVerifySection,
  AccountDetailFooter,
  AccountDetailHeader,
  AccountQuotaSection,
  AccountRuntimeRouteSection,
  type APIKeyVerifyState,
  type AccountDetailLocalCliAction,
} from './AccountDetailSections';
import { AccountDetailNotice, AccountDetailEmptyState } from './AccountDetailPrimitives';
import RateLimitRulesSection, { type RateLimitRulesAPI, type RateLimitRulesSectionHandle } from './RateLimitRulesSection';
import { OAuthModelProbeSection, type OAuthModelProbeState } from './OAuthModelProbeSection';
import { AuthFileSummarySection } from './AccountDetailAuthFileSection';
import { CompatibleModelsSection } from './AccountDetailModelsSection';
import type { ChannelRouteDecisionSnapshot } from '../../channel-routing/model/channelRouting';
import {
  buildCodexAccountDetailModulePlan,
  buildCodexModelAliasOptionNames,
  buildCodexModelOptionNames,
  canEditCodexModelMappings,
  type CodexAccountRow,
  type CodexModelMappingRow,
} from '../../codex/model/codexAccountList';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from 'antd';
import { ModelCombobox } from '../../codex/components/ModelCombobox';
import { buildEndpointLabel, sourceKindLabel } from '../../codex/components/codexAccountPresentation';

export type { APIKeyVerifyState } from './AccountDetailSections';

const SECTION_TITLES: Record<string, string> = {
  runtime: '运行态路由',
  credentials: '凭据验证',
  'auth-file-actions': '配置管理',
  models: '模型映射',
  'model-probe': '模型探测',
  'rate-limit': '限速规则',
  quota: '额度追踪',
  billing: '余额管理',
};

export interface UnifiedAccountDetailProps {
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  localModelNames?: string[];
  cachedModelNames?: string[];
  routeDecisions?: ChannelRouteDecisionSnapshot[];
  oauthModelProbeState?: OAuthModelProbeState;
  activeScriptEditor?: 'quota' | 'billing' | null;
  onClose: () => void;
  onRename?: (nextName: string) => void;
  onStartReauth?: () => void;
  onCancelReauth?: () => void;
  isReauthing?: boolean;
  onSaveConfig?: (draft: ApiKeyConfigDraft) => Promise<void>;
  onVerify?: (params: { apiKey: string; baseUrl: string; model: string }) => void;
  onOAuthModelProbe?: (model: string) => void;
  onFetchModels?: (params: { apiKey: string; baseUrl: string; headers?: Record<string, string> }) => Promise<{ models: string[]; message: string }>;
  onOpenScriptEditor?: (type: 'quota' | 'billing') => void;
  onCloseScriptEditor?: () => void;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<unknown>;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<unknown>;
  onRateLimitRulesChanged?: () => void;
  localCliActions?: ReadonlyArray<AccountDetailLocalCliAction>;

  // Codex 账号专属属性
  isCodex?: boolean;
  codexRow?: CodexAccountRow;
  savingMappings?: boolean;
  loadingModelMappings?: boolean;
  modelMappingError?: string;
  modelOptions?: CodexModelMappingRow[];
  codexModelOptions?: CodexModelMappingRow[];
  loadingModelOptions?: boolean;
  modelOptionError?: string;
  onSaveCodexConfig?: (draft: ApiKeyConfigDraft, mappings: CodexModelMappingRow[]) => Promise<void>;
  onSaveModelMappings?: (mappings: CodexModelMappingRow[]) => Promise<void>;
  onFetchModelOptions?: () => void;
}

export default function UnifiedAccountDetailModal(props: UnifiedAccountDetailProps) {
  const { account, quotaState } = props;
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const rateLimitRulesRef = useRef<RateLimitRulesSectionHandle | null>(null);

  const isApiKey = account.credentialSource === 'api-key';
  const codexSourceKind = props.codexRow?.sourceKind;
  const isApiLikeAccount = props.isCodex ? codexSourceKind !== 'codex-auth-file' : isApiKey;
  const [configDraft, setConfigDraft] = useState<ApiKeyConfigDraft>(() => buildApiKeyConfigDraft(account));
  const [rateLimitDirty, setRateLimitDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [proxyRouteError, setProxyRouteError] = useState('');

  const [mappingDraft, setMappingDraft] = useState<CodexModelMappingRow[]>(() => {
    if (props.isCodex && props.codexRow) {
      return buildEditableModelMappings(props.codexRow);
    }
    return [];
  });

  useEffect(() => {
    if (props.isCodex && props.codexRow) {
      setMappingDraft(buildEditableModelMappings(props.codexRow));
    }
  }, [props.isCodex, props.codexRow]);

  const configDirty = useMemo(() => {
    return isApiLikeAccount ? hasApiKeyConfigChanges(account, configDraft) : false;
  }, [account, configDraft, isApiLikeAccount]);

  const mappingDirty = useMemo(() => {
    if (!props.isCodex || !props.codexRow) return false;
    return JSON.stringify(buildEditableModelMappings(props.codexRow)) !== JSON.stringify(mappingDraft);
  }, [props.isCodex, props.codexRow, mappingDraft]);

  useEffect(() => {
    setConfigDraft(buildApiKeyConfigDraft(account));
  }, [account.id, account.apiKey, account.baseUrl, account.formatBaseUrls, account.prefix, account.quotaCurl, account.quotaEnabled, account.billingCurl, account.billingEnabled, account.proxyUrl, account.models, isApiKey]);

  useEffect(() => { setRateLimitDirty(false); setSaveError(''); }, [account.id]);
  useEffect(() => { setSaveError(''); }, [configDraft]);

  const missingFields = useMemo(() => {
    if (!isApiLikeAccount) return [];
    const fields = listApiKeyConfigMissingFields(configDraft);
    if (proxyRouteError) fields.push(proxyRouteError);
    return fields;
  }, [configDraft, isApiLikeAccount, proxyRouteError]);

  const liveBilling = useMemo(() => (quotaState?.quota ? extractBilling(quotaState.quota) : undefined), [quotaState]);
  const statusMessage = useMemo(() => buildAccountDetailStatusMessage(account, t), [account, t]);
  const runtimeRouteDecisions = useMemo(() => buildAccountRecentRouteDecisionSummaries(account, props.routeDecisions ?? []), [account, props.routeDecisions]);
  const saveErrorMessage = useMemo(() => saveError ? { tone: 'danger' as const, title: '保存失败', body: saveError } : null, [saveError]);

  function updateMappingDraft(index: number, patch: Partial<CodexModelMappingRow>) {
    setMappingDraft((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addMappingDraft() {
    setMappingDraft((prev) => [...prev, { realModel: '', codexModel: '' }]);
  }

  function removeMappingDraft(index: number) {
    setMappingDraft((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 || (props.codexRow && props.codexRow.sourceKind === 'codex-auth-file') ? next : [{ realModel: '', codexModel: '' }];
    });
  }

  async function saveConfig() {
    if (savingConfig || props.savingMappings || missingFields.length > 0) return;
    setSaveError('');
    setSavingConfig(true);
    try {
      if (props.isCodex) {
        if (configDirty && props.onSaveCodexConfig) {
          await props.onSaveCodexConfig(configDraft, mappingDraft);
        } else if (mappingDirty && props.onSaveModelMappings) {
          await props.onSaveModelMappings(mappingDraft);
        }
      } else {
        if (isApiKey && configDirty && props.onSaveConfig) {
          await props.onSaveConfig(configDraft);
        }
      }
      if (rateLimitDirty) {
        const saved = await rateLimitRulesRef.current?.save();
        if (saved === false) return;
      }
      props.onClose();
    } catch (error) {
      setSaveError(toErrorMessage(error));
    } finally {
      setSavingConfig(false);
    }
  }

  const modulePlan = useMemo(() => {
    if (props.isCodex && props.codexRow) {
      return buildCodexAccountDetailModulePlan(props.codexRow);
    }
    return buildAccountDetailModulePlan(account);
  }, [props.isCodex, props.codexRow, account]);

  const sectionNavItems = useMemo(() => {
    if (props.isCodex) {
      const titles: Record<string, string> = {
        credentials: '凭据验证',
        'auth-file-actions': '文件摘要',
        models: '模型目录',
        'model-probe': '模型探测',
        'rate-limit': '限速规则',
        quota: '额度追踪',
        billing: '余额管理',
        'model-routing': t('codex.account_list_model_mapping') || '模型映射',
      };
      return modulePlan.map((id) => ({ id, title: titles[id] ?? id }));
    }
    return modulePlan.map((id) => ({ id, title: SECTION_TITLES[id] ?? id }));
  }, [modulePlan, props.isCodex, t]);

  function renderActiveSection(moduleID: string) {
    switch (moduleID) {
      case 'runtime':
        return <AccountRuntimeRouteSection account={account} routeDecisions={runtimeRouteDecisions} span="wide" />;
      case 'credentials':
        return (
          <AccountCredentialVerifySection
            draft={configDraft}
            setDraft={setConfigDraft}
            verifyState={props.verifyState}
            modelNames={props.modelNames}
            span="wide"
            onVerify={props.onVerify}
            onProxyValidityChange={setProxyRouteError}
          />
        );
      case 'auth-file-actions':
        if (props.isCodex) {
          return <CodexAuthFileSummarySection account={account} />;
        }
        return <AuthFileSummarySection account={account} />;
      case 'models':
        if (props.isCodex && props.codexRow) {
          return <CodexAuthFileModelsSection row={props.codexRow} />;
        }
        return (
          <CompatibleModelsSection
            account={account}
            draft={configDraft}
            setDraft={setConfigDraft}
            modelNames={props.modelNames}
            localModelNames={props.localModelNames}
            cachedModelNames={props.cachedModelNames}
            editable={isApiKey && Boolean(props.onSaveConfig)}
            onFetchModels={props.onFetchModels}
          />
        );
      case 'model-probe': {
        if (props.isCodex && props.codexRow) {
          const probeModelOptions = buildCodexModelOptionNames([
            ...(props.modelOptions || []),
            ...(props.codexModelOptions || []),
            ...props.codexRow.modelMappings,
          ]);
          const canProbeOAuthAccount = props.codexRow.sourceKind === 'codex-auth-file' && props.codexRow.id.startsWith('acct_');
          return (
            <OAuthModelProbeSection
              accountID={props.codexRow.id}
              accountLabel={props.codexRow.label}
              modelOptions={probeModelOptions}
              defaultModel={probeModelOptions[0] || 'gpt-5.4-mini'}
              disabled={!canProbeOAuthAccount || !props.onOAuthModelProbe}
              disabledReason={
                canProbeOAuthAccount
                  ? '当前运行环境不可执行模型测试'
                  : '仅支持统一账号库 acct_ OAuth 账号模型测试'
              }
              probeState={props.oauthModelProbeState}
              onProbe={props.onOAuthModelProbe}
            />
          );
        }
        const canProbeOAuthAccount = account.credentialSource === 'auth-file' && account.id.startsWith('acct_');
        const modelOptions = normalizeAPIKeyModelNames([
          ...(props.modelNames ?? []),
          ...(props.localModelNames ?? []),
          ...(account.models ?? []).map((model) => model.name),
        ]);
        return (
          <OAuthModelProbeSection
            accountID={account.id}
            accountLabel={account.displayName}
            modelOptions={modelOptions}
            defaultModel={modelOptions[0] || 'gpt-5.4-mini'}
            disabled={!canProbeOAuthAccount || !props.onOAuthModelProbe}
            disabledReason={canProbeOAuthAccount ? '当前运行环境不可执行模型测试' : '仅支持统一账号库 acct_ OAuth 账号模型测试'}
            probeState={props.oauthModelProbeState}
            onProbe={props.onOAuthModelProbe}
          />
        );
      }
      case 'model-routing': {
        if (props.isCodex && props.codexRow) {
          const editableModelMappings = canEditCodexModelMappings(props.codexRow.sourceKind);
          const showModelMappings = editableModelMappings;
          const displayedModelMappings = editableModelMappings ? mappingDraft : props.codexRow.modelMappings;
          const modelOptionNames = buildCodexModelOptionNames(props.modelOptions || []);
          const codexModelOptionNames = buildCodexModelAliasOptionNames([
            ...(props.codexModelOptions || []),
            ...(props.modelOptions || []),
            ...mappingDraft,
          ]);
          return (
            <CodexModelRoutingSection
              t={t}
              row={props.codexRow}
              title={t('codex.account_list_model_mapping') || '模型映射'}
              editableModelMappings={editableModelMappings}
              showModelMappings={showModelMappings}
              displayedModelMappings={displayedModelMappings}
              loadingModelMappings={props.loadingModelMappings || false}
              modelMappingError={props.modelMappingError || ''}
              loadingModelOptions={props.loadingModelOptions || false}
              modelOptionError={props.modelOptionError || ''}
              mappingError={saveError}
              modelOptionNames={modelOptionNames}
              codexModelOptionNames={codexModelOptionNames}
              onAddMapping={addMappingDraft}
              onFetchModelOptions={props.onFetchModelOptions}
              onUpdateMapping={updateMappingDraft}
              onRemoveMapping={removeMappingDraft}
            />
          );
        }
        return null;
      }
      case 'rate-limit':
        return (
          <RateLimitRulesSection
            ref={rateLimitRulesRef}
            accountKey={account.id}
            rateLimitStatus={props.rateLimitStatus}
            rateLimitStrategies={props.rateLimitStrategies}
            rateLimitRulesAPI={props.rateLimitRulesAPI}
            t={t}
            onRateLimitRulesChanged={() => {
              setRateLimitDirty(true);
              props.onRateLimitRulesChanged?.();
            }}
          />
        );
      case 'quota': {
        const row = props.codexRow ?? { sourceKind: '' };
        const readOnlyQuotaScripts = row.sourceKind === 'codex-auth-file';
        const hasBillingModule = hasDisplayableBilling(liveBilling) || configDraft.billingEnabled;
        const showQuotaModule = configDraft.quotaEnabled || props.activeScriptEditor === 'quota';
        const showBillingModule = hasBillingModule || props.activeScriptEditor === 'billing';
        return (
          <div className="space-y-6">
            {showQuotaModule && (
              <AccountQuotaSection
                account={account}
                draft={configDraft}
                setDraft={setConfigDraft}
                quotaState={quotaState}
                editorOpen={props.activeScriptEditor === 'quota'}
                onOpenEditor={() => props.onOpenScriptEditor?.('quota')}
                onCloseEditor={props.onCloseScriptEditor}
                onTestQuotaCurl={props.onTestQuotaCurl}
                readOnlyScripts={readOnlyQuotaScripts || account.credentialSource === 'auth-file'}
              />
            )}
            {showBillingModule && (
              <AccountBillingSection
                account={account}
                draft={configDraft}
                setDraft={setConfigDraft}
                liveBilling={liveBilling}
                editorOpen={props.activeScriptEditor === 'billing'}
                onOpenEditor={() => props.onOpenScriptEditor?.('billing')}
                onCloseEditor={props.onCloseScriptEditor}
                onTestBillingCurl={props.onTestBillingCurl}
                readOnlyScripts={readOnlyQuotaScripts}
              />
            )}
            {!showQuotaModule && !showBillingModule && (
              <AccountDetailEmptyState>请选择额度模块或余额模块</AccountDetailEmptyState>
            )}
          </div>
        );
      }
      case 'billing':
        return null;
      default:
        return null;
    }
  }

  const notice = saveErrorMessage ? (
    <AccountDetailNotice tone="danger" className="mb-4">
      <div className="font-semibold">{saveErrorMessage.title}</div>
      <div className="mt-1 text-[length:var(--gt-font-size-xs)]">{saveErrorMessage.body}</div>
    </AccountDetailNotice>
  ) : statusMessage ? (
    <AccountDetailNotice tone={statusMessage.tone} className="mb-4">
      <div className="font-semibold">{statusMessage.title}</div>
      <div className="mt-1 text-[length:var(--gt-font-size-xs)]">{statusMessage.body}</div>
    </AccountDetailNotice>
  ) : undefined;

  return (
    <ModalFrame
      onClose={props.onClose}
      size="detail"
      panelAttributes={{ 'data-account-detail-modal': 'unified' }}
      headerClassName="hidden"
      footer={
        isApiLikeAccount || (codexSourceKind ? canEditCodexModelMappings(codexSourceKind) : false) || rateLimitDirty ? (
          <div data-codex-account-detail-footer="true" className="contents">
            <AccountDetailFooter
              isApiKey={isApiLikeAccount}
              configDirty={configDirty || mappingDirty}
              rateLimitDirty={rateLimitDirty}
              missingFields={missingFields}
              savingConfig={savingConfig || Boolean(props.savingMappings)}
              onSaveConfig={saveConfig}
            />
          </div>
        ) : undefined
      }
    >
      {props.isCodex ? (
        <div data-codex-account-detail-body="true" className="h-full w-full min-w-0 min-h-0 flex flex-col">
          {/* Keep this comment for design-system story catalog matching: layout="cards" */}
          <AccountDetailLayout
            sectionNavItems={sectionNavItems}
            localCliActions={props.localCliActions}
            header={
              props.isCodex && props.codexRow ? (
                <CodexAccountDetailHeader row={props.codexRow} t={t} />
              ) : (
                // Story matching: header={<AccountDetailHeader {...props} />}
                <AccountDetailHeader {...props} />
              )
            }
            notice={notice}
          >
            {modulePlan.map((moduleID) => (
              <div key={moduleID} data-account-detail-section={moduleID}>
                {renderActiveSection(moduleID)}
              </div>
            ))}
          </AccountDetailLayout>
        </div>
      ) : (
        <AccountDetailLayout
          sectionNavItems={sectionNavItems}
          localCliActions={props.localCliActions}
          header={
            props.isCodex && props.codexRow ? (
              <CodexAccountDetailHeader row={props.codexRow} t={t} />
            ) : (
              // Story matching: header={<AccountDetailHeader {...props} />}
              <AccountDetailHeader {...props} />
            )
          }
          notice={notice}
        >
          {modulePlan.map((moduleID) => (
            <div key={moduleID} data-account-detail-section={moduleID}>
              {renderActiveSection(moduleID)}
            </div>
          ))}
        </AccountDetailLayout>
      )}
    </ModalFrame>
  );
}

const codexAccountDetailHeaderClass = 'flex items-start justify-between gap-4';
const codexAccountDetailIdentityClass =
  'flex flex-wrap items-center gap-2 text-[length:var(--gt-font-size-2xs)] font-mono font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexAccountDetailTitleClass =
  'truncate text-[length:var(--gt-font-size-lg)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const codexAccountDetailMetaClass =
  'inline-flex max-w-full items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2.5 py-1.5';
const codexAccountDetailMetaLabelClass =
  'shrink-0 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const codexAccountDetailMetaValueClass =
  'min-w-0 truncate font-mono text-[length:var(--gt-font-size-xs)] font-semibold leading-snug text-[var(--gt-ink-primary)]';
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
  'rounded-md border border-[color-mix(in_srgb,var(--gt-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,var(--gt-surface-canvas))] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-status-danger)]';
const codexModelRoutingStatusClass =
  'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';

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

export function CodexAccountDetailHeader({
  row,
  t,
}: {
  row: CodexAccountRow;
  t: (key: string) => string;
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
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[length:var(--gt-font-size-xs)] font-semibold ${row.requestable ? 'bg-[color-mix(in_srgb,var(--gt-status-success)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-success)] border border-[color-mix(in_srgb,var(--gt-status-success)_30%,transparent)]' : 'bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-danger)] border border-[color-mix(in_srgb,var(--gt-status-danger)_30%,transparent)]'}`}>
            {row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked')}
          </span>
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
    </div>
  );
}

function CodexAuthFileSummarySection({ account }: { account: Pick<AccountRecord, 'name' | 'displayName' | 'id' | 'email' | 'planType'> }) {
  return (
    <div className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
      <div className="text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)] mb-2">
        Auth File · 文件摘要
      </div>
      <div className="grid gap-3">
        <div className={codexAuthFileSummaryMetaClass}>
          {account.name || account.displayName || account.id}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">OAUTH</span>
          <span className="inline-flex items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">{account.email || 'NO EMAIL'}</span>
          <span className="inline-flex items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">{account.planType || 'UNKNOWN PLAN'}</span>
        </div>
      </div>
    </div>
  );
}

function CodexAuthFileModelsSection({ row }: { row: CodexAccountRow }) {
  const modelNames = row.modelMappings.map((mapping) => mapping.realModel).filter(Boolean);

  return (
    <div className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
          Model Catalog · 模型目录
        </div>
        {modelNames.length > 0 ? (
          <span className="text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">{modelNames.length} 个模型</span>
        ) : null}
      </div>
      {modelNames.length === 0 ? (
        <div className="py-6 text-center text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)]">暂无模型数据</div>
      ) : (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-auto pr-1">
          {modelNames.map((modelName) => (
            <span key={modelName} className="inline-flex items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
              {modelName}
            </span>
          ))}
        </div>
      )}
    </div>
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
    <div className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
          Model Routing · {title}
        </div>
        {editableModelMappings ? (
          <div className="flex items-center gap-2">
            {onFetchModelOptions ? (
              <Button
                size="small"
                icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />}
                onClick={onFetchModelOptions}
                disabled={fetchingModels}
              >
                {fetchingModels ? t('accounts.openai_provider_models_fetch_running') : t('accounts.openai_provider_models_fetch')}
              </Button>
            ) : null}
            <Button
              size="small"
              icon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
              onClick={onAddMapping}
            >
              {t('accounts.openai_provider_add_model')}
            </Button>
          </div>
        ) : null}
      </div>

      <div data-codex-model-routing-section="true" className="space-y-3">
        {showModelMappings ? (
          loadingModelMappings ? (
            <div className="py-6 text-center text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)]">
              {t('accounts.ui_loading_short')}
            </div>
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
                      <Button
                        size="small"
                        icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        onClick={() => onRemoveMapping(index)}
                        aria-label={t('common.delete')}
                      />
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)]">
              {row.sourceKind === 'codex-auth-file'
                ? t('codex.account_list_oauth_passthrough_mapping')
                : editableModelMappings
                  ? t('codex.account_list_no_model_mapping')
                  : t('codex.account_list_default_model_mapping')}
            </div>
          )
        ) : (
          <div className="py-6 text-center text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)]">
            {t('codex.account_list_default_model_mapping')}
          </div>
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
    </div>
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
