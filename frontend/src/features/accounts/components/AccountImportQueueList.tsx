import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT,
  resolveAccountImportPayloadPreview,
  resolveAccountImportQueueRenderWindow,
  type AccountImportPayloadItem,
} from '../model/accountTransfer';
import type { Translator } from '../model/types';

type AccountImportSource = 'file' | 'paste';

export interface AccountImportQueueItem {
  id: string;
  source: AccountImportSource;
  payload: AccountImportPayloadItem;
}

interface AccountImportQueueListProps {
  items: readonly AccountImportQueueItem[];
  submitting: boolean;
  t: Translator;
  onRemove: (id: string) => void;
}

export default function AccountImportQueueList({
  items,
  submitting,
  t,
  onRemove,
}: AccountImportQueueListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT * 4);
  const renderWindow = useMemo(
    () =>
      resolveAccountImportQueueRenderWindow({
        itemCount: items.length,
        scrollTop,
        viewportHeight,
      }),
    [items.length, scrollTop, viewportHeight],
  );
  const renderedItems = useMemo(
    () => items.slice(renderWindow.startIndex, renderWindow.endIndex),
    [items, renderWindow.endIndex, renderWindow.startIndex],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }

    function measure() {
      if (!viewport) {
        return;
      }
      setViewportHeight(viewport.clientHeight || ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT * 4);
      setScrollTop(viewport.scrollTop);
    }

    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={viewportRef}
      data-account-import-queue-viewport
      data-account-import-queue-window={`${renderWindow.startIndex}:${renderWindow.endIndex}`}
      className="max-h-[min(34rem,calc(100vh-18rem))] overflow-auto bg-[var(--bg-surface)] p-4"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="relative min-h-full" style={{ height: renderWindow.totalHeight }}>
        <div
          className="absolute inset-x-0 top-0 grid gap-3"
          style={{ transform: `translateY(${renderWindow.topOffset}px)` }}
        >
          {renderedItems.map((item, offset) => {
            const index = renderWindow.startIndex + offset;
            return (
              <div key={item.id} style={{ height: ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT - 12 }}>
                <div
                  data-account-card
                  data-account-import-queue-rendered-item
                  className="card-swiss relative flex h-full min-w-0 max-w-full flex-col overflow-hidden bg-[var(--bg-main)] p-0"
                >
                  <div className="grid shrink-0 gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-surface)] font-mono text-[length:var(--font-size-ui-xs)] font-black">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[length:var(--font-size-ui-sm)] font-black uppercase italic tracking-normal text-[var(--text-primary)]">
                          {resolveQueueItemTitle(item.payload)}
                        </div>
                        <div className="mt-1 flex min-w-0 flex-wrap gap-2">
                          <span className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                            {item.source === 'file' ? t('accounts.import_account_source_file') : t('accounts.import_account_source_paste')}
                          </span>
                          <span className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                            {resolveQueueItemKind(item.payload)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      disabled={submitting}
                      className="justify-self-end border-0 bg-transparent p-1 text-[var(--color-status-danger)] transition-transform active:scale-95 disabled:opacity-45"
                      aria-label={t('accounts.import_account_remove_item')}
                      title={t('accounts.import_account_remove_item')}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </div>
                  <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words border-0 bg-[var(--bg-surface)] px-4 py-3 font-mono text-[length:var(--font-size-ui-2xs)] leading-relaxed text-[var(--text-secondary)]">
                    {resolveAccountImportPayloadPreview(item.payload)}
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function resolveQueueItemKind(item: AccountImportPayloadItem) {
  if (item.type === 'upload-file' || item.type === 'auth-file') {
    return 'AUTH FILE';
  }
  if (item.type === 'codex-api-key') {
    return 'API KEY';
  }
  return 'PROVIDER';
}

function resolveQueueItemTitle(item: AccountImportPayloadItem) {
  if (item.type === 'upload-file' || item.type === 'auth-file') {
    return item.name;
  }
  if (item.type === 'codex-api-key') {
    return item.label || 'Codex API Key';
  }
  return item.name || 'OpenAI Compatible Provider';
}
