import type { main } from '../../../../wailsjs/go/models';
import { normalizeBaseUrl } from './accountConfig.ts';

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
  apiKey: string;
}

export interface OpenAICompatibleProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  apiKeyPlaceholder: string;
  models: OpenAICompatibleModelRow[];
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
  apiKey: '',
};

// Derived from Cherry Studio provider defaults and adapted to GetTokens'
// `/chat/completions` verification path expectations.
export const openAICompatibleProviderPresets: OpenAICompatibleProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'deepseek-chat', alias: 'Chat' },
      { name: 'deepseek-reasoner', alias: 'Reasoner' },
    ],
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'deepseek-ai/DeepSeek-V3.2', alias: 'DeepSeek V3.2' },
      { name: 'Qwen/Qwen3-8B', alias: 'Qwen3-8B' },
    ],
  },
  {
    id: 'zhipu',
    label: 'Zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'glm-5', alias: 'GLM-5' },
      { name: 'glm-4.7', alias: 'GLM-4.7' },
      { name: 'glm-4.5-flash', alias: 'GLM-4.5-Flash' },
    ],
  },
  {
    id: 'moonshot',
    label: 'Moonshot AI',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'moonshot-v1-auto', alias: 'Moonshot Auto' },
      { name: 'kimi-k2.5', alias: 'Kimi K2.5' },
      { name: 'kimi-k2-thinking', alias: 'Kimi Thinking' },
    ],
  },
  {
    id: 'dashscope',
    label: 'DashScope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'qwen3.5-plus', alias: 'Qwen3.5-Plus' },
      { name: 'qwen3.5-flash', alias: 'Qwen3.5-Flash' },
      { name: 'deepseek-v3.2', alias: 'DeepSeek V3.2' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'sk-or-...',
    models: [
      { name: 'deepseek/deepseek-chat', alias: 'DeepSeek V3' },
      { name: 'google/gemini-2.5-flash-preview', alias: 'Gemini 2.5 Flash' },
      { name: 'qwen/qwen-2.5-7b-instruct:free', alias: 'Qwen 2.5 7B' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyPlaceholder: 'gsk_...',
    models: [
      { name: 'llama3-8b-8192', alias: 'LLaMA3 8B' },
      { name: 'llama3-70b-8192', alias: 'LLaMA3 70B' },
      { name: 'mistral-saba-24b', alias: 'Mistral Saba 24B' },
    ],
  },
  {
    id: 'together',
    label: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo', alias: 'Llama 3.2 11B Vision' },
      { name: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo', alias: 'Llama 3.2 90B Vision' },
      { name: 'google/gemma-2-27b-it', alias: 'Gemma 2 27B' },
    ],
  },
  {
    id: 'doubao',
    label: 'Doubao',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'doubao-seed-1-8-251228', alias: 'Doubao Seed 1.8' },
      { name: 'doubao-1-5-pro-32k-250115', alias: 'Doubao 1.5 Pro 32K' },
      { name: 'deepseek-r1-250120', alias: 'DeepSeek R1' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: [
      { name: 'gpt-5.4', alias: 'GPT 5.4' },
      { name: 'gpt-5.2', alias: 'GPT 5.2' },
      { name: 'gpt-5-chat', alias: 'GPT 5 Chat' },
    ],
  },
];

export function getOpenAICompatibleProviderPreset(presetID: string): OpenAICompatibleProviderPreset | null {
  const preset = openAICompatibleProviderPresets.find((item) => item.id === presetID);
  return preset || null;
}

export function applyOpenAICompatibleProviderPreset(
  form: OpenAICompatibleProviderFormState,
  presetID: string,
): OpenAICompatibleProviderFormState {
  const preset = getOpenAICompatibleProviderPreset(presetID);
  if (!preset) {
    return form;
  }

  return {
    ...form,
    name: preset.id,
    baseUrl: preset.baseUrl,
  };
}

export function resolveOpenAICompatibleProviderPresetID(input: {
  name?: string;
  baseUrl?: string;
}): string {
  const normalizedName = String(input.name || '').trim().toLowerCase();
  const normalizedBaseURL = normalizeBaseUrl(String(input.baseUrl || ''));

  const preset = openAICompatibleProviderPresets.find((item) => {
    if (normalizedName && item.id === normalizedName) {
      return true;
    }
    return normalizedBaseURL !== '' && normalizeBaseUrl(item.baseUrl) === normalizedBaseURL;
  });

  return preset?.id || '';
}

export function resolveOpenAICompatibleProviderPreset(input: {
  name?: string;
  baseUrl?: string;
}): OpenAICompatibleProviderPreset | null {
  const presetID = resolveOpenAICompatibleProviderPresetID(input);
  return getOpenAICompatibleProviderPreset(presetID);
}

export function buildOpenAICompatibleProviderDraft(
  provider: OpenAICompatibleProvider,
  verifyState?: ProviderVerifyState,
): OpenAICompatibleProviderDraft {
  const models = buildModelRows(provider.models);
  const preset = resolveOpenAICompatibleProviderPreset({
    name: provider.name,
    baseUrl: provider.baseUrl,
  });
  return {
    currentName: provider.name,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey || '',
    apiKeys: provider.apiKeys && provider.apiKeys.length > 0 ? [...provider.apiKeys] : provider.apiKey ? [provider.apiKey] : [''],
    headers: buildHeaderRows(provider.headers),
    models,
    verifyModel: verifyState?.model || models[0]?.name || preset?.models[0]?.name || '',
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
