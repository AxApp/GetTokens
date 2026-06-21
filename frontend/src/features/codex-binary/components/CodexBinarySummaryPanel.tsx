import { ShieldCheck } from 'lucide-react';
import RefreshActionButton from '../../../components/ui/RefreshActionButton';
import type { CodexBinarySnapshot } from '../model';

const codexBinarySummaryPanelClass =
  'border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3 shadow-sm sm:p-4';
const codexBinarySummaryTitleClass =
  'min-w-0 truncate text-xl font-semibold text-[var(--gt-ink-primary)]';
const codexBinarySummaryActionButtonClass =
  'inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-ink-primary)] px-2.5 py-1.5 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-surface-canvas)] transition-colors hover:bg-[var(--gt-ink-secondary)] disabled:cursor-not-allowed disabled:opacity-50';
const codexBinarySummaryMetaClass =
  'mt-2 grid gap-x-5 gap-y-1 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]/55 px-2 py-2 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)] md:grid-cols-3';
const codexBinarySummaryMessageClass =
  'mt-2 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]/55 px-2 py-2 text-xs font-medium text-[var(--gt-ink-muted)]';
const codexBinarySummaryStatusClass =
  'inline-flex items-center rounded px-2 py-1 text-[length:var(--gt-font-size-xs)] font-medium';

export default function CodexBinarySummaryPanel({
  snapshot,
  message,
  loading,
  managedBusy,
  onEnableManagedPath,
  onRefresh,
  t,
}: {
  snapshot: CodexBinarySnapshot | null;
  message: string;
  loading: boolean;
  managedBusy: boolean;
  onEnableManagedPath: () => void;
  onRefresh: () => void;
  t: (key: string) => string;
}) {
  return (
    <section
      data-design-system-component="true"
      data-design-system-component-name="CodexBinarySummaryPanel"
      data-codex-binary-summary-panel="quiet"
      className={codexBinarySummaryPanelClass}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center">
            <div className={codexBinarySummaryTitleClass}>
              {snapshot?.currentVersion?.displayName || t('codex_binary.no_active')}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {snapshot?.doctor.severity === 'error' ? <StatusPill severity="error" text={snapshot.doctor.message} /> : null}
              {snapshot?.managedConfig ? (
                <StatusPill
                  severity={snapshot.managedConfig.isPathConfigured ? 'ok' : 'warning'}
                  text={snapshot.managedConfig.isPathConfigured ? t('codex_binary.managed_path_enabled') : t('codex_binary.managed_path_disabled')}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {snapshot?.managedConfig && !snapshot.managedConfig.isPathConfigured ? (
            <button
              type="button"
              onClick={onEnableManagedPath}
              disabled={managedBusy}
              className={codexBinarySummaryActionButtonClass}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {managedBusy ? t('codex_binary.managing') : t('codex_binary.enable_managed')}
            </button>
          ) : null}
          <RefreshActionButton
            onClick={onRefresh}
            disabled={loading}
            label={t('codex_binary.refresh')}
            loading={loading}
            size="sm"
            className="!px-2.5 !py-1.5"
          />
        </div>
      </div>
      {snapshot?.managedConfig ? (
        <div className={codexBinarySummaryMetaClass}>
          <ManagedMeta label={t('codex_binary.managed_bin_dir')} value={snapshot.managedConfig.binDir} />
          <ManagedMeta label={t('codex_binary.resolved_codex_path')} value={snapshot.managedConfig.resolvedCodexPath || t('codex_binary.resolved_codex_missing')} />
          <ManagedMeta label={t('codex_binary.managed_profile_target')} value={snapshot.managedConfig.profilePath || t('codex_binary.managed_profile_unknown')} strong />
        </div>
      ) : null}
      {message ? <div className={codexBinarySummaryMessageClass}>{message}</div> : null}
    </section>
  );
}

function StatusPill({ severity, text }: { severity: string; text: string }) {
  const color =
    severity === 'ok'
      ? 'bg-[var(--gt-status-success)]/12 text-[var(--gt-status-success)]'
      : severity === 'error'
        ? 'bg-[var(--gt-status-danger)]/12 text-[var(--gt-status-danger)]'
        : 'bg-[var(--gt-status-warning)]/14 text-[var(--gt-status-warning)]';
  return <span className={`${codexBinarySummaryStatusClass} ${color}`}>{text}</span>;
}

function ManagedMeta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 truncate">
      <span className="font-medium text-[var(--gt-ink-primary)]">{label}: </span>
      <span className={strong ? 'text-[var(--gt-ink-primary)]' : ''}>{value}</span>
    </div>
  );
}
