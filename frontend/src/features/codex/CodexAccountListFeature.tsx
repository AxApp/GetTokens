import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'antd';
import { Terminal } from 'lucide-react';
import {
  CreateProjectCandidatePoolRule,
  CreateRateLimitRule,
  DeleteProjectCandidatePoolRule,
  DeleteRateLimitRule,
  FetchOpenAICompatibleProviderModels,
  ExplainChannelRouting,
  GetAuthFileModels,
  GetChannelRoutingConfig,
  GetCodexLiveSessionsSnapshot,
  GetCodexSessionManagementSnapshot,
  ListChannelRouteDecisions,
  ListChannelRouteEvents,
  ListOAuthModelAliases,
  ListCodexAccountInventory,
  ListProjectCandidatePoolRules,
  ListRateLimitRules,
  ListRelaySupportedModels,
  ProbeCodexAccountRouting,
  SaveChannelRoutingConfig,
  SetAccountDisabled,
  UpdateProjectCandidatePoolRule,
  UpdateRateLimitRule,
  UpdateOAuthModelAliases,
  UpdateCodexAPIKeyConfig,
  UpdateOpenAICompatibleProvider,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/useDebug';
import { useI18n } from '../../context/I18nContext';
import type { AccountRecord, SidecarStatus } from '../../types';
import { toErrorMessage } from '../../utils/error';
import {
  buildCodexDetailFrameHash,
  buildCodexModalFrameHash,
  clearCodexDetailFrameHash,
  clearCodexModalFrameHash,
  readFrameHashState,
} from '../../utils/pagePersistence';
import { hasWailsAppBindings } from '../../utils/previewMode';
import useAccountsQuotaState from '../accounts/hooks/useAccountsQuotaState';
import useAccountsRateLimitState from '../accounts/hooks/useAccountsRateLimitState';
import useAccountsUsageState from '../accounts/hooks/useAccountsUsageState';
import { getAccountsPreviewCodexAccounts } from '../accounts/previewData';
import type { ApiKeyConfigDraft } from '../accounts/model/accountDetailConfig';
import type { OAuthModelProbeState } from '../accounts/components/OAuthModelProbeSection';
import {
  publishAccountDisabledChange,
  readAccountDisabledOverrides,
  subscribeAccountDisabledChanges,
} from '../accounts/model/accountDisabledSync';
import { mapBackendAccountRecord } from '../accounts/model/accountPresentation';
import {
  ACCOUNT_USAGE_REFRESH_INTERVAL_MS,
  shouldScheduleAccountUsageRefresh,
} from '../accounts/model/accountUsage';
import ChannelRoutingWorkbench from '../channel-routing/components/ChannelRoutingWorkbench';
import ProjectCandidatePoolRulesModal from '../channel-routing/components/ProjectCandidatePoolRulesModal';
import {
  buildPreviewProjectCandidatePoolRules,
  buildPreviewChannelRouteAuditEvent,
  buildPreviewChannelRouteDecision,
  buildProjectCandidatePoolProjectOptions,
  buildProjectCandidatePoolProjectsFromCodexLiveSessions,
  buildProjectCandidatePoolProjectsFromSessionManagementSnapshot,
  mergeProjectCandidatePoolObservedProjects,
  normalizeProjectCandidatePoolRuleDraft,
  normalizeProjectCandidatePoolRules,
  normalizeChannelRoutingConfig,
  updateChannelRoutingConfig,
  type ChannelRouteAuditEvent,
  type ChannelRouteDecisionSnapshot,
  type ChannelRouteMode,
  type ChannelRoutingConfig,
  type ProjectCandidatePoolObservedProjectLike,
  type ProjectCandidatePoolProjectOption,
  type ProjectCandidatePoolRuleLike,
} from '../channel-routing/model/channelRouting';
import { CodexAccountDetailModal, CodexAccountOrderSection, RouteProbeCard } from './components/CodexAccountListView';
import { getCodexAccountListPreviewAuthFileModelOptions, getCodexAccountListPreviewRows } from './previewData';
import {
  buildCodexAuthFileModelMappings,
  buildCodexAccountRows,
  buildCodexQuotaSummaryAccount,
  buildCodexRoutePolicyExplainPreviewFromCandidates,
  buildCodexRoutePolicyPreview,
  buildCodexRoutePolicyRowStates,
  buildCodexRoutingProbeModelOptions,
  buildCodexRoutingProbeRequestInput,
  buildCodexRoutingProbeStreamLines,
  buildOpenAICompatibleModelMappings,
  canEditCodexModelMappings,
  DEFAULT_CODEX_ROUTING_PROBE_MODEL,
  mergeCodexAuthFileModelMappings,
  normalizeCodexModelMappingsForProvider,
  patchCodexAccountRowDisabled,
  patchCodexAccountRowManualRequestable,
  reorderCodexAccountRows,
  resolveCodexRoutingProbeDefaultModel,
  type CodexAccountRow,
  type CodexModelMappingRow,
  type CodexRoutingProbeAttemptView,
} from './model/codexAccountList';

interface CodexAccountListFeatureProps {
  sidecarStatus: SidecarStatus;
}

const PROJECT_CANDIDATE_POOL_PROJECT_SYNC_INTERVAL_MS = 15_000;

export default function CodexAccountListFeature({ sidecarStatus }: CodexAccountListFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const browserMode = !hasWailsAppBindings();
  const ready = browserMode || sidecarStatus?.code === 'ready';
  const [orderedRows, setOrderedRows] = useState<CodexAccountRow[]>([]);
  const [draggedID, setDraggedID] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingToggleID, setPendingToggleID] = useState<string | null>(null);
  const [pendingManualRequestableID, setPendingManualRequestableID] = useState<string | null>(null);
  const [pendingMappingID, setPendingMappingID] = useState<string | null>(null);
  const [loadingAuthFileModelID, setLoadingAuthFileModelID] = useState<string | null>(null);
  const [authFileModelMappings, setAuthFileModelMappings] = useState<Record<string, CodexModelMappingRow[]>>({});
  const [authFileModelOptions, setAuthFileModelOptions] = useState<Record<string, CodexModelMappingRow[]>>({});
  const [authFileModelErrors, setAuthFileModelErrors] = useState<Record<string, string>>({});
  const [loadingOpenAICompatibleModelID, setLoadingOpenAICompatibleModelID] = useState<string | null>(null);
  const [openAICompatibleModelOptions, setOpenAICompatibleModelOptions] = useState<Record<string, CodexModelMappingRow[]>>({});
  const [openAICompatibleModelErrors, setOpenAICompatibleModelErrors] = useState<Record<string, string>>({});
  const [codexModelCatalogOptions, setCodexModelCatalogOptions] = useState<CodexModelMappingRow[]>([]);
  const [routingProbeModel, setRoutingProbeModel] = useState(DEFAULT_CODEX_ROUTING_PROBE_MODEL);
  const [routingProbeAttempts, setRoutingProbeAttempts] = useState<CodexRoutingProbeAttemptView[]>([]);
  const [detailOAuthModelProbeStateByID, setDetailOAuthModelProbeStateByID] = useState<Record<string, OAuthModelProbeState>>({});
  const [routingProbeRequestedAttempts, setRoutingProbeRequestedAttempts] = useState(1);
  const [routingProbeRunning, setRoutingProbeRunning] = useState(false);
  const [routeProbeOpen, setRouteProbeOpen] = useState(false);
  const [projectConfigOpen, setProjectConfigOpen] = useState(false);
  const [detailRowID, setDetailRowID] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [orderDirty, setOrderDirty] = useState(false);
  const [autoSaveOrderRequested, setAutoSaveOrderRequested] = useState(false);
  const [channelConfig, setChannelConfig] = useState<ChannelRoutingConfig>(() =>
    buildDefaultChannelRoutingConfig('codex'),
  );
  const [channelExplain, setChannelExplain] = useState<main.ChannelRoutingExplainResult | null>(null);
  const [channelRouteEvents, setChannelRouteEvents] = useState<ChannelRouteAuditEvent[]>([]);
  const [channelRouteDecisions, setChannelRouteDecisions] = useState<ChannelRouteDecisionSnapshot[]>([]);
  const [projectCandidatePoolRules, setProjectCandidatePoolRules] = useState<ProjectCandidatePoolRuleLike[]>([]);
  const [selectedProjectCandidatePoolKey, setSelectedProjectCandidatePoolKey] = useState('');
  const [projectCandidatePoolObservedProjects, setProjectCandidatePoolObservedProjects] = useState<
    ProjectCandidatePoolObservedProjectLike[]
  >([]);
  const suppressNextDetailClickRef = useRef(false);
  const { codexQuotaByName, loadCodexQuotas, refreshCodexQuota } = useAccountsQuotaState(trackRequest);
  const { accountUsageByID, usageRefreshingAccountIDSet, loadAccountUsage, refreshAccountUsage } = useAccountsUsageState(trackRequest);
  const {
    accountRateLimitByID,
    rateLimitRefreshingAccountIDSet,
    rateLimitStrategies,
    loadAccountRateLimits,
    refreshAccountRateLimits,
  } = useAccountsRateLimitState(trackRequest);

  const detailRow = useMemo(
    () => orderedRows.find((row) => row.id === detailRowID) || null,
    [detailRowID, orderedRows],
  );
  const detailRowWithModels = useMemo(() => {
    if (!detailRow || detailRow.sourceKind !== 'codex-auth-file') {
      return detailRow;
    }
    return {
      ...detailRow,
      modelMappings: authFileModelMappings[detailRow.id] || detailRow.modelMappings,
    };
  }, [authFileModelMappings, detailRow]);
  const orderChanged = orderDirty;
  const routingProbeModelOptions = useMemo(
    () => buildCodexRoutingProbeModelOptions(orderedRows, codexModelCatalogOptions),
    [codexModelCatalogOptions, orderedRows],
  );
  const requestableRows = useMemo(() => orderedRows.filter((row) => row.requestable), [orderedRows]);
  const projectCandidatePoolProjectOptions = useMemo(
    () =>
      buildProjectCandidatePoolProjectOptions({
        rules: projectCandidatePoolRules,
        sessionProjects: projectCandidatePoolObservedProjects,
        routeEvents: channelRouteEvents,
      }),
    [channelRouteEvents, projectCandidatePoolObservedProjects, projectCandidatePoolRules],
  );
  const selectedProjectCandidatePoolRule = useMemo(
    () =>
      buildSelectedProjectCandidatePoolRule(
        selectedProjectCandidatePoolKey,
        projectCandidatePoolRules,
        projectCandidatePoolProjectOptions,
      ),
    [projectCandidatePoolProjectOptions, projectCandidatePoolRules, selectedProjectCandidatePoolKey],
  );
  const routePolicyDraft = useMemo(
    () => ({
      allowAccountIDs: [],
      denyAccountIDs: [],
      orderAccountIDs: [],
      allowFallback: true,
    }),
    [],
  );
  const routePolicyPreviewRows = useMemo(
    () => buildCodexRoutePolicyPreview(orderedRows, routePolicyDraft),
    [orderedRows, routePolicyDraft],
  );
  const routePolicyPreviewSignature = useMemo(
    () => routePolicyPreviewRows.map((row) => row.id).join('\n'),
    [routePolicyPreviewRows],
  );
  const routePolicyRowStates = useMemo(
    () => buildCodexRoutePolicyRowStates(orderedRows, routePolicyDraft),
    [orderedRows, routePolicyDraft],
  );
  const usageRefreshAccounts = useMemo(
    () => orderedRows.map((row) => codexRowToAccountRecord(row)),
    [orderedRows],
  );
  const routingProbeStreamLines = useMemo(
    () =>
      buildCodexRoutingProbeStreamLines(routePolicyPreviewRows, routingProbeAttempts, {
        model: routingProbeModel,
        requestedAttempts: routingProbeRequestedAttempts,
        running: routingProbeRunning,
      }),
    [routePolicyPreviewRows, routingProbeAttempts, routingProbeModel, routingProbeRequestedAttempts, routingProbeRunning],
  );
  const latestRoutingProbeAttempt = routingProbeAttempts[routingProbeAttempts.length - 1] || null;
  const latestRoutingProbeAccountID = latestRoutingProbeAttempt?.accountID || '';
  const routingProbeDisabled = !ready || saving || routingProbeRunning || !routingProbeModel.trim();

  useEffect(() => {
    if (!selectedProjectCandidatePoolKey) {
      return;
    }
    if (projectCandidatePoolProjectOptions.some((option) => option.projectKey === selectedProjectCandidatePoolKey)) {
      return;
    }
    setSelectedProjectCandidatePoolKey('');
    setChannelExplain(null);
  }, [projectCandidatePoolProjectOptions, selectedProjectCandidatePoolKey]);

  async function reload(messageOverride?: string) {
    if (browserMode) {
      const previewAccounts = getAccountsPreviewCodexAccounts();
      const disabledOverrides = readAccountDisabledOverrides();
      const previewRows = getCodexAccountListPreviewRows().map((row) =>
        Object.prototype.hasOwnProperty.call(disabledOverrides, row.id)
          ? patchCodexAccountRowDisabled(row, disabledOverrides[row.id])
          : row,
      );
      const previewConfig = buildDefaultChannelRoutingConfig('codex', previewRows.map((row) => row.id));
      setChannelConfig(previewConfig);
      setOrderedRows(applyChannelOrderToRows(previewRows, previewConfig.orderedAccountIDs));
      setChannelExplain(null);
      setChannelRouteEvents([]);
      setChannelRouteDecisions([]);
      setProjectCandidatePoolRules(buildPreviewProjectCandidatePoolRules('codex', previewRows));
      setProjectCandidatePoolObservedProjects([
        {
          projectKey: 'workspace:preview-gettokens',
          projectName: 'GetTokens',
          projectKeySource: 'browser-preview',
          projectKeyConfidence: 'strong',
          source: 'session-history',
          lastSeenAt: '2026-06-07T08:00:00.000Z',
          sessionCount: 3,
        },
      ]);
      setOrderDirty(false);
      void loadCodexQuotas(previewAccounts);
      const previewUsageAccounts: AccountRecord[] = [
        ...previewAccounts,
        {
          id: 'acct_deepseek',
          accountKind: 'openai-compatible',
          provider: 'deepseek',
          credentialSource: 'api-key',
          displayName: 'DeepSeek',
          status: 'configured',
        },
        {
          id: 'acct_openrouter',
          accountKind: 'openai-compatible',
          provider: 'openrouter',
          credentialSource: 'api-key',
          displayName: 'OpenRouter',
          status: 'disabled',
          disabled: true,
        },
      ];
      void loadAccountUsage(previewUsageAccounts);
      void loadAccountRateLimits(previewUsageAccounts);
      setMessage(messageOverride || t('codex.account_list_loaded'));
      return;
    }

    if (!ready) {
      setOrderedRows([]);
      setProjectCandidatePoolRules([]);
      setProjectCandidatePoolObservedProjects([]);
      setMessage(t('codex.account_list_waiting_ready'));
      return;
    }

    setLoading(true);
    try {
      const [accountResponse, routingConfig, projectRulesResponse] = await Promise.all([
        trackRequest('ListCodexAccountInventory', { args: [] }, () => ListCodexAccountInventory()),
        trackRequest('GetChannelRoutingConfig', { channel: 'codex' }, () => GetChannelRoutingConfig('codex')),
        trackRequest('ListProjectCandidatePoolRules', { channel: 'codex' }, () =>
          ListProjectCandidatePoolRules(main.ProjectCandidatePoolRulesInput.createFrom({ channel: 'codex' })),
        ),
      ]);
      const accountRows = (accountResponse || []).map((account) => mapBackendAccountRecord(account));
      const normalizedConfig = mapWailsChannelRoutingConfig(routingConfig, 'codex');
      const nextRows = applyChannelOrderToRows(buildCodexAccountRows({
        accounts: accountRows,
        providers: [],
        manualRequestableAccountIDs: normalizedConfig.manualRequestableAccountIDs,
      }), normalizedConfig.orderedAccountIDs);
      const nextUsageAccounts = nextRows.map((row) => codexRowToAccountRecord(row));
      void loadCodexQuotas(accountRows);
      void loadAccountUsage(nextUsageAccounts);
      void loadAccountRateLimits(nextUsageAccounts);
      setChannelConfig(normalizedConfig);
      setChannelExplain(null);
      setOrderedRows(nextRows);
      setProjectCandidatePoolRules(normalizeProjectCandidatePoolRules(projectRulesResponse, 'codex'));
      void loadProjectCandidatePoolProjectSources();
      void loadChannelRouteDiagnostics();
      setOrderDirty(false);
      setMessage(messageOverride || t('codex.account_list_loaded'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_load_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [browserMode, loadAccountRateLimits, loadAccountUsage, loadCodexQuotas, ready]);

  useEffect(() => {
    if (browserMode || !ready || !projectConfigOpen) {
      return;
    }
    void loadProjectCandidatePoolProjectSources();
    const timer = window.setInterval(() => {
      void loadProjectCandidatePoolProjectSources();
    }, PROJECT_CANDIDATE_POOL_PROJECT_SYNC_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [browserMode, projectConfigOpen, ready]);

  useEffect(
    () =>
      subscribeAccountDisabledChanges((event) => {
        setOrderedRows((prev) =>
          prev.map((row) => (row.id === event.id ? patchCodexAccountRowDisabled(row, event.disabled) : row)),
        );
      }),
    [],
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !shouldScheduleAccountUsageRefresh({
        ready,
        hasRuntimeBindings: !browserMode,
        accounts: usageRefreshAccounts,
      })
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadAccountUsage(usageRefreshAccounts);
    }, ACCOUNT_USAGE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [browserMode, loadAccountUsage, ready, usageRefreshAccounts]);

  useEffect(() => {
    if (routingProbeModel.trim()) {
      return;
    }
    setRoutingProbeModel(resolveCodexRoutingProbeDefaultModel(orderedRows, codexModelCatalogOptions));
  }, [codexModelCatalogOptions, orderedRows, routingProbeModel]);

  useEffect(() => {
    setChannelExplain(null);
  }, [routePolicyPreviewSignature]);

  useEffect(() => {
    if (!ready) {
      setCodexModelCatalogOptions([]);
      return;
    }
    if (browserMode) {
      setCodexModelCatalogOptions(
        getCodexAccountListPreviewRows()
          .filter((row) => row.sourceKind === 'codex-auth-file')
          .flatMap((row) => row.modelMappings),
      );
      return;
    }

    let mounted = true;
    void trackRequest('ListRelaySupportedModels', { args: [] }, () => ListRelaySupportedModels())
      .then((result) => {
        if (mounted) {
          setCodexModelCatalogOptions(buildOpenAICompatibleModelMappings({ models: result?.models || [] }));
        }
      })
      .catch((error) => {
        console.error(error);
        if (mounted) {
          setCodexModelCatalogOptions([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [browserMode, ready, trackRequest]);

  useEffect(() => {
    if (!detailRow || detailRow.sourceKind !== 'codex-auth-file') {
      return;
    }
    if (browserMode) {
      setAuthFileModelOptions((prev) => ({
        ...prev,
        [detailRow.id]: getCodexAccountListPreviewAuthFileModelOptions(detailRow.id),
      }));
      return;
    }
    if (authFileModelMappings[detailRow.id]) {
      return;
    }

    const authFileName = String(detailRow.name || '').trim();
    if (!authFileName) {
      return;
    }

    const channel = detailRow.provider.trim().toLowerCase() || 'codex';
    let mounted = true;
    setLoadingAuthFileModelID(detailRow.id);
    setAuthFileModelErrors((prev) => ({ ...prev, [detailRow.id]: '' }));
    void trackRequest('GetAuthFileModels', { name: authFileName, channel }, async () => {
      const [models, aliases] = await Promise.all([
        GetAuthFileModels(authFileName),
        ListOAuthModelAliases(channel),
      ]);
      return { models, aliases };
    })
      .then((result) => {
        if (!mounted) {
          return;
        }
        setAuthFileModelMappings((prev) => ({
          ...prev,
          [detailRow.id]: mergeCodexAuthFileModelMappings(result.models || [], result.aliases || []),
        }));
        setAuthFileModelOptions((prev) => ({
          ...prev,
          [detailRow.id]: buildCodexAuthFileModelMappings(result.models || []),
        }));
      })
      .catch((error) => {
        console.error(error);
        if (mounted) {
          setAuthFileModelErrors((prev) => ({ ...prev, [detailRow.id]: toErrorMessage(error) }));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingAuthFileModelID((current) => (current === detailRow.id ? null : current));
        }
      });

    return () => {
      mounted = false;
    };
  }, [authFileModelMappings, browserMode, detailRow, trackRequest]);

  useEffect(() => {
    if (!detailRow || detailRow.sourceKind !== 'openai-compatible') {
      return;
    }
    if (browserMode || openAICompatibleModelOptions[detailRow.id]) {
      return;
    }

    const apiKey = detailRow.apiKey || detailRow.apiKeys?.[0] || '';
    if (!detailRow.baseUrl || !apiKey) {
      return;
    }

    let mounted = true;
    setLoadingOpenAICompatibleModelID(detailRow.id);
    setOpenAICompatibleModelErrors((prev) => ({ ...prev, [detailRow.id]: '' }));
    void trackRequest('FetchOpenAICompatibleProviderModels', { name: detailRow.provider, baseUrl: detailRow.baseUrl }, () =>
      FetchOpenAICompatibleProviderModels(
        main.FetchOpenAICompatibleProviderModelsInput.createFrom({
          baseUrl: detailRow.baseUrl,
          apiKey,
          headers: detailRow.headers || {},
        }),
      ),
    )
      .then((result) => {
        if (!mounted) {
          return;
        }
        const fetchedMappings = buildCodexAuthFileModelMappings(result?.models || []);
        setOpenAICompatibleModelOptions((prev) => ({
          ...prev,
          [detailRow.id]: fetchedMappings,
        }));
        if (Number(result?.statusCode || 0) >= 400 && fetchedMappings.length === 0) {
          setOpenAICompatibleModelErrors((prev) => ({
            ...prev,
            [detailRow.id]: result?.message || t('accounts.openai_provider_models_fetch_failed'),
          }));
        }
      })
      .catch((error) => {
        console.error(error);
        if (mounted) {
          setOpenAICompatibleModelErrors((prev) => ({ ...prev, [detailRow.id]: toErrorMessage(error) }));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingOpenAICompatibleModelID((current) => (current === detailRow.id ? null : current));
        }
      });

    return () => {
      mounted = false;
    };
  }, [browserMode, detailRow, openAICompatibleModelOptions, trackRequest]);

  async function fetchDetailModelOptions(row: CodexAccountRow) {
    if (row.sourceKind === 'codex-auth-file') {
      const authFileName = String(row.name || '').trim();
      if (!authFileName) {
        return;
      }
      if (browserMode) {
        setAuthFileModelMappings((prev) => ({
          ...prev,
          [row.id]: getCodexAccountListPreviewAuthFileModelOptions(row.id),
        }));
        setAuthFileModelOptions((prev) => ({
          ...prev,
          [row.id]: getCodexAccountListPreviewAuthFileModelOptions(row.id),
        }));
        setAuthFileModelErrors((prev) => ({ ...prev, [row.id]: '' }));
        return;
      }

      const channel = row.provider.trim().toLowerCase() || 'codex';
      setLoadingAuthFileModelID(row.id);
      setAuthFileModelErrors((prev) => ({ ...prev, [row.id]: '' }));
      try {
        const result = await trackRequest('GetAuthFileModels', { name: authFileName, channel }, async () => {
          const [models, aliases] = await Promise.all([
            GetAuthFileModels(authFileName),
            ListOAuthModelAliases(channel),
          ]);
          return { models, aliases };
        });
        setAuthFileModelMappings((prev) => ({
          ...prev,
          [row.id]: mergeCodexAuthFileModelMappings(result.models || [], result.aliases || []),
        }));
        setAuthFileModelOptions((prev) => ({
          ...prev,
          [row.id]: buildCodexAuthFileModelMappings(result.models || []),
        }));
      } catch (error) {
        console.error(error);
        setAuthFileModelErrors((prev) => ({ ...prev, [row.id]: toErrorMessage(error) }));
      } finally {
        setLoadingAuthFileModelID((current) => (current === row.id ? null : current));
      }
      return;
    }

    const apiKey = row.apiKey || row.apiKeys?.[0] || '';
    if (!row.baseUrl || !apiKey) {
      setOpenAICompatibleModelErrors((prev) => ({
        ...prev,
        [row.id]: t('accounts.openai_provider_models_fetch_failed'),
      }));
      return;
    }

    if (browserMode) {
      setOpenAICompatibleModelOptions((prev) => ({
        ...prev,
        [row.id]: row.modelMappings,
      }));
      setOpenAICompatibleModelErrors((prev) => ({ ...prev, [row.id]: '' }));
      return;
    }

    setLoadingOpenAICompatibleModelID(row.id);
    setOpenAICompatibleModelErrors((prev) => ({ ...prev, [row.id]: '' }));
    try {
      const result = await trackRequest('FetchOpenAICompatibleProviderModels', { name: row.provider, baseUrl: row.baseUrl }, () =>
        FetchOpenAICompatibleProviderModels(
          main.FetchOpenAICompatibleProviderModelsInput.createFrom({
            baseUrl: row.baseUrl,
            apiKey,
            headers: row.headers || {},
          }),
        ),
      );
      const fetchedMappings = buildCodexAuthFileModelMappings(result?.models || []);
      setOpenAICompatibleModelOptions((prev) => ({
        ...prev,
        [row.id]: fetchedMappings,
      }));
      if (Number(result?.statusCode || 0) >= 400 && fetchedMappings.length === 0) {
        setOpenAICompatibleModelErrors((prev) => ({
          ...prev,
          [row.id]: result?.message || t('accounts.openai_provider_models_fetch_failed'),
        }));
      }
    } catch (error) {
      console.error(error);
      setOpenAICompatibleModelErrors((prev) => ({ ...prev, [row.id]: toErrorMessage(error) }));
    } finally {
      setLoadingOpenAICompatibleModelID((current) => (current === row.id ? null : current));
    }
  }

  function handleDragStart(id: string) {
    setDraggedID(id);
    suppressNextDetailClickRef.current = false;
  }

  function handleDragEnter(targetID: string) {
    if (!draggedID) {
      return;
    }
    if (draggedID === targetID) {
      return;
    }
    suppressNextDetailClickRef.current = true;
    setOrderDirty(true);
    setOrderedRows((prev) => reorderCodexAccountRows(prev, draggedID, targetID));
    setMessage(t('codex.account_list_unsaved'));
  }

  function handleDrop() {
    suppressNextDetailClickRef.current = true;
    setDraggedID(null);
    setAutoSaveOrderRequested(true);
  }

  function handleDragEnd() {
    setDraggedID(null);
    window.setTimeout(() => {
      suppressNextDetailClickRef.current = false;
    }, 100);
  }

  function openDetail(rowID: string) {
    if (suppressNextDetailClickRef.current) {
      suppressNextDetailClickRef.current = false;
      return;
    }
    setDetailRowID(rowID);
    markCodexDetailInHash(rowID);
  }

  function closeDetail() {
    setDetailRowID(null);
    clearCodexDetailInHash();
  }

  function refreshOrderAccount(row: CodexAccountRow) {
    const account = codexRowToAccountRecord(row);
    void refreshCodexQuota(account);
    void refreshAccountUsage([account]);
    void refreshAccountRateLimits([account]);
  }

  function openRouteProbeModal() {
    setRouteProbeOpen(true);
    markCodexModalInHash('route-probe');
  }

  function closeRouteProbeModal() {
    setRouteProbeOpen(false);
    clearCodexModalInHash();
  }

  function openProjectConfigModal() {
    setProjectConfigOpen(true);
    markCodexModalInHash('project-config');
  }

  function closeProjectConfigModal() {
    setProjectConfigOpen(false);
    clearCodexModalInHash();
  }

  function markCodexDetailInHash(rowID: string) {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = buildCodexDetailFrameHash(window.location.hash, rowID);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function clearCodexDetailInHash() {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = clearCodexDetailFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function markCodexModalInHash(modal: 'route-probe' | 'project-config') {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = buildCodexModalFrameHash(window.location.hash, modal);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function clearCodexModalInHash() {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = clearCodexModalFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncDetailFromHash = () => {
      const hashState = readFrameHashState(window.location.hash);
      if (hashState?.page === 'codex' && hashState.codexWorkspace === 'account-list' && hashState.accountDetailID) {
        setDetailRowID(hashState.accountDetailID);
      } else {
        setDetailRowID(null);
      }
      const accountListModal = hashState?.page === 'codex' && hashState.codexWorkspace === 'account-list'
        ? hashState?.modal
        : undefined;
      setRouteProbeOpen(accountListModal === 'route-probe');
      setProjectConfigOpen(accountListModal === 'project-config');
    };

    syncDetailFromHash();
    window.addEventListener('hashchange', syncDetailFromHash);
    return () => {
      window.removeEventListener('hashchange', syncDetailFromHash);
    };
  }, []);

  async function persistChannelRoutingConfig(
    nextConfig: ChannelRoutingConfig,
    options: { reloadAfterSave?: boolean } = {},
  ): Promise<boolean> {
    if (!ready || saving) {
      return false;
    }

    setSaving(true);
    setMessage('');
    try {
      if (!browserMode) {
        await trackRequest('SaveChannelRoutingConfig', { channel: 'codex', mode: nextConfig.routeMode }, () =>
          SaveChannelRoutingConfig(main.ChannelRoutingConfig.createFrom(nextConfig)),
        );
      }
      setChannelConfig(nextConfig);
      setOrderDirty(false);
      if (browserMode) {
        setMessage(t('codex.account_list_saved'));
      } else if (options.reloadAfterSave) {
        await reload(t('codex.account_list_saved'));
      } else {
        setMessage('');
      }
      return true;
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_save_failed')}: ${toErrorMessage(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveOrder() {
    if (!ready || !orderChanged || saving) {
      return;
    }

    const nextConfig = withCurrentChannelOrder(channelConfig, orderedRows.map((row) => row.id));
    await persistChannelRoutingConfig(nextConfig, { reloadAfterSave: !browserMode });
  }

  useEffect(() => {
    if (!autoSaveOrderRequested || draggedID || saving) {
      return;
    }
    if (!orderChanged) {
      setAutoSaveOrderRequested(false);
      return;
    }
    setAutoSaveOrderRequested(false);
    void saveOrder();
  }, [autoSaveOrderRequested, channelConfig, draggedID, orderChanged, orderedRows, saving]);

  function updateChannelMode(mode: ChannelRouteMode) {
    const nextConfig = withCurrentChannelOrder(
      updateChannelRoutingConfig(channelConfig, { routeMode: mode }),
      orderedRows.map((row) => row.id),
    );
    setChannelExplain(null);
    void persistChannelRoutingConfig(nextConfig);
  }

  function updateShadowMode(mode: ChannelRouteMode) {
    const nextConfig = withCurrentChannelOrder(
      updateChannelRoutingConfig(channelConfig, { shadowRouteMode: mode }),
      orderedRows.map((row) => row.id),
    );
    setChannelExplain(null);
    void persistChannelRoutingConfig(nextConfig);
  }

  async function runChannelExplain(rule?: ProjectCandidatePoolRuleLike | null) {
    const nextConfig = withCurrentChannelOrder(channelConfig, orderedRows.map((row) => row.id));
    setChannelConfig(nextConfig);
    const requestedModel = routingProbeModel.trim();
    const explainRule = rule === undefined ? selectedProjectCandidatePoolRule : rule;
    if (browserMode) {
      const normalizedRule = explainRule ? normalizeProjectCandidatePoolRuleDraft(explainRule, 'codex') : null;
      const projectKey = String(normalizedRule?.projectKey || '').trim();
      const { candidates, filtered, projectCandidatePool } = buildCodexRoutePolicyExplainPreviewFromCandidates(
        orderedRows,
        routePolicyPreviewRows,
        normalizedRule,
      );
      const result = main.ChannelRoutingExplainResult.createFrom({
        channel: 'codex',
        routeMode: nextConfig.routeMode,
        requestedModel,
        selectedAccountID: candidates[0]?.id || '',
        candidates,
        filtered,
        steps: [
          ...(projectKey ? [projectCandidatePool?.reason || 'project-candidate-pool:matched'] : []),
          `mode:${nextConfig.routeMode}`,
          `candidates:${candidates.length}`,
          'preview:browser',
        ],
        snapshotVersion: 'preview',
        policyVersion: 'channel-routing-v1',
        projectCandidatePool,
        shadow: {
          enabled: true,
          routeMode: nextConfig.shadowRouteMode,
          selectedAccountID: candidates[0]?.id || '',
          candidates,
          diff: false,
          steps: [`mode:${nextConfig.shadowRouteMode}`, `candidates:${candidates.length}`, 'preview:shadow'],
        },
      });
      setChannelExplain(result);
      const event = buildPreviewChannelRouteAuditEvent({ channel: 'codex', explain: result });
      setChannelRouteEvents((prev) => (event ? [event, ...prev].slice(0, 5) : prev));
      const decision = buildPreviewChannelRouteDecision({ channel: 'codex', explain: result });
      setChannelRouteDecisions((prev) => (decision ? [decision, ...prev].slice(0, 5) : prev));
      return;
    }
    try {
      const normalizedRule = explainRule ? normalizeProjectCandidatePoolRuleDraft(explainRule, 'codex') : null;
      const projectKey = String(normalizedRule?.projectKey || '').trim();
      const result = await trackRequest('ExplainChannelRouting', { channel: 'codex', projectKey }, () =>
        ExplainChannelRouting(
          main.ChannelRoutingExplainInput.createFrom({
            channel: 'codex',
            requestedModel,
            projectKey,
            projectName: normalizedRule?.projectName || '',
            projectKeySource: normalizedRule?.projectKeySource || '',
            projectKeyConfidence: normalizedRule?.projectKeyConfidence || '',
            projectMatchKeys: projectKey ? [projectKey] : [],
          }),
        ),
      );
      setChannelExplain(result);
      await loadChannelRouteDiagnostics();
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_probe_failed')}: ${toErrorMessage(error)}`);
    }
  }

  async function loadChannelRouteDiagnostics() {
    if (browserMode) {
      return;
    }
    try {
      const [events, decisions] = await Promise.all([
        trackRequest('ListChannelRouteEvents', { channel: 'codex', limit: 5 }, () =>
          ListChannelRouteEvents(main.ChannelRouteEventsInput.createFrom({ channel: 'codex', limit: 5 })),
        ),
        trackRequest('ListChannelRouteDecisions', { channel: 'codex', limit: 5 }, () =>
          ListChannelRouteDecisions(main.ChannelRouteDecisionsInput.createFrom({ channel: 'codex', limit: 5 })),
        ),
      ]);
      setChannelRouteEvents((events || []) as ChannelRouteAuditEvent[]);
      setChannelRouteDecisions((decisions || []) as ChannelRouteDecisionSnapshot[]);
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_probe_failed')}: ${toErrorMessage(error)}`);
    }
  }

  async function loadProjectCandidatePoolProjectSources() {
    if (browserMode || !ready) {
      return;
    }
    try {
      const [liveSnapshot, sessionSnapshot] = await Promise.all([
        trackRequest('GetCodexLiveSessionsSnapshot', { source: 'project-candidate-pool' }, () =>
          GetCodexLiveSessionsSnapshot(),
        ),
        trackRequest('GetCodexSessionManagementSnapshot', { source: 'project-candidate-pool' }, () =>
          GetCodexSessionManagementSnapshot(),
        ),
      ]);
      setProjectCandidatePoolObservedProjects(
        mergeProjectCandidatePoolObservedProjects([
          ...buildProjectCandidatePoolProjectsFromSessionManagementSnapshot(sessionSnapshot, 'session-history'),
          ...buildProjectCandidatePoolProjectsFromCodexLiveSessions(liveSnapshot, sessionSnapshot),
        ]),
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function runRoutingProbe(attempts: number) {
    const model = routingProbeModel.trim();
    if (!ready || !model) {
      return;
    }
    const safeAttempts = Math.max(1, Math.min(5, attempts));
    setRoutingProbeRequestedAttempts(safeAttempts);

    if (browserMode) {
      const firstAvailable = routePolicyPreviewRows[0];
      const previewAttempts = Array.from({ length: safeAttempts }, (_, index) => ({
        index: index + 1,
        success: Boolean(firstAvailable),
        statusCode: firstAvailable ? 200 : 0,
        accountID: firstAvailable?.id || '',
        accountLabel: firstAvailable?.label || '',
        provider: firstAvailable?.provider || '',
        message: t('codex.account_list_probe_preview'),
        evidence: 'browser preview',
      }));
      setRoutingProbeAttempts(previewAttempts);
      setMessage(firstAvailable ? t('codex.account_list_probe_complete') : t('codex.account_list_probe_no_account'));
      return;
    }

    setRoutingProbeRunning(true);
    setRoutingProbeAttempts([]);
    setMessage('');
    try {
      const collectedAttempts: CodexRoutingProbeAttemptView[] = [];
      for (let attemptIndex = 0; attemptIndex < safeAttempts; attemptIndex += 1) {
        const routePolicyInput = buildCodexRoutingProbeRequestInput(model, 1);
        const result = await trackRequest('ProbeCodexAccountRouting', { ...routePolicyInput, index: attemptIndex + 1 }, () =>
          ProbeCodexAccountRouting(
            main.ProbeCodexAccountRoutingInput.createFrom({
              ...routePolicyInput,
            }),
          ),
        );
        const nextAttempts = (result?.attempts || []).map((attempt) => ({
          index: attemptIndex + 1,
          success: attempt.success,
          statusCode: attempt.statusCode,
          accountID: attempt.accountID,
          accountLabel: attempt.accountLabel,
          provider: attempt.provider,
          message: attempt.message,
          evidence: attempt.evidence,
        }));
        collectedAttempts.push(...nextAttempts);
        setRoutingProbeAttempts([...collectedAttempts]);
      }
      await loadChannelRouteDiagnostics();
      setMessage(t('codex.account_list_probe_complete'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_probe_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setRoutingProbeRunning(false);
    }
  }

  async function runDetailOAuthModelProbe(row: CodexAccountRow, model: string) {
    if (row.sourceKind !== 'codex-auth-file' || !row.id.startsWith('acct_')) {
      return;
    }
    const nextModel = model.trim();
    if (!nextModel) {
      setDetailOAuthModelProbeStateByID((prev) => ({
        ...prev,
        [row.id]: {
          model: '',
          status: 'error',
          message: '请选择要测试的模型',
          lastTestedAt: prev[row.id]?.lastTestedAt ?? null,
        },
      }));
      return;
    }

    setDetailOAuthModelProbeStateByID((prev) => ({
      ...prev,
      [row.id]: {
        model: nextModel,
        status: 'loading',
        message: '',
        lastTestedAt: prev[row.id]?.lastTestedAt ?? null,
      },
    }));

    if (browserMode) {
      setDetailOAuthModelProbeStateByID((prev) => ({
        ...prev,
        [row.id]: {
          model: nextModel,
          status: 'success',
          message: `PREVIEW ONLY / ${row.label} 可使用 ${nextModel}`,
          lastTestedAt: Date.now(),
        },
      }));
      return;
    }

    try {
      const result = await trackRequest(
        'ProbeCodexAccountRouting',
        { model: nextModel, accountID: row.id, source: 'codex-account-detail-oauth' },
        () =>
          ProbeCodexAccountRouting(
            main.ProbeCodexAccountRoutingInput.createFrom({
              model: nextModel,
              attempts: 1,
              allowAccountIDs: [row.id],
              orderAccountIDs: [row.id],
              allowFallback: false,
            }),
          ),
      );
      const attempt = result?.attempts?.[0];
      const matched = Boolean(attempt?.success && attempt.accountID === row.id);
      setDetailOAuthModelProbeStateByID((prev) => ({
        ...prev,
        [row.id]: {
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
      setDetailOAuthModelProbeStateByID((prev) => ({
        ...prev,
        [row.id]: {
          model: nextModel,
          status: 'error',
          message: toErrorMessage(error),
          lastTestedAt: Date.now(),
        },
      }));
    }
  }

  function resetRoutePolicy() {
    setRoutingProbeAttempts([]);
  }

  async function toggleAccount(row: CodexAccountRow) {
    if (!ready) {
      return;
    }
    const nextDisabled = !row.disabled;

    if (browserMode) {
      setOrderedRows((prev) => prev.map((item) => (item.id === row.id ? patchCodexAccountRowDisabled(item, nextDisabled) : item)));
      publishAccountDisabledChange({ id: row.id, disabled: nextDisabled }, 'codex-account-list');
      setMessage(nextDisabled ? t('codex.account_list_disabled') : t('codex.account_list_enabled'));
      return;
    }

    setPendingToggleID(row.id);
    setMessage('');
    try {
      await trackRequest('SetAccountDisabled', { id: row.id, disabled: nextDisabled }, () =>
        SetAccountDisabled(row.id, nextDisabled)
      );
      publishAccountDisabledChange({ id: row.id, disabled: nextDisabled }, 'codex-account-list');
      await reload(row.disabled ? t('codex.account_list_enabled') : t('codex.account_list_disabled'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_status_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setPendingToggleID(null);
    }
  }

  async function toggleManualRequestable(row: CodexAccountRow) {
    if (!ready || saving || pendingManualRequestableID) {
      return;
    }

    const nextManualRequestable = row.manualRequestable !== true;
    const previousRows = orderedRows;
    const previousConfig = channelConfig;
    const nextManualRequestableAccountIDs = new Set(channelConfig.manualRequestableAccountIDs);
    if (nextManualRequestable) {
      nextManualRequestableAccountIDs.add(row.id);
    } else {
      nextManualRequestableAccountIDs.delete(row.id);
    }
    const nextRows = orderedRows.map((item) =>
      item.id === row.id ? patchCodexAccountRowManualRequestable(item, nextManualRequestable) : item,
    );
    const nextConfig = withCurrentChannelOrder(
      updateChannelRoutingConfig(channelConfig, {
        manualRequestableAccountIDs: Array.from(nextManualRequestableAccountIDs),
      }),
      nextRows.map((item) => item.id),
    );

    setPendingManualRequestableID(row.id);
    setOrderedRows(nextRows);
    setChannelConfig(nextConfig);
    setChannelExplain(null);
    setMessage('');

    if (browserMode) {
      setPendingManualRequestableID(null);
      setMessage(
        nextManualRequestable
          ? t('codex.account_list_manual_requestable_saved')
          : t('codex.account_list_manual_requestable_removed'),
      );
      return;
    }

    const saved = await persistChannelRoutingConfig(nextConfig, { reloadAfterSave: false });
    if (saved) {
      setMessage(
        nextManualRequestable
          ? t('codex.account_list_manual_requestable_saved')
          : t('codex.account_list_manual_requestable_removed'),
      );
    } else {
      setOrderedRows(previousRows);
      setChannelConfig(previousConfig);
    }
    setPendingManualRequestableID(null);
  }

  async function saveDetailConfig(row: CodexAccountRow, draft: ApiKeyConfigDraft, mappings: CodexModelMappingRow[]) {
    if (!canEditCodexModelMappings(row.sourceKind) || row.sourceKind === 'codex-auth-file') {
      return;
    }

    const normalizedModels = normalizeCodexModelMappingsForProvider(mappings);
    const nextMappings = buildOpenAICompatibleModelMappings({ models: normalizedModels });
    const nextAPIKey = draft.apiKey.trim();
    const nextBaseURL = draft.baseUrl.trim();
    const nextPrefix = draft.prefix.trim();
    const nextProxyURL = draft.proxyUrl.trim();
    const nextQuotaCurl = draft.quotaCurl.trim();
    const nextBillingCurl = draft.billingCurl.trim();

    if (browserMode) {
      setOrderedRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                apiKey: nextAPIKey,
                apiKeys: nextAPIKey ? [nextAPIKey] : item.apiKeys,
                baseUrl: nextBaseURL,
                prefix: nextPrefix,
                proxyUrl: nextProxyURL,
                quotaCurl: nextQuotaCurl,
                quotaEnabled: Boolean(draft.quotaEnabled && nextQuotaCurl),
                billingCurl: nextBillingCurl,
                billingEnabled: Boolean(draft.billingEnabled && nextBillingCurl),
                modelMappings: nextMappings,
              }
            : item,
        ),
      );
      setMessage(t('codex.account_list_model_mapping_saved'));
      return;
    }

    setPendingMappingID(row.id);
    try {
      if (row.sourceKind === 'openai-compatible') {
        await trackRequest('UpdateOpenAICompatibleProvider', { id: row.id, baseUrl: nextBaseURL, models: normalizedModels }, () =>
          UpdateOpenAICompatibleProvider(
            main.UpdateOpenAICompatibleProviderInput.createFrom({
              currentName: row.id.startsWith('acct_') ? row.id : row.provider,
              name: row.provider,
              baseUrl: nextBaseURL,
              prefix: nextPrefix,
              apiKey: nextAPIKey,
              apiKeys: nextAPIKey ? [nextAPIKey] : [],
              proxyUrl: nextProxyURL,
              headers: row.headers || {},
              models: normalizedModels,
            }),
          ),
        );
      } else {
        await trackRequest('UpdateCodexAPIKeyConfig', { id: row.id, baseUrl: nextBaseURL, models: normalizedModels }, () =>
          UpdateCodexAPIKeyConfig(
            main.UpdateCodexAPIKeyConfigInput.createFrom({
              id: row.id,
              apiKey: nextAPIKey,
              baseUrl: nextBaseURL,
              prefix: nextPrefix,
              proxyUrl: nextProxyURL,
              models: normalizedModels,
              quotaCurl: nextQuotaCurl,
              quotaEnabled: Boolean(draft.quotaEnabled && nextQuotaCurl),
              billingCurl: nextBillingCurl,
              billingEnabled: Boolean(draft.billingEnabled && nextBillingCurl),
            }),
          ),
        );
      }
      await reload(t('codex.account_list_model_mapping_saved'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_model_mapping_save_failed')}: ${toErrorMessage(error)}`);
      throw error;
    } finally {
      setPendingMappingID(null);
    }
  }

  async function saveModelMappings(row: CodexAccountRow, mappings: CodexModelMappingRow[]) {
    if (!canEditCodexModelMappings(row.sourceKind)) {
      return;
    }

    const normalizedModels = normalizeCodexModelMappingsForProvider(mappings);
    const nextMappings = buildOpenAICompatibleModelMappings({ models: normalizedModels });
    if (row.sourceKind === 'codex-auth-file') {
      if (browserMode) {
        setAuthFileModelMappings((prev) => ({ ...prev, [row.id]: nextMappings }));
        setOrderedRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, modelMappings: nextMappings } : item)));
        setMessage(t('codex.account_list_model_mapping_saved'));
        return;
      }

      const channel = row.provider.trim().toLowerCase() || 'codex';
      setPendingMappingID(row.id);
      try {
        await trackRequest('UpdateOAuthModelAliases', { channel, models: normalizedModels }, () =>
          UpdateOAuthModelAliases(
            main.UpdateOAuthModelAliasesInput.createFrom({
              channel,
              models: normalizedModels,
            }),
          ),
        );
        setAuthFileModelMappings((prev) => ({ ...prev, [row.id]: nextMappings }));
        setMessage(t('codex.account_list_model_mapping_saved'));
      } catch (error) {
        console.error(error);
        setMessage(`${t('codex.account_list_model_mapping_save_failed')}: ${toErrorMessage(error)}`);
        throw error;
      } finally {
        setPendingMappingID(null);
      }
      return;
    }

    if (browserMode) {
      setOrderedRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                modelMappings: buildOpenAICompatibleModelMappings({ models: normalizedModels }),
              }
            : item,
        ),
      );
      setMessage(t('codex.account_list_model_mapping_saved'));
      return;
    }

    setPendingMappingID(row.id);
    try {
      if (row.sourceKind === 'openai-compatible') {
        await trackRequest('UpdateOpenAICompatibleProvider', { id: row.id, models: normalizedModels }, () =>
          UpdateOpenAICompatibleProvider(
            main.UpdateOpenAICompatibleProviderInput.createFrom({
              currentName: row.id.startsWith('acct_') ? row.id : row.provider,
              name: row.provider,
              baseUrl: row.baseUrl,
              prefix: row.prefix,
              apiKey: row.apiKey || row.apiKeys?.[0] || '',
              apiKeys: row.apiKeys && row.apiKeys.length > 0 ? row.apiKeys : row.apiKey ? [row.apiKey] : [],
              headers: row.headers || {},
              models: normalizedModels,
            }),
          ),
        );
      } else {
        await trackRequest('UpdateCodexAPIKeyConfig', { id: row.id, models: normalizedModels }, () =>
          UpdateCodexAPIKeyConfig(
            main.UpdateCodexAPIKeyConfigInput.createFrom({
              id: row.id,
              apiKey: row.apiKey || '',
              baseUrl: row.baseUrl,
              prefix: row.prefix,
              proxyUrl: row.proxyUrl || '',
              models: normalizedModels,
              quotaCurl: row.quotaCurl || '',
              quotaEnabled: Boolean(row.quotaEnabled && row.quotaCurl),
              billingCurl: row.billingCurl || '',
              billingEnabled: Boolean(row.billingEnabled && row.billingCurl),
            }),
          ),
        );
      }
      await reload(t('codex.account_list_model_mapping_saved'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_model_mapping_save_failed')}: ${toErrorMessage(error)}`);
      throw error;
    } finally {
      setPendingMappingID(null);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  const projectCandidatePoolRulesAPI = browserMode
    ? undefined
    : {
        create: (rule: ProjectCandidatePoolRuleLike) =>
          CreateProjectCandidatePoolRule(main.ProjectCandidatePoolRule.createFrom(rule)),
        update: (rule: ProjectCandidatePoolRuleLike) =>
          UpdateProjectCandidatePoolRule(main.ProjectCandidatePoolRule.createFrom(rule)),
        delete: (input: { id: string }) =>
          DeleteProjectCandidatePoolRule(main.DeleteProjectCandidatePoolRuleInput.createFrom(input)),
      };

  function handleProjectCandidatePoolRulesChange(rules: ProjectCandidatePoolRuleLike[]) {
    setProjectCandidatePoolRules(rules);
    setChannelExplain(null);
  }

  function handleDiagnosticModelChange(model: string) {
    setRoutingProbeModel(model);
    setChannelExplain(null);
  }

  function handleDiagnosticProjectChange(projectKey: string) {
    setSelectedProjectCandidatePoolKey(projectKey);
    setChannelExplain(null);
  }

  return (
    <div className="h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_ACCOUNT_LIST">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-8">
        <WorkspacePageHeader
          title={t('codex.account_list_title')}
          subtitle={t('codex.account_list_subtitle')}
          align="center"
          actions={
            <Button
              icon={<Terminal className="h-3.5 w-3.5" strokeWidth={4} />}
              size="small"
              onClick={openRouteProbeModal}
            >
              {t('codex.account_list_probe_open')}
            </Button>
          }
        />

        <ChannelRoutingWorkbench
          channel="codex"
          config={withCurrentChannelOrder(channelConfig, orderedRows.map((row) => row.id))}
          explain={channelExplain}
          routeDecisions={channelRouteDecisions}
          disabled={!ready || saving}
          saving={saving}
          message={orderChanged ? t('codex.account_list_unsaved') : ''}
          accounts={orderedRows}
          modelOptions={routingProbeModelOptions}
          modelValue={routingProbeModel}
          projectOptions={projectCandidatePoolProjectOptions}
          projectValue={selectedProjectCandidatePoolKey}
          onModeChange={updateChannelMode}
          onOpenProjectConfig={openProjectConfigModal}
          onModelChange={handleDiagnosticModelChange}
          onProjectChange={handleDiagnosticProjectChange}
          onShadowModeChange={updateShadowMode}
          onExplain={() => void runChannelExplain()}
        />

        <CodexAccountOrderSection
          title={t('codex.account_list_order')}
          hint={ready ? t('codex.account_list_order_hint') : t('codex.account_list_waiting_ready')}
          message={message}
          ready={ready}
          loading={loading}
          saving={saving}
          routingProbeRunning={routingProbeRunning}
          orderChanged={orderChanged}
          rows={orderedRows}
          draggedID={draggedID}
          pendingToggleID={pendingToggleID}
          pendingManualRequestableID={pendingManualRequestableID}
          latestRoutingProbeAccountID={latestRoutingProbeAccountID}
          routePolicyRowStates={routePolicyRowStates}
          codexQuotaByName={codexQuotaByName}
          accountUsageByID={accountUsageByID}
          usageRefreshingAccountIDSet={usageRefreshingAccountIDSet}
          accountRateLimitByID={accountRateLimitByID}
          rateLimitRefreshingAccountIDSet={rateLimitRefreshingAccountIDSet}
          refreshLabel={t('common.refresh')}
          loadingLabel={t('common.loading')}
          savingLabel={t('codex.account_list_saving')}
          unsavedLabel={t('codex.account_list_unsaved')}
          emptyLabel={t('codex.account_list_empty')}
          waitingLabel={t('codex.account_list_waiting_ready')}
          t={t}
          onReload={() => void reload()}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          onOpenDetail={openDetail}
          onToggle={(row) => void toggleAccount(row)}
          onToggleManualRequestable={(row) => void toggleManualRequestable(row)}
          onRefreshQuota={refreshOrderAccount}
        />
      </div>
      {routeProbeOpen ? (
        <RouteProbeCard
          t={t}
          routingProbeModel={routingProbeModel}
          routingProbeModelOptions={routingProbeModelOptions}
          routingProbeRunning={routingProbeRunning}
          routingProbeDisabled={routingProbeDisabled || routePolicyPreviewRows.length === 0}
          routePolicyPreviewRows={routePolicyPreviewRows}
          routingProbeStreamLines={routingProbeStreamLines}
          onClose={closeRouteProbeModal}
          onModelChange={setRoutingProbeModel}
          onProbeOnce={() => void runRoutingProbe(1)}
          onProbeSeries={() => void runRoutingProbe(3)}
          onReset={resetRoutePolicy}
        />
      ) : null}
      {projectConfigOpen ? (
        <ProjectCandidatePoolRulesModal
          channel="codex"
          rules={projectCandidatePoolRules}
          projectOptions={projectCandidatePoolProjectOptions}
          accounts={orderedRows}
          disabled={!ready || saving}
          saving={saving}
          api={projectCandidatePoolRulesAPI}
          onClose={closeProjectConfigModal}
          onRulesChange={handleProjectCandidatePoolRulesChange}
          onPreviewRule={(rule) => void runChannelExplain(rule)}
        />
      ) : null}
      {detailRowWithModels ? (
        <CodexAccountDetailModal
          row={detailRowWithModels}
          t={t}
          quotaState={detailRowWithModels.quotaKey ? codexQuotaByName[detailRowWithModels.quotaKey] : undefined}
          usageSummary={accountUsageByID[detailRowWithModels.id]}
          rateLimitStatus={accountRateLimitByID[detailRowWithModels.id]}
          rateLimitStrategies={rateLimitStrategies}
          rateLimitRulesAPI={browserMode
            ? undefined
            : {
                list: ListRateLimitRules,
                create: CreateRateLimitRule,
                update: UpdateRateLimitRule,
                delete: DeleteRateLimitRule,
              }}
          savingMappings={pendingMappingID === detailRowWithModels.id}
          loadingModelMappings={loadingAuthFileModelID === detailRowWithModels.id}
          modelMappingError={authFileModelErrors[detailRowWithModels.id] || ''}
          modelOptions={
            detailRowWithModels.sourceKind === 'codex-auth-file'
              ? authFileModelOptions[detailRowWithModels.id] || []
              : openAICompatibleModelOptions[detailRowWithModels.id]?.length
                ? openAICompatibleModelOptions[detailRowWithModels.id]
                : detailRowWithModels.modelMappings
          }
          codexModelOptions={codexModelCatalogOptions}
          loadingModelOptions={loadingOpenAICompatibleModelID === detailRowWithModels.id}
          modelOptionError={openAICompatibleModelErrors[detailRowWithModels.id] || ''}
          oauthModelProbeState={detailOAuthModelProbeStateByID[detailRowWithModels.id]}
          onClose={closeDetail}
          onSaveConfig={(draft, mappings) => saveDetailConfig(detailRowWithModels, draft, mappings)}
          onRateLimitRulesChanged={() => void loadAccountRateLimits(orderedRows.map(buildCodexQuotaSummaryAccount))}
          onSaveModelMappings={(mappings) => saveModelMappings(detailRowWithModels, mappings)}
          onFetchModelOptions={() => void fetchDetailModelOptions(detailRowWithModels)}
          onOAuthModelProbe={
            detailRowWithModels.sourceKind === 'codex-auth-file' && detailRowWithModels.id.startsWith('acct_')
              ? (model) => void runDetailOAuthModelProbe(detailRowWithModels, model)
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function buildDefaultChannelRoutingConfig(channel: 'codex', orderedAccountIDs: string[] = []): ChannelRoutingConfig {
  return normalizeChannelRoutingConfig(
    {
      channel,
      routeMode: 'sequential',
      orderedAccountIDs,
      manualRequestableAccountIDs: [],
      accountGroups: [],
      channelGroupStates: {},
      shadowEnabled: false,
      shadowRouteMode: 'balanced',
    },
    { channel },
  ).config;
}

function mapWailsChannelRoutingConfig(input: main.ChannelRoutingConfig | null | undefined, channel: 'codex'): ChannelRoutingConfig {
  return normalizeChannelRoutingConfig(
    {
      channel: input?.channel || channel,
      routeMode: input?.routeMode,
      orderedAccountIDs: input?.orderedAccountIDs || [],
      manualRequestableAccountIDs: input?.manualRequestableAccountIDs || [],
      accountGroups: input?.accountGroups || [],
      channelGroupStates: input?.channelGroupStates || {},
      shadowEnabled: input?.shadowEnabled,
      shadowRouteMode: input?.shadowRouteMode,
    },
    { channel },
  ).config;
}

function withCurrentChannelOrder(config: ChannelRoutingConfig, orderedAccountIDs: string[]): ChannelRoutingConfig {
  return updateChannelRoutingConfig(config, { orderedAccountIDs });
}

function applyChannelOrderToRows<T extends { id: string }>(rows: T[], orderedAccountIDs: string[]): T[] {
  const rank = new Map(orderedAccountIDs.map((id, index) => [id, index]));
  return [...rows].sort((left, right) => {
    const leftRank = rank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return rows.indexOf(left) - rows.indexOf(right);
  });
}

function codexRowToAccountRecord(row: CodexAccountRow): AccountRecord {
  return buildCodexQuotaSummaryAccount(row);
}

function buildSelectedProjectCandidatePoolRule(
  projectKey: string,
  rules: ProjectCandidatePoolRuleLike[],
  projectOptions: ProjectCandidatePoolProjectOption[],
): ProjectCandidatePoolRuleLike | null {
  const selectedKey = String(projectKey || '').trim();
  if (!selectedKey) {
    return null;
  }
  const existingRule = rules.find((rule) => String(rule.projectKey || '').trim() === selectedKey);
  if (existingRule) {
    return existingRule;
  }
  const option = projectOptions.find((item) => item.projectKey === selectedKey);
  if (!option) {
    return null;
  }
  return {
    channel: 'codex',
    projectKey: option.projectKey,
    projectName: option.projectName,
    projectKeySource: option.projectKeySource,
    projectKeyConfidence: option.projectKeyConfidence,
    enabled: true,
    allowAccountIDs: [],
  };
}
