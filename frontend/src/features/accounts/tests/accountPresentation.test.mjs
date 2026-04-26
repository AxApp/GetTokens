import test from 'node:test';
import assert from 'node:assert/strict';

import { mapAuthFileToRecord, resolveAccountFailureReason } from '../model/accountPresentation.ts';

test('mapAuthFileToRecord keeps auth file status message', () => {
  const record = mapAuthFileToRecord({
    name: 'broken.json',
    provider: 'codex',
    status: 'error',
    statusMessage: 'refresh token expired',
  });

  assert.equal(record.status, 'ERROR');
  assert.equal(record.statusMessage, 'refresh token expired');
});

test('resolveAccountFailureReason only returns message for failed statuses', () => {
  assert.equal(
    resolveAccountFailureReason({
      id: 'auth-file:broken',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'broken.json',
      status: 'ERROR',
      statusMessage: 'refresh token expired',
    }),
    'refresh token expired'
  );

  assert.equal(
    resolveAccountFailureReason({
      id: 'auth-file:healthy',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'healthy.json',
      status: 'ACTIVE',
      statusMessage: 'should stay hidden',
    }),
    ''
  );
});
