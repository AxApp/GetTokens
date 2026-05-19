import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  CreateRateLimitRule,
  DeleteRateLimitRule,
  DownloadAuthFile,
  GetAuthFileModels,
  ListRateLimitRules,
  NormalizeAuthFileContent,
  UpdateRateLimitRule,
} from '../../../../wailsjs/go/main/App';
import { useDebug } from '../../../context/DebugContext';
import { useI18n } from '../../../context/I18nContext';
import type { AccountRecord, ApiFormat, BillingDisplay } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import { decodeBase64Utf8, parseMaybeJSON } from '../model/accountConfig';
import type { AccountUsageSummary } from '../model/accountUsage';
import {
  buildApiKeyConfigDraft,
  buildBillingCurlTemplate,
  buildQuotaCurlTemplate,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import {
  extractBilling,
  selectQuotaWindows,
} from '../model/accountQuota';
import {
  resolveAccountPrimaryLabel,
  resolveAccountOperationalState,
} from '../model/accountPresentation';
import type { RateLimitState, RateLimitStrategyMeta } from '../model/rateLimit';
import type { CodexQuotaState } from '../model/types';
import { formatLabel } from '../model/vendorPresetHelpers';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import AccountProxyRouteSection from './AccountProxyRouteSection';
import { BillingBalance } from './CardSections';
import RateLimitRulesSection from './RateLimitRulesSection';

export interface UnifiedAccountDetailProps {
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  onClose: () => void;
  onRename?: (nextName: string) => void;
  onSaveConfig?: (draft: ApiKeyConfigDraft) => Promise<void>;
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string }) => Promise<any>;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string }) => Promise<any>;
  onRateLimitRulesChanged?: () => void;
  onStartReauth?: () => void;
  onCancelReauth?: () => void;
  isReauthing?: boolean;
}

export interface APIKeyVerifyState {
  model: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  lastVerifiedAt: number | null;
}

const DEFAULT_VERIFY_MODEL = 'gpt-5.4-mini';

export default function UnifiedAccountDetailModal(props: UnifiedAccountDetailProps) {
  const { account, onClose, onSaveConfig, quotaState } = props;
  const isApiKey = account.credentialSource === 'api-key';
  const isAuthFile = account.credentialSource === 'auth-file';
  const [configDraft, setConfigDraft] = useState<ApiKeyConfigDraft>(() => buildApiKeyConfigDraft(account));
  const [proxyRouteError, setProxyRouteError] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (!isApiKey) {
      return;
    }
    setConfigDraft(buildApiKeyConfigDraft(account));
  }, [
    account.id,
    account.apiKey,
    account.baseUrl,
    account.prefix,
    account.quotaCurl,
    account.quotaEnabled,
    account.billingCurl,
    account.billingEnabled,
    account.proxyUrl,
    isApiKey,
  ]);

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

  async function saveConfig() {
    if (!isApiKey || !onSaveConfig || savingConfig || missingFields.length > 0) {
      return;
    }
    setSavingConfig(true);
    try {
      await onSaveConfig(configDraft);
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <AccountDetailModalFrame
      onClose={onClose}
      header={<DetailHeader {...props} />}
      footer={
        <DetailFooter
          isApiKey={isApiKey}
          configDirty={configDirty}
          missingFields={missingFields}
          savingConfig={savingConfig}
          onClose={onClose}
          onSaveConfig={saveConfig}
        />
      }
    >
      <div className="space-y-6 p-6">
        {isApiKey ? (
          <CredentialsSection
            draft={configDraft}
            setDraft={setConfigDraft}
          />
        ) : null}
        {isAuthFile ? <AuthFileContentSection account={account} /> : null}
        <AccountProxyRouteSection
          proxyUrl={isApiKey ? configDraft.proxyUrl : account.proxyUrl}
          readonlyReason={isApiKey ? undefined : tReadonlyProxyReason(account)}
          onProxyUrlChange={(nextProxyURL) => setConfigDraft((prev) => ({ ...prev, proxyUrl: nextProxyURL }))}
          onValidityChange={setProxyRouteError}
        />
        <RateLimitSection {...props} />
        {isApiKey ? (
          <VerifySection
            draft={configDraft}
            verifyState={props.verifyState}
            modelNames={props.modelNames}
            onVerify={props.onVerify}
          />
        ) : null}
        {isApiKey ? (
          <QuotaSection
            account={account}
            draft={configDraft}
            setDraft={setConfigDraft}
            quotaState={quotaState}
            onTestQuotaCurl={props.onTestQuotaCurl}
          />
        ) : null}
        {isApiKey ? (
          <BillingSection
            account={account}
            draft={configDraft}
            setDraft={setConfigDraft}
            liveBilling={liveBilling}
            onTestBillingCurl={props.onTestBillingCurl}
          />
        ) : null}
        {isAuthFile ? <CompatibleModelsSection account={account} /> : null}
      </div>
    </AccountDetailModalFrame>
  );
}

function tReadonlyProxyReason(account: AccountRecord) {
  if (account.credentialSource === 'auth-file') {
    return 'AUTH FILE 暂不支持账号级出口写入；当前请求仍按全局或 sidecar 默认出口处理。';
  }
  return '当前账号类型暂不支持账号级出口配置。';
}

function DetailHeader({
  account,
  usageSummary,
  onRename,
  onStartReauth,
  onCancelReauth,
  isReauthing,
}: UnifiedAccountDetailProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(account.displayName);

  useEffect(() => {
    setDraftName(account.displayName);
  }, [account.displayName]);

  const primaryLabel = resolveAccountPrimaryLabel(account);
  const operationalState = resolveAccountOperationalState(account, usageSummary, undefined, t);
  const canReauth = account.credentialSource === 'auth-file' && account.provider === 'codex';
  const formats = (account.supportedFormats && account.supportedFormats.length > 0
    ? account.supportedFormats
    : ['anthropic']) as ApiFormat[];

  function saveName() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== account.displayName) {
      onRename?.(trimmed);
    }
    setEditing(false);
  }

  return (
    <div className="space-y-3">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
        {account.credentialSource === 'auth-file' ? 'AUTH FILE' : 'API KEY'}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {editing ? (
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveName();
                if (event.key === 'Escape') setEditing(false);
              }}
              className="input-swiss text-lg font-black uppercase"
              autoFocus
            />
          ) : (
            <button
              onClick={() => (onRename ? setEditing(true) : null)}
              className={`text-lg font-black uppercase italic tracking-tight ${onRename ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
            >
              {primaryLabel}
            </button>
          )}
          <span
            className={`border px-2 py-0.5 text-[0.5625rem] font-black uppercase tracking-[0.12em] ${
              operationalState.tone === 'positive'
                ? 'border-green-600 text-green-600'
                : operationalState.tone === 'warning'
                  ? 'border-yellow-500 text-yellow-500'
                  : 'border-red-500 text-red-500'
            }`}
          >
            {operationalState.label}
          </span>
        </div>

        {canReauth ? (
          <button onClick={isReauthing ? onCancelReauth : onStartReauth} className="btn-swiss whitespace-nowrap !text-[0.5625rem]">
            {isReauthing ? t('accounts.cancel_reauth') : t('accounts.reauth')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {account.provider.toUpperCase()}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {formats.map((fmt) => (
            <span key={fmt} className="border border-[var(--border-color)] px-2 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {formatLabel(fmt)}
            </span>
          ))}
        </div>
      </div>

      {account.baseUrl ? (
        <div className="truncate text-[0.5625rem] font-mono text-[var(--text-muted)]">
          {account.baseUrl}
        </div>
      ) : null}

      {account.formatBaseUrls && Object.keys(account.formatBaseUrls).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(account.formatBaseUrls).map(([fmt, url]) => (
            <div key={fmt} className="text-[0.5rem] font-mono text-[var(--text-muted)]">
              <span className="font-black uppercase text-[var(--text-primary)]">{formatLabel(fmt as ApiFormat)}:</span>{' '}
              <span className="truncate">{String(url)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CredentialsSection({
  draft,
  setDraft,
}: {
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Credentials
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">API Key</span>
          <div className="flex gap-2">
            <input
              value={draft.apiKey}
              onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
              className="input-swiss flex-1 font-mono"
            />
            <button onClick={() => void navigator.clipboard.writeText(draft.apiKey)} className="btn-swiss !px-2 !py-1 !text-[0.5rem]">
              Copy
            </button>
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Base URL</span>
          <div className="flex gap-2">
            <input
              value={draft.baseUrl}
              onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
              className="input-swiss flex-1 font-mono"
            />
            <button onClick={() => void navigator.clipboard.writeText(draft.baseUrl)} className="btn-swiss !px-2 !py-1 !text-[0.5rem]">
              Copy
            </button>
          </div>
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Prefix</span>
        <input
          value={draft.prefix}
          onChange={(event) => setDraft((prev) => ({ ...prev, prefix: event.target.value }))}
          className="input-swiss w-full font-mono"
          placeholder="/v1"
        />
      </label>
    </section>
  );
}

function RateLimitSection({
  account,
  usageSummary,
  rateLimitStatus,
  rateLimitStrategies,
  onRateLimitRulesChanged,
}: UnifiedAccountDetailProps) {
  const { t } = useI18n();

  return (
    <RateLimitRulesSection
      accountKey={account.id}
      matchKey={usageSummary?.attributionKey}
      rateLimitStatus={rateLimitStatus}
      rateLimitStrategies={rateLimitStrategies ?? []}
      rateLimitRulesAPI={{
        list: ListRateLimitRules,
        create: CreateRateLimitRule,
        update: UpdateRateLimitRule,
        delete: DeleteRateLimitRule,
      }}
      onRateLimitRulesChanged={onRateLimitRulesChanged ?? (() => {})}
      t={t}
    />
  );
}

function VerifySection({
  draft,
  verifyState,
  modelNames,
  onVerify,
}: {
  draft: ApiKeyConfigDraft;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
}) {
  const [verifyModel, setVerifyModel] = useState(DEFAULT_VERIFY_MODEL);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelMenuMode, setModelMenuMode] = useState<'all' | 'custom'>('all');

  useEffect(() => {
    if (verifyState?.model) {
      setVerifyModel(verifyState.model);
    }
  }, [verifyState?.model]);

  const displayedModelNames = useMemo(() => {
    if (!modelNames || modelNames.length === 0) return [];
    if (modelMenuMode === 'all') return modelNames;
    return modelNames.filter((name) => name.toLowerCase().includes(verifyModel.toLowerCase()));
  }, [modelMenuMode, modelNames, verifyModel]);

  const vs = verifyState ?? {
    model: verifyModel,
    status: 'idle' as const,
    message: '',
    lastVerifiedAt: null,
  };

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    }
    if (isModelMenuOpen) {
      window.addEventListener('mousedown', handlePointerDown);
      return () => window.removeEventListener('mousedown', handlePointerDown);
    }
  }, [isModelMenuOpen]);

  return (
    <section className="space-y-3">
      <h3 className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Verify Connection
      </h3>

      {vs.lastVerifiedAt ? (
        <div className="text-[0.5rem] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Last verified: {new Date(vs.lastVerifiedAt).toLocaleString()}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <div ref={modelMenuRef} className="relative flex-1">
          <div className="flex items-center gap-2">
            <input
              value={verifyModel}
              onChange={(event) => {
                setVerifyModel(event.target.value);
                setModelMenuMode('custom');
              }}
              onFocus={() => setIsModelMenuOpen(true)}
              className="input-swiss flex-1 font-mono !text-[0.5625rem]"
              placeholder={DEFAULT_VERIFY_MODEL}
            />
            {modelNames && modelNames.length > 0 ? (
              <button onClick={() => setIsModelMenuOpen((prev) => !prev)} className="btn-swiss !px-2 !py-1 !text-[0.5rem]">
                ▼
              </button>
            ) : null}
          </div>
          {isModelMenuOpen && displayedModelNames.length > 0 ? (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-auto border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard">
              {displayedModelNames.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setVerifyModel(name);
                    setIsModelMenuOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[0.5625rem] font-black uppercase tracking-[0.12em] transition-colors ${
                    verifyModel === name
                      ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          onClick={() => onVerify?.({ apiKey: draft.apiKey, baseUrl: draft.baseUrl, model: verifyModel })}
          disabled={vs.status === 'loading'}
          className="btn-swiss whitespace-nowrap !text-[0.5625rem]"
        >
          {vs.status === 'loading' ? 'Verifying...' : 'Verify'}
        </button>
      </div>

      {vs.status !== 'idle' ? (
        <div className={`text-[0.5625rem] font-black uppercase tracking-wide ${
          vs.status === 'success' ? 'text-green-600' : vs.status === 'error' ? 'text-red-500' : 'text-[var(--text-muted)]'
        }`}>
          {vs.message}
        </div>
      ) : null}
    </section>
  );
}

function QuotaSection({
  account,
  draft,
  setDraft,
  quotaState,
  onTestQuotaCurl,
}: {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  quotaState?: CodexQuotaState;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string }) => Promise<any>;
}) {
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const liveWindows = quotaState?.quota ? selectQuotaWindows(quotaState.quota) : [];

  useEffect(() => {
    setTestStatus('idle');
    setTestMessage('');
    setTestResult(null);
  }, [account.id]);

  async function runQuotaTest() {
    if (!onTestQuotaCurl || !draft.quotaCurl.trim()) return;
    setTestStatus('loading');
    setTestMessage('');
    try {
      const result = await onTestQuotaCurl({
        apiKey: draft.apiKey,
        baseUrl: draft.baseUrl,
        prefix: draft.prefix,
        quotaCurl: draft.quotaCurl.trim(),
      });
      setTestResult(result);
      setTestStatus('success');
    } catch (error) {
      setTestMessage(toErrorMessage(error));
      setTestStatus('error');
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Quota Tracking
        </h3>
        {liveWindows.length > 0 ? (
          <span className="text-[0.5rem] font-black uppercase tracking-[0.12em] text-green-600">
            Live {liveWindows.length} windows
          </span>
        ) : null}
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.quotaEnabled}
          onChange={(event) => setDraft((prev) => ({ ...prev, quotaEnabled: event.target.checked }))}
        />
        <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Enable</span>
      </label>

      <textarea
        value={draft.quotaCurl}
        onChange={(event) => setDraft((prev) => ({ ...prev, quotaCurl: event.target.value }))}
        className="input-swiss min-h-20 w-full resize-y font-mono !text-[0.5625rem]"
        placeholder='curl -sS "https://api.example.com/usage" -H "Authorization: Bearer {{apiKey}}"'
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setDraft((prev) => ({
            ...prev,
            quotaCurl: buildQuotaCurlTemplate({
              displayName: account.displayName,
              provider: account.provider,
              baseUrl: draft.baseUrl,
            }),
            quotaEnabled: true,
          }))}
          className="btn-swiss !text-[0.5rem]"
        >
          Use Template
        </button>
        <button onClick={runQuotaTest} disabled={testStatus === 'loading' || !draft.quotaCurl.trim()} className="btn-swiss !text-[0.5rem]">
          {testStatus === 'loading' ? 'Testing...' : 'Test'}
        </button>
      </div>

      {testStatus === 'success' && testResult ? (
        <div className="text-[0.5625rem] font-black uppercase text-green-600">
          OK — {testResult.planType ?? 'quota'} {testResult.windows?.length ? `${testResult.windows.length} windows` : ''}
        </div>
      ) : null}
      {testStatus === 'error' ? (
        <div className="text-[0.5625rem] font-black uppercase text-red-500">{testMessage}</div>
      ) : null}
    </section>
  );
}

function BillingSection({
  account,
  draft,
  setDraft,
  liveBilling,
  onTestBillingCurl,
}: {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  liveBilling?: BillingDisplay;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string }) => Promise<any>;
}) {
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testBilling, setTestBilling] = useState<BillingDisplay | undefined>(undefined);
  const billingTemplate = useMemo(
    () => buildBillingCurlTemplate({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: draft.baseUrl,
    }),
    [account.displayName, account.provider, draft.baseUrl],
  );

  useEffect(() => {
    setTestStatus('idle');
    setTestMessage('');
    setTestBilling(undefined);
  }, [account.id]);

  async function runBillingTest() {
    if (!onTestBillingCurl || !draft.billingCurl.trim()) return;
    setTestStatus('loading');
    setTestMessage('');
    try {
      const result = await onTestBillingCurl({
        apiKey: draft.apiKey,
        baseUrl: draft.baseUrl,
        prefix: draft.prefix,
        billingCurl: draft.billingCurl.trim(),
      });
      const nextBilling = normalizeBillingDisplay(result);
      setTestBilling(nextBilling);
      setTestStatus('success');
      if (!nextBilling) {
        setTestMessage('Billing endpoint returned no balance data');
      }
    } catch (error) {
      setTestMessage(toErrorMessage(error));
      setTestStatus('error');
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Balance
        </h3>
        {liveBilling ? (
          <span className="text-[0.5rem] font-black uppercase tracking-[0.12em] text-green-600">
            Live billing ready
          </span>
        ) : null}
      </div>

      {liveBilling ? (
        <div className="border-2 border-[var(--border-color)]">
          <BillingBalance billing={liveBilling} />
        </div>
      ) : (
        <div className="border-2 border-dashed border-[var(--border-color)] px-4 py-3 text-[0.5625rem] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
          No balance data is currently available for this account.
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.billingEnabled}
          onChange={(event) => setDraft((prev) => ({ ...prev, billingEnabled: event.target.checked }))}
        />
        <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Enable Billing</span>
      </label>

      <textarea
        value={draft.billingCurl}
        onChange={(event) => setDraft((prev) => ({ ...prev, billingCurl: event.target.value }))}
        className="input-swiss min-h-20 w-full resize-y font-mono !text-[0.5625rem]"
        placeholder={billingTemplate || 'curl -sS "https://api.example.com/billing" -H "Authorization: Bearer {{apiKey}}"'}
      />

      <div className="flex flex-wrap items-center gap-2">
        {billingTemplate ? (
          <button
            onClick={() => setDraft((prev) => ({ ...prev, billingCurl: billingTemplate, billingEnabled: true }))}
            className="btn-swiss !text-[0.5rem]"
          >
            Use Vendor Template
          </button>
        ) : null}
        <button onClick={runBillingTest} disabled={testStatus === 'loading' || !draft.billingCurl.trim()} className="btn-swiss !text-[0.5rem]">
          {testStatus === 'loading' ? 'Testing...' : 'Test Billing'}
        </button>
      </div>

      {testStatus === 'success' && testBilling ? (
        <div className="border-2 border-[var(--border-color)]">
          <BillingBalance billing={testBilling} />
        </div>
      ) : null}
      {testStatus === 'success' && testMessage ? (
        <div className="text-[0.5625rem] font-black uppercase text-[var(--text-muted)]">{testMessage}</div>
      ) : null}
      {testStatus === 'error' ? (
        <div className="text-[0.5625rem] font-black uppercase text-red-500">{testMessage}</div>
      ) : null}
    </section>
  );
}

function AuthFileContentSection({ account }: { account: AccountRecord }) {
  const { trackRequest } = useDebug();
  const [rawContent, setRawContent] = useState('');
  const [sanitizedContent, setSanitizedContent] = useState('');
  const [viewMode, setViewMode] = useState<'raw' | 'sanitized'>('raw');
  const [loading, setLoading] = useState(false);
  const [sanitizing, setSanitizing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!account.name) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
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
    if (rawContent === sanitizedContent && viewMode === 'sanitized') {
      setViewMode('raw');
      return;
    }
    setSanitizing(true);
    try {
      const result = await trackRequest('NormalizeAuthFileContent', { content: rawContent }, () => NormalizeAuthFileContent(rawContent));
      setSanitizedContent(result);
      setViewMode('sanitized');
    } catch {
      // ignore sanitize errors in modal
    }
    setSanitizing(false);
  }

  async function handleCopy() {
    const displayed = viewMode === 'sanitized' && sanitizedContent ? sanitizedContent : rawContent;
    try {
      await navigator.clipboard.writeText(displayed);
      setCopyState('success');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
    }
  }

  const displayed = viewMode === 'sanitized' && sanitizedContent ? sanitizedContent : rawContent;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {viewMode === 'sanitized' ? 'Sanitized Content' : 'Raw Content'}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={handleSanitize} disabled={sanitizing || loading} className="btn-swiss !px-2 !py-1 !text-[0.5rem]">
            {sanitizing ? '...' : viewMode === 'sanitized' ? 'Show Raw' : 'Sanitize'}
          </button>
          <button onClick={handleCopy} disabled={!displayed} className="btn-swiss !px-2 !py-1 !text-[0.5rem]">
            {copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Error' : 'Copy'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 bg-[var(--border-color)]" />
          <div className="h-4 w-1/2 bg-[var(--border-color)]" />
        </div>
      ) : (
        <pre
          onClick={() => void handleCopy()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') void handleCopy();
          }}
          className="max-h-64 cursor-pointer select-all overflow-auto border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 font-mono text-[0.5rem] leading-relaxed text-[var(--text-primary)]"
          tabIndex={0}
        >
          {displayed || '(empty)'}
        </pre>
      )}
    </section>
  );
}

function CompatibleModelsSection({ account }: { account: AccountRecord }) {
  const { trackRequest } = useDebug();
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account.name) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const result = await trackRequest('GetAuthFileModels', { name: account.name }, () => GetAuthFileModels(account.name!));
        if (cancelled) return;
        setModels((result as any)?.models ?? []);
      } catch {
        // ignore models read errors in modal
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [account.name, trackRequest]);

  return (
    <section className="space-y-3">
      <h3 className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Compatible Models
      </h3>
      {loading ? (
        <div className="h-4 w-1/3 animate-pulse bg-[var(--border-color)]" />
      ) : models.length === 0 ? (
        <div className="text-[0.5rem] text-[var(--text-muted)]">No models data</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {models.map((model, index) => (
            <span key={index} className="border border-[var(--border-color)] px-2 py-0.5 text-[0.5rem] font-black uppercase text-[var(--text-primary)]">
              {model.name ?? model.display_name ?? `Model ${index + 1}`}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function DetailFooter({
  isApiKey,
  configDirty,
  missingFields,
  savingConfig,
  onClose,
  onSaveConfig,
}: {
  isApiKey: boolean;
  configDirty: boolean;
  missingFields: string[];
  savingConfig: boolean;
  onClose: () => void;
  onSaveConfig: () => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {isApiKey && missingFields.length > 0
          ? `Missing: ${missingFields.join(', ')}`
          : isApiKey && configDirty
            ? 'Unsaved account config changes'
            : ''}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="btn-swiss text-[0.5625rem]">
          {t('common.close')}
        </button>
        {isApiKey ? (
          <button
            onClick={onSaveConfig}
            disabled={!configDirty || missingFields.length > 0 || savingConfig}
            className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] !text-[0.5625rem]"
          >
            {savingConfig ? 'Saving...' : 'Save Changes'}
          </button>
        ) : null}
      </div>
    </>
  );
}

function normalizeBillingDisplay(result: any): BillingDisplay | undefined {
  if (!result?.isAvailable || !Array.isArray(result.balanceInfos) || result.balanceInfos.length === 0) {
    return undefined;
  }
  return {
    isAvailable: true,
    balances: result.balanceInfos.map((info: any) => ({
      currency: info?.currency ?? '',
      totalBalance: info?.totalBalance ?? '0',
      grantedBalance: info?.grantedBalance ?? '0',
      toppedUpBalance: info?.toppedUpBalance ?? '0',
    })),
  };
}
