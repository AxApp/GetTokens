import type { AccountRecord } from './types';
import { resolveAccountPrimaryLabel } from './accountPresentation.ts';
import { ACCOUNT_CARD_IMPORT_SCHEMA } from './accountTransfer.ts';

export function buildAccountCardCopyText(account: AccountRecord): string {
  return resolveAccountPrimaryLabel(account);
}

export function buildAccountCardContentText(account: AccountRecord, authFileContent?: unknown): string {
  const payload = {
    schema: ACCOUNT_CARD_IMPORT_SCHEMA,
    credentialSource: account.credentialSource,
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
      account.credentialSource === 'api-key'
        ? {
            label: account.displayName || '',
            apiKey: account.apiKey || '',
            baseUrl: account.baseUrl || '',
            prefix: account.prefix || '',
          }
        : undefined,
  };

  return JSON.stringify(payload, null, 2);
}
