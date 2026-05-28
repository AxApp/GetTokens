import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toErrorMessage } from '../../../utils/error';
import {
  DEFAULT_RATE_LIMIT_STRATEGIES,
  DEFAULT_RATE_LIMIT_WINDOWS,
  RATE_LIMIT_CALENDAR_DAY_WINDOW,
  formatRateLimitLimitDraftValue,
  formatRateLimitMetric,
  formatRateLimitWindowLabel,
  parseRateLimitLimitDraftValue,
  rateLimitRuleLabel,
  type RateLimitRule,
  type RateLimitState,
  type RateLimitStrategyMeta,
} from '../model/rateLimit';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import type { Translator } from '../model/types';
import {
  AccountDetailEmptyState,
  AccountDetailNotice,
  AccountDetailSection,
} from './AccountDetailPrimitives';

interface RateLimitRulesSectionProps {
  accountKey: string;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  onDirtyChange?: (dirty: boolean) => void;
  onRateLimitRulesChanged: () => void;
  t: Translator;
}

export interface RateLimitRulesSectionHandle {
  save: () => Promise<boolean>;
  hasDirtyChanges: () => boolean;
}

export interface RateLimitRulesAPI {
  list: (input: { accountKey: string }) => Promise<RateLimitRule[] | null | undefined>;
  create: (rule: RateLimitRule) => Promise<RateLimitRule[] | null | undefined>;
  update: (rule: RateLimitRule) => Promise<RateLimitRule[] | null | undefined>;
  delete: (input: { id: string }) => Promise<unknown>;
}

const RateLimitRulesSection = forwardRef<RateLimitRulesSectionHandle, RateLimitRulesSectionProps>(function RateLimitRulesSection(
  {
    accountKey,
    rateLimitStatus,
    rateLimitStrategies,
    rateLimitRulesAPI,
    onDirtyChange,
    onRateLimitRulesChanged,
    t,
  },
  ref,
) {
  const strategies = useMemo(() => normalizeRateLimitStrategies(rateLimitStrategies), [rateLimitStrategies]);
  const [ruleDrafts, setRuleDrafts] = useState<RateLimitRule[]>([]);
  const [baselineRuleDrafts, setBaselineRuleDrafts] = useState<RateLimitRule[]>([]);
  const [deletedRuleIDs, setDeletedRuleIDs] = useState<string[]>([]);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [rateLimitMessageTone, setRateLimitMessageTone] = useState<'danger' | 'success' | 'neutral'>('danger');
  const [savingRules, setSavingRules] = useState(false);
  const [rateLimitViewMode, setRateLimitViewMode] = useState<'summary' | 'config'>('summary');
  const dirtyRef = useRef(false);

  const dirty = useMemo(
    () => deletedRuleIDs.length > 0 || serializeRateLimitRules(ruleDrafts) !== serializeRateLimitRules(baselineRuleDrafts),
    [baselineRuleDrafts, deletedRuleIDs, ruleDrafts],
  );
  const rateLimitSummaryText = useMemo(
    () => buildRateLimitSummaryText(ruleDrafts, rateLimitStatus, t),
    [rateLimitStatus, ruleDrafts, t],
  );

  useEffect(() => {
    dirtyRef.current = dirty;
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    async function loadRules() {
      if (dirtyRef.current) {
        return;
      }
      setRateLimitMessage('');
      setRateLimitMessageTone('danger');
      if (!rateLimitRulesAPI) {
        commitRuleDrafts((rateLimitStatus?.rules ?? []).map((item) => item.rule));
        return;
      }
      try {
        const rules = await rateLimitRulesAPI.list({ accountKey });
        if (!cancelled) {
          commitRuleDrafts(rules ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          commitRuleDrafts((rateLimitStatus?.rules ?? []).map((item) => item.rule));
          setRateLimitMessage(toErrorMessage(error));
          setRateLimitMessageTone('danger');
        }
      }
    }
    void loadRules();
    return () => {
      cancelled = true;
    };
  }, [accountKey, rateLimitRulesAPI, rateLimitStatus]);

  useImperativeHandle(
    ref,
    () => ({
      save: saveRateLimitRules,
      hasDirtyChanges: () => dirtyRef.current,
    }),
    [ruleDrafts, baselineRuleDrafts, deletedRuleIDs, rateLimitRulesAPI, accountKey, t],
  );

  function commitRuleDrafts(rules: RateLimitRule[]) {
    const normalized = rules.map((rule) => normalizeRateLimitRuleDraft(rule, accountKey));
    setRuleDrafts(normalized);
    setBaselineRuleDrafts(normalized);
    setDeletedRuleIDs([]);
    dirtyRef.current = false;
  }

  function addRateLimitRule() {
    const strategy = strategies[0] || DEFAULT_RATE_LIMIT_STRATEGIES[0];
    const window = supportedWindowsForStrategy(strategy)[0] || RATE_LIMIT_CALENDAR_DAY_WINDOW;
    setRuleDrafts((prev) => [
      ...prev,
      {
        accountKey,
        strategy: strategy.id,
        window,
        limitValue: strategy.id === 'request-window' ? 100 : 1000000,
        action: 'block',
        enabled: true,
        label: '',
      },
    ]);
    setRateLimitViewMode('config');
    setRateLimitMessage('');
  }

  function updateRateLimitDraft(index: number, patch: Partial<RateLimitRule>) {
    setRuleDrafts((prev) =>
      prev.map((draft, draftIndex) =>
        draftIndex === index ? normalizeRateLimitRuleDraft({ ...draft, ...patch }, accountKey) : draft,
      ),
    );
    setRateLimitMessage('');
  }

  async function saveRateLimitRules() {
    if (!dirtyRef.current) {
      return true;
    }
    const normalizedDrafts = ruleDrafts.map((draft) => normalizeRateLimitRuleDraft(draft, accountKey));
    if (normalizedDrafts.some((draft) => !draft.strategy || !draft.window || draft.limitValue <= 0)) {
      setRateLimitMessage(t('accounts.rate_limit_rule_required'));
      setRateLimitMessageTone('danger');
      return false;
    }

    setSavingRules(true);
    setRateLimitMessage('');
    setRateLimitMessageTone('danger');
    if (!rateLimitRulesAPI) {
      const previewRules = normalizedDrafts.map((draft, index) => ({
        ...draft,
        id: draft.id || `preview-${index}`,
      }));
      commitRuleDrafts(previewRules);
      setRateLimitMessage(t('accounts.rate_limit_preview_only'));
      setRateLimitMessageTone('neutral');
      setRateLimitViewMode('summary');
      setSavingRules(false);
      return true;
    }

    try {
      const baselineByID = new Map<string, RateLimitRule>(
        baselineRuleDrafts
          .filter((draft): draft is RateLimitRule & { id: string } => Boolean(draft.id))
          .map((draft) => [draft.id, draft]),
      );
      for (const id of deletedRuleIDs) {
        await rateLimitRulesAPI.delete({ id });
      }
      for (const draft of normalizedDrafts) {
        const baseline = draft.id ? baselineByID.get(draft.id) : undefined;
        if (!draft.id) {
          await rateLimitRulesAPI.create(draft);
        } else if (!baseline || serializeRateLimitRule(draft) !== serializeRateLimitRule(baseline)) {
          await rateLimitRulesAPI.update(draft);
        }
      }
      const rules = await rateLimitRulesAPI.list({ accountKey });
      commitRuleDrafts(rules ?? []);
      setRateLimitMessage(t('accounts.rate_limit_save_success'));
      setRateLimitMessageTone('success');
      setRateLimitViewMode('summary');
      onRateLimitRulesChanged();
      return true;
    } catch (error) {
      setRateLimitMessage(toErrorMessage(error));
      setRateLimitMessageTone('danger');
      return false;
    } finally {
      setSavingRules(false);
    }
  }

  function deleteRateLimitRule(index: number) {
    const draft = ruleDrafts[index];
    if (draft?.id) {
      setDeletedRuleIDs((prev) => (prev.includes(draft.id!) ? prev : [...prev, draft.id!]));
    }
    setRuleDrafts((prev) => prev.filter((_, draftIndex) => draftIndex !== index));
    setRateLimitMessage('');
  }

  return (
    <AccountDetailSection
      componentName="RateLimitRulesSection"
      eyebrow="Route Guard"
      title={t('accounts.rate_limit_rules_title')}
      meta={`${t('accounts.rate_limit_cache')} ${rateLimitStatus?.updatedAt ? new Date(rateLimitStatus.updatedAt).toLocaleString() : '-'}`}
      span="wide"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {rateLimitViewMode === 'config' ? (
            <button
              type="button"
              onClick={addRateLimitRule}
              className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
              disabled={savingRules}
            >
              {t('accounts.rate_limit_add_rule')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setRateLimitViewMode((prev) => (prev === 'summary' ? 'config' : 'summary'))}
            className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
            disabled={savingRules || (rateLimitViewMode === 'config' && dirty)}
          >
            {rateLimitViewMode === 'summary' ? t('accounts.rate_limit_edit_rules') : t('accounts.rate_limit_done')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {dirty ? (
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {t('accounts.rate_limit_dirty')}
          </div>
        ) : null}

        {rateLimitMessage ? (
          <AccountDetailNotice tone={rateLimitMessageTone}>
            {rateLimitMessage}
          </AccountDetailNotice>
        ) : null}

        {rateLimitViewMode === 'summary' ? (
          <div
            data-rate-limit-view-mode="summary"
            className="min-w-0 border-y-2 border-[var(--border-color)] px-2 py-2"
          >
            <button
              type="button"
              onClick={() => setRateLimitViewMode('config')}
              className="block w-full min-w-0 text-left"
              title={rateLimitSummaryText}
            >
              <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                {rateLimitSummaryText}
              </span>
            </button>
          </div>
        ) : ruleDrafts.length === 0 ? (
          <div data-rate-limit-view-mode="config">
            <AccountDetailEmptyState>
              <button
                type="button"
                onClick={addRateLimitRule}
                className="font-mono font-black uppercase tracking-[0.12em] text-[var(--text-primary)] underline decoration-dashed underline-offset-4"
                disabled={savingRules}
              >
                {t('accounts.rate_limit_no_local_rule')}
              </button>
            </AccountDetailEmptyState>
          </div>
        ) : (
          <div data-rate-limit-view-mode="config" className="space-y-2" role="list">
              {ruleDrafts.map((draft, index) => {
                const strategy = strategies.find((item) => item.id === draft.strategy) || strategies[0];
                const windows = supportedWindowsForStrategy(strategy);
                const ruleState = rateLimitStatus?.rules.find((item) => item.rule.id && item.rule.id === draft.id);
                const ruleDomID = `rate-limit-rule-${draft.id || index}`;
                return (
                  <fieldset
                    key={draft.id || `new-${index}`}
                    className="grid min-w-0 gap-3 border-y-2 border-[var(--border-color)] px-2 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(7rem,0.8fr)_minmax(9rem,1fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(7rem,0.8fr)_minmax(9rem,1fr)_minmax(8rem,0.8fr)_minmax(7rem,0.7fr)_minmax(9rem,0.9fr)_auto]"
                    role="listitem"
                    disabled={savingRules}
                  >
                    <legend className="sr-only">{t('accounts.rate_limit_rule_legend')}</legend>
                    <RuleField label={t('accounts.rate_limit_label')} htmlFor={`${ruleDomID}-label`}>
                      <input
                        id={`${ruleDomID}-label`}
                        type="text"
                        value={draft.label || ''}
                        placeholder={rateLimitRuleLabel(draft)}
                        onChange={(event) => updateRateLimitDraft(index, { label: event.target.value })}
                        className="input-swiss h-9 w-full !py-1 !text-[length:var(--font-size-ui-xs)]"
                      />
                    </RuleField>
                    <RuleField label={t('accounts.rate_limit_strategy')} htmlFor={`${ruleDomID}-strategy`}>
                      <select
                        id={`${ruleDomID}-strategy`}
                        value={draft.strategy}
                        onChange={(event) => {
                          const nextStrategy = strategies.find((item) => item.id === event.target.value);
                          const nextWindows = supportedWindowsForStrategy(nextStrategy);
                          updateRateLimitDraft(index, {
                            strategy: event.target.value,
                            window: nextWindows.includes(draft.window) ? draft.window : nextWindows[0] || '24h',
                          });
                        }}
                        className="input-swiss h-9 w-full !py-1 !text-[length:var(--font-size-ui-xs)]"
                      >
                        {strategies.map((item) => (
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
                        className="input-swiss h-9 w-full !py-1 !text-[length:var(--font-size-ui-xs)]"
                      >
                        {windows.map((window) => (
                          <option key={window} value={window}>
                            {formatRateLimitWindowLabel(window)}
                          </option>
                        ))}
                      </select>
                    </RuleField>
                    <RuleField label={t('accounts.rate_limit_limit')} htmlFor={`${ruleDomID}-limit`}>
                      <div className="flex h-9 border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
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
                          className="min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-primary)] outline-none"
                        />
                        <span className="flex w-10 items-center justify-center border-l border-[var(--border-color)] text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                          {draft.strategy === 'token-window' ? 'M' : t('accounts.rate_limit_count_unit')}
                        </span>
                      </div>
                    </RuleField>
                    <RuleField label={t('accounts.rate_limit_action')} htmlFor={`${ruleDomID}-action`}>
                      <select
                        id={`${ruleDomID}-action`}
                        value={draft.action}
                        onChange={(event) => updateRateLimitDraft(index, { action: event.target.value })}
                        className="input-swiss h-9 w-full !py-1 !text-[length:var(--font-size-ui-xs)]"
                      >
                        <option value="block">{t('accounts.rate_limit_action_block')}</option>
                        <option value="warn">{t('accounts.rate_limit_action_warn')}</option>
                      </select>
                    </RuleField>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        {t('accounts.rate_limit_enabled_short')}
                      </div>
                      <ToggleSwitch
                        label={t('accounts.rate_limit_enabled')}
                        checked={draft.enabled}
                        disabled={savingRules}
                        onChange={(checked) => updateRateLimitDraft(index, { enabled: checked })}
                        className="!min-h-0 scale-75 origin-left"
                      />
                    </div>
                    <div
                      className={`min-w-0 self-end truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] xl:self-center ${
                        ruleState?.exceeded ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
                      }`}
                      title={ruleState ? `${formatRateLimitMetric(ruleState.currentUsage)} / ${formatRateLimitMetric(ruleState.rule.limitValue)} (${Math.round(ruleState.usagePct)}%)` : undefined}
                    >
                      {ruleState
                        ? `${formatRateLimitMetric(ruleState.currentUsage)} / ${formatRateLimitMetric(ruleState.rule.limitValue)} (${Math.round(ruleState.usagePct)}%)`
                        : '-'}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteRateLimitRule(index)}
                      className="btn-swiss h-9 self-end !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)] !text-[var(--color-status-danger)] xl:self-center"
                      disabled={savingRules}
                    >
                      {t('common.delete')}
                    </button>
                  </fieldset>
                );
              })}
          </div>
        )}
      </div>
    </AccountDetailSection>
  );
});

export default RateLimitRulesSection;

function normalizeRateLimitRuleDraft(rule: RateLimitRule, accountKey: string): RateLimitRule {
  return {
    id: String(rule?.id || '').trim() || undefined,
    accountKey: String(rule?.accountKey || accountKey).trim(),
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

function normalizeRateLimitStrategies(strategies: RateLimitStrategyMeta[] | undefined) {
  const source = strategies?.length ? strategies : DEFAULT_RATE_LIMIT_STRATEGIES;
  return source.map((strategy) => ({
    ...strategy,
    supportedWindows: supportedWindowsForStrategy(strategy),
  }));
}

function supportedWindowsForStrategy(strategy?: RateLimitStrategyMeta) {
  const windows = strategy?.supportedWindows?.length ? strategy.supportedWindows : DEFAULT_RATE_LIMIT_WINDOWS;
  const normalized = windows.map((window) => String(window || '').trim()).filter(Boolean);
  if (normalized.some((window) => window.toLowerCase() === RATE_LIMIT_CALENDAR_DAY_WINDOW)) {
    return normalized;
  }
  const insertAfter = normalized.findIndex((window) => window.toLowerCase() === '24h');
  const next = [...normalized];
  next.splice(insertAfter >= 0 ? insertAfter + 1 : next.length, 0, RATE_LIMIT_CALENDAR_DAY_WINDOW);
  return next;
}

function serializeRateLimitRules(rules: RateLimitRule[]) {
  return JSON.stringify(rules.map((rule) => compactRateLimitRule(rule)));
}

function serializeRateLimitRule(rule: RateLimitRule) {
  return JSON.stringify(compactRateLimitRule(rule));
}

function compactRateLimitRule(rule: RateLimitRule) {
  return {
    id: String(rule.id || ''),
    accountKey: String(rule.accountKey || ''),
    strategy: String(rule.strategy || ''),
    window: String(rule.window || ''),
    limitValue: Math.max(0, Number(rule.limitValue || 0)),
    action: String(rule.action || ''),
    enabled: Boolean(rule.enabled),
    label: String(rule.label || ''),
  };
}

function buildRateLimitSummaryText(
  rules: RateLimitRule[],
  status: RateLimitState | undefined,
  t: Translator,
) {
  if (rules.length === 0) {
    return t('accounts.rate_limit_no_local_rule');
  }
  const enabledCount = rules.filter((rule) => rule.enabled).length;
  const evaluatedRules = status?.rules ?? [];
  const exceededCount = evaluatedRules.filter((item) => item.exceeded).length;
  const hottestRule = evaluatedRules.reduce<(typeof evaluatedRules)[number] | undefined>((current, item) => {
    if (!current || item.usagePct > current.usagePct) {
      return item;
    }
    return current;
  }, undefined);
  const usageText = hottestRule
    ? `${Math.round(hottestRule.usagePct)}% ${formatRateLimitMetric(hottestRule.currentUsage)}/${formatRateLimitMetric(hottestRule.rule.limitValue)}`
    : t('accounts.rate_limit_not_evaluated');
  const statusText = status?.blocked
    ? `${t('accounts.rate_limit_summary_blocked')} ${Math.max(exceededCount, 1)}`
    : t('accounts.rate_limit_summary_enabled');
  return `${statusText} / ${t('accounts.rate_limit_summary_rules')} ${rules.length} / ${t('accounts.rate_limit_summary_active')} ${enabledCount} / ${usageText}`;
}

function RuleField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block min-w-0 space-y-1">
      <span className="block font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
