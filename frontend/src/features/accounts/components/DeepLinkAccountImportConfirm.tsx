import ModalFrame from '../../../components/ui/ModalFrame';
import { main } from '../../../../wailsjs/go/models';

interface DeepLinkAccountImportConfirmProps {
  preview: main.DeepLinkImportPreview;
  result?: main.DeepLinkApplyResult | null;
  applying: boolean;
  resultMessage?: string;
  previewMode?: boolean;
  onApply: () => void;
  onClose: () => void;
}

const deepLinkImportHeaderClass = 'grid gap-1';
const deepLinkImportTitleClass =
  'text-[length:var(--font-size-ui-lg)] font-semibold tracking-normal text-[var(--text-primary)]';
const deepLinkImportMetaClass =
  'font-mono text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const deepLinkImportButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-45';
const deepLinkImportPrimaryButtonClass =
  'rounded border border-[var(--text-primary)] bg-[var(--text-primary)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--gt-surface-canvas)] transition-colors disabled:cursor-not-allowed disabled:opacity-45';
const deepLinkImportBodyClass =
  'grid gap-5 p-0 text-[length:var(--font-size-ui-sm)]';
const deepLinkImportSummaryGridClass = 'grid gap-3 md:grid-cols-4';
const deepLinkImportPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4';
const deepLinkImportSummaryTileClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3';
const deepLinkImportSummaryLabelClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const deepLinkImportSummaryValueClass =
  'mt-1 truncate font-semibold tracking-normal text-[var(--text-primary)]';
const deepLinkImportUrlClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3 font-mono text-[length:var(--font-size-ui-2xs)] text-[var(--text-muted)]';
const deepLinkImportAccountTitleClass =
  'font-semibold tracking-normal text-[var(--text-primary)]';
const deepLinkImportAccountMetaClass =
  'mt-1 flex flex-wrap gap-2 text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const deepLinkImportResultClass =
  'mt-3 rounded border px-3 py-2 font-semibold tracking-normal';
const deepLinkImportNoticeClass =
  'rounded border px-4 py-3 font-semibold tracking-normal';
const deepLinkImportNoticeToneClass = {
  success: 'border-[var(--gt-status-success)] text-[var(--gt-status-success)]',
  warning: 'border-[var(--gt-status-warning)] text-[var(--gt-status-warning)]',
  error: 'border-[var(--gt-status-danger)] text-[var(--gt-status-danger)]',
} as const;

export default function DeepLinkAccountImportConfirm({
  preview,
  result,
  applying,
  resultMessage,
  previewMode = false,
  onApply,
  onClose,
}: DeepLinkAccountImportConfirmProps) {
  const accountCount = preview.accounts?.length ?? 0;
  const blockingCount = (preview.blocking?.length ?? 0)
    + (preview.accounts ?? []).reduce((total, account) => total + (account.blocking?.length ?? 0), 0);
  const canApply = !previewMode && !applying && accountCount > 0 && blockingCount === 0;
  const created = result?.created ?? 0;
  const failed = result?.failed ?? 0;

  return (
    <ModalFrame
      onClose={onClose}
      size="xl"
      header={(
        <div data-deep-link-import-confirm-header className={deepLinkImportHeaderClass}>
          <div className={deepLinkImportTitleClass}>导入账号</div>
          <div className={deepLinkImportMetaClass}>
            {preview.source?.name || 'GT DEEP LINK'} / {accountCount} 个账号
          </div>
        </div>
      )}
      footer={(
        <>
          <button type="button" className={deepLinkImportButtonClass} onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className={deepLinkImportPrimaryButtonClass}
            disabled={!canApply}
            onClick={onApply}
          >
            {applying ? '导入中...' : `导入 ${accountCount} 个账号`}
          </button>
        </>
      )}
    >
      <div data-deep-link-import-confirm-body className={deepLinkImportBodyClass}>
        <section data-deep-link-import-confirm-summary className={deepLinkImportSummaryGridClass}>
          <SummaryTile label="protocol" value={preview.protocol || 'gt'} />
          <SummaryTile label="accounts" value={String(accountCount)} />
          <SummaryTile label="warnings" value={String((preview.warnings?.length ?? 0) + blockingCount)} />
          <SummaryTile label="source" value={preview.source?.name || 'external'} />
        </section>

        <div data-deep-link-import-confirm-url className={deepLinkImportUrlClass}>
          {preview.redactedURL}
        </div>

        {previewMode ? (
          <Notice tone="warning" message="PREVIEW ONLY / 当前浏览器预览环境不会调用 Wails 写入。" />
        ) : null}
        {(preview.warnings || []).map((message) => (
          <Notice key={message} tone="warning" message={message} />
        ))}
        {(preview.blocking || []).map((message) => (
          <Notice key={message} tone="error" message={message} />
        ))}
        {resultMessage ? (
          <Notice tone={failed > 0 ? 'warning' : 'success'} message={resultMessage} />
        ) : null}

        <section data-deep-link-import-confirm-account-list className="grid gap-3">
          {(preview.accounts || []).map((account) => {
            const itemResult = result?.accounts?.find((item) => item.index === account.index);
            return (
              <article
                key={`${account.index}:${account.ref || account.title}`}
                className={deepLinkImportPanelClass}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className={deepLinkImportAccountTitleClass}>{account.title || account.kind}</div>
                    <div className={deepLinkImportAccountMetaClass}>
                      <span>{account.kind}</span>
                      {account.provider ? <span>{account.provider}</span> : null}
                      {account.ref ? <span>ref:{account.ref}</span> : null}
                      {account.disabled ? <span>disabled</span> : null}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[length:var(--font-size-ui-2xs)] text-[var(--text-muted)]">
                    <div>{account.baseUrl || '-'}</div>
                    <div>{account.apiKeyPreview || `${account.keyCount || 0} key(s)`} / {account.modelCount || 0} model(s)</div>
                  </div>
                </div>
                {itemResult ? (
                  <div className={`${deepLinkImportResultClass} ${
                    itemResult.status === 'created'
                      ? deepLinkImportNoticeToneClass.success
                      : deepLinkImportNoticeToneClass.error
                  }`}>
                    {itemResult.status === 'created'
                      ? `created ${itemResult.accountKey || ''}`
                      : `failed ${itemResult.error || ''}`}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        {result ? (
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryTile label="status" value={result.status || 'noop'} />
            <SummaryTile label="created" value={String(created)} />
            <SummaryTile label="failed" value={String(failed)} />
          </div>
        ) : null}
      </div>
    </ModalFrame>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={deepLinkImportSummaryTileClass}>
      <div className={deepLinkImportSummaryLabelClass}>{label}</div>
      <div className={deepLinkImportSummaryValueClass}>{value}</div>
    </div>
  );
}

function Notice({ tone, message }: { tone: 'success' | 'warning' | 'error'; message: string }) {
  const toneClass = deepLinkImportNoticeToneClass[tone];
  return (
    <div className={`${deepLinkImportNoticeClass} ${toneClass}`}>
      {message}
    </div>
  );
}
