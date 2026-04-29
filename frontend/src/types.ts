import type { main, sidecar, updater } from '../wailsjs/go/models';

export type AppPage = 'status' | 'accounts' | 'usage-desk' | 'settings' | 'debug';
export type AccountWorkspace = 'all' | 'codex' | 'openai-compatible';
export type UsageDeskWorkspace = 'codex' | 'gemini';

export type ThemeMode = 'system' | 'light' | 'dark';

export type LocaleCode = 'zh' | 'en';

export type SidecarStatus = sidecar.Status;
export type ReleaseInfo = updater.ReleaseInfo;

export type AuthFile = main.AuthFileItem & {
  priority?: number;
  email?: string;
  planType?: string;
};
export type CodexQuota = main.CodexQuotaResponse;
export type CredentialSource = 'auth-file' | 'api-key';

export interface AccountRecord {
  id: string;
  provider: string;
  credentialSource: CredentialSource;
  displayName: string;
  status: string;
  statusMessage?: string;
  priority?: number;
  disabled?: boolean;
  email?: string;
  planType?: string;
  name?: string;
  apiKey?: string;
  keyFingerprint?: string;
  keySuffix?: string;
  baseUrl?: string;
  prefix?: string;
  authIndex?: unknown;
  quotaKey?: string;
  localOnly?: boolean;
  rawAuthFile?: AuthFile;
}

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
