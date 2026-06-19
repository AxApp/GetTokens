import { useCallback, useState } from 'react';
import {
  CreateBudgetWindowDefinition,
  DeleteBudgetWindowDefinition,
  ListBudgetWindowDefinitions,
  PreviewBudgetWindowFacts,
  UpdateBudgetWindowDefinition,
} from '../../../../wailsjs/go/main/App';
import { main } from '../../../../wailsjs/go/models';
import type { BudgetWindowDefinition, QuotaUsageCalibration, QuotaWindowFact } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { normalizeBudgetWindowDefinitions, normalizeQuotaWindowFacts } from '../model/budgetWindowDefinition';
import type { TrackRequest } from '../model/types';

export default function useBudgetWindowDefinitions(trackRequest: TrackRequest) {
  const [budgetWindowDefinitions, setBudgetWindowDefinitions] = useState<BudgetWindowDefinition[]>([]);
  const [budgetWindowFactsByAccountKey, setBudgetWindowFactsByAccountKey] = useState<Record<string, QuotaWindowFact[]>>({});

  const loadBudgetWindowDefinitions = useCallback(async () => {
    if (!hasWailsAppBindings()) {
      setBudgetWindowDefinitions([]);
      return [] as BudgetWindowDefinition[];
    }
    const items = normalizeBudgetWindowDefinitions(
      await trackRequest('ListBudgetWindowDefinitions', {}, () => ListBudgetWindowDefinitions()),
    );
    setBudgetWindowDefinitions(items);
    return items;
  }, [trackRequest]);

  const createBudgetWindowDefinition = useCallback(
    async (definition: BudgetWindowDefinition) => {
      if (!hasWailsAppBindings()) {
        return [] as BudgetWindowDefinition[];
      }
      const items = normalizeBudgetWindowDefinitions(
        await trackRequest('CreateBudgetWindowDefinition', { id: definition.id }, () =>
          CreateBudgetWindowDefinition(definition),
        ),
      );
      setBudgetWindowDefinitions(items);
      return items;
    },
    [trackRequest],
  );

  const updateBudgetWindowDefinition = useCallback(
    async (id: string, definition: BudgetWindowDefinition) => {
      const windowID = String(id || '').trim();
      if (!windowID || !hasWailsAppBindings()) {
        return [] as BudgetWindowDefinition[];
      }
      const items = normalizeBudgetWindowDefinitions(
        await trackRequest('UpdateBudgetWindowDefinition', { id: windowID }, () =>
          UpdateBudgetWindowDefinition(windowID, definition),
        ),
      );
      setBudgetWindowDefinitions(items);
      return items;
    },
    [trackRequest],
  );

  const deleteBudgetWindowDefinition = useCallback(
    async (id: string) => {
      const windowID = String(id || '').trim();
      if (!windowID || !hasWailsAppBindings()) {
        return [] as BudgetWindowDefinition[];
      }
      const items = normalizeBudgetWindowDefinitions(
        await trackRequest('DeleteBudgetWindowDefinition', { id: windowID }, () =>
          DeleteBudgetWindowDefinition(windowID),
        ),
      );
      setBudgetWindowDefinitions(items);
      return items;
    },
    [trackRequest],
  );

  const previewBudgetWindowFacts = useCallback(
    async (options: {
      accountKey: string;
      definitions?: BudgetWindowDefinition[];
      calibrations?: QuotaUsageCalibration[];
      now?: Date;
    }) => {
      const accountKey = String(options.accountKey || '').trim();
      if (!accountKey) {
        return [] as QuotaWindowFact[];
      }
      if (!hasWailsAppBindings()) {
        setBudgetWindowFactsByAccountKey((prev) => ({ ...prev, [accountKey]: [] }));
        return [] as QuotaWindowFact[];
      }
      const request = main.BudgetWindowFactsPreviewRequest.createFrom({
        accountKey,
        now: (options.now || new Date()).toISOString(),
        definitions: options.definitions,
        calibrations: options.calibrations,
      });
      const items = normalizeQuotaWindowFacts(
        await trackRequest('PreviewBudgetWindowFacts', { accountKey }, () => PreviewBudgetWindowFacts(request)),
      );
      setBudgetWindowFactsByAccountKey((prev) => ({ ...prev, [accountKey]: items }));
      return items;
    },
    [trackRequest],
  );

  return {
    budgetWindowDefinitions,
    budgetWindowFactsByAccountKey,
    loadBudgetWindowDefinitions,
    createBudgetWindowDefinition,
    updateBudgetWindowDefinition,
    deleteBudgetWindowDefinition,
    previewBudgetWindowFacts,
  };
}
