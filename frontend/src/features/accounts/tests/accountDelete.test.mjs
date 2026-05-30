import test from 'node:test';
import assert from 'node:assert/strict';

import {
  removeDeletedAPIKeyRecord,
  removeDeletedAuthFile,
  resolveAccountDeleteRequest,
  shouldClearDeletedSelectedAccount,
} from '../model/accountDelete.ts';

test('removeDeletedAuthFile removes only the deleted auth-file asset', () => {
  const files = [
    { name: 'codex-a.json' },
    { name: 'codex-b.json' },
  ];

  assert.deepEqual(
    removeDeletedAuthFile(files, {
      id: 'auth-file:codex-a.json',
      credentialSource: 'auth-file',
      name: 'codex-a.json',
    }),
    [{ name: 'codex-b.json' }]
  );
});

test('removeDeletedAPIKeyRecord removes only the deleted api-key asset', () => {
  const records = [
    { id: 'api-key:a', credentialSource: 'api-key' },
    { id: 'api-key:b', credentialSource: 'api-key' },
  ];

  assert.deepEqual(
    removeDeletedAPIKeyRecord(records, {
      id: 'api-key:a',
      credentialSource: 'api-key',
    }),
    [{ id: 'api-key:b', credentialSource: 'api-key' }]
  );
});

test('resolveAccountDeleteRequest does not infer openai-compatible providers from legacy id prefix', () => {
  assert.deepEqual(
    resolveAccountDeleteRequest({
      id: 'openai-compatible:deepseek',
      provider: 'deepseek',
      credentialSource: 'api-key',
    }),
    { type: 'codex-api-key', id: 'openai-compatible:deepseek' }
  );
});

test('resolveAccountDeleteRequest routes unified openai-compatible accounts by account kind', () => {
  assert.deepEqual(
    resolveAccountDeleteRequest({
      id: 'acct_00000000-0000-4000-8000-000000000001',
      accountKind: 'openai-compatible',
      provider: 'deepseek',
      credentialSource: 'api-key',
    }),
    { type: 'openai-compatible-provider', name: 'acct_00000000-0000-4000-8000-000000000001' }
  );
});

test('resolveAccountDeleteRequest keeps codex api key assets on codex delete path', () => {
  assert.deepEqual(
    resolveAccountDeleteRequest({
      id: 'codex-api-key:stable-001',
      provider: 'openai',
      credentialSource: 'api-key',
    }),
    { type: 'codex-api-key', id: 'codex-api-key:stable-001' }
  );
});

test('shouldClearDeletedSelectedAccount clears matching selected account only', () => {
  const selected = {
    id: 'auth-file:codex-a.json',
    credentialSource: 'auth-file',
    name: 'codex-a.json',
  };

  assert.equal(
    shouldClearDeletedSelectedAccount(selected, {
      id: 'auth-file:codex-a.json',
      credentialSource: 'auth-file',
      name: 'codex-a.json',
    }),
    true
  );
  assert.equal(
    shouldClearDeletedSelectedAccount(selected, {
      id: 'auth-file:codex-b.json',
      credentialSource: 'auth-file',
      name: 'codex-b.json',
    }),
    false
  );
});
