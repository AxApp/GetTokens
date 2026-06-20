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

test('settings appearance exposes theme mode and theme preset controls via useTheme', async () => {
  const source = await readFile(new URL('./SettingsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /const \{ themeMode, setThemeMode, themePreset, setThemePreset \} = useTheme\(\)/);
  assert.match(source, /<Segmented\b/);
  assert.match(source, /<Switch\b/);
  assert.match(source, /data-theme-preset-control="true"/);
  assert.match(source, /settings\.theme_preset/);
  assert.match(source, /parchment-settings-row/);
  assert.match(source, /settings-group/);
  assert.match(source, /settings-section-title/);
});

test('theme preset picker uses the quiet workspace shell', async () => {
  const source = await readFile(new URL('../../components/ui/ThemePresetPicker.tsx', import.meta.url), 'utf8');

  assert.match(source, /data-theme-preset-option=\{definition\.id\}/);
  assert.match(source, /border border-\[var\(--gt-border-subtle\)\] bg-\[var\(--gt-surface-canvas\)\]/);
  assert.match(source, /border-\[var\(--gt-accent-primary\)\]/);
  assert.match(source, /bg-\[color-mix\(in_srgb,var\(--gt-accent-primary\)_8%,var\(--gt-surface-canvas\)\)\]/);
  assert.match(source, /text-\[var\(--gt-ink-primary\)\]/);
  assert.match(source, /text-\[var\(--gt-ink-muted\)\]/);
  assert.doesNotMatch(source, /border-2/);
  assert.doesNotMatch(source, /--bg-main|--border-color|--text-primary|--text-muted/);
  assert.doesNotMatch(source, /font-black/);
  assert.doesNotMatch(source, /\buppercase\b/);
  assert.doesNotMatch(source, /tracking-\[|tracking-wide|tracking-wider|tracking-widest|tracking-tight|tracking-tighter|tracking-tightest/);
});

test('settings page uses Ant Design adapter and macOS preferences layout', async () => {
  const source = await readFile(new URL('./SettingsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /from 'antd'/);
  assert.match(source, /GetTokensAntdThemeProvider/);
  assert.match(source, /data-settings-antd-spike="true"/);
  assert.match(source, /data-settings-redesign="macos-preferences"/);
  assert.match(source, /settings-page/);
});

test('settings browser preview protects Wails-only local usage and proxy settings', async () => {
  const source = await readFile(new URL('./SettingsFeature.tsx', import.meta.url), 'utf8');

  assert.match(source, /if \(!hasWailsAppBindings\(\)\) \{\n\s*setLocalUsageInterval/);
  assert.match(source, /if \(!hasWailsAppBindings\(\)\) \{\n\s*setUseSystemProxy/);
  assert.match(source, /settings\.local_usage_refresh_preview_saved/);
  assert.match(source, /settings\.system_proxy_preview_saved/);
});
