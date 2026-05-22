import type { AccountRecord, AuthFile, CodexQuota, CredentialSource } from '../../../types';

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
  resetLabel: string;
  resetAtUnix?: number;
}

export interface QuotaDisplay {
  status: 'unsupported' | 'loading' | 'error' | 'empty' | 'success';
  planType: string;
  windows: QuotaWindowDisplay[];
  refreshing?: boolean;
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
}

export interface ClickEventLike {
  stopPropagation: () => void;
}

export interface AccountGroup {
  id: string;
  label: string;
  rank: number;
  accounts: AccountRecord[];
}

export type AccountsFilterSource = 'all' | 'none' | CredentialSource;
export type AccountsAvailabilityFilter = 'all' | 'requestable' | 'disabled' | 'errors';

export interface AccountsFilterState {
  source: AccountsFilterSource;
  availability: AccountsAvailabilityFilter;
  hasBalance: boolean;
  hasLongestQuota: boolean;
}

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
