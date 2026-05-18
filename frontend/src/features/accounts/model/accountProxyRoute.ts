import { buildProxyURLFromNode, type ProxyNodeRecord } from '../../proxy-pool/model.ts';

export type AccountProxyMode = 'inherit' | 'direct' | 'custom';

export interface AccountProxyRouteDraft {
  mode: AccountProxyMode;
  proxyNodeID: string;
  proxyUrl: string;
}

export interface AccountProxySummary {
  label: string;
  nodeName: string;
  proxyUrl: string;
}

export function buildAccountProxyRouteDraft(
  account: { id: string; proxyUrl?: string },
  proxyNodes: readonly ProxyNodeRecord[],
): AccountProxyRouteDraft {
  const raw = (account.proxyUrl || '').trim();
  if (!raw) {
    return { mode: 'inherit', proxyNodeID: '', proxyUrl: '' };
  }
  const lower = raw.toLowerCase();
  if (lower === 'direct' || lower === 'none') {
    return { mode: 'direct', proxyNodeID: '', proxyUrl: 'direct' };
  }
  const matched = proxyNodes.find((node) => buildProxyURLFromNode(node) === raw);
  return {
    mode: 'custom',
    proxyNodeID: matched?.id || '',
    proxyUrl: raw,
  };
}

export function buildAccountProxySaveValue(draft: AccountProxyRouteDraft): string {
  if (draft.mode === 'inherit') {
    return '';
  }
  if (draft.mode === 'direct') {
    return 'direct';
  }
  if (!draft.proxyUrl || draft.proxyUrl === 'direct') {
    throw new Error('请选择代理节点或切换到继承/直连模式');
  }
  return draft.proxyUrl;
}

export function formatAccountProxySummary(
  proxyUrl: string | undefined,
  proxyNodes: readonly ProxyNodeRecord[],
): AccountProxySummary {
  const raw = (proxyUrl || '').trim();
  if (!raw) {
    return { label: '继承全局', nodeName: '', proxyUrl: '' };
  }
  const lower = raw.toLowerCase();
  if (lower === 'direct' || lower === 'none') {
    return { label: '直连', nodeName: '', proxyUrl: 'direct' };
  }
  const matched = proxyNodes.find((node) => buildProxyURLFromNode(node) === raw);
  if (matched) {
    return { label: matched.name, nodeName: matched.name, proxyUrl: raw };
  }
  return { label: '自定义代理', nodeName: '', proxyUrl: raw };
}
