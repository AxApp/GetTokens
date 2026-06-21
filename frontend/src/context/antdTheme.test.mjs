import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGetTokensAntdTheme } from './antdTheme.ts';

test('classic preset maps to neutral Ant Design tokens', () => {
  const theme = buildGetTokensAntdTheme();

  assert.deepEqual(theme.cssVar, { key: 'gettokens' });
  assert.equal(theme.token?.colorBgLayout, '#ffffff');
  assert.equal(theme.token?.colorText, '#1f1f1f');
  assert.equal(theme.token?.colorPrimary, '#1677ff');
  assert.equal(theme.token?.borderRadius, 6);
  assert.equal(theme.token?.borderRadiusLG, 8);
  assert.equal(theme.components?.Button?.borderRadius, 6);
  assert.equal(theme.components?.Card?.borderRadiusLG, 8);
});

test('unsupported theme inputs still resolve to the single neutral style', () => {
  const theme = buildGetTokensAntdTheme({ themePreset: 'parchment-trust-console', isDark: false });

  assert.deepEqual(theme.cssVar, { key: 'gettokens' });
  assert.equal(theme.token?.colorBgLayout, '#ffffff');
  assert.equal(theme.token?.colorBgContainer, '#ffffff');
  assert.equal(theme.token?.colorBgElevated, '#ffffff');
  assert.equal(theme.token?.colorText, '#1f1f1f');
  assert.equal(theme.token?.colorTextSecondary, '#595959');
  assert.equal(theme.token?.colorBorder, '#d9d9d9');
  assert.equal(theme.token?.colorPrimary, '#1677ff');
  assert.equal(theme.token?.colorSuccess, '#52c41a');
  assert.equal(theme.token?.colorWarning, '#faad14');
  assert.equal(theme.token?.colorError, '#f5222d');
  assert.equal(theme.components?.Segmented?.itemSelectedBg, '#1677ff');
  assert.equal(theme.components?.Segmented?.itemSelectedColor, '#ffffff');
  assert.equal(theme.components?.Segmented?.trackBg, 'transparent');
  assert.equal(theme.components?.Segmented?.borderRadius, 6);
});
