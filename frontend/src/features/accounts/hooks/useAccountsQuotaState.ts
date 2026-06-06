import { useCallback, useRef, useState } from 'react';
import { GetAllQuotaStatuses, GetCodexQuota } from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { beginQuotaRefreshState, failQuotaRefreshState, supportsQuota } from '../model/accountQuota';
import { persistAccountQuotaStates, readStoredAccountQuotaStates } from '../model/accountQuotaCache';
import { getAccountsPreviewQuotaStateByKey } from '../previewData';
import type { CodexQuotaState, TrackRequest } from '../model/types';

export default function useAccountsQuotaState(trackRequest: TrackRequest) {
  const [codexQuotaByName, setCodexQuotaByName] = useState<Record<string, CodexQuotaState>>({});
  const quotaRequestIdRef = useRef(0);

  const syncCodexQuotaStatuses = useCallback(
    async (items: AccountRecord[], options: { replace?: boolean } = {}) => {
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
        if (options.replace !== false) {
          setCodexQuotaByName({});
        }
        return;
      }

      let quotaStatuses: any[] = [];
      try {
        quotaStatuses = await trackRequest('GetAllQuotaStatuses', { args: [] }, () => GetAllQuotaStatuses());
      } catch (error) {
        console.error(error);
        if (Object.keys(cachedQuotaByName).length === 0) {
          return;
        }
      }

      if (quotaRequestIdRef.current !== requestID) {
        return;
      }

      const accountKeySet = new Set(quotaKeys);
      const runtimeQuotaByName = (quotaStatuses || []).reduce<Record<string, CodexQuotaState>>(
        (result, quota) => {
          const key = String(quota?.accountKey || '').trim();
          if (key && accountKeySet.has(key)) {
            result[key] = { status: 'success', quota } satisfies CodexQuotaState;
          }
          return result;
        }, {}
      );

      setCodexQuotaByName((prev) => {
        const nextQuotaByName = codexAccounts.reduce<Record<string, CodexQuotaState>>((result, account) => {
          const key = account.quotaKey!;
          result[key] =
            runtimeQuotaByName[key] ||
            cachedQuotaByName[key] ||
            prev[key] ||
            emptyRuntimeQuotaState(account);
          return result;
        }, {});
        const next = options.replace === false ? { ...prev, ...nextQuotaByName } : nextQuotaByName;
        persistAccountQuotaStates(typeof window === 'undefined' ? null : window.localStorage, next);
        return next;
      });
    },
    [trackRequest]
  );

  const loadCodexQuotas = useCallback(
    async (items: AccountRecord[]) => {
      await syncCodexQuotaStatuses(items);
    },
    [syncCodexQuotaStatuses],
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
          [account.quotaKey!]: failQuotaRefreshState(prev[account.quotaKey!], error),
        }));
      }
    },
    [trackRequest]
  );

  return {
    codexQuotaByName,
    loadCodexQuotas,
    syncCodexQuotaStatuses,
    refreshCodexQuota,
  };
}

function emptyRuntimeQuotaState(account: AccountRecord): CodexQuotaState {
  return {
    status: 'success',
    quota: {
      accountKey: account.quotaKey || account.id,
      status: 'stale',
      planType: account.planType || '',
      windows: [],
      stale: true,
      degradedReason: 'Quota runtime status has not been observed yet.',
      blocked: false,
      sources: [],
    } as any,
  };
}
