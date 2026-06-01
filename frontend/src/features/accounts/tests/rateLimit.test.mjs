import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
  assert.match(featureSource, /rateLimitRulesAPI=\{previewMode\s*\?/);
  assert.doesNotMatch(codexDetailSource, /CreateRateLimitRule|DeleteRateLimitRule|ListRateLimitRules|UpdateRateLimitRule/);
  assert.match(codexDetailSource, /rateLimitRulesAPI\?: RateLimitRulesAPI/);
  assert.match(codexDetailSource, /rateLimitRulesAPI=\{rateLimitRulesAPI\}/);
  assert.match(codexFeatureSource, /rateLimitRulesAPI=\{browserMode\s*\?/);
});
