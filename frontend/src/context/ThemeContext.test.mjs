import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PRESET,
  THEME_MODE_STORAGE_KEY,
  getThemePresetDefinition,
  isThemeMode,
  isThemePreset,
  persistThemeMode,
  persistThemePreset,
  readStoredThemeMode,
  readStoredThemePreset,
  resolveInitialThemeMode,
  resolveInitialThemePreset,
  themePresetDefinitions,
} from './theme.ts';

test('isThemeMode only accepts supported mode values', () => {
  assert.equal(isThemeMode('light'), true);
  assert.equal(isThemeMode('system'), false);
  assert.equal(isThemeMode('dark'), false);
  assert.equal(isThemeMode('parchment-trust-console'), false);
  assert.equal(isThemeMode(null), false);
});

test('isThemePreset only accepts supported preset values', () => {
  assert.equal(isThemePreset('classic'), true);
  assert.equal(isThemePreset('parchment-trust-console'), false);
  assert.equal(isThemePreset('dark'), false);
  assert.equal(isThemePreset(null), false);
});

test('theme storage readers ignore legacy runtime style choices', () => {
  const storage = {
    getItem(key) {
      if (key === THEME_MODE_STORAGE_KEY) {
        return 'dark';
      }
      if (key === 'theme-preset') {
        return 'parchment-trust-console';
      }
      return null;
    },
  };

  assert.equal(readStoredThemeMode(storage), DEFAULT_THEME_MODE);
  assert.equal(readStoredThemePreset(storage), DEFAULT_THEME_PRESET);
});

test('theme storage readers fall back for invalid values or unavailable storage', () => {
  assert.equal(resolveInitialThemeMode('sepia'), DEFAULT_THEME_MODE);
  assert.equal(resolveInitialThemePreset('sepia'), DEFAULT_THEME_PRESET);
  assert.equal(readStoredThemeMode(null), DEFAULT_THEME_MODE);
  assert.equal(readStoredThemePreset(null), DEFAULT_THEME_PRESET);
  assert.equal(readStoredThemeMode({ getItem: () => 'parchment-trust-console' }), DEFAULT_THEME_MODE);
  assert.equal(readStoredThemePreset({ getItem: () => 'dark' }), DEFAULT_THEME_PRESET);
});

test('theme persistence writes only the active runtime theme key', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistThemeMode(storage, 'dark');
  persistThemePreset(storage, 'parchment-trust-console');

  assert.deepEqual(writes, [
    [THEME_MODE_STORAGE_KEY, 'light'],
  ]);
});

test('theme preset registry exposes only the single runtime style', () => {
  assert.deepEqual(
    themePresetDefinitions.map((definition) => definition.id),
    ['classic'],
  );

  const classic = getThemePresetDefinition('parchment-trust-console');
  assert.equal(classic.rootAttribute, 'classic');
  assert.equal(classic.previewTokens.canvas, '#ffffff');
  assert.equal(classic.previewTokens.accent, '#1677ff');
});
