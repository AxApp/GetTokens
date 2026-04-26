import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountsExportFilename, resolvePastedAuthFileName } from '../model/accountTransfer.ts';

test('resolvePastedAuthFileName prefers explicit name and normalizes suffix', () => {
  assert.equal(resolvePastedAuthFileName({ name: 'custom-auth' }), 'custom-auth.json');
  assert.equal(resolvePastedAuthFileName({ name: 'custom-auth.json' }), 'custom-auth.json');
});

test('resolvePastedAuthFileName falls back to email prefix and default name', () => {
  assert.equal(resolvePastedAuthFileName({ email: 'demo@example.com' }), 'demo-auth.json');
  assert.equal(resolvePastedAuthFileName({}), 'pasted-auth.json');
});

test('buildAccountsExportFilename produces traceable json filename', () => {
  assert.equal(
    buildAccountsExportFilename(new Date('2026-04-26T10:20:30.456Z')),
    'gettokens-accounts-2026-04-26T10-20-30-456Z.json'
  );
});
