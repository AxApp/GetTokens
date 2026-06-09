import type { AccountRecord } from './types';

export type AccountDetailModuleID =
  | 'credentials'
  | 'auth-file-actions'
  | 'models'
  | 'model-probe'
  | 'rate-limit'
  | 'quota'
  | 'billing';

export function buildAccountDetailModulePlan(account: Pick<AccountRecord, 'credentialSource'>): AccountDetailModuleID[] {
  if (account.credentialSource === 'api-key') {
    return ['credentials', 'models', 'rate-limit', 'quota', 'billing'];
  }

  if (account.credentialSource === 'auth-file') {
    return ['auth-file-actions', 'models', 'model-probe', 'rate-limit'];
  }

  return ['rate-limit'];
}
