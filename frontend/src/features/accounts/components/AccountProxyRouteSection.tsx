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
  type AccountProxyRouteDraft,
} from '../model/accountProxyRoute.ts';
import {
  AccountDetailEmptyState,
  AccountDetailPill,
  AccountDetailSection,
} from './AccountDetailPrimitives';

const accountProxyRouteSummaryPillClass =
  '!border-[var(--gt-border-subtle)] !bg-[var(--gt-surface-canvas)] !text-[var(--gt-ink-primary)]';
const accountProxyRouteEditorClass = 'grid gap-2';
const accountProxyRouteHintClass =
  'text-[length:var(--gt-font-size-xs)] font-medium leading-5 tracking-normal text-[var(--gt-ink-muted)]';
const accountProxyRouteSelectClass =
  'min-h-10 w-full rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 font-mono text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-primary)] outline-none transition-colors focus:border-[var(--gt-border-strong)] disabled:cursor-not-allowed disabled:bg-[var(--gt-surface-muted)] disabled:text-[var(--gt-ink-muted)]';
const accountProxyRouteEmptyClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-medium leading-5 tracking-normal text-[var(--gt-ink-muted)]';

interface AccountProxyRouteSectionProps {
  proxyUrl?: string;
  proxyNodes?: ProxyNodeRecord[];
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
  proxyNodes: injectedProxyNodes,
  readonlyReason,
  onProxyUrlChange,
  onValidityChange,
}: AccountProxyRouteSectionProps) {
  const { t } = useI18n();
  const [storedProxyNodes, setStoredProxyNodes] = useState<ProxyNodeRecord[]>(() => injectedProxyNodes ?? readProxyNodes());
  const proxyNodes = injectedProxyNodes ?? storedProxyNodes;
  const [draft, setDraft] = useState<AccountProxyRouteDraft>(() =>
    buildAccountProxyRouteDraft({ id: 'account-proxy-route', proxyUrl }, proxyNodes),
  );

  useEffect(() => {
    setDraft(buildAccountProxyRouteDraft({ id: 'account-proxy-route', proxyUrl }, proxyNodes));
  }, [proxyNodes, proxyUrl]);

  useEffect(() => {
    if (injectedProxyNodes) {
      setStoredProxyNodes(injectedProxyNodes);
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    function refreshProxyNodes() {
      setStoredProxyNodes(readProxyNodes());
    }
    window.addEventListener('storage', refreshProxyNodes);
    window.addEventListener('focus', refreshProxyNodes);
    return () => {
      window.removeEventListener('storage', refreshProxyNodes);
      window.removeEventListener('focus', refreshProxyNodes);
    };
  }, [injectedProxyNodes]);

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
    <AccountDetailSection
      componentName="AccountProxyRouteSection"
      eyebrow="Route"
      title={t('accounts.proxy_route_title')}
      meta={summary.proxyUrl || t('accounts.proxy_route_inherit_hint')}
      actions={
        <AccountDetailPill className={accountProxyRouteSummaryPillClass} data-account-proxy-route-summary="quiet">
          {summary.label}
        </AccountDetailPill>
      }
    >
      <AccountProxyRouteEditor
        readonlyReason={readonlyReason}
        draft={draft}
        proxyOptions={proxyOptions}
        hasDetachedCurrentURL={hasDetachedCurrentURL}
        onProxySelect={selectProxy}
      />
    </AccountDetailSection>
  );
}

export function AccountProxyRouteEditor({
  readonlyReason,
  draft,
  proxyOptions,
  hasDetachedCurrentURL,
  onProxySelect,
}: {
  readonlyReason?: string;
  draft: AccountProxyRouteDraft;
  proxyOptions: Array<{ node: ProxyNodeRecord; proxyUrl: string }>;
  hasDetachedCurrentURL: boolean;
  onProxySelect: (proxyUrl: string) => void;
}) {
  const { t } = useI18n();

  if (readonlyReason) {
    return (
      <AccountDetailEmptyState className="py-3 text-left !text-[length:var(--gt-font-size-xs)]">
        {readonlyReason}
      </AccountDetailEmptyState>
    );
  }

  return (
    <div data-account-proxy-route-editor="saved-node-only" className={accountProxyRouteEditorClass}>
      <div className={accountProxyRouteHintClass}>
        账号详情只选择已保存的代理池节点；刷新、测速、增删节点在代理池页面完成。
      </div>
      <select
        value={draft.proxyUrl}
        onChange={(event) => onProxySelect(event.target.value)}
        disabled={proxyOptions.length === 0 && !hasDetachedCurrentURL}
        className={accountProxyRouteSelectClass}
        data-account-proxy-route-select="saved-node"
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
        <div className={accountProxyRouteEmptyClass} data-account-proxy-route-empty="quiet">
          {t('accounts.proxy_route_no_nodes')}
        </div>
      ) : null}
    </div>
  );
}
