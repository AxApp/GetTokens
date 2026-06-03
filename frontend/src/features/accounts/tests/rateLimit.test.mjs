import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildRateLimitGuardRows } from '../model/rateLimit.ts';

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


test('rate limit guard rows use the same stacked progress layout as quota rows', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /account-card-rate-limit-heading flex min-w-0 items-baseline justify-between gap-2/);
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
  assert.doesNotMatch(source, /RATE_LIMIT_RULE_SURFACE_CLASS = 'bg-\[var\(--bg-surface\)\]\/35 px-3 py-3'/);
  assert.doesNotMatch(source, /formatRateLimitMetric\(ruleState\.currentUsage\) \/ \$\{formatRateLimitMetric/);
  assert.match(source, /RATE_LIMIT_RULE_SURFACE_CLASS/);
  assert.match(source, /RATE_LIMIT_RULE_STACK_CLASS/);
  assert.match(source, /RATE_LIMIT_RULE_LIST_CLASS/);
  assert.match(source, /density="dense"/);
  assert.match(source, /rate_limit_add_rule/);
  assert.match(source, /editingRuleIndex/);
  assert.match(source, /openRuleMenuIndex/);
  assert.match(source, /finishEditingRateLimitRule/);
  assert.match(source, /type="checkbox"/);
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



test('compact account cards still render route guard module when rules are configured', async () => {
  const source = await readFile(new URL('../components/AttributionCard.tsx', import.meta.url), 'utf8');

  assert.match(source, /const showCompactRouteGuard = density === 'compact' && hasRouteGuardRows/);
  assert.match(source, /\{showCompactRouteGuard \? <RateLimitGuard rateLimitStatus=\{rateLimitStatus\} \/> : null\}/);
  assert.match(source, /const hasRouteGuardRows = buildRateLimitGuardRows\(rateLimitStatus\)\.length > 0/);
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
    '../components/ApiKeyDetailModal.tsx',
    '../components/OpenAICompatibleDetailModal.tsx',
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
  assert.match(detailSource, /rateLimitRulesAPI=\{rateLimitRulesAPI\}/);
  assert.match(featureSource, /rateLimitRulesAPI=\{[\s\S]*?previewMode\s*\?/);
  assert.doesNotMatch(codexDetailSource, /CreateRateLimitRule|DeleteRateLimitRule|ListRateLimitRules|UpdateRateLimitRule/);
  assert.match(codexDetailSource, /rateLimitRulesAPI\?: RateLimitRulesAPI/);
  assert.match(codexDetailSource, /rateLimitRulesAPI=\{rateLimitRulesAPI\}/);
  assert.match(codexFeatureSource, /rateLimitRulesAPI=\{browserMode\s*\?/);
});
