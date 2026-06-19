import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemeMode, ThemePreset } from '../types';
import {
  persistThemeMode,
  persistThemePreset,
  readStoredThemeMode,
  readStoredThemePreset,
} from './theme';

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (value: ThemeMode) => void;
  themePreset: ThemePreset;
  setThemePreset: (value: ThemePreset) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children?: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return readStoredThemeMode(typeof localStorage === 'undefined' ? null : localStorage);
  });
  const [themePreset, setThemePreset] = useState<ThemePreset>(() => {
    return readStoredThemePreset(typeof localStorage === 'undefined' ? null : localStorage);
  });

  useEffect(() => {
    persistThemeMode(typeof localStorage === 'undefined' ? null : localStorage, themeMode);
  }, [themeMode]);

  useEffect(() => {
    persistThemePreset(typeof localStorage === 'undefined' ? null : localStorage, themePreset);
  }, [themePreset]);

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      themePreset,
      setThemePreset,
    }),
    [themeMode, themePreset]
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
