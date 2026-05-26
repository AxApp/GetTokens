import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHANNEL_ROUTE_MODES,
  LEGACY_CHANNEL_ROUTING_BYPASSES,
  buildChannelRouteAuditEventSummary,
  buildChannelRoutingParticipantRows,
  buildLegacyRoutingBypassSummary,
  buildLegacyRoutingMaskPanel,
  buildChannelRoutingExplainDigest,
  buildPreviewChannelRouteAuditEvent,
  classifyChannelRouteMode,
  isChannelRouteMode,
  normalizeChannelRoutingConfig,
  updateChannelRoutingConfig,
} from '../model/channelRouting.ts';

test('ChannelRouteMode only accepts the GetTokens two-mode routing model', () => {
  assert.deepEqual([...CHANNEL_ROUTE_MODES], ['sequential', 'balanced']);
  assert.equal(isChannelRouteMode('sequential'), true);
  assert.equal(isChannelRouteMode('balanced'), true);

  ['project', 'dedicated', 'prefer', 'ordered', 'weighted', 'canary', 'exclude', 'round-robin'].forEach((mode) => {
    assert.equal(isChannelRouteMode(mode), false, mode);
  });
});

test('classifyChannelRouteMode separates upstream compatibility modes from GetTokens route modes', () => {
  assert.deepEqual(classifyChannelRouteMode('balanced'), { kind: 'gettokens', mode: 'balanced' });
  assert.deepEqual(classifyChannelRouteMode('weighted'), { kind: 'upstream-compat', mode: 'weighted' });
  assert.deepEqual(classifyChannelRouteMode('exclude'), { kind: 'invalid', mode: 'exclude' });
});

test('normalizeChannelRoutingConfig keeps upstream modes out of saved channel config', () => {
  const { config, ignoredUpstreamModes, invalidModes } = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'weighted',
      orderedAccountIDs: ['auth-file:a.json', 'auth-file:a.json', ' ', 'codex-api-key:stable'],
      projectModeFallbackRouteMode: 'canary',
      fallbackMode: 'fallback-default',
    },
    { channel: 'codex' },
  );

  assert.equal(config.channel, 'codex');
  assert.equal(config.routeMode, 'sequential');
  assert.equal(config.projectModeFallbackRouteMode, 'sequential');
  assert.equal(config.shadowRouteMode, 'balanced');
  assert.deepEqual(config.orderedAccountIDs, ['auth-file:a.json', 'codex-api-key:stable']);
  assert.deepEqual(ignoredUpstreamModes, ['weighted', 'canary']);
  assert.deepEqual(invalidModes, []);
});

test('legacy upstream routing bypasses are blocked from the GetTokens channel config model', () => {
  assert.deepEqual(
    LEGACY_CHANNEL_ROUTING_BYPASSES.map((item) => [item.id, item.disposition]),
    [
      ['session-affinity', 'blocked'],
      ['websocket-pin', 'blocked'],
      ['route-order-header', 'ignored'],
    ],
  );
  assert.equal(buildLegacyRoutingBypassSummary(), '3 个旧兼容输入已屏蔽');

  const normalized = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'balanced',
      sessionAffinity: true,
      websocketPin: 'auth-file:a.json',
      orderAccountIDs: ['auth-file:a.json'],
      routeOrderHeader: 'auth-file:a.json',
    },
    { channel: 'codex' },
  );

  assert.equal('sessionAffinity' in normalized.config, false);
  assert.equal('websocketPin' in normalized.config, false);
  assert.equal('orderAccountIDs' in normalized.config, false);
  assert.equal('routeOrderHeader' in normalized.config, false);
  assert.equal(normalized.config.routeMode, 'balanced');
});

test('legacy compatibility mask panel only exposes summary text and hides detail rows', () => {
  const legacyMask = buildLegacyRoutingMaskPanel();

  assert.equal(legacyMask.title, '兼容层提示');
  assert.equal(legacyMask.summary, '3 个旧兼容输入已屏蔽');
  assert.equal(legacyMask.note, '这些信号只保留为兼容层，不写入新配置，也不影响主路由判断。');
  assert.equal(legacyMask.hasDetails, false);
});

test('normalizeChannelRoutingConfig keeps shadow mode explicit and separate from production route mode', () => {
  const normalized = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'sequential',
      shadowEnabled: true,
      shadowRouteMode: 'balanced',
    },
    { channel: 'codex' },
  );

  assert.equal(normalized.config.routeMode, 'sequential');
  assert.equal(normalized.config.shadowEnabled, true);
  assert.equal(normalized.config.shadowRouteMode, 'balanced');
  assert.deepEqual(normalized.ignoredUpstreamModes, []);
  assert.deepEqual(normalized.invalidModes, []);
});

test('project mode inputs are downgraded while fallback stays limited to sequential or balanced', () => {
  assert.equal(
    normalizeChannelRoutingConfig(
      {
        routeMode: 'project',
        projectModeFallbackRouteMode: 'balanced',
      },
      { channel: 'claude' },
    ).config.projectModeFallbackRouteMode,
    'balanced',
  );

  const normalized = normalizeChannelRoutingConfig(
    {
      routeMode: 'project',
      projectModeFallbackRouteMode: 'project',
    },
    { channel: 'claude' },
  );

  assert.equal(normalized.config.routeMode, 'sequential');
  assert.equal(normalized.config.projectModeFallbackRouteMode, 'sequential');
  assert.deepEqual(normalized.invalidModes, ['project']);
});

test('Codex and Claude channel routing configs stay isolated when patched', () => {
  const codex = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'sequential',
      orderedAccountIDs: ['auth-file:codex.json'],
      channelGroupStates: {
        shared: { enabled: true, routeOrder: 1 },
      },
    },
    { channel: 'codex' },
  ).config;
  const claude = normalizeChannelRoutingConfig(
    {
      channel: 'claude',
      routeMode: 'balanced',
      orderedAccountIDs: ['openai-compatible:anthropic'],
      channelGroupStates: {
        shared: { enabled: true, routeOrder: 2 },
      },
    },
    { channel: 'claude' },
  ).config;

  const nextCodex = updateChannelRoutingConfig(codex, {
    channelGroupStates: {
      shared: { enabled: false, routeOrder: 9 },
    },
  });

  assert.equal(nextCodex.channel, 'codex');
  assert.equal(nextCodex.routeMode, 'sequential');
  assert.deepEqual(nextCodex.channelGroupStates.shared, { enabled: false, routeOrder: 9 });
  assert.equal(claude.channel, 'claude');
  assert.equal(claude.routeMode, 'balanced');
  assert.deepEqual(claude.channelGroupStates.shared, { enabled: true, routeOrder: 2 });
});

test('normalizeChannelRoutingConfig trims project bindings and drops legacy project route mode', () => {
  const normalized = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'project',
      projectBindings: [
        {
          projectName: ' gettokens ',
          targetType: 'group',
          targetID: ' codex-pro ',
          fallbackMode: 'fallback-global',
        },
        {
          projectName: 'gettokens',
          targetType: 'account',
          targetID: 'auth-file:duplicate.json',
          fallbackMode: 'fallback-default',
        },
        {
          projectName: 'broken',
          targetType: 'invalid',
          targetID: 'auth-file:broken.json',
          fallbackMode: 'fallback-default',
        },
      ],
    },
    { channel: 'codex' },
  );

  assert.equal(normalized.config.routeMode, 'sequential');
  assert.deepEqual(normalized.config.projectBindings, [
    {
      projectName: 'gettokens',
      targetType: 'group',
      targetID: 'codex-pro',
      fallbackMode: 'fallback-global',
    },
  ]);
});

test('buildChannelRouteAuditEventSummary keeps route ledger redacted and compact', () => {
  assert.deepEqual(
    buildChannelRouteAuditEventSummary({
      id: 'route-1',
      recordedAt: '2026-05-25T10:00:00Z',
      channel: 'codex',
      projectName: 'GetTokens',
      routeMode: 'balanced',
      selectedAccountID: 'codex-api-key:stable',
      candidateCount: 3,
      filteredCount: 1,
      snapshotVersion: 'snapshot-7',
      policyVersion: 'channel-routing-v1',
      shadowEnabled: true,
      shadowRouteMode: 'sequential',
      shadowSelectedAccountID: 'auth-file:backup.json',
      shadowDiff: true,
      redacted: true,
    }),
    {
      id: 'route-1',
      title: '均衡 → codex-api-key:stable',
      meta: '项目:GetTokens · 3 个候选 · 1 个过滤 · 快照 snapshot-7 · 规则 channel-routing-v1',
      shadow: '顺序 → auth-file:backup.json · 差异:有',
      redacted: true,
    },
  );
});

test('buildChannelRoutingExplainDigest turns raw explain data into readable sections', () => {
  assert.deepEqual(
    buildChannelRoutingExplainDigest({
      routeMode: 'balanced',
      selectedAccountID: 'codex-api-key:stable',
      candidates: [
        {
          id: 'codex-api-key:stable',
          displayName: 'Stable',
          provider: 'openai-compatible',
          activeSessions: 2,
        },
        {
          id: 'auth-file:backup.json',
          displayName: 'Backup',
          provider: 'auth-file',
          activeSessions: 0,
        },
      ],
      filtered: [
        { id: 'auth-file:blocked.json', reason: 'account-disabled' },
        { id: 'auth-file:cooldown.json', reason: 'runtime-rate-limit' },
        { id: 'auth-file:cooldown-2.json', reason: 'runtime-rate-limit' },
      ],
      steps: ['mode:balanced', 'legacy:session-affinity=blocked', 'candidates:2', 'sticky:hit:codex-api-key:stable'],
      snapshotVersion: 'preview',
      policyVersion: 'channel-routing-v1',
      shadow: {
        enabled: true,
        routeMode: 'sequential',
        selectedAccountID: 'auth-file:backup.json',
        diff: true,
      },
    }),
    {
      hasExplain: true,
      modeLabel: '均衡',
      selectedTitle: 'Stable',
      selectedMeta: '命中候选 #1 · openai-compatible · 2 个活跃会话',
      summaryLabel: '2 个候选 / 3 个过滤',
      snapshotLabel: '快照 preview',
      policyLabel: '规则 channel-routing-v1',
      shadowLabel: 'Shadow 开启',
      shadowMeta: '顺序 · auth-file:backup.json · 差异:有',
      candidateRows: [
        {
          rank: 1,
          id: 'codex-api-key:stable',
          title: 'Stable',
          meta: 'openai-compatible · 2 个活跃会话',
        },
        {
          rank: 2,
          id: 'auth-file:backup.json',
          title: 'Backup',
          meta: 'auth-file',
        },
      ],
      filteredRows: [
        { label: '账号已禁用', count: 1 },
        { label: '运行态限流', count: 2 },
      ],
      stepRows: [
        { label: '当前模式', detail: '均衡' },
        { label: '兼容信号', detail: 'session-affinity 已屏蔽' },
        { label: '候选池', detail: '2 个' },
        { label: '粘性命中', detail: 'codex-api-key:stable' },
      ],
    },
  );
});

test('buildPreviewChannelRouteAuditEvent converts explain result into browser-only ledger item', () => {
  const event = buildPreviewChannelRouteAuditEvent({
    channel: 'claude',
    explain: {
      selectedAccountID: 'codex-api-key:claude',
      candidates: [{ id: 'codex-api-key:claude' }, { id: 'codex-api-key:fallback' }],
      filtered: [{ id: 'codex-api-key:disabled' }],
      snapshotVersion: 'preview',
      policyVersion: 'channel-routing-v1',
      shadow: {
        enabled: true,
        routeMode: 'balanced',
        selectedAccountID: 'codex-api-key:fallback',
        diff: true,
      },
    },
  });

  assert.equal(event.channel, 'claude');
  assert.equal(event.selectedAccountID, 'codex-api-key:claude');
  assert.equal(event.candidateCount, 2);
  assert.equal(event.filteredCount, 1);
  assert.equal(event.redacted, true);
  assert.equal(event.shadowDiff, true);
});

test('buildChannelRoutingParticipantRows shows only requestable accounts in channel order', () => {
  assert.deepEqual(
    buildChannelRoutingParticipantRows(
      {
        orderedAccountIDs: [
          'codex-api-key:stable',
          'missing-account',
          'auth-file:disabled.json',
          'openai-compatible:fast',
          'auth-file:cooldown.json',
        ],
      },
      [
        {
          id: 'auth-file:cooldown.json',
          label: 'Cooldown',
          provider: 'OpenAI',
          sourceKind: 'codex-auth-file',
          requestable: false,
        },
        {
          id: 'openai-compatible:fast',
          label: 'Fast Relay',
          provider: 'OpenRouter',
          sourceKind: 'openai-compatible',
          requestable: true,
        },
        {
          id: 'codex-api-key:stable',
          label: 'Stable Key',
          provider: 'OpenAI',
          sourceKind: 'codex-api-key',
          requestable: true,
        },
        {
          id: 'auth-file:disabled.json',
          label: 'Disabled OAuth',
          provider: 'OpenAI',
          sourceKind: 'codex-auth-file',
          requestable: true,
          disabled: true,
        },
      ],
    ),
    [
      {
        rank: 1,
        id: 'codex-api-key:stable',
        title: 'Stable Key',
        meta: 'OpenAI · API Key',
      },
      {
        rank: 2,
        id: 'openai-compatible:fast',
        title: 'Fast Relay',
        meta: 'OpenRouter · OpenAI-compatible',
      },
    ],
  );
});
