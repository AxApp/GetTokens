import { useEffect, useState, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { buildGetTokensAntdTheme } from './antdTheme';
import { useTheme } from './ThemeContext';

function resolveSystemDark() {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function GetTokensAntdThemeProvider({ children }: { children?: ReactNode }) {
  const { themeMode, themePreset } = useTheme();
  const [systemDark, setSystemDark] = useState(resolveSystemDark);
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemDark);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemDark(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return (
    <ConfigProvider theme={buildGetTokensAntdTheme({ themePreset, isDark })}>
      {children}
    </ConfigProvider>
  );
}

