import { useEffect, useMemo, useRef, useState } from 'react';
import { GetRelayServiceConfig, UpdateRelayServiceAPIKeys } from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';
import { useDebug } from '../context/DebugContext';
import { useI18n } from '../context/I18nContext';
import type { SidecarStatus } from '../types';
import { toErrorMessage } from '../utils/error';

interface StatusPageProps {
  sidecarStatus?: SidecarStatus;
  version?: string;
}

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
};

function maskRelayKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 12) {
    return trimmed || 'KEY';
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

export default function StatusPage({
  sidecarStatus = defaultSidecarStatus,
  version = 'dev',
}: StatusPageProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const startTimeRef = useRef(Date.now());
  const [healthz, setHealthz] = useState('CHECKING...');
  const [uptime, setUptime] = useState('0s');
  const [relayKeys, setRelayKeys] = useState<string[]>([]);
  const [relayKeysDraft, setRelayKeysDraft] = useState('');
  const [relayEndpoints, setRelayEndpoints] = useState<main.RelayServiceEndpoint[]>([]);
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0);
  const [selectedEndpointID, setSelectedEndpointID] = useState('localhost');
  const [serviceMessage, setServiceMessage] = useState('');
  const [isSavingServiceKeys, setIsSavingServiceKeys] = useState(false);

  const selectedKey = relayKeys[selectedKeyIndex] || '';
  const selectedEndpoint =
    relayEndpoints.find((endpoint) => endpoint.id === selectedEndpointID) ||
    relayEndpoints[0] || {
      id: 'localhost',
      kind: 'localhost',
      host: '127.0.0.1',
      baseUrl: `http://127.0.0.1:${sidecarStatus.port || 8317}/v1`,
    };

  const serviceConfig = useMemo(
    () =>
      JSON.stringify(
        {
          auth_mode: 'apikey',
          OPENAI_API_KEY: selectedKey || '<YOUR_API_KEY>',
          base_url: selectedEndpoint.baseUrl,
        },
        null,
        2
      ),
    [selectedEndpoint.baseUrl, selectedKey]
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
        setRelayKeysDraft('');
        setRelayEndpoints([]);
        setSelectedKeyIndex(0);
        setSelectedEndpointID('localhost');
        setServiceMessage('');
        return;
      }

      try {
        const config = await trackRequest('GetRelayServiceConfig', { args: [] }, () => GetRelayServiceConfig());
        if (cancelled) {
          return;
        }
        setRelayKeys(config.apiKeys || []);
        setRelayKeysDraft((config.apiKeys || []).join('\n'));
        setRelayEndpoints(config.endpoints || []);
        setSelectedKeyIndex(0);
        setSelectedEndpointID(config.endpoints?.[0]?.id || 'localhost');
        setServiceMessage(t('status.service_key_loaded'));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setRelayKeys([]);
        setRelayKeysDraft('');
        setRelayEndpoints([]);
        setSelectedKeyIndex(0);
        setSelectedEndpointID('localhost');
        setServiceMessage(t('status.service_key_missing'));
      }
    }

    void loadRelayServiceConfig();

    return () => {
      cancelled = true;
    };
  }, [sidecarStatus.code, t, trackRequest]);

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

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error(error);
    }
  }

  async function saveRelayServiceAPIKeys() {
    const normalized = relayKeysDraft
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    if (normalized.length === 0) {
      setServiceMessage(t('status.service_keys_required'));
      return;
    }

    setIsSavingServiceKeys(true);
    try {
      const config = await trackRequest('UpdateRelayServiceAPIKeys', { apiKeys: normalized }, () =>
        UpdateRelayServiceAPIKeys(normalized)
      );
      const nextKeys = config.apiKeys || [];
      const nextEndpoints = config.endpoints || [];
      setRelayKeys(nextKeys);
      setRelayKeysDraft(nextKeys.join('\n'));
      setRelayEndpoints(nextEndpoints);
      setSelectedKeyIndex((prev) => Math.min(prev, Math.max(nextKeys.length - 1, 0)));
      setSelectedEndpointID((prev) =>
        nextEndpoints.some((endpoint) => endpoint.id === prev) ? prev : (nextEndpoints[0]?.id || 'localhost')
      );
      setServiceMessage(t('status.service_keys_saved'));
    } catch (error) {
      console.error(error);
      setServiceMessage(`${t('status.service_keys_save_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsSavingServiceKeys(false);
    }
  }

  function endpointLabel(endpoint: main.RelayServiceEndpoint) {
    if (endpoint.kind === 'hostname') {
      return t('status.endpoint_hostname');
    }
    if (endpoint.kind === 'lan') {
      return t('status.endpoint_lan');
    }
    return t('status.endpoint_localhost');
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
            <button onClick={() => void copyText(serviceConfig)} className="btn-swiss !px-3 !py-1 !text-[9px]">
              复制
            </button>
          </div>

          <div className="space-y-6 border-b-2 border-[var(--border-color)] p-6">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                {t('status.service_api_keys')}
              </div>
              <textarea
                value={relayKeysDraft}
                onChange={(event) => {
                  setRelayKeysDraft(event.target.value);
                  setServiceMessage('');
                }}
                placeholder="sk-gettokens-a\nsk-gettokens-b"
                rows={4}
                className="w-full resize-y border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 font-mono text-sm font-bold text-[var(--text-primary)] outline-none"
              />
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                  {t('status.service_keys_hint')}
                </div>
                <button
                  onClick={() => void saveRelayServiceAPIKeys()}
                  disabled={isSavingServiceKeys || sidecarStatus.code !== 'ready'}
                  className="btn-swiss !px-4 !py-3 !text-[10px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingServiceKeys ? t('status.service_keys_saving') : t('status.service_keys_save')}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                {t('status.preview_key')}
              </div>
              <div className="flex flex-wrap gap-2">
                {relayKeys.map((item, index) => (
                  <button
                    key={`${item}-${index}`}
                    onClick={() => setSelectedKeyIndex(index)}
                    className={`border-2 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-wide ${
                      selectedKeyIndex === index
                        ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                    }`}
                  >
                    {`KEY ${index + 1} · ${maskRelayKey(item)}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                {t('status.endpoint_title')}
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {relayEndpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    onClick={() => setSelectedEndpointID(endpoint.id)}
                    className={`space-y-3 border-2 p-4 text-left ${
                      selectedEndpointID === endpoint.id
                        ? 'border-[var(--border-color)] bg-[var(--bg-main)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                          {endpointLabel(endpoint)}
                        </div>
                        <div className="mt-1 font-mono text-sm font-black text-[var(--text-primary)]">{endpoint.host}</div>
                      </div>
                      <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">{endpoint.kind}</span>
                    </div>
                    <div className="font-mono text-xs font-bold break-all text-[var(--text-primary)]">{endpoint.baseUrl}</div>
                    <div className="flex justify-end">
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          void copyText(endpoint.baseUrl);
                        }}
                        className="cursor-pointer text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]"
                      >
                        复制
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">{serviceMessage}</div>
          </div>

          <pre className="overflow-auto p-6 font-mono text-xs font-bold leading-6 text-[var(--text-primary)]">
            {serviceConfig}
          </pre>
        </div>
      </div>
    </div>
  );
}
