import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PRESET,
  THEME_MODE_STORAGE_KEY,
  THEME_PRESET_STORAGE_KEY,
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
  assert.equal(isThemeMode('system'), true);
  assert.equal(isThemeMode('light'), true);
  assert.equal(isThemeMode('dark'), true);
  assert.equal(isThemeMode('parchment-trust-console'), false);
  assert.equal(isThemeMode(null), false);
});

test('isThemePreset only accepts supported preset values', () => {
  assert.equal(isThemePreset('classic'), true);
  assert.equal(isThemePreset('parchment-trust-console'), true);
  assert.equal(isThemePreset('dark'), false);
  assert.equal(isThemePreset(null), false);
});

test('theme storage readers keep mode and preset independent', () => {
  const storage = {
    getItem(key) {
      if (key === THEME_MODE_STORAGE_KEY) {
        return 'dark';
      }
      if (key === THEME_PRESET_STORAGE_KEY) {
        return 'parchment-trust-console';
      }
      return null;
    },
  };

  assert.equal(readStoredThemeMode(storage), 'dark');
  assert.equal(readStoredThemePreset(storage), 'parchment-trust-console');
});

test('theme storage readers fall back for invalid values or unavailable storage', () => {
  assert.equal(resolveInitialThemeMode('sepia'), DEFAULT_THEME_MODE);
  assert.equal(resolveInitialThemePreset('sepia'), DEFAULT_THEME_PRESET);
  assert.equal(readStoredThemeMode(null), DEFAULT_THEME_MODE);
  assert.equal(readStoredThemePreset(null), DEFAULT_THEME_PRESET);
  assert.equal(readStoredThemeMode({ getItem: () => 'parchment-trust-console' }), DEFAULT_THEME_MODE);
  assert.equal(readStoredThemePreset({ getItem: () => 'dark' }), DEFAULT_THEME_PRESET);
});

test('theme persistence writes stable localStorage keys', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistThemeMode(storage, 'light');
  persistThemePreset(storage, 'parchment-trust-console');

  assert.deepEqual(writes, [
    [THEME_MODE_STORAGE_KEY, 'light'],
    [THEME_PRESET_STORAGE_KEY, 'parchment-trust-console'],
  ]);
});

test('theme preset registry exposes classic and parchment preview tokens', () => {
  assert.deepEqual(
    themePresetDefinitions.map((definition) => definition.id),
    ['classic', 'parchment-trust-console'],
  );

  const parchment = getThemePresetDefinition('parchment-trust-console');
  assert.equal(parchment.rootAttribute, 'parchment-trust-console');
  assert.equal(parchment.previewTokens.canvas, '#f5f4ed');
  assert.equal(parchment.previewTokens.accent, '#c96442');
});
