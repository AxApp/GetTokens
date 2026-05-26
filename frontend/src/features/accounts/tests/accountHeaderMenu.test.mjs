import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ACCOUNT_HEADER_MENU_ITEM_CLASS,
  buildAccountsHeaderMenuItems,
} from '../components/accountHeaderMenu.ts';

test('buildAccountsHeaderMenuItems keeps all add-account actions in one flat menu', () => {
  const items = buildAccountsHeaderMenuItems({
    ready: true,
    loading: false,
    includeUnifiedCompose: true,
    includeRotationSettings: true,
  });

  assert.deepEqual(
    items.map((item) => item.id),
    [
      'unified-compose',
      'chatgpt-login',
      'import-auth-file',
      'paste-auth-file',
      'codex-api-key',
      'rotation-settings',
    ],
  );
  assert.equal(items[0].labelKey, 'accounts.add_account');
  assert.equal(items[0].label, '+ ADD ACCOUNT');
  assert.equal(items[0].emphasis, true);
  assert.equal(items[1].dividerBefore, true);
  assert.equal(items[5].dividerBefore, true);
  assert.equal(items[1].disabled, false);
  assert.equal(items[2].disabled, false);
  assert.equal(items[3].disabled, false);
});

test('buildAccountsHeaderMenuItems disables import actions when the page is not ready', () => {
  const items = buildAccountsHeaderMenuItems({
    ready: false,
    loading: false,
    includeUnifiedCompose: true,
    includeRotationSettings: true,
  });

  assert.equal(items[0].disabled, false);
  assert.equal(items[1].disabled, true);
  assert.equal(items[2].disabled, true);
  assert.equal(items[3].disabled, true);
  assert.equal(items[4].disabled, false);
  assert.equal(items[5].disabled, true);
});

test('AccountsHeader menu row styles stay flat instead of card-like', () => {
  const source = readFileSync(new URL('../components/AccountsHeader.tsx', import.meta.url), 'utf8');

  assert.match(source, /ACCOUNT_HEADER_MENU_ITEM_CLASS/);
  assert.match(ACCOUNT_HEADER_MENU_ITEM_CLASS, /hover:bg-\[var\(--bg-surface\)\]/);
  assert.match(ACCOUNT_HEADER_MENU_ITEM_CLASS, /active:scale-\[0\.99\]/);
  assert.doesNotMatch(ACCOUNT_HEADER_MENU_ITEM_CLASS, /btn-swiss/);
  assert.doesNotMatch(ACCOUNT_HEADER_MENU_ITEM_CLASS, /shadow/);
  assert.doesNotMatch(ACCOUNT_HEADER_MENU_ITEM_CLASS, /border-2/);
  assert.doesNotMatch(source, /btn-swiss whitespace-nowrap bg-\[var\(--text-primary\)\]/);
});
