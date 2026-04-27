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

export interface OpenAICompatibleProviderDraft extends OpenAICompatibleProviderFormState {
  currentName: string;
  verifyModel: string;
}

export const emptyOpenAICompatibleProviderForm: OpenAICompatibleProviderFormState = {
  name: '',
  baseUrl: '',
  prefix: '',
  apiKey: '',
};

export function buildOpenAICompatibleProviderDraft(
  provider: OpenAICompatibleProvider,
  verifyState?: ProviderVerifyState,
): OpenAICompatibleProviderDraft {
  return {
    currentName: provider.name,
    name: provider.name,
    baseUrl: provider.baseUrl,
    prefix: provider.prefix || '',
    apiKey: provider.apiKey || '',
    verifyModel: verifyState?.model || '',
  };
}

export function renameProviderVerifyState(
  states: Record<string, ProviderVerifyState>,
  previousName: string,
  nextName: string,
): Record<string, ProviderVerifyState> {
  if (!previousName || !nextName || previousName === nextName || !states[previousName]) {
    return states;
  }

  const nextStates = { ...states };
  nextStates[nextName] = nextStates[previousName];
  delete nextStates[previousName];
  return nextStates;
}

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
