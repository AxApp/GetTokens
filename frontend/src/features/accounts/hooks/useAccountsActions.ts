import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import {
  CreateCodexAPIKey,
  DeleteAuthFiles,
  DeleteCodexAPIKey,
  DeleteOpenAICompatibleProvider,
  DownloadAuthFile,
  SetAccountDisabled,
  TestCodexAPIKeyQuotaCurl,
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
  parseAccountCardImportPayload,
  readUploadFiles,
  resolvePastedAuthFileName,
} from '../model/accountTransfer';
import type { ApiKeyConfigDraft } from '../model/accountDetailConfig';
import { resolveAccountDeleteRequest } from '../model/accountDelete';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import {
  resolveBulkQuotaRefreshTargets,
  resolveBulkSetDisabledTargets,
  type AccountBulkActionID,
} from '../model/accountSelection';
import type { AccountActionNotice, ApiKeyFormState, TrackRequest, Translator } from '../model/types';

interface UseAccountsActionsArgs {
  ready: boolean;
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
  setAccountActionNotice: Dispatch<SetStateAction<AccountActionNotice | null>>;
  removeDeletedAccountLocally: (account: AccountRecord) => void;
  patchAccountDisabledLocally: (account: AccountRecord, disabled: boolean) => void;
  refreshAccountQuota: (account: AccountRecord) => Promise<void>;
  loadAccounts: (options?: { showLoading?: boolean; refreshSupplementalData?: boolean }) => Promise<void>;
}

export default function useAccountsActions({
  ready,
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
  setAccountActionNotice,
  removeDeletedAccountLocally,
  patchAccountDisabledLocally,
  refreshAccountQuota,
  loadAccounts,
}: UseAccountsActionsArgs) {
  const [bulkActionPending, setBulkActionPending] = useState<AccountBulkActionID | null>(null);

  const setAccountDisabled = useCallback(
    async (account: AccountRecord, nextDisabled: boolean, options?: { reload?: boolean }) => {
      if (!ready || !hasWailsAppBindings()) {
        patchAccountDisabledLocally(account, nextDisabled);
        return;
      }

      await trackRequest('SetAccountDisabled', { id: account.id, disabled: nextDisabled }, () =>
        SetAccountDisabled(account.id, nextDisabled)
      );
      patchAccountDisabledLocally(account, nextDisabled);

      if (options?.reload ?? true) {
        await loadAccounts({ showLoading: false, refreshSupplementalData: false });
      }
    },
    [loadAccounts, patchAccountDisabledLocally, ready, trackRequest],
  );

  const toggleAccountDisabled = useCallback(
    async (account: AccountRecord) => {
      try {
        await setAccountDisabled(account, !account.disabled);
      } catch (error) {
        console.error(error);
        setDeleteError(`SAVE ERROR: ${toErrorMessage(error)}`);
      }
    },
    [setAccountDisabled, setDeleteError],
  );

  const executeDeleteAccount = useCallback(
    async (account: AccountRecord, options?: { reload?: boolean }) => {
      const deleteRequest = resolveAccountDeleteRequest(account);

      if (deleteRequest.type === 'missing-auth-file-name' || deleteRequest.type === 'missing-openai-compatible-name') {
        throw new Error(t('accounts.delete_missing_name'));
      }

      if (!hasWailsAppBindings()) {
        setPendingDeleteID(null);
        removeDeletedAccountLocally(account);
        return;
      }

      if (deleteRequest.type === 'openai-compatible-provider') {
        await trackRequest('DeleteOpenAICompatibleProvider', { name: deleteRequest.name }, () =>
          DeleteOpenAICompatibleProvider(deleteRequest.name)
        );
      } else if (deleteRequest.type === 'codex-api-key') {
        await trackRequest('DeleteCodexAPIKey', { id: deleteRequest.id }, () => DeleteCodexAPIKey(deleteRequest.id));
      } else {
        await trackRequest('DeleteAuthFiles', { names: [deleteRequest.name] }, () => DeleteAuthFiles([deleteRequest.name]));
      }

      setPendingDeleteID(null);
      removeDeletedAccountLocally(account);

      if (options?.reload ?? true) {
        await loadAccounts({ showLoading: false, refreshSupplementalData: false });
      }
    },
    [loadAccounts, removeDeletedAccountLocally, setPendingDeleteID, t, trackRequest],
  );

  const deleteAccount = useCallback(
    async (account: AccountRecord) => {
      setDeleteError('');
      try {
        await executeDeleteAccount(account);
      } catch (error) {
        console.error(error);
        setDeleteError(`DELETE ERROR: ${toErrorMessage(error)}`);
      }
    },
    [executeDeleteAccount, setDeleteError],
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
      const trimmedQuotaCurl = apiKeyForm.quotaCurl.trim();
      const lowestPriority = accounts.reduce((min, account) => Math.min(min, Number(account.priority || 0)), 0);
      await trackRequest(
        'CreateCodexAPIKey',
        { baseUrl: trimmedBaseURL },
        () =>
          CreateCodexAPIKey(main.CreateCodexAPIKeyInput.createFrom({
            apiKey,
            label: trimmedLabel,
            baseUrl: trimmedBaseURL,
            priority: lowestPriority - 1,
            prefix: trimmedPrefix,
            quotaCurl: trimmedQuotaCurl,
            quotaEnabled: Boolean(apiKeyForm.quotaEnabled && trimmedQuotaCurl),
          }))
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

    const copiedAccount = parseAccountCardImportPayload(parsed);

    try {
      if (copiedAccount?.type === 'codex-api-key') {
        const lowestPriority = accounts.reduce((min, account) => Math.min(min, Number(account.priority || 0)), 0);
        await trackRequest(
          'CreateCodexAPIKey',
          { baseUrl: copiedAccount.baseUrl, source: 'account-card-paste' },
          () =>
            CreateCodexAPIKey(main.CreateCodexAPIKeyInput.createFrom({
              apiKey: copiedAccount.apiKey,
              label: copiedAccount.label,
              baseUrl: copiedAccount.baseUrl,
              priority: lowestPriority - 1,
              prefix: copiedAccount.prefix,
            }))
        );
        setIsPasteModalOpen(false);
        setPasteContent('');
        setPasteError('');
        await loadAccounts();
        return;
      }

      const name = copiedAccount?.type === 'auth-file' ? copiedAccount.name : resolvePastedAuthFileName(parsed);
      const uploadContent = copiedAccount?.type === 'auth-file' ? copiedAccount.content : content;
      const payload = [{ name, contentBase64: encodeUTF8Base64(uploadContent) }];

      await trackRequest('UploadAuthFiles', { files: [{ name }] }, () => UploadAuthFiles(payload));
      setIsPasteModalOpen(false);
      setPasteContent('');
      setPasteError('');
      await loadAccounts();
    } catch (error) {
      console.error(error);
      setPasteError(toErrorMessage(error));
    }
  }, [accounts, loadAccounts, pasteContent, setIsPasteModalOpen, setPasteContent, setPasteError, t, trackRequest]);

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
          await loadAccounts({ refreshSupplementalData: false });
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
        await loadAccounts({ refreshSupplementalData: false });
      } catch (error) {
        console.error(error);
        setDeleteError(`SAVE ERROR: ${toErrorMessage(error)}`);
      }
    },
    [loadAccounts, selectedAccount, setDeleteError, setSelectedAccount, trackRequest]
  );

  const updateSelectedApiKeyConfig = useCallback(
    async (draft: ApiKeyConfigDraft) => {
      if (!selectedAccount?.id || selectedAccount.credentialSource !== 'api-key') {
        return;
      }

      const nextAPIKey = draft.apiKey.trim();
      const nextBaseURL = draft.baseUrl.trim();
      const nextPrefix = draft.prefix.trim();
      const nextQuotaCurl = draft.quotaCurl.trim();
      const nextBillingCurl = draft.billingCurl.trim();
      const nextProxyURL = draft.proxyUrl.trim();
      if (!nextAPIKey) {
        setDeleteError(`SAVE ERROR: ${t('accounts.api_key_required')}`);
        return;
      }

      try {
        if (draft.quotaEnabled && nextQuotaCurl) {
          await trackRequest(
            'TestCodexAPIKeyQuotaCurl',
            { id: selectedAccount.id, baseUrl: nextBaseURL },
            () =>
              TestCodexAPIKeyQuotaCurl(
                main.TestCodexAPIKeyQuotaCurlInput.createFrom({
                  apiKey: nextAPIKey,
                  baseUrl: nextBaseURL,
                  prefix: nextPrefix,
                  quotaCurl: nextQuotaCurl,
                })
              )
          );
        }

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
                quotaCurl: nextQuotaCurl,
                quotaEnabled: Boolean(draft.quotaEnabled && nextQuotaCurl),
                billingCurl: nextBillingCurl,
                billingEnabled: Boolean(draft.billingEnabled && nextBillingCurl),
                proxyUrl: nextProxyURL,
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
                quotaCurl: nextQuotaCurl,
                quotaEnabled: Boolean(draft.quotaEnabled && nextQuotaCurl),
                billingCurl: nextBillingCurl,
                billingEnabled: Boolean(draft.billingEnabled && nextBillingCurl),
                proxyUrl: nextProxyURL,
              }
            : prev
        );
        await loadAccounts({ refreshSupplementalData: false });
      } catch (error) {
        console.error(error);
        setDeleteError(`SAVE ERROR: ${toErrorMessage(error)}`);
        throw error;
      }
    },
    [loadAccounts, selectedAccount, setDeleteError, setSelectedAccount, t, trackRequest]
  );

  const formatBulkActionMessage = useCallback(
    (label: string, summary: { succeeded: number; skipped: number; failed: number }) => {
      const parts = [`${t('accounts.bulk_action_success_count')} ${summary.succeeded}`];
      if (summary.skipped > 0) {
        parts.push(`${t('accounts.bulk_action_skipped_count')} ${summary.skipped}`);
      }
      if (summary.failed > 0) {
        parts.push(`${t('accounts.bulk_action_failed_count')} ${summary.failed}`);
      }
      return `${label}：${parts.join(' / ')}`;
    },
    [t],
  );

  const runSelectedBulkDelete = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      setAccountActionNotice({
        tone: 'warning',
        message: t('accounts.bulk_action_no_selection'),
      });
      return;
    }

    setDeleteError('');
    setAccountActionNotice(null);
    setBulkActionPending('delete');

    let succeeded = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (const account of selectedAccounts) {
        const deleteRequest = resolveAccountDeleteRequest(account);
        if (deleteRequest.type === 'missing-auth-file-name' || deleteRequest.type === 'missing-openai-compatible-name') {
          skipped += 1;
          continue;
        }

        try {
          await executeDeleteAccount(account, { reload: false });
          succeeded += 1;
        } catch (error) {
          console.error(error);
          failed += 1;
        }
      }

      if (hasWailsAppBindings()) {
        await loadAccounts({ showLoading: false, refreshSupplementalData: false });
      }

      setAccountActionNotice({
        tone: failed > 0 ? 'error' : skipped > 0 ? 'warning' : 'success',
        message: formatBulkActionMessage(t('accounts.bulk_delete_selected'), { succeeded, skipped, failed }),
      });
    } catch (error) {
      console.error(error);
      setAccountActionNotice({
        tone: 'error',
        message: `${t('accounts.bulk_delete_selected')}：${toErrorMessage(error)}`,
      });
    } finally {
      setBulkActionPending(null);
    }
  }, [
    executeDeleteAccount,
    formatBulkActionMessage,
    loadAccounts,
    selectedAccounts,
    setAccountActionNotice,
    setDeleteError,
    t,
  ]);

  const runSelectedBulkRefresh = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      setAccountActionNotice({
        tone: 'warning',
        message: t('accounts.bulk_action_no_selection'),
      });
      return;
    }

    const resolution = resolveBulkQuotaRefreshTargets(selectedAccounts);
    if (resolution.targets.length === 0) {
      setAccountActionNotice({
        tone: 'warning',
        message: `${t('accounts.bulk_refresh_selected')}：${t('accounts.bulk_action_no_targets')}`,
      });
      return;
    }

    setDeleteError('');
    setAccountActionNotice(null);
    setBulkActionPending('refresh');

    let succeeded = 0;
    let failed = 0;
    try {
      for (const account of resolution.targets) {
        try {
          await refreshAccountQuota(account);
          succeeded += 1;
        } catch (error) {
          console.error(error);
          failed += 1;
        }
      }

      if (hasWailsAppBindings()) {
        await loadAccounts({ showLoading: false, refreshSupplementalData: false });
      }

      setAccountActionNotice({
        tone: failed > 0 ? 'error' : resolution.skipped.length > 0 ? 'warning' : 'success',
        message: formatBulkActionMessage(t('accounts.bulk_refresh_selected'), {
          succeeded,
          skipped: resolution.skipped.length,
          failed,
        }),
      });
    } catch (error) {
      console.error(error);
      setAccountActionNotice({
        tone: 'error',
        message: `${t('accounts.bulk_refresh_selected')}：${toErrorMessage(error)}`,
      });
    } finally {
      setBulkActionPending(null);
    }
  }, [
    formatBulkActionMessage,
    loadAccounts,
    refreshAccountQuota,
    selectedAccounts,
    setAccountActionNotice,
    setDeleteError,
    t,
  ]);

  const runAccountsBulkSetDisabled = useCallback(
    async (targetAccounts: AccountRecord[], nextDisabled: boolean) => {
      if (targetAccounts.length === 0) {
        setAccountActionNotice({
          tone: 'warning',
          message: t('accounts.bulk_action_no_selection'),
        });
        return;
      }

      const resolution = resolveBulkSetDisabledTargets(targetAccounts, nextDisabled);
      const label = nextDisabled ? t('accounts.bulk_disable_selected') : t('accounts.bulk_enable_selected');
      if (resolution.targets.length === 0) {
        setAccountActionNotice({
          tone: 'warning',
          message: `${label}：${t('accounts.bulk_action_no_targets')}`,
        });
        return;
      }

      setDeleteError('');
      setAccountActionNotice(null);
      setBulkActionPending(nextDisabled ? 'disable' : 'enable');

      let succeeded = 0;
      let failed = 0;
      try {
        for (const account of resolution.targets) {
          try {
            await setAccountDisabled(account, nextDisabled, { reload: false });
            succeeded += 1;
          } catch (error) {
            console.error(error);
            failed += 1;
          }
        }

        if (hasWailsAppBindings()) {
          await loadAccounts({ showLoading: false, refreshSupplementalData: false });
        }

        setAccountActionNotice({
          tone: failed > 0 ? 'error' : resolution.skipped.length > 0 ? 'warning' : 'success',
          message: formatBulkActionMessage(label, {
            succeeded,
            skipped: resolution.skipped.length,
            failed,
          }),
        });
      } catch (error) {
        console.error(error);
        setAccountActionNotice({
          tone: 'error',
          message: `${label}：${toErrorMessage(error)}`,
        });
      } finally {
        setBulkActionPending(null);
      }
    },
    [
      formatBulkActionMessage,
      loadAccounts,
      setAccountActionNotice,
      setAccountDisabled,
      setDeleteError,
      t,
    ],
  );

  const runSelectedBulkSetDisabled = useCallback(
    async (nextDisabled: boolean) => {
      await runAccountsBulkSetDisabled(selectedAccounts, nextDisabled);
    },
    [runAccountsBulkSetDisabled, selectedAccounts],
  );

  return {
    toggleAccountDisabled,
    deleteAccount,
    bulkActionPending,
    runSelectedBulkDelete,
    runSelectedBulkRefresh,
    runAccountsBulkSetDisabled,
    runSelectedBulkSetDisabled,
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
