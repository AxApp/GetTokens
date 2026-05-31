import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApplyClaudeCodeAPIKeyConfigToLocal,
  ApplyDeepLinkImport,
  ApplyRelayServiceConfigToLocalV2,
  ConsumePendingDeepLinks,
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
  PreviewDeepLinkImport,
  UpdateRateLimitRule,
  VerifyOpenAICompatibleProvider,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { useDebug } from '../../context/useDebug';
import { useI18n } from '../../context/I18nContext';
import AccountCardSkeleton from './components/AccountCardSkeleton';
import AccountImportModal from './components/AccountImportModal';
import AccountLocalCliApplyConfirm from './components/AccountLocalCliApplyConfirm';
import DeepLinkCodexApplyAdapter from './components/DeepLinkCodexApplyAdapter';
import AccountGroupSection from './components/AccountGroupSection';
import AccountsHeader from './components/AccountsHeader';
import AccountsToolbar, { AccountsSelectionActions } from './components/AccountsToolbar';
import ApiKeyComposeModal from './components/ApiKeyComposeModal';
import CodexOAuthModal from './components/CodexOAuthModal';
import OpenAICompatibleComposeModal from './components/OpenAICompatibleComposeModal';
import OpenAICompatibleDetailModal from './components/OpenAICompatibleDetailModal';
import UnifiedComposeModal, { type UnifiedComposeFormState } from './components/UnifiedComposeModal';
import UnifiedAccountDetailModal from './components/UnifiedAccountDetailModal';
import { useAccountsPageStateContext } from './AccountsPageStateContext';
import useOpenAICompatibleState from './hooks/useOpenAICompatibleState';
import { getAccountsPreviewRelayModelNames } from './previewData';
import { isCodexAuthFile } from './model/accountPresentation';
import { readAccountClipboardFallback } from './model/accountClipboard';
import { findAccountDetailByID } from './model/accountDetailSelection';
import { buildRelayModelProviderSignature } from './model/apiKeyModelCatalog';
import useGroupCardHeights from './hooks/useGroupCardHeights';
import {
  buildAccountDetailFrameHash,
  buildAccountDetailScriptFrameHash,
  clearAccountDetailFrameHash,
  clearAccountDetailScriptFrameHash,
  readFrameHashState,
  type AccountDetailScriptRoute,
} from '../../utils/pagePersistence';
import { hasWailsAppBindings, hasWailsRuntime } from '../../utils/previewMode';
import type { AccountRecord } from './model/types';
import {
  resolveAccountLocalCliMappings,
  type AccountCliApplyDraft,
  type AccountLocalCliMapping,
} from './model/accountLocalCliMapping';
import {
  ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY,
  DEFAULT_ACCOUNT_LIST_DISPLAY_MODE,
  buildAccountListViewHash,
  parseAccountListDisplayMode,
  type AccountGroupMode,
  type AccountListDisplayMode,
  type AccountSortMode,
} from './model/accountListLayout';
import {
  ACCOUNT_USAGE_REFRESH_INTERVAL_MS,
  shouldScheduleAccountUsageRefresh,
} from './model/accountUsage';
import { shouldShowAccountSkeletons } from './model/accountSnapshot';
import { toggleAccountGroupSelection } from './model/accountSelection';
import type { OpenAICompatibleProvider } from './model/openAICompatible';
import type { VendorPreset } from './model/vendorPresets';
import { emptyApiKeyForm } from './model/accountConfig';
import type { AccountImportPayloadItem } from './model/accountTransfer';
import { toErrorMessage } from '../../utils/error';

interface AccountsFeatureProps {
  workspace?: string;
}

export default function AccountsFeature({ workspace }: AccountsFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const processedDeepLinksRef = useRef<Set<string>>(new Set());
  const [initialImportPasteContent, setInitialImportPasteContent] = useState('');
  const [initialImportItems, setInitialImportItems] = useState<AccountImportPayloadItem[]>([]);
  const {
    loading,
    accountsLoaded,
    searchTerm,
    groupMode,
    sortMode,
    filters,
    selectedAccount,
    pendingDeleteID,
    deleteError,
    oauthBanner,
    oauthDialog,
    oauthPendingAccountID,
    isOAuthPending,
    accountActionNotice,
    apiKeyVerifyState,
    apiKeyFormError,
    isApiKeyModalOpen,
    apiKeyForm,
    isAccountImportModalOpen,
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
    availablePlanTypes,
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
    openApiKeyModal,
    submitApiKeyForm,
    submitAccountImport,
    toggleAccountSelection,
    toggleSelectAllFiltered,
    toggleSelectionMode,
    toggleAccountDisabled,
    bulkActionPending,
    runSelectedBulkDelete,
    runSelectedBulkRefresh,
    runAccountsBulkSetDisabled,
    runSelectedBulkSetDisabled,
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
  const [deepLinkRawURL, setDeepLinkRawURL] = useState('');
  const [deepLinkPreview, setDeepLinkPreview] = useState<main.DeepLinkImportPreview | null>(null);
  const [deepLinkDraft, setDeepLinkDraft] = useState<AccountCliApplyDraft | null>(null);
  const [deepLinkApplyMessage, setDeepLinkApplyMessage] = useState('');
  const [isApplyingDeepLink, setIsApplyingDeepLink] = useState(false);
  const [accountDetailIDFromHash, setAccountDetailIDFromHash] = useState(() => readAccountDetailIDFromHash());
  const [accountDetailScriptFromHash, setAccountDetailScriptFromHash] = useState<AccountDetailScriptRoute | ''>(() => readAccountDetailScriptFromHash());

  const [relayModelNames, setRelayModelNames] = useState<string[]>([]);
  const loadRelayModelNames = useCallback(async (isCancelled: () => boolean = () => false) => {
    if (!hasWailsAppBindings()) {
      setRelayModelNames(getAccountsPreviewRelayModelNames());
      return;
    }
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
          currentModel: 'gpt-5.4',
          hasExplicitCurrentModel: true,
          currentProviderID: 'team-codex-relay',
          currentProviderName: 'Team Codex Relay',
          currentProviderIsBuiltin: false,
          currentProviderExists: true,
          hasExplicitCurrentProvider: true,
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

  const accountCardHeights = useGroupCardHeights(pageRef, groupedAccounts, loading, selectedAccountIDs, displayMode);
  const isAggregateWorkspace = true;
  const usageAccounts = useMemo(() => accounts, [accounts]);
  const previewMode = !hasWailsAppBindings();
  const selectedRelayEndpoint = useMemo(() => (
    relayEndpoints[0] || main.RelayServiceEndpoint.createFrom({
      id: 'localhost',
      kind: 'localhost',
      host: '127.0.0.1',
      baseUrl: `http://127.0.0.1:${sidecarStatus.port || 8317}/v1`,
    })
  ), [relayEndpoints, sidecarStatus.port]);

  const openDeepLinkImport = useCallback(async (rawURL: string) => {
    const normalizedURL = rawURL.trim();
    if (!normalizedURL || processedDeepLinksRef.current.has(normalizedURL)) {
      return;
    }
    processedDeepLinksRef.current.add(normalizedURL);
    setDeepLinkApplyMessage('正在解析 deep link...');
    try {
      const preview = await trackRequest(
        'PreviewDeepLinkImport',
        { redactedURL: normalizedURL.replace(/(apiKey=)[^&]+/i, '$1[REDACTED]') },
        () => PreviewDeepLinkImport(normalizedURL),
      );
      if (preview.resource === 'account') {
        const items = buildDeepLinkAccountImportItems(preview.request.account);
        if (!items.length) {
          setAccountActionNotice({
            tone: 'warning',
            message: '已解析 Codex 账号 deep link，但当前账号类型需要后端专用确认页，本次未写入。',
          });
          return;
        }
        setInitialImportItems(items);
        setIsAccountImportModalOpen(true);
        setDeepLinkApplyMessage('');
        return;
      }
      const draft = buildDeepLinkCodexApplyDraft(preview);
      setDeepLinkRawURL(normalizedURL);
      setDeepLinkPreview(preview);
      setDeepLinkDraft(draft);
      setDeepLinkApplyMessage(preview.blockingWarnings?.[0] || 'Deep link 已转换为 Codex local apply 草稿，等待确认。');
    } catch (error) {
      console.error(error);
      setAccountActionNotice({
        tone: 'error',
        message: `Deep link 解析失败：${toErrorMessage(error)}`,
      });
      setDeepLinkApplyMessage('');
    }
  }, [setAccountActionNotice, trackRequest]);

  useEffect(() => {
    if (!hasWailsRuntime() || !hasWailsAppBindings()) {
      return;
    }
    const offDeepLink = EventsOn('deeplink:import', (rawURL: string) => {
      void openDeepLinkImport(String(rawURL || ''));
      void ConsumePendingDeepLinks().catch((error) => {
        console.error(error);
      });
    });
    void ConsumePendingDeepLinks()
      .then((links) => {
        (links || []).forEach((link) => void openDeepLinkImport(link));
      })
      .catch((error) => {
        console.error(error);
      });
    return () => {
      offDeepLink();
    };
  }, [openDeepLinkImport]);

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    function syncDetailIDFromHash() {
      const hashState = readFrameHashState(window.location.hash);
      setAccountDetailIDFromHash(hashState?.accountDetailID ?? '');
      setAccountDetailScriptFromHash(hashState?.accountDetailScript ?? '');
    }
    window.addEventListener('hashchange', syncDetailIDFromHash);
    return () => window.removeEventListener('hashchange', syncDetailIDFromHash);
  }, []);

  useEffect(() => {
    if (!accountDetailIDFromHash) {
      return;
    }
    if (selectedAccount?.id === accountDetailIDFromHash) {
      return;
    }
    const account = findAccountDetailByID(accounts, accountDetailIDFromHash);
    if (account) {
      if (isOpenAICompatibleAccount(account)) {
        const provider = openAICompatibleState.providers.find(
          (item) =>
            item.accountKey === account.id ||
            item.name.trim().toLowerCase() === account.provider.trim().toLowerCase(),
        );
        if (provider) {
          openAICompatibleState.openDetailModal(provider);
          return;
        }
      }
      setSelectedAccount(account);
    }
  }, [
    accountDetailIDFromHash,
    accounts,
    openAICompatibleState.openDetailModal,
    openAICompatibleState.providers,
    selectedAccount?.id,
    setSelectedAccount,
  ]);

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
    window.location.hash = buildAccountListViewHash(window.location.hash, { displayMode: nextMode });
  }, []);

  const updateGroupMode = useCallback((nextMode: AccountGroupMode) => {
    setGroupMode(nextMode);
    if (typeof window === 'undefined') {
      return;
    }
    window.location.hash = buildAccountListViewHash(window.location.hash, { groupMode: nextMode });
  }, [setGroupMode]);

  const updateSortMode = useCallback((nextMode: AccountSortMode) => {
    setSortMode(nextMode);
    if (typeof window === 'undefined') {
      return;
    }
    window.location.hash = buildAccountListViewHash(window.location.hash, { sortMode: nextMode });
  }, [setSortMode]);

  const toggleGroupSelection = useCallback(
    (groupAccounts: AccountRecord[]) => {
      if (!isSelectionMode || groupAccounts.length === 0) {
        return;
      }
      setSelectedAccountIDs((prev) => toggleAccountGroupSelection(prev, groupAccounts));
    },
    [isSelectionMode, setSelectedAccountIDs],
  );

  const refreshGroupQuota = useCallback(
    (groupAccounts: AccountRecord[]) => {
      groupAccounts.forEach((account) => {
        void refreshCodexQuota(account);
      });
    },
    [refreshCodexQuota],
  );

  const setGroupDisabled = useCallback(
    (groupAccounts: AccountRecord[], nextDisabled: boolean) => {
      void runAccountsBulkSetDisabled(groupAccounts, nextDisabled);
    },
    [runAccountsBulkSetDisabled],
  );

  const markAccountDetailInHash = useCallback((detailID: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    setAccountDetailIDFromHash(detailID);
    setAccountDetailScriptFromHash('');
    const nextHash = buildAccountDetailFrameHash(window.location.hash, detailID);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const clearAccountDetailInHash = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setAccountDetailIDFromHash('');
    setAccountDetailScriptFromHash('');
    const nextHash = clearAccountDetailFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const openAccountDetailScriptRoute = useCallback((script: AccountDetailScriptRoute) => {
    if (typeof window === 'undefined' || !selectedAccount) {
      return;
    }
    setAccountDetailIDFromHash(selectedAccount.id);
    setAccountDetailScriptFromHash(script);
    const nextHash = buildAccountDetailScriptFrameHash(window.location.hash, selectedAccount.id, script);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [selectedAccount]);

  const closeAccountDetailScriptRoute = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setAccountDetailScriptFromHash('');
    const nextHash = clearAccountDetailScriptFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const openAccountDetail = useCallback(
    (account: AccountRecord) => {
      if (isOpenAICompatibleAccount(account)) {
        const providerName = account.provider.trim().toLowerCase();
        const provider = openAICompatibleState.providers.find(
          (item) =>
            item.accountKey === account.id ||
            item.name.trim().toLowerCase() === providerName ||
            item.name.trim().toLowerCase() === account.provider.trim().toLowerCase(),
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
      markAccountDetailInHash(provider.accountKey || provider.name);
    },
    [markAccountDetailInHash, openAICompatibleState],
  );

  const closeOpenAICompatibleDetail = useCallback(() => {
    openAICompatibleState.closeDetailModal();
    clearAccountDetailInHash();
  }, [clearAccountDetailInHash, openAICompatibleState]);

  const selectedAccountIsCodexAPIKey = selectedAccount ? isCodexAPIKeyAccount(selectedAccount) : false;

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
    const codexUsesOAuthAuthFile = draft.target === 'codex' && draft.codex.authStrategy === 'replace_auth_with_oauth';
    const codexUsesAccountAPIKey = draft.target === 'codex' && draft.codex.authStrategy === 'replace_auth_with_apikey';
    const codexAPIKey = codexUsesAccountAPIKey ? String(draft.codex.apiKey || '').trim() : relayKey;
    const claudeAPIKey = draft.target === 'claude' ? String(draft.claude.apiKey || relayKey).trim() : '';
    if (draft.target === 'codex' && codexUsesAccountAPIKey && !codexAPIKey) {
      setLocalCliApplyMessage('当前账号缺少 API Key，不能写入 Codex。');
      return;
    }
    if (draft.target !== 'codex' && !claudeAPIKey) {
      setLocalCliApplyMessage('缺少 GetTokens relay key，不能写入本机 CLI 配置。');
      return;
    }
    if (draft.target === 'codex' && !codexAPIKey && !codexUsesOAuthAuthFile) {
      setLocalCliApplyMessage('缺少 GetTokens relay key，不能写入本机 CLI 配置。');
      return;
    }

    setIsApplyingLocalCli(true);
    try {
      if (draft.target === 'codex') {
        let authFileContentBase64 = '';
        if (draft.codex.authStrategy === 'replace_auth_with_oauth') {
          const authFileName = String(draft.codex.authFileName || '').trim();
          if (!authFileName) {
            setLocalCliApplyMessage('OAuth 账号缺少 auth-file 名称，不能写入 Codex OAuth 配置。');
            return;
          }
          const authFile = await trackRequest(
            'DownloadAuthFile',
            { name: authFileName, target: 'codex-oauth-local-apply' },
            () => DownloadAuthFile(authFileName),
          );
          authFileContentBase64 = authFile.contentBase64 || '';
        }
        const result = await trackRequest(
          'ApplyRelayServiceConfigToLocalV2',
          {
            apiKey: codexAPIKey,
            authFileName: draft.codex.authFileName,
            baseURL: draft.codex.baseUrl,
            model: draft.codex.model,
            reasoningEffort: draft.codex.reasoningEffort,
            providerID: draft.codex.providerID,
            providerName: draft.codex.providerName,
            authStrategy: draft.codex.authStrategy,
            skipRelayKeyMetadata: codexUsesAccountAPIKey,
          },
          () =>
            ApplyRelayServiceConfigToLocalV2({
              apiKey: codexAPIKey,
              apiKeySet: draft.codex.apiKeySet ?? true,
              authFileContentBase64,
              authFileContentSet: draft.codex.authStrategy === 'replace_auth_with_oauth' && Boolean(authFileContentBase64),
              baseURL: draft.codex.baseUrl,
              baseURLSet: draft.codex.baseUrlSet ?? true,
              model: draft.codex.model,
              modelSet: draft.codex.modelSet ?? true,
              reasoningEffort: draft.codex.reasoningEffort,
              reasoningEffortSet: draft.codex.reasoningEffortSet ?? true,
              providerID: draft.codex.providerID,
              providerIDSet: draft.codex.providerIDSet ?? true,
              providerName: draft.codex.providerName,
              providerNameSet: draft.codex.providerNameSet ?? true,
              requiresOpenAIAuth: draft.codex.requiresOpenAIAuth ?? true,
              requiresOpenAIAuthSet: draft.codex.requiresOpenAIAuthSet ?? true,
              wireAPI: draft.codex.wireAPI || 'responses',
              wireAPISet: draft.codex.wireAPISet ?? true,
              supportsWebsockets: draft.codex.supportsWebsockets,
              supportsWebsocketsSet: draft.codex.supportsWebsocketsSet ?? true,
              authStrategy: draft.codex.authStrategy,
              skipRelayKeyMetadata: codexUsesAccountAPIKey,
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
          apiKey: claudeAPIKey,
          baseURL: draft.claude.baseUrl,
          options: {
            authField: draft.claude.authField,
            model: draft.claude.model,
            defaultHaikuModel: draft.claude.defaultHaikuModel,
            defaultSonnetModel: draft.claude.defaultSonnetModel,
            defaultOpusModel: draft.claude.defaultOpusModel,
            smallFastModel: draft.claude.smallFastModel,
            maxOutputTokens: draft.claude.maxOutputTokens,
            apiTimeoutMs: draft.claude.apiTimeoutMs,
            disableNonEssentialTraffic: draft.claude.disableNonEssentialTraffic,
            claudeCodeAttributionHeader: draft.claude.claudeCodeAttributionHeader,
          },
        },
        () =>
          ApplyClaudeCodeAPIKeyConfigToLocal(claudeAPIKey, draft.claude.baseUrl, {
            authField: draft.claude.authField,
            model: draft.claude.model,
            defaultHaikuModel: draft.claude.defaultHaikuModel,
            defaultSonnetModel: draft.claude.defaultSonnetModel,
            defaultOpusModel: draft.claude.defaultOpusModel,
            smallFastModel: draft.claude.smallFastModel,
            maxOutputTokens: draft.claude.maxOutputTokens,
            apiTimeoutMs: draft.claude.apiTimeoutMs,
            disableNonEssentialTraffic: draft.claude.disableNonEssentialTraffic,
            claudeCodeAttributionHeader: draft.claude.claudeCodeAttributionHeader,
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

  async function applyDeepLinkDraft(draft: AccountCliApplyDraft, accountOnly = false) {
    if (previewMode) {
      setDeepLinkApplyMessage('PREVIEW ONLY / deep link 草稿已确认，未调用 Wails 写入。');
      return;
    }
    if (!deepLinkRawURL) {
      setDeepLinkApplyMessage('缺少 deep link 原始 URL，不能应用。');
      return;
    }
    const blockingWarning = draft.source.warnings.find((warning) => warning.severity === 'blocking');
    if (blockingWarning && !accountOnly) {
      setDeepLinkApplyMessage(blockingWarning.message);
      return;
    }
    setIsApplyingDeepLink(true);
    try {
      if (accountOnly) {
        const result = await trackRequest(
          'ApplyDeepLinkImport',
          { redactedURL: deepLinkPreview?.redactedURL || '[REDACTED]', accountOnly: true },
          () => ApplyDeepLinkImport(buildDeepLinkAccountOnlyURL(deepLinkRawURL)),
        );
        if (result.accountApplied) {
          setDeepLinkApplyMessage('已按 deep link 导入账号，未写入 Codex 配置。');
          await loadAccounts();
        } else {
          setDeepLinkApplyMessage(`账号导入失败：${result.accountError || '未知错误'}`);
        }
        return;
      }
      const result = await trackRequest(
        'ApplyDeepLinkImport',
        { redactedURL: deepLinkPreview?.redactedURL || '[REDACTED]' },
        () => ApplyDeepLinkImport(deepLinkRawURL),
      );
      if (result.status === 'partial') {
        setDeepLinkApplyMessage(`部分完成：${result.codexConfigError || result.accountError || 'Codex 配置未应用'}`);
      } else if (result.status === 'failed') {
        setDeepLinkApplyMessage(`应用失败：${result.codexConfigError || result.accountError || '未知错误'}`);
      } else {
        setDeepLinkApplyMessage(`已应用 deep link：${result.localApplyResult?.configPath || result.status}`);
        await loadAccounts();
        try {
          const providerState = await trackRequest('GetLocalCodexModelProviderStateView', { args: [] }, () =>
            GetLocalCodexModelProviderStateView()
          );
          setLocalCodexProviderState(providerState);
        } catch (refreshError) {
          console.error(refreshError);
        }
      }
    } catch (error) {
      console.error(error);
      setDeepLinkApplyMessage(`应用失败：${toErrorMessage(error)}`);
    } finally {
      setIsApplyingDeepLink(false);
    }
  }

  const showAccountSkeletons = shouldShowAccountSkeletons({
    ready,
    loaded: accountsLoaded,
    accountCount: accounts.length,
  });

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
            headerActionsMenuRef={headerActionsMenuRef}
            onToggleMenu={() => setIsHeaderActionsMenuOpen((prev) => !prev)}
            onOpenImportModal={() => {
              setInitialImportPasteContent(readAccountClipboardFallback());
              setIsAccountImportModalOpen(true);
              setIsHeaderActionsMenuOpen(false);
            }}
            onOpenApiKeyModal={() => {
              openApiKeyModal();
              setIsHeaderActionsMenuOpen(false);
            }}
            onOpenUnifiedCompose={openUnifiedCompose}
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
            bulkActionPending={bulkActionPending}
            displayMode={displayMode}
            groupMode={groupMode}
            sortMode={sortMode}
            availablePlanTypes={availablePlanTypes}
            planAvailabilityResolved={accountsLoaded}
            renderSelectionActions={false}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setPendingDeleteID(null);
            }}
            onFiltersChange={setFilters}
            onDisplayModeChange={updateDisplayMode}
            onGroupModeChange={updateGroupMode}
            onSortModeChange={updateSortMode}
            onToggleSelectionMode={toggleSelectionMode}
            onToggleSelectAllFiltered={toggleSelectAllFiltered}
            onClearSelection={() => setSelectedAccountIDs([])}
            onExportSelected={() => void exportSelectedAccounts()}
            onRefreshSelected={() => void runSelectedBulkRefresh()}
            onEnableSelected={() => void runSelectedBulkSetDisabled(false)}
            onDisableSelected={() => void runSelectedBulkSetDisabled(true)}
            onDeleteSelected={() => void runSelectedBulkDelete()}
          />

          {isSelectionMode ? (
            <div
              data-account-selection-toolbar-sticky="true"
              className="sticky -top-12 z-40 -mx-12 !mt-4 bg-[var(--bg-surface)] px-12 py-1.5"
            >
              <AccountsSelectionActions
                t={t}
                allFilteredSelected={allFilteredSelected}
                selectedAccountCount={selectedAccountIDs.length}
                bulkActionPending={bulkActionPending}
                onToggleSelectAllFiltered={toggleSelectAllFiltered}
                onClearSelection={() => setSelectedAccountIDs([])}
                onExportSelected={() => void exportSelectedAccounts()}
                onRefreshSelected={() => void runSelectedBulkRefresh()}
                onEnableSelected={() => void runSelectedBulkSetDisabled(false)}
                onDisableSelected={() => void runSelectedBulkSetDisabled(true)}
                onDeleteSelected={() => void runSelectedBulkDelete()}
              />
            </div>
          ) : null}

          {accountActionNotice ? (
            <div
              className={`flex items-start justify-between gap-3 border-2 px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide ${
                accountActionNotice.tone === 'error'
                  ? 'border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--color-status-danger)]'
                  : accountActionNotice.tone === 'warning'
                    ? 'border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_10%,transparent)] text-[var(--color-status-warning)]'
                    : 'border-[var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_10%,transparent)] text-[var(--color-status-success)]'
              }`}
            >
              <span>{accountActionNotice.message}</span>
              <button
                onClick={() => setAccountActionNotice(null)}
                className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]"
              >
                {t('common.close')}
              </button>
            </div>
          ) : null}

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

          {showAccountSkeletons ? (
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
            <div className={isSelectionMode ? 'space-y-8 !mt-4' : 'space-y-8'}>
              {groupedAccounts.map((group) => (
                <AccountGroupSection
                  key={group.id}
                  t={t}
                  group={group}
                  accountCardHeights={accountCardHeights}
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
                  onToggleGroupSelection={toggleGroupSelection}
                  onRefreshGroup={refreshGroupQuota}
                  onSetGroupDisabled={setGroupDisabled}
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
          rateLimitRulesAPI={previewMode
            ? undefined
            : {
                list: ListRateLimitRules,
                create: CreateRateLimitRule,
                update: UpdateRateLimitRule,
                delete: DeleteRateLimitRule,
              }}
          verifyState={apiKeyVerifyState}
          modelNames={relayModelNames}
          onClose={closeAccountDetail}
          onRename={selectedAccountIsCodexAPIKey ? renameSelectedApiKey : undefined}
          onSaveConfig={selectedAccountIsCodexAPIKey
            ? (draft) => updateSelectedApiKeyConfig(draft)
            : undefined}
          onVerify={selectedAccountIsCodexAPIKey ? (input) => void verifySelectedApiKey(input) : undefined}
          onTestQuotaCurl={selectedAccountIsCodexAPIKey ? (input) => testSelectedApiKeyQuotaCurl(input) : undefined}
          onTestBillingCurl={selectedAccountIsCodexAPIKey ? (input) => testSelectedApiKeyBillingCurl(input) : undefined}
          onRateLimitRulesChanged={() => void loadAccountRateLimits(usageAccounts)}
          activeScriptEditor={selectedAccount.id === accountDetailIDFromHash ? accountDetailScriptFromHash : ''}
          onOpenScriptEditor={openAccountDetailScriptRoute}
          onCloseScriptEditor={closeAccountDetailScriptRoute}
          onStartReauth={isCodexAuthFile(selectedAccount) ? () => { void startCodexOAuth(selectedAccount); } : undefined}
          onCancelReauth={cancelCodexOAuth}
          isReauthing={oauthPendingAccountID === selectedAccount.id}
        />
      ) : null}

      {openAICompatibleState.detailDraft ? (
        <OpenAICompatibleDetailModal
          t={t}
          draft={openAICompatibleState.detailDraft}
          rateLimitStatus={accountRateLimitByID[openAICompatibleState.detailDraft.accountKey || openAICompatibleState.detailDraft.currentName]}
          rateLimitStrategies={rateLimitStrategies}
          rateLimitRulesAPI={previewMode
            ? undefined
            : {
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
          onSave={openAICompatibleState.saveDetail}
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

      {isAccountImportModalOpen ? (
        <AccountImportModal
          t={t}
          initialPasteContent={initialImportPasteContent}
          onClose={() => {
            setIsAccountImportModalOpen(false);
            setInitialImportPasteContent('');
            setInitialImportItems([]);
          }}
          onSubmit={async (items) => {
            await submitAccountImport(items);
            setInitialImportPasteContent('');
            setInitialImportItems([]);
          }}
          initialItems={initialImportItems}
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
          onDraftChange={(nextDraft) => {
            setLocalCliDraft(nextDraft);
            setLocalCliApplyMessage('');
          }}
          onApply={(draft) => void applyAccountLocalCliDraft(draft)}
        />
      ) : null}

      {deepLinkDraft && deepLinkPreview ? (
        <DeepLinkCodexApplyAdapter
          draft={deepLinkDraft as Extract<AccountCliApplyDraft, { target: 'codex' }>}
          relayKeyItems={relayKeyItems}
          context={{
            source: deepLinkPreview.source || 'DEEP LINK',
            resource: deepLinkPreview.resource === 'codex-setup' ? 'codex-setup' : 'codex-config',
            providerScope: deepLinkPreview.providerScope === 'create-new' ? 'create-new' : 'current-active',
            providerRewriteMode: deepLinkPreview.providerRewriteMode as 'keep-current' | 'patch-current' | 'create-new' | undefined,
            providerCompatibility: deepLinkPreview.providerCompatibility as 'compatible' | 'blocked_builtin_openai' | 'missing_chatgpt_auth' | 'missing_provider_section' | undefined,
            redactedURL: deepLinkPreview.redactedURL,
            accountDraft: deepLinkPreview.accountSummary
              ? {
                  accountType: deepLinkPreview.accountSummary.accountType,
                  title: deepLinkPreview.accountSummary.title,
                  baseUrl: deepLinkPreview.accountSummary.baseUrl,
                  apiKeyPreview: deepLinkPreview.accountSummary.apiKeyPreview,
                }
              : undefined,
          }}
          applying={isApplyingDeepLink}
          resultMessage={deepLinkApplyMessage}
          previewMode={previewMode}
          onClose={() => {
            setDeepLinkRawURL('');
            setDeepLinkPreview(null);
            setDeepLinkDraft(null);
            setDeepLinkApplyMessage('');
          }}
          onDraftChange={(nextDraft) => {
            setDeepLinkDraft(nextDraft);
            setDeepLinkApplyMessage('');
          }}
          onApply={(draft) => void applyDeepLinkDraft(draft)}
          onImportAccountOnly={() => {
            if (deepLinkDraft) void applyDeepLinkDraft(deepLinkDraft, true);
          }}
        />
      ) : null}
        </div>
      </div>
    </>
  );
}

function buildDeepLinkCodexApplyDraft(preview: main.DeepLinkImportPreview): Extract<AccountCliApplyDraft, { target: 'codex' }> {
  const input = preview.localApplyInput || main.RelayLocalApplyInput.createFrom({});
  const accountTitle = preview.accountSummary?.title || preview.source || 'Deep Link Codex Config';
  const warnings = [
    ...(preview.warnings || []).map((message) => ({
      code: 'current-provider-missing' as const,
      severity: 'warning' as const,
      message,
    })),
    ...(preview.blockingWarnings || []).map((message) => ({
      code: 'preserve-chatgpt-auth-missing-local-auth' as const,
      severity: 'blocking' as const,
      message,
    })),
  ];
  const source = {
    id: `deeplink:${preview.resource || 'codex-config'}`,
    accountID: preview.accountSummary?.accountType || 'deeplink:codex-config',
    accountTitle,
    templateID: 'deeplink-codex-config',
    templateName: 'Deep Link Codex Config',
    target: 'codex' as const,
    status: preview.blockingWarnings?.length ? 'blocked-account' as const : 'ready' as const,
    enabled: !(preview.blockingWarnings?.length),
    disabledReason: preview.blockingWarnings?.[0] || '',
    sourceFormat: 'openai_responses' as const,
    sourceFormatBaseUrl: input.baseURL || '',
    relayEndpointID: 'deeplink',
    relayBaseUrl: input.baseURL || '',
    relayKeyIndex: 0,
    relayKeyLabel: 'Deep Link',
    modelCandidates: [input.model || 'gpt-5-codex'],
    warnings,
  };
  return {
    target: 'codex',
    source,
    codex: {
      relayKeyIndex: 0,
      endpointID: 'deeplink',
      apiKey: input.apiKey || '',
      apiKeySet: Boolean(input.apiKeySet),
      authFileContentSet: Boolean(input.authFileContentSet),
      baseUrl: input.baseURL || '',
      baseUrlSet: Boolean(input.baseURLSet),
      model: input.model || 'gpt-5-codex',
      modelSet: Boolean(input.modelSet),
      providerID: input.providerID || preview.effectiveProviderID || 'gettokens',
      providerIDSet: Boolean(input.providerIDSet),
      providerName: input.providerName || preview.effectiveProviderName || input.providerID || 'GetTokens',
      providerNameSet: Boolean(input.providerNameSet),
      reasoningEffort: input.reasoningEffort || 'high',
      reasoningEffortSet: Boolean(input.reasoningEffortSet),
      requiresOpenAIAuth: input.requiresOpenAIAuth ?? true,
      requiresOpenAIAuthSet: Boolean(input.requiresOpenAIAuthSet),
      wireAPI: input.wireAPI || 'responses',
      wireAPISet: Boolean(input.wireAPISet),
      supportsWebsockets: Boolean(input.supportsWebsockets),
      supportsWebsocketsSet: Boolean(input.supportsWebsocketsSet),
      authStrategy: (input.authStrategy || 'replace_auth_with_apikey') as Extract<AccountCliApplyDraft, { target: 'codex' }>['codex']['authStrategy'],
    },
  };
}

function buildDeepLinkAccountOnlyURL(rawURL: string) {
  const parsed = new URL(rawURL);
  parsed.searchParams.set('resource', 'account');
  parsed.searchParams.delete('apply');
  return parsed.toString();
}

function buildDeepLinkAccountImportItems(account?: main.DeepLinkAccountDraft): AccountImportPayloadItem[] {
  if (!account) {
    return [];
  }
  if (account.accountType === 'codex-api-key') {
    return [{
      type: 'codex-api-key',
      label: account.label || account.name || 'Deep Link Codex API Key',
      apiKey: account.apiKey || '',
      baseUrl: account.baseUrl || '',
      prefix: account.prefix || '',
    }];
  }
  if (account.accountType === 'openai-compatible') {
    return [{
      type: 'openai-compatible',
      name: account.name || account.label || 'openai-compatible',
      apiKey: account.apiKey || account.apiKeys?.[0] || '',
      apiKeys: account.apiKeys || [],
      baseUrl: account.baseUrl || '',
      prefix: account.prefix || '',
      proxyUrl: account.proxyUrl || '',
      headers: {},
      models: (account.models || []).map((model) => ({
        name: model.name,
        alias: model.alias,
      })),
    }];
  }
  if (account.accountType === 'auth-file' && account.authFileJSON) {
    const name = account.authFileName || account.name || account.label || 'deep-link-auth.json';
    return [{
      type: 'auth-file',
      name: name.endsWith('.json') ? name : `${name}.json`,
      content: account.authFileJSON,
    }];
  }
  return [];
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

function readAccountDetailIDFromHash() {
  if (typeof window === 'undefined') {
    return '';
  }
  return readFrameHashState(window.location.hash)?.accountDetailID ?? '';
}

function readAccountDetailScriptFromHash(): AccountDetailScriptRoute | '' {
  if (typeof window === 'undefined') {
    return '';
  }
  return readFrameHashState(window.location.hash)?.accountDetailScript ?? '';
}

function isOpenAICompatibleAccount(account: Pick<AccountRecord, 'accountKind' | 'id'>): boolean {
  return account.accountKind === 'openai-compatible';
}

function isCodexAPIKeyAccount(account: Pick<AccountRecord, 'accountKind' | 'credentialSource' | 'id'>): boolean {
  return account.accountKind === 'codex-api-key';
}
