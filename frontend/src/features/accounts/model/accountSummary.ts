import type { AccountRecord } from '../../../types';

export function sanitizeAccountSummaryPatch(patch: Partial<AccountRecord>): Partial<AccountRecord> {
  return {
    ...patch,
    detailLoaded: false,
    apiKey: undefined,
    apiKeys: undefined,
    headers: undefined,
    proxyUrl: undefined,
    authIndex: undefined,
    quotaCurl: undefined,
    billingCurl: undefined,
    platformCookie: undefined,
    curlVariables: undefined,
    modelFetchApiKey: undefined,
    modelFetchBaseUrl: undefined,
  };
}
