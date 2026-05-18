import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountProxyRouteDraft,
  buildAccountProxySaveValue,
  formatAccountProxySummary,
} from '../model/accountProxyRoute.ts';

const proxyNodes = [
  {
    id: 'proxy-local',
    name: 'Local SOCKS',
    group: '主用组',
    protocol: 'SOCKS5',
    sourceLabel: '手动维护',
    sourceURL: '',
    host: '127.0.0.1',
    port: 7890,
    latencyMs: 18,
    availabilityRate: 99,
    lastCheckedAt: '2026-05-18 10:00',
    status: 'available',
    note: '',
  },
];

test('buildAccountProxyRouteDraft resolves inherit, direct, and custom modes', () => {
  assert.deepEqual(
    buildAccountProxyRouteDraft({ id: 'codex-api-key:1', proxyUrl: '' }, proxyNodes),
    { mode: 'inherit', proxyNodeID: '', proxyUrl: '' },
  );
  assert.deepEqual(
    buildAccountProxyRouteDraft({ id: 'codex-api-key:1', proxyUrl: 'direct' }, proxyNodes),
    { mode: 'direct', proxyNodeID: '', proxyUrl: 'direct' },
  );
  assert.deepEqual(
    buildAccountProxyRouteDraft({ id: 'codex-api-key:1', proxyUrl: 'socks5://127.0.0.1:7890' }, proxyNodes),
    { mode: 'custom', proxyNodeID: 'proxy-local', proxyUrl: 'socks5://127.0.0.1:7890' },
  );
});

test('buildAccountProxySaveValue stores only the effective proxy url', () => {
  assert.equal(buildAccountProxySaveValue({ mode: 'inherit', proxyNodeID: '', proxyUrl: '' }), '');
  assert.equal(buildAccountProxySaveValue({ mode: 'direct', proxyNodeID: '', proxyUrl: '' }), 'direct');
  assert.equal(
    buildAccountProxySaveValue({
      mode: 'custom',
      proxyNodeID: 'proxy-local',
      proxyUrl: 'socks5://127.0.0.1:7890',
    }),
    'socks5://127.0.0.1:7890',
  );
  assert.throws(
    () => buildAccountProxySaveValue({ mode: 'custom', proxyNodeID: '', proxyUrl: '' }),
    /代理/,
  );
});

test('formatAccountProxySummary keeps stale custom urls visible', () => {
  assert.equal(formatAccountProxySummary('', proxyNodes).label, '继承全局');
  assert.equal(formatAccountProxySummary('direct', proxyNodes).label, '直连');
  assert.equal(formatAccountProxySummary('socks5://127.0.0.1:7890', proxyNodes).label, 'Local SOCKS');
  assert.equal(formatAccountProxySummary('http://10.0.0.2:8080', proxyNodes).label, '自定义代理');
});
