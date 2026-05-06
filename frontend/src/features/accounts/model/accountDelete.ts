import type { AccountRecord, AuthFile } from '../../../types';

export function removeDeletedAuthFile(files: AuthFile[], deletedAccount: Pick<AccountRecord, 'credentialSource' | 'name'>): AuthFile[] {
  if (deletedAccount.credentialSource !== 'auth-file' || !deletedAccount.name) {
    return files;
  }

  return files.filter((file) => file.name !== deletedAccount.name);
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

  if (deletedAccount.credentialSource === 'auth-file') {
    return Boolean(deletedAccount.name) && selectedAccount.name === deletedAccount.name;
  }

  return selectedAccount.id === deletedAccount.id;
}
