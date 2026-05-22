import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import {
  FetchOpenAICompatibleProviderModels,
  GetAuthFileModels,
  ListOAuthModelAliases,
  ListAccounts,
  ListOpenAICompatibleProviders,
  ListRelaySupportedModels,
  ProbeCodexAccountRouting,
  SetAccountDisabled,
  UpdateOAuthModelAliases,
  UpdateAccountPriority,
  UpdateOpenAICompatibleProvider,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import type { AccountRecord, SidecarStatus } from '../../types';
import { toErrorMessage } from '../../utils/error';
import { buildCodexDetailFrameHash, clearCodexDetailFrameHash, readFrameHashState } from '../../utils/pagePersistence';
import { hasWailsAppBindings } from '../../utils/previewMode';
import useAccountsQuotaState from '../accounts/hooks/useAccountsQuotaState';
import useAccountsRateLimitState from '../accounts/hooks/useAccountsRateLimitState';
import useAccountsUsageState from '../accounts/hooks/useAccountsUsageState';
import { getAccountsPreviewCodexAccounts } from '../accounts/previewData';
import { mapBackendAccountRecord } from '../accounts/model/accountPresentation';
import {
  ACCOUNT_USAGE_REFRESH_INTERVAL_MS,
  shouldScheduleAccountUsageRefresh,
} from '../accounts/model/accountUsage';
import { CodexAccountDetailModal, CodexAccountOrderSection, RouteProbeCard } from './components/CodexAccountListView';
import { getCodexAccountListPreviewAuthFileModelOptions, getCodexAccountListPreviewRows } from './previewData';
import {
  applyCodexAccountPriorities,
  buildCodexAuthFileModelMappings,
  buildCodexAccountPriorityUpdates,
  buildCodexAccountRows,
  buildCodexQuotaSummaryAccount,
  buildCodexRoutePolicyPreview,
  buildCodexRoutePolicyRowStates,
  buildCodexRoutingProbeModelOptions,
  buildCodexRoutingProbeStreamLines,
  buildOpenAICompatibleModelMappings,
  DEFAULT_CODEX_ROUTING_PROBE_MODEL,
  mergeCodexAuthFileModelMappings,
  normalizeCodexModelMappingsForProvider,
  normalizeCodexAccountIDList,
  reorderCodexAccountRows,
  resolveCodexRoutingProbeDefaultModel,
  type CodexAccountRow,
  type CodexModelMappingRow,
  type CodexRoutePolicyRowMode,
  type CodexRoutingProbeAttemptView,
} from './model/codexAccountList';

interface CodexAccountListFeatureProps {
  sidecarStatus: SidecarStatus;
}

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
  const [routePolicyAllowIDs, setRoutePolicyAllowIDs] = useState<string[]>([]);
  const [routePolicyDenyIDs, setRoutePolicyDenyIDs] = useState<string[]>([]);
  const [routePolicyAllowFallback, setRoutePolicyAllowFallback] = useState(false);
  const [routingProbeAttempts, setRoutingProbeAttempts] = useState<CodexRoutingProbeAttemptView[]>([]);
  const [routingProbeRequestedAttempts, setRoutingProbeRequestedAttempts] = useState(1);
  const [routingProbeRunning, setRoutingProbeRunning] = useState(false);
  const [routeProbeOpen, setRouteProbeOpen] = useState(false);
  const [detailRowID, setDetailRowID] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [orderDirty, setOrderDirty] = useState(false);
  const [autoSaveOrderRequested, setAutoSaveOrderRequested] = useState(false);
  const suppressNextDetailClickRef = useRef(false);
  const { codexQuotaByName, loadCodexQuotas } = useAccountsQuotaState(trackRequest);
  const { accountUsageByID, loadAccountUsage } = useAccountsUsageState(trackRequest);
  const { accountRateLimitByID, loadAccountRateLimits } = useAccountsRateLimitState(trackRequest);

  const priorityUpdates = useMemo(() => buildCodexAccountPriorityUpdates(orderedRows), [orderedRows]);
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
  const routingProbeModelOptions = useMemo(() => buildCodexRoutingProbeModelOptions(orderedRows), [orderedRows]);
  const requestableRows = useMemo(() => orderedRows.filter((row) => row.requestable), [orderedRows]);
  const requestableOrderIDs = useMemo(() => requestableRows.map((row) => row.id), [requestableRows]);
  const routePolicyDraft = useMemo(
    () => ({
      allowAccountIDs: routePolicyAllowIDs,
      denyAccountIDs: routePolicyDenyIDs,
      orderAccountIDs: requestableOrderIDs,
      allowFallback: routePolicyAllowFallback,
    }),
    [requestableOrderIDs, routePolicyAllowFallback, routePolicyAllowIDs, routePolicyDenyIDs],
  );
  const routePolicyPreviewRows = useMemo(
    () => buildCodexRoutePolicyPreview(orderedRows, routePolicyDraft),
    [orderedRows, routePolicyDraft],
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
  const latestRoutingProbeExpectedID = routePolicyPreviewRows[0]?.id || '';
  const latestRoutingProbeUsedFallback =
    Boolean(latestRoutingProbeAccountID && latestRoutingProbeExpectedID) &&
    latestRoutingProbeAccountID !== latestRoutingProbeExpectedID;
  const routingProbeDisabled = !ready || saving || routingProbeRunning || !routingProbeModel.trim();

  async function reload(messageOverride?: string) {
    if (browserMode) {
      const previewAccounts = getAccountsPreviewCodexAccounts();
      setOrderedRows(getCodexAccountListPreviewRows());
      setOrderDirty(false);
      void loadCodexQuotas(previewAccounts);
      const previewUsageAccounts: AccountRecord[] = [
        ...previewAccounts,
        {
          id: 'openai-compatible:deepseek',
          provider: 'deepseek',
          credentialSource: 'api-key',
          displayName: 'DeepSeek',
          status: 'configured',
        },
        {
          id: 'openai-compatible:openrouter',
          provider: 'openrouter',
          credentialSource: 'api-key',
          displayName: 'OpenRouter',
          status: 'disabled',
          disabled: true,
        },
      ];
      void loadAccountUsage(previewUsageAccounts);
      void loadAccountRateLimits(previewUsageAccounts);
      setMessage(messageOverride || t('codex.account_list_preview_loaded'));
      return;
    }

    if (!ready) {
      setOrderedRows([]);
      setMessage(t('codex.account_list_waiting_ready'));
      return;
    }

    setLoading(true);
    try {
      const [accountResponse, providerResponse] = await Promise.all([
        trackRequest('ListAccounts', { args: [] }, () => ListAccounts()),
        trackRequest('ListOpenAICompatibleProviders', { args: [] }, () => ListOpenAICompatibleProviders()),
      ]);
      const accountRows = (accountResponse || []).map((account) => mapBackendAccountRecord(account));
      const nextProviders = providerResponse || [];
      const nextRows = buildCodexAccountRows({
        accounts: accountRows,
        providers: nextProviders,
      });
      const nextUsageAccounts = nextRows.map((row) => codexRowToAccountRecord(row));
      void loadCodexQuotas(accountRows);
      void loadAccountUsage(nextUsageAccounts);
      void loadAccountRateLimits(nextUsageAccounts);
      setOrderedRows(nextRows);
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
    setRoutingProbeModel(resolveCodexRoutingProbeDefaultModel(orderedRows));
  }, [orderedRows, routingProbeModel]);

  useEffect(() => {
    setRoutePolicyAllowIDs((prev) => filterCodexAccountIDs(prev, requestableOrderIDs));
    setRoutePolicyDenyIDs((prev) => filterCodexAccountIDs(prev, requestableOrderIDs));
  }, [requestableOrderIDs]);

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
          setCodexModelCatalogOptions(buildCodexAuthFileModelMappings(result?.models || []));
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

    const authFileName = readAuthFileNameFromRowID(detailRow.id);
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncDetailFromHash = () => {
      const hashState = readFrameHashState(window.location.hash);
      if (hashState?.page === 'codex' && hashState.codexWorkspace === 'account-list' && hashState.accountDetailID) {
        setDetailRowID(hashState.accountDetailID);
        return;
      }
      setDetailRowID(null);
    };

    syncDetailFromHash();
    window.addEventListener('hashchange', syncDetailFromHash);
    return () => {
      window.removeEventListener('hashchange', syncDetailFromHash);
    };
  }, []);

  async function saveOrder() {
    if (!ready || !orderChanged || saving) {
      return;
    }

    if (browserMode) {
      setOrderedRows((prev) => applyCodexAccountPriorities(prev));
      setOrderDirty(false);
      setMessage(t('codex.account_list_preview_saved'));
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      for (const update of priorityUpdates) {
        await trackRequest('UpdateAccountPriority', update, () => UpdateAccountPriority(update));
      }
      setOrderDirty(false);
      await reload(t('codex.account_list_saved'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_save_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
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
  }, [autoSaveOrderRequested, draggedID, orderChanged, priorityUpdates, saving]);

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
        const routePolicyInput = {
          model,
          attempts: 1,
          allowAccountIDs: routePolicyAllowIDs,
          denyAccountIDs: routePolicyDenyIDs,
          orderAccountIDs: requestableOrderIDs,
          allowFallback: routePolicyAllowFallback,
        };
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
      setMessage(t('codex.account_list_probe_complete'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_probe_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setRoutingProbeRunning(false);
    }
  }

  function setRoutePolicyMode(id: string, mode: Exclude<CodexRoutePolicyRowMode, 'blocked'>) {
    setRoutePolicyAllowIDs((prev) => {
      const filtered = normalizeCodexAccountIDList(prev).filter((item) => item !== id);
      return mode === 'allow' ? [...filtered, id] : filtered;
    });
    setRoutePolicyDenyIDs((prev) => {
      const filtered = normalizeCodexAccountIDList(prev).filter((item) => item !== id);
      return mode === 'deny' ? [...filtered, id] : filtered;
    });
  }

  function resetRoutePolicy() {
    setRoutePolicyAllowIDs([]);
    setRoutePolicyDenyIDs([]);
    setRoutePolicyAllowFallback(false);
    setRoutingProbeAttempts([]);
  }

  async function toggleAccount(row: CodexAccountRow) {
    if (!ready) {
      return;
    }

    if (browserMode) {
      setOrderedRows((prev) =>
        prev.map((item) => {
          if (item.id !== row.id) {
            return item;
          }
          const disabled = !item.disabled;
          const status = disabled ? 'disabled' : item.status === 'disabled' ? 'configured' : item.status;
          const requestable = !disabled && ['ACTIVE', 'CONFIGURED', 'LOCAL'].includes(status.trim().toUpperCase());
          return {
            ...item,
            disabled,
            requestable,
            blockReason: requestable ? '' : disabled ? 'disabled' : item.blockReason || status,
            status,
          };
        }),
      );
      setMessage(t('codex.account_list_preview_status_updated'));
      return;
    }

    setPendingToggleID(row.id);
    setMessage('');
    try {
      await trackRequest('SetAccountDisabled', { id: row.id, disabled: !row.disabled }, () =>
        SetAccountDisabled(row.id, !row.disabled)
      );
      await reload(row.disabled ? t('codex.account_list_enabled') : t('codex.account_list_disabled'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_status_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setPendingToggleID(null);
    }
  }

  async function saveModelMappings(row: CodexAccountRow, mappings: CodexModelMappingRow[]) {
    if (row.sourceKind !== 'openai-compatible' && row.sourceKind !== 'codex-auth-file') {
      return;
    }

    const normalizedModels = normalizeCodexModelMappingsForProvider(mappings);
    if (row.sourceKind === 'codex-auth-file') {
      const nextMappings = buildOpenAICompatibleModelMappings({ models: normalizedModels });
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
      await trackRequest('UpdateOpenAICompatibleProvider', { id: row.id, models: normalizedModels }, () =>
        UpdateOpenAICompatibleProvider(
          main.UpdateOpenAICompatibleProviderInput.createFrom({
            currentName: row.provider,
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

  return (
    <div className="h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_ACCOUNT_LIST">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-8">
        <WorkspacePageHeader
          title={t('codex.account_list_title')}
          subtitle={t('codex.account_list_subtitle')}
          align="center"
          actions={
            <button
              type="button"
              onClick={() => setRouteProbeOpen(true)}
              className="btn-swiss flex min-h-10 items-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-sm)]"
            >
              <Terminal className="h-3.5 w-3.5" strokeWidth={4} />
              {t('codex.account_list_probe_open')}
            </button>
          }
        />

        <CodexAccountOrderSection
          title={t('codex.account_list_order')}
          hint={
            browserMode
              ? t('codex.account_list_browser_hint')
              : ready
                ? t('codex.account_list_order_hint')
                : t('codex.account_list_waiting_ready')
          }
          message={message}
          ready={ready}
          loading={loading}
          saving={saving}
          routingProbeRunning={routingProbeRunning}
          orderChanged={orderChanged}
          rows={orderedRows}
          draggedID={draggedID}
          pendingToggleID={pendingToggleID}
          latestRoutingProbeAccountID={latestRoutingProbeAccountID}
          routePolicyRowStates={routePolicyRowStates}
          codexQuotaByName={codexQuotaByName}
          accountUsageByID={accountUsageByID}
          accountRateLimitByID={accountRateLimitByID}
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
          onPolicyModeChange={setRoutePolicyMode}
        />
      </div>
      {routeProbeOpen ? (
        <RouteProbeCard
          t={t}
          routingProbeModel={routingProbeModel}
          routingProbeModelOptions={routingProbeModelOptions}
          routingProbeRunning={routingProbeRunning}
          routingProbeDisabled={routingProbeDisabled || routePolicyPreviewRows.length === 0}
          allowFallback={routePolicyAllowFallback}
          routePolicyPreviewRows={routePolicyPreviewRows}
          routingProbeStreamLines={routingProbeStreamLines}
          latestUsedFallback={latestRoutingProbeUsedFallback}
          onClose={() => setRouteProbeOpen(false)}
          onFallbackChange={() => setRoutePolicyAllowFallback((prev) => !prev)}
          onModelChange={setRoutingProbeModel}
          onProbeOnce={() => void runRoutingProbe(1)}
          onProbeSeries={() => void runRoutingProbe(3)}
          onReset={resetRoutePolicy}
        />
      ) : null}
      {detailRowWithModels ? (
        <CodexAccountDetailModal
          row={detailRowWithModels}
          t={t}
          quotaState={detailRowWithModels.quotaKey ? codexQuotaByName[detailRowWithModels.quotaKey] : undefined}
          usageSummary={accountUsageByID[detailRowWithModels.id]}
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
          onClose={closeDetail}
          onSaveModelMappings={(mappings) => saveModelMappings(detailRowWithModels, mappings)}
        />
      ) : null}
    </div>
  );
}

function readAuthFileNameFromRowID(rowID: string) {
  const prefix = 'auth-file:';
  return rowID.startsWith(prefix) ? rowID.slice(prefix.length) : '';
}

function filterCodexAccountIDs(previous: string[], availableIDs: string[]) {
  const available = new Set(availableIDs);
  return normalizeCodexAccountIDList(previous).filter((id) => available.has(id));
}

function codexRowToAccountRecord(row: CodexAccountRow): AccountRecord {
  return buildCodexQuotaSummaryAccount(row);
}
