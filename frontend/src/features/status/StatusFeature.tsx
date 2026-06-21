import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Space, Tag, Typography } from 'antd';
import {
  ApplyClaudeCodeAPIKeyConfigToLocal,
  ApplyRelayServiceConfigToLocal,
  ApplyRelayServiceConfigToLocalV2,
  DisableGetTokensCodexModelCatalogProjection,
  EnableGetTokensCodexModelCatalogProjection,
  GetAccountStoreDiagnostics,
  GetAllQuotaStatuses,
  GetAppRuntimeSettings,
  GetLocalCodexAuthState,
  GetLocalCodexModelProviderStateView,
  GetRelayServiceConfig,
  ListRelaySupportedModels,
  SetCodexModelCatalogSyncEnabled,
  UpdateRelayServiceAPIKeys,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import { useDebug } from '../../context/useDebug';
import { hasWailsAppBindings } from '../../utils/previewMode';
import { useI18n } from '../../context/I18nContext';
import {
  RelayKeyEditorModal,
  RelayProviderEditorModal,
} from './components/RelayEditors';
import {
  StatusApplyLocalSection,
  StatusQuotaEvidenceSection,
} from './components/StatusPanels';
import { RELAY_CODEX_DEFAULT_MODEL, RELAY_CODEX_PROVIDER_ID } from '../accounts/model/accountConfig';
import { buildStatusQuotaEvidenceSectionState } from './model/quotaEvidenceSection';
import {
  defaultRelayProviderOptions,
  defaultRelayReasoningEffortOptions,
  getCodexLocalApplyPreflight,
  loadCodexLocalAuthStrategy,
  loadLANAccessEnabled,
  loadRelayKeyAliases,
  loadRelayModelOptions,
  loadRelayProviderOptions,
  loadSelectedRelayModel,
  loadSelectedRelayProvider,
  loadSelectedRelayReasoningEffort,
  resolveInitialRelayModelSelection,
  resolveInitialRelayProviderSelection,
  resolveInitialSupportsWebsocketsSelection,
  resolveRelayEndpointSelection,
  saveCodexLocalAuthStrategy,
  saveLANAccessEnabled,
  saveRelayKeyAliases,
  saveRelayModelOptions,
  saveRelayProviderOptions,
  saveSelectedRelayModel,
  saveSelectedRelayProvider,
  saveSelectedRelayReasoningEffort,
  toRelayProviderOption,
  type CodexLocalAuthStrategy,
  type ClaudeCodeLocalApplyDraft,
  type RelayKeyEditorState,
  type RelayProviderEditorState,
} from './model/relayLocalState';
import { mergeRelayModelCatalog, resolveRelayModelReasoningProfile } from './model/relayModelCatalog';
import { buildAccountStoreDiagnosticsView } from './model/accountStoreDiagnostics';
import {
  mergeRelayProviderCatalog,
  type RelayProviderOption,
} from './model/relayProviderCatalog';
import type { SidecarStatus } from '../../types';
import { toErrorMessage } from '../../utils/error';

interface StatusFeatureProps {
  sidecarStatus?: SidecarStatus;
  version?: string;
}

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
  gitHash: '',
  startedAtUnix: 0,
};

const statusDiagnosticsPanelClass =
  'status-diagnostics-card border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const statusDiagnosticsTitleClass =
  'text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const statusDiagnosticsHeadlineClass =
  'mt-1 truncate text-[length:var(--gt-font-size-md)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const statusDiagnosticsToneClass =
  'shrink-0 rounded border px-3 py-1 text-right text-[length:var(--gt-font-size-xs)] font-normal tracking-normal';
const statusDiagnosticsErrorClass =
  'min-w-0 overflow-hidden rounded border border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,transparent)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-status-warning)]';
const statusPageShellClass =
  'h-full w-full overflow-auto bg-[var(--gt-surface-panel)] px-6 py-6 lg:px-8 lg:py-8';
const statusPageContentClass = 'mx-auto flex w-full max-w-[1180px] flex-col gap-6';
const statusHeroCardClass = 'status-hero-card border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const statusWorkbenchGridClass = 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.34fr)]';
const statusPrimaryRailClass = 'min-w-0';
const statusDiagnosticsRailClass = 'grid min-w-0 gap-4';

type StatusBadgeState = 'success' | 'processing' | 'default' | 'error' | 'warning';

function AccountStoreDiagnosticsPanel({ view }: { view: ReturnType<typeof buildAccountStoreDiagnosticsView> }) {
  const toneClass =
    view.tone === 'critical'
      ? 'border-[var(--gt-status-danger)] text-[var(--gt-status-danger)]'
      : view.tone === 'warning'
        ? 'border-[var(--gt-status-warning)] text-[var(--gt-status-warning)]'
        : view.tone === 'success'
          ? 'border-[var(--gt-status-success)] text-[var(--gt-status-success)]'
          : 'border-[var(--gt-border-subtle)] text-[var(--gt-ink-muted)]';

  const toneTagColor =
    view.tone === 'critical'
      ? 'error'
      : view.tone === 'warning'
        ? 'warning'
        : view.tone === 'success'
          ? 'success'
          : 'default';

  return (
    <Card
      size="small"
      variant="outlined"
      className={statusDiagnosticsPanelClass}
      styles={{ body: { padding: 16 } }}
      data-account-store-diagnostics-panel="quiet"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className={statusDiagnosticsTitleClass}>
            Account store
          </div>
          <div className={statusDiagnosticsHeadlineClass}>
            {view.headline}
          </div>
        </div>
        <Tag bordered color={toneTagColor} className={[statusDiagnosticsToneClass, toneClass, 'm-0'].join(' ')}>
          {view.recoveryLine}
        </Tag>
      </div>
      {view.errorSummary ? (
        <div
          className={statusDiagnosticsErrorClass}
          title={view.fullError}
          data-account-store-diagnostics-error
        >
          {view.errorSummary}
        </div>
      ) : null}
    </Card>
  );
}

function normalizeRelayEndpointURL(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '');
}

export default function StatusFeature({
  sidecarStatus = defaultSidecarStatus,
  version = 'dev',
}: StatusFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const [healthz, setHealthz] = useState('CHECKING...');
  const [relayKeyItems, setRelayKeyItems] = useState<main.RelayServiceAPIKeyItem[]>([]);
  const [relayEndpoints, setRelayEndpoints] = useState<main.RelayServiceEndpoint[]>([]);
  const [relayModelOptions, setRelayModelOptions] = useState<string[]>(() => loadRelayModelOptions());
  const [relayAccountPoolModels, setRelayAccountPoolModels] = useState<main.OpenAICompatibleModel[]>([]);
  const [relayProviderOptions, setRelayProviderOptions] = useState<RelayProviderOption[]>(() => loadRelayProviderOptions());
  const [relayKeyAliases, setRelayKeyAliases] = useState<Record<string, string>>(() => loadRelayKeyAliases());
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
  const [selectedEndpointID, setSelectedEndpointID] = useState('localhost');
  const [isLANAccessEnabled, setIsLANAccessEnabled] = useState(() => loadLANAccessEnabled());
  const [selectedRelayModel, setSelectedRelayModel] = useState<string>(() =>
    loadSelectedRelayModel(loadRelayModelOptions())
  );
  const [selectedRelayReasoningEffort, setSelectedRelayReasoningEffort] = useState<string>(() =>
    loadSelectedRelayReasoningEffort()
  );
  const [selectedRelayProviderID, setSelectedRelayProviderID] = useState<string>(() =>
    loadSelectedRelayProvider(loadRelayProviderOptions())
  );
  const [codexLocalAuthStrategy, setCodexLocalAuthStrategy] = useState<CodexLocalAuthStrategy>(() =>
    loadCodexLocalAuthStrategy()
  );
  const [supportsWebsockets, setSupportsWebsockets] = useState(false);
  const [syncCodexModelCatalog, setSyncCodexModelCatalog] = useState(false);
  const [relayKeyEditor, setRelayKeyEditor] = useState<RelayKeyEditorState | null>(null);
  const [relayProviderEditor, setRelayProviderEditor] = useState<RelayProviderEditorState | null>(null);
  const [localCodexAuthState, setLocalCodexAuthState] = useState<main.LocalCodexAuthState | null>(null);
  const [localCodexProviderState, setLocalCodexProviderState] = useState<main.LocalCodexModelProviderStateView | null>(
    null
  );
  const [localCodexProviderStateLoaded, setLocalCodexProviderStateLoaded] = useState(() => !hasWailsAppBindings());
  const [accountStoreDiagnostics, setAccountStoreDiagnostics] = useState<main.AccountStoreDiagnostics | null>(null);
  const [quotaStatuses, setQuotaStatuses] = useState<main.CodexQuotaResponse[]>([]);
  const [localApplyMessage, setLocalApplyMessage] = useState('');
  const [claudeApplyMessage, setClaudeApplyMessage] = useState('');
  const [isApplyingToLocal, setIsApplyingToLocal] = useState(false);
  const [isApplyingClaude, setIsApplyingClaude] = useState(false);
  const [isDisablingModelCatalog, setIsDisablingModelCatalog] = useState(false);

  const relayKeys = relayKeyItems.map((item) => item.value);
  const selectedKey = relayKeys[selectedKeyIndex] || '';
  const selectedRelayProvider =
    relayProviderOptions.find((option) => option.id === selectedRelayProviderID) ||
    relayProviderOptions.find((option) => option.id === RELAY_CODEX_PROVIDER_ID) ||
    defaultRelayProviderOptions.find((option) => option.id === RELAY_CODEX_PROVIDER_ID) ||
    relayProviderOptions[0] ||
    defaultRelayProviderOptions[0];
  const selectedEndpoint =
    relayEndpoints.find((endpoint) => endpoint.id === selectedEndpointID) ||
    relayEndpoints.find((endpoint) => isLANAccessEnabled || endpoint.kind !== 'lan') ||
    relayEndpoints[0] || {
      id: 'localhost',
      kind: 'localhost',
      host: '127.0.0.1',
      baseUrl: `http://127.0.0.1:${sidecarStatus.port || 8317}/v1`,
    };
  const localCodexProviderWebsocketRisk =
    Boolean(localCodexProviderState?.currentProviderSupportsWebsocketsSet) &&
    Boolean(localCodexProviderState?.currentProviderSupportsWebsockets) &&
    localCodexProviderState?.currentProviderID === selectedRelayProvider.id &&
    normalizeRelayEndpointURL(localCodexProviderState?.currentProviderBaseUrl) ===
      normalizeRelayEndpointURL(selectedEndpoint.baseUrl);
  const visibleRelayEndpoints = relayEndpoints
    .filter((endpoint) => isLANAccessEnabled || endpoint.kind !== 'lan')
    .slice(0, 3);
  const resolvedRelayModels = useMemo(
    () => mergeRelayModelCatalog(relayAccountPoolModels, relayModelOptions),
    [relayAccountPoolModels, relayModelOptions]
  );
  const resolvedRelayModelNames = useMemo(
    () => resolvedRelayModels.map((item) => item.name),
    [resolvedRelayModels]
  );
  const relayReasoningProfile = useMemo(
    () => resolveRelayModelReasoningProfile(selectedRelayModel, resolvedRelayModels),
    [resolvedRelayModels, selectedRelayModel]
  );
  const codexLocalPreflight = useMemo(
    () =>
      getCodexLocalApplyPreflight({
        authStrategy: codexLocalAuthStrategy,
        providerID: selectedRelayProvider.id,
        authState: localCodexAuthState,
      }),
    [codexLocalAuthStrategy, localCodexAuthState, selectedRelayProvider.id]
  );
  const codexLocalApplyBlockedMessage = useMemo(() => {
    switch (codexLocalPreflight.reason) {
      case 'missing_chatgpt_auth':
        return t('status.codex_local_preserve_requires_chatgpt');
      case 'requires_custom_provider':
        return t('status.codex_local_preserve_requires_custom_provider');
      default:
        return '';
    }
  }, [codexLocalPreflight.reason, t]);

  function selectRelayProviderID(providerID: string) {
    setSelectedRelayProviderID(providerID);
    setSupportsWebsockets(
      resolveInitialSupportsWebsocketsSelection({
        selectedProviderID: providerID,
        providerState: localCodexProviderState,
      })
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadLocalCodexAuthState() {
      try {
        const result = await trackRequest('GetLocalCodexAuthState', { args: [] }, () => GetLocalCodexAuthState());
        if (!cancelled) {
          setLocalCodexAuthState(result);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLocalCodexAuthState(null);
        }
      }
    }

    void loadLocalCodexAuthState();

    return () => {
      cancelled = true;
    };
  }, [trackRequest]);

  useEffect(() => {
    saveCodexLocalAuthStrategy(codexLocalAuthStrategy);
  }, [codexLocalAuthStrategy]);

  useEffect(() => {
    let cancelled = false;

    async function loadRelayServiceConfig() {
      if (sidecarStatus.code !== 'ready') {
        setRelayKeyItems([]);
        setRelayEndpoints([]);
        setRelayAccountPoolModels([]);
        setSelectedKeyIndex(0);
        setSelectedEndpointID('localhost');
        setLocalApplyMessage('');
        setClaudeApplyMessage('');
        return;
      }

      try {
        const config = await trackRequest('GetRelayServiceConfig', { args: [] }, () => GetRelayServiceConfig());
        if (cancelled) {
          return;
        }
        setRelayKeyItems(config.apiKeyItems || (config.apiKeys || []).map((value) => ({ value })));
        const nextEndpoints = config.endpoints || [];
        setRelayEndpoints(nextEndpoints);
        setSelectedKeyIndex(0);
        setSelectedEndpointID((prev) => resolveRelayEndpointSelection(nextEndpoints, prev, isLANAccessEnabled));
        setLocalApplyMessage('');
        setClaudeApplyMessage('');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setRelayKeyItems([]);
        setRelayEndpoints([]);
        setRelayAccountPoolModels([]);
        setSelectedKeyIndex(0);
        setSelectedEndpointID('localhost');
        setLocalApplyMessage('');
        setClaudeApplyMessage('');
      }
    }

    void loadRelayServiceConfig();

    return () => {
      cancelled = true;
    };
  }, [isLANAccessEnabled, sidecarStatus.code, t, trackRequest]);

  useEffect(() => {
    let cancelled = false;

    async function loadCodexModelCatalogSyncPreference() {
      if (!hasWailsAppBindings()) {
        setSyncCodexModelCatalog(false);
        return;
      }
      try {
        const settings = await trackRequest('GetAppRuntimeSettings', { args: [] }, () => GetAppRuntimeSettings());
        if (!cancelled) {
          setSyncCodexModelCatalog(Boolean(settings?.codexModelCatalogSyncEnabled));
        }
      } catch (error) {
        console.error(error);
      }
    }

    void loadCodexModelCatalogSyncPreference();

    return () => {
      cancelled = true;
    };
  }, [trackRequest]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalCodexModelProviders() {
      try {
        const providerState = await trackRequest('GetLocalCodexModelProviderStateView', { args: [] }, () =>
          GetLocalCodexModelProviderStateView()
        );
        if (cancelled) {
          return;
        }
        setLocalCodexProviderState(providerState);
        const activeProvider =
          providerState?.currentProviderID
            ? [
                {
                  providerID: providerState.currentProviderID,
                  providerName: providerState.currentProviderName || providerState.currentProviderID,
                },
              ]
            : [];
        setRelayProviderOptions((prev) => {
          const next = mergeRelayProviderCatalog(
            defaultRelayProviderOptions,
            prev,
            providerState?.providers || [],
            activeProvider
          );
          const nextSelectedProviderID = resolveInitialRelayProviderSelection({
            providerOptions: next,
            activeProviderID: providerState?.currentProviderID,
            hasExplicitActiveProvider: Boolean(providerState?.hasExplicitCurrentProvider),
          });
          setSelectedRelayProviderID(nextSelectedProviderID);
          setSupportsWebsockets(
            resolveInitialSupportsWebsocketsSelection({
              selectedProviderID: nextSelectedProviderID,
              providerState,
            })
          );
          return next;
        });
        const activeModel = providerState?.hasExplicitCurrentModel ? providerState.currentModel : '';
        setRelayModelOptions((prev) => {
          const next = activeModel ? Array.from(new Set([...prev, activeModel])) : prev;
          const nextSelectedRelayModel = resolveInitialRelayModelSelection({
            modelOptions: next,
            activeModel: providerState?.currentModel,
            hasExplicitActiveModel: Boolean(providerState?.hasExplicitCurrentModel),
          });
          setSelectedRelayModel(nextSelectedRelayModel);
          saveSelectedRelayModel(nextSelectedRelayModel);
          return next;
        });
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLocalCodexProviderStateLoaded(true);
        }
      }
    }

    void loadLocalCodexModelProviders();

    return () => {
      cancelled = true;
    };
  }, [trackRequest]);

  useEffect(() => {
    let cancelled = false;

    async function loadRelaySupportedModels() {
      if (sidecarStatus.code !== 'ready') {
        setRelayAccountPoolModels([]);
        return;
      }

      try {
        const result = await trackRequest('ListRelaySupportedModels', { args: [] }, () => ListRelaySupportedModels());
        if (cancelled) {
          return;
        }
        setRelayAccountPoolModels(result.models || []);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRelayAccountPoolModels([]);
        }
      }
    }

    void loadRelaySupportedModels();

    return () => {
      cancelled = true;
    };
  }, [sidecarStatus.code, trackRequest]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuotaStatuses() {
      if (sidecarStatus.code !== 'ready') {
        setQuotaStatuses([]);
        return;
      }

      try {
        const result = await trackRequest('GetAllQuotaStatuses', { args: [] }, () => GetAllQuotaStatuses());
        if (!cancelled) {
          setQuotaStatuses(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setQuotaStatuses([]);
        }
      }
    }

    void loadQuotaStatuses();

    return () => {
      cancelled = true;
    };
  }, [sidecarStatus.code, trackRequest]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccountStoreDiagnostics() {
      if (sidecarStatus.code !== 'ready') {
        setAccountStoreDiagnostics(null);
        return;
      }

      try {
        const result = await trackRequest('GetAccountStoreDiagnostics', { args: [] }, () =>
          GetAccountStoreDiagnostics()
        );
        if (!cancelled) {
          setAccountStoreDiagnostics(result);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setAccountStoreDiagnostics(null);
        }
      }
    }

    void loadAccountStoreDiagnostics();

    return () => {
      cancelled = true;
    };
  }, [sidecarStatus.code, trackRequest]);

  useEffect(() => {
    setRelayKeyAliases((prev) => {
      const next: Record<string, string> = {};
      let changed = false;

      relayKeys.forEach((key) => {
        const alias = prev[key];
        if (alias) {
          next[key] = alias;
        }
      });

      const prevKeys = Object.keys(prev);
      if (prevKeys.length !== Object.keys(next).length) {
        changed = true;
      } else {
        changed = prevKeys.some((key) => prev[key] !== next[key]);
      }

      if (changed) {
        saveRelayKeyAliases(next);
      }

      return changed ? next : prev;
    });
  }, [relayKeys]);

  useEffect(() => {
    saveLANAccessEnabled(isLANAccessEnabled);
  }, [isLANAccessEnabled]);

  useEffect(() => {
    const normalized = Array.from(
      new Set(relayModelOptions.map((item) => item.trim()).filter(Boolean))
    );
    saveRelayModelOptions(normalized);
  }, [relayModelOptions]);

  useEffect(() => {
    const normalized = mergeRelayProviderCatalog(defaultRelayProviderOptions, relayProviderOptions);
    const changed =
      normalized.length !== relayProviderOptions.length ||
      normalized.some((item, index) => item.id !== relayProviderOptions[index]?.id || item.name !== relayProviderOptions[index]?.name);
    if (changed) {
      setRelayProviderOptions(normalized);
      return;
    }
    saveRelayProviderOptions(normalized);
  }, [relayProviderOptions]);

  useEffect(() => {
    const trimmedSelectedRelayModel = selectedRelayModel.trim();
    if (!localCodexProviderStateLoaded) {
      return;
    }
    if (!trimmedSelectedRelayModel) {
      setSelectedRelayModel(resolvedRelayModelNames[0] || RELAY_CODEX_DEFAULT_MODEL);
      return;
    }
    if (trimmedSelectedRelayModel !== selectedRelayModel) {
      setSelectedRelayModel(trimmedSelectedRelayModel);
      return;
    }
    saveSelectedRelayModel(trimmedSelectedRelayModel);
  }, [localCodexProviderStateLoaded, resolvedRelayModelNames, selectedRelayModel]);

  useEffect(() => {
    if (!relayReasoningProfile.options.includes(selectedRelayReasoningEffort)) {
      setSelectedRelayReasoningEffort(relayReasoningProfile.defaultValue);
      return;
    }
    saveSelectedRelayReasoningEffort(selectedRelayReasoningEffort);
  }, [relayReasoningProfile.defaultValue, relayReasoningProfile.options, selectedRelayReasoningEffort]);

  useEffect(() => {
    if (!relayProviderOptions.some((option) => option.id === selectedRelayProviderID)) {
      setSelectedRelayProviderID(resolveInitialRelayProviderSelection({ providerOptions: relayProviderOptions }));
      return;
    }
    saveSelectedRelayProvider(selectedRelayProviderID);
  }, [relayProviderOptions, selectedRelayProviderID]);

  useEffect(() => {
    const nextEndpointID = resolveRelayEndpointSelection(relayEndpoints, selectedEndpointID, isLANAccessEnabled);
    if (nextEndpointID === selectedEndpointID) {
      return;
    }

    setSelectedEndpointID(nextEndpointID);
  }, [isLANAccessEnabled, relayEndpoints, selectedEndpointID]);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      if (sidecarStatus.code !== 'ready' || !sidecarStatus.port) {
        setHealthz('CHECKING...');
        return;
      }

      try {
        const url = `http://127.0.0.1:${sidecarStatus.port}/healthz`;
        const response = await trackRequest(
          'fetch /healthz',
          { url, method: 'HEAD', cache: 'no-store' },
          () =>
            fetch(url, {
              method: 'HEAD',
              cache: 'no-store',
            }),
          {
            transport: 'http',
            mapSuccess: (result) => ({
              ok: result.ok,
              status: result.status,
              url: result.url,
            }),
          }
        );
        if (!cancelled) {
          setHealthz(
            response.ok
              ? `HTTP/127.0.0.1:${sidecarStatus.port}/healthz -> 200 OK`
              : `FAIL: ${response.status}`
          );
        }
      } catch (error) {
        if (!cancelled) {
          setHealthz(`ERROR: ${toErrorMessage(error)}`);
        }
      }
    }

    void checkHealth();

    return () => {
      cancelled = true;
    };
  }, [sidecarStatus.code, sidecarStatus.port, trackRequest]);

  async function copyText(value: string, successMessage?: string) {
    try {
      await navigator.clipboard.writeText(value);
      if (successMessage) {
        setLocalApplyMessage(successMessage);
      }
      return true;
    } catch (error) {
      console.error(error);
      setLocalApplyMessage(t('status.copy_failed'));
      return false;
    }
  }

  function setRelayKeyAliasesWithPersist(nextAliases: Record<string, string>) {
    setRelayKeyAliases(nextAliases);
    saveRelayKeyAliases(nextAliases);
  }

  function relayKeyDisplayName(value: string, index: number) {
    return relayKeyAliases[value]?.trim() || `KEY ${index + 1}`;
  }

  async function saveRelayServiceAPIKeys(nextKeys: string[], nextSelectedIndex = selectedKeyIndex) {
    const normalized = nextKeys.map((item) => item.trim()).filter(Boolean);

    if (normalized.length === 0) {
      setLocalApplyMessage(t('status.service_keys_required'));
      return false;
    }

    try {
      const config = await trackRequest('UpdateRelayServiceAPIKeys', { apiKeys: normalized }, () =>
        UpdateRelayServiceAPIKeys(normalized)
      );
      const nextKeys = config.apiKeys || [];
      setRelayKeyItems(config.apiKeyItems || nextKeys.map((value) => ({ value })));
      const nextEndpoints = config.endpoints || [];
      setRelayEndpoints(nextEndpoints);
      setSelectedKeyIndex(Math.min(nextSelectedIndex, Math.max(nextKeys.length - 1, 0)));
      setSelectedEndpointID((prev) => resolveRelayEndpointSelection(nextEndpoints, prev, isLANAccessEnabled));
      setLocalApplyMessage(t('status.service_keys_saved'));
      return true;
    } catch (error) {
      console.error(error);
      setLocalApplyMessage(`${t('status.service_keys_save_failed')}: ${toErrorMessage(error)}`);
      return false;
    }
  }

  function openCreateRelayKeyEditor() {
    setRelayKeyEditor({
      mode: 'create',
      index: null,
      name: '',
      apiKey: '',
      error: '',
    });
  }

  async function submitRelayKeyEditor() {
    if (!relayKeyEditor) {
      return;
    }

    const trimmedName = relayKeyEditor.name.trim();
    const trimmedKey = relayKeyEditor.apiKey.trim();

    if (relayKeyEditor.mode === 'create') {
      if (!trimmedKey) {
        setRelayKeyEditor((prev) => (prev ? { ...prev, error: t('status.service_key_required') } : prev));
        return;
      }

      const nextKeys = [...relayKeys, trimmedKey];
      const saved = await saveRelayServiceAPIKeys(nextKeys, nextKeys.length - 1);
      if (!saved) {
        return;
      }

      if (trimmedName) {
        setRelayKeyAliasesWithPersist({
          ...relayKeyAliases,
          [trimmedKey]: trimmedName,
        });
      }

      setRelayKeyEditor(null);
      return;
    }

    const currentIndex = relayKeyEditor.index;
    if (currentIndex === null) {
      return;
    }
    const currentKey = relayKeys[currentIndex];
    if (!currentKey) {
      return;
    }

    const nextAliases = { ...relayKeyAliases };
    if (trimmedName) {
      nextAliases[currentKey] = trimmedName;
    } else {
      delete nextAliases[currentKey];
    }
    setRelayKeyAliasesWithPersist(nextAliases);
    setRelayKeyEditor(null);
    setLocalApplyMessage(t('status.service_key_name_saved'));
  }

  function openCreateRelayProviderEditor() {
    setRelayProviderEditor({
      providerID: '',
      providerName: '',
      error: '',
    });
  }

  function commitRelayModelSelection(rawValue: string) {
    const nextValue = rawValue.trim();
    if (!nextValue) {
      const fallback = selectedRelayModel.trim() || resolvedRelayModelNames[0] || RELAY_CODEX_DEFAULT_MODEL;
      setSelectedRelayModel(fallback);
      return;
    }

    if (!resolvedRelayModelNames.includes(nextValue) && !relayModelOptions.includes(nextValue)) {
      setRelayModelOptions((prev) => [...prev, nextValue]);
      setLocalApplyMessage(t('status.model_name_saved'));
    }

    setSelectedRelayModel(nextValue);
  }

  function addRelayProviderOption() {
    if (!relayProviderEditor) {
      return;
    }

    const nextProvider = toRelayProviderOption({
      providerID: relayProviderEditor.providerID,
      providerName: relayProviderEditor.providerID,
    });
    if (!nextProvider.id) {
      setRelayProviderEditor((prev) => (prev ? { ...prev, error: t('status.provider_id_required') } : prev));
      return;
    }
    if (relayProviderOptions.some((item) => item.id === nextProvider.id)) {
      setRelayProviderEditor((prev) => (prev ? { ...prev, error: t('status.provider_id_exists') } : prev));
      return;
    }

    setRelayProviderOptions([...relayProviderOptions, nextProvider]);
    setSelectedRelayProviderID(nextProvider.id);
    setRelayProviderEditor(null);
    setLocalApplyMessage(t('status.provider_saved'));
  }

  function deleteRelayProviderOption(providerID: string) {
    const nextOptions = relayProviderOptions.filter((item) => item.id !== providerID);
    if (nextOptions.length === 0) {
      setLocalApplyMessage(t('status.provider_id_required'));
      return;
    }

    setRelayProviderOptions(nextOptions);
    if (selectedRelayProviderID === providerID) {
      setSelectedRelayProviderID(resolveInitialRelayProviderSelection({ providerOptions: nextOptions }));
    }
    setLocalApplyMessage(t('status.provider_deleted'));
  }

  async function applyRelayConfigToLocal() {
    if (!localCodexProviderStateLoaded) {
      setLocalApplyMessage(t('status.codex_local_apply_blocked_loading_config'));
      return;
    }
    const normalizedKey = selectedKey.trim();
    if (!normalizedKey) {
      setLocalApplyMessage(t('status.apply_local_missing_key'));
      return;
    }
    if (!codexLocalPreflight.canApply) {
      setLocalApplyMessage(codexLocalApplyBlockedMessage);
      return;
    }

    setIsApplyingToLocal(true);
    try {
      const result = await trackRequest(
        'ApplyRelayServiceConfigToLocalV2',
        {
          apiKey: normalizedKey,
          baseURL: selectedEndpoint.baseUrl,
          model: selectedRelayModel,
          reasoningEffort: selectedRelayReasoningEffort,
          providerID: selectedRelayProvider.id,
          providerName: selectedRelayProvider.name,
          authStrategy: codexLocalAuthStrategy,
          modelCatalogProjectionMode: syncCodexModelCatalog ? 'gettokens' : 'off',
        },
        () =>
          ApplyRelayServiceConfigToLocalV2(main.RelayLocalApplyInput.createFrom({
            apiKey: normalizedKey,
            apiKeySet: true,
            baseURL: selectedEndpoint.baseUrl,
            baseURLSet: true,
            model: selectedRelayModel,
            modelSet: true,
            reasoningEffort: selectedRelayReasoningEffort,
            reasoningEffortSet: true,
            providerID: selectedRelayProvider.id,
            providerIDSet: true,
            providerName: selectedRelayProvider.name,
            providerNameSet: true,
            requiresOpenAIAuth: true,
            requiresOpenAIAuthSet: true,
            wireAPI: 'responses',
            wireAPISet: true,
            supportsWebsockets,
            supportsWebsocketsSet: true,
            authStrategy: codexLocalAuthStrategy,
            modelCatalogProjectionMode: syncCodexModelCatalog ? 'gettokens' : 'off',
            modelCatalogModels: relayAccountPoolModels.length > 0 ? relayAccountPoolModels : undefined,
          }))
      );
      const catalogMessage = result.existingExternalModelCatalogPath
        ? ` / 保留外部 model_catalog_json：${result.existingExternalModelCatalogPath}`
        : result.modelCatalogPath
          ? ` / /model 同步：${result.modelCatalogPath}，重启 Codex 后生效`
          : '';
      const warningMessage = result.warnings?.length ? ` / ${result.warnings.join(' / ')}` : '';
      setLocalApplyMessage(`${t('status.apply_local_done')}: ${result.codexHomePath}${catalogMessage}${warningMessage}`);
      try {
        const refreshed = await trackRequest('GetRelayServiceConfig', { args: [] }, () => GetRelayServiceConfig());
        setRelayKeyItems(refreshed.apiKeyItems || (refreshed.apiKeys || []).map((value) => ({ value })));
        const providerState = await trackRequest('GetLocalCodexModelProviderStateView', { args: [] }, () =>
          GetLocalCodexModelProviderStateView()
        );
        const activeProvider =
          providerState?.currentProviderID
            ? [
                {
                  providerID: providerState.currentProviderID,
                  providerName: providerState.currentProviderName || providerState.currentProviderID,
                },
              ]
            : [];
        setRelayProviderOptions((prev) => {
          const next = mergeRelayProviderCatalog(
            defaultRelayProviderOptions,
            prev,
            providerState?.providers || [],
            activeProvider
          );
          const nextSelectedProviderID = resolveInitialRelayProviderSelection({
            providerOptions: next,
            activeProviderID: providerState?.currentProviderID,
            hasExplicitActiveProvider: Boolean(providerState?.hasExplicitCurrentProvider),
          });
          setSelectedRelayProviderID(nextSelectedProviderID);
          setSupportsWebsockets(
            resolveInitialSupportsWebsocketsSelection({
              selectedProviderID: nextSelectedProviderID,
              providerState,
            })
          );
          return next;
        });
        const activeModel = providerState?.hasExplicitCurrentModel ? providerState.currentModel : '';
        setRelayModelOptions((prev) => {
          const next = activeModel ? Array.from(new Set([...prev, activeModel])) : prev;
          const nextSelectedRelayModel = resolveInitialRelayModelSelection({
            modelOptions: next,
            activeModel: providerState?.currentModel,
            hasExplicitActiveModel: Boolean(providerState?.hasExplicitCurrentModel),
          });
          setSelectedRelayModel(nextSelectedRelayModel);
          saveSelectedRelayModel(nextSelectedRelayModel);
          return next;
        });
        const refreshedAuthState = await trackRequest('GetLocalCodexAuthState', { args: [] }, () =>
          GetLocalCodexAuthState()
        );
        setLocalCodexAuthState(refreshedAuthState);
      } catch (refreshError) {
        console.error(refreshError);
      }
    } catch (error) {
      console.error(error);
      setLocalApplyMessage(`${t('status.apply_local_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsApplyingToLocal(false);
    }
  }

  async function disableCodexModelCatalogProjection(): Promise<boolean> {
    setIsDisablingModelCatalog(true);
    try {
      const result = await trackRequest(
        'DisableGetTokensCodexModelCatalogProjection',
        { args: [] },
        () => DisableGetTokensCodexModelCatalogProjection()
      );
      const restartMessage = result.modelCatalogRequiresRestart ? '，重启 Codex 后生效' : '';
      setLocalApplyMessage(`已停用 GetTokens /model 同步：${result.configPath}${restartMessage}`);
      return true;
    } catch (error) {
      console.error(error);
      setLocalApplyMessage(`${t('status.apply_local_failed')}: ${toErrorMessage(error)}`);
      return false;
    } finally {
      setIsDisablingModelCatalog(false);
    }
  }

  async function enableCodexModelCatalogProjection(): Promise<boolean> {
    setIsDisablingModelCatalog(true);
    try {
      const models = relayAccountPoolModels.length > 0 ? relayAccountPoolModels : [];
      const result = await trackRequest(
        'EnableGetTokensCodexModelCatalogProjection',
        { modelCount: models.length },
        () => EnableGetTokensCodexModelCatalogProjection(models)
      );
      if (result.existingExternalModelCatalogPath) {
        const warningMessage = result.warnings?.length ? ` / ${result.warnings.join(' / ')}` : '';
        setLocalApplyMessage(`保留外部 model_catalog_json：${result.existingExternalModelCatalogPath}${warningMessage}`);
        return false;
      }
      setLocalApplyMessage(`/model 同步已启用：${result.modelCatalogPath || result.configPath}，重启 Codex 后生效`);
      return true;
    } catch (error) {
      console.error(error);
      setLocalApplyMessage(`${t('status.apply_local_failed')}: ${toErrorMessage(error)}`);
      return false;
    } finally {
      setIsDisablingModelCatalog(false);
    }
  }

  async function persistCodexModelCatalogSyncPreference(enabled: boolean, reason?: string): Promise<boolean> {
    try {
      await trackRequest(
        'SetCodexModelCatalogSyncEnabled',
        { enabled, ...(reason ? { reason } : {}) },
        () => SetCodexModelCatalogSyncEnabled(enabled)
      );
      return true;
    } catch (error) {
      console.error(error);
      setLocalApplyMessage(`sync_model_catalog 保存失败：${toErrorMessage(error)}`);
      return false;
    }
  }

  async function changeSyncCodexModelCatalog(nextValue: boolean) {
    setSyncCodexModelCatalog(nextValue);
    const saved = await persistCodexModelCatalogSyncPreference(nextValue);
    if (!saved) {
      setSyncCodexModelCatalog(!nextValue);
      return;
    }

    if (nextValue) {
      const enabled = await enableCodexModelCatalogProjection();
      if (!enabled) {
        setSyncCodexModelCatalog(false);
        void persistCodexModelCatalogSyncPreference(false, 'enable-failed');
      }
      return;
    }

    const disabled = await disableCodexModelCatalogProjection();
    if (!disabled) {
      setSyncCodexModelCatalog(true);
      void persistCodexModelCatalogSyncPreference(true, 'disable-failed');
    }
  }

  async function applyClaudeConfigToLocal(draft: ClaudeCodeLocalApplyDraft) {
    const normalizedKey = (relayKeys[draft.relayKeyIndex] || '').trim();
    if (!normalizedKey) {
      setClaudeApplyMessage(t('status.apply_local_missing_key'));
      return;
    }

    setIsApplyingClaude(true);
    try {
      const result = await trackRequest(
        'ApplyClaudeCodeAPIKeyConfigToLocal',
        {
          apiKey: normalizedKey,
          baseURL: draft.baseUrl,
          options: {
            authField: draft.authField,
            model: draft.model,
            defaultHaikuModel: draft.defaultHaikuModel,
            defaultSonnetModel: draft.defaultSonnetModel,
            defaultOpusModel: draft.defaultOpusModel,
            smallFastModel: draft.smallFastModel,
            maxOutputTokens: draft.maxOutputTokens,
            apiTimeoutMs: draft.apiTimeoutMs,
            disableNonEssentialTraffic: draft.disableNonEssentialTraffic,
            claudeCodeAttributionHeader: draft.claudeCodeAttributionHeader,
          },
        },
        () =>
          ApplyClaudeCodeAPIKeyConfigToLocal(normalizedKey, draft.baseUrl, {
            authField: draft.authField,
            model: draft.model,
            defaultHaikuModel: draft.defaultHaikuModel,
            defaultSonnetModel: draft.defaultSonnetModel,
            defaultOpusModel: draft.defaultOpusModel,
            smallFastModel: draft.smallFastModel,
            maxOutputTokens: draft.maxOutputTokens,
            apiTimeoutMs: draft.apiTimeoutMs,
            disableNonEssentialTraffic: draft.disableNonEssentialTraffic,
            claudeCodeAttributionHeader: draft.claudeCodeAttributionHeader,
          })
      );
      const warningSuffix = result.warnings?.length ? ` / ${result.warnings.join(' / ')}` : '';
      setClaudeApplyMessage(`${t('status.apply_local_claude_done')}: ${result.settingsPath}${warningSuffix}`);
    } catch (error) {
      console.error(error);
      setClaudeApplyMessage(`${t('status.apply_local_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsApplyingClaude(false);
    }
  }

  const accountStoreDiagnosticsView = useMemo(
    () => buildAccountStoreDiagnosticsView(accountStoreDiagnostics),
    [accountStoreDiagnostics]
  );
  const quotaEvidenceSection = useMemo(
    () => buildStatusQuotaEvidenceSectionState(quotaStatuses, 'codex'),
    [quotaStatuses]
  );
  const healthzHasError = healthz.startsWith('ERROR:') || healthz.startsWith('FAIL:');
  const trimmedStatusMessage = sidecarStatus.message.trim();
  const statusHeadline =
    sidecarStatus.code === 'ready' && !healthzHasError
      ? t('status.online')
      : healthzHasError
        ? healthz.replace(/^(ERROR:|FAIL:)\s*/, '')
        : trimmedStatusMessage
          ? trimmedStatusMessage
          : t('status.offline');
  const statusBadgeState: StatusBadgeState =
    sidecarStatus.code === 'ready' && !healthzHasError
      ? 'success'
      : healthzHasError
        ? 'error'
        : healthz === 'CHECKING...'
          ? 'processing'
          : 'default';
  const statusToneColor =
    statusBadgeState === 'success'
      ? 'success'
      : statusBadgeState === 'error'
        ? 'error'
        : statusBadgeState === 'processing'
          ? 'blue'
          : 'default';
  const runtimeLabel = hasWailsAppBindings() ? 'Wails runtime' : 'browser runtime';
  const statusDisplayValue = statusHeadline === runtimeLabel ? healthz : statusHeadline;
  return (
    <div className={statusPageShellClass} data-collaboration-id="PAGE_STATUS">
      <div className={statusPageContentClass}>
        <Card
          variant="outlined"
          className={statusHeroCardClass}
          styles={{ body: { padding: 16 } }}
          data-status-hero="true"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <Space orientation="vertical" size={8} className="min-w-0">
              <Typography.Title level={2} className="!m-0 !text-[length:var(--gt-font-size-2xl)] !font-semibold">
                {t('status.title')}
              </Typography.Title>
              <div data-status-header-health="quiet">
                <Badge
                  status={statusBadgeState}
                  text={
                    <Typography.Text className="text-[length:var(--gt-font-size-sm)]">
                      {healthz}
                    </Typography.Text>
                  }
                />
              </div>
            </Space>
            <Space wrap align="start" className="justify-start lg:justify-end">
              <Tag bordered color={statusToneColor} className="m-0">
                {statusDisplayValue}
              </Tag>
              <Tag bordered color={hasWailsAppBindings() ? 'success' : 'warning'} className="m-0">
                {runtimeLabel}
              </Tag>
            </Space>
          </div>
        </Card>

        <section className={statusWorkbenchGridClass} data-status-workbench-grid="true">
          <div className={statusPrimaryRailClass} data-status-primary-rail="true">
            <StatusApplyLocalSection
              t={t}
              localApplyMessage={localApplyMessage}
              claudeApplyMessage={claudeApplyMessage}
              isLANAccessEnabled={isLANAccessEnabled}
              isApplyingToLocal={isApplyingToLocal}
              isApplyingClaude={isApplyingClaude}
              isReady={sidecarStatus.code === 'ready'}
              codexLocalConfigLoaded={localCodexProviderStateLoaded}
              relayKeyItems={relayKeyItems}
              selectedKeyIndex={selectedKeyIndex}
              visibleRelayEndpoints={visibleRelayEndpoints}
              selectedEndpointID={selectedEndpointID}
              selectedEndpointBaseUrl={selectedEndpoint.baseUrl}
              relayProviderOptions={relayProviderOptions}
              selectedRelayProviderID={selectedRelayProviderID}
              codexLocalAuthStrategy={codexLocalAuthStrategy}
              localCodexAuthState={localCodexAuthState}
              codexLocalCanApply={codexLocalPreflight.canApply}
              codexLocalApplyBlockedMessage={codexLocalApplyBlockedMessage}
              relayReasoningEffortOptions={relayReasoningProfile.options}
              selectedRelayReasoningEffort={selectedRelayReasoningEffort}
              selectedRelayModel={selectedRelayModel}
              resolvedRelayModels={resolvedRelayModels}
              onOpenCreateRelayKeyEditor={openCreateRelayKeyEditor}
              onToggleLANAccess={() => setIsLANAccessEnabled((prev) => !prev)}
              onApplyRelayConfigToLocal={() => void applyRelayConfigToLocal()}
              onApplyClaude={(draft) => void applyClaudeConfigToLocal(draft)}
              onSelectKeyIndex={setSelectedKeyIndex}
              onSelectEndpointID={setSelectedEndpointID}
            onCopyEndpointBaseUrl={() => void copyText(selectedEndpoint.baseUrl, t('status.endpoint_copied'))}
            onOpenCreateRelayProviderEditor={openCreateRelayProviderEditor}
            onSelectRelayProviderID={selectRelayProviderID}
            onSelectCodexLocalAuthStrategy={setCodexLocalAuthStrategy}
            onDeleteRelayProviderOption={deleteRelayProviderOption}
            onSelectRelayReasoningEffort={setSelectedRelayReasoningEffort}
            onCommitRelayModelSelection={commitRelayModelSelection}
            onCopyText={(value, successMessage) => void copyText(value, successMessage)}
            relayKeyDisplayName={relayKeyDisplayName}
            supportsWebsockets={supportsWebsockets}
            localCodexProviderWebsocketRisk={localCodexProviderWebsocketRisk}
            onToggleSupportsWebsockets={() => setSupportsWebsockets((prev) => !prev)}
            syncCodexModelCatalog={syncCodexModelCatalog}
            isDisablingModelCatalog={isDisablingModelCatalog}
            onChangeSyncCodexModelCatalog={(nextValue) => void changeSyncCodexModelCatalog(nextValue)}
            />
          </div>
          <aside className={statusDiagnosticsRailClass} data-status-diagnostics-rail="true">
            <AccountStoreDiagnosticsPanel view={accountStoreDiagnosticsView} />
            <StatusQuotaEvidenceSection state={quotaEvidenceSection} />
          </aside>
        </section>
      </div>

      {relayKeyEditor ? (
        <RelayKeyEditorModal
          editor={relayKeyEditor}
          t={t}
          onClose={() => setRelayKeyEditor(null)}
          onChange={(next) => setRelayKeyEditor(next)}
          onSubmit={() => void submitRelayKeyEditor()}
        />
      ) : null}

      {relayProviderEditor ? (
        <RelayProviderEditorModal
          editor={relayProviderEditor}
          t={t}
          onClose={() => setRelayProviderEditor(null)}
          onChange={(next) => setRelayProviderEditor(next)}
          onSubmit={addRelayProviderOption}
        />
      ) : null}
    </div>
  );
}
