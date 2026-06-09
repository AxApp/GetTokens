import type { AccountRecord } from '../../../types';

export type AccountDeleteRequest =
  | { type: 'auth-file'; name: string }
  | { type: 'codex-api-key'; id: string }
  | { type: 'openai-compatible-provider'; name: string }
  | { type: 'missing-auth-file-name' }
  | { type: 'missing-openai-compatible-name' };

export function resolveAccountDeleteRequest(
  account: Pick<AccountRecord, 'accountKind' | 'credentialSource' | 'id' | 'name' | 'provider'>,
): AccountDeleteRequest {
  if (account.accountKind === 'openai-compatible') {
    const name = account.id.trim();
    return name
      ? { type: 'openai-compatible-provider', name }
      : { type: 'missing-openai-compatible-name' };
  }

  if (account.credentialSource === 'api-key') {
    return { type: 'codex-api-key', id: account.id };
  }

  if (!account.name) {
    return { type: 'missing-auth-file-name' };
  }

  return { type: 'auth-file', name: account.name };
}

export function removeDeletedAPIKeyRecord(
  records: AccountRecord[],
  deletedAccount: Pick<AccountRecord, 'credentialSource' | 'id'>,
): AccountRecord[] {
  if (deletedAccount.credentialSource !== 'api-key') {
    return records;
  }

  return records.filter((record) => record.id !== deletedAccount.id);
}

export function shouldClearDeletedSelectedAccount(
  selectedAccount: Pick<AccountRecord, 'credentialSource' | 'id' | 'name'> | null,
  deletedAccount: Pick<AccountRecord, 'credentialSource' | 'id' | 'name'>,
): boolean {
  if (!selectedAccount || selectedAccount.credentialSource !== deletedAccount.credentialSource) {
    return false;
  }
  return selectedAccount.id === deletedAccount.id;
}
