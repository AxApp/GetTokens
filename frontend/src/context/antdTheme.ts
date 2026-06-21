import type { ThemeConfig } from 'antd';
import { blue, gold, green, red } from '@ant-design/colors';

interface GetTokensAntdThemeInput {
  themePreset?: unknown;
  isDark?: unknown;
}

interface AntdPalette {
  canvas: string;
  container: string;
  elevated: string;
  muted: string;
  text: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
  primary: string;
  primarySelected: string;
  primarySoft: string;
  success: string;
  warning: string;
  error: string;
}

const antdBluePrimary = blue[5] ?? '#1677ff';
const antdBlueSelected = blue[0] ?? '#e6f4ff';
const antdBlueSoft = blue[1] ?? '#bae0ff';
const antdGreenPrimary = green[5] ?? '#52c41a';
const antdGoldPrimary = gold[5] ?? '#faad14';
const antdRedPrimary = red[5] ?? '#f5222d';

const classicLight: AntdPalette = {
  canvas: '#ffffff',
  container: '#ffffff',
  elevated: '#ffffff',
  muted: '#fafafa',
  text: '#1f1f1f',
  textSecondary: '#595959',
  border: '#d9d9d9',
  borderStrong: '#8c8c8c',
  primary: antdBluePrimary,
  primarySelected: antdBlueSelected,
  primarySoft: antdBlueSoft,
  success: antdGreenPrimary,
  warning: antdGoldPrimary,
  error: antdRedPrimary,
};

export function buildGetTokensAntdTheme(_input?: GetTokensAntdThemeInput): ThemeConfig {
  const palette = classicLight;

  return {
    cssVar: { key: 'gettokens' },
    hashed: true,
    token: {
      colorBgLayout: palette.canvas,
      colorBgContainer: palette.container,
      colorBgElevated: palette.elevated,
      colorFillSecondary: palette.muted,
      colorText: palette.text,
      colorTextSecondary: palette.textSecondary,
      colorBorder: palette.border,
      colorBorderSecondary: palette.border,
      colorPrimary: palette.primary,
      colorSuccess: palette.success,
      colorWarning: palette.warning,
      colorError: palette.error,
      borderRadius: 6,
      borderRadiusLG: 8,
      controlHeight: 32,
      controlHeightLG: 40,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
      fontFamilyCode: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
      boxShadow: '0 16px 38px rgba(0, 0, 0, 0.13)',
      boxShadowSecondary: '0 10px 24px rgba(0, 0, 0, 0.10)',
    },
    components: {
      Button: {
        borderRadius: 6,
        defaultBg: palette.container,
        defaultBorderColor: palette.border,
        defaultColor: palette.text,
        primaryShadow: 'none',
      },
      Card: {
        borderRadiusLG: 8,
        colorBgContainer: palette.container,
        colorBorderSecondary: palette.border,
        paddingLG: 24,
      },
      Menu: {
        itemBg: 'transparent',
        itemActiveBg: palette.primarySelected,
        itemHoverBg: palette.muted,
        itemHoverColor: palette.text,
        itemSelectedBg: palette.primarySelected,
        itemSelectedColor: palette.primary,
        subMenuItemBg: 'transparent',
        subMenuItemSelectedColor: palette.primary,
        itemBorderRadius: 6,
        subMenuItemBorderRadius: 6,
        itemHeight: 32,
        itemMarginBlock: 2,
        itemMarginInline: 4,
        itemPaddingInline: 10,
        iconSize: 16,
        collapsedIconSize: 16,
        collapsedWidth: 76,
      },
      Segmented: {
        borderRadius: 6,
        controlHeight: 32,
        controlHeightSM: 24,
        itemActiveBg: palette.primary,
        itemColor: palette.textSecondary,
        itemHoverBg: palette.primarySoft,
        itemSelectedBg: palette.primary,
        itemSelectedColor: palette.elevated,
        trackBg: 'transparent',
        fontSize: 14,
      },
      Switch: {
        colorPrimary: palette.success,
        colorPrimaryHover: palette.success,
      },
      Tag: {
        borderRadiusSM: 999,
      },
    },
  };
}
