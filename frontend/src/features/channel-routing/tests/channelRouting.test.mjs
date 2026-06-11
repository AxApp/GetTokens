import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CHANNEL_ROUTE_MODES,
  CHANNEL_ROUTE_MODE_HELP_SECTIONS,
  buildChannelRouteAuditEventSummary,
  buildChannelRoutingParticipantRows,
  buildChannelRoutingExplainDigest,
  buildProjectCandidatePoolProjectOptions,
  buildProjectCandidatePoolRuleRows,
  buildPreviewProjectCandidatePoolRules,
  buildPreviewChannelRouteAuditEvent,
  buildProjectCandidatePoolProjectsFromCodexLiveSessions,
  buildProjectCandidatePoolProjectsFromSessionManagementSnapshot,
  classifyChannelRouteMode,
  mergeProjectCandidatePoolObservedProjects,
  isChannelRouteMode,
  normalizeChannelRoutingConfig,
  normalizeProjectCandidatePoolRuleDraft,
  normalizeProjectCandidatePoolRules,
  updateChannelRoutingConfig,
  validateProjectCandidatePoolRuleDraft,
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

test('buildChannelRouteAuditEventSummary includes filtered reason counts when available', () => {
  const summary = buildChannelRouteAuditEventSummary({
    id: 'route-reasons',
    recordedAt: '2026-05-25T10:00:00Z',
    channel: 'codex',
    routeMode: 'balanced',
    selectedAccountID: 'codex-api-key:stable',
    candidateCount: 5,
    filteredCount: 3,
    filtered: [
      { id: 'auth-file:a.json', reason: 'account-disabled' },
      { id: 'auth-file:b.json', reason: 'runtime-rate-limit' },
      { id: 'auth-file:c.json', reason: 'runtime-rate-limit' },
    ],
    snapshotVersion: 'snapshot-7',
    policyVersion: 'channel-routing-v1',
    redacted: true,
  });

  assert.match(summary.meta, /过滤原因 runtime-rate-limit x2, account-disabled x1/);
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
        candidates: [
          {
            id: 'auth-file:backup.json',
            displayName: 'Backup',
            provider: 'auth-file',
          },
          {
            id: 'codex-api-key:stable',
            displayName: 'Stable',
            provider: 'openai-compatible',
            activeSessions: 2,
          },
        ],
        diff: true,
      },
    }),
    {
      hasExplain: true,
      modeLabel: '均衡',
      requestedModelLabel: '模型未指定',
      projectLabel: '项目未指定',
      selectedTitle: 'Stable',
      shadowSelectedTitle: 'Backup',
      selectedMeta: '命中候选 #1 · openai-compatible · 2 个活跃会话',
      summaryLabel: '2 个候选 / 3 个过滤',
      snapshotLabel: '快照 preview',
      policyLabel: '规则 channel-routing-v1',
      shadowLabel: 'Shadow 开启',
      shadowMeta: '顺序 · auth-file:backup.json · 差异:有',
      projectCandidatePoolLabel: '项目池未评估',
      projectCandidatePoolMeta: '',
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
      shadowCandidateRows: [
        {
          rank: 1,
          id: 'auth-file:backup.json',
          title: 'Backup',
          meta: 'auth-file',
        },
        {
          rank: 2,
          id: 'codex-api-key:stable',
          title: 'Stable',
          meta: 'openai-compatible · 2 个活跃会话',
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

test('buildChannelRoutingExplainDigest surfaces project candidate pool explain state', () => {
  assert.deepEqual(
    buildChannelRoutingExplainDigest({
      routeMode: 'sequential',
      selectedAccountID: 'auth-file:allowed.json',
      candidates: [
        {
          id: 'auth-file:allowed.json',
          displayName: 'Allowed',
          provider: 'auth-file',
        },
      ],
      filtered: [
        { id: 'auth-file:outside.json', reason: 'project-candidate-pool' },
        { id: 'auth-file:blocked.json', reason: 'project-candidate-pool-no-routeable-account' },
        { id: 'auth-file:conflict.json', reason: 'project-candidate-pool-conflict' },
      ],
      steps: ['mode:sequential', 'project-candidate-pool:matched', 'candidates:1'],
      snapshotVersion: 'snapshot-project',
      policyVersion: 'channel-routing-v1',
      projectCandidatePool: {
        evaluated: true,
        activated: true,
        reason: 'project-candidate-pool:matched',
        ruleID: 'rule-gettokens',
        projectName: 'GetTokens',
        beforeCandidateCount: 4,
        afterCandidateCount: 1,
      },
    }),
    {
      hasExplain: true,
      modeLabel: '顺序',
      requestedModelLabel: '模型未指定',
      projectLabel: 'GetTokens',
      selectedTitle: 'Allowed',
      shadowSelectedTitle: '未命中',
      selectedMeta: '命中候选 #1 · auth-file',
      summaryLabel: '1 个候选 / 3 个过滤',
      snapshotLabel: '快照 snapshot-project',
      policyLabel: '规则 channel-routing-v1',
      shadowLabel: 'Shadow 关闭',
      shadowMeta: '',
      projectCandidatePoolLabel: '项目候选池命中',
      projectCandidatePoolMeta: '项目:GetTokens · 规则:rule-gettokens · 4 → 1 个候选',
      candidateRows: [
        {
          rank: 1,
          id: 'auth-file:allowed.json',
          title: 'Allowed',
          meta: 'auth-file',
        },
      ],
      shadowCandidateRows: [],
      filteredRows: [
        { label: '项目候选池规则', count: 1 },
        { label: '项目候选池无可路由账号', count: 1 },
        { label: '项目候选池规则冲突', count: 1 },
      ],
      stepRows: [
        { label: '当前模式', detail: '顺序' },
        { label: '项目候选池', detail: '项目候选池命中' },
        { label: '候选池', detail: '1 个' },
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

test('project candidate pool rule model normalizes exact project keys and allow accounts', () => {
  const normalized = normalizeProjectCandidatePoolRuleDraft(
    {
      id: ' rule-1 ',
      channel: 'claude',
      projectKey: ' workspace:abc123 ',
      projectName: ' GetTokens ',
      enabled: undefined,
      allowAccountIDs: ['auth-file:a.json', ' ', 'auth-file:a.json', 'codex-api-key:b'],
    },
    'codex',
  );

  assert.deepEqual(normalized, {
    id: 'rule-1',
    channel: 'codex',
    projectKey: 'workspace:abc123',
    projectName: 'GetTokens',
    projectKeySource: 'manual-confirmed',
    projectKeyConfidence: 'strong',
    enabled: true,
    allowAccountIDs: ['auth-file:a.json', 'codex-api-key:b'],
    createdAt: undefined,
    updatedAt: undefined,
  });
  assert.deepEqual(validateProjectCandidatePoolRuleDraft(normalized), []);
  assert.deepEqual(validateProjectCandidatePoolRuleDraft({ projectKey: 'GetTokens', allowAccountIDs: ['auth-file:a.json'] }), [
    '项目标识缺少来源前缀，请重新选择历史项目',
  ]);
  assert.deepEqual(validateProjectCandidatePoolRuleDraft({ projectKey: 'workspace:abc123', allowAccountIDs: [] }), [
    '至少选择一个允许账号',
  ]);
});

test('project candidate pool rule lists normalize by channel and preview requestable accounts', () => {
  assert.deepEqual(
    normalizeProjectCandidatePoolRules(
      [
        {
          id: 'rule-a',
          channel: 'claude',
          projectKey: ' workspace:a ',
          projectName: 'A',
          allowAccountIDs: ['acct-a', 'acct-a', 'acct-b'],
        },
        {
          id: 'empty-key',
          projectKey: ' ',
          allowAccountIDs: ['acct-a'],
        },
      ],
      'codex',
    ),
    [
      {
        id: 'rule-a',
        channel: 'codex',
        projectKey: 'workspace:a',
        projectName: 'A',
        projectKeySource: 'manual-confirmed',
        projectKeyConfidence: 'strong',
        enabled: true,
        allowAccountIDs: ['acct-a', 'acct-b'],
        createdAt: undefined,
        updatedAt: undefined,
      },
    ],
  );

  assert.deepEqual(
    buildPreviewProjectCandidatePoolRules('claude', [
      { id: 'acct-a', label: 'A', requestable: true },
      { id: 'acct-b', label: 'B', requestable: false },
      { id: 'acct-c', label: 'C', requestable: true },
    ]),
    [
      {
        id: 'preview-claude-gettokens',
        channel: 'claude',
        projectKey: 'workspace:preview-gettokens',
        projectName: 'GetTokens',
        projectKeySource: 'browser-preview',
        projectKeyConfidence: 'strong',
        enabled: true,
        allowAccountIDs: ['acct-a', 'acct-c'],
      },
    ],
  );
});

test('project candidate pool rows show project metadata and missing accounts', () => {
  assert.deepEqual(
    buildProjectCandidatePoolRuleRows(
      [
        {
          id: 'rule-1',
          channel: 'codex',
          projectKey: 'workspace:abc123',
          projectName: 'GetTokens',
          projectKeySource: 'codex-turn-workspace',
          projectKeyConfidence: 'strong',
          enabled: false,
          allowAccountIDs: ['auth-file:a.json', 'missing-account'],
        },
      ],
      [
        {
          id: 'auth-file:a.json',
          label: 'OAuth A',
          provider: 'OpenAI',
          sourceKind: 'codex-auth-file',
          requestable: true,
        },
      ],
    ),
    [
      {
        id: 'rule-1',
        projectTitle: 'GetTokens',
        projectKey: 'workspace:abc123',
        projectMeta: 'codex-turn-workspace · strong',
        statusLabel: '停用',
        enabled: false,
        allowAccountTitles: ['OAuth A'],
        missingAccountIDs: ['missing-account'],
        accountCountLabel: '2 个账号',
        raw: {
          id: 'rule-1',
          channel: 'codex',
          projectKey: 'workspace:abc123',
          projectName: 'GetTokens',
          projectKeySource: 'codex-turn-workspace',
          projectKeyConfidence: 'strong',
          enabled: false,
          allowAccountIDs: ['auth-file:a.json', 'missing-account'],
        },
      },
    ],
  );
});

test('project candidate pool project options prefer configured rules, live sessions, and session history before route events', () => {
  const sessionProjects = mergeProjectCandidatePoolObservedProjects([
    ...buildProjectCandidatePoolProjectsFromSessionManagementSnapshot({
      projects: [
        {
          name: 'History Project',
          projectKey: 'workspace:history',
          projectKeySource: 'codex-session-cwd',
          projectKeyConfidence: 'strong',
          lastActiveAt: '2026-06-05T08:00:00.000Z',
          sessionCount: 3,
        },
        {
          name: 'Live Project',
          projectKey: 'workspace:live',
          projectKeySource: 'codex-session-cwd',
          projectKeyConfidence: 'strong',
          lastActiveAt: '2026-06-04T08:00:00.000Z',
          sessionCount: 1,
        },
      ],
    }),
    ...buildProjectCandidatePoolProjectsFromCodexLiveSessions(
      {
        sessions: [
          {
            projectName: 'Live Project',
            status: 'active',
            lastEventAt: '2026-06-06T08:00:00.000Z',
          },
          {
            projectName: 'Unknown Live Project',
            status: 'active',
            lastEventAt: '2026-06-06T08:30:00.000Z',
          },
        ],
      },
      {
        projects: [
          {
            name: 'Live Project',
            projectKey: 'workspace:live',
            projectKeySource: 'codex-session-cwd',
            projectKeyConfidence: 'strong',
            lastActiveAt: '2026-06-04T08:00:00.000Z',
            sessionCount: 1,
          },
        ],
      },
    ),
  ]);

  const options = buildProjectCandidatePoolProjectOptions({
    rules: [
      {
        id: 'rule-1',
        projectKey: 'workspace:configured',
        projectName: 'Configured Project',
        projectKeySource: 'codex-turn-workspace',
        projectKeyConfidence: 'strong',
        updatedAt: '2026-06-01T08:00:00.000Z',
      },
    ],
    sessionProjects,
    routeEvents: [
      {
        id: 'event-1',
        recordedAt: '2026-06-02T08:00:00.000Z',
        channel: 'codex',
        projectKey: 'workspace:observed',
        projectName: 'Route Event Project',
        projectKeySource: 'codex-turn-workspace',
        projectKeyConfidence: 'strong',
        routeMode: 'sequential',
        candidateCount: 2,
        filteredCount: 0,
        snapshotVersion: 'snapshot',
        policyVersion: 'policy',
        redacted: true,
      },
      {
        id: 'event-2',
        recordedAt: '2026-06-03T08:00:00.000Z',
        channel: 'codex',
        projectKey: 'workspace:configured',
        projectName: 'Configured From History',
        projectKeySource: 'history',
        projectKeyConfidence: 'observed',
        routeMode: 'balanced',
        candidateCount: 2,
        filteredCount: 0,
        snapshotVersion: 'snapshot',
        policyVersion: 'policy',
        redacted: true,
      },
      {
        id: 'event-no-project',
        recordedAt: '2026-06-04T08:00:00.000Z',
        channel: 'codex',
        routeMode: 'balanced',
        candidateCount: 2,
        filteredCount: 0,
        snapshotVersion: 'snapshot',
        policyVersion: 'policy',
        redacted: true,
      },
    ],
  });

  assert.deepEqual(options, [
    {
      projectKey: 'workspace:configured',
      projectName: 'Configured Project',
      projectKeySource: 'codex-turn-workspace',
      projectKeyConfidence: 'strong',
      configured: true,
      lastSeenAt: '2026-06-03T08:00:00.000Z',
      sourceLabel: '已配置',
      active: false,
      sessionCount: 0,
      sourceRank: 0,
    },
    {
      projectKey: 'workspace:live',
      projectName: 'Live Project',
      projectKeySource: 'codex-session-cwd',
      projectKeyConfidence: 'strong',
      configured: false,
      lastSeenAt: '2026-06-06T08:00:00.000Z',
      sourceLabel: '运行会话',
      active: true,
      sessionCount: 2,
      sourceRank: 1,
    },
    {
      projectKey: 'workspace:history',
      projectName: 'History Project',
      projectKeySource: 'codex-session-cwd',
      projectKeyConfidence: 'strong',
      configured: false,
      lastSeenAt: '2026-06-05T08:00:00.000Z',
      sourceLabel: '会话历史',
      active: false,
      sessionCount: 3,
      sourceRank: 2,
    },
    {
      projectKey: 'workspace:observed',
      projectName: 'Route Event Project',
      projectKeySource: 'codex-turn-workspace',
      projectKeyConfidence: 'strong',
      configured: false,
      lastSeenAt: '2026-06-02T08:00:00.000Z',
      sourceLabel: '路由记录',
      active: false,
      sessionCount: 0,
      sourceRank: 3,
    },
  ]);
});

test('Codex and Claude account list pages expose project candidate pool rule editing', async () => {
  const codexSource = await readFile(new URL('../../codex/CodexAccountListFeature.tsx', import.meta.url), 'utf8');
  const claudeSource = await readFile(new URL('../../claude-code/ClaudeCodeAccountListFeature.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../components/ProjectCandidatePoolRulesModal.tsx', import.meta.url), 'utf8');

  for (const source of [codexSource, claudeSource]) {
    assert.match(source, /ProjectCandidatePoolRulesModal/);
    assert.match(source, /ListProjectCandidatePoolRules/);
    assert.match(source, /CreateProjectCandidatePoolRule/);
    assert.match(source, /UpdateProjectCandidatePoolRule/);
    assert.match(source, /DeleteProjectCandidatePoolRule/);
    assert.match(source, /projectMatchKeys: projectKey \? \[projectKey\] : \[\]/);
    assert.match(source, /accountListModal === 'project-config'/);
    assert.match(source, /buildProjectCandidatePoolProjectOptions/);
    assert.match(source, /loadProjectCandidatePoolProjectSources/);
    assert.match(source, /Get(Codex|ClaudeCode)SessionManagementSnapshot/);
    assert.match(source, /projectOptions=\{projectCandidatePoolProjectOptions\}/);
  }
  assert.match(codexSource, /GetCodexLiveSessionsSnapshot/);
  assert.match(modalSource, /ProjectCandidatePoolRulesPanel/);
  assert.match(modalSource, /size="detail"/);
  assert.match(modalSource, /coverViewport/);
  assert.match(modalSource, /bodyClassName="flex min-h-0 flex-col overflow-x-hidden p-4 sm:p-5"/);
  assert.match(modalSource, /projectOptions/);
  assert.match(modalSource, /useState<HTMLDivElement \| null>/);
  assert.match(modalSource, /ref=\{setPrimaryActionSlot\}/);
  assert.match(modalSource, /primaryActionSlot=\{primaryActionSlot\}/);
});

test('ProjectCandidatePoolRulesPanel stays flat inside the project config modal', async () => {
  const source = await readFile(new URL('../components/ProjectCandidatePoolRulesPanel.tsx', import.meta.url), 'utf8');

  assert.match(source, /<section className="flex min-h-0 flex-1 flex-col">/);
  assert.match(source, /grid min-h-0 flex-1 gap-6 overflow-x-hidden/);
  assert.match(source, /xl:border-r xl:border-\[var\(--border-color\)\] xl:pr-5/);
  assert.match(source, /border-y border-\[var\(--border-color\)\]/);
  assert.match(source, /projectOptions\.map/);
  assert.match(source, /请选择历史项目/);
  assert.match(source, /flex min-h-0 min-w-0 flex-1 flex-col/);
  assert.match(source, /min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-y border-\[var\(--border-color\)\]/);
  assert.match(source, /createPortal/);
  assert.match(source, /primaryActionSlot/);
  assert.match(source, /onClick=\{saveRule\}[\s\S]*\{selectedExistingRule \? '更新规则' : '新建规则'\}/);
  assert.equal(source.match(/onClick=\{saveRule\}/g)?.length || 0, 1);
  assert.match(source, /moveDraftAccount/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /enabled \? `#\$\{rank\}` : '--'/);
  assert.match(source, /aria-label=\{`\$\{enabled \? '停用' : '启用'\}/);
  assert.doesNotMatch(source, /max-h-56/);
  assert.doesNotMatch(source, /flex shrink-0 justify-end pb-3/);
  assert.doesNotMatch(source, /min-h-0 flex-1 overflow-auto border-y/);
  assert.doesNotMatch(source, /<h2[\s\S]*项目候选池/);
  assert.doesNotMatch(source, /<p[\s\S]*命中历史项目后/);
  assert.doesNotMatch(source, /\{rows\.length\} rules/);
  assert.doesNotMatch(source, /selectedProjectOption/);
  assert.doesNotMatch(source, /带工作目录身份的会话/);
  assert.doesNotMatch(source, /border-y border-\[var\(--color-status-danger\)\]/);
  assert.doesNotMatch(source, /onChange=\{\(event\) => updateDraft\(\{ projectKey/);
  assert.doesNotMatch(source, /onChange=\{\(event\) => updateDraft\(\{ projectName/);
  assert.doesNotMatch(source, /placeholder="workspace:\.\.\."/);
  assert.doesNotMatch(source, /overflow-hidden border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(source, /<section className="min-w-0 border border-\[var\(--border-color\)\] p-3">/);
  assert.doesNotMatch(source, /<section className="min-w-0 border border-\[var\(--border-color\)\]">/);
});

test('ChannelRoutingWorkbench leaves participant account filtering to the account order list', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /group\/participants/);
  assert.doesNotMatch(source, /ParticipantList/);
  assert.doesNotMatch(source, /buildChannelRoutingParticipantRows/);
  assert.doesNotMatch(source, /label="参与账号"/);
});

test('ChannelRoutingWorkbench uses left conditions and right diagnostic result layout', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.match(source, />\s*条件列表\s*</);
  assert.match(source, />\s*运行预演\s*</);
  assert.doesNotMatch(source, /<DiagnosticStaticCondition/);
  assert.doesNotMatch(source, /function DiagnosticStaticCondition/);
  assert.match(source, /title="当前模式"/);
  assert.match(source, />\s*对比模式\s*</);
  assert.match(source, />\s*账号顺序\s*</);
  assert.match(source, /<DiagnosticSelect[\s\S]*label="请求模型"[\s\S]*<DiagnosticSelect[\s\S]*label="项目"/);
  assert.match(source, /rows=\{explainView\.candidateRows\}/);
  assert.match(source, /rows=\{explainView\.shadowCandidateRows\}/);
  assert.match(source, /lg:grid-cols-\[minmax\(14rem,0\.72fr\)_minmax\(0,1\.7fr\)\]/);
  assert.match(source, /lg:grid-cols-2/);
  assert.match(source, /input-swiss grid min-h-\[3\.25rem\] min-w-0 grid-cols-\[2\.5rem_minmax\(0,1fr\)\]/);
  assert.match(source, /btn-swiss min-h-11 w-full justify-start/);
  assert.match(source, /input-swiss min-w-0 !px-3 !py-2/);
  assert.match(source, /input-swiss max-w-\[9rem\] truncate/);
  assert.equal((source.match(/select-swiss h-11 min-w-0/g) || []).length, 1);
  assert.equal((source.match(/select-swiss h-\[1\.625rem\] w-\[4\.25rem\]/g) || []).length, 1);
  assert.match(source, /text-center !text-\[length:var\(--font-size-ui-sm\)\] \[text-align-last:center\]/);
  assert.match(source, />\s*条件列表\s*<\/span>/);
  assert.match(source, /text-\[length:var\(--font-size-ui-md\)\][^"]*">\s*条件列表\s*<\/span>/);
  assert.match(source, /<aside className="min-w-0 py-1">/);
  assert.equal((source.match(/border-l-2 border-\[var\(--border-color\)\]/g) || []).length, 2);
  assert.doesNotMatch(source, /border-y border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /lg:border-r/);
  assert.doesNotMatch(source, /border-l border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /onShadowEnabledChange/);
  assert.doesNotMatch(source, />\s*最近路由\s*</);
  assert.doesNotMatch(source, /RouteEventLedger/);
  assert.doesNotMatch(source, /onRefreshEvents/);
  assert.doesNotMatch(source, />\s*链路\s*</);
  assert.doesNotMatch(source, /<StepRow/);
  assert.doesNotMatch(source, /function StepRow/);
  assert.doesNotMatch(source, /<DiagnosticMetric/);
  assert.doesNotMatch(source, /function DiagnosticPill/);
  assert.doesNotMatch(source, /<DiagnosticPill/);
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
  assert.match(source, /onOpenProjectConfig/);
  assert.match(source, />\s*项目配置\s*</);
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
