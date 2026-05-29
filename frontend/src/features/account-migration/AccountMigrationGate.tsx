import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Database, Loader2, RefreshCw } from 'lucide-react';
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
          className="fixed inset-0 z-[90] flex min-w-0 overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]"
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
          icon: busyAction === 'commit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />,
          onClick: handleConfirmMigration,
          disabled: !canCommitAccountMigration(preview, busyAction !== null),
        }
      : preview?.status === 'ready-to-delete-legacy'
        ? {
            label: busyAction ? '处理中' : '确认迁移并清理旧源',
            icon: busyAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />,
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
        className="fixed inset-0 z-[90] flex w-screen max-w-full min-w-0 flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]"
      >
      <header className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-4 border-b-4 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-4 lg:px-7">
        <div className="min-w-0">
          <div className="mb-2 inline-flex border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em]">
            APP STARTED / MIGRATION MODAL
          </div>
          <h1 id="account-migration-title" className="text-[length:var(--font-size-ui-5xl)] font-black leading-tight lg:text-[length:var(--font-size-ui-display)]">
            账号存储迁移
          </h1>
          <p className="mt-1 max-w-3xl break-words text-[length:var(--font-size-ui-md)] font-semibold leading-relaxed text-[var(--text-muted)] [overflow-wrap:anywhere]">
            sidecar 已切换到 SQLite 账号库。进入工作台前，需要先把旧账号凭证和配置导入新事实源，再清理旧数据来源。
          </p>
        </div>
        <button
          type="button"
          onClick={loadPreview}
          disabled={loading || busyAction !== null}
          className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          重新检查
        </button>
      </header>

      <div className="grid min-h-0 min-w-0 flex-1 content-start gap-5 overflow-y-auto overflow-x-hidden p-5 lg:p-7">
        <section className="grid min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
          <div className="border-b-2 border-[var(--border-color)] px-4 py-3">
            <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              迁移列表
            </div>
          </div>

          <div className="grid min-w-0 gap-0">
            <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center border-2 border-[var(--border-color)] bg-[var(--text-primary)] font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--bg-main)]">
                    01
                  </span>
                  <div className="min-w-0">
                    <div className="text-[length:var(--font-size-ui-2xl)] font-black">账号迁移</div>
                    <p className="mt-1 break-words text-[length:var(--font-size-ui-sm)] font-semibold leading-relaxed text-[var(--text-muted)] [overflow-wrap:anywhere]">
                      导入账号凭证与配置，确认 SQLite 账号写入后删除旧账号事实源。
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                  {preview?.kindSummary?.length ? (
                    preview.kindSummary.map((item) => (
                      <span key={item.kind} className="inline-flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black">
                        {formatAccountMigrationKind(item.kind)}
                        <span className="text-[var(--text-muted)]">{item.count}</span>
                      </span>
                    ))
                  ) : (
                    <span className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {loading ? 'Dry-run' : 'No Candidates'}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid min-w-0 gap-3 border-t-2 border-dashed border-[var(--border-color)] pt-4 lg:border-l-2 lg:border-t-0 lg:pl-4 lg:pt-0">
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
          <section className="grid gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
            {error ? <NoticeLine tone="error" text={error} /> : null}
            {message ? <NoticeLine tone="success" text={message} /> : null}
            {preview?.warnings?.map((warning) => <NoticeLine key={warning} tone="warning" text={warning} />)}
          </section>
        ) : null}
      </div>

      <footer className="min-w-0 shrink-0 border-t-4 border-[var(--border-color)] bg-[var(--bg-main)] p-5 lg:p-7">
        {primaryAction ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="btn-swiss min-h-16 w-full bg-[var(--text-primary)] !px-6 !py-4 !text-[length:var(--font-size-ui-lg)] !font-black !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {primaryAction.icon}
            {primaryAction.label}
          </button>
        ) : null}
      </footer>
      </section>
    </>
  );
}

function NoticeLine({ tone, text }: { tone: 'success' | 'warning' | 'error'; text: string }) {
  const toneClass =
    tone === 'success'
      ? 'bg-[var(--color-status-success)] text-[var(--text-on-accent)]'
      : tone === 'warning'
        ? 'bg-[var(--color-status-warning)] text-[var(--text-primary)]'
        : 'bg-[var(--color-status-danger)] text-[var(--text-on-accent)]';
  return <div className={`px-3 py-2 text-[length:var(--font-size-ui-sm)] font-black leading-relaxed ${toneClass}`}>{text}</div>;
}

function MigrationStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-dashed border-[var(--border-color)] pb-2 last:border-b-0 last:pb-0">
      <span className="truncate text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</span>
      <span className="font-mono text-[length:var(--font-size-ui-lg)] font-black">{value}</span>
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
