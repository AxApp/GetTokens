import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAccountsPreviewAPIKeyRecords,
  getAccountsPreviewAuthFiles,
  getAccountsPreviewOpenAICompatibleProviders,
  getAccountsPreviewQuotaStateByKey,
} from '../previewData.ts';

test('accounts browser preview data covers auth files, api keys, and openai-compatible providers', () => {
  const authFiles = getAccountsPreviewAuthFiles();
  const accountRecords = getAccountsPreviewAPIKeyRecords();
  const openAICompatibleProviders = getAccountsPreviewOpenAICompatibleProviders();

  assert.ok(authFiles.length >= 4);
  assert.ok(accountRecords.length >= 4);
  assert.ok(openAICompatibleProviders.length >= 2);
  assert.ok(authFiles.some((account) => account.name === 'codex-pro.json'));
  assert.ok(accountRecords.some((account) => account.id === 'codex-api-key:stable-001'));
  assert.ok(accountRecords.some((account) => account.accountKind === 'openai-compatible'));
});

test('accounts browser preview data can expand account records for high-volume scroll checks', () => {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        href: 'http://127.0.0.1:5174/?accountsPreviewCount=1000#frame=accounts',
      },
    },
  });

  try {
    const authFiles = getAccountsPreviewAuthFiles();
    const accountRecords = getAccountsPreviewAPIKeyRecords();
    const quotaByKey = getAccountsPreviewQuotaStateByKey(accountRecords);

    assert.equal(authFiles.length + accountRecords.length, 1000);
    assert.ok(accountRecords.some((account) => account.id === 'codex-api-key:stable-001'));
    assert.ok(accountRecords.some((account) => account.id.endsWith(':preview-1')));
    const expandedAccount = accountRecords.find((account) => account.id.endsWith(':preview-1'));
    assert.ok(expandedAccount?.quotaKey);
    assert.equal(quotaByKey[expandedAccount.quotaKey].status, 'success');
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: previousWindow,
    });
  }
});
