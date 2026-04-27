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

export interface OpenAICompatibleHeaderRow {
  key: string;
  value: string;
}

export interface OpenAICompatibleModelRow {
  name: string;
  alias: string;
}

export interface OpenAICompatibleProviderDraft extends OpenAICompatibleProviderFormState {
  currentName: string;
  apiKeys: string[];
  headers: OpenAICompatibleHeaderRow[];
  models: OpenAICompatibleModelRow[];
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
  const models = buildModelRows(provider.models);
  return {
    currentName: provider.name,
    name: provider.name,
    baseUrl: provider.baseUrl,
    prefix: provider.prefix || '',
    apiKey: provider.apiKey || '',
    apiKeys: provider.apiKeys && provider.apiKeys.length > 0 ? [...provider.apiKeys] : provider.apiKey ? [provider.apiKey] : [''],
    headers: buildHeaderRows(provider.headers),
    models,
    verifyModel: verifyState?.model || models[0]?.name || '',
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

export function buildHeaderRows(headers: Record<string, string> | undefined): OpenAICompatibleHeaderRow[] {
  const entries = Object.entries(headers || {});
  if (entries.length === 0) {
    return [{ key: '', value: '' }];
  }
  return entries.map(([key, value]) => ({ key, value }));
}

export function normalizeProviderAPIKeys(apiKeys: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of apiKeys) {
    const trimmed = String(item || '').trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function buildHeadersMap(rows: OpenAICompatibleHeaderRow[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of rows) {
    const key = String(row.key || '').trim();
    const value = String(row.value || '').trim();
    if (!key || !value) {
      continue;
    }
    headers[key] = value;
  }
  return headers;
}

export function buildModelRows(models: Array<{ name: string; alias?: string }> | undefined): OpenAICompatibleModelRow[] {
  if (!models || models.length === 0) {
    return [{ name: '', alias: '' }];
  }
  return models.map((model) => ({
    name: String(model.name || ''),
    alias: String(model.alias || ''),
  }));
}

export function normalizeProviderModels(rows: OpenAICompatibleModelRow[]): OpenAICompatibleModelRow[] {
  const normalized: OpenAICompatibleModelRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const alias = String(row.alias || '').trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    normalized.push({ name, alias });
  }
  return normalized;
}
