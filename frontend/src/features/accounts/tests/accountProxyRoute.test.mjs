import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountProxyRouteDraft,
  buildAccountProxySaveValue,
  formatAccountProxySummary,
} from '../model/accountProxyRoute.ts';

test('buildAccountProxyRouteDraft resolves inherit, direct, and custom modes', () => {
  assert.deepEqual(
    buildAccountProxyRouteDraft({ id: 'codex-api-key:1', proxyUrl: '' }),
    { mode: 'inherit', proxyNodeID: '', proxyUrl: '' },
  );
  assert.deepEqual(
    buildAccountProxyRouteDraft({ id: 'codex-api-key:1', proxyUrl: 'direct' }),
    { mode: 'direct', proxyNodeID: '', proxyUrl: 'direct' },
  );
  assert.deepEqual(
    buildAccountProxyRouteDraft({ id: 'codex-api-key:1', proxyUrl: 'socks5://127.0.0.1:7890' }),
    { mode: 'custom', proxyNodeID: '', proxyUrl: 'socks5://127.0.0.1:7890' },
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
  assert.equal(formatAccountProxySummary('').label, '继承全局');
  assert.equal(formatAccountProxySummary('direct').label, '直连');
  assert.equal(formatAccountProxySummary('socks5://127.0.0.1:7890').label, '自定义代理');
  assert.equal(formatAccountProxySummary('http://10.0.0.2:8080').label, '自定义代理');
});
