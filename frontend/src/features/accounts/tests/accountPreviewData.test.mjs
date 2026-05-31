import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAccountsPreviewAPIKeyRecords,
  getAccountsPreviewAuthFiles,
  getAccountsPreviewOpenAICompatibleProviders,
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
