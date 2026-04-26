import { useCallback, useState } from 'react';
import { GetUsageStatistics } from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import { buildAccountUsageSummaryMap, type AccountUsageSummary } from '../model/accountUsage';
import type { TrackRequest } from '../model/types';

export default function useAccountsUsageState(trackRequest: TrackRequest) {
  const [accountUsageByID, setAccountUsageByID] = useState<Record<string, AccountUsageSummary>>({});

  const loadAccountUsage = useCallback(
    async (accounts: AccountRecord[]) => {
      if (accounts.length === 0) {
        setAccountUsageByID({});
        return;
      }

      try {
        const response = await trackRequest<any>('GetUsageStatistics', { args: [] }, () => GetUsageStatistics());
        const usageData = response?.usage ?? response;
        setAccountUsageByID(buildAccountUsageSummaryMap(accounts, usageData));
      } catch (error) {
        console.error(error);
        setAccountUsageByID(buildAccountUsageSummaryMap(accounts, null));
      }
    },
    [trackRequest]
  );

  return {
    accountUsageByID,
    loadAccountUsage,
  };
}
