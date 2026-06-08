import { useMemo, useRef, useState } from 'react';
import { ClipboardPaste, FilePlus, Loader2, Upload } from 'lucide-react';
import ModalFrame from '../../../components/ui/ModalFrame';
import { toErrorMessage } from '../../../utils/error';
import {
  parseAccountImportPayloads,
  readUploadFiles,
  type AccountImportPayloadItem,
} from '../model/accountTransfer';
import type { TextInputEvent, Translator } from '../model/types';
import AccountImportQueueList, { type AccountImportQueueItem } from './AccountImportQueueList';

type AccountImportSource = 'file' | 'paste';

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nextIDRef = useRef(0);
  const [queueItems, setQueueItems] = useState<AccountImportQueueItem[]>(() =>
    initialItems.map((payload) => createQueueItem(nextIDRef, 'paste', payload))
  );
  const [pasteContent, setPasteContent] = useState(initialPasteContent);
  const [error, setError] = useState('');
  const [readingFiles, setReadingFiles] = useState(false);
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('accounts.import_account_eyebrow')}
            </div>
            <h3 className="mt-1 text-lg font-black uppercase italic tracking-normal text-[var(--text-primary)]">
              {t('accounts.import_account_title')}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
              AUTO DETECT
            </span>
            <span className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
              JSON ARRAY
            </span>
          </div>
        </div>
      }
      error={
        error ? (
          <div className="border-t-2 border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] px-6 py-4 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--color-status-danger)]">
            {error}
          </div>
        ) : undefined
      }
      footer={
        <>
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {formatQueueSummary(t, queueItems.length, queueSummary)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} disabled={submitting} className="btn-swiss">
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || queueItems.length === 0}
              className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] disabled:opacity-45"
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
        </>
      }
    >
      <div className="grid gap-5 p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
        <section
          data-account-import-input-panel
          className="grid min-w-0 gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 shadow-[4px_4px_0_var(--shadow-color)]"
        >
          <div className="grid gap-3 border-b-2 border-dashed border-[var(--border-color)] pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FilePlus className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={3} />
                <h4 className="truncate text-[length:var(--font-size-ui-sm)] font-black uppercase italic tracking-normal text-[var(--text-primary)]">
                  {t('accounts.import_account_files')}
                </h4>
              </div>
              <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                MULTI
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                void handleAddFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={readingFiles || submitting}
              className="grid min-h-36 place-items-center border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-6 text-center transition-[background-color,transform] active:scale-[0.99] disabled:opacity-45"
            >
              <span className="grid justify-items-center gap-3">
                {readingFiles ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" strokeWidth={3} />}
                <span className="text-sm font-black uppercase italic tracking-normal text-[var(--text-primary)]">
                  {t('accounts.import_account_choose_files')}
                </span>
                <span className="max-w-sm text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {t('accounts.import_account_files_hint')}
                </span>
              </span>
            </button>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ClipboardPaste className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={3} />
                <h4 className="truncate text-[length:var(--font-size-ui-sm)] font-black uppercase italic tracking-normal text-[var(--text-primary)]">
                  {t('accounts.import_account_paste')}
                </h4>
              </div>
              <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                JSON
              </span>
            </div>
            <textarea
              value={pasteContent}
              onChange={(event: TextInputEvent) => {
                setPasteContent(event.target.value);
                setError('');
              }}
              className="input-swiss min-h-36 w-full resize-y font-mono text-xs"
              placeholder={t('accounts.import_account_paste_placeholder')}
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleAddPaste} disabled={submitting} className="btn-swiss">
                {t('accounts.import_account_add_paste')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasteContent('');
                  setError('');
                }}
                disabled={submitting || pasteContent.length === 0}
                className="btn-swiss"
              >
                {t('accounts.import_account_clear_paste')}
              </button>
            </div>
          </div>
        </section>

        <section className="grid min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
          <header className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase italic tracking-normal text-[var(--text-primary)]">
              {t('accounts.import_account_queue')}
            </div>
            <div className="mt-1 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {t('accounts.import_account_queue_hint')}
            </div>
          </header>
          {queueItems.length === 0 ? (
            <div className="border-0 px-4 py-8 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase italic tracking-normal text-[var(--text-muted)]">
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
