import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY,
  DEFAULT_ACCOUNT_LIST_DISPLAY_MODE,
  buildAccountListDisplayModeHash,
  parseAccountListDisplayMode,
} from '../model/accountListLayout.ts';

test('parseAccountListDisplayMode keeps existing full-card accounts layout as the default', () => {
  assert.equal(ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY, 'gettokens.accounts.display-mode');
  assert.equal(DEFAULT_ACCOUNT_LIST_DISPLAY_MODE, 'full');
  assert.equal(parseAccountListDisplayMode('compact'), 'compact');
  assert.equal(parseAccountListDisplayMode('list'), 'list');
  assert.equal(parseAccountListDisplayMode('full'), 'full');
  assert.equal(parseAccountListDisplayMode('unknown'), 'full');
  assert.equal(parseAccountListDisplayMode(null), 'full');
});

test('buildAccountListDisplayModeHash preserves accounts frame params and omits default density', () => {
  assert.equal(
    buildAccountListDisplayModeHash('#frame=accounts&detail=codex-api-key%3Astable', 'list'),
    '#frame=accounts&detail=codex-api-key%3Astable&density=list',
  );
  assert.equal(
    buildAccountListDisplayModeHash('#frame=accounts&detail=codex-api-key%3Astable&density=list', 'full'),
    '#frame=accounts&detail=codex-api-key%3Astable',
  );
});
