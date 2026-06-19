import { Play, RotateCcw, Terminal, X } from 'lucide-react';
import { useEffect } from 'react';
import { ModelCombobox } from './ModelCombobox';
import { buildEndpointLabel, sourceKindLabel } from './codexAccountPresentation';
import {
  DEFAULT_CODEX_ROUTING_PROBE_MODEL,
  type CodexAccountRow,
  type CodexRoutingProbeStreamLineStatus,
} from '../model/codexAccountList';

const codexRouteProbePanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-[var(--gt-elevation-raised-2)]';
const codexRouteProbeButtonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';
const codexRouteProbePrimaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[var(--gt-border-strong)] bg-[var(--text-primary)] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-medium text-[var(--gt-surface-canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const codexRouteProbeBadgeClass =
  'inline-flex items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2 py-1 font-mono text-[length:var(--font-size-ui-2xs)] font-medium tracking-normal text-[var(--text-muted)]';
const codexRouteProbeMetaClass =
  'truncate font-mono text-[length:var(--font-size-ui-2xs)] font-medium tracking-normal text-[var(--text-muted)]';

export function RouteProbeCard({
  t,
  routingProbeModel,
  routingProbeModelOptions,
  routingProbeRunning,
  routingProbeDisabled,
  routePolicyPreviewRows,
  routingProbeStreamLines,
  onClose,
  onModelChange,
  onProbeOnce,
  onProbeSeries,
  onReset,
}: {
  t: (key: string) => string;
  routingProbeModel: string;
  routingProbeModelOptions: string[];
  routingProbeRunning: boolean;
  routingProbeDisabled: boolean;
  routePolicyPreviewRows: CodexAccountRow[];
  routingProbeStreamLines: Array<{
    key: string;
    marker: string;
    label: string;
    detail: string;
    status: CodexRoutingProbeStreamLineStatus;
  }>;
  onClose: () => void;
  onModelChange: (value: string) => void;
  onProbeOnce: () => void;
  onProbeSeries: () => void;
  onReset: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const resolvedModel = routingProbeModel.trim() || DEFAULT_CODEX_ROUTING_PROBE_MODEL;
  const latestHitLine = [...routingProbeStreamLines].reverse().find((line) => line.marker.startsWith('#') && line.status === 'hit');
  const statusLabel = routingProbeRunning
    ? t('codex.account_list_probe_running')
    : latestHitLine
      ? latestHitLine.label
      : t('codex.account_list_probe_idle');

  return (
    <div
      className="scrollbar-stable fixed inset-0 z-50 overflow-hidden bg-[var(--overlay-scrim-80)] backdrop-blur-sm"
      data-collaboration-id="MODAL_CODEX_ROUTE_PROBE"
      data-codex-route-probe-shell="true"
      onClick={onClose}
    >
      <section
        className="flex h-full w-full max-w-none flex-col overflow-hidden bg-[var(--gt-surface-canvas)] shadow-[var(--gt-elevation-overlay)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-5 py-4">
          <div className="min-w-0">
            <div className={codexRouteProbeMetaClass}>
              {t('codex.account_list_probe_terminal')}
            </div>
            <h3 className="mt-2 text-xl font-semibold italic leading-none tracking-normal text-[var(--text-primary)]">
              {t('codex.account_list_probe_open')}
            </h3>
            <p className="mt-2 max-w-3xl text-[length:var(--font-size-ui-sm)] font-medium tracking-normal text-[var(--text-muted)]">
              {t('codex.account_list_policy_headline')}
            </p>
          </div>
          <div className="flex items-start justify-end gap-3">
            <ProbeStatusBar
              t={t}
              model={resolvedModel}
              candidateCount={routePolicyPreviewRows.length}
              statusLabel={statusLabel}
            />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]"
              aria-label={t('common.close')}
              title={t('common.close')}
            >
              <X className="h-4 w-4" strokeWidth={4} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid min-h-full xl:grid-cols-[23rem_minmax(0,1fr)]">
            <div className="border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-5 xl:border-b-0 xl:border-r">
              <ProbeControlPanel
                t={t}
                routingProbeModel={routingProbeModel}
                routingProbeModelOptions={routingProbeModelOptions}
                routingProbeRunning={routingProbeRunning}
                routingProbeDisabled={routingProbeDisabled}
                onModelChange={onModelChange}
                onProbeOnce={onProbeOnce}
                onProbeSeries={onProbeSeries}
                onReset={onReset}
              />
            </div>

            <div className="grid min-w-0 gap-0">
              <RouteProbeCandidateQueue rows={routePolicyPreviewRows} t={t} />
              <RouteProbeTerminal
                lines={routingProbeStreamLines}
                t={t}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProbeStatusBar({
  t,
  model,
  candidateCount,
  statusLabel,
}: {
  t: (key: string) => string;
  model: string;
  candidateCount: number;
  statusLabel: string;
}) {
  return (
    <div className={`${codexRouteProbePanelClass} hidden min-w-[28rem] grid-cols-[minmax(0,1.25fr)_7rem_minmax(0,1fr)] lg:grid`}>
      <ProbeMetric label={t('codex.account_list_probe_model')} value={model} />
      <ProbeMetric label={t('codex.account_list_policy_preview_count')} value={String(candidateCount).padStart(2, '0')} />
      <ProbeMetric label={t('codex.account_list_probe_result')} value={statusLabel} tone="neutral" last />
    </div>
  );
}

function ProbeMetric({
  label,
  value,
  tone = 'neutral',
  last = false,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'critical';
  last?: boolean;
}) {
  return (
    <div className={`min-w-0 px-3 py-2 ${last ? '' : 'border-r border-[var(--gt-border-subtle)]'}`}>
      <div className={codexRouteProbeMetaClass}>
        {label}
      </div>
      <div className={`mt-1 truncate font-mono text-[length:var(--font-size-ui-sm)] font-semibold tracking-normal ${
        tone === 'critical' ? 'text-[var(--gt-status-danger)]' : 'text-[var(--text-primary)]'
      }`}>
        {value}
      </div>
    </div>
  );
}

function ProbeControlPanel({
  t,
  routingProbeModel,
  routingProbeModelOptions,
  routingProbeRunning,
  routingProbeDisabled,
  onModelChange,
  onProbeOnce,
  onProbeSeries,
  onReset,
}: {
  t: (key: string) => string;
  routingProbeModel: string;
  routingProbeModelOptions: string[];
  routingProbeRunning: boolean;
  routingProbeDisabled: boolean;
  onModelChange: (value: string) => void;
  onProbeOnce: () => void;
  onProbeSeries: () => void;
  onReset: () => void;
}) {
  return (
    <div data-codex-route-probe-control-panel="true" className="grid content-start gap-5">
      <div className="border-b border-[var(--gt-border-subtle)] pb-4">
        <div className={codexRouteProbeMetaClass}>
          {t('codex.account_list_probe_open')}
        </div>
        <div className="mt-2 text-lg font-semibold italic leading-none tracking-normal text-[var(--text-primary)]">
          {t('codex.account_list_policy_headline')}
        </div>
      </div>

      <label className="grid gap-2">
        <span className={codexRouteProbeMetaClass}>
          {t('codex.account_list_probe_model')}
        </span>
        <ModelCombobox
          value={routingProbeModel}
          options={routingProbeModelOptions}
          onChange={onModelChange}
          placeholder={DEFAULT_CODEX_ROUTING_PROBE_MODEL}
        />
      </label>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={onProbeOnce}
          disabled={routingProbeDisabled}
          className={`${codexRouteProbePrimaryButtonClass} w-full`}
        >
          <Play className="h-3.5 w-3.5" strokeWidth={4} />
          {routingProbeRunning ? t('codex.account_list_probe_running') : t('codex.account_list_probe_once')}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onProbeSeries}
            disabled={routingProbeDisabled}
            className={codexRouteProbeButtonClass}
          >
            {t('codex.account_list_probe_series')}
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={routingProbeRunning}
            className={codexRouteProbeButtonClass}
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={4} />
            {t('common.reset')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RouteProbeCandidateQueue({ rows, t }: { rows: CodexAccountRow[]; t: (key: string) => string }) {
  return (
    <section data-codex-route-probe-candidate-queue="true" className="min-w-0 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]">
      <div className="flex items-end justify-between gap-4 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-5 py-3">
        <div className="min-w-0">
          <div className={codexRouteProbeMetaClass}>
            {t('codex.account_list_policy_preview')}
          </div>
          <div className="mt-1 text-base font-semibold italic leading-none tracking-normal text-[var(--text-primary)]">
            {t('codex.account_list_policy_order')}
          </div>
        </div>
        <div className={`${codexRouteProbeBadgeClass} shrink-0 text-[var(--text-primary)]`}>
          {String(rows.length).padStart(2, '0')}
        </div>
      </div>
      <div className="max-h-[19rem] overflow-auto p-3">
        {rows.length === 0 ? (
          <div className="rounded border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-3 py-4 text-center text-[length:var(--font-size-ui-sm)] font-medium tracking-normal text-[var(--gt-status-danger)]">
            {t('codex.account_list_probe_no_account')}
          </div>
        ) : (
          <div className="grid gap-2">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className={`${codexRouteProbePanelClass} grid min-h-12 grid-cols-[3rem_minmax(0,1fr)_max-content] items-stretch`}
              >
                <div className="flex items-center justify-center border-r border-[var(--gt-border-subtle)] bg-[var(--text-primary)] font-mono text-[length:var(--font-size-ui-md)] font-semibold text-[var(--gt-surface-canvas)]">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="grid min-w-0 content-center gap-1 px-3 py-2">
                  <div className="truncate text-[length:var(--font-size-ui-md)] font-semibold leading-tight text-[var(--text-primary)]">
                    {row.label}
                  </div>
                  <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] font-medium tracking-normal text-[var(--text-muted)]">
                    {buildEndpointLabel(row) || row.provider}
                  </div>
                </div>
                <div className="flex items-center border-l border-[var(--gt-border-subtle)] px-2 py-2">
                  <span className={codexRouteProbeBadgeClass}>
                    {sourceKindLabel(t, row.sourceKind)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RouteProbeTerminal({
  lines,
  t,
}: {
  lines: Array<{
    key: string;
    marker: string;
    label: string;
    detail: string;
    status: CodexRoutingProbeStreamLineStatus;
  }>;
  t: (key: string) => string;
}) {
  return (
    <section data-codex-route-probe-terminal="true" className="min-w-0 bg-[var(--gt-surface-canvas)] p-5">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] pb-3">
        <div className="flex items-center gap-2 text-[length:var(--font-size-ui-2xs)] font-medium tracking-normal text-[var(--text-muted)]">
          <Terminal className="h-3.5 w-3.5" strokeWidth={3} />
          {t('codex.account_list_probe_terminal')}
        </div>
      </div>
      <div className="max-h-[22rem] min-h-[13rem] overflow-auto bg-[var(--gt-surface-canvas)] py-3 font-mono text-[length:var(--font-size-ui-md-compact)] font-semibold leading-6 text-[var(--text-primary)]">
        {lines.length === 0 ? (
          <div className="rounded border border-dashed border-[var(--gt-border-subtle)] px-3 py-4 text-[length:var(--font-size-ui-sm)] tracking-normal text-[var(--text-muted)]">
            {t('codex.account_list_probe_idle')}
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.key} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 border-b border-dashed border-[var(--gt-border-subtle)] py-1 last:border-b-0">
              <span className={`text-right tabular-nums ${routeProbeLineTone(line.status)}`}>{line.marker}</span>
              <span className="min-w-0">
                <span className="break-all">{line.label}</span>
                {line.detail ? (
                  <span className={`ml-2 break-all text-[length:var(--font-size-ui-sm)] ${line.status === 'command' ? 'text-[var(--text-muted)]' : routeProbeLineTone(line.status)}`}>
                    · {line.detail}
                  </span>
                ) : null}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function routeProbeLineTone(status: CodexRoutingProbeStreamLineStatus) {
  switch (status) {
    case 'hit':
    case 'running':
      return 'text-[var(--text-primary)]';
    case 'passed':
      return 'text-[var(--text-primary)]';
    case 'miss':
    case 'empty':
      return 'text-[var(--gt-status-danger)]';
    case 'queued':
      return 'text-[var(--text-muted)]';
    case 'command':
    default:
      return 'text-[var(--text-primary)]';
  }
}
