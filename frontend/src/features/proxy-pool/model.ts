export type ProxyPoolFilter = 'all' | 'available' | 'review';
export type ProxyPoolSortKey = 'name' | 'group' | 'latency' | 'availability' | 'lastCheckedAt';
export type ProxyPoolSortDirection = 'asc' | 'desc';

export type ProxyNodeStatus = 'available' | 'review';
export type ProxyNodeProtocol = 'SOCKS5' | 'SOCKS5H' | 'HTTP' | 'HTTPS';

export interface ProxyNodeRecord {
  id: string;
  name: string;
  group: string;
  protocol: ProxyNodeProtocol;
  sourceLabel: string;
  sourceURL: string;
  host: string;
  port: number;
  latencyMs: number;
  availabilityRate: number;
  lastCheckedAt: string;
  status: ProxyNodeStatus;
  note: string;
}

export interface ProxyNodeDraft {
  id?: string;
  name: string;
  group: string;
  protocol: ProxyNodeProtocol;
  sourceLabel: string;
  sourceURL: string;
  host: string;
  port: string;
  latencyMs: string;
  availabilityRate: string;
  status: ProxyNodeStatus;
  note: string;
}

export interface ProxyPoolSummary {
  totalCount: number;
  availableCount: number;
  reviewCount: number;
  averageLatencyMs: number;
  averageAvailabilityRate: number;
}

export interface ProxyPoolPaginationResult<T> {
  page: number;
  pageCount: number;
  items: T[];
}

export interface EnvironmentProxyEntry {
  source: string;
  proxyUrl: string;
}

export interface ProxyImportOptions {
  sourceLabel?: string;
  sourceURL?: string;
}

export interface ProxySubscriptionSourceRecord {
  id: string;
  url: string;
  label: string;
  lastSyncedAt: string;
  lastImportCount: number;
  lastError: string;
}

export interface ProxyProbeResult {
  proxyUrl: string;
  targetUrl: string;
  success: boolean;
  statusCode?: number;
  latencyMs: number;
  checkedAt: string;
  message: string;
}

export const PROXY_POOL_STORAGE_KEY = 'gettokens.proxy-pool.nodes';
export const PROXY_POOL_SUBSCRIPTION_STORAGE_KEY = 'gettokens.proxy-pool.subscriptions';
export const DEFAULT_PROXY_PROBE_TARGET_URL = 'https://example.com';
export const PROXY_POOL_PROBE_TARGET_STORAGE_KEY = 'gettokens.proxy-pool.probe-target';
export const PROXY_POOL_PROBE_TARGET_HISTORY_STORAGE_KEY = 'gettokens.proxy-pool.probe-target-history';
export const proxyNodeProtocols: readonly ProxyNodeProtocol[] = ['SOCKS5', 'SOCKS5H', 'HTTP', 'HTTPS'];
export const proxyNodeGroups = ['主用组', '备用组', '观察组', '冷备组', '隔离组'] as const;

export const proxyPoolFilterOptions = [
  { id: 'all', label: '全部' },
  { id: 'available', label: '可用' },
  { id: 'review', label: '待复查' },
] as const;
export const proxyPoolPageSizeOptions = [10, 20, 50] as const;
export const proxyPoolSortOptions = [
  { id: 'latency', label: '按延时' },
  { id: 'availability', label: '按可用率' },
  { id: 'lastCheckedAt', label: '按最近检测' },
  { id: 'group', label: '按分组' },
  { id: 'name', label: '按名称' },
] as const satisfies ReadonlyArray<{ id: ProxyPoolSortKey; label: string }>;

const initialProxyNodes: readonly ProxyNodeRecord[] = [
  {
    id: 'proxy-sha-01',
    name: '上海 Alpha',
    group: '主用组',
    protocol: 'SOCKS5',
    sourceLabel: '手动维护',
    sourceURL: '',
    host: '127.0.0.1',
    port: 7890,
    latencyMs: 132,
    availabilityRate: 98,
    lastCheckedAt: '2026-04-30 09:42',
    status: 'available',
    note: '主用出口稳定，可直接承载日常转发。',
  },
  {
    id: 'proxy-sg-02',
    name: '新加坡 Beta',
    group: '备用组',
    protocol: 'HTTPS',
    sourceLabel: '手动维护',
    sourceURL: '',
    host: '10.0.0.24',
    port: 8443,
    latencyMs: 184,
    availabilityRate: 94,
    lastCheckedAt: '2026-04-30 09:39',
    status: 'available',
    note: '备用链路，适合高峰时分担请求。',
  },
  {
    id: 'proxy-la-03',
    name: '洛杉矶 Epsilon',
    group: '观察组',
    protocol: 'HTTP',
    sourceLabel: '手动维护',
    sourceURL: '',
    host: '172.16.8.3',
    port: 8080,
    latencyMs: 816,
    availabilityRate: 61,
    lastCheckedAt: '2026-04-30 09:35',
    status: 'review',
    note: '最近一次检测失败，建议复测鉴权或出口质量。',
  },
  {
    id: 'proxy-fra-04',
    name: '法兰克福 Gamma',
    group: '冷备组',
    protocol: 'SOCKS5H',
    sourceLabel: '手动维护',
    sourceURL: '',
    host: '192.168.11.7',
    port: 1080,
    latencyMs: 524,
    availabilityRate: 76,
    lastCheckedAt: '2026-04-30 09:31',
    status: 'review',
    note: '可连通，但延时偏高，适合待命。',
  },
  {
    id: 'proxy-hk-05',
    name: '香港 Delta',
    group: '主用组',
    protocol: 'HTTPS',
    sourceLabel: '手动维护',
    sourceURL: '',
    host: '10.8.0.15',
    port: 9443,
    latencyMs: 148,
    availabilityRate: 96,
    lastCheckedAt: '2026-04-30 09:41',
    status: 'available',
    note: '低延时，适合主用转发。',
  },
  {
    id: 'proxy-tokyo-06',
    name: '东京 Kappa',
    group: '隔离组',
    protocol: 'HTTP',
    sourceLabel: '手动维护',
    sourceURL: '',
    host: '10.8.0.23',
    port: 8081,
    latencyMs: 930,
    availabilityRate: 42,
    lastCheckedAt: '2026-04-30 09:28',
    status: 'review',
    note: '异常波动较大，暂不参与常规使用。',
  },
] as const;
const legacySeedNodeIDs = new Set(initialProxyNodes.map((node) => node.id));

export function createInitialProxyNodes(): ProxyNodeRecord[] {
  return initialProxyNodes.map((node) => ({ ...node }));
}

export function filterProxyNodes(nodes: readonly ProxyNodeRecord[], filter: ProxyPoolFilter, query: string): ProxyNodeRecord[] {
  const normalizedQuery = query.trim().toLowerCase();

  return nodes.filter((node) => {
    if (filter === 'available' && node.status !== 'available') {
      return false;
    }

    if (filter === 'review' && node.status !== 'review') {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystacks = [
      node.name,
      node.group,
      node.protocol,
      node.sourceLabel,
      node.sourceURL,
      node.host,
      `${node.host}:${node.port}`,
      node.note,
    ];

    return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

export function filterProxyNodesByGroup(nodes: readonly ProxyNodeRecord[], group: string): ProxyNodeRecord[] {
  if (group === '全部分组') {
    return [...nodes];
  }

  return nodes.filter((node) => node.group === group);
}

export function getDefaultSortDirection(sortKey: ProxyPoolSortKey): ProxyPoolSortDirection {
  if (sortKey === 'latency' || sortKey === 'group' || sortKey === 'name') {
    return 'asc';
  }

  return 'desc';
}

export function toggleProxyPoolSort(
  currentKey: ProxyPoolSortKey,
  currentDirection: ProxyPoolSortDirection,
  nextKey: ProxyPoolSortKey,
): { key: ProxyPoolSortKey; direction: ProxyPoolSortDirection } {
  if (currentKey !== nextKey) {
    return {
      key: nextKey,
      direction: getDefaultSortDirection(nextKey),
    };
  }

  return {
    key: currentKey,
    direction: currentDirection === 'asc' ? 'desc' : 'asc',
  };
}

export function sortProxyNodes(
  nodes: readonly ProxyNodeRecord[],
  sortKey: ProxyPoolSortKey,
  direction = getDefaultSortDirection(sortKey),
): ProxyNodeRecord[] {
  const cloned = [...nodes];
  cloned.sort((left, right) => {
    const multiplier = direction === 'asc' ? 1 : -1;

    if (sortKey === 'latency') {
      return (left.latencyMs - right.latencyMs) * multiplier;
    }
    if (sortKey === 'availability') {
      return (left.availabilityRate - right.availabilityRate) * multiplier;
    }
    if (sortKey === 'lastCheckedAt') {
      return left.lastCheckedAt.localeCompare(right.lastCheckedAt) * multiplier;
    }
    if (sortKey === 'group') {
      const leftIndex = proxyNodeGroups.indexOf(left.group as (typeof proxyNodeGroups)[number]);
      const rightIndex = proxyNodeGroups.indexOf(right.group as (typeof proxyNodeGroups)[number]);
      return ((leftIndex - rightIndex) || left.name.localeCompare(right.name, 'zh-Hans-CN')) * multiplier;
    }

    return left.name.localeCompare(right.name, 'zh-Hans-CN') * multiplier;
  });
  return cloned;
}

export function summarizeProxyNodes(nodes: readonly ProxyNodeRecord[]): ProxyPoolSummary {
  if (nodes.length === 0) {
    return {
      totalCount: 0,
      availableCount: 0,
      reviewCount: 0,
      averageLatencyMs: 0,
      averageAvailabilityRate: 0,
    };
  }

  const availableCount = nodes.filter((node) => node.status === 'available').length;
  const reviewCount = nodes.length - availableCount;
  const totalLatency = nodes.reduce((sum, node) => sum + node.latencyMs, 0);
  const totalAvailabilityRate = nodes.reduce((sum, node) => sum + node.availabilityRate, 0);

  return {
    totalCount: nodes.length,
    availableCount,
    reviewCount,
    averageLatencyMs: Math.round(totalLatency / nodes.length),
    averageAvailabilityRate: Math.round(totalAvailabilityRate / nodes.length),
  };
}

export function paginateProxyNodes<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): ProxyPoolPaginationResult<T> {
  const safePageSize = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize));
  const normalizedPage = Math.min(Math.max(1, page), pageCount);
  const start = (normalizedPage - 1) * safePageSize;

  return {
    page: normalizedPage,
    pageCount,
    items: items.slice(start, start + safePageSize),
  };
}

export function cycleProxyNodeGroup(node: ProxyNodeRecord): ProxyNodeRecord {
  const currentIndex = proxyNodeGroups.indexOf(node.group as (typeof proxyNodeGroups)[number]);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % proxyNodeGroups.length : 0;

  return {
    ...node,
    group: proxyNodeGroups[nextIndex],
  };
}

export function setProxyNodeGroup(node: ProxyNodeRecord, group: string): ProxyNodeRecord {
  if (!proxyNodeGroups.includes(group as (typeof proxyNodeGroups)[number])) {
    throw new Error('代理分组不合法。');
  }

  return {
    ...node,
    group,
  };
}

export function retestProxyNode(node: ProxyNodeRecord, now = new Date()): ProxyNodeRecord {
  const improvedLatency = node.status === 'review' ? Math.max(96, node.latencyMs - 120) : node.latencyMs + 24;
  const nextStatus = improvedLatency <= 680 ? 'available' : 'review';
  const nextAvailabilityRate = nextStatus === 'available' ? Math.min(99, node.availabilityRate + 8) : Math.max(38, node.availabilityRate - 6);

  return {
    ...node,
    latencyMs: improvedLatency,
    availabilityRate: nextAvailabilityRate,
    lastCheckedAt: formatTimestamp(now),
    status: nextStatus,
    note:
      nextStatus === 'available'
        ? '最近一次复测通过，可继续参与本地代理池。'
        : '复测后仍建议观察，优先检查鉴权和线路稳定性。',
  };
}

export function buildProxyURLFromNode(node: ProxyNodeRecord): string {
  return `${node.protocol.toLowerCase()}://${node.host}:${node.port}`;
}

export function normalizeProxyProbeTargetURL(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return DEFAULT_PROXY_PROBE_TARGET_URL;
  }

  const normalizedInput = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(normalizedInput);
  } catch {
    throw new Error('测速网址不合法。');
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  if ((scheme !== 'http' && scheme !== 'https') || !parsed.hostname) {
    throw new Error('测速网址仅支持 http/https。');
  }

  return parsed.toString();
}

export function readStoredProxyProbeTargetURL(storage: Pick<Storage, 'getItem'> | null): string {
  if (!storage) {
    return DEFAULT_PROXY_PROBE_TARGET_URL;
  }

  try {
    const raw = storage.getItem(PROXY_POOL_PROBE_TARGET_STORAGE_KEY);
    return normalizeProxyProbeTargetURL(raw ?? '');
  } catch {
    return DEFAULT_PROXY_PROBE_TARGET_URL;
  }
}

export function persistProxyProbeTargetURL(storage: Pick<Storage, 'setItem'> | null, value: string) {
  storage?.setItem(PROXY_POOL_PROBE_TARGET_STORAGE_KEY, value);
}

export function readStoredProxyProbeTargetHistory(storage: Pick<Storage, 'getItem'> | null): string[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(PROXY_POOL_PROBE_TARGET_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      return [];
    }

    return parsed.slice(0, 5);
  } catch {
    return [];
  }
}

export function persistProxyProbeTargetHistory(storage: Pick<Storage, 'setItem'> | null, history: readonly string[]) {
  storage?.setItem(PROXY_POOL_PROBE_TARGET_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 5)));
}

export function rememberProxyProbeTargetURL(history: readonly string[], raw: string, limit = 5): string[] {
  const normalized = normalizeProxyProbeTargetURL(raw);
  const nextHistory: string[] = [normalized];
  const seen = new Set<string>([normalized]);

  for (const item of history) {
    try {
      const normalizedItem = normalizeProxyProbeTargetURL(item);
      if (seen.has(normalizedItem)) {
        continue;
      }
      seen.add(normalizedItem);
      nextHistory.push(normalizedItem);
      if (nextHistory.length >= limit) {
        break;
      }
    } catch {
      continue;
    }
  }

  return nextHistory;
}

export function buildProxyNodesFromEnvironment(entries: readonly EnvironmentProxyEntry[], now = new Date()): ProxyNodeRecord[] {
  return entries
    .filter((entry) => entry && typeof entry.source === 'string' && typeof entry.proxyUrl === 'string')
    .map((entry, index) => parseProxyNodeURL(entry.proxyUrl, now, {
      name: `环境代理 ${entry.source.toUpperCase()}`,
      note: `从环境变量 ${entry.source} 导入。`,
      sourceLabel: '环境变量',
      idSeed: `${entry.source}-${index + 1}`,
    }));
}

export function applyProxyProbeResult(
  node: ProxyNodeRecord,
  result: Pick<ProxyProbeResult, 'success' | 'latencyMs' | 'checkedAt' | 'message'>,
): ProxyNodeRecord {
  const nextAvailabilityRate = result.success
    ? Math.min(100, Math.max(node.availabilityRate, 80) + 4)
    : Math.max(0, Math.min(node.availabilityRate, 90) - 12);

  return {
    ...node,
    latencyMs: Math.max(0, Math.round(result.latencyMs)),
    availabilityRate: nextAvailabilityRate,
    lastCheckedAt: formatProbeCheckedAt(result.checkedAt),
    status: result.success ? 'available' : 'review',
    note: result.message.trim() || (result.success ? '最近一次检测通过。' : '最近一次检测失败。'),
  };
}

export function readStoredProxyNodes(storage: Pick<Storage, 'getItem'> | null): ProxyNodeRecord[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(PROXY_POOL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isProxyNodeRecord)) {
      return [];
    }

    if (isLegacySeedProxyNodes(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

export function persistProxyNodes(storage: Pick<Storage, 'setItem'> | null, nodes: readonly ProxyNodeRecord[]) {
  storage?.setItem(PROXY_POOL_STORAGE_KEY, JSON.stringify(nodes));
}

export function readStoredProxySubscriptions(storage: Pick<Storage, 'getItem'> | null): ProxySubscriptionSourceRecord[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(PROXY_POOL_SUBSCRIPTION_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isProxySubscriptionSourceRecord)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

export function persistProxySubscriptions(
  storage: Pick<Storage, 'setItem'> | null,
  subscriptions: readonly ProxySubscriptionSourceRecord[],
) {
  storage?.setItem(PROXY_POOL_SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subscriptions));
}

export function upsertProxySubscriptionSource(
  current: readonly ProxySubscriptionSourceRecord[],
  input: { url: string; label: string; lastSyncedAt: string; lastImportCount: number; lastError?: string },
): ProxySubscriptionSourceRecord[] {
  const normalizedURL = input.url.trim();
  const normalizedLabel = input.label.trim() || deriveProxySourceLabel(normalizedURL) || normalizedURL;
  const nextRecord: ProxySubscriptionSourceRecord = {
    id: buildProxySubscriptionSourceID(normalizedURL, normalizedLabel),
    url: normalizedURL,
    label: normalizedLabel,
    lastSyncedAt: input.lastSyncedAt,
    lastImportCount: Math.max(0, Math.round(input.lastImportCount)),
    lastError: input.lastError?.trim() || '',
  };

  const existingIndex = current.findIndex((item) => item.url === normalizedURL || item.label === normalizedLabel);
  if (existingIndex < 0) {
    return [nextRecord, ...current];
  }

  return current.map((item, index) => (index === existingIndex ? nextRecord : item));
}

export function removeProxySubscriptionSource(
  current: readonly ProxySubscriptionSourceRecord[],
  id: string,
): ProxySubscriptionSourceRecord[] {
  return current.filter((item) => item.id !== id);
}

export function removeProxyNodesBySource(
  nodes: readonly ProxyNodeRecord[],
  source: Pick<ProxySubscriptionSourceRecord, 'label' | 'url'>,
): ProxyNodeRecord[] {
  return nodes.filter((node) => node.sourceLabel !== source.label && node.sourceURL !== source.url);
}

export function createEmptyProxyNodeDraft(): ProxyNodeDraft {
  return {
    name: '',
    group: proxyNodeGroups[0],
    protocol: 'SOCKS5',
    sourceLabel: '手动维护',
    sourceURL: '',
    host: '',
    port: '1080',
    latencyMs: '180',
    availabilityRate: '95',
    status: 'available',
    note: '',
  };
}

export function createProxyNodeDraftFromRecord(node: ProxyNodeRecord): ProxyNodeDraft {
  return {
    id: node.id,
    name: node.name,
    group: node.group,
    protocol: node.protocol,
    sourceLabel: node.sourceLabel,
    sourceURL: node.sourceURL,
    host: node.host,
    port: String(node.port),
    latencyMs: String(node.latencyMs),
    availabilityRate: String(node.availabilityRate),
    status: node.status,
    note: node.note,
  };
}

export function upsertProxyNode(
  nodes: readonly ProxyNodeRecord[],
  draft: ProxyNodeDraft,
  now = new Date(),
): ProxyNodeRecord[] {
  const normalized = buildProxyNodeFromDraft(draft, now);
  const existingIndex = draft.id ? nodes.findIndex((node) => node.id === draft.id) : -1;
  if (existingIndex < 0) {
    return [normalized, ...nodes];
  }

  return nodes.map((node, index) => (index === existingIndex ? normalized : node));
}

export function parseImportedProxyNodes(raw: string, now = new Date(), options: ProxyImportOptions = {}): ProxyNodeRecord[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('导入内容不能为空。');
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('导入内容不是有效 JSON。');
    }

    if (!Array.isArray(parsed)) {
      throw new Error('导入内容必须是代理节点数组。');
    }

    if (!parsed.every(isProxyNodeRecord)) {
      throw new Error('导入数组中存在不合法的代理节点。');
    }

    return parsed.map((node) => applyImportSource(node, options));
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('导入内容不能为空。');
  }

  return lines.map((line, index) => parseProxyNodeLine(line, index, now, options));
}

export function serializeProxyNodes(nodes: readonly ProxyNodeRecord[]): string {
  return JSON.stringify(nodes, null, 2);
}

export function buildProxyPoolExportFilename(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  return `gettokens-proxy-pool-${year}${month}${day}-${hour}${minute}.json`;
}

export function downloadProxyPool(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function mergeImportedProxyNodes(
  currentNodes: readonly ProxyNodeRecord[],
  importedNodes: readonly ProxyNodeRecord[],
): ProxyNodeRecord[] {
  const currentByID = new Map(currentNodes.map((node) => [node.id, node]));
  for (const node of importedNodes) {
    currentByID.set(node.id, node);
  }

  return Array.from(currentByID.values());
}

function buildProxyNodeFromDraft(draft: ProxyNodeDraft, now: Date): ProxyNodeRecord {
  const name = draft.name.trim();
  if (!name) {
    throw new Error('节点名称不能为空。');
  }

  const host = draft.host.trim();
  if (!host) {
    throw new Error('代理地址不能为空。');
  }

  if (!proxyNodeGroups.includes(draft.group as (typeof proxyNodeGroups)[number])) {
    throw new Error('代理分组不合法。');
  }

  if (!proxyNodeProtocols.includes(draft.protocol)) {
    throw new Error('代理协议不合法。');
  }

  const port = Number.parseInt(draft.port, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('端口必须是 1 到 65535 之间的整数。');
  }

  const latencyMs = Number.parseInt(draft.latencyMs, 10);
  if (!Number.isInteger(latencyMs) || latencyMs < 0) {
    throw new Error('延时必须是大于等于 0 的整数。');
  }

  const availabilityRate = Number.parseInt(draft.availabilityRate, 10);
  if (!Number.isInteger(availabilityRate) || availabilityRate < 0 || availabilityRate > 100) {
    throw new Error('可用率必须是 0 到 100 之间的整数。');
  }

  return {
    id: draft.id ?? buildProxyNodeID(name, draft.protocol, host, port),
    name,
    group: draft.group,
    protocol: draft.protocol,
    sourceLabel: draft.sourceLabel?.trim() || '手动维护',
    sourceURL: draft.sourceURL?.trim() || '',
    host,
    port,
    latencyMs,
    availabilityRate,
    lastCheckedAt: formatTimestamp(now),
    status: draft.status,
    note: draft.note.trim() || (draft.status === 'available' ? '本地新增节点，待后续复测。' : '本地新增节点，建议先复测。'),
  };
}

function buildProxyNodeID(name: string, protocol: ProxyNodeProtocol, host: string, port: number) {
  return `proxy-${slugify(`${name}-${protocol}-${host}-${port}`)}`;
}

function parseProxyNodeLine(line: string, index: number, now: Date, options: ProxyImportOptions): ProxyNodeRecord {
  return parseProxyNodeURL(line, now, {
    name: `导入节点 ${index + 1}`,
    note: buildImportedNote(options.sourceLabel),
    sourceLabel: options.sourceLabel,
    sourceURL: options.sourceURL,
  }, index);
}

function isProxyNodeRecord(value: unknown): value is ProxyNodeRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.group === 'string' &&
    typeof record.protocol === 'string' &&
    typeof record.sourceLabel === 'string' &&
    typeof record.sourceURL === 'string' &&
    typeof record.host === 'string' &&
    typeof record.port === 'number' &&
    typeof record.latencyMs === 'number' &&
    typeof record.availabilityRate === 'number' &&
    typeof record.lastCheckedAt === 'string' &&
    (record.status === 'available' || record.status === 'review') &&
    typeof record.note === 'string'
  );
}

function isProxySubscriptionSourceRecord(value: unknown): value is ProxySubscriptionSourceRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.url === 'string' &&
    typeof record.label === 'string' &&
    typeof record.lastSyncedAt === 'string' &&
    typeof record.lastImportCount === 'number' &&
    typeof record.lastError === 'string'
  );
}

function isLegacySeedProxyNodes(nodes: readonly ProxyNodeRecord[]) {
  if (nodes.length !== initialProxyNodes.length) {
    return false;
  }

  return nodes.every((node) => legacySeedNodeIDs.has(node.id));
}

function formatTimestamp(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatProbeCheckedAt(value: string) {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return formatTimestamp(new Date());
  }

  return formatTimestamp(parsed);
}

function parseProxyNodeURL(
  raw: string,
  now: Date,
  options: {
    name: string;
    note: string;
    sourceLabel?: string;
    sourceURL?: string;
    idSeed?: string;
  },
  lineIndex?: number,
): ProxyNodeRecord {
  const trimmed = raw.trim();
  const normalizedInput = trimmed.includes('://') ? trimmed : `socks5://${trimmed}`;
  let parsed: URL;

  try {
    parsed = new URL(normalizedInput);
  } catch {
    if (typeof lineIndex === 'number') {
      throw new Error(`第 ${lineIndex + 1} 行格式不合法，请使用 scheme://host:port 或 host:port。`);
    }
    throw new Error('代理 URL 不合法。');
  }

  const protocol = parsed.protocol.replace(/:$/, '').toUpperCase();
  if (!proxyNodeProtocols.includes(protocol as ProxyNodeProtocol)) {
    throw new Error('代理协议不合法。');
  }

  const host = parsed.hostname.trim();
  const port = Number.parseInt(parsed.port, 10);
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
    if (typeof lineIndex === 'number') {
      throw new Error(`第 ${lineIndex + 1} 行端口不合法。`);
    }
    throw new Error('代理地址或端口不合法。');
  }

  return {
    id: buildProxyNodeID(options.idSeed ?? `${host}-${port}`, protocol as ProxyNodeProtocol, host, port),
    name: options.name,
    group: proxyNodeGroups[0],
    protocol: protocol as ProxyNodeProtocol,
    sourceLabel: options.sourceLabel?.trim() || '批量导入',
    sourceURL: options.sourceURL?.trim() || '',
    host,
    port,
    latencyMs: 180,
    availabilityRate: 100,
    lastCheckedAt: formatTimestamp(now),
    status: 'available',
    note: options.note,
  };
}

function applyImportSource(node: ProxyNodeRecord, options: ProxyImportOptions): ProxyNodeRecord {
  const sourceLabel = options.sourceLabel?.trim();
  const sourceURL = options.sourceURL?.trim();
  if (!sourceLabel && !sourceURL) {
    return node;
  }

  return {
    ...node,
    sourceLabel: sourceLabel || node.sourceLabel || '批量导入',
    sourceURL: sourceURL || node.sourceURL || '',
    note: buildImportedNote(sourceLabel || node.sourceLabel),
  };
}

function buildImportedNote(sourceLabel?: string) {
  const normalizedLabel = sourceLabel?.trim();
  if (!normalizedLabel) {
    return '由文本批量导入，建议首次使用前执行复测。';
  }

  return `由订阅或文本批量导入，来源：${normalizedLabel}，建议首次使用前执行复测。`;
}

export function deriveProxySourceLabel(rawURL: string): string {
  const trimmed = rawURL.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    const pathnameParts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname === 'raw.githubusercontent.com' && pathnameParts.length >= 2) {
      return `${pathnameParts[0]}/${pathnameParts[1]}`;
    }

    return parsed.hostname;
  } catch {
    return '';
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function buildProxySubscriptionSourceID(url: string, label: string) {
  return `proxy-source-${slugify(`${label}-${url}`)}`;
}
