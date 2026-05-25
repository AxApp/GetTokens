import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSidebarContentMotionState,
  getOpenSidebarSection,
  getSidebarSubmenuMotionState,
  getSidebarSubmenuPlacement,
  getSidebarToggleTranslationKey,
  resolveHoveredSidebarSection,
} from './sidebarState.ts';
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

test('sidebar only opens nested navigation for hoverable section pages', () => {
  assert.equal(resolveHoveredSidebarSection('accounts'), 'accounts');
  assert.equal(resolveHoveredSidebarSection('codex'), 'codex');
  assert.equal(resolveHoveredSidebarSection('claude'), 'claude');
  assert.equal(resolveHoveredSidebarSection('settings'), null);
  assert.equal(resolveHoveredSidebarSection('debug'), null);
});

test('sidebar toggle uses explicit labels for collapsed and expanded states', () => {
  assert.equal(getSidebarToggleTranslationKey(false), 'nav.collapse_sidebar');
  assert.equal(getSidebarToggleTranslationKey(true), 'nav.expand_sidebar');
});

test('content motion state follows collapsed sidebar state', () => {
  assert.equal(getSidebarContentMotionState(false), 'expanded');
  assert.equal(getSidebarContentMotionState(true), 'collapsed');
});

test('pinned sidebar section stays open after hover leaves', () => {
  assert.equal(getOpenSidebarSection('accounts', null), 'accounts');
  assert.equal(getOpenSidebarSection('codex', 'accounts'), 'codex');
  assert.equal(getOpenSidebarSection('claude', 'codex'), 'claude');
  assert.equal(getOpenSidebarSection(null, 'accounts'), 'accounts');
  assert.equal(getOpenSidebarSection(null, null), null);
});

test('submenu placement uses right rail only for collapsed sidebar', () => {
  assert.equal(getSidebarSubmenuPlacement(true), 'right');
  assert.equal(getSidebarSubmenuPlacement(false), 'bottom');
});

test('submenu motion state matches placement and visibility', () => {
  assert.equal(getSidebarSubmenuMotionState('right', true), 'open-right');
  assert.equal(getSidebarSubmenuMotionState('right', false), 'closed-right');
  assert.equal(getSidebarSubmenuMotionState('bottom', true), 'open-bottom');
  assert.equal(getSidebarSubmenuMotionState('bottom', false), 'closed-bottom');
});

test('sidebar typography keeps the brand and nav labels readable', async () => {
  const source = await readFile(new URL('./Sidebar.tsx', import.meta.url), 'utf8');

  assert.match(source, /text-3xl/);
  assert.match(source, /text-sm font-bold uppercase tracking-widest/);
  assert.match(source, /font-size-ui-lg/);
  assert.match(source, /font-size-ui-sm/);
});

test('app shell publishes sidebar width for fixed modal layout', async () => {
  const appSource = await readFile(new URL('../../App.tsx', import.meta.url), 'utf8');
  const sidebarSource = await readFile(new URL('./Sidebar.tsx', import.meta.url), 'utf8');

  assert.match(appSource, /--app-sidebar-width/);
  assert.match(appSource, /isSidebarCollapsed \? '4\.75rem' : '15rem'/);
  assert.match(sidebarSource, /onCollapsedChange\?:/);
  assert.match(sidebarSource, /onCollapsedChange\?\.\(next\)/);
});
