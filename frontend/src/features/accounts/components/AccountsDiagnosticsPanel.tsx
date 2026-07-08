import { Input } from 'antd';
import { useMemo, useState } from 'react';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import {
  buildAccountDiagnosticsSnapshot,
  type AccountDiagnosticsSnapshot,
} from '../model/accountDiagnostics';
import type { CodexQuotaState } from '../model/types';

interface AccountsDiagnosticsPanelProps {
  accounts: AccountRecord[];
  filteredAccounts: AccountRecord[];
  codexQuotaByName: Record<string, CodexQuotaState>;
  runtimeSyncTargetAccountIDs: string[];
  runtimeRefreshing: boolean;
  lastRuntimeSyncAt: number | null;
  sidecarStatus: {
    code?: string;
    port?: number;
  };
}

export default function AccountsDiagnosticsPanel({
  accounts,
  filteredAccounts,
  codexQuotaByName,
  runtimeSyncTargetAccountIDs,
  runtimeRefreshing,
  lastRuntimeSyncAt,
  sidecarStatus,
}: AccountsDiagnosticsPanelProps) {
  const [targetAccountID, setTargetAccountID] = useState('');
  const snapshot = useMemo(
    () =>
      buildAccountDiagnosticsSnapshot({
        href: typeof window === 'undefined' ? '' : window.location.href,
        origin: typeof window === 'undefined' ? '' : window.location.origin,
        hasWailsBindings: hasWailsAppBindings(),
        sidecarCode: sidecarStatus.code,
        sidecarPort: sidecarStatus.port,
        accounts,
        filteredAccounts,
        runtimeSyncTargetAccountIDs,
        codexQuotaByName,
        storage: typeof window === 'undefined' ? null : window.localStorage,
        targetAccountID,
      }),
    [accounts, codexQuotaByName, filteredAccounts, runtimeSyncTargetAccountIDs, sidecarStatus.code, sidecarStatus.port, targetAccountID],
  );

  return (
    <section
      data-accounts-dev-diagnostics="true"
      className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4 text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-secondary)]"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
            Accounts Dev Diagnostics
          </div>
          <div className="mt-1 text-[var(--gt-ink-muted)]">
            只读诊断：用于区分 profile、窗口 cache、visible runtime sync 与真实 sidecar 状态。
          </div>
        </div>
        <div className="font-mono text-[var(--gt-ink-muted)]">
          {runtimeRefreshing ? 'runtime sync: running' : `last sync: ${formatDiagnosticsTime(lastRuntimeSyncAt)}`}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <DiagnosticsCell label="origin" value={snapshot.origin || '-'} />
        <DiagnosticsCell label="wails bindings" value={snapshot.hasWailsBindings ? 'yes' : 'no'} />
        <DiagnosticsCell label="sidecar" value={`${snapshot.sidecarCode} / ${snapshot.sidecarPort}`} />
        <DiagnosticsCell label="accounts" value={`${snapshot.filteredAccountCount} visible filters / ${snapshot.accountCount} total`} />
        <DiagnosticsCell label="quota state" value={`${snapshot.quotaStateCount} react / ${snapshot.quotaCacheCount} cache`} />
        <DiagnosticsCell label="list cache" value={`${snapshot.listCacheCount} items / ${formatDiagnosticsTime(snapshot.listCacheUpdatedAt)}`} />
        <DiagnosticsCell label="quota cache" value={`${snapshot.quotaCacheCount} items / ${formatDiagnosticsTime(snapshot.quotaCacheUpdatedAt)}`} />
        <DiagnosticsCell label="visible sync targets" value={`${snapshot.runtimeSyncTargetCount} targets`} />
      </div>

      <div className="mt-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3">
        <div className="mb-2 font-mono font-semibold text-[var(--gt-ink-primary)]">visible runtime sync ids</div>
        <div data-accounts-dev-diagnostics-visible-ids="true" className="flex flex-wrap gap-1.5 font-mono text-[length:var(--gt-font-size-2xs)]">
          {snapshot.visibleRuntimeSyncTargetIDs.length > 0 ? (
            <>
              {snapshot.visibleRuntimeSyncTargetIDs.map((id) => (
                <span key={id} className="rounded-sm border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-1.5 py-0.5">
                  {id}
                </span>
              ))}
              {snapshot.hiddenRuntimeSyncTargetCount > 0 ? (
                <span className="px-1.5 py-0.5 text-[var(--gt-ink-muted)]">+{snapshot.hiddenRuntimeSyncTargetCount}</span>
              ) : null}
            </>
          ) : (
            <span className="text-[var(--gt-ink-muted)]">no visible targets reported yet</span>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(220px,320px)_1fr]">
        <Input
          size="small"
          value={targetAccountID}
          onChange={(event) => setTargetAccountID(event.target.value)}
          placeholder="account id 或 quota key"
          data-accounts-dev-diagnostics-target-input="true"
        />
        <TargetAccountSummary snapshot={snapshot} />
      </div>
    </section>
  );
}

function DiagnosticsCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-sm border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1.5">
      <div className="font-mono text-[length:var(--gt-font-size-2xs)] uppercase text-[var(--gt-ink-muted)]">{label}</div>
      <div className="truncate font-mono text-[var(--gt-ink-primary)]" title={value}>{value}</div>
    </div>
  );
}

function TargetAccountSummary({ snapshot }: { snapshot: AccountDiagnosticsSnapshot }) {
  if (!snapshot.targetAccountID) {
    return (
      <div className="rounded-sm border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1.5 text-[var(--gt-ink-muted)]">
        输入 account id / quota key 后，对比 React runtime state 与当前窗口 quota-cache。
      </div>
    );
  }

  return (
    <div data-accounts-dev-diagnostics-target-summary="true" className="grid gap-2 rounded-sm border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1.5 md:grid-cols-3">
      <DiagnosticsCell label="target" value={snapshot.targetAccountName || snapshot.targetAccountID} />
      <DiagnosticsCell label="react runtime" value={`${snapshot.targetRuntimeStatus || 'missing'} / blocked=${snapshot.targetRuntimeBlocked ? 'yes' : 'no'}`} />
      <DiagnosticsCell label="window cache" value={`${snapshot.targetCacheStatus || 'missing'} / blocked=${snapshot.targetCacheBlocked ? 'yes' : 'no'}`} />
    </div>
  );
}

function formatDiagnosticsTime(value: number | null | undefined) {
  if (!value) {
    return 'never';
  }
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return 'invalid';
  }
}
