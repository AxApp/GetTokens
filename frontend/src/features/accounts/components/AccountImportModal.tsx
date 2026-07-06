import { useMemo, useRef, useState, useEffect, type DragEvent } from 'react';
import { Button, Input, Upload, Tabs, Alert, Checkbox } from 'antd';
import type { TextAreaRef } from 'antd/lib/input/TextArea';
import { ClipboardPaste, FilePlus, Loader2, Upload as UploadIcon, Trash2 } from 'lucide-react';
import ModalFrame from '../../../components/ui/ModalFrame';
import { toErrorMessage } from '../../../utils/error';
import {
  parseAccountImportPayloads,
  readUploadFiles,
  validateAccountImportPayloadItem,
  type AccountImportPayloadItem,
} from '../model/accountTransfer';
import { readAccountClipboardText } from '../model/accountClipboard';
import type { TextInputEvent, Translator } from '../model/types';
import AccountImportQueueList, { type AccountImportQueueItem } from './AccountImportQueueList';

type AccountImportSource = 'file' | 'paste' | 'clipboard';

const accountImportModalHeaderClass =
  'flex flex-wrap items-start justify-between gap-4';
const accountImportModalEyebrowClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportModalTitleClass =
  'mt-1 text-[length:var(--gt-font-size-xl)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportModalErrorClass =
  'border-t border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-6 py-4 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-status-danger)]';
const accountImportModalSummaryClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportModalBodyClass =
  'grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)] lg:items-start';
const accountImportModalPanelClass =
  'grid min-w-0 gap-4 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4';
const accountImportModalDropzoneClass = (active: boolean) =>
  `!h-auto !min-w-0 w-full max-w-full overflow-hidden whitespace-normal grid min-h-40 place-items-center rounded border px-5 py-6 text-center transition-[background-color,border-color] disabled:opacity-45 ${
    active
      ? 'border-[var(--gt-ink-primary)] bg-[color-mix(in_srgb,var(--gt-ink-primary)_8%,var(--gt-surface-muted))]'
      : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]'
  }`;
const accountImportModalDropzoneTitleClass =
  'max-w-full text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportModalDropzoneHintClass =
  'max-w-full whitespace-normal break-words text-[length:var(--gt-font-size-xs)] font-normal leading-relaxed tracking-normal text-[var(--gt-ink-muted)]';
const accountImportModalQueueHeaderClass =
  'flex items-center justify-between border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-2 shrink-0';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set(initialItems.map((_, i) => `paste-${i + 1}`))
  );

  // Sync selectedIds if queueItems changes and initially populated
  useEffect(() => {
    if (initialItems.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set(queueItems.map((item) => item.id)));
    }
  }, [queueItems, initialItems, selectedIds]);

  const [pasteContent, setPasteContent] = useState(initialPasteContent);
  const [error, setError] = useState('');
  const [readingFiles, setReadingFiles] = useState(false);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Smart Clipboard detector
  const [clipboardContent, setClipboardContent] = useState<string | null>(null);

  useEffect(() => {
    async function checkClipboard() {
      try {
        const text = await readAccountClipboardText();
        const trimmed = text.trim();
        if (trimmed && trimmed !== initialPasteContent.trim()) {
          const parsed = JSON.parse(trimmed);
          const validated = parseAccountImportPayloads(parsed);
          if (validated && validated.length > 0) {
            setClipboardContent(trimmed);
          }
        }
      } catch {
        // Safe to ignore clipboard access errors
      }
    }
    void checkClipboard();
  }, [initialPasteContent]);

  // Selected Count Statistics
  const selectedSummary = useMemo(() => {
    const selectedItems = queueItems.filter((item) => selectedIds.has(item.id));
    return selectedItems.reduce(
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
  }, [queueItems, selectedIds]);

  const allValid = useMemo(() => {
    const selectedItems = queueItems.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return false;
    return selectedItems.every((item) => validateAccountImportPayloadItem(item.payload).valid);
  }, [queueItems, selectedIds]);

  async function handleAddFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    setReadingFiles(true);
    setError('');
    try {
      const payload = await readUploadFiles(files);
      const nextItems: AccountImportQueueItem[] = [];

      for (let index = 0; index < payload.length; index += 1) {
        if (index > 0 && index % 50 === 0) {
          await yieldAccountImportWork();
        }
        nextItems.push(createQueueItem(nextIDRef, 'file', payload[index]));
      }

      setQueueItems((prev) => {
        const updated = [...prev, ...nextItems];
        setSelectedIds((prevSelected) => {
          const nextSelected = new Set(prevSelected);
          nextItems.forEach((item) => nextSelected.add(item.id));
          return nextSelected;
        });
        return updated;
      });
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

    const nextItems = items.map((item) => createQueueItem(nextIDRef, 'paste', item));
    setQueueItems((prev) => {
      const updated = [...prev, ...nextItems];
      setSelectedIds((prevSelected) => {
        const nextSelected = new Set(prevSelected);
        nextItems.forEach((item) => nextSelected.add(item.id));
        return nextSelected;
      });
      return updated;
    });
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

  function handleImportFromClipboard() {
    if (!clipboardContent) return;
    try {
      const parsed = JSON.parse(clipboardContent);
      const items = parseAccountImportPayloads(parsed);
      if (items && items.length > 0) {
        const nextItems = items.map((item) => createQueueItem(nextIDRef, 'clipboard', item));
        setQueueItems((prev) => {
          const updated = [...prev, ...nextItems];
          setSelectedIds((prevSelected) => {
            const nextSelected = new Set(prevSelected);
            nextItems.forEach((item) => nextSelected.add(item.id));
            return nextSelected;
          });
          return updated;
        });
        setClipboardContent(null);
        setError('');
      }
    } catch (err) {
      setError(toErrorMessage(err));
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleToggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(queueItems.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleRemoveItem(id: string) {
    setQueueItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleClearAll() {
    setQueueItems([]);
    setSelectedIds(new Set());
    setError('');
  }

  function handleUpdatePayload(id: string, newPayload: AccountImportPayloadItem) {
    setQueueItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, payload: newPayload } : item))
    );
  }

  async function handleSubmit() {
    const selectedItems = queueItems.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      setError(t('accounts.import_account_queue_required'));
      return;
    }

    const invalidItems = selectedItems.filter((item) => !validateAccountImportPayloadItem(item.payload).valid);
    if (invalidItems.length > 0) {
      setError(t('accounts.import_account_invalid_item').replace('{reason}', 'Please fix fields in editing cards first'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit(selectedItems.map((item) => item.payload));
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
            {selectedIds.size === 0
              ? t('accounts.import_account_queue_empty')
              : t('accounts.import_account_selected_summary')
                  .replace('{selected}', String(selectedIds.size))
                  .replace('{total}', String(queueItems.length))
                  .replace('{authFiles}', String(selectedSummary.authFiles))
                  .replace('{apiKeys}', String(selectedSummary.apiKeys))
                  .replace('{providers}', String(selectedSummary.providers))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button
              type="primary"
              onClick={() => void handleSubmit()}
              disabled={submitting || selectedIds.size === 0 || !allValid}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
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
      {/* Smart Clipboard Notification */}
      {clipboardContent && (
        <div className="shrink-0 px-6 pt-4">
          <Alert
            type="info"
            showIcon
            message={
              <div className="flex items-center justify-between gap-4">
                <span className="text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-primary)]">
                  {t('accounts.import_account_clipboard_banner')}
                </span>
                <Button
                  type="primary"
                  size="small"
                  onClick={handleImportFromClipboard}
                  icon={<ClipboardPaste className="h-3.5 w-3.5" />}
                >
                  {t('accounts.import_account_clipboard_action')}
                </Button>
              </div>
            }
            closable
            onClose={() => setClipboardContent(null)}
            className="rounded border-[var(--gt-border-focus)] bg-[var(--gt-primary-bg)] px-4"
          />
        </div>
      )}

      <div data-account-import-modal-body className={accountImportModalBodyClass}>
        {/* Left Workspace Panel: Tabs */}
        <section
          data-account-import-input-panel
          className={accountImportModalPanelClass}
        >
          <Tabs
            defaultActiveKey="file"
            size="small"
            items={[
              {
                key: 'file',
                label: (
                  <span className="flex items-center gap-1.5 font-semibold">
                    <FilePlus className="h-3.5 w-3.5" />
                    {t('accounts.import_account_files')}
                  </span>
                ),
                children: (
                  <div className="grid gap-3 pt-2">
                    <Upload
                      className="w-full [&_.ant-upload]:w-full [&_.ant-upload-select]:w-full [&_.ant-upload-select]:block"
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
                        block
                        data-account-import-dropzone
                        onDragEnter={handleFileDragOver}
                        onDragOver={handleFileDragOver}
                        onDragLeave={handleFileDragLeave}
                        onDrop={handleFileDrop}
                        disabled={readingFiles || submitting}
                        className={accountImportModalDropzoneClass(isFileDragOver)}
                      >
                        <span className="grid min-w-0 max-w-full justify-items-center gap-3 whitespace-normal">
                          {readingFiles ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <UploadIcon className="h-5 w-5" strokeWidth={3} />
                          )}
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
                ),
              },
              {
                key: 'paste',
                label: (
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    {t('accounts.import_account_paste')}
                  </span>
                ),
                children: (
                  <div className="grid gap-3 pt-2">
                    <Input.TextArea
                      size="small"
                      ref={pasteInputRef}
                      value={pasteContent}
                      onChange={(event: TextInputEvent) => {
                        setPasteContent(event.target.value);
                        setError('');
                      }}
                      rows={6}
                      className="w-full resize-none font-mono text-[length:var(--gt-font-size-xs)]"
                      placeholder={t('accounts.import_account_paste_placeholder')}
                      spellCheck={false}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="primary"
                        onClick={handleAddPaste}
                        disabled={submitting || !pasteContent.trim()}
                      >
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
                ),
              },
            ]}
          />
        </section>

        {/* Right Workbench Queue Panel */}
        <section data-account-import-queue-panel className={accountImportModalPanelClass + ' p-0 flex flex-col'} aria-label={t('accounts.import_account_queue')}>
          <header className={accountImportModalQueueHeaderClass}>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={queueItems.length > 0 && selectedIds.size === queueItems.length}
                indeterminate={selectedIds.size > 0 && selectedIds.size < queueItems.length}
                disabled={submitting || queueItems.length === 0}
                onChange={(e: any) => handleToggleSelectAll(e.target.checked)}
              >
                <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-secondary)]">
                  {t('accounts.import_account_select_all')} ({selectedIds.size}/{queueItems.length})
                </span>
              </Checkbox>
            </div>
            {queueItems.length > 0 && (
              <Button
                size="small"
                type="text"
                danger
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={handleClearAll}
                disabled={submitting}
              >
                {t('accounts.import_account_clear_all')}
              </Button>
            )}
          </header>

          <div className="flex-1 min-h-[30rem] flex flex-col justify-between">
            {queueItems.length === 0 ? (
              <div className={accountImportModalQueueEmptyClass}>
                {t('accounts.import_account_queue_empty')}
              </div>
            ) : (
              <AccountImportQueueList
                items={queueItems}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onRemove={handleRemoveItem}
                onUpdatePayload={handleUpdatePayload}
                submitting={submitting}
                t={t}
              />
            )}
          </div>
        </section>
      </div>
    </ModalFrame>
  );
}

function yieldAccountImportWork() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
