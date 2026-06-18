import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const layoutSource = readFileSync(new URL('../model/accountDetailLayout.ts', import.meta.url), 'utf8');
const sectionSource = readFileSync(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
const bindingsSource = readFileSync(new URL('../../../../wailsjs/go/main/App.d.ts', import.meta.url), 'utf8');
const modelsSource = readFileSync(new URL('../../../../wailsjs/go/models.ts', import.meta.url), 'utf8');

test('auth-file account detail includes quota reset module', () => {
  assert.match(layoutSource, /credentialSource === 'auth-file'[\s\S]*'quota'/);
  assert.match(sectionSource, /GetOpenAIQuotaResetCredit/);
  assert.match(sectionSource, /ConsumeOpenAIQuotaResetCredit/);
});

test('quota reset modal keeps confirm success and failure states in the same dialog', () => {
  assert.match(sectionSource, /data-openai-quota-reset-modal/);
  assert.match(sectionSource, /resetStatus === 'confirm'/);
  assert.match(sectionSource, /resetStatus === 'success'/);
  assert.match(sectionSource, /resetStatus === 'error'/);
  assert.match(sectionSource, /确认重置/);
  assert.match(sectionSource, /重置成功/);
  assert.match(sectionSource, /重置失败/);
});

test('quota reset modal uses dynamic gradient and glass treatment', () => {
  assert.match(sectionSource, /@keyframes openaiQuotaResetGradient/);
  assert.match(sectionSource, /data-openai-quota-reset-gradient="dynamic"/);
  assert.match(sectionSource, /animate-\[openaiQuotaResetGradient_14s_ease-in-out_infinite\]/);
  assert.match(sectionSource, /backdrop-blur-\[18px\]/);
  assert.match(sectionSource, /backdrop-blur-2xl/);
  assert.match(sectionSource, /bg-white\/35/);
});

test('quota reset consume is gated by available reset credits', () => {
  assert.match(sectionSource, /const resetCreditAvailable = resetCreditKnown && \(resetInfo\?\.availableCount \?\? 0\) > 0/);
  assert.match(sectionSource, /disabled=\{!account\.quotaKey \|\| resetQueryStatus === 'loading' \|\| !resetCreditAvailable\}/);
  assert.match(sectionSource, /没有可用重置次数，请先查询最新重置次数。/);
});

test('generated Wails surface exposes OpenAI quota reset methods and models', () => {
  assert.match(bindingsSource, /GetOpenAIQuotaResetCredit\(arg1:string\):Promise<main\.OpenAIQuotaResetCreditInfo>/);
  assert.match(bindingsSource, /ConsumeOpenAIQuotaResetCredit\(arg1:string\):Promise<main\.OpenAIQuotaResetConsumeResult>/);
  assert.match(modelsSource, /export class OpenAIQuotaResetCreditInfo/);
  assert.match(modelsSource, /export class OpenAIQuotaResetConsumeResult/);
});
