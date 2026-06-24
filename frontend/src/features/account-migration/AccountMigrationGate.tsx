import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Database, Loader2, RefreshCw } from 'lucide-react';
import { Button } from 'antd';
import {
  CommitAccountMigration,
  DeleteLegacyAccountSources,
  GetAccountMigrationPreview,
} from '../../../wailsjs/go/main/App';
import PageLoadingFallback from '../../components/ui/PageLoadingFallback';
import { useDebug } from '../../context/useDebug';
import type { SidecarStatus } from '../../types';
import { toErrorMessage } from '../../utils/error';
import { hasPreviewMode, hasWailsAppBindings } from '../../utils/previewMode';
import {
  canCommitAccountMigration,
  formatAccountMigrationKind,
  resolveAccountMigrationStepState,
  shouldCheckAccountMigration,
  shouldShowAccountMigrationGate,
  type AccountMigrationPreview,
} from './model';

interface AccountMigrationGateProps {
  sidecarStatus: SidecarStatus;
  children: ReactNode;
}

const accountMigrationGateLoadingClass =
  'fixed inset-0 z-[90] flex min-w-0 overflow-hidden bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)]';
const accountMigrationGateShellClass =
  'fixed inset-0 z-[90] flex w-screen max-w-full min-w-0 flex-col overflow-hidden bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)]';
const accountMigrationGateHeaderClass =
  'flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-5 py-4 lg:px-7';
const accountMigrationGateBadgeClass =
  'mb-2 inline-flex rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountMigrationGatePanelClass =
  'grid min-w-0 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const accountMigrationGatePanelHeaderClass =
  'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-4 py-3';
const accountMigrationGateStepIndexClass =
  'grid h-11 w-11 shrink-0 place-items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]';
const accountMigrationGateChipClass =
  'inline-flex items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]';
const accountMigrationGateEmptyChipClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountMigrationGateStatsClass =
  'grid min-w-0 gap-3 border-t border-[var(--gt-border-subtle)] pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0';
const accountMigrationGateNoticesClass =
  'grid gap-2 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4';
const accountMigrationGateNoticeToneClass = {
  success:
    'border-[var(--gt-status-success)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-status-success)]',
  warning:
    'border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] text-[var(--gt-status-warning)]',
  error:
    'border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] text-[var(--gt-status-danger)]',
};
const accountMigrationGateFooterClass =
  'min-w-0 shrink-0 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-5 lg:p-7';

export default function AccountMigrationGate({ sidecarStatus, children }: AccountMigrationGateProps) {
  const { trackRequest } = useDebug();
  const previewMode = hasPreviewMode('account-migration');
  const shouldCheck = previewMode || shouldCheckAccountMigration(sidecarStatus, hasWailsAppBindings());
  const [preview, setPreview] = useState<AccountMigrationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<'commit' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadPreview = useCallback(async () => {
    if (!shouldCheck) {
      setPreview(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (previewMode) {
        setPreview(buildPreviewAccountMigrationState('needs-migration'));
        return;
      }
      const next = await trackRequest('GetAccountMigrationPreview', { args: [] }, () => GetAccountMigrationPreview());
      setPreview(next);
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [previewMode, shouldCheck, trackRequest]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const stepState = useMemo(() => resolveAccountMigrationStepState(preview), [preview]);
  const blocksApp = shouldCheck && (preview === null || loading || Boolean(error) || shouldShowAccountMigrationGate(preview));

  async function handleConfirmMigration() {
    if (busyAction !== null) {
      return;
    }
    setError('');
    setMessage('');
    try {
      if (preview?.status === 'needs-migration' || preview?.status === 'ready-to-delete-legacy') {
        if (!canCommitAccountMigration(preview, false)) {
          return;
        }
        setBusyAction('commit');
        if (previewMode) {
          setPreview(buildPreviewAccountMigrationState('ready'));
          setMessage('已迁移 12 个账号并清理旧账号来源。');
          return;
        }
        const result = await trackRequest('CommitAccountMigration', { candidateCount: preview?.candidateCount ?? 0 }, () => CommitAccountMigration());
        const nextPreview = result?.preview ?? (await loadPreviewAndReturn());
        setMessage(`已迁移 ${result?.imported ?? 0} 个账号，跳过 ${result?.skipped ?? 0} 个已导入来源。`);
        if (result?.errors?.length) {
          setPreview(nextPreview);
          setError(result.errors.join('\n'));
          return;
        }
        if (nextPreview?.status !== 'ready-to-delete-legacy') {
          if (nextPreview) {
            setPreview(nextPreview);
          }
          return;
        }
        setPreview(nextPreview);
        setBusyAction('delete');
        await deleteLegacySourcesAfterConfirm(nextPreview);
        return;
      }
    } catch (nextError) {
      setError(toErrorMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  async function loadPreviewAndReturn() {
    const next = await trackRequest('GetAccountMigrationPreview', { args: [] }, () => GetAccountMigrationPreview());
    setPreview(next);
    return next;
  }

  async function deleteLegacySourcesAfterConfirm(sourcePreview: AccountMigrationPreview) {
    const result = await trackRequest('DeleteLegacyAccountSources', { accountCount: sourcePreview?.accountCount ?? 0 }, () => DeleteLegacyAccountSources());
    if (result?.preview) {
      setPreview(result.preview);
    } else {
      await loadPreview();
    }
    setMessage(`已清理旧账号来源，删除 ${result?.deleted ?? 0} 项，备份目录：${result?.backupDir || sourcePreview?.backupHint || 'migration-backups'}`);
  }

  if (!blocksApp) {
    return <>{children}</>;
  }

  if (shouldCheck && preview === null && !error) {
    return (
      <>
        <div className="h-full" aria-hidden="true">
          {children}
        </div>
        <section
          role="status"
          aria-live="polite"
          className={accountMigrationGateLoadingClass}
          data-account-migration-loading
        >
          <PageLoadingFallback />
        </section>
      </>
    );
  }

  const totalCandidates = preview?.candidateCount ?? 0;
  const migratedAccounts = preview?.accountCount ?? 0;
  const primaryAction =
    preview?.status === 'needs-migration'
      ? {
          label: busyAction ? '处理中' : '确认迁移',
          icon: busyAction === 'commit' ? <Loader2 className="h-4 w-4" /> : <Database className="h-4 w-4" />,
          onClick: handleConfirmMigration,
          disabled: !canCommitAccountMigration(preview, busyAction !== null),
        }
      : preview?.status === 'ready-to-delete-legacy'
        ? {
            label: busyAction ? '处理中' : '确认迁移并清理旧源',
            icon: busyAction ? <Loader2 className="h-4 w-4" /> : <Database className="h-4 w-4" />,
            onClick: handleConfirmMigration,
            disabled: !canCommitAccountMigration(preview, busyAction !== null),
          }
        : null;

  return (
    <>
      <div className="h-full" aria-hidden="true">
        {children}
      </div>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-migration-title"
        className={accountMigrationGateShellClass}
        data-account-migration-gate
      >
      <header className={accountMigrationGateHeaderClass} data-account-migration-header>
        <div className="min-w-0">
          <div className={accountMigrationGateBadgeClass}>
            App started / migration modal
          </div>
          <h1 id="account-migration-title" className="text-[length:var(--gt-font-size-5xl)] font-semibold leading-tight lg:text-[length:var(--gt-font-size-display)]">
            账号存储迁移
          </h1>
          <p className="mt-1 max-w-3xl break-words text-[length:var(--gt-font-size-md)] font-semibold leading-relaxed text-[var(--gt-ink-muted)] [overflow-wrap:anywhere]">
            sidecar 已切换到 SQLite 账号库。进入工作台前，需要先把旧账号凭证和配置导入新事实源，再清理旧数据来源。
          </p>
        </div>
        <Button
          size="small"
          onClick={loadPreview}
          disabled={loading || busyAction !== null}
          icon={loading ? <Loader2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
        >
          重新检查
        </Button>
      </header>

      <div className="grid min-h-0 min-w-0 flex-1 content-start gap-5 overflow-y-auto overflow-x-hidden p-5 lg:p-7">
        <section className={accountMigrationGatePanelClass} data-account-migration-summary-panel>
          <div className={accountMigrationGatePanelHeaderClass}>
            <div className="text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
              迁移列表
            </div>
          </div>

          <div className="grid min-w-0 gap-0">
            <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={accountMigrationGateStepIndexClass}>
                    01
                  </span>
                  <div className="min-w-0">
                    <div className="text-[length:var(--gt-font-size-2xl)] font-semibold">账号迁移</div>
                    <p className="mt-1 break-words text-[length:var(--gt-font-size-sm)] font-semibold leading-relaxed text-[var(--gt-ink-muted)] [overflow-wrap:anywhere]">
                      导入账号凭证与配置，确认 SQLite 账号写入后删除旧账号事实源。
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex min-w-0 flex-wrap gap-2" data-account-migration-kind-list>
                  {preview?.kindSummary?.length ? (
                    preview.kindSummary.map((item) => (
                      <span key={item.kind} className={accountMigrationGateChipClass}>
                        {formatAccountMigrationKind(item.kind)}
                        <span className="text-[var(--gt-ink-muted)]">{item.count}</span>
                      </span>
                    ))
                  ) : (
                    <span className={accountMigrationGateEmptyChipClass}>
                      {loading ? 'Dry-run' : 'No Candidates'}
                    </span>
                  )}
                </div>
              </div>

              <div className={accountMigrationGateStatsClass} data-account-migration-stats>
                <MigrationStat label="旧账号来源" value={`${totalCandidates}`} />
                <MigrationStat label="SQLite 账号" value={`${migratedAccounts}`} />
                <MigrationStat
                  label="当前阶段"
                  value={stepState.commit === 'active' ? '写入 SQLite' : stepState.cleanup === 'done' ? '完成' : '检查中'}
                />
              </div>
            </div>
          </div>
        </section>

        {(error || message || preview?.warnings?.length) ? (
          <section className={accountMigrationGateNoticesClass} data-account-migration-notices>
            {error ? <NoticeLine tone="error" text={error} /> : null}
            {message ? <NoticeLine tone="success" text={message} /> : null}
            {preview?.warnings?.map((warning) => <NoticeLine key={warning} tone="warning" text={warning} />)}
          </section>
        ) : null}
      </div>

      <footer className={accountMigrationGateFooterClass} data-account-migration-footer>
        {primaryAction ? (
          <Button
            type="primary"
            size="small"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            icon={primaryAction.icon}
            className="w-full min-h-14"
          >
            {primaryAction.label}
          </Button>
        ) : null}
      </footer>
      </section>
    </>
  );
}

function NoticeLine({ tone, text }: { tone: 'success' | 'warning' | 'error'; text: string }) {
  return (
    <div className={`rounded border px-3 py-2 text-[length:var(--gt-font-size-sm)] font-semibold leading-relaxed ${accountMigrationGateNoticeToneClass[tone]}`}>
      {text}
    </div>
  );
}

function MigrationStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-[var(--gt-border-subtle)] pb-2 last:border-b-0 last:pb-0">
      <span className="truncate text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">{label}</span>
      <span className="font-mono text-[length:var(--gt-font-size-lg)] font-semibold">{value}</span>
    </div>
  );
}

function accountMigrationBackupFallback() {
  return '~/.config/gettokens/migration-backups/accounts-v1-<timestamp>/';
}

function buildPreviewAccountMigrationState(status: 'needs-migration' | 'ready-to-delete-legacy' | 'ready'): AccountMigrationPreview {
  return {
    status,
    accountCount: status === 'needs-migration' ? 0 : 12,
    candidateCount: status === 'ready' ? 0 : 12,
    kindSummary:
      status === 'ready'
        ? []
        : [
            { kind: 'auth-file', count: 4 },
            { kind: 'codex-api-key', count: 8 },
          ],
    warnings: [],
    generatedAtUnixMs: Date.now(),
    backupHint: accountMigrationBackupFallback(),
  };
}
