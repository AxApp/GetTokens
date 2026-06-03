import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNTS_SELECTION_ACTION_MENU_GAP,
  ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY,
  DEFAULT_ACCOUNT_LIST_DISPLAY_MODE,
  buildAccountListDisplayModeHash,
  parseAccountListDisplayMode,
  shouldUseAccountsSelectionActionMenu,
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

test('shouldUseAccountsSelectionActionMenu only falls back when inline actions overflow', () => {
  assert.equal(ACCOUNTS_SELECTION_ACTION_MENU_GAP, 16);
  assert.equal(shouldUseAccountsSelectionActionMenu(0, 360), false);
  assert.equal(shouldUseAccountsSelectionActionMenu(720, 0), false);
  assert.equal(shouldUseAccountsSelectionActionMenu(376, 360), false);
  assert.equal(shouldUseAccountsSelectionActionMenu(375, 360), true);
});

test('accounts selection toolbar stays sticky while scrolling selected accounts', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-selection-toolbar-sticky/);
  assert.match(source, /renderSelectionActions=\{false\}/);
  assert.match(
    source,
    /className="sticky -top-12 z-40 -mx-12 !mt-4 bg-\[var\(--bg-surface\)\] px-12 py-1\.5"/,
  );
  assert.match(source, /className=\{isSelectionMode \? [\"']space-y-8 !mt-4[\"'] : [\"']space-y-8[\"']\}/);
  assert.doesNotMatch(source, /shadow-\[6px_6px_0_var\(--shadow-color\)\]/);
  assert.doesNotMatch(source, /className="border-2 border-\[var\(--border-color\)\] bg-\[var\(--bg-main\)\] px-4 pb-4/);
  assert.match(source, /<AccountsSelectionActions/);
});

test('accounts selection actions render as one adaptive toolbar with overflow fallback', async () => {
  const source = await readFile(new URL('../components/AccountsToolbar.tsx', import.meta.url), 'utf8');

  assert.match(source, /ResizeObserver/);
  assert.match(source, /useBulkActionMenu/);
  assert.match(source, /shouldUseAccountsSelectionActionMenu/);
  assert.match(source, /ref=\{inlineActionsMeasureRef\}/);
  assert.match(source, /<BulkInlineAction/);
  assert.match(source, /<MoreVertical size=\{18\} strokeWidth=\{3\} \/>/);
  assert.match(source, /aria-label=\{t\('common\.more_actions'\)\}/);
  assert.match(source, /<BulkMenuAction/);
  assert.match(source, /label=\{t\('accounts\.export_selected'\)\}/);
  assert.doesNotMatch(source, /className="border-t border-dashed border-\[var\(--border-color\)\] pt-4"/);
  assert.doesNotMatch(source, /className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed/);
});
