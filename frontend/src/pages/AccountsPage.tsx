import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeleteAuthFiles, GetCodexQuota, ListAuthFiles, UploadAuthFiles } from '../../wailsjs/go/main/App';
import AccountDetailModal from '../components/biz/AccountDetailModal';
import { useDebug } from '../context/DebugContext';
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

interface QuotaWindowDisplay {
  id: string;
  label: string;
  remainingPercent: number | null;
  usedLabel: string;
  resetLabel: string;
}

interface QuotaDisplay {
  status: 'unsupported' | 'loading' | 'error' | 'empty' | 'success';
  planType: string;
  windows: QuotaWindowDisplay[];
}

export default function AccountsPage({ sidecarStatus }: AccountsPageProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
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
          const quota = await trackRequest('GetCodexQuota', { name: account.name }, () =>
            GetCodexQuota(account.name)
          );
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
  }, [trackRequest]);

  const refreshCodexQuota = useCallback(async (account: AuthFile) => {
    if (!isCodexAccount(account)) {
      return;
    }

    setCodexQuotaByName((prev) => ({
      ...prev,
      [account.name]: { status: 'loading' },
    }));

    try {
      const quota = await trackRequest('GetCodexQuota', { name: account.name }, () =>
        GetCodexQuota(account.name)
      );
      setCodexQuotaByName((prev) => ({
        ...prev,
        [account.name]: { status: 'success', quota },
      }));
    } catch (error) {
      console.error(error);
      setCodexQuotaByName((prev) => ({
        ...prev,
        [account.name]: { status: 'error' },
      }));
    }
  }, [trackRequest]);

  const loadAccounts = useCallback(async () => {
    if (!ready) {
      return;
    }

    setLoading(true);
    try {
      const response = await trackRequest('ListAuthFiles', { args: [] }, () => ListAuthFiles());
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
      await trackRequest('DeleteAuthFiles', { names: [name] }, () => DeleteAuthFiles([name]));
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

      await trackRequest('UploadAuthFiles', { files: payload.map((item) => ({ name: item.name })) }, () =>
        UploadAuthFiles(payload)
      );
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setDeleteError(`UPLOAD ERROR: ${toErrorMessage(error)}`);
    }
  }

function providerLabel(account: AuthFile) {
  return String(account.provider || account.type || 'UNKNOWN').trim().toUpperCase();
}

function resolveAccountPlanLabel(account: AuthFile, quotaDisplay: QuotaDisplay) {
  const plan = String(quotaDisplay.planType || account.planType || '')
    .trim()
    .toUpperCase();
  return plan || '';
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
              {filteredAccounts.map((account) => {
                const quotaDisplay = buildQuotaDisplay(account, codexQuotaByName[account.name]);

                return (
                  <div
                    key={account.name}
                    className="card-swiss flex min-h-[320px] flex-col bg-[var(--bg-main)] p-5 transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="break-all text-[12px] font-bold uppercase leading-snug tracking-[0.08em] text-[var(--text-primary)]">
                          {account.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                          {account.email ? (
                            <span className="normal-case tracking-normal">{account.email}</span>
                          ) : null}
                          {account.email && resolveAccountPlanLabel(account, quotaDisplay) ? <span>/</span> : null}
                          {resolveAccountPlanLabel(account, quotaDisplay) ? <span>{resolveAccountPlanLabel(account, quotaDisplay)}</span> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end">
                        <span className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-primary)]">
                          {providerLabel(account)}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4 space-y-3 border-t border-dashed border-[var(--border-color)] pt-4">
                      <div className="space-y-2.5">
                        {(quotaDisplay.windows.length > 0 ? quotaDisplay.windows : createPlaceholderWindows()).map((window) => (
                          <div
                            key={window.id}
                            className="space-y-2.5 border-b border-dashed border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0"
                          >
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-x-3 gap-y-1 text-[8px] font-black uppercase">
                              <span className="tracking-[0.2em] text-[var(--text-muted)]">{window.label}</span>
                              <span className="truncate text-right text-[var(--text-primary)]" title={`${t('accounts.quota_reset')} ${window.resetLabel}`}>
                                {formatQuotaResetDisplay(window.resetLabel)}
                              </span>
                              <span className="text-green-600">
                                {t('accounts.quota_remaining')} {window.remainingPercent === null ? '--' : `${window.remainingPercent}%`}
                              </span>
                            </div>
                            <div
                              className={`relative h-5 w-full overflow-hidden ${
                                quotaDisplay.status === 'loading' ? 'animate-pulse' : ''
                              }`}
                            >
                              <div
                                className="absolute inset-0 opacity-50"
                                style={{
                                  backgroundImage:
                                    'linear-gradient(to right, var(--border-color) 0 8px, transparent 8px 11px)',
                                  backgroundSize: '11px 100%',
                                  backgroundRepeat: 'repeat-x',
                                }}
                              />
                              <div
                                className="absolute inset-y-0 left-0"
                                style={{
                                  width:
                                    window.remainingPercent === null
                                      ? quotaDisplay.status === 'loading'
                                        ? '40%'
                                        : '0%'
                                      : `${window.remainingPercent}%`,
                                  backgroundImage:
                                    'linear-gradient(to right, rgb(22 163 74) 0 8px, transparent 8px 11px)',
                                  backgroundSize: '11px 100%',
                                  backgroundRepeat: 'repeat-x',
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {quotaDisplay.windows.length === 0 ? (
                        <div className="text-[9px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                          {quotaDisplay.status === 'loading'
                            ? t('accounts.quota_syncing')
                            : quotaDisplay.status === 'error'
                              ? t('accounts.quota_unavailable')
                              : t('accounts.quota_unsupported')}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-auto space-y-2.5">
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
                        <div className={`grid gap-2 ${isCodexAccount(account) ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          <button onClick={() => setSelectedAccount(account)} className="btn-swiss !py-1.5 !text-[9px]">
                            {t('common.details')}
                          </button>
                          {isCodexAccount(account) ? (
                            <button
                              onClick={() => void refreshCodexQuota(account)}
                              className="btn-swiss !py-1.5 !text-[9px]"
                              disabled={!ready || codexQuotaByName[account.name]?.status === 'loading'}
                            >
                              REFRESH
                            </button>
                          ) : null}
                          <button
                            onClick={() => {
                              setDeleteError('');
                              setPendingDeleteName(account.name);
                            }}
                            className="btn-swiss !py-1.5 !text-[9px] !text-red-500"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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

function buildQuotaDisplay(account: AuthFile, state?: CodexQuotaState): QuotaDisplay {
  if (!isCodexAccount(account)) {
    return {
      status: 'unsupported',
      planType: '',
      windows: [],
    };
  }

  if (!state || state.status === 'loading') {
    return {
      status: 'loading',
      planType: '',
      windows: [],
    };
  }

  if (state.status === 'error' || !state.quota) {
    return {
      status: 'error',
      planType: '',
      windows: [],
    };
  }

  const windows = selectQuotaWindows(state.quota).map((window) => {
    const remainingPercent = normalizePercent(window.remainingPercent);
    const usedPercent = remainingPercent === null ? null : Math.max(0, 100 - remainingPercent);

    return {
      id: window.id,
      label: window.label,
      remainingPercent,
      usedLabel: usedPercent === null ? '--' : `${usedPercent}%`,
      resetLabel: window.resetLabel || '--',
    };
  });

  if (windows.length === 0) {
    return {
      status: 'empty',
      planType: state.quota.planType || '',
      windows: [],
    };
  }

  return {
    status: 'success',
    planType: state.quota.planType || '',
    windows,
  };
}

function selectQuotaWindows(quota: CodexQuota) {
  const preferredWindows = quota.windows.filter((window) => window.id === 'five-hour' || window.id === 'weekly');
  return preferredWindows.length > 0 ? preferredWindows : quota.windows.slice(0, 2);
}

function normalizePercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createPlaceholderWindows(): QuotaWindowDisplay[] {
  return [
    { id: 'placeholder-five-hour', label: '5H', remainingPercent: null, usedLabel: '--', resetLabel: '--' },
    { id: 'placeholder-weekly', label: '7D', remainingPercent: null, usedLabel: '--', resetLabel: '--' },
  ];
}

function formatQuotaResetDisplay(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') {
    return '--';
  }

  const chineseMatch = trimmed.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(上午|下午)?(\d{1,2}):(\d{2})/);
  if (chineseMatch) {
    const [, , month, day, meridiem, rawHour, minute] = chineseMatch;
    let hour = Number(rawHour);
    if (meridiem === '下午' && hour < 12) {
      hour += 12;
    }
    if (meridiem === '上午' && hour === 12) {
      hour = 0;
    }
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')} ${String(hour).padStart(2, '0')}:${minute}`;
  }

  return trimmed
    .replace(/^重置于\s*/u, '')
    .replace(/^reset\s*/iu, '')
    .trim();
}
