import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildPriorityUpdates,
  canToggleRotationAccountDisabled,
  buildRotationParticipationSummary,
  buildRotationQuotaSummary,
  buildRoutingDefaultLabel,
  mapOpenAICompatibleProviderToRotationAccount,
  reorderPriorityAccounts,
} from '../model/accountRotation.ts';

test('reorderPriorityAccounts moves dragged account before target account', () => {
  const accounts = [
    { id: 'api-key:1', displayName: 'One', priority: 3 },
    { id: 'api-key:2', displayName: 'Two', priority: 2 },
    { id: 'api-key:3', displayName: 'Three', priority: 1 },
  ];

  const reordered = reorderPriorityAccounts(accounts, 'api-key:3', 'api-key:1');

  assert.deepEqual(
    reordered.map((account) => account.id),
    ['api-key:3', 'api-key:1', 'api-key:2']
  );
});

test('buildPriorityUpdates assigns descending priorities from top to bottom', () => {
  const accounts = [
    { id: 'api-key:3', displayName: 'Three', priority: 1 },
    { id: 'api-key:1', displayName: 'One', priority: 3 },
    { id: 'api-key:2', displayName: 'Two', priority: 2 },
  ];

  const updates = buildPriorityUpdates(accounts);

  assert.deepEqual(updates, [
    { id: 'api-key:3', priority: 3 },
    { id: 'api-key:1', priority: 2 },
    { id: 'api-key:2', priority: 1 },
  ]);
});

test('buildPriorityUpdates omits accounts whose priority does not change', () => {
  const accounts = [
    { id: 'api-key:1', displayName: 'One', priority: 2 },
    { id: 'api-key:2', displayName: 'Two', priority: 1 },
  ];

  const updates = buildPriorityUpdates(accounts);

  assert.deepEqual(updates, []);
});

test('mapOpenAICompatibleProviderToRotationAccount preserves provider priority', () => {
  const account = mapOpenAICompatibleProviderToRotationAccount({
    name: 'deepseek',
    priority: 7,
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: 'team-a',
    apiKey: 'sk-test',
  });

  assert.deepEqual(account, {
    id: 'deepseek',
    accountKind: 'openai-compatible',
    provider: 'deepseek',
    credentialSource: 'api-key',
    displayName: '兼容 OpenAI · deepseek',
    status: 'CONFIGURED',
    priority: 7,
    disabled: false,
    name: 'deepseek',
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: 'team-a',
  });
});

test('buildRoutingDefaultLabel exposes explicit defaults for routing fields', () => {
  const t = (key) =>
    ({
      'status.default_value': '默认',
      'status.routing_strategy_round_robin': '轮询',
      'status.disabled': '关闭',
    })[key] || key;

  assert.equal(buildRoutingDefaultLabel(t, 'strategy'), '默认: 轮询');
  assert.equal(buildRoutingDefaultLabel(t, 'sessionAffinityTTL'), '默认: 1h');
  assert.equal(buildRoutingDefaultLabel(t, 'requestRetry'), '默认: 3');
  assert.equal(buildRoutingDefaultLabel(t, 'maxRetryCredentials'), '默认: 0');
  assert.equal(buildRoutingDefaultLabel(t, 'maxRetryInterval'), '默认: 30');
  assert.equal(buildRoutingDefaultLabel(t, 'sessionAffinity'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'switchProject'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'switchPreviewModel'), '默认: 关闭');
  assert.equal(buildRoutingDefaultLabel(t, 'antigravityCredits'), '默认: 关闭');
});

test('buildRotationQuotaSummary prefers the longest quota window for codex auth files', () => {
  const t = (key) =>
    ({
      'accounts.quota_remaining': '剩余',
      'accounts.quota_reset': '重置时间',
      'accounts.quota_syncing': '额度同步中...',
      'accounts.quota_unavailable': '额度暂不可用',
      'accounts.rotation_quota_not_tracked': '当前资产不跟踪额度',
    })[key] || key;

  const summary = buildRotationQuotaSummary(
    {
      id: 'auth-file:pro.json',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'pro.json',
      quotaKey: 'pro.json',
    },
    {
      status: 'success',
      quota: {
        planType: 'pro',
        windows: [
          { id: 'five-hour', label: '5H', remainingPercent: 80, resetLabel: '05/01 10:00', resetAtUnix: 1 },
          { id: 'weekly', label: '7D', remainingPercent: 25, resetLabel: '05/07 10:00', resetAtUnix: 4102444800 },
        ],
      },
    },
    t
  );

  assert.match(summary, /^7D · 剩余 25% · 重置时间 /);
});

test('buildRotationQuotaSummary returns fallback labels for loading and unsupported assets', () => {
  const t = (key) =>
    ({
      'accounts.quota_remaining': '剩余',
      'accounts.quota_reset': '重置时间',
      'accounts.quota_syncing': '额度同步中...',
      'accounts.quota_unavailable': '额度暂不可用',
      'accounts.rotation_quota_not_tracked': '当前资产不跟踪额度',
    })[key] || key;

  assert.equal(
    buildRotationQuotaSummary(
      {
        id: 'auth-file:syncing.json',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'syncing.json',
        quotaKey: 'syncing.json',
      },
      undefined,
      t
    ),
    '额度同步中...'
  );

  assert.equal(
    buildRotationQuotaSummary(
      {
        id: 'api-key:1',
        provider: 'openai',
        credentialSource: 'api-key',
        displayName: 'OPENAI API KEY',
      },
      undefined,
      t
    ),
    '当前资产不跟踪额度'
  );
});

test('buildRotationParticipationSummary marks disabled accounts as kept-but-skipped', () => {
  const t = (key) =>
    ({
      'accounts.rotation_disabled_hint': '已禁用，保留当前位置但不参与轮动',
      'accounts.quota_remaining': '剩余',
      'accounts.quota_reset': '重置时间',
      'accounts.quota_syncing': '额度同步中...',
      'accounts.quota_unavailable': '额度暂不可用',
      'accounts.rotation_quota_not_tracked': '当前资产不跟踪额度',
    })[key] || key;

  assert.equal(
    buildRotationParticipationSummary(
      {
        id: 'auth-file:disabled.json',
        provider: 'codex',
        credentialSource: 'auth-file',
        displayName: 'disabled.json',
        disabled: true,
      },
      undefined,
      t
    ),
    '已禁用，保留当前位置但不参与轮动'
  );
});

test('canToggleRotationAccountDisabled requires accountKind for account store assets', () => {
  assert.equal(
    canToggleRotationAccountDisabled({
      id: 'auth-file:demo.json',
      credentialSource: 'auth-file',
      name: 'demo.json',
    }),
    false
  );

  assert.equal(
    canToggleRotationAccountDisabled({
      id: 'codex-api-key:1',
      credentialSource: 'api-key',
      name: 'demo',
    }),
    false
  );

  assert.equal(
    canToggleRotationAccountDisabled({
      id: 'openai-compatible:deepseek',
      credentialSource: 'api-key',
      name: 'deepseek',
    }),
    false
  );

  assert.equal(
    canToggleRotationAccountDisabled({
      id: 'acct_auth_file',
      accountKind: 'auth-file',
      credentialSource: 'auth-file',
      name: 'demo.json',
    }),
    true
  );

  assert.equal(
    canToggleRotationAccountDisabled({
      id: 'acct_codex_key',
      accountKind: 'codex-api-key',
      credentialSource: 'api-key',
      name: 'demo',
    }),
    true
  );

  assert.equal(
    canToggleRotationAccountDisabled({
      id: 'acct_openai_compatible',
      accountKind: 'openai-compatible',
      credentialSource: 'api-key',
      name: 'deepseek',
    }),
    true
  );

  assert.equal(
    canToggleRotationAccountDisabled({
      id: 'auth-file:missing',
      credentialSource: 'auth-file',
      name: '',
    }),
    false
  );
});

test('RotationConfigSection uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../components/account-rotation/RotationConfigSection.tsx', import.meta.url), 'utf8');

  assert.match(source, /const rotationConfigPanelClass =/);
  assert.match(source, /const rotationConfigInputShellClass =/);
  assert.match(source, /const rotationConfigInputClass =/);
  assert.match(source, /const rotationConfigMetaClass =/);
  assert.match(source, /data-account-rotation-config-section/);
  assert.match(source, /data-account-rotation-strategy-menu/);
  assert.match(source, /data-account-rotation-toggle-grid/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-warning/);
  assert.doesNotMatch(source, /select-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--border-muted\)\]/);
  assert.doesNotMatch(source, /border-l-2 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[0\.12em\]/);
  assert.doesNotMatch(source, /tracking-\[0\.18em\]/);
});

test('RotationPriorityItem uses the quiet workspace row shell', async () => {
  const source = await readFile(new URL('../components/account-rotation/RotationPriorityItem.tsx', import.meta.url), 'utf8');

  assert.match(source, /const rotationPriorityItemShellClass =/);
  assert.match(source, /const rotationPriorityItemDraggedClass =/);
  assert.match(source, /const rotationPriorityItemActionButtonClass =/);
  assert.match(source, /const rotationPriorityItemStatusClass =/);
  assert.match(source, /data-account-rotation-priority-item/);
  assert.match(source, /data-account-rotation-drag-handle/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);

  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(source, /shadow-\[4px_4px_0_var\(--shadow-color\)\]/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /tracking-\[/);
});

test('AccountRotationModal uses the quiet workspace modal shell', async () => {
  const source = await readFile(new URL('../components/AccountRotationModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /const accountRotationModalOverlayClass =/);
  assert.match(source, /const accountRotationModalPanelClass =/);
  assert.match(source, /const accountRotationModalHeaderClass =/);
  assert.match(source, /const accountRotationModalSectionHeaderClass =/);
  assert.match(source, /const accountRotationModalButtonClass =/);
  assert.match(source, /const accountRotationModalPrimaryButtonClass =/);
  assert.match(source, /data-account-rotation-modal/);
  assert.match(source, /data-account-rotation-modal-header/);
  assert.match(source, /data-account-rotation-modal-body/);
  assert.match(source, /data-account-rotation-modal-priority/);
  assert.match(source, /data-account-rotation-modal-config/);
  assert.match(source, /data-account-rotation-modal-footer/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /btn-swiss/);
  assert.doesNotMatch(source, /border-4 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /border-b-4 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /border-2 border-\[var\(--border-color\)\]/);
  assert.doesNotMatch(source, /border-2 border-dashed/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-main\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /shadow-\[/);
});
