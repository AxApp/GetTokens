import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, zipSync, strToU8 } from 'fflate';

import {
  ACCOUNT_CARD_IMPORT_SCHEMA,
  ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT,
  buildAccountsExportFilename,
  parseAccountCardImportPayload,
  parseAccountImportPayloads,
  readArchiveJSONFiles,
  readUploadFiles,
  resolveAccountImportQueueRenderWindow,
  resolveAccountImportPayloadPreview,
  resolveCopiedAuthFileName,
  resolveCopiedOpenAICompatibleProviderName,
  resolveNumberedDuplicateTitle,
  resolvePastedAuthFileName,
  validateAccountImportPayloadItem,
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
    id: 'acct_stable_001',
    accountKind: 'codex-api-key',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Primary API Key',
    status: 'configured',
    apiKey: 'sk-test-1111',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'team-a',
    supportedFormats: ['openai_chat', 'openai_responses'],
    formatBaseUrls: {
      openai_chat: 'https://relay.example.com/chat/v1',
      openai_responses: 'https://relay.example.com/responses/v1',
    },
  });

  assert.deepEqual(parseAccountCardImportPayload(JSON.parse(copiedText)), {
    type: 'codex-api-key',
    label: 'Primary API Key',
    apiKey: 'sk-test-1111',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'team-a',
    supportedFormats: ['openai_chat', 'openai_responses'],
    formatBaseUrls: {
      openai_chat: 'https://relay.example.com/chat/v1',
      openai_responses: 'https://relay.example.com/responses/v1',
    },
  });
});

test('copied auth file card content can be pasted as an import payload', () => {
  const copiedText = buildAccountCardContentText(
    {
      id: 'acct_codex_auth',
      accountKind: 'auth-file',
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

test('copied openai-compatible card content can be pasted as an import payload', () => {
  const copiedText = buildAccountCardContentText({
    id: 'acct_deepseek',
    accountKind: 'openai-compatible',
    provider: 'deepseek',
    credentialSource: 'api-key',
    displayName: 'OPENAI-COMPATIBLE · DEEPSEEK',
    status: 'configured',
    apiKey: 'sk-test-deepseek',
    apiKeys: ['sk-test-deepseek', 'sk-test-backup'],
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: 'ds',
    proxyUrl: 'socks5://127.0.0.1:7890',
    headers: { 'X-Provider': 'deepseek' },
    models: [{ name: 'deepseek-chat', alias: 'codex-deepseek' }],
    supportedFormats: ['openai_chat', 'openai_responses', 'anthropic'],
    formatBaseUrls: {
      openai_chat: 'https://relay.example.com/openai/v1',
      openai_responses: 'https://relay.example.com/codex/v1',
      anthropic: 'https://relay.example.com/anthropic',
    },
  });

  assert.deepEqual(parseAccountCardImportPayload(JSON.parse(copiedText)), {
    type: 'openai-compatible',
    name: 'deepseek',
    apiKey: 'sk-test-deepseek',
    apiKeys: ['sk-test-deepseek', 'sk-test-backup'],
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: 'ds',
    proxyUrl: 'socks5://127.0.0.1:7890',
    headers: { 'X-Provider': 'deepseek' },
    models: [{ name: 'deepseek-chat', alias: 'codex-deepseek' }],
    supportedFormats: ['openai_chat', 'openai_responses', 'anthropic'],
    formatBaseUrls: {
      openai_chat: 'https://relay.example.com/openai/v1',
      openai_responses: 'https://relay.example.com/codex/v1',
      anthropic: 'https://relay.example.com/anthropic',
    },
  });
});

test('parseAccountImportPayloads keeps single copied account-card payload compatibility', () => {
  assert.deepEqual(
    parseAccountImportPayloads({
      schema: ACCOUNT_CARD_IMPORT_SCHEMA,
      credentialSource: 'api-key',
      account: { displayName: 'Primary Key' },
      codexAPIKey: {
        apiKey: 'sk-test-1111',
        baseUrl: 'https://api.openai.com/v1',
      },
    }),
    [
      {
        type: 'codex-api-key',
        label: 'Primary Key',
        apiKey: 'sk-test-1111',
        baseUrl: 'https://api.openai.com/v1',
        prefix: '',
      },
    ],
  );
});

test('parseAccountImportPayloads splits pasted json arrays into import candidates', () => {
  assert.deepEqual(
    parseAccountImportPayloads([
      {
        schema: ACCOUNT_CARD_IMPORT_SCHEMA,
        credentialSource: 'auth-file',
        authFile: {
          name: 'copied-auth',
          content: { type: 'codex', access_token: 'copied-token' },
        },
      },
      {
        name: 'raw-auth',
        type: 'codex',
        access_token: 'raw-token',
      },
    ]),
    [
      {
        type: 'auth-file',
        name: 'copied-auth.json',
        content: '{\n  "type": "codex",\n  "access_token": "copied-token"\n}',
      },
      {
        type: 'auth-file',
        name: 'raw-auth.json',
        content: '{\n  "name": "raw-auth",\n  "type": "codex",\n  "access_token": "raw-token"\n}',
      },
    ],
  );
});

test('parseAccountImportPayloads rejects malformed copied account-card payloads', () => {
  assert.equal(
    parseAccountImportPayloads({
      schema: ACCOUNT_CARD_IMPORT_SCHEMA,
      credentialSource: 'api-key',
      codexAPIKey: {
        apiKey: '',
        baseUrl: '',
      },
    }),
    null,
  );
});

test('resolveAccountImportPayloadPreview shows decoded upload file content', () => {
  const payload = {
    type: 'upload-file',
    name: 'chatgpt-session.json',
    contentBase64: Buffer.from(
      JSON.stringify(
        {
          type: 'codex',
          email: 'team-codex@example.com',
          access_token: 'preview-access-token',
        },
        null,
        2,
      ),
      'utf8',
    ).toString('base64'),
  };

  const preview = resolveAccountImportPayloadPreview(payload);
  assert.match(preview, /"email": "team-codex@example.com"/);
  assert.match(preview, /"access_token": "\[REDACTED\]"/);
  assert.doesNotMatch(preview, /preview-access-token/);
});

test('resolveAccountImportPayloadPreview shows parsed card payload content', () => {
  const preview = resolveAccountImportPayloadPreview({
    type: 'openai-compatible',
    name: 'deepseek',
    apiKey: 'sk-preview-deepseek',
    apiKeys: ['sk-preview-deepseek', 'sk-preview-backup'],
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: '',
    proxyUrl: '',
    headers: {},
    models: [{ name: 'deepseek-chat', alias: 'codex-deepseek' }],
  });

  assert.match(preview, /"baseUrl": "https:\/\/api.deepseek.com\/v1"/);
  assert.match(preview, /"apiKey": "\[REDACTED\]"/);
  assert.doesNotMatch(preview, /sk-preview-deepseek/);
});

test('readArchiveJSONFiles parses json files inside zip archives', async () => {
  const archive = zipSync({
    'auth/codex-auth.json': strToU8('{ "type": "codex", "access_token": "zip-token" }'),
    'notes/readme.txt': strToU8('not imported'),
    'nested/provider.JSON': strToU8('{ "schema": "gettokens.account-card.v1" }'),
  });

  const payloads = await readArchiveJSONFiles(archive, 'accounts.zip');

  assert.deepEqual(payloads, [
    {
      type: 'auth-file',
      name: 'pasted-auth.json',
      content: '{\n  "type": "codex",\n  "access_token": "zip-token"\n}',
    },
    {
      type: 'upload-file',
      name: 'accounts.zip:nested/provider.JSON',
      contentBase64: Buffer.from('{ "schema": "gettokens.account-card.v1" }', 'utf8').toString('base64'),
    },
  ]);
});

test('readArchiveJSONFiles parses json files inside tar archives', async () => {
  const archive = buildTarArchive([
    ['auth/codex-auth.json', '{ "type": "codex", "access_token": "tar-token" }'],
    ['notes/readme.txt', 'not imported'],
    ['nested/provider.json', '{ "schema": "gettokens.account-card.v1" }'],
  ]);

  const payloads = await readArchiveJSONFiles(archive, 'accounts.tar');

  assert.deepEqual(payloads, [
    {
      type: 'auth-file',
      name: 'pasted-auth.json',
      content: '{\n  "type": "codex",\n  "access_token": "tar-token"\n}',
    },
    {
      type: 'upload-file',
      name: 'accounts.tar:nested/provider.json',
      contentBase64: Buffer.from('{ "schema": "gettokens.account-card.v1" }', 'utf8').toString('base64'),
    },
  ]);
});

test('readArchiveJSONFiles parses json files inside compressed tar archives', async () => {
  const archive = gzipSync(buildTarArchive([
    ['auth/codex-auth.json', '{ "type": "codex", "access_token": "tgz-token" }'],
    ['notes/readme.txt', 'not imported'],
  ]));

  const payloads = await readArchiveJSONFiles(archive, 'accounts.tgz');

  assert.deepEqual(payloads, [
    {
      type: 'auth-file',
      name: 'pasted-auth.json',
      content: '{\n  "type": "codex",\n  "access_token": "tgz-token"\n}',
    },
  ]);
});

test('readArchiveJSONFiles expands single json gzip uploads', async () => {
  const archive = gzipSync(strToU8('{ "type": "codex", "access_token": "gzip-token" }'));

  const payloads = await readArchiveJSONFiles(archive, 'codex-auth.json.gz');

  assert.deepEqual(payloads, [
    {
      type: 'auth-file',
      name: 'pasted-auth.json',
      content: '{\n  "type": "codex",\n  "access_token": "gzip-token"\n}',
    },
  ]);
});

test('readUploadFiles expands zip archives into parsed import candidates', async () => {
  const archive = zipSync({
    'auth/codex-auth.json': strToU8('{ "type": "codex", "access_token": "zip-token" }'),
    'nested/provider.json': strToU8('{ "schema": "gettokens.account-card.v1" }'),
    'notes/readme.txt': strToU8('not imported'),
  });
  const payloads = await readUploadFiles([
    new File([archive], 'accounts.zip', { type: 'application/zip' }),
  ]);

  assert.deepEqual(payloads, [
    {
      type: 'auth-file',
      name: 'pasted-auth.json',
      content: '{\n  "type": "codex",\n  "access_token": "zip-token"\n}',
    },
    {
      type: 'upload-file',
      name: 'accounts.zip:nested/provider.json',
      contentBase64: Buffer.from('{ "schema": "gettokens.account-card.v1" }', 'utf8').toString('base64'),
    },
  ]);
});

test('readUploadFiles parses large json entries without base64 fallback', async () => {
  const content = JSON.stringify({
    type: 'codex',
    access_token: `zip-token-${'x'.repeat(8_000)}`,
    refresh_token: `zip-refresh-${'y'.repeat(8_000)}`,
  });
  const archive = zipSync({
    'auth/codex-auth.json': strToU8(content),
  });
  const payloads = await readUploadFiles([
    new File([archive], 'accounts.zip', { type: 'application/zip' }),
  ]);

  assert.deepEqual(payloads, [
    {
      type: 'auth-file',
      name: 'pasted-auth.json',
      content: JSON.stringify(JSON.parse(content), null, 2),
    },
  ]);
});

test('readUploadFiles expands tgz archives into parsed import candidates', async () => {
  const archive = gzipSync(buildTarArchive([
    ['auth/codex-auth.json', '{ "type": "codex", "access_token": "tgz-token" }'],
    ['notes/readme.txt', 'not imported'],
  ]));
  const payloads = await readUploadFiles([
    new File([archive], 'accounts.tar.gz', { type: 'application/gzip' }),
  ]);

  assert.deepEqual(payloads, [
    {
      type: 'auth-file',
      name: 'pasted-auth.json',
      content: '{\n  "type": "codex",\n  "access_token": "tgz-token"\n}',
    },
  ]);
});

test('resolveAccountImportQueueRenderWindow keeps large import queues virtualized by scroll viewport', () => {
  const renderWindow = resolveAccountImportQueueRenderWindow({
    itemCount: 1000,
    scrollTop: ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT * 500,
    viewportHeight: ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT * 3,
  });

  assert.equal(renderWindow.startIndex, 496);
  assert.equal(renderWindow.endIndex, 507);
  assert.equal(renderWindow.visibleCount, 11);
  assert.equal(renderWindow.topOffset, ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT * 496);
  assert.equal(renderWindow.totalHeight, ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT * 1000);
});

test('resolveCopiedAuthFileName creates a new auth-file asset name when importing into existing accounts', () => {
  assert.equal(resolveCopiedAuthFileName('codex-auth.json', []), 'codex-auth.json');
  assert.equal(resolveCopiedAuthFileName('codex-auth.json', ['codex-auth.json']), 'codex-auth #2.json');
  assert.equal(
    resolveCopiedAuthFileName('codex-auth.json', ['codex-auth.json', 'codex-auth #2.json']),
    'codex-auth #3.json',
  );
});

test('resolveCopiedOpenAICompatibleProviderName creates a new provider name when importing into existing accounts', () => {
  assert.equal(resolveCopiedOpenAICompatibleProviderName('deepseek', []), 'deepseek');
  assert.equal(resolveCopiedOpenAICompatibleProviderName('deepseek', ['deepseek']), 'deepseek #2');
  assert.equal(
    resolveCopiedOpenAICompatibleProviderName('deepseek', ['deepseek', 'deepseek #2']),
    'deepseek #3',
  );
});

test('resolveNumberedDuplicateTitle starts from #2 and keeps incrementing from the base title', () => {
  assert.equal(resolveNumberedDuplicateTitle('deepseek', ['deepseek']), 'deepseek #2');
  assert.equal(resolveNumberedDuplicateTitle('deepseek', ['deepseek', 'deepseek #2']), 'deepseek #3');
  assert.equal(resolveNumberedDuplicateTitle('deepseek #2', ['deepseek', 'deepseek #2']), 'deepseek #3');
});

test('validateAccountImportPayloadItem validates different account types correctly', () => {
  // 1. openai-compatible valid
  const okProvider = {
    type: 'openai-compatible',
    name: 'deepseek',
    apiKey: 'sk-1111',
    apiKeys: ['sk-1111'],
    baseUrl: 'https://api.deepseek.com/v1',
    prefix: 'ds',
    proxyUrl: '',
    headers: {},
    models: []
  };
  assert.deepEqual(validateAccountImportPayloadItem(okProvider), { valid: true });

  // 2. openai-compatible invalid (missing name)
  const badProvider1 = { ...okProvider, name: '' };
  assert.equal(validateAccountImportPayloadItem(badProvider1).valid, false);

  // 3. openai-compatible invalid (missing apiKey)
  const badProvider2 = { ...okProvider, apiKey: '' };
  assert.equal(validateAccountImportPayloadItem(badProvider2).valid, false);

  // 4. openai-compatible invalid (missing baseUrl)
  const badProvider3 = { ...okProvider, baseUrl: '' };
  assert.equal(validateAccountImportPayloadItem(badProvider3).valid, false);

  // 5. codex-api-key valid
  const okCodexKey = {
    type: 'codex-api-key',
    label: 'my-key',
    apiKey: 'sk-2222',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'cdx'
  };
  assert.deepEqual(validateAccountImportPayloadItem(okCodexKey), { valid: true });

  // 6. codex-api-key invalid (missing apiKey)
  const badCodexKey = { ...okCodexKey, apiKey: '' };
  assert.equal(validateAccountImportPayloadItem(badCodexKey).valid, false);

  // 7. auth-file valid
  const okAuthFile = {
    type: 'auth-file',
    name: 'some-auth.json',
    content: JSON.stringify({ type: 'codex', access_token: 'tok' })
  };
  assert.deepEqual(validateAccountImportPayloadItem(okAuthFile), { valid: true });

  // 8. auth-file invalid (missing name)
  const badAuthFile1 = { ...okAuthFile, name: '' };
  assert.equal(validateAccountImportPayloadItem(badAuthFile1).valid, false);

  // 9. auth-file invalid (malformed JSON content)
  const badAuthFile2 = { ...okAuthFile, content: '{invalid-json' };
  assert.equal(validateAccountImportPayloadItem(badAuthFile2).valid, false);
});


function buildTarArchive(entries) {
  const encoder = new TextEncoder();
  const chunks = [];

  for (const [name, content] of entries) {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const header = new Uint8Array(512);
    header.set(nameBytes.slice(0, 100), 0);
    writeTarOctal(header, 100, 8, 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, contentBytes.length);
    writeTarOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = 0x30;
    header.set(encoder.encode('ustar'), 257);
    header[262] = 0;
    header.set(encoder.encode('00'), 263);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeTarOctal(header, 148, 8, checksum);

    chunks.push(header, contentBytes);
    const paddingSize = (512 - (contentBytes.length % 512)) % 512;
    if (paddingSize > 0) {
      chunks.push(new Uint8Array(paddingSize));
    }
  }

  chunks.push(new Uint8Array(1024));
  const totalSize = chunks.reduce((size, chunk) => size + chunk.length, 0);
  const out = new Uint8Array(totalSize);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

function writeTarOctal(header, offset, length, value) {
  const text = value.toString(8).padStart(length - 1, '0').slice(0, length - 1);
  for (let index = 0; index < text.length; index += 1) {
    header[offset + index] = text.charCodeAt(index);
  }
  header[offset + length - 1] = 0;
}
