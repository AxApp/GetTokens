import {
  BookOpenText,
  ChevronDown,
  CircleHelp,
  Play,
  RefreshCcw,
  Settings2,
  Shuffle,
  Split,
  X,
} from 'lucide-react';
import { Button, Select } from 'antd';
import { useEffect, useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import { RunRouteResilienceAction } from '../../../../wailsjs/go/main/App';
import { main } from '../../../../wailsjs/go/models';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import {
  CHANNEL_ROUTE_MODE_HELP_SECTIONS,
  buildChannelRouteDecisionSummary,
  buildRouteResilienceActionDescriptors,
  buildRouteResilienceActionHistoryEntry,
  buildRouteResilienceActionTargets,
  buildChannelRoutingExplainDigest,
  findLatestRouteResilienceActionHistoryForTarget,
  type ChannelID,
  type ChannelRouteMode,
  type ChannelRouteDecisionSnapshot,
  type ChannelRoutingConfig,
  type ChannelRoutingParticipantAccountLike,
  type ProjectCandidatePoolProjectOption,
  type RouteResilienceActionHistoryEntry,
  type RouteResilienceActionName,
} from '../model/channelRouting';

interface ChannelRoutingWorkbenchProps {
  channel: ChannelID;
  config: ChannelRoutingConfig;
  explain?: main.ChannelRoutingExplainResult | null;
  routeDecisions?: ChannelRouteDecisionSnapshot[] | null;
  disabled?: boolean;
  saving?: boolean;
  message?: string;
  accounts?: ChannelRoutingParticipantAccountLike[];
  modelOptions?: string[];
  modelValue?: string;
  projectOptions?: ProjectCandidatePoolProjectOption[];
  projectValue?: string;
  onModeChange: (mode: ChannelRouteMode) => void;
  onOpenProjectConfig?: () => void;
  onModelChange?: (model: string) => void;
  onProjectChange?: (projectKey: string) => void;
  onShadowModeChange: (mode: ChannelRouteMode) => void;
  onExplain: () => void;
}

type LucideIcon = typeof Split;

const routeModes: Array<{
  mode: ChannelRouteMode;
  icon: LucideIcon;
  label: string;
  cue: string;
}> = [
  { mode: 'sequential', icon: Split, label: '顺序', cue: '01→02→03' },
  { mode: 'balanced', icon: Shuffle, label: '均衡', cue: '空闲优先' },
];

const channelRoutingPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm';
const channelRoutingMutedPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const channelRoutingHeaderClass = 'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const channelRoutingSecondaryButtonClass =
  'inline-flex min-h-9 w-fit items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-1.5 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60';
const channelRoutingPrimaryButtonClass =
  'inline-flex min-h-11 w-full items-center gap-2 rounded border border-[var(--gt-border-strong)] bg-[var(--gt-ink-primary)] px-3 py-2 text-[length:var(--gt-font-size-md)] font-normal text-[var(--gt-surface-canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
const channelRoutingFieldClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]';
const channelRoutingMetaTextClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';

export default function ChannelRoutingWorkbench({
  channel,
  config,
  explain,
  routeDecisions = [],
  disabled = false,
  saving = false,
  message = '',
  accounts = [],
  modelOptions = [],
  modelValue = '',
  projectOptions = [],
  projectValue = '',
  onModeChange,
  onOpenProjectConfig,
  onModelChange,
  onProjectChange,
  onShadowModeChange,
  onExplain,
}: ChannelRoutingWorkbenchProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedRouteActionTargetID, setSelectedRouteActionTargetID] = useState('');
  const [routeActionPending, setRouteActionPending] = useState<RouteResilienceActionName | ''>('');
  const [routeActionHistory, setRouteActionHistory] = useState<RouteResilienceActionHistoryEntry[]>([]);
  const [routeActionError, setRouteActionError] = useState('');
  const explainView = buildChannelRoutingExplainDigest(explain);
  const routeDecisionRows = (routeDecisions ?? []).map((item) => buildChannelRouteDecisionSummary(item));
  const hasExplain = explainView.hasExplain;
  const candidateCount = explainView.candidateRows.length;
  const filteredCount = explainView.filteredRows.reduce((total, item) => total + item.count, 0);
  const shadowCandidateCount = explainView.shadowCandidateRows.length;
  const normalizedModelOptions = normalizeDiagnosticModelOptions(modelOptions, modelValue);
  const routeActionRuntimeAvailable = hasWailsAppBindings();
  const routeActionTargets = buildRouteResilienceActionTargets(routeDecisions, accounts, modelValue);
  const routeActionTarget =
    routeActionTargets.find((target) => target.id === selectedRouteActionTargetID) || routeActionTargets[0] || null;
  const routeActionButtons = buildRouteResilienceActionDescriptors(routeActionTarget, routeActionRuntimeAvailable);
  const routeActionHistoryEntry = findLatestRouteResilienceActionHistoryForTarget(
    routeActionHistory,
    routeActionTarget?.id || '',
  );

  useEffect(() => {
    if (!helpOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setHelpOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [helpOpen]);

  useEffect(() => {
    if (routeActionTargets.length === 0) {
      if (selectedRouteActionTargetID) {
        setSelectedRouteActionTargetID('');
      }
      return;
    }
    if (routeActionTargets.some((target) => target.id === selectedRouteActionTargetID)) {
      return;
    }
    setSelectedRouteActionTargetID(routeActionTargets[0].id);
  }, [routeActionTargets, selectedRouteActionTargetID]);

  async function runRouteResilienceAction(action: RouteResilienceActionName) {
    if (!routeActionTarget || !routeActionRuntimeAvailable) {
      return;
    }
    const reason = `channel-routing-workbench:${channel}:${action}`;
    const input = main.RouteResilienceActionInput.createFrom({
      action,
      accountKey: routeActionTarget.accountKey || undefined,
      authId: routeActionTarget.authId || undefined,
      model: routeActionTarget.model || undefined,
      sources: action === 'clear_transient_lockout' ? [routeActionTarget.source].filter(Boolean) : undefined,
      reason,
      idempotencyKey: `${reason}:${routeActionTarget.id || routeActionTarget.accountKey || routeActionTarget.authId || 'unknown'}`,
    });

    setRouteActionPending(action);
    setRouteActionError('');
    try {
      const result = await RunRouteResilienceAction(input);
      const entry = buildRouteResilienceActionHistoryEntry(routeActionTarget, action, result);
      setRouteActionHistory((current) => [entry, ...current]);
    } catch (error) {
      setRouteActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setRouteActionPending('');
    }
  }

  return (
    <section
      aria-label={`${channel} 请求模式`}
      data-channel-routing-shell="true"
      className={`${channelRoutingPanelClass} overflow-hidden`}
    >
      <header className={`${channelRoutingHeaderClass} p-4`}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[var(--gt-border-strong)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]">
              <Split className="h-4 w-4" strokeWidth={4} />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 text-[length:var(--gt-font-size-lg)] font-semibold leading-5 text-[var(--gt-ink-primary)] sm:text-[length:var(--font-size-heading-sm)] sm:leading-normal">
                请求模式
              </h2>
              <Button
                size="small"
                onClick={() => setHelpOpen(true)}
                aria-label="查看请求模式说明"
                title="查看请求模式说明"
                aria-pressed={helpOpen}
                icon={<CircleHelp className="h-4 w-4" strokeWidth={4} />}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border transition-colors ${
                  helpOpen
                    ? 'border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
                    : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)] [@media(hover:hover)]:hover:border-[var(--gt-ink-primary)]'
                }`}
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
            {onOpenProjectConfig ? (
              <Button
                size="small"
                onClick={onOpenProjectConfig}
                disabled={disabled || saving}
                className={channelRoutingSecondaryButtonClass}
                icon={<Settings2 className="h-3.5 w-3.5" strokeWidth={4} />}
              >
                项目配置
              </Button>
            ) : null}
            <div className="grid min-w-0 flex-1 gap-2 sm:max-w-[28rem] sm:flex-none sm:grid-cols-2">
              {routeModes.map((item) => (
                <StrategyButton
                  key={item.mode}
                  mode={item.mode}
                  icon={item.icon}
                  label={item.label}
                  cue={item.cue}
                  active={config.routeMode === item.mode}
                  disabled={disabled || saving}
                  onModeChange={onModeChange}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {message ? (
        <p className="border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3 text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-secondary)]">
          {message}
        </p>
      ) : null}

      <details data-channel-routing-diagnostics="true" className="group border-t border-[var(--gt-border-subtle)] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)] [&::-webkit-details-marker]:hidden">
          <span>高级诊断</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">
              {hasExplain ? '有结果' : '可选'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" strokeWidth={4} />
          </span>
        </summary>

        <div className="mt-4 space-y-4">
          <section className="grid gap-4 lg:grid-cols-[minmax(14rem,0.72fr)_minmax(0,1.7fr)]">
            <aside className="min-w-0 py-1">
              <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                <span className="text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">条件列表</span>
                <span className={channelRoutingMetaTextClass}>
                  INPUT
                </span>
              </div>
              <div className="grid gap-3">
                <Button
                  type="primary"
                  size="small"
                  onClick={onExplain}
                  disabled={disabled}
                  className={channelRoutingPrimaryButtonClass}
                  icon={<Play className="h-3.5 w-3.5 shrink-0" strokeWidth={4} />}
                >
                  <span className="min-w-0 flex-1 truncate text-left font-semibold">运行预演</span>
                  <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold opacity-70">
                    RUN
                  </span>
                </Button>
                {onModelChange && normalizedModelOptions.length > 0 ? (
                  <DiagnosticSelect
                    label="请求模型"
                    value={modelValue}
                    disabled={disabled}
                    onChange={onModelChange}
                    options={normalizedModelOptions.map((model) => ({ value: model, label: model }))}
                  />
                ) : null}
                {onProjectChange && projectOptions.length > 0 ? (
                  <DiagnosticSelect
                    label="项目"
                    value={projectValue}
                    disabled={disabled}
                    onChange={onProjectChange}
                    options={[
                      { value: '', label: '不限项目' },
                      ...projectOptions.map((option) => ({
                        value: option.projectKey,
                        label: formatDiagnosticProjectOptionLabel(option),
                      })),
                    ]}
                  />
                ) : null}
              </div>
            </aside>

            <section className="grid min-w-0 gap-4 lg:grid-cols-2">
              <div className="min-w-0 border-l border-[var(--gt-border-subtle)] py-1 pl-4 lg:pr-3">
                <DiagnosticRouteColumn
                  title="当前模式"
                  modeLabel={explainView.modeLabel}
                  selectedTitle={hasExplain ? explainView.selectedTitle : '尚未运行'}
                  summaryLabel={hasExplain ? `${candidateCount} 个候选 / ${filteredCount} 个过滤` : '等待预演'}
                  rows={explainView.candidateRows}
                  emptyText="点击预演后显示当前模式账号顺序"
                  emphasis
                />
              </div>

              <div className="min-w-0 border-l border-[var(--gt-border-subtle)] py-1 pl-4">
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <span className="text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">对比模式</span>
                  <Select
                    size="small"
                    value={config.shadowRouteMode}
                    disabled={disabled}
                    onChange={(value) => onShadowModeChange(value as ChannelRouteMode)}
                    className="w-[4.25rem] text-center font-mono"
                    options={routeModes.map((item) => ({ value: item.mode, label: item.label }))}
                  />
                </div>
                <DiagnosticRouteColumn
                  title=""
                  modeLabel={resolveRouteModeLabel(config.shadowRouteMode)}
                  selectedTitle={hasExplain ? explainView.shadowSelectedTitle : '尚未运行'}
                  summaryLabel={hasExplain ? `${shadowCandidateCount} 个候选` : '等待预演'}
                  rows={explainView.shadowCandidateRows}
                  emptyText="点击预演后显示对比模式账号顺序"
                />
              </div>
            </section>
          </section>

          <section className="border-t border-[var(--gt-border-subtle)] pt-4">
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
              <span className="text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">最近真实决策</span>
              <span className={channelRoutingMetaTextClass}>
                SIDE CAR
              </span>
            </div>
            <div className="grid gap-2">
              {routeDecisionRows.length > 0 ? (
                routeDecisionRows.map((row) => (
                  <div
                    key={row.id}
                    className={`${channelRoutingFieldClass} min-w-0 ${
                      row.unresolved ? 'border-[var(--gt-status-danger)]' : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                        {row.title}
                      </span>
                      <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                        {row.unresolved ? 'UNRESOLVED' : 'SELECTED'}
                      </span>
                    </div>
                    {row.meta ? (
                      <div className="mt-1 min-w-0 truncate font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-secondary)]">
                        {row.meta}
                      </div>
                    ) : null}
                    {row.detail ? (
                      <div className="mt-1 text-[length:var(--gt-font-size-xs)] font-semibold leading-5 text-[var(--gt-ink-muted)]">
                        {row.detail}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <Placeholder text="运行预演或探测后，这里会显示 sidecar 最近真实路由决策。" />
              )}
            </div>
          </section>

          <section data-channel-routing-route-resilience="true" className="border-t border-[var(--gt-border-subtle)] pt-4">
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
              <span className="text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">Route Resilience</span>
              <span className={channelRoutingMetaTextClass}>
                BRIDGE
              </span>
            </div>

            {routeActionTarget ? (
              <div className="grid gap-3">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
                  <div className="grid gap-2">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">Action Targets</span>
                      <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                        {routeActionTargets.length} 个
                      </span>
                    </div>
                    {routeActionTargets.map((target) => {
                      const active = target.id === routeActionTarget.id;
                      return (
                        <Button
                          key={target.id}
                          size="small"
                          onClick={() => setSelectedRouteActionTargetID(target.id)}
                          className={`w-full rounded border px-3 py-2 text-left transition-colors ${
                            active
                              ? 'border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
                              : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)] [@media(hover:hover)]:hover:border-[var(--gt-ink-primary)]'
                          }`}
                        >
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-[length:var(--gt-font-size-md)] font-semibold">
                              {target.title}
                            </span>
                            <span
                              className={`font-mono text-[length:var(--gt-font-size-xs)] font-semibold ${
                                active ? 'text-[var(--gt-surface-canvas)] opacity-70' : 'text-[var(--gt-ink-muted)]'
                              }`}
                            >
                              {target.sourceLabel}
                            </span>
                          </div>
                          <div
                            className={`mt-1 min-w-0 truncate text-[length:var(--gt-font-size-xs)] font-semibold leading-5 ${
                              active ? 'text-[var(--gt-surface-canvas)] opacity-80' : 'text-[var(--gt-ink-secondary)]'
                            }`}
                          >
                            {target.meta}
                          </div>
                          {target.detail ? (
                            <div
                              className={`mt-1 min-w-0 truncate text-[length:var(--gt-font-size-xs)] leading-5 ${
                                active ? 'text-[var(--gt-surface-canvas)] opacity-80' : 'text-[var(--gt-ink-muted)]'
                              }`}
                            >
                              {target.detail}
                            </div>
                          ) : null}
                        </Button>
                      );
                    })}
                  </div>

                  <div className="grid gap-3">
                    <div className={`${channelRoutingFieldClass} min-w-0`}>
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                          {routeActionTarget.accountTitle}
                        </span>
                        <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                          {routeActionTarget.sourceLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-[length:var(--gt-font-size-xs)] font-semibold leading-5 text-[var(--gt-ink-secondary)]">
                        {[
                          routeActionTarget.accountKey ? `account:${routeActionTarget.accountKey}` : '',
                          routeActionTarget.authId ? `auth:${routeActionTarget.authId}` : '',
                          routeActionTarget.model ? `model:${routeActionTarget.model}` : '',
                          routeActionTarget.reasonSummary
                            ? `${routeActionTarget.reasons.length > 1 ? 'reasons' : 'reason'}:${routeActionTarget.reasonSummary}`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>

                    <div className="grid gap-2 xl:grid-cols-3">
                      {routeActionButtons.map((item) => (
                        <Button
                          key={item.action}
                          size="small"
                          onClick={() => void runRouteResilienceAction(item.action)}
                          disabled={!item.enabled || Boolean(routeActionPending) || disabled}
                          className={`${channelRoutingSecondaryButtonClass} min-w-0 justify-start text-left`}
                          title={item.disabledReason || item.helper}
                          icon={<RefreshCcw className="h-3.5 w-3.5 shrink-0" strokeWidth={4} />}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                              {item.title}
                            </span>
                            <span className="block truncate text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-secondary)]">
                              {item.enabled ? item.helper : item.disabledReason || item.helper}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </div>

                    {routeActionError ? (
                      <div className="border border-[var(--gt-status-danger)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-semibold leading-5 text-[var(--gt-status-danger)]">
                        {routeActionError}
                      </div>
                    ) : null}

                    <div
                      className={`rounded border bg-[var(--gt-surface-muted)] px-3 py-3 ${
                        routeActionHistoryEntry?.tone === 'success'
                          ? 'border-[var(--gt-status-success)]'
                          : routeActionHistoryEntry?.tone === 'warning'
                            ? 'border-[var(--gt-status-warning)]'
                            : routeActionHistoryEntry?.tone === 'danger'
                              ? 'border-[var(--gt-status-danger)]'
                              : 'border-[var(--gt-border-subtle)]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <span className="text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                          {routeActionHistoryEntry?.actionTitle || 'Action Response'}
                        </span>
                        <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                          {routeActionPending ? 'RUNNING' : routeActionHistoryEntry?.statusLabel || '未执行'}
                        </span>
                      </div>
                      {routeActionHistoryEntry ? (
                        <div className="mt-2 grid gap-1 text-[length:var(--gt-font-size-xs)] leading-5 text-[var(--gt-ink-secondary)]">
                          <div>{routeActionHistoryEntry.detail}</div>
                          {routeActionHistoryEntry.authority ? <div>authority: {routeActionHistoryEntry.authority}</div> : null}
                          {routeActionHistoryEntry.auditId ? <div>audit: {routeActionHistoryEntry.auditId}</div> : null}
                          {routeActionHistoryEntry.beforeLabel ? <div>before: {routeActionHistoryEntry.beforeLabel}</div> : null}
                          {routeActionHistoryEntry.afterLabel ? <div>after: {routeActionHistoryEntry.afterLabel}</div> : null}
                          {routeActionHistoryEntry.droppedReasonsLabel ? (
                            <div>dropped: {routeActionHistoryEntry.droppedReasonsLabel}</div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-2 text-[length:var(--gt-font-size-xs)] leading-5 text-[var(--gt-ink-muted)]">
                          当前 target 还没有 sidecar action response。
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[var(--gt-border-subtle)] pt-3">
                      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                        <span className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">Action History</span>
                        <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                          {routeActionHistory.length} 条
                        </span>
                      </div>
                      <div className="grid gap-2">
                        {routeActionHistory.length > 0 ? (
                          routeActionHistory.map((entry) => (
                            <div key={entry.id} className={`${channelRoutingFieldClass} min-w-0`}>
                              <div className="flex min-w-0 items-center justify-between gap-3">
                                <span className="min-w-0 truncate text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                                  {entry.targetTitle} · {entry.actionTitle}
                                </span>
                                <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                                  {entry.statusLabel}
                                </span>
                              </div>
                              <div className="mt-1 min-w-0 truncate text-[length:var(--gt-font-size-xs)] font-semibold leading-5 text-[var(--gt-ink-secondary)]">
                                {entry.targetMeta}
                              </div>
                              <div className="mt-1 text-[length:var(--gt-font-size-xs)] leading-5 text-[var(--gt-ink-muted)]">
                                {entry.detail}
                              </div>
                            </div>
                          ))
                        ) : (
                          <Placeholder text="执行 action 后，这里会按 target 保留 sidecar 返回历史。" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Placeholder text="最近真实决策里还没有可定位 account/auth 的 dropped reason，暂时无法触发 route resilience action。" />
            )}
          </section>
        </div>
      </details>

      {helpOpen ? (
        <RouteModeHelpModal onClose={() => setHelpOpen(false)} />
      ) : null}
    </section>
  );
}

function DiagnosticRouteColumn({
  title,
  modeLabel,
  selectedTitle,
  summaryLabel,
  rows,
  emptyText,
  emphasis = false,
}: {
  title: string;
  modeLabel: string;
  selectedTitle: string;
  summaryLabel: string;
  rows: Array<{ rank: number; id: string; title: string; meta: string }>;
  emptyText: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      {title ? (
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <span className="text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">{title}</span>
          <span className={`${channelRoutingFieldClass} max-w-[9rem] truncate px-2 py-1 text-right font-mono text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-secondary)]`}>
            {modeLabel || '未知'}
          </span>
        </div>
      ) : null}
      <div
        className={[
          `${channelRoutingFieldClass} min-w-0`,
          emphasis ? 'bg-[var(--gt-ink-primary)] !text-[var(--gt-surface-canvas)]' : 'bg-[var(--gt-surface-canvas)] !text-[var(--gt-ink-primary)]',
        ].join(' ')}
      >
        <span
          className={[
            'block font-mono text-[length:var(--gt-font-size-xs)] font-semibold',
            emphasis ? 'text-[var(--gt-surface-canvas)] opacity-70' : 'text-[var(--gt-ink-muted)]',
          ].join(' ')}
        >
          命中
        </span>
        <span className="mt-1 block min-w-0 truncate font-mono text-[length:var(--gt-font-size-lg)] font-semibold">
          {selectedTitle || '—'}
        </span>
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
        <span className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
          账号顺序
        </span>
        <span className="min-w-0 truncate text-right font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-secondary)]">
          {summaryLabel}
        </span>
      </div>
      <div className="mt-2 grid gap-2">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={`${row.rank}-${row.id}`}
              className={`${channelRoutingFieldClass} grid min-h-[3.25rem] min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center px-0 py-0`}
            >
              <span className="flex h-full items-center justify-center border-r border-[var(--gt-border-subtle)] font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                {String(row.rank).padStart(2, '0')}
              </span>
              <span className="min-w-0 px-2 py-1.5">
                <span className="block min-w-0 truncate text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                  {row.title}
                </span>
                <span className="mt-0.5 block min-w-0 truncate font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                  {row.meta}
                </span>
              </span>
            </div>
          ))
        ) : (
          <Placeholder text={emptyText} />
        )}
      </div>
    </div>
  );
}

function RouteModeHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalFrame
      onClose={onClose}
      size="xl"
      ariaLabel="请求模式说明"
      header={
        <div className="flex min-w-0 items-center justify-between gap-3">
          <SectionHeading icon={BookOpenText} label="请求模式说明" />
          <Button
            size="small"
            onClick={onClose}
            aria-label="关闭请求模式说明"
            className={channelRoutingSecondaryButtonClass}
            icon={<X className="h-3.5 w-3.5" strokeWidth={4} />}
          >
            关闭
          </Button>
        </div>
      }
      bodyClassName="p-4 sm:p-5"
    >
      <div className="border-y border-[var(--gt-border-subtle)] py-3">
        <p className="max-w-3xl text-[length:var(--gt-font-size-sm)] font-semibold leading-6 text-[var(--gt-ink-primary)]">
          顺序模式决定的是“每次路由怎么排序”，不是“只消耗一个账号”的独占开关。
        </p>
        <p className="mt-1 max-w-3xl text-[length:var(--gt-font-size-xs)] leading-5 text-[var(--gt-ink-secondary)]">
          如果前序账号不可用、触发 retry、处于冷却，或存在多个会话并发，请求会继续命中后续账号。
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {CHANNEL_ROUTE_MODE_HELP_SECTIONS.map((section) => (
          <article key={section.title} className={`${channelRoutingMutedPanelClass} min-w-0 p-3`}>
            <h3 className="text-[length:var(--gt-font-size-md)] font-semibold leading-5 text-[var(--gt-ink-primary)]">
              {section.title}
            </h3>
            <p className="mt-2 text-[length:var(--gt-font-size-xs)] leading-5 text-[var(--gt-ink-secondary)]">
              {section.body}
            </p>
            <ul className="mt-3 space-y-2">
              {section.points.map((point) => (
                <li key={point} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 text-[length:var(--gt-font-size-xs)] leading-5 text-[var(--gt-ink-primary)]">
                  <span className="mt-1 h-2 w-2 border border-[var(--gt-border-strong)]" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </ModalFrame>
  );
}

function StrategyButton({
  mode,
  icon: Icon,
  label,
  cue,
  active,
  disabled,
  onModeChange,
}: {
  mode: ChannelRouteMode;
  icon: LucideIcon;
  label: string;
  cue: string;
  active: boolean;
  disabled: boolean;
  onModeChange: (mode: ChannelRouteMode) => void;
}) {
  return (
    <Button
      size="small"
      onClick={() => onModeChange(mode)}
      disabled={disabled}
      aria-pressed={active}
      icon={<Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={4} />}
      className={`grid min-h-10 grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 rounded border px-3 py-2 text-left transition-colors ${
        active
          ? 'border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
          : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)] [@media(hover:hover)]:hover:border-[var(--gt-ink-primary)]'
      }`}
    >
      <span className="min-w-0 truncate text-[length:var(--gt-font-size-sm)] font-semibold">{label}</span>
    </Button>
  );
}

function DiagnosticSelect({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
        {label}
      </span>
      <Select
        size="small"
        value={value}
        disabled={disabled}
        onChange={(val) => onChange(val)}
        className="min-w-0 font-mono"
        options={options.map((option) => ({ value: option.value, label: option.label }))}
      />
    </label>
  );
}

function normalizeDiagnosticModelOptions(options: string[], selected: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of [selected, ...options]) {
    const model = String(value || '').trim();
    if (!model || seen.has(model)) {
      continue;
    }
    seen.add(model);
    out.push(model);
  }
  return out;
}

function formatDiagnosticProjectOptionLabel(option: ProjectCandidatePoolProjectOption): string {
  const title = String(option.projectName || option.projectKey || '').trim() || '未命名项目';
  return option.configured ? `${title} · 已配置` : title;
}

function SectionHeading({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-[var(--gt-ink-secondary)]" strokeWidth={3} />
      <div className="min-w-0 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
        {label}
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="px-2 py-3 text-[length:var(--gt-font-size-xs)] font-semibold leading-5 text-[var(--gt-ink-muted)]">
      {text}
    </div>
  );
}

function resolveRouteModeLabel(mode: ChannelRouteMode): string {
  return routeModes.find((item) => item.mode === mode)?.label || mode;
}
