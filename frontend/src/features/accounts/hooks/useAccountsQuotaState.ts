import { useCallback, useRef, useState } from 'react';
import { GetCodexQuota } from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import { isCodexAuthFile, supportsQuota } from '../model/accountQuota';
import type { AuthFile, CodexQuotaState, TrackRequest } from '../model/types';

export default function useAccountsQuotaState(trackRequest: TrackRequest) {
  const [codexQuotaByName, setCodexQuotaByName] = useState<Record<string, CodexQuotaState>>({});
  const quotaRequestIdRef = useRef(0);

  const loadCodexQuotas = useCallback(
    async (items: AuthFile[]) => {
      const codexAccounts = items.filter((account) => isCodexAuthFile(account));
      quotaRequestIdRef.current += 1;
      const requestID = quotaRequestIdRef.current;

      if (codexAccounts.length === 0) {
        setCodexQuotaByName({});
        return;
      }

      setCodexQuotaByName(
        codexAccounts.reduce<Record<string, CodexQuotaState>>((result, account) => {
          result[account.name] = { status: 'loading' };
          return result;
        }, {})
      );

      const results = await Promise.all(
        codexAccounts.map(async (account) => {
          try {
            const quota = await trackRequest('GetCodexQuota', { name: account.name }, () =>
              GetCodexQuota(account.name)
            );
            return [account.name, { status: 'success', quota } satisfies CodexQuotaState] as const;
          } catch (error) {
            console.error(error);
            return [account.name, { status: 'error' } satisfies CodexQuotaState] as const;
          }
        })
      );

      if (quotaRequestIdRef.current !== requestID) {
        return;
      }

      setCodexQuotaByName(
        results.reduce<Record<string, CodexQuotaState>>((result, [name, state]) => {
          result[name] = state;
          return result;
        }, {})
      );
    },
    [trackRequest]
  );

  const refreshCodexQuota = useCallback(
    async (account: AccountRecord) => {
      if (!supportsQuota(account) || !account.quotaKey) {
        return;
      }

      setCodexQuotaByName((prev) => ({
        ...prev,
        [account.quotaKey!]: { status: 'loading' },
      }));

      try {
        const quota = await trackRequest('GetCodexQuota', { name: account.quotaKey }, () =>
          GetCodexQuota(account.quotaKey!)
        );
        setCodexQuotaByName((prev) => ({
          ...prev,
          [account.quotaKey!]: { status: 'success', quota },
        }));
      } catch (error) {
        console.error(error);
        setCodexQuotaByName((prev) => ({
          ...prev,
          [account.quotaKey!]: { status: 'error' },
        }));
      }
    },
    [trackRequest]
  );

  return {
    codexQuotaByName,
    loadCodexQuotas,
    refreshCodexQuota,
  };
}
