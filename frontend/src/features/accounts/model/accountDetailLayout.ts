import type { AccountRecord } from './types';

export type AccountDetailModuleID =
  | 'runtime'
  | 'credentials'
  | 'auth-file-actions'
  | 'models'
  | 'model-probe'
  | 'rate-limit'
  | 'quota'
  | 'billing';

export function buildAccountDetailModulePlan(account: Pick<AccountRecord, 'credentialSource'>): AccountDetailModuleID[] {
  if (account.credentialSource === 'api-key') {
    return ['runtime', 'credentials', 'models', 'rate-limit', 'quota', 'billing'];
  }

  if (account.credentialSource === 'auth-file') {
    return ['runtime', 'auth-file-actions', 'models', 'model-probe', 'rate-limit', 'quota'];
  }

  return ['runtime', 'rate-limit'];
}
