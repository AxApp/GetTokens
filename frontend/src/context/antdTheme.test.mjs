import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGetTokensAntdTheme } from './antdTheme.ts';

test('classic preset maps to neutral Ant Design tokens', () => {
  const theme = buildGetTokensAntdTheme({ themePreset: 'classic', isDark: false });

  assert.deepEqual(theme.cssVar, { key: 'gettokens' });
  assert.equal(theme.token?.colorBgLayout, '#ffffff');
  assert.equal(theme.token?.colorText, '#000000');
  assert.equal(theme.token?.colorPrimary, '#111111');
  assert.equal(theme.token?.borderRadius, 10);
  assert.equal(theme.token?.borderRadiusLG, 14);
  assert.equal(theme.components?.Button?.borderRadius, 8);
  assert.equal(theme.components?.Card?.borderRadiusLG, 14);
});

test('parchment preset maps to warm Ant Design tokens aligned with CSS contract', () => {
  const theme = buildGetTokensAntdTheme({ themePreset: 'parchment-trust-console', isDark: false });

  assert.deepEqual(theme.cssVar, { key: 'gettokens' });
  assert.equal(theme.token?.colorBgLayout, '#f5f4ed');
  assert.equal(theme.token?.colorBgContainer, '#faf9f5');
  assert.equal(theme.token?.colorBgElevated, '#ffffff');
  assert.equal(theme.token?.colorText, '#141413');
  assert.equal(theme.token?.colorTextSecondary, '#5e5d59');
  assert.equal(theme.token?.colorBorder, '#e8e6dc');
  assert.equal(theme.token?.colorPrimary, '#c96442');
  assert.equal(theme.token?.colorSuccess, '#3f7d5a');
  assert.equal(theme.token?.colorWarning, '#b7791f');
  assert.equal(theme.token?.colorError, '#b84a38');
  assert.equal(theme.components?.Segmented?.itemSelectedBg, '#c96442');
  assert.equal(theme.components?.Segmented?.itemSelectedColor, '#ffffff');
  assert.equal(theme.components?.Segmented?.trackBg, 'transparent');
  assert.equal(theme.components?.Segmented?.borderRadius, 6);
});

test('dark parchment maps to corrected dark palette', () => {
  const theme = buildGetTokensAntdTheme({ themePreset: 'parchment-trust-console', isDark: true });

  assert.deepEqual(theme.cssVar, { key: 'gettokens' });
  assert.equal(theme.token?.colorBgLayout, '#1d1c19');
  assert.equal(theme.token?.colorBgContainer, '#25231f');
  assert.equal(theme.token?.colorBgElevated, '#2e2b26');
  assert.equal(theme.token?.colorText, '#f5f1e8');
  assert.equal(theme.token?.colorTextSecondary, '#c9c1ae');
  assert.equal(theme.token?.colorBorder, '#605947');
  assert.equal(theme.token?.colorPrimary, '#d97757');
  assert.equal(theme.token?.colorSuccess, '#74b18a');
  assert.equal(theme.token?.colorWarning, '#d4a647');
  assert.equal(theme.token?.colorError, '#e0765f');
});
