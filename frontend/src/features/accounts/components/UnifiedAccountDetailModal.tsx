import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  DownloadAuthFile,
  GetAuthFileModels,
  NormalizeAuthFileContent,
} from '../../../../wailsjs/go/main/App';
import { useDebug } from '../../../context/useDebug';
import { useI18n } from '../../../context/I18nContext';
import type { AccountRecord } from '../../../types';
import type { AccountDetailScriptRoute } from '../../../utils/pagePersistence';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { decodeBase64Utf8, parseMaybeJSON } from '../model/accountConfig';
import type { AccountUsageSummary } from '../model/accountUsage';
import {
  buildApiKeyConfigDraft,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import { buildAccountDetailModulePlan } from '../model/accountDetailLayout';
import { buildQuotaDisplay, extractBilling } from '../model/accountQuota';
import { buildAccountDetailStatusMessage } from '../model/accountPresentation';
import type { RateLimitState, RateLimitStrategyMeta } from '../model/rateLimit';
import type { CodexQuotaState } from '../model/types';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import {
  AccountBillingSection,
  AccountCredentialVerifySection,
  AccountDetailFooter,
  AccountDetailHeader,
  AccountQuotaSection,
  AccountRuntimeEvidenceSection,
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

export type { APIKeyVerifyState } from './AccountDetailSections';

export interface UnifiedAccountDetailProps {
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  onClose: () => void;
  onRename?: (nextName: string) => void;
  onSaveConfig?: (draft: ApiKeyConfigDraft) => Promise<void>;
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string }) => Promise<any>;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string }) => Promise<any>;
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
        const saved = await rateLimitRulesRef.current?.save();
        if (saved === false) {
          return;
        }
      }
      onClose();
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
        <AccountRuntimeEvidenceSection
          account={account}
          usageSummary={props.usageSummary}
          quotaDisplay={quotaDisplay}
          billing={liveBilling}
        />
        <AccountDetailModuleStack layout="cards">
          {buildAccountDetailModulePlan(account).map((moduleID) => {
            switch (moduleID) {
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
                return <CompatibleModelsSection key={moduleID} account={account} />;
              case 'rate-limit':
                return (
                  <RateLimitSection
                    key={moduleID}
                    {...props}
                    rateLimitRulesRef={rateLimitRulesRef}
                    onRateLimitDirtyChange={setRateLimitDirty}
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
                    editorOpen={props.activeScriptEditor === 'quota'}
                    onOpenEditor={() => props.onOpenScriptEditor?.('quota')}
                    onCloseEditor={props.onCloseScriptEditor}
                    onTestQuotaCurl={props.onTestQuotaCurl}
                  />
                );
              case 'billing':
                return (
                  <AccountBillingSection
                    key={moduleID}
                    account={account}
                    draft={configDraft}
                    setDraft={setConfigDraft}
                    liveBilling={liveBilling}
                    editorOpen={props.activeScriptEditor === 'billing'}
                    onOpenEditor={() => props.onOpenScriptEditor?.('billing')}
                    onCloseEditor={props.onCloseScriptEditor}
                    onTestBillingCurl={props.onTestBillingCurl}
                  />
                );
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
      title="文件摘要"
      actions={
        <>
          <button onClick={handleSanitize} disabled={sanitizing || loading} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
            {sanitizing ? '...' : '脱敏'}
          </button>
          <button onClick={handleCopy} disabled={!displayed} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
            {copyState === 'success' ? '已复制' : copyState === 'error' ? '失败' : '复制'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="space-y-2">
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {account.name || 'UNKNOWN FILE'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AccountDetailPill>RAW HIDDEN</AccountDetailPill>
            <AccountDetailPill>{sanitizedContent ? 'SANITIZED READY' : 'SANITIZE ON DEMAND'}</AccountDetailPill>
            <AccountDetailPill>{loading ? 'LOADING' : 'READY'}</AccountDetailPill>
          </div>
        </div>
        <button onClick={handleCopy} disabled={!displayed} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
          {copyState === 'success' ? '已复制' : copyState === 'error' ? '失败' : '复制原文'}
        </button>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 bg-[var(--border-color)]" />
          <div className="h-4 w-1/2 bg-[var(--border-color)]" />
        </div>
      ) : (
        <div className="border-2 border-dashed border-[var(--border-color)] px-3 py-2 font-mono text-[length:var(--font-size-ui-2xs)] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          默认不展开原始内容；需要时可复制原文或先脱敏再复制。
        </div>
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
  }, [account.name, trackRequest]);

  return (
    <AccountDetailSection
      componentName="CompatibleModelsSection"
      eyebrow="Model Catalog"
      title="模型目录"
      meta={models.length > 0 ? `${models.length} 个模型` : undefined}
    >
      {loading ? (
        <div className="h-4 w-1/3 animate-pulse bg-[var(--border-color)]" />
      ) : models.length === 0 ? (
        <AccountDetailEmptyState>暂无模型数据</AccountDetailEmptyState>
      ) : (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-auto pr-1">
          {models.map((model, index) => (
            <AccountDetailPill key={index}>
              {model.name ?? model.display_name ?? `MODEL ${index + 1}`}
            </AccountDetailPill>
          ))}
        </div>
      )}
    </AccountDetailSection>
  );
}
