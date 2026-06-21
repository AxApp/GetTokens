import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApplyClaudeCodeAPIKeyConfigToLocal,
  ApplyDeepLinkImport,
  ApplyRelayServiceConfigToLocalV2,
  ConsumePendingDeepLinks,
  CreateOpenAICompatibleProvider,
  CreateRateLimitRule,
  DeleteRateLimitRule,
  DownloadAuthFile,
  FetchOpenAICompatibleProviderModels,
  GetAppRuntimeSettings,
  GetLocalCodexAuthState,
  GetLocalCodexModelProviderStateView,
  GetRelayServiceConfig,
  ListChannelRouteDecisions,
  ListRateLimitRules,
  ListRelaySupportedModels,
  ProbeCodexAccountRouting,
  PreviewDeepLinkImport,
  UpdateOpenAICompatibleProvider,
  UpdateRateLimitRule,
  VerifyOpenAICompatibleProvider,
} from "../../../wailsjs/go/main/App";
import { main } from "../../../wailsjs/go/models";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { useDebug } from "../../context/useDebug";
import { useI18n } from "../../context/I18nContext";
import AccountCardSkeleton from "./components/AccountCardSkeleton";
import AccountImportModal from "./components/AccountImportModal";
import AccountLocalCliApplyConfirm from "./components/AccountLocalCliApplyConfirm";
import DeepLinkAccountImportConfirm from "./components/DeepLinkAccountImportConfirm";
import AccountGroupSection from "./components/AccountGroupSection";
import AccountsHeader from "./components/AccountsHeader";
import AccountsToolbar, {
  AccountsSelectionActions,
} from "./components/AccountsToolbar";
import ApiKeyComposeModal from "./components/ApiKeyComposeModal";
import CodexOAuthModal from "./components/CodexOAuthModal";
import OpenAICompatibleComposeModal from "./components/OpenAICompatibleComposeModal";
import UnifiedComposeModal, {
  type UnifiedComposeFormState,
} from "./components/UnifiedComposeModal";
import UnifiedAccountDetailModal from "./components/UnifiedAccountDetailModal";
import type { OAuthModelProbeState } from "./components/OAuthModelProbeSection";
import { useAccountsPageStateContext } from "./AccountsPageStateContext";
import useOpenAICompatibleState from "./hooks/useOpenAICompatibleState";
import { getAccountsPreviewRelayModelNames } from "./previewData";
import { isCodexAuthFile } from "./model/accountPresentation";
import { readAccountClipboardFallback } from "./model/accountClipboard";
import { resolveAccountDetailSelection } from "./model/accountDetailSelection";
import {
  buildRelayModelProviderSignature,
  normalizeAPIKeyModelNames,
} from "./model/apiKeyModelCatalog";
import useGroupCardHeights from "./hooks/useGroupCardHeights";
import {
  buildAccountDetailFrameHash,
  buildAccountDetailScriptFrameHash,
  clearAccountDetailFrameHash,
  clearAccountDetailScriptFrameHash,
  readFrameHashState,
  type AccountDetailScriptRoute,
} from "../../utils/pagePersistence";
import { hasWailsAppBindings, hasWailsRuntime } from "../../utils/previewMode";
import type { AccountRecord } from "./model/types";
import type { ChannelRouteDecisionSnapshot } from "../channel-routing/model/channelRouting";
import {
  resolveAccountLocalCliMappings,
  type AccountCliApplyDraft,
  type AccountLocalCliMapping,
} from "./model/accountLocalCliMapping";
import {
  ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY,
  DEFAULT_ACCOUNT_LIST_DISPLAY_MODE,
  buildAccountListViewHash,
  parseAccountListDisplayMode,
  type AccountGroupMode,
  type AccountListDisplayMode,
  type AccountSortMode,
} from "./model/accountListLayout";
import {
  defaultAccountsFilterState,
  resolveAccountsFilterStateFromHash,
  resolveAccountsEmptyState,
  summarizeAccountsFilterState,
} from "./model/accountFilters";
import { shouldShowAccountSkeletons } from "./model/accountSnapshot";
import { toggleAccountGroupSelection } from "./model/accountSelection";
import type { OpenAICompatibleProvider } from "./model/openAICompatible";
import type { VendorPreset } from "./model/vendorPresets";
import { emptyApiKeyForm } from "./model/accountConfig";
import {
  normalizeApiKeyConfigModels,
  normalizeCurlVariables,
  normalizeFormatBaseUrls as normalizeDetailFormatBaseUrls,
  type ApiKeyConfigDraft,
} from "./model/accountDetailConfig";
import type { AccountImportPayloadItem } from "./model/accountTransfer";
import { toErrorMessage } from "../../utils/error";

interface AccountsFeatureProps {
  workspace?: string;
}

const accountsFeatureShellClass =
  "h-full w-full overflow-auto bg-[var(--gt-surface-canvas)] p-12";
const accountsFeatureContentClass =
  "mx-auto max-w-6xl space-y-8 pb-32";
const accountsFeatureSelectionToolbarShellClass =
  "sticky -top-12 z-40 -mx-12 !mt-4 bg-[color-mix(in_srgb,var(--gt-surface-canvas)_94%,transparent)] px-12 py-1.5 backdrop-blur";
const accountsFeatureNoticeClass =
  "flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal";
const accountsFeatureNoticeToneClass = {
  error:
    "border-[color-mix(in_srgb,var(--gt-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_7%,var(--gt-surface-canvas))] text-[var(--gt-status-danger)]",
  warning:
    "border-[color-mix(in_srgb,var(--gt-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-warning)_8%,var(--gt-surface-canvas))] text-[var(--gt-status-warning)]",
  success:
    "border-[color-mix(in_srgb,var(--gt-status-success)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_7%,var(--gt-surface-canvas))] text-[var(--gt-status-success)]",
  neutral:
    "border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-primary)]",
} satisfies Record<"error" | "warning" | "success" | "neutral", string>;
const accountsFeatureInlineButtonClass =
  "inline-flex h-7 items-center justify-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)]";
const accountsFeatureEmptyStateClass =
  "grid gap-4 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-16 text-center";
const accountsFeatureEmptyTitleClass =
  "font-mono text-[length:var(--gt-font-size-lg)] font-semibold tracking-normal text-[var(--gt-ink-primary)]";
const accountsFeatureEmptyBodyClass =
  "mx-auto max-w-2xl text-[length:var(--gt-font-size-sm)] font-normal tracking-normal text-[var(--gt-ink-muted)]";
const accountsFeatureEmptyActionButtonClass =
  "inline-flex h-9 items-center justify-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-canvas)]";

export default function AccountsFeature({ workspace }: AccountsFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const processedDeepLinksRef = useRef<Set<string>>(new Set());
  const [initialImportPasteContent, setInitialImportPasteContent] =
    useState("");
  const [detailRouteDecisions, setDetailRouteDecisions] = useState<ChannelRouteDecisionSnapshot[]>([]);
  const [initialImportItems, setInitialImportItems] = useState<
    AccountImportPayloadItem[]
  >([]);
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
    usageRefreshingAccountIDSet,
    accountRateLimitByID,
    rateLimitRefreshingAccountIDSet,
    rateLimitStrategies,
    isSelectionMode,
    selectedAccountIDs,
    isHeaderActionsMenuOpen,
    pendingStatusAccountID,
    accounts,
    filteredAccounts,
    groupedAccounts,
    availablePlanTypes,
    availableRequestStatusCodes,
    selectedAccountIDSet,
    allFilteredSelected,
    loadAccounts,
    refreshAccountUsage,
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
    toggleAccountDisabled,
    bulkActionPending,
    runAccountsBulkDelete,
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
  const accountsEmptyState = useMemo(
    () =>
      resolveAccountsEmptyState(t, {
        accountCount: accounts.length,
        filteredAccountCount: filteredAccounts.length,
        searchTerm,
        filters,
        availablePlanTypes,
        availableRequestStatusCodes,
      }),
    [accounts.length, availablePlanTypes, availableRequestStatusCodes, filteredAccounts.length, filters, searchTerm, t],
  );
  const isAccountListFiltered = useMemo(
    () =>
      searchTerm.trim().length > 0 ||
      summarizeAccountsFilterState(t, filters, availablePlanTypes, availableRequestStatusCodes).length > 0,
    [availablePlanTypes, availableRequestStatusCodes, filters, searchTerm, t],
  );

  const [isUnifiedComposeOpen, setIsUnifiedComposeOpen] = useState(false);
  const [unifiedComposeForm, setUnifiedComposeForm] =
    useState<UnifiedComposeFormState>({
      ...emptyApiKeyForm,
      formatBaseUrls: {},
      billingCurl: "",
      billingEnabled: false,
      modelFetchApiKey: "",
      modelFetchBaseUrl: "",
    });
  const [unifiedComposeError, setUnifiedComposeError] = useState("");
  const [unifiedComposePreset, setUnifiedComposePreset] =
    useState<VendorPreset | null>(null);
  const [displayMode, setDisplayMode] = useState<AccountListDisplayMode>(() =>
    readInitialDisplayMode(),
  );
  const [collapsedAccountGroupIDs, setCollapsedAccountGroupIDs] = useState<Set<string>>(
    () => new Set(),
  );
  const [relayKeyItems, setRelayKeyItems] = useState<
    main.RelayServiceAPIKeyItem[]
  >([]);
  const [relayEndpoints, setRelayEndpoints] = useState<
    main.RelayServiceEndpoint[]
  >([]);
  const [localCodexAuthState, setLocalCodexAuthState] =
    useState<main.LocalCodexAuthState | null>(null);
  const [localCodexProviderState, setLocalCodexProviderState] =
    useState<main.LocalCodexModelProviderStateView | null>(null);
  const [syncCodexModelCatalog, setSyncCodexModelCatalog] = useState(false);
  const [localCliDraft, setLocalCliDraft] =
    useState<AccountCliApplyDraft | null>(null);
  const [localCliApplyMessage, setLocalCliApplyMessage] = useState("");
  const [isApplyingLocalCli, setIsApplyingLocalCli] = useState(false);
  const [deepLinkRawURL, setDeepLinkRawURL] = useState("");
  const [deepLinkPreview, setDeepLinkPreview] =
    useState<main.DeepLinkImportPreview | null>(null);
  const [deepLinkResult, setDeepLinkResult] =
    useState<main.DeepLinkApplyResult | null>(null);
  const [deepLinkApplyMessage, setDeepLinkApplyMessage] = useState("");
  const [isApplyingDeepLink, setIsApplyingDeepLink] = useState(false);
  const [accountDetailIDFromHash, setAccountDetailIDFromHash] = useState(() =>
    readAccountDetailIDFromHash(),
  );
  const [accountDetailScriptFromHash, setAccountDetailScriptFromHash] =
    useState<AccountDetailScriptRoute | "">(() =>
      readAccountDetailScriptFromHash(),
    );
  const [runtimeRefreshing, setRuntimeRefreshing] = useState(false);
  const refreshAccountsRuntime = useCallback(async () => {
    if (runtimeRefreshing) {
      return;
    }
    setRuntimeRefreshing(true);
    try {
      await Promise.allSettled([
        ...accounts.map((account) => refreshCodexQuota(account)),
        refreshAccountUsage(accounts),
        refreshAccountRateLimits(accounts),
      ]);
    } finally {
      setRuntimeRefreshing(false);
    }
  }, [accounts, refreshAccountRateLimits, refreshAccountUsage, refreshCodexQuota, runtimeRefreshing]);

  const [relayModelNames, setRelayModelNames] = useState<string[]>([]);
  const [accountModelNamesByID, setAccountModelNamesByID] = useState<Record<string, string[]>>({});
  const [oauthModelProbeStateByID, setOAuthModelProbeStateByID] = useState<Record<string, OAuthModelProbeState>>({});
  const loadRelayModelNames = useCallback(
    async (isCancelled: () => boolean = () => false) => {
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
    },
    [ready],
  );

  const openAICompatibleState = useOpenAICompatibleState({
    ready,
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
            value: "sk-gettokens-preview-account-template",
          }),
        ]);
        setRelayEndpoints([
          main.RelayServiceEndpoint.createFrom({
            id: "localhost",
            kind: "localhost",
            host: "127.0.0.1",
            baseUrl: "http://127.0.0.1:8317/v1",
          }),
        ]);
        setLocalCodexAuthState(
          main.LocalCodexAuthState.createFrom({
            hasAuthFile: true,
            authMode: "chatgpt",
            hasTokens: true,
            canPreserveChatGPTAuth: true,
          }),
        );
        setLocalCodexProviderState(
          main.LocalCodexModelProviderStateView.createFrom({
            currentModel: "gpt-5.4",
            hasExplicitCurrentModel: true,
            currentProviderID: "team-codex-relay",
            currentProviderName: "Team Codex Relay",
            currentProviderIsBuiltin: false,
            currentProviderExists: true,
            hasExplicitCurrentProvider: true,
            providers: [
              {
                providerID: "team-codex-relay",
                providerName: "Team Codex Relay",
              },
            ],
          }),
        );
        setSyncCodexModelCatalog(false);
        return;
      }

      if (!ready) {
        setRelayKeyItems([]);
        setRelayEndpoints([]);
        setSyncCodexModelCatalog(false);
        return;
      }

      try {
        const [config, authState, providerState, runtimeSettings] = await Promise.all([
          trackRequest("GetRelayServiceConfig", { args: [] }, () =>
            GetRelayServiceConfig(),
          ),
          trackRequest("GetLocalCodexAuthState", { args: [] }, () =>
            GetLocalCodexAuthState(),
          ),
          trackRequest(
            "GetLocalCodexModelProviderStateView",
            { args: [] },
            () => GetLocalCodexModelProviderStateView(),
          ),
          trackRequest("GetAppRuntimeSettings", { args: [] }, () =>
            GetAppRuntimeSettings(),
          ),
        ]);
        if (cancelled) {
          return;
        }
        setRelayKeyItems(
          config.apiKeyItems ||
            (config.apiKeys || []).map((value) =>
              main.RelayServiceAPIKeyItem.createFrom({ value }),
            ),
        );
        setRelayEndpoints(config.endpoints || []);
        setLocalCodexAuthState(authState);
        setLocalCodexProviderState(providerState);
        setSyncCodexModelCatalog(Boolean(runtimeSettings?.codexModelCatalogSyncEnabled));
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRelayKeyItems([]);
          setRelayEndpoints([]);
          setLocalCodexAuthState(null);
          setLocalCodexProviderState(null);
          setSyncCodexModelCatalog(false);
        }
      }
    }

    void loadLocalCliContext();

    return () => {
      cancelled = true;
    };
  }, [ready, trackRequest]);
  useEffect(() => {
    if (selectedAccount?.credentialSource !== "api-key") {
      return;
    }
    let cancelled = false;
    void loadRelayModelNames(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [
    loadRelayModelNames,
    selectedAccount?.credentialSource,
    selectedAccount?.id,
  ]);

  const accountCardHeights = useGroupCardHeights(
    pageRef,
    groupedAccounts,
    loading,
    selectedAccountIDs,
    displayMode,
  );
  const toggleAccountGroupCollapsed = useCallback((groupID: string) => {
    setCollapsedAccountGroupIDs((current) => {
      const next = new Set(current);
      if (next.has(groupID)) {
        next.delete(groupID);
      } else {
        next.add(groupID);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setCollapsedAccountGroupIDs((current) => {
      if (current.size === 0) {
        return current;
      }
      const visibleGroupIDs = new Set(groupedAccounts.map((group) => group.id));
      let changed = false;
      const next = new Set<string>();
      current.forEach((groupID) => {
        if (visibleGroupIDs.has(groupID)) {
          next.add(groupID);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [groupedAccounts]);

  const isAggregateWorkspace = true;
  const usageAccounts = useMemo(() => accounts, [accounts]);
  const previewMode = !hasWailsAppBindings();
  const selectedRelayEndpoint = useMemo(
    () =>
      relayEndpoints[0] ||
      main.RelayServiceEndpoint.createFrom({
        id: "localhost",
        kind: "localhost",
        host: "127.0.0.1",
        baseUrl: `http://127.0.0.1:${sidecarStatus.port || 8317}/v1`,
      }),
    [relayEndpoints, sidecarStatus.port],
  );

  const openDeepLinkImport = useCallback(
    async (rawURL: string) => {
      const normalizedURL = rawURL.trim();
      if (!normalizedURL || processedDeepLinksRef.current.has(normalizedURL)) {
        return;
      }
      processedDeepLinksRef.current.add(normalizedURL);
      setDeepLinkApplyMessage("正在解析 deep link...");
      try {
        const preview = await trackRequest(
          "PreviewDeepLinkImport",
          {
            redactedURL: normalizedURL.replace(
              /(payload=)[^&]+/i,
              "$1[REDACTED]",
            ),
          },
          () => PreviewDeepLinkImport(normalizedURL),
        );
        setDeepLinkRawURL(normalizedURL);
        setDeepLinkPreview(preview);
        setDeepLinkResult(null);
        setDeepLinkApplyMessage("");
      } catch (error) {
        console.error(error);
        setAccountActionNotice({
          tone: "error",
          message: `Deep link 解析失败：${toErrorMessage(error)}`,
        });
        setDeepLinkApplyMessage("");
      }
    },
    [setAccountActionNotice, trackRequest],
  );

  useEffect(() => {
    if (!hasWailsRuntime() || !hasWailsAppBindings()) {
      return;
    }
    const offDeepLink = EventsOn("deeplink:import", (rawURL: string) => {
      void openDeepLinkImport(String(rawURL || ""));
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
    if (typeof window === "undefined") {
      return;
    }
    function syncDetailIDFromHash() {
      const hashState = readFrameHashState(window.location.hash);
      setAccountDetailIDFromHash(hashState?.accountDetailID ?? "");
      setAccountDetailScriptFromHash(hashState?.accountDetailScript ?? "");
      if (hashState?.accountFilter === "risk") {
        setFilters((current) => resolveAccountsFilterStateFromHash(window.location.hash, current));
      }
    }
    syncDetailIDFromHash();
    window.addEventListener("hashchange", syncDetailIDFromHash);
    return () => window.removeEventListener("hashchange", syncDetailIDFromHash);
  }, [setFilters]);

  useEffect(() => {
    if (!accountDetailIDFromHash) {
      return;
    }
    const nextSelectedAccount = resolveAccountDetailSelection(
      accounts,
      accountDetailIDFromHash,
      selectedAccount,
      accountsLoaded,
    );
    if (nextSelectedAccount !== selectedAccount) {
      setSelectedAccount(nextSelectedAccount);
    }
  }, [
    accountDetailIDFromHash,
    accountsLoaded,
    accounts,
    selectedAccount,
    setSelectedAccount,
  ]);

  const updateDisplayMode = useCallback((nextMode: AccountListDisplayMode) => {
    setDisplayMode(nextMode);
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY,
        nextMode,
      );
    } catch {
      // The current hash still reflects the active session if storage is unavailable.
    }
    window.location.hash = buildAccountListViewHash(window.location.hash, {
      displayMode: nextMode,
    });
  }, []);

  const updateGroupMode = useCallback(
    (nextMode: AccountGroupMode) => {
      setGroupMode(nextMode);
      if (typeof window === "undefined") {
        return;
      }
      window.location.hash = buildAccountListViewHash(window.location.hash, {
        groupMode: nextMode,
      });
    },
    [setGroupMode],
  );

  const updateSortMode = useCallback(
    (nextMode: AccountSortMode) => {
      setSortMode(nextMode);
      if (typeof window === "undefined") {
        return;
      }
      window.location.hash = buildAccountListViewHash(window.location.hash, {
        sortMode: nextMode,
      });
    },
    [setSortMode],
  );

  const toggleGroupSelection = useCallback(
    (groupAccounts: AccountRecord[]) => {
      if (!isSelectionMode || groupAccounts.length === 0) {
        return;
      }
      setSelectedAccountIDs((prev) =>
        toggleAccountGroupSelection(prev, groupAccounts),
      );
    },
    [isSelectionMode, setSelectedAccountIDs],
  );

  const refreshGroupQuota = useCallback(
    (groupAccounts: AccountRecord[]) => {
      groupAccounts.forEach((account) => {
        void refreshCodexQuota(account);
      });
      void refreshAccountUsage(groupAccounts);
      void refreshAccountRateLimits(groupAccounts);
    },
    [refreshAccountRateLimits, refreshAccountUsage, refreshCodexQuota],
  );

  const setGroupDisabled = useCallback(
    (groupAccounts: AccountRecord[], nextDisabled: boolean) => {
      void runAccountsBulkSetDisabled(groupAccounts, nextDisabled);
    },
    [runAccountsBulkSetDisabled],
  );

  const deleteGroup = useCallback(
    (groupAccounts: AccountRecord[]) => {
      const label = isAccountListFiltered
        ? t('accounts.delete_group_visible')
        : t('accounts.delete_group');
      void runAccountsBulkDelete(groupAccounts, label);
    },
    [isAccountListFiltered, runAccountsBulkDelete, t],
  );

  const markAccountDetailInHash = useCallback((detailID: string) => {
    if (typeof window === "undefined") {
      return;
    }
    setAccountDetailIDFromHash(detailID);
    setAccountDetailScriptFromHash("");
    const nextHash = buildAccountDetailFrameHash(
      window.location.hash,
      detailID,
    );
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const clearAccountDetailInHash = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    setAccountDetailIDFromHash("");
    setAccountDetailScriptFromHash("");
    const nextHash = clearAccountDetailFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const openAccountDetailScriptRoute = useCallback(
    (script: AccountDetailScriptRoute) => {
      if (typeof window === "undefined" || !selectedAccount) {
        return;
      }
      setAccountDetailIDFromHash(selectedAccount.id);
      setAccountDetailScriptFromHash(script);
      const nextHash = buildAccountDetailScriptFrameHash(
        window.location.hash,
        selectedAccount.id,
        script,
      );
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    },
    [selectedAccount],
  );

  const closeAccountDetailScriptRoute = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    setAccountDetailScriptFromHash("");
    const nextHash = clearAccountDetailScriptFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const openAccountDetail = useCallback(
    (account: AccountRecord) => {
      setSelectedAccount(account);
      markAccountDetailInHash(account.id);
    },
    [markAccountDetailInHash, setSelectedAccount],
  );

  const closeAccountDetail = useCallback(() => {
    setSelectedAccount(null);
    clearAccountDetailInHash();
  }, [clearAccountDetailInHash, setSelectedAccount]);

  const openUnifiedCompose = useCallback(() => {
    setUnifiedComposeError("");
    setUnifiedComposePreset(null);
    setUnifiedComposeForm({
      ...emptyApiKeyForm,
      formatBaseUrls: {},
      billingCurl: "",
      billingEnabled: false,
      modelFetchApiKey: "",
      modelFetchBaseUrl: "",
    });
    setIsUnifiedComposeOpen(true);
  }, []);

  const handlePresetApply = useCallback((preset: VendorPreset) => {
    const formatBaseUrls: Record<string, string> = {};
    for (const fmt of preset.supportedFormats) {
      const presetUrl = preset.formatBaseUrls?.[fmt] ?? preset.baseUrl;
      if (presetUrl) formatBaseUrls[fmt] = presetUrl;
    }
    const quotaCurl =
      preset.quotaCurlTemplate ??
      `curl -sS "${preset.baseUrl}/usage" -H "Authorization: Bearer {{apiKey}}"`;
    setUnifiedComposePreset(preset);
    setUnifiedComposeForm((prev) => ({
      ...prev,
      label: preset.name,
      baseUrl: preset.baseUrl,
      formatBaseUrls,
      quotaCurl,
      quotaEnabled: true,
      billingCurl: preset.billingCurlTemplate ?? prev.billingCurl,
      billingEnabled: Boolean(preset.billingCurlTemplate),
      modelFetchApiKey: "",
      modelFetchBaseUrl: preset.modelFetchBaseUrl ?? "",
    }));
    setUnifiedComposeError("");
  }, []);

  const handleUnifiedComposeSubmit = useCallback(async () => {
    const apiKey = unifiedComposeForm.apiKey.trim();
    if (!apiKey) {
      setUnifiedComposeError("API Key is required");
      return;
    }
    const baseUrl = unifiedComposeForm.baseUrl.trim();
    if (!baseUrl) {
      setUnifiedComposeError("Base URL is required");
      return;
    }

    const providerName =
      unifiedComposeForm.label.trim() ||
      resolveProviderNameFromBaseUrl(baseUrl);
    if (!providerName) {
      setUnifiedComposeError("Provider name is required");
      return;
    }
    const formatBaseUrls = normalizeUnifiedComposeFormatBaseUrls(
      unifiedComposeForm.formatBaseUrls,
    );
    const models = buildUnifiedComposeProviderModels(unifiedComposePreset);

    try {
      await trackRequest(
        "CreateOpenAICompatibleProvider",
        { name: providerName, baseUrl, source: "unified-compose" },
        () =>
          CreateOpenAICompatibleProvider(
            main.CreateOpenAICompatibleProviderInput.createFrom({
              name: providerName,
              apiKey,
              baseUrl,
              prefix: "",
              formatBaseUrls:
                Object.keys(formatBaseUrls).length > 0
                  ? formatBaseUrls
                  : undefined,
              quotaCurl: unifiedComposeForm.quotaCurl,
              quotaEnabled: unifiedComposeForm.quotaEnabled,
              billingCurl: unifiedComposeForm.billingCurl,
              billingEnabled: unifiedComposeForm.billingEnabled,
              curlVariables: unifiedComposeForm.curlVariables,
              models: models.length > 0 ? models : undefined,
              platformCookie: (unifiedComposeForm.platformCookie ?? "").trim(),
              modelFetchApiKey:
                unifiedComposeForm.modelFetchApiKey?.trim() || "",
              modelFetchBaseUrl:
                unifiedComposeForm.modelFetchBaseUrl?.trim() || "",
            }),
          ),
      );
      setIsUnifiedComposeOpen(false);
      setUnifiedComposePreset(null);
      setUnifiedComposeForm({
        ...emptyApiKeyForm,
        formatBaseUrls: {},
        billingCurl: "",
        billingEnabled: false,
        modelFetchApiKey: "",
        modelFetchBaseUrl: "",
      });
      setUnifiedComposeError("");
      await loadAccounts();
    } catch (err) {
      setUnifiedComposeError(err instanceof Error ? err.message : String(err));
    }
  }, [unifiedComposeForm, unifiedComposePreset, trackRequest, loadAccounts]);

  const openOpenAICompatibleDetail = useCallback(
    (provider: OpenAICompatibleProvider) => {
      const providerAccount = findOpenAICompatibleAccountForProvider(
        accounts,
        provider,
      );
      if (!providerAccount) {
        return;
      }
      setSelectedAccount(providerAccount);
      markAccountDetailInHash(providerAccount.id);
    },
    [accounts, markAccountDetailInHash, setSelectedAccount],
  );

  const selectedAccountIsCodexAPIKey = selectedAccount
    ? isCodexAPIKeyAccount(selectedAccount)
    : false;
  const selectedAccountCanSaveApiConfig = selectedAccount?.credentialSource === "api-key";
  const selectedAccountCanProbeOAuthModel =
    selectedAccount?.credentialSource === "auth-file" &&
    selectedAccount.id.startsWith("acct_");

  useEffect(() => {
    if (!selectedAccount || !ready || previewMode || !hasWailsAppBindings()) {
      setDetailRouteDecisions([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [codexDecisions, claudeDecisions] = await Promise.all([
          trackRequest('ListChannelRouteDecisions', { channel: 'codex', limit: 8, source: 'account-detail' }, () =>
            ListChannelRouteDecisions(main.ChannelRouteDecisionsInput.createFrom({ channel: 'codex', limit: 8 })),
          ),
          trackRequest('ListChannelRouteDecisions', { channel: 'claude', limit: 8, source: 'account-detail' }, () =>
            ListChannelRouteDecisions(main.ChannelRouteDecisionsInput.createFrom({ channel: 'claude', limit: 8 })),
          ),
        ]);
        if (cancelled) {
          return;
        }
        setDetailRouteDecisions([...(codexDecisions || []), ...(claudeDecisions || [])] as ChannelRouteDecisionSnapshot[]);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setDetailRouteDecisions([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewMode, ready, selectedAccount, trackRequest]);

  const probeSelectedOAuthModel = useCallback(
    async (model: string) => {
      if (!selectedAccount || !selectedAccountCanProbeOAuthModel) {
        return;
      }
      const nextModel = model.trim();
      const accountID = selectedAccount.id;
      if (!nextModel) {
        setOAuthModelProbeStateByID((prev) => ({
          ...prev,
          [accountID]: {
            model: '',
            status: 'error',
            message: '请选择要测试的模型',
            lastTestedAt: prev[accountID]?.lastTestedAt ?? null,
          },
        }));
        return;
      }

      setOAuthModelProbeStateByID((prev) => ({
        ...prev,
        [accountID]: {
          model: nextModel,
          status: 'loading',
          message: '',
          lastTestedAt: prev[accountID]?.lastTestedAt ?? null,
        },
      }));

      if (previewMode) {
        setOAuthModelProbeStateByID((prev) => ({
          ...prev,
          [accountID]: {
            model: nextModel,
            status: 'success',
            message: `PREVIEW ONLY / ${selectedAccount.displayName} 可使用 ${nextModel}`,
            lastTestedAt: Date.now(),
          },
        }));
        return;
      }

      try {
        const result = await trackRequest(
          "ProbeCodexAccountRouting",
          { model: nextModel, accountID, source: "accounts-detail-oauth" },
          () =>
            ProbeCodexAccountRouting(
              main.ProbeCodexAccountRoutingInput.createFrom({
                model: nextModel,
                attempts: 1,
                allowAccountIDs: [selectedAccount.id],
                orderAccountIDs: [selectedAccount.id],
                allowFallback: false,
              }),
            ),
        );
        const attempt = result?.attempts?.[0];
        const matched = Boolean(attempt?.success && attempt.accountID === accountID);
        setOAuthModelProbeStateByID((prev) => ({
          ...prev,
          [accountID]: {
            model: nextModel,
            status: matched ? 'success' : 'error',
            message: matched
              ? attempt?.message || `模型 ${nextModel} 测试通过，命中当前账号。`
              : attempt?.accountID
                ? `测试未命中当前账号：${attempt.accountID}`
                : attempt?.message || '模型测试失败，未确认当前账号命中。',
            lastTestedAt: Date.now(),
          },
        }));
      } catch (error) {
        setOAuthModelProbeStateByID((prev) => ({
          ...prev,
          [accountID]: {
            model: nextModel,
            status: 'error',
            message: toErrorMessage(error),
            lastTestedAt: Date.now(),
          },
        }));
      }
    },
    [previewMode, selectedAccount, selectedAccountCanProbeOAuthModel, trackRequest],
  );

  const saveSelectedApiLikeConfig = useCallback(
    async (draft: ApiKeyConfigDraft) => {
      if (!selectedAccount || selectedAccount.credentialSource !== "api-key") {
        return;
      }
      if (isCodexAPIKeyAccount(selectedAccount)) {
        await updateSelectedApiKeyConfig(draft);
        return;
      }
      if (!isOpenAICompatibleAccount(selectedAccount)) {
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
      const nextAPIKeys = selectedAccount.apiKeys && selectedAccount.apiKeys.length > 0
        ? [nextAPIKey, ...selectedAccount.apiKeys.slice(1)].filter(Boolean)
        : nextAPIKey
          ? [nextAPIKey]
          : [];

      if (!nextAPIKey) {
        setDeleteError(`SAVE ERROR: ${t("accounts.api_key_required")}`);
        return;
      }

      if (!hasWailsAppBindings()) {
        patchAccountLocally(selectedAccount.id, {
          displayName: nextLabel || selectedAccount.displayName,
          provider: nextLabel || selectedAccount.provider,
          apiKey: nextAPIKey,
          apiKeys: nextAPIKeys,
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
        await trackRequest(
          "UpdateOpenAICompatibleProvider",
          { id: selectedAccount.id, baseUrl: nextBaseURL, models: nextModels },
          () =>
            UpdateOpenAICompatibleProvider(
              main.UpdateOpenAICompatibleProviderInput.createFrom({
                currentName: selectedAccount.id.startsWith("acct_") ? selectedAccount.id : selectedAccount.provider,
                name: nextLabel || selectedAccount.provider,
                baseUrl: nextBaseURL,
                formatBaseUrls: nextFormatBaseURLs,
                prefix: nextPrefix,
                proxyUrl: nextProxyURL,
                apiKey: nextAPIKey,
                apiKeys: nextAPIKeys,
                quotaCurl: nextQuotaCurl,
                quotaEnabled: Boolean(draft.quotaEnabled && nextQuotaCurl),
                billingCurl: nextBillingCurl,
                billingEnabled: Boolean(draft.billingEnabled && nextBillingCurl),
                platformCookie: nextPlatformCookie,
                curlVariables: nextCurlVariables,
                headers: selectedAccount.headers || {},
                models: nextModels,
                modelFetchApiKey: selectedAccount.modelFetchApiKey || "",
                modelFetchBaseUrl: selectedAccount.modelFetchBaseUrl || "",
              }),
            ),
        );
        patchAccountLocally(selectedAccount.id, {
          displayName: nextLabel || selectedAccount.displayName,
          provider: nextLabel || selectedAccount.provider,
          apiKey: nextAPIKey,
          apiKeys: nextAPIKeys,
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
        await loadAccounts({ refreshSupplementalData: false });
      } catch (error) {
        console.error(error);
        setDeleteError(`SAVE ERROR: ${toErrorMessage(error)}`);
        throw error;
      }
    },
    [loadAccounts, patchAccountLocally, selectedAccount, setDeleteError, t, trackRequest, updateSelectedApiKeyConfig],
  );

  const resolveLocalCliMappingsForAccount = useCallback(
    (account: AccountRecord) =>
      resolveAccountLocalCliMappings({
        account,
        relayKeyItems,
        relayEndpoint: selectedRelayEndpoint,
        selectedModel: relayModelNames[0] || "GT",
        selectedReasoningEffort: "medium",
        supportsWebsockets: false,
        modelCatalogProjectionMode: syncCodexModelCatalog ? "gettokens" : "off",
        sidecarReady: previewMode || sidecarStatus.code === "ready",
        previewMode,
        currentCodexProviderState: localCodexProviderState,
        localCodexAuthState,
        accountBlockedReason: accountRateLimitByID[account.id]?.blocked
          ? accountRateLimitByID[account.id]?.blockReason ||
            "账号当前被路由保护阻塞"
          : "",
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
      syncCodexModelCatalog,
    ],
  );

  const resolveLocalCliActionsForAccount = useCallback(
    (account: AccountRecord) =>
      resolveLocalCliMappingsForAccount(account).map((mapping) => ({
        id: mapping.id,
        label:
          mapping.target === "codex" ? "应用到 Codex" : "应用到 Claude Code",
        detail: `${mapping.templateName} / ${mapping.sourceFormat.toUpperCase()}`,
        disabled: !mapping.enabled,
        disabledReason: mapping.disabledReason,
        onSelect: () => {
          if (!mapping.enabled) {
            return;
          }
          setLocalCliApplyMessage("");
          setLocalCliDraft(mapping.draft);
        },
      })),
    [resolveLocalCliMappingsForAccount],
  );

  async function applyAccountLocalCliDraft(draft: AccountCliApplyDraft) {
    if (previewMode) {
      setLocalCliApplyMessage(
        `PREVIEW ONLY / ${draft.target === "codex" ? "Codex" : "Claude Code"} 草稿已确认，未调用 Wails 写入。`,
      );
      return;
    }

    const blockingWarning = draft.source.warnings.find(
      (warning) => warning.severity === "blocking",
    );
    if (blockingWarning) {
      setLocalCliApplyMessage(blockingWarning.message);
      return;
    }
    const relayKey = String(
      relayKeyItems[draft.source.relayKeyIndex]?.value || "",
    ).trim();
    const codexUsesOAuthAuthFile =
      draft.target === "codex" &&
      draft.codex.authStrategy === "replace_auth_with_oauth";
    const codexUsesAccountAPIKey =
      draft.target === "codex" &&
      draft.codex.authStrategy === "replace_auth_with_apikey";
    const codexAPIKey = codexUsesAccountAPIKey
      ? String(draft.codex.apiKey || "").trim()
      : relayKey;
    const claudeAPIKey =
      draft.target === "claude"
        ? String(draft.claude.apiKey || relayKey).trim()
        : "";
    if (draft.target === "codex" && codexUsesAccountAPIKey && !codexAPIKey) {
      setLocalCliApplyMessage("当前账号缺少 API Key，不能写入 Codex。");
      return;
    }
    if (draft.target !== "codex" && !claudeAPIKey) {
      setLocalCliApplyMessage(
        "缺少 GetTokens relay key，不能写入本机 CLI 配置。",
      );
      return;
    }
    if (draft.target === "codex" && !codexAPIKey && !codexUsesOAuthAuthFile) {
      setLocalCliApplyMessage(
        "缺少 GetTokens relay key，不能写入本机 CLI 配置。",
      );
      return;
    }

    setIsApplyingLocalCli(true);
    try {
      if (draft.target === "codex") {
        let authFileContentBase64 = "";
        if (draft.codex.authStrategy === "replace_auth_with_oauth") {
          const authFileName = String(draft.codex.authFileName || "").trim();
          if (!authFileName) {
            setLocalCliApplyMessage(
              "OAuth 账号缺少 auth-file 名称，不能写入 Codex OAuth 配置。",
            );
            return;
          }
          const authFile = await trackRequest(
            "DownloadAuthFile",
            { name: authFileName, target: "codex-oauth-local-apply" },
            () => DownloadAuthFile(authFileName),
          );
          authFileContentBase64 = authFile.contentBase64 || "";
        }
        const result = await trackRequest(
          "ApplyRelayServiceConfigToLocalV2",
          {
            apiKey: codexAPIKey,
            authFileName: draft.codex.authFileName,
            baseURL: draft.codex.baseUrl,
            model: draft.codex.model,
            reasoningEffort: draft.codex.reasoningEffort,
            providerID: draft.codex.providerID,
            providerName: draft.codex.providerName,
            authStrategy: draft.codex.authStrategy,
            modelCatalogProjectionMode: draft.codex.modelCatalogProjectionMode,
            skipRelayKeyMetadata: codexUsesAccountAPIKey,
          },
          () =>
            ApplyRelayServiceConfigToLocalV2(
              main.RelayLocalApplyInput.createFrom({
                apiKey: codexAPIKey,
                apiKeySet: draft.codex.apiKeySet ?? true,
                authFileContentBase64,
                authFileContentSet:
                  draft.codex.authStrategy === "replace_auth_with_oauth" &&
                  Boolean(authFileContentBase64),
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
                requiresOpenAIAuthSet:
                  draft.codex.requiresOpenAIAuthSet ?? true,
                wireAPI: draft.codex.wireAPI || "responses",
                wireAPISet: draft.codex.wireAPISet ?? true,
                supportsWebsockets: draft.codex.supportsWebsockets,
                supportsWebsocketsSet:
                  draft.codex.supportsWebsocketsSet ?? true,
                authStrategy: draft.codex.authStrategy,
                modelCatalogProjectionMode:
                  draft.codex.modelCatalogProjectionMode || "off",
                skipRelayKeyMetadata: codexUsesAccountAPIKey,
              }),
            ),
        );
        setSyncCodexModelCatalog(
          draft.codex.modelCatalogProjectionMode === "gettokens",
        );
        setLocalCliApplyMessage(
          `已写入 Codex：${result.configPath || result.codexHomePath}`,
        );
        try {
          const providerState = await trackRequest(
            "GetLocalCodexModelProviderStateView",
            { args: [] },
            () => GetLocalCodexModelProviderStateView(),
          );
          setLocalCodexProviderState(providerState);
        } catch (refreshError) {
          console.error(refreshError);
        }
        return;
      }

      const result = await trackRequest(
        "ApplyClaudeCodeAPIKeyConfigToLocal",
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
            claudeCodeAttributionHeader:
              draft.claude.claudeCodeAttributionHeader,
          },
        },
        () =>
          ApplyClaudeCodeAPIKeyConfigToLocal(
            claudeAPIKey,
            draft.claude.baseUrl,
            {
              authField: draft.claude.authField,
              model: draft.claude.model,
              defaultHaikuModel: draft.claude.defaultHaikuModel,
              defaultSonnetModel: draft.claude.defaultSonnetModel,
              defaultOpusModel: draft.claude.defaultOpusModel,
              smallFastModel: draft.claude.smallFastModel,
              maxOutputTokens: draft.claude.maxOutputTokens,
              apiTimeoutMs: draft.claude.apiTimeoutMs,
              disableNonEssentialTraffic:
                draft.claude.disableNonEssentialTraffic,
              claudeCodeAttributionHeader:
                draft.claude.claudeCodeAttributionHeader,
            },
          ),
      );
      const warningSuffix = result.warnings?.length
        ? ` / ${result.warnings.join(" / ")}`
        : "";
      setLocalCliApplyMessage(
        `已写入 Claude Code：${result.settingsPath}${warningSuffix}`,
      );
    } catch (error) {
      console.error(error);
      setLocalCliApplyMessage(`写入失败：${toErrorMessage(error)}`);
    } finally {
      setIsApplyingLocalCli(false);
    }
  }

  async function applyDeepLinkImport() {
    if (previewMode) {
      setDeepLinkApplyMessage(
        "PREVIEW ONLY / deep link 账号导入已确认，未调用 Wails 写入。",
      );
      return;
    }
    if (!deepLinkRawURL) {
      setDeepLinkApplyMessage("缺少 deep link 原始 URL，不能应用。");
      return;
    }
    setIsApplyingDeepLink(true);
    try {
      const result = await trackRequest(
        "ApplyDeepLinkImport",
        { redactedURL: deepLinkPreview?.redactedURL || "[REDACTED]" },
        () => ApplyDeepLinkImport(deepLinkRawURL),
      );
      setDeepLinkResult(result);
      if (result.status === "partial") {
        setDeepLinkApplyMessage(
          `部分导入：成功 ${result.created || 0} 个，失败 ${result.failed || 0} 个。`,
        );
      } else if (result.status === "failed") {
        setDeepLinkApplyMessage(
          `导入失败：${result.failed || 0} 个账号未写入。`,
        );
      } else {
        setDeepLinkApplyMessage(`已导入 ${result.created || 0} 个账号。`);
        await loadAccounts();
      }
    } catch (error) {
      console.error(error);
      setDeepLinkApplyMessage(`导入失败：${toErrorMessage(error)}`);
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
        className={accountsFeatureShellClass}
        data-collaboration-id="PAGE_ACCOUNTS"
        data-accounts-feature-shell="quiet"
      >
        <div className={accountsFeatureContentClass}>
          <AccountsHeader
            t={t}
            accountCount={accounts.length}
            ready={ready}
            loading={loading}
            runtimeRefreshing={runtimeRefreshing}
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
            onRefreshAccounts={() => void loadAccounts({ refreshSupplementalData: false })}
            onRefreshRuntime={() => void refreshAccountsRuntime()}
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
            availableRequestStatusCodes={availableRequestStatusCodes}
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
              data-account-selection-toolbar-sticky="quiet"
              className={accountsFeatureSelectionToolbarShellClass}
            >
              <AccountsSelectionActions
                t={t}
                allFilteredSelected={allFilteredSelected}
                selectedAccountCount={selectedAccountIDs.length}
                bulkActionPending={bulkActionPending}
                onCancelSelection={toggleSelectionMode}
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
              data-account-action-notice={accountActionNotice.tone}
              className={`${accountsFeatureNoticeClass} ${accountsFeatureNoticeToneClass[accountActionNotice.tone]}`}
            >
              <span>{accountActionNotice.message}</span>
              <button
                type="button"
                onClick={() => setAccountActionNotice(null)}
                className={accountsFeatureInlineButtonClass}
              >
                {t("common.close")}
              </button>
            </div>
          ) : null}

          {deleteError ? (
            <div
              data-account-delete-error="quiet"
              className={`${accountsFeatureNoticeClass} ${accountsFeatureNoticeToneClass.error}`}
            >
              {deleteError}
            </div>
          ) : null}
          {oauthBanner ? (
            <div
              data-account-oauth-banner={oauthBanner.tone}
              className={`${accountsFeatureNoticeClass} ${accountsFeatureNoticeToneClass[oauthBanner.tone === "error" || oauthBanner.tone === "success" ? oauthBanner.tone : "neutral"]}`}
            >
              <span>{oauthBanner.message}</span>
              {!isOAuthPending ? (
                <button
                  type="button"
                  onClick={() => setOAuthBanner(null)}
                  className={accountsFeatureInlineButtonClass}
                >
                  {t("common.close")}
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
          ) : accountsEmptyState ? (
            <div data-accounts-empty-state="quiet" className={accountsFeatureEmptyStateClass}>
              <div className={accountsFeatureEmptyTitleClass}>
                {accountsEmptyState.title}
              </div>
              <div className={accountsFeatureEmptyBodyClass}>
                {accountsEmptyState.body}
              </div>
              {accountsEmptyState.kind === 'filtered' ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {accountsEmptyState.showClearSearch ? (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className={accountsFeatureEmptyActionButtonClass}
                    >
                      {t('common.clear_search')}
                    </button>
                  ) : null}
                  {accountsEmptyState.showResetFilters ? (
                    <button
                      type="button"
                      onClick={() => setFilters({ ...defaultAccountsFilterState })}
                      className={accountsFeatureEmptyActionButtonClass}
                    >
                      {t('accounts.filter_reset')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={isSelectionMode ? "space-y-8 !mt-4" : "space-y-8"}>
              {groupedAccounts.map((group) => (
                <AccountGroupSection
                  key={group.id}
                  t={t}
                  group={group}
                  accountCardHeights={accountCardHeights}
                  codexQuotaByName={codexQuotaByName}
                  accountUsageByID={accountUsageByID}
                  usageRefreshingAccountIDSet={usageRefreshingAccountIDSet}
                  accountRateLimitByID={accountRateLimitByID}
                  rateLimitRefreshingAccountIDSet={rateLimitRefreshingAccountIDSet}
                  ready={ready}
                  isSelectionMode={isSelectionMode}
                  selectedAccountIDSet={selectedAccountIDSet}
                  pendingDeleteID={pendingDeleteID}
                  oauthPendingAccountID={oauthPendingAccountID}
                  pendingStatusAccountID={pendingStatusAccountID}
                  displayMode={displayMode}
                  isCollapsed={collapsedAccountGroupIDs.has(group.id)}
                  isFilteredView={isAccountListFiltered}
                  onToggleSelection={toggleAccountSelection}
                  onToggleCollapsed={toggleAccountGroupCollapsed}
                  onToggleGroupSelection={toggleGroupSelection}
                  onRefreshGroup={refreshGroupQuota}
                  onSetGroupDisabled={setGroupDisabled}
                  onDeleteGroup={deleteGroup}
                  onOpenDetails={openAccountDetail}
                  onRefreshQuota={(account) => {
                    void refreshCodexQuota(account);
                    void refreshAccountUsage([account]);
                    void refreshAccountRateLimits([account]);
                  }}
                  onStartReauth={(account) => void startCodexOAuth(account)}
                  onToggleDisabled={(account) =>
                    void toggleAccountDisabled(account)
                  }
                  onRequestDelete={(accountID) => {
                    setDeleteError("");
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
              quotaState={
                selectedAccount.quotaKey
                  ? codexQuotaByName[selectedAccount.quotaKey]
                  : undefined
              }
              usageSummary={accountUsageByID[selectedAccount.id]}
              rateLimitStatus={accountRateLimitByID[selectedAccount.id]}
              rateLimitStrategies={rateLimitStrategies}
              rateLimitRulesAPI={
                previewMode
                  ? undefined
                  : {
                      list: ListRateLimitRules,
                      create: CreateRateLimitRule,
                      update: UpdateRateLimitRule,
                      delete: DeleteRateLimitRule,
                    }
              }
              verifyState={apiKeyVerifyState}
              oauthModelProbeState={oauthModelProbeStateByID[selectedAccount.id]}
              routeDecisions={detailRouteDecisions}
              modelNames={resolveAccountVerifyModelNames(
                selectedAccount,
                relayModelNames,
              )}
              localModelNames={relayModelNames}
              cachedModelNames={accountModelNamesByID[selectedAccount.id] ?? []}
              localCliActions={resolveLocalCliActionsForAccount(selectedAccount).map((action) => ({
                ...action,
                onSelect: () => action.onSelect(),
              }))}
              onClose={closeAccountDetail}
              onRename={
                selectedAccountIsCodexAPIKey ? renameSelectedApiKey : undefined
              }
              onSaveConfig={
                selectedAccountCanSaveApiConfig
                  ? (draft) => saveSelectedApiLikeConfig(draft)
                  : undefined
              }
              onVerify={
                selectedAccountIsCodexAPIKey
                  ? (input) => void verifySelectedApiKey(input)
                  : undefined
              }
              onOAuthModelProbe={
                selectedAccountCanProbeOAuthModel
                  ? (model) => void probeSelectedOAuthModel(model)
                  : undefined
              }
              onFetchModels={
                selectedAccountCanSaveApiConfig
                  ? async (input) => {
                      if (!hasWailsAppBindings()) {
                        const previewModels = normalizeAPIKeyModelNames(
                          (selectedAccount.models ?? []).map((model) => model.name),
                        );
                        setAccountModelNamesByID((prev) => ({
                          ...prev,
                          [selectedAccount.id]: previewModels,
                        }));
                        return {
                          models: previewModels,
                          message: `PREVIEW MODELS / ${previewModels.length}`,
                        };
                      }
                      const result = await FetchOpenAICompatibleProviderModels(
                        main.FetchOpenAICompatibleProviderModelsInput.createFrom(input),
                      );
                      const fetchedModels = normalizeAPIKeyModelNames(
                        (result.models ?? [])
                          .map((model) => model.name)
                          .filter(Boolean),
                      );
                      setAccountModelNamesByID((prev) => ({
                        ...prev,
                        [selectedAccount.id]: fetchedModels,
                      }));
                      return {
                        models: fetchedModels,
                        message: result.message ?? "",
                      };
                    }
                  : undefined
              }
              onTestQuotaCurl={
                selectedAccountIsCodexAPIKey
                  ? (input) => testSelectedApiKeyQuotaCurl(input)
                  : undefined
              }
              onTestBillingCurl={
                selectedAccountIsCodexAPIKey
                  ? (input) => testSelectedApiKeyBillingCurl(input)
                  : undefined
              }
              onRateLimitRulesChanged={() =>
                void loadAccountRateLimits(usageAccounts)
              }
              activeScriptEditor={
                selectedAccount.id === accountDetailIDFromHash
                  ? accountDetailScriptFromHash || null
                  : null
              }
              onOpenScriptEditor={openAccountDetailScriptRoute}
              onCloseScriptEditor={closeAccountDetailScriptRoute}
              onStartReauth={
                isCodexAuthFile(selectedAccount)
                  ? () => {
                      void startCodexOAuth(selectedAccount);
                    }
                  : undefined
              }
              onCancelReauth={cancelCodexOAuth}
              isReauthing={oauthPendingAccountID === selectedAccount.id}
            />
          ) : null}

          {isApiKeyModalOpen ? (
            <ApiKeyComposeModal
              t={t}
              form={apiKeyForm}
              error={apiKeyFormError}
              onClose={() => {
                setIsApiKeyModalOpen(false);
                setApiKeyFormError("");
              }}
              onChange={(field, value) => {
                setApiKeyForm((prev) => ({ ...prev, [field]: value }));
                setApiKeyFormError("");
              }}
              onSubmit={submitApiKeyForm}
              onFetchModels={async (input) => {
                const result = await FetchOpenAICompatibleProviderModels(
                  main.FetchOpenAICompatibleProviderModelsInput.createFrom(
                    input,
                  ),
                );
                return {
                  models: (result.models ?? [])
                    .map((m) => m.name)
                    .filter(Boolean),
                  message: result.message ?? "",
                };
              }}
              onVerify={async (input) => {
                const result = await VerifyOpenAICompatibleProvider(
                  main.VerifyOpenAICompatibleProviderInput.createFrom(input),
                );
                return {
                  success: result.success,
                  message: result.message ?? "",
                };
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
                setUnifiedComposePreset(null);
                setUnifiedComposeError("");
              }}
              onFormChange={(field, value) => {
                setUnifiedComposeForm((prev) => ({ ...prev, [field]: value }));
                setUnifiedComposeError("");
              }}
              onFormatBaseUrlChange={(format, value) => {
                setUnifiedComposeForm((prev) => ({
                  ...prev,
                  formatBaseUrls: { ...prev.formatBaseUrls, [format]: value },
                }));
                setUnifiedComposeError("");
              }}
              onBillingCurlChange={(value) => {
                setUnifiedComposeForm((prev) => ({
                  ...prev,
                  billingCurl: value,
                  billingEnabled: value.trim().length > 0,
                }));
              }}
              onBillingEnabledChange={(enabled) => {
                setUnifiedComposeForm((prev) => ({
                  ...prev,
                  billingEnabled: enabled,
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
                setInitialImportPasteContent("");
                setInitialImportItems([]);
              }}
              onSubmit={async (items) => {
                await submitAccountImport(items);
                setInitialImportPasteContent("");
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
                setLocalCliApplyMessage("");
              }}
              onDraftChange={(nextDraft) => {
                setLocalCliDraft(nextDraft);
                setLocalCliApplyMessage("");
              }}
              onApply={(draft) => void applyAccountLocalCliDraft(draft)}
            />
          ) : null}

          {deepLinkPreview ? (
            <DeepLinkAccountImportConfirm
              preview={deepLinkPreview}
              result={deepLinkResult}
              applying={isApplyingDeepLink}
              resultMessage={deepLinkApplyMessage}
              previewMode={previewMode}
              onClose={() => {
                setDeepLinkRawURL("");
                setDeepLinkPreview(null);
                setDeepLinkResult(null);
                setDeepLinkApplyMessage("");
              }}
              onApply={() => void applyDeepLinkImport()}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

function normalizeUnifiedComposeFormatBaseUrls(
  items: Partial<Record<string, string>>,
) {
  const out: Record<string, string> = {};
  for (const [format, value] of Object.entries(items)) {
    const trimmedFormat = format.trim();
    const trimmedValue = String(value || "").trim();
    if (!trimmedFormat || !trimmedValue) continue;
    out[trimmedFormat] = trimmedValue;
  }
  return out;
}

function buildUnifiedComposeProviderModels(preset: VendorPreset | null) {
  if (!preset) return [];
  return preset.modelSuggestions
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, alias: name }));
}

function resolveProviderNameFromBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "";
  try {
    const host = new URL(trimmed).host.replace(/^api\./, "");
    return host.split(".")[0] || host || "";
  } catch {
    return (
      trimmed
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        ?.split(".")[0] || ""
    );
  }
}

function readInitialDisplayMode(): AccountListDisplayMode {
  if (typeof window === "undefined") {
    return DEFAULT_ACCOUNT_LIST_DISPLAY_MODE;
  }
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const hashDensity = params.get("density");
  if (hashDensity) {
    return parseAccountListDisplayMode(hashDensity);
  }
  try {
    return parseAccountListDisplayMode(
      window.localStorage.getItem(ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_ACCOUNT_LIST_DISPLAY_MODE;
  }
}

function readAccountDetailIDFromHash() {
  if (typeof window === "undefined") {
    return "";
  }
  return readFrameHashState(window.location.hash)?.accountDetailID ?? "";
}

function readAccountDetailScriptFromHash(): AccountDetailScriptRoute | "" {
  if (typeof window === "undefined") {
    return "";
  }
  return readFrameHashState(window.location.hash)?.accountDetailScript ?? "";
}

function isOpenAICompatibleAccount(
  account: Pick<AccountRecord, "accountKind" | "id">,
): boolean {
  return account.accountKind === "openai-compatible";
}

function findOpenAICompatibleAccountForProvider(
  accounts: AccountRecord[],
  provider: OpenAICompatibleProvider,
): AccountRecord | null {
  const providerAccountKey = String(provider.accountKey || "").trim();
  const providerName = String(provider.name || "").trim().toLowerCase();
  return accounts.find((account) => {
    if (!isOpenAICompatibleAccount(account)) {
      return false;
    }
    if (providerAccountKey && account.id === providerAccountKey) {
      return true;
    }
    return String(account.provider || "").trim().toLowerCase() === providerName;
  }) ?? null;
}

function isCodexAPIKeyAccount(
  account: Pick<AccountRecord, "accountKind" | "credentialSource" | "id">,
): boolean {
  return account.accountKind === "codex-api-key";
}

function resolveAccountVerifyModelNames(
  account: AccountRecord,
  fallback: string[],
): string[] {
  const accountModels = (account.models || [])
    .map((model) => String(model.name || "").trim())
    .filter(Boolean);
  if (accountModels.length > 0) {
    return Array.from(new Set(accountModels));
  }
  return fallback;
}
