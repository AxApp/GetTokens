import type { ThemeConfig } from 'antd';
import type { ThemePreset } from '../types';

interface GetTokensAntdThemeInput {
  themePreset: ThemePreset;
  isDark: boolean;
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

const classicDark: AntdPalette = {
  canvas: '#080808',
  container: '#111111',
  elevated: '#171717',
  muted: '#202020',
  text: '#f4f4f4',
  textSecondary: '#c8c8c8',
  border: '#343434',
  borderStrong: '#e8e8e8',
  primary: '#f4f4f4',
  primarySoft: '#2a2a2a',
  success: '#7bc47f',
  warning: '#d39b48',
  error: '#ff766d',
};

const parchmentLight: AntdPalette = {
  canvas: '#f5f4ed',
  container: '#faf9f5',
  elevated: '#ffffff',
  muted: '#e8e6dc',
  text: '#141413',
  textSecondary: '#5e5d59',
  border: '#e8e6dc',
  borderStrong: '#d1cfc5',
  primary: '#c96442',
  primarySoft: '#f0eee6',
  success: '#3f7d5a',
  warning: '#b7791f',
  error: '#b84a38',
};

const parchmentDark: AntdPalette = {
  canvas: '#1d1c19',
  container: '#25231f',
  elevated: '#2e2b26',
  muted: '#363228',
  text: '#f5f1e8',
  textSecondary: '#c9c1ae',
  border: '#605947',
  borderStrong: '#d4c6a5',
  primary: '#d97757',
  primarySoft: '#38342d',
  success: '#74b18a',
  warning: '#d4a647',
  error: '#e0765f',
};

function resolvePalette(themePreset: ThemePreset, isDark: boolean): AntdPalette {
  if (themePreset === 'parchment-trust-console') {
    return isDark ? parchmentDark : parchmentLight;
  }
  return isDark ? classicDark : classicLight;
}

export function buildGetTokensAntdTheme({
  themePreset,
  isDark,
}: GetTokensAntdThemeInput): ThemeConfig {
  const palette = resolvePalette(themePreset, isDark);

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
