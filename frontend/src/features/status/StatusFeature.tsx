import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApplyRelayServiceConfigToLocal,
  GetRelayServiceConfig,
  UpdateRelayServiceAPIKeys,
} from '../../../wailsjs/go/main/App';
import type { main } from '../../../wailsjs/go/models';
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

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
};

const relayKeyAliasStorageKey = 'gettokens.status.relay-key-aliases';
const relayModelOptions = ['GT', 'gpt-5.4'] as const;

function maskRelayKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 12) {
    return trimmed || 'KEY';
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
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

export default function StatusFeature({
  sidecarStatus = defaultSidecarStatus,
  version = 'dev',
}: StatusFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const startTimeRef = useRef(Date.now());
  const [healthz, setHealthz] = useState('CHECKING...');
  const [uptime, setUptime] = useState('0s');
  const [relayKeys, setRelayKeys] = useState<string[]>([]);
  const [relayEndpoints, setRelayEndpoints] = useState<main.RelayServiceEndpoint[]>([]);
  const [relayKeyAliases, setRelayKeyAliases] = useState<Record<string, string>>(() => loadRelayKeyAliases());
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
  const [selectedEndpointID, setSelectedEndpointID] = useState('localhost');
  const [isLANAccessEnabled, setIsLANAccessEnabled] = useState(true);
  const [selectedRelayModel, setSelectedRelayModel] = useState<(typeof relayModelOptions)[number]>('GT');
  const [openKeyMenuIndex, setOpenKeyMenuIndex] = useState<number | null>(null);
  const [relayKeyEditor, setRelayKeyEditor] = useState<RelayKeyEditorState | null>(null);
  const [serviceMessage, setServiceMessage] = useState('');
  const [localApplyMessage, setLocalApplyMessage] = useState('');
  const [isSavingServiceKeys, setIsSavingServiceKeys] = useState(false);
  const [isApplyingToLocal, setIsApplyingToLocal] = useState(false);

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
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
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
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRelayServiceConfig() {
      if (sidecarStatus.code !== 'ready') {
        setRelayKeys([]);
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
        setRelayKeys(config.apiKeys || []);
        setRelayEndpoints(config.endpoints || []);
        setSelectedKeyIndex(0);
        setSelectedEndpointID(config.endpoints?.[0]?.id || 'localhost');
        setServiceMessage(t('status.service_key_loaded'));
        setLocalApplyMessage('');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setRelayKeys([]);
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
      const nextEndpoints = config.endpoints || [];
      setRelayKeys(nextKeys);
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
    } catch (error) {
      console.error(error);
      setLocalApplyMessage(`${t('status.apply_local_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsApplyingToLocal(false);
    }
  }

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_STATUS">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex items-center justify-between border-b-4 border-[var(--border-color)] pb-4">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
            {t('status.title')}
          </h2>
          <div
            className={`border-2 border-[var(--border-color)] px-4 py-1 text-xs font-black uppercase tracking-widest text-white ${
              sidecarStatus.code === 'ready' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {sidecarStatus.code === 'ready' ? t('status.online') : t('status.offline')}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="card-swiss !p-6">
            <div className="mb-2 text-[10px] font-black uppercase text-[var(--text-primary)]">
              {t('status.core_state')}
            </div>
            <div className="text-xl font-black italic text-[var(--text-primary)]">{sidecarStatus.code.toUpperCase()}</div>
          </div>
          <div className="card-swiss !p-6">
            <div className="mb-2 text-[10px] font-black uppercase text-[var(--text-primary)]">
              {t('status.port')}
            </div>
            <div className="text-xl font-black italic text-[var(--text-primary)]">
              {sidecarStatus.port ? `:${sidecarStatus.port}` : '—'}
            </div>
          </div>
          <div className="card-swiss !p-6">
            <div className="mb-2 text-[10px] font-black uppercase text-[var(--text-primary)]">
              {t('status.uptime')}
            </div>
            <div className="text-xl font-black italic text-[var(--text-primary)]">{uptime}</div>
          </div>
          <div className="card-swiss !p-6">
            <div className="mb-2 text-[10px] font-black uppercase text-[var(--text-primary)]">
              {t('status.build')}
            </div>
            <div className="text-xl font-black italic text-[var(--text-primary)]">{version}</div>
          </div>
        </div>

        <div className="card-swiss !p-0 overflow-hidden">
          <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-3 text-[10px] font-black italic uppercase tracking-widest">
            {t('status.diagnostic')}
          </div>
          <div className="flex items-center gap-4 p-6">
            <div
              className={`h-3 w-3 border-2 border-[var(--border-color)] ${
                sidecarStatus.code === 'ready' ? 'bg-green-600' : 'bg-red-600'
              }`}
            ></div>
            <div className="font-mono text-xs font-bold uppercase text-[var(--text-primary)]">{healthz}</div>
          </div>
        </div>

        <div className="card-swiss !p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-3">
            <div className="text-[10px] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
              {t('status.service_config')}
            </div>
            <button
              onClick={() => void applyRelayConfigToLocal()}
              disabled={isApplyingToLocal || sidecarStatus.code !== 'ready'}
              className="btn-swiss !px-3 !py-1 !text-[9px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplyingToLocal ? t('status.applying_local') : t('status.apply_local')}
            </button>
          </div>

          <div className="space-y-6 border-b-2 border-[var(--border-color)] p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {t('status.service_api_keys')}
                </div>
                <button
                  onClick={openCreateRelayKeyEditor}
                  disabled={isSavingServiceKeys || sidecarStatus.code !== 'ready'}
                  className="btn-swiss !px-3 !py-1 !text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +
                </button>
              </div>
              <div className="overflow-hidden border-2 border-[var(--border-color)]">
                {relayKeys.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      index > 0 ? 'border-t-2 border-[var(--border-color)]' : ''
                    } ${
                      selectedKeyIndex === index
                        ? 'bg-[var(--bg-main)]'
                        : 'bg-[var(--bg-surface)]'
                    }`}
                  >
                    <button onClick={() => setSelectedKeyIndex(index)} className="min-w-0 flex-1 text-left">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                        {relayKeyDisplayName(item, index)}
                      </div>
                      <div className="mt-1 font-mono text-[10px] font-black uppercase tracking-wide text-[var(--text-primary)]">
                        {maskRelayKey(item)}
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
                        <div className="absolute right-0 top-full z-10 mt-2 min-w-28 overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
                          <button
                            onClick={() => openRenameRelayKeyEditor(index)}
                            className="block w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-[var(--text-primary)]"
                          >
                            {t('status.service_key_rename')}
                          </button>
                          <button
                            onClick={() => void deleteRelayServiceAPIKey(index)}
                            className="block w-full border-t-2 border-[var(--border-color)] px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-[var(--text-primary)]"
                          >
                            {t('status.service_key_delete')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                {t('status.service_keys_hint')}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {t('status.endpoint_title')}
                </div>
                <button
                  onClick={() => setIsLANAccessEnabled((prev) => !prev)}
                  className={`btn-swiss !px-3 !py-1 !text-[9px] ${
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
                      <div className="font-mono text-xs font-bold break-all text-[var(--text-primary)]">
                        {endpoint.baseUrl}
                      </div>
                    </button>
                    <button
                      onClick={() => void copyText(endpoint.baseUrl, t('status.endpoint_copied'))}
                      className="shrink-0 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]"
                    >
                      复制
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                {t('status.model_name_title')}
              </div>
              <div className="flex flex-wrap gap-2">
                {relayModelOptions.map((model) => (
                  <button
                    key={model}
                    onClick={() => setSelectedRelayModel(model)}
                    className={`border-2 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-wide ${
                      selectedRelayModel === model
                        ? 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                    }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">{serviceMessage}</div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="overflow-hidden border-2 border-[var(--border-color)]">
                <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-2">
                  <div className="font-mono text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                    {t('status.codex_auth_json')}
                  </div>
                  <button
                    onClick={() => void copyText(serviceAuthJSON, t('status.auth_json_copied'))}
                    className="btn-swiss !px-3 !py-1 !text-[9px]"
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
                  <div className="font-mono text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                    {t('status.codex_config_toml')}
                  </div>
                  <button
                    onClick={() => void copyText(serviceConfigToml, t('status.config_toml_copied'))}
                    className="btn-swiss !px-3 !py-1 !text-[9px]"
                  >
                    复制
                  </button>
                </div>
                <pre className="overflow-x-auto bg-[var(--bg-surface)] p-4 text-xs font-bold leading-6 text-[var(--text-primary)]">
                  {serviceConfigToml}
                </pre>
              </div>
            </div>

            <div className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">{localApplyMessage}</div>
          </div>
        </div>
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
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('status.service_api_keys')}
              </div>
              <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
                {relayKeyEditor.mode === 'create' ? t('status.service_key_create_title') : t('status.service_key_rename')}
              </h3>
            </header>
            <div className="space-y-4 p-6">
              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('status.service_key_value_label')}
                </span>
                <input
                  value={relayKeyEditor.apiKey}
                  onChange={(event) =>
                    setRelayKeyEditor((prev) => (prev ? { ...prev, apiKey: event.target.value, error: '' } : prev))
                  }
                  className="input-swiss w-full"
                  placeholder={t('status.service_key_value_placeholder')}
                  type="password"
                  disabled={relayKeyEditor.mode === 'rename'}
                />
              </label>
              {relayKeyEditor.error ? (
                <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-500">
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
    </div>
  );
}
