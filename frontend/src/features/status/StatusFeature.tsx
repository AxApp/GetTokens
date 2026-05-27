import { useEffect, useMemo, useState } from 'react';
import {
  ApplyClaudeCodeAPIKeyConfigToLocal,
  ApplyRelayServiceConfigToLocal,
  ApplyRelayServiceConfigToLocalV2,
  GetLocalCodexAuthState,
  GetLocalCodexModelProviderStateView,
  GetRelayServiceConfig,
  ListRelaySupportedModels,
  UpdateRelayServiceAPIKeys,
} from '../../../wailsjs/go/main/App';
import type { main } from '../../../wailsjs/go/models';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import {
  RelayKeyEditorModal,
  RelayProviderEditorModal,
} from './components/RelayEditors';
import {
  StatusApplyLocalSection,
} from './components/StatusPanels';
import { RELAY_CODEX_DEFAULT_MODEL, RELAY_CODEX_PROVIDER_ID } from '../accounts/model/accountConfig';
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
  const [supportsWebsockets, setSupportsWebsockets] = useState(true);
  const [relayKeyEditor, setRelayKeyEditor] = useState<RelayKeyEditorState | null>(null);
  const [relayProviderEditor, setRelayProviderEditor] = useState<RelayProviderEditorState | null>(null);
  const [localCodexAuthState, setLocalCodexAuthState] = useState<main.LocalCodexAuthState | null>(null);
  const [localApplyMessage, setLocalApplyMessage] = useState('');
  const [claudeApplyMessage, setClaudeApplyMessage] = useState('');
  const [isApplyingToLocal, setIsApplyingToLocal] = useState(false);
  const [isApplyingClaude, setIsApplyingClaude] = useState(false);

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
        setRelayEndpoints(config.endpoints || []);
        setSelectedKeyIndex(0);
        setSelectedEndpointID(config.endpoints?.[0]?.id || 'localhost');
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
  }, [sidecarStatus.code, t, trackRequest]);

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
          setSelectedRelayProviderID(
            resolveInitialRelayProviderSelection({
              providerOptions: next,
              activeProviderID: providerState?.currentProviderID,
              hasExplicitActiveProvider: Boolean(providerState?.hasExplicitCurrentProvider),
            })
          );
          return next;
        });
        const activeModel = providerState?.hasExplicitCurrentModel ? providerState.currentModel : '';
        setRelayModelOptions((prev) => {
          const next = activeModel ? Array.from(new Set([...prev, activeModel])) : prev;
          setSelectedRelayModel(
            resolveInitialRelayModelSelection({
              modelOptions: next,
              activeModel: providerState?.currentModel,
              hasExplicitActiveModel: Boolean(providerState?.hasExplicitCurrentModel),
            })
          );
          return next;
        });
      } catch (error) {
        console.error(error);
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
    if (!trimmedSelectedRelayModel) {
      setSelectedRelayModel(resolvedRelayModelNames[0] || RELAY_CODEX_DEFAULT_MODEL);
      return;
    }
    if (trimmedSelectedRelayModel !== selectedRelayModel) {
      setSelectedRelayModel(trimmedSelectedRelayModel);
      return;
    }
    saveSelectedRelayModel(trimmedSelectedRelayModel);
  }, [resolvedRelayModelNames, selectedRelayModel]);

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
    if (isLANAccessEnabled) {
      return;
    }

    const currentEndpoint = relayEndpoints.find((endpoint) => endpoint.id === selectedEndpointID);
    if (!currentEndpoint || currentEndpoint.kind !== 'lan') {
      return;
    }

    setSelectedEndpointID(relayEndpoints.find((endpoint) => endpoint.kind !== 'lan')?.id || 'localhost');
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
      setSelectedEndpointID((prev) =>
        nextEndpoints.some((endpoint) => endpoint.id === prev) ? prev : (nextEndpoints[0]?.id || 'localhost')
      );
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
        },
        () =>
          ApplyRelayServiceConfigToLocalV2({
            apiKey: normalizedKey,
            baseURL: selectedEndpoint.baseUrl,
            model: selectedRelayModel,
            reasoningEffort: selectedRelayReasoningEffort,
            providerID: selectedRelayProvider.id,
            providerName: selectedRelayProvider.name,
            supportsWebsockets,
            authStrategy: codexLocalAuthStrategy,
          })
      );
      setLocalApplyMessage(`${t('status.apply_local_done')}: ${result.codexHomePath}`);
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
          setSelectedRelayProviderID(
            resolveInitialRelayProviderSelection({
              providerOptions: next,
              activeProviderID: providerState?.currentProviderID,
              hasExplicitActiveProvider: Boolean(providerState?.hasExplicitCurrentProvider),
            })
          );
          return next;
        });
        const activeModel = providerState?.hasExplicitCurrentModel ? providerState.currentModel : '';
        setRelayModelOptions((prev) => {
          const next = activeModel ? Array.from(new Set([...prev, activeModel])) : prev;
          setSelectedRelayModel(
            resolveInitialRelayModelSelection({
              modelOptions: next,
              activeModel: providerState?.currentModel,
              hasExplicitActiveModel: Boolean(providerState?.hasExplicitCurrentModel),
            })
          );
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

  return (
    <div className="h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_STATUS">
      <div className="w-full space-y-8">
        <WorkspacePageHeader
          title={t('status.title')}
          subtitle={
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 border border-[var(--border-color)] ${
                  sidecarStatus.code === 'ready' ? 'bg-[var(--color-status-success)]' : 'bg-[var(--color-status-danger)]'
                }`}
              ></span>
              <span className="font-mono tracking-[0.04em] text-[var(--text-primary)]">{healthz}</span>
            </span>
          }
          align="center"
          actionsClassName="shrink-0"
          actions={
            <div
              className={`max-w-[18rem] border-2 px-4 py-1 text-right text-xs font-black tracking-widest ${
                sidecarStatus.code === 'ready' && !healthzHasError
                  ? 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
                  : 'border-[var(--color-status-danger)] bg-[var(--bg-main)] text-[var(--color-status-danger)]'
              }`}
            >
              {statusHeadline}
            </div>
          }
        />

        <section className="space-y-6">
          <StatusApplyLocalSection
            t={t}
            localApplyMessage={localApplyMessage}
            claudeApplyMessage={claudeApplyMessage}
            isLANAccessEnabled={isLANAccessEnabled}
            isApplyingToLocal={isApplyingToLocal}
            isApplyingClaude={isApplyingClaude}
            isReady={sidecarStatus.code === 'ready'}
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
            onSelectRelayProviderID={setSelectedRelayProviderID}
            onSelectCodexLocalAuthStrategy={setCodexLocalAuthStrategy}
            onDeleteRelayProviderOption={deleteRelayProviderOption}
            onSelectRelayReasoningEffort={setSelectedRelayReasoningEffort}
            onCommitRelayModelSelection={commitRelayModelSelection}
            onCopyText={(value, successMessage) => void copyText(value, successMessage)}
            relayKeyDisplayName={relayKeyDisplayName}
            supportsWebsockets={supportsWebsockets}
            onToggleSupportsWebsockets={() => setSupportsWebsockets((prev) => !prev)}
          />
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
