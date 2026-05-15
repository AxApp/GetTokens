import { useCallback, useState } from 'react';
import { GetSidecarUsageAttribution, GetUsageStatistics } from '../../../../wailsjs/go/main/App';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { buildAccountUsageSummaryMap, type AccountUsageSummary } from '../model/accountUsage';
import { getAccountsPreviewUsageByID } from '../previewData';
import type { TrackRequest } from '../model/types';

export default function useAccountsUsageState(trackRequest: TrackRequest) {
  const [accountUsageByID, setAccountUsageByID] = useState<Record<string, AccountUsageSummary>>({});

  const loadAccountUsage = useCallback(
    async (accounts: AccountRecord[]) => {
      if (accounts.length === 0) {
        setAccountUsageByID({});
        return;
      }

      if (!hasWailsAppBindings()) {
        setAccountUsageByID(getAccountsPreviewUsageByID(accounts));
        return;
      }

      try {
        const attribution = await trackRequest<any>(
          'GetSidecarUsageAttribution',
          { args: [{ window: '24h', bucket: '1h' }] },
          () => GetSidecarUsageAttribution({ window: '24h', bucket: '1h' }),
        );
        const hasAttributionData = Array.isArray(attribution?.items) && attribution.items.length > 0;
        if (hasAttributionData) {
          setAccountUsageByID(buildAccountUsageSummaryMap(accounts, attribution));
          return;
        }

        const response = await trackRequest<any>('GetUsageStatistics', { args: [] }, () => GetUsageStatistics());
        setAccountUsageByID(buildAccountUsageSummaryMap(accounts, response?.usage ?? response));
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
