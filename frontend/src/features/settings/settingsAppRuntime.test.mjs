import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAppCloseAction, resolveAppRuntimeUIState } from './settingsAppRuntime.ts';

test('normalizeAppCloseAction falls back to quitting the app and service', () => {
  assert.equal(normalizeAppCloseAction('keep_service_in_menu_bar'), 'keep_service_in_menu_bar');
  assert.equal(normalizeAppCloseAction('unexpected'), 'quit_app_and_service');
  assert.equal(normalizeAppCloseAction(undefined), 'quit_app_and_service');
});

test('resolveAppRuntimeUIState allows hiding the menu bar icon in foreground mode', () => {
  assert.deepEqual(resolveAppRuntimeUIState('quit_app_and_service', false), {
    closeAction: 'quit_app_and_service',
    menuBarResident: false,
    showMenuBarIcon: false,
  });
});

test('resolveAppRuntimeUIState forces the menu bar icon when close action keeps service resident', () => {
  assert.deepEqual(resolveAppRuntimeUIState('keep_service_in_menu_bar', false), {
    closeAction: 'keep_service_in_menu_bar',
    menuBarResident: true,
    showMenuBarIcon: true,
  });
});
