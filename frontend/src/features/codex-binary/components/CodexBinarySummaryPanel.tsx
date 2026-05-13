import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { CodexBinarySnapshot } from '../model';

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
    <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 shadow-[5px_5px_0_var(--shadow-color)] sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center">
            <div className="min-w-0 truncate text-xl font-black text-[var(--text-primary)]">
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
              className="btn-swiss whitespace-nowrap bg-[var(--text-primary)] !px-2.5 !py-1.5 !text-[0.5625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {managedBusy ? t('codex_binary.managing') : t('codex_binary.enable_managed')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="btn-swiss whitespace-nowrap !px-2.5 !py-1.5 !text-[0.5625rem] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('codex_binary.refresh')}
          </button>
        </div>
      </div>
      {snapshot?.managedConfig ? (
        <div className="mt-2 grid gap-x-5 gap-y-1 border-t border-[var(--border-color)] pt-2 text-[0.5625rem] font-semibold text-[var(--text-muted)] md:grid-cols-3">
          <ManagedMeta label={t('codex_binary.managed_bin_dir')} value={snapshot.managedConfig.binDir} />
          <ManagedMeta label={t('codex_binary.resolved_codex_path')} value={snapshot.managedConfig.resolvedCodexPath || t('codex_binary.resolved_codex_missing')} />
          <ManagedMeta label={t('codex_binary.managed_profile_target')} value={snapshot.managedConfig.profilePath || t('codex_binary.managed_profile_unknown')} strong />
        </div>
      ) : null}
      {message ? <div className="mt-2 border-t border-[var(--border-color)] pt-2 text-xs font-semibold text-[var(--text-muted)]">{message}</div> : null}
    </section>
  );
}

function StatusPill({ severity, text }: { severity: string; text: string }) {
  const color = severity === 'ok' ? 'bg-[var(--accent-green)] text-white' : severity === 'error' ? 'bg-[var(--accent-red)] text-white' : 'bg-[var(--accent-yellow)] text-[var(--text-primary)]';
  return <span className={`inline-flex items-center px-2 py-1 text-[0.5625rem] font-black ${color}`}>{text}</span>;
}

function ManagedMeta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 truncate">
      <span className="font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">{label}: </span>
      <span className={strong ? 'text-[var(--text-primary)]' : ''}>{value}</span>
    </div>
  );
}
