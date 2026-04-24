import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeleteAuthFiles, GetCodexQuota, ListAuthFiles, UploadAuthFiles } from '../../wailsjs/go/main/App';
import AccountDetailModal from '../components/biz/AccountDetailModal';
import { useI18n } from '../context/I18nContext';
import type { AuthFile, CodexQuota, SidecarStatus } from '../types';
import { toErrorMessage } from '../utils/error';

interface AccountsPageProps {
  sidecarStatus: SidecarStatus;
}

interface TextInputEvent {
  target: {
    value: string;
  };
}

interface CodexQuotaState {
  status: 'loading' | 'success' | 'error';
  quota?: CodexQuota;
}

export default function AccountsPage({ sidecarStatus }: AccountsPageProps) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<AuthFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<AuthFile | null>(null);
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [codexQuotaByName, setCodexQuotaByName] = useState<Record<string, CodexQuotaState>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quotaRequestIdRef = useRef(0);

  const ready = sidecarStatus?.code === 'ready';

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return accounts.filter((account) => {
      if (!searchTerm) {
        return true;
      }
      return (
        (account.name || '').toLowerCase().includes(query) ||
        (account.provider || '').toLowerCase().includes(query)
      );
    });
  }, [accounts, searchTerm]);

  const loadCodexQuotas = useCallback(async (items: AuthFile[]) => {
    const codexAccounts = items.filter((account) => isCodexAccount(account));
    quotaRequestIdRef.current += 1;
    const requestID = quotaRequestIdRef.current;

    if (codexAccounts.length === 0) {
      setCodexQuotaByName({});
      return;
    }

    setCodexQuotaByName(
      codexAccounts.reduce<Record<string, CodexQuotaState>>((result, account) => {
        result[account.name] = { status: 'loading' };
        return result;
      }, {})
    );

    const results = await Promise.all(
      codexAccounts.map(async (account) => {
        try {
          const quota = await GetCodexQuota(account.name);
          return [account.name, { status: 'success', quota } satisfies CodexQuotaState] as const;
        } catch (error) {
          console.error(error);
          return [account.name, { status: 'error' } satisfies CodexQuotaState] as const;
        }
      })
    );

    if (quotaRequestIdRef.current !== requestID) {
      return;
    }

    setCodexQuotaByName(
      results.reduce<Record<string, CodexQuotaState>>((result, [name, state]) => {
        result[name] = state;
        return result;
      }, {})
    );
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!ready) {
      return;
    }

    setLoading(true);
    try {
      const response = await ListAuthFiles();
      const files = response.files || [];
      setAccounts(files);
      setPendingDeleteName(null);
      void loadCodexQuotas(files);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [loadCodexQuotas, ready]);

  useEffect(() => {
    if (ready) {
      loadAccounts();
    }
  }, [ready, loadAccounts]);

  async function deleteAccount(name: string) {
    setDeleteError('');
    try {
      await DeleteAuthFiles([name]);
      setPendingDeleteName(null);
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setDeleteError(`DELETE ERROR: ${toErrorMessage(error)}`);
    }
  }

  async function uploadAccounts(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setDeleteError('');
    try {
      const payload = await Promise.all(
        Array.from(files).map(
          (file) =>
            new Promise<{ name: string; contentBase64: string }>((resolve, reject) => {
              const reader = new FileReader();

              reader.onload = () => {
                const result = reader.result;
                if (typeof result !== 'string') {
                  reject(new Error('文件读取失败'));
                  return;
                }

                const marker = 'base64,';
                const base64Index = result.indexOf(marker);
                resolve({
                  name: file.name,
                  contentBase64: base64Index >= 0 ? result.slice(base64Index + marker.length) : result,
                });
              };

              reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'));
              reader.readAsDataURL(file);
            })
        )
      );

      await UploadAuthFiles(payload);
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setDeleteError(`UPLOAD ERROR: ${toErrorMessage(error)}`);
    }
  }

  function providerLabel(account: AuthFile) {
    return String(account.provider || account.type || 'UNKNOWN').trim().toUpperCase();
  }

  function quotaSummary(account: AuthFile) {
    if (!isCodexAccount(account)) {
      return '';
    }

    const state = codexQuotaByName[account.name];
    if (!state || state.status === 'loading') {
      return 'SYNCING...';
    }
    if (state.status === 'error' || !state.quota) {
      return 'UNAVAILABLE';
    }

    const preferredWindows = state.quota.windows.filter(
      (window) => window.id === 'five-hour' || window.id === 'weekly'
    );
    const windows = preferredWindows.length > 0 ? preferredWindows : state.quota.windows.slice(0, 2);
    if (windows.length === 0) {
      return state.quota.planType ? state.quota.planType.toUpperCase() : 'READY';
    }

    const parts = windows.map((window) => {
      const remaining = window.remainingPercent === undefined ? '--' : `${window.remainingPercent}%`;
      return `${window.label} ${remaining}`;
    });
    return parts.join(' · ');
  }

  return (
    <>
      <div
        className="h-full w-full overflow-auto bg-[var(--bg-surface)] p-12"
        data-collaboration-id="PAGE_ACCOUNTS"
      >
        <div className="mx-auto max-w-6xl space-y-8 pb-32">
          <header className="flex items-end justify-between border-b-4 border-[var(--border-color)] pb-4">
            <div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {t('accounts.title')}
              </h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {t('accounts.subtitle')} / {accounts.length} TOTAL
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  void uploadAccounts(event.target.files);
                  event.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-swiss"
                disabled={!ready || loading}
              >
                {t('accounts.add_account')}
              </button>
              <button onClick={loadAccounts} className="btn-swiss" disabled={!ready || loading}>
                {t('common.refresh')}
              </button>
            </div>
          </header>

          <div className="flex w-full items-center">
            <input
              value={searchTerm}
              onChange={(event: TextInputEvent) => {
                setSearchTerm(event.target.value);
                setPendingDeleteName(null);
              }}
              type="text"
              className="input-swiss w-full uppercase"
              placeholder="NAME / PROVIDER..."
            />
          </div>

          {deleteError ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-500">
              {deleteError}
            </div>
          ) : null}

          {!ready ? (
            <div className="animate-pulse border-2 border-dashed border-[var(--border-color)] p-20 text-center font-black uppercase italic text-[var(--text-muted)]">
              Waiting_for_backend_core...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="border-2 border-dashed border-[var(--border-color)] p-20 text-center font-black uppercase italic text-[var(--text-muted)]">
              {loading ? t('common.loading') : t('accounts.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-3">
              {filteredAccounts.map((account) => (
                <div
                  key={account.name}
                  className="card-swiss flex min-h-[200px] flex-col bg-[var(--bg-main)] p-6 transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]"
                >
                  <h3 className="mb-4 break-all text-sm font-black uppercase text-[var(--text-primary)]">
                    {account.name}
                  </h3>

                  <div className="mb-6 space-y-2 border-t border-dashed border-[var(--border-color)] pt-3">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wide text-[var(--text-primary)]">
                      <span className="text-[var(--text-muted)]">Provider</span>
                      <span>{providerLabel(account)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 text-[9px] font-black uppercase tracking-wide text-[var(--text-primary)]">
                      <span className="text-[var(--text-muted)]">Quota</span>
                      <span className="text-right">{quotaSummary(account)}</span>
                    </div>
                  </div>

                  <div className="mt-auto space-y-3">
                    <div className="flex justify-between border-t border-dashed border-[var(--border-color)] pt-3 text-[10px] font-bold uppercase text-[var(--text-primary)]">
                      <span className="text-[var(--text-muted)]">{t('common.status')}</span>
                      <span className={account.disabled ? 'text-zinc-500' : 'text-green-600'}>
                        {account.disabled ? 'DIS' : 'ACT'}
                      </span>
                    </div>

                    {pendingDeleteName === account.name ? (
                      <div className="space-y-2">
                        <div className="text-[9px] font-black uppercase tracking-wide text-red-500">
                          {t('common.confirm_delete')}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setPendingDeleteName(null)}
                            className="btn-swiss !py-1 !text-[9px]"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            onClick={() => deleteAccount(account.name)}
                            className="btn-swiss !py-1 !text-[9px] !text-red-500"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setSelectedAccount(account)} className="btn-swiss !py-1 !text-[9px]">
                          {t('common.details')}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError('');
                            setPendingDeleteName(account.name);
                          }}
                          className="btn-swiss !py-1 !text-[9px] !text-red-500"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedAccount ? (
        <AccountDetailModal account={selectedAccount} onClose={() => setSelectedAccount(null)} />
      ) : null}
    </>
  );
}

function isCodexAccount(account: AuthFile) {
  const provider = String(account.provider || account.type || '')
    .trim()
    .toLowerCase();
  return provider === 'codex';
}
