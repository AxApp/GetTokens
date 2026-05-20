import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApplyClaudeCodeAPIKeyConfigToLocal,
  ApplyRelayServiceConfigToLocalV2,
  CreateCodexAPIKey,
  CreateRateLimitRule,
  DeleteRateLimitRule,
  DownloadAuthFile,
  FetchOpenAICompatibleProviderModels,
  GetLocalCodexAuthState,
  GetLocalCodexModelProviderStateView,
  GetRelayServiceConfig,
  ListRateLimitRules,
  ListRelaySupportedModels,
  UpdateRateLimitRule,
  VerifyOpenAICompatibleProvider,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import AccountCardSkeleton from './components/AccountCardSkeleton';
import AccountLocalCliApplyConfirm from './components/AccountLocalCliApplyConfirm';
import AccountRotationModal from './components/AccountRotationModal';
import AccountGroupSection from './components/AccountGroupSection';
import AccountsHeader from './components/AccountsHeader';
import AccountsToolbar from './components/AccountsToolbar';
import ApiKeyComposeModal from './components/ApiKeyComposeModal';
import CodexOAuthModal from './components/CodexOAuthModal';
import OpenAICompatibleComposeModal from './components/OpenAICompatibleComposeModal';
import OpenAICompatibleDetailModal from './components/OpenAICompatibleDetailModal';
import PasteAuthModal from './components/PasteAuthModal';
import UnifiedComposeModal, { type UnifiedComposeFormState } from './components/UnifiedComposeModal';
import UnifiedAccountDetailModal from './components/UnifiedAccountDetailModal';
import { useAccountsPageStateContext } from './AccountsPageStateProvider';
import useOpenAICompatibleState from './hooks/useOpenAICompatibleState';
import { isCodexAuthFile } from './model/accountPresentation';
import { buildRelayModelProviderSignature } from './model/apiKeyModelCatalog';
import useGroupCardHeights from './hooks/useGroupCardHeights';
import { buildAccountDetailFrameHash, clearAccountDetailFrameHash } from '../../utils/pagePersistence';
import { hasWailsAppBindings } from '../../utils/previewMode';
import type { AccountRecord } from './model/types';
import {
  resolveAccountLocalCliMappings,
  type AccountCliApplyDraft,
  type AccountLocalCliMapping,
} from './model/accountLocalCliMapping';
import {
  ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY,
  DEFAULT_ACCOUNT_LIST_DISPLAY_MODE,
  buildAccountListDisplayModeHash,
  parseAccountListDisplayMode,
  type AccountListDisplayMode,
} from './model/accountListLayout';
import {
  ACCOUNT_USAGE_REFRESH_INTERVAL_MS,
  shouldScheduleAccountUsageRefresh,
} from './model/accountUsage';
import type { OpenAICompatibleProvider } from './model/openAICompatible';
import type { VendorPreset } from './model/vendorPresets';
import { emptyApiKeyForm } from './model/accountConfig';
import { toErrorMessage } from '../../utils/error';

interface AccountsFeatureProps {
  workspace?: string;
}

export default function AccountsFeature({ workspace }: AccountsFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    accountRateLimitByID,
    rateLimitStrategies,
    isSelectionMode,
    selectedAccountIDs,
    isHeaderActionsMenuOpen,
    pendingStatusAccountID,
    accounts,
    filteredAccounts,
    groupedAccounts,
    selectedAccountIDSet,
    allFilteredSelected,
    loadAccounts,
    loadAccountUsage,
    loadAccountRateLimits,
    startCodexOAuth,
    cancelCodexOAuth,
    verifySelectedApiKey,
    testSelectedApiKeyQuotaCurl,
    testSelectedApiKeyBillingCurl,
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
    toggleAccountDisabled,
    exportSelectedAccounts,
    deleteAccount,
    renameSelectedApiKey,
    updateSelectedApiKeyPriority,
    updateSelectedApiKeyConfig,
    ready,
    sidecarStatus,
    headerActionsMenuRef,
  } = useAccountsPageStateContext();

  const [isUnifiedComposeOpen, setIsUnifiedComposeOpen] = useState(false);
  const [unifiedComposeForm, setUnifiedComposeForm] = useState<UnifiedComposeFormState>({
    ...emptyApiKeyForm,
    formatBaseUrls: {},
    billingCurl: '',
    billingEnabled: false,
  });
  const [unifiedComposeError, setUnifiedComposeError] = useState('');
  const [displayMode, setDisplayMode] = useState<AccountListDisplayMode>(() => readInitialDisplayMode());
  const [relayKeyItems, setRelayKeyItems] = useState<main.RelayServiceAPIKeyItem[]>([]);
  const [relayEndpoints, setRelayEndpoints] = useState<main.RelayServiceEndpoint[]>([]);
  const [localCodexAuthState, setLocalCodexAuthState] = useState<main.LocalCodexAuthState | null>(null);
  const [localCodexProviderState, setLocalCodexProviderState] = useState<main.LocalCodexModelProviderStateView | null>(null);
  const [localCliDraft, setLocalCliDraft] = useState<AccountCliApplyDraft | null>(null);
  const [localCliApplyMessage, setLocalCliApplyMessage] = useState('');
  const [isApplyingLocalCli, setIsApplyingLocalCli] = useState(false);

  const [relayModelNames, setRelayModelNames] = useState<string[]>([]);
  const loadRelayModelNames = useCallback(async (isCancelled: () => boolean = () => false) => {
    if (!ready) {
      setRelayModelNames([]);
      return;
    }
    try {
      const result = await ListRelaySupportedModels();
      if (isCancelled()) return;
      const models = result?.models || [];
      setRelayModelNames(models.map((m) => m.name).filter(Boolean));
    } catch {
      if (!isCancelled()) setRelayModelNames([]);
    }
  }, [ready]);

  const openAICompatibleState = useOpenAICompatibleState({
    ready,
    t,
    trackRequest,
  });
  const relayModelProviderSignature = useMemo(
    () => buildRelayModelProviderSignature(openAICompatibleState.providers),
    [openAICompatibleState.providers],
  );
  useEffect(() => {
    let cancelled = false;
    void loadRelayModelNames(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadRelayModelNames, relayModelProviderSignature]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalCliContext() {
      if (!hasWailsAppBindings()) {
        if (cancelled) return;
        setRelayKeyItems([
          main.RelayServiceAPIKeyItem.createFrom({
            value: 'sk-gettokens-preview-account-template',
          }),
        ]);
        setRelayEndpoints([
          main.RelayServiceEndpoint.createFrom({
            id: 'localhost',
            kind: 'localhost',
            host: '127.0.0.1',
            baseUrl: 'http://127.0.0.1:8317/v1',
          }),
        ]);
        setLocalCodexAuthState(main.LocalCodexAuthState.createFrom({
          hasAuthFile: true,
          authMode: 'chatgpt',
          hasTokens: true,
          canPreserveChatGPTAuth: true,
        }));
        setLocalCodexProviderState(main.LocalCodexModelProviderStateView.createFrom({
          currentProviderID: 'team-codex-relay',
          currentProviderName: 'Team Codex Relay',
          currentProviderIsBuiltin: false,
          currentProviderExists: true,
          providers: [{ providerID: 'team-codex-relay', providerName: 'Team Codex Relay' }],
        }));
        return;
      }

      if (!ready) {
        setRelayKeyItems([]);
        setRelayEndpoints([]);
        return;
      }

      try {
        const [config, authState, providerState] = await Promise.all([
          trackRequest('GetRelayServiceConfig', { args: [] }, () => GetRelayServiceConfig()),
          trackRequest('GetLocalCodexAuthState', { args: [] }, () => GetLocalCodexAuthState()),
          trackRequest('GetLocalCodexModelProviderStateView', { args: [] }, () => GetLocalCodexModelProviderStateView()),
        ]);
        if (cancelled) {
          return;
        }
        setRelayKeyItems(config.apiKeyItems || (config.apiKeys || []).map((value) => main.RelayServiceAPIKeyItem.createFrom({ value })));
        setRelayEndpoints(config.endpoints || []);
        setLocalCodexAuthState(authState);
        setLocalCodexProviderState(providerState);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRelayKeyItems([]);
          setRelayEndpoints([]);
          setLocalCodexAuthState(null);
          setLocalCodexProviderState(null);
        }
      }
    }

    void loadLocalCliContext();

    return () => {
      cancelled = true;
    };
  }, [ready, trackRequest]);
  useEffect(() => {
    if (selectedAccount?.credentialSource !== 'api-key') {
      return;
    }
    let cancelled = false;
    void loadRelayModelNames(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadRelayModelNames, selectedAccount?.credentialSource, selectedAccount?.id]);

  const groupCardHeights = useGroupCardHeights(pageRef, groupedAccounts, loading, selectedAccountIDs, displayMode);
  const isAggregateWorkspace = true;
  const usageAccounts = useMemo(() => accounts, [accounts]);
  const rotationAccounts = accounts;
  const previewMode = !hasWailsAppBindings();
  const selectedRelayEndpoint = useMemo(() => (
    relayEndpoints[0] || main.RelayServiceEndpoint.createFrom({
      id: 'localhost',
      kind: 'localhost',
      host: '127.0.0.1',
      baseUrl: `http://127.0.0.1:${sidecarStatus.port || 8317}/v1`,
    })
  ), [relayEndpoints, sidecarStatus.port]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    void loadAccountUsage(usageAccounts);
    void loadAccountRateLimits(usageAccounts);
  }, [loadAccountRateLimits, loadAccountUsage, ready, usageAccounts]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !shouldScheduleAccountUsageRefresh({
        ready,
        hasRuntimeBindings: hasWailsAppBindings(),
        accounts: usageAccounts,
      })
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadAccountUsage(usageAccounts);
    }, ACCOUNT_USAGE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadAccountUsage, ready, usageAccounts]);

  async function reloadRotationAccounts() {
    await loadAccounts();
    await openAICompatibleState.loadProviders();
  }

  const updateDisplayMode = useCallback((nextMode: AccountListDisplayMode) => {
    setDisplayMode(nextMode);
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY, nextMode);
    } catch {
      // The current hash still reflects the active session if storage is unavailable.
    }
    window.location.hash = buildAccountListDisplayModeHash(window.location.hash, nextMode);
  }, []);

  const markAccountDetailInHash = useCallback((detailID: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = buildAccountDetailFrameHash(window.location.hash, detailID);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const clearAccountDetailInHash = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = clearAccountDetailFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const openAccountDetail = useCallback(
    (account: AccountRecord) => {
      if (account.id.startsWith('openai-compatible:')) {
        const providerName = account.id.slice('openai-compatible:'.length).trim().toLowerCase();
        const provider = openAICompatibleState.providers.find(
          (item) => item.name.trim().toLowerCase() === providerName || item.name.trim().toLowerCase() === account.provider.trim().toLowerCase(),
        );
        if (provider) {
          openAICompatibleState.openDetailModal(provider);
          markAccountDetailInHash(account.id);
          return;
        }
      }
      setSelectedAccount(account);
      markAccountDetailInHash(account.id);
    },
    [markAccountDetailInHash, openAICompatibleState, setSelectedAccount],
  );

  const closeAccountDetail = useCallback(() => {
    setSelectedAccount(null);
    clearAccountDetailInHash();
  }, [clearAccountDetailInHash, setSelectedAccount]);

  const openUnifiedCompose = useCallback(() => {
    setUnifiedComposeError('');
    setUnifiedComposeForm({ ...emptyApiKeyForm, formatBaseUrls: {}, billingCurl: '', billingEnabled: false });
    setIsUnifiedComposeOpen(true);
  }, []);

  const handlePresetApply = useCallback(
    (preset: VendorPreset) => {
      const formatBaseUrls: Record<string, string> = {};
      for (const fmt of preset.supportedFormats) {
        const presetUrl = preset.formatBaseUrls?.[fmt] ?? preset.baseUrl;
        if (presetUrl) formatBaseUrls[fmt] = presetUrl;
      }
      const quotaCurl = preset.quotaCurlTemplate
        ?? `curl -sS "${preset.baseUrl}/usage" -H "Authorization: Bearer {{apiKey}}"`;
      setUnifiedComposeForm((prev) => ({
        ...prev,
        label: preset.name,
        baseUrl: preset.baseUrl,
        formatBaseUrls,
        quotaCurl,
        quotaEnabled: true,
        billingCurl: preset.billingCurlTemplate ?? prev.billingCurl,
        billingEnabled: Boolean(preset.billingCurlTemplate),
      }));
      setUnifiedComposeError('');
    },
    [],
  );

  const handleUnifiedComposeSubmit = useCallback(async () => {
    const apiKey = unifiedComposeForm.apiKey.trim();
    if (!apiKey) {
      setUnifiedComposeError('API Key is required');
      return;
    }
    const baseUrl = unifiedComposeForm.baseUrl.trim();
    if (!baseUrl) {
      setUnifiedComposeError('Base URL is required');
      return;
    }

    const formatBaseUrls: Record<string, string> = {};
    for (const [fmt, url] of Object.entries(unifiedComposeForm.formatBaseUrls)) {
      const trimmed = (url as string).trim();
      if (trimmed) formatBaseUrls[fmt] = trimmed;
    }

    try {
      await trackRequest(
        'CreateCodexAPIKey',
        { baseUrl },
        () =>
          CreateCodexAPIKey(main.CreateCodexAPIKeyInput.createFrom({
            apiKey,
            label: unifiedComposeForm.label.trim(),
            baseUrl,
            formatBaseUrls: Object.keys(formatBaseUrls).length > 0 ? formatBaseUrls : undefined,
            priority: 0,
            prefix: '',
            quotaCurl: unifiedComposeForm.quotaCurl.trim(),
            quotaEnabled: Boolean(unifiedComposeForm.quotaEnabled && unifiedComposeForm.quotaCurl.trim()),
            billingCurl: unifiedComposeForm.billingCurl?.trim() ?? '',
            billingEnabled: Boolean(unifiedComposeForm.billingEnabled && (unifiedComposeForm.billingCurl?.trim() ?? '')),
          })),
      );
      setIsUnifiedComposeOpen(false);
      setUnifiedComposeForm({ ...emptyApiKeyForm, formatBaseUrls: {}, billingCurl: '', billingEnabled: false });
      setUnifiedComposeError('');
      await loadAccounts();
    } catch (err) {
      setUnifiedComposeError(err instanceof Error ? err.message : String(err));
    }
  }, [unifiedComposeForm, trackRequest, loadAccounts]);

  const openOpenAICompatibleDetail = useCallback(
    (provider: OpenAICompatibleProvider) => {
      openAICompatibleState.openDetailModal(provider);
      markAccountDetailInHash(`openai-compatible:${provider.name}`);
    },
    [markAccountDetailInHash, openAICompatibleState],
  );

  const closeOpenAICompatibleDetail = useCallback(() => {
    openAICompatibleState.closeDetailModal();
    clearAccountDetailInHash();
  }, [clearAccountDetailInHash, openAICompatibleState]);

  const resolveLocalCliMappingsForAccount = useCallback(
    (account: AccountRecord) =>
      resolveAccountLocalCliMappings({
        account,
        relayKeyItems,
        relayEndpoint: selectedRelayEndpoint,
        selectedModel: relayModelNames[0] || 'GT',
        selectedReasoningEffort: 'medium',
        supportsWebsockets: true,
        sidecarReady: previewMode || sidecarStatus.code === 'ready',
        previewMode,
        currentCodexProviderState: localCodexProviderState,
        localCodexAuthState,
        accountBlockedReason: accountRateLimitByID[account.id]?.blocked
          ? accountRateLimitByID[account.id]?.blockReason || '账号当前被路由保护阻塞'
          : '',
      }),
    [
      accountRateLimitByID,
      localCodexAuthState,
      localCodexProviderState,
      previewMode,
      relayKeyItems,
      relayModelNames,
      selectedRelayEndpoint,
      sidecarStatus.code,
    ],
  );

  const resolveLocalCliActionsForAccount = useCallback(
    (account: AccountRecord) =>
      resolveLocalCliMappingsForAccount(account).map((mapping) => ({
        id: mapping.id,
        label: mapping.target === 'codex' ? '应用到 Codex' : '应用到 Claude Code',
        detail: `${mapping.templateName} / ${mapping.sourceFormat.toUpperCase()}`,
        disabled: !mapping.enabled,
        disabledReason: mapping.disabledReason,
        onSelect: () => {
          if (!mapping.enabled) {
            return;
          }
          setLocalCliApplyMessage('');
          setLocalCliDraft(mapping.draft);
        },
      })),
    [resolveLocalCliMappingsForAccount],
  );

  async function applyAccountLocalCliDraft(draft: AccountCliApplyDraft) {
    if (previewMode) {
      setLocalCliApplyMessage(`PREVIEW ONLY / ${draft.target === 'codex' ? 'Codex' : 'Claude Code'} 草稿已确认，未调用 Wails 写入。`);
      return;
    }

    const blockingWarning = draft.source.warnings.find((warning) => warning.severity === 'blocking');
    if (blockingWarning) {
      setLocalCliApplyMessage(blockingWarning.message);
      return;
    }
    const relayKey = String(relayKeyItems[draft.source.relayKeyIndex]?.value || '').trim();
    if (!relayKey) {
      setLocalCliApplyMessage('缺少 GetTokens relay key，不能写入本机 CLI 配置。');
      return;
    }

    setIsApplyingLocalCli(true);
    try {
      if (draft.target === 'codex') {
        const result = await trackRequest(
          'ApplyRelayServiceConfigToLocalV2',
          {
            apiKey: relayKey,
            baseURL: draft.codex.baseUrl,
            model: draft.codex.model,
            reasoningEffort: draft.codex.reasoningEffort,
            providerID: draft.codex.providerID,
            providerName: draft.codex.providerName,
            authStrategy: draft.codex.authStrategy,
          },
          () =>
            ApplyRelayServiceConfigToLocalV2({
              apiKey: relayKey,
              baseURL: draft.codex.baseUrl,
              model: draft.codex.model,
              reasoningEffort: draft.codex.reasoningEffort,
              providerID: draft.codex.providerID,
              providerName: draft.codex.providerName,
              supportsWebsockets: draft.codex.supportsWebsockets,
              authStrategy: draft.codex.authStrategy,
            }),
        );
        setLocalCliApplyMessage(`已写入 Codex：${result.configPath || result.codexHomePath}`);
        try {
          const providerState = await trackRequest('GetLocalCodexModelProviderStateView', { args: [] }, () =>
            GetLocalCodexModelProviderStateView()
          );
          setLocalCodexProviderState(providerState);
        } catch (refreshError) {
          console.error(refreshError);
        }
        return;
      }

      const result = await trackRequest(
        'ApplyClaudeCodeAPIKeyConfigToLocal',
        {
          apiKey: relayKey,
          baseURL: draft.claude.baseUrl,
          options: {
            model: draft.claude.model,
            defaultHaikuModel: draft.claude.defaultHaikuModel,
            defaultSonnetModel: draft.claude.defaultSonnetModel,
            defaultOpusModel: draft.claude.defaultOpusModel,
            smallFastModel: draft.claude.smallFastModel,
            maxOutputTokens: draft.claude.maxOutputTokens,
            apiTimeoutMs: draft.claude.apiTimeoutMs,
            disableNonEssentialTraffic: draft.claude.disableNonEssentialTraffic,
          },
        },
        () =>
          ApplyClaudeCodeAPIKeyConfigToLocal(relayKey, draft.claude.baseUrl, {
            model: draft.claude.model,
            defaultHaikuModel: draft.claude.defaultHaikuModel,
            defaultSonnetModel: draft.claude.defaultSonnetModel,
            defaultOpusModel: draft.claude.defaultOpusModel,
            smallFastModel: draft.claude.smallFastModel,
            maxOutputTokens: draft.claude.maxOutputTokens,
            apiTimeoutMs: draft.claude.apiTimeoutMs,
            disableNonEssentialTraffic: draft.claude.disableNonEssentialTraffic,
          }),
      );
      const warningSuffix = result.warnings?.length ? ` / ${result.warnings.join(' / ')}` : '';
      setLocalCliApplyMessage(`已写入 Claude Code：${result.settingsPath}${warningSuffix}`);
    } catch (error) {
      console.error(error);
      setLocalCliApplyMessage(`写入失败：${toErrorMessage(error)}`);
    } finally {
      setIsApplyingLocalCli(false);
    }
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
            onOpenUnifiedCompose={openUnifiedCompose}
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
            displayMode={displayMode}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setPendingDeleteID(null);
            }}
            onFiltersChange={setFilters}
            onDisplayModeChange={updateDisplayMode}
            onToggleSelectionMode={toggleSelectionMode}
            onToggleSelectAllFiltered={toggleSelectAllFiltered}
            onClearSelection={() => setSelectedAccountIDs([])}
            onExportSelected={() => void exportSelectedAccounts()}
          />

          {deleteError ? (
            <div className="border-2 border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--color-status-danger)]">
              {deleteError}
            </div>
          ) : null}
          {oauthBanner ? (
            <div
              className={`flex items-start justify-between gap-3 border-2 px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide ${
                oauthBanner.tone === 'error'
                  ? 'border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--color-status-danger)]'
                  : oauthBanner.tone === 'success'
                    ? 'border-[var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_10%,transparent)] text-[var(--color-status-success)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
              }`}
            >
              <span>{oauthBanner.message}</span>
              {!isOAuthPending ? (
                <button onClick={() => setOAuthBanner(null)} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
                  {t('common.close')}
                </button>
              ) : null}
            </div>
          ) : null}

          {!ready ? (
            <div className="account-card-grid-full grid gap-8">
              {[...Array(6)].map((_, i) => (
                <AccountCardSkeleton key={`ready-${i}`} />
              ))}
            </div>
          ) : loading ? (
            <div className="account-card-grid-full grid gap-8">
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
                  accountRateLimitByID={accountRateLimitByID}
                  ready={ready}
                  isSelectionMode={isSelectionMode}
                  selectedAccountIDSet={selectedAccountIDSet}
                  pendingDeleteID={pendingDeleteID}
                  oauthPendingAccountID={oauthPendingAccountID}
                  pendingStatusAccountID={pendingStatusAccountID}
                  displayMode={displayMode}
                  onToggleSelection={toggleAccountSelection}
                  onOpenDetails={openAccountDetail}
                  onRefreshQuota={(account) => void refreshCodexQuota(account)}
                  onStartReauth={(account) => void startCodexOAuth(account)}
                  onToggleDisabled={(account) => void toggleAccountDisabled(account)}
                  onRequestDelete={(accountID) => {
                    setDeleteError('');
                    setPendingDeleteID(accountID);
                  }}
                  onCancelDelete={() => setPendingDeleteID(null)}
                  onConfirmDelete={(account) => void deleteAccount(account)}
                  downloadAuthFile={DownloadAuthFile}
                  resolveLocalCliActions={resolveLocalCliActionsForAccount}
                />
              ))}
            </div>
          )}

      {selectedAccount ? (
        <UnifiedAccountDetailModal
          account={selectedAccount}
          quotaState={selectedAccount.quotaKey ? codexQuotaByName[selectedAccount.quotaKey] : undefined}
          usageSummary={accountUsageByID[selectedAccount.id]}
          rateLimitStatus={accountRateLimitByID[selectedAccount.id]}
          rateLimitStrategies={rateLimitStrategies}
          verifyState={apiKeyVerifyState}
          modelNames={relayModelNames}
          onClose={closeAccountDetail}
          onRename={renameSelectedApiKey}
          onSaveConfig={selectedAccount.credentialSource === 'api-key' && selectedAccount.id.startsWith('codex-api-key:')
            ? (draft) => updateSelectedApiKeyConfig(draft)
            : undefined}
          onVerify={selectedAccount.credentialSource === 'api-key' ? (input) => void verifySelectedApiKey(input) : undefined}
          onTestQuotaCurl={selectedAccount.credentialSource === 'api-key' ? (input) => testSelectedApiKeyQuotaCurl(input) : undefined}
          onTestBillingCurl={selectedAccount.credentialSource === 'api-key' ? (input) => testSelectedApiKeyBillingCurl(input) : undefined}
          onRateLimitRulesChanged={() => void loadAccountRateLimits(usageAccounts)}
          onStartReauth={isCodexAuthFile(selectedAccount) ? () => { void startCodexOAuth(selectedAccount); } : undefined}
          onCancelReauth={cancelCodexOAuth}
          isReauthing={oauthPendingAccountID === selectedAccount.id}
        />
      ) : null}

      {openAICompatibleState.detailDraft ? (
        <OpenAICompatibleDetailModal
          t={t}
          draft={openAICompatibleState.detailDraft}
          rateLimitStatus={accountRateLimitByID[`openai-compatible:${openAICompatibleState.detailDraft.currentName}`]}
          rateLimitStrategies={rateLimitStrategies}
          rateLimitRulesAPI={{
            list: ListRateLimitRules,
            create: CreateRateLimitRule,
            update: UpdateRateLimitRule,
            delete: DeleteRateLimitRule,
          }}
          verifyState={
            openAICompatibleState.verifyStates[openAICompatibleState.detailDraft.currentName] ?? {
              model: openAICompatibleState.detailDraft.verifyModel,
              status: 'idle',
              message: '',
              lastVerifiedAt: null,
            }
          }
          remoteModelsState={openAICompatibleState.remoteModelsStates[openAICompatibleState.detailDraft.currentName]}
          error={openAICompatibleState.detailError}
          saving={openAICompatibleState.detailSaving}
          onClose={closeOpenAICompatibleDetail}
          onChange={openAICompatibleState.setDetailDraft}
          onSave={() => void openAICompatibleState.saveDetail()}
          onVerify={() => void openAICompatibleState.verifyDetail()}
          onFetchModels={() => void openAICompatibleState.fetchDetailModels()}
          onApplyFetchedModels={openAICompatibleState.applyFetchedModelsToDetailDraft}
          onRateLimitRulesChanged={() => void loadAccountRateLimits(usageAccounts)}
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
          onFetchModels={async (input) => {
            const result = await FetchOpenAICompatibleProviderModels(
              main.FetchOpenAICompatibleProviderModelsInput.createFrom(input),
            );
            return {
              models: (result.models ?? []).map((m) => m.name).filter(Boolean),
              message: result.message ?? '',
            };
          }}
          onVerify={async (input) => {
            const result = await VerifyOpenAICompatibleProvider(
              main.VerifyOpenAICompatibleProviderInput.createFrom(input),
            );
            return { success: result.success, message: result.message ?? '' };
          }}
        />
      ) : null}

      {isUnifiedComposeOpen ? (
        <UnifiedComposeModal
          t={t}
          form={unifiedComposeForm}
          error={unifiedComposeError}
          onClose={() => {
            setIsUnifiedComposeOpen(false);
            setUnifiedComposeError('');
          }}
          onFormChange={(field, value) => {
            setUnifiedComposeForm((prev) => ({ ...prev, [field]: value }));
            setUnifiedComposeError('');
          }}
          onFormatBaseUrlChange={(format, value) => {
            setUnifiedComposeForm((prev) => ({
              ...prev,
              formatBaseUrls: { ...prev.formatBaseUrls, [format]: value },
            }));
            setUnifiedComposeError('');
          }}
          onBillingCurlChange={(value) => {
            setUnifiedComposeForm((prev) => ({
              ...prev,
              billingCurl: value,
              billingEnabled: value.trim().length > 0,
            }));
          }}
          onPresetApply={handlePresetApply}
          onSubmit={() => void handleUnifiedComposeSubmit()}
        />
      ) : null}

      {isRotationModalOpen ? (
        <AccountRotationModal
          accounts={rotationAccounts}
          codexQuotaByName={codexQuotaByName}
          ready={ready}
          onClose={() => setIsRotationModalOpen(false)}
          onReloadAccounts={reloadRotationAccounts}
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

      {localCliDraft ? (
        <AccountLocalCliApplyConfirm
          draft={localCliDraft}
          relayKeyItems={relayKeyItems}
          applying={isApplyingLocalCli}
          resultMessage={localCliApplyMessage}
          previewMode={previewMode}
          onClose={() => {
            setLocalCliDraft(null);
            setLocalCliApplyMessage('');
          }}
          onApply={(draft) => void applyAccountLocalCliDraft(draft)}
        />
      ) : null}
        </div>
      </div>
    </>
  );
}

function readInitialDisplayMode(): AccountListDisplayMode {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCOUNT_LIST_DISPLAY_MODE;
  }
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const hashDensity = params.get('density');
  if (hashDensity) {
    return parseAccountListDisplayMode(hashDensity);
  }
  try {
    return parseAccountListDisplayMode(window.localStorage.getItem(ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCOUNT_LIST_DISPLAY_MODE;
  }
}
