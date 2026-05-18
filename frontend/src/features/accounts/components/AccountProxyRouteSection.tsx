import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../context/I18nContext';
import {
  buildProxyURLFromNode,
  readStoredProxyNodes,
  type ProxyNodeRecord,
} from '../../proxy-pool/model.ts';
import {
  buildAccountProxyRouteDraft,
  formatAccountProxySummary,
  type AccountProxyMode,
  type AccountProxyRouteDraft,
} from '../model/accountProxyRoute.ts';

interface AccountProxyRouteSectionProps {
  proxyUrl?: string;
  readonlyReason?: string;
  onProxyUrlChange?: (proxyUrl: string) => void;
  onValidityChange?: (message: string) => void;
}

function readProxyNodes(): ProxyNodeRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return readStoredProxyNodes(window.localStorage);
}

function getProxyNodeURL(node: ProxyNodeRecord) {
  return buildProxyURLFromNode(node);
}

export default function AccountProxyRouteSection({
  proxyUrl,
  readonlyReason,
  onProxyUrlChange,
  onValidityChange,
}: AccountProxyRouteSectionProps) {
  const { t } = useI18n();
  const [proxyNodes, setProxyNodes] = useState<ProxyNodeRecord[]>(() => readProxyNodes());
  const [draft, setDraft] = useState<AccountProxyRouteDraft>(() =>
    buildAccountProxyRouteDraft({ id: 'account-proxy-route', proxyUrl }, proxyNodes),
  );

  useEffect(() => {
    setDraft(buildAccountProxyRouteDraft({ id: 'account-proxy-route', proxyUrl }, proxyNodes));
  }, [proxyNodes, proxyUrl]);

  useEffect(() => {
    function refreshProxyNodes() {
      setProxyNodes(readProxyNodes());
    }
    window.addEventListener('storage', refreshProxyNodes);
    window.addEventListener('focus', refreshProxyNodes);
    return () => {
      window.removeEventListener('storage', refreshProxyNodes);
      window.removeEventListener('focus', refreshProxyNodes);
    };
  }, []);

  const proxyOptions = useMemo(
    () =>
      proxyNodes
        .map((node) => ({
          node,
          proxyUrl: getProxyNodeURL(node),
        }))
        .sort((a, b) => {
          if (a.node.status !== b.node.status) {
            return a.node.status === 'available' ? -1 : 1;
          }
          return a.node.latencyMs - b.node.latencyMs;
        }),
    [proxyNodes],
  );

  const summary = useMemo(() => formatAccountProxySummary(draft.proxyUrl, proxyNodes), [draft.proxyUrl, proxyNodes]);
  const isReadonly = Boolean(readonlyReason);
  const customMissing = draft.mode === 'custom' && !draft.proxyUrl.trim();
  const hasDetachedCurrentURL = Boolean(
    draft.proxyUrl && !proxyOptions.some((item) => item.proxyUrl === draft.proxyUrl),
  );

  useEffect(() => {
    onValidityChange?.(customMissing ? t('accounts.proxy_route_invalid') : '');
  }, [customMissing, onValidityChange, t]);

  function commitDraft(nextDraft: AccountProxyRouteDraft, shouldCommitURL: boolean) {
    setDraft(nextDraft);
    if (shouldCommitURL) {
      onProxyUrlChange?.(nextDraft.proxyUrl);
    }
  }

  function changeMode(mode: AccountProxyMode) {
    if (mode === 'inherit') {
      commitDraft({ mode, proxyNodeID: '', proxyUrl: '' }, true);
      return;
    }
    if (mode === 'direct') {
      commitDraft({ mode, proxyNodeID: '', proxyUrl: 'direct' }, true);
      return;
    }

    const selected = proxyOptions[0];
    if (!selected) {
      commitDraft({ mode, proxyNodeID: '', proxyUrl: '' }, false);
      return;
    }
    commitDraft({ mode, proxyNodeID: selected.node.id, proxyUrl: selected.proxyUrl }, true);
  }

  function selectProxy(nextProxyURL: string) {
    const selected = proxyOptions.find((item) => item.proxyUrl === nextProxyURL);
    commitDraft(
      {
        mode: 'custom',
        proxyNodeID: selected?.node.id || '',
        proxyUrl: nextProxyURL,
      },
      true,
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.proxy_route_title')}
          </h3>
          <div className="mt-1 text-[0.5625rem] font-mono text-[var(--text-muted)]">
            {summary.proxyUrl || t('accounts.proxy_route_inherit_hint')}
          </div>
        </div>
        <div className="border-2 border-[var(--border-color)] px-3 py-1 text-[0.5625rem] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
          {summary.label}
        </div>
      </div>

      {isReadonly ? (
        <div className="border-2 border-dashed border-[var(--border-color)] px-4 py-3 text-[0.5625rem] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {readonlyReason}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 border-2 border-[var(--border-color)]">
            {(['inherit', 'direct', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => changeMode(mode)}
                className={`min-h-9 border-r-2 border-[var(--border-color)] px-3 py-2 text-[0.5625rem] font-black uppercase tracking-[0.12em] last:border-r-0 ${
                  draft.mode === mode
                    ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
                    : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
                }`}
              >
                {mode === 'inherit'
                  ? t('accounts.proxy_route_inherit')
                  : mode === 'direct'
                    ? t('accounts.proxy_route_direct')
                    : t('accounts.proxy_route_custom')}
              </button>
            ))}
          </div>

          {draft.mode === 'custom' ? (
            <div className="space-y-2">
              <select
                value={draft.proxyUrl}
                onChange={(event) => selectProxy(event.target.value)}
                disabled={proxyOptions.length === 0 && !hasDetachedCurrentURL}
                className="input-swiss w-full font-mono !text-[0.5625rem]"
              >
                {draft.proxyUrl ? null : <option value="">{t('accounts.proxy_route_select_placeholder')}</option>}
                {hasDetachedCurrentURL ? (
                  <option value={draft.proxyUrl}>
                    {t('accounts.proxy_route_current_url')}: {draft.proxyUrl}
                  </option>
                ) : null}
                {proxyOptions.map(({ node, proxyUrl: nodeProxyURL }) => (
                  <option key={node.id} value={nodeProxyURL}>
                    {node.name} · {node.protocol} · {node.host}:{node.port} · {node.latencyMs}ms
                  </option>
                ))}
              </select>
              {proxyOptions.length === 0 && !draft.proxyUrl ? (
                <div className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[0.5625rem] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {t('accounts.proxy_route_no_nodes')}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
