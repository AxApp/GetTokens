import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AccountRecord, ApiFormat, BillingDisplay } from '../../../types';
import { useI18n } from '../../../context/I18nContext';
import { toErrorMessage } from '../../../utils/error';
import {
  buildBillingCurlTemplate,
  buildQuotaCurlTemplate,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import { formatQuotaResetDisplayWithUnix, selectQuotaWindows } from '../model/accountQuota';
import { buildAccountRuntimeStats } from '../model/accountDetailRuntime';
import {
  resolveAccountOperationalState,
  resolveAccountPrimaryLabel,
} from '../model/accountPresentation';
import type { AccountUsageSummary } from '../model/accountUsage';
import { buildAccountEvidenceRows, type AccountEvidenceRow } from '../model/accountEvidence';
import type { CodexQuotaState, QuotaDisplay } from '../model/types';
import { formatLabel } from '../model/vendorPresetHelpers';
import { BillingBalance } from './CardSections';
import {
  AccountDetailEvidenceGrid,
  AccountDetailPill,
  AccountDetailSection,
} from './AccountDetailPrimitives';

export interface APIKeyVerifyState {
  model: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  lastVerifiedAt: number | null;
}

export interface AccountDetailHeaderProps {
  account: AccountRecord;
  usageSummary?: AccountUsageSummary;
  onRename?: (nextName: string) => void;
  onStartReauth?: () => void;
  onCancelReauth?: () => void;
  isReauthing?: boolean;
}

export interface AccountCredentialsSectionProps {
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
}

export interface AccountVerifySectionProps {
  draft: ApiKeyConfigDraft;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
}

export interface AccountQuotaSectionProps {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  quotaState?: CodexQuotaState;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string }) => Promise<any>;
}

export interface AccountBillingSectionProps {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  liveBilling?: BillingDisplay;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string }) => Promise<any>;
}

export interface AccountEvidenceSectionProps {
  account: AccountRecord;
  usageSummary?: AccountUsageSummary;
  rows?: AccountEvidenceRow[];
}

export interface AccountRuntimeSnapshotSectionProps {
  usageSummary?: AccountUsageSummary;
  quotaDisplay?: QuotaDisplay;
  billing?: BillingDisplay;
}

export interface AccountDetailFooterProps {
  isApiKey: boolean;
  configDirty: boolean;
  rateLimitDirty?: boolean;
  missingFields: string[];
  savingConfig: boolean;
  onClose: () => void;
  onSaveConfig: () => void;
}

const DEFAULT_VERIFY_MODEL = 'gpt-5.4-mini';

export function AccountDetailHeader({
  account,
  usageSummary,
  onRename,
  onStartReauth,
  onCancelReauth,
  isReauthing,
}: AccountDetailHeaderProps) {
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
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
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
          <AccountDetailPill
            tone={operationalState.tone === 'positive' ? 'success' : operationalState.tone === 'warning' ? 'warning' : 'danger'}
            className="!min-h-0 !py-0.5 !text-[length:var(--font-size-ui-xs)] !tracking-[0.12em]"
          >
            {operationalState.label}
          </AccountDetailPill>
        </div>

        {canReauth ? (
          <button onClick={isReauthing ? onCancelReauth : onStartReauth} className="btn-swiss whitespace-nowrap !text-[length:var(--font-size-ui-xs)]">
            {isReauthing ? t('accounts.cancel_reauth') : t('accounts.reauth')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {account.provider.toUpperCase()}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {formats.map((fmt) => (
            <AccountDetailPill key={fmt} className="!min-h-0 !py-0.5 !tracking-[0.12em]">
              {formatLabel(fmt)}
            </AccountDetailPill>
          ))}
        </div>
      </div>

      {account.baseUrl ? (
        <div className="truncate text-[length:var(--font-size-ui-xs)] font-mono text-[var(--text-muted)]">
          {account.baseUrl}
        </div>
      ) : null}

      {account.formatBaseUrls && Object.keys(account.formatBaseUrls).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(account.formatBaseUrls).map(([fmt, url]) => (
            <div key={fmt} className="text-[length:var(--font-size-ui-2xs)] font-mono text-[var(--text-muted)]">
              <span className="font-black uppercase text-[var(--text-primary)]">{formatLabel(fmt as ApiFormat)}:</span>{' '}
              <span className="truncate">{String(url)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AccountCredentialsSection({
  draft,
  setDraft,
}: AccountCredentialsSectionProps) {
  return (
    <AccountDetailSection eyebrow="Credential" title="凭据">

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">API 密钥</span>
          <div className="flex gap-2">
            <input
              value={draft.apiKey}
              onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
              className="input-swiss flex-1 font-mono"
            />
            <button onClick={() => void navigator.clipboard.writeText(draft.apiKey)} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
              复制
            </button>
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">基础 URL</span>
          <div className="flex gap-2">
            <input
              value={draft.baseUrl}
              onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
              className="input-swiss flex-1 font-mono"
            />
            <button onClick={() => void navigator.clipboard.writeText(draft.baseUrl)} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
              复制
            </button>
          </div>
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">前缀</span>
        <input
          value={draft.prefix}
          onChange={(event) => setDraft((prev) => ({ ...prev, prefix: event.target.value }))}
          className="input-swiss w-full font-mono"
          placeholder="/v1"
        />
      </label>
    </AccountDetailSection>
  );
}

export function AccountVerifySection({
  draft,
  verifyState,
  modelNames,
  onVerify,
}: AccountVerifySectionProps) {
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
    <AccountDetailSection eyebrow="Connection" title="验证连接">
      {vs.lastVerifiedAt ? (
        <div className="text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          上次验证：{new Date(vs.lastVerifiedAt).toLocaleString()}
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
              className="input-swiss flex-1 font-mono !text-[length:var(--font-size-ui-xs)]"
              placeholder={DEFAULT_VERIFY_MODEL}
            />
            {modelNames && modelNames.length > 0 ? (
              <button onClick={() => setIsModelMenuOpen((prev) => !prev)} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
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
                  className={`block w-full px-3 py-1.5 text-left text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] transition-colors ${
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
          className="btn-swiss whitespace-nowrap !text-[length:var(--font-size-ui-xs)]"
        >
          {vs.status === 'loading' ? '验证中...' : '验证'}
        </button>
      </div>

      {vs.status !== 'idle' ? (
        <div className={`text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide ${
          vs.status === 'success' ? 'text-[var(--color-status-success)]' : vs.status === 'error' ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
        }`}>
          {vs.message}
        </div>
      ) : null}
    </AccountDetailSection>
  );
}

export function AccountQuotaSection({
  account,
  draft,
  setDraft,
  quotaState,
  onTestQuotaCurl,
}: AccountQuotaSectionProps) {
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
    <AccountDetailSection
      eyebrow="Quota"
      title="额度追踪"
      meta={liveWindows.length > 0 ? `实时 ${liveWindows.length} 个窗口` : undefined}
    >

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.quotaEnabled}
          onChange={(event) => setDraft((prev) => ({ ...prev, quotaEnabled: event.target.checked }))}
        />
        <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">启用</span>
      </label>

      <textarea
        value={draft.quotaCurl}
        onChange={(event) => setDraft((prev) => ({ ...prev, quotaCurl: event.target.value }))}
        className="input-swiss min-h-20 w-full resize-y font-mono !text-[length:var(--font-size-ui-xs)]"
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
          className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
        >
          使用模板
        </button>
        <button onClick={runQuotaTest} disabled={testStatus === 'loading' || !draft.quotaCurl.trim()} className="btn-swiss !text-[length:var(--font-size-ui-2xs)]">
          {testStatus === 'loading' ? '测试中...' : '测试'}
        </button>
      </div>

      {testStatus === 'success' && testResult ? (
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--color-status-success)]">
          OK - {testResult.planType ?? 'quota'} {testResult.windows?.length ? `${testResult.windows.length} windows` : ''}
        </div>
      ) : null}
      {testStatus === 'error' ? (
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--color-status-danger)]">{testMessage}</div>
      ) : null}
    </AccountDetailSection>
  );
}

export function AccountRuntimeSnapshotSection({
  usageSummary,
  quotaDisplay,
  billing,
}: AccountRuntimeSnapshotSectionProps) {
  const { t } = useI18n();
  const stats = buildAccountRuntimeStats(usageSummary, quotaDisplay, billing, t);
  const quotaWindows = quotaDisplay?.windows ?? [];
  const balances = billing?.isAvailable ? billing.balances ?? [] : [];

  return (
    <AccountDetailSection
      eyebrow="Runtime"
      title="运行快照"
      meta={usageSummary?.lastActivityAt ? `LAST ${new Date(usageSummary.lastActivityAt).toLocaleString()}` : undefined}
    >
      <div className="grid border-y-2 border-[var(--border-color)] md:grid-cols-3">
        {stats.map((item) => (
          <div key={item.id} className="min-w-0 border-b border-r border-dashed border-[var(--border-color)] px-3 py-3">
            <div className="truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {item.label}
            </div>
            <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-md-compact)] font-black uppercase tabular-nums text-[var(--text-primary)]">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {quotaWindows.length > 0 ? (
        <div className="grid gap-2 border-b-2 border-dashed border-[var(--border-color)] pb-4">
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            QUOTA
          </div>
          {quotaWindows.map((window) => {
            const resetTime = formatQuotaResetDisplayWithUnix(window.resetLabel, window.resetAtUnix);
            return (
              <div key={window.id} className="grid gap-2 md:grid-cols-[6rem_minmax(0,1fr)_5rem_12rem] md:items-center">
                <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {window.label}
                </div>
                <div
                  className="relative h-4 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]"
                  style={{
                    backgroundImage: window.remainingPercent === null
                      ? 'repeating-linear-gradient(to right, color-mix(in srgb, var(--border-color) 12%, transparent) 0 8px, transparent 8px 14px)'
                      : 'none',
                  }}
                >
                  {window.remainingPercent !== null ? (
                    <div
                      className="absolute inset-y-0 left-0 bg-[var(--color-status-success)]"
                      style={{ width: `${Math.max(0, window.remainingPercent)}%` }}
                    />
                  ) : null}
                  {quotaDisplay?.refreshing ? (
                    <div className="account-card-quota-refresh-skeleton pointer-events-none absolute inset-0" aria-hidden="true" />
                  ) : null}
                </div>
                <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] md:text-right">
                  {window.remainingPercent === null ? '--' : `${window.remainingPercent}%`}
                </div>
                <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)] md:text-right">
                  {t('accounts.quota_reset')} {resetTime}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {balances.length > 0 ? (
        <div className="grid gap-2">
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            BALANCE
          </div>
          {balances.map((balance, index) => (
            <div key={`${balance.currency}-${index}`} className="grid gap-2 border-y border-dashed border-[var(--border-color)] py-2 md:grid-cols-3">
              <RuntimeKV label="Total" value={`${balance.totalBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Granted" value={`${balance.grantedBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Topped Up" value={`${balance.toppedUpBalance} ${balance.currency}`.trim()} />
            </div>
          ))}
        </div>
      ) : null}
    </AccountDetailSection>
  );
}

export function AccountBillingSection({
  account,
  draft,
  setDraft,
  liveBilling,
  onTestBillingCurl,
}: AccountBillingSectionProps) {
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
        setTestMessage('余额接口未返回余额数据');
      }
    } catch (error) {
      setTestMessage(toErrorMessage(error));
      setTestStatus('error');
    }
  }

  return (
    <AccountDetailSection
      eyebrow="Billing"
      title="余额"
      meta={liveBilling ? '实时余额已就绪' : undefined}
    >

      {liveBilling ? (
        <div className="border-2 border-[var(--border-color)]">
          <BillingBalance billing={liveBilling} />
        </div>
      ) : (
        <div className="border-2 border-dashed border-[var(--border-color)] px-4 py-3 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
          当前账号暂无余额数据。
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.billingEnabled}
          onChange={(event) => setDraft((prev) => ({ ...prev, billingEnabled: event.target.checked }))}
        />
        <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">启用余额</span>
      </label>

      <textarea
        value={draft.billingCurl}
        onChange={(event) => setDraft((prev) => ({ ...prev, billingCurl: event.target.value }))}
        className="input-swiss min-h-20 w-full resize-y font-mono !text-[length:var(--font-size-ui-xs)]"
        placeholder={billingTemplate || 'curl -sS "https://api.example.com/billing" -H "Authorization: Bearer {{apiKey}}"'}
      />

      <div className="flex flex-wrap items-center gap-2">
        {billingTemplate ? (
          <button
            onClick={() => setDraft((prev) => ({ ...prev, billingCurl: billingTemplate, billingEnabled: true }))}
            className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
          >
            使用供应商模板
          </button>
        ) : null}
        <button onClick={runBillingTest} disabled={testStatus === 'loading' || !draft.billingCurl.trim()} className="btn-swiss !text-[length:var(--font-size-ui-2xs)]">
          {testStatus === 'loading' ? '测试中...' : '测试余额'}
        </button>
      </div>

      {testStatus === 'success' && testBilling ? (
        <div className="border-2 border-[var(--border-color)]">
          <BillingBalance billing={testBilling} />
        </div>
      ) : null}
      {testStatus === 'success' && testMessage ? (
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">{testMessage}</div>
      ) : null}
      {testStatus === 'error' ? (
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--color-status-danger)]">{testMessage}</div>
      ) : null}
    </AccountDetailSection>
  );
}

export function AccountEvidenceSection({
  account,
  usageSummary,
  rows,
}: AccountEvidenceSectionProps) {
  const { t } = useI18n();
  const evidenceRows = rows ?? buildAccountEvidenceRows(t, account, usageSummary);

  if (evidenceRows.length === 0) {
    return null;
  }

  return (
    <AccountDetailSection eyebrow="Audit" title="EVIDENCE">
      <AccountDetailEvidenceGrid
        rows={evidenceRows.map((row) => ({
          label: row.label,
          value: row.value,
          title: row.title ?? row.value,
        }))}
      />
    </AccountDetailSection>
  );
}

function RuntimeKV({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

export function AccountDetailFooter({
  isApiKey,
  configDirty,
  rateLimitDirty = false,
  missingFields,
  savingConfig,
  onClose,
  onSaveConfig,
}: AccountDetailFooterProps) {
  const { t } = useI18n();
  const hasDirtyChanges = configDirty || rateLimitDirty;
  const dirtyMessage = configDirty && rateLimitDirty
    ? '账号配置 / 路由守卫有未保存改动'
    : configDirty
      ? '账号配置有未保存改动'
      : rateLimitDirty
        ? t('accounts.rate_limit_dirty')
        : '';

  return (
    <>
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {isApiKey && missingFields.length > 0
          ? `缺少：${missingFields.join(', ')}`
          : dirtyMessage}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="btn-swiss text-[length:var(--font-size-ui-xs)]">
          {t('common.close')}
        </button>
        {isApiKey || rateLimitDirty ? (
          <button
            onClick={onSaveConfig}
            disabled={!hasDirtyChanges || missingFields.length > 0 || savingConfig}
            className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] !text-[length:var(--font-size-ui-xs)]"
          >
            {savingConfig ? '保存中...' : '保存改动'}
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
