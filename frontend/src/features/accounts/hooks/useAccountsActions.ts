import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import {
  CreateCodexAPIKey,
  CreateOpenAICompatibleProvider,
  DeleteAccountsBatch,
  DeleteAuthFiles,
  DeleteCodexAPIKey,
  DeleteOpenAICompatibleProvider,
  DownloadAuthFile,
  PreviewAuthFileUploads,
  SetAccountDisabled,
  SetAccountsDisabledBatch,
  UpdateCodexAPIKeyConfig,
  UpdateCodexAPIKeyLabel,
  UpdateCodexAPIKeyPriority,
  UpdateOpenAICompatibleProvider,
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
import { fallbackAPIKeyDisplayName, mapBackendAccountRecord } from '../model/accountPresentation';
import {
  type AccountImportPayloadItem,
  buildAccountsExportFilename,
  encodeUTF8Base64,
  resolveCopiedAuthFileName,
  resolveCopiedOpenAICompatibleProviderName,
  resolveNumberedDuplicateTitle,
} from '../model/accountTransfer';
import {
  normalizeApiKeyConfigModels,
  normalizeCurlVariables,
  normalizeFormatBaseUrls as normalizeDetailFormatBaseUrls,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import { resolveAccountDeleteRequest } from '../model/accountDelete';
import { publishAccountDisabledChange } from '../model/accountDisabledSync';
import { buildAccountDisabledActionNotice } from '../model/accountActionErrors';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import {
  resolveBulkDeleteTargets,
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
  selectedAccount: AccountRecord | null;
  selectedAccounts: AccountRecord[];
  setPendingDeleteID: Dispatch<SetStateAction<string | null>>;
  setDeleteError: Dispatch<SetStateAction<string>>;
  setApiKeyFormError: Dispatch<SetStateAction<string>>;
  setIsApiKeyModalOpen: Dispatch<SetStateAction<boolean>>;
  setApiKeyForm: Dispatch<SetStateAction<ApiKeyFormState>>;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  setSelectedAccountIDs: Dispatch<SetStateAction<string[]>>;
  setAccountActionNotice: Dispatch<SetStateAction<AccountActionNotice | null>>;
  removeDeletedAccountLocally: (account: AccountRecord) => void;
  patchAccountLocally: (accountID: string, patch: Partial<AccountRecord>) => void;
  patchAccountDisabledLocally: (account: AccountRecord, disabled: boolean) => void;
  recoverAccountRevisionConflict: (error: unknown, accountID: string) => Promise<Error | null>;
  refreshAccountQuotasBatch: (accounts: AccountRecord[]) => Promise<{ succeeded: number; failed: number }>;
  loadAccounts: (options?: { showLoading?: boolean; refreshSupplementalData?: boolean }) => Promise<void>;
}

export default function useAccountsActions({
  ready,
  t,
  trackRequest,
  apiKeyForm,
  accounts,
  selectedAccount,
  selectedAccounts,
  setPendingDeleteID,
  setDeleteError,
  setApiKeyFormError,
  setIsApiKeyModalOpen,
  setApiKeyForm,
  setSearchTerm,
  setSelectedAccountIDs,
  setAccountActionNotice,
  removeDeletedAccountLocally,
  patchAccountLocally,
  patchAccountDisabledLocally,
  recoverAccountRevisionConflict,
  refreshAccountQuotasBatch,
  loadAccounts,
}: UseAccountsActionsArgs) {
  const [bulkActionPending, setBulkActionPending] = useState<AccountBulkActionID | null>(null);

  const setAccountDisabled = useCallback(
    async (account: AccountRecord, nextDisabled: boolean) => {
      if (!ready || !hasWailsAppBindings()) {
        patchAccountDisabledLocally(account, nextDisabled);
        publishAccountDisabledChange({ id: account.id, disabled: nextDisabled }, 'accounts');
        return;
      }

      const updatedAccount = await trackRequest('SetAccountDisabled', { id: account.id, disabled: nextDisabled }, () =>
        SetAccountDisabled(account.id, nextDisabled)
      );
      patchAccountLocally(account.id, mapBackendAccountRecord(updatedAccount));
      publishAccountDisabledChange({ id: account.id, disabled: nextDisabled }, 'accounts');
    },
    [patchAccountDisabledLocally, patchAccountLocally, ready, trackRequest],
  );

  const toggleAccountDisabled = useCallback(
    async (account: AccountRecord) => {
      try {
        await setAccountDisabled(account, !account.disabled);
      } catch (error) {
        console.error(error);
        setAccountActionNotice(buildAccountDisabledActionNotice(!account.disabled, error));
      }
    },
    [setAccountDisabled, setAccountActionNotice],
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
            platformCookie: (apiKeyForm.platformCookie ?? "").trim(),
            curlVariables: normalizeCurlVariables(apiKeyForm.curlVariables, apiKeyForm.platformCookie),
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

  const submitAccountImport = useCallback(
    async (items: readonly AccountImportPayloadItem[]) => {
      if (items.length === 0) {
        throw new Error(t('accounts.import_account_queue_required'));
      }

      setDeleteError('');
      let mutated = false;

      const existingAuthFileNames = accounts.flatMap((account) => {
        if (account.credentialSource !== 'auth-file') {
          return [];
        }
        return account.name || '';
      });
      const authFilePayload = items.flatMap((item) => {
        if (item.type === 'upload-file') {
          return [{ name: item.name, contentBase64: item.contentBase64 }];
        }
        if (item.type !== 'auth-file') {
          return [];
        }
        const name = resolveCopiedAuthFileName(item.name, existingAuthFileNames);
        existingAuthFileNames.push(name);
        return [{ name, contentBase64: encodeUTF8Base64(item.content) }];
      });

      try {
        if (authFilePayload.length > 0) {
          const previewResult = await trackRequest(
            'PreviewAuthFileUploads',
            { files: authFilePayload.map((item) => ({ name: item.name })) },
            () => PreviewAuthFileUploads(authFilePayload),
          );
          const skipUploadAfterPreview =
            previewResult?.supported &&
            previewResult.failed === 0 &&
            previewResult.wouldCreate === 0 &&
            previewResult.skipped === authFilePayload.length;
          if (previewResult?.supported && previewResult.skipped > 0) {
            const message =
              previewResult.wouldCreate > 0
                ? t('accounts.import_account_upload_preview_summary')
                    .replace('{wouldCreate}', String(previewResult.wouldCreate))
                    .replace('{skipped}', String(previewResult.skipped))
                : t('accounts.import_account_upload_preview_all_skipped').replace('{skipped}', String(previewResult.skipped));
            setAccountActionNotice({
              tone: previewResult.wouldCreate > 0 ? 'success' : 'warning',
              message,
            });
          }
          if (!skipUploadAfterPreview) {
            const uploadResult = await trackRequest(
              'UploadAuthFiles',
              { files: authFilePayload.map((item) => ({ name: item.name })) },
              () => UploadAuthFiles(authFilePayload),
            );
            if (uploadResult?.skipped && uploadResult.skipped > 0) {
              const message =
                uploadResult.succeeded > 0
                  ? t('accounts.import_account_upload_skipped_summary')
                      .replace('{succeeded}', String(uploadResult.succeeded))
                      .replace('{skipped}', String(uploadResult.skipped))
                  : t('accounts.import_account_upload_all_skipped').replace('{skipped}', String(uploadResult.skipped));
              setAccountActionNotice({
                tone: uploadResult.succeeded > 0 ? 'success' : 'warning',
                message,
              });
            }
            mutated = true;
          }
        }

        const existingApiKeyTitles = accounts.flatMap((account) => {
          if (!isCodexAPIKeyAccount(account)) {
            return [];
          }
          return account.displayName || account.name || '';
        });
        let nextPriority = accounts.reduce((min, account) => Math.min(min, Number(account.priority || 0)), 0) - 1;

        for (const item of items) {
          if (item.type !== 'codex-api-key') {
            continue;
          }
          const label = resolveNumberedDuplicateTitle(item.label || 'Codex API Key', existingApiKeyTitles);
          existingApiKeyTitles.push(label);
          await trackRequest(
            'CreateCodexAPIKey',
            { baseUrl: item.baseUrl, source: 'account-import' },
            () =>
              CreateCodexAPIKey(main.CreateCodexAPIKeyInput.createFrom({
                apiKey: item.apiKey,
                label,
                baseUrl: item.baseUrl,
                priority: nextPriority,
                prefix: item.prefix,
                formatBaseUrls: item.formatBaseUrls,
              })),
          );
          mutated = true;
          nextPriority -= 1;
        }

        const existingProviderNames = accounts.flatMap((account) => {
          if (!isOpenAICompatibleAccount(account)) {
            return [];
          }
          return account.provider;
        });

        for (const item of items) {
          if (item.type !== 'openai-compatible') {
            continue;
          }
          const name = resolveCopiedOpenAICompatibleProviderName(item.name, existingProviderNames);
          existingProviderNames.push(name);
          await trackRequest(
            'CreateOpenAICompatibleProvider',
            { name, source: 'account-import' },
            () =>
              CreateOpenAICompatibleProvider(main.CreateOpenAICompatibleProviderInput.createFrom({
                name,
                apiKey: item.apiKey,
                baseUrl: item.baseUrl,
                prefix: item.prefix,
                formatBaseUrls: item.formatBaseUrls,
              })),
          );
          mutated = true;
          await trackRequest(
            'UpdateOpenAICompatibleProvider',
            { name, source: 'account-import' },
            () =>
              UpdateOpenAICompatibleProvider(main.UpdateOpenAICompatibleProviderInput.createFrom({
                currentName: name,
                name,
                apiKey: item.apiKey,
                apiKeys: item.apiKeys,
                baseUrl: item.baseUrl,
                formatBaseUrls: item.formatBaseUrls,
                prefix: item.prefix,
                proxyUrl: item.proxyUrl || undefined,
                headers: item.headers,
                models: item.models,
              })),
          );
          mutated = true;
        }
      } finally {
        if (mutated) {
          setSearchTerm('');
          await loadAccounts({ refreshSupplementalData: false });
        }
      }
    },
    [accounts, loadAccounts, setAccountActionNotice, setDeleteError, setSearchTerm, t, trackRequest],
  );

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
      if (!selectedAccount?.id || !isCodexAPIKeyAccount(selectedAccount)) {
        return;
      }
      const trimmedName = nextName.trim();
      void (async () => {
        try {
          const updatedAccount = await trackRequest(
            'UpdateCodexAPIKeyLabel',
            { id: selectedAccount.id, label: trimmedName },
            () =>
              UpdateCodexAPIKeyLabel({
                id: selectedAccount.id,
                label: trimmedName,
                expectedRevision: selectedAccount.revision,
              })
          );
          patchAccountLocally(selectedAccount.id, mapBackendAccountRecord(updatedAccount));
        } catch (error) {
          console.error(error);
          const conflictError = await recoverAccountRevisionConflict(error, selectedAccount.id);
          if (conflictError) {
            setDeleteError(`SAVE ERROR: ${conflictError.message}`);
          }
        }
      })();
    },
    [patchAccountLocally, recoverAccountRevisionConflict, selectedAccount, setDeleteError, trackRequest]
  );

  const updateSelectedApiKeyPriority = useCallback(
    async (priorityDraft: string) => {
      if (!selectedAccount?.id || !isCodexAPIKeyAccount(selectedAccount)) {
        return;
      }

      try {
        const parsedPriority = Number.parseInt(priorityDraft.trim() || '0', 10);
        const nextPriority = Number.isFinite(parsedPriority) ? parsedPriority : 0;

        const updatedAccount = await trackRequest(
          'UpdateCodexAPIKeyPriority',
          { id: selectedAccount.id, priority: nextPriority },
          () =>
            UpdateCodexAPIKeyPriority({
              id: selectedAccount.id,
              priority: nextPriority,
              expectedRevision: selectedAccount.revision,
            })
        );

        patchAccountLocally(selectedAccount.id, mapBackendAccountRecord(updatedAccount));
      } catch (error) {
        console.error(error);
        const conflictError = await recoverAccountRevisionConflict(error, selectedAccount.id);
        const resolvedError = conflictError ?? error;
        setDeleteError(`SAVE ERROR: ${toErrorMessage(resolvedError)}`);
        if (conflictError) {
          throw conflictError;
        }
      }
    },
    [patchAccountLocally, recoverAccountRevisionConflict, selectedAccount, setDeleteError, trackRequest]
  );

  const updateSelectedApiKeyConfig = useCallback(
    async (draft: ApiKeyConfigDraft) => {
      if (!selectedAccount?.id || !isCodexAPIKeyAccount(selectedAccount)) {
        return;
      }

      const nextAPIKey = draft.apiKey.trim();
      const nextBaseURL = draft.baseUrl.trim();
      const nextFormatBaseURLs = normalizeDetailFormatBaseUrls(draft.formatBaseUrls);
      const nextPrefix = draft.prefix.trim();
      const nextQuotaCurl = draft.quotaCurl.trim();
      const nextBillingCurl = draft.billingCurl.trim();
      const nextPlatformCookie = (draft.platformCookie ?? "").trim();
      const nextCurlVariables = normalizeCurlVariables(draft.curlVariables, nextPlatformCookie);
      const nextProxyURL = draft.proxyUrl.trim();
      const nextModels = normalizeApiKeyConfigModels(draft.models);
      const nextLabel = draft.label.trim();
      if (!nextAPIKey) {
        setDeleteError(`SAVE ERROR: ${t('accounts.api_key_required')}`);
        return;
      }

      if (!hasWailsAppBindings()) {
        patchAccountLocally(selectedAccount.id, {
          displayName: nextLabel || fallbackAPIKeyDisplayName(nextAPIKey),
          apiKey: nextAPIKey,
          baseUrl: nextBaseURL,
          formatBaseUrls: nextFormatBaseURLs,
          prefix: nextPrefix,
          quotaCurl: nextQuotaCurl,
          quotaEnabled: Boolean(draft.quotaEnabled && nextQuotaCurl),
          billingCurl: nextBillingCurl,
          billingEnabled: Boolean(draft.billingEnabled && nextBillingCurl),
          platformCookie: nextPlatformCookie,
          curlVariables: nextCurlVariables,
          proxyUrl: nextProxyURL,
          models: nextModels,
        });
        return;
      }

      try {
        const updatedAccount = await trackRequest(
          'UpdateCodexAPIKeyConfig',
          { id: selectedAccount.id, baseUrl: nextBaseURL },
          () =>
            UpdateCodexAPIKeyConfig(
              main.UpdateCodexAPIKeyConfigInput.createFrom({
                id: selectedAccount.id,
                expectedRevision: selectedAccount.revision,
                label: nextLabel,
                apiKey: nextAPIKey,
                baseUrl: nextBaseURL,
                formatBaseUrls: nextFormatBaseURLs,
                prefix: nextPrefix,
                quotaCurl: nextQuotaCurl,
                quotaEnabled: Boolean(draft.quotaEnabled && nextQuotaCurl),
                billingCurl: nextBillingCurl,
                billingEnabled: Boolean(draft.billingEnabled && nextBillingCurl),
                platformCookie: nextPlatformCookie,
                curlVariables: nextCurlVariables,
                proxyUrl: nextProxyURL,
                models: normalizeApiKeyConfigModels(draft.models),
              })
            )
          );

        patchAccountLocally(selectedAccount.id, mapBackendAccountRecord(updatedAccount));
      } catch (error) {
        console.error(error);
        const conflictError = await recoverAccountRevisionConflict(error, selectedAccount.id);
        const resolvedError = conflictError ?? error;
        setDeleteError(`SAVE ERROR: ${toErrorMessage(resolvedError)}`);
        throw resolvedError;
      }
    },
    [patchAccountLocally, recoverAccountRevisionConflict, selectedAccount, setDeleteError, t, trackRequest]
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

  const runAccountsBulkDelete = useCallback(async (targetAccounts: AccountRecord[], label = t('accounts.bulk_delete_selected')) => {
    if (targetAccounts.length === 0) {
      setAccountActionNotice({
        tone: 'warning',
        message: t('accounts.bulk_action_no_selection'),
      });
      return;
    }

    setDeleteError('');
    setAccountActionNotice(null);
    setBulkActionPending('delete');

    const resolution = resolveBulkDeleteTargets(targetAccounts);
    if (resolution.targets.length === 0) {
      setAccountActionNotice({
        tone: 'warning',
        message: `${label}：${t('accounts.bulk_action_no_targets')}`,
      });
      setBulkActionPending(null);
      return;
    }

    try {
      let succeeded = 0;
      let failed = 0;
      const accountIDs = resolution.targets.map((account) => account.id);

      if (hasWailsAppBindings()) {
        const result = await trackRequest('DeleteAccountsBatch', { accountIDs }, () =>
          DeleteAccountsBatch(main.DeleteAccountsBatchInput.createFrom({ accountIDs }))
        );
        succeeded = Number(result?.succeeded || 0);
        failed = Number(result?.failed || 0);

        const deletedAccountIDs = new Set(result?.deletedAccountIDs || []);
        resolution.targets.forEach((account) => {
          if (deletedAccountIDs.has(account.id)) {
            removeDeletedAccountLocally(account);
          }
        });
      } else {
        resolution.targets.forEach((account) => removeDeletedAccountLocally(account));
        succeeded = resolution.targets.length;
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
  }, [
    formatBulkActionMessage,
    loadAccounts,
    removeDeletedAccountLocally,
    setAccountActionNotice,
    setDeleteError,
    t,
    trackRequest,
  ]);

  const runSelectedBulkDelete = useCallback(async () => {
    await runAccountsBulkDelete(selectedAccounts, t('accounts.bulk_delete_selected'));
  }, [runAccountsBulkDelete, selectedAccounts, t]);

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

    try {
      const result = await refreshAccountQuotasBatch(resolution.targets);
      const succeeded = result.succeeded;
      const failed = result.failed;

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
    refreshAccountQuotasBatch,
    selectedAccounts,
    setAccountActionNotice,
    setDeleteError,
    t,
  ]);

  const runAccountsBulkSetDisabled = useCallback(
    async (targetAccounts: AccountRecord[], nextDisabled: boolean, labelOverride?: string) => {
      if (targetAccounts.length === 0) {
        setAccountActionNotice({
          tone: 'warning',
          message: t('accounts.bulk_action_no_selection'),
        });
        return;
      }

      const resolution = resolveBulkSetDisabledTargets(targetAccounts, nextDisabled);
      const label = labelOverride || (nextDisabled ? t('accounts.bulk_disable_selected') : t('accounts.bulk_enable_selected'));
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
        if (hasWailsAppBindings()) {
          const accountIDs = resolution.targets.map((account) => account.id);
          const result = await trackRequest('SetAccountsDisabledBatch', { accountIDs, disabled: nextDisabled }, () =>
            SetAccountsDisabledBatch(main.SetAccountsDisabledBatchInput.createFrom({ accountIDs, disabled: nextDisabled }))
          );
          succeeded = Number(result?.succeeded || 0);
          failed = Number(result?.failed || 0);

          const updatedAccountIDs = new Set(result?.updatedAccountIDs || []);
          resolution.targets.forEach((account) => {
            if (updatedAccountIDs.has(account.id)) {
              patchAccountDisabledLocally(account, nextDisabled);
              publishAccountDisabledChange({ id: account.id, disabled: nextDisabled }, 'accounts');
            }
          });
        } else {
          resolution.targets.forEach((account) => {
            patchAccountDisabledLocally(account, nextDisabled);
            publishAccountDisabledChange({ id: account.id, disabled: nextDisabled }, 'accounts');
          });
          succeeded = resolution.targets.length;
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
      patchAccountDisabledLocally,
      setAccountActionNotice,
      setDeleteError,
      t,
      trackRequest,
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
    runAccountsBulkDelete,
    runSelectedBulkDelete,
    runSelectedBulkRefresh,
    runAccountsBulkSetDisabled,
    runSelectedBulkSetDisabled,
    openApiKeyModal,
    submitApiKeyForm,
    submitAccountImport,
    exportSelectedAccounts,
    renameSelectedApiKey,
    updateSelectedApiKeyPriority,
    updateSelectedApiKeyConfig,
  };
}

function isOpenAICompatibleAccount(account: Pick<AccountRecord, 'accountKind' | 'id'>): boolean {
  return account.accountKind === 'openai-compatible';
}

function isCodexAPIKeyAccount(account: Pick<AccountRecord, 'accountKind' | 'credentialSource' | 'id'>): boolean {
  return account.accountKind === 'codex-api-key';
}
