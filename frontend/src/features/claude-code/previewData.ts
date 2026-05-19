import type { AccountRecord } from '../../types.ts';
import { buildClaudeCodeAccountRows, type ClaudeCodeAccountRow } from './model/claudeCodeAccountList.ts';

type PreviewAccountRecord = AccountRecord & {
  models?: Array<{ name: string; alias: string }>;
};

const PREVIEW_ACCOUNTS: PreviewAccountRecord[] = [
  {
    id: 'codex-api-key:deepseek-claude',
    provider: 'deepseek',
    credentialSource: 'api-key',
    displayName: 'DeepSeek Claude Code',
    status: 'configured',
    priority: 40,
    apiKey: 'sk-preview-deepseek',
    keySuffix: 'DSEK',
    baseUrl: 'https://api.deepseek.com',
    formatBaseUrls: {
      anthropic: 'https://api.deepseek.com/anthropic',
    },
    supportedFormats: ['anthropic', 'openai_chat'],
    models: [
      { name: 'deepseek-v4-pro[1m]', alias: 'claude-sonnet-4-6' },
      { name: 'deepseek-v4-pro[1m]', alias: 'claude-opus-4-7' },
      { name: 'deepseek-v4-flash', alias: 'claude-haiku-4-5' },
    ],
  },
  {
    id: 'codex-api-key:bailian-coding-plan',
    provider: 'bailian',
    credentialSource: 'api-key',
    displayName: '百炼 Coding Plan',
    status: 'configured',
    priority: 30,
    apiKey: 'sk-preview-bailian',
    keySuffix: 'BLAN',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    formatBaseUrls: {
      anthropic: 'https://dashscope.aliyuncs.com/api/v2/apps/claude-code',
    },
    supportedFormats: ['anthropic'],
    models: [
      { name: 'qwen3.6-plus', alias: 'claude-sonnet-4-6' },
      { name: 'qwen3.6-flash', alias: 'claude-haiku-4-5' },
    ],
  },
  {
    id: 'codex-api-key:mimo-shared',
    provider: 'mimo',
    credentialSource: 'api-key',
    displayName: 'Xiaomi MiMo Shared',
    status: 'configured',
    priority: 20,
    apiKey: 'sk-preview-mimo',
    keySuffix: 'MIMO',
    baseUrl: 'https://platform.xiaomimimo.com/v1',
    supportedFormats: ['anthropic', 'openai_chat'],
    models: [{ name: 'mimo-v2.5-pro', alias: 'claude-sonnet-4-6' }],
  },
  {
    id: 'codex-api-key:minimax-disabled',
    provider: 'minimax',
    credentialSource: 'api-key',
    displayName: 'MiniMax Backup',
    status: 'configured',
    priority: 10,
    disabled: true,
    apiKey: 'sk-preview-minimax',
    keySuffix: 'MINI',
    baseUrl: 'https://api.minimax.chat/v1',
    supportedFormats: ['anthropic'],
    models: [{ name: 'MiniMax-M2.7', alias: 'claude-opus-4-5' }],
  },
  {
    id: 'codex-api-key:gemini-native',
    provider: 'gemini',
    credentialSource: 'api-key',
    displayName: 'Gemini Native',
    status: 'configured',
    priority: 5,
    apiKey: 'sk-preview-gemini',
    keySuffix: 'GEMI',
    baseUrl: 'https://generativelanguage.googleapis.com',
    supportedFormats: ['gemini_native'],
  },
];

export function getClaudeCodeAccountListPreviewAccounts(): AccountRecord[] {
  return PREVIEW_ACCOUNTS.map((account) => ({
    ...account,
    formatBaseUrls: account.formatBaseUrls ? { ...account.formatBaseUrls } : undefined,
    supportedFormats: account.supportedFormats ? [...account.supportedFormats] : undefined,
    models: account.models ? account.models.map((model) => ({ ...model })) : undefined,
  }));
}

export function getClaudeCodeAccountListPreviewRows(): ClaudeCodeAccountRow[] {
  return buildClaudeCodeAccountRows(getClaudeCodeAccountListPreviewAccounts());
}
