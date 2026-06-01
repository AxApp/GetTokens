import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import {
  ExplainChannelRouting,
  FetchOpenAICompatibleProviderModels,
  GetAuthFileModels,
  GetChannelRoutingConfig,
  ListChannelRouteEvents,
  ListAccounts,
  ListOAuthModelAliases,
  ProbeClaudeCodeAccountRouting,
  SaveChannelRoutingConfig,
  SetAccountDisabled,
  UpdateCodexAPIKeyConfig,
  UpdateOAuthModelAliases,
  UpdateOpenAICompatibleProvider,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/useDebug';
import { useI18n } from '../../context/I18nContext';
import type { SidecarStatus } from '../../types';
import { toErrorMessage } from '../../utils/error';
import {
  buildClaudeDetailFrameHash,
  buildClaudeModalFrameHash,
  clearClaudeDetailFrameHash,
  clearClaudeModalFrameHash,
  readFrameHashState,
} from '../../utils/pagePersistence';
import { hasWailsAppBindings } from '../../utils/previewMode';
import { mapBackendAccountRecord } from '../accounts/model/accountPresentation';
import ChannelRoutingWorkbench from '../channel-routing/components/ChannelRoutingWorkbench';
import {
  buildPreviewChannelRouteAuditEvent,
  normalizeChannelRoutingConfig,
  updateChannelRoutingConfig,
  type ChannelRouteAuditEvent,
  type ChannelRouteMode,
  type ChannelRoutingConfig,
} from '../channel-routing/model/channelRouting';
import { CodexAccountDetailModal, CodexAccountOrderSection, RouteProbeCard } from '../codex/components/CodexAccountListView';
import {
  buildCodexAuthFileModelMappings,
  buildCodexRoutePolicyPreview,
  buildCodexRoutePolicyRowStates,
  buildCodexRoutingProbeModelOptions,
  buildCodexRoutingProbeRequestInput,
  buildCodexRoutingProbeStreamLines,
  mergeCodexAuthFileModelMappings,
  resolveCodexRoutingProbeDefaultModel,
  type CodexModelMappingRow,
  type CodexRoutingProbeAttemptView,
} from '../codex/model/codexAccountList';
import {
  buildClaudeCodeAccountRows,
  buildClaudeCodeAccountSummary,
  buildClaudeCodeModelMappings,
  normalizeClaudeCodeModelMappingsForProvider,
  reorderClaudeCodeAccountRows,
  resolveClaudeCodeProviderProfile,
  type ClaudeCodeAccountRow,
} from './model/claudeCodeAccountList';
import { getClaudeCodeAccountListPreviewAccounts, getClaudeCodeAccountListPreviewRows } from './previewData';

const DEFAULT_CLAUDE_CODE_PROBE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_OAUTH_MODEL_ALIAS_CHANNEL = 'claude';

interface ClaudeCodeAccountListFeatureProps {
  sidecarStatus: SidecarStatus;
}

export default function ClaudeCodeAccountListFeature({ sidecarStatus }: ClaudeCodeAccountListFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const browserMode = !hasWailsAppBindings();
  const ready = browserMode || sidecarStatus?.code === 'ready';
  const [orderedRows, setOrderedRows] = useState<ClaudeCodeAccountRow[]>([]);
  const [draggedID, setDraggedID] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingToggleID, setPendingToggleID] = useState<string | null>(null);
  const [pendingMappingID, setPendingMappingID] = useState<string | null>(null);
  const [loadingAuthFileModelID, setLoadingAuthFileModelID] = useState<string | null>(null);
  const [authFileModelMappings, setAuthFileModelMappings] = useState<Record<string, CodexModelMappingRow[]>>({});
  const [authFileModelOptions, setAuthFileModelOptions] = useState<Record<string, CodexModelMappingRow[]>>({});
  const [authFileModelErrors, setAuthFileModelErrors] = useState<Record<string, string>>({});
  const [loadingRemoteModelID, setLoadingRemoteModelID] = useState<string | null>(null);
  const [remoteModelOptions, setRemoteModelOptions] = useState<Record<string, CodexModelMappingRow[]>>({});
  const [remoteModelErrors, setRemoteModelErrors] = useState<Record<string, string>>({});
  const [routingProbeModel, setRoutingProbeModel] = useState(DEFAULT_CLAUDE_CODE_PROBE_MODEL);
  const [routingProbeAttempts, setRoutingProbeAttempts] = useState<CodexRoutingProbeAttemptView[]>([]);
  const [routingProbeRequestedAttempts, setRoutingProbeRequestedAttempts] = useState(1);
  const [routingProbeRunning, setRoutingProbeRunning] = useState(false);
  const [routeProbeOpen, setRouteProbeOpen] = useState(false);
  const [detailRowID, setDetailRowID] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [orderDirty, setOrderDirty] = useState(false);
  const [autoSaveOrderRequested, setAutoSaveOrderRequested] = useState(false);
  const [channelConfig, setChannelConfig] = useState<ChannelRoutingConfig>(() =>
    buildDefaultChannelRoutingConfig('claude'),
  );
  const [channelExplain, setChannelExplain] = useState<main.ChannelRoutingExplainResult | null>(null);
  const [channelRouteEvents, setChannelRouteEvents] = useState<ChannelRouteAuditEvent[]>([]);
  const [channelRouteEventsLoading, setChannelRouteEventsLoading] = useState(false);
  const suppressNextDetailClickRef = useRef(false);

  const summary = useMemo(() => buildClaudeCodeAccountSummary(orderedRows), [orderedRows]);
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
  const requestableRows = useMemo(() => orderedRows.filter((row) => row.requestable), [orderedRows]);
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
  const routePolicyRowStates = useMemo(
    () => buildCodexRoutePolicyRowStates(orderedRows, routePolicyDraft),
    [orderedRows, routePolicyDraft],
  );
  const routingProbeModelOptions = useMemo(
    () => withClaudeDefaultModelOptions(buildCodexRoutingProbeModelOptions(orderedRows)),
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

  async function reload(messageOverride?: string) {
    if (browserMode) {
      const previewRows = getClaudeCodeAccountListPreviewRows();
      const previewConfig = buildDefaultChannelRoutingConfig('claude', previewRows.map((row) => row.id));
      setChannelConfig(previewConfig);
      setChannelExplain(null);
      setChannelRouteEvents([]);
      setOrderedRows(applyChannelOrderToRows(previewRows, previewConfig.orderedAccountIDs));
      setOrderDirty(false);
      setMessage(messageOverride || t('claude_code.account_list_preview_loaded'));
      return;
    }

    if (!ready) {
      setOrderedRows([]);
      setMessage(t('claude_code.account_list_waiting_ready'));
      return;
    }

    setLoading(true);
    try {
      const [accountResponse, routingConfig] = await Promise.all([
        trackRequest('ListAccounts', { args: [] }, () => ListAccounts()),
        trackRequest('GetChannelRoutingConfig', { channel: 'claude' }, () => GetChannelRoutingConfig('claude')),
      ]);
      const accountRows = (accountResponse || []).map((account) => mapBackendAccountRecord(account));
      const normalizedConfig = mapWailsChannelRoutingConfig(routingConfig, 'claude');
      setChannelConfig(normalizedConfig);
      setChannelExplain(null);
      setOrderedRows(applyChannelOrderToRows(buildClaudeCodeAccountRows(accountRows), normalizedConfig.orderedAccountIDs));
      void loadChannelRouteEvents();
      setOrderDirty(false);
      setMessage(messageOverride || t('claude_code.account_list_loaded'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('claude_code.account_list_load_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [browserMode, ready]);

  useEffect(() => {
    if (routingProbeModel.trim()) {
      return;
    }
    setRoutingProbeModel(resolveCodexRoutingProbeDefaultModel(orderedRows) || DEFAULT_CLAUDE_CODE_PROBE_MODEL);
  }, [orderedRows, routingProbeModel]);

  useEffect(() => {
    if (!detailRow || detailRow.sourceKind !== 'codex-auth-file') {
      return;
    }
    if (browserMode) {
      setAuthFileModelOptions((prev) => ({
        ...prev,
        [detailRow.id]: buildOfficialProfileModelOptions(detailRow.provider, detailRow.modelMappings),
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

    let mounted = true;
    setLoadingAuthFileModelID(detailRow.id);
    setAuthFileModelErrors((prev) => ({ ...prev, [detailRow.id]: '' }));
    void trackRequest('GetAuthFileModels', { name: authFileName, channel: CLAUDE_OAUTH_MODEL_ALIAS_CHANNEL }, async () => {
      const [models, aliases] = await Promise.all([
        GetAuthFileModels(authFileName),
        ListOAuthModelAliases(CLAUDE_OAUTH_MODEL_ALIAS_CHANNEL),
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
          [detailRow.id]: mergeModelOptions(
            buildOfficialProfileModelOptions(detailRow.provider, detailRow.modelMappings),
            buildCodexAuthFileModelMappings(result.models || []),
          ),
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
    if (!detailRow || detailRow.sourceKind === 'codex-auth-file') {
      return;
    }
    if (browserMode || remoteModelOptions[detailRow.id]) {
      return;
    }

    const apiKey = detailRow.apiKey || detailRow.apiKeys?.[0] || '';
    if (!detailRow.baseUrl || !apiKey) {
      setRemoteModelOptions((prev) => ({
        ...prev,
        [detailRow.id]: buildOfficialProfileModelOptions(detailRow.provider, detailRow.modelMappings),
      }));
      return;
    }

    let mounted = true;
    setLoadingRemoteModelID(detailRow.id);
    setRemoteModelErrors((prev) => ({ ...prev, [detailRow.id]: '' }));
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
        setRemoteModelOptions((prev) => ({
          ...prev,
          [detailRow.id]: mergeModelOptions(
            buildOfficialProfileModelOptions(detailRow.provider, detailRow.modelMappings),
            fetchedMappings,
          ),
        }));
        if (Number(result?.statusCode || 0) >= 400 && fetchedMappings.length === 0) {
          setRemoteModelErrors((prev) => ({
            ...prev,
            [detailRow.id]: result?.message || t('accounts.openai_provider_models_fetch_failed'),
          }));
        }
      })
      .catch((error) => {
        console.error(error);
        if (mounted) {
          setRemoteModelErrors((prev) => ({ ...prev, [detailRow.id]: toErrorMessage(error) }));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingRemoteModelID((current) => (current === detailRow.id ? null : current));
        }
      });

    return () => {
      mounted = false;
    };
  }, [browserMode, detailRow, remoteModelOptions, trackRequest]);

  function handleDragStart(id: string) {
    setDraggedID(id);
    suppressNextDetailClickRef.current = false;
  }

  function handleDragEnter(targetID: string) {
    if (!draggedID || draggedID === targetID) {
      return;
    }
    suppressNextDetailClickRef.current = true;
    setOrderDirty(true);
    setOrderedRows((prev) => reorderClaudeCodeAccountRows(prev, draggedID, targetID));
    setMessage(t('claude_code.account_list_unsaved'));
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

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function openDetail(rowID: string) {
    if (suppressNextDetailClickRef.current) {
      suppressNextDetailClickRef.current = false;
      return;
    }
    setDetailRowID(rowID);
    markClaudeDetailInHash(rowID);
  }

  function closeDetail() {
    setDetailRowID(null);
    clearClaudeDetailInHash();
  }

  function openRouteProbeModal() {
    setRouteProbeOpen(true);
    markClaudeModalInHash('route-probe');
  }

  function closeRouteProbeModal() {
    setRouteProbeOpen(false);
    clearClaudeModalInHash();
  }

  function markClaudeDetailInHash(rowID: string) {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = buildClaudeDetailFrameHash(window.location.hash, rowID);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function clearClaudeDetailInHash() {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = clearClaudeDetailFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function markClaudeModalInHash(modal: 'route-probe') {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = buildClaudeModalFrameHash(window.location.hash, modal);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function clearClaudeModalInHash() {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = clearClaudeModalFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncModalStateFromHash = () => {
      const hashState = readFrameHashState(window.location.hash);
      if (hashState?.page === 'claude' && hashState.claudeWorkspace === 'account-list' && hashState?.accountDetailID) {
        setDetailRowID(hashState.accountDetailID);
      } else {
        setDetailRowID(null);
      }
      setRouteProbeOpen(hashState?.page === 'claude' && hashState.claudeWorkspace === 'account-list' && hashState?.modal === 'route-probe');
    };

    syncModalStateFromHash();
    window.addEventListener('hashchange', syncModalStateFromHash);
    return () => {
      window.removeEventListener('hashchange', syncModalStateFromHash);
    };
  }, []);

  async function persistChannelRoutingConfig(
    nextConfig: ChannelRoutingConfig,
    options: { reloadAfterSave?: boolean } = {},
  ) {
    if (!ready || saving) {
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      if (!browserMode) {
        await trackRequest('SaveChannelRoutingConfig', { channel: 'claude', mode: nextConfig.routeMode }, () =>
          SaveChannelRoutingConfig(main.ChannelRoutingConfig.createFrom(nextConfig)),
        );
      }
      setChannelConfig(nextConfig);
      setOrderDirty(false);
      if (browserMode) {
        setMessage(t('claude_code.account_list_preview_saved'));
      } else if (options.reloadAfterSave) {
        await reload(t('claude_code.account_list_saved'));
      } else {
        setMessage('');
      }
    } catch (error) {
      console.error(error);
      setMessage(`${t('claude_code.account_list_save_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveOrder() {
    if (!ready || !orderDirty || saving) {
      return;
    }

    const nextConfig = withCurrentChannelOrder(channelConfig, orderedRows.map((row) => row.id));
    await persistChannelRoutingConfig(nextConfig, { reloadAfterSave: !browserMode });
  }

  useEffect(() => {
    if (!autoSaveOrderRequested || draggedID || saving) {
      return;
    }
    if (!orderDirty) {
      setAutoSaveOrderRequested(false);
      return;
    }
    setAutoSaveOrderRequested(false);
    void saveOrder();
  }, [autoSaveOrderRequested, channelConfig, draggedID, orderDirty, orderedRows, saving]);

  function updateChannelMode(mode: ChannelRouteMode) {
    const nextConfig = withCurrentChannelOrder(
      updateChannelRoutingConfig(channelConfig, { routeMode: mode }),
      orderedRows.map((row) => row.id),
    );
    setChannelExplain(null);
    void persistChannelRoutingConfig(nextConfig);
  }

  function updateShadowEnabled(enabled: boolean) {
    const nextConfig = withCurrentChannelOrder(
      updateChannelRoutingConfig(channelConfig, { shadowEnabled: enabled }),
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

  async function runChannelExplain() {
    const nextConfig = withCurrentChannelOrder(channelConfig, orderedRows.map((row) => row.id));
    setChannelConfig(nextConfig);
    if (browserMode) {
      const candidates = orderedRows
        .filter((row) => row.requestable)
        .map((row, index) => ({
          id: row.id,
          displayName: row.label,
          provider: row.provider,
          routeOrder: index,
          channelOrder: index,
        }));
      const result = main.ChannelRoutingExplainResult.createFrom({
          channel: 'claude',
          routeMode: nextConfig.routeMode,
          selectedAccountID: candidates[0]?.id || '',
          candidates,
          filtered: orderedRows
            .filter((row) => !row.requestable)
            .map((row) => ({ id: row.id, reason: row.disabled ? 'account-disabled' : 'account-unrequestable' })),
          steps: [`mode:${nextConfig.routeMode}`, `candidates:${candidates.length}`, 'preview:browser'],
          snapshotVersion: 'preview',
          policyVersion: 'channel-routing-v1',
          shadow: nextConfig.shadowEnabled
            ? {
                enabled: true,
                routeMode: nextConfig.shadowRouteMode,
                selectedAccountID: candidates[candidates.length - 1]?.id || candidates[0]?.id || '',
                diff: Boolean(candidates.length > 1),
                steps: [`mode:${nextConfig.shadowRouteMode}`, `candidates:${candidates.length}`, 'preview:shadow'],
            }
            : undefined,
        });
      setChannelExplain(result);
      const event = buildPreviewChannelRouteAuditEvent({ channel: 'claude', explain: result });
      setChannelRouteEvents((prev) => (event ? [event, ...prev].slice(0, 5) : prev));
      return;
    }
    try {
      const result = await trackRequest('ExplainChannelRouting', { channel: 'claude' }, () =>
        ExplainChannelRouting(main.ChannelRoutingExplainInput.createFrom({ channel: 'claude' })),
      );
      setChannelExplain(result);
      await loadChannelRouteEvents();
    } catch (error) {
      console.error(error);
      setMessage(`${t('claude_code.account_list_probe_failed')}: ${toErrorMessage(error)}`);
    }
  }

  async function loadChannelRouteEvents() {
    if (browserMode) {
      return;
    }
    setChannelRouteEventsLoading(true);
    try {
      const result = await trackRequest('ListChannelRouteEvents', { channel: 'claude', limit: 5 }, () =>
        ListChannelRouteEvents(main.ChannelRouteEventsInput.createFrom({ channel: 'claude', limit: 5 })),
      );
      setChannelRouteEvents((result || []) as ChannelRouteAuditEvent[]);
    } catch (error) {
      console.error(error);
      setMessage(`${t('claude_code.account_list_probe_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setChannelRouteEventsLoading(false);
    }
  }

  async function toggleAccount(row: ClaudeCodeAccountRow) {
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
      setMessage(t('claude_code.account_list_preview_status_updated'));
      return;
    }

    setPendingToggleID(row.id);
    setMessage('');
    try {
      await trackRequest('SetAccountDisabled', { id: row.id, disabled: !row.disabled }, () =>
        SetAccountDisabled(row.id, !row.disabled)
      );
      await reload(row.disabled ? t('claude_code.account_list_enabled') : t('claude_code.account_list_disabled'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('claude_code.account_list_status_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setPendingToggleID(null);
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
        message: t('claude_code.account_list_probe_preview'),
        evidence: 'browser preview',
      }));
      setRoutingProbeAttempts(previewAttempts);
      setMessage(firstAvailable ? t('claude_code.account_list_probe_complete') : t('claude_code.account_list_probe_no_account'));
      return;
    }

    setRoutingProbeRunning(true);
    setRoutingProbeAttempts([]);
    setMessage('');
    try {
      const collectedAttempts: CodexRoutingProbeAttemptView[] = [];
      for (let attemptIndex = 0; attemptIndex < safeAttempts; attemptIndex += 1) {
        const routePolicyInput = buildCodexRoutingProbeRequestInput(model, 1);
        const result = await trackRequest('ProbeClaudeCodeAccountRouting', { ...routePolicyInput, index: attemptIndex + 1 }, () =>
          ProbeClaudeCodeAccountRouting(
            main.ProbeClaudeCodeAccountRoutingInput.createFrom({
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
      setMessage(t('claude_code.account_list_probe_complete'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('claude_code.account_list_probe_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setRoutingProbeRunning(false);
    }
  }

  function resetRoutePolicy() {
    setRoutingProbeAttempts([]);
  }

  async function saveModelMappings(row: ClaudeCodeAccountRow, mappings: CodexModelMappingRow[]) {
    const normalizedModels = normalizeClaudeCodeModelMappingsForProvider(mappings);
    const nextMappings = buildClaudeCodeModelMappings(normalizedModels);

    if (row.sourceKind === 'codex-auth-file') {
      if (browserMode) {
        setAuthFileModelMappings((prev) => ({ ...prev, [row.id]: nextMappings }));
        setOrderedRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, modelMappings: nextMappings } : item)));
        setMessage(t('claude_code.account_list_model_mapping_saved'));
        return;
      }

      setPendingMappingID(row.id);
      try {
        await trackRequest('UpdateOAuthModelAliases', { channel: CLAUDE_OAUTH_MODEL_ALIAS_CHANNEL, models: normalizedModels }, () =>
          UpdateOAuthModelAliases(
            main.UpdateOAuthModelAliasesInput.createFrom({
              channel: CLAUDE_OAUTH_MODEL_ALIAS_CHANNEL,
              models: normalizedModels,
            }),
          ),
        );
        setAuthFileModelMappings((prev) => ({ ...prev, [row.id]: nextMappings }));
        setOrderedRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, modelMappings: nextMappings } : item)));
        setMessage(t('claude_code.account_list_model_mapping_saved'));
      } catch (error) {
        console.error(error);
        setMessage(`${t('claude_code.account_list_model_mapping_save_failed')}: ${toErrorMessage(error)}`);
        throw error;
      } finally {
        setPendingMappingID(null);
      }
      return;
    }

    if (browserMode) {
      setOrderedRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, modelMappings: nextMappings } : item)));
      setMessage(t('claude_code.account_list_model_mapping_saved'));
      return;
    }

    setPendingMappingID(row.id);
    try {
      if (row.sourceKind === 'openai-compatible') {
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
      } else {
        await trackRequest('UpdateCodexAPIKeyConfig', { id: row.id, models: normalizedModels }, () =>
          UpdateCodexAPIKeyConfig(
            main.UpdateCodexAPIKeyConfigInput.createFrom({
              id: row.id,
              apiKey: row.apiKey || '',
              baseUrl: row.baseUrl,
              prefix: row.prefix,
              models: normalizedModels,
            }),
          ),
        );
      }
      await reload(t('claude_code.account_list_model_mapping_saved'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('claude_code.account_list_model_mapping_save_failed')}: ${toErrorMessage(error)}`);
      throw error;
    } finally {
      setPendingMappingID(null);
    }
  }

  const storyT = (key: string) => {
    if (key === 'codex.account_list_title') return t('claude_code.account_list_title');
    if (key === 'codex.account_list_order') return t('claude_code.account_list_order');
    if (key === 'codex.account_list_order_hint') return t('claude_code.account_list_order_hint');
    if (key === 'codex.account_list_empty') return t('claude_code.account_list_empty');
    if (key === 'codex.account_list_waiting_ready') return t('claude_code.account_list_waiting_ready');
    if (key === 'codex.account_list_browser_hint') return t('claude_code.account_list_browser_hint');
    if (key === 'codex.account_list_probe_open') return t('claude_code.account_list_probe_open');
    if (key === 'codex.account_list_probe_model') return t('claude_code.account_list_probe_model');
    if (key === 'codex.account_list_probe_terminal') return t('claude_code.account_list_probe_terminal');
    if (key === 'codex.account_list_real_model') return t('claude_code.account_list_real_model');
    if (key === 'codex.account_list_codex_model') return t('claude_code.account_list_claude_model');
    if (key === 'codex.account_list_oauth_passthrough_mapping') return t('claude_code.account_list_oauth_passthrough_mapping');
    if (key === 'codex.account_list_default_model_mapping') return t('claude_code.account_list_default_model_mapping');
    if (key === 'codex.account_list_source_api_key') return t('claude_code.account_list_source_api_key');
    if (key === 'codex.account_list_source_auth_file') return t('claude_code.account_list_source_auth_file');
    return t(key);
  };

  return (
    <div className="h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CLAUDE_CODE_ACCOUNT_LIST">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-8">
        <WorkspacePageHeader
          title={t('claude_code.account_list_title')}
          subtitle={t('claude_code.account_list_subtitle')}
          align="center"
          actions={
            <button
              type="button"
              onClick={openRouteProbeModal}
              className="btn-swiss flex min-h-10 items-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-sm)]"
            >
              <Terminal className="h-3.5 w-3.5" strokeWidth={4} />
              {t('claude_code.account_list_probe_open')}
            </button>
          }
        />

        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 sm:grid-cols-4">
          <SummaryMetric label={t('claude_code.account_list_total')} value={summary.total} />
          <SummaryMetric label={t('claude_code.account_list_anthropic')} value={summary.anthropic} />
          <SummaryMetric label={t('claude_code.account_list_requestable')} value={summary.requestable} />
          <SummaryMetric label={t('claude_code.account_list_blocked')} value={summary.blocked} />
        </section>

        <ChannelRoutingWorkbench
          channel="claude"
          config={withCurrentChannelOrder(channelConfig, orderedRows.map((row) => row.id))}
          explain={channelExplain}
          disabled={!ready || saving}
          saving={saving}
          message={orderDirty ? t('claude_code.account_list_unsaved') : ''}
          routeEvents={channelRouteEvents}
          routeEventsLoading={channelRouteEventsLoading}
          accounts={orderedRows}
          onModeChange={updateChannelMode}
          onShadowEnabledChange={updateShadowEnabled}
          onShadowModeChange={updateShadowMode}
          onExplain={() => void runChannelExplain()}
          onRefreshEvents={() => void loadChannelRouteEvents()}
        />

        <CodexAccountOrderSection
          title={t('claude_code.account_list_order')}
          hint={
            browserMode
              ? t('claude_code.account_list_browser_hint')
              : ready
                ? t('claude_code.account_list_order_hint')
                : t('claude_code.account_list_waiting_ready')
          }
          message={message}
          ready={ready}
          loading={loading}
          saving={saving}
          routingProbeRunning={routingProbeRunning}
          orderChanged={orderDirty}
          rows={orderedRows}
          draggedID={draggedID}
          pendingToggleID={pendingToggleID}
          latestRoutingProbeAccountID={latestRoutingProbeAccountID}
          routePolicyRowStates={routePolicyRowStates}
          codexQuotaByName={{}}
          accountUsageByID={{}}
          accountRateLimitByID={{}}
          refreshLabel={t('common.refresh')}
          loadingLabel={t('common.loading')}
          savingLabel={t('claude_code.account_list_saving')}
          unsavedLabel={t('claude_code.account_list_unsaved')}
          emptyLabel={t('claude_code.account_list_empty')}
          waitingLabel={t('claude_code.account_list_waiting_ready')}
          t={storyT}
          onReload={() => void reload()}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          onOpenDetail={openDetail}
          onToggle={(row) => void toggleAccount(row as ClaudeCodeAccountRow)}
        />
      </div>
      {routeProbeOpen ? (
        <RouteProbeCard
          t={storyT}
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
      {detailRowWithModels ? (
        <CodexAccountDetailModal
          row={detailRowWithModels}
          t={storyT}
          savingMappings={pendingMappingID === detailRowWithModels.id}
          loadingModelMappings={loadingAuthFileModelID === detailRowWithModels.id}
          modelMappingError={authFileModelErrors[detailRowWithModels.id] || ''}
          modelOptions={resolveDetailModelOptions(detailRowWithModels, authFileModelOptions, remoteModelOptions)}
          codexModelOptions={routingProbeModelOptions.map((model) => ({ realModel: model, codexModel: model }))}
          loadingModelOptions={loadingRemoteModelID === detailRowWithModels.id}
          modelOptionError={remoteModelErrors[detailRowWithModels.id] || ''}
          onClose={closeDetail}
          onSaveModelMappings={(mappings) => saveModelMappings(detailRowWithModels, mappings)}
        />
      ) : null}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function buildDefaultChannelRoutingConfig(channel: 'claude', orderedAccountIDs: string[] = []): ChannelRoutingConfig {
  return normalizeChannelRoutingConfig(
    {
      channel,
      routeMode: 'sequential',
      orderedAccountIDs,
      accountGroups: [],
      channelGroupStates: {},
      shadowEnabled: false,
      shadowRouteMode: 'balanced',
    },
    { channel },
  ).config;
}

function mapWailsChannelRoutingConfig(
  input: main.ChannelRoutingConfig | null | undefined,
  channel: 'claude',
): ChannelRoutingConfig {
  return normalizeChannelRoutingConfig(
    {
      channel: input?.channel || channel,
      routeMode: input?.routeMode,
      orderedAccountIDs: input?.orderedAccountIDs || [],
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

function withClaudeDefaultModelOptions(options: string[]) {
  const defaults = [DEFAULT_CLAUDE_CODE_PROBE_MODEL, 'claude-opus-4-5', 'claude-haiku-4-5'];
  return Array.from(new Set([...options.filter((option) => option !== 'gpt-5.4'), ...defaults]));
}

function buildOfficialProfileModelOptions(provider: string, existingMappings: CodexModelMappingRow[] = []): CodexModelMappingRow[] {
  const profile = resolveClaudeCodeProviderProfile(provider);
  const profileModels = profile
    ? [
        profile.defaultModel,
        profile.haikuModel || '',
        profile.sonnetModel || '',
        profile.opusModel || '',
        ...profile.officialSwitchableModels,
      ]
    : [];
  return mergeModelOptions(
    existingMappings,
    buildCodexAuthFileModelMappings(profileModels.filter(Boolean).map((model) => ({ id: model }))),
  );
}

function mergeModelOptions(...groups: CodexModelMappingRow[][]) {
  const seen = new Set<string>();
  const result: CodexModelMappingRow[] = [];
  for (const group of groups) {
    for (const mapping of group) {
      const realModel = String(mapping.realModel || '').trim();
      const codexModel = String(mapping.codexModel || realModel).trim() || realModel;
      const key = `${realModel}\n${codexModel}`;
      if (!realModel || seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ realModel, codexModel });
    }
  }
  return result;
}

function resolveDetailModelOptions(
  row: ClaudeCodeAccountRow,
  authFileModelOptions: Record<string, CodexModelMappingRow[]>,
  remoteModelOptions: Record<string, CodexModelMappingRow[]>,
) {
  if (row.sourceKind === 'codex-auth-file') {
    return authFileModelOptions[row.id] || buildOfficialProfileModelOptions(row.provider, row.modelMappings);
  }
  return remoteModelOptions[row.id] || buildOfficialProfileModelOptions(row.provider, row.modelMappings);
}

export function getClaudeCodeAccountListSmokePreviewRows(): ClaudeCodeAccountRow[] {
  return buildClaudeCodeAccountRows(getClaudeCodeAccountListPreviewAccounts());
}
