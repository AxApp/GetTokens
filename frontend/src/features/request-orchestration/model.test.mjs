import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFlowTest,
  cloneRequestFlows,
  computeRequestAccount,
  enableProxyPoolForFlowAccount,
  getCurrentAccount,
  getVisibleRoutesForAccount,
  buildOpenAICompatibleModelMap,
  buildRequestAccountGroups,
  mapAccountRecordsToRequestAccounts,
  mapOpenAICompatibleProvidersToAccountRecords,
  mapProxyNodesToRequestRoutes,
  readStoredRequestAccountOverrides,
  readStoredRequestFlows,
  persistRequestAccountOverrides,
  requestAccounts,
  requestProxyRoutes,
  selectFirstCompatibleAccount,
  toggleFlowAccountEnabled,
} from './model.ts';

test('switching entry selects the first compatible account in the current group', () => {
  const [defaultFlow] = cloneRequestFlows();
  const nextFlow = selectFirstCompatibleAccount({ ...defaultFlow, cli: 'claude-code' });

  assert.equal(nextFlow.groupID, 'codex');
  assert.equal(nextFlow.accountID, 'codex-lab-02');
});

test('direct accounts only expose the direct route until proxy pool is enabled', () => {
  const [defaultFlow] = cloneRequestFlows();
  const account = getCurrentAccount(defaultFlow);
  const routes = getVisibleRoutesForAccount(account);

  assert.equal(account?.id, 'codex-prod-01');
  assert.deepEqual(routes.map((route) => route.id), ['direct']);
});

test('flow account checklist controls which compatible accounts participate', () => {
  const [defaultFlow] = cloneRequestFlows();
  const withoutProd = toggleFlowAccountEnabled(defaultFlow, 'codex-prod-01', requestAccounts, requestProxyRoutes);
  const prodAccount = computeRequestAccount(requestAccounts[0], withoutProd, requestProxyRoutes);
  const labAccount = computeRequestAccount(requestAccounts[1], withoutProd, requestProxyRoutes);

  assert.deepEqual(withoutProd.enabledAccountIDs, ['codex-lab-02']);
  assert.equal(withoutProd.accountID, 'codex-lab-02');
  assert.equal(prodAccount.usable, true);
  assert.equal(prodAccount.included, false);
  assert.equal(prodAccount.active, false);
  assert.match(prodAccount.reasons.join(' / '), /未勾选参与/);
  assert.equal(labAccount.active, true);
});

test('proxy-enabled accounts expose only configured proxy routes', () => {
  const [, customFlow] = cloneRequestFlows();
  const account = getCurrentAccount(customFlow);
  const routes = getVisibleRoutesForAccount(account);

  assert.equal(account?.id, 'codex-lab-02');
  assert.deepEqual(routes.map((route) => route.id), ['hk-resi-03', 'sg-biz-01', 'us-static-02']);
});

test('enabling proxy pool selects the first available proxy route when current route is direct', () => {
  const [defaultFlow] = cloneRequestFlows();
  const nextFlow = enableProxyPoolForFlowAccount(defaultFlow, 'codex-prod-01', requestProxyRoutes);

  assert.equal(nextFlow.routes['codex-prod-01'], 'hk-resi-03');
});

test('enabling proxy pool keeps direct when no proxy route exists', () => {
  const [defaultFlow] = cloneRequestFlows();
  const nextFlow = enableProxyPoolForFlowAccount(defaultFlow, 'codex-prod-01', [{ id: 'direct', label: '直连', note: '' }]);

  assert.equal(nextFlow.routes['codex-prod-01'], null);
});

test('proxy-enabled accounts without a selected proxy cannot route through direct', () => {
  const [defaultFlow] = cloneRequestFlows();
  const account = computeRequestAccount(
    { ...requestAccounts[0], proxyPoolEnabled: true },
    defaultFlow,
    [{ id: 'direct', label: '直连', note: '' }],
  );
  const visibleRoutes = getVisibleRoutesForAccount(account, [{ id: 'direct', label: '直连', note: '' }]);
  const result = buildFlowTest(defaultFlow, account, '11:10');

  assert.equal(account.active, false);
  assert.equal(account.routeID, 'direct');
  assert.deepEqual(visibleRoutes, []);
  assert.equal(result?.status, 'blocked');
  assert.match(result?.reason ?? '', /未选择可用代理/);
});

test('enabling proxy pool preserves an existing proxy route', () => {
  const [, customFlow] = cloneRequestFlows();
  const nextFlow = enableProxyPoolForFlowAccount(customFlow, 'codex-lab-02', requestProxyRoutes);

  assert.equal(nextFlow.routes['codex-lab-02'], 'hk-resi-03');
});

test('incompatible selected account produces a blocked test result', () => {
  const [defaultFlow] = cloneRequestFlows();
  const flow = { ...defaultFlow, cli: 'claude-code', accountID: 'codex-prod-01' };
  const account = computeRequestAccount(requestAccounts[0], flow, requestProxyRoutes);
  const result = buildFlowTest(flow, account, '10:30');

  assert.equal(account.active, false);
  assert.equal(result?.status, 'blocked');
  assert.match(result?.reason ?? '', /CLI 不兼容/);
});

test('real account records become request accounts with conservative CLI support and mappings', () => {
  const modelMap = buildOpenAICompatibleModelMap([
    {
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      models: [
        { name: 'deepseek-chat', alias: 'Chat' },
        { name: 'deepseek-reasoner', alias: 'Reasoner' },
      ],
    },
  ]);
  const accounts = mapAccountRecordsToRequestAccounts([
    {
      id: 'auth-file:codex-main',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'codex-main',
      status: 'ACTIVE',
    },
    {
      id: 'openai-compatible:deepseek',
      provider: 'deepseek',
      credentialSource: 'api-key',
      displayName: 'OPENAI-COMPATIBLE · DEEPSEEK',
      status: 'CONFIGURED',
      baseUrl: 'https://api.deepseek.com/v1',
    },
    {
      id: 'auth-file:claude-prod',
      provider: 'anthropic',
      credentialSource: 'auth-file',
      displayName: 'claude-prod',
      status: 'DISABLED',
      disabled: true,
    },
  ], modelMap);

  assert.equal(accounts[0].groupID, 'codex');
  assert.deepEqual(accounts[0].entrySupport, ['codex']);
  assert.equal(accounts[0].modelMappings['codex:gpt-5.5'], 'gpt-5.5');
  assert.equal(accounts[1].groupID, 'openai-compatible');
  assert.deepEqual(accounts[1].entrySupport, ['codex']);
  assert.equal(accounts[1].modelMappings['codex:gpt-5.5'], 'deepseek-chat');
  assert.equal(accounts[2].groupID, 'claude');
  assert.deepEqual(accounts[2].entrySupport, ['claude-code']);
  assert.equal(accounts[2].disabled, true);
});

test('openai-compatible providers become request accounts and account groups', () => {
  const providers = [
    {
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test',
      disabled: false,
      priority: 7,
      models: [
        { name: 'deepseek-chat', alias: 'Chat' },
        { name: 'deepseek-reasoner', alias: 'Reasoner' },
      ],
    },
  ];
  const records = mapOpenAICompatibleProvidersToAccountRecords(providers);
  const accounts = mapAccountRecordsToRequestAccounts(records, buildOpenAICompatibleModelMap(providers));
  const groups = buildRequestAccountGroups(accounts);

  assert.equal(records[0].id, 'openai-compatible:deepseek');
  assert.equal(records[0].credentialSource, 'api-key');
  assert.equal(records[0].displayName, '兼容 OpenAI · deepseek');
  assert.equal(accounts[0].groupID, 'openai-compatible');
  assert.deepEqual(accounts[0].entrySupport, ['codex']);
  assert.equal(accounts[0].modelMappings['codex:gpt-5.5'], 'deepseek-chat');
  assert.deepEqual(groups.map((group) => group.id), ['openai-compatible']);
});

test('available proxy nodes become request routes after the direct route', () => {
  const routes = mapProxyNodesToRequestRoutes([
    {
      id: 'proxy-hk-01',
      name: '香港出口',
      group: '主用组',
      protocol: 'HTTPS',
      sourceLabel: 'local',
      sourceURL: '',
      host: '127.0.0.1',
      port: 9443,
      latencyMs: 120,
      availabilityRate: 98,
      lastCheckedAt: '2026-05-05 10:00',
      status: 'available',
      note: '',
    },
    {
      id: 'proxy-la-01',
      name: '洛杉矶观察',
      group: '观察组',
      protocol: 'HTTP',
      sourceLabel: 'local',
      sourceURL: '',
      host: '127.0.0.2',
      port: 8080,
      latencyMs: 900,
      availabilityRate: 55,
      lastCheckedAt: '2026-05-05 10:00',
      status: 'review',
      note: '',
    },
  ]);

  assert.deepEqual(routes.map((route) => route.id), ['direct', 'proxy-hk-01']);
  assert.match(routes[1].note, /https:\/\/127\.0\.0\.1:9443/);
});

test('stored request flows ignore invalid payloads', () => {
  const storage = {
    getItem() {
      return JSON.stringify([{ id: 'broken', label: 42 }]);
    },
  };

  assert.equal(readStoredRequestFlows(storage), null);
});

test('request account overrides roundtrip valid account-level toggles only', () => {
  let payload = '';
  const storage = {
    getItem() {
      return payload;
    },
    setItem(_key, value) {
      payload = value;
    },
  };

  persistRequestAccountOverrides(storage, {
    'auth-file:codex-main': { disabled: true, proxyPoolEnabled: true },
    broken: { disabled: 'yes' },
  });

  assert.deepEqual(readStoredRequestAccountOverrides(storage), {
    'auth-file:codex-main': { disabled: true, proxyPoolEnabled: true },
  });
});
