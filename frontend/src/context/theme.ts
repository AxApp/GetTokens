import type { ThemeMode, ThemePreset } from '../types';

export const THEME_MODE_STORAGE_KEY = 'theme-mode';
export const THEME_PRESET_STORAGE_KEY = 'theme-preset';
export const DEFAULT_THEME_MODE: ThemeMode = 'light';
export const DEFAULT_THEME_PRESET: ThemePreset = 'classic';

export interface ThemePresetDefinition {
  id: ThemePreset;
  label: string;
  description: string;
  rootAttribute: string;
  previewTokens: {
    canvas: string;
    panel: string;
    ink: string;
    accent: string;
  };
}

export const themePresetDefinitions: ReadonlyArray<ThemePresetDefinition> = [
  {
    id: 'classic',
    label: 'Classic Console',
    description: 'Current Swiss hard-edge console style kept as the compatibility baseline.',
    rootAttribute: 'classic',
    previewTokens: {
      canvas: '#ffffff',
      panel: '#f9f9f9',
      ink: '#000000',
      accent: '#111111',
    },
  },
] as const;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === DEFAULT_THEME_MODE;
}

export function isThemePreset(value: unknown): value is ThemePreset {
  return value === DEFAULT_THEME_PRESET;
}

export function resolveInitialThemeMode(_value: string | null): ThemeMode {
  return DEFAULT_THEME_MODE;
}

export function resolveInitialThemePreset(_value: string | null): ThemePreset {
  return DEFAULT_THEME_PRESET;
}

export function readStoredThemeMode(_storage: Pick<Storage, 'getItem'> | null | undefined): ThemeMode {
  return DEFAULT_THEME_MODE;
}

export function readStoredThemePreset(_storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreset {
  return DEFAULT_THEME_PRESET;
}

export function persistThemeMode(storage: Pick<Storage, 'setItem'> | null | undefined, _themeMode: unknown) {
  storage?.setItem(THEME_MODE_STORAGE_KEY, DEFAULT_THEME_MODE);
}

export function persistThemePreset(storage: Pick<Storage, 'setItem'> | null | undefined, _themePreset: unknown) {
  storage?.setItem(THEME_PRESET_STORAGE_KEY, DEFAULT_THEME_PRESET);
}

export function getThemePresetDefinition(themePreset: ThemePreset): ThemePresetDefinition {
  return themePresetDefinitions.find((definition) => definition.id === themePreset) ?? themePresetDefinitions[0];
}
