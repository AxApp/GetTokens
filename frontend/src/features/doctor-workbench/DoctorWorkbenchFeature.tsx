import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import RefreshActionButton from '../../components/ui/RefreshActionButton';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { GetDoctorSnapshot } from '../../../wailsjs/go/main/App';
import { deriveDoctorWorkbenchView, type DoctorCheckStatus, type DoctorSnapshot } from './model/doctorWorkbench';
import { getDoctorWorkbenchPreviewSnapshot } from './model/previewData';

const statusLabel: Record<DoctorCheckStatus, string> = {
  critical: 'Critical',
  warning: 'Warning',
  degraded: 'Degraded',
  not_ready: 'Not ready',
  ok: 'OK',
  skipped: 'Skipped',
};

const statusTone: Record<DoctorCheckStatus, string> = {
  critical: 'border-red-500/80 bg-red-500/10 text-red-700 dark:text-red-200',
  warning: 'border-amber-500/80 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  degraded: 'border-orange-500/80 bg-orange-500/10 text-orange-700 dark:text-orange-200',
  not_ready: 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-muted)]',
  ok: 'border-emerald-500/80 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  skipped: 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-muted)]',
};

const statusIcon = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  degraded: AlertTriangle,
  not_ready: Clock3,
  ok: CheckCircle2,
  skipped: Clock3,
};

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
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="text-[length:var(--font-size-ui-xs)] font-bold leading-5 text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

export default function DoctorWorkbenchFeature() {
  const [snapshot, setSnapshot] = useState<DoctorSnapshot>(() => getDoctorWorkbenchPreviewSnapshot());
  const [loadingSource, setLoadingSource] = useState<'runtime' | 'preview'>('preview');
  const [runtimeError, setRuntimeError] = useState<string>('');

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

  const view = useMemo(() => deriveDoctorWorkbenchView(snapshot), [snapshot]);
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
  const previewOnly = view.source === 'preview';

  return (
    <div
      data-collaboration-id="PAGE_DOCTOR_WORKBENCH"
      data-doctor-mode="read-only"
      className="h-full w-full overflow-auto p-6 lg:p-8 select-text"
    >
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title="Doctor Workbench"
          subtitle={`source=${view.source} / runtime=${previewOnly ? 'preview-only' : loadingSource} / generated ${formatPreviewTime(view.generatedAtUnixMs)}`}
          align="center"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
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
          aria-label="Doctor source boundary"
          data-doctor-mutation-surface="none"
          className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[4px_4px_0_var(--shadow-color)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Source boundary
              </div>
              <p className="mt-1 max-w-3xl text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-secondary)]">
                {previewOnly
                  ? 'This workbench consumes the explicit preview doctor snapshot because Wails runtime is unavailable.'
                  : 'This workbench consumes the read-only Wails Doctor snapshot and surfaces sidecar authority facts without repair mutations.'}
                {runtimeError ? ` Runtime fallback: ${runtimeError}` : ''}
              </p>
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Mutation surface: none. Evidence only, no repair handler.
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(view.statusCounts).map(([status, count]) => (
                <div
                  key={status}
                  className={`min-w-20 border-2 px-3 py-2 text-center ${statusTone[status as DoctorCheckStatus]}`}
                  data-testid={`doctor-count-${status}`}
                >
                  <div className="text-lg font-black leading-none">{count}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest">{statusLabel[status as DoctorCheckStatus]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Doctor acceptance checks" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-3">
            {view.checks.map((check) => {
              const Icon = statusIcon[check.status];
              return (
                <article
                  key={check.id}
                  data-doctor-check-id={check.id}
                  className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[3px_3px_0_var(--shadow-color)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 border-2 px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone[check.status]}`}>
                          <Icon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                          {statusLabel[check.status]}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          {check.kind}
                        </span>
                      </div>
                      <h3 className="mt-3 text-[length:var(--font-size-ui-xl)] font-black uppercase tracking-normal text-[var(--text-primary)]">
                        {check.title}
                      </h3>
                      <p className="mt-2 text-[length:var(--font-size-ui-sm)] font-semibold leading-6 text-[var(--text-secondary)]">
                        {check.reason}
                      </p>
                    </div>
                    <div className="grid min-w-52 gap-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
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
                          className="border border-[var(--border-color)] bg-[var(--bg-muted)] px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                              {item.label}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                              {item.kind} / {item.sourceLabel}
                            </span>
                          </div>
                          {item.routeFallbackState ? (
                            <div className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                              {item.routeFallbackState === 'unknown-non-authoritative'
                                ? 'Unknown non-authoritative evidence'
                                : 'Partial identity fallback'}
                            </div>
                          ) : null}
                          <p className="mt-1 text-[length:var(--font-size-ui-xs)] font-semibold leading-5 text-[var(--text-secondary)]">
                            {item.summaryLabel}
                          </p>
                          {item.targetKey ? (
                            <div
                              data-doctor-route-evidence-target={item.targetKey}
                              className="mt-3 border border-[var(--border-color)] bg-[var(--bg-surface)] p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                  Structured route evidence
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                  Read only
                                </div>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div data-doctor-route-evidence-target={item.targetKey} className="space-y-1">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                    Target key
                                  </div>
                                  <div className="break-all text-[length:var(--font-size-ui-xs)] font-bold leading-5 text-[var(--text-primary)]">
                                    {item.targetKey}
                                  </div>
                                </div>
                                <div
                                  data-doctor-route-evidence-blocking={item.routeBlockingLabel || 'unknown'}
                                  className="space-y-1"
                                >
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                    Route blocking
                                  </div>
                                  <div className="text-[length:var(--font-size-ui-xs)] font-bold leading-5 text-[var(--text-primary)]">
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
                          className="flex items-center justify-between gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-muted)]"
                        >
                          <span className="min-w-0 truncate">{target.label}</span>
                          <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="h-fit border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[3px_3px_0_var(--shadow-color)]">
            <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Core acceptance
            </div>
            <div className="mt-3 space-y-3">
              {acceptanceChecks.map((check) => (
                <div key={`acceptance-${check.id}`} className="border border-[var(--border-color)] bg-[var(--bg-muted)] p-3">
                  <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-primary)]">{check.title}</div>
                  <div className="mt-2 text-[length:var(--font-size-ui-xs)] font-bold leading-5 text-[var(--text-secondary)]">
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
