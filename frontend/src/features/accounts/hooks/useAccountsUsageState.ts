import { useCallback, useState } from 'react';
import { GetSidecarUsageAttribution } from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { buildAccountUsageSummaryMap, buildFailedAccountUsageSummaryMap, type AccountUsageSummary } from '../model/accountUsage';
import { getAccountsPreviewUsageByID } from '../previewData';
import type { TrackRequest } from '../model/types';

export default function useAccountsUsageState(trackRequest: TrackRequest) {
  const [accountUsageByID, setAccountUsageByID] = useState<Record<string, AccountUsageSummary>>({});
  const [usageRefreshingAccountIDSet, setUsageRefreshingAccountIDSet] = useState<Set<string>>(new Set());

  const loadAccountUsage = useCallback(
    async (
      accounts: AccountRecord[],
      options: {
        showRefreshing?: boolean;
        merge?: boolean;
        includeUnresolved?: boolean;
        resolveAccountKeys?: boolean;
      } = {},
    ) => {
      if (accounts.length === 0) {
        if (!options.merge) {
          setAccountUsageByID({});
        }
        return;
      }

      const accountIDs = accounts.map((account) => account.id).filter(Boolean);
      const startedAt = Date.now();
      const showRefreshing = options.showRefreshing === true && accountIDs.length > 0;
      const mergeUsage = options.merge === true;
      const shouldResolveAccountKeys = options.resolveAccountKeys === true;
      const includeUnresolved = options.includeUnresolved ?? !shouldResolveAccountKeys;
      if (showRefreshing) {
        setUsageRefreshingAccountIDSet((prev) => new Set([...prev, ...accountIDs]));
      }

      try {
        if (!hasWailsAppBindings()) {
          const previewMap = getAccountsPreviewUsageByID(accounts);
          setAccountUsageByID((prev) => (mergeUsage ? { ...prev, ...previewMap } : previewMap));
          return;
        }

        const attribution = await trackRequest<any>(
          'GetSidecarUsageAttribution',
          { args: [{ window: '24h', bucket: '1h', includeUnresolved, resolveAccountKeys: shouldResolveAccountKeys }] },
          () =>
            GetSidecarUsageAttribution({
              window: '24h',
              bucket: '1h',
              includeUnresolved,
              resolveAccountKeys: shouldResolveAccountKeys,
            }),
        );
        const hasAttributionData = Array.isArray(attribution?.items) && attribution.items.length > 0;
        if (hasAttributionData) {
          const usageMap = buildAccountUsageSummaryMap(accounts, attribution);
          setAccountUsageByID((prev) => (mergeUsage ? { ...prev, ...usageMap } : usageMap));
          return;
        }
        const usageMap = buildAccountUsageSummaryMap(accounts, attribution);
        setAccountUsageByID((prev) => (mergeUsage ? { ...prev, ...usageMap } : usageMap));
      } catch (error) {
        console.error(error);
        setAccountUsageByID((prev) => {
          const usageMap = buildFailedAccountUsageSummaryMap(accounts, mergeUsage ? prev : {}, error);
          return mergeUsage ? { ...prev, ...usageMap } : usageMap;
        });
      } finally {
        if (showRefreshing) {
          const remainingFeedbackMs = Math.max(0, 350 - (Date.now() - startedAt));
          if (remainingFeedbackMs > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, remainingFeedbackMs));
          }
          setUsageRefreshingAccountIDSet((prev) => {
            const next = new Set(prev);
            accountIDs.forEach((accountID) => next.delete(accountID));
            return next;
          });
        }
      }
    },
    [trackRequest]
  );

  const refreshAccountUsage = useCallback(
    async (accounts: AccountRecord[]) => {
      await loadAccountUsage(accounts, { showRefreshing: true, merge: true });
    },
    [loadAccountUsage],
  );

  return {
    accountUsageByID,
    usageRefreshingAccountIDSet,
    loadAccountUsage,
    refreshAccountUsage,
  };
}
