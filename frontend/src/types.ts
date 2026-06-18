import type { main, sidecar, updater } from "../wailsjs/go/models";

export type AppPage =
  | "status"
  | "accounts"
  | "account-import"
  | "session-management"
  | "vendor-status"
  | "proxy-pool"
  | "codex"
  | "claude"
  | "usage-desk"
  | "settings"
  | "design-system"
  | "debug";
export type AccountWorkspace = "all";
export type CodexLiveSessionsView = "session" | "project";
export type CodexWorkspace =
  | "feature-config"
  | "binary-management"
  | "extension-registry"
  | "skills"
  | "mcp-servers"
  | "account-list"
  | "live-sessions"
  | "session-management"
  | "vendor-status"
  | "usage-codex"
  | "doctor-workbench";
export type ClaudeWorkspace =
  | "account-list"
  | "skills"
  | "mcp-servers"
  | "session-management"
  | "usage"
  | "settings"
  | "claude-md"
  | "subagents";
export type SessionManagementWorkspace = "codex" | "claude";
export type UsageDeskWorkspace = "codex" | "claude";

export type ThemeMode = "system" | "light" | "dark";

export type LocaleCode = "zh" | "en";

export type SidecarStatus = sidecar.Status;
export type ReleaseInfo = updater.ReleaseInfo;

export type AuthFile = main.AuthFileItem & {
  priority?: number;
  email?: string;
  planType?: string;
};
export type CodexQuota = main.CodexQuotaResponse;

export interface BillingDisplay {
  isAvailable: boolean;
  balances: {
    currency: string;
    totalBalance: string;
    grantedBalance: string;
    toppedUpBalance: string;
  }[];
}
export type CredentialSource = "auth-file" | "api-key";
export type AccountPlanType = string;

export type ApiFormat =
  | "anthropic"
  | "openai_chat"
  | "openai_responses"
  | "gemini_native";

export interface AccountRecord {
  id: string;
  accountKind?: "auth-file" | "codex-api-key" | "openai-compatible" | string;
  provider: string;
  credentialSource: CredentialSource;
  displayName: string;
  status: string;
  statusMessage?: string;
  runtimeStatus?: string;
  runtimeReason?: string;
  runtimeFailureClass?: string;
  routeable?: boolean;
  registeredModelCount?: number;
  runtimeRepairOutcome?: string;
  runtimeRepairAction?: string;
  runtimeRepairTriggerStatus?: string;
  runtimeRepairTriggerClass?: string;
  runtimeRepairTriggerReason?: string;
  lastRuntimeRepairAtUnixMs?: number;
  priority?: number;
  disabled?: boolean;
  email?: string;
  planType?: string;
  name?: string;
  apiKey?: string;
  apiKeys?: string[];
  headers?: Record<string, string>;
  keyFingerprint?: string;
  keySuffix?: string;
  baseUrl?: string;
  prefix?: string;
  proxyUrl?: string;
  authIndex?: unknown;
  quotaKey?: string;
  quotaCurl?: string;
  quotaEnabled?: boolean;
  localOnly?: boolean;
  supportedFormats?: ApiFormat[];
  formatBaseUrls?: Partial<Record<ApiFormat, string>>;
  models?: Array<{ name: string; alias?: string }>;
  billingCurl?: string;
  billingEnabled?: boolean;
  platformCookie?: string;
  curlVariables?: Record<string, string>;
  modelFetchApiKey?: string;
  modelFetchBaseUrl?: string;
  requestability?: {
    evidence?: string[];
    manual?: boolean;
  };
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
