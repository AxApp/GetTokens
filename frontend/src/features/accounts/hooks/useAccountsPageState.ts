import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  FinalizeCodexOAuth,
  GetOAuthStatus,
  ListAccounts,
  ListCachedAccounts,
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
  persistStoredAccountRecords,
  readStoredAccountRecords,
} from '../model/accountListCache';
import { buildQuotaDisplay } from '../model/accountQuota';
import {
  removeDeletedAPIKeyRecord,
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
  mapBackendAccountRecord,
  resolveLoadedAccountIDs,
} from '../model/accountPresentation';
import {
  applyAccountDisabledChangeToRecord,
  normalizeAccountDisabledChange,
  readAccountDisabledOverrides,
  subscribeAccountDisabledChanges,
  type AccountDisabledChange,
} from '../model/accountDisabledSync';
import { getAccountsPreviewAPIKeyRecords, getAccountsPreviewAuthFileRecords } from '../previewData';
import useAccountsActions from './useAccountsActions';
import useAccountsQuotaState from './useAccountsQuotaState';
import useAccountsRateLimitState from './useAccountsRateLimitState';
import useAccountsUsageState from './useAccountsUsageState';
import type {
  AccountActionNotice,
  ApiKeyFormState,
  AccountsFilterState,
  TrackRequest,
  Translator,
} from '../model/types';
import { shouldEnsureAccountSnapshot } from '../model/accountSnapshot';
import {
  normalizeRuntimeSyncDocumentHidden,
  resolveAutomaticAccountRuntimeSyncTargets,
  resolveAccountRuntimeSyncIntervalMs,
  shouldRunImmediateAccountRuntimeSync,
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
  const [initialCachedAccounts] = useState(() => readInitialAccountRecordsCache());
  const [authFileRecords, setAuthFileRecords] = useState<AccountRecord[]>(() =>
    initialCachedAccounts.filter((account) => account.credentialSource === 'auth-file')
  );
  const [apiKeyRecords, setApiKeyRecords] = useState<AccountRecord[]>(() =>
    initialCachedAccounts.filter((account) => account.credentialSource === 'api-key')
  );
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
  const [runtimeRefreshing, setRuntimeRefreshing] = useState(false);
  const [apiKeyVerifyStateByID, setAPIKeyVerifyStateByID] = useState<Record<string, APIKeyVerifyState>>({});
  const legacyAPIKeyLabelsRef = useRef<Record<string, string>>(loadAPIKeyLabels());
  const accountRecordsRef = useRef<AccountRecord[]>(initialCachedAccounts);
  const liveAccountsLoadedRef = useRef(false);
  const sqliteSnapshotRequestedRef = useRef(false);
  const runtimeRefreshingRef = useRef(false);
  const automaticRuntimeSyncTargetIDsByGroupRef = useRef<Record<string, string[]>>({});
  const [automaticRuntimeSyncTargetAccountIDs, setAutomaticRuntimeSyncTargetAccountIDs] = useState<string[]>([]);
  const {
    isSelectionMode,
    selectedAccountIDs,
    setSelectedAccountIDs,
    toggleAccountSelection,
    toggleSelectAllFiltered: applyToggleSelectAllFiltered,
    toggleSelectionMode,
  } = useAccountSelectionState();
  const {
    codexQuotaByName,
    loadCodexQuotas,
    syncCodexQuotaStatuses,
    refreshCodexQuota,
    refreshCodexQuotasBatch,
  } = useAccountsQuotaState(trackRequest);
  const { accountUsageByID, usageRefreshingAccountIDSet, loadAccountUsage, refreshAccountUsage } = useAccountsUsageState(trackRequest);
  const {
    accountRateLimitByID,
    rateLimitRefreshingAccountIDSet,
    rateLimitStrategies,
    loadAccountRateLimits,
    refreshAccountRateLimits,
  } = useAccountsRateLimitState(trackRequest);

  const runtimeSyncAccounts = useMemo(
    () => [...authFileRecords, ...apiKeyRecords],
    [apiKeyRecords, authFileRecords],
  );
  const automaticRuntimeSyncAccounts = useMemo(
    () => resolveAutomaticAccountRuntimeSyncTargets(runtimeSyncAccounts, automaticRuntimeSyncTargetAccountIDs),
    [automaticRuntimeSyncTargetAccountIDs, runtimeSyncAccounts],
  );

  useEffect(() => {
    accountRecordsRef.current = runtimeSyncAccounts;
  }, [runtimeSyncAccounts]);

  const updateAutomaticRuntimeSyncTargets = useCallback((groupID: string, accountIDs: string[]) => {
    const normalizedGroupID = groupID.trim();
    if (!normalizedGroupID) {
      return;
    }

    const normalizedAccountIDs = Array.from(new Set(accountIDs.map((id) => id.trim()).filter(Boolean)));
    const current = automaticRuntimeSyncTargetIDsByGroupRef.current[normalizedGroupID] || [];
    if (areStringArraysEqual(current, normalizedAccountIDs)) {
      return;
    }

    automaticRuntimeSyncTargetIDsByGroupRef.current = {
      ...automaticRuntimeSyncTargetIDsByGroupRef.current,
      [normalizedGroupID]: normalizedAccountIDs,
    };

    const nextAccountIDs = Array.from(
      new Set(Object.values(automaticRuntimeSyncTargetIDsByGroupRef.current).flat()),
    );
    setAutomaticRuntimeSyncTargetAccountIDs((prev) => (areStringArraysEqual(prev, nextAccountIDs) ? prev : nextAccountIDs));
  }, []);

  const {
    accounts,
    filteredAccounts,
    groupedAccounts,
    availablePlanTypes,
    availableRequestStatusCodes,
    selectedAccountIDSet,
    selectedAccounts,
    allFilteredSelected,
  } = useMemo(
    () =>
      buildAccountsView({
        authFileRecords,
        apiKeyRecords,
        codexQuotaByName,
        accountUsageByID,
        searchTerm,
        filters,
        groupMode,
        sortMode,
        selectedAccountIDs,
        t,
      }),
    [accountUsageByID, apiKeyRecords, authFileRecords, codexQuotaByName, filters, groupMode, searchTerm, selectedAccountIDs, sortMode, t]
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
      const previewAccounts = applyDisabledOverridesToPreviewAccounts(
        [...getAccountsPreviewAuthFileRecords(), ...getAccountsPreviewAPIKeyRecords()],
        disabledOverrides,
      );
      const nextAuthFileRecords = previewAccounts.filter((account) => account.credentialSource === 'auth-file');
      const apiKeyAccounts = previewAccounts.filter((account) => account.credentialSource === 'api-key');
      accountRecordsRef.current = [...nextAuthFileRecords, ...apiKeyAccounts];
      setAuthFileRecords(nextAuthFileRecords);
      setApiKeyRecords(apiKeyAccounts);
      persistAccountRecordsCache([...nextAuthFileRecords, ...apiKeyAccounts]);
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
      const rawAccountResponse = await trackRequest('ListAccounts', { args: [] }, () => ListAccounts());
      const accountResponse = await migrateLegacyAPIKeyLabels(rawAccountResponse || []);
      const mappedAccounts = (accountResponse || []).map((account) => mapBackendAccountRecord(account));
      const apiKeyAccounts = mappedAccounts.filter((account) => account.credentialSource === 'api-key');
      const nextAuthFileRecords = mappedAccounts.filter((account) => account.credentialSource === 'auth-file');
      liveAccountsLoadedRef.current = true;
      accountRecordsRef.current = mappedAccounts;
      setAuthFileRecords(nextAuthFileRecords);
      setApiKeyRecords(apiKeyAccounts);
      persistAccountRecordsCache(mappedAccounts);
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
      if (accountRecordsRef.current.length > 0) {
        setAccountsLoaded(true);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [loadAccountRateLimits, loadAccountUsage, loadCodexQuotas, migrateLegacyAPIKeyLabels, ready, trackRequest]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasWailsAppBindings() || sqliteSnapshotRequestedRef.current) {
      return;
    }
    sqliteSnapshotRequestedRef.current = true;
    let cancelled = false;

    async function loadSQLiteSnapshot() {
      try {
        const snapshot = await trackRequest('ListCachedAccounts', { args: [] }, () => ListCachedAccounts());
        if (cancelled || liveAccountsLoadedRef.current) {
          return;
        }
        const mappedAccounts = (snapshot || []).map((account) => mapBackendAccountRecord(account));
        if (mappedAccounts.length === 0) {
          return;
        }
        const nextAuthFileRecords = mappedAccounts.filter((account) => account.credentialSource === 'auth-file');
        const apiKeyAccounts = mappedAccounts.filter((account) => account.credentialSource === 'api-key');
        accountRecordsRef.current = mappedAccounts;
        setAuthFileRecords(nextAuthFileRecords);
        setApiKeyRecords(apiKeyAccounts);
        persistAccountRecordsCache(mappedAccounts);
        setPendingDeleteID(null);
        setSelectedAccountIDs((prev) =>
          filterSelectedAccountIDs(prev, resolveLoadedAccountIDs(nextAuthFileRecords, apiKeyAccounts))
        );
      } catch (error) {
        console.error(error);
      }
    }

    void loadSQLiteSnapshot();
    return () => {
      cancelled = true;
    };
  }, [setSelectedAccountIDs, trackRequest]);

  const removeDeletedAccountLocally = useCallback(
    (account: AccountRecord) => {
      setAuthFileRecords((prev) => prev.filter((item) => item.id !== account.id));
      setApiKeyRecords((prev) => removeDeletedAPIKeyRecord(prev, account));
      setSelectedAccount((prev) => (shouldClearDeletedSelectedAccount(prev, account) ? null : prev));
      setSelectedAccountIDs((prev) => prev.filter((id) => id !== account.id));
    },
    [setSelectedAccountIDs],
  );

  const patchAccountLocally = useCallback(
    (accountID: string, patch: Partial<AccountRecord>) => {
      setAuthFileRecords((prev) => patchAccountDetailByID(prev, accountID, patch));
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
      setAuthFileRecords((prev) =>
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
        accountCount: automaticRuntimeSyncAccounts.length,
        documentHidden,
      })
    ) {
      return;
    }
    void syncCodexQuotaStatuses(automaticRuntimeSyncAccounts, { replace: false });
    void loadAccountUsage(automaticRuntimeSyncAccounts, {
      merge: true,
      resolveAccountKeys: false,
    });
    void loadAccountRateLimits(automaticRuntimeSyncAccounts);
  }, [
    automaticRuntimeSyncAccounts,
    loadAccountRateLimits,
    loadAccountUsage,
    ready,
    syncCodexQuotaStatuses,
  ]);

  const refreshAccountsRuntime = useCallback(async () => {
    if (!ready || runtimeSyncAccounts.length === 0 || runtimeRefreshingRef.current) {
      return;
    }

    runtimeRefreshingRef.current = true;
    setRuntimeRefreshing(true);
    try {
      await Promise.allSettled([
        syncCodexQuotaStatuses(runtimeSyncAccounts, { replace: false }),
        refreshAccountUsage(runtimeSyncAccounts),
        refreshAccountRateLimits(runtimeSyncAccounts),
      ]);
    } finally {
      runtimeRefreshingRef.current = false;
      setRuntimeRefreshing(false);
    }
  }, [ready, refreshAccountRateLimits, refreshAccountUsage, runtimeSyncAccounts, syncCodexQuotaStatuses]);

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
        accountCount: automaticRuntimeSyncAccounts.length,
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

    if (shouldRunImmediateAccountRuntimeSync(runtimeSyncAccounts.length)) {
      runSync();
    }
    const timer = window.setInterval(runSync, resolveAccountRuntimeSyncIntervalMs(runtimeSyncAccounts.length));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [automaticRuntimeSyncAccounts.length, ready, runtimeSyncAccounts.length, syncAccountRuntime]);

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
        const quotaState = account?.quotaKey ? codexQuotaByName[account.quotaKey] : undefined;
        const quotaDisplay = account ? buildQuotaDisplay(account, quotaState) : undefined;
        const existingName = account && isCodexReauthEligible(account, quotaDisplay) ? String(account.name || '').trim() : '';
        setOAuthFlow({
          state: String(result.state || '').trim(),
          existingName,
          previousNames: authFileRecords.map((file) => String(file.name || '').trim()).filter(Boolean),
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
    [authFileRecords, codexQuotaByName, oauthFlow, ready, t, trackRequest]
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
    refreshAccountQuotasBatch: refreshCodexQuotasBatch,
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
    runtimeRefreshing,
    isSelectionMode,
    selectedAccountIDs,
    isHeaderActionsMenuOpen,
    accounts,
    filteredAccounts,
    groupedAccounts,
    availablePlanTypes,
    availableRequestStatusCodes,
    selectedAccountIDSet,
    allFilteredSelected,
    loadAccounts,
    loadAccountUsage,
    syncCodexQuotaStatuses,
    refreshAccountUsage,
    refreshAccountsRuntime,
    loadAccountRateLimits,
    refreshAccountRateLimits,
    updateAutomaticRuntimeSyncTargets,
    startCodexOAuth,
    cancelCodexOAuth,
    verifySelectedApiKey,
    testSelectedApiKeyQuotaCurl,
    testSelectedApiKeyBillingCurl,
    openOAuthDialogInBrowser,
    refreshCodexQuota,
    refreshAccountQuotasBatch: refreshCodexQuotasBatch,
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
    runAccountsBulkDelete,
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

function readInitialAccountRecordsCache(): AccountRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return readStoredAccountRecords(window.localStorage);
}

function persistAccountRecordsCache(accounts: AccountRecord[]) {
  if (typeof window === 'undefined') {
    return;
  }
  persistStoredAccountRecords(window.localStorage, accounts);
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function applyDisabledOverridesToPreviewAccounts(accounts: AccountRecord[], overrides: Record<string, boolean>) {
  return accounts.map((account) =>
    Object.prototype.hasOwnProperty.call(overrides, account.id)
      ? applyAccountDisabledChangeToRecord(account, { id: account.id, disabled: overrides[account.id] })
      : account,
  );
}
