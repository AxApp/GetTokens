import type { AccountRecord } from '../../types';
import type { OpenAICompatibleProvider } from '../accounts/model/openAICompatible.ts';
import { buildCodexAccountRows, type CodexAccountRow } from './model/codexAccountList.ts';

const PREVIEW_ACCOUNTS: AccountRecord[] = [
  {
    id: 'auth-file:codex-pro.json',
    provider: 'codex',
    credentialSource: 'auth-file',
    displayName: 'codex-pro.json',
    status: 'active',
    priority: 8,
    email: 'team-pro@example.com',
    planType: 'pro',
    name: 'codex-pro.json',
    quotaKey: 'codex-pro.json',
  },
  {
    id: 'codex-api-key:preview-prod',
    provider: 'codex',
    credentialSource: 'api-key',
    displayName: 'Prod Relay Key',
    status: 'configured',
    priority: 6,
    baseUrl: 'https://api.openai.com/v1',
    keySuffix: '9A2B',
  },
  {
    id: 'auth-file:expired-preview.json',
    provider: 'codex',
    credentialSource: 'auth-file',
    displayName: 'expired-preview.json',
    status: 'error',
    statusMessage: 'refresh token expired',
    priority: 2,
    name: 'expired-preview.json',
  },
];

const PREVIEW_PROVIDERS: OpenAICompatibleProvider[] = [
  previewProvider({
    name: 'deepseek',
    priority: 10,
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: 'sk-preview-deepseek',
    keyCount: 1,
    modelCount: 2,
    models: [
      { alias: 'codex-deepseek', name: 'deepseek-chat' },
      { alias: 'codex-reasoner', name: 'deepseek-reasoner' },
    ],
  }),
  previewProvider({
    name: 'openrouter',
    priority: 4,
    disabled: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'sk-or-preview',
    keyCount: 1,
    modelCount: 2,
    models: [
      { alias: 'codex-kimi', name: 'moonshotai/kimi-k2' },
      { alias: '', name: 'openai/gpt-5.4-mini' },
    ],
  }),
];

export function getCodexAccountListPreviewRows(): CodexAccountRow[] {
  return buildCodexAccountRows({
    accounts: PREVIEW_ACCOUNTS,
    providers: PREVIEW_PROVIDERS,
  });
}

function previewProvider(input: Omit<OpenAICompatibleProvider, 'convertValues'>): OpenAICompatibleProvider {
  return {
    ...input,
    convertValues(value: unknown) {
      return value;
    },
  } as OpenAICompatibleProvider;
}
