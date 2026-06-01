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
        <div>
          <div className="text-[length:var(--font-size-ui-lg)] font-black uppercase text-[var(--text-primary)]">导入账号</div>
          <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">
            {preview.source?.name || 'GT DEEP LINK'} / {accountCount} 个账号
          </div>
        </div>
      )}
      footer={(
        <>
          <button type="button" className="btn-swiss !border-[var(--border-color)]" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className="btn-swiss"
            disabled={!canApply}
            onClick={onApply}
          >
            {applying ? '导入中...' : `导入 ${accountCount} 个账号`}
          </button>
        </>
      )}
    >
      <div className="space-y-5 text-[length:var(--font-size-ui-sm)]">
        <section className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="protocol" value={preview.protocol || 'gt'} />
          <SummaryTile label="accounts" value={String(accountCount)} />
          <SummaryTile label="warnings" value={String((preview.warnings?.length ?? 0) + blockingCount)} />
          <SummaryTile label="source" value={preview.source?.name || 'external'} />
        </section>

        <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 font-mono text-[length:var(--font-size-ui-2xs)] text-[var(--text-muted)]">
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

        <section className="space-y-3">
          {(preview.accounts || []).map((account) => {
            const itemResult = result?.accounts?.find((item) => item.index === account.index);
            return (
              <article
                key={`${account.index}:${account.ref || account.title}`}
                className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-black uppercase text-[var(--text-primary)]">{account.title || account.kind}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase text-[var(--text-muted)]">
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
                  <div className={`mt-3 border px-3 py-2 font-black uppercase ${
                    itemResult.status === 'created'
                      ? 'border-[var(--color-status-success)] text-[var(--color-status-success)]'
                      : 'border-[var(--color-status-danger)] text-[var(--color-status-danger)]'
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
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3">
      <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 truncate font-black uppercase text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function Notice({ tone, message }: { tone: 'success' | 'warning' | 'error'; message: string }) {
  const toneClass = tone === 'error'
    ? 'border-[var(--color-status-danger)] text-[var(--color-status-danger)]'
    : tone === 'warning'
      ? 'border-[var(--color-status-warning)] text-[var(--color-status-warning)]'
      : 'border-[var(--color-status-success)] text-[var(--color-status-success)]';
  return (
    <div className={`border-2 px-4 py-3 font-black uppercase ${toneClass}`}>
      {message}
    </div>
  );
}
