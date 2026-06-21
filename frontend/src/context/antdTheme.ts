import type { ThemeConfig } from 'antd';

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
  primarySoft: string;
  success: string;
  warning: string;
  error: string;
}

const classicLight: AntdPalette = {
  canvas: '#ffffff',
  container: '#ffffff',
  elevated: '#f9f9f9',
  muted: '#f2f2f2',
  text: '#000000',
  textSecondary: '#4b4b4b',
  border: '#d8d8d8',
  borderStrong: '#111111',
  primary: '#111111',
  primarySoft: '#ececec',
  success: '#2f7d32',
  warning: '#a46312',
  error: '#b42318',
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
      borderRadius: 10,
      borderRadiusLG: 14,
      controlHeight: 30,
      controlHeightLG: 36,
      fontFamily: '"Avenir Next", "SF Pro Text", "Helvetica Neue", sans-serif',
      fontFamilyCode: '"JetBrains Mono", "SFMono-Regular", "Menlo", monospace',
      boxShadow: '0 16px 38px rgba(43, 34, 24, 0.13)',
      boxShadowSecondary: '0 10px 24px rgba(43, 34, 24, 0.10)',
    },
    components: {
      Button: {
        borderRadius: 8,
        defaultBg: palette.container,
        defaultBorderColor: palette.border,
        defaultColor: palette.text,
        primaryShadow: 'none',
      },
      Card: {
        borderRadiusLG: 14,
        colorBgContainer: palette.container,
        colorBorderSecondary: palette.border,
        paddingLG: 20,
      },
      Segmented: {
        borderRadius: 6,
        controlHeight: 28,
        controlHeightSM: 24,
        itemActiveBg: palette.primary,
        itemColor: palette.textSecondary,
        itemHoverBg: palette.primarySoft,
        itemSelectedBg: palette.primary,
        itemSelectedColor: palette.elevated,
        trackBg: 'transparent',
        fontSize: 12,
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
