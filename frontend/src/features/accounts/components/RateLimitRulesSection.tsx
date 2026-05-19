import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toErrorMessage } from '../../../utils/error';
import {
  DEFAULT_RATE_LIMIT_STRATEGIES,
  formatRateLimitLimitDraftValue,
  formatRateLimitMetric,
  parseRateLimitLimitDraftValue,
  rateLimitRuleLabel,
  type RateLimitRule,
  type RateLimitState,
  type RateLimitStrategyMeta,
} from '../model/rateLimit';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import type { TextInputEvent, Translator } from '../model/types';

interface RateLimitRulesSectionProps {
  accountKey: string;
  matchKey?: string;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  onRateLimitRulesChanged: () => void;
  t: Translator;
}

export interface RateLimitRulesAPI {
  list: (input: { accountKey: string }) => Promise<RateLimitRule[] | null | undefined>;
  create: (rule: RateLimitRule) => Promise<RateLimitRule[] | null | undefined>;
  update: (rule: RateLimitRule) => Promise<RateLimitRule[] | null | undefined>;
  delete: (input: { id: string }) => Promise<unknown>;
}

export default function RateLimitRulesSection({
  accountKey,
  matchKey,
  rateLimitStatus,
  rateLimitStrategies = DEFAULT_RATE_LIMIT_STRATEGIES,
  rateLimitRulesAPI,
  onRateLimitRulesChanged,
  t,
}: RateLimitRulesSectionProps) {
  const [ruleDrafts, setRuleDrafts] = useState<RateLimitRule[]>([]);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [savingRuleID, setSavingRuleID] = useState('');
  const hasDirtyDraftRef = useRef(false);

  useEffect(() => {
    hasDirtyDraftRef.current = false;
  }, [accountKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadRules() {
      if (hasDirtyDraftRef.current) {
        return;
      }
      setRateLimitMessage('');
      if (!rateLimitRulesAPI) {
        setRuleDrafts((rateLimitStatus?.rules ?? []).map((item) => normalizeRateLimitRuleDraft(item.rule, accountKey)));
        return;
      }
      try {
        const rules = await rateLimitRulesAPI.list({ accountKey });
        if (!cancelled) {
          setRuleDrafts((rules ?? []).map((rule) => normalizeRateLimitRuleDraft(rule as RateLimitRule, accountKey)));
        }
      } catch (error) {
        if (!cancelled) {
          setRuleDrafts((rateLimitStatus?.rules ?? []).map((item) => normalizeRateLimitRuleDraft(item.rule, accountKey)));
          setRateLimitMessage(toErrorMessage(error));
        }
      }
    }
    void loadRules();
    return () => {
      cancelled = true;
    };
  }, [accountKey, rateLimitRulesAPI, rateLimitStatus]);

  function addRateLimitRule() {
    const strategy = rateLimitStrategies[0] || DEFAULT_RATE_LIMIT_STRATEGIES[0];
    const window = strategy.supportedWindows[0] || '24h';
    hasDirtyDraftRef.current = true;
    setRuleDrafts((prev) => [
      ...prev,
      {
        accountKey,
        matchKey: matchKey || rateLimitStatus?.matchKey || '',
        strategy: strategy.id,
        window,
        limitValue: strategy.id === 'request-window' ? 100 : 1000000,
        action: 'block',
        enabled: true,
        label: '',
      },
    ]);
  }

  function updateRateLimitDraft(index: number, patch: Partial<RateLimitRule>) {
    hasDirtyDraftRef.current = true;
    setRuleDrafts((prev) =>
      prev.map((draft, draftIndex) =>
        draftIndex === index ? normalizeRateLimitRuleDraft({ ...draft, ...patch }, accountKey) : draft,
      ),
    );
  }

  async function saveRateLimitRule(index: number) {
    const draft = normalizeRateLimitRuleDraft(ruleDrafts[index], accountKey);
    if (!draft.strategy || !draft.window || draft.limitValue <= 0) {
      setRateLimitMessage(t('accounts.rate_limit_rule_required'));
      return;
    }
    const key = draft.id || `new-${index}`;
    setSavingRuleID(key);
    setRateLimitMessage('');
    if (!rateLimitRulesAPI) {
      hasDirtyDraftRef.current = false;
      setRuleDrafts((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...draft,
                id: draft.id || `preview-${index}`,
              }
            : item,
        ),
      );
      setRateLimitMessage(t('accounts.rate_limit_preview_only'));
      setSavingRuleID('');
      return;
    }
    try {
      const rules = draft.id ? await rateLimitRulesAPI.update(draft) : await rateLimitRulesAPI.create(draft);
      hasDirtyDraftRef.current = false;
      setRuleDrafts((rules ?? []).map((rule) => normalizeRateLimitRuleDraft(rule as RateLimitRule, accountKey)));
      onRateLimitRulesChanged();
    } catch (error) {
      setRateLimitMessage(toErrorMessage(error));
    } finally {
      setSavingRuleID('');
    }
  }

  async function deleteRateLimitRule(index: number) {
    const draft = ruleDrafts[index];
    if (!rateLimitRulesAPI) {
      setRuleDrafts((prev) => prev.filter((_, draftIndex) => draftIndex !== index));
      hasDirtyDraftRef.current = false;
      setRateLimitMessage(t('accounts.rate_limit_preview_only'));
      return;
    }
    if (!draft?.id) {
      setRuleDrafts((prev) => prev.filter((_, draftIndex) => draftIndex !== index));
      hasDirtyDraftRef.current = false;
      return;
    }
    setSavingRuleID(draft.id);
    setRateLimitMessage('');
    try {
      await rateLimitRulesAPI.delete({ id: draft.id });
      hasDirtyDraftRef.current = false;
      setRuleDrafts((prev) => prev.filter((_, draftIndex) => draftIndex !== index));
      onRateLimitRulesChanged();
    } catch (error) {
      setRateLimitMessage(toErrorMessage(error));
    } finally {
      setSavingRuleID('');
    }
  }

  return (
    <section aria-labelledby="rate-limit-rules-title" className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-5">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dashed border-[var(--border-color)] pb-3">
          <div>
            <h3 id="rate-limit-rules-title" className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('accounts.rate_limit_rules_title')}
            </h3>
            <div className="mt-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {t('accounts.rate_limit_cache')} {rateLimitStatus?.updatedAt ? new Date(rateLimitStatus.updatedAt).toLocaleString() : '—'}
            </div>
          </div>
          <button type="button" onClick={addRateLimitRule} className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-xs)]">
            {t('accounts.rate_limit_add_rule')}
          </button>
        </div>

        {rateLimitMessage ? (
          <div className="border-2 border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--color-status-danger)]">
            {rateLimitMessage}
          </div>
        ) : null}

        {ruleDrafts.length === 0 ? (
          <div className="border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-4 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {t('accounts.rate_limit_no_local_rule')}
          </div>
        ) : (
          <div className="space-y-3" role="list">
            {ruleDrafts.map((draft, index) => {
              const strategy = rateLimitStrategies.find((item) => item.id === draft.strategy) || rateLimitStrategies[0];
              const windows = strategy?.supportedWindows?.length ? strategy.supportedWindows : ['1h', '6h', '12h', '24h', '7d', '30d'];
              const ruleState = rateLimitStatus?.rules.find((item) => item.rule.id && item.rule.id === draft.id);
              const busy = savingRuleID === (draft.id || `new-${index}`);
              const ruleDomID = `rate-limit-rule-${draft.id || index}`;
              return (
                <fieldset
                  key={draft.id || `new-${index}`}
                  className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3"
                  role="listitem"
                >
                  <legend className="sr-only">{t('accounts.rate_limit_rule_legend')}</legend>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_auto_minmax(0,1.5fr)_auto]">
                    <RuleField label={t('accounts.rate_limit_strategy')} htmlFor={`${ruleDomID}-strategy`}>
                      <select
                        id={`${ruleDomID}-strategy`}
                        value={draft.strategy}
                        onChange={(event) => {
                          const nextStrategy = rateLimitStrategies.find((item) => item.id === event.target.value);
                          updateRateLimitDraft(index, {
                            strategy: event.target.value,
                            window: nextStrategy?.supportedWindows?.[0] || draft.window || '24h',
                          });
                        }}
                        className="input-swiss h-full !py-1.5 !text-[length:var(--font-size-ui-sm)]"
                      >
                        {rateLimitStrategies.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </RuleField>
                    <RuleField label={t('accounts.rate_limit_window')} htmlFor={`${ruleDomID}-window`}>
                      <select
                        id={`${ruleDomID}-window`}
                        value={draft.window}
                        onChange={(event) => updateRateLimitDraft(index, { window: event.target.value })}
                        className="input-swiss h-full !py-1.5 !text-[length:var(--font-size-ui-sm)]"
                      >
                        {windows.map((window) => (
                          <option key={window} value={window}>
                            {window}
                          </option>
                        ))}
                      </select>
                    </RuleField>
                    <RuleField label={t('accounts.rate_limit_limit')} htmlFor={`${ruleDomID}-limit`}>
                      <div className="flex h-full border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
                        <input
                          id={`${ruleDomID}-limit`}
                          type="number"
                          min={draft.strategy === 'token-window' ? 0.000001 : 1}
                          step={draft.strategy === 'token-window' ? 0.1 : 1}
                          value={formatRateLimitLimitDraftValue(draft)}
                          onChange={(event) =>
                            updateRateLimitDraft(index, {
                              limitValue: parseRateLimitLimitDraftValue(draft.strategy, event.target.value),
                            })
                          }
                          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-primary)] outline-none"
                        />
                        <span className="flex items-center border-l border-[var(--border-color)] px-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                          {draft.strategy === 'token-window' ? 'M' : t('accounts.rate_limit_count_unit')}
                        </span>
                      </div>
                    </RuleField>
                    <RuleField label={t('accounts.rate_limit_action')} htmlFor={`${ruleDomID}-action`}>
                      <select
                        id={`${ruleDomID}-action`}
                        value={draft.action}
                        onChange={(event) => updateRateLimitDraft(index, { action: event.target.value })}
                        className="input-swiss h-full !py-1.5 !text-[length:var(--font-size-ui-sm)]"
                      >
                        <option value="block">{t('accounts.rate_limit_action_block')}</option>
                        <option value="warn">{t('accounts.rate_limit_action_warn')}</option>
                      </select>
                    </RuleField>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <input
                      value={draft.label || ''}
                      onChange={(event: TextInputEvent) => updateRateLimitDraft(index, { label: event.target.value })}
                      className="input-swiss !py-1.5 !text-[length:var(--font-size-ui-sm)]"
                      aria-label={t('accounts.rate_limit_label')}
                      placeholder={rateLimitRuleLabel(draft)}
                    />
                    <div className="flex items-center gap-2">
                      <ToggleSwitch
                        label={t('accounts.rate_limit_enabled')}
                        checked={draft.enabled}
                        onChange={(checked) => updateRateLimitDraft(index, { enabled: checked })}
                        className="!min-h-0 scale-75"
                      />
                      <button type="button" onClick={() => void saveRateLimitRule(index)} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]" disabled={busy}>
                        {busy ? '...' : t('common.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRateLimitRule(index)}
                        className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)] !text-[var(--color-status-danger)]"
                        disabled={busy}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                  {ruleState ? (
                    <div
                      className={`font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] ${
                        ruleState.exceeded ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {`${formatRateLimitMetric(ruleState.currentUsage)} / ${formatRateLimitMetric(ruleState.rule.limitValue)} (${Math.round(ruleState.usagePct)}%)`}
                    </div>
                  ) : null}
                </fieldset>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeRateLimitRuleDraft(rule: RateLimitRule, accountKey: string): RateLimitRule {
  return {
    id: String(rule?.id || '').trim() || undefined,
    accountKey: String(rule?.accountKey || accountKey).trim(),
    matchKey: String(rule?.matchKey || '').trim(),
    strategy: String(rule?.strategy || DEFAULT_RATE_LIMIT_STRATEGIES[0].id).trim(),
    window: String(rule?.window || '24h').trim(),
    limitValue: Math.max(0, Number(rule?.limitValue || 0)),
    action: String(rule?.action || 'block').trim(),
    enabled: Boolean(rule?.enabled),
    label: String(rule?.label || '').trim(),
    createdAt: Number(rule?.createdAt || 0),
    updatedAt: Number(rule?.updatedAt || 0),
  };
}

function RuleField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1">
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}
