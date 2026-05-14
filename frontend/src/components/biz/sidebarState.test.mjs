import test from 'node:test';
import assert from 'node:assert/strict';

import {
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
