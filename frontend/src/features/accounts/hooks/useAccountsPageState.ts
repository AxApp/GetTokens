import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import {
  ListAccounts,
  ListAuthFiles,
} from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import {
  emptyApiKeyForm,
  loadAPIKeyLabels,
} from '../model/accountConfig';
import {
  filterSelectedAccountIDs,
  useAccountSelectionState,
} from '../model/accountSelection';
import { buildAccountsView } from '../model/accountSelectors';
import {
  mapAuthFileToRecord,
  mapBackendAccountRecord,
} from '../model/accountPresentation';
import useAccountsActions from './useAccountsActions';
import useAccountsQuotaState from './useAccountsQuotaState';
import type {
  ApiKeyFormState,
  AuthFile,
  SourceFilter,
  TrackRequest,
  Translator,
} from '../model/types';

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
  const [apiKeyLabels, setAPIKeyLabels] = useState<Record<string, string>>(() => loadAPIKeyLabels());
  const [isHeaderActionsMenuOpen, setIsHeaderActionsMenuOpen] = useState(false);
  const {
    isSelectionMode,
    selectedAccountIDs,
    setSelectedAccountIDs,
    toggleAccountSelection,
    toggleSelectAllFiltered: applyToggleSelectAllFiltered,
    toggleSelectionMode,
  } = useAccountSelectionState();
  const { codexQuotaByName, loadCodexQuotas, refreshCodexQuota } = useAccountsQuotaState(trackRequest);

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
      setSelectedAccountIDs((prev) =>
        filterSelectedAccountIDs(prev, [
          ...files.map((file) => `auth-file:${file.name}`),
          ...apiKeyAccounts.map((account) => account.id),
        ])
      );
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

  function toggleSelectAllFiltered() {
    applyToggleSelectAllFiltered(filteredAccounts, allFilteredSelected);
  }
  const {
    deleteAccount,
    uploadAccounts,
    openApiKeyModal,
    submitApiKeyForm,
    submitPasteImport,
    exportSelectedAccounts,
    renameSelectedApiKey,
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
    setSourceFilter,
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
