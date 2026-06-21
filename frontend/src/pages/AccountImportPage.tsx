import { useMemo, useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, ClipboardPaste, FilePlus, Loader2, Upload } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useAccountsPageStateContext } from '../features/accounts/AccountsPageStateContext';
import AccountImportQueueList, { type AccountImportQueueItem } from '../features/accounts/components/AccountImportQueueList';
import { readAccountClipboardText } from '../features/accounts/model/accountClipboard';
import {
  parseAccountImportPayloads,
  readUploadFiles,
  type AccountImportPayloadItem,
} from '../features/accounts/model/accountTransfer';
import type { TextInputEvent } from '../features/accounts/model/types';
import { toErrorMessage } from '../utils/error';

interface AccountImportPageProps {
  onDone: () => void;
}

type AccountImportSource = 'file' | 'paste';

const accountImportPageShellClass =
  'flex h-full flex-col overflow-hidden bg-[var(--gt-surface-muted)]';
const accountImportHeaderClass =
  'flex shrink-0 items-center justify-between border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-6 py-4';
const accountImportBackButtonClass =
  'inline-flex min-h-10 items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-50';
const accountImportEyebrowClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportTitleClass =
  'text-[length:var(--gt-font-size-xl)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportMetaChipClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2.5 py-1 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportErrorClass =
  'shrink-0 border-t border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-6 py-3 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-status-danger)]';
const accountImportMainClass =
  'min-h-0 flex-1 overflow-auto';
const accountImportGridClass =
  'grid gap-5 p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start';
const accountImportPanelClass =
  'grid min-w-0 gap-4 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4';
const accountImportPanelSectionClass =
  'grid gap-3 border-b border-[var(--gt-border-subtle)] pb-4';
const accountImportPanelTitleClass =
  'truncate text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportPanelMetaClass =
  'font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportDropzoneClass = (active: boolean) =>
  `grid min-h-36 place-items-center rounded border px-5 py-6 text-center transition-[background-color,border-color,transform] active:scale-[0.99] disabled:opacity-45 ${
    active
      ? 'border-[var(--gt-ink-primary)] bg-[color-mix(in_srgb,var(--gt-ink-primary)_8%,var(--gt-surface-muted))]'
      : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]'
  }`;
const accountImportDropzoneTitleClass =
  'text-sm font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportDropzoneHintClass =
  'max-w-sm text-[length:var(--gt-font-size-xs)] font-medium leading-relaxed tracking-normal text-[var(--gt-ink-muted)]';
const accountImportTextareaClass =
  'min-h-36 w-full resize-y rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 font-mono text-xs text-[var(--gt-ink-primary)] outline-none transition-colors placeholder:text-[var(--gt-ink-muted)] focus:border-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-50';
const accountImportButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-50';
const accountImportPrimaryButtonClass =
  'rounded border border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-surface-canvas)] transition-colors disabled:cursor-not-allowed disabled:opacity-45';
const accountImportQueueHeaderClass =
  'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3';
const accountImportQueueEmptyClass =
  'px-4 py-8 text-center text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportFooterClass =
  'flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-6 py-4';
const accountImportSummaryClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';

export default function AccountImportPage({ onDone }: AccountImportPageProps) {
  const { t } = useI18n();
  const { submitAccountImport } = useAccountsPageStateContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pasteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const nextIDRef = useRef(0);
  const [queueItems, setQueueItems] = useState<AccountImportQueueItem[]>([]);
  const [pasteContent, setPasteContent] = useState('');
  const [error, setError] = useState('');
  const [readingFiles, setReadingFiles] = useState(false);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const queueSummary = useMemo(() => {
    return queueItems.reduce(
      (summary, item) => {
        if (item.payload.type === 'upload-file' || item.payload.type === 'auth-file') {
          summary.authFiles += 1;
        } else if (item.payload.type === 'codex-api-key') {
          summary.apiKeys += 1;
        } else {
          summary.providers += 1;
        }
        return summary;
      },
      { authFiles: 0, apiKeys: 0, providers: 0 },
    );
  }, [queueItems]);

  async function handleAddFiles(files: FileList | null) {
    if (!files?.length) return;
    setReadingFiles(true);
    setError('');
    try {
      const payload = await readUploadFiles(files);
      setQueueItems((prev) => [
        ...prev,
        ...payload.map((item) =>
          createQueueItem(nextIDRef, 'file', {
            type: 'upload-file',
            name: item.name,
            contentBase64: item.contentBase64,
          }),
        ),
      ]);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setReadingFiles(false);
    }
  }

  function handleFileDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = readingFiles || submitting ? 'none' : 'copy';
    if (!readingFiles && !submitting) {
      setIsFileDragOver(true);
    }
  }

  function handleFileDragLeave() {
    setIsFileDragOver(false);
  }

  function handleFileDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsFileDragOver(false);
    if (readingFiles || submitting) {
      return;
    }
    void handleAddFiles(event.dataTransfer.files);
  }

  function handleAddPaste() {
    const content = pasteContent.trim();
    if (!content) {
      setError(t('accounts.import_account_paste_required'));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      setError(t('accounts.import_account_paste_invalid'));
      return;
    }
    const items = parseAccountImportPayloads(parsed);
    if (!items?.length) {
      setError(t('accounts.import_account_paste_invalid'));
      return;
    }
    setQueueItems((prev) => [...prev, ...items.map((item) => createQueueItem(nextIDRef, 'paste', item))]);
    setPasteContent('');
    setError('');
  }

  async function handlePasteFromClipboard() {
    setError('');
    try {
      const content = await readAccountClipboardText();
      if (!content.trim()) {
        pasteInputRef.current?.focus();
        setError(t('accounts.import_account_paste_clipboard_unavailable'));
        return;
      }
      setPasteContent(content);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }

  async function handleSubmit() {
    if (queueItems.length === 0) {
      setError(t('accounts.import_account_queue_required'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitAccountImport(queueItems.map((item) => item.payload));
      onDone();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-account-import-page className={accountImportPageShellClass}>
      {/* Page header */}
      <div data-account-import-header className={accountImportHeaderClass}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onDone}
            disabled={submitting}
            className={accountImportBackButtonClass}
            aria-label="Back to accounts"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={3} />
            {t('common.back')}
          </button>
          <div>
            <div className={accountImportEyebrowClass}>
              {t('accounts.import_account_eyebrow')}
            </div>
            <h2 className={accountImportTitleClass}>
              {t('accounts.import_account_title')}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={accountImportMetaChipClass}>
            AUTO DETECT
          </span>
          <span className={accountImportMetaChipClass}>
            JSON ARRAY
          </span>
        </div>
      </div>

      {/* Error bar */}
      {error ? (
        <div className={accountImportErrorClass}>
          {error}
        </div>
      ) : null}

      {/* Main two-column layout */}
      <div className={accountImportMainClass}>
        <div className={accountImportGridClass}>
          {/* Left: input panel */}
          <section
            data-account-import-input-panel
            className={accountImportPanelClass}
          >
            <div className={accountImportPanelSectionClass}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FilePlus className="h-4 w-4 shrink-0 text-[var(--gt-ink-muted)]" strokeWidth={3} />
                  <h4 className={accountImportPanelTitleClass}>
                    {t('accounts.import_account_files')}
                  </h4>
                </div>
                <span className={accountImportPanelMetaClass}>
                  MULTI
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".json,.zip,.tar,.tar.gz,.tgz,.gz,.gzip,application/json,application/zip,application/gzip,application/x-tar"
                hidden
                onChange={(event) => {
                  void handleAddFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                data-account-import-dropzone
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleFileDragOver}
                onDragOver={handleFileDragOver}
                onDragLeave={handleFileDragLeave}
                onDrop={handleFileDrop}
                disabled={readingFiles || submitting}
                className={accountImportDropzoneClass(isFileDragOver)}
              >
                <span className="grid justify-items-center gap-3">
                  {readingFiles ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" strokeWidth={3} />}
                  <span className={accountImportDropzoneTitleClass}>
                    {t('accounts.import_account_choose_files')}
                  </span>
                  <span className={accountImportDropzoneHintClass}>
                    {t('accounts.import_account_files_hint')}
                  </span>
                </span>
              </button>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <ClipboardPaste className="h-4 w-4 shrink-0 text-[var(--gt-ink-muted)]" strokeWidth={3} />
                  <h4 className={accountImportPanelTitleClass}>
                    {t('accounts.import_account_paste')}
                  </h4>
                </div>
                <span className={accountImportPanelMetaClass}>
                  JSON
                </span>
              </div>
              <textarea
                ref={pasteInputRef}
                value={pasteContent}
                onChange={(event: TextInputEvent) => {
                  setPasteContent(event.target.value);
                  setError('');
                }}
                className={accountImportTextareaClass}
                placeholder={t('accounts.import_account_paste_placeholder')}
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleAddPaste} disabled={submitting} className={accountImportButtonClass}>
                  {t('accounts.import_account_add_paste')}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePasteFromClipboard()}
                  disabled={submitting}
                  className={accountImportButtonClass}
                >
                  {t('accounts.import_account_clear_paste')}
                </button>
              </div>
            </div>
          </section>

          {/* Right: candidate queue */}
          <section data-account-import-queue-panel className={accountImportPanelClass}>
            <header className={accountImportQueueHeaderClass}>
              <div className={accountImportPanelTitleClass}>
                {t('accounts.import_account_queue')}
              </div>
              <div className={`mt-1 ${accountImportPanelMetaClass}`}>
                {t('accounts.import_account_queue_hint')}
              </div>
            </header>
            {queueItems.length === 0 ? (
              <div className={accountImportQueueEmptyClass}>
                {t('accounts.import_account_queue_empty')}
              </div>
            ) : (
              <AccountImportQueueList
                items={queueItems}
                submitting={submitting}
                t={t}
                onRemove={(id) => setQueueItems((prev) => prev.filter((candidate) => candidate.id !== id))}
              />
            )}
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className={accountImportFooterClass}>
        <div className={accountImportSummaryClass}>
          {formatQueueSummary(t, queueItems.length, queueSummary)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onDone} disabled={submitting} className={accountImportButtonClass}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || queueItems.length === 0}
            className={accountImportPrimaryButtonClass}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('accounts.import_account_importing')}
              </span>
            ) : (
              t('accounts.import_account_submit')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function createQueueItem(
  nextIDRef: { current: number },
  source: AccountImportSource,
  payload: AccountImportPayloadItem,
): AccountImportQueueItem {
  nextIDRef.current += 1;
  return { id: `${source}-${nextIDRef.current}`, source, payload };
}

function formatQueueSummary(
  t: (key: string) => string,
  total: number,
  summary: { authFiles: number; apiKeys: number; providers: number },
) {
  if (total === 0) return t('accounts.import_account_queue_empty');
  return t('accounts.import_account_queue_summary')
    .replace('{total}', String(total))
    .replace('{authFiles}', String(summary.authFiles))
    .replace('{apiKeys}', String(summary.apiKeys))
    .replace('{providers}', String(summary.providers));
}
