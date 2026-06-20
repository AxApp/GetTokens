import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACCOUNT_GROUP_FULL_ROW_ESTIMATE,
  ACCOUNT_GROUP_VIRTUALIZATION_THRESHOLD,
  ACCOUNTS_SELECTION_ACTION_MENU_GAP,
  ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY,
  DEFAULT_ACCOUNT_LIST_DISPLAY_MODE,
  buildAccountListDisplayModeHash,
  parseAccountListDisplayMode,
  resolveAccountGroupRenderWindow,
  shouldUseAccountsSelectionActionMenu,
} from '../model/accountListLayout.ts';

test('parseAccountListDisplayMode keeps existing full-card accounts layout as the default', () => {
  assert.equal(ACCOUNT_LIST_DISPLAY_MODE_STORAGE_KEY, 'gettokens.accounts.display-mode');
  assert.equal(DEFAULT_ACCOUNT_LIST_DISPLAY_MODE, 'full');
  assert.equal(parseAccountListDisplayMode('compact'), 'full');
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

test('resolveAccountGroupRenderWindow keeps high-volume account groups windowed by rows', () => {
  assert.equal(ACCOUNT_GROUP_VIRTUALIZATION_THRESHOLD, 120);

  const renderWindow = resolveAccountGroupRenderWindow({
    itemCount: 1000,
    columns: 3,
    viewportStart: ACCOUNT_GROUP_FULL_ROW_ESTIMATE * 100,
    viewportEnd: ACCOUNT_GROUP_FULL_ROW_ESTIMATE * 104,
    rowHeight: ACCOUNT_GROUP_FULL_ROW_ESTIMATE,
  });

  assert.equal(renderWindow.startIndex, 291);
  assert.equal(renderWindow.endIndex, 321);
  assert.equal(renderWindow.renderedCount, 30);
  assert.equal(renderWindow.rowCount, 334);
  assert.equal(renderWindow.topSpacerHeight, ACCOUNT_GROUP_FULL_ROW_ESTIMATE * 97);
  assert.equal(renderWindow.bottomSpacerHeight, ACCOUNT_GROUP_FULL_ROW_ESTIMATE * 227);
});

test('AccountGroupSectionView virtualizes large account groups instead of mapping every card', async () => {
  const source = await readFile(new URL('../components/AccountGroupSectionView.tsx', import.meta.url), 'utf8');

  assert.match(source, /ACCOUNT_GROUP_VIRTUALIZATION_THRESHOLD/);
  assert.match(source, /data-account-group-virtualized/);
  assert.match(source, /data-account-group-render-window/);
  assert.match(source, /data-account-group-virtual-spacer="top"/);
  assert.match(source, /visibleAccounts\.map\(\(account\) => renderAccount\(account\)\)/);
  assert.doesNotMatch(source, /group\.accounts\.map\(\(account\) => renderAccount\(account\)\)/);
});

test('account plan groups can collapse without changing group actions scope', async () => {
  const viewSource = await readFile(new URL('../components/AccountGroupSectionView.tsx', import.meta.url), 'utf8');
  const wrapperSource = await readFile(new URL('../components/AccountGroupSection.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const zhLocale = await readFile(new URL('../../../locales/zh.json', import.meta.url), 'utf8');
  const enLocale = await readFile(new URL('../../../locales/en.json', import.meta.url), 'utf8');

  assert.match(viewSource, /isCollapsed\?: boolean/);
  assert.match(viewSource, /onToggleCollapsed\?: \(groupID: string\) => void/);
  assert.match(viewSource, /data-account-group-collapsed=\{isCollapsed \? 'true' : 'false'\}/);
  assert.match(viewSource, /data-account-group-header="true"/);
  assert.match(viewSource, /className="flex items-center justify-between gap-3 rounded-md border px-3 py-2\.5"/);
  assert.match(viewSource, /backgroundColor: 'color-mix\(in srgb, var\(--gt-surface-muted\) 54%, transparent\)'/);
  assert.match(viewSource, /className="flex min-w-0 items-center gap-2"/);
  assert.match(viewSource, /className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-\[var\(--gt-surface-canvas\)\]"/);
  assert.match(viewSource, /className="min-w-0 truncate text-sm font-semibold leading-tight"/);
  assert.match(viewSource, /className="font-mono text-\[length:var\(--font-size-ui-xs\)\] font-medium leading-none"/);
  assert.match(viewSource, /className="flex h-7 items-center gap-1 rounded-md border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-canvas\)\] px-2 text-\[length:var\(--font-size-ui-xs\)\] font-medium text-\[var\(--gt-ink-secondary\)\] transition-colors hover:bg-\[var\(--gt-surface-muted\)\] disabled:cursor-not-allowed disabled:opacity-40"/);
  assert.match(viewSource, /aria-label=\{t\('accounts\.refresh_group'\)\}[\s\S]*className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-\[var\(--gt-surface-muted\)\] disabled:cursor-not-allowed disabled:opacity-40"[\s\S]*title=\{t\('accounts\.refresh_group'\)\}/);
  assert.match(viewSource, /className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-\[var\(--gt-surface-muted\)\]"/);
  assert.doesNotMatch(viewSource, /<RefreshCw size=\{13\} strokeWidth=\{2\} \/>\s*\{t\('accounts\.refresh_group'\)\}/);
  assert.doesNotMatch(viewSource, /className="btn-swiss mb-1 flex h-8 w-8/);
  assert.doesNotMatch(viewSource, /className="flex items-center justify-between gap-4 border-b pb-4"/);
  assert.match(viewSource, /aria-expanded=\{!isCollapsed\}/);
  assert.match(viewSource, /onToggleCollapsed\(group\.id\)/);
  assert.match(viewSource, /isCollapsed \? null : \(/);
  assert.match(viewSource, /onRefreshGroup\(group\.accounts\)/);
  assert.match(viewSource, /groupSelectionAction\(group\.accounts\)/);

  assert.match(wrapperSource, /isCollapsed\?: boolean/);
  assert.match(wrapperSource, /onToggleCollapsed\?: \(groupID: string\) => void/);
  assert.match(wrapperSource, /isCollapsed=\{isCollapsed\}/);
  assert.match(wrapperSource, /onToggleCollapsed=\{onToggleCollapsed\}/);

  assert.match(featureSource, /collapsedAccountGroupIDs/);
  assert.match(featureSource, /toggleAccountGroupCollapsed/);
  assert.match(featureSource, /isCollapsed=\{collapsedAccountGroupIDs\.has\(group\.id\)\}/);
  assert.match(featureSource, /onToggleCollapsed=\{toggleAccountGroupCollapsed\}/);

  assert.match(zhLocale, /"group_collapse": "收起分组"/);
  assert.match(zhLocale, /"group_expand": "展开分组"/);
  assert.match(enLocale, /"group_collapse": "Collapse Group"/);
  assert.match(enLocale, /"group_expand": "Expand Group"/);
});

test('accounts selection toolbar stays sticky while scrolling selected accounts', async () => {
  const source = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-account-selection-toolbar-sticky/);
  assert.match(source, /renderSelectionActions=\{false\}/);
  assert.match(source, /onCancelSelection=\{toggleSelectionMode\}/);
  assert.match(
    source,
    /className=\{accountsFeatureSelectionToolbarShellClass\}/,
  );
  assert.match(source, /bg-\[color-mix\(in_srgb,var\(--gt-surface-canvas\)_94%,transparent\)\]/);
  assert.match(source, /backdrop-blur/);
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
  assert.match(source, /onCancelSelection\?: \(\) => void/);
  assert.match(source, /t\('accounts\.cancel_selection'\)/);
  assert.match(source, /ref=\{inlineActionsMeasureRef\}/);
  assert.match(source, /<BulkInlineAction/);
  assert.match(source, /<MoreVertical size=\{18\} strokeWidth=\{3\} \/>/);
  assert.match(source, /aria-label=\{t\('common\.more_actions'\)\}/);
  assert.match(source, /<BulkMenuAction/);
  assert.match(source, /label=\{t\('accounts\.export_selected'\)\}/);
  assert.doesNotMatch(source, /className="border-t border-dashed border-\[var\(--border-color\)\] pt-4"/);
  assert.doesNotMatch(source, /className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed/);
});

test('account group menu exposes destructive delete behind a confirmation state', async () => {
  const source = await readFile(new URL('../components/AccountGroupSectionView.tsx', import.meta.url), 'utf8');

  assert.match(source, /onDeleteGroup\?: \(accounts: AccountRecord\[\]\) => void/);
  assert.match(source, /isFilteredView\?: boolean/);
  assert.match(source, /isGroupDeleteConfirming/);
  assert.match(source, /t\('accounts\.delete_group'\)/);
  assert.match(source, /t\('accounts\.delete_group_visible'\)/);
  assert.match(source, /t\('accounts\.group_remove_confirm'\)/);
  assert.match(source, /t\('accounts\.group_remove_visible_confirm'\)/);
  assert.match(source, /onDeleteGroup\(group\.accounts\)/);
  assert.match(source, /resolveBulkDeleteTargets\(group\.accounts\)/);
});

test('accounts toolbar display mode switch only offers full and list views', async () => {
  const source = await readFile(new URL('../components/AccountsToolbar.tsx', import.meta.url), 'utf8');

  assert.match(source, /grid-cols-2/);
  assert.match(source, /className="grid h-8 shrink-0 grid-cols-2 overflow-hidden rounded-md border"/);
  assert.match(source, /text-\[length:var\(--font-size-ui-xs\)\] font-medium leading-none/);
  assert.match(source, /onDisplayModeChange\('full'\)/);
  assert.match(source, /onDisplayModeChange\('list'\)/);
  assert.doesNotMatch(source, /onDisplayModeChange\('compact'\)|display_mode_compact/);
});
