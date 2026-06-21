import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { ThemeMode, ThemePreset } from '../types';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PRESET,
  persistThemeMode,
  persistThemePreset,
} from './theme';

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (value: ThemeMode) => void;
  themePreset: ThemePreset;
  setThemePreset: (value: ThemePreset) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children?: ReactNode }) {
  const themeMode = DEFAULT_THEME_MODE;
  const themePreset = DEFAULT_THEME_PRESET;

  useEffect(() => {
    persistThemeMode(typeof localStorage === 'undefined' ? null : localStorage, themeMode);
    persistThemePreset(typeof localStorage === 'undefined' ? null : localStorage, themePreset);
  }, []);

  function setThemeMode(_value: ThemeMode) {
    persistThemeMode(typeof localStorage === 'undefined' ? null : localStorage, themeMode);
  }

  function setThemePreset(_value: ThemePreset) {
    persistThemePreset(typeof localStorage === 'undefined' ? null : localStorage, themePreset);
  }

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      themePreset,
      setThemePreset,
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
