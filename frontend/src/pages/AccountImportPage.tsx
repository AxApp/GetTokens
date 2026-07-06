import { useMemo, useRef, useState, useEffect, type DragEvent } from 'react';
import { Button, Input, type InputRef, Upload, Tabs, Alert, Checkbox } from 'antd';
import { ArrowLeft, ClipboardPaste, FilePlus, Loader2, Upload as UploadIcon, CheckSquare, Trash2 } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useAccountsPageStateContext } from '../features/accounts/AccountsPageStateContext';
import AccountImportQueueList, { type AccountImportQueueItem } from '../features/accounts/components/AccountImportQueueList';
import { readAccountClipboardText } from '../features/accounts/model/accountClipboard';
import {
  parseAccountImportPayloads,
  readUploadFiles,
  validateAccountImportPayloadItem,
  type AccountImportPayloadItem,
} from '../features/accounts/model/accountTransfer';
import { toErrorMessage } from '../utils/error';

interface AccountImportPageProps {
  onDone: () => void;
}

type AccountImportSource = 'file' | 'paste' | 'clipboard';

const accountImportPageShellClass =
  'flex h-full flex-col overflow-hidden bg-[var(--gt-surface-muted)]';
const accountImportHeaderClass =
  'flex shrink-0 items-center justify-between border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-6 py-4';
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
  'grid gap-5 p-6 lg:grid-cols-[380px_1fr] lg:items-start';
const accountImportPanelClass =
  'grid min-w-0 gap-4 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4';
const accountImportDropzoneClass = (active: boolean) =>
  `w-full grid min-h-40 place-items-center rounded border px-5 py-6 text-center transition-[background-color,border-color] disabled:opacity-45 ${
    active
      ? 'border-[var(--gt-ink-primary)] bg-[color-mix(in_srgb,var(--gt-ink-primary)_8%,var(--gt-surface-muted))]'
      : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]'
  }`;
const accountImportDropzoneTitleClass =
  'text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportDropzoneHintClass =
  'max-w-sm text-[length:var(--gt-font-size-xs)] font-normal leading-relaxed tracking-normal text-[var(--gt-ink-muted)]';
const accountImportQueueHeaderClass =
  'flex items-center justify-between border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3 shrink-0';
const accountImportQueueEmptyClass =
  'px-4 py-8 text-center text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const accountImportFooterClass =
  'flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-6 py-4';
const accountImportSummaryClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';

export default function AccountImportPage({ onDone }: AccountImportPageProps) {
  const { t } = useI18n();
  const { submitAccountImport } = useAccountsPageStateContext();
  const pasteInputRef = useRef<InputRef | null>(null);
  const nextIDRef = useRef(0);

  const [queueItems, setQueueItems] = useState<AccountImportQueueItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pasteContent, setPasteContent] = useState('');
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
        if (trimmed) {
          // Try parse to see if it is valid
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
  }, []);

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
    if (!files?.length) return;
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
        // Auto select newly added items
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

  function handleFileDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = readingFiles || submitting ? 'none' : 'copy';
    if (!readingFiles && !submitting) {
      setIsFileDragOver(true);
    }
  }

  function handleFileDragLeave() {
    setIsFileDragOver(false);
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
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
        pasteInputRef.current?.focus();
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

    // Double check validity before final submission
    const invalidItems = selectedItems.filter((item) => !validateAccountImportPayloadItem(item.payload).valid);
    if (invalidItems.length > 0) {
      setError(t('import_account_invalid_item').replace('{reason}', 'Please fix fields in editing cards first'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await submitAccountImport(selectedItems.map((item) => item.payload));
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
          <Button
            size="small"
            onClick={onDone}
            disabled={submitting}
            className="inline-flex min-h-10 items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Back to accounts"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={3} />
            {t('common.back')}
          </Button>
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
          <span className={accountImportMetaChipClass}>AUTO DETECT</span>
          <span className={accountImportMetaChipClass}>JSON ARRAY</span>
        </div>
      </div>

      {/* Smart Clipboard Notification */}
      {clipboardContent && (
        <div className="shrink-0">
          <Alert
            type="info"
            showIcon
            message={
              <div className="flex items-center justify-between gap-4">
                <span className="text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-primary)]">
                  {t('import_account_clipboard_banner')}
                </span>
                <Button
                  type="primary"
                  size="small"
                  onClick={handleImportFromClipboard}
                  icon={<ClipboardPaste className="h-3.5 w-3.5" />}
                >
                  {t('import_account_clipboard_action')}
                </Button>
              </div>
            }
            closable
            onClose={() => setClipboardContent(null)}
            className="rounded-none border-x-0 border-t-0 border-b border-[var(--gt-border-focus)] bg-[var(--gt-primary-bg)] px-6"
          />
        </div>
      )}

      {/* Error bar */}
      {error && <div className={accountImportErrorClass}>{error}</div>}

      {/* Main layout */}
      <div className={accountImportMainClass}>
        <div className={accountImportGridClass}>
          {/* Left panel: unified input with tabs */}
          <section data-account-import-input-panel className={accountImportPanelClass}>
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
                          size="small"
                          data-account-import-dropzone
                          onDragEnter={handleFileDragOver}
                          onDragOver={handleFileDragOver}
                          onDragLeave={handleFileDragLeave}
                          onDrop={handleFileDrop}
                          disabled={readingFiles || submitting}
                          className={accountImportDropzoneClass(isFileDragOver)}
                        >
                          <span className="grid justify-items-center gap-3">
                            {readingFiles ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <UploadIcon className="h-5 w-5" strokeWidth={3} />
                            )}
                            <span className={accountImportDropzoneTitleClass}>
                              {t('accounts.import_account_choose_files')}
                            </span>
                            <span className={accountImportDropzoneHintClass}>
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
                        ref={pasteInputRef}
                        value={pasteContent}
                        onChange={(event) => {
                          setPasteContent(event.target.value);
                          setError('');
                        }}
                        size="small"
                        rows={6}
                        className="w-full resize-none font-mono text-[length:var(--gt-font-size-xs)]"
                        placeholder={t('accounts.import_account_paste_placeholder')}
                        spellCheck={false}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="primary"
                          size="small"
                          onClick={handleAddPaste}
                          disabled={submitting || !pasteContent.trim()}
                        >
                          {t('accounts.import_account_add_paste')}
                        </Button>
                        <Button
                          size="small"
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

          {/* Right panel: candidate queue workbench */}
          <section data-account-import-queue-panel className={accountImportPanelClass + ' p-0 flex flex-col'} aria-label={t('accounts.import_account_queue')}>
            <header className={accountImportQueueHeaderClass}>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={queueItems.length > 0 && selectedIds.size === queueItems.length}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < queueItems.length}
                  disabled={submitting || queueItems.length === 0}
                  onChange={(e: any) => handleToggleSelectAll(e.target.checked)}
                >
                  <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-secondary)]">
                    {t('import_account_select_all')} ({selectedIds.size}/{queueItems.length})
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
                  {t('import_account_clear_all')}
                </Button>
              )}
            </header>

            <div className="flex-1 min-h-[30rem] flex flex-col justify-between">
              {queueItems.length === 0 ? (
                <div className={accountImportQueueEmptyClass}>
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
      </div>

      {/* Footer */}
      <div className={accountImportFooterClass}>
        <div className={accountImportSummaryClass}>
          {selectedIds.size === 0
            ? t('accounts.import_account_queue_empty')
            : t('import_account_selected_summary')
                .replace('{selected}', String(selectedIds.size))
                .replace('{total}', String(queueItems.length))
                .replace('{authFiles}', String(selectedSummary.authFiles))
                .replace('{apiKeys}', String(selectedSummary.apiKeys))
                .replace('{providers}', String(selectedSummary.providers))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" onClick={onDone} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            size="small"
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
      </div>
    </div>
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
  return { id: `${source}-${nextIDRef.current}`, source, payload };
}
