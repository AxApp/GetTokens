import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_CARD_IMPORT_SCHEMA,
  buildAccountsExportFilename,
  parseAccountCardImportPayload,
  resolvePastedAuthFileName,
} from '../model/accountTransfer.ts';
import { buildAccountCardContentText } from '../model/accountCardActions.ts';

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

test('parseAccountCardImportPayload reads copied codex api key cards', () => {
  assert.deepEqual(
    parseAccountCardImportPayload({
      schema: ACCOUNT_CARD_IMPORT_SCHEMA,
      credentialSource: 'api-key',
      account: { displayName: 'Primary Key' },
      codexAPIKey: {
        apiKey: 'sk-test-1111',
        baseUrl: 'https://api.openai.com/v1',
        prefix: 'team-a',
      },
    }),
    {
      type: 'codex-api-key',
      label: 'Primary Key',
      apiKey: 'sk-test-1111',
      baseUrl: 'https://api.openai.com/v1',
      prefix: 'team-a',
    },
  );
});

test('parseAccountCardImportPayload reads copied auth file cards', () => {
  assert.deepEqual(
    parseAccountCardImportPayload({
      schema: ACCOUNT_CARD_IMPORT_SCHEMA,
      credentialSource: 'auth-file',
      authFile: {
        name: 'codex-auth',
        content: { type: 'codex', access_token: 'token' },
      },
    }),
    {
      type: 'auth-file',
      name: 'codex-auth.json',
      content: '{\n  "type": "codex",\n  "access_token": "token"\n}',
    },
  );
});

test('copied codex api key card content can be pasted as an import payload', () => {
  const copiedText = buildAccountCardContentText({
    id: 'codex-api-key:stable-001',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Primary API Key',
    status: 'configured',
    apiKey: 'sk-test-1111',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'team-a',
  });

  assert.deepEqual(parseAccountCardImportPayload(JSON.parse(copiedText)), {
    type: 'codex-api-key',
    label: 'Primary API Key',
    apiKey: 'sk-test-1111',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'team-a',
  });
});

test('copied auth file card content can be pasted as an import payload', () => {
  const copiedText = buildAccountCardContentText(
    {
      id: 'auth-file:codex-auth.json',
      provider: 'codex',
      credentialSource: 'auth-file',
      displayName: 'codex-auth.json',
      status: 'configured',
      name: 'codex-auth.json',
    },
    { type: 'codex', access_token: 'token' },
  );

  assert.deepEqual(parseAccountCardImportPayload(JSON.parse(copiedText)), {
    type: 'auth-file',
    name: 'codex-auth.json',
    content: '{\n  "type": "codex",\n  "access_token": "token"\n}',
  });
});
