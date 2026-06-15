import { RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import {
  DownloadAuthFile,
  GetAuthFileModels,
  NormalizeAuthFileContent,
} from '../../../../wailsjs/go/main/App';
import { useDebug } from '../../../context/useDebug';
import { useI18n } from '../../../context/I18nContext';
import type { AccountRecord } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import type { AccountDetailScriptRoute } from '../../../utils/pagePersistence';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { Combobox } from '../../../components/ui/Combobox.tsx';
import { decodeBase64Utf8, parseMaybeJSON } from '../model/accountConfig';
import type { AccountUsageSummary } from '../model/accountUsage';
import {
  buildApiKeyConfigDraft,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
  resolveManagementBaseUrl,
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
import { getVendorPreset } from '../model/vendorPresets';
import { resolveVendorPresetID } from '../model/vendorPresetHelpers';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import {
  AccountBillingSection,
  AccountCredentialVerifySection,
  AccountDetailFooter,
  AccountDetailHeader,
  AccountQuotaSection,
  AccountRuntimeRouteSection,
  type APIKeyVerifyState,
} from './AccountDetailSections';
import {
  AccountDetailBody,
  AccountDetailEmptyState,
  AccountDetailModuleStack,
  AccountDetailNotice,
  AccountDetailPill,
  AccountDetailSection,
} from './AccountDetailPrimitives';
import RateLimitRulesSection, { type RateLimitRulesAPI, type RateLimitRulesSectionHandle } from './RateLimitRulesSection';
import { getAccountsPreviewAuthFileContent, getAccountsPreviewAuthFileModels } from '../previewData';
import { OAuthModelProbeSection, type OAuthModelProbeState } from './OAuthModelProbeSection';
import type { ChannelRouteDecisionSnapshot } from '../../channel-routing/model/channelRouting';

export type { APIKeyVerifyState } from './AccountDetailSections';

export interface UnifiedAccountDetailProps {
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  verifyState?: APIKeyVerifyState;
  oauthModelProbeState?: OAuthModelProbeState;
  routeDecisions?: ChannelRouteDecisionSnapshot[];
  modelNames?: string[];
  localModelNames?: string[];
  cachedModelNames?: string[];
  onClose: () => void;
  onRename?: (nextName: string) => void;
  onSaveConfig?: (draft: ApiKeyConfigDraft) => Promise<void>;
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
  onOAuthModelProbe?: (model: string) => void;
  onFetchModels?: (input: { apiKey: string; baseUrl: string; headers?: Record<string, string> }) => Promise<{ models: string[]; message: string }>;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<any>;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<any>;
  onRateLimitRulesChanged?: () => void;
  activeScriptEditor?: AccountDetailScriptRoute | '';
  onOpenScriptEditor?: (script: AccountDetailScriptRoute) => void;
  onCloseScriptEditor?: () => void;
  onStartReauth?: () => void;
  onCancelReauth?: () => void;
  isReauthing?: boolean;
}

export default function UnifiedAccountDetailModal(props: UnifiedAccountDetailProps) {
  const { account, onClose, onSaveConfig, quotaState } = props;
  const { t } = useI18n();
  const isApiKey = account.credentialSource === 'api-key';
  const [configDraft, setConfigDraft] = useState<ApiKeyConfigDraft>(() => buildApiKeyConfigDraft(account));
  const [proxyRouteError, setProxyRouteError] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [rateLimitDirty, setRateLimitDirty] = useState(false);
  const rateLimitRulesRef = useRef<RateLimitRulesSectionHandle>(null);

  useEffect(() => {
    if (!isApiKey) {
      return;
    }
    setConfigDraft(buildApiKeyConfigDraft(account));
  }, [
    account.id,
    account.apiKey,
    account.baseUrl,
    account.formatBaseUrls,
    account.prefix,
    account.quotaCurl,
    account.quotaEnabled,
    account.billingCurl,
    account.billingEnabled,
    account.proxyUrl,
    account.models,
    isApiKey,
  ]);

  useEffect(() => {
    setRateLimitDirty(false);
    setSaveError('');
  }, [account.id]);

  useEffect(() => {
    setSaveError('');
  }, [configDraft]);

  const configDirty = useMemo(
    () => (isApiKey ? hasApiKeyConfigChanges(account, configDraft) : false),
    [account, configDraft, isApiKey],
  );
  const missingFields = useMemo(
    () => {
      if (!isApiKey) {
        return [];
      }
      const fields = listApiKeyConfigMissingFields(configDraft);
      if (proxyRouteError) {
        fields.push(proxyRouteError);
      }
      return fields;
    },
    [configDraft, isApiKey, proxyRouteError],
  );
  const liveBilling = useMemo(
    () => (quotaState?.quota ? extractBilling(quotaState.quota) : undefined),
    [quotaState],
  );
  const statusMessage = useMemo(
    () => buildAccountDetailStatusMessage(account, t),
    [account, t],
  );
  const runtimeRouteDecisions = useMemo(
    () => buildAccountRecentRouteDecisionSummaries(account, props.routeDecisions ?? []),
    [account, props.routeDecisions],
  );
  const saveErrorMessage = useMemo(
    () =>
      saveError
        ? {
            tone: 'danger' as const,
            title: '保存失败',
            body: saveError,
          }
        : null,
    [saveError],
  );

  async function saveConfig() {
    if (savingConfig || missingFields.length > 0) {
      return;
    }
    setSaveError('');
    setSavingConfig(true);
    try {
      if (isApiKey && configDirty && onSaveConfig) {
        await onSaveConfig(configDraft);
      }
      if (rateLimitDirty) {
        const saved = await rateLimitRulesRef.current?.save();
        if (saved === false) {
          return;
        }
      }
      onClose();
    } catch (error) {
      setSaveError(toErrorMessage(error));
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <AccountDetailModalFrame
      onClose={onClose}
      panelAttributes={{ 'data-account-detail-modal': 'unified' }}
      header={<AccountDetailHeader {...props} />}
      headerClassName="p-0"
      error={
        saveErrorMessage ? (
          <AccountDetailStatusNotice message={saveErrorMessage} />
        ) : statusMessage ? (
          <AccountDetailStatusNotice message={statusMessage} />
        ) : undefined
      }
      footer={
        <AccountDetailFooter
          isApiKey={isApiKey}
          configDirty={configDirty}
          rateLimitDirty={rateLimitDirty}
          missingFields={missingFields}
          savingConfig={savingConfig}
          onClose={onClose}
          onSaveConfig={saveConfig}
        />
      }
    >
      <AccountDetailBody>
        <AccountDetailModuleStack layout="bands">
          {buildAccountDetailModulePlan(account).map((moduleID) => {
            switch (moduleID) {
              case 'runtime':
                return (
                  <AccountRuntimeRouteSection
                    key={moduleID}
                    account={account}
                    routeDecisions={runtimeRouteDecisions}
                    span="wide"
                  />
                );
              case 'credentials':
                return (
                  <AccountCredentialVerifySection
                    key={moduleID}
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
                return <AuthFileSummarySection key={moduleID} account={account} />;
              case 'models':
                return (
                  <CompatibleModelsSection
                    key={moduleID}
                    account={account}
                    draft={configDraft}
                    setDraft={setConfigDraft}
                    modelNames={props.modelNames}
                    localModelNames={props.localModelNames}
                    cachedModelNames={props.cachedModelNames}
                    editable={isApiKey && Boolean(onSaveConfig)}
                    onFetchModels={props.onFetchModels}
                  />
                );
              case 'model-probe': {
                const canProbeOAuthAccount = account.credentialSource === 'auth-file' && account.id.startsWith('acct_');
                const modelOptions = normalizeAPIKeyModelNames([
                  ...(props.modelNames ?? []),
                  ...(props.localModelNames ?? []),
                  ...(account.models ?? []).map((model) => model.name),
                ]);
                return (
                  <OAuthModelProbeSection
                    key={moduleID}
                    accountID={account.id}
                    accountLabel={account.displayName}
                    modelOptions={modelOptions}
                    defaultModel={modelOptions[0] || 'gpt-5.4-mini'}
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
              case 'rate-limit':
                return (
                  <RateLimitSection
                    key={moduleID}
                    {...props}
                    rateLimitRulesRef={rateLimitRulesRef}
                    onRateLimitDirtyChange={setRateLimitDirty}
                  />
                );
              case 'quota': {
                const hasBillingModule = hasDisplayableBilling(liveBilling) || configDraft.billingEnabled;
                const showQuotaModule = configDraft.quotaEnabled || props.activeScriptEditor === 'quota';
                const showBillingModule = hasBillingModule || props.activeScriptEditor === 'billing';
                const showBalanceSplit = showQuotaModule && showBillingModule;
                const handleQuotaModuleToggle = (checked: boolean) => {
                  setConfigDraft((prev) => ({ ...prev, quotaEnabled: checked }));
                  if (!checked && props.activeScriptEditor === 'quota') {
                    props.onCloseScriptEditor?.();
                  }
                };
                const handleBillingModuleToggle = (checked: boolean) => {
                  setConfigDraft((prev) => ({ ...prev, billingEnabled: checked }));
                  if (!checked && props.activeScriptEditor === 'billing') {
                    props.onCloseScriptEditor?.();
                  }
                };
                const balanceRailControls = (
                  <div className="grid gap-2">
                    <label data-account-balance-rail-toggle="quota" className="flex items-center gap-2 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={configDraft.quotaEnabled}
                        onChange={(event) => handleQuotaModuleToggle(event.target.checked)}
                      />
                      <span>额度模块</span>
                    </label>
                    <label data-account-balance-rail-toggle="billing" className="flex items-center gap-2 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={hasBillingModule}
                        onChange={(event) => handleBillingModuleToggle(event.target.checked)}
                      />
                      <span>余额模块</span>
                    </label>
                  </div>
                );
                const quotaSection = (
                  <AccountQuotaSection
                    account={account}
                    draft={configDraft}
                    setDraft={setConfigDraft}
                    quotaState={quotaState}
                    editorOpen={props.activeScriptEditor === 'quota'}
                    onOpenEditor={() => props.onOpenScriptEditor?.('quota')}
                    onCloseEditor={props.onCloseScriptEditor}
                    onTestQuotaCurl={props.onTestQuotaCurl}
                    topBorder={false}
                    headerDivider={false}
                    layoutMode={showBalanceSplit ? 'stack' : 'split'}
                  />
                );
                const billingSection = (
                  <AccountBillingSection
                    account={account}
                    draft={configDraft}
                    setDraft={setConfigDraft}
                    liveBilling={liveBilling}
                    editorOpen={props.activeScriptEditor === 'billing'}
                    onOpenEditor={() => props.onOpenScriptEditor?.('billing')}
                    onCloseEditor={props.onCloseScriptEditor}
                    onTestBillingCurl={props.onTestBillingCurl}
                    topBorder={false}
                    headerDivider={false}
                  />
                );

                return (
                  <AccountDetailSection
                    key="quota-billing"
                    componentName="AccountBalanceSplitSection"
                    eyebrow="Balance"
                    title="余额与额度"
                    railControls={balanceRailControls}
                    bandActionDivider={false}
                  >
                    {showBalanceSplit ? (
                      <div data-account-balance-panel="quota-billing" className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <span data-account-balance-divider="full-height" className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-[var(--border-color)]" />
                        <div data-account-balance-pane="quota-left" className="min-w-0 pr-4">
                          {quotaSection}
                        </div>
                        <div data-account-balance-pane="billing-right" className="min-w-0 pl-4">
                          {billingSection}
                        </div>
                      </div>
                    ) : showQuotaModule ? (
                      <div data-account-balance-panel="quota-only" className="grid min-w-0">
                        <div data-account-balance-pane="quota-full" className="min-w-0">
                          {quotaSection}
                        </div>
                      </div>
                    ) : showBillingModule ? (
                      <div data-account-balance-panel="billing-only" className="grid min-w-0">
                        <div data-account-balance-pane="billing-full" className="min-w-0">
                          {billingSection}
                        </div>
                      </div>
                    ) : (
                      <AccountDetailEmptyState className="!border-0 !bg-transparent px-0 py-4 text-left !text-[length:var(--font-size-ui-xs)] !tracking-[0.08em]">
                        请选择左侧额度模块或余额模块
                      </AccountDetailEmptyState>
                    )}
                  </AccountDetailSection>
                );
              }
              case 'billing':
                return null;
              default:
                return null;
            }
          })}
        </AccountDetailModuleStack>
      </AccountDetailBody>
    </AccountDetailModalFrame>
  );
}

function AccountDetailStatusNotice({
  message,
}: {
  message: NonNullable<ReturnType<typeof buildAccountDetailStatusMessage>>;
}) {
  return (
    <AccountDetailNotice tone={message.tone} className="mx-6 mb-4 shrink-0">
      <div className="font-mono text-[length:var(--font-size-ui-2xs)] tracking-[0.18em]">
        {message.title}
      </div>
      <div className="mt-1 break-words font-mono text-[length:var(--font-size-ui-xs)] normal-case tracking-[0.06em]">
        {message.body}
      </div>
    </AccountDetailNotice>
  );
}

function RateLimitSection({
  account,
  rateLimitStatus,
  rateLimitStrategies,
  rateLimitRulesAPI,
  onRateLimitRulesChanged,
  rateLimitRulesRef,
  onRateLimitDirtyChange,
}: UnifiedAccountDetailProps & {
  rateLimitRulesRef: RefObject<RateLimitRulesSectionHandle>;
  onRateLimitDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <RateLimitRulesSection
      ref={rateLimitRulesRef}
      accountKey={account.id}
      rateLimitStatus={rateLimitStatus}
      rateLimitStrategies={rateLimitStrategies ?? []}
      rateLimitRulesAPI={rateLimitRulesAPI}
      onDirtyChange={onRateLimitDirtyChange}
      onRateLimitRulesChanged={onRateLimitRulesChanged ?? (() => {})}
      t={t}
    />
  );
}

function AuthFileSummarySection({ account }: { account: AccountRecord }) {
  const { trackRequest } = useDebug();
  const [rawContent, setRawContent] = useState('');
  const [sanitizedContent, setSanitizedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sanitizing, setSanitizing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!account.name) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        if (!hasWailsAppBindings()) {
          const content = getAccountsPreviewAuthFileContent(account.name!);
          if (cancelled) return;
          setRawContent(content);
          setLoading(false);
          return;
        }
        const result = await trackRequest('DownloadAuthFile', { name: account.name }, () => DownloadAuthFile(account.name!));
        if (cancelled) return;
        const decoded = decodeBase64Utf8(result?.contentBase64 ?? '');
        const pretty = parseMaybeJSON(decoded);
        setRawContent(typeof pretty === 'string' ? pretty : JSON.stringify(pretty, null, 2));
      } catch {
        // ignore detail read errors in modal
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [account.name, trackRequest]);

  async function handleSanitize() {
    setSanitizing(true);
    try {
      const result = await trackRequest('NormalizeAuthFileContent', { content: rawContent }, () => NormalizeAuthFileContent(rawContent));
      setSanitizedContent(result);
    } catch {
      // ignore sanitize errors in modal
    }
    setSanitizing(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sanitizedContent || rawContent);
      setCopyState('success');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
    }
  }

  const displayed = sanitizedContent || rawContent;

  return (
    <AccountDetailSection
      componentName="AuthFileSummarySection"
      eyebrow="Auth File"
      title="配置管理"
      bandActionDivider={false}
      actions={
        <>
          <button data-auth-file-config-action="preview" onClick={handleSanitize} disabled={sanitizing || loading} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
            {sanitizing ? '...' : '预览配置'}
          </button>
          <button data-auth-file-config-action="download" onClick={handleCopy} disabled={!displayed} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
            {copyState === 'success' ? '已下载' : copyState === 'error' ? '失败' : '下载配置'}
          </button>
          <button data-auth-file-config-action="apply" onClick={handleCopy} disabled={!displayed} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
            应用配置
          </button>
        </>
      }
    >
      <div data-auth-file-config-management="ui-placeholder" className="grid gap-3">
        <div className="space-y-2">
          <label className="grid gap-1.5">
            <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">账号名称</span>
            <input className="input-swiss font-mono !text-[length:var(--font-size-ui-xs)]" value={account.displayName} readOnly />
          </label>
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            配置预览
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AccountDetailPill>SQLite account store</AccountDetailPill>
            <AccountDetailPill>{sanitizedContent ? 'PREVIEW READY' : 'PREVIEW ON DEMAND'}</AccountDetailPill>
            <AccountDetailPill>{loading ? 'LOADING' : 'READY'}</AccountDetailPill>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 bg-[var(--border-color)]" />
          <div className="h-4 w-1/2 bg-[var(--border-color)]" />
        </div>
      ) : (
        <div className="border-2 border-dashed border-[var(--border-color)] px-3 py-2 font-mono text-[length:var(--font-size-ui-2xs)] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          配置预览基于账号数据库生成；可预览配置、下载配置，并在确认后应用到运行时。待接入 account-store management API。
        </div>
      )}
    </AccountDetailSection>
  );
}

function CompatibleModelsSection({
  account,
  draft,
  setDraft,
  modelNames = [],
  localModelNames = [],
  cachedModelNames = [],
  editable,
  onFetchModels,
}: {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  modelNames?: string[];
  localModelNames?: string[];
  cachedModelNames?: string[];
  editable: boolean;
  onFetchModels?: (input: { apiKey: string; baseUrl: string; headers?: Record<string, string> }) => Promise<{ models: string[]; message: string }>;
}) {
  const { trackRequest } = useDebug();
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteModelStatus, setRemoteModelStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [remoteModelMessage, setRemoteModelMessage] = useState('');
  const isAuthFile = account.credentialSource === 'auth-file';
  const defaultModelNames = useMemo(
    () => resolveDefaultModelMappingNames(account, draft),
    [account, draft.baseUrl, draft.label],
  );
  const sourceModelOptionNames = useMemo(
    () => normalizeAPIKeyModelNames([
      ...cachedModelNames,
      ...defaultModelNames,
      ...(account.models ?? []).map((model) => model.name),
      ...draft.models.map((model) => model.name),
    ]),
    [account.models, cachedModelNames, defaultModelNames, draft.models],
  );
  const aliasModelOptionNames = useMemo(
    () => normalizeAPIKeyModelNames(localModelNames),
    [localModelNames],
  );

  const staticModels = useMemo(() => {
    if (editable) {
      return draft.models;
    }
    const accountModels = account.models ?? [];
    if (accountModels.length > 0) {
      return accountModels;
    }
    return modelNames.map((name) => ({ name }));
  }, [account.models, draft.models, editable, modelNames]);

  const displayedModels = isAuthFile ? models : staticModels;

  useEffect(() => {
    if (!isAuthFile || !account.name) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        if (!hasWailsAppBindings()) {
          const previewModels = getAccountsPreviewAuthFileModels(account.name!);
          if (cancelled) return;
          setModels(previewModels);
          setLoading(false);
          return;
        }
        const result = await trackRequest('GetAuthFileModels', { name: account.name }, () => GetAuthFileModels(account.name!));
        if (cancelled) return;
        setModels((result as any)?.models ?? []);
      } catch {
        // Model catalog is optional detail metadata.
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [account.name, isAuthFile, trackRequest]);

  function onAddModelMapping() {
    const usedNames = new Set(draft.models.map((model) => String(model.name ?? '').trim()).filter(Boolean));
    const nextSourceName = sourceModelOptionNames.find((name) => !usedNames.has(name)) ?? sourceModelOptionNames[0] ?? '';
    const nextModels = [...draft.models, { name: nextSourceName, alias: '' }];
    setConfigDraftModels(setDraft, nextModels);
    setRemoteModelStatus('idle');
    setRemoteModelMessage(nextSourceName ? `已新增映射：${nextSourceName}` : '已新增空映射，可手动输入 source model');
  }

  function applyDefaultModelMappings() {
    if (sourceModelOptionNames.length === 0) {
      setRemoteModelStatus('error');
      setRemoteModelMessage('暂无当前账号支持模型，可先拉取模型或手动添加映射');
      return;
    }
    setConfigDraftModels(setDraft, sourceModelOptionNames.map((name) => ({ name, alias: '' })));
    setRemoteModelStatus('idle');
    setRemoteModelMessage(`已填入 ${sourceModelOptionNames.length} 个当前账号支持模型`);
  }

  async function fetchRemoteModelMappings() {
    if (!onFetchModels || !draft.apiKey.trim() || !draft.baseUrl.trim()) {
      setRemoteModelStatus('error');
      setRemoteModelMessage('缺少 API 密钥或基础 URL，无法拉取模型');
      return;
    }
    setRemoteModelStatus('loading');
    setRemoteModelMessage('');
    try {
      const result = await onFetchModels({
        apiKey: draft.apiKey.trim(),
        baseUrl: resolveManagementBaseUrl({ baseUrl: draft.baseUrl, formatBaseUrls: draft.formatBaseUrls }),
        headers: account.headers || {},
      });
      const nextNames = normalizeAPIKeyModelNames(result.models);
      setRemoteModelStatus('success');
      setRemoteModelMessage(result.message || `已缓存 ${nextNames.length} 个当前账号支持模型`);
    } catch (error) {
      setRemoteModelStatus('error');
      setRemoteModelMessage(toErrorMessage(error));
    }
  }

  function updateModelMapping(index: number, patch: { name?: string; alias?: string }) {
    const nextModels = draft.models.map((model, modelIndex) => (
      modelIndex === index ? { ...model, ...patch } : model
    ));
    setConfigDraftModels(setDraft, nextModels);
  }

  function removeModelMapping(index: number) {
    const nextModels = draft.models.filter((_, modelIndex) => modelIndex !== index);
    setConfigDraftModels(setDraft, nextModels);
  }

  return (
    <AccountDetailSection
      componentName="CompatibleModelsSection"
      eyebrow="Model Mapping"
      title="模型映射"
      meta={displayedModels.length > 0 ? `${displayedModels.length} 个模型` : undefined}
      bandActionDivider={false}
      actions={editable ? (
        <>
          <button
            type="button"
            onClick={() => void fetchRemoteModelMappings()}
            disabled={remoteModelStatus === 'loading' || !onFetchModels}
            className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]"
            aria-label="拉取模型"
            title="拉取模型"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${remoteModelStatus === 'loading' ? 'animate-spin' : ''}`} strokeWidth={4} />
          </button>
          <button
            type="button"
            onClick={applyDefaultModelMappings}
            className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]"
          >
            填入支持模型
          </button>
          <button type="button" onClick={onAddModelMapping} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
            添加映射
          </button>
        </>
      ) : undefined}
    >
      {editable && remoteModelMessage ? (
        <div
          data-account-model-fetch-status={remoteModelStatus}
          className={`font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] ${
            remoteModelStatus === 'error' ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
          }`}
        >
          {remoteModelMessage}
        </div>
      ) : null}
      {loading ? (
        <div className="h-4 w-1/3 animate-pulse bg-[var(--border-color)]" />
      ) : displayedModels.length === 0 ? (
        <AccountDetailEmptyState>
          {editable ? '暂无模型映射；可拉取模型后添加映射，或直接手动添加。' : '暂无模型数据'}
        </AccountDetailEmptyState>
      ) : (
        <div data-account-model-mapping-grid="source-route" className="grid gap-2 md:grid-cols-2">
          {displayedModels.map((model, index) => {
            const modelName = String(model.name ?? model.id ?? model.display_name ?? `MODEL ${index + 1}`);
            const routeLabel = String(model.alias ?? (isAuthFile ? 'oauth available' : modelName));
            return (
              <div key={index} data-account-model-mapping-card={editable ? 'editable' : 'readonly'} className="grid min-h-14 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_auto] items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-2">
                <div className="min-w-0">
                  {editable ? (
                    <div data-account-model-mapping-input="source">
                      <Combobox
                        value={modelName}
                        options={sourceModelOptionNames}
                        placeholder={sourceModelOptionNames[0] || modelName || '选择 Source Model'}
                        maxOptions={12}
                        onChange={(value) => updateModelMapping(index, { name: value })}
                      />
                    </div>
                  ) : (
                    <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">{modelName}</div>
                  )}
                </div>
                <div className="grid h-full place-items-center border-x border-dashed border-[var(--border-color)] text-[var(--text-muted)]">→</div>
                <div className="min-w-0">
                  {editable ? (
                    <div data-account-model-mapping-input="alias">
                      <Combobox
                        value={String(model.alias ?? '')}
                        options={aliasModelOptionNames}
                        placeholder={aliasModelOptionNames[0] || modelName || '选择 Alias Model'}
                        maxOptions={12}
                        onChange={(value) => updateModelMapping(index, { alias: value })}
                      />
                    </div>
                  ) : (
                    <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">{routeLabel}</div>
                  )}
                </div>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => removeModelMapping(index)}
                    className="btn-swiss !min-h-0 !px-1.5 !py-1 !text-[length:var(--font-size-ui-2xs)]"
                    aria-label="删除映射"
                    title="删除映射"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={3} />
                  </button>
                ) : (
                  <AccountDetailPill className="!min-h-0 !py-0.5 !text-[length:var(--font-size-ui-2xs)]">只读</AccountDetailPill>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AccountDetailSection>
  );
}

function setConfigDraftModels(
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>,
  nextModels: Array<{ name: string; alias?: string }>,
) {
  setDraft((prev) => ({ ...prev, models: nextModels }));
}

function resolveDefaultModelMappingNames(
  account: AccountRecord,
  draft: ApiKeyConfigDraft,
) {
  const accountModelNames = (account.models ?? []).map((model) => model.name);
  const presetID = resolveVendorPresetID(draft.label || account.displayName || account.provider, draft.baseUrl);
  const presetModelNames = presetID ? getVendorPreset(presetID)?.modelSuggestions ?? [] : [];
  return normalizeAPIKeyModelNames([
    ...accountModelNames,
    ...presetModelNames,
  ]);
}
