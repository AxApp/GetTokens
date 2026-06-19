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

test('settings appearance exposes theme mode control via useTheme', async () => {
  const source = await readFile(new URL('./SettingsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /const \{ themeMode, setThemeMode \} = useTheme\(\)/);
  assert.match(source, /<Segmented\b/);
  assert.match(source, /<Switch\b/);
  assert.match(source, /parchment-settings-row/);
  assert.match(source, /settings-group/);
  assert.match(source, /settings-section-title/);
});

test('settings page uses Ant Design adapter and macOS preferences layout', async () => {
  const source = await readFile(new URL('./SettingsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /from 'antd'/);
  assert.match(source, /GetTokensAntdThemeProvider/);
  assert.match(source, /data-settings-antd-spike="true"/);
  assert.match(source, /data-settings-redesign="macos-preferences"/);
  assert.match(source, /settings-page/);
});
