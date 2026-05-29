import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canCommitAccountMigration,
  canDeleteLegacyAccountSources,
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
  assert.equal(shouldShowAccountMigrationGate(null), false);
});

test('canCommitAccountMigration requires candidates and idle state', () => {
  assert.equal(canCommitAccountMigration({ status: 'needs-migration', candidateCount: 2 }, false), true);
  assert.equal(canCommitAccountMigration({ status: 'needs-migration', candidateCount: 0 }, false), false);
  assert.equal(canCommitAccountMigration({ status: 'ready-to-delete-legacy', candidateCount: 2 }, false), true);
  assert.equal(canCommitAccountMigration({ status: 'needs-migration', candidateCount: 2 }, true), false);
});

test('canDeleteLegacyAccountSources requires migrated accounts, candidates and idle state', () => {
  assert.equal(canDeleteLegacyAccountSources({ status: 'ready-to-delete-legacy', accountCount: 2, candidateCount: 3 }, false), true);
  assert.equal(canDeleteLegacyAccountSources({ status: 'ready-to-delete-legacy', accountCount: 0, candidateCount: 3 }, false), false);
  assert.equal(canDeleteLegacyAccountSources({ status: 'ready-to-delete-legacy', accountCount: 2, candidateCount: 0 }, false), false);
  assert.equal(canDeleteLegacyAccountSources({ status: 'ready-to-delete-legacy', accountCount: 2, candidateCount: 3 }, true), false);
});

test('resolveAccountMigrationStepState maps preview status to the three-step gate', () => {
  assert.deepEqual(resolveAccountMigrationStepState(null), { inspect: 'active', commit: 'pending', cleanup: 'pending' });
  assert.deepEqual(resolveAccountMigrationStepState({ status: 'needs-migration' }), { inspect: 'done', commit: 'active', cleanup: 'pending' });
  assert.deepEqual(resolveAccountMigrationStepState({ status: 'ready-to-delete-legacy' }), { inspect: 'done', commit: 'active', cleanup: 'pending' });
  assert.deepEqual(resolveAccountMigrationStepState({ status: 'ready' }), { inspect: 'done', commit: 'done', cleanup: 'done' });
});

test('formatAccountMigrationKind provides operator-facing labels', () => {
  assert.equal(formatAccountMigrationKind('auth-file'), 'Auth File');
  assert.equal(formatAccountMigrationKind('codex-api-key'), 'Codex API Key');
  assert.equal(formatAccountMigrationKind('openai-compatible'), 'OpenAI Compatible');
  assert.equal(formatAccountMigrationKind('custom'), 'custom');
});
