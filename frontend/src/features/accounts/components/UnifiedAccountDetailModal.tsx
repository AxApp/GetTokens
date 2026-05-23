import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
import type { AccountRecord } from '../../../types';
import { decodeBase64Utf8, parseMaybeJSON } from '../model/accountConfig';
import type { AccountUsageSummary } from '../model/accountUsage';
import {
  buildApiKeyConfigDraft,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import { buildQuotaDisplay, extractBilling } from '../model/accountQuota';
import { buildAccountDetailStatusMessage } from '../model/accountPresentation';
import type { RateLimitState, RateLimitStrategyMeta } from '../model/rateLimit';
import type { CodexQuotaState } from '../model/types';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import {
  AccountBillingSection,
  AccountCredentialsSection,
  AccountDetailFooter,
  AccountDetailHeader,
  AccountEvidenceSection,
  AccountQuotaSection,
  AccountRuntimeSnapshotSection,
  AccountVerifySection,
  type APIKeyVerifyState,
} from './AccountDetailSections';
import {
  AccountDetailBody,
  AccountDetailEmptyState,
  AccountDetailModuleStack,
  AccountDetailOverviewGrid,
  AccountDetailNotice,
  AccountDetailPill,
  AccountDetailSection,
} from './AccountDetailPrimitives';
import AccountProxyRouteSection from './AccountProxyRouteSection';
import RateLimitRulesSection, { type RateLimitRulesSectionHandle } from './RateLimitRulesSection';

export type { APIKeyVerifyState } from './AccountDetailSections';

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

export default function UnifiedAccountDetailModal(props: UnifiedAccountDetailProps) {
  const { account, onClose, onSaveConfig, quotaState } = props;
  const { t } = useI18n();
  const isApiKey = account.credentialSource === 'api-key';
  const isAuthFile = account.credentialSource === 'auth-file';
  const [configDraft, setConfigDraft] = useState<ApiKeyConfigDraft>(() => buildApiKeyConfigDraft(account));
  const [proxyRouteError, setProxyRouteError] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
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
    account.prefix,
    account.quotaCurl,
    account.quotaEnabled,
    account.billingCurl,
    account.billingEnabled,
    account.proxyUrl,
    isApiKey,
  ]);

  useEffect(() => {
    setRateLimitDirty(false);
  }, [account.id]);

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
  const quotaDisplay = useMemo(
    () => buildQuotaDisplay(account, quotaState),
    [account, quotaState],
  );
  const statusMessage = useMemo(
    () => buildAccountDetailStatusMessage(account, t),
    [account, t],
  );

  async function saveConfig() {
    if (savingConfig || missingFields.length > 0) {
      return;
    }
    setSavingConfig(true);
    try {
      if (isApiKey && configDirty && onSaveConfig) {
        await onSaveConfig(configDraft);
      }
      if (rateLimitDirty) {
        await rateLimitRulesRef.current?.save();
      }
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <AccountDetailModalFrame
      onClose={onClose}
      header={<AccountDetailHeader {...props} />}
      error={statusMessage ? <AccountDetailStatusNotice message={statusMessage} /> : undefined}
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
        <AccountDetailOverviewGrid
          runtime={
            <AccountRuntimeSnapshotSection
              usageSummary={props.usageSummary}
              quotaDisplay={quotaDisplay}
              billing={liveBilling}
            />
          }
          evidence={
            <AccountEvidenceSection
              account={account}
              usageSummary={props.usageSummary}
            />
          }
        />
        <AccountDetailModuleStack layout="cards">
          {isApiKey ? (
            <AccountCredentialsSection
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
          <RateLimitSection
            {...props}
            rateLimitRulesRef={rateLimitRulesRef}
            onRateLimitDirtyChange={setRateLimitDirty}
          />
          {isApiKey ? (
            <AccountVerifySection
              draft={configDraft}
              verifyState={props.verifyState}
              modelNames={props.modelNames}
              onVerify={props.onVerify}
            />
          ) : null}
          {isApiKey ? (
            <AccountQuotaSection
              account={account}
              draft={configDraft}
              setDraft={setConfigDraft}
              quotaState={quotaState}
              onTestQuotaCurl={props.onTestQuotaCurl}
            />
          ) : null}
          {isApiKey ? (
            <AccountBillingSection
              account={account}
              draft={configDraft}
              setDraft={setConfigDraft}
              liveBilling={liveBilling}
              onTestBillingCurl={props.onTestBillingCurl}
            />
          ) : null}
          {isAuthFile ? <CompatibleModelsSection account={account} /> : null}
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

function tReadonlyProxyReason(account: AccountRecord) {
  if (account.credentialSource === 'auth-file') {
    return 'AUTH FILE 暂不支持账号级出口写入；当前请求仍按全局或 sidecar 默认出口处理。';
  }
  return '当前账号类型暂不支持账号级出口配置。';
}

function RateLimitSection({
  account,
  usageSummary,
  rateLimitStatus,
  rateLimitStrategies,
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
      matchKey={usageSummary?.attributionKey}
      rateLimitStatus={rateLimitStatus}
      rateLimitStrategies={rateLimitStrategies ?? []}
      rateLimitRulesAPI={{
        list: ListRateLimitRules,
        create: CreateRateLimitRule,
        update: UpdateRateLimitRule,
        delete: DeleteRateLimitRule,
      }}
      onDirtyChange={onRateLimitDirtyChange}
      onRateLimitRulesChanged={onRateLimitRulesChanged ?? (() => {})}
      t={t}
    />
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
    <AccountDetailSection
      componentName="AuthFileContentSection"
      eyebrow="Auth File"
      title={viewMode === 'sanitized' ? 'Sanitized Content' : 'Raw Content'}
      span="wide"
      actions={
        <>
          <button onClick={handleSanitize} disabled={sanitizing || loading} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
            {sanitizing ? '...' : viewMode === 'sanitized' ? 'Show Raw' : 'Sanitize'}
          </button>
          <button onClick={handleCopy} disabled={!displayed} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
            {copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Error' : 'Copy'}
          </button>
        </>
      }
    >

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
          className="max-h-64 cursor-pointer select-all overflow-auto border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 font-mono text-[length:var(--font-size-ui-2xs)] leading-relaxed text-[var(--text-primary)]"
          tabIndex={0}
        >
          {displayed || '(empty)'}
        </pre>
      )}
    </AccountDetailSection>
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
    <AccountDetailSection componentName="CompatibleModelsSection" eyebrow="Model Catalog" title="Compatible Models" span="wide">
      {loading ? (
        <div className="h-4 w-1/3 animate-pulse bg-[var(--border-color)]" />
      ) : models.length === 0 ? (
        <AccountDetailEmptyState>No models data</AccountDetailEmptyState>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {models.map((model, index) => (
            <AccountDetailPill key={index}>
              {model.name ?? model.display_name ?? `Model ${index + 1}`}
            </AccountDetailPill>
          ))}
        </div>
      )}
    </AccountDetailSection>
  );
}
