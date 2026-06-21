import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  canCommitAccountMigration,
  formatAccountMigrationKind,
  resolveAccountMigrationStepState,
  shouldCheckAccountMigration,
  shouldShowAccountMigrationGate,
} from './model.ts';

test('shouldCheckAccountMigration waits for sidecar ready and Wails bindings', () => {
  assert.equal(shouldCheckAccountMigration({ code: 'ready' }, true), true);
  assert.equal(shouldCheckAccountMigration({ code: 'running' }, true), false);
  assert.equal(shouldCheckAccountMigration({ code: 'ready' }, false), false);
});

test('shouldShowAccountMigrationGate blocks only migration and cleanup states', () => {
  assert.equal(shouldShowAccountMigrationGate({ status: 'needs-migration' }), true);
  assert.equal(shouldShowAccountMigrationGate({ status: 'ready-to-delete-legacy' }), true);
  assert.equal(shouldShowAccountMigrationGate({ status: 'ready' }), false);
  assert.equal(shouldShowAccountMigrationGate({ status: 'empty' }), false);
  assert.equal(shouldShowAccountMigrationGate({ status: 'unknown-sidecar-state' }), false);
  assert.equal(shouldShowAccountMigrationGate(null), false);
});

test('canCommitAccountMigration requires candidates and idle state', () => {
  assert.equal(canCommitAccountMigration(null, false), false);
  assert.equal(canCommitAccountMigration({ status: 'needs-migration', candidateCount: 2 }, false), true);
  assert.equal(canCommitAccountMigration({ status: 'needs-migration', candidateCount: 0 }, false), false);
  assert.equal(canCommitAccountMigration({ status: 'needs-migration' }, false), false);
  assert.equal(canCommitAccountMigration({ status: 'ready-to-delete-legacy', candidateCount: 2 }, false), true);
  assert.equal(canCommitAccountMigration({ status: 'ready-to-delete-legacy', accountCount: 1, candidateCount: 11 }, false), true);
  assert.equal(canCommitAccountMigration({ status: 'ready-to-delete-legacy', accountCount: 1, candidateCount: 0 }, false), false);
  assert.equal(canCommitAccountMigration({ status: 'ready', accountCount: 12, candidateCount: 0 }, false), false);
  assert.equal(canCommitAccountMigration({ status: 'empty', accountCount: 0, candidateCount: 0 }, false), false);
  assert.equal(canCommitAccountMigration({ status: 'unknown-sidecar-state', candidateCount: 3 }, false), false);
  assert.equal(canCommitAccountMigration({ status: 'needs-migration', candidateCount: 2 }, true), false);
});

test('resolveAccountMigrationStepState maps preview status to the three-step gate', () => {
  assert.deepEqual(resolveAccountMigrationStepState(null), { inspect: 'active', commit: 'pending', cleanup: 'pending' });
  assert.deepEqual(resolveAccountMigrationStepState({ status: 'needs-migration' }), { inspect: 'done', commit: 'active', cleanup: 'pending' });
  assert.deepEqual(resolveAccountMigrationStepState({ status: 'ready-to-delete-legacy' }), { inspect: 'done', commit: 'active', cleanup: 'pending' });
  assert.deepEqual(resolveAccountMigrationStepState({ status: 'ready' }), { inspect: 'done', commit: 'done', cleanup: 'done' });
  assert.deepEqual(resolveAccountMigrationStepState({ status: 'empty' }), { inspect: 'done', commit: 'done', cleanup: 'done' });
});

test('formatAccountMigrationKind provides operator-facing labels', () => {
  assert.equal(formatAccountMigrationKind('auth-file'), 'Auth File');
  assert.equal(formatAccountMigrationKind('codex-api-key'), 'Codex API Key');
  assert.equal(formatAccountMigrationKind('openai-compatible'), 'OpenAI Compatible');
  assert.equal(formatAccountMigrationKind('custom'), 'custom');
  assert.equal(formatAccountMigrationKind(''), 'Unknown');
});

test('AccountMigrationGate uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('./AccountMigrationGate.tsx', import.meta.url), 'utf8');

  assert.match(source, /const accountMigrationGateShellClass =/);
  assert.match(source, /const accountMigrationGateHeaderClass =/);
  assert.match(source, /const accountMigrationGatePanelClass =/);
  assert.match(source, /const accountMigrationGateButtonClass =/);
  assert.match(source, /const accountMigrationGatePrimaryButtonClass =/);
  assert.match(source, /const accountMigrationGateNoticeToneClass =/);
  assert.match(source, /data-account-migration-loading/);
  assert.match(source, /data-account-migration-gate/);
  assert.match(source, /data-account-migration-header/);
  assert.match(source, /data-account-migration-summary-panel/);
  assert.match(source, /data-account-migration-kind-list/);
  assert.match(source, /data-account-migration-stats/);
  assert.match(source, /data-account-migration-notices/);
  assert.match(source, /data-account-migration-footer/);
  assert.match(source, /--gt-surface-canvas/);
  assert.match(source, /--gt-surface-muted/);
  assert.match(source, /--gt-border-subtle/);
  assert.match(source, /--gt-status-success/);
  assert.match(source, /--gt-status-warning/);
  assert.match(source, /--gt-status-danger/);
  assert.doesNotMatch(source, /btn-swiss|input-swiss|select-swiss|card-swiss/);
  assert.doesNotMatch(source, /border-2|border-t-2|border-b-2|border-b-4|border-t-4/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-(main|surface)\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bg-surface\)\]/);
  assert.doesNotMatch(source, /color-status-/);
  assert.doesNotMatch(source, /font-(?:medium|bold|extrabold|black)/);
  assert.doesNotMatch(source, /uppercase/);
  assert.doesNotMatch(source, /shadow-hard|shadow-\[/);
});
