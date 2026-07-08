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
  resolveAccountGroupMeasuredRowHeight,
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

test('resolveAccountGroupMeasuredRowHeight prefers measured card row stride over the fallback estimate', () => {
  assert.equal(
    resolveAccountGroupMeasuredRowHeight(
      [
        { top: 0, height: 224 },
        { top: 0, height: 220 },
        { top: 256, height: 228 },
        { top: 256, height: 224 },
      ],
      { fallbackRowHeight: ACCOUNT_GROUP_FULL_ROW_ESTIMATE, rowGap: 32 },
    ),
    256,
  );
  assert.equal(
    resolveAccountGroupMeasuredRowHeight(
      [
        { top: 0, height: 224 },
        { top: 0, height: 220 },
      ],
      { fallbackRowHeight: ACCOUNT_GROUP_FULL_ROW_ESTIMATE, rowGap: 32 },
    ),
    256,
  );
});

test('AccountGroupSectionView virtualizes large account groups instead of mapping every card', async () => {
  const source = await readFile(new URL('../components/AccountGroupSectionView.tsx', import.meta.url), 'utf8');

  assert.match(source, /ACCOUNT_GROUP_VIRTUALIZATION_THRESHOLD/);
  assert.match(source, /resolveAccountGroupMeasuredRowHeight/);
  assert.match(source, /measureRenderedAccountGroupRowHeight/);
  assert.match(source, /data-account-group-virtualized/);
  assert.match(source, /data-account-group-render-window/);
  assert.match(source, /data-account-group-virtual-spacer="top"/);
  assert.match(source, /onVisibleAccountsChange\?: \(groupID: string, accountIDs: string\[\]\) => void/);
  assert.match(source, /const visibleAccountIDs = useMemo/);
  assert.match(source, /onVisibleAccountsChange\?\.\(group\.id, visibleAccountIDs\)/);
  assert.match(source, /onVisibleAccountsChange\?\.\(group\.id, \[\]\)/);
  assert.match(source, /visibleAccounts\.map\(\(account\) => renderAccount\(account\)\)/);
  assert.doesNotMatch(source, /group\.accounts\.map\(\(account\) => renderAccount\(account\)\)/);
});

test('AccountGroupSectionView keeps virtual spacers outside the selectable account grid', async () => {
  const source = await readFile(new URL('../components/AccountGroupSectionView.tsx', import.meta.url), 'utf8');
  const styleSource = await readFile(new URL('../../../style.css', import.meta.url), 'utf8');

  assert.match(source, /const virtualWrapperRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(source, /const gridRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(source, /ref=\{virtualWrapperRef\}/);
  assert.match(source, /id=\{groupBodyID\}[\s\S]*ref=\{gridRef\}/);
  assert.match(source, /data-account-group-virtualized=\{shouldVirtualize \? 'true' : undefined\}/);
  assert.match(source, /data-account-group-total-count=\{shouldVirtualize \? group\.accounts\.length : undefined\}/);
  assert.match(source, /data-account-group-rendered-count=\{shouldVirtualize \? renderWindow\.renderedCount : undefined\}/);
  assert.match(source, /data-account-group-hidden-before-count=\{shouldVirtualize \? renderWindow\.startIndex : undefined\}/);
  assert.match(source, /data-account-group-hidden-after-count=\{shouldVirtualize \? group\.accounts\.length - renderWindow\.endIndex : undefined\}/);

  const gridStart = source.indexOf('id={groupBodyID}');
  const gridEnd = source.indexOf("{shouldVirtualize && renderWindow.bottomSpacerHeight > 0", gridStart);
  const gridBlock = gridStart >= 0 && gridEnd > gridStart ? source.slice(gridStart, gridEnd) : '';
  assert.ok(gridBlock, 'expected the account grid block to be present');
  assert.doesNotMatch(gridBlock, /data-account-group-virtual-spacer/);

  const spacerBlock = styleSource.match(/\[data-account-group-virtual-spacer\]\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
  assert.match(spacerBlock, /pointer-events:\s*none/);
  assert.match(spacerBlock, /user-select:\s*none/);
});

test('AccountGroupSectionView memoizes large group action availability outside scroll metrics', async () => {
  const viewSource = await readFile(new URL('../components/AccountGroupSectionView.tsx', import.meta.url), 'utf8');
  const selectionSource = await readFile(new URL('../model/accountSelection.ts', import.meta.url), 'utf8');

  assert.match(selectionSource, /export function resolveAccountGroupActionAvailability/);
  assert.match(viewSource, /resolveAccountGroupActionAvailability/);
  assert.match(viewSource, /useMemo\(\s*\(\) => resolveAccountGroupActionAvailability\(group\.accounts, selectedAccountIDSet\)/);
  assert.doesNotMatch(viewSource, /resolveBulkQuotaRefreshTargets\(group\.accounts\)/);
  assert.doesNotMatch(viewSource, /resolveBulkSetDisabledTargets\(group\.accounts/);
  assert.doesNotMatch(viewSource, /resolveBulkDeleteTargets\(group\.accounts\)/);
});

test('account plan groups can collapse without changing group actions scope', async () => {
  const viewSource = await readFile(new URL('../components/AccountGroupSectionView.tsx', import.meta.url), 'utf8');
  const wrapperSource = await readFile(new URL('../components/AccountGroupSection.tsx', import.meta.url), 'utf8');
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');
  const zhLocale = await readFile(new URL('../../../locales/zh.json', import.meta.url), 'utf8');
  const enLocale = await readFile(new URL('../../../locales/en.json', import.meta.url), 'utf8');

  assert.match(viewSource, /isCollapsed\?: boolean/);
  assert.match(viewSource, /isRefreshing\?: boolean/);
  assert.match(viewSource, /onToggleCollapsed\?: \(groupID: string\) => void/);
  assert.match(viewSource, /data-account-group-collapsed=\{isCollapsed \? 'true' : 'false'\}/);
  assert.match(viewSource, /data-account-group-header="true"/);
  assert.match(viewSource, /className=\{isListMode/);
  assert.match(viewSource, /'flex items-center justify-between gap-3 rounded-md border px-3\.5 py-2\.5'/);
  assert.match(viewSource, /'flex items-center justify-between gap-3 border-b border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-muted\)\] px-3 py-2\.5'/);
  assert.match(viewSource, /backgroundColor: 'color-mix\(in srgb, var\(--gt-surface-muted\) 54%, transparent\)'/);
  assert.match(viewSource, /className="flex min-w-0 items-center gap-2"/);
  assert.match(viewSource, /type="text"[\s\S]*className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md !border-0 !bg-transparent !shadow-none text-\[var\(--gt-ink-secondary\)\] transition-colors hover:!bg-transparent hover:text-\[var\(--gt-ink-primary\)\]"/);
  assert.match(viewSource, /className="min-w-0 truncate font-sans text-\[length:var\(--gt-font-size-md\)\] font-semibold leading-tight text-\[var\(--gt-ink-primary\)\]"/);
  assert.match(viewSource, /className="font-mono text-\[length:var\(--gt-font-size-xs\)\] font-normal leading-none text-\[var\(--gt-ink-muted\)\]"/);
  assert.match(viewSource, /<Button[\s\S]*aria-pressed=\{allGroupSelected\}[\s\S]*icon=\{<SquareCheckBig size=\{13\} strokeWidth=\{2\} \/>}/);
  assert.match(viewSource, /<Tooltip title=\{t\('accounts\.refresh_group'\)\}>[\s\S]*aria-label=\{t\('accounts\.refresh_group'\)\}[\s\S]*icon=\{<RefreshCw size=\{13\} strokeWidth=\{2\} \/>}/);
  assert.match(viewSource, /aria-busy=\{isRefreshing \? 'true' : undefined\}/);
  assert.match(viewSource, /data-account-group-refreshing=\{isRefreshing \? 'true' : undefined\}/);
  assert.match(viewSource, /disabled=\{!canRefreshGroup \|\| isRefreshing\}/);
  assert.match(viewSource, /loading=\{isRefreshing\}/);
  assert.match(viewSource, /<Dropdown[\s\S]*label: deleteGroupLabel/);
  assert.doesNotMatch(viewSource, /<RefreshCw size=\{13\} strokeWidth=\{2\} \/>\s*\{t\('accounts\.refresh_group'\)\}/);
  assert.doesNotMatch(viewSource, /className="btn-swiss mb-1 flex h-8 w-8/);
  assert.doesNotMatch(viewSource, /className="flex items-center justify-between gap-4 border-b pb-4"/);
  assert.match(viewSource, /aria-expanded=\{!isCollapsed\}/);
  assert.match(viewSource, /onToggleCollapsed\(group\.id\)/);
  assert.match(viewSource, /isCollapsed \? null : \(/);
  assert.match(viewSource, /onRefreshGroup\(group\.accounts\)/);
  assert.match(viewSource, /groupSelectionAction\(group\.accounts\)/);

  assert.match(wrapperSource, /isCollapsed\?: boolean/);
  assert.match(wrapperSource, /onVisibleAccountsChange\?: \(groupID: string, accountIDs: string\[\]\) => void/);
  assert.match(wrapperSource, /const isGroupRefreshing = group\.accounts\.some/);
  assert.match(wrapperSource, /quotaState\?\.refreshing === true/);
  assert.match(wrapperSource, /usageRefreshingAccountIDSet\.has\(account\.id\)/);
  assert.match(wrapperSource, /rateLimitRefreshingAccountIDSet\.has\(account\.id\)/);
  assert.match(wrapperSource, /onToggleCollapsed\?: \(groupID: string\) => void/);
  assert.match(wrapperSource, /isCollapsed=\{isCollapsed\}/);
  assert.match(wrapperSource, /isRefreshing=\{isGroupRefreshing\}/);
  assert.match(wrapperSource, /onToggleCollapsed=\{onToggleCollapsed\}/);
  assert.match(wrapperSource, /onVisibleAccountsChange=\{onVisibleAccountsChange\}/);

  assert.match(featureSource, /collapsedAccountGroupIDs/);
  assert.match(featureSource, /toggleAccountGroupCollapsed/);
  assert.match(featureSource, /updateAutomaticRuntimeSyncTargets/);
  assert.match(featureSource, /isCollapsed=\{collapsedAccountGroupIDs\.has\(group\.id\)\}/);
  assert.match(featureSource, /onToggleCollapsed=\{toggleAccountGroupCollapsed\}/);
  assert.match(featureSource, /onVisibleAccountsChange=\{updateAutomaticRuntimeSyncTargets\}/);

  assert.match(zhLocale, /"group_collapse": "收起分组"/);
  assert.match(zhLocale, /"group_expand": "展开分组"/);
  assert.match(enLocale, /"group_collapse": "Collapse Group"/);
  assert.match(enLocale, /"group_expand": "Expand Group"/);
});

test('accounts page keeps the account inventory rhythm compact on desktop', async () => {
  const featureSource = await readFile(new URL('../AccountsFeature.tsx', import.meta.url), 'utf8');

  assert.match(featureSource, /"h-full w-full overflow-auto bg-\[var\(--gt-surface-canvas\)\] p-8"/);
  assert.match(featureSource, /"mx-auto max-w-6xl space-y-6 pb-32"/);
  assert.match(featureSource, /"sticky -top-8 z-40 -mx-8 !mt-3 bg-\[var\(--gt-surface-canvas\)\] px-8 py-1\.5"/);
  assert.match(featureSource, /<div className="account-card-grid-full grid gap-6">/);
  assert.match(featureSource, /className=\{isSelectionMode \? ["']space-y-6 !mt-3["'] : ["']space-y-6["']\}/);
  assert.doesNotMatch(featureSource, /p-12|space-y-8|-top-12|-mx-12|px-12|grid gap-8/);
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
  assert.match(source, /bg-\[var\(--gt-surface-canvas\)\]/);
  assert.doesNotMatch(source, /backdrop-blur/);
  assert.match(source, /className=\{isSelectionMode \? [\"']space-y-6 !mt-3[\"'] : [\"']space-y-6[\"']\}/);
  assert.doesNotMatch(source, /shadow-\[6px_6px_0_var\(--gt-shadow-panel\)\]/);
  assert.doesNotMatch(source, /className="border-2 border-\[var\(--gt-border-strong\)\] bg-\[var\(--bg-(main|surface)\)\] px-4 pb-4/);
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
  assert.match(source, /const bulkMenuItems: MenuProps\['items'\] = \[/);
  assert.match(source, /<Dropdown[\s\S]*menu=\{\{ items: bulkMenuItems \}\}/);
  assert.match(source, /label=\{t\('accounts\.export_selected'\)\}/);
  assert.doesNotMatch(source, /className="border-t border-dashed border-\[var\(--gt-border-strong\)\] pt-4"/);
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
  assert.match(source, /canDeleteGroup/);
});

test('accounts toolbar display mode switch only offers full and list views', async () => {
  const source = await readFile(new URL('../components/AccountsToolbar.tsx', import.meta.url), 'utf8');

  assert.match(source, /<Segmented/);
  assert.match(source, /options=\{\[/);
  assert.match(source, /\{ label: t\('accounts\.display_mode_full'\), value: 'full' \}/);
  assert.match(source, /\{ label: t\('accounts\.display_mode_list'\), value: 'list' \}/);
  assert.match(source, /onChange=\{\(value\) => onDisplayModeChange\(value as AccountListDisplayMode\)\}/);
  assert.doesNotMatch(source, /onDisplayModeChange\('compact'\)|display_mode_compact/);
});
