import { ActivitySquare, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Gauge, Puzzle, Route, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import RefreshActionButton from '../../components/ui/RefreshActionButton';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { GetDoctorSnapshot, RunRouteResilienceAction } from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import {
  deriveDoctorWorkbenchView,
  deriveDoctorWorkbenchCheckFilterOptions,
  deriveDoctorWorkbenchFilteredChecks,
  deriveOmniRouteWorkbenchProductizationView,
  deriveOmniRouteWorkbenchSafeActionSurface,
  type DoctorCheckStatus,
  type DoctorSnapshot,
  type DoctorWorkbenchCheckFilter,
  type OmniRouteWorkbenchActionStatus,
  type OmniRouteWorkbenchSignalKind,
  type OmniRouteWorkbenchSignalStatus,
} from './model/doctorWorkbench';
import { getDoctorWorkbenchPreviewSnapshot } from './model/previewData';
import { previewGetTokensExtensionCodexConfigDryRun } from '../gettokens-extension-registry/api';
import {
  deriveGetTokensExtensionCodexConfigDryRunView,
  type GetTokensExtensionCodexConfigDryRunView,
} from '../gettokens-extension-registry/model';

const statusLabel: Record<DoctorCheckStatus, string> = {
  critical: 'Critical',
  warning: 'Warning',
  degraded: 'Degraded',
  not_ready: 'Not ready',
  ok: 'OK',
  skipped: 'Skipped',
};

const statusTone: Record<DoctorCheckStatus, string> = {
  critical: 'border-[color:color-mix(in_srgb,var(--gt-status-danger)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] text-[var(--gt-status-danger)]',
  warning: 'border-[color:color-mix(in_srgb,var(--gt-status-warning)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,transparent)] text-[var(--gt-status-warning)]',
  degraded: 'border-[color:color-mix(in_srgb,var(--gt-status-warning)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,transparent)] text-[var(--gt-status-warning)]',
  not_ready: 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]',
  ok: 'border-[color:color-mix(in_srgb,var(--gt-status-success)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-status-success)]',
  skipped: 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]',
};

const statusIcon = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  degraded: AlertTriangle,
  not_ready: Clock3,
  ok: CheckCircle2,
  skipped: Clock3,
};

const signalTone: Record<OmniRouteWorkbenchSignalStatus, string> = {
  critical: 'border-[color:color-mix(in_srgb,var(--gt-status-danger)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] text-[var(--gt-status-danger)]',
  warning: 'border-[color:color-mix(in_srgb,var(--gt-status-warning)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,transparent)] text-[var(--gt-status-warning)]',
  missing: 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]',
  preview: 'border-[color:color-mix(in_srgb,var(--gt-status-info)_30%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-info)_10%,transparent)] text-[var(--gt-status-info)]',
  ready: 'border-[color:color-mix(in_srgb,var(--gt-status-success)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-status-success)]',
};

const signalIcon: Record<OmniRouteWorkbenchSignalKind, typeof Route> = {
  route: Route,
  quota: Gauge,
  extension: Puzzle,
  ledger: ActivitySquare,
};

const actionTone: Record<OmniRouteWorkbenchActionStatus, string> = {
  ready: 'border-[color:color-mix(in_srgb,var(--gt-status-success)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-status-success)]',
  pending: 'border-[color:color-mix(in_srgb,var(--gt-status-info)_30%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-info)_10%,transparent)] text-[var(--gt-status-info)]',
  success: 'border-[color:color-mix(in_srgb,var(--gt-status-success)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-status-success)]',
  warning: 'border-[color:color-mix(in_srgb,var(--gt-status-warning)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,transparent)] text-[var(--gt-status-warning)]',
  blocked: 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]',
  failed: 'border-[color:color-mix(in_srgb,var(--gt-status-danger)_34%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] text-[var(--gt-status-danger)]',
};

const doctorPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm';
const doctorMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const doctorInsetPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const doctorSectionEyebrowClass = 'text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]';
const doctorTinyMetaClass = 'text-[length:var(--gt-font-size-2xs)] font-medium text-[var(--gt-ink-muted)]';
const doctorMetaClass = 'text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]';
const doctorStatusBadgeClass = 'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[length:var(--gt-font-size-2xs)] font-semibold';
const doctorLinkButtonClass = 'inline-flex items-center justify-center gap-1.5 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2.5 py-1.5 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]';

function formatPreviewTime(unixMs: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(unixMs));
}

function hasDoctorSnapshotRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }
  const runtimeWindow = window as unknown as {
    go?: { main?: { App?: { GetDoctorSnapshot?: unknown } } };
  };
  return typeof runtimeWindow.go?.main?.App?.GetDoctorSnapshot === 'function';
}

function renderRouteEvidenceField(marker: string, label: string, value?: string) {
  if (!value) {
    return null;
  }
  return (
    <div data-doctor-route-evidence-field={marker} className="space-y-1">
      <div className={doctorTinyMetaClass}>
        {label}
      </div>
      <div className="text-[length:var(--gt-font-size-xs)] font-medium leading-5 text-[var(--gt-ink-primary)]">
        {value}
      </div>
    </div>
  );
}

export default function DoctorWorkbenchFeature() {
  const [snapshot, setSnapshot] = useState<DoctorSnapshot>(() => getDoctorWorkbenchPreviewSnapshot());
  const [loadingSource, setLoadingSource] = useState<'runtime' | 'preview'>('preview');
  const [runtimeError, setRuntimeError] = useState<string>('');
  const [extensionImpact, setExtensionImpact] = useState<GetTokensExtensionCodexConfigDryRunView | null>(null);
  const [routeActionPending, setRouteActionPending] = useState(false);
  const [routeActionError, setRouteActionError] = useState('');
  const [routeActionResult, setRouteActionResult] = useState<main.RouteResilienceActionResult | null>(null);
  const [checkFilter, setCheckFilter] = useState<DoctorWorkbenchCheckFilter>('all');

  useEffect(() => {
    let cancelled = false;
    const canUseWails = typeof window !== 'undefined' && hasDoctorSnapshotRuntime();

    if (!canUseWails) {
      setLoadingSource('preview');
      setSnapshot(getDoctorWorkbenchPreviewSnapshot());
      return () => {
        cancelled = true;
      };
    }

    setLoadingSource('runtime');
    GetDoctorSnapshot({ scope: 'codex', includeEvidence: true, maxEvidencePerCheck: 4 })
      .then((runtimeSnapshot) => {
        if (cancelled) {
          return;
        }
        setRuntimeError('');
        setSnapshot(runtimeSnapshot as DoctorSnapshot);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setRuntimeError(error instanceof Error ? error.message : String(error));
        setLoadingSource('preview');
        setSnapshot(getDoctorWorkbenchPreviewSnapshot());
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    previewGetTokensExtensionCodexConfigDryRun()
      .then((preview) => {
        if (cancelled) {
          return;
        }
        setExtensionImpact(deriveGetTokensExtensionCodexConfigDryRunView(preview));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setExtensionImpact(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => deriveDoctorWorkbenchView(snapshot), [snapshot]);
  const omniRouteView = useMemo(
    () => deriveOmniRouteWorkbenchProductizationView(view, extensionImpact),
    [view, extensionImpact],
  );
  const previewOnly = view.source === 'preview';
  const routeActionRuntimeAvailable = !previewOnly && hasDoctorSnapshotRuntime();
  const safeActionSurface = useMemo(
    () => deriveOmniRouteWorkbenchSafeActionSurface(view, extensionImpact, {
      runtimeAvailable: routeActionRuntimeAvailable,
      routeActionPending,
      routeActionError,
      routeActionResult,
    }),
    [extensionImpact, routeActionError, routeActionPending, routeActionResult, routeActionRuntimeAvailable, view],
  );
  const acceptanceCheckIDs = new Set([
    'applied-not-routeable',
    'catalog-visible-no-backing',
    'stale-route-guard',
    'route_guard_dropped_reasons',
    'quota_facts',
  ]);
  const acceptanceChecks = view.checks.filter((check) =>
    acceptanceCheckIDs.has(check.id),
  );
  const checkFilterOptions = useMemo(() => deriveDoctorWorkbenchCheckFilterOptions(view), [view]);
  const visibleChecks = useMemo(
    () => deriveDoctorWorkbenchFilteredChecks(view, checkFilter),
    [checkFilter, view],
  );
  const routeRecheckAction = safeActionSurface.actions.find((action) => action.id === 'route-recheck');

  async function runDoctorRouteRecheck() {
    if (!routeRecheckAction?.enabled || !routeRecheckAction.target) {
      return;
    }
    const target = routeRecheckAction.target;
    const reason = 'doctor-workbench:route-recheck';
    setRouteActionPending(true);
    setRouteActionError('');
    try {
      const result = await RunRouteResilienceAction(main.RouteResilienceActionInput.createFrom({
        action: 'recheck_routeability',
        accountKey: target.accountKey || undefined,
        authId: target.authId || undefined,
        model: target.model || undefined,
        reason,
        idempotencyKey: `${reason}:${target.targetKey}`,
      }));
      setRouteActionResult(result);
    } catch (error) {
      setRouteActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setRouteActionPending(false);
    }
  }

  return (
    <div
      data-collaboration-id="PAGE_DOCTOR_WORKBENCH"
      data-doctor-mode="read-only"
      data-doctor-workbench-shell="quiet"
      className="h-full w-full overflow-auto p-6 lg:p-8 select-text"
    >
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title="Doctor Workbench"
          subtitle={`${omniRouteView.title} / source=${view.source} / runtime=${previewOnly ? 'preview-only' : loadingSource} / generated ${formatPreviewTime(view.generatedAtUnixMs)}`}
          align="center"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]">
                Sidecar {view.sidecarReady ? 'ready in snapshot' : 'not ready'}
              </span>
              <RefreshActionButton
                label="Doctor snapshot"
                disabled
                title={previewOnly ? 'Preview data only; no Wails runtime call is made.' : 'Runtime refresh will be enabled with the next interactive slice.'}
              />
            </div>
          }
        />

        <section
          aria-label="OmniRoute workbench summary"
          data-omniroute-workbench-summary="true"
          data-omniroute-workbench-status={omniRouteView.primaryStatus}
          className={`${doctorPanelClass} p-4`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={doctorSectionEyebrowClass}>
                OmniRoute Workbench
              </div>
              <h2 className="mt-1 text-[length:var(--gt-font-size-2xl)] font-semibold text-[var(--gt-ink-primary)]">
                Failure explanation surface
              </h2>
              <p className="mt-2 max-w-4xl text-[length:var(--gt-font-size-sm)] font-medium leading-6 text-[var(--gt-ink-secondary)]">
                {omniRouteView.subtitle}
              </p>
            </div>
            <div className={`rounded border px-3 py-2 text-[length:var(--gt-font-size-2xs)] font-semibold ${signalTone[omniRouteView.primaryStatus]}`}>
              {omniRouteView.primaryStatus} / {omniRouteView.sourceLabel}
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-4">
            {omniRouteView.signals.map((signal) => {
              const Icon = signalIcon[signal.kind];
              return (
                <article
                  key={signal.kind}
                  data-omniroute-workbench-signal={signal.kind}
                  data-omniroute-workbench-signal-status={signal.status}
                  className={`${doctorMutedPanelClass} block p-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`${doctorStatusBadgeClass} ${signalTone[signal.status]}`}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                      {signal.status}
                    </div>
                    <a
                      href={signal.navigationHash}
                      data-omniroute-workbench-signal-primary-action={signal.kind}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[var(--gt-ink-muted)] transition-colors hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-canvas)] hover:text-[var(--gt-ink-primary)]"
                      aria-label={`${signal.title}: ${signal.actionLabel}`}
                    >
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                    </a>
                  </div>
                  <div className="mt-3 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                    {signal.title}
                  </div>
                  <p className="mt-2 min-h-12 text-[length:var(--gt-font-size-xs)] font-medium leading-5 text-[var(--gt-ink-secondary)]">
                    {signal.summary}
                  </p>
                  <div className={`mt-3 space-y-1 border-t border-[var(--gt-border-subtle)] pt-3 ${doctorTinyMetaClass}`}>
                    <div>source={signal.sourceLabel}</div>
                    <div className="truncate">evidence={signal.evidenceLabel}</div>
                    <div>{signal.actionLabel}</div>
                    {signal.blockedReason ? <div className="text-[var(--gt-status-warning)]">{signal.blockedReason}</div> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--gt-border-subtle)] pt-3">
                    {signal.actionLinks.map((action) => (
                      <a
                        key={`${signal.kind}-${action.id}`}
                        href={action.hash}
                        data-omniroute-workbench-signal-action={action.id}
                        data-omniroute-workbench-signal-action-kind={signal.kind}
                        className={doctorLinkButtonClass}
                      >
                        {action.label}
                        <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          aria-label="OmniRoute safe action surface"
          data-omniroute-workbench-action-surface="true"
          className={`${doctorPanelClass} p-4`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className={doctorSectionEyebrowClass}>
                Safe actions
              </div>
              <h2 className="mt-1 text-[length:var(--gt-font-size-xl)] font-semibold text-[var(--gt-ink-primary)]">
                Controlled next steps
              </h2>
              <p className="mt-2 max-w-3xl text-[length:var(--gt-font-size-sm)] font-medium leading-6 text-[var(--gt-ink-secondary)]">
                Route actions are sidecar-owned and only run with a stable target. Extension config apply remains preview/staged-only until an explicit temp target is supplied.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {safeActionSurface.actions.map((action) => (
              <div
                key={action.id}
                data-omniroute-workbench-action={action.id}
                data-omniroute-workbench-action-status={action.status}
                className={`${doctorMutedPanelClass} p-3`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`${doctorStatusBadgeClass} ${actionTone[action.status]}`}>
                      {action.status}
                    </div>
                    <div className="mt-3 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                      {action.title}
                    </div>
                    <p className="mt-2 text-[length:var(--gt-font-size-xs)] font-medium leading-5 text-[var(--gt-ink-secondary)]">
                      {action.summary}
                    </p>
                  </div>
                  {action.id === 'route-recheck' ? (
                    <RefreshActionButton
                      label="Run recheck"
                      loading={routeActionPending}
                      loadingLabel="Running"
                      disabled={!action.enabled || routeActionPending}
                      onClick={runDoctorRouteRecheck}
                      size="sm"
                    />
                  ) : (
                    <a
                      href="#frame=codex&workspace=extension-registry"
                      className={`${doctorLinkButtonClass} shrink-0`}
                    >
                      Review <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                    </a>
                  )}
                </div>
                <div className={`mt-3 grid gap-2 border-t border-[var(--gt-border-subtle)] pt-3 ${doctorTinyMetaClass}`}>
                  <div>result={action.resultLabel}</div>
                  <div className="text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-secondary)]">
                    {action.resultDetail}
                  </div>
                  <div>{action.rollbackLabel}</div>
                  {action.disabledReason ? (
                    <div className="text-[var(--gt-status-warning)]">{action.disabledReason}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div
            data-omniroute-workbench-ledger="true"
            className={`${doctorMutedPanelClass} mt-4 p-3`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                Evidence ledger
              </div>
              <div className={doctorTinyMetaClass}>
                diagnostics / route action / extension config
              </div>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {safeActionSurface.ledgerEntries.map((entry) => (
                <div
                  key={entry.id}
                  data-omniroute-workbench-ledger-entry={entry.id}
                  data-omniroute-workbench-ledger-entry-status={entry.status}
                  className={`${doctorInsetPanelClass} px-3 py-3`}
                >
                  <div className={`${doctorStatusBadgeClass} ${actionTone[entry.status]}`}>
                    {entry.status}
                  </div>
                  <div className="mt-3 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                    {entry.title}
                  </div>
                  <div className="mt-2 text-[length:var(--gt-font-size-xs)] font-medium leading-5 text-[var(--gt-ink-secondary)]">
                    {entry.summary}
                  </div>
                  <div className="mt-2 break-words text-[length:var(--gt-font-size-xs)] font-semibold leading-5 text-[var(--gt-ink-muted)]">
                    {entry.detail}
                  </div>
                  <div className={`mt-3 grid gap-1 border-t border-[var(--gt-border-subtle)] pt-2 ${doctorTinyMetaClass}`}>
                    <div>source={entry.sourceLabel}</div>
                    <div>result={entry.resultLabel}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-label="Doctor source boundary"
          data-doctor-mutation-surface="none"
          className={`${doctorPanelClass} p-4`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={doctorSectionEyebrowClass}>
                Source boundary
              </div>
              <p className="mt-1 max-w-3xl text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-secondary)]">
                {previewOnly
                  ? 'This workbench consumes the explicit preview doctor snapshot because Wails runtime is unavailable.'
                  : 'This workbench consumes the read-only Wails Doctor snapshot and surfaces sidecar authority facts without repair mutations.'}
                {runtimeError ? ` Runtime fallback: ${runtimeError}` : ''}
              </p>
              <div className={`mt-2 ${doctorTinyMetaClass}`}>
                Mutation surface: none. Evidence only, no repair handler.
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(view.statusCounts).map(([status, count]) => (
                <div
                  key={status}
                  className={`min-w-20 rounded border px-3 py-2 text-center ${statusTone[status as DoctorCheckStatus]}`}
                  data-testid={`doctor-count-${status}`}
                >
                  <div className="text-lg font-semibold leading-none">{count}</div>
                  <div className="mt-1 text-[length:var(--gt-font-size-2xs)] font-medium">{statusLabel[status as DoctorCheckStatus]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-label="Doctor check filters"
          data-omniroute-workbench-check-filter-surface="true"
          data-omniroute-workbench-check-filter-active={checkFilter}
          data-omniroute-workbench-check-filter-count={visibleChecks.length}
          className={`${doctorPanelClass} p-4`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={doctorSectionEyebrowClass}>
                Check filters
              </div>
              <div className="mt-1 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-secondary)]">
                Narrow the evidence list without changing sidecar authority or local inference rules.
              </div>
            </div>
            <div className={doctorTinyMetaClass}>
              showing={visibleChecks.length}/{view.checks.length}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {checkFilterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-omniroute-workbench-check-filter={option.id}
                data-omniroute-workbench-check-filter-selected={option.id === checkFilter}
                onClick={() => setCheckFilter(option.id)}
                className={`rounded border px-3 py-2 text-[length:var(--gt-font-size-xs)] font-medium transition-colors ${
                  option.id === checkFilter
                    ? 'border-[var(--gt-border-strong)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
                    : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-canvas)]'
                }`}
              >
                {option.label} · {option.count}
              </button>
            ))}
          </div>
        </section>

        <section
          aria-label="Doctor acceptance checks"
          data-doctor-workbench-check-list="true"
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]"
        >
          <div className="space-y-3">
            {visibleChecks.map((check) => {
              const Icon = statusIcon[check.status];
              return (
                <article
                  key={check.id}
                  data-doctor-check-id={check.id}
                  className={`${doctorPanelClass} p-4`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`${doctorStatusBadgeClass} ${statusTone[check.status]}`}>
                          <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                          {statusLabel[check.status]}
                        </span>
                        <span className={doctorTinyMetaClass}>
                          {check.kind}
                        </span>
                      </div>
                      <h3 className="mt-3 text-[length:var(--gt-font-size-xl)] font-semibold text-[var(--gt-ink-primary)]">
                        {check.title}
                      </h3>
                      <p className="mt-2 text-[length:var(--gt-font-size-sm)] font-semibold leading-6 text-[var(--gt-ink-secondary)]">
                        {check.reason}
                      </p>
                    </div>
                    <div className={`grid min-w-52 gap-2 ${doctorMetaClass}`}>
                      <div>repairability={check.repairability}</div>
                      <div>authority={check.authority}</div>
                      <div>evidence={check.evidenceCount}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="space-y-2">
                      {check.evidence.map((item) => (
                        <div
                          key={`${check.id}-${item.refID}`}
                          data-doctor-route-evidence-fallback={item.routeFallbackState || ''}
                          className={`${doctorMutedPanelClass} px-3 py-2`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                              {item.label}
                            </span>
                            <span className={doctorTinyMetaClass}>
                              {item.kind} / {item.sourceLabel}
                            </span>
                          </div>
                          {item.routeFallbackState ? (
                            <div className={`mt-2 ${doctorTinyMetaClass}`}>
                              {item.routeFallbackState === 'unknown-non-authoritative'
                                ? 'Unknown non-authoritative evidence'
                                : 'Partial identity fallback'}
                            </div>
                          ) : null}
                          <p className="mt-1 text-[length:var(--gt-font-size-xs)] font-semibold leading-5 text-[var(--gt-ink-secondary)]">
                            {item.summaryLabel}
                          </p>
                          {item.targetKey ? (
                            <div
                              data-doctor-route-evidence-target={item.targetKey}
                              className={`${doctorInsetPanelClass} mt-3 p-3`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className={doctorTinyMetaClass}>
                                  Structured route evidence
                                </div>
                                <div className={doctorTinyMetaClass}>
                                  Read only
                                </div>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div data-doctor-route-evidence-target={item.targetKey} className="space-y-1">
                                  <div className={doctorTinyMetaClass}>
                                    Target key
                                  </div>
                                  <div className="break-all text-[length:var(--gt-font-size-xs)] font-medium leading-5 text-[var(--gt-ink-primary)]">
                                    {item.targetKey}
                                  </div>
                                </div>
                                <div
                                  data-doctor-route-evidence-blocking={item.routeBlockingLabel || 'unknown'}
                                  className="space-y-1"
                                >
                                  <div className={doctorTinyMetaClass}>
                                    Route blocking
                                  </div>
                                  <div className="text-[length:var(--gt-font-size-xs)] font-medium leading-5 text-[var(--gt-ink-primary)]">
                                    {item.routeBlockingLabel || 'Unknown'}
                                  </div>
                                </div>
                                <div data-doctor-route-evidence-account={item.accountKey || ''}>
                                  {renderRouteEvidenceField('account', 'Account', item.accountKey)}
                                </div>
                                <div data-doctor-route-evidence-auth={item.authId || ''}>
                                  {renderRouteEvidenceField('auth', 'Auth', item.authId)}
                                </div>
                                <div data-doctor-route-evidence-model={item.model || ''}>
                                  {renderRouteEvidenceField('model', 'Model', item.model)}
                                </div>
                                <div data-doctor-route-evidence-scope={item.scope || ''}>
                                  {renderRouteEvidenceField('scope', 'Scope', item.scope)}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {check.navigation.map((target) => (
                        <a
                          key={`${check.id}-${target.hash}`}
                          href={target.hash}
                          data-doctor-navigation-hash={target.hash}
                          className="flex items-center justify-between gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]"
                        >
                          <span className="min-w-0 truncate">{target.label}</span>
                          <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside
            data-doctor-workbench-core-acceptance="true"
            className={`${doctorPanelClass} h-fit p-4`}
          >
            <div className={doctorSectionEyebrowClass}>
              Core acceptance
            </div>
            <div className="mt-3 space-y-3">
              {acceptanceChecks.map((check) => (
                <div key={`acceptance-${check.id}`} className={`${doctorMutedPanelClass} p-3`}>
                  <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">{check.title}</div>
                  <div className="mt-2 text-[length:var(--gt-font-size-xs)] font-medium leading-5 text-[var(--gt-ink-secondary)]">
                    status={check.status}; repairability={check.repairability}; navigation={check.primaryNavigation?.hash ?? 'none'}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
