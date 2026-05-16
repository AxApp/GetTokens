import { useCallback, useEffect, useRef, useState } from 'react';
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
  const latestAccountsRef = useRef<AccountRecord[]>([]);

  const loadAccountRateLimits = useCallback(
    async (accounts: AccountRecord[]) => {
      latestAccountsRef.current = accounts;
      if (accounts.length === 0) {
        setAccountRateLimitByID({});
        return;
      }

      if (!hasWailsAppBindings()) {
        setRateLimitStrategies(DEFAULT_RATE_LIMIT_STRATEGIES);
        setAccountRateLimitByID(getAccountsPreviewRateLimitByID(accounts));
        return;
      }

      try {
        const [strategies, statuses] = await Promise.all([
          trackRequest<any>('ListRateLimitStrategies', { args: [] }, () => ListRateLimitStrategies()),
          trackRequest<any>('GetAllRateLimitStatuses', { args: [] }, () => GetAllRateLimitStatuses()),
        ]);
        setRateLimitStrategies(
          Array.isArray(strategies) && strategies.length > 0 ? strategies : DEFAULT_RATE_LIMIT_STRATEGIES,
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
    [trackRequest],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (latestAccountsRef.current.length > 0) {
        void loadAccountRateLimits(latestAccountsRef.current);
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadAccountRateLimits]);

  return {
    accountRateLimitByID,
    rateLimitStrategies,
    loadAccountRateLimits,
  };
}
