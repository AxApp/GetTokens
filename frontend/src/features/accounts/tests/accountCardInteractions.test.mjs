import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildAccountCardContentText } from '../model/accountCardActions.ts';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions.ts';

function node(tagName, parentElement = null, dataset) {
  return { tagName, parentElement, dataset };
}

test('shouldOpenAccountDetailsFromTarget allows plain card body clicks', () => {
  const card = node('div');
  const content = node('div', card);

  assert.equal(shouldOpenAccountDetailsFromTarget(content, card), true);
});

test('shouldOpenAccountDetailsFromTarget ignores direct interactive elements', () => {
  const card = node('div');
  const button = node('button', card);

  assert.equal(shouldOpenAccountDetailsFromTarget(button, card), false);
});

test('shouldOpenAccountDetailsFromTarget ignores nested elements inside buttons', () => {
  const card = node('div');
  const button = node('button', card);
  const icon = node('span', button);

  assert.equal(shouldOpenAccountDetailsFromTarget(icon, card), false);
});

test('shouldOpenAccountDetailsFromTarget respects explicit ignore markers', () => {
  const card = node('div');
  const wrapper = node('div', card, { accountCardIgnoreClick: 'true' });
  const inner = node('span', wrapper);

  assert.equal(shouldOpenAccountDetailsFromTarget(inner, card), false);
});

test('buildAccountCardContentText returns structured account summary json', () => {
  const content = buildAccountCardContentText({
    id: 'codex-api-key:stable-001',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Primary API Key',
    status: 'configured',
    apiKey: 'sk-test-1111',
    baseUrl: 'https://api.openai.com/v1',
    prefix: 'team-a',
  });

  assert.deepEqual(JSON.parse(content), {
    schema: 'gettokens.account-card.v1',
    credentialSource: 'api-key',
    account: {
      id: 'codex-api-key:stable-001',
      provider: 'codex',
      displayName: 'Primary API Key',
      status: 'configured',
      disabled: false,
      localOnly: false,
    },
    codexAPIKey: {
      label: 'Primary API Key',
      apiKey: 'sk-test-1111',
      baseUrl: 'https://api.openai.com/v1',
      prefix: 'team-a',
    },
  });
});

test('account card action menu uses explicit copy labels', async () => {
  const source = await readFile(new URL('../components/AccountCard.tsx', import.meta.url), 'utf8');

  assert.match(source, /t\('accounts\.copy_account_config'\)/);
  assert.match(source, /writeAccountClipboardText/);
  assert.doesNotMatch(source, /t\('accounts\.copy_account_name'\)/);
  assert.doesNotMatch(source, /t\('common\.copy_content'\)/);
  assert.doesNotMatch(source, /navigator\.clipboard\.writeText/);
});

test('accounts import modal opens with app-local copied account payload when available', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /readAccountClipboardFallback/);
  assert.match(source, /setInitialImportPasteContent\(readAccountClipboardFallback\(\)\)/);
});

test('pasted codex api key copies use numbered duplicate titles', async () => {
  const source = await readFile(new URL('../hooks/useAccountsActions.ts', import.meta.url), 'utf8');

  assert.match(source, /resolveNumberedDuplicateTitle\(item\.label/);
  assert.match(source, /label,/);
});
