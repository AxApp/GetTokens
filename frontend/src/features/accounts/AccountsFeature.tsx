import { useRef } from 'react';
import AccountDetailModal from '../../components/biz/AccountDetailModal';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import type { AccountWorkspace, SidecarStatus } from '../../types';
import AccountCardSkeleton from './components/AccountCardSkeleton';
import AccountRotationModal from './components/AccountRotationModal';
import AccountGroupSection from './components/AccountGroupSection';
import AccountsHeader from './components/AccountsHeader';
import AccountsToolbar from './components/AccountsToolbar';
import ApiKeyComposeModal from './components/ApiKeyComposeModal';
import ApiKeyDetailModal from './components/ApiKeyDetailModal';
import CodexOAuthModal from './components/CodexOAuthModal';
import OpenAICompatibleComposeModal from './components/OpenAICompatibleComposeModal';
import OpenAICompatibleDetailModal from './components/OpenAICompatibleDetailModal';
import OpenAICompatibleWorkspace from './components/OpenAICompatibleWorkspace';
import PasteAuthModal from './components/PasteAuthModal';
import useAccountsPageState from './hooks/useAccountsPageState';
import useOpenAICompatibleState from './hooks/useOpenAICompatibleState';
import { isCodexAuthFile } from './model/accountPresentation';
import useGroupCardHeights from './hooks/useGroupCardHeights';

interface AccountsFeatureProps {
  sidecarStatus: SidecarStatus;
  workspace: AccountWorkspace;
}

export default function AccountsFeature({ sidecarStatus, workspace }: AccountsFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const headerActionsMenuRef = useRef<HTMLDivElement | null>(null);

  const ready = sidecarStatus?.code === 'ready';
  const openAICompatibleState = useOpenAICompatibleState({
    ready,
    t,
    trackRequest,
  });
  const {
    loading,
    searchTerm,
    filters,
    selectedAccount,
    pendingDeleteID,
    deleteError,
    oauthBanner,
    oauthDialog,
    oauthPendingAccountID,
    isOAuthPending,
    apiKeyVerifyState,
    apiKeyFormError,
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
    verifySelectedApiKey,
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
  } = useAccountsPageState({
    ready,
    t,
    trackRequest,
    headerActionsMenuRef,
  });

  const groupCardHeights = useGroupCardHeights(pageRef, groupedAccounts, loading, selectedAccountIDs);

  if (workspace === 'openai-compatible') {
    return (
      <>
        <OpenAICompatibleWorkspace
          t={t}
          ready={ready}
          loading={openAICompatibleState.loading}
          providers={openAICompatibleState.providers}
          verifyStates={openAICompatibleState.verifyStates}
          pendingDeleteName={openAICompatibleState.pendingDeleteName}
          onCreate={openAICompatibleState.openCreateModal}
          onRefresh={() => void openAICompatibleState.loadProviders()}
          onOpenDetail={openAICompatibleState.openDetailModal}
          onDelete={(name) => void openAICompatibleState.deleteProvider(name)}
        />

        {openAICompatibleState.isCreateModalOpen ? (
          <OpenAICompatibleComposeModal
            t={t}
            form={openAICompatibleState.form}
            error={openAICompatibleState.formError}
            onClose={() => openAICompatibleState.setIsCreateModalOpen(false)}
            onChange={openAICompatibleState.setForm}
            onSubmit={() => void openAICompatibleState.submitCreate()}
          />
        ) : null}

        {openAICompatibleState.detailDraft ? (
          <OpenAICompatibleDetailModal
            t={t}
            draft={openAICompatibleState.detailDraft}
            verifyState={
              openAICompatibleState.verifyStates[openAICompatibleState.detailDraft.currentName] ?? {
                model: openAICompatibleState.detailDraft.verifyModel,
                status: 'idle',
                message: '',
                lastVerifiedAt: null,
              }
            }
            error={openAICompatibleState.detailError}
            saving={openAICompatibleState.detailSaving}
            onClose={openAICompatibleState.closeDetailModal}
            onChange={openAICompatibleState.setDetailDraft}
            onSave={() => void openAICompatibleState.saveDetail()}
            onVerify={() => void openAICompatibleState.verifyDetail()}
          />
        ) : null}
      </>
    );
  }

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
            onOpenRotationModal={() => {
              setIsRotationModalOpen(true);
              setIsHeaderActionsMenuOpen(false);
            }}
            onStartCodexOAuth={() => {
              void startCodexOAuth();
              setIsHeaderActionsMenuOpen(false);
            }}
            onRefresh={loadAccounts}
          />

          <AccountsToolbar
            t={t}
            searchTerm={searchTerm}
            filters={filters}
            isSelectionMode={isSelectionMode}
            allFilteredSelected={allFilteredSelected}
            selectedAccountCount={selectedAccountIDs.length}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setPendingDeleteID(null);
            }}
            onFiltersChange={setFilters}
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
          {oauthBanner ? (
            <div
              className={`flex items-start justify-between gap-3 border-2 px-4 py-3 text-[10px] font-black uppercase tracking-wide ${
                oauthBanner.tone === 'error'
                  ? 'border-red-500 bg-red-500/10 text-red-500'
                  : oauthBanner.tone === 'success'
                    ? 'border-green-600 bg-green-600/10 text-green-700'
                    : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
              }`}
            >
              <span>{oauthBanner.message}</span>
              {!isOAuthPending ? (
                <button onClick={() => setOAuthBanner(null)} className="btn-swiss !px-2 !py-1 !text-[8px]">
                  {t('common.close')}
                </button>
              ) : null}
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
                  accountUsageByID={accountUsageByID}
                  ready={ready}
                  isSelectionMode={isSelectionMode}
                  selectedAccountIDSet={selectedAccountIDSet}
                  pendingDeleteID={pendingDeleteID}
                  oauthPendingAccountID={oauthPendingAccountID}
                  onToggleSelection={toggleAccountSelection}
                  onOpenDetails={setSelectedAccount}
                  onRefreshQuota={(account) => void refreshCodexQuota(account)}
                  onStartReauth={(account) => void startCodexOAuth(account)}
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
        <AccountDetailModal
          account={selectedAccount.rawAuthFile}
          usageSummary={accountUsageByID[selectedAccount.id]}
          canStartReauth={isCodexAuthFile(selectedAccount)}
          isReauthing={oauthPendingAccountID === selectedAccount.id}
          onClose={() => setSelectedAccount(null)}
          onStartReauth={() => {
            const targetAccount = selectedAccount;
            void startCodexOAuth(targetAccount);
          }}
          onCancelReauth={cancelCodexOAuth}
        />
      ) : null}

      {selectedAccount?.credentialSource === 'api-key' ? (
        <ApiKeyDetailModal
          account={selectedAccount}
          usageSummary={accountUsageByID[selectedAccount.id]}
          verifyState={apiKeyVerifyState}
          onClose={() => setSelectedAccount(null)}
          onRename={renameSelectedApiKey}
          onSavePriority={(priority) => void updateSelectedApiKeyPriority(priority)}
          onVerify={(input) => void verifySelectedApiKey(input)}
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

      {isRotationModalOpen ? (
        <AccountRotationModal
          accounts={accounts}
          ready={ready}
          onClose={() => setIsRotationModalOpen(false)}
          onReloadAccounts={loadAccounts}
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

      {oauthDialog ? (
        <CodexOAuthModal
          t={t}
          existingName={oauthDialog.existingName}
          url={oauthDialog.url}
          onClose={cancelCodexOAuth}
          onOpenInBrowser={openOAuthDialogInBrowser}
        />
      ) : null}
    </>
  );
}
