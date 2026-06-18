import type { AccountRecord, AuthFile, CodexQuota, AccountPlanType } from '../../../types';
import type { AccountGroupMode } from './accountListLayout';

export interface AccountsPageProps {
  sidecarStatus: {
    code: string;
  };
}

export interface TextInputEvent {
  target: {
    value: string;
  };
}

export interface CodexQuotaState {
  status: 'loading' | 'success' | 'error';
  quota?: CodexQuota;
  refreshing?: boolean;
}

export interface QuotaWindowDisplay {
  id: string;
  label: string;
  remainingPercent: number | null;
  usedLabel: string;
  usedTokens?: number;
  limitTokens?: number;
  remainingTokens?: number;
  resetLabel: string;
  resetAtUnix?: number;
}

export interface QuotaDisplay {
  status: 'unsupported' | 'loading' | 'error' | 'empty' | 'success';
  planType: string;
  windows: QuotaWindowDisplay[];
  fact?: QuotaFactDisplay;
  refreshing?: boolean;
  updatedAt?: string;
  lastEvaluatedAt?: string;
  blocked?: boolean;
  blockReason?: string;
  stale?: boolean;
  degradedReason?: string;
  sources?: QuotaSourceDisplay[];
}

export type QuotaFactState =
  | 'unsupported'
  | 'unknown'
  | 'available'
  | 'no-quota'
  | 'stale'
  | 'denied';

export type QuotaFactFreshness = 'fresh' | 'stale' | 'unknown';
export type QuotaFactConfidence = 'high' | 'medium' | 'low' | 'none';
export type QuotaFactRisk = 'none' | 'warning' | 'blocking' | 'denied' | 'unknown';

export interface QuotaFactDisplay {
  state: QuotaFactState;
  source?: string;
  freshness: QuotaFactFreshness;
  confidence: QuotaFactConfidence;
  risk: QuotaFactRisk;
  explanation?: string;
  observedAt?: string;
  expiresAt?: string;
  evidenceRefs?: string[];
}

export interface QuotaFactEvidenceView {
  stateLabel: string;
  sourceLabel: string;
  freshnessLabel: string;
  confidenceLabel: string;
  riskLabel: string;
  summary: string;
  explanation?: string;
  observedAt?: string;
  expiresAt?: string;
  evidenceRefs: string[];
}

export interface QuotaSourceDisplay {
  source: string;
  reason?: string;
  expiresAt?: string;
  nextReset?: string;
}

export interface AccountStabilitySummary {
  title: string;
  body: string;
  tone: 'positive' | 'warning' | 'neutral';
}

export interface ApiKeyFormState {
  label: string;
  apiKey: string;
  baseUrl: string;
  prefix: string;
  quotaCurl: string;
  quotaEnabled: boolean;
  platformCookie?: string;
  curlVariables?: Record<string, string>;
}

export interface ClickEventLike {
  stopPropagation: () => void;
}

export interface AccountGroup {
  id: string;
  label: string;
  rank: number;
  mode?: AccountGroupMode;
  accounts: AccountRecord[];
  meta?: {
    requestableCount: number;
    disabledCount: number;
    errorCount: number;
  };
}

export interface AccountsFilterState {
  source: {
    authFile: boolean;
    apiKey: boolean;
  };
  resource: {
    hasQuota: boolean;
    noQuota: boolean;
    hasBalance: boolean;
    noBalance: boolean;
    hasUsageToday: boolean;
    noUsageToday: boolean;
  };
  status: {
    error: boolean;
    disabled: boolean;
    requestable: boolean;
    requestStatusCodes: {
      [statusCode: string]: boolean;
    };
  };
  plan: {
    [planType: string]: boolean;
  };
}

export interface AccountActionNotice {
  tone: 'success' | 'warning' | 'error';
  message: string;
}

export type AccountsFilterPlan = AccountPlanType;

export type TrackRequest = <T>(
  name: string,
  request: unknown,
  executor: () => Promise<T>,
  options?: {
    transport?: 'wails' | 'http';
    mapSuccess?: (result: T) => unknown;
  }
) => Promise<T>;

export type Translator = (key: string) => string;
export type { AccountRecord, AuthFile };
