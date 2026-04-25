import { useRef } from 'react';
import AccountDetailModal from '../components/biz/AccountDetailModal';
import { useDebug } from '../context/DebugContext';
import { useI18n } from '../context/I18nContext';
import type { SidecarStatus } from '../types';
import AccountCardSkeleton from './accounts/AccountCardSkeleton';
import AccountGroupSection from './accounts/AccountGroupSection';
import AccountsHeader from './accounts/AccountsHeader';
import AccountsToolbar from './accounts/AccountsToolbar';
import ApiKeyComposeModal from './accounts/ApiKeyComposeModal';
import ApiKeyDetailModal from './accounts/ApiKeyDetailModal';
import PasteAuthModal from './accounts/PasteAuthModal';
import useAccountsPageState from './accounts/useAccountsPageState';
import useGroupCardHeights from './accounts/useGroupCardHeights';

interface AccountsPageProps {
  sidecarStatus: SidecarStatus;
}

export default function AccountsPage({ sidecarStatus }: AccountsPageProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const headerActionsMenuRef = useRef<HTMLDivElement | null>(null);

  const ready = sidecarStatus?.code === 'ready';
  const {
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
  } = useAccountsPageState({
    ready,
    t,
    trackRequest,
    headerActionsMenuRef,
  });

  const groupCardHeights = useGroupCardHeights(pageRef, groupedAccounts, loading, selectedAccountIDs);

  return (
    <>
      <div
        ref={pageRef}
        className="h-full w-full overflow-auto bg-[var(--bg-surface)] p-12"
        data-collaboration-id="PAGE_ACCOUNTS"
      >
        <div className="mx-auto max-w-6xl space-y-8 pb-32">
          <AccountsHeader
            t={t}
            accountCount={accounts.length}
            ready={ready}
            loading={loading}
            isHeaderActionsMenuOpen={isHeaderActionsMenuOpen}
            fileInputRef={fileInputRef}
            headerActionsMenuRef={headerActionsMenuRef}
            onUploadAccounts={uploadAccounts}
            onToggleMenu={() => setIsHeaderActionsMenuOpen((prev) => !prev)}
            onOpenPasteModal={() => {
              setPasteError('');
              setPasteContent('');
              setIsPasteModalOpen(true);
              setIsHeaderActionsMenuOpen(false);
            }}
            onOpenApiKeyModal={() => {
              openApiKeyModal();
              setIsHeaderActionsMenuOpen(false);
            }}
            onRefresh={loadAccounts}
          />

          <AccountsToolbar
            t={t}
            searchTerm={searchTerm}
            sourceFilter={sourceFilter}
            isSelectionMode={isSelectionMode}
            allFilteredSelected={allFilteredSelected}
            selectedAccountCount={selectedAccountIDs.length}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setPendingDeleteID(null);
            }}
            onSourceFilterChange={setSourceFilter}
            onToggleSelectionMode={toggleSelectionMode}
            onToggleSelectAllFiltered={toggleSelectAllFiltered}
            onClearSelection={() => setSelectedAccountIDs([])}
            onExportSelected={() => void exportSelectedAccounts()}
          />

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
                <AccountGroupSection
                  key={group.id}
                  t={t}
                  group={group}
                  groupCardHeight={groupCardHeights[group.id]}
                  codexQuotaByName={codexQuotaByName}
                  ready={ready}
                  isSelectionMode={isSelectionMode}
                  selectedAccountIDSet={selectedAccountIDSet}
                  pendingDeleteID={pendingDeleteID}
                  onToggleSelection={toggleAccountSelection}
                  onOpenDetails={setSelectedAccount}
                  onRefreshQuota={(account) => void refreshCodexQuota(account)}
                  onRequestDelete={(accountID) => {
                    setDeleteError('');
                    setPendingDeleteID(accountID);
                  }}
                  onCancelDelete={() => setPendingDeleteID(null)}
                  onConfirmDelete={(account) => void deleteAccount(account)}
                />
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
          onRename={renameSelectedApiKey}
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
        <PasteAuthModal
          t={t}
          pasteContent={pasteContent}
          pasteError={pasteError}
          onClose={() => setIsPasteModalOpen(false)}
          onChange={(value) => {
            setPasteContent(value);
            setPasteError('');
          }}
          onSubmit={submitPasteImport}
        />
      ) : null}
    </>
  );
}
