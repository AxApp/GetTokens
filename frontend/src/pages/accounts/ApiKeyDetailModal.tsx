import { useEffect, useMemo, useState } from 'react';
import { buildManagedAuthJSONSnippet, buildManagedConfigTomlSnippet } from './accountConfig';
import { providerLabel, sourceLabel } from './accountPresentation';
import type { AccountRecord, ClickEventLike, TextInputEvent, Translator } from './types';

interface ApiKeyDetailModalProps {
  account: AccountRecord;
  onClose: () => void;
  onRename: (nextName: string) => void;
  t: Translator;
}

export default function ApiKeyDetailModal({ account, onClose, onRename, t }: ApiKeyDetailModalProps) {
  const [draftName, setDraftName] = useState(account.displayName);
  const [configDraft, setConfigDraft] = useState({
    apiKey: account.apiKey || '',
    baseUrl: account.baseUrl || '',
    prefix: account.prefix || '',
  });
  const [copyState, setCopyState] = useState<{
    target: 'apiKey' | 'baseUrl' | 'prefix' | 'authJson' | 'configToml' | null;
    status: 'idle' | 'success' | 'error';
  }>({
    target: null,
    status: 'idle',
  });

  useEffect(() => {
    setDraftName(account.displayName);
  }, [account.displayName]);

  useEffect(() => {
    setConfigDraft({
      apiKey: account.apiKey || '',
      baseUrl: account.baseUrl || '',
      prefix: account.prefix || '',
    });
  }, [account.apiKey, account.baseUrl, account.prefix]);

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
    ['FINGERPRINT', account.keyFingerprint || '--'],
    ...(account.prefix ? [['PREFIX', account.prefix]] as Array<[string, string]> : []),
    [t('common.status'), account.localOnly ? t('accounts.status_local') : account.status],
  ];
  const managedAuthJSONSnippet = useMemo(() => buildManagedAuthJSONSnippet(configDraft), [configDraft]);
  const managedConfigTomlSnippet = useMemo(() => buildManagedConfigTomlSnippet(configDraft), [configDraft]);
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

  async function copyText(
    target: 'apiKey' | 'baseUrl' | 'prefix' | 'authJson' | 'configToml',
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
                {t('accounts.source_api_key')}
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
            </div>

            <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.provider_config')}
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

            <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {t('accounts.api_key_plain_notice')}
            </div>
          </section>

          <section className="card-swiss !p-0 overflow-hidden">
            <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.configuration_workspace')}
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

              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  PREFIX
                </span>
                <div className="relative">
                  <input
                    value={configDraft.prefix}
                    onChange={(event: TextInputEvent) =>
                      setConfigDraft((prev) => ({ ...prev, prefix: event.target.value }))
                    }
                    className="input-swiss w-full pr-24"
                    placeholder={t('accounts.prefix_optional')}
                  />
                  <button
                    onClick={() => void copyText('prefix', configDraft.prefix)}
                    className="btn-swiss absolute right-2 top-1/2 !px-3 !py-1 !text-[9px] -translate-y-1/2"
                  >
                    复制
                  </button>
                </div>
              </label>

              <div className="space-y-3 border-t-2 border-dashed border-[var(--border-color)] pt-5">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('accounts.configuration_snippet')}
                  </div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {missingFields.length > 0
                      ? `${t('accounts.configuration_missing')} ${missingFields.join(' / ')}`
                      : t('accounts.configuration_ready')}
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
            {t('accounts.configuration_hint')}
          </div>
          <button onClick={onClose} className="btn-swiss self-end sm:self-auto">
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
