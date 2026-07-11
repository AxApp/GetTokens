import { useCallback, useRef, useState } from 'react';
import { GetAllRateLimitStatuses, ListRateLimitStrategies } from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { getAccountsPreviewRateLimitByID } from '../previewData';
import {
  DEFAULT_RATE_LIMIT_STRATEGIES,
  buildRateLimitStatusMap,
  type RateLimitState,
  type RateLimitStrategyMeta,
} from '../model/rateLimit';
import type { TrackRequest } from '../model/types';

export default function useAccountsRateLimitState(trackRequest: TrackRequest) {
  const [accountRateLimitByID, setAccountRateLimitByID] = useState<Record<string, RateLimitState>>({});
  const [rateLimitStrategies, setRateLimitStrategies] = useState<RateLimitStrategyMeta[]>(DEFAULT_RATE_LIMIT_STRATEGIES);
  const [rateLimitRefreshingAccountIDSet, setRateLimitRefreshingAccountIDSet] = useState<Set<string>>(new Set());
  const rateLimitStrategiesRequestRef = useRef<Promise<void> | null>(null);

  const loadRateLimitStrategies = useCallback(() => {
    if (rateLimitStrategiesRequestRef.current) {
      return rateLimitStrategiesRequestRef.current;
    }

    const request = trackRequest<any>('ListRateLimitStrategies', { args: [] }, () => ListRateLimitStrategies())
      .then((strategies) => {
        setRateLimitStrategies(
          Array.isArray(strategies) && strategies.length > 0 ? strategies : DEFAULT_RATE_LIMIT_STRATEGIES,
        );
      })
      .catch((error) => {
        rateLimitStrategiesRequestRef.current = null;
        console.error(error);
      });
    rateLimitStrategiesRequestRef.current = request;
    return request;
  }, [trackRequest]);

  const loadAccountRateLimits = useCallback(
    async (accounts: AccountRecord[]) => {
      if (accounts.length === 0) {
        setAccountRateLimitByID({});
        return;
      }

      if (!hasWailsAppBindings()) {
        setRateLimitStrategies(DEFAULT_RATE_LIMIT_STRATEGIES);
        setAccountRateLimitByID(getAccountsPreviewRateLimitByID(accounts));
        return;
      }

      void loadRateLimitStrategies();
      try {
        const statuses = await trackRequest<any>('GetAllRateLimitStatuses', { args: [] }, () =>
          GetAllRateLimitStatuses(),
        );
        const statusMap = buildRateLimitStatusMap(statuses);
        const accountIDSet = new Set(accounts.map((account) => account.id));
        setAccountRateLimitByID(
          Object.fromEntries(Object.entries(statusMap).filter(([accountID]) => accountIDSet.has(accountID))),
        );
      } catch (error) {
        console.error(error);
        setAccountRateLimitByID({});
      }
    },
    [loadRateLimitStrategies, trackRequest],
  );

  const refreshAccountRateLimits = useCallback(
    async (accounts: AccountRecord[]) => {
      const accountIDs = accounts.map((account) => account.id).filter(Boolean);
      if (accountIDs.length === 0) return;

      const accountIDSet = new Set(accountIDs);
      const startedAt = Date.now();
      setRateLimitRefreshingAccountIDSet((prev) => new Set([...prev, ...accountIDs]));

      try {
        if (!hasWailsAppBindings()) {
          setRateLimitStrategies(DEFAULT_RATE_LIMIT_STRATEGIES);
          const previewMap = getAccountsPreviewRateLimitByID(accounts);
          setAccountRateLimitByID((prev) => ({ ...prev, ...previewMap }));
          return;
        }

        void loadRateLimitStrategies();
        const statuses = await trackRequest<any>('GetAllRateLimitStatuses', { args: [] }, () =>
          GetAllRateLimitStatuses(),
        );
        const statusMap = buildRateLimitStatusMap(statuses);
        setAccountRateLimitByID((prev) => ({
          ...prev,
          ...Object.fromEntries(Object.entries(statusMap).filter(([accountID]) => accountIDSet.has(accountID))),
        }));
      } catch (error) {
        console.error(error);
      } finally {
        const remainingFeedbackMs = Math.max(0, 350 - (Date.now() - startedAt));
        if (remainingFeedbackMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remainingFeedbackMs));
        }
        setRateLimitRefreshingAccountIDSet((prev) => {
          const next = new Set(prev);
          accountIDs.forEach((accountID) => next.delete(accountID));
          return next;
        });
      }
    },
    [loadRateLimitStrategies, trackRequest],
  );

  return {
    accountRateLimitByID,
    rateLimitRefreshingAccountIDSet,
    rateLimitStrategies,
    loadAccountRateLimits,
    refreshAccountRateLimits,
  };
}
