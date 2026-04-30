import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROXY_POOL_STORAGE_KEY,
  PROXY_POOL_SUBSCRIPTION_STORAGE_KEY,
  PROXY_POOL_PROBE_TARGET_HISTORY_STORAGE_KEY,
  PROXY_POOL_PROBE_TARGET_STORAGE_KEY,
  buildProxyPoolExportFilename,
  buildProxyURLFromNode,
  DEFAULT_PROXY_PROBE_TARGET_URL,
  deriveProxySourceLabel,
  createInitialProxyNodes,
  createProxyNodeDraftFromRecord,
  cycleProxyNodeGroup,
  filterProxyNodes,
  filterProxyNodesByGroup,
  getDefaultSortDirection,
  mergeImportedProxyNodes,
  normalizeProxyProbeTargetURL,
  persistProxyProbeTargetHistory,
  persistProxyProbeTargetURL,
  paginateProxyNodes,
  persistProxyNodes,
  persistProxySubscriptions,
  parseImportedProxyNodes,
  applyProxyProbeResult,
  readStoredProxyNodes,
  readStoredProxyProbeTargetHistory,
  readStoredProxyProbeTargetURL,
  readStoredProxySubscriptions,
  rememberProxyProbeTargetURL,
  removeProxyNodesBySource,
  removeProxySubscriptionSource,
  retestProxyNode,
  setProxyNodeGroup,
  sortProxyNodes,
  summarizeProxyNodes,
  toggleProxyPoolSort,
  upsertProxySubscriptionSource,
  upsertProxyNode,
} from './model.ts';

test('filterProxyNodes filters by status and query', () => {
  const nodes = createInitialProxyNodes();

  assert.equal(filterProxyNodes(nodes, 'available', '').every((node) => node.status === 'available'), true);
  assert.equal(filterProxyNodes(nodes, 'review', '').every((node) => node.status === 'review'), true);
  assert.deepEqual(
    filterProxyNodes(nodes, 'all', '法兰克福').map((node) => node.name),
    ['法兰克福 Gamma'],
  );
});

test('filterProxyNodesByGroup narrows rows to a single local group', () => {
  const nodes = createInitialProxyNodes();

  assert.equal(filterProxyNodesByGroup(nodes, '主用组').length, 2);
  assert.equal(filterProxyNodesByGroup(nodes, '全部分组').length, nodes.length);
});

test('summarizeProxyNodes returns compact table metrics', () => {
  const nodes = createInitialProxyNodes();

  assert.deepEqual(summarizeProxyNodes(nodes), {
    totalCount: 6,
    availableCount: 3,
    reviewCount: 3,
    averageLatencyMs: 456,
    averageAvailabilityRate: 78,
  });
});

test('cycleProxyNodeGroup moves node to the next local group', () => {
  const [first] = createInitialProxyNodes();

  assert.equal(cycleProxyNodeGroup(first).group, '备用组');
});

test('setProxyNodeGroup assigns an explicit target group', () => {
  const [first] = createInitialProxyNodes();

  assert.equal(setProxyNodeGroup(first, '隔离组').group, '隔离组');
  assert.throws(() => setProxyNodeGroup(first, '不存在'), /不合法/);
});

test('retestProxyNode refreshes local status and timestamp', () => {
  const reviewNode = createInitialProxyNodes().find((node) => node.status === 'review');
  const retested = retestProxyNode(reviewNode, new Date(2026, 3, 30, 10, 8, 0));

  assert.equal(retested.lastCheckedAt, '2026-04-30 10:08');
  assert.equal(retested.latencyMs < reviewNode.latencyMs, true);
});

test('readStoredProxyNodes falls back to initial nodes for invalid storage payloads', () => {
  const nodes = readStoredProxyNodes({
    getItem(key) {
      assert.equal(key, PROXY_POOL_STORAGE_KEY);
      return '{"broken":true}';
    },
  });

  assert.equal(nodes.length, 0);
});

test('readStoredProxyNodes drops legacy seeded demo nodes from previous frontend versions', () => {
  const nodes = readStoredProxyNodes({
    getItem() {
      return JSON.stringify(createInitialProxyNodes());
    },
  });

  assert.equal(nodes.length, 0);
});

test('persistProxyNodes serializes the local proxy pool', () => {
  const writes = [];
  persistProxyNodes(
    {
      setItem(key, value) {
        writes.push([key, value]);
      },
    },
    createInitialProxyNodes().slice(0, 2),
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], PROXY_POOL_STORAGE_KEY);
  assert.match(writes[0][1], /上海 Alpha/);
});

test('readStoredProxySubscriptions falls back to empty list for invalid payloads', () => {
  const subscriptions = readStoredProxySubscriptions({
    getItem(key) {
      assert.equal(key, PROXY_POOL_SUBSCRIPTION_STORAGE_KEY);
      return '{"broken":true}';
    },
  });

  assert.equal(subscriptions.length, 0);
});

test('persistProxySubscriptions serializes local subscription sources', () => {
  const writes = [];
  persistProxySubscriptions(
    {
      setItem(key, value) {
        writes.push([key, value]);
      },
    },
    [
      {
        id: 'proxy-source-1',
        url: 'https://example.com/proxy.txt',
        label: 'example.com',
        lastSyncedAt: '2026-04-30 13:08',
        lastImportCount: 2,
        lastError: '',
      },
    ],
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], PROXY_POOL_SUBSCRIPTION_STORAGE_KEY);
  assert.match(writes[0][1], /example\.com/);
});

test('readStoredProxyProbeTargetURL falls back to default and persists normalized values', () => {
  assert.equal(
    readStoredProxyProbeTargetURL({
      getItem(key) {
        assert.equal(key, PROXY_POOL_PROBE_TARGET_STORAGE_KEY);
        return 'example.com/ping';
      },
    }),
    'https://example.com/ping',
  );

  const writes = [];
  persistProxyProbeTargetURL(
    {
      setItem(key, value) {
        writes.push([key, value]);
      },
    },
    'https://example.com/health',
  );
  assert.equal(writes[0][0], PROXY_POOL_PROBE_TARGET_STORAGE_KEY);
  assert.equal(writes[0][1], 'https://example.com/health');
});

test('probe target history keeps latest five unique urls', () => {
  const history = rememberProxyProbeTargetURL(
    ['https://a.com', 'https://b.com', 'https://c.com', 'https://d.com', 'https://e.com'],
    'https://f.com',
  );
  assert.deepEqual(history, ['https://f.com/', 'https://a.com/', 'https://b.com/', 'https://c.com/', 'https://d.com/']);

  const deduped = rememberProxyProbeTargetURL(history, 'b.com');
  assert.deepEqual(deduped, ['https://b.com/', 'https://f.com/', 'https://a.com/', 'https://c.com/', 'https://d.com/']);
});

test('readStoredProxyProbeTargetHistory falls back to empty and persists only first five', () => {
  assert.deepEqual(
    readStoredProxyProbeTargetHistory({
      getItem(key) {
        assert.equal(key, PROXY_POOL_PROBE_TARGET_HISTORY_STORAGE_KEY);
        return '["https://a.com","https://b.com","https://c.com","https://d.com","https://e.com","https://f.com"]';
      },
    }),
    ['https://a.com', 'https://b.com', 'https://c.com', 'https://d.com', 'https://e.com'],
  );

  const writes = [];
  persistProxyProbeTargetHistory(
    {
      setItem(key, value) {
        writes.push([key, value]);
      },
    },
    ['https://a.com', 'https://b.com', 'https://c.com', 'https://d.com', 'https://e.com', 'https://f.com'],
  );
  assert.equal(writes[0][0], PROXY_POOL_PROBE_TARGET_HISTORY_STORAGE_KEY);
  assert.equal(JSON.parse(writes[0][1]).length, 5);
});

test('upsertProxySubscriptionSource inserts and updates by url or label', () => {
  const created = upsertProxySubscriptionSource([], {
    url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    label: 'hookzof/socks5_list',
    lastSyncedAt: '2026-04-30 13:15',
    lastImportCount: 20,
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].label, 'hookzof/socks5_list');

  const updated = upsertProxySubscriptionSource(created, {
    url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    label: 'hookzof/socks5_list',
    lastSyncedAt: '2026-04-30 13:16',
    lastImportCount: 24,
    lastError: '上次 403',
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].lastImportCount, 24);
  assert.equal(updated[0].lastError, '上次 403');
});

test('removeProxySubscriptionSource deletes one source and removeProxyNodesBySource clears tagged nodes', () => {
  const subscriptions = [
    {
      id: 'source-a',
      url: 'https://example.com/a.txt',
      label: '源 A',
      lastSyncedAt: '2026-04-30 13:18',
      lastImportCount: 2,
      lastError: '',
    },
    {
      id: 'source-b',
      url: 'https://example.com/b.txt',
      label: '源 B',
      lastSyncedAt: '2026-04-30 13:18',
      lastImportCount: 1,
      lastError: '',
    },
  ];
  const nodes = parseImportedProxyNodes('127.0.0.1:7897\n127.0.0.1:7898', new Date(2026, 3, 30, 13, 18, 0), {
    sourceLabel: '源 A',
    sourceURL: 'https://example.com/a.txt',
  });

  assert.equal(removeProxySubscriptionSource(subscriptions, 'source-a').length, 1);
  assert.equal(removeProxyNodesBySource(nodes, subscriptions[0]).length, 0);
});

test('upsertProxyNode creates a new local node from draft fields', () => {
  const nodes = createInitialProxyNodes();
  const nextNodes = upsertProxyNode(nodes, {
    name: '首尔 Lambda',
    group: '备用组',
    protocol: 'HTTPS',
    host: '10.9.0.9',
    port: '9443',
    latencyMs: '210',
    availabilityRate: '91',
    status: 'available',
    note: '新补充的本地节点',
  }, new Date(2026, 3, 30, 11, 6, 0));

  assert.equal(nextNodes.length, nodes.length + 1);
  assert.equal(nextNodes[0].name, '首尔 Lambda');
  assert.equal(nextNodes[0].lastCheckedAt, '2026-04-30 11:06');
});

test('upsertProxyNode updates an existing node when draft carries id', () => {
  const [first, ...rest] = createInitialProxyNodes();
  const nextNodes = upsertProxyNode([first, ...rest], {
    ...createProxyNodeDraftFromRecord(first),
    latencyMs: '288',
    note: '编辑后的本地说明',
  }, new Date(2026, 3, 30, 11, 8, 0));

  assert.equal(nextNodes.length, 6);
  assert.equal(nextNodes[0].id, first.id);
  assert.equal(nextNodes[0].latencyMs, 288);
  assert.equal(nextNodes[0].note, '编辑后的本地说明');
  assert.equal(nextNodes[0].lastCheckedAt, '2026-04-30 11:08');
});

test('parseImportedProxyNodes accepts exported proxy arrays and rejects invalid payloads', () => {
  const nodes = createInitialProxyNodes().slice(0, 2);
  assert.equal(parseImportedProxyNodes(JSON.stringify(nodes)).length, 2);
  assert.throws(() => parseImportedProxyNodes('{"broken":true}'), /数组/);
  assert.throws(() => parseImportedProxyNodes('[{"id":"bad"}]'), /不合法/);
});

test('parseImportedProxyNodes accepts plain text proxy lines', () => {
  const parsed = parseImportedProxyNodes(
    'socks5://127.0.0.1:1080\n10.0.0.8:8080\nhttps://proxy.example.com:8443',
    new Date(2026, 3, 30, 11, 15, 0),
  );

  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].protocol, 'SOCKS5');
  assert.equal(parsed[1].protocol, 'SOCKS5');
  assert.equal(parsed[1].host, '10.0.0.8');
  assert.equal(parsed[2].protocol, 'HTTPS');
  assert.equal(parsed[0].lastCheckedAt, '2026-04-30 11:15');
});

test('parseImportedProxyNodes keeps different protocols on the same host and port as separate nodes', () => {
  const parsed = parseImportedProxyNodes(
    'http://127.0.0.1:7897\nsocks5://127.0.0.1:7897',
    new Date(2026, 3, 30, 11, 20, 0),
  );

  assert.equal(parsed.length, 2);
  assert.notEqual(parsed[0].id, parsed[1].id);
  assert.equal(parsed[0].protocol, 'HTTP');
  assert.equal(parsed[1].protocol, 'SOCKS5');
});

test('parseImportedProxyNodes applies source label and url to imported rows', () => {
  const parsed = parseImportedProxyNodes(
    '206.123.156.193:6589\n184.182.240.12:4145',
    new Date(2026, 3, 30, 11, 22, 0),
    {
      sourceLabel: 'hookzof/socks5_list',
      sourceURL: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
    },
  );

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].sourceLabel, 'hookzof/socks5_list');
  assert.equal(parsed[0].sourceURL, 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt');
  assert.match(parsed[0].note, /来源：hookzof\/socks5_list/);
});

test('mergeImportedProxyNodes replaces duplicate ids and keeps the rest', () => {
  const nodes = createInitialProxyNodes();
  const replacement = { ...nodes[0], latencyMs: 333 };
  const merged = mergeImportedProxyNodes(nodes, [replacement]);

  assert.equal(merged.length, nodes.length);
  assert.equal(merged.find((node) => node.id === replacement.id)?.latencyMs, 333);
});

test('buildProxyPoolExportFilename returns a traceable local filename', () => {
  assert.equal(
    buildProxyPoolExportFilename(new Date(2026, 3, 30, 11, 9, 0)),
    'gettokens-proxy-pool-20260430-1109.json',
  );
});

test('sortProxyNodes supports latency and availability ordering', () => {
  const nodes = createInitialProxyNodes();

  const byLatency = sortProxyNodes(nodes, 'latency');
  const byAvailability = sortProxyNodes(nodes, 'availability');
  const byLatencyDesc = sortProxyNodes(nodes, 'latency', 'desc');

  assert.equal(byLatency[0].latencyMs <= byLatency[1].latencyMs, true);
  assert.equal(byAvailability[0].availabilityRate >= byAvailability[1].availabilityRate, true);
  assert.equal(byLatencyDesc[0].latencyMs >= byLatencyDesc[1].latencyMs, true);
});

test('toggleProxyPoolSort switches direction for the same column and resets defaults for new columns', () => {
  assert.equal(getDefaultSortDirection('latency'), 'asc');
  assert.equal(getDefaultSortDirection('availability'), 'desc');
  assert.deepEqual(toggleProxyPoolSort('latency', 'asc', 'latency'), { key: 'latency', direction: 'desc' });
  assert.deepEqual(toggleProxyPoolSort('latency', 'desc', 'availability'), { key: 'availability', direction: 'desc' });
});

test('paginateProxyNodes slices rows and clamps out-of-range pages', () => {
  const nodes = createInitialProxyNodes();
  const firstPage = paginateProxyNodes(nodes, 1, 2);
  const overflowPage = paginateProxyNodes(nodes, 99, 4);

  assert.equal(firstPage.page, 1);
  assert.equal(firstPage.pageCount, 3);
  assert.equal(firstPage.items.length, 2);
  assert.equal(overflowPage.page, 2);
  assert.equal(overflowPage.pageCount, 2);
  assert.equal(overflowPage.items.length, 2);
});

test('buildProxyURLFromNode rebuilds a usable proxy url', () => {
  const [first] = createInitialProxyNodes();
  assert.equal(buildProxyURLFromNode(first), 'socks5://127.0.0.1:7890');
});

test('normalizeProxyProbeTargetURL fills default, normalizes host-only input, and rejects invalid schemes', () => {
  assert.equal(normalizeProxyProbeTargetURL(''), DEFAULT_PROXY_PROBE_TARGET_URL);
  assert.equal(normalizeProxyProbeTargetURL('example.com/ping'), 'https://example.com/ping');
  assert.equal(normalizeProxyProbeTargetURL('https://example.com/health'), 'https://example.com/health');
  assert.throws(() => normalizeProxyProbeTargetURL('ftp://example.com/file'), /仅支持/);
});

test('deriveProxySourceLabel derives readable source names from subscription urls', () => {
  assert.equal(
    deriveProxySourceLabel('https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt'),
    'hookzof/socks5_list',
  );
  assert.equal(deriveProxySourceLabel('https://example.com/subscriptions/proxy.txt'), 'example.com');
});

test('applyProxyProbeResult writes real detection outcome back to node', () => {
  const [first] = createInitialProxyNodes();
  const next = applyProxyProbeResult(first, {
    success: false,
    latencyMs: 622,
    checkedAt: '2026-04-30 12:30',
    message: '检测失败：context deadline exceeded',
  });

  assert.equal(next.status, 'review');
  assert.equal(next.latencyMs, 622);
  assert.equal(next.lastCheckedAt, '2026-04-30 12:30');
  assert.match(next.note, /检测失败/);
});
