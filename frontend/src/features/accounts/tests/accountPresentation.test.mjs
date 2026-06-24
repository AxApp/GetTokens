import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountAttributionBadges,
  buildAccountStabilitySummary,
  isCodexAuthFile,
  isCodexReauthEligible,
  mapBackendAccountRecord,
  resolveLoadedAccountIDs,
  resolveAccountAPIKeyPlainNotice,
  resolveAccountConfigurationWorkspaceHeading,
  resolveAccountFailureReason,
  buildAccountRecentRouteDecisionSummaries,
  resolveAccountOperationalState,
  resolveAccountProviderConfigHeading,
  resolveAccountStatusTone,
  resolveAccountSourceHeading,
  buildAccountDetailStatusMessage,
  isAccountUnavailable,
} from '../model/accountPresentation.ts';
import { shouldLoadAccountsData } from '../model/accountRuntime.ts';
import { buildAccountRuntimeStats, formatRuntimeLatency, formatRuntimeTokens } from '../model/accountDetailRuntime.ts';
import { getVendorPreset, getVendorPresets } from '../model/vendorPresets.ts';
import { resolveVendorDisplayName, resolveVendorLogo } from '../model/vendorIcons.ts';
import {
  buildUnifiedComposeProviderAriaLabel,
  resolveUnifiedComposeFormatTitle,
  resolveUnifiedComposeModalCopy,
} from '../model/unifiedComposeCopy.ts';
import {
  DEFAULT_RATE_LIMIT_STRATEGIES,
  RATE_LIMIT_CALENDAR_DAY_WINDOW,
  formatRateLimitLimitDraftValue,
  formatRateLimitWindowLabel,
  parseRateLimitLimitDraftValue,
  rateLimitRuleLabel,
} from '../model/rateLimit.ts';

const accountComponentTransitionGateFiles = [
  '../components/AccountDetailAuthFileSection.tsx',
  '../components/AccountLocalCliApplyConfirm.tsx',
  '../components/OpenAICompatibleComposeModal.tsx',
  '../components/OpenAICompatibleWorkspace.tsx',
  '../components/QuotaCalibrationPanel.tsx',
  '../components/QuotaThresholdRulePanel.tsx',
  '../components/RateLimitRulesSection.tsx',
  '../components/account-rotation/RotationConfigSection.tsx',
];

test('accounts component controls do not use bare transition utilities', () => {
  for (const file of accountComponentTransitionGateFiles) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');

    assert.doesNotMatch(source, /\btransition(?![-\[])/, `${file} should not use bare transition utilities`);
  }
});

test('shouldLoadAccountsData allows browser preview data without Wails bindings', () => {
  assert.equal(shouldLoadAccountsData({ code: 'running' }, false), true);
});

test('shouldLoadAccountsData waits for ready sidecar when Wails bindings exist', () => {
  assert.equal(shouldLoadAccountsData({ code: 'running' }, true), false);
  assert.equal(shouldLoadAccountsData({ code: 'stopped' }, true), false);
  assert.equal(shouldLoadAccountsData({ code: 'ready' }, true), true);
});

test('rate limit token-window draft limit is edited in millions', () => {
  assert.equal(formatRateLimitLimitDraftValue({ strategy: 'token-window', limitValue: 1000000 }), '1');
  assert.equal(formatRateLimitLimitDraftValue({ strategy: 'token-window', limitValue: 1500000 }), '1.5');
  assert.equal(parseRateLimitLimitDraftValue('token-window', '1.5'), 1500000);
});

test('rate limit request-window draft limit keeps raw count units', () => {
  assert.equal(formatRateLimitLimitDraftValue({ strategy: 'request-window', limitValue: 120 }), '120');
  assert.equal(parseRateLimitLimitDraftValue('request-window', '120'), 120);
});

test('rate limit supports calendar day window label', () => {
  assert.equal(formatRateLimitWindowLabel(RATE_LIMIT_CALENDAR_DAY_WINDOW), '00:00-23:59');
  assert.equal(rateLimitRuleLabel({ strategy: 'request-window', window: RATE_LIMIT_CALENDAR_DAY_WINDOW }), '00:00-23:59 REQ');
  assert.ok(DEFAULT_RATE_LIMIT_STRATEGIES.every((strategy) => strategy.supportedWindows.includes(RATE_LIMIT_CALENDAR_DAY_WINDOW)));
});

test('account detail runtime stats mirror card quota billing and usage values', () => {
  const t = (key) => ({
    'accounts.recent_requests': '最近请求',
    'accounts.total_tokens': '总 Token',
    'accounts.average_latency': '平均延迟',
  }[key] || key);
  const stats = buildAccountRuntimeStats(
    {
      requestCount: 1234,
      totalTokens: 2600000,
      cachedInputTokens: 2400,
      averageLatencyMs: 1450,
    },
    t,
  );

  assert.deepEqual(stats.map((item) => [item.id, item.value]), [
    ['recent-requests', '1.2K'],
    ['total-tokens', '2.6M'],
    ['cached-input', '2.4K'],
    ['average-latency', '1.5s'],
  ]);
  assert.equal(formatRuntimeTokens(0), '—');
  assert.equal(formatRuntimeLatency(900), '900ms');
});

test('buildAccountAttributionBadges includes codex plan from quota before source formats', () => {
  const badges = buildAccountAttributionBadges(
    {
      id: 'auth-file:codex.json',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'codex.json',
      status: 'ACTIVE',
      planType: 'free',
      supportedFormats: ['openai_responses', 'anthropic'],
    },
    {
      status: 'success',
      planType: 'plus',
      windows: [{ id: 'weekly', label: '7D', remainingPercent: 80, usedLabel: '20%', resetLabel: 'soon' }],
    },
  );

  assert.deepEqual(badges.map((badge) => badge.label), ['PLUS', 'OPENAI RESPONSES', 'ANTHROPIC']);
  assert.deepEqual(badges.map((badge) => badge.shortLabel || badge.label), ['PLUS', 'OAI RESP', 'ANTH']);
  assert.equal(badges[0].backgroundColor, 'color-mix(in_srgb,var(--gt-ink-primary)_6%,transparent)');
});

test('vendor preset picker uses compact provider names', () => {
  assert.equal(resolveVendorDisplayName(getVendorPreset('anthropic')), 'Anthropic');
  assert.equal(resolveVendorDisplayName(getVendorPreset('gemini')), 'Gemini');
  assert.equal(resolveVendorDisplayName(getVendorPreset('kimi')), 'Kimi');
  assert.equal(resolveVendorDisplayName(getVendorPreset('zhipu')), 'Zhipu');
  assert.equal(resolveVendorDisplayName(getVendorPreset('aws-bedrock')), 'AWS');
});

test('unified compose copy resolves localized labels and titles', () => {
  const t = (key) => `t:${key}`;
  const copy = resolveUnifiedComposeModalCopy(t);

  assert.equal(copy.title, 't:accounts.add_account');
  assert.equal(copy.selectTitle, 't:accounts.unified_compose_title_select');
  assert.equal(copy.configureTitle, 't:accounts.unified_compose_title_configure');
  assert.equal(copy.providerEyebrow, 't:accounts.unified_compose_provider_eyebrow');
  assert.equal(copy.endpointEyebrow, 't:accounts.unified_compose_endpoint_eyebrow');
  assert.equal(copy.credentialEyebrow, 't:accounts.unified_compose_credential_eyebrow');
  assert.equal(copy.automationEyebrow, 't:accounts.unified_compose_automation_eyebrow');
  assert.equal(copy.billingEyebrow, 't:accounts.unified_compose_billing_eyebrow');
  assert.equal(copy.labelLabel, 't:accounts.unified_compose_label');
  assert.equal(copy.baseUrlPrimaryLabel, 't:accounts.unified_compose_base_url_primary');
  assert.equal(copy.advancedLabel, 't:accounts.unified_compose_advanced');
  assert.equal(copy.billingLabel, 't:accounts.unified_compose_billing');
  assert.equal(copy.credentialsLabel, 't:accounts.unified_compose_credentials');
  assert.equal(copy.formatTargetLabels.openai_chat, 't:accounts.unified_compose_format_target_chat');
  assert.equal(resolveUnifiedComposeFormatTitle(t, 'gemini_native'), 't:accounts.unified_compose_format_title_gemini_native');
  assert.equal(buildUnifiedComposeProviderAriaLabel(t, 'OpenAI'), 't:accounts.unified_compose_provider_aria_prefix OpenAI');
});

test('unified compose locale keys exist in both zh and en', () => {
  const zh = JSON.parse(readFileSync(new URL('../../../locales/zh.json', import.meta.url), 'utf8'));
  const en = JSON.parse(readFileSync(new URL('../../../locales/en.json', import.meta.url), 'utf8'));
  const keys = [
    'unified_compose_title_select',
    'unified_compose_title_configure',
    'unified_compose_search_placeholder',
    'unified_compose_provider_eyebrow',
    'unified_compose_endpoint_eyebrow',
    'unified_compose_credential_eyebrow',
    'unified_compose_automation_eyebrow',
    'unified_compose_billing_eyebrow',
    'unified_compose_endpoints',
    'unified_compose_change',
    'unified_compose_custom_entry',
    'unified_compose_label',
    'unified_compose_label_placeholder_default',
    'unified_compose_label_placeholder_suffix',
    'unified_compose_base_url_primary',
    'unified_compose_advanced',
    'unified_compose_billing',
    'unified_compose_credentials',
    'unified_compose_quota_curl_placeholder',
    'unified_compose_billing_curl',
    'unified_compose_provider_aria_prefix',
    'unified_compose_category_official',
    'unified_compose_category_cn_official',
    'unified_compose_category_aggregator',
    'unified_compose_category_third_party',
    'unified_compose_category_cloud_provider',
    'unified_compose_format_target_claude',
    'unified_compose_format_target_chat',
    'unified_compose_format_target_responses',
    'unified_compose_format_target_gemini',
    'unified_compose_format_title_anthropic',
    'unified_compose_format_title_openai_chat',
    'unified_compose_format_title_openai_responses',
    'unified_compose_format_title_gemini_native',
  ];

  for (const [localeName, locale] of [
    ['zh', zh],
    ['en', en],
  ]) {
    for (const key of keys) {
      assert.ok(Object.hasOwn(locale.accounts, key), `${localeName} missing accounts.${key}`);
    }
  }
});

test('vendor preset picker resolves local logo specs with fallback initials', () => {
  const anthropicLogo = resolveVendorLogo(getVendorPreset('anthropic'));
  assert.equal(anthropicLogo.kind, 'logo');
  assert.equal(anthropicLogo.slug, 'anthropic');
  assert.ok(anthropicLogo.path.length > 20);

  const geminiLogo = resolveVendorLogo(getVendorPreset('gemini'));
  assert.equal(geminiLogo.kind, 'logo');
  assert.equal(geminiLogo.slug, 'googlegemini');

  const zhipuLogo = resolveVendorLogo(getVendorPreset('zhipu'));
  assert.equal(zhipuLogo.kind, 'initials');
  assert.equal(zhipuLogo.initials, 'ZH');

  for (const preset of getVendorPresets()) {
    const logo = resolveVendorLogo(preset);
    assert.ok(logo.title);
    assert.ok(logo.path || logo.initials);
  }
});

test('mapBackendAccountRecord keeps backend display name for api keys', () => {
  const record = mapBackendAccountRecord({
    id: 'codex-api-key:test',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'PRIMARY PROD KEY',
    status: 'ACTIVE',
    apiKey: 'sk-test',
    baseUrl: 'https://api.openai.com/v1',
    prefix: '',
  });

  assert.equal(record.displayName, 'PRIMARY PROD KEY');
});

test('mapBackendAccountRecord infers provider and formats from known base url', () => {
  const record = mapBackendAccountRecord({
    id: 'codex-api-key:deepseek',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'DEEPSEEK KEY',
    status: 'ACTIVE',
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: '',
  });

  assert.equal(record.provider, 'deepseek');
  assert.deepEqual(record.supportedFormats, ['anthropic', 'openai_chat']);
});

test('auth-file records come from unified account-store records only', () => {
  const mappedAccounts = [
    {
      id: 'acct_codex_pro',
      accountKind: 'auth-file',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'codex-pro.json',
      status: 'ACTIVE',
      name: 'codex-pro.json',
    },
    {
      id: 'acct_stable_001',
      accountKind: 'codex-api-key',
      provider: 'openai',
      credentialSource: 'api-key',
      displayName: 'Stable 001',
      status: 'CONFIGURED',
    },
  ];
  const authFileRecords = mappedAccounts.filter((account) => account.credentialSource === 'auth-file');
  const apiKeyRecords = mappedAccounts.filter((account) => account.credentialSource === 'api-key');

  assert.deepEqual(authFileRecords.map((account) => account.id), ['acct_codex_pro']);
  assert.deepEqual(
    resolveLoadedAccountIDs(authFileRecords, apiKeyRecords),
    ['acct_codex_pro', 'acct_stable_001']
  );
});

test('resolveAccountFailureReason only returns message for failed statuses', () => {
  assert.equal(
    resolveAccountFailureReason({
      id: 'acct_route_split',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'route split',
      status: 'CONFIGURED',
      runtimeStatus: 'applied_not_registered',
      runtimeReason: 'runtime auth missing from registry',
    }),
    'runtime auth missing from registry'
  );

  assert.equal(
    resolveAccountFailureReason({
      id: 'auth-file:broken',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'broken.json',
      status: 'ERROR',
      statusMessage: 'refresh token expired',
    }),
    'refresh token expired'
  );

  assert.equal(
    resolveAccountFailureReason({
      id: 'auth-file:healthy',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'healthy.json',
      status: 'ACTIVE',
      statusMessage: 'should stay hidden',
    }),
    ''
  );
});

test('buildAccountDetailStatusMessage exposes failed account diagnostics for detail page', () => {
  const t = (key) =>
    ({
      'accounts.detail_error_title': '账号异常',
      'accounts.detail_error_fallback': '当前账号状态异常，但 sidecar 未返回具体原因。',
    })[key] || key;

  assert.deepEqual(
    buildAccountDetailStatusMessage(
      {
        id: 'acct_route_split',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'route split',
        status: 'CONFIGURED',
        runtimeStatus: 'applied_not_registered',
        runtimeReason: 'runtime auth missing from registry',
      },
      t
    ),
    {
      title: '账号异常',
      body: 'runtime auth missing from registry',
      tone: 'danger',
    }
  );

  assert.deepEqual(
    buildAccountDetailStatusMessage(
      {
        id: 'auth-file:broken',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'broken.json',
        status: 'ERROR',
        statusMessage: 'refresh token expired',
      },
      t
    ),
    {
      title: '账号异常',
      body: 'refresh token expired',
      tone: 'danger',
    }
  );

  assert.deepEqual(
    buildAccountDetailStatusMessage(
      {
        id: 'auth-file:unknown-error',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'unknown-error.json',
        status: 'ERROR',
      },
      t
    ),
    {
      title: '账号异常',
      body: '当前账号状态异常，但 sidecar 未返回具体原因。',
      tone: 'danger',
    }
  );

  assert.equal(
    buildAccountDetailStatusMessage(
      {
        id: 'auth-file:healthy',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'healthy.json',
        status: 'ACTIVE',
        statusMessage: 'should stay hidden',
      },
      t
    ),
    null
  );
});

test('isCodexReauthEligible only allows failed codex auth-file accounts', () => {
  assert.equal(
    isCodexReauthEligible({
      id: 'auth-file:expired',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'expired.json',
      name: 'expired.json',
      status: 'ERROR',
    }),
    true
  );

  assert.equal(
    isCodexReauthEligible({
      id: 'auth-file:healthy',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'healthy.json',
      name: 'healthy.json',
      status: 'ACTIVE',
    }),
    false
  );

  assert.equal(
    isCodexReauthEligible({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'ERROR',
    }),
    false
  );
});

test('isCodexAuthFile allows any codex auth-file with a file name', () => {
  assert.equal(
    isCodexAuthFile({
      id: 'auth-file:healthy',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'healthy.json',
      name: 'healthy.json',
      status: 'ACTIVE',
    }),
    true
  );

  assert.equal(
    isCodexAuthFile({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'ACTIVE',
    }),
    false
  );
});

test('buildAccountStabilitySummary prefers failure reason and falls back to placeholder states', () => {
  const t = (key) => key;

  assert.deepEqual(
    buildAccountStabilitySummary(
      {
        id: 'auth-file:broken',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'broken.json',
        status: 'ERROR',
        statusMessage: 'refresh token expired',
      },
      {
        status: 'success',
        planType: '',
        windows: [{ id: 'month', label: 'MONTH', remainingPercent: 80, usedLabel: '', resetLabel: '' }],
      },
      t
    ),
    {
      title: 'accounts.stability_attention_title',
      body: 'refresh token expired',
      tone: 'warning',
    }
  );

  assert.deepEqual(
    buildAccountStabilitySummary(
      {
        id: 'auth-file:healthy',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'healthy.json',
        status: 'ACTIVE',
      },
      {
        status: 'success',
        planType: '',
        windows: [{ id: 'month', label: 'MONTH', remainingPercent: 80, usedLabel: '', resetLabel: '' }],
      },
      t
    ),
    {
      title: 'accounts.stability_ready_title',
      body: 'accounts.stability_ready_body',
      tone: 'positive',
    }
  );

  assert.deepEqual(
    buildAccountStabilitySummary(
      {
        id: 'api-key:codex',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'CODEX API KEY',
        status: 'ACTIVE',
      },
      {
        status: 'unsupported',
        planType: '',
        windows: [],
      },
      t
    ),
    {
      title: 'accounts.stability_placeholder_title',
      body: 'accounts.stability_placeholder_body',
      tone: 'neutral',
    }
  );
});

test('runtime routeability state drives account operational tone and availability', () => {
  const t = (key) =>
    ({
      'accounts.status_error_display': '异常',
      'accounts.status_waiting_check': '待检查',
      'accounts.status_available': '可用',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_local': '本地',
    })[key] || key;

  const degraded = {
    id: 'acct_route_split',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'route split',
    status: 'CONFIGURED',
    runtimeStatus: 'applied_not_registered',
    runtimeReason: 'runtime auth missing from registry',
  };

  assert.equal(resolveAccountStatusTone(degraded), 'danger');
  assert.deepEqual(resolveAccountOperationalState(degraded, undefined, undefined, t), {
    tone: 'danger',
    label: '异常',
  });
  assert.equal(isAccountUnavailable(degraded), true);

  const routeable = {
    id: 'acct_routeable',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'routeable',
    status: 'CONFIGURED',
    runtimeStatus: 'registered_routeable',
    routeable: true,
  };

  assert.equal(resolveAccountStatusTone(routeable), 'positive');
  assert.deepEqual(resolveAccountOperationalState(routeable, undefined, undefined, t), {
    tone: 'positive',
    label: '可用',
  });
  assert.equal(isAccountUnavailable(routeable), false);
});

test('account detail recent route decisions keep only decisions that touch the current account', () => {
  const rows = buildAccountRecentRouteDecisionSummaries(
    { id: 'acct_company_1' },
    [
      {
        id: 'decision-selected',
        recordedAt: '2026-06-15T11:00:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        selectedAccountID: 'acct_company_1',
        selectedProvider: 'codex',
        trace: [{ stage: 'pool-scope', reason: 'matched', activated: true }],
      },
      {
        id: 'decision-candidate',
        recordedAt: '2026-06-15T10:00:00Z',
        channel: 'claude',
        source: 'scheduler',
        candidateCount: 3,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        unavailableCode: 'auth-unavailable',
        trace: [{ stage: 'hard-filter', policy: 'RuntimeGuardPolicy' }],
      },
      {
        id: 'decision-other',
        recordedAt: '2026-06-15T09:00:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 1,
        selectedAccountID: 'acct_other',
      },
    ],
  );

  assert.deepEqual(rows, [
    {
      id: 'decision-selected',
      channel: 'codex',
      matchedAs: 'selected',
      title: '命中 acct_company_1',
      meta: 'CODEX · selected · 提供方:codex · 2 个候选 · 来源:scheduler',
      detail: 'pool-scope: matched · 命中凭据 acct_company_1',
      unresolved: false,
    },
    {
      id: 'decision-candidate',
      channel: 'claude',
      matchedAs: 'candidate',
      title: '未命中 · auth-unavailable',
      meta: 'CLAUDE · candidate · 3 个候选 · 来源:scheduler',
      detail: 'hard-filter: RuntimeGuardPolicy',
      unresolved: true,
    },
  ]);
});

test('account detail route resilience evidence groups reasons by stable target identity', () => {
  const rows = buildAccountRecentRouteDecisionSummaries(
    { id: 'acct_company_1' },
    [
      {
        id: 'decision-resilience',
        recordedAt: '2026-06-15T12:00:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'rpm cooldown',
            routeBlocking: true,
          },
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'tpm cooldown',
            routeBlocking: true,
          },
          {
            accountID: 'acct_company_2',
            authID: 'auth_company_2',
            source: 'auth-error',
            scope: 'account',
            model: 'gpt-5.4',
            reason: 'other account auth failed',
            routeBlocking: true,
          },
        ],
      },
    ],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].routeResilienceEvidence?.length, 1);
  assert.deepEqual(rows[0].routeResilienceEvidence?.map((evidence) => ({
    id: evidence.id,
    digestDisplayMode: evidence.digestDisplayMode,
    matchedDecisionID: evidence.matchedDecisionID,
    matchedRecordedAt: evidence.matchedRecordedAt,
    matchedRouteBlocking: evidence.matchedRouteBlocking,
    relevantDecisions: evidence.relevantDecisions,
    blockingDecisionCount: evidence.blockingDecisionCount,
    observeDecisionCount: evidence.observeDecisionCount,
    accountKey: evidence.accountKey,
    authId: evidence.authId,
    decisionID: evidence.decisionID,
    recordedAt: evidence.recordedAt,
    firstObservedDecisionID: evidence.firstObservedDecisionID,
    firstObservedAt: evidence.firstObservedAt,
    lastObservedDecisionID: evidence.lastObservedDecisionID,
    lastObservedAt: evidence.lastObservedAt,
    source: evidence.source,
    sourceLabel: evidence.sourceLabel,
    scope: evidence.scope,
    model: evidence.model,
    routeBlocking: evidence.routeBlocking,
    reasonSummary: evidence.reasonSummary,
    detail: evidence.detail,
    occurrenceCount: evidence.occurrenceCount,
  })), [
    {
      id: 'acct_company_1|auth_company_1|gpt-5.4|upstream-rate-limit|model',
      digestDisplayMode: 'full',
      matchedDecisionID: 'decision-resilience',
      matchedRecordedAt: '2026-06-15T12:00:00Z',
      matchedRouteBlocking: true,
      relevantDecisions: [
        {
          decisionID: 'decision-resilience',
          recordedAt: '2026-06-15T12:00:00Z',
          routeBlocking: true,
        },
      ],
      blockingDecisionCount: 1,
      observeDecisionCount: 0,
      accountKey: 'acct_company_1',
      authId: 'auth_company_1',
      decisionID: 'decision-resilience',
      recordedAt: '2026-06-15T12:00:00Z',
      firstObservedDecisionID: 'decision-resilience',
      firstObservedAt: '2026-06-15T12:00:00Z',
      lastObservedDecisionID: 'decision-resilience',
      lastObservedAt: '2026-06-15T12:00:00Z',
      source: 'upstream-rate-limit',
      sourceLabel: '上游限流',
      scope: 'model',
      model: 'gpt-5.4',
      routeBlocking: true,
      reasonSummary: 'rpm cooldown / tpm cooldown',
      detail: 'rpm cooldown / tpm cooldown · 2 次命中',
      occurrenceCount: 2,
    },
  ]);
  assert.doesNotMatch(rows[0].routeResilienceEvidence[0].id, /rpm cooldown|tpm cooldown/);
});

test('account detail route resilience evidence reuses digest recency metadata across decisions', () => {
  const rows = buildAccountRecentRouteDecisionSummaries(
    { id: 'acct_company_1' },
    [
      {
        id: 'decision-resilience-older',
        recordedAt: '2026-06-15T12:00:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'rpm cooldown',
            routeBlocking: true,
          },
        ],
      },
      {
        id: 'decision-resilience-latest',
        recordedAt: '2026-06-15T12:05:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'tpm cooldown',
            routeBlocking: true,
          },
        ],
      },
    ],
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].routeResilienceEvidence?.length, 1);
  assert.equal(rows[1].routeResilienceEvidence?.length, 1);
  assert.deepEqual(
    rows.map((row) => row.routeResilienceEvidence?.map((evidence) => ({
      id: evidence.id,
      digestDisplayMode: evidence.digestDisplayMode,
      matchedDecisionID: evidence.matchedDecisionID,
      matchedRecordedAt: evidence.matchedRecordedAt,
      matchedRouteBlocking: evidence.matchedRouteBlocking,
      relevantDecisions: evidence.relevantDecisions,
      blockingDecisionCount: evidence.blockingDecisionCount,
      observeDecisionCount: evidence.observeDecisionCount,
      decisionID: evidence.decisionID,
      recordedAt: evidence.recordedAt,
      firstObservedDecisionID: evidence.firstObservedDecisionID,
      firstObservedAt: evidence.firstObservedAt,
      lastObservedDecisionID: evidence.lastObservedDecisionID,
      lastObservedAt: evidence.lastObservedAt,
      reasonSummary: evidence.reasonSummary,
      detail: evidence.detail,
      occurrenceCount: evidence.occurrenceCount,
    }))),
    [
      [
        {
          id: 'acct_company_1|auth_company_1|gpt-5.4|upstream-rate-limit|model',
          digestDisplayMode: 'full',
          matchedDecisionID: 'decision-resilience-latest',
          matchedRecordedAt: '2026-06-15T12:05:00Z',
          matchedRouteBlocking: true,
          relevantDecisions: [
            {
              decisionID: 'decision-resilience-latest',
              recordedAt: '2026-06-15T12:05:00Z',
              routeBlocking: true,
            },
            {
              decisionID: 'decision-resilience-older',
              recordedAt: '2026-06-15T12:00:00Z',
              routeBlocking: true,
            },
          ],
          blockingDecisionCount: 2,
          observeDecisionCount: 0,
          decisionID: 'decision-resilience-latest',
          recordedAt: '2026-06-15T12:05:00Z',
          firstObservedDecisionID: 'decision-resilience-older',
          firstObservedAt: '2026-06-15T12:00:00Z',
          lastObservedDecisionID: 'decision-resilience-latest',
          lastObservedAt: '2026-06-15T12:05:00Z',
          reasonSummary: 'rpm cooldown / tpm cooldown',
          detail: 'rpm cooldown / tpm cooldown · 2 次命中',
          occurrenceCount: 2,
        },
      ],
      [
        {
          id: 'acct_company_1|auth_company_1|gpt-5.4|upstream-rate-limit|model',
          digestDisplayMode: 'reference',
          matchedDecisionID: 'decision-resilience-older',
          matchedRecordedAt: '2026-06-15T12:00:00Z',
          matchedRouteBlocking: true,
          relevantDecisions: [
            {
              decisionID: 'decision-resilience-latest',
              recordedAt: '2026-06-15T12:05:00Z',
              routeBlocking: true,
            },
            {
              decisionID: 'decision-resilience-older',
              recordedAt: '2026-06-15T12:00:00Z',
              routeBlocking: true,
            },
          ],
          blockingDecisionCount: 2,
          observeDecisionCount: 0,
          decisionID: 'decision-resilience-latest',
          recordedAt: '2026-06-15T12:05:00Z',
          firstObservedDecisionID: 'decision-resilience-older',
          firstObservedAt: '2026-06-15T12:00:00Z',
          lastObservedDecisionID: 'decision-resilience-latest',
          lastObservedAt: '2026-06-15T12:05:00Z',
          reasonSummary: 'rpm cooldown / tpm cooldown',
          detail: 'rpm cooldown / tpm cooldown · 2 次命中',
          occurrenceCount: 2,
        },
      ],
    ],
  );
  assert.equal(rows[0].routeResilienceEvidence[0].id, rows[1].routeResilienceEvidence[0].id);
  assert.doesNotMatch(rows[0].routeResilienceEvidence[0].id, /rpm cooldown|tpm cooldown/);
});

test('account detail route resilience evidence keeps different route semantics as separate digests', () => {
  const rows = buildAccountRecentRouteDecisionSummaries(
    { id: 'acct_company_1' },
    [
      {
        id: 'decision-semantic-split',
        recordedAt: '2026-06-15T12:10:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'rpm cooldown',
            routeBlocking: true,
          },
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'auth-error',
            scope: 'account',
            model: 'gpt-5.4',
            reason: 'oauth refresh failed',
            routeBlocking: true,
          },
        ],
      },
    ],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].routeResilienceEvidence?.length, 2);
  assert.deepEqual(
    rows[0].routeResilienceEvidence?.map((evidence) => ({
      id: evidence.id,
      source: evidence.source,
      scope: evidence.scope,
      reasonSummary: evidence.reasonSummary,
    })),
    [
      {
        id: 'acct_company_1|auth_company_1|gpt-5.4|upstream-rate-limit|model',
        source: 'upstream-rate-limit',
        scope: 'model',
        reasonSummary: 'rpm cooldown',
      },
      {
        id: 'acct_company_1|auth_company_1|gpt-5.4|auth-error|account',
        source: 'auth-error',
        scope: 'account',
        reasonSummary: 'oauth refresh failed',
      },
    ],
  );
});

test('account detail route resilience evidence keeps per-decision blocking explainability after dedupe', () => {
  const rows = buildAccountRecentRouteDecisionSummaries(
    { id: 'acct_company_1' },
    [
      {
        id: 'decision-observe-newer',
        recordedAt: '2026-06-15T12:15:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'soft cooldown warning',
            routeBlocking: false,
          },
        ],
      },
      {
        id: 'decision-blocking-older',
        recordedAt: '2026-06-15T12:10:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'hard cooldown block',
            routeBlocking: true,
          },
        ],
      },
    ],
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.routeResilienceEvidence?.map((evidence) => ({
      digestDisplayMode: evidence.digestDisplayMode,
      matchedDecisionID: evidence.matchedDecisionID,
      matchedRouteBlocking: evidence.matchedRouteBlocking,
      routeBlocking: evidence.routeBlocking,
      blockingDecisionCount: evidence.blockingDecisionCount,
      observeDecisionCount: evidence.observeDecisionCount,
      relevantDecisions: evidence.relevantDecisions,
    }))),
    [
      [
        {
          digestDisplayMode: 'full',
          matchedDecisionID: 'decision-observe-newer',
          matchedRouteBlocking: false,
          routeBlocking: true,
          blockingDecisionCount: 1,
          observeDecisionCount: 1,
          relevantDecisions: [
            {
              decisionID: 'decision-observe-newer',
              recordedAt: '2026-06-15T12:15:00Z',
              routeBlocking: false,
            },
            {
              decisionID: 'decision-blocking-older',
              recordedAt: '2026-06-15T12:10:00Z',
              routeBlocking: true,
            },
          ],
        },
      ],
      [
        {
          digestDisplayMode: 'reference',
          matchedDecisionID: 'decision-blocking-older',
          matchedRouteBlocking: true,
          routeBlocking: true,
          blockingDecisionCount: 1,
          observeDecisionCount: 1,
          relevantDecisions: [
            {
              decisionID: 'decision-observe-newer',
              recordedAt: '2026-06-15T12:15:00Z',
              routeBlocking: false,
            },
            {
              decisionID: 'decision-blocking-older',
              recordedAt: '2026-06-15T12:10:00Z',
              routeBlocking: true,
            },
          ],
        },
      ],
    ],
  );
});

test('account detail route resilience evidence keeps per-reason blocking details inside one decision digest', () => {
  const rows = buildAccountRecentRouteDecisionSummaries(
    { id: 'acct_company_1' },
    [
      {
        id: 'decision-mixed-reasons',
        recordedAt: '2026-06-17T08:00:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'rpm cooldown blocks current turn',
            routeBlocking: true,
          },
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'tpm cooldown observed for telemetry',
            routeBlocking: false,
          },
        ],
      },
    ],
  );

  assert.equal(rows.length, 1);
  const evidence = rows[0].routeResilienceEvidence?.[0];
  assert.equal(evidence?.id, 'acct_company_1|auth_company_1|gpt-5.4|upstream-rate-limit|model');
  assert.equal(evidence?.matchedRouteBlocking, true);
  assert.deepEqual(evidence?.matchedReasonDetails, [
    {
      reason: 'rpm cooldown blocks current turn',
      routeBlocking: true,
    },
    {
      reason: 'tpm cooldown observed for telemetry',
      routeBlocking: false,
    },
  ]);
  assert.doesNotMatch(evidence?.id || '', /rpm cooldown blocks current turn|tpm cooldown observed for telemetry/);
});

test('account detail route resilience reference evidence keeps current-decision reason details', () => {
  const rows = buildAccountRecentRouteDecisionSummaries(
    { id: 'acct_company_1' },
    [
      {
        id: 'decision-full-newer',
        recordedAt: '2026-06-17T08:05:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'newer soft warning',
            routeBlocking: false,
          },
        ],
      },
      {
        id: 'decision-reference-older',
        recordedAt: '2026-06-17T08:00:00Z',
        channel: 'codex',
        source: 'scheduler',
        candidateCount: 2,
        candidates: [{ accountID: 'acct_company_1', provider: 'codex' }],
        droppedReasons: [
          {
            accountID: 'acct_company_1',
            authID: 'auth_company_1',
            source: 'upstream-rate-limit',
            scope: 'model',
            model: 'gpt-5.4',
            reason: 'older hard block',
            routeBlocking: true,
          },
        ],
      },
    ],
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.routeResilienceEvidence?.map((evidence) => ({
      digestDisplayMode: evidence.digestDisplayMode,
      matchedDecisionID: evidence.matchedDecisionID,
      matchedRouteBlocking: evidence.matchedRouteBlocking,
      matchedReasonDetails: evidence.matchedReasonDetails,
      routeBlocking: evidence.routeBlocking,
    }))),
    [
      [
        {
          digestDisplayMode: 'full',
          matchedDecisionID: 'decision-full-newer',
          matchedRouteBlocking: false,
          matchedReasonDetails: [
            {
              reason: 'newer soft warning',
              routeBlocking: false,
            },
          ],
          routeBlocking: true,
        },
      ],
      [
        {
          digestDisplayMode: 'reference',
          matchedDecisionID: 'decision-reference-older',
          matchedRouteBlocking: true,
          matchedReasonDetails: [
            {
              reason: 'older hard block',
              routeBlocking: true,
            },
          ],
          routeBlocking: true,
        },
      ],
    ],
  );
  assert.equal(rows[0].routeResilienceEvidence[0].id, rows[1].routeResilienceEvidence[0].id);
  assert.doesNotMatch(rows[1].routeResilienceEvidence[0].id, /older hard block|newer soft warning/);
});

test('account detail headings keep explicit provider scope', () => {
  const t = (key) =>
    ({
      'accounts.source_api_key_with_provider': '{provider} API KEY',
      'accounts.provider_config_with_provider': '{provider} Provider Config',
      'accounts.configuration_workspace_with_provider': '{provider} Config Workspace',
      'accounts.api_key_plain_notice_with_provider': 'This panel shows the {provider} API key in plain text.',
    })[key] || key;

  const account = {
    id: 'api-key:codex',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'CODEX API KEY',
    status: 'ACTIVE',
  };

  assert.equal(resolveAccountSourceHeading(account, t), 'CODEX API KEY');
  assert.equal(resolveAccountProviderConfigHeading(account, t), 'CODEX Provider Config');
  assert.equal(resolveAccountConfigurationWorkspaceHeading(account, t), 'CODEX Config Workspace');
  assert.equal(resolveAccountAPIKeyPlainNotice(account, t), 'This panel shows the CODEX API key in plain text.');
});

test('resolveAccountStatusTone treats configured api keys as healthy', () => {
  assert.equal(
    resolveAccountStatusTone({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'CONFIGURED',
    }),
    'positive',
  );

  assert.equal(
    resolveAccountStatusTone({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'DISABLED',
    }),
    'warning',
  );

  assert.equal(
    resolveAccountStatusTone({
      id: 'api-key:codex',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'CODEX API KEY',
      status: 'ERROR',
    }),
    'danger',
  );
});

test('resolveAccountOperationalState prefers recent usage and falls back to waiting-check', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'api-key:codex',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'CODEX API KEY',
        status: 'CONFIGURED',
      },
      {
        hasData: true,
        success: 3,
        failure: 0,
        successRate: 100,
        averageLatencyMs: 120,
        lastActivityAt: Date.now(),
        statusBar: { blocks: [], blockDetails: [], successRate: 100, totalSuccess: 3, totalFailure: 0 },
      },
      undefined,
      t,
    ),
    { tone: 'positive', label: '可用' },
  );

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'api-key:codex',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'CODEX API KEY',
        status: 'CONFIGURED',
      },
      undefined,
      undefined,
      t,
    ),
    { tone: 'warning', label: '等待检测' },
  );

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'api-key:codex',
        provider: 'codex',
        credentialSource: 'api-key',
        displayName: 'CODEX API KEY',
        status: 'ERROR',
      },
      {
        hasData: true,
        success: 0,
        failure: 2,
        successRate: 0,
        averageLatencyMs: null,
        lastActivityAt: Date.now(),
        statusBar: { blocks: [], blockDetails: [], successRate: 0, totalSuccess: 0, totalFailure: 2 },
      },
      undefined,
      t,
    ),
    { tone: 'danger', label: '异常' },
  );
});

test('resolveAccountOperationalState treats oauth accounts with quota data as available', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'auth-file:codex',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'codex.json',
        status: 'ACTIVE',
      },
      undefined,
      {
        status: 'success',
        planType: 'PLUS',
        windows: [{ id: 'weekly', label: 'WEEKLY', remainingPercent: 80, usedLabel: '20%', resetLabel: 'soon' }],
      },
      t,
    ),
    { tone: 'positive', label: '可用' },
  );
});

test('resolveAccountOperationalState treats oauth quota auth failures as error instead of waiting-check', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'auth-file:codex',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'codex.json',
        status: 'ACTIVE',
      },
      undefined,
      {
        status: 'success',
        stale: true,
        degradedReason: 'ChatGPT usage request failed (401): token_invalidated',
        planType: 'PLUS',
        windows: [{ id: 'weekly', label: 'WEEKLY', remainingPercent: 80, usedLabel: '20%', resetLabel: 'soon' }],
      },
      t,
    ),
    { tone: 'danger', label: '异常' },
  );
});

test('resolveAccountOperationalState treats oauth workspace deactivation failures as error', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'auth-file:codex',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'codex.json',
        status: 'ACTIVE',
      },
      undefined,
      {
        status: 'success',
        stale: true,
        degradedReason: 'ChatGPT usage request failed (402) (deactivated_workspace)',
        planType: 'PLUS',
        windows: [{ id: 'weekly', label: 'WEEKLY', remainingPercent: 80, usedLabel: '20%', resetLabel: 'soon' }],
      },
      t,
    ),
    { tone: 'danger', label: '异常' },
  );
});

test('resolveAccountOperationalState treats generic stale quota refresh errors as error', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'auth-file:codex',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'codex.json',
        status: 'ACTIVE',
      },
      undefined,
      {
        status: 'success',
        stale: true,
        degradedReason: 'management api-call failed',
        planType: 'PLUS',
        windows: [{ id: 'weekly', label: 'WEEKLY', remainingPercent: 80, usedLabel: '20%', resetLabel: 'soon' }],
      },
      t,
    ),
    { tone: 'danger', label: '异常' },
  );
});

test('resolveAccountOperationalState keeps unobserved quota runtime as waiting-check', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'auth-file:codex',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'codex.json',
        status: 'ACTIVE',
      },
      undefined,
      {
        status: 'empty',
        stale: true,
        degradedReason: 'Quota runtime status has not been observed yet.',
        planType: 'PLUS',
        windows: [],
      },
      t,
    ),
    { tone: 'warning', label: '等待检测' },
  );
});

test('resolveAccountOperationalState keeps error cards visible even when usage looks healthy', () => {
  const t = (key) =>
    ({
      'accounts.status_available': '可用',
      'accounts.status_waiting_check': '等待检测',
      'accounts.status_disabled_display': '已禁用',
      'accounts.status_error_display': '异常',
      'accounts.status_local': '本地草稿',
    })[key] || key;

  assert.deepEqual(
    resolveAccountOperationalState(
      {
        id: 'auth-file:broken',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'broken.json',
        status: 'ERROR',
        statusMessage: 'refresh token expired',
      },
      {
        hasData: true,
        success: 4,
        failure: 0,
        successRate: 100,
        averageLatencyMs: 88,
        lastActivityAt: Date.now(),
        statusBar: { blocks: [], blockDetails: [], successRate: 100, totalSuccess: 4, totalFailure: 0 },
      },
      {
        status: 'success',
        planType: 'PLUS',
        windows: [{ id: 'weekly', label: 'WEEKLY', remainingPercent: 64, usedLabel: '36%', resetLabel: 'soon' }],
      },
      t,
    ),
    { tone: 'danger', label: '异常' },
  );
});
