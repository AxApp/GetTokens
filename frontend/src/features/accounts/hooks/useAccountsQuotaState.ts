import { useCallback, useRef, useState } from 'react';
import { GetCodexQuota } from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { beginQuotaRefreshState, failQuotaRefreshState, supportsQuota } from '../model/accountQuota';
import { persistAccountQuotaStates, readStoredAccountQuotaStates } from '../model/accountQuotaCache';
import { getAccountsPreviewQuotaStateByKey } from '../previewData';
import type { CodexQuotaState, TrackRequest } from '../model/types';

export default function useAccountsQuotaState(trackRequest: TrackRequest) {
  const [codexQuotaByName, setCodexQuotaByName] = useState<Record<string, CodexQuotaState>>({});
  const quotaRequestIdRef = useRef(0);

  const loadCodexQuotas = useCallback(
    async (items: AccountRecord[]) => {
      if (!hasWailsAppBindings()) {
        setCodexQuotaByName(getAccountsPreviewQuotaStateByKey(items));
        return;
      }

      const codexAccounts = items.filter((account) => supportsQuota(account) && account.quotaKey);
      const quotaKeys = codexAccounts.map((account) => account.quotaKey!);
      const cachedQuotaByName = readStoredAccountQuotaStates(
        typeof window === 'undefined' ? null : window.localStorage,
        quotaKeys,
      );
      quotaRequestIdRef.current += 1;
      const requestID = quotaRequestIdRef.current;

      if (codexAccounts.length === 0) {
        setCodexQuotaByName({});
        return;
      }

      setCodexQuotaByName(
        codexAccounts.reduce<Record<string, CodexQuotaState>>((result, account) => {
          result[account.quotaKey!] = beginQuotaRefreshState(cachedQuotaByName[account.quotaKey!]);
          return result;
        }, {})
      );

      const results = await Promise.all(
        codexAccounts.map(async (account) => {
          try {
            const quota = await trackRequest('GetCodexQuota', { name: account.quotaKey }, () =>
              GetCodexQuota(account.quotaKey!)
            );
            return [account.quotaKey!, { status: 'success', quota } satisfies CodexQuotaState] as const;
          } catch (error) {
            console.error(error);
            return [
              account.quotaKey!,
              failQuotaRefreshState(cachedQuotaByName[account.quotaKey!]) satisfies CodexQuotaState,
            ] as const;
          }
        })
      );

      if (quotaRequestIdRef.current !== requestID) {
        return;
      }

      const nextQuotaByName = results.reduce<Record<string, CodexQuotaState>>(
        (result, [name, state]) => {
          result[name] = state;
          return result;
        },
        {},
      );
      setCodexQuotaByName(nextQuotaByName);
      persistAccountQuotaStates(typeof window === 'undefined' ? null : window.localStorage, nextQuotaByName);
    },
    [trackRequest]
  );

  const refreshCodexQuota = useCallback(
    async (account: AccountRecord) => {
      if (!hasWailsAppBindings()) {
        setCodexQuotaByName((prev) => ({
          ...prev,
          ...getAccountsPreviewQuotaStateByKey([account]),
        }));
        return;
      }

      if (!supportsQuota(account) || !account.quotaKey) {
        return;
      }

      setCodexQuotaByName((prev) => ({
        ...prev,
        [account.quotaKey!]: beginQuotaRefreshState(prev[account.quotaKey!]),
      }));

      try {
        const quota = await trackRequest('GetCodexQuota', { name: account.quotaKey }, () =>
          GetCodexQuota(account.quotaKey!)
        );
        setCodexQuotaByName((prev) => {
          const nextQuotaByName = {
            ...prev,
            [account.quotaKey!]: { status: 'success', quota } satisfies CodexQuotaState,
          };
          persistAccountQuotaStates(typeof window === 'undefined' ? null : window.localStorage, nextQuotaByName);
          return nextQuotaByName;
        });
      } catch (error) {
        console.error(error);
        setCodexQuotaByName((prev) => ({
          ...prev,
          [account.quotaKey!]: failQuotaRefreshState(prev[account.quotaKey!]),
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
