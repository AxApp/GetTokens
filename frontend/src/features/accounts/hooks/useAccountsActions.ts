import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  CreateCodexAPIKey,
  DeleteAuthFiles,
  DeleteCodexAPIKey,
  DownloadAuthFile,
  UpdateCodexAPIKeyConfig,
  UpdateCodexAPIKeyLabel,
  UpdateCodexAPIKeyPriority,
  UploadAuthFiles,
} from '../../../../wailsjs/go/main/App';
import { main } from '../../../../wailsjs/go/models';
import type { AccountRecord } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import {
  decodeBase64Utf8,
  downloadTextFile,
  emptyApiKeyForm,
  parseMaybeJSON,
} from '../model/accountConfig';
import { fallbackAPIKeyDisplayName } from '../model/accountPresentation';
import {
  buildAccountsExportFilename,
  encodeUTF8Base64,
  readUploadFiles,
  resolvePastedAuthFileName,
} from '../model/accountTransfer';
import type { ApiKeyFormState, TrackRequest, Translator } from '../model/types';

interface UseAccountsActionsArgs {
  t: Translator;
  trackRequest: TrackRequest;
  apiKeyForm: ApiKeyFormState;
  accounts: AccountRecord[];
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
  setSelectedAccountIDs: Dispatch<SetStateAction<string[]>>;
  loadAccounts: () => Promise<void>;
}

export default function useAccountsActions({
  t,
  trackRequest,
  apiKeyForm,
  accounts,
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
  setSelectedAccountIDs,
  loadAccounts,
}: UseAccountsActionsArgs) {
  const deleteAccount = useCallback(
    async (account: AccountRecord) => {
      setDeleteError('');

      if (account.credentialSource === 'api-key') {
        try {
          await trackRequest('DeleteCodexAPIKey', { id: account.id }, () => DeleteCodexAPIKey(account.id));
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
      const lowestPriority = accounts.reduce((min, account) => Math.min(min, Number(account.priority || 0)), 0);
      await trackRequest(
        'CreateCodexAPIKey',
        { baseUrl: trimmedBaseURL },
        () =>
          CreateCodexAPIKey({
            apiKey,
            label: trimmedLabel,
            baseUrl: trimmedBaseURL,
            priority: lowestPriority - 1,
            prefix: trimmedPrefix,
          })
      );
      setIsApiKeyModalOpen(false);
      setApiKeyForm(emptyApiKeyForm);
      setApiKeyFormError('');
      setSearchTerm('');
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setApiKeyFormError(toErrorMessage(error));
    }
  }, [
    apiKeyForm,
    accounts,
    loadAccounts,
    setApiKeyForm,
    setApiKeyFormError,
    setIsApiKeyModalOpen,
    setSearchTerm,
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
      if (!selectedAccount?.id || selectedAccount.credentialSource !== 'api-key') {
        return;
      }
      const trimmedName = nextName.trim();
      void (async () => {
        try {
          await trackRequest(
            'UpdateCodexAPIKeyLabel',
            { id: selectedAccount.id, label: trimmedName },
            () =>
              UpdateCodexAPIKeyLabel({
                id: selectedAccount.id,
                label: trimmedName,
              })
          );
          setSelectedAccount((prev) =>
            prev
              ? {
                  ...prev,
                  displayName: trimmedName || fallbackAPIKeyDisplayName(prev.apiKey || ''),
                }
              : prev
          );
          await loadAccounts();
        } catch (error) {
          console.error(error);
        }
      })();
    },
    [loadAccounts, selectedAccount, setSelectedAccount, trackRequest]
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

  const updateSelectedApiKeyConfig = useCallback(
    async (draft: { apiKey: string; baseUrl: string; prefix: string }) => {
      if (!selectedAccount?.id || selectedAccount.credentialSource !== 'api-key') {
        return;
      }

      const nextAPIKey = draft.apiKey.trim();
      const nextBaseURL = draft.baseUrl.trim();
      const nextPrefix = draft.prefix.trim();
      if (!nextAPIKey) {
        setDeleteError(`SAVE ERROR: ${t('accounts.api_key_required')}`);
        return;
      }

      try {
        await trackRequest(
          'UpdateCodexAPIKeyConfig',
          { id: selectedAccount.id, baseUrl: nextBaseURL },
          () =>
            UpdateCodexAPIKeyConfig(
              main.UpdateCodexAPIKeyConfigInput.createFrom({
                id: selectedAccount.id,
                apiKey: nextAPIKey,
                baseUrl: nextBaseURL,
                prefix: nextPrefix,
              })
            )
        );

        setSelectedAccount((prev) =>
          prev
            ? {
                ...prev,
                apiKey: nextAPIKey,
                baseUrl: nextBaseURL,
                prefix: nextPrefix,
              }
            : prev
        );
        await loadAccounts();
      } catch (error) {
        console.error(error);
        setDeleteError(`SAVE ERROR: ${toErrorMessage(error)}`);
        throw error;
      }
    },
    [loadAccounts, selectedAccount, setDeleteError, setSelectedAccount, t, trackRequest]
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
    updateSelectedApiKeyConfig,
  };
}
