import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('rate limit model is keyed only by accountKey', async () => {
  const source = await readFile(new URL('../model/rateLimit.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /matchKey|MatchKey|match_key/);
  assert.match(source, /accountKey: string/);
});

test('rate limit rules section edits account-card rules without matchKey fallback', async () => {
  const source = await readFile(new URL('../components/RateLimitRulesSection.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /matchKey|MatchKey|match_key/);
  assert.doesNotMatch(source, /ROW_GRID_CLASS/);
  assert.doesNotMatch(source, /overflow-x-auto/);
  assert.doesNotMatch(source, /min-w-\[76rem\]/);
  assert.doesNotMatch(source, /ruleTexts/);
  assert.doesNotMatch(source, /rules\.slice\(0, 3\)/);
  assert.match(source, /rateLimitViewMode/);
  assert.match(source, /data-rate-limit-view-mode="summary"/);
  assert.match(source, /data-rate-limit-view-mode="config"/);
  assert.match(source, /rate_limit_summary_rules/);
  assert.match(source, /rate_limit_summary_active/);
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
