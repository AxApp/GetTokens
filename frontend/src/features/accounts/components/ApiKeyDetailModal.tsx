import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import {
  providerLabel,
  resolveAccountConfigurationWorkspaceHeading,
  resolveAccountProviderConfigHeading,
  resolveAccountSourceHeading,
} from '../model/accountPresentation';
import { buildAccountHealthMetaItems } from '../model/accountHealthMeta';
import type { AccountRecord, TextInputEvent, Translator } from '../model/types';
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
  onSaveConfig: (draft: { apiKey: string; baseUrl: string; prefix: string }) => Promise<void>;
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
  onSaveConfig,
  onVerify,
  t,
}: ApiKeyDetailModalProps) {
  const [draftName, setDraftName] = useState(account.displayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [verifyModel, setVerifyModel] = useState(verifyState.model || DEFAULT_CODEX_API_KEY_VERIFY_MODEL);
  const [configDraft, setConfigDraft] = useState({
    apiKey: account.apiKey || '',
    baseUrl: account.baseUrl || '',
    prefix: account.prefix || '',
  });
  const [copyState, setCopyState] = useState<{
    target: 'apiKey' | 'baseUrl' | null;
    status: 'idle' | 'success' | 'error';
  }>({
    target: null,
    status: 'idle',
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    setDraftName(account.displayName);
    setIsEditingName(false);
  }, [account.displayName]);

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
  const sourceHeading = useMemo(() => resolveAccountSourceHeading(account, t), [account, t]);
  const providerConfigHeading = useMemo(() => resolveAccountProviderConfigHeading(account, t), [account, t]);
  const workspaceHeading = useMemo(() => resolveAccountConfigurationWorkspaceHeading(account, t), [account, t]);
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
  const configDirty = useMemo(
    () =>
      configDraft.apiKey.trim() !== String(account.apiKey || '').trim() ||
      configDraft.baseUrl.trim() !== String(account.baseUrl || '').trim() ||
      configDraft.prefix.trim() !== String(account.prefix || '').trim(),
    [account.apiKey, account.baseUrl, account.prefix, configDraft.apiKey, configDraft.baseUrl, configDraft.prefix]
  );
  const healthMetaItems = useMemo(() => buildAccountHealthMetaItems(usageSummary, t), [usageSummary, t]);

  const messageTone =
    verifyState.status === 'success'
      ? 'text-green-600'
      : verifyState.status === 'error'
        ? 'text-red-500'
        : 'text-[var(--text-muted)]';

  async function copyText(
    target: 'apiKey' | 'baseUrl',
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

  function startEditingName() {
    setDraftName(account.displayName);
    setIsEditingName(true);
  }

  function cancelEditingName() {
    setDraftName(account.displayName);
    setIsEditingName(false);
  }

  function saveName() {
    onRename(draftName);
    setIsEditingName(false);
  }

  async function saveConfig() {
    setIsSavingConfig(true);
    try {
      await onSaveConfig({
        apiKey: configDraft.apiKey,
        baseUrl: configDraft.baseUrl,
        prefix: configDraft.prefix,
      });
    } finally {
      setIsSavingConfig(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b-2 border-[var(--border-color)] px-6 py-5">
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {sourceHeading}
              </div>
              {isEditingName ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={draftName}
                    onChange={(event: TextInputEvent) => setDraftName(event.target.value)}
                    className="input-swiss min-w-[16rem] flex-1 !py-1.5 !text-[0.75rem] !font-black !uppercase !italic tracking-tight"
                    placeholder={t('accounts.api_key_label_placeholder')}
                  />
                  <button onClick={saveName} className="btn-swiss shrink-0 !py-1.5 !text-[0.5625rem]">
                    {t('common.save')}
                  </button>
                  <button onClick={cancelEditingName} className="btn-swiss shrink-0 !py-1.5 !text-[0.5625rem]">
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
                    {account.displayName}
                  </h3>
                  <button
                    onClick={startEditingName}
                    className="btn-swiss flex h-7 w-7 items-center justify-center !p-0"
                    aria-label={t('accounts.api_key_label')}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-4 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <div className="flex min-w-0 items-center gap-2">
                  <span>{providerConfigHeading}</span>
                  <span className="text-[var(--border-color)]">/</span>
                  <span className="truncate text-[var(--text-primary)]">{providerLabel(account)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span>{t('accounts.recent_health')}</span>
                  <span className="text-[var(--text-primary)]">
                    {usageSummary?.successRate !== null && usageSummary?.successRate !== undefined
                      ? `${Math.round(usageSummary.successRate)}%`
                      : t('accounts.no_recent_activity')}
                  </span>
                  {healthMetaItems.map((item) => (
                    <span key={item.label} className="flex items-center gap-1">
                      <span>{item.label}</span>
                      <span className="text-[var(--text-primary)]">{item.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {usageSummary ? (
              <div className="pt-2">
                <AccountHealthBar summary={usageSummary} />
              </div>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex flex-col">
            <section className="border-b-2 border-[var(--border-color)] px-6 py-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dashed border-[var(--border-color)] pb-3">
                  <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    MANAGEMENT
                  </div>
                  <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {missingFieldsMessage}
                  </div>
                </div>

                <div className="space-y-3">
                    <label className="space-y-1.5">
                      <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        API KEY
                      </span>
                      <div className="relative">
                        <input
                          value={configDraft.apiKey}
                          onChange={(event: TextInputEvent) =>
                            setConfigDraft((prev) => ({ ...prev, apiKey: event.target.value }))
                          }
                          className="input-swiss w-full pr-16 !py-1.5 !text-[0.6875rem]"
                          type="text"
                          placeholder="sk-..."
                        />
                        <button
                          onClick={() => void copyText('apiKey', configDraft.apiKey)}
                          className="btn-swiss absolute right-2 top-1/2 !px-2 !py-0.5 !text-[0.5rem] -translate-y-1/2"
                        >
                          复制
                        </button>
                      </div>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        BASE URL
                      </span>
                      <div className="relative">
                        <input
                          value={configDraft.baseUrl}
                          onChange={(event: TextInputEvent) =>
                            setConfigDraft((prev) => ({ ...prev, baseUrl: event.target.value }))
                          }
                          className="input-swiss w-full pr-16 !py-1.5 !text-[0.6875rem]"
                          placeholder="https://api.openai.com/v1"
                        />
                        <button
                          onClick={() => void copyText('baseUrl', configDraft.baseUrl)}
                          className="btn-swiss absolute right-2 top-1/2 !px-2 !py-0.5 !text-[0.5rem] -translate-y-1/2"
                        >
                          复制
                        </button>
                      </div>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        PREFIX
                      </span>
                      <input
                        value={configDraft.prefix}
                        onChange={(event: TextInputEvent) =>
                          setConfigDraft((prev) => ({ ...prev, prefix: event.target.value }))
                        }
                        className="input-swiss w-full !py-1.5 !text-[0.6875rem]"
                        placeholder="/v1"
                      />
                    </label>
                </div>
              </div>
            </section>

            <section className="bg-[var(--bg-surface)]/30 px-6 py-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dashed border-[var(--border-color)] pb-3">
                  <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {workspaceHeading}
                  </div>
                  <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {providerLabel(account)}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="text-[0.5rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      {t('accounts.api_key_verify_summary')}
                    </div>
                    <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {t('accounts.api_key_verify_last_verified')} {formatLastVerifiedAt(verifyState.lastVerifiedAt)}
                    </div>
                  </div>

                  <label className="space-y-1.5">
                    <span className="text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {t('accounts.api_key_verify_model')}
                    </span>
                    <div className="relative">
                      <input
                        value={verifyModel}
                        onChange={(event: TextInputEvent) => setVerifyModel(event.target.value)}
                        className="input-swiss w-full pr-24 !py-1.5 !text-[0.6875rem]"
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
                        className="btn-swiss absolute right-2 top-1/2 !px-2 !py-0.5 !text-[0.5rem] -translate-y-1/2"
                        disabled={verifyState.status === 'loading'}
                      >
                        {t('accounts.api_key_verify')}
                      </button>
                    </div>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className={`text-[0.625rem] font-black uppercase tracking-tight ${messageTone}`}>
                      {verifyState.message || t('accounts.api_key_verify_idle')}
                    </div>
                    <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {verifyState.model || '—'}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] sm:max-w-[70%]">
            {missingFieldsMessage}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void saveConfig()}
              className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]"
              disabled={!configDirty || missingFields.length > 0 || isSavingConfig}
            >
              {isSavingConfig ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={onClose} className="btn-swiss">
              {t('common.close')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
