import {
  BookOpenText,
  ChevronDown,
  CircleHelp,
  History,
  Play,
  RefreshCw,
  ShieldCheck,
  Shuffle,
  Split,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import type { main } from '../../../../wailsjs/go/models';
import {
  CHANNEL_ROUTE_MODE_HELP_SECTIONS,
  buildChannelRouteAuditEventSummary,
  buildChannelRoutingExplainDigest,
  buildChannelRoutingParticipantRows,
  buildLegacyRoutingMaskPanel,
  type ChannelID,
  type ChannelRouteAuditEvent,
  type ChannelRouteMode,
  type ChannelRoutingConfig,
  type ChannelRoutingExplainStepRow,
  type ChannelRoutingParticipantAccountLike,
  type ChannelRoutingParticipantRow,
} from '../model/channelRouting';

interface ChannelRoutingWorkbenchProps {
  channel: ChannelID;
  config: ChannelRoutingConfig;
  explain?: main.ChannelRoutingExplainResult | null;
  disabled?: boolean;
  saving?: boolean;
  preview?: boolean;
  message?: string;
  routeEvents?: ChannelRouteAuditEvent[];
  routeEventsLoading?: boolean;
  accounts?: ChannelRoutingParticipantAccountLike[];
  onModeChange: (mode: ChannelRouteMode) => void;
  onShadowEnabledChange: (enabled: boolean) => void;
  onShadowModeChange: (mode: ChannelRouteMode) => void;
  onExplain: () => void;
  onRefreshEvents?: () => void;
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

export default function ChannelRoutingWorkbench({
  channel,
  config,
  explain,
  disabled = false,
  saving = false,
  preview = false,
  message = '',
  routeEvents = [],
  routeEventsLoading = false,
  accounts = [],
  onModeChange,
  onShadowEnabledChange,
  onShadowModeChange,
  onExplain,
  onRefreshEvents,
}: ChannelRoutingWorkbenchProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const explainView = buildChannelRoutingExplainDigest(explain);
  const legacyMask = buildLegacyRoutingMaskPanel();
  const eventSummaries = routeEvents.slice(0, 5).map((event) => buildChannelRouteAuditEventSummary(event));
  const hasExplain = explainView.hasExplain;
  const shadowPanelLabel = config.shadowEnabled ? (hasExplain ? explainView.shadowLabel : '开启') : '关闭';
  const shadowPanelMeta = config.shadowEnabled && hasExplain ? explainView.shadowMeta : '';
  const participantRows = buildChannelRoutingParticipantRows(config, accounts);
  const candidateCount = explainView.candidateRows.length;
  const filteredCount = explainView.filteredRows.reduce((total, item) => total + item.count, 0);

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

  return (
    <section
      aria-label={`${channel} 请求模式`}
      className="overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
    >
      <header className="p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-main)]">
              <Split className="h-4 w-4" strokeWidth={4} />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 text-[length:var(--font-size-ui-lg)] font-black leading-5 tracking-[0] text-[var(--text-primary)] sm:text-[length:var(--font-size-heading-sm)] sm:leading-normal">
                请求模式
              </h2>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label="查看请求模式说明"
                title="查看请求模式说明"
                aria-pressed={helpOpen}
                className={`flex h-8 w-8 shrink-0 items-center justify-center border-2 transition-colors active:scale-95 ${
                  helpOpen
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] [@media(hover:hover)]:hover:border-[var(--text-primary)]'
                }`}
              >
                <CircleHelp className="h-4 w-4" strokeWidth={4} />
              </button>
              {preview ? (
                <span className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[length:var(--font-size-ui-sm)] font-black leading-4 text-[var(--text-primary)]">
                  预览
                </span>
              ) : null}
            </div>
          </div>
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
      </header>

      <div className="border-t-2 border-[var(--border-color)]">
        <details className="group/participants min-w-0 border-t-2 border-[var(--border-color)] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <SectionHeading icon={Split} label="参与账号" />
            <span className="flex items-center gap-2">
              <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                {participantRows.length} 个账号
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open/participants:rotate-180" strokeWidth={4} />
            </span>
          </summary>
          <ParticipantList mode={config.routeMode} rows={participantRows} />
        </details>
      </div>

      {message ? (
        <p className="border-t-2 border-[var(--border-color)] px-4 py-3 text-[length:var(--font-size-ui-sm)] text-[var(--text-secondary)]">
          {message}
        </p>
      ) : null}

      <details className="group border-t-2 border-[var(--border-color)] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
          <span>高级诊断</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
              {hasExplain ? '有结果' : '可选'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" strokeWidth={4} />
          </span>
        </summary>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.75fr)]">
          <section className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onExplain}
                disabled={disabled}
                className="btn-swiss flex min-h-9 items-center gap-2 !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)]"
              >
                <Play className="h-3.5 w-3.5" strokeWidth={4} />
                预演
              </button>
              <DiagnosticPill label="命中" value={hasExplain ? explainView.selectedTitle : '—'} />
              <DiagnosticPill label="候选" value={hasExplain ? String(candidateCount) : '—'} />
              <DiagnosticPill label="过滤" value={hasExplain ? String(filteredCount) : '—'} />
            </div>
            {hasExplain && explainView.selectedMeta ? (
              <p className="mt-3 break-words text-[length:var(--font-size-ui-xs)] leading-5 text-[var(--text-secondary)]">
                {explainView.selectedMeta}
              </p>
            ) : null}

            <details className="group/steps mt-4 border-t border-[var(--border-color)] pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
                <span>链路</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                    {hasExplain ? explainView.snapshotLabel : '—'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open/steps:rotate-180" strokeWidth={4} />
                </span>
              </summary>
              <div className="mt-2">
                {hasExplain && explainView.stepRows.length > 0 ? (
                  explainView.stepRows.map((step, index) => <StepRow key={`${step.label}-${index}`} step={step} />)
                ) : (
                  <Placeholder text="—" />
                )}
              </div>
            </details>
          </section>

          <section className="min-w-0 border-t border-[var(--border-color)] pt-3 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0">
            <label className="flex min-w-0 items-center justify-between gap-3">
              <span className="text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">对照测试</span>
              <input
                type="checkbox"
                checked={config.shadowEnabled}
                disabled={disabled}
                onChange={(event) => onShadowEnabledChange(event.currentTarget.checked)}
                className="h-4 w-4 shrink-0 accent-[var(--text-primary)]"
              />
            </label>

            <label className="mt-3 block min-w-0">
              <span className="mb-1 block text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                对照模式
              </span>
              <select
                value={config.shadowRouteMode}
                disabled={disabled || !config.shadowEnabled}
                onChange={(event) => onShadowModeChange(event.currentTarget.value as ChannelRouteMode)}
                className="input-swiss h-10 w-full font-mono text-[length:var(--font-size-ui-sm)]"
              >
                {routeModes.map((item) => (
                  <option key={item.mode} value={item.mode}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 grid gap-2">
              <DiagnosticLine label="兼容输入" value={legacyMask.summary} />
              <DiagnosticLine label="对照结果" value={shadowPanelLabel} />
              {shadowPanelMeta ? <DiagnosticLine label="差异" value={shadowPanelMeta} /> : null}
              {hasExplain ? <DiagnosticLine label="规则" value={explainView.policyLabel} /> : null}
            </div>
          </section>
        </div>

        <RouteEventLedger
          events={eventSummaries}
          disabled={disabled}
          loading={routeEventsLoading}
          onRefreshEvents={onRefreshEvents}
        />
      </details>

      {helpOpen ? (
        <RouteModeHelpModal onClose={() => setHelpOpen(false)} />
      ) : null}
    </section>
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
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭请求模式说明"
            className="btn-swiss flex min-h-9 items-center gap-2 !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={4} />
            关闭
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-5"
    >
      <div className="border-y-2 border-[var(--border-color)] py-3">
        <p className="max-w-3xl text-[length:var(--font-size-ui-sm)] font-black leading-6 text-[var(--text-primary)]">
          顺序模式决定的是“每次路由怎么排序”，不是“只消耗一个账号”的独占开关。
        </p>
        <p className="mt-1 max-w-3xl text-[length:var(--font-size-ui-xs)] leading-5 text-[var(--text-secondary)]">
          如果前序账号不可用、触发 retry、处于冷却，或存在多个会话并发，请求会继续命中后续账号。
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {CHANNEL_ROUTE_MODE_HELP_SECTIONS.map((section) => (
          <article key={section.title} className="min-w-0 border-2 border-[var(--border-color)] p-3">
            <h3 className="text-[length:var(--font-size-ui-md)] font-black leading-5 text-[var(--text-primary)]">
              {section.title}
            </h3>
            <p className="mt-2 text-[length:var(--font-size-ui-xs)] leading-5 text-[var(--text-secondary)]">
              {section.body}
            </p>
            <ul className="mt-3 space-y-2">
              {section.points.map((point) => (
                <li key={point} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 text-[length:var(--font-size-ui-xs)] leading-5 text-[var(--text-primary)]">
                  <span className="mt-1 h-2 w-2 border-2 border-[var(--text-primary)]" aria-hidden="true" />
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
    <button
      type="button"
      onClick={() => onModeChange(mode)}
      disabled={disabled}
      aria-pressed={active}
      className={`grid min-h-10 grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 border-2 px-3 py-2 text-left transition-colors active:scale-[0.98] ${
        active
          ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-main)]'
          : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] [@media(hover:hover)]:hover:border-[var(--text-primary)]'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={4} />
      <span className="min-w-0 truncate text-[length:var(--font-size-ui-sm)] font-black">{label}</span>
    </button>
  );
}

function ParticipantList({ mode, rows }: { mode: ChannelRouteMode; rows: ChannelRoutingParticipantRow[] }) {
  if (rows.length === 0) {
    return <Placeholder text="暂无可请求账号参与" />;
  }

  const isSequential = mode === 'sequential';
  return (
    <div className="mt-3 divide-y divide-[var(--border-color)] border-t border-[var(--border-color)]">
      {rows.map((row) => (
        <div key={row.id} className="grid min-h-14 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 px-2 py-3">
          <div
            className={`flex h-8 w-8 items-center justify-center border-2 font-mono text-[length:var(--font-size-ui-2xs)] font-black ${
              isSequential && row.rank === 1
                ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                : 'border-[var(--border-color)] text-[var(--text-primary)]'
            }`}
          >
            {String(row.rank).padStart(2, '0')}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[length:var(--font-size-ui-md)] font-black text-[var(--text-primary)]">
              {row.title}
            </div>
            <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
              {row.meta}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RouteEventLedger({
  events,
  disabled,
  loading,
  onRefreshEvents,
}: {
  events: Array<ReturnType<typeof buildChannelRouteAuditEventSummary>>;
  disabled: boolean;
  loading: boolean;
  onRefreshEvents?: () => void;
}) {
  return (
    <section className="min-w-0 border-t-2 border-[var(--border-color)] p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionHeading icon={History} label="最近路由" />
        <button
          type="button"
          onClick={onRefreshEvents}
          disabled={disabled || loading || !onRefreshEvents}
          className="btn-swiss flex min-h-8 items-center gap-1 !px-2 !py-1 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={4} />
          {loading ? '加载中' : '刷新'}
        </button>
      </div>

      <div className="mt-3 border-t border-[var(--border-color)]">
        {events.length === 0 ? (
          <Placeholder text="暂无记录" />
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {events.map((event) => (
              <details key={event.id} className="group min-w-0 py-2">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">
                    {event.title}
                  </span>
                  {event.redacted ? (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" strokeWidth={3} />
                  ) : null}
                  <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                    strokeWidth={4}
                  />
                </summary>
                <div className="mt-2 min-w-0 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                  <div className="truncate">{event.meta}</div>
                  {event.shadow ? <div className="mt-1 truncate text-[var(--text-secondary)]">{event.shadow}</div> : null}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DiagnosticPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-[var(--border-color)] px-2 py-1.5">
      <span className="mr-2 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      <span className="break-words text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">
        {value || '—'}
      </span>
    </div>
  );
}

function DiagnosticLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 border-t border-[var(--border-color)] pt-2">
      <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div className="min-w-0 truncate text-right text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">
        {value || '—'}
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" strokeWidth={3} />
      <div className="min-w-0 text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
        {label}
      </div>
    </div>
  );
}

function StepRow({
  step,
}: {
  step: ChannelRoutingExplainStepRow;
}) {
  return (
    <div className="border-t border-[var(--border-color)] px-2 py-2">
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
        {step.label}
      </div>
      <div className="mt-1 break-words text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
        {step.detail || '已记录'}
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="px-2 py-3 text-[length:var(--font-size-ui-xs)] font-black leading-5 text-[var(--text-muted)]">
      {text}
    </div>
  );
}

function resolveRouteModeLabel(mode: ChannelRouteMode): string {
  return routeModes.find((item) => item.mode === mode)?.label || mode;
}
