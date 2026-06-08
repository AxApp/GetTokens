import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  FinalizeCodexOAuth,
  GetOAuthStatus,
  ListAccounts,
  ListAuthFiles,
  StartCodexOAuth,
  TestCodexAPIKeyBillingCurl,
  TestCodexAPIKeyQuotaCurl,
  UpdateCodexAPIKeyLabel,
  VerifyOpenAICompatibleProvider,
} from '../../../../wailsjs/go/main/App';
import { main } from '../../../../wailsjs/go/models';
import { BrowserOpenURL } from '../../../../wailsjs/runtime/runtime';
import type { AccountRecord, CodexQuota } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import {
  buildAPIKeyLabelStorageKey,
  buildCodexAPIKeyVerifyInput,
  clearAPIKeyLabels,
  emptyApiKeyForm,
  loadAPIKeyLabels,
} from '../model/accountConfig';
import { normalizeCurlVariables } from '../model/accountDetailConfig';
import {
  defaultAccountsFilterState,
  persistAccountsFilterState,
  readStoredAccountsFilterState,
} from '../model/accountFilters';
import {
  ACCOUNT_GROUP_MODE_STORAGE_KEY,
  ACCOUNT_SORT_MODE_STORAGE_KEY,
  DEFAULT_ACCOUNT_GROUP_MODE,
  DEFAULT_ACCOUNT_SORT_MODE,
  parseAccountGroupMode,
  parseAccountSortMode,
  type AccountGroupMode,
  type AccountSortMode,
} from '../model/accountListLayout';
import {
  removeDeletedAPIKeyRecord,
  removeDeletedAuthFile,
  shouldClearDeletedSelectedAccount,
} from '../model/accountDelete';
import { patchAccountDetailByID } from '../model/accountDetailSelection';
import {
  filterSelectedAccountIDs,
  useAccountSelectionState,
} from '../model/accountSelection';
import { buildCodexOAuthBannerMessage } from '../model/accountOAuth';
import { buildAccountsView } from '../model/accountSelectors';
import {
  isCodexReauthEligible,
  mapAuthFileToRecord,
  mapBackendAccountRecord,
  resolveLoadedAccountIDs,
  resolveLoadedAuthFileRecords,
} from '../model/accountPresentation';
import {
  applyAccountDisabledChangeToRecord,
  normalizeAccountDisabledChange,
  readAccountDisabledOverrides,
  subscribeAccountDisabledChanges,
  type AccountDisabledChange,
} from '../model/accountDisabledSync';
import { getAccountsPreviewAPIKeyRecords, getAccountsPreviewAuthFiles } from '../previewData';
import useAccountsActions from './useAccountsActions';
import useAccountsQuotaState from './useAccountsQuotaState';
import useAccountsRateLimitState from './useAccountsRateLimitState';
import useAccountsUsageState from './useAccountsUsageState';
import type {
  AccountActionNotice,
  ApiKeyFormState,
  AccountsFilterState,
  AuthFile,
  TrackRequest,
  Translator,
} from '../model/types';
import { shouldEnsureAccountSnapshot } from '../model/accountSnapshot';
import {
  ACCOUNT_RUNTIME_QUOTA_REFRESH_CONCURRENCY,
  ACCOUNT_RUNTIME_SYNC_INTERVAL_MS,
  normalizeRuntimeSyncDocumentHidden,
  runAccountRuntimeRequestPool,
  shouldRunRuntimeSyncOnVisibilityRestore,
  shouldScheduleAccountRuntimeSync,
} from '../model/accountRuntimeSync';

type OAuthFlowState =
  | {
      state: string;
      existingName: string;
      previousNames: string[];
      pendingAccountID: string | null;
    }
  | null;

type OAuthBanner =
  | {
      tone: 'info' | 'success' | 'error';
      message: string;
    }
  | null;

type OAuthDialogState =
  | {
      url: string;
      existingName: string;
    }
  | null;

type APIKeyVerifyState = {
  model: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  lastVerifiedAt: number | null;
};

const DEFAULT_CODEX_API_KEY_VERIFY_MODEL = 'gpt-5.4-mini';

interface UseAccountsPageStateArgs {
  ready: boolean;
  t: Translator;
  trackRequest: TrackRequest;
  headerActionsMenuRef: MutableRefObject<HTMLDivElement | null>;
}

export type AccountsPageState = ReturnType<typeof useAccountsPageState>;

export default function useAccountsPageState({
  ready,
  t,
  trackRequest,
  headerActionsMenuRef,
}: UseAccountsPageStateArgs) {
  const [authFiles, setAuthFiles] = useState<AuthFile[]>([]);
  const [derivedAuthFileRecords, setDerivedAuthFileRecords] = useState<AccountRecord[]>([]);
  const [apiKeyRecords, setApiKeyRecords] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupMode, setGroupMode] = useState<AccountGroupMode>(() => readInitialAccountGroupMode());
  const [sortMode, setSortMode] = useState<AccountSortMode>(() => readInitialAccountSortMode());
  const [filters, setFilters] = useState<AccountsFilterState>(() =>
    typeof window === 'undefined' ? defaultAccountsFilterState : readStoredAccountsFilterState(window.localStorage)
  );
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [pendingDeleteID, setPendingDeleteID] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [apiKeyFormError, setApiKeyFormError] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState<ApiKeyFormState>(emptyApiKeyForm);
  const [isAccountImportModalOpen, setIsAccountImportModalOpen] = useState(false);
  const [accountActionNotice, setAccountActionNotice] = useState<AccountActionNotice | null>(null);
  const [isHeaderActionsMenuOpen, setIsHeaderActionsMenuOpen] = useState(false);
  const [oauthBanner, setOAuthBanner] = useState<OAuthBanner>(null);
  const [oauthFlow, setOAuthFlow] = useState<OAuthFlowState>(null);
  const [oauthDialog, setOAuthDialog] = useState<OAuthDialogState>(null);
  const [pendingStatusAccountID, setPendingStatusAccountID] = useState<string | null>(null);
  const [apiKeyVerifyStateByID, setAPIKeyVerifyStateByID] = useState<Record<string, APIKeyVerifyState>>({});
  const legacyAPIKeyLabelsRef = useRef<Record<string, string>>(loadAPIKeyLabels());
  const {
    isSelectionMode,
    selectedAccountIDs,
    setSelectedAccountIDs,
    toggleAccountSelection,
    toggleSelectAllFiltered: applyToggleSelectAllFiltered,
    toggleSelectionMode,
  } = useAccountSelectionState();
  const { codexQuotaByName, loadCodexQuotas, syncCodexQuotaStatuses, refreshCodexQuota } = useAccountsQuotaState(trackRequest);
  const { accountUsageByID, usageRefreshingAccountIDSet, loadAccountUsage, refreshAccountUsage } = useAccountsUsageState(trackRequest);
  const {
    accountRateLimitByID,
    rateLimitRefreshingAccountIDSet,
    rateLimitStrategies,
    loadAccountRateLimits,
    refreshAccountRateLimits,
  } = useAccountsRateLimitState(trackRequest);

  const authFileRecords = useMemo(
    () => (authFiles.length > 0 ? authFiles.map((account) => mapAuthFileToRecord(account)) : derivedAuthFileRecords),
    [authFiles, derivedAuthFileRecords]
  );
  const runtimeSyncAccounts = useMemo(
    () => [...authFileRecords, ...apiKeyRecords],
    [apiKeyRecords, authFileRecords],
  );

  const {
    accounts,
    filteredAccounts,
    groupedAccounts,
    availablePlanTypes,
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
        filters,
        groupMode,
        sortMode,
        selectedAccountIDs,
        t,
      }),
    [apiKeyRecords, authFileRecords, codexQuotaByName, filters, groupMode, searchTerm, selectedAccountIDs, sortMode, t]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    persistAccountsFilterState(window.localStorage, filters);
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(ACCOUNT_GROUP_MODE_STORAGE_KEY, groupMode);
    } catch {
      // The URL hash still carries the active view if storage is unavailable.
    }
  }, [groupMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(ACCOUNT_SORT_MODE_STORAGE_KEY, sortMode);
    } catch {
      // The URL hash still carries the active view if storage is unavailable.
    }
  }, [sortMode]);

  const migrateLegacyAPIKeyLabels = useCallback(
    async (accounts: main.AccountRecord[]) => {
      const legacyLabels = legacyAPIKeyLabelsRef.current;
      const legacyKeys = Object.keys(legacyLabels);
      if (legacyKeys.length === 0) {
        return accounts;
      }

      const updates = accounts
        .filter((account) => account.credentialSource === 'api-key')
        .map((account) => {
          const storageKey = buildAPIKeyLabelStorageKey(account.apiKey || '', account.baseUrl || '', account.prefix || '');
          const nextLabel = String(legacyLabels[storageKey] || '').trim();
          if (!nextLabel || nextLabel === String(account.displayName || '').trim()) {
            return null;
          }
          return {
            id: account.id,
            label: nextLabel,
          };
        })
        .filter((item): item is { id: string; label: string } => item !== null);

      if (updates.length === 0) {
        clearAPIKeyLabels();
        legacyAPIKeyLabelsRef.current = {};
        return accounts;
      }

      for (const update of updates) {
        await trackRequest('UpdateCodexAPIKeyLabel', update, () => UpdateCodexAPIKeyLabel(update));
      }

      clearAPIKeyLabels();
      legacyAPIKeyLabelsRef.current = {};
      return trackRequest('ListAccounts', { migratedLegacyLabels: true }, () => ListAccounts());
    },
    [trackRequest]
  );

  const loadAccounts = useCallback(async (options: { showLoading?: boolean; refreshSupplementalData?: boolean; showSupplementalRefreshing?: boolean } = {}) => {
    if (!ready) {
      return;
    }

    if (!hasWailsAppBindings()) {
      const disabledOverrides = readAccountDisabledOverrides();
      const files = applyDisabledOverridesToPreviewAuthFiles(getAccountsPreviewAuthFiles(), disabledOverrides);
      const apiKeyAccounts = applyDisabledOverridesToPreviewAccounts(getAccountsPreviewAPIKeyRecords(), disabledOverrides);
      const nextAuthFileRecords = resolveLoadedAuthFileRecords(files, []);
      setAuthFiles(files);
      setDerivedAuthFileRecords([]);
      setApiKeyRecords(apiKeyAccounts);
      setAccountsLoaded(true);
      setPendingDeleteID(null);
      setSelectedAccountIDs((prev) =>
        filterSelectedAccountIDs(prev, resolveLoadedAccountIDs(nextAuthFileRecords, apiKeyAccounts))
      );
      if (options.refreshSupplementalData ?? true) {
        void loadCodexQuotas([...nextAuthFileRecords, ...apiKeyAccounts]);
        void loadAccountUsage([...nextAuthFileRecords, ...apiKeyAccounts], {
          showRefreshing: options.showSupplementalRefreshing === true,
        });
        void loadAccountRateLimits([...nextAuthFileRecords, ...apiKeyAccounts]);
      }
      return;
    }

    const showLoading = options.showLoading ?? true;
    if (showLoading) {
      setLoading(true);
    }
    try {
      const authFileResponsePromise = trackRequest('ListAuthFiles', { args: [] }, () => ListAuthFiles()).catch(() => {
        // sidecar unavailable — auth files will be empty, keys still load
        return { files: [] };
      });
      const accountResponsePromise = trackRequest('ListAccounts', { args: [] }, () => ListAccounts());
      const [authFileResponse, rawAccountResponse] = await Promise.all([authFileResponsePromise, accountResponsePromise]);
      const accountResponse = await migrateLegacyAPIKeyLabels(rawAccountResponse || []);
      const files = authFileResponse?.files || [];
      const mappedAccounts = (accountResponse || []).map((account) => mapBackendAccountRecord(account));
      const apiKeyAccounts = mappedAccounts.filter((account) => account.credentialSource === 'api-key');
      const nextAuthFileRecords = resolveLoadedAuthFileRecords(files, mappedAccounts);
      setAuthFiles(files);
      setDerivedAuthFileRecords(files.length === 0 ? nextAuthFileRecords : []);
      setApiKeyRecords(apiKeyAccounts);
      setAccountsLoaded(true);
      setPendingDeleteID(null);
      setSelectedAccountIDs((prev) =>
        filterSelectedAccountIDs(prev, resolveLoadedAccountIDs(nextAuthFileRecords, apiKeyAccounts))
      );
      if (options.refreshSupplementalData ?? true) {
        void loadCodexQuotas([...nextAuthFileRecords, ...apiKeyAccounts]);
        void loadAccountUsage([...nextAuthFileRecords, ...apiKeyAccounts], {
          showRefreshing: options.showSupplementalRefreshing === true,
        });
        void loadAccountRateLimits([...nextAuthFileRecords, ...apiKeyAccounts]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [loadAccountRateLimits, loadAccountUsage, loadCodexQuotas, migrateLegacyAPIKeyLabels, ready, trackRequest]);

  const removeDeletedAccountLocally = useCallback(
    (account: AccountRecord) => {
      setAuthFiles((prev) => removeDeletedAuthFile(prev, account));
      setDerivedAuthFileRecords((prev) => prev.filter((item) => item.id !== account.id));
      setApiKeyRecords((prev) => removeDeletedAPIKeyRecord(prev, account));
      setSelectedAccount((prev) => (shouldClearDeletedSelectedAccount(prev, account) ? null : prev));
      setSelectedAccountIDs((prev) => prev.filter((id) => id !== account.id));
    },
    [setSelectedAccountIDs],
  );

  const patchAccountLocally = useCallback(
    (accountID: string, patch: Partial<AccountRecord>) => {
      setDerivedAuthFileRecords((prev) => patchAccountDetailByID(prev, accountID, patch));
      setApiKeyRecords((prev) => patchAccountDetailByID(prev, accountID, patch));
      setSelectedAccount((prev) =>
        prev?.id === accountID
          ? {
              ...prev,
              ...patch,
              id: prev.id,
            }
          : prev,
      );
    },
    [],
  );

  const patchAccountDisabledChangeLocally = useCallback(
    (change: AccountDisabledChange) => {
      const normalized = normalizeAccountDisabledChange(change);
      if (!normalized) {
        return;
      }
      setAuthFiles((prev) =>
        prev.map((item) => {
          const id = String(item.authIndex || '').trim();
          if (!id) {
            return item;
          }
          const patched = applyAccountDisabledChangeToRecord(
            {
              id,
              status: String(item.status || ''),
              disabled: item.disabled,
            },
            normalized,
          );
          return patched.id === id && patched.disabled !== item.disabled
            ? { ...item, disabled: patched.disabled, status: patched.status }
            : item;
        })
      );
      setDerivedAuthFileRecords((prev) =>
        prev.map((item) => applyAccountDisabledChangeToRecord(item, normalized))
      );
      setApiKeyRecords((prev) =>
        prev.map((item) => applyAccountDisabledChangeToRecord(item, normalized))
      );
      setSelectedAccount((prev) => (prev ? applyAccountDisabledChangeToRecord(prev, normalized) : prev));
    },
    [],
  );

  const patchAccountDisabledLocally = useCallback(
    (account: AccountRecord, disabled: boolean) => {
      patchAccountDisabledChangeLocally({ id: account.id, disabled });
    },
    [patchAccountDisabledChangeLocally],
  );

  useEffect(() => subscribeAccountDisabledChanges(patchAccountDisabledChangeLocally), [patchAccountDisabledChangeLocally]);

  useEffect(() => {
    if (shouldEnsureAccountSnapshot({ ready, loaded: accountsLoaded, loading })) {
      void loadAccounts();
    }
  }, [accountsLoaded, loading, ready, loadAccounts]);

  const syncAccountRuntime = useCallback(() => {
    const hasRuntimeBindings = hasWailsAppBindings();
    const documentHidden = normalizeRuntimeSyncDocumentHidden({
      documentHidden: typeof document !== 'undefined' ? document.hidden : false,
      hasRuntimeBindings,
    });
    if (
      !shouldScheduleAccountRuntimeSync({
        ready,
        hasRuntimeBindings,
        accountCount: runtimeSyncAccounts.length,
        documentHidden,
      })
    ) {
      return;
    }
    void syncCodexQuotaStatuses(runtimeSyncAccounts, { replace: false });
    void loadAccountUsage(runtimeSyncAccounts, {
      merge: true,
      resolveAccountKeys: false,
      fallbackUsageStatistics: false,
    });
    void loadAccountRateLimits(runtimeSyncAccounts);
  }, [
    loadAccountRateLimits,
    loadAccountUsage,
    ready,
    runtimeSyncAccounts,
    syncCodexQuotaStatuses,
  ]);

  const refreshAccountsRuntime = useCallback(async () => {
    if (!ready || runtimeSyncAccounts.length === 0) {
      return;
    }

    await Promise.all([
      runAccountRuntimeRequestPool(runtimeSyncAccounts, refreshCodexQuota, {
        concurrency: ACCOUNT_RUNTIME_QUOTA_REFRESH_CONCURRENCY,
      }),
      refreshAccountUsage(runtimeSyncAccounts),
      refreshAccountRateLimits(runtimeSyncAccounts),
    ]);
  }, [ready, refreshAccountRateLimits, refreshAccountUsage, refreshCodexQuota, runtimeSyncAccounts]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !ready ||
      !hasWailsAppBindings() ||
      runtimeSyncAccounts.length === 0
    ) {
      return;
    }

    const readDocumentHidden = () =>
      normalizeRuntimeSyncDocumentHidden({
        documentHidden: typeof document !== 'undefined' ? document.hidden : false,
        hasRuntimeBindings: hasWailsAppBindings(),
      });

    let wasHidden = readDocumentHidden();
    const runSync = () => syncAccountRuntime();
    const handleVisibilityChange = () => {
      const documentHidden = readDocumentHidden();
      const canSchedule = shouldScheduleAccountRuntimeSync({
        ready,
        hasRuntimeBindings: hasWailsAppBindings(),
        accountCount: runtimeSyncAccounts.length,
        documentHidden,
      });
      if (
        shouldRunRuntimeSyncOnVisibilityRestore({
          wasHidden,
          documentHidden,
          canSchedule,
        })
      ) {
        runSync();
      }
      wasHidden = documentHidden;
    };

    runSync();
    const timer = window.setInterval(runSync, ACCOUNT_RUNTIME_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ready, runtimeSyncAccounts.length, syncAccountRuntime]);

  useEffect(() => {
    if (!oauthFlow) {
      return;
    }
    const currentFlow = oauthFlow;

    let cancelled = false;

    async function pollOnce() {
      try {
        const result = await trackRequest('GetOAuthStatus', { state: currentFlow.state }, () => GetOAuthStatus(currentFlow.state));
        if (cancelled) {
          return;
        }

        if (result.status === 'wait') {
          return;
        }

        if (result.status === 'error') {
          setOAuthDialog(null);
          setOAuthBanner({
            tone: 'error',
            message: result.error || t('accounts.codex_login_failed'),
          });
          setOAuthFlow(null);
          return;
        }

        if (currentFlow.existingName) {
          await trackRequest(
            'FinalizeCodexOAuth',
            { existingName: currentFlow.existingName },
            () =>
              FinalizeCodexOAuth({
                existingName: currentFlow.existingName,
                previousNames: currentFlow.previousNames,
              })
          );
        }

        await loadAccounts({ refreshSupplementalData: false });
        setOAuthDialog(null);
        setOAuthBanner({
          tone: 'success',
          message: buildCodexOAuthBannerMessage(t, 'success', currentFlow.existingName),
        });
        setOAuthFlow(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setOAuthDialog(null);
        setOAuthBanner({
          tone: 'error',
          message: toErrorMessage(error),
        });
        setOAuthFlow(null);
      }
    }

    void pollOnce();
    const timer = window.setInterval(() => {
      void pollOnce();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadAccounts, oauthFlow, t, trackRequest]);

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

  function toggleSelectAllFiltered() {
    applyToggleSelectAllFiltered(filteredAccounts, allFilteredSelected);
  }

  const startCodexOAuth = useCallback(
    async (account?: AccountRecord) => {
      if (!ready || oauthFlow) {
        return;
      }

      setOAuthBanner(null);
      try {
        const result = await trackRequest('StartCodexOAuth', {}, () => StartCodexOAuth());
        const existingName = account && isCodexReauthEligible(account) ? String(account.name || '').trim() : '';
        setOAuthFlow({
          state: String(result.state || '').trim(),
          existingName,
          previousNames: authFiles.map((file) => file.name),
          pendingAccountID: account?.id || null,
        });
        setOAuthDialog({
          url: String(result.url || '').trim(),
          existingName,
        });
        setOAuthBanner({
          tone: 'info',
          message: buildCodexOAuthBannerMessage(t, 'pending', existingName),
        });
      } catch (error) {
        setOAuthBanner({
          tone: 'error',
          message: toErrorMessage(error),
        });
      }
    },
    [authFiles, oauthFlow, ready, t, trackRequest]
  );

  const openOAuthDialogInBrowser = useCallback(() => {
    if (!oauthDialog?.url) {
      return;
    }
    BrowserOpenURL(oauthDialog.url);
  }, [oauthDialog]);

  const cancelCodexOAuth = useCallback(() => {
    setOAuthDialog(null);
    setOAuthFlow(null);
    setOAuthBanner(null);
  }, []);

  const verifySelectedApiKey = useCallback(
    async (input: { apiKey: string; baseUrl: string; model: string }) => {
      if (!selectedAccount?.id || selectedAccount.credentialSource !== 'api-key') {
        return;
      }

      const nextInput = buildCodexAPIKeyVerifyInput(input);
      if (!nextInput.model) {
        setAPIKeyVerifyStateByID((prev) => ({
          ...prev,
          [selectedAccount.id]: {
            model: '',
            status: 'error',
            message: t('accounts.api_key_verify_model_required'),
            lastVerifiedAt: prev[selectedAccount.id]?.lastVerifiedAt ?? null,
          },
        }));
        return;
      }

      setAPIKeyVerifyStateByID((prev) => ({
        ...prev,
        [selectedAccount.id]: {
          model: nextInput.model,
          status: 'loading',
          message: '',
          lastVerifiedAt: prev[selectedAccount.id]?.lastVerifiedAt ?? null,
        },
      }));

      try {
        const result = await trackRequest(
          'VerifyOpenAICompatibleProvider',
          { id: selectedAccount.id, baseUrl: nextInput.baseUrl, model: nextInput.model },
          () =>
            VerifyOpenAICompatibleProvider(
              main.VerifyOpenAICompatibleProviderInput.createFrom({
                apiKey: nextInput.apiKey,
                baseUrl: nextInput.baseUrl,
                model: nextInput.model,
              }),
            ),
        );

        setAPIKeyVerifyStateByID((prev) => ({
          ...prev,
          [selectedAccount.id]: {
            model: nextInput.model,
            status: result.success ? 'success' : 'error',
            message: result.message || (result.success ? t('accounts.api_key_verify_success') : t('accounts.api_key_verify_failed')),
            lastVerifiedAt: Date.now(),
          },
        }));
      } catch (error) {
        setAPIKeyVerifyStateByID((prev) => ({
          ...prev,
          [selectedAccount.id]: {
            model: nextInput.model,
            status: 'error',
            message: toErrorMessage(error),
            lastVerifiedAt: Date.now(),
          },
        }));
      }
    },
    [selectedAccount, t, trackRequest],
  );

  const testSelectedApiKeyQuotaCurl = useCallback(
    async (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }): Promise<CodexQuota> => {
      const nextInput = {
        apiKey: input.apiKey.trim(),
        baseUrl: input.baseUrl.trim(),
        prefix: input.prefix.trim(),
        quotaCurl: input.quotaCurl.trim(),
        platformCookie: input.platformCookie?.trim() ?? '',
        curlVariables: normalizeCurlVariables(input.curlVariables, input.platformCookie),
      };
      return trackRequest(
        'TestCodexAPIKeyQuotaCurl',
        { id: selectedAccount?.id, baseUrl: nextInput.baseUrl },
        () => TestCodexAPIKeyQuotaCurl(main.TestCodexAPIKeyQuotaCurlInput.createFrom(nextInput)),
      );
    },
    [selectedAccount?.id, trackRequest],
  );

  const testSelectedApiKeyBillingCurl = useCallback(
    async (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => {
      const nextInput = {
        apiKey: input.apiKey.trim(),
        baseUrl: input.baseUrl.trim(),
        prefix: input.prefix.trim(),
        quotaCurl: input.billingCurl.trim(),
        platformCookie: input.platformCookie?.trim() ?? '',
        curlVariables: normalizeCurlVariables(input.curlVariables, input.platformCookie),
      };
      return trackRequest(
        'TestCodexAPIKeyBillingCurl',
        { id: selectedAccount?.id, baseUrl: nextInput.baseUrl },
        () => TestCodexAPIKeyBillingCurl(main.TestCodexAPIKeyQuotaCurlInput.createFrom(nextInput)),
      );
    },
    [selectedAccount?.id, trackRequest],
  );

  const {
    toggleAccountDisabled,
    deleteAccount,
    bulkActionPending,
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
  } = useAccountsActions({
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
    refreshAccountQuota: refreshCodexQuota,
    loadAccounts,
  });

  const toggleAccountDisabledFromCard = useCallback(
    async (account: AccountRecord) => {
      setPendingStatusAccountID(account.id);
      try {
        await toggleAccountDisabled(account);
      } finally {
        setPendingStatusAccountID(null);
      }
    },
    [toggleAccountDisabled],
  );

  function closeHeaderActionsMenu() {
    setIsHeaderActionsMenuOpen(false);
  }

  return {
    loading,
    accountsLoaded,
    searchTerm,
    groupMode,
    sortMode,
    filters,
    selectedAccount,
    pendingDeleteID,
    pendingStatusAccountID,
    deleteError,
    accountActionNotice,
    apiKeyFormError,
    oauthBanner,
    oauthDialog,
    oauthPendingAccountID: oauthFlow?.pendingAccountID || null,
    isOAuthPending: oauthFlow !== null,
    apiKeyVerifyState:
      selectedAccount?.id && apiKeyVerifyStateByID[selectedAccount.id]
        ? apiKeyVerifyStateByID[selectedAccount.id]
        : {
            model: DEFAULT_CODEX_API_KEY_VERIFY_MODEL,
            status: 'idle' as const,
            message: '',
            lastVerifiedAt: null,
          },
    isApiKeyModalOpen,
    apiKeyForm,
    isAccountImportModalOpen,
    codexQuotaByName,
    accountUsageByID,
    usageRefreshingAccountIDSet,
    accountRateLimitByID,
    rateLimitRefreshingAccountIDSet,
    rateLimitStrategies,
    isSelectionMode,
    selectedAccountIDs,
    isHeaderActionsMenuOpen,
    accounts,
    filteredAccounts,
    groupedAccounts,
    availablePlanTypes,
    selectedAccountIDSet,
    allFilteredSelected,
    loadAccounts,
    loadAccountUsage,
    syncCodexQuotaStatuses,
    refreshAccountUsage,
    refreshAccountsRuntime,
    loadAccountRateLimits,
    refreshAccountRateLimits,
    startCodexOAuth,
    cancelCodexOAuth,
    verifySelectedApiKey,
    testSelectedApiKeyQuotaCurl,
    testSelectedApiKeyBillingCurl,
    openOAuthDialogInBrowser,
    refreshCodexQuota,
    setSearchTerm,
    setGroupMode,
    setSortMode,
    setFilters,
    setSelectedAccount,
    setPendingDeleteID,
    setDeleteError,
    setApiKeyFormError,
    setOAuthBanner,
    setOAuthDialog,
    setIsApiKeyModalOpen,
    setApiKeyForm,
    setIsAccountImportModalOpen,
    setAccountActionNotice,
    setSelectedAccountIDs,
    setIsHeaderActionsMenuOpen,
    patchAccountLocally,
    openApiKeyModal,
    submitApiKeyForm,
    submitAccountImport,
    toggleAccountSelection,
    toggleSelectAllFiltered,
    toggleSelectionMode,
    toggleAccountDisabled: toggleAccountDisabledFromCard,
    exportSelectedAccounts,
    deleteAccount,
    bulkActionPending,
    runSelectedBulkDelete,
    runSelectedBulkRefresh,
    runAccountsBulkSetDisabled,
    runSelectedBulkSetDisabled,
    renameSelectedApiKey,
    updateSelectedApiKeyPriority,
    updateSelectedApiKeyConfig,
    closeHeaderActionsMenu,
  };
}

function readInitialAccountGroupMode(): AccountGroupMode {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCOUNT_GROUP_MODE;
  }
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const hashGroup = params.get('group');
  if (hashGroup) {
    return parseAccountGroupMode(hashGroup);
  }
  try {
    return parseAccountGroupMode(window.localStorage.getItem(ACCOUNT_GROUP_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCOUNT_GROUP_MODE;
  }
}

function readInitialAccountSortMode(): AccountSortMode {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCOUNT_SORT_MODE;
  }
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const hashSort = params.get('sort');
  if (hashSort) {
    return parseAccountSortMode(hashSort);
  }
  try {
    return parseAccountSortMode(window.localStorage.getItem(ACCOUNT_SORT_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCOUNT_SORT_MODE;
  }
}

function applyDisabledOverridesToPreviewAuthFiles(files: AuthFile[], overrides: Record<string, boolean>) {
  return files.map((file) => {
    const id = String(file.authIndex || '').trim();
    if (!id) {
      return file;
    }
    if (!Object.prototype.hasOwnProperty.call(overrides, id)) {
      return file;
    }
    const patched = applyAccountDisabledChangeToRecord(
      {
        id,
        status: String(file.status || ''),
        disabled: file.disabled,
      },
      { id, disabled: overrides[id] },
    );
    return {
      ...file,
      disabled: patched.disabled,
      status: patched.status,
    };
  });
}

function applyDisabledOverridesToPreviewAccounts(accounts: AccountRecord[], overrides: Record<string, boolean>) {
  return accounts.map((account) =>
    Object.prototype.hasOwnProperty.call(overrides, account.id)
      ? applyAccountDisabledChangeToRecord(account, { id: account.id, disabled: overrides[account.id] })
      : account,
  );
}
