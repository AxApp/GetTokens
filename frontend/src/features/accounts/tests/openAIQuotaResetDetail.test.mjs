import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const layoutSource = readFileSync(new URL('../model/accountDetailLayout.ts', import.meta.url), 'utf8');
const sectionSource = readFileSync(new URL('../components/AccountDetailSections.tsx', import.meta.url), 'utf8');
const bindingsSource = readFileSync(new URL('../../../../wailsjs/go/main/App.d.ts', import.meta.url), 'utf8');
const modelsSource = readFileSync(new URL('../../../../wailsjs/go/models.ts', import.meta.url), 'utf8');

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

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

test('quota reset modal uses the quiet workspace shell without gradient glass', () => {
  assert.match(sectionSource, /const accountDetailQuotaResetModalOverlayClass =/);
  assert.match(sectionSource, /const accountDetailQuotaResetModalPanelClass =/);
  assert.match(sectionSource, /const accountDetailQuotaResetHeroClass =/);
  assert.doesNotMatch(sectionSource, /@keyframes openaiQuotaResetGradient/);
  assert.doesNotMatch(sectionSource, /data-openai-quota-reset-gradient="dynamic"/);
  assert.doesNotMatch(sectionSource, /radial-gradient|linear-gradient\(/);
  assert.doesNotMatch(sectionSource, /backdrop-blur-\[18px\]|backdrop-blur-2xl|backdrop-blur-xl/);
});

test('quota reset modal uses AntD dialog controls', () => {
  const modalSource = sourceBlock(
    sectionSource,
    'function OpenAIQuotaResetConfirmationModal',
    'function formatUnixSecondsLabel',
  );

  assert.match(sectionSource, /const accountDetailQuotaResetModalPanelClass =/);
  assert.match(sectionSource, /import \{ .*Button, Input, Select, Tooltip.*\} from 'antd';/);
  assert.match(modalSource, /className=\{accountDetailQuotaResetModalPanelClass\}/);
  assert.match(modalSource, /<Button[\s\S]*type="primary"/);
  assert.match(sectionSource, /--gt-surface-canvas/);
  assert.match(sectionSource, /--gt-surface-muted/);
  assert.match(sectionSource, /--gt-border-subtle/);
  assert.match(sectionSource, /--gt-status-danger/);
  assert.doesNotMatch(modalSource, /border-2/);
  assert.doesNotMatch(modalSource, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(modalSource, /uppercase/);
  assert.doesNotMatch(modalSource, /tracking-\[0\.08em\]|tracking-tight/);
  assert.doesNotMatch(modalSource, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(modalSource, /color-status-/);
  assert.doesNotMatch(sectionSource, /shadow-\[|shadow-xl/);
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
