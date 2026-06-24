import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getSettingsSectionBadge, settingsSectionOrder } from './settingsLayout.ts';

test('settings section order puts daily preferences before maintenance actions', () => {
  assert.deepEqual(settingsSectionOrder, [
    'appearance',
    'app_lifecycle',
    'local_usage_refresh',
    'network_proxy',
    'updates',
  ]);
});

test('getSettingsSectionBadge reflects settings section order', () => {
  assert.equal(getSettingsSectionBadge('appearance'), '01');
  assert.equal(getSettingsSectionBadge('app_lifecycle'), '02');
  assert.equal(getSettingsSectionBadge('local_usage_refresh'), '03');
  assert.equal(getSettingsSectionBadge('network_proxy'), '04');
  assert.equal(getSettingsSectionBadge('updates'), '05');
});

test('settings appearance keeps one runtime style and exposes only non-style preferences', async () => {
  const source = await readFile(new URL('./SettingsFeature.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /useTheme\(\)/);
  assert.doesNotMatch(source, /themeMode|setThemeMode|themePreset|setThemePreset/);
  assert.doesNotMatch(source, /data-theme-preset-control="true"/);
  assert.doesNotMatch(source, /settings\.theme_preset|settings\.theme_mode/);
  assert.match(source, /settings\.appearance/);
  assert.match(source, /settings\.language/);
  assert.match(source, /settings\.text_scale/);
  assert.match(source, /<Switch\b/);
  assert.match(source, /settingsRowClass/);
  assert.doesNotMatch(source, /parchment-settings-row/);
  assert.match(source, /settings-group/);
  assert.match(source, /settings-section-title/);
});

test('settings page uses Ant Design adapter and macOS preferences layout', async () => {
  const source = await readFile(new URL('./SettingsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /from 'antd'/);
  assert.doesNotMatch(source, /GetTokensAntdThemeProvider/);
  assert.match(source, /data-settings-antd-spike="true"/);
  assert.match(source, /data-settings-redesign="macos-preferences"/);
  assert.match(source, /settings-page/);
  assert.match(source, /text-\[length:var\(--gt-font-size-xs\)\]/);
  assert.doesNotMatch(source, /!?text-(?:xs|sm|base|lg|xl|2xl|3xl)\b/);
});

test('settings browser preview protects Wails-only local usage and proxy settings', async () => {
  const source = await readFile(new URL('./SettingsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /if \(!hasWailsAppBindings\(\)\) \{\n\s*setLocalUsageInterval/);
  assert.match(source, /if \(!hasWailsAppBindings\(\)\) \{\n\s*setUseSystemProxy/);
  assert.match(source, /settings\.local_usage_refresh_preview_saved/);
  assert.match(source, /settings\.system_proxy_preview_saved/);
});
