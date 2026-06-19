import { useCallback, useState } from 'react';
import {
  CreateQuotaThresholdRule,
  DeleteQuotaThresholdRule,
  ListQuotaThresholdRules,
  UpdateQuotaThresholdRule,
} from '../../../../wailsjs/go/main/App';
import type { QuotaThresholdRule } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { normalizeQuotaThresholdRules } from '../model/quotaThresholdRule';
import type { TrackRequest } from '../model/types';

export default function useQuotaThresholdRules(trackRequest: TrackRequest) {
  const [quotaThresholdRulesByAccountKey, setQuotaThresholdRulesByAccountKey] = useState<
    Record<string, QuotaThresholdRule[]>
  >({});

  const loadQuotaThresholdRules = useCallback(
    async (accountKey: string) => {
      const key = String(accountKey || '').trim();
      if (!key) {
        return [] as QuotaThresholdRule[];
      }
      if (!hasWailsAppBindings()) {
        setQuotaThresholdRulesByAccountKey((prev) => ({ ...prev, [key]: [] }));
        return [] as QuotaThresholdRule[];
      }
      const items = normalizeQuotaThresholdRules(
        await trackRequest('ListQuotaThresholdRules', { accountKey: key }, () => ListQuotaThresholdRules(key)),
      );
      setQuotaThresholdRulesByAccountKey((prev) => ({ ...prev, [key]: items }));
      return items;
    },
    [trackRequest],
  );

  const createQuotaThresholdRule = useCallback(
    async (rule: QuotaThresholdRule) => {
      if (!hasWailsAppBindings()) {
        return [] as QuotaThresholdRule[];
      }
      const accountKey = String(rule.accountKey || '').trim();
      const items = normalizeQuotaThresholdRules(
        await trackRequest('CreateQuotaThresholdRule', { accountKey }, () => CreateQuotaThresholdRule(rule)),
      );
      if (accountKey) {
        setQuotaThresholdRulesByAccountKey((prev) => ({ ...prev, [accountKey]: items }));
      }
      return items;
    },
    [trackRequest],
  );

  const updateQuotaThresholdRule = useCallback(
    async (id: string, rule: QuotaThresholdRule) => {
      const ruleID = String(id || '').trim();
      if (!ruleID || !hasWailsAppBindings()) {
        return [] as QuotaThresholdRule[];
      }
      const accountKey = String(rule.accountKey || '').trim();
      const items = normalizeQuotaThresholdRules(
        await trackRequest('UpdateQuotaThresholdRule', { id: ruleID, accountKey }, () =>
          UpdateQuotaThresholdRule(ruleID, rule),
        ),
      );
      if (accountKey) {
        setQuotaThresholdRulesByAccountKey((prev) => ({ ...prev, [accountKey]: items }));
      }
      return items;
    },
    [trackRequest],
  );

  const deleteQuotaThresholdRule = useCallback(
    async (id: string, accountKey?: string) => {
      const ruleID = String(id || '').trim();
      const key = String(accountKey || '').trim();
      if (!ruleID || !hasWailsAppBindings()) {
        return;
      }
      await trackRequest('DeleteQuotaThresholdRule', { id: ruleID, accountKey: key }, () =>
        DeleteQuotaThresholdRule(ruleID),
      );
      if (key) {
        setQuotaThresholdRulesByAccountKey((prev) => ({
          ...prev,
          [key]: (prev[key] || []).filter((rule) => rule.id !== ruleID),
        }));
      }
    },
    [trackRequest],
  );

  return {
    quotaThresholdRulesByAccountKey,
    loadQuotaThresholdRules,
    createQuotaThresholdRule,
    updateQuotaThresholdRule,
    deleteQuotaThresholdRule,
  };
}
