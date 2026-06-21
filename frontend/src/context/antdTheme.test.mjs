import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGetTokensAntdTheme } from './antdTheme.ts';

test('classic preset maps to neutral Ant Design tokens', () => {
  const theme = buildGetTokensAntdTheme();

  assert.deepEqual(theme.cssVar, { key: 'gettokens' });
  assert.equal(theme.token?.colorBgLayout, '#ffffff');
  assert.equal(theme.token?.colorText, '#000000');
  assert.equal(theme.token?.colorPrimary, '#111111');
  assert.equal(theme.token?.borderRadius, 10);
  assert.equal(theme.token?.borderRadiusLG, 14);
  assert.equal(theme.components?.Button?.borderRadius, 8);
  assert.equal(theme.components?.Card?.borderRadiusLG, 14);
});

test('unsupported theme inputs still resolve to the single neutral style', () => {
  const theme = buildGetTokensAntdTheme({ themePreset: 'parchment-trust-console', isDark: false });

  assert.deepEqual(theme.cssVar, { key: 'gettokens' });
  assert.equal(theme.token?.colorBgLayout, '#ffffff');
  assert.equal(theme.token?.colorBgContainer, '#ffffff');
  assert.equal(theme.token?.colorBgElevated, '#f9f9f9');
  assert.equal(theme.token?.colorText, '#000000');
  assert.equal(theme.token?.colorTextSecondary, '#4b4b4b');
  assert.equal(theme.token?.colorBorder, '#d8d8d8');
  assert.equal(theme.token?.colorPrimary, '#111111');
  assert.equal(theme.token?.colorSuccess, '#2f7d32');
  assert.equal(theme.token?.colorWarning, '#a46312');
  assert.equal(theme.token?.colorError, '#b42318');
  assert.equal(theme.components?.Segmented?.itemSelectedBg, '#111111');
  assert.equal(theme.components?.Segmented?.itemSelectedColor, '#ffffff');
  assert.equal(theme.components?.Segmented?.trackBg, 'transparent');
  assert.equal(theme.components?.Segmented?.borderRadius, 6);
});
