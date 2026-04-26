import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  CreateCodexAPIKey,
  DeleteAuthFiles,
  DeleteCodexAPIKey,
  DownloadAuthFile,
  UpdateCodexAPIKeyPriority,
  UploadAuthFiles,
} from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import {
  buildAPIKeyLabelStorageKey,
  decodeBase64Utf8,
  downloadTextFile,
  emptyApiKeyForm,
  parseMaybeJSON,
  persistAPIKeyLabels,
} from '../model/accountConfig';
import { fallbackAPIKeyDisplayName } from '../model/accountPresentation';
import {
  buildAccountsExportFilename,
  encodeUTF8Base64,
  readUploadFiles,
  resolvePastedAuthFileName,
} from '../model/accountTransfer';
import type { ApiKeyFormState, SourceFilter, TrackRequest, Translator } from '../model/types';

interface UseAccountsActionsArgs {
  t: Translator;
  trackRequest: TrackRequest;
  apiKeyForm: ApiKeyFormState;
  pasteContent: string;
  selectedAccount: AccountRecord | null;
  selectedAccounts: AccountRecord[];
  setSelectedAccount: Dispatch<SetStateAction<AccountRecord | null>>;
  setPendingDeleteID: Dispatch<SetStateAction<string | null>>;
  setDeleteError: Dispatch<SetStateAction<string>>;
  setApiKeyFormError: Dispatch<SetStateAction<string>>;
  setIsApiKeyModalOpen: Dispatch<SetStateAction<boolean>>;
  setApiKeyForm: Dispatch<SetStateAction<ApiKeyFormState>>;
  setIsPasteModalOpen: Dispatch<SetStateAction<boolean>>;
  setPasteContent: Dispatch<SetStateAction<string>>;
  setPasteError: Dispatch<SetStateAction<string>>;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  setSourceFilter: Dispatch<SetStateAction<SourceFilter>>;
  setSelectedAccountIDs: Dispatch<SetStateAction<string[]>>;
  setAPIKeyLabels: Dispatch<SetStateAction<Record<string, string>>>;
  loadAccounts: () => Promise<void>;
}

export default function useAccountsActions({
  t,
  trackRequest,
  apiKeyForm,
  pasteContent,
  selectedAccount,
  selectedAccounts,
  setSelectedAccount,
  setPendingDeleteID,
  setDeleteError,
  setApiKeyFormError,
  setIsApiKeyModalOpen,
  setApiKeyForm,
  setIsPasteModalOpen,
  setPasteContent,
  setPasteError,
  setSearchTerm,
  setSourceFilter,
  setSelectedAccountIDs,
  setAPIKeyLabels,
  loadAccounts,
}: UseAccountsActionsArgs) {
  const deleteAccount = useCallback(
    async (account: AccountRecord) => {
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
    },
    [
      loadAccounts,
      selectedAccount,
      setAPIKeyLabels,
      setDeleteError,
      setPendingDeleteID,
      setSelectedAccount,
      t,
      trackRequest,
    ]
  );

  const uploadAccounts = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) {
        return;
      }

      setDeleteError('');
      try {
        const payload = await readUploadFiles(files);
        await trackRequest('UploadAuthFiles', { files: payload.map((item) => ({ name: item.name })) }, () =>
          UploadAuthFiles(payload)
        );
        await loadAccounts();
      } catch (error) {
        console.error(error);
        setDeleteError(`UPLOAD ERROR: ${toErrorMessage(error)}`);
      }
    },
    [loadAccounts, setDeleteError, trackRequest]
  );

  const openApiKeyModal = useCallback(() => {
    setApiKeyFormError('');
    setApiKeyForm(emptyApiKeyForm);
    setIsApiKeyModalOpen(true);
  }, [setApiKeyForm, setApiKeyFormError, setIsApiKeyModalOpen]);

  const submitApiKeyForm = useCallback(async () => {
    const apiKey = apiKeyForm.apiKey.trim();
    if (!apiKey) {
      setApiKeyFormError(t('accounts.api_key_required'));
      return;
    }

    try {
      const trimmedBaseURL = apiKeyForm.baseUrl.trim();
      const trimmedPrefix = apiKeyForm.prefix.trim();
      const trimmedLabel = apiKeyForm.label.trim();
      const parsedPriority = Number.parseInt(apiKeyForm.priority.trim() || '0', 10);
      await trackRequest(
        'CreateCodexAPIKey',
        { baseUrl: trimmedBaseURL },
        () =>
          CreateCodexAPIKey({
            apiKey,
            baseUrl: trimmedBaseURL,
            priority: Number.isFinite(parsedPriority) ? parsedPriority : 0,
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
  }, [
    apiKeyForm,
    loadAccounts,
    setAPIKeyLabels,
    setApiKeyForm,
    setApiKeyFormError,
    setIsApiKeyModalOpen,
    setSearchTerm,
    setSourceFilter,
    t,
    trackRequest,
  ]);

  const submitPasteImport = useCallback(async () => {
    const content = pasteContent.trim();
    if (!content) {
      setPasteError(t('accounts.paste_auth_file_required'));
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      setPasteError(t('accounts.paste_auth_file_invalid'));
      return;
    }

    const name = resolvePastedAuthFileName(parsed);

    try {
      const payload = [{ name, contentBase64: encodeUTF8Base64(content) }];

      await trackRequest('UploadAuthFiles', { files: [{ name }] }, () => UploadAuthFiles(payload));
      setIsPasteModalOpen(false);
      setPasteContent('');
      setPasteError('');
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setPasteError(toErrorMessage(error));
    }
  }, [loadAccounts, pasteContent, setIsPasteModalOpen, setPasteContent, setPasteError, t, trackRequest]);

  const exportSelectedAccounts = useCallback(async () => {
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
          downloadTextFile(buildAccountsExportFilename(), JSON.stringify(bundle, null, 2));
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
  }, [selectedAccounts, setDeleteError, setSelectedAccountIDs, t, trackRequest]);

  const renameSelectedApiKey = useCallback(
    (nextName: string) => {
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
    },
    [selectedAccount, setAPIKeyLabels, setSelectedAccount]
  );

  const updateSelectedApiKeyPriority = useCallback(
    async (priorityDraft: string) => {
      if (!selectedAccount?.id || selectedAccount.credentialSource !== 'api-key') {
        return;
      }

      try {
        const parsedPriority = Number.parseInt(priorityDraft.trim() || '0', 10);
        const nextPriority = Number.isFinite(parsedPriority) ? parsedPriority : 0;

        await trackRequest(
          'UpdateCodexAPIKeyPriority',
          { id: selectedAccount.id, priority: nextPriority },
          () =>
            UpdateCodexAPIKeyPriority({
              id: selectedAccount.id,
              priority: nextPriority,
            })
        );

        setSelectedAccount((prev) => (prev ? { ...prev, priority: nextPriority } : prev));
        await loadAccounts();
      } catch (error) {
        console.error(error);
        setDeleteError(`SAVE ERROR: ${toErrorMessage(error)}`);
      }
    },
    [loadAccounts, selectedAccount, setDeleteError, setSelectedAccount, trackRequest]
  );

  return {
    deleteAccount,
    uploadAccounts,
    openApiKeyModal,
    submitApiKeyForm,
    submitPasteImport,
    exportSelectedAccounts,
    renameSelectedApiKey,
    updateSelectedApiKeyPriority,
  };
}
