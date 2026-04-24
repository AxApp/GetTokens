import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext.jsx';
import { DeleteAuthFiles, ListAuthFiles } from '../../wailsjs/go/main/App';
import AccountDetailModal from '../components/biz/AccountDetailModal.jsx';

export default function AccountsPage({ sidecarStatus }) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [pendingDeleteName, setPendingDeleteName] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const ready = sidecarStatus?.code === 'ready';

  const loadAccounts = useCallback(async () => {
    if (!ready) {
      return;
    }

    setLoading(true);
    try {
      const response = await ListAuthFiles();
      setAccounts(response.files || []);
      setPendingDeleteName(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [ready]);

  useEffect(() => {
    if (ready) {
      loadAccounts();
    }
  }, [ready, loadAccounts]);

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

  async function deleteAccount(name) {
    setDeleteError('');
    try {
      await DeleteAuthFiles([name]);
      setPendingDeleteName(null);
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setDeleteError(`DELETE ERROR: ${error?.message || error}`);
    }
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
            <button onClick={loadAccounts} className="btn-swiss" disabled={!ready || loading}>
              {t('common.refresh')}
            </button>
          </header>

          <div className="flex flex-wrap items-center gap-6 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-hard shadow-[var(--shadow-color)]">
            <div className="flex min-w-[300px] flex-1 items-center gap-3">
              <span className="text-[10px] font-black uppercase">{t('common.search')}:</span>
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPendingDeleteName(null);
                }}
                type="text"
                className="input-swiss flex-1 uppercase"
                placeholder="NAME / PROVIDER..."
              />
            </div>
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
