import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { toErrorMessage } from '../../../utils/error';
import {
  DEFAULT_RATE_LIMIT_STRATEGIES,
  DEFAULT_RATE_LIMIT_WINDOWS,
  RATE_LIMIT_CALENDAR_DAY_WINDOW,
  collectLegacyRateLimitBindings,
  formatRateLimitLimitDraftValue,
  formatRateLimitMetric,
  formatRateLimitWindowLabel,
  parseRateLimitLimitDraftValue,
  type RateLimitRule,
  type RateLimitState,
  type RateLimitStrategyMeta,
} from '../model/rateLimit';
import type { Translator } from '../model/types';
import {
  AccountDetailEmptyState,
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

const rateLimitRulesShellClass = 'grid min-w-0 gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3';
const rateLimitRulesPanelClass = 'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-3';
const rateLimitRulesListClass = 'grid min-w-0 gap-2';
const rateLimitRulesMetaClass = 'min-w-0 font-mono text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]';
const rateLimitRulesTitleClass = 'truncate font-mono text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]';
const rateLimitRulesButtonClass = 'inline-flex h-9 items-center justify-center rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-panel)] px-3 text-xs font-normal text-[var(--gt-ink-primary)] transition hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';
const rateLimitRulesPrimaryButtonClass = `${rateLimitRulesButtonClass} bg-[var(--gt-accent-primary)] text-[var(--gt-ink-inverse)] hover:bg-[var(--gt-accent-hover)]`;
const rateLimitRulesIconButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-panel)] text-[var(--gt-ink-muted)] transition hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-50';
const rateLimitRulesMenuItemClass = 'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)]';
const rateLimitRulesDangerMenuItemClass = `${rateLimitRulesMenuItemClass} text-[var(--gt-status-danger)]`;
const rateLimitRulesInputClass = 'h-9 w-full rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-canvas)] px-2 py-1 text-sm text-[var(--gt-ink-primary)] outline-none transition focus:border-[var(--gt-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60';
const rateLimitRulesInlineInputClass = 'min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] outline-none';
const rateLimitRulesNoticeClass = 'rounded-md border px-3 py-2 font-mono text-[length:var(--gt-font-size-xs)] font-normal';
const rateLimitRulesNoticeToneClass = {
  danger: 'border-[color-mix(in_srgb,var(--gt-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,var(--gt-surface-canvas))] text-[var(--gt-status-danger)]',
  neutral: 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)]',
  success: 'border-[color-mix(in_srgb,var(--gt-status-success)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_8%,var(--gt-surface-canvas))] text-[var(--gt-status-success)]',
} satisfies Record<'danger' | 'neutral' | 'success', string>;

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
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [openRuleMenuIndex, setOpenRuleMenuIndex] = useState<number | null>(null);
  const dirtyRef = useRef(false);
  const ruleMenuRef = useRef<HTMLDivElement | null>(null);

  const dirty = useMemo(
    () => deletedRuleIDs.length > 0 || serializeRateLimitRules(ruleDrafts) !== serializeRateLimitRules(baselineRuleDrafts),
    [baselineRuleDrafts, deletedRuleIDs, ruleDrafts],
  );
  const rateLimitMetaTimestamp = rateLimitStatus?.lastEvaluatedAt || rateLimitStatus?.updatedAt || '';
  const legacyBindings = useMemo(
    () => collectLegacyRateLimitBindings({ currentAccountKey: accountKey, rules: ruleDrafts, status: rateLimitStatus }),
    [accountKey, rateLimitStatus, ruleDrafts],
  );

  useEffect(() => {
    dirtyRef.current = dirty;
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (openRuleMenuIndex === null) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!ruleMenuRef.current?.contains(event.target as Node)) {
        setOpenRuleMenuIndex(null);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [openRuleMenuIndex]);

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
    setEditingRuleIndex(null);
    setOpenRuleMenuIndex(null);
    dirtyRef.current = false;
  }

  function addRateLimitRule() {
    const strategy = strategies[0] || DEFAULT_RATE_LIMIT_STRATEGIES[0];
    const window = supportedWindowsForStrategy(strategy)[0] || RATE_LIMIT_CALENDAR_DAY_WINDOW;
    const nextIndex = ruleDrafts.length;
    setRuleDrafts([
      ...ruleDrafts,
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
    setEditingRuleIndex(nextIndex);
    setOpenRuleMenuIndex(null);
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
    setEditingRuleIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
    setOpenRuleMenuIndex(null);
    setRateLimitMessage('');
  }

  function startEditingRateLimitRule(index: number) {
    setEditingRuleIndex(index);
    setOpenRuleMenuIndex(null);
    setRateLimitMessage('');
  }

  function finishEditingRateLimitRule(index: number) {
    const draft = normalizeRateLimitRuleDraft(ruleDrafts[index], accountKey);
    if (!draft.strategy || !draft.window || draft.limitValue <= 0) {
      setRateLimitMessage(t('accounts.rate_limit_rule_required'));
      setRateLimitMessageTone('danger');
      return;
    }
    setRuleDrafts((prev) => prev.map((item, draftIndex) => (draftIndex === index ? draft : item)));
    setEditingRuleIndex(null);
    setRateLimitMessage('');
  }

  return (
    <AccountDetailSection
      componentName="RateLimitRulesSection"
      eyebrow="Route Guard"
      title={t('accounts.rate_limit_rules_title')}
      meta={`${t('accounts.rate_limit_cache')} ${rateLimitMetaTimestamp ? new Date(rateLimitMetaTimestamp).toLocaleString() : '-'}`}
      density="dense"
      span="wide"
      actions={
        <button
          type="button"
          onClick={addRateLimitRule}
          className={rateLimitRulesPrimaryButtonClass}
          disabled={savingRules}
        >
          {t('accounts.rate_limit_add_rule')}
        </button>
      }
    >
      <div className={rateLimitRulesShellClass} data-rate-limit-rules-section>
        {dirty ? (
          <div className={rateLimitRulesMetaClass}>
            {t('accounts.rate_limit_dirty')}
          </div>
        ) : null}

        {rateLimitMessage ? (
          <div
            className={`${rateLimitRulesNoticeClass} ${rateLimitRulesNoticeToneClass[rateLimitMessageTone]}`}
            data-rate-limit-rule-message={rateLimitMessageTone}
          >
            {rateLimitMessage}
          </div>
        ) : null}

        {legacyBindings.length > 0 ? (
          <div
            className={`${rateLimitRulesNoticeClass} ${rateLimitRulesNoticeToneClass.neutral}`}
            data-rate-limit-rule-message="legacy"
          >
            {t('accounts.rate_limit_legacy_key_warning')} {legacyBindings.length}
          </div>
        ) : null}

        {ruleDrafts.length === 0 ? (
          <div
            data-rate-limit-view-mode="config"
          >
            <AccountDetailEmptyState>
              <button
                type="button"
                onClick={addRateLimitRule}
                className="font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] underline decoration-dotted underline-offset-4"
                disabled={savingRules}
              >
                {t('accounts.rate_limit_no_local_rule')}
              </button>
            </AccountDetailEmptyState>
          </div>
        ) : (
          <div
            data-rate-limit-view-mode="config"
            data-rate-limit-rules-list
            className={rateLimitRulesListClass}
            role="list"
          >
            {ruleDrafts.map((draft, index) => {
              const strategy = strategies.find((item) => item.id === draft.strategy) || strategies[0];
              const windows = supportedWindowsForStrategy(strategy);
              const ruleState = rateLimitStatus?.rules.find((item) => item.rule.id && item.rule.id === draft.id);
              const ruleDomID = `rate-limit-rule-${draft.id || index}`;
              const isEditing = editingRuleIndex === index;
              if (!isEditing) {
                return (
                  <div
                    key={draft.id || `new-${index}`}
                    className={`grid min-w-0 items-center gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] ${rateLimitRulesPanelClass}`}
                    data-rate-limit-rule-card
                    role="listitem"
                  >
                    <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center" title={t('accounts.rate_limit_enabled')}>
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) => updateRateLimitDraft(index, { enabled: event.target.checked })}
                        disabled={savingRules}
                        className="h-4 w-4 accent-[var(--gt-ink-primary)]"
                        aria-label={t('accounts.rate_limit_enabled')}
                      />
                    </label>
                    <div className="min-w-0">
                      <div
                        className={rateLimitRulesTitleClass}
                        title={buildRateLimitRuleRowSummary(draft, strategy, t)}
                      >
                        {buildRateLimitRuleRowSummary(draft, strategy, t)}
                      </div>
                      {ruleState ? (
                        <div
                          className={`mt-1 truncate ${rateLimitRulesMetaClass} ${
                            ruleState.exceeded ? 'text-[var(--gt-status-danger)]' : ''
                          }`}
                          title={`${Math.round(ruleState.usagePct)}% ${formatRateLimitMetric(ruleState.currentUsage)}/${formatRateLimitMetric(ruleState.rule.limitValue)}`}
                        >
                          {Math.round(ruleState.usagePct)}% {formatRateLimitMetric(ruleState.currentUsage)}/{formatRateLimitMetric(ruleState.rule.limitValue)}
                        </div>
                      ) : null}
                    </div>
                    <div ref={openRuleMenuIndex === index ? ruleMenuRef : undefined} className="relative">
                      <button
                        type="button"
                        aria-label={t('accounts.rate_limit_rule_actions')}
                        aria-haspopup="menu"
                        aria-expanded={openRuleMenuIndex === index}
                        onClick={() => setOpenRuleMenuIndex((current) => (current === index ? null : index))}
                        className={rateLimitRulesIconButtonClass}
                        disabled={savingRules}
                        title={t('accounts.rate_limit_rule_actions')}
                      >
                        <MoreVertical size={15} strokeWidth={3} />
                      </button>
                      {openRuleMenuIndex === index ? (
                        <div
                          role="menu"
                          className="absolute right-0 top-full z-30 mt-2 w-40 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-1 shadow-lg"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => startEditingRateLimitRule(index)}
                            className={rateLimitRulesMenuItemClass}
                          >
                            <Pencil size={14} strokeWidth={3} />
                            {t('accounts.rate_limit_rule_edit')}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => deleteRateLimitRule(index)}
                            className={rateLimitRulesDangerMenuItemClass}
                          >
                            <Trash2 size={14} strokeWidth={3} />
                            {t('common.delete')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }
              return (
                <fieldset
                  key={draft.id || `new-${index}`}
                  className={`grid min-w-0 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(7rem,0.8fr)_minmax(9rem,1fr)_minmax(8rem,0.8fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(7rem,0.8fr)_minmax(9rem,1fr)_minmax(8rem,0.8fr)_auto] ${rateLimitRulesPanelClass}`}
                  data-rate-limit-rule-draft
                  role="listitem"
                  disabled={savingRules}
                >
                  <legend className="sr-only">{t('accounts.rate_limit_rule_legend')}</legend>
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
                      className={rateLimitRulesInputClass}
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
                      className={rateLimitRulesInputClass}
                    >
                      {windows.map((window) => (
                        <option key={window} value={window}>
                          {formatRateLimitWindowLabel(window)}
                        </option>
                      ))}
                    </select>
                  </RuleField>
                  <RuleField label={t('accounts.rate_limit_limit')} htmlFor={`${ruleDomID}-limit`}>
                    <div className="flex h-9 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]">
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
                        className={rateLimitRulesInlineInputClass}
                      />
                      <span className="flex w-10 items-center justify-center border-l border-[var(--gt-border-subtle)] text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]">
                        {draft.strategy === 'token-window' ? 'M' : t('accounts.rate_limit_count_unit')}
                      </span>
                    </div>
                  </RuleField>
                  <RuleField label={t('accounts.rate_limit_action')} htmlFor={`${ruleDomID}-action`}>
                    <select
                      id={`${ruleDomID}-action`}
                      value={draft.action}
                      onChange={(event) => updateRateLimitDraft(index, { action: event.target.value })}
                      className={rateLimitRulesInputClass}
                    >
                      <option value="block">{t('accounts.rate_limit_action_block')}</option>
                      <option value="warn">{t('accounts.rate_limit_action_warn')}</option>
                    </select>
                  </RuleField>
                  <div className="flex min-w-0 items-end justify-end self-end md:col-span-4 xl:col-span-1 xl:self-end">
                    <button
                      type="button"
                      onClick={() => finishEditingRateLimitRule(index)}
                      className={rateLimitRulesPrimaryButtonClass}
                      disabled={savingRules}
                    >
                      {t('accounts.rate_limit_rule_save')}
                    </button>
                  </div>
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

function buildRateLimitRuleRowSummary(
  rule: RateLimitRule,
  strategy: RateLimitStrategyMeta | undefined,
  t: Translator,
) {
  const strategyLabel = strategy?.name || String(rule.strategy || '').toUpperCase();
  const windowLabel = formatRateLimitWindowLabel(rule.window);
  const limitLabel = rule.strategy === 'token-window'
    ? `${formatRateLimitLimitDraftValue(rule)}M`
    : `${formatRateLimitMetric(rule.limitValue)} ${t('accounts.rate_limit_count_unit')}`;
  const actionLabel = rule.action === 'warn'
    ? t('accounts.rate_limit_action_warn')
    : t('accounts.rate_limit_action_block');
  return `${strategyLabel} / ${windowLabel} / ${limitLabel} / ${actionLabel}`;
}

function RuleField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block min-w-0 space-y-1">
      <span className="block font-mono text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
