import type { main, sidecar } from '../wailsjs/go/models';

export type AppPage = 'status' | 'accounts' | 'settings';

export type ThemeMode = 'system' | 'light' | 'dark';

export type LocaleCode = 'zh' | 'en';

export type SidecarStatus = sidecar.Status;

export type AuthFile = main.AuthFileItem;
export type CodexQuota = main.CodexQuotaResponse;

export interface AuthModel {
  id?: string;
  display_name?: string;
  name?: string;
  type?: string;
  owned_by?: string;
  [key: string]: unknown;
}

export interface SegmentedOption<T extends string = string> {
  id: T;
  label: string;
}

export type TranslationValue = string | TranslationTree;

export interface TranslationTree {
  [key: string]: TranslationValue;
}
