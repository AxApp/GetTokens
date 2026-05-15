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

test('sidebar only opens nested navigation for hoverable section pages', () => {
  assert.equal(resolveHoveredSidebarSection('accounts'), 'accounts');
  assert.equal(resolveHoveredSidebarSection('codex'), 'codex');
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
