import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAccountDisabledChangeToRecord,
  normalizeAccountDisabledChange,
  readAccountDisabledOverrides,
  rememberAccountDisabledChange,
} from '../model/accountDisabledSync.ts';

test('normalizeAccountDisabledChange accepts only canonical account store ids', () => {
  assert.deepEqual(normalizeAccountDisabledChange({ id: 'acct_00000000-0000-4000-8000-000000000001', disabled: true }), {
    id: 'acct_00000000-0000-4000-8000-000000000001',
    disabled: true,
  });
  assert.equal(normalizeAccountDisabledChange({ id: 'auth-file:codex.json', disabled: true }), null);
  assert.equal(normalizeAccountDisabledChange({ id: 'codex-api-key:stable', disabled: false }), null);
  assert.equal(normalizeAccountDisabledChange({ id: 'openai-compatible:deepseek', disabled: true }), null);
  assert.equal(normalizeAccountDisabledChange({ id: 'auth-file:codex.json', disabled: 'false' }), null);
  assert.equal(normalizeAccountDisabledChange({ id: 'auth-file:codex.json', disabled: 1 }), null);
  assert.equal(normalizeAccountDisabledChange({ id: 'codex.json', disabled: true }), null);
  assert.equal(normalizeAccountDisabledChange({ id: 'openai:legacy', disabled: true }), null);
});

test('applyAccountDisabledChangeToRecord patches only the matching account snapshot', () => {
  const account = {
    id: 'auth-file:codex.json',
    provider: 'codex',
    credentialSource: 'auth-file',
    displayName: 'codex.json',
    status: 'ACTIVE',
  };

  assert.equal(applyAccountDisabledChangeToRecord(account, { id: 'auth-file:other.json', disabled: true }), account);
  assert.deepEqual(applyAccountDisabledChangeToRecord(account, { id: 'auth-file:codex.json', disabled: true }), {
    ...account,
    disabled: true,
    status: 'disabled',
  });
  assert.deepEqual(
    applyAccountDisabledChangeToRecord(
      { ...account, disabled: true, status: 'disabled' },
      { id: 'auth-file:codex.json', disabled: false },
    ),
    {
      ...account,
      disabled: false,
      status: 'configured',
    },
  );
});

test('account disabled overrides persist canonical ids for browser preview reloads', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
  };

  rememberAccountDisabledChange({ id: 'codex-api-key:stable', disabled: true }, storage);
  rememberAccountDisabledChange({ id: 'legacy-stable', disabled: true }, storage);
  rememberAccountDisabledChange({ id: 'openai-compatible:deepseek', disabled: false }, storage);
  rememberAccountDisabledChange({ id: 'acct_00000000-0000-4000-8000-000000000001', disabled: true }, storage);

  assert.deepEqual(readAccountDisabledOverrides(storage), {
    'acct_00000000-0000-4000-8000-000000000001': true,
  });
});
