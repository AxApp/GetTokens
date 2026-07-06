import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { resolveUnboundedTrafficActivityPercent } from '../model/accountUsage.ts';
import {
  buildRateLimitGuardRows,
  collectLegacyRateLimitBindings,
  isLegacyRateLimitAccountKey,
} from '../model/rateLimit.ts';

test('rate limit guard rows expose quota-like progress details for account cards', () => {
  const rows = buildRateLimitGuardRows({
    accountKey: 'acct_001',
    blocked: false,
    rules: [
      {
        exceeded: false,
        usagePct: 37.4,
        currentUsage: 1870000,
        limitValue: 5000000,
        windowStart: '2026-06-03T00:00:00Z',
        windowEnd: '2026-06-03T01:00:00',
        nextReset: '2026-06-03T01:00:00',
        rule: {
          id: 'rlr_tokens_1h',
          accountKey: 'acct_001',
          strategy: 'token-window',
          window: '1h',
          limitValue: 5000000,
          action: 'block',
          enabled: true,
          label: 'Claude burst',
        },
      },
    ],
    lastEvaluatedAt: '2026-06-03T00:30:00Z',
  });

  assert.deepEqual(rows, [
    {
      id: 'rlr_tokens_1h',
      label: 'CLAUDE BURST',
      valueLabel: '1.9M / 5M',
      fillPercent: 37,
      tone: 'warning',
      windowLabel: '1h',
      resetLabel: '06/03 01:00',
    },
  ]);
});

test('rate limit model detects legacy account key bindings without migrating them', () => {
  assert.equal(isLegacyRateLimitAccountKey('auth-file:codex.json'), true);
  assert.equal(isLegacyRateLimitAccountKey('codex-api-key:stable'), true);
  assert.equal(isLegacyRateLimitAccountKey('openai-compatible:deepseek'), true);
  assert.equal(isLegacyRateLimitAccountKey('acct_00000000-0000-4000-8000-000000000001'), false);

  const bindings = collectLegacyRateLimitBindings({
    currentAccountKey: 'acct_00000000-0000-4000-8000-000000000001',
    rules: [
      {
        id: 'rule-legacy',
        accountKey: 'codex-api-key:stable',
        strategy: 'token-window',
        window: '24h',
        limitValue: 1000,
        action: 'block',
        enabled: true,
      },
    ],
    status: {
      accountKey: 'acct_00000000-0000-4000-8000-000000000001',
      blocked: false,
      rules: [
        {
          exceeded: false,
          usagePct: 10,
          currentUsage: 10,
          rule: {
            id: 'status-legacy',
            accountKey: 'auth-file:codex.json',
            strategy: 'request-window',
            window: '1h',
            limitValue: 100,
            action: 'warn',
            enabled: true,
          },
        },
      ],
    },
    events: [
      {
        id: 'event-legacy',
        accountKey: 'openai-compatible:deepseek',
        ruleID: 'rule-legacy',
        strategy: 'token-window',
        window: '24h',
        action: 'block',
        usageValue: 1000,
        limitValue: 1000,
        blocked: true,
        triggeredAt: 1760000000000,
      },
    ],
  });

  assert.deepEqual(bindings.map((item) => `${item.source}:${item.accountKey}`), [
    'rules:codex-api-key:stable',
    'status:auth-file:codex.json',
    'events:openai-compatible:deepseek',
  ]);
});


test('rate limit guard rows use the same stacked progress layout as quota rows', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /import \{ Flex, Progress, Tag, Tooltip \} from 'antd'/);
  assert.match(source, /<Flex className="account-card-rate-limit-heading min-w-0" align="baseline" justify="space-between" gap="small">/);
  assert.match(source, /<Progress[\s\S]*size=\{\{ height: 16 \}\}[\s\S]*strokeLinecap="square"/);
  assert.match(source, /className="account-card-rate-limit-row grid min-w-0 gap-1\.5"/);
  assert.match(styleSource, /\.account-card-rate-limit-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.doesNotMatch(styleSource, /\.account-card-rate-limit-row\s*\{[^}]*grid-template-columns:\s*(?:4|5)rem\s+minmax\(0,\s*1fr\)/s);
});

test('rate limit model is keyed only by accountKey', async () => {
  const source = await readFile(new URL('../model/rateLimit.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /matchKey|MatchKey|match_key/);
  assert.match(source, /accountKey: string/);
  assert.match(source, /interface RateLimitSourceState/);
  assert.match(source, /lastEvaluatedAt/);
  assert.match(source, /nextReset/);
});

test('rate limit rules section edits account-card rules without matchKey fallback', async () => {
  const source = await readFile(new URL('../components/RateLimitRulesSection.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /matchKey|MatchKey|match_key/);
  assert.doesNotMatch(source, /ROW_GRID_CLASS/);
  assert.doesNotMatch(source, /overflow-x-auto/);
  assert.doesNotMatch(source, /min-w-\[76rem\]/);
  assert.doesNotMatch(source, /ruleTexts/);
  assert.doesNotMatch(source, /rules\.slice\(0, 3\)/);
  assert.doesNotMatch(source, /rateLimitViewMode/);
  assert.doesNotMatch(source, /data-rate-limit-view-mode="summary"/);
  assert.doesNotMatch(source, /rate_limit_edit_rules/);
  assert.doesNotMatch(source, /rate_limit_done/);
  assert.doesNotMatch(source, /rate_limit_label/);
  assert.doesNotMatch(source, /border-y-2/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]\/45/);
  assert.doesNotMatch(source, /<div className="space-y-4">/);
  assert.doesNotMatch(source, /className="space-y-3" role="list"/);
  assert.doesNotMatch(source, /formatRateLimitMetric\(ruleState\.currentUsage\) \/ \$\{formatRateLimitMetric/);
  assert.match(source, /const rateLimitRulesShellClass =/);
  assert.match(source, /const rateLimitRulesPanelClass =/);
  assert.match(source, /import \{ Button, Checkbox, Input, Select, Tooltip \} from 'antd'/);
  assert.match(source, /<Button/);
  assert.match(source, /<Input/);
  assert.match(source, /const rateLimitRulesNoticeToneClass =/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-danger/);
  assert.match(source, /data-rate-limit-rules-section/);
  assert.match(source, /data-rate-limit-rules-list/);
  assert.match(source, /data-rate-limit-rule-card/);
  assert.match(source, /data-rate-limit-rule-draft/);
  assert.match(source, /data-rate-limit-rule-message/);
  assert.doesNotMatch(source, /btn-swiss|input-swiss|select-swiss|card-swiss/);
  assert.doesNotMatch(source, /border-2|border-t-2|border-b-2|border-dashed/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]|bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /color-status-/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)|\buppercase\b|shadow-hard|shadow-\[/);
  assert.doesNotMatch(source, /tracking-\[|tracking-wide|tracking-wider|tracking-widest|tracking-tight|tracking-tighter|tracking-tightest/);
  assert.match(source, /density="dense"/);
  assert.match(source, /rate_limit_add_rule/);
  assert.match(source, /editingRuleIndex/);
  assert.match(source, /openRuleMenuIndex/);
  assert.match(source, /finishEditingRateLimitRule/);
  assert.match(source, /Checkbox/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /role="menuitem"/);
  assert.match(source, /rate_limit_rule_edit/);
  assert.match(source, /rate_limit_rule_save/);
  assert.match(source, /buildRateLimitRuleRowSummary/);
  assert.match(source, /data-rate-limit-view-mode="config"/);
  assert.doesNotMatch(source, /title=\{rateLimitSummaryText\}/);
  assert.doesNotMatch(source, /\{rateLimitSummaryText\}/);
  assert.doesNotMatch(source, /rateLimitSources\.map/);
  assert.doesNotMatch(source, /formatRateLimitTimestamp/);
});



test('account cards render route guard module from the full card path', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /showCompactRouteGuard|density === 'compact'/);
  assert.match(source, /<RateLimitGuard rateLimitStatus=\{rateLimitStatus\} usageSummary=\{usageSummary\} refreshing=\{rateLimitRefreshing \|\| usageRefreshing\} t=\{t\} \/>/);
});

test('account quota refresh also refreshes route guard status and marks guard rows busy', async () => {
  const pageSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const pageStateSource = await readFile(new URL('../hooks/useAccountsPageState.ts', import.meta.url), 'utf8');
  const usageHookSource = await readFile(new URL('../hooks/useAccountsUsageState.ts', import.meta.url), 'utf8');
  const rateLimitHookSource = await readFile(new URL('../hooks/useAccountsRateLimitState.ts', import.meta.url), 'utf8');
  const groupSource = await readFile(new URL('../components/AccountGroupSection.tsx', import.meta.url), 'utf8');
  const cardSource = await readFile(new URL('../components/AccountCard.tsx', import.meta.url), 'utf8');
  const frameSource = await readFile(new URL('../components/AccountCardFrame.tsx', import.meta.url), 'utf8');
  const attributionSource = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(rateLimitHookSource, /const \[rateLimitRefreshingAccountIDSet, setRateLimitRefreshingAccountIDSet\]/);
  assert.match(rateLimitHookSource, /refreshAccountRateLimits/);
  assert.match(usageHookSource, /const \[usageRefreshingAccountIDSet, setUsageRefreshingAccountIDSet\]/);
  assert.match(usageHookSource, /refreshAccountUsage/);
  assert.match(pageStateSource, /refreshAccountRateLimits/);
  assert.match(pageStateSource, /refreshAccountUsage/);
  assert.match(pageStateSource, /rateLimitRefreshingAccountIDSet/);
  assert.match(pageStateSource, /usageRefreshingAccountIDSet/);
  assert.match(pageSource, /void refreshAccountRateLimits\(groupAccounts\)/);
  assert.match(pageSource, /void refreshAccountUsage\(groupAccounts\)/);
  assert.match(pageSource, /void refreshAccountRateLimits\(\[account\]\)/);
  assert.match(pageSource, /void refreshAccountUsage\(\[account\]\)/);
  assert.match(pageStateSource, /refreshAccountsRuntime/);
  assert.match(pageSource, /void refreshAccountsRuntime\(\)/);
  assert.match(groupSource, /rateLimitRefreshing=\{rateLimitRefreshingAccountIDSet\.has\(account\.id\)\}/);
  assert.match(groupSource, /usageRefreshing=\{usageRefreshingAccountIDSet\.has\(account\.id\)\}/);
  assert.match(cardSource, /rateLimitRefreshing\?: boolean/);
  assert.match(cardSource, /usageRefreshing\?: boolean/);
  assert.match(cardSource, /rateLimitRefreshing=\{rateLimitRefreshing\}/);
  assert.match(cardSource, /usageRefreshing=\{usageRefreshing\}/);
  assert.match(cardSource, /const \[refreshFeedback, setRefreshFeedback\] = useState\(false\)/);
  assert.match(cardSource, /function showRefreshFeedback\(\)/);
  assert.match(cardSource, /showRefreshFeedback\(\);\s*onRefreshQuota\(account\);/);
  assert.match(attributionSource, /rateLimitRefreshing\?: boolean/);
  assert.match(attributionSource, /usageRefreshing\?: boolean/);
  assert.match(attributionSource, /refreshFeedback\?: boolean/);
  assert.match(attributionSource, /const refreshing = refreshFeedback \|\| resolvedQuotaDisplay\.refreshing === true \|\| rateLimitRefreshing \|\| usageRefreshing/);
  assert.match(attributionSource, /refreshing=\{refreshing\}/);
  assert.match(frameSource, /data-account-card-refreshing=\{refreshing \? 'true' : undefined\}/);
  assert.match(frameSource, /aria-busy=\{refreshing \|\| undefined\}/);
  assert.match(attributionSource, /refreshing=\{rateLimitRefreshing \|\| usageRefreshing\}/);
  assert.match(sectionsSource, /refreshing\?: boolean/);
  assert.match(sectionsSource, /aria-busy=\{refreshing\}/);
  assert.match(sectionsSource, /data-rate-limit-refreshing=\{refreshing \? 'true' : undefined\}/);
  assert.match(sectionsSource, /account-card-quota-refresh-skeleton/);
  assert.match(styleSource, /\[data-account-card-refreshing='true'\]/);
  assert.match(styleSource, /@keyframes account-card-refresh-pulse/);
  assert.match(styleSource, /@keyframes account-card-refresh-sweep/);
  assert.doesNotMatch(sectionsSource, /repeating-linear-gradient/);
  assert.doesNotMatch(styleSource.match(/\.account-card-quota-refresh-skeleton\s*\{[\s\S]*?\n\s*\}/)?.[0] || '', /repeating-linear-gradient|animation:/);
});

test('full account cards keep unbounded traffic statistics rows without a heading', async () => {
  const cardSource = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');
  const sectionsSource = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const zhSource = await readFile(new URL('../../../locales/zh.json', import.meta.url), 'utf8');
  const enSource = await readFile(new URL('../../../locales/en.json', import.meta.url), 'utf8');

  assert.match(cardSource, /<RateLimitGuard rateLimitStatus=\{rateLimitStatus\} usageSummary=\{usageSummary\} refreshing=\{rateLimitRefreshing \|\| usageRefreshing\} t=\{t\} \/>/);
  assert.doesNotMatch(sectionsSource, /if \(rows\.length === 0\) return null/);
  assert.doesNotMatch(sectionsSource, /const headerLabel = hasRows \? 'ROUTE GUARD' : t\('accounts\.traffic_statistics'\)/);
  assert.doesNotMatch(sectionsSource, /traffic_statistics_unbounded/);
  assert.match(sectionsSource, /\{hasRows \? \(/);
  assert.match(sectionsSource, /ROUTE GUARD/);
  assert.match(sectionsSource, /data-account-card-traffic-statistics="unbounded"/);
  assert.match(sectionsSource, /<TrafficStatisticsRow/);
  assert.match(sectionsSource, /buildAccountTodayUsageTotals\(usageSummary\)/);
  assert.match(sectionsSource, /value=\{formatUsageCountMetric\(todayUsage\.requestCount\)\}/);
  assert.match(sectionsSource, /value=\{formatUsageTokenMetric\(todayUsage\.totalTokens\)\}/);
  assert.doesNotMatch(sectionsSource, /value=\{formatUsageCountMetric\(usageSummary\?\.requestCount \?\? 0\)\}/);
  assert.doesNotMatch(sectionsSource, /value=\{formatUsageTokenMetric\(usageSummary\?\.totalTokens \?\? 0\)\}/);
  assert.match(sectionsSource, /trafficBuckets\.map\(\(bucket\) => bucket\.requestCount\)/);
  assert.match(sectionsSource, /trafficBuckets\.map\(\(bucket\) => bucket\.totalTokens\)/);
  assert.match(sectionsSource, /activityPercent=\{requestActivityPercent\}/);
  assert.match(sectionsSource, /activityPercent=\{tokenActivityPercent\}/);
  assert.doesNotMatch(sectionsSource, /value === 0\) return '—'/);
  assert.match(sectionsSource, /\{value\} \/ ∞/);
  const trafficRowSource = sectionsSource.slice(sectionsSource.indexOf('function TrafficStatisticsRow'));
  assert.match(trafficRowSource, /<Progress[\s\S]*percent=\{activityPercent\}[\s\S]*railColor="var\(--gt-surface-muted\)"/);
  assert.match(trafficRowSource, /data-account-card-traffic-activity-fill/);
  assert.match(trafficRowSource, /strokeColor="color-mix\(in srgb, var\(--gt-ink-primary\) 16%, transparent\)"/);
  assert.doesNotMatch(trafficRowSource, /color-chart-blue/);
  assert.doesNotMatch(trafficRowSource, /width: `\$\{activityPercent\}%`/);
  assert.doesNotMatch(trafficRowSource, /<span className="shrink-0">0<\/span>/);
  assert.doesNotMatch(trafficRowSource, /<span className="min-w-0 truncate text-right text-\[var\(--gt-ink-primary\)\]">∞<\/span>/);
  assert.match(zhSource, /"today_requests": "今日请求"/);
  assert.match(zhSource, /"today_tokens": "今日 Token"/);
  assert.doesNotMatch(zhSource, /traffic_statistics|无限上限/);
  assert.doesNotMatch(enSource, /traffic_statistics|Unlimited/);
  assert.doesNotMatch(zhSource, /暂无路由守卫规则|route_guard_unconfigured/);
  assert.doesNotMatch(enSource, /No route guard rules|route_guard_unconfigured/);
});

test('unbounded traffic activity percent uses recent buckets without inventing a quota', () => {
  assert.equal(resolveUnboundedTrafficActivityPercent(0, [12, 8, 0]), 0);
  assert.equal(resolveUnboundedTrafficActivityPercent(59, [14, 11, 9, 6]), 100);
  assert.equal(resolveUnboundedTrafficActivityPercent(20, [100, 80, 50, 20]), 8);
  assert.equal(resolveUnboundedTrafficActivityPercent(200, []), 12);
});

test('route guard configured account cards replace the generic frame inspector label with guard info', async () => {
  const frameSource = await readFile(new URL('../components/AccountCardFrame.tsx', import.meta.url), 'utf8');
  const cardSource = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');

  assert.match(frameSource, /debugLabel\?: string/);
  assert.match(frameSource, /if \(debugLabel\)/);
  assert.match(frameSource, /data-debug=\{debugLabel\}/);
  assert.match(cardSource, /buildRouteGuardFrameDebugLabel\(rateLimitStatus\)/);
  assert.match(cardSource, /debugLabel=\{routeGuardFrameDebugLabel\}/);
  assert.match(cardSource, /ROUTE GUARD: /);
  assert.match(cardSource, /buildRateLimitGuardRows\(rateLimitStatus\)/);
});

test('account detail callers do not pass attribution keys into rate limit rules', async () => {
  const files = [
    '../components/UnifiedAccountDetailModal.tsx',
    '../../codex/components/CodexAccountDetailModal.tsx',
  ];

  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /matchKey=|rateLimitMatchKey|rateLimitStatus\?\.matchKey/);
  }
});

test('account detail modals keep rate limit CRUD injected by the page shell', async () => {
  const detailSource = await readFile(new URL('../components/UnifiedAccountDetailModal.tsx', import.meta.url), 'utf8');
  const codexDetailSource = await readFile(new URL('../../codex/components/CodexAccountDetailModal.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const codexFeatureSource = await readFile(new URL('../../codex/CodexAccountListFeature.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(detailSource, /CreateRateLimitRule|DeleteRateLimitRule|ListRateLimitRules|UpdateRateLimitRule/);
  assert.match(detailSource, /rateLimitRulesAPI\?: RateLimitRulesAPI/);
  assert.match(detailSource, /rateLimitRulesAPI=\{props\.rateLimitRulesAPI\}/);
  assert.match(featureSource, /rateLimitRulesAPI=\{[\s\S]*?previewMode\s*\?/);
  assert.doesNotMatch(codexDetailSource, /CreateRateLimitRule|DeleteRateLimitRule|ListRateLimitRules|UpdateRateLimitRule/);
  assert.match(codexDetailSource, /rateLimitRulesAPI\?: RateLimitRulesAPI/);
  assert.match(codexDetailSource, /rateLimitRulesAPI=\{rateLimitRulesAPI\}/);
  assert.match(codexFeatureSource, /rateLimitRulesAPI=\{browserMode\s*\?/);
});
