import { useEffect, useMemo, useState } from 'react';
import {
  ApplyRelayServiceConfigToLocal,
  GetRelayServiceConfig,
  UpdateRelayServiceAPIKeys,
} from '../../../wailsjs/go/main/App';
import type { main } from '../../../wailsjs/go/models';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import { buildRelayCodexAuthJSONSnippet, buildRelayCodexConfigTomlSnippet } from '../accounts/model/accountConfig';
import type { SidecarStatus } from '../../types';
import { toErrorMessage } from '../../utils/error';

interface StatusFeatureProps {
  sidecarStatus?: SidecarStatus;
  version?: string;
}

interface RelayKeyEditorState {
  mode: 'create' | 'rename';
  index: number | null;
  name: string;
  apiKey: string;
  error: string;
}

interface RelayModelEditorState {
  value: string;
  error: string;
}

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
  startedAtUnix: 0,
};

const relayKeyAliasStorageKey = 'gettokens.status.relay-key-aliases';
const relayLANAccessStorageKey = 'gettokens.status.lan-access-enabled';
const relayModelOptionsStorageKey = 'gettokens.status.relay-model-options';
const relaySelectedModelStorageKey = 'gettokens.status.selected-relay-model';
const defaultRelayModelOptions = ['GT', 'gpt-5.4'];

function maskRelayKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 12) {
    return trimmed || 'KEY';
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

function generateRandomRelayKey() {
  const prefix = 'sk-gettokens-';
  const hexLength = 32;

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(hexLength / 2));
    return `${prefix}${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  let suffix = '';
  while (suffix.length < hexLength) {
    suffix += Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  }
  return `${prefix}${suffix.slice(0, hexLength)}`;
}

function loadRelayKeyAliases() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string>;
  }

  try {
    const raw = window.localStorage.getItem(relayKeyAliasStorageKey);
    if (!raw) {
      return {} as Record<string, string>;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : ({} as Record<string, string>);
  } catch (error) {
    console.error(error);
    return {} as Record<string, string>;
  }
}

function saveRelayKeyAliases(aliases: Record<string, string>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relayKeyAliasStorageKey, JSON.stringify(aliases));
  } catch (error) {
    console.error(error);
  }
}

function loadLANAccessEnabled() {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const raw = window.localStorage.getItem(relayLANAccessStorageKey);
    return raw === null ? true : raw === 'true';
  } catch (error) {
    console.error(error);
    return true;
  }
}

function saveLANAccessEnabled(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relayLANAccessStorageKey, String(value));
  } catch (error) {
    console.error(error);
  }
}

function loadRelayModelOptions() {
  if (typeof window === 'undefined') {
    return defaultRelayModelOptions;
  }

  try {
    const raw = window.localStorage.getItem(relayModelOptionsStorageKey);
    if (!raw) {
      return defaultRelayModelOptions;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaultRelayModelOptions;
    }
    const normalized = parsed
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return normalized.length > 0 ? Array.from(new Set(normalized)) : defaultRelayModelOptions;
  } catch (error) {
    console.error(error);
    return defaultRelayModelOptions;
  }
}

function saveRelayModelOptions(values: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relayModelOptionsStorageKey, JSON.stringify(values));
  } catch (error) {
    console.error(error);
  }
}

function loadSelectedRelayModel(modelOptions: string[]) {
  if (typeof window === 'undefined') {
    return modelOptions[0] || 'GT';
  }

  try {
    const raw = String(window.localStorage.getItem(relaySelectedModelStorageKey) || '').trim();
    return raw && modelOptions.includes(raw) ? raw : (modelOptions[0] || 'GT');
  } catch (error) {
    console.error(error);
    return modelOptions[0] || 'GT';
  }
}

function saveSelectedRelayModel(value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(relaySelectedModelStorageKey, value);
  } catch (error) {
    console.error(error);
  }
}

export default function StatusFeature({
  sidecarStatus = defaultSidecarStatus,
  version = 'dev',
}: StatusFeatureProps) {
  const { locale, t } = useI18n();
  const { trackRequest } = useDebug();
  const [healthz, setHealthz] = useState('CHECKING...');
  const [uptime, setUptime] = useState('0s');
  const [relayKeyItems, setRelayKeyItems] = useState<main.RelayServiceAPIKeyItem[]>([]);
  const [relayEndpoints, setRelayEndpoints] = useState<main.RelayServiceEndpoint[]>([]);
  const [relayModelOptions, setRelayModelOptions] = useState<string[]>(() => loadRelayModelOptions());
  const [relayKeyAliases, setRelayKeyAliases] = useState<Record<string, string>>(() => loadRelayKeyAliases());
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
  const [selectedEndpointID, setSelectedEndpointID] = useState('localhost');
  const [isLANAccessEnabled, setIsLANAccessEnabled] = useState(() => loadLANAccessEnabled());
  const [selectedRelayModel, setSelectedRelayModel] = useState<string>(() =>
    loadSelectedRelayModel(loadRelayModelOptions())
  );
  const [openKeyMenuIndex, setOpenKeyMenuIndex] = useState<number | null>(null);
  const [relayKeyEditor, setRelayKeyEditor] = useState<RelayKeyEditorState | null>(null);
  const [relayModelEditor, setRelayModelEditor] = useState<RelayModelEditorState | null>(null);
  const [serviceMessage, setServiceMessage] = useState('');
  const [localApplyMessage, setLocalApplyMessage] = useState('');
  const [isSavingServiceKeys, setIsSavingServiceKeys] = useState(false);
  const [isApplyingToLocal, setIsApplyingToLocal] = useState(false);

  const relayKeys = relayKeyItems.map((item) => item.value);
  const selectedKey = relayKeys[selectedKeyIndex] || '';
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

  const serviceAuthJSON = useMemo(
    () =>
      buildRelayCodexAuthJSONSnippet({
        apiKey: selectedKey,
        model: selectedRelayModel,
      }),
    [selectedKey, selectedRelayModel]
  );
  const serviceConfigToml = useMemo(
    () =>
      buildRelayCodexConfigTomlSnippet({
        baseUrl: selectedEndpoint.baseUrl,
        model: selectedRelayModel,
      }),
    [selectedEndpoint.baseUrl, selectedRelayModel]
  );

  useEffect(() => {
    function syncUptime() {
      if (!sidecarStatus.startedAtUnix || sidecarStatus.code !== 'ready') {
        setUptime('0s');
        return;
      }

      const seconds = Math.max(0, Math.floor((Date.now() - sidecarStatus.startedAtUnix) / 1000));
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;

      if (hours > 0) {
        setUptime(`${hours}H ${minutes}M ${remainingSeconds}S`);
      } else if (minutes > 0) {
        setUptime(`${minutes}M ${remainingSeconds}S`);
      } else {
        setUptime(`${remainingSeconds}S`);
      }
    }

    syncUptime();
    const timer = window.setInterval(syncUptime, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sidecarStatus.code, sidecarStatus.startedAtUnix]);

  useEffect(() => {
    let cancelled = false;

    async function loadRelayServiceConfig() {
      if (sidecarStatus.code !== 'ready') {
        setRelayKeyItems([]);
        setRelayEndpoints([]);
        setSelectedKeyIndex(0);
        setSelectedEndpointID('localhost');
        setServiceMessage('');
        setLocalApplyMessage('');
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
        setServiceMessage(t('status.service_key_loaded'));
        setLocalApplyMessage('');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setRelayKeyItems([]);
        setRelayEndpoints([]);
        setSelectedKeyIndex(0);
        setSelectedEndpointID('localhost');
        setServiceMessage(t('status.service_key_missing'));
        setLocalApplyMessage('');
      }
    }

    void loadRelayServiceConfig();

    return () => {
      cancelled = true;
    };
  }, [sidecarStatus.code, t, trackRequest]);

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
    if (normalized.length === 0) {
      return;
    }
    saveRelayModelOptions(normalized);
  }, [relayModelOptions]);

  useEffect(() => {
    if (!relayModelOptions.includes(selectedRelayModel)) {
      setSelectedRelayModel(relayModelOptions[0] || 'GT');
      return;
    }
    saveSelectedRelayModel(selectedRelayModel);
  }, [relayModelOptions, selectedRelayModel]);

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
        setServiceMessage(successMessage);
      }
      return true;
    } catch (error) {
      console.error(error);
      setServiceMessage(t('status.copy_failed'));
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
      setServiceMessage(t('status.service_keys_required'));
      return false;
    }

    setIsSavingServiceKeys(true);
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
      setServiceMessage(t('status.service_keys_saved'));
      return true;
    } catch (error) {
      console.error(error);
      setServiceMessage(`${t('status.service_keys_save_failed')}: ${toErrorMessage(error)}`);
      return false;
    } finally {
      setIsSavingServiceKeys(false);
    }
  }

  function openCreateRelayKeyEditor() {
    setOpenKeyMenuIndex(null);
    setRelayKeyEditor({
      mode: 'create',
      index: null,
      name: '',
      apiKey: '',
      error: '',
    });
  }

  function openRenameRelayKeyEditor(index: number) {
    const currentKey = relayKeys[index];
    if (!currentKey) {
      return;
    }

    setOpenKeyMenuIndex(null);
    setRelayKeyEditor({
      mode: 'rename',
      index,
      name: relayKeyAliases[currentKey] || '',
      apiKey: currentKey,
      error: '',
    });
  }

  async function deleteRelayServiceAPIKey(index: number) {
    const currentKey = relayKeys[index];
    if (!currentKey) {
      return;
    }

    const nextKeys = relayKeys.filter((_, itemIndex) => itemIndex !== index);
    if (nextKeys.length === 0) {
      setServiceMessage(t('status.service_keys_required'));
      return;
    }

    const saved = await saveRelayServiceAPIKeys(nextKeys, Math.max(0, Math.min(selectedKeyIndex, nextKeys.length - 1)));
    if (!saved) {
      return;
    }

    const nextAliases = { ...relayKeyAliases };
    delete nextAliases[currentKey];
    setRelayKeyAliasesWithPersist(nextAliases);
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
    setServiceMessage(t('status.service_key_name_saved'));
  }

  function openCreateRelayModelEditor() {
    setRelayModelEditor({
      value: '',
      error: '',
    });
  }

  function addRelayModelOption() {
    if (!relayModelEditor) {
      return;
    }

    const nextValue = relayModelEditor.value.trim();
    if (!nextValue) {
      setRelayModelEditor((prev) => (prev ? { ...prev, error: t('status.model_name_required') } : prev));
      return;
    }
    if (relayModelOptions.includes(nextValue)) {
      setRelayModelEditor((prev) => (prev ? { ...prev, error: t('status.model_name_exists') } : prev));
      return;
    }

    const nextOptions = [...relayModelOptions, nextValue];
    setRelayModelOptions(nextOptions);
    setSelectedRelayModel(nextValue);
    setRelayModelEditor(null);
    setServiceMessage(t('status.model_name_saved'));
  }

  function deleteRelayModelOption(value: string) {
    const nextOptions = relayModelOptions.filter((item) => item !== value);
    if (nextOptions.length === 0) {
      setServiceMessage(t('status.model_name_required'));
      return;
    }

    setRelayModelOptions(nextOptions);
    if (selectedRelayModel === value) {
      setSelectedRelayModel(nextOptions[0]);
    }
    setServiceMessage(t('status.model_name_deleted'));
  }

  async function applyRelayConfigToLocal() {
    const normalizedKey = selectedKey.trim();
    if (!normalizedKey) {
      setLocalApplyMessage(t('status.apply_local_missing_key'));
      return;
    }

    setIsApplyingToLocal(true);
    try {
      const result = await trackRequest(
        'ApplyRelayServiceConfigToLocal',
        { apiKey: normalizedKey, baseURL: selectedEndpoint.baseUrl },
        () => ApplyRelayServiceConfigToLocal(normalizedKey, selectedEndpoint.baseUrl)
      );
      setLocalApplyMessage(`${t('status.apply_local_done')}: ${result.codexHomePath}`);
      try {
        const refreshed = await trackRequest('GetRelayServiceConfig', { args: [] }, () => GetRelayServiceConfig());
        setRelayKeyItems(refreshed.apiKeyItems || (refreshed.apiKeys || []).map((value) => ({ value })));
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

  function formatRelayKeyTimestamp(value?: string) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return '—';
    }

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return trimmed;
    }

    return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_STATUS">
      <div className="mx-auto max-w-6xl space-y-10">
        <WorkspacePageHeader
          title={t('status.title')}
          subtitle={
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 border border-[var(--border-color)] ${
                  sidecarStatus.code === 'ready' ? 'bg-green-600' : 'bg-red-600'
                }`}
              ></span>
              <span className="font-mono tracking-[0.04em] text-[var(--text-primary)]">{healthz}</span>
            </span>
          }
          align="center"
          actionsClassName="shrink-0"
          actions={
            <div
              className={`max-w-[18rem] border-2 px-4 py-1 text-right text-xs font-black uppercase tracking-widest ${
                sidecarStatus.code === 'ready' && !healthzHasError
                  ? 'border-black bg-white text-black'
                  : 'border-red-600 bg-white text-red-600'
              }`}
            >
              {statusHeadline}
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="card-swiss flex min-h-[8.5rem] flex-col justify-between !p-6">
            <div className="mb-2 text-[0.625rem] font-black uppercase text-[var(--text-primary)]">
              {t('status.core_state')}
            </div>
            <div className="text-xl font-black italic text-[var(--text-primary)]">{sidecarStatus.code.toUpperCase()}</div>
          </div>
          <div className="card-swiss flex min-h-[8.5rem] flex-col justify-between !p-6">
            <div className="mb-2 text-[0.625rem] font-black uppercase text-[var(--text-primary)]">
              {t('status.port')}
            </div>
            <div className="text-xl font-black italic text-[var(--text-primary)]">
              {sidecarStatus.port ? `:${sidecarStatus.port}` : '—'}
            </div>
          </div>
          <div className="card-swiss flex min-h-[8.5rem] flex-col justify-between !p-6">
            <div className="mb-2 text-[0.625rem] font-black uppercase text-[var(--text-primary)]">
              {t('status.uptime')}
            </div>
            <div className="text-xl font-black italic text-[var(--text-primary)]">{uptime}</div>
          </div>
          <div className="card-swiss flex min-h-[8.5rem] flex-col justify-between !p-6">
            <div className="mb-2 text-[0.625rem] font-black uppercase text-[var(--text-primary)]">
              {t('status.build')}
            </div>
            <div className="text-xl font-black italic text-[var(--text-primary)]">{version}</div>
          </div>
        </div>

        <section className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <section className="overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-3">
                <div>
                  <div className="text-[0.625rem] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
                    {t('status.service_config')}
                  </div>
                  <div className="mt-1 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
                    {relayKeys.length} {t('status.service_api_keys')}
                  </div>
                </div>
                <button
                  onClick={openCreateRelayKeyEditor}
                  disabled={isSavingServiceKeys || sidecarStatus.code !== 'ready'}
                  className="btn-swiss !px-3 !py-1 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div className="overflow-hidden border-2 border-[var(--border-color)]">
                  {relayKeyItems.map((item, index) => (
                    <div
                      key={`${item.value}-${index}`}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        index > 0 ? 'border-t-2 border-[var(--border-color)]' : ''
                      } ${
                        selectedKeyIndex === index
                          ? 'bg-[var(--bg-main)]'
                          : 'bg-[var(--bg-surface)]'
                      }`}
                    >
                      <button onClick={() => setSelectedKeyIndex(index)} className="min-w-0 flex-1 text-left">
                        <div className="text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-primary)]">
                          {relayKeyDisplayName(item.value, index)}
                        </div>
                        <div className="mt-1 font-mono text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                          {maskRelayKey(item.value)}
                        </div>
                        <div className="mt-2 grid gap-1 text-[0.5625rem] font-bold uppercase tracking-wide text-[var(--text-muted)] md:grid-cols-2">
                          <div>{t('status.service_key_created_at')}: {formatRelayKeyTimestamp(item.createdAt)}</div>
                          <div>{t('status.service_key_last_used_at')}: {formatRelayKeyTimestamp(item.lastUsedAt)}</div>
                        </div>
                      </button>
                      <div className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
                        <button
                          onClick={() => setOpenKeyMenuIndex((prev) => (prev === index ? null : index))}
                          className="flex h-7 w-7 items-center justify-center text-base font-black text-[var(--text-muted)]"
                        >
                          ⋮
                        </button>
                        {openKeyMenuIndex === index ? (
                          <div className="absolute right-full top-1/2 z-10 mr-2 flex -translate-y-1/2 items-center gap-2">
                            <button
                              onClick={() => openRenameRelayKeyEditor(index)}
                              className="btn-swiss whitespace-nowrap !px-3 !py-1 !text-[0.5625rem]"
                            >
                              {t('status.service_key_rename')}
                            </button>
                            <button
                              onClick={() => void deleteRelayServiceAPIKey(index)}
                              className="btn-swiss whitespace-nowrap !px-3 !py-1 !text-[0.5625rem]"
                            >
                              {t('status.service_key_delete')}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
                  {t('status.service_keys_hint')}
                </div>
                {serviceMessage ? (
                  <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                    {serviceMessage}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-3">
                <div>
                  <div className="text-[0.625rem] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
                    {t('status.apply_local')}
                  </div>
                  <div className="mt-1 text-[0.6875rem] font-mono font-black uppercase tracking-wide text-[var(--text-muted)]">
                    {selectedRelayModel}
                  </div>
                </div>
                <button
                  onClick={() => void applyRelayConfigToLocal()}
                  disabled={isApplyingToLocal || sidecarStatus.code !== 'ready'}
                  className="btn-swiss bg-[var(--border-color)] !px-4 !py-2 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApplyingToLocal ? t('status.applying_local') : t('status.apply_local')}
                </button>
              </div>
              <div className="divide-y-2 divide-[var(--border-color)]">
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-primary)]">
                      {t('status.endpoint_title')}
                    </div>
                    <button
                      onClick={() => setIsLANAccessEnabled((prev) => !prev)}
                      className={`btn-swiss !px-3 !py-1 !text-[0.5625rem] ${
                        isLANAccessEnabled ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''
                      }`}
                    >
                      {isLANAccessEnabled ? t('status.lan_access_on') : t('status.lan_access_off')}
                    </button>
                  </div>
                  <div className="overflow-hidden border-2 border-[var(--border-color)]">
                    {visibleRelayEndpoints.map((endpoint, index) => (
                      <div
                        key={endpoint.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          index > 0 ? 'border-t-2 border-[var(--border-color)]' : ''
                        } ${
                          selectedEndpointID === endpoint.id ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'bg-[var(--bg-surface)]'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedEndpointID(endpoint.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div
                            className={`font-mono text-xs font-bold break-all ${
                              selectedEndpointID === endpoint.id ? 'text-[var(--bg-main)]' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {endpoint.baseUrl}
                          </div>
                        </button>
                        <button
                          onClick={() => void copyText(endpoint.baseUrl, t('status.endpoint_copied'))}
                          className={`shrink-0 text-[0.625rem] font-black uppercase tracking-wide ${
                            selectedEndpointID === endpoint.id ? 'text-[var(--bg-main)]' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          复制
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-primary)]">
                      {t('status.model_name_title')}
                    </div>
                    <button onClick={openCreateRelayModelEditor} className="btn-swiss !px-3 !py-1 !text-[0.625rem]">
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {relayModelOptions.map((model) => (
                      <div
                        key={model}
                        className={`border-2 px-3 py-2 font-mono text-[0.625rem] font-black uppercase tracking-wide ${
                          selectedRelayModel === model
                            ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                            : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedRelayModel(model)} className="text-left">
                            {model}
                          </button>
                          <button
                            onClick={() => deleteRelayModelOption(model)}
                            className={selectedRelayModel === model ? 'text-[var(--bg-main)]' : 'text-[var(--text-muted)]'}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {localApplyMessage ? (
                  <div className="bg-[var(--bg-main)] px-5 py-4 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                    {localApplyMessage}
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div className="overflow-hidden border-2 border-[var(--border-color)]">
              <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-2">
                <div className="font-mono text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {t('status.codex_auth_json')}
                </div>
                <button
                  onClick={() => void copyText(serviceAuthJSON, t('status.auth_json_copied'))}
                  className="btn-swiss !px-3 !py-1 !text-[0.5625rem]"
                >
                  复制
                </button>
              </div>
              <pre className="overflow-x-auto bg-[var(--bg-surface)] p-4 text-xs font-bold leading-6 text-[var(--text-primary)]">
                {serviceAuthJSON}
              </pre>
            </div>

            <div className="overflow-hidden border-2 border-[var(--border-color)]">
              <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-2">
                <div className="font-mono text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {t('status.codex_config_toml')}
                </div>
                <button
                  onClick={() => void copyText(serviceConfigToml, t('status.config_toml_copied'))}
                  className="btn-swiss !px-3 !py-1 !text-[0.5625rem]"
                >
                  复制
                </button>
              </div>
              <pre className="overflow-x-auto bg-[var(--bg-surface)] p-4 text-xs font-bold leading-6 text-[var(--text-primary)]">
                {serviceConfigToml}
              </pre>
            </div>
          </div>
        </section>
      </div>

      {relayKeyEditor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
          onClick={() => setRelayKeyEditor(null)}
        >
          <div
            className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('status.service_api_keys')}
              </div>
              <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
                {relayKeyEditor.mode === 'create' ? t('status.service_key_create_title') : t('status.service_key_rename')}
              </h3>
            </header>
            <div className="space-y-4 p-6">
              <label className="space-y-2">
                <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('status.service_key_name_label')}
                </span>
                <input
                  value={relayKeyEditor.name}
                  onChange={(event) =>
                    setRelayKeyEditor((prev) => (prev ? { ...prev, name: event.target.value, error: '' } : prev))
                  }
                  className="input-swiss w-full"
                  placeholder={t('status.service_key_name_placeholder')}
                />
              </label>
              <label className="space-y-2">
                <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('status.service_key_value_label')}
                </span>
                <div className="relative">
                  <input
                    value={relayKeyEditor.apiKey}
                    onChange={(event) =>
                      setRelayKeyEditor((prev) => (prev ? { ...prev, apiKey: event.target.value, error: '' } : prev))
                    }
                    className="input-swiss w-full pr-24"
                    placeholder={t('status.service_key_value_placeholder')}
                    type="text"
                    disabled={relayKeyEditor.mode === 'rename'}
                  />
                  {relayKeyEditor.mode === 'create' ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRelayKeyEditor((prev) =>
                          prev ? { ...prev, apiKey: generateRandomRelayKey(), error: '' } : prev
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[0.5625rem] font-black uppercase tracking-wide text-[var(--text-primary)] active:scale-95"
                    >
                      {t('status.service_key_value_generate')}
                    </button>
                  ) : null}
                </div>
              </label>
              {relayKeyEditor.error ? (
                <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
                  {relayKeyEditor.error}
                </div>
              ) : null}
            </div>
            <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
              <button onClick={() => setRelayKeyEditor(null)} className="btn-swiss">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => void submitRelayKeyEditor()}
                className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]"
              >
                {relayKeyEditor.mode === 'create' ? t('status.service_key_create_submit') : t('common.save')}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {relayModelEditor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
          onClick={() => setRelayModelEditor(null)}
        >
          <div
            className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('status.model_name_title')}
              </div>
              <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
                {t('status.model_name_create_title')}
              </h3>
            </header>
            <div className="space-y-4 p-6">
              <label className="space-y-2">
                <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('status.model_name_label')}
                </span>
                <input
                  value={relayModelEditor.value}
                  onChange={(event) =>
                    setRelayModelEditor((prev) => (prev ? { ...prev, value: event.target.value, error: '' } : prev))
                  }
                  className="input-swiss w-full"
                  placeholder={t('status.model_name_placeholder')}
                />
              </label>
              {relayModelEditor.error ? (
                <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
                  {relayModelEditor.error}
                </div>
              ) : null}
            </div>
            <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
              <button onClick={() => setRelayModelEditor(null)} className="btn-swiss">
                {t('common.cancel')}
              </button>
              <button onClick={addRelayModelOption} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
                {t('status.model_name_create_submit')}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
