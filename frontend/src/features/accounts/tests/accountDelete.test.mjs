import test from 'node:test';
import assert from 'node:assert/strict';

import {
  removeDeletedAPIKeyRecord,
  removeDeletedAuthFile,
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
