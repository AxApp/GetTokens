import { useEffect, type ReactNode } from 'react';
import type { Preview } from '@storybook/react-vite';
import { I18nProvider, useI18n } from '../src/context/I18nContext';
import { resolveStorybookLocale, storybookLocaleOptions } from '../src/features/design-system/storybookGlobals';
import { TextScaleProvider, useTextScale } from '../src/context/TextScaleContext';
import { getTextScaleAttributeValue, type TextScale } from '../src/context/textScale';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import type { LocaleCode, ThemeMode } from '../src/types';
import { applyTextScaleVariables } from '../src/features/settings/settingsTextScale';
import '../src/style.css';

function StorybookRuntime({
  children,
  locale,
  textScale,
  themeMode,
}: {
  children: ReactNode;
  locale: LocaleCode;
  textScale: TextScale;
  themeMode: ThemeMode;
}) {
  const { setLocale } = useI18n();
  const { setThemeMode } = useTheme();
  const { setTextScale } = useTextScale();

  useEffect(() => {
    setLocale(locale);
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale, setLocale]);

  useEffect(() => {
    setThemeMode(themeMode);
  }, [setThemeMode, themeMode]);

  useEffect(() => {
    setTextScale(textScale);
  }, [setTextScale, textScale]);

  useEffect(() => {
    const isDark =
      themeMode === 'dark' ||
      (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.textScale = getTextScaleAttributeValue(textScale);
    applyTextScaleVariables(document.documentElement.style, textScale);
  }, [textScale]);

  return <div className="min-h-screen bg-[var(--bg-surface)] p-6 text-[var(--text-primary)]">{children}</div>;
}

const preview: Preview = {
  initialGlobals: {
    locale: 'zh',
    themeMode: 'system',
    textScale: 'default',
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
  },
  globalTypes: {
    locale: {
      description: 'GetTokens 预览语言',
      defaultValue: 'zh',
      toolbar: {
        title: '语言',
        icon: 'globe',
        items: storybookLocaleOptions,
      },
    },
    themeMode: {
      description: 'GetTokens 主题模式',
      defaultValue: 'system',
      toolbar: {
        title: '主题',
        icon: 'mirror',
        items: [
          { value: 'system', title: '跟随系统' },
          { value: 'light', title: '浅色' },
          { value: 'dark', title: '深色' },
        ],
      },
    },
    textScale: {
      description: 'GetTokens 文字缩放',
      defaultValue: 'default',
      toolbar: {
        title: '文字',
        icon: 'paragraph',
        items: [
          { value: 'default', title: '默认' },
          { value: 'large', title: '大号' },
          { value: 'x-large', title: '超大' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => (
      <ThemeProvider>
        <TextScaleProvider>
          <I18nProvider>
            <StorybookRuntime
              locale={resolveStorybookLocale(context.globals.locale)}
              themeMode={(context.globals.themeMode || 'system') as ThemeMode}
              textScale={(context.globals.textScale || 'default') as TextScale}
            >
              <Story />
            </StorybookRuntime>
          </I18nProvider>
        </TextScaleProvider>
      </ThemeProvider>
    ),
  ],
};

export default preview;
