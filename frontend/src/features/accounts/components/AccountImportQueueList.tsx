import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Tag, Tooltip } from 'antd';
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

const accountImportQueueViewportClass =
  'max-h-[min(34rem,calc(100vh-18rem))] overflow-auto rounded-md bg-[var(--gt-surface-muted)] p-3';
const accountImportQueueCardClass =
  'relative flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const accountImportQueueHeaderClass =
  'grid shrink-0 gap-3 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start';
const accountImportQueueIndexClass =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]';
const accountImportQueueTitleClass =
  'truncate text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportQueuePreviewClass =
  'min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-[var(--gt-surface-muted)] px-4 py-3 font-mono text-[length:var(--gt-font-size-2xs)] leading-relaxed text-[var(--gt-ink-secondary)]';

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
      className={accountImportQueueViewportClass}
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
              <div key={item.id} className="h-[212px]">
                <div
                  data-account-card
                  data-account-import-queue-rendered-item
                  data-account-import-queue-card="quiet"
                  className={accountImportQueueCardClass}
                >
                  <div className={accountImportQueueHeaderClass}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={accountImportQueueIndexClass}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className={accountImportQueueTitleClass}>
                          {resolveQueueItemTitle(item.payload)}
                        </div>
                        <div className="mt-1 flex min-w-0 flex-wrap gap-2">
                          <Tag
                            color="default"
                            className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]"
                          >
                            {item.source === 'file' ? t('accounts.import_account_source_file') : t('accounts.import_account_source_paste')}
                          </Tag>
                          <Tag
                            color="blue"
                            className="rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-primary)]"
                          >
                            {resolveQueueItemKind(item.payload)}
                          </Tag>
                        </div>
                      </div>
                    </div>
                    <Tooltip title={t('accounts.import_account_remove_item')}>
                      <Button
                        type="text"
                        size="small"
                        onClick={() => onRemove(item.id)}
                        disabled={submitting}
                        aria-label={t('accounts.import_account_remove_item')}
                        icon={<Trash2 className="h-4 w-4" strokeWidth={2.5} />}
                      />
                    </Tooltip>
                  </div>
                  <pre data-account-import-queue-preview="quiet" className={accountImportQueuePreviewClass}>
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
