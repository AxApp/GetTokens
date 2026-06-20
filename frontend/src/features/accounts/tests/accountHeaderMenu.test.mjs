import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ACCOUNT_HEADER_MENU_ICON_CLASS,
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
      'account-import',
      'codex-api-key',
      'rotation-settings',
    ],
  );
  assert.equal(items[0].labelKey, 'accounts.add_account');
  assert.equal(items[0].label, undefined);
  assert.equal(items[0].icon, 'plus');
  assert.equal(items[0].emphasis, true);
  assert.equal(items[1].dividerBefore, true);
  assert.equal(items[4].dividerBefore, true);
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
  assert.equal(items[3].disabled, false);
  assert.equal(items[4].disabled, true);
});

test('AccountsHeader menu row styles stay flat instead of card-like', () => {
  const source = readFileSync(new URL('../components/AccountsHeader.tsx', import.meta.url), 'utf8');

  assert.match(source, /ACCOUNT_HEADER_MENU_ITEM_CLASS/);
  assert.match(ACCOUNT_HEADER_MENU_ITEM_CLASS, /text-\[length:var\(--font-size-ui-md\)\]/);
  assert.match(ACCOUNT_HEADER_MENU_ITEM_CLASS, /min-h-11/);
  assert.match(ACCOUNT_HEADER_MENU_ITEM_CLASS, /leading-snug/);
  assert.match(ACCOUNT_HEADER_MENU_ITEM_CLASS, /hover:bg-\[var\(--gt-surface-muted\)\]/);
  assert.match(ACCOUNT_HEADER_MENU_ITEM_CLASS, /active:scale-\[0\.99\]/);
  assert.match(ACCOUNT_HEADER_MENU_ICON_CLASS, /h-5 w-5/);
  assert.match(source, /aria-label=\{t\('accounts\.header_actions_menu'\)\}/);
  assert.match(source, /\{t\(item\.labelKey\)\}/);
  assert.doesNotMatch(ACCOUNT_HEADER_MENU_ITEM_CLASS, /btn-swiss/);
  assert.doesNotMatch(ACCOUNT_HEADER_MENU_ITEM_CLASS, /shadow/);
  assert.doesNotMatch(ACCOUNT_HEADER_MENU_ITEM_CLASS, /border-2/);
  assert.doesNotMatch(source, /btn-swiss whitespace-nowrap bg-\[var\(--text-primary\)\]/);
});

test('AccountsHeader exposes separate account-list and runtime refresh actions', () => {
  const headerSource = readFileSync(new URL('../components/AccountsHeader.tsx', import.meta.url), 'utf8');
  const featureSource = readFileSync(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(headerSource, /onRefreshAccounts/);
  assert.match(headerSource, /onRefreshRuntime/);
  assert.match(headerSource, /runtimeRefreshing\?: boolean/);
  assert.match(headerSource, /accounts\.refresh_accounts/);
  assert.match(headerSource, /accounts\.refresh_runtime/);
  assert.match(headerSource, /accounts\.refresh_runtime_hint/);
  assert.match(headerSource, /disabled=\{!ready \|\| loading \|\| runtimeRefreshing\}/);
  assert.match(headerSource, /data-accounts-runtime-refreshing=\{runtimeRefreshing \? 'true' : undefined\}/);
  assert.match(headerSource, /className=\{`h-4 w-4 \$\{runtimeRefreshing \? 'animate-pulse' : ''\}`\}/);
  assert.doesNotMatch(headerSource, /<Activity className=\{`h-4 w-4 \$\{loading \? 'animate-pulse' : ''\}`\}/);
  assert.match(featureSource, /const \[runtimeRefreshing, setRuntimeRefreshing\] = useState\(false\)/);
  assert.match(featureSource, /await Promise\.allSettled\(\[/);
  assert.match(featureSource, /runtimeRefreshing=\{runtimeRefreshing\}/);
  assert.match(featureSource, /onRefreshAccounts=\{\(\) => void loadAccounts\(\{ refreshSupplementalData: false \}\)\}/);
  assert.match(featureSource, /onRefreshRuntime=\{\(\) => void refreshAccountsRuntime\(\)\}/);
  assert.doesNotMatch(featureSource, /onRefresh=\{\(\) => void loadAccounts\(\{ showSupplementalRefreshing: true \}\)\}/);
});

test('AccountsHeader menu visible labels are localized from locale files', () => {
  const zh = JSON.parse(readFileSync(new URL('../../../locales/zh.json', import.meta.url), 'utf8'));
  const en = JSON.parse(readFileSync(new URL('../../../locales/en.json', import.meta.url), 'utf8'));

  for (const locale of [zh, en]) {
    assert.ok(Object.hasOwn(locale.accounts, 'header_actions_menu'));
    assert.ok(Object.hasOwn(locale.accounts, 'refresh_runtime'));
    assert.ok(Object.hasOwn(locale.accounts, 'refresh_runtime_hint'));
    assert.ok(Object.hasOwn(locale.accounts, 'add_account'));
    assert.ok(Object.hasOwn(locale.accounts, 'login_chatgpt'));
    assert.ok(Object.hasOwn(locale.accounts, 'import_accounts'));
    assert.ok(Object.hasOwn(locale.accounts, 'add_codex_api_key'));
  }
  assert.equal(zh.accounts.add_account, '添加第三方厂商账号');
  assert.equal(en.accounts.add_account, 'Add Third-Party Provider Account');
});
