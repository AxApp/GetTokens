import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CHANNEL_ROUTE_MODES,
  CHANNEL_ROUTE_MODE_HELP_SECTIONS,
  buildChannelRouteAuditEventSummary,
  buildChannelRoutingParticipantRows,
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

test('classifyChannelRouteMode treats every non GetTokens mode as invalid', () => {
  assert.deepEqual(classifyChannelRouteMode('balanced'), { kind: 'gettokens', mode: 'balanced' });
  assert.deepEqual(classifyChannelRouteMode('weighted'), { kind: 'invalid', mode: 'weighted' });
  assert.deepEqual(classifyChannelRouteMode('project'), { kind: 'invalid', mode: 'project' });
  assert.deepEqual(classifyChannelRouteMode('exclude'), { kind: 'invalid', mode: 'exclude' });
});

test('normalizeChannelRoutingConfig drops legacy routing fields from saved channel config', () => {
  const { config, invalidModes } = normalizeChannelRoutingConfig(
    {
      channel: 'codex',
      routeMode: 'weighted',
      orderedAccountIDs: ['auth-file:a.json', 'auth-file:a.json', ' ', 'codex-api-key:stable'],
      projectModeFallbackRouteMode: 'canary',
      fallbackMode: 'fallback-default',
      projectBindings: [
        { projectName: 'gettokens', targetType: 'group', targetID: 'paid', fallbackMode: 'fallback-default' },
      ],
    },
    { channel: 'codex' },
  );

  assert.equal(config.channel, 'codex');
  assert.equal(config.routeMode, 'sequential');
  assert.equal(config.shadowRouteMode, 'balanced');
  assert.deepEqual(config.orderedAccountIDs, ['auth-file:a.json', 'codex-api-key:stable']);
  assert.equal('projectModeFallbackRouteMode' in config, false);
  assert.equal('fallbackMode' in config, false);
  assert.equal('projectBindings' in config, false);
  assert.deepEqual(invalidModes, ['weighted']);
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
  assert.deepEqual(normalized.invalidModes, []);
});

test('project mode inputs are invalid and do not create project fallback config', () => {
  const normalized = normalizeChannelRoutingConfig(
    {
      routeMode: 'project',
      projectModeFallbackRouteMode: 'project',
    },
    { channel: 'claude' },
  );

  assert.equal(normalized.config.routeMode, 'sequential');
  assert.equal('projectModeFallbackRouteMode' in normalized.config, false);
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

test('normalizeChannelRoutingConfig removes legacy project bindings entirely', () => {
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
  assert.equal('projectBindings' in normalized.config, false);
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
      steps: ['mode:balanced', 'candidates:2', 'sticky:hit:codex-api-key:stable'],
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

test('ChannelRoutingWorkbench leaves participant account filtering to the account order list', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /group\/participants/);
  assert.doesNotMatch(source, /ParticipantList/);
  assert.doesNotMatch(source, /buildChannelRoutingParticipantRows/);
  assert.doesNotMatch(source, /label="参与账号"/);
});

test('channel route mode help explains sequential fallback without claiming account exclusivity', () => {
  const helpText = CHANNEL_ROUTE_MODE_HELP_SECTIONS.flatMap((section) => [
    section.title,
    section.body,
    ...section.points,
  ]).join('\n');

  assert.match(helpText, /顺序模式不是账号独占/);
  assert.match(helpText, /不保证整段会话或全应用只消耗第一个账号/);
  assert.match(helpText, /retry 时，会排除已尝试账号/);
  assert.match(helpText, /路由探测和连续测试会发真实 relay 请求/);
  assert.match(helpText, /Explain \/ dry-run 只解释候选和过滤原因/);
});

test('ChannelRoutingWorkbench opens route mode help as a modal next to route mode', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.match(source, /CircleHelp/);
  assert.match(source, /aria-label="查看请求模式说明"/);
  assert.match(source, /const \[helpOpen, setHelpOpen\] = useState\(false\)/);
  assert.match(source, /<RouteModeHelpModal onClose=\{\(\) => setHelpOpen\(false\)\} \/>/);
  assert.match(source, /<ModalFrame/);
  assert.match(source, /ariaLabel="请求模式说明"/);
  assert.match(source, /关闭请求模式说明/);
  assert.doesNotMatch(source, /返回模式/);
  assert.doesNotMatch(source, /view === 'help'/);
});

test('ChannelRoutingWorkbench keeps route mode toggles in the header and removes the save button', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.match(source, /routeModes\.map/);
  assert.match(source, /onModeChange\(mode\)/);
  assert.match(source, /<header className="p-4">/);
  assert.match(source, /grid min-w-0 flex-1 gap-2 sm:max-w-\[28rem\] sm:flex-none sm:grid-cols-2/);
  assert.doesNotMatch(source, /active \? '当前' : cue/);
  assert.doesNotMatch(source, /\bonSave\b/);
  assert.doesNotMatch(source, /\bSave\b/);
});

test('ChannelRoutingWorkbench presents route mode heading as a large status lockup', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.match(source, /flex h-11 w-11 shrink-0 items-center justify-center border-2 border-\[var\(--text-primary\)\] bg-\[var\(--text-primary\)\] text-\[var\(--bg-main\)\]/);
  assert.match(source, /<h2 className="min-w-0 text-\[length:var\(--font-size-ui-lg\)\] font-black leading-5 tracking-\[0\] text-\[var\(--text-primary\)\] sm:text-\[length:var\(--font-size-heading-sm\)\] sm:leading-normal">/);
  assert.match(source, /查看请求模式说明/);
  assert.doesNotMatch(source, /preview\?: boolean/);
  assert.doesNotMatch(source, />\s*预览\s*</);
});
