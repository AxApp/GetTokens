import { useCallback, useState } from 'react';
import {
  AddQuotaCalibration,
  ListQuotaCalibrations,
  RevokeQuotaCalibration,
} from '../../../../wailsjs/go/main/App';
import type { QuotaUsageCalibration, QuotaUsageCalibrationInput } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { normalizeQuotaCalibrations } from '../model/quotaCalibration';
import type { TrackRequest } from '../model/types';

export default function useQuotaCalibrations(trackRequest: TrackRequest) {
  const [quotaCalibrationsByAccountKey, setQuotaCalibrationsByAccountKey] = useState<
    Record<string, QuotaUsageCalibration[]>
  >({});

  const loadQuotaCalibrations = useCallback(
    async (accountKey: string) => {
      const key = String(accountKey || '').trim();
      if (!key) {
        return [] as QuotaUsageCalibration[];
      }
      if (!hasWailsAppBindings()) {
        setQuotaCalibrationsByAccountKey((prev) => ({ ...prev, [key]: [] }));
        return [] as QuotaUsageCalibration[];
      }
      const items = normalizeQuotaCalibrations(
        await trackRequest('ListQuotaCalibrations', { accountKey: key }, () => ListQuotaCalibrations(key)),
      );
      setQuotaCalibrationsByAccountKey((prev) => ({ ...prev, [key]: items }));
      return items;
    },
    [trackRequest],
  );

  const addQuotaCalibration = useCallback(
    async (input: QuotaUsageCalibrationInput) => {
      const accountKey = String(input.accountKey || '').trim();
      if (!accountKey) {
        return null;
      }
      if (!hasWailsAppBindings()) {
        return null;
      }
      const item = await trackRequest('AddQuotaCalibration', { accountKey }, () => AddQuotaCalibration(input));
      const normalized = normalizeQuotaCalibrations([item])[0];
      if (normalized) {
        setQuotaCalibrationsByAccountKey((prev) => ({
          ...prev,
          [accountKey]: [normalized, ...(prev[accountKey] || []).filter((existing) => existing.id !== normalized.id)],
        }));
      }
      return normalized || null;
    },
    [trackRequest],
  );

  const revokeQuotaCalibration = useCallback(
    async (id: string, accountKey?: string) => {
      const calibrationID = String(id || '').trim();
      if (!calibrationID || !hasWailsAppBindings()) {
        return null;
      }
      const item = await trackRequest('RevokeQuotaCalibration', { id: calibrationID }, () =>
        RevokeQuotaCalibration(calibrationID),
      );
      const normalized = normalizeQuotaCalibrations([item])[0];
      const key = String(accountKey || normalized?.accountKey || '').trim();
      if (key) {
        setQuotaCalibrationsByAccountKey((prev) => ({
          ...prev,
          [key]: (prev[key] || []).map((existing) => (existing.id === calibrationID && normalized ? normalized : existing)),
        }));
      }
      return normalized || null;
    },
    [trackRequest],
  );

  return {
    quotaCalibrationsByAccountKey,
    loadQuotaCalibrations,
    addQuotaCalibration,
    revokeQuotaCalibration,
  };
}
