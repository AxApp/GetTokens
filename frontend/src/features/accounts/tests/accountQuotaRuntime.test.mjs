import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildQuotaDisplay,
  formatQuotaRuntimeTimestampDisplay,
  formatQuotaWindowUsageLabel,
  resolveQuotaWindowUsagePercent,
} from '../model/accountQuota.ts';

const quotaCapableAccount = {
  id: 'acct_codex_001',
  accountKind: 'codex-api-key',
  provider: 'codex',
  credentialSource: 'api-key',
  displayName: 'Codex Key',
  status: 'configured',
  quotaEnabled: true,
  quotaCurl: 'curl https://quota.example.test',
  quotaKey: 'acct_codex_001',
};

test('buildQuotaDisplay preserves sidecar runtime refresh timestamps', () => {
  const display = buildQuotaDisplay(quotaCapableAccount, {
    status: 'success',
    quota: {
      planType: 'pro',
      updatedAt: '2026-06-10T16:26:50Z',
      lastEvaluatedAt: '2026-06-10T16:26:51Z',
      windows: [
        {
          id: 'five-hour',
          label: '5H',
          remainingPercent: 40,
          resetLabel: '06/11 00:34',
          resetAtUnix: 1781109273,
        },
      ],
    },
  });

  assert.equal(display.status, 'success');
  assert.equal(display.updatedAt, '2026-06-10T16:26:50Z');
  assert.equal(display.lastEvaluatedAt, '2026-06-10T16:26:51Z');
});

test('buildQuotaDisplay reads snake case quota runtime states from Wails status APIs', () => {
  const display = buildQuotaDisplay(quotaCapableAccount, {
    status: 'success',
    quota: {
      account_key: 'acct_codex_001',
      source: 'codex-api-key-quota-curl',
      status: 'success',
      plan_type: 'pro',
      updated_at: '2026-06-10T16:27:38Z',
      last_evaluated_at: '2026-06-10T16:27:39Z',
      windows: [
        {
          id: 'five-hour',
          label: '5H',
          remaining_percent: 40,
          used_tokens: 24_000_000,
          limit_tokens: 60_000_000,
          reset_label: '06/11 00:34',
          reset_at_unix: 1781109273,
        },
        {
          id: 'weekly',
          label: '7D',
          remaining_percent: 14,
          reset_label: '06/11 08:41',
        },
      ],
      blocked: false,
      block_reason: '',
      sources: [],
    },
  });

  assert.equal(display.status, 'success');
  assert.equal(display.planType, 'pro');
  assert.equal(display.updatedAt, '2026-06-10T16:27:38Z');
  assert.equal(display.lastEvaluatedAt, '2026-06-10T16:27:39Z');
  assert.deepEqual(display.windows.map((window) => ({
    id: window.id,
    label: window.label,
    remainingPercent: window.remainingPercent,
    usedTokens: window.usedTokens,
    limitTokens: window.limitTokens,
    resetLabel: window.resetLabel,
    resetAtUnix: window.resetAtUnix,
  })), [
    {
      id: 'five-hour',
      label: '5H',
      remainingPercent: 40,
      usedTokens: 24000000,
      limitTokens: 60000000,
      resetLabel: '06/11 00:34',
      resetAtUnix: 1781109273,
    },
    {
      id: 'weekly',
      label: '7D',
      remainingPercent: 14,
      usedTokens: undefined,
      limitTokens: undefined,
      resetLabel: '06/11 08:41',
      resetAtUnix: undefined,
    },
  ]);
});

test('quota percent progress uses used ratio while preserving remaining quota semantics', () => {
  const display = buildQuotaDisplay(quotaCapableAccount, {
    status: 'success',
    quota: {
      account_key: 'acct_xiaomi_001',
      status: 'success',
      plan_type: 'xiaomimimo',
      windows: [
        {
          id: 'mimo-plan-total-token',
          label: 'PLAN',
          remaining_percent: 47,
          used_tokens: 20_037_365_787,
          limit_tokens: 38_000_000_000,
          remaining_tokens: 17_962_634_213,
          reset_label: '-',
        },
      ],
    },
  });

  assert.equal(display.status, 'success');
  const [window] = display.windows;
  assert.equal(window.remainingPercent, 47);
  assert.equal(window.usedLabel, '53%');
  assert.equal(resolveQuotaWindowUsagePercent(window), 53);
  assert.equal(formatQuotaWindowUsageLabel(window), '53%');
});

test('quota bars keep runtime refresh timestamps out of compact account cards', async () => {
  const source = await readFile(new URL('../components/CardSections.tsx', import.meta.url), 'utf8');
  const zhSource = await readFile(new URL('../../../locales/zh.json', import.meta.url), 'utf8');
  const enSource = await readFile(new URL('../../../locales/en.json', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /formatQuotaRuntimeTimestampDisplay\(quotaDisplay\.lastEvaluatedAt \|\| quotaDisplay\.updatedAt\)/);
  assert.doesNotMatch(source, /data-account-card-quota-updated-at/);
  assert.doesNotMatch(source, /t\('accounts\.quota_last_updated'\)/);
  assert.doesNotMatch(zhSource, /"quota_last_updated": "最近刷新"/);
  assert.doesNotMatch(enSource, /"quota_last_updated": "Last updated"/);
});

test('formatQuotaRuntimeTimestampDisplay keeps invalid runtime values visible', () => {
  assert.equal(formatQuotaRuntimeTimestampDisplay(''), '');
  assert.equal(formatQuotaRuntimeTimestampDisplay('upstream-cache-hit'), 'upstream-cache-hit');
  assert.match(formatQuotaRuntimeTimestampDisplay('2026-06-10T16:26:50Z'), /^\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
});
