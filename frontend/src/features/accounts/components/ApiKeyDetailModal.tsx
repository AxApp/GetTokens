import { useEffect, useMemo, useState } from 'react';
import { buildManagedAuthJSONSnippet, buildManagedConfigTomlSnippet } from '../model/accountConfig';
import {
  providerLabel,
  resolveAccountAPIKeyPlainNotice,
  resolveAccountConfigurationWorkspaceHeading,
  resolveAccountProviderConfigHeading,
  resolveAccountSourceHeading,
  sourceLabel,
} from '../model/accountPresentation';
import type { AccountRecord, ClickEventLike, TextInputEvent, Translator } from '../model/types';
import type { AccountUsageSummary } from '../model/accountUsage';
import AccountHealthBar from './AccountHealthBar';

const DEFAULT_CODEX_API_KEY_VERIFY_MODEL = 'gpt-5.4-mini';

interface APIKeyVerifyState {
  model: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  lastVerifiedAt: number | null;
}

interface ApiKeyDetailModalProps {
  account: AccountRecord;
  usageSummary?: AccountUsageSummary;
  verifyState: APIKeyVerifyState;
  onClose: () => void;
  onRename: (nextName: string) => void;
  onSavePriority: (priority: string) => void;
  onVerify: (input: { apiKey: string; baseUrl: string; model: string }) => void;
  t: Translator;
}

function formatVerifyTone(status: APIKeyVerifyState['status']) {
  if (status === 'success') return 'border-green-600 bg-green-600/10 text-green-700';
  if (status === 'error') return 'border-red-500 bg-red-500/10 text-red-500';
  return 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)]';
}

function formatLastVerifiedAt(timestamp: number | null) {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleString();
}

export default function ApiKeyDetailModal({
  account,
  usageSummary,
  verifyState,
  onClose,
  onRename,
  onSavePriority,
  onVerify,
  t,
}: ApiKeyDetailModalProps) {
  const [draftName, setDraftName] = useState(account.displayName);
  const [draftPriority, setDraftPriority] = useState(String(account.priority ?? 0));
  const [verifyModel, setVerifyModel] = useState(verifyState.model || DEFAULT_CODEX_API_KEY_VERIFY_MODEL);
  const [configDraft, setConfigDraft] = useState({
    apiKey: account.apiKey || '',
    baseUrl: account.baseUrl || '',
    prefix: account.prefix || '',
  });
  const [copyState, setCopyState] = useState<{
    target: 'apiKey' | 'baseUrl' | 'authJson' | 'configToml' | null;
    status: 'idle' | 'success' | 'error';
  }>({
    target: null,
    status: 'idle',
  });

  useEffect(() => {
    setDraftName(account.displayName);
  }, [account.displayName]);

  useEffect(() => {
    setDraftPriority(String(account.priority ?? 0));
  }, [account.priority]);

  useEffect(() => {
    setConfigDraft({
      apiKey: account.apiKey || '',
      baseUrl: account.baseUrl || '',
      prefix: account.prefix || '',
    });
  }, [account.apiKey, account.baseUrl, account.prefix]);

  useEffect(() => {
    setVerifyModel(verifyState.model || DEFAULT_CODEX_API_KEY_VERIFY_MODEL);
  }, [verifyState.model, account.id]);

  useEffect(() => {
    if (copyState.status === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyState({ target: null, status: 'idle' });
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyState]);

  const detailRows: Array<[string, string]> = [
    [t('accounts.provider'), providerLabel(account)],
    [t('accounts.source_api_key'), sourceLabel(t, account.credentialSource)],
    [t('accounts.api_key_priority'), String(account.priority ?? 0)],
    ['FINGERPRINT', account.keyFingerprint || '--'],
    [t('common.status'), account.localOnly ? t('accounts.status_local') : account.status],
  ];
  const managedAuthJSONSnippet = useMemo(() => buildManagedAuthJSONSnippet(configDraft), [configDraft]);
  const managedConfigTomlSnippet = useMemo(() => buildManagedConfigTomlSnippet(configDraft), [configDraft]);
  const sourceHeading = useMemo(() => resolveAccountSourceHeading(account, t), [account, t]);
  const providerConfigHeading = useMemo(() => resolveAccountProviderConfigHeading(account, t), [account, t]);
  const workspaceHeading = useMemo(() => resolveAccountConfigurationWorkspaceHeading(account, t), [account, t]);
  const apiKeyPlainNotice = useMemo(() => resolveAccountAPIKeyPlainNotice(account, t), [account, t]);
  const missingFields = useMemo(() => {
    const fields: string[] = [];
    if (!configDraft.apiKey.trim()) {
      fields.push('API KEY');
    }
    if (!configDraft.baseUrl.trim()) {
      fields.push('BASE URL');
    }
    return fields;
  }, [configDraft.apiKey, configDraft.baseUrl]);
  const missingFieldsMessage = useMemo(() => {
    if (missingFields.length === 0) {
      return t('accounts.configuration_ready');
    }
    return t('accounts.configuration_missing_with_location').replace('{fields}', missingFields.join(' / '));
  }, [missingFields, t]);

  async function copyText(
    target: 'apiKey' | 'baseUrl' | 'authJson' | 'configToml',
    value: string
  ) {
    if (!value.trim()) {
      setCopyState({ target, status: 'error' });
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyState({ target, status: 'success' });
    } catch {
      setCopyState({ target, status: 'error' });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b-2 border-[var(--border-color)] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {sourceHeading}
              </div>
              <div className="mt-3 space-y-2">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.api_key_label')}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    value={draftName}
                    onChange={(event: TextInputEvent) => setDraftName(event.target.value)}
                    className="input-swiss w-full"
                    placeholder={t('accounts.api_key_label_placeholder')}
                  />
                  <button onClick={() => onRename(draftName)} className="btn-swiss shrink-0">
                    {t('common.save')}
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.api_key_priority')}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    value={draftPriority}
                    onChange={(event: TextInputEvent) => setDraftPriority(event.target.value)}
                    className="input-swiss w-full"
                    inputMode="numeric"
                    placeholder={t('accounts.api_key_priority_placeholder')}
                  />
                  <button onClick={() => onSavePriority(draftPriority)} className="btn-swiss shrink-0">
                    {t('common.save')}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {providerConfigHeading}
              </div>
              <div className="mt-1 text-lg font-black italic uppercase tracking-tight text-[var(--text-primary)]">
                {providerLabel(account)}
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              {detailRows.map(([label, value]) => (
                <div key={label} className="space-y-1 border-b border-dashed border-[var(--border-color)] pb-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
                  <div className="break-all text-[11px] font-black uppercase text-[var(--text-primary)]">{value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.recent_health')}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--text-primary)]">
                  {usageSummary?.successRate !== null && usageSummary?.successRate !== undefined
                    ? `${Math.round(usageSummary.successRate)}%`
                    : t('accounts.no_recent_activity')}
                </div>
              </div>

              {usageSummary?.hasData ? <AccountHealthBar summary={usageSummary} /> : null}

              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                <div className="space-y-1">
                  <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.recent_success')}
                  </div>
                  <div className="text-[11px] font-black uppercase text-[var(--text-primary)]">{usageSummary?.success ?? 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.recent_failure')}
                  </div>
                  <div className="text-[11px] font-black uppercase text-[var(--text-primary)]">{usageSummary?.failure ?? 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.average_latency')}
                  </div>
                  <div className="text-[11px] font-black uppercase text-[var(--text-primary)]">
                    {usageSummary?.averageLatencyMs ? `${usageSummary.averageLatencyMs} ms` : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {apiKeyPlainNotice}
            </div>
          </section>

          <section className="card-swiss !p-0 overflow-hidden">
            <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {workspaceHeading}
              </div>
            </div>

            <div className="space-y-5 p-6">
              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  API KEY
                </span>
                <div className="relative">
                  <input
                    value={configDraft.apiKey}
                    onChange={(event: TextInputEvent) =>
                      setConfigDraft((prev) => ({ ...prev, apiKey: event.target.value }))
                    }
                    className="input-swiss w-full pr-36"
                    placeholder="sk-..."
                  />
                  <button
                    onClick={() => void copyText('apiKey', configDraft.apiKey)}
                    className="btn-swiss absolute right-2 top-1/2 !px-3 !py-1 !text-[9px] -translate-y-1/2"
                  >
                    复制
                  </button>
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  BASE URL
                </span>
                <div className="relative">
                  <input
                    value={configDraft.baseUrl}
                    onChange={(event: TextInputEvent) =>
                      setConfigDraft((prev) => ({ ...prev, baseUrl: event.target.value }))
                    }
                    className="input-swiss w-full pr-24"
                    placeholder="https://api.openai.com/v1"
                  />
                  <button
                    onClick={() => void copyText('baseUrl', configDraft.baseUrl)}
                    className="btn-swiss absolute right-2 top-1/2 !px-3 !py-1 !text-[9px] -translate-y-1/2"
                  >
                    复制
                  </button>
                </div>
              </label>

              <div className="space-y-3 border-t-2 border-dashed border-[var(--border-color)] pt-5">
                <div className="space-y-3 border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {t('accounts.api_key_verify_summary')}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {verifyState.model || '—'}
                    </div>
                  </div>

                  <label className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {t('accounts.api_key_verify_model')}
                    </span>
                    <div className="flex items-end gap-3">
                      <input
                        value={verifyModel}
                        onChange={(event: TextInputEvent) => setVerifyModel(event.target.value)}
                        className="input-swiss w-full"
                        placeholder={DEFAULT_CODEX_API_KEY_VERIFY_MODEL}
                      />
                      <button
                        onClick={() =>
                          onVerify({
                            apiKey: configDraft.apiKey,
                            baseUrl: configDraft.baseUrl,
                            model: verifyModel,
                          })
                        }
                        className="btn-swiss shrink-0"
                        disabled={verifyState.status === 'loading'}
                      >
                        {verifyState.status === 'loading' ? t('accounts.api_key_verify_running') : t('accounts.api_key_verify')}
                      </button>
                    </div>
                  </label>

                  <div className={`border px-4 py-3 text-[10px] font-black uppercase tracking-wide ${formatVerifyTone(verifyState.status)}`}>
                    {verifyState.message || t('accounts.api_key_verify_idle')}
                  </div>

                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {t('accounts.api_key_verify_last_verified')} {formatLastVerifiedAt(verifyState.lastVerifiedAt)}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.configuration_snippet')}
                  </div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {missingFieldsMessage}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
                    <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--border-color)] px-4 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        auth.json
                      </div>
                      <button
                        onClick={() => void copyText('authJson', managedAuthJSONSnippet)}
                        className="btn-swiss !px-3 !py-1 !text-[9px]"
                      >
                        复制
                      </button>
                    </div>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-[11px] font-bold leading-6 text-[var(--text-primary)]">
                      {managedAuthJSONSnippet}
                    </pre>
                  </div>

                  <div className="overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
                    <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--border-color)] px-4 py-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        config.toml
                      </div>
                      <button
                        onClick={() => void copyText('configToml', managedConfigTomlSnippet)}
                        className="btn-swiss !px-3 !py-1 !text-[9px]"
                      >
                        复制
                      </button>
                    </div>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-[11px] font-bold leading-6 text-[var(--text-primary)]">
                      {managedConfigTomlSnippet}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] sm:max-w-[70%]">
            {missingFieldsMessage}
          </div>
          <button onClick={onClose} className="btn-swiss self-end sm:self-auto">
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
