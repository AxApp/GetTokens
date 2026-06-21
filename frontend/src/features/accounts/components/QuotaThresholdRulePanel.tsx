import { useEffect, useMemo, useState } from 'react';
import { useDebug } from '../../../context/useDebug';
import type { QuotaThresholdRule, RouteGuardReasonTraceStep, RouteGuardSimulationResult } from '../../../types';
import useQuotaThresholdRules from '../hooks/useQuotaThresholdRules';
import useQuotaCalibrations from '../hooks/useQuotaCalibrations';
import useRouteGuardSimulation from '../hooks/useRouteGuardSimulation';
import useBudgetWindowDefinitions from '../hooks/useBudgetWindowDefinitions';
import { buildRouteGuardSimulationRequest } from '../model/routeGuardSimulation';
import { buildQuotaThresholdCondition, buildQuotaThresholdRule } from '../model/quotaThresholdRule';
import {
  budgetWindowDefinitionLabel,
  buildBoundedBudgetWindowDefinition,
  buildDailyBudgetWindowDefinition,
  buildMultiDayBudgetWindowDefinition,
  quotaWindowFactLabel,
  type BudgetWindowKind,
  type BudgetWindowMetric,
} from '../model/budgetWindowDefinition';
import type { QuotaWindowDisplay } from '../model/types';
import { AccountDetailPill } from './AccountDetailPrimitives';

interface QuotaThresholdRulePanelProps {
  accountKey: string;
  windows: QuotaWindowDisplay[];
}

const quotaThresholdPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const quotaThresholdMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const quotaThresholdButtonClass =
  'inline-flex min-h-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2 py-1 text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';
const quotaThresholdInputClass =
  'min-h-8 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2 py-1 font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] outline-none transition focus-visible:border-[var(--gt-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--gt-border-subtle)]';
const quotaThresholdMetaClass = 'font-mono text-[length:var(--gt-font-size-2xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';

export function QuotaThresholdRulePanel({ accountKey, windows }: QuotaThresholdRulePanelProps) {
  const { trackRequest } = useDebug();
  const {
    quotaThresholdRulesByAccountKey,
    loadQuotaThresholdRules,
    createQuotaThresholdRule,
    updateQuotaThresholdRule,
    deleteQuotaThresholdRule,
  } = useQuotaThresholdRules(trackRequest);
  const {
    quotaCalibrationsByAccountKey,
    loadQuotaCalibrations,
  } = useQuotaCalibrations(trackRequest);
  const {
    simulateRouteGuardRule,
  } = useRouteGuardSimulation(trackRequest);
  const {
    budgetWindowDefinitions,
    budgetWindowFactsByAccountKey,
    loadBudgetWindowDefinitions,
    createBudgetWindowDefinition,
    deleteBudgetWindowDefinition,
    previewBudgetWindowFacts,
  } = useBudgetWindowDefinitions(trackRequest);

  const [formOpen, setFormOpen] = useState(false);
  const [definitionFormOpen, setDefinitionFormOpen] = useState(false);
  const [windowKey, setWindowKey] = useState('');
  const [thresholdPercent, setThresholdPercent] = useState('20');
  const [definitionID, setDefinitionID] = useState('tokens_daily');
  const [definitionKind, setDefinitionKind] = useState<BudgetWindowKind>('daily');
  const [definitionMetric, setDefinitionMetric] = useState<BudgetWindowMetric>('tokens');
  const [definitionLimit, setDefinitionLimit] = useState('100000');
  const [definitionTimezone, setDefinitionTimezone] = useState('Asia/Shanghai');
  const [definitionDays, setDefinitionDays] = useState('7');
  const [definitionStartsAt, setDefinitionStartsAt] = useState('');
  const [definitionEndsAt, setDefinitionEndsAt] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [conditionJson, setConditionJson] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [definitionSubmitting, setDefinitionSubmitting] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [simulationError, setSimulationError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [simulationResult, setSimulationResult] = useState<RouteGuardSimulationResult | null>(null);

  const rules = quotaThresholdRulesByAccountKey[accountKey] ?? [];
  const calibrations = quotaCalibrationsByAccountKey[accountKey] ?? [];
  const previewFacts = budgetWindowFactsByAccountKey[accountKey] ?? [];
  const enabledRules = useMemo(() => rules.filter((rule) => rule.enabled !== false), [rules]);
  const windowOptions = useMemo(
    () => {
      const options = previewFacts.map((fact) => ({ id: fact.windowId, label: quotaWindowFactLabel(fact), source: 'preview' }));
      for (const window of windows) {
        if (!options.some((option) => option.id === window.id)) {
          options.push({ id: window.id, label: window.label, source: 'runtime' });
        }
      }
      return options;
    },
    [previewFacts, windows],
  );
  const enabledDefinitions = useMemo(
    () => budgetWindowDefinitions.filter((definition) => definition.enabled !== false),
    [budgetWindowDefinitions],
  );

  useEffect(() => {
    if (!accountKey) return;
    void loadQuotaThresholdRules(accountKey);
    void loadQuotaCalibrations(accountKey);
    void loadBudgetWindowDefinitions();
  }, [accountKey, loadBudgetWindowDefinitions, loadQuotaCalibrations, loadQuotaThresholdRules]);

  useEffect(() => {
    if (!accountKey || enabledDefinitions.length === 0) return;
    void previewBudgetWindowFacts({ accountKey, calibrations });
  }, [accountKey, calibrations, enabledDefinitions.length, previewBudgetWindowFacts]);

  useEffect(() => {
    if (windowOptions.length > 0 && !windowKey) {
      setWindowKey(windowOptions[0].id);
    }
  }, [windowOptions, windowKey]);

  async function handlePreviewBudgetFacts() {
    setPreviewing(true);
    setPreviewError('');
    try {
      const items = await previewBudgetWindowFacts({ accountKey, calibrations });
      if (items.length > 0 && !items.some((item) => item.windowId === windowKey)) {
        setWindowKey(items[0].windowId);
      }
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : '无法预览预算窗口 facts');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCreateBudgetWindowDefinition() {
    const limit = Number(definitionLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      setPreviewError('请输入大于 0 的额度上限');
      return;
    }
    setDefinitionSubmitting(true);
    setPreviewError('');
    try {
      let definition;
      if (definitionKind === 'daily') {
        definition = buildDailyBudgetWindowDefinition({
          id: definitionID,
          metric: definitionMetric,
          limit,
          timezone: definitionTimezone,
        });
      } else if (definitionKind === 'multi-day') {
        definition = buildMultiDayBudgetWindowDefinition({
          id: definitionID,
          metric: definitionMetric,
          limit,
          days: Number(definitionDays),
          timezone: definitionTimezone,
        });
      } else {
        definition = buildBoundedBudgetWindowDefinition({
          id: definitionID,
          metric: definitionMetric,
          limit,
          startsAt: definitionStartsAt,
          endsAt: definitionEndsAt,
        });
      }
      await createBudgetWindowDefinition(definition);
      const facts = await previewBudgetWindowFacts({ accountKey, calibrations });
      setWindowKey(definition.id || facts[0]?.windowId || windowKey);
      setDefinitionFormOpen(false);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : '窗口定义保存失败');
    } finally {
      setDefinitionSubmitting(false);
    }
  }

  async function handleDisableBudgetWindowDefinition(id: string) {
    setPreviewError('');
    try {
      await deleteBudgetWindowDefinition(id);
      await previewBudgetWindowFacts({ accountKey, calibrations });
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : '窗口定义停用失败');
    }
  }

  async function handleSubmit() {
    const parsedThreshold = Number(thresholdPercent);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 100) {
      setError('请输入 0-100 的百分比');
      return;
    }
    if (!windowKey.trim()) {
      setError('请选择窗口');
      return;
    }
    let condition: Record<string, unknown>;
    if (advancedOpen) {
      try {
        condition = JSON.parse(conditionJson || '{}') as Record<string, unknown>;
      } catch {
        setError('高级条件 JSON 格式错误');
        return;
      }
    } else {
      condition = buildQuotaThresholdCondition({
        windowKey: windowKey.trim(),
        metric: 'remaining-percent',
        comparator: '<=',
        value: parsedThreshold,
      });
    }
    setSubmitting(true);
    setError('');
    try {
      await createQuotaThresholdRule(buildQuotaThresholdRule({
        accountKey,
        windowKey: windowKey.trim(),
        metric: 'remaining-percent',
        thresholdPercent: parsedThreshold,
        condition,
        enabled: true,
      }));
      setFormOpen(false);
      setThresholdPercent('20');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(rule: QuotaThresholdRule) {
    if (!rule.id) return;
    setError('');
    try {
      await updateQuotaThresholdRule(rule.id, buildQuotaThresholdRule({
        id: rule.id,
        accountKey: rule.accountKey || accountKey,
        windowKey: rule.windowKey,
        metric: rule.metric === 'used-percent' ? 'used-percent' : 'remaining-percent',
        comparator: rule.comparator,
        thresholdPercent: rule.thresholdPercent,
        condition: rule.condition,
        enabled: rule.enabled === false,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '规则更新失败');
    }
  }

  async function handleDelete(rule: QuotaThresholdRule) {
    if (!rule.id) return;
    setError('');
    try {
      await deleteQuotaThresholdRule(rule.id, rule.accountKey || accountKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '规则删除失败');
    }
  }

  function buildDraftRuleForSimulation() {
    const parsedThreshold = Number(thresholdPercent);
    let condition: Record<string, unknown> | undefined;
    if (advancedOpen) {
      condition = JSON.parse(conditionJson || '{}') as Record<string, unknown>;
    } else {
      condition = buildQuotaThresholdCondition({
        windowKey: windowKey.trim(),
        metric: 'remaining-percent',
        comparator: '<=',
        value: Number.isFinite(parsedThreshold) ? parsedThreshold : 20,
      });
    }
    return buildQuotaThresholdRule({
      accountKey,
      windowKey: windowKey.trim(),
      metric: 'remaining-percent',
      thresholdPercent: Number.isFinite(parsedThreshold) ? parsedThreshold : 20,
      condition,
      enabled: true,
    });
  }

  async function handleSimulate(rule?: QuotaThresholdRule) {
    setSimulationError('');
    setError('');
    setSimulating(true);
    try {
      const simulationRule = rule || buildDraftRuleForSimulation();
      const targetWindow = windows.find((window) => window.id === (simulationRule.windowKey || windowKey)) || windows[0] || null;
      const sidecarFacts = previewFacts.length > 0 ? previewFacts : [];
      const result = await simulateRouteGuardRule(buildRouteGuardSimulationRequest({
        accountKey,
        rule: simulationRule,
        ruleId: rule?.id,
        window: targetWindow,
        quotaWindowFacts: sidecarFacts,
        calibrations,
      }));
      setSimulationResult(result as RouteGuardSimulationResult);
    } catch (err: unknown) {
      setSimulationResult(null);
      setSimulationError(err instanceof Error ? err.message : '无法模拟当前规则');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div data-account-quota-threshold-rule-panel="true" className={`${quotaThresholdMutedPanelClass} grid gap-2 p-3`}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={quotaThresholdMetaClass}>
            STOP RULES
          </div>
          <div className="mt-1 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
            Token 窗口低于指定百分比时停止路由
          </div>
          <div className="mt-1 text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
            先由 sidecar 生成多窗口 preview facts，再保存规则并调用 simulator trace
          </div>
        </div>
        <AccountDetailPill tone={enabledRules.length > 0 ? 'warning' : 'neutral'}>
          {enabledRules.length > 0 ? `${enabledRules.length} ENABLED` : 'NONE'}
        </AccountDetailPill>
      </div>

      {rules.length > 0 ? (
        <div className="grid gap-1.5">
          {rules.map((rule) => (
            <div
              key={rule.id || `${rule.windowKey}-${rule.thresholdPercent}`}
              data-quota-threshold-rule-item={rule.enabled === false ? 'disabled' : 'enabled'}
              className="flex min-w-0 items-center justify-between gap-2 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <AccountDetailPill tone={rule.enabled === false ? 'neutral' : 'warning'} className="!min-h-0 !px-1.5 !py-0 !text-[length:var(--gt-font-size-2xs)]">
                    {rule.enabled === false ? 'OFF' : 'STOP'}
                  </AccountDetailPill>
                  <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold tabular-nums text-[var(--gt-ink-primary)]">
                    {rule.metric || 'remaining-percent'} {rule.comparator || '<='} {rule.thresholdPercent}%
                  </span>
                  <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">
                    {rule.windowKey}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleSimulate(rule)}
                  disabled={simulating}
                  className={`${quotaThresholdButtonClass} !min-h-0 !px-1.5 !py-0.5 !text-[length:var(--gt-font-size-2xs)]`}
                >
                  模拟
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggle(rule)}
                  className={`${quotaThresholdButtonClass} !min-h-0 !px-1.5 !py-0.5 !text-[length:var(--gt-font-size-2xs)]`}
                >
                  {rule.enabled === false ? '启用' : '停用'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(rule)}
                  className={`${quotaThresholdButtonClass} !min-h-0 !px-1.5 !py-0.5 !text-[length:var(--gt-font-size-2xs)]`}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !formOpen ? (
          <div className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
            暂无停止规则，可为当前账号选择一个 quota window 和停止百分比
          </div>
        ) : null
      )}

      {error && !formOpen ? (
        <div className="font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-status-danger)]">
          {error}
        </div>
      ) : null}

      {simulationError ? (
        <div data-route-guard-simulation-state="failed" className="border border-[var(--gt-status-danger)] bg-[var(--gt-surface-canvas)] p-2">
          <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-status-danger)]">
            无法模拟
          </div>
          <div className="mt-1 text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
            {simulationError}；不能据此认为规则安全。
          </div>
        </div>
      ) : null}

      {simulationResult ? (
        <RouteGuardSimulationPreview result={simulationResult} />
      ) : null}

      <div data-budget-window-definition-panel="true" className={`${quotaThresholdPanelClass} grid gap-2 p-2`}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <div className={quotaThresholdMetaClass}>
              Budget windows
            </div>
            <div className="mt-1 text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
              前端只创建/选择 definition；used/remaining/block 由 sidecar preview 与 simulator 决定
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => void handlePreviewBudgetFacts()} disabled={previewing} className={`${quotaThresholdButtonClass} !min-h-0 !px-1.5 !py-0.5 !text-[length:var(--gt-font-size-2xs)]`}>
              {previewing ? '预览中...' : '刷新 preview'}
            </button>
            <button type="button" onClick={() => setDefinitionFormOpen((value) => !value)} className={`${quotaThresholdButtonClass} !min-h-0 !px-1.5 !py-0.5 !text-[length:var(--gt-font-size-2xs)]`}>
              {definitionFormOpen ? '收起' : '创建窗口'}
            </button>
          </div>
        </div>
        {enabledDefinitions.length > 0 ? (
          <div className="grid gap-1">
            {enabledDefinitions.map((definition) => (
              <div key={definition.id} className="flex min-w-0 items-center justify-between gap-2 border border-[var(--gt-border-subtle)] px-2 py-1">
                <span className="min-w-0 truncate font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-primary)]">
                  {budgetWindowDefinitionLabel(definition)}
                </span>
                <button type="button" onClick={() => void handleDisableBudgetWindowDefinition(definition.id || '')} className={`${quotaThresholdButtonClass} !min-h-0 !px-1.5 !py-0.5 !text-[length:var(--gt-font-size-2xs)]`}>
                  停用
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
            暂无 budget window definition；可以先创建 daily / multi-day / bounded。
          </div>
        )}
        {previewFacts.length > 0 ? (
          <div data-budget-window-preview-facts="true" className="grid gap-1">
            {previewFacts.map((fact) => (
              <div key={fact.windowId} className="font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                <span className="text-[var(--gt-ink-primary)]">{quotaWindowFactLabel(fact)}</span>
                {' · raw '}
                {Number(fact.rawUsed || 0).toFixed(0)}
                {' · delta '}
                {Number(fact.calibrationDelta || 0).toFixed(0)}
                {' · recovery '}
                {fact.endsAt || 'unknown'}
              </div>
            ))}
          </div>
        ) : (
          <div data-budget-window-preview-state="inconclusive" className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
            还没有 sidecar preview facts；无法确认规则会生效，也不能显示为绿色安全。
          </div>
        )}
        {previewError ? (
          <div className="font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-status-danger)]">
            {previewError}
          </div>
        ) : null}
        {definitionFormOpen ? (
          <div data-budget-window-definition-form="true" className="grid gap-2 border-t border-[var(--gt-border-subtle)] pt-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">ID</span>
                <input value={definitionID} onChange={(event) => setDefinitionID(event.target.value)} className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`} />
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Kind</span>
                <select value={definitionKind} onChange={(event) => setDefinitionKind(event.target.value as BudgetWindowKind)} className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`}>
                  <option value="daily">daily</option>
                  <option value="multi-day">multi-day calendar</option>
                  <option value="bounded">bounded</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Metric</span>
                <select value={definitionMetric} onChange={(event) => setDefinitionMetric(event.target.value as BudgetWindowMetric)} className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`}>
                  <option value="tokens">tokens</option>
                  <option value="requests">requests</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Limit</span>
                <input type="number" min={1} value={definitionLimit} onChange={(event) => setDefinitionLimit(event.target.value)} className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`} />
              </label>
              {definitionKind !== 'bounded' ? (
                <label className="grid gap-1">
                  <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Timezone</span>
                  <input value={definitionTimezone} onChange={(event) => setDefinitionTimezone(event.target.value)} className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`} />
                </label>
              ) : null}
              {definitionKind === 'multi-day' ? (
                <label className="grid gap-1">
                  <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Days</span>
                  <input type="number" min={1} value={definitionDays} onChange={(event) => setDefinitionDays(event.target.value)} className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`} />
                </label>
              ) : null}
              {definitionKind === 'bounded' ? (
                <>
                  <label className="grid gap-1">
                    <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">StartsAt</span>
                    <input type="datetime-local" value={definitionStartsAt} onChange={(event) => setDefinitionStartsAt(event.target.value)} className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`} />
                  </label>
                  <label className="grid gap-1">
                    <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">EndsAt</span>
                    <input type="datetime-local" value={definitionEndsAt} onChange={(event) => setDefinitionEndsAt(event.target.value)} className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`} />
                  </label>
                </>
              ) : null}
            </div>
            <button type="button" onClick={() => void handleCreateBudgetWindowDefinition()} disabled={definitionSubmitting} className={`${quotaThresholdButtonClass} !text-[length:var(--gt-font-size-2xs)]`}>
              {definitionSubmitting ? '保存中...' : '保存并预览'}
            </button>
          </div>
        ) : null}
      </div>

      {formOpen ? (
        <div data-quota-threshold-rule-form="true" className="grid gap-2 border-t border-[var(--gt-border-subtle)] pt-2">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <label className="grid gap-1">
              <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
                窗口
              </span>
              <select
                value={windowKey}
                onChange={(event) => { setWindowKey(event.target.value); setError(''); }}
                className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`}
              >
                {windowOptions.length > 0 ? (
                  windowOptions.map((window) => (
                    <option key={window.id} value={window.id}>{window.label}</option>
                  ))
                ) : (
                  <option value="">无窗口数据</option>
                )}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
                停止阈值 %
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={thresholdPercent}
                onChange={(event) => { setThresholdPercent(event.target.value); setError(''); }}
                className={`${quotaThresholdInputClass} font-mono !py-1 !text-[length:var(--gt-font-size-xs)]`}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
            <input
              type="checkbox"
              checked={advancedOpen}
              onChange={(event) => {
                const checked = event.target.checked;
                setAdvancedOpen(checked);
                setError('');
                if (checked && !conditionJson.trim()) {
                  setConditionJson(JSON.stringify(buildQuotaThresholdCondition({
                    windowKey: windowKey.trim(),
                    metric: 'remaining-percent',
                    comparator: '<=',
                    value: Number(thresholdPercent) || 20,
                  }), null, 2));
                }
              }}
            />
            高级 DSL JSON
          </label>
          {advancedOpen ? (
            <label className="grid gap-1">
              <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
                Condition AST
              </span>
              <textarea
                value={conditionJson}
                onChange={(event) => { setConditionJson(event.target.value); setError(''); }}
                rows={7}
                spellCheck={false}
                className={`${quotaThresholdInputClass} font-mono !min-h-[148px] !py-2 !text-[length:var(--gt-font-size-2xs)]`}
              />
              <span className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                支持 all / any / not 与 leaf: window_key, metric, comparator, value
              </span>
            </label>
          ) : null}
          {error ? (
            <div className="font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-status-danger)]">
              {error}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !windowKey.trim()}
              className={`${quotaThresholdButtonClass} !text-[length:var(--gt-font-size-2xs)]`}
            >
              {submitting ? '提交中...' : '添加停止规则'}
            </button>
            <button
              type="button"
              onClick={() => void handleSimulate()}
              disabled={simulating}
              className={`${quotaThresholdButtonClass} !text-[length:var(--gt-font-size-2xs)]`}
            >
              {simulating ? '模拟中...' : '模拟当前规则'}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setError(''); }}
              disabled={submitting}
              className={`${quotaThresholdButtonClass} !text-[length:var(--gt-font-size-2xs)]`}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFormOpen(true);
            setError('');
            if (!conditionJson.trim()) {
              setConditionJson(JSON.stringify(buildQuotaThresholdCondition({
                windowKey: windowKey.trim() || windows[0]?.id || '',
                metric: 'remaining-percent',
                comparator: '<=',
                value: Number(thresholdPercent) || 20,
              }), null, 2));
            }
          }}
          className={`${quotaThresholdButtonClass} !text-[length:var(--gt-font-size-2xs)]`}
        >
          添加停止规则
        </button>
      )}
    </div>
  );
}

function RouteGuardSimulationPreview({ result }: { result: RouteGuardSimulationResult }) {
  const decision = String(result.decision || 'allow');
  const tone = decision === 'block' ? 'warning' : decision === 'diagnostic' ? 'neutral' : 'success';
  const label = decision === 'block' ? '阻断' : decision === 'diagnostic' ? '诊断' : '允许';
  const trace = result.accountTrace?.reasonTrace || [];
  const diagnostics = result.diagnostics || [];
  return (
    <div
      data-route-guard-simulation-state={decision}
      className={`${quotaThresholdPanelClass} grid gap-2 p-2`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <AccountDetailPill tone={tone}>{label}</AccountDetailPill>
        {result.matchedRule?.id ? (
          <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
            matched rule: {result.matchedRule.id}
          </span>
        ) : null}
        {result.recoveryAt ? (
          <span className="font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
            recoveryAt {result.recoveryAt}
          </span>
        ) : null}
        {result.expiresAt ? (
          <span className="font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
            expiresAt {result.expiresAt}
          </span>
        ) : null}
      </div>
      {decision === 'diagnostic' ? (
        <div className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
          facts 不足、缺少额度窗口或额度数据已过期，本次只显示诊断，不会按阻断展示。
        </div>
      ) : null}
      <div className="grid gap-1">
        <div className={quotaThresholdMetaClass}>
          Account decision
        </div>
        <div className="text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
          <span className="font-mono text-[var(--gt-ink-primary)]">{result.accountTrace?.source || 'n/a'}</span>
          {' · '}
          {result.accountTrace?.reason || 'no reason'}
        </div>
      </div>
      <ReasonTraceList title="Reason trace" steps={trace} />
      {diagnostics.length > 0 ? (
        <ReasonTraceList title="Diagnostics / ignored facts" steps={diagnostics} />
      ) : null}
    </div>
  );
}

function ReasonTraceList({ title, steps }: { title: string; steps: RouteGuardReasonTraceStep[] }) {
  if (!steps.length) {
    return null;
  }
  return (
    <div className="grid gap-1">
      <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
        {title}
      </div>
      <div className="grid gap-1">
        {steps.map((step, index) => (
          <div key={step.code + '-' + index} className="border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-1.5">
            <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
              {step.code}
            </div>
            {step.message ? (
              <div className="mt-0.5 text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                {step.message}
              </div>
            ) : null}
            {step.data ? (
              <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-1 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
                {JSON.stringify(step.data, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
