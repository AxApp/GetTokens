import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Tag, Tooltip, Input, Checkbox } from 'antd';
import { Trash2, Edit3, Check, X, AlertCircle } from 'lucide-react';
import {
  ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT,
  resolveAccountImportPayloadPreview,
  resolveAccountImportQueueRenderWindow,
  validateAccountImportPayloadItem,
  type AccountImportPayloadItem,
} from '../model/accountTransfer';
import type { Translator } from '../model/types';

type AccountImportSource = 'file' | 'paste' | 'clipboard';

export interface AccountImportQueueItem {
  id: string;
  source: AccountImportSource;
  payload: AccountImportPayloadItem;
}

interface AccountImportQueueListProps {
  items: readonly AccountImportQueueItem[];
  submitting: boolean;
  selectedIds: ReadonlySet<string>;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdatePayload: (id: string, newPayload: AccountImportPayloadItem) => void;
  t: Translator;
}

const accountImportQueueViewportClass =
  'max-h-[min(34rem,calc(100vh-18rem))] overflow-auto rounded-md bg-[var(--gt-surface-muted)] p-3';
const accountImportQueueCardClass = (hasError: boolean) =>
  `relative flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-md border bg-[var(--gt-surface-canvas)] transition-all ${
    hasError ? 'border-[var(--gt-status-danger)]' : 'border-[var(--gt-border-subtle)] hover:border-[var(--gt-primary)]'
  }`;
const accountImportQueueHeaderClass =
  'flex shrink-0 items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3';
const accountImportQueueIndexClass =
  'grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]';
const accountImportQueueTitleClass =
  'truncate text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const accountImportQueuePreviewClass =
  'min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-[var(--gt-surface-muted)] px-3 py-2 font-mono text-[length:var(--gt-font-size-2xs)] leading-relaxed text-[var(--gt-ink-secondary)]';

export default function AccountImportQueueList({
  items,
  submitting,
  selectedIds,
  onToggleSelect,
  onRemove,
  onUpdatePayload,
  t,
}: AccountImportQueueListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT * 4);
  const [editingId, setEditingId] = useState<string | null>(null);

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
            const isSelected = selectedIds.has(item.id);
            const isEditing = editingId === item.id;
            const validation = validateAccountImportPayloadItem(item.payload);
            const hasError = !validation.valid;

            return (
              <div key={item.id} className="h-[212px]">
                <div
                  data-account-card
                  data-account-import-queue-rendered-item
                  data-account-import-queue-card="quiet"
                  className={accountImportQueueCardClass(hasError)}
                >
                  {/* Card Header */}
                  <div className={accountImportQueueHeaderClass}>
                    <div className="flex min-w-0 items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        disabled={submitting || isEditing}
                        onChange={() => onToggleSelect(item.id)}
                      />
                      <span className={accountImportQueueIndexClass}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={accountImportQueueTitleClass}>
                            {resolveQueueItemTitle(item.payload)}
                          </span>
                          <Tag
                            color={item.source === 'file' ? 'default' : item.source === 'paste' ? 'purple' : 'blue'}
                            className="m-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-1.5 py-0 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]"
                          >
                            {item.source === 'file'
                              ? t('accounts.import_account_source_file')
                              : item.source === 'paste'
                              ? t('accounts.import_account_source_paste')
                              : t('import_account_source_clipboard')}
                          </Tag>
                          <Tag
                            color="blue"
                            className="m-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-1.5 py-0 font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]"
                          >
                            {resolveQueueItemKind(item.payload)}
                          </Tag>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasError && !isEditing && (
                        <Tooltip title={t('import_account_invalid_item').replace('{reason}', validation.error || '')}>
                          <AlertCircle className="h-4 w-4 text-[var(--gt-status-danger)]" />
                        </Tooltip>
                      )}
                      {!isEditing && (
                        <Tooltip title={t('import_account_edit_btn')}>
                          <Button
                            type="text"
                            size="small"
                            onClick={() => setEditingId(item.id)}
                            disabled={submitting}
                            icon={<Edit3 className="h-3.5 w-3.5" />}
                          />
                        </Tooltip>
                      )}
                      <Tooltip title={t('accounts.import_account_remove_item')}>
                        <Button
                          type="text"
                          size="small"
                          onClick={() => {
                            if (editingId === item.id) {
                              setEditingId(null);
                            }
                            onRemove(item.id);
                          }}
                          disabled={submitting}
                          danger
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        />
                      </Tooltip>
                    </div>
                  </div>

                  {/* Card Content: Edit Form vs Raw Preview */}
                  {isEditing ? (
                    <InlineEditForm
                      item={item}
                      onSave={(newPayload) => {
                        onUpdatePayload(item.id, newPayload);
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                      t={t}
                    />
                  ) : (
                    <>
                      {hasError && (
                        <div className="bg-[var(--gt-status-danger-bg)] px-3 py-1.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-danger)] border-b border-[var(--gt-status-danger-border)]">
                          {t('import_account_invalid_item').replace('{reason}', validation.error || '')}
                        </div>
                      )}
                      <pre data-account-import-queue-preview="quiet" className={accountImportQueuePreviewClass}>
                        {resolveAccountImportPayloadPreview(item.payload)}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Inline Edit Form Component to wrap inside 150px height content zone */
interface InlineEditFormProps {
  item: AccountImportQueueItem;
  onSave: (payload: AccountImportPayloadItem) => void;
  onCancel: () => void;
  t: Translator;
}

function InlineEditForm({ item, onSave, onCancel, t }: InlineEditFormProps) {
  const payload = item.payload;

  // Form states based on type
  const [name, setName] = useState(() => {
    if (payload.type === 'upload-file' || payload.type === 'auth-file') return payload.name;
    if (payload.type === 'codex-api-key') return payload.label;
    return payload.name;
  });
  const [baseUrl, setBaseUrl] = useState(() => {
    if (payload.type === 'codex-api-key' || payload.type === 'openai-compatible') return payload.baseUrl;
    return '';
  });

  const [apiKey, setApiKey] = useState(() => {
    if (payload.type === 'codex-api-key' || payload.type === 'openai-compatible') return payload.apiKey;
    return '';
  });

  const [prefix, setPrefix] = useState(() => {
    if (payload.type === 'codex-api-key' || payload.type === 'openai-compatible') return payload.prefix || '';
    return '';
  });

  const [proxyUrl, setProxyUrl] = useState(() => {
    if (payload.type === 'openai-compatible') return payload.proxyUrl || '';
    return '';
  });

  const [authJson, setAuthJson] = useState(() => {
    if (payload.type === 'auth-file') return payload.content;
    return '';
  });

  const handleSave = () => {
    let newPayload: AccountImportPayloadItem;

    if (payload.type === 'upload-file') {
      newPayload = {
        ...payload,
        name: name.trim(),
      };
    } else if (payload.type === 'auth-file') {
      newPayload = {
        ...payload,
        name: name.trim(),
        content: authJson.trim(),
      };
    } else if (payload.type === 'codex-api-key') {
      newPayload = {
        ...payload,
        label: name.trim(),
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        prefix: prefix.trim(),
      };
    } else {
      newPayload = {
        ...payload,
        name: name.trim(),
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        prefix: prefix.trim(),
        proxyUrl: proxyUrl.trim(),
      };
    }

    onSave(newPayload);
  };

  return (
    <div className="flex flex-1 flex-col justify-between bg-[var(--gt-surface-card)] p-3 text-[length:var(--gt-font-size-xs)] overflow-hidden">
      <div className="grid gap-2 overflow-y-auto pr-1">
        {payload.type === 'auth-file' && (
          <div className="grid gap-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="mb-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">File Name</div>
                <Input size="small" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Content (JSON)</div>
              <Input.TextArea
                size="small"
                rows={2}
                className="font-mono text-[length:var(--gt-font-size-2xs)]"
                value={authJson}
                onChange={(e) => setAuthJson(e.target.value)}
              />
            </div>
          </div>
        )}

        {payload.type === 'upload-file' && (
          <div>
            <div className="mb-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">File Name</div>
            <Input size="small" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        {(payload.type === 'codex-api-key' || payload.type === 'openai-compatible') && (
          <div className="grid gap-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="mb-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">DisplayName / Label</div>
                <Input size="small" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="w-24">
                <div className="mb-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Prefix</div>
                <Input size="small" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Base URL</div>
              <Input size="small" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="mb-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">API Key</div>
                <Input.Password size="small" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </div>
              {payload.type === 'openai-compatible' && (
                <div className="flex-1">
                  <div className="mb-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">Proxy URL</div>
                  <Input size="small" value={proxyUrl} placeholder="socks5://..." onChange={(e) => setProxyUrl(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-end gap-1.5 border-t border-[var(--gt-border-subtle)] pt-2 shrink-0">
        <Button size="small" onClick={onCancel} icon={<X className="h-3 w-3" />}>
          {t('import_account_edit_cancel')}
        </Button>
        <Button type="primary" size="small" onClick={handleSave} icon={<Check className="h-3 w-3" />}>
          {t('import_account_edit_save')}
        </Button>
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
