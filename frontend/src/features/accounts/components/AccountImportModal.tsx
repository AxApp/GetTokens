import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Button, Input, Upload } from 'antd';
import type { TextAreaRef } from 'antd/lib/input/TextArea';
import { ClipboardPaste, FilePlus, Loader2, Upload as UploadIcon } from 'lucide-react';
import ModalFrame from '../../../components/ui/ModalFrame';
import { toErrorMessage } from '../../../utils/error';
import {
  parseAccountImportPayloads,
  readUploadFiles,
  type AccountImportPayloadItem,
} from '../model/accountTransfer';
import { readAccountClipboardText } from '../model/accountClipboard';
import type { TextInputEvent, Translator } from '../model/types';
import AccountImportQueueList, { type AccountImportQueueItem } from './AccountImportQueueList';

type AccountImportSource = 'file' | 'paste';

const accountImportModalHeaderClass =
  'flex flex-wrap items-start justify-between gap-4';
const accountImportModalEyebrowClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportModalTitleClass =
  'mt-1 text-[length:var(--gt-font-size-xl)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportModalMetaChipClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2.5 py-1 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportModalErrorClass =
  'border-t border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-6 py-4 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-status-danger)]';
const accountImportModalSummaryClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportModalBodyClass =
  'grid gap-5 p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start';
const accountImportModalPanelClass =
  'grid min-w-0 gap-4 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4';
const accountImportModalPanelSectionClass =
  'grid gap-3 border-b border-[var(--gt-border-subtle)] pb-4';
const accountImportModalPanelTitleClass =
  'truncate text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportModalPanelMetaClass =
  'font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportModalDropzoneClass = (active: boolean) =>
  `grid min-h-36 place-items-center rounded border px-5 py-6 text-center transition-[background-color,border-color] disabled:opacity-45 ${
    active
      ? 'border-[var(--gt-ink-primary)] bg-[color-mix(in_srgb,var(--gt-ink-primary)_8%,var(--gt-surface-muted))]'
      : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]'
  }`;
const accountImportModalDropzoneTitleClass =
  'text-sm font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportModalDropzoneHintClass =
  'max-w-sm text-[length:var(--gt-font-size-xs)] font-normal leading-relaxed tracking-normal text-[var(--gt-ink-muted)]';
const accountImportModalQueueHeaderClass =
  'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3';
const accountImportModalQueueEmptyClass =
  'px-4 py-8 text-center text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';

interface AccountImportModalProps {
  t: Translator;
  initialPasteContent?: string;
  initialItems?: AccountImportPayloadItem[];
  onClose: () => void;
  onSubmit: (items: AccountImportPayloadItem[]) => Promise<void> | void;
}

export default function AccountImportModal({
  t,
  initialPasteContent = '',
  initialItems = [],
  onClose,
  onSubmit,
}: AccountImportModalProps) {
  const pasteInputRef = useRef<TextAreaRef | null>(null);
  const nextIDRef = useRef(0);
  const [queueItems, setQueueItems] = useState<AccountImportQueueItem[]>(() =>
    initialItems.map((payload) => createQueueItem(nextIDRef, 'paste', payload))
  );
  const [pasteContent, setPasteContent] = useState(initialPasteContent);
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
    if (!files?.length) {
      return;
    }
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
        pasteInputRef.current?.nativeElement?.focus();
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
      await onSubmit(queueItems.map((item) => item.payload));
      onClose();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame
      onClose={submitting ? () => undefined : onClose}
      size="xl"
      ariaLabel={t('accounts.import_account_title')}
      header={
        <div data-account-import-modal-header className={accountImportModalHeaderClass}>
          <div className="min-w-0">
            <div className={accountImportModalEyebrowClass}>
              {t('accounts.import_account_eyebrow')}
            </div>
            <h3 className={accountImportModalTitleClass}>
              {t('accounts.import_account_title')}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={accountImportModalMetaChipClass}>
              AUTO DETECT
            </span>
            <span className={accountImportModalMetaChipClass}>
              JSON ARRAY
            </span>
          </div>
        </div>
      }
      error={
        error ? (
          <div className={accountImportModalErrorClass}>
            {error}
          </div>
        ) : undefined
      }
      footer={
        <>
          <div className={accountImportModalSummaryClass}>
            {formatQueueSummary(t, queueItems.length, queueSummary)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button
              type="primary"
              onClick={() => void handleSubmit()}
              disabled={submitting || queueItems.length === 0}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4" />
                  {t('accounts.import_account_importing')}
                </span>
              ) : (
                t('accounts.import_account_submit')
              )}
            </Button>
          </div>
        </>
      }
    >
      <div data-account-import-modal-body className={accountImportModalBodyClass}>
        <section
          data-account-import-input-panel
          className={accountImportModalPanelClass}
        >
          <div className={accountImportModalPanelSectionClass}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FilePlus className="h-4 w-4 shrink-0 text-[var(--gt-ink-muted)]" strokeWidth={3} />
                <h4 className={accountImportModalPanelTitleClass}>
                  {t('accounts.import_account_files')}
                </h4>
              </div>
              <span className={accountImportModalPanelMetaClass}>
                MULTI
              </span>
            </div>

            <Upload
              multiple
              accept=".json,.zip,.tar,.tar.gz,.tgz,.gz,.gzip,application/json,application/zip,application/gzip,application/x-tar"
              showUploadList={false}
              beforeUpload={(file) => {
                const dt = new DataTransfer();
                dt.items.add(file);
                void handleAddFiles(dt.files);
                return false;
              }}
            >
              <Button
                data-account-import-dropzone
                onDragEnter={handleFileDragOver}
                onDragOver={handleFileDragOver}
                onDragLeave={handleFileDragLeave}
                onDrop={handleFileDrop}
                disabled={readingFiles || submitting}
                className={accountImportModalDropzoneClass(isFileDragOver)}
              >
                <span className="grid justify-items-center gap-3">
                  {readingFiles ? <Loader2 className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" strokeWidth={3} />}
                  <span className={accountImportModalDropzoneTitleClass}>
                    {t('accounts.import_account_choose_files')}
                  </span>
                  <span className={accountImportModalDropzoneHintClass}>
                    {t('accounts.import_account_files_hint')}
                  </span>
                </span>
              </Button>
            </Upload>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ClipboardPaste className="h-4 w-4 shrink-0 text-[var(--gt-ink-muted)]" strokeWidth={3} />
                <h4 className={accountImportModalPanelTitleClass}>
                  {t('accounts.import_account_paste')}
                </h4>
              </div>
              <span className={accountImportModalPanelMetaClass}>
                JSON
              </span>
            </div>
            <Input.TextArea
              size="small"
              ref={pasteInputRef}
              value={pasteContent}
              onChange={(event: TextInputEvent) => {
                setPasteContent(event.target.value);
                setError('');
              }}
              className="min-h-36 resize-y font-mono text-xs"
              placeholder={t('accounts.import_account_paste_placeholder')}
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAddPaste} disabled={submitting}>
                {t('accounts.import_account_add_paste')}
              </Button>
              <Button
                onClick={() => void handlePasteFromClipboard()}
                disabled={submitting}
              >
                {t('accounts.import_account_clear_paste')}
              </Button>
            </div>
          </div>
        </section>

        <section data-account-import-queue-panel className={accountImportModalPanelClass}>
          <header className={accountImportModalQueueHeaderClass}>
            <div className={accountImportModalPanelTitleClass}>
              {t('accounts.import_account_queue')}
            </div>
            <div className={`mt-1 ${accountImportModalPanelMetaClass}`}>
              {t('accounts.import_account_queue_hint')}
            </div>
          </header>
          {queueItems.length === 0 ? (
            <div className={accountImportModalQueueEmptyClass}>
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
    </ModalFrame>
  );
}

function createQueueItem(
  nextIDRef: { current: number },
  source: AccountImportSource,
  payload: AccountImportPayloadItem,
): AccountImportQueueItem {
  nextIDRef.current += 1;
  return {
    id: `${source}-${nextIDRef.current}`,
    source,
    payload,
  };
}

function formatQueueSummary(
  t: Translator,
  total: number,
  summary: { authFiles: number; apiKeys: number; providers: number },
) {
  if (total === 0) {
    return t('accounts.import_account_queue_empty');
  }
  return t('accounts.import_account_queue_summary')
    .replace('{total}', String(total))
    .replace('{authFiles}', String(summary.authFiles))
    .replace('{apiKeys}', String(summary.apiKeys))
    .replace('{providers}', String(summary.providers));
}
