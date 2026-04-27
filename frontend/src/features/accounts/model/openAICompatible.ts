import type { main } from '../../../../wailsjs/go/models';

export type OpenAICompatibleProvider = main.OpenAICompatibleProvider;

export type ProviderVerifyStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ProviderVerifyState {
  model: string;
  status: ProviderVerifyStatus;
  message: string;
  lastVerifiedAt: number | null;
}

export interface OpenAICompatibleProviderFormState {
  name: string;
  baseUrl: string;
  prefix: string;
  apiKey: string;
}

export const emptyOpenAICompatibleProviderForm: OpenAICompatibleProviderFormState = {
  name: '',
  baseUrl: '',
  prefix: '',
  apiKey: '',
};

export function maskProviderAPIKey(apiKey: string | undefined): string {
  const trimmed = String(apiKey || '').trim();
  if (!trimmed) {
    return '—';
  }
  if (trimmed.length <= 8) {
    return trimmed;
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
