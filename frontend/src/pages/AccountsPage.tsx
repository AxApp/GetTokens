import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CreateCodexAPIKey,
  DeleteAuthFiles,
  DeleteCodexAPIKey,
  DownloadAuthFile,
  GetCodexQuota,
  ListAccounts,
  ListAuthFiles,
  UploadAuthFiles,
} from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';
import AccountDetailModal from '../components/biz/AccountDetailModal';
import { useDebug } from '../context/DebugContext';
import { useI18n } from '../context/I18nContext';
import type { AccountRecord, AuthFile, CodexQuota, CredentialSource, SidecarStatus } from '../types';
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

interface ApiKeyFormState {
  label: string;
  apiKey: string;
  baseUrl: string;
  prefix: string;
}

interface ClickEventLike {
  stopPropagation: () => void;
}

const emptyApiKeyForm: ApiKeyFormState = {
  label: '',
  apiKey: '',
  baseUrl: '',
  prefix: '',
};

const API_KEY_LABELS_STORAGE_KEY = 'gettokens.apiKeyLabels';

export default function AccountsPage({ sidecarStatus }: AccountsPageProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const [authFiles, setAuthFiles] = useState<AuthFile[]>([]);
  const [apiKeyRecords, setApiKeyRecords] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | CredentialSource>('all');
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [pendingDeleteID, setPendingDeleteID] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [apiKeyFormError, setApiKeyFormError] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState<ApiKeyFormState>(emptyApiKeyForm);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [codexQuotaByName, setCodexQuotaByName] = useState<Record<string, CodexQuotaState>>({});
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [apiKeyLabels, setAPIKeyLabels] = useState<Record<string, string>>(() => loadAPIKeyLabels());
  const [selectedAccountIDs, setSelectedAccountIDs] = useState<string[]>([]);
  const [groupCardHeights, setGroupCardHeights] = useState<Record<string, number>>({});
  const pageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quotaRequestIdRef = useRef(0);

  const ready = sidecarStatus?.code === 'ready';

  const authFileRecords = useMemo(
    () => authFiles.map((account) => mapAuthFileToRecord(account)),
    [authFiles]
  );

  const accounts = useMemo(
    () => [...authFileRecords, ...apiKeyRecords].sort(compareAccountRecords),
    [authFileRecords, apiKeyRecords]
  );

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return accounts.filter((account) => {
      if (sourceFilter !== 'all' && account.credentialSource !== sourceFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        account.displayName,
        account.provider,
        account.email,
        account.planType,
        account.keyFingerprint,
        account.baseUrl,
        account.prefix,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [accounts, searchTerm, sourceFilter]);

  const groupedAccounts = useMemo(
    () => groupAccountsByPlan(filteredAccounts, codexQuotaByName, t),
    [codexQuotaByName, filteredAccounts, t]
  );

  const selectedAccountIDSet = useMemo(() => new Set(selectedAccountIDs), [selectedAccountIDs]);

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIDSet.has(account.id)),
    [accounts, selectedAccountIDSet]
  );

  const allFilteredSelected =
    filteredAccounts.length > 0 && filteredAccounts.every((account) => selectedAccountIDSet.has(account.id));

  const loadCodexQuotas = useCallback(async (items: AuthFile[]) => {
    const codexAccounts = items.filter((account) => isCodexAuthFile(account));
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

  const refreshCodexQuota = useCallback(async (account: AccountRecord) => {
    if (!supportsQuota(account) || !account.quotaKey) {
      return;
    }

    setCodexQuotaByName((prev) => ({
      ...prev,
      [account.quotaKey!]: { status: 'loading' },
    }));

    try {
      const quota = await trackRequest('GetCodexQuota', { name: account.quotaKey }, () =>
        GetCodexQuota(account.quotaKey!)
      );
      setCodexQuotaByName((prev) => ({
        ...prev,
        [account.quotaKey!]: { status: 'success', quota },
      }));
    } catch (error) {
      console.error(error);
      setCodexQuotaByName((prev) => ({
        ...prev,
        [account.quotaKey!]: { status: 'error' },
      }));
    }
  }, [trackRequest]);

  const loadAccounts = useCallback(async () => {
    if (!ready) {
      return;
    }

    setLoading(true);
    try {
      const [authFileResponse, accountResponse] = await Promise.all([
        trackRequest('ListAuthFiles', { args: [] }, () => ListAuthFiles()),
        trackRequest('ListAccounts', { args: [] }, () => ListAccounts()),
      ]);
      const files = authFileResponse.files || [];
      const apiKeyAccounts = (accountResponse || [])
        .map((account) => mapBackendAccountRecord(account, apiKeyLabels))
        .filter((account) => account.credentialSource === 'api-key');
      setAuthFiles(files);
      setApiKeyRecords(apiKeyAccounts);
      setPendingDeleteID(null);
      const nextAccountIDs = new Set<string>([
        ...files.map((file) => `auth-file:${file.name}`),
        ...apiKeyAccounts.map((account) => account.id),
      ]);
      setSelectedAccountIDs((prev) => prev.filter((id) => nextAccountIDs.has(id)));
      void loadCodexQuotas(files);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiKeyLabels, loadCodexQuotas, ready, trackRequest]);

  useEffect(() => {
    if (ready) {
      loadAccounts();
    }
  }, [ready, loadAccounts]);

  useLayoutEffect(() => {
    if (!pageRef.current) {
      return;
    }

    const measure = () => {
      const nextHeights: Record<string, number> = {};
      const groupNodes = pageRef.current?.querySelectorAll<HTMLElement>('[data-plan-group-grid]');
      groupNodes?.forEach((groupNode) => {
        const groupID = groupNode.dataset.planGroupGrid;
        if (!groupID) {
          return;
        }
        const cards = Array.from(groupNode.querySelectorAll<HTMLElement>('[data-account-card]'));
        if (cards.length === 0) {
          return;
        }
        cards.forEach((card) => {
          card.style.minHeight = '0px';
        });
        const maxHeight = cards.reduce((current, card) => Math.max(current, card.offsetHeight), 0);
        if (maxHeight > 0) {
          nextHeights[groupID] = maxHeight;
        }
      });

      setGroupCardHeights((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(nextHeights);
        if (prevKeys.length === nextKeys.length && prevKeys.every((key) => prev[key] === nextHeights[key])) {
          return prev;
        }
        return nextHeights;
      });
    };

    const frameID = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frameID);
      window.removeEventListener('resize', measure);
    };
  }, [groupedAccounts, loading, selectedAccountIDs]);

  async function deleteAccount(account: AccountRecord) {
    setDeleteError('');

    if (account.credentialSource === 'api-key') {
      try {
        await trackRequest('DeleteCodexAPIKey', { id: account.id }, () => DeleteCodexAPIKey(account.id));
        if (account.apiKey) {
          const storageKey = buildAPIKeyLabelStorageKey(account.apiKey, account.baseUrl || '', account.prefix || '');
          setAPIKeyLabels((prev) => {
            if (!(storageKey in prev)) {
              return prev;
            }
            const next = { ...prev };
            delete next[storageKey];
            persistAPIKeyLabels(next);
            return next;
          });
        }
        setPendingDeleteID(null);
        if (selectedAccount?.id === account.id) {
          setSelectedAccount(null);
        }
        await loadAccounts();
      } catch (error) {
        console.error(error);
        setDeleteError(`DELETE ERROR: ${toErrorMessage(error)}`);
      }
      return;
    }

    if (!account.name) {
      setDeleteError(`DELETE ERROR: ${t('accounts.delete_missing_name')}`);
      return;
    }

    const authFileName = account.name;

    try {
      await trackRequest('DeleteAuthFiles', { names: [authFileName] }, () => DeleteAuthFiles([authFileName]));
      setPendingDeleteID(null);
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

  function openApiKeyModal() {
    setApiKeyFormError('');
    setApiKeyForm(emptyApiKeyForm);
    setIsApiKeyModalOpen(true);
  }

  async function submitApiKeyForm() {
    const apiKey = apiKeyForm.apiKey.trim();
    if (!apiKey) {
      setApiKeyFormError(t('accounts.api_key_required'));
      return;
    }

    try {
      const trimmedBaseURL = apiKeyForm.baseUrl.trim();
      const trimmedPrefix = apiKeyForm.prefix.trim();
      const trimmedLabel = apiKeyForm.label.trim();
      await trackRequest(
        'CreateCodexAPIKey',
        {
          baseUrl: trimmedBaseURL,
        },
        () =>
          CreateCodexAPIKey({
            apiKey,
            baseUrl: trimmedBaseURL,
            prefix: trimmedPrefix,
          })
      );
      if (trimmedLabel) {
        setAPIKeyLabels((prev) => {
          const next = {
            ...prev,
            [buildAPIKeyLabelStorageKey(apiKey, trimmedBaseURL, trimmedPrefix)]: trimmedLabel,
          };
          persistAPIKeyLabels(next);
          return next;
        });
      }
      setIsApiKeyModalOpen(false);
      setApiKeyForm(emptyApiKeyForm);
      setApiKeyFormError('');
      setSourceFilter('all');
      setSearchTerm('');
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setApiKeyFormError(toErrorMessage(error));
    }
  }

  async function submitPasteImport() {
    const content = pasteContent.trim();
    if (!content) {
      setPasteError(t('accounts.paste_auth_file_required'));
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      setPasteError(t('accounts.paste_auth_file_invalid'));
      return;
    }

    // Try to extract a name, otherwise use a default
    let name = 'pasted-auth.json';
    if (parsed.name && typeof parsed.name === 'string') {
      name = parsed.name.endsWith('.json') ? parsed.name : `${parsed.name}.json`;
    } else if (parsed.email && typeof parsed.email === 'string') {
      name = `${parsed.email.split('@')[0]}-auth.json`;
    }

    try {
      const payload = [
        {
          name,
          contentBase64: window.btoa(unescape(encodeURIComponent(content))),
        },
      ];

      await trackRequest('UploadAuthFiles', { files: [{ name }] }, () => UploadAuthFiles(payload));
      setIsPasteModalOpen(false);
      setPasteContent('');
      setPasteError('');
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setPasteError(toErrorMessage(error));
    }
  }

  function toggleAccountSelection(accountID: string) {
    setSelectedAccountIDs((prev) =>
      prev.includes(accountID) ? prev.filter((id) => id !== accountID) : [...prev, accountID]
    );
  }

  function toggleSelectAllFiltered() {
    setSelectedAccountIDs((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredAccounts.forEach((account) => next.delete(account.id));
      } else {
        filteredAccounts.forEach((account) => next.add(account.id));
      }
      return [...next];
    });
  }

  function toggleSelectionMode() {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedAccountIDs([]);
      }
      return !prev;
    });
  }

  async function exportSelectedAccounts() {
    if (selectedAccounts.length === 0) {
      setDeleteError(t('accounts.export_empty_selection'));
      return;
    }

    setDeleteError('');
    try {
      const payload = await trackRequest(
        'ExportAccounts',
        { ids: selectedAccounts.map((account) => account.id) },
        async () => {
          const items = await Promise.all(
            selectedAccounts.map(async (account) => {
              if (account.credentialSource === 'auth-file' && account.name) {
                const response = await DownloadAuthFile(account.name);
                const content = decodeBase64Utf8(response.contentBase64);
                return {
                  id: account.id,
                  provider: account.provider,
                  credentialSource: account.credentialSource,
                  displayName: account.displayName,
                  email: account.email || '',
                  planType: account.planType || '',
                  fileName: response.name,
                  content: parseMaybeJSON(content),
                };
              }

              return {
                id: account.id,
                provider: account.provider,
                credentialSource: account.credentialSource,
                displayName: account.displayName,
                email: account.email || '',
                planType: account.planType || '',
                apiKey: account.apiKey || '',
                baseUrl: account.baseUrl || '',
                prefix: account.prefix || '',
              };
            })
          );

          const bundle = {
            exportedAt: new Date().toISOString(),
            total: items.length,
            items,
          };
          downloadTextFile(
            `gettokens-accounts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
            JSON.stringify(bundle, null, 2)
          );
          return bundle;
        },
        {
          mapSuccess: (bundle) => ({
            total: bundle.total,
          }),
        }
      );

      if (payload.total > 0) {
        setSelectedAccountIDs([]);
      }
    } catch (error) {
      console.error(error);
      setDeleteError(`EXPORT ERROR: ${toErrorMessage(error)}`);
    }
  }

  return (
    <>
      <div
        ref={pageRef}
        className="h-full w-full overflow-auto bg-[var(--bg-surface)] p-12"
        data-collaboration-id="PAGE_ACCOUNTS"
      >
        <div className="mx-auto max-w-6xl space-y-8 pb-32">
          <header className="flex flex-col gap-5 border-b-4 border-[var(--border-color)] pb-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {t('accounts.title')}
              </h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {t('accounts.subtitle')} / {accounts.length} UNITS
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
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
                className="btn-swiss min-w-[170px]"
                disabled={!ready || loading}
              >
                {t('accounts.import_auth_file')}
              </button>
              <button
                onClick={() => {
                  setPasteError('');
                  setPasteContent('');
                  setIsPasteModalOpen(true);
                }}
                className="btn-swiss min-w-[170px]"
                disabled={!ready || loading}
              >
                {t('accounts.paste_auth_file')}
              </button>
              <button onClick={openApiKeyModal} className="btn-swiss min-w-[170px]">
                {t('accounts.add_codex_api_key')}
              </button>
              <button onClick={loadAccounts} className="btn-swiss" disabled={!ready || loading}>
                {t('common.refresh')}
              </button>
            </div>
          </header>

          <section className="card-swiss !p-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex w-full items-center">
                <input
                  value={searchTerm}
                  onChange={(event: TextInputEvent) => {
                    setSearchTerm(event.target.value);
                    setPendingDeleteID(null);
                  }}
                  type="text"
                  className="input-swiss w-full uppercase"
                  placeholder={t('accounts.search_placeholder')}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {(['all', 'auth-file', 'api-key'] as const).map((source) => (
                  <button
                    key={source}
                    onClick={() => setSourceFilter(source)}
                    className={`btn-swiss !px-3 !py-2 !text-[9px] ${
                      sourceFilter === source ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''
                    }`}
                  >
                    {source === 'all'
                      ? t('accounts.filter_all')
                      : source === 'auth-file'
                        ? t('accounts.source_auth_file')
                        : t('accounts.source_api_key')}
                  </button>
                ))}
                <button onClick={toggleSelectionMode} className="btn-swiss !px-3 !py-2 !text-[9px]">
                  {isSelectionMode ? t('accounts.unselect_all') : t('accounts.selection_mode')}
                </button>
              </div>
              {isSelectionMode ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border-color)] pt-4">
                  <button onClick={toggleSelectAllFiltered} className="btn-swiss !px-3 !py-2 !text-[9px]">
                    {allFilteredSelected ? t('accounts.unselect_all') : t('accounts.select_all')}
                  </button>
                  <button
                    onClick={() => setSelectedAccountIDs([])}
                    className="btn-swiss !px-3 !py-2 !text-[9px]"
                    disabled={selectedAccountIDs.length === 0}
                  >
                    {t('accounts.clear_selection')}
                  </button>
                  <button
                    onClick={() => void exportSelectedAccounts()}
                    className="btn-swiss !px-3 !py-2 !text-[9px]"
                    disabled={selectedAccountIDs.length === 0}
                  >
                    {t('accounts.export_selected')}
                  </button>
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {selectedAccountIDs.length} {t('accounts.selected_count')}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {deleteError ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-500">
              {deleteError}
            </div>
          ) : null}

          {!ready ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <AccountCardSkeleton key={`ready-${i}`} />
              ))}
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <AccountCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="border-2 border-dashed border-[var(--border-color)] p-20 text-center font-black uppercase italic text-[var(--text-muted)]">
              {t('accounts.empty')}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedAccounts.map((group) => (
                <section key={group.id} className="space-y-4">
                  <div className="flex items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
                    <div className="flex items-center gap-4">
                      <div className="h-5 w-5 bg-[var(--accent-red)]" />
                      <h3 className="text-3xl font-black uppercase italic leading-none tracking-tighter text-[var(--text-primary)]">
                        {group.label}
                      </h3>
                      <span className="mb-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                        {groupProviderLabel(group.accounts)}
                      </span>
                    </div>
                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
                      {group.accounts.length} {t('accounts.plan_group_meta')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-3" data-plan-group-grid={group.id}>
                    {group.accounts.map((account) => {
                      const quotaDisplay = buildQuotaDisplay(account, codexQuotaByName[account.quotaKey || '']);
                      const planLabel = resolveAccountPlanLabel(account, quotaDisplay);
                      const primaryLabel = resolveAccountPrimaryLabel(account, planLabel);

                      if (quotaDisplay.status === 'loading') {
                        return <AccountCardSkeleton key={account.id} />;
                      }

                      return (
                        <div
                          key={account.id}
                          data-account-card
                          className="card-swiss flex h-full flex-col bg-[var(--bg-main)] p-5 transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]"
                          style={groupCardHeights[group.id] ? { minHeight: `${groupCardHeights[group.id]}px` } : undefined}
                        >
                          <div className="mb-5 flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-2">
                              <h3 className="flex items-center gap-2 break-all text-[12px] font-black uppercase leading-snug tracking-[0.08em] text-[var(--text-primary)]">
                                <div
                                  title={account.localOnly ? t('accounts.status_local') : account.status}
                                  className={`h-2 w-2 shrink-0 ${
                                    (account.localOnly ? 'LOCAL' : account.status).toUpperCase() === 'ACTIVE'
                                      ? 'bg-green-500'
                                      : (account.localOnly ? 'LOCAL' : account.status).toUpperCase() === 'DISABLED'
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                  }`}
                                />
                                <span className={account.credentialSource === 'auth-file' && account.email ? 'normal-case tracking-normal' : ''}>
                                  {primaryLabel}
                                </span>
                              </h3>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              {isSelectionMode ? (
                                <label className="flex cursor-pointer items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
                                  <input
                                    type="checkbox"
                                    checked={selectedAccountIDSet.has(account.id)}
                                    onChange={() => toggleAccountSelection(account.id)}
                                    className="h-3.5 w-3.5 accent-[var(--text-primary)]"
                                  />
                                  {t('accounts.select_account')}
                                </label>
                              ) : null}
                            </div>
                          </div>

                          {quotaDisplay.windows.length > 0 ? (
                            <div className="mb-4 space-y-3 border-t border-dashed border-[var(--border-color)] pt-4">
                              {quotaDisplay.windows.map((window) => (
                                <div
                                  key={window.id}
                                  className="space-y-2.5 border-b border-dashed border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0"
                                >
                                  <div className="flex items-end justify-between gap-3 text-[8px] font-black uppercase">
                                    <span className="tracking-[0.2em] text-[var(--text-muted)]">{window.label}</span>
                                    <span className="text-green-600">
                                      {t('accounts.quota_remaining')} {window.remainingPercent === null ? '--' : `${window.remainingPercent}%`}
                                    </span>
                                  </div>
                                  <div
                                    className={`relative h-6 w-full overflow-hidden ${
                                      quotaDisplay.status === 'loading' ? 'animate-pulse' : ''
                                    }`}
                                  >
                                    <div
                                      className="absolute inset-0 opacity-50"
                                      style={{
                                        backgroundImage:
                                          'linear-gradient(to right, var(--border-color) 0 8px, transparent 8px 12px)',
                                        backgroundSize: '12px 100%',
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
                                          'linear-gradient(to right, rgb(22 163 74) 0 8px, transparent 8px 12px)',
                                        backgroundSize: '12px 100%',
                                        backgroundRepeat: 'repeat-x',
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-[8px] font-black uppercase tracking-[0.12em]">
                                    <span className="text-[var(--text-muted)]">{t('accounts.quota_reset')}</span>
                                    <div
                                      className="cursor-help text-right text-[var(--text-primary)]"
                                      title={formatQuotaResetDisplay(window.resetLabel)}
                                    >
                                      {formatQuotaResetRelative(window.resetLabel)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="mt-auto">
                            {pendingDeleteID === account.id ? (
                              <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--border-color)] pt-3">
                                <div className="shrink-0 text-[9px] font-black uppercase tracking-wide text-red-500">
                                  {t('common.confirm_delete')}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setPendingDeleteID(null)}
                                    className="btn-swiss !px-3 !py-1 !text-[9px]"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                  <button
                                    onClick={() => void deleteAccount(account)}
                                    className="btn-swiss !px-3 !py-1 !text-[9px] !text-red-500"
                                  >
                                    {t('common.delete')}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={`grid gap-2 border-t border-dashed border-[var(--border-color)] pt-3 ${supportsQuota(account) ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                <button
                                  onClick={() => setSelectedAccount(account)}
                                  className="btn-swiss !py-1.5 !text-[9px]"
                                >
                                  {t('common.details')}
                                </button>
                                {supportsQuota(account) ? (
                                  <button
                                    onClick={() => void refreshCodexQuota(account)}
                                    className="btn-swiss !py-1.5 !text-[9px]"
                                    disabled={!ready || codexQuotaByName[account.quotaKey || '']?.status === 'loading'}
                                  >
                                    {t('accounts.refresh_quota')}
                                  </button>
                                ) : null}
                                <button
                                  onClick={() => {
                                    setDeleteError('');
                                    setPendingDeleteID(account.id);
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
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedAccount?.credentialSource === 'auth-file' && selectedAccount.rawAuthFile ? (
        <AccountDetailModal account={selectedAccount.rawAuthFile} onClose={() => setSelectedAccount(null)} />
      ) : null}

      {selectedAccount?.credentialSource === 'api-key' ? (
        <ApiKeyDetailModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onRename={(nextName) => {
            if (!selectedAccount.apiKey) {
              return;
            }
            const storageKey = buildAPIKeyLabelStorageKey(
              selectedAccount.apiKey,
              selectedAccount.baseUrl || '',
              selectedAccount.prefix || ''
            );
            const trimmedName = nextName.trim();
            setAPIKeyLabels((prev) => {
              const next = { ...prev };
              if (trimmedName) {
                next[storageKey] = trimmedName;
              } else {
                delete next[storageKey];
              }
              persistAPIKeyLabels(next);
              return next;
            });
            setSelectedAccount((prev) =>
              prev
                ? {
                    ...prev,
                    displayName: trimmedName || fallbackAPIKeyDisplayName(prev.apiKey || ''),
                  }
                : prev
            );
          }}
          t={t}
        />
      ) : null}

      {isApiKeyModalOpen ? (
        <ApiKeyComposeModal
          t={t}
          form={apiKeyForm}
          error={apiKeyFormError}
          onClose={() => {
            setIsApiKeyModalOpen(false);
            setApiKeyFormError('');
          }}
          onChange={(field, value) => {
            setApiKeyForm((prev) => ({ ...prev, [field]: value }));
            setApiKeyFormError('');
          }}
          onSubmit={submitApiKeyForm}
        />
      ) : null}

      {isPasteModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setIsPasteModalOpen(false)}
        >
          <div
            className="flex w-full max-w-2xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.import_auth_file')}
              </div>
              <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
                {t('accounts.paste_auth_file_title')}
              </h3>
            </header>
            <div className="space-y-4 p-6">
              <textarea
                autoFocus
                value={pasteContent}
                onChange={(e) => {
                  setPasteContent(e.target.value);
                  setPasteError('');
                }}
                className="input-swiss h-64 w-full resize-none font-mono text-xs"
                placeholder={t('accounts.paste_auth_file_placeholder')}
              />
              {pasteError ? (
                <div className="text-[10px] font-black uppercase tracking-wide text-red-500">
                  {pasteError}
                </div>
              ) : null}
            </div>
            <footer className="flex items-center justify-end gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
              <button onClick={() => setIsPasteModalOpen(false)} className="btn-swiss">
                {t('common.cancel')}
              </button>
              <button onClick={submitPasteImport} className="btn-swiss">
                {t('common.upload')}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ApiKeyComposeModal({
  t,
  form,
  error,
  onClose,
  onChange,
  onSubmit,
}: {
  t: (key: string) => string;
  form: ApiKeyFormState;
  error: string;
  onClose: () => void;
  onChange: (field: keyof ApiKeyFormState, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.source_api_key')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('accounts.add_codex_api_key')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.api_key_label')}
              </span>
              <input
                value={form.label}
                onChange={(event: TextInputEvent) => onChange('label', event.target.value)}
                className="input-swiss w-full"
                placeholder={t('accounts.api_key_label_placeholder')}
              />
            </label>
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.api_key_value')}
              </span>
              <input
                value={form.apiKey}
                onChange={(event: TextInputEvent) => onChange('apiKey', event.target.value)}
                className="input-swiss w-full"
                placeholder={t('accounts.api_key_value_placeholder')}
                type="password"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Base URL
              </span>
              <input
                value={form.baseUrl}
                onChange={(event: TextInputEvent) => onChange('baseUrl', event.target.value)}
                className="input-swiss w-full"
                placeholder="https://api.openai.com/v1"
              />
            </label>
          </div>

          <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {t('accounts.api_key_plain_notice')}
          </div>

          {error ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-500">
              {error}
            </div>
          ) : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
            {t('accounts.add_codex_api_key')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ApiKeyDetailModal({
  account,
  onClose,
  onRename,
  t,
}: {
  account: AccountRecord;
  onClose: () => void;
  onRename: (nextName: string) => void;
  t: (key: string) => string;
}) {
  const [draftName, setDraftName] = useState(account.displayName);

  useEffect(() => {
    setDraftName(account.displayName);
  }, [account.displayName]);

  const detailRows: Array<[string, string]> = [
    [t('accounts.provider'), providerLabel(account)],
    [t('accounts.source_api_key'), sourceLabel(t, account.credentialSource)],
    ['API KEY', account.apiKey || '--'],
    ['FINGERPRINT', account.keyFingerprint || '--'],
    ['BASE URL', formatCompactBaseUrl(account.baseUrl)],
    ...(account.prefix ? [['PREFIX', account.prefix]] as Array<[string, string]> : []),
    [t('common.status'), account.localOnly ? t('accounts.status_local') : account.status],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
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
        </header>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          {detailRows.map(([label, value]) => (
            <div key={label} className="space-y-1 border-b border-dashed border-[var(--border-color)] pb-3">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
              <div className="break-all text-[11px] font-black uppercase text-[var(--text-primary)]">{value}</div>
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
            {t('accounts.api_key_plain_notice')}
          </div>
          <button onClick={onClose} className="btn-swiss">
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function compareAccountRecords(left: AccountRecord, right: AccountRecord) {
  return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' });
}

function groupAccountsByPlan(
  accounts: AccountRecord[],
  codexQuotaByName: Record<string, CodexQuotaState>,
  t: (key: string) => string
) {
  const groups = new Map<
    string,
    {
      id: string;
      label: string;
      rank: number;
      accounts: AccountRecord[];
    }
  >();

  for (const account of accounts) {
    const quotaDisplay = buildQuotaDisplay(account, codexQuotaByName[account.quotaKey || '']);
    const label = resolvePlanGroupLabel(account, quotaDisplay, t);
    const id = label.toLowerCase();
    const existing = groups.get(id);
    if (existing) {
      existing.accounts.push(account);
      continue;
    }
    groups.set(id, {
      id,
      label,
      rank: planGroupRank(label),
      accounts: [account],
    });
  }

  return [...groups.values()].sort((left, right) => {
    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
  });
}

function sourceLabel(t: (key: string) => string, source: CredentialSource) {
  return source === 'auth-file' ? t('accounts.source_auth_file') : t('accounts.source_api_key');
}

function providerLabel(account: AccountRecord) {
  return String(account.provider || 'unknown').trim().toUpperCase();
}

function mapAuthFileToRecord(account: AuthFile): AccountRecord {
  const provider = String(account.provider || account.type || 'unknown').trim().toLowerCase() || 'unknown';
  return {
    id: `auth-file:${account.name}`,
    provider,
    credentialSource: 'auth-file',
    displayName: account.name,
    status: String(account.status || 'active').trim().toUpperCase() || 'ACTIVE',
    disabled: account.disabled,
    email: account.email,
    planType: account.planType,
    name: account.name,
    quotaKey: account.name,
    rawAuthFile: account,
  };
}

function mapBackendAccountRecord(account: main.AccountRecord, apiKeyLabels: Record<string, string>): AccountRecord {
  const credentialSource = account.credentialSource === 'api-key' ? 'api-key' : 'auth-file';
  const storageKey =
    credentialSource === 'api-key'
      ? buildAPIKeyLabelStorageKey(account.apiKey || '', account.baseUrl || '', account.prefix || '')
      : '';
  const localDisplayName = storageKey ? apiKeyLabels[storageKey] : '';

  return {
    ...account,
    displayName: localDisplayName || account.displayName,
    credentialSource,
  };
}

function supportsQuota(account: AccountRecord) {
  return account.credentialSource === 'auth-file' && providerLabel(account).toLowerCase() === 'codex';
}

function isCodexAuthFile(account: AuthFile) {
  const provider = String(account.provider || account.type || '')
    .trim()
    .toLowerCase();
  return provider === 'codex';
}

function buildQuotaDisplay(account: AccountRecord, state?: CodexQuotaState): QuotaDisplay {
  if (!supportsQuota(account)) {
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

function resolveAccountPlanLabel(account: AccountRecord, quotaDisplay: QuotaDisplay) {
  const plan = String(quotaDisplay.planType || account.planType || '')
    .trim()
    .toUpperCase();
  return plan || '';
}

function resolveAccountPrimaryLabel(account: AccountRecord, planLabel: string) {
  if (account.credentialSource === 'auth-file') {
    const primary = String(account.email || account.displayName || '').trim();
    if (primary) {
      return primary;
    }
  }
  return account.displayName;
}

function fallbackAPIKeyDisplayName(apiKey: string) {
  const suffix = apiKey.trim().slice(-4);
  return suffix ? `CODEX API KEY · ${suffix}` : 'CODEX API KEY';
}

function resolvePlanGroupLabel(account: AccountRecord, quotaDisplay: QuotaDisplay, t: (key: string) => string) {
  if (account.credentialSource === 'api-key') {
    return t('accounts.plan_group_api_key');
  }
  const label = resolveAccountPlanLabel(account, quotaDisplay);
  return label || t('accounts.plan_group_none');
}

function groupProviderLabel(accounts: AccountRecord[]) {
  if (accounts.length === 0) {
    return 'UNKNOWN';
  }
  return providerLabel(accounts[0]);
}

function planGroupRank(label: string) {
  const normalized = label.trim().toUpperCase();
  if (normalized === 'API KEY') {
    return 5;
  }
  if (normalized === 'PRO') {
    return 0;
  }
  if (normalized === 'PLUS') {
    return 1;
  }
  if (normalized === 'FREE') {
    return 2;
  }
  if (normalized === 'TEAM') {
    return 3;
  }
  if (normalized === 'ENTERPRISE') {
    return 4;
  }
  return 9;
}

function selectQuotaWindows(quota: CodexQuota) {
  const preferredWindows = quota.windows.filter(
    (window) =>
      window.id === 'five-hour' ||
      window.id === 'weekly' ||
      window.id.endsWith('-five-hour') ||
      window.id.endsWith('-weekly')
  );
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

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function normalizePrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^\/+|\/+$/g, '');
}

function formatCompactBaseUrl(value?: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '--';
  }

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.host}${path}`;
  } catch {
    return trimmed;
  }
}

function parseMaybeJSON(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function decodeBase64Utf8(value: string) {
  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function buildAPIKeyLabelStorageKey(apiKey: string, baseUrl: string, prefix: string) {
  return JSON.stringify({
    apiKey: apiKey.trim(),
    baseUrl: normalizeBaseUrl(baseUrl),
    prefix: normalizePrefix(prefix),
  });
}

function loadAPIKeyLabels() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(API_KEY_LABELS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function persistAPIKeyLabels(labels: Record<string, string>) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(API_KEY_LABELS_STORAGE_KEY, JSON.stringify(labels));
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function formatQuotaResetRelative(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') {
    return '--';
  }

  const date = parseQuotaResetDate(trimmed);
  if (!date || isNaN(date.getTime())) {
    return '--';
  }

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return '0s';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const parts: string[] = [];
  if (diffDay > 0) {
    parts.push(`${diffDay}d`);
  }
  if (diffHour % 24 > 0) {
    parts.push(`${diffHour % 24}h`);
  }
  if (diffDay === 0 && diffMin % 60 > 0) {
    parts.push(`${diffMin % 60}m`);
  }

  if (parts.length === 0) {
    return '0s';
  }
  return parts.slice(0, 2).join(', ');
}

function formatQuotaResetDisplay(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') {
    return '--';
  }

  const parsed = parseQuotaResetDate(trimmed);
  if (parsed && !isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hour = String(parsed.getHours()).padStart(2, '0');
    const minute = String(parsed.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
  }

  return trimmed
    .replace(/^重置于\s*/u, '')
    .replace(/^reset\s*/iu, '')
    .trim();
}

function parseQuotaResetDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') {
    return null;
  }

  const normalized = trimmed
    .replace(/^重置于\s*/u, '')
    .replace(/^reset\s*/iu, '')
    .trim();

  const chineseMatch = normalized.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(上午|下午)?(\d{1,2}):(\d{2})/);
  if (chineseMatch) {
    const [, year, month, day, meridiem, rawHour, minute] = chineseMatch;
    let hour = Number(rawHour);
    if (meridiem === '下午' && hour < 12) {
      hour += 12;
    }
    if (meridiem === '上午' && hour === 12) {
      hour = 0;
    }
    return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute));
  }

  const parsed = new Date(normalized);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function AccountCardSkeleton() {
  return (
    <div className="card-swiss flex animate-pulse flex-col bg-[var(--bg-main)] p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-3/4 bg-[var(--bg-muted)]" />
            <div className="h-2 w-2 shrink-0 bg-[var(--bg-muted)]" />
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-4 border-t border-dashed border-[var(--border-color)] pt-4">
        <div className="space-y-3 border-b border-dashed border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0">
          <div className="flex items-end justify-between gap-3">
            <div className="h-2 w-1/4 bg-[var(--bg-muted)]" />
            <div className="h-2 w-1/6 bg-[var(--bg-muted)]" />
          </div>
          <div className="h-6 w-full bg-[var(--bg-muted)] opacity-50" />
          <div className="flex items-center justify-between gap-3">
            <div className="h-2 w-1/5 bg-[var(--bg-muted)]" />
            <div className="h-2 w-1/4 bg-[var(--bg-muted)]" />
          </div>
        </div>
      </div>

      <div className="mt-auto flex gap-3 border-t border-dashed border-[var(--border-color)] pt-4">
        <div className="h-8 flex-1 bg-[var(--bg-muted)]" />
        <div className="h-8 flex-1 bg-[var(--bg-muted)]" />
      </div>
    </div>
  );
}
