import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import {
  FinalizeCodexOAuth,
  GetOAuthStatus,
  ListAccounts,
  ListAuthFiles,
  StartCodexOAuth,
} from '../../../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../../../wailsjs/runtime/runtime';
import type { AccountRecord } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import {
  emptyApiKeyForm,
  loadAPIKeyLabels,
} from '../model/accountConfig';
import {
  defaultAccountsFilterState,
  persistAccountsFilterState,
  readStoredAccountsFilterState,
} from '../model/accountFilters';
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
} from '../model/accountPresentation';
import useAccountsActions from './useAccountsActions';
import useAccountsQuotaState from './useAccountsQuotaState';
import useAccountsUsageState from './useAccountsUsageState';
import type {
  ApiKeyFormState,
  AccountsFilterState,
  AuthFile,
  TrackRequest,
  Translator,
} from '../model/types';

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
  const [filters, setFilters] = useState<AccountsFilterState>(() =>
    typeof window === 'undefined' ? defaultAccountsFilterState : readStoredAccountsFilterState(window.localStorage)
  );
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [pendingDeleteID, setPendingDeleteID] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [apiKeyFormError, setApiKeyFormError] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isRotationModalOpen, setIsRotationModalOpen] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState<ApiKeyFormState>(emptyApiKeyForm);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [apiKeyLabels, setAPIKeyLabels] = useState<Record<string, string>>(() => loadAPIKeyLabels());
  const [isHeaderActionsMenuOpen, setIsHeaderActionsMenuOpen] = useState(false);
  const [oauthBanner, setOAuthBanner] = useState<OAuthBanner>(null);
  const [oauthFlow, setOAuthFlow] = useState<OAuthFlowState>(null);
  const [oauthDialog, setOAuthDialog] = useState<OAuthDialogState>(null);
  const {
    isSelectionMode,
    selectedAccountIDs,
    setSelectedAccountIDs,
    toggleAccountSelection,
    toggleSelectAllFiltered: applyToggleSelectAllFiltered,
    toggleSelectionMode,
  } = useAccountSelectionState();
  const { codexQuotaByName, loadCodexQuotas, refreshCodexQuota } = useAccountsQuotaState(trackRequest);
  const { accountUsageByID, loadAccountUsage } = useAccountsUsageState(trackRequest);

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
        filters,
        selectedAccountIDs,
        t,
      }),
    [apiKeyRecords, authFileRecords, codexQuotaByName, filters, searchTerm, selectedAccountIDs, t]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    persistAccountsFilterState(window.localStorage, filters);
  }, [filters]);

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
      const nextAuthFileRecords = files.map((account) => mapAuthFileToRecord(account));
      setAuthFiles(files);
      setApiKeyRecords(apiKeyAccounts);
      setPendingDeleteID(null);
      setSelectedAccountIDs((prev) =>
        filterSelectedAccountIDs(prev, [
          ...files.map((file) => `auth-file:${file.name}`),
          ...apiKeyAccounts.map((account) => account.id),
        ])
      );
      void loadCodexQuotas(files);
      void loadAccountUsage([...nextAuthFileRecords, ...apiKeyAccounts]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiKeyLabels, loadAccountUsage, loadCodexQuotas, ready, trackRequest]);

  useEffect(() => {
    if (ready) {
      void loadAccounts();
    }
  }, [ready, loadAccounts]);

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

        await loadAccounts();
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

  const {
    deleteAccount,
    uploadAccounts,
    openApiKeyModal,
    submitApiKeyForm,
    submitPasteImport,
    exportSelectedAccounts,
    renameSelectedApiKey,
    updateSelectedApiKeyPriority,
  } = useAccountsActions({
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
    setSelectedAccountIDs,
    setAPIKeyLabels,
    loadAccounts,
  });

  function closeHeaderActionsMenu() {
    setIsHeaderActionsMenuOpen(false);
  }

  return {
    loading,
    searchTerm,
    filters,
    selectedAccount,
    pendingDeleteID,
    deleteError,
    apiKeyFormError,
    oauthBanner,
    oauthDialog,
    oauthPendingAccountID: oauthFlow?.pendingAccountID || null,
    isOAuthPending: oauthFlow !== null,
    isApiKeyModalOpen,
    isRotationModalOpen,
    apiKeyForm,
    isPasteModalOpen,
    pasteContent,
    pasteError,
    codexQuotaByName,
    accountUsageByID,
    isSelectionMode,
    selectedAccountIDs,
    isHeaderActionsMenuOpen,
    accounts,
    filteredAccounts,
    groupedAccounts,
    selectedAccountIDSet,
    allFilteredSelected,
    loadAccounts,
    startCodexOAuth,
    cancelCodexOAuth,
    openOAuthDialogInBrowser,
    refreshCodexQuota,
    setSearchTerm,
    setFilters,
    setSelectedAccount,
    setPendingDeleteID,
    setDeleteError,
    setApiKeyFormError,
    setOAuthBanner,
    setOAuthDialog,
    setIsApiKeyModalOpen,
    setIsRotationModalOpen,
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
    updateSelectedApiKeyPriority,
    closeHeaderActionsMenu,
  };
}
