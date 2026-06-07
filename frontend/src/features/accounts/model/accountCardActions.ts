import type { AccountRecord } from './types';
import { ACCOUNT_CARD_IMPORT_SCHEMA } from './accountTransfer.ts';

export function buildAccountCardContentText(account: AccountRecord, authFileContent?: unknown): string {
  const isOpenAICompatible = account.accountKind === 'openai-compatible';
  const isCodexAPIKey = account.accountKind === 'codex-api-key';
  const credentialSource = isOpenAICompatible ? 'openai-compatible' : account.credentialSource;
  const openAICompatibleName = account.name || account.provider;
  const payload = {
    schema: ACCOUNT_CARD_IMPORT_SCHEMA,
    credentialSource,
    account: {
      id: account.id,
      provider: account.provider,
      displayName: account.displayName,
      status: account.status,
      statusMessage: account.statusMessage || undefined,
      disabled: Boolean(account.disabled),
      email: account.email || undefined,
      planType: account.planType || undefined,
      keyFingerprint: account.keyFingerprint || undefined,
      keySuffix: account.keySuffix || undefined,
      quotaKey: account.quotaKey || undefined,
      localOnly: Boolean(account.localOnly),
    },
    authFile:
      account.credentialSource === 'auth-file'
        ? {
            name: account.name || account.displayName || 'pasted-auth.json',
            content: authFileContent,
          }
        : undefined,
    codexAPIKey:
      isCodexAPIKey
        ? {
            label: account.displayName || '',
            apiKey: account.apiKey || '',
            baseUrl: account.baseUrl || '',
            prefix: account.prefix || '',
            supportedFormats: account.supportedFormats || [],
            formatBaseUrls: account.formatBaseUrls || {},
          }
        : undefined,
    openAICompatibleProvider: isOpenAICompatible
      ? {
          name: openAICompatibleName || account.provider || account.displayName || '',
          apiKey: account.apiKey || '',
          apiKeys: account.apiKeys || [],
          baseUrl: account.baseUrl || '',
          prefix: account.prefix || '',
          proxyUrl: account.proxyUrl || '',
          headers: account.headers || {},
          models: account.models || [],
          supportedFormats: account.supportedFormats || [],
          formatBaseUrls: account.formatBaseUrls || {},
        }
      : undefined,
  };

  return JSON.stringify(payload, null, 2);
}
