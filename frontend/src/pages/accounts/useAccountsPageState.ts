import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  CreateCodexAPIKey,
  DeleteAuthFiles,
  DeleteCodexAPIKey,
  DownloadAuthFile,
  GetCodexQuota,
  ListAccounts,
  ListAuthFiles,
  UploadAuthFiles,
} from '../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../types';
import { toErrorMessage } from '../../utils/error';
import {
  decodeBase64Utf8,
  downloadTextFile,
  emptyApiKeyForm,
  loadAPIKeyLabels,
  parseMaybeJSON,
  persistAPIKeyLabels,
  buildAPIKeyLabelStorageKey,
} from './accountConfig';
import { isCodexAuthFile, supportsQuota } from './accountQuota';
import { buildAccountsView } from './accountSelectors';
import {
  fallbackAPIKeyDisplayName,
  mapAuthFileToRecord,
  mapBackendAccountRecord,
} from './accountPresentation';
import type {
  ApiKeyFormState,
  AuthFile,
  CodexQuotaState,
  SourceFilter,
  Translator,
} from './types';

type TrackRequest = <T>(
  name: string,
  request: unknown,
  executor: () => Promise<T>,
  options?: {
    transport?: 'wails' | 'http';
    mapSuccess?: (result: T) => unknown;
  }
) => Promise<T>;

interface UseAccountsPageStateArgs {
  ready: boolean;
  t: Translator;
  trackRequest: TrackRequest;
  headerActionsMenuRef: MutableRefObject<HTMLDivElement | null>;
}

export default function useAccountsPageState({
  ready,
  t,
  trackRequest,
  headerActionsMenuRef,
}: UseAccountsPageStateArgs) {
  const [authFiles, setAuthFiles] = useState<AuthFile[]>([]);
  const [apiKeyRecords, setApiKeyRecords] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
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
  const [isHeaderActionsMenuOpen, setIsHeaderActionsMenuOpen] = useState(false);
  const quotaRequestIdRef = useRef(0);

  const authFileRecords = useMemo(
    () => authFiles.map((account) => mapAuthFileToRecord(account)),
    [authFiles]
  );

  const {
    accounts,
    filteredAccounts,
    groupedAccounts,
    selectedAccountIDSet,
    selectedAccounts,
    allFilteredSelected,
  } = useMemo(
    () =>
      buildAccountsView({
        authFileRecords,
        apiKeyRecords,
        codexQuotaByName,
        searchTerm,
        sourceFilter,
        selectedAccountIDs,
        t,
      }),
    [apiKeyRecords, authFileRecords, codexQuotaByName, searchTerm, selectedAccountIDs, sourceFilter, t]
  );

  const loadCodexQuotas = useCallback(
    async (items: AuthFile[]) => {
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
    },
    [trackRequest]
  );

  const refreshCodexQuota = useCallback(
    async (account: AccountRecord) => {
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
    },
    [trackRequest]
  );

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
      void loadAccounts();
    }
  }, [ready, loadAccounts]);

  useEffect(() => {
    if (!isHeaderActionsMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!headerActionsMenuRef.current?.contains(event.target as Node)) {
        setIsHeaderActionsMenuOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [headerActionsMenuRef, isHeaderActionsMenuOpen]);

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

    try {
      await trackRequest('DeleteAuthFiles', { names: [account.name] }, () => DeleteAuthFiles([account.name!]));
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
        { baseUrl: trimmedBaseURL },
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

  function renameSelectedApiKey(nextName: string) {
    if (!selectedAccount?.apiKey) {
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
  }

  function closeHeaderActionsMenu() {
    setIsHeaderActionsMenuOpen(false);
  }

  return {
    loading,
    searchTerm,
    sourceFilter,
    selectedAccount,
    pendingDeleteID,
    deleteError,
    apiKeyFormError,
    isApiKeyModalOpen,
    apiKeyForm,
    isPasteModalOpen,
    pasteContent,
    pasteError,
    codexQuotaByName,
    isSelectionMode,
    selectedAccountIDs,
    isHeaderActionsMenuOpen,
    accounts,
    filteredAccounts,
    groupedAccounts,
    selectedAccountIDSet,
    allFilteredSelected,
    loadAccounts,
    refreshCodexQuota,
    setSearchTerm,
    setSourceFilter,
    setSelectedAccount,
    setPendingDeleteID,
    setDeleteError,
    setApiKeyFormError,
    setIsApiKeyModalOpen,
    setApiKeyForm,
    setIsPasteModalOpen,
    setPasteContent,
    setPasteError,
    setSelectedAccountIDs,
    setIsHeaderActionsMenuOpen,
    uploadAccounts,
    openApiKeyModal,
    submitApiKeyForm,
    submitPasteImport,
    toggleAccountSelection,
    toggleSelectAllFiltered,
    toggleSelectionMode,
    exportSelectedAccounts,
    deleteAccount,
    renameSelectedApiKey,
    closeHeaderActionsMenu,
  };
}
