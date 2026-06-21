import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CHANNEL_ROUTE_MODES,
  CHANNEL_ROUTE_MODE_HELP_SECTIONS,
  buildChannelRouteAuditEventSummary,
  buildChannelRouteDecisionSummary,
  buildChannelRoutingParticipantRows,
  buildChannelRoutingExplainDigest,
  buildRouteResilienceActionDescriptors,
  buildRouteResilienceEvidenceDigestsFromDroppedReasons,
  buildRouteResilienceEvidenceDigests,
  buildRouteResilienceActionHistoryEntry,
  buildRouteResilienceActionResultDigest,
  buildRouteResilienceActionTargets,
  findLatestRouteResilienceActionHistoryForTarget,
  buildProjectCandidatePoolProjectOptions,
  buildProjectCandidatePoolRuleRows,
  buildPreviewProjectCandidatePoolRules,
  buildPreviewChannelRouteAuditEvent,
  buildPreviewChannelRouteDecision,
  buildProjectCandidatePoolProjectsFromCodexLiveSessions,
  buildProjectCandidatePoolProjectsFromSessionManagementSnapshot,
  classifyChannelRouteMode,
  mergeProjectCandidatePoolObservedProjects,
  isChannelRouteMode,
  isRouteResilienceTransientSource,
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

test('buildRouteResilienceEvidenceDigestsFromDroppedReasons can enforce full stable identity', () => {
  const partial = buildRouteResilienceEvidenceDigestsFromDroppedReasons(
    [
      {
        decisionID: 'rd_partial',
        recordedAt: '2026-06-17T10:00:00Z',
        droppedReason: {
          accountID: 'acct_partial',
          authID: 'auth_partial',
          source: 'upstream-error',
          reason: 'temporary upstream timeout',
        },
      },
    ],
    [],
    '',
    { requireFullIdentity: true },
  );

  assert.deepEqual(partial, []);

  const digests = buildRouteResilienceEvidenceDigestsFromDroppedReasons(
    [
      {
        decisionID: 'rd_1',
        recordedAt: '2026-06-17T10:00:00Z',
        droppedReason: {
          accountID: 'acct_route_001',
          authID: 'auth_route_001',
          source: 'upstream-error',
          scope: 'model',
          model: 'gpt-5',
          reason: 'upstream recovered',
          routeBlocking: true,
        },
      },
      {
        decisionID: 'rd_2',
        recordedAt: '2026-06-17T10:01:00Z',
        droppedReason: {
          accountID: 'acct_route_001',
          authID: 'auth_route_001',
          source: 'upstream-error',
          scope: 'model',
          model: 'gpt-5',
          reason: 'temporary upstream timeout',
          routeBlocking: false,
        },
      },
    ],
    [],
    '',
    { requireFullIdentity: true },
  );

  assert.equal(digests.length, 1);
  assert.equal(digests[0]?.id, 'acct_route_001|auth_route_001|gpt-5|upstream-error|model');
  assert.equal(digests[0]?.reasonSummary, 'upstream recovered / temporary upstream timeout');
  assert.equal(digests[0]?.detail, 'upstream recovered / temporary upstream timeout · 2 次命中');
  assert.equal(digests[0]?.sourceLabel, '上游错误');
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

test('buildPreviewChannelRouteDecision converts explain result into browser-only real decision row', () => {
  const decision = buildPreviewChannelRouteDecision({
    channel: 'codex',
    explain: {
      requestedModel: 'gpt-5',
      selectedAccountID: 'acct-company-1',
      candidates: [{ id: 'acct-company-1' }, { id: 'acct-fallback' }],
      projectCandidatePool: {
        projectKey: 'workspace:gettokens',
        projectName: 'GetTokens',
        projectKeySource: 'browser-preview',
        projectKeyConfidence: 'strong',
      },
    },
  });

  assert.ok(decision);
  assert.equal(decision?.channel, 'codex');
  assert.equal(decision?.model, 'gpt-5');
  assert.equal(decision?.selectedAccountID, 'acct-company-1');
  assert.equal(decision?.candidateCount, 2);
  assert.equal(decision?.source, 'preview');
  assert.deepEqual(decision?.trace, [{ stage: 'preview', reason: 'browser preview route decision', activated: true }]);
});

test('buildChannelRouteDecisionSummary prefers selected account, trace and unresolved diagnostics', () => {
  assert.deepEqual(
    buildChannelRouteDecisionSummary({
      id: 'decision-1',
      recordedAt: '2026-06-15T10:00:00Z',
      channel: 'codex',
      model: 'gpt-5',
      projectName: 'GetTokens',
      source: 'scheduler',
      candidateCount: 3,
      selectedAccountID: 'acct-company-1',
      selectedProvider: 'codex',
      trace: [{ stage: 'pool-scope', reason: 'project-candidate-pool matched', activated: true }],
    }),
    {
      id: 'decision-1',
      title: '命中 acct-company-1',
      meta: '模型:gpt-5 · 提供方:codex · 项目:GetTokens · 3 个候选 · 来源:scheduler',
      detail: 'pool-scope: project-candidate-pool matched · 命中凭据 acct-company-1',
      unresolved: false,
    },
  );

  assert.deepEqual(
    buildChannelRouteDecisionSummary({
      id: 'decision-2',
      recordedAt: '2026-06-15T10:05:00Z',
      channel: 'codex',
      candidateCount: 0,
      unavailableCode: 'project-candidate-pool-no-routeable-account',
      unavailableMessage: 'project candidate pool left no routeable accounts',
      trace: [{ stage: 'pool-scope', policy: 'ProjectCandidatePoolPolicy' }],
    }),
    {
      id: 'decision-2',
      title: '未命中 · project-candidate-pool-no-routeable-account',
      meta: '0 个候选',
      detail: 'pool-scope: ProjectCandidatePoolPolicy · project candidate pool left no routeable accounts',
      unresolved: true,
    },
  );
});

test('buildChannelRouteDecisionSummary prefers structured dropped reasons before trace fallback', () => {
  assert.deepEqual(
    buildChannelRouteDecisionSummary({
      id: 'decision-dropped',
      recordedAt: '2026-06-15T10:10:00Z',
      channel: 'codex',
      model: 'gpt-5',
      candidateCount: 0,
      unavailableCode: 'no-routeable-account',
      droppedReasons: [
        {
          accountID: 'acct-company-2',
          authID: 'auth-company-2',
          source: 'rate-limit',
          scope: 'account',
          reason: 'request window exhausted',
          model: 'gpt-5',
          expiresAt: '2026-06-15T10:15:00Z',
          updatedAt: '2026-06-15T10:10:00Z',
          routeBlocking: true,
        },
      ],
      trace: [{ stage: 'pool-scope', reason: 'legacy trace fallback', activated: true }],
    }),
    {
      id: 'decision-dropped',
      title: '未命中 · no-routeable-account',
      meta: '模型:gpt-5 · 0 个候选',
      detail: 'rate-limit/account: request window exhausted · pool-scope: legacy trace fallback',
      unresolved: true,
    },
  );
});

test('buildRouteResilienceActionTargets keeps multiple structured dropped reasons selectable', () => {
  assert.deepEqual(
    buildRouteResilienceActionTargets(
      [
        {
          id: 'decision-1',
          recordedAt: '2026-06-17T10:00:00Z',
          channel: 'codex',
          model: 'gpt-5',
          candidateCount: 0,
          droppedReasons: [
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'upstream recovered',
              model: 'gpt-5',
              routeBlocking: true,
            },
            {
              accountID: 'acct-company-2',
              authID: 'auth-company-2',
              source: 'auth-error',
              scope: 'model',
              reason: 'token expired',
              model: 'gpt-5-mini',
              routeBlocking: true,
            },
          ],
        },
        {
          id: 'decision-2',
          recordedAt: '2026-06-17T10:05:00Z',
          channel: 'codex',
          model: 'gpt-5',
          candidateCount: 0,
          droppedReasons: [
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'temporary upstream timeout',
              model: 'gpt-5',
              routeBlocking: true,
            },
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'upstream recovered',
              model: 'gpt-5',
              routeBlocking: true,
            },
          ],
        },
      ],
      [
        { id: 'acct-company-1', label: 'Company Primary' },
        { id: 'acct-company-2', label: 'Company Backup' },
      ],
      '',
    ),
    [
      {
        id: 'acct-company-1|auth-company-1|gpt-5|upstream-error|account',
        accountKey: 'acct-company-1',
        authId: 'auth-company-1',
        model: 'gpt-5',
        accountTitle: 'Company Primary',
        source: 'upstream-error',
        scope: 'account',
        reason: 'upstream recovered',
        reasons: [
          { reason: 'upstream recovered', count: 2 },
          { reason: 'temporary upstream timeout', count: 1 },
        ],
        reasonSummary: 'upstream recovered x2 / temporary upstream timeout',
        routeBlocking: true,
        decisionID: 'decision-2',
        recordedAt: '2026-06-17T10:05:00Z',
        firstObservedDecisionID: 'decision-1',
        firstObservedAt: '2026-06-17T10:00:00Z',
        lastObservedDecisionID: 'decision-2',
        lastObservedAt: '2026-06-17T10:05:00Z',
        sourceLabel: '上游错误',
        title: 'Company Primary',
        meta: '上游错误 · account · model:gpt-5 · recent:decision-2',
        detail: 'upstream recovered x2 / temporary upstream timeout · 3 次命中',
        occurrenceCount: 3,
      },
      {
        id: 'acct-company-2|auth-company-2|gpt-5-mini|auth-error|model',
        accountKey: 'acct-company-2',
        authId: 'auth-company-2',
        model: 'gpt-5-mini',
        accountTitle: 'Company Backup',
        source: 'auth-error',
        scope: 'model',
        reason: 'token expired',
        reasons: [{ reason: 'token expired', count: 1 }],
        reasonSummary: 'token expired',
        routeBlocking: true,
        decisionID: 'decision-1',
        recordedAt: '2026-06-17T10:00:00Z',
        firstObservedDecisionID: 'decision-1',
        firstObservedAt: '2026-06-17T10:00:00Z',
        lastObservedDecisionID: 'decision-1',
        lastObservedAt: '2026-06-17T10:00:00Z',
        sourceLabel: '认证错误',
        title: 'Company Backup',
        meta: '认证错误 · model · model:gpt-5-mini · recent:decision-1',
        detail: 'token expired',
        occurrenceCount: 1,
      },
    ],
  );
});

test('buildRouteResilienceEvidenceDigests keeps stable ids while aggregating multiple reasons and latest evidence metadata', () => {
  assert.deepEqual(
    buildRouteResilienceEvidenceDigests(
      [
        {
          id: 'decision-1',
          recordedAt: '2026-06-17T10:00:00Z',
          channel: 'codex',
          model: 'gpt-5',
          candidateCount: 0,
          droppedReasons: [
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'upstream recovered',
              model: 'gpt-5',
              routeBlocking: true,
            },
          ],
        },
        {
          id: 'decision-2',
          recordedAt: '2026-06-17T10:05:00Z',
          channel: 'codex',
          model: 'gpt-5',
          candidateCount: 0,
          droppedReasons: [
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'temporary upstream timeout',
              model: 'gpt-5',
              routeBlocking: true,
            },
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'upstream recovered',
              model: 'gpt-5',
              routeBlocking: true,
            },
          ],
        },
      ],
      [{ id: 'acct-company-1', label: 'Company Primary' }],
      '',
    ),
    [
      {
        id: 'acct-company-1|auth-company-1|gpt-5|upstream-error|account',
        accountKey: 'acct-company-1',
        authId: 'auth-company-1',
        model: 'gpt-5',
        accountTitle: 'Company Primary',
        source: 'upstream-error',
        sourceLabel: '上游错误',
        scope: 'account',
        reason: 'upstream recovered',
        reasons: [
          { reason: 'upstream recovered', count: 2 },
          { reason: 'temporary upstream timeout', count: 1 },
        ],
        reasonSummary: 'upstream recovered x2 / temporary upstream timeout',
        routeBlocking: true,
        decisionID: 'decision-2',
        recordedAt: '2026-06-17T10:05:00Z',
        firstObservedDecisionID: 'decision-1',
        firstObservedAt: '2026-06-17T10:00:00Z',
        lastObservedDecisionID: 'decision-2',
        lastObservedAt: '2026-06-17T10:05:00Z',
        detail: 'upstream recovered x2 / temporary upstream timeout · 3 次命中',
        occurrenceCount: 3,
      },
    ],
  );
});

test('buildRouteResilienceEvidenceDigests derives first and latest observation boundaries independent of input order', () => {
  assert.deepEqual(
    buildRouteResilienceEvidenceDigests(
      [
        {
          id: 'decision-latest',
          recordedAt: '2026-06-17T10:05:00Z',
          channel: 'codex',
          model: 'gpt-5',
          candidateCount: 0,
          droppedReasons: [
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'temporary upstream timeout',
              model: 'gpt-5',
              routeBlocking: true,
            },
          ],
        },
        {
          id: 'decision-earliest',
          recordedAt: '2026-06-17T10:00:00Z',
          channel: 'codex',
          model: 'gpt-5',
          candidateCount: 0,
          droppedReasons: [
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'upstream recovered',
              model: 'gpt-5',
              routeBlocking: true,
            },
          ],
        },
      ],
      [{ id: 'acct-company-1', label: 'Company Primary' }],
      '',
    ),
    [
      {
        id: 'acct-company-1|auth-company-1|gpt-5|upstream-error|account',
        accountKey: 'acct-company-1',
        authId: 'auth-company-1',
        model: 'gpt-5',
        accountTitle: 'Company Primary',
        source: 'upstream-error',
        sourceLabel: '上游错误',
        scope: 'account',
        reason: 'temporary upstream timeout',
        reasons: [
          { reason: 'temporary upstream timeout', count: 1 },
          { reason: 'upstream recovered', count: 1 },
        ],
        reasonSummary: 'temporary upstream timeout / upstream recovered',
        routeBlocking: true,
        decisionID: 'decision-latest',
        recordedAt: '2026-06-17T10:05:00Z',
        firstObservedDecisionID: 'decision-earliest',
        firstObservedAt: '2026-06-17T10:00:00Z',
        lastObservedDecisionID: 'decision-latest',
        lastObservedAt: '2026-06-17T10:05:00Z',
        detail: 'temporary upstream timeout / upstream recovered · 2 次命中',
        occurrenceCount: 2,
      },
    ],
  );
});

test('buildRouteResilienceEvidenceDigests ignores dropped reasons without stable identity', () => {
  assert.deepEqual(
    buildRouteResilienceEvidenceDigests(
      [
        {
          id: 'decision-identity',
          recordedAt: '2026-06-17T10:00:00Z',
          channel: 'codex',
          model: 'gpt-5',
          candidateCount: 0,
          droppedReasons: [
            {
              source: 'upstream-error',
              scope: 'account',
              reason: 'anonymous reason should drop',
              model: 'gpt-5',
              routeBlocking: true,
            },
            {
              accountID: 'acct-company-1',
              authID: 'auth-company-1',
              source: 'upstream-error',
              scope: 'account',
              reason: 'named reason survives',
              model: 'gpt-5',
              routeBlocking: true,
            },
          ],
        },
      ],
      [{ id: 'acct-company-1', label: 'Company Primary' }],
      '',
    ),
    [
      {
        id: 'acct-company-1|auth-company-1|gpt-5|upstream-error|account',
        accountKey: 'acct-company-1',
        authId: 'auth-company-1',
        model: 'gpt-5',
        accountTitle: 'Company Primary',
        source: 'upstream-error',
        sourceLabel: '上游错误',
        scope: 'account',
        reason: 'named reason survives',
        reasons: [{ reason: 'named reason survives', count: 1 }],
        reasonSummary: 'named reason survives',
        routeBlocking: true,
        decisionID: 'decision-identity',
        recordedAt: '2026-06-17T10:00:00Z',
        firstObservedDecisionID: 'decision-identity',
        firstObservedAt: '2026-06-17T10:00:00Z',
        lastObservedDecisionID: 'decision-identity',
        lastObservedAt: '2026-06-17T10:00:00Z',
        detail: 'named reason survives',
        occurrenceCount: 1,
      },
    ],
  );
});

test('route resilience action descriptors keep transient cleanup narrow and surface not-implemented actions as passthrough', () => {
  const descriptors = buildRouteResilienceActionDescriptors(
    {
      accountKey: 'acct-company-1',
      authId: 'auth-company-1',
      model: 'gpt-5',
      accountTitle: 'Company Primary',
      source: 'rate-limit',
      scope: 'account',
      reason: 'request window exhausted',
      routeBlocking: true,
      decisionID: 'decision-1',
    },
    true,
  );

  assert.equal(descriptors[0].action, 'clear_transient_lockout');
  assert.equal(descriptors[0].enabled, false);
  assert.match(descriptors[0].disabledReason || '', /transient source/);
  assert.equal(descriptors[1].action, 'rerun_bounded_reconcile');
  assert.equal(descriptors[1].enabled, true);
  assert.equal(descriptors[2].action, 'recheck_routeability');
  assert.equal(descriptors[2].enabled, true);
});

test('route resilience target identity stays stable when reason text changes', () => {
  const initialTarget = buildRouteResilienceActionTargets(
    [
      {
        id: 'decision-1',
        recordedAt: '2026-06-17T10:00:00Z',
        channel: 'codex',
        model: 'gpt-5',
        candidateCount: 0,
        droppedReasons: [
          {
            accountID: 'acct-company-1',
            authID: 'auth-company-1',
            source: 'upstream-error',
            scope: 'account',
            reason: 'upstream recovered',
            model: 'gpt-5',
            routeBlocking: true,
          },
        ],
      },
    ],
    [{ id: 'acct-company-1', label: 'Company Primary' }],
    '',
  )[0];
  const refreshedTarget = buildRouteResilienceActionTargets(
    [
      {
        id: 'decision-2',
        recordedAt: '2026-06-17T10:05:00Z',
        channel: 'codex',
        model: 'gpt-5',
        candidateCount: 0,
        droppedReasons: [
          {
            accountID: 'acct-company-1',
            authID: 'auth-company-1',
            source: 'upstream-error',
            scope: 'account',
            reason: 'temporary upstream timeout',
            model: 'gpt-5',
            routeBlocking: true,
          },
        ],
      },
    ],
    [{ id: 'acct-company-1', label: 'Company Primary' }],
    '',
  )[0];

  const history = [
    buildRouteResilienceActionHistoryEntry(initialTarget, 'clear_transient_lockout', {
      ok: true,
      action: 'clear_transient_lockout',
      status: 'applied',
      authority: 'sidecar',
      auditId: 'audit-a',
      before: { blockCount: 1 },
      after: { blockCount: 0 },
      droppedReasons: [],
    }),
  ];

  assert.equal(initialTarget.id, 'acct-company-1|auth-company-1|gpt-5|upstream-error|account');
  assert.equal(refreshedTarget.id, initialTarget.id);
  assert.equal(refreshedTarget.reasonSummary, 'temporary upstream timeout');
  assert.deepEqual(findLatestRouteResilienceActionHistoryForTarget(history, refreshedTarget.id), history[0]);
});

test('route resilience action history stays bound to target instead of one global result slot', () => {
  const targetA = buildRouteResilienceActionTargets(
    [
      {
        id: 'decision-1',
        recordedAt: '2026-06-17T10:00:00Z',
        channel: 'codex',
        model: 'gpt-5',
        candidateCount: 0,
        droppedReasons: [
          {
            accountID: 'acct-company-1',
            authID: 'auth-company-1',
            source: 'upstream-error',
            scope: 'account',
            reason: 'upstream recovered',
            model: 'gpt-5',
            routeBlocking: true,
          },
        ],
      },
    ],
    [{ id: 'acct-company-1', label: 'Company Primary' }],
    '',
  )[0];
  const targetB = buildRouteResilienceActionTargets(
    [
      {
        id: 'decision-2',
        recordedAt: '2026-06-17T10:05:00Z',
        channel: 'codex',
        model: 'gpt-5-mini',
        candidateCount: 0,
        droppedReasons: [
          {
            accountID: 'acct-company-2',
            authID: 'auth-company-2',
            source: 'auth-error',
            scope: 'model',
            reason: 'token expired',
            model: 'gpt-5-mini',
            routeBlocking: true,
          },
        ],
      },
    ],
    [{ id: 'acct-company-2', label: 'Company Backup' }],
    '',
  )[0];

  const history = [
    buildRouteResilienceActionHistoryEntry(targetA, 'clear_transient_lockout', {
      ok: true,
      action: 'clear_transient_lockout',
      status: 'applied',
      authority: 'sidecar',
      auditId: 'audit-a',
      before: { blockCount: 1 },
      after: { blockCount: 0 },
      droppedReasons: [],
    }),
    buildRouteResilienceActionHistoryEntry(targetB, 'recheck_routeability', {
      ok: false,
      action: 'recheck_routeability',
      status: 'not_implemented',
      httpStatus: 501,
      notImplementedReason: 'routeability service permissions not available in current management layer',
      authority: 'sidecar',
      droppedReasons: [{ source: 'auth-error', scope: 'model', reason: 'token expired' }],
    }),
  ];

  assert.deepEqual(findLatestRouteResilienceActionHistoryForTarget(history, targetA.id), history[0]);
  assert.deepEqual(findLatestRouteResilienceActionHistoryForTarget(history, targetB.id), history[1]);
  assert.deepEqual(history[1], {
    id: 'acct-company-2|auth-company-2|gpt-5-mini|auth-error|model:recheck_routeability:not_implemented:sidecar',
    targetID: 'acct-company-2|auth-company-2|gpt-5-mini|auth-error|model',
    targetTitle: 'Company Backup',
    targetMeta: '认证错误 · model · model:gpt-5-mini · recent:decision-2',
    action: 'recheck_routeability',
    actionTitle: '重查 routeability',
    statusLabel: '未实现',
    tone: 'warning',
    detail: 'routeability service permissions not available in current management layer',
    authority: 'sidecar',
    auditId: '',
    beforeLabel: '',
    afterLabel: '',
    droppedReasonsLabel: '认证错误 / model: token expired',
  });
});

test('buildRouteResilienceActionResultDigest preserves sidecar not_implemented instead of treating it as success', () => {
  assert.deepEqual(
    buildRouteResilienceActionResultDigest({
      ok: false,
      action: 'recheck_routeability',
      status: 'not_implemented',
      httpStatus: 501,
      before: { blockCount: 1 },
      after: { blockCount: 1 },
      droppedReasons: [{ source: 'auth-error', scope: 'account', reason: 'auth failed' }],
      notImplementedReason: 'current gettokenshooks management layer does not own bounded reconcile or routeability service permissions',
    }),
    {
      statusLabel: '未实现',
      tone: 'warning',
      detail:
        'current gettokenshooks management layer does not own bounded reconcile or routeability service permissions',
      beforeLabel: 'blockCount:1',
      afterLabel: 'blockCount:1',
      droppedReasonsLabel: '认证错误 / account: auth failed',
    },
  );
});

test('isRouteResilienceTransientSource only allows the sidecar-supported clear list', () => {
  assert.equal(isRouteResilienceTransientSource('auth-error'), true);
  assert.equal(isRouteResilienceTransientSource('upstream-rate-limit'), true);
  assert.equal(isRouteResilienceTransientSource('upstream-error'), true);
  assert.equal(isRouteResilienceTransientSource('rate-limit'), false);
  assert.equal(isRouteResilienceTransientSource('quota-empty'), false);
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
    assert.match(source, /ListChannelRouteDecisions/);
    assert.match(source, /buildPreviewChannelRouteDecision/);
    assert.match(source, /routeDecisions=\{channelRouteDecisions\}/);
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
  const modalSource = await readFile(new URL('../components/ProjectCandidatePoolRulesModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /const projectCandidateRulesShellClass =/);
  assert.match(source, /const projectCandidateRulesPanelClass =/);
  assert.match(source, /const projectCandidateRulesButtonClass =/);
  assert.match(source, /const projectCandidateRulesSelectClass =/);
  assert.match(source, /data-project-candidate-pool-rules-panel/);
  assert.match(source, /data-project-candidate-rule-draft/);
  assert.match(source, /data-project-candidate-account-list/);
  assert.match(source, /data-project-candidate-rule-list/);
  assert.match(source, /data-project-candidate-rule-row/);
  assert.match(source, /data-project-candidate-rules-message/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-danger/);
  assert.match(modalSource, /const projectCandidateRulesModalButtonClass =/);
  assert.match(modalSource, /data-project-candidate-rules-modal-header/);
  assert.match(source, /projectOptions\.map/);
  assert.match(source, /请选择历史项目/);
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
  assert.doesNotMatch(source, /overflow-hidden border-2 border-\[var\(--gt-border-strong\)\] bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /<section className="min-w-0 border border-\[var\(--gt-border-strong\)\] p-3">/);
  assert.doesNotMatch(source, /<section className="min-w-0 border border-\[var\(--gt-border-strong\)\]">/);
  for (const targetSource of [source, modalSource]) {
    assert.doesNotMatch(targetSource, /btn-swiss|input-swiss|select-swiss|card-swiss/);
    assert.doesNotMatch(targetSource, /border-2|border-t-2|border-b-2/);
    assert.doesNotMatch(targetSource, /bg-\[var\(--bg-(main|surface)\)\]/);
    assert.doesNotMatch(targetSource, /bg-\[var\(--bg-surface\)\]/);
    assert.doesNotMatch(targetSource, /color-status-/);
    assert.doesNotMatch(targetSource, /font-black/);
    assert.doesNotMatch(targetSource, /uppercase/);
    assert.doesNotMatch(targetSource, /shadow-hard|shadow-\[/);
  }
});

test('ChannelRoutingWorkbench leaves participant account filtering to the account order list', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /group\/participants/);
  assert.doesNotMatch(source, /ParticipantList/);
  assert.doesNotMatch(source, /buildChannelRoutingParticipantRows/);
  assert.doesNotMatch(source, /label="参与账号"/);
});

test('ChannelRoutingWorkbench uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.match(source, /const channelRoutingPanelClass =/);
  assert.match(source, /const channelRoutingSecondaryButtonClass =/);
  assert.match(source, /data-channel-routing-shell/);
  assert.match(source, /data-channel-routing-diagnostics/);
  assert.match(source, /data-channel-routing-route-resilience/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-warning/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /card-swiss/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /input-swiss/);
  assert.doesNotMatch(source, /select-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-b-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /border-t-2 border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[/);
  assert.doesNotMatch(source, /tracking-(wide|wider|widest|tight|tighter|tightest|normal)/);
  assert.doesNotMatch(source, /shadow-\[4px_4px_0_var\(--gt-shadow-panel\)\]/);
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
  assert.match(source, /channelRoutingFieldClass/);
  assert.match(source, /channelRoutingPrimaryButtonClass/);
  assert.match(source, /channelRoutingSelectClass/);
  assert.match(source, /grid min-h-\[3\.25rem\] min-w-0 grid-cols-\[2\.5rem_minmax\(0,1fr\)\]/);
  assert.match(source, /className=\{channelRoutingPrimaryButtonClass\}/);
  assert.match(source, /\$\{channelRoutingFieldClass\} min-w-0/);
  assert.match(source, /max-w-\[9rem\] truncate px-2 py-1 text-right/);
  assert.ok((source.match(/channelRoutingSelectClass/g) || []).length >= 3);
  assert.match(source, /h-11 min-w-0 px-3 py-2 pr-8/);
  assert.match(source, /h-\[1\.625rem\] w-\[4\.25rem\] px-2 py-1 text-center/);
  assert.match(source, /text-center font-mono text-\[length:var\(--gt-font-size-sm\)\] \[text-align-last:center\]/);
  assert.match(source, />\s*条件列表\s*<\/span>/);
  assert.match(source, /text-\[length:var\(--gt-font-size-md\)\][^"]*">\s*条件列表\s*<\/span>/);
  assert.match(source, /<aside className="min-w-0 py-1">/);
  assert.equal((source.match(/border-l border-\[var\(--gt-border-subtle\)\]/g) || []).length, 2);
  assert.doesNotMatch(source, /border-y border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /lg:border-r/);
  assert.doesNotMatch(source, /border-l border-\[var\(--gt-border-strong\)\]/);
  assert.doesNotMatch(source, /onShadowEnabledChange/);
  assert.match(source, />\s*最近真实决策\s*</);
  assert.match(source, /SIDE CAR/);
  assert.match(source, /buildChannelRouteDecisionSummary/);
  assert.match(source, /运行预演或探测后，这里会显示 sidecar 最近真实路由决策/);
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
  assert.match(source, /<header className=\{`\$\{channelRoutingHeaderClass\} p-4`\}>/);
  assert.match(source, /grid min-w-0 flex-1 gap-2 sm:max-w-\[28rem\] sm:flex-none sm:grid-cols-2/);
  assert.doesNotMatch(source, /active \? '当前' : cue/);
  assert.doesNotMatch(source, /\bonSave\b/);
  assert.doesNotMatch(source, /\bSave\b/);
});

test('ChannelRoutingWorkbench presents route mode heading as a large status lockup', async () => {
  const source = await readFile(new URL('../components/ChannelRoutingWorkbench.tsx', import.meta.url), 'utf8');

  assert.match(source, /flex h-11 w-11 shrink-0 items-center justify-center rounded border border-\[var\(--gt-border-strong\)\] bg-\[var\(--gt-ink-primary\)\] text-\[var\(--gt-surface-canvas\)\]/);
  assert.match(source, /<h2 className="min-w-0 text-\[length:var\(--gt-font-size-lg\)\] font-semibold leading-5 text-\[var\(--gt-ink-primary\)\] sm:text-\[length:var\(--font-size-heading-sm\)\] sm:leading-normal">/);
  assert.doesNotMatch(source, /tracking-\[0\]/);
  assert.match(source, /查看请求模式说明/);
  assert.doesNotMatch(source, /preview\?: boolean/);
  assert.doesNotMatch(source, />\s*预览\s*</);
});
