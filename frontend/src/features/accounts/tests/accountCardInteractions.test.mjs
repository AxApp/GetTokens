import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccountCardContentText, buildAccountCardCopyText } from '../model/accountCardActions.ts';
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

test('buildAccountCardCopyText returns the account primary label', () => {
  assert.equal(
    buildAccountCardCopyText({
      id: 'codex-api-key:stable-001',
      provider: 'codex',
      credentialSource: 'api-key',
      displayName: 'Primary API Key',
      status: 'configured',
      keySuffix: '1234',
    }),
    'Primary API Key',
  );
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
