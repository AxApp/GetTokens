import test from 'node:test';
import assert from 'node:assert/strict';

import { getSidebarToggleTranslationKey } from './sidebarState.ts';
import { getSidebarNavItems } from './sidebarNav.ts';
import { readFile } from 'node:fs/promises';

test('sidebar hides developer-only entries outside dev tools mode', () => {
  const productionIDs = getSidebarNavItems(false).map((item) => item.id);
  const developmentIDs = getSidebarNavItems(true).map((item) => item.id);

  assert.equal(productionIDs.includes('design-system'), false);
  assert.equal(productionIDs.includes('debug'), false);
  assert.equal(developmentIDs.includes('design-system'), true);
  assert.equal(developmentIDs.includes('debug'), true);
});

test('sidebar toggle uses explicit labels for collapsed and expanded states', () => {
  assert.equal(getSidebarToggleTranslationKey(false), 'nav.collapse_sidebar');
  assert.equal(getSidebarToggleTranslationKey(true), 'nav.expand_sidebar');
});

test('sidebar typography keeps nav labels readable in the compact workspace shell', async () => {
  const source = await readFile(new URL('./Sidebar.tsx', import.meta.url), 'utf8');
  const stateSource = await readFile(new URL('./sidebarState.ts', import.meta.url), 'utf8');

  assert.match(source, /from 'antd'/);
  assert.match(source, /<Menu\b/);
  assert.match(source, /items=\{sidebarMenuItems\}/);
  assert.match(source, /selectedKeys=\{\[selectedMenuKey\]\}/);
  assert.match(source, /openKeys=\{sidebarOpenKeys\}/);
  assert.match(source, /inlineCollapsed=\{isCollapsed\}/);
  assert.match(source, /mode="inline"/);
  assert.match(source, /!font-sans/);
  assert.doesNotMatch(source, /fontWeight: .*500/);
  assert.doesNotMatch(source, /fontSize:/);
  assert.doesNotMatch(source, /\btransition(?![-\[])/);
  assert.doesNotMatch(source, /createPortal/);
  assert.doesNotMatch(source, /function Submenu/);
  assert.doesNotMatch(stateSource, /resolveHoveredSidebarSection|getSidebarSubmenuPlacement|getSidebarSubmenuMotionState|getOpenSidebarSection/);
});

test('sidebar section clicks still select the section page before opening submenu', async () => {
  const source = await readFile(new URL('./Sidebar.tsx', import.meta.url), 'utf8');

  assert.match(source, /function handleSectionTitleClick\(section: 'codex' \| 'claude'\) \{\n\s*setActivePage\(section\)/);
  assert.match(source, /function handleMenuClick\(\{ key \}: \{ key: string \}\) \{/);
  assert.match(source, /setActivePage\('codex'\)/);
  assert.match(source, /setActivePage\('claude'\)/);
  assert.doesNotMatch(source, /展开时：只 toggle 子菜单，不切换页面/);
});

test('sidebar navigation follows Ant Design navigation menu contract', async () => {
  const source = await readFile(new URL('./Sidebar.tsx', import.meta.url), 'utf8');
  const themeSource = await readFile(new URL('../../context/antdTheme.ts', import.meta.url), 'utf8');

  assert.match(source, /MenuProps\['items'\]/);
  assert.match(source, /onTitleClick: \(\) => handleSectionTitleClick\('codex'\)/);
  assert.match(source, /onTitleClick: \(\) => handleSectionTitleClick\('claude'\)/);
  assert.match(source, /data-sidebar-menu="antd"/);
  assert.match(source, /aria-label=\{t\('nav\.sidebar_navigation'\)\}/);
  assert.match(themeSource, /Menu: \{/);
  assert.match(themeSource, /itemHeight: 32/);
  assert.match(themeSource, /itemBorderRadius: 6/);
  assert.match(themeSource, /collapsedWidth: 76/);
});

test('app shell publishes sidebar width for fixed modal layout', async () => {
  const appSource = await readFile(new URL('../../App.tsx', import.meta.url), 'utf8');
  const sidebarSource = await readFile(new URL('./Sidebar.tsx', import.meta.url), 'utf8');

  assert.match(appSource, /--app-sidebar-width/);
  assert.match(appSource, /\[--app-sidebar-width:4\.75rem\]/);
  assert.match(appSource, /\[--app-sidebar-width:15rem\]/);
  assert.doesNotMatch(appSource, /style=\{\{[\s\S]*--app-sidebar-width/);
  assert.match(sidebarSource, /onCollapsedChange\?:/);
  assert.match(sidebarSource, /onCollapsedChange\?\.\(next\)/);
});
