import type { ThemeMode, ThemePreset } from '../types';

export const THEME_MODE_STORAGE_KEY = 'theme-mode';
export const THEME_PRESET_STORAGE_KEY = 'theme-preset';
export const DEFAULT_THEME_MODE: ThemeMode = 'system';
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
  {
    id: 'parchment-trust-console',
    label: 'Parchment Trust Console',
    description: 'Warm parchment surfaces, charcoal ink, and audit-console contrast for dense workbench pages.',
    rootAttribute: 'parchment-trust-console',
    previewTokens: {
      canvas: '#f5f4ed',
      panel: '#faf9f5',
      ink: '#141413',
      accent: '#c96442',
    },
  },
] as const;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isThemePreset(value: unknown): value is ThemePreset {
  return value === 'classic' || value === 'parchment-trust-console';
}

export function resolveInitialThemeMode(value: string | null): ThemeMode {
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
}

export function resolveInitialThemePreset(value: string | null): ThemePreset {
  return isThemePreset(value) ? value : DEFAULT_THEME_PRESET;
}

export function readStoredThemeMode(storage: Pick<Storage, 'getItem'> | null | undefined): ThemeMode {
  return resolveInitialThemeMode(storage?.getItem(THEME_MODE_STORAGE_KEY) ?? null);
}

export function readStoredThemePreset(storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreset {
  return resolveInitialThemePreset(storage?.getItem(THEME_PRESET_STORAGE_KEY) ?? null);
}

export function persistThemeMode(storage: Pick<Storage, 'setItem'> | null | undefined, themeMode: ThemeMode) {
  storage?.setItem(THEME_MODE_STORAGE_KEY, themeMode);
}

export function persistThemePreset(storage: Pick<Storage, 'setItem'> | null | undefined, themePreset: ThemePreset) {
  storage?.setItem(THEME_PRESET_STORAGE_KEY, themePreset);
}

export function getThemePresetDefinition(themePreset: ThemePreset): ThemePresetDefinition {
  return themePresetDefinitions.find((definition) => definition.id === themePreset) ?? themePresetDefinitions[0];
}
