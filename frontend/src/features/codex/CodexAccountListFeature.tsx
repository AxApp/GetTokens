import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import { type DragEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ListAccounts,
  ListOpenAICompatibleProviders,
  SetAccountDisabled,
  UpdateAccountPriority,
  UpdateOpenAICompatibleProvider,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import type { SidecarStatus } from '../../types';
import { toErrorMessage } from '../../utils/error';
import { buildCodexDetailFrameHash, clearCodexDetailFrameHash, readFrameHashState } from '../../utils/pagePersistence';
import { hasWailsAppBindings } from '../../utils/previewMode';
import { mapBackendAccountRecord } from '../accounts/model/accountPresentation';
import { getCodexAccountListPreviewRows } from './previewData';
import {
  applyCodexAccountPriorities,
  buildCodexAccountPriorityUpdates,
  buildCodexAccountRows,
  buildCodexAccountSummary,
  buildOpenAICompatibleModelMappings,
  normalizeCodexModelMappingsForProvider,
  reorderCodexAccountRows,
  type CodexAccountRow,
  type CodexModelMappingRow,
  type CodexAccountSourceKind,
} from './model/codexAccountList';

interface CodexAccountListFeatureProps {
  sidecarStatus: SidecarStatus;
}

export default function CodexAccountListFeature({ sidecarStatus }: CodexAccountListFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const browserMode = !hasWailsAppBindings();
  const ready = browserMode || sidecarStatus?.code === 'ready';
  const [orderedRows, setOrderedRows] = useState<CodexAccountRow[]>([]);
  const [draggedID, setDraggedID] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingToggleID, setPendingToggleID] = useState<string | null>(null);
  const [pendingMappingID, setPendingMappingID] = useState<string | null>(null);
  const [detailRowID, setDetailRowID] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const suppressNextDetailClickRef = useRef(false);

  const summary = useMemo(() => buildCodexAccountSummary(orderedRows), [orderedRows]);
  const priorityUpdates = useMemo(() => buildCodexAccountPriorityUpdates(orderedRows), [orderedRows]);
  const detailRow = useMemo(
    () => orderedRows.find((row) => row.id === detailRowID) || null,
    [detailRowID, orderedRows],
  );
  const orderChanged = priorityUpdates.length > 0;

  async function reload(messageOverride?: string) {
    if (browserMode) {
      setOrderedRows(getCodexAccountListPreviewRows());
      setMessage(messageOverride || t('codex.account_list_preview_loaded'));
      return;
    }

    if (!ready) {
      setOrderedRows([]);
      setMessage(t('codex.account_list_waiting_ready'));
      return;
    }

    setLoading(true);
    try {
      const [accountResponse, providerResponse] = await Promise.all([
        trackRequest('ListAccounts', { args: [] }, () => ListAccounts()),
        trackRequest('ListOpenAICompatibleProviders', { args: [] }, () => ListOpenAICompatibleProviders()),
      ]);
      const accountRows = (accountResponse || []).map((account) => mapBackendAccountRecord(account));
      const nextProviders = providerResponse || [];
      const nextRows = buildCodexAccountRows({
        accounts: accountRows,
        providers: nextProviders,
      });
      setOrderedRows(nextRows);
      setMessage(messageOverride || t('codex.account_list_loaded'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_load_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [browserMode, ready]);

  function handleDragStart(id: string) {
    setDraggedID(id);
    suppressNextDetailClickRef.current = false;
  }

  function handleDragEnter(targetID: string) {
    if (!draggedID) {
      return;
    }
    if (draggedID === targetID) {
      return;
    }
    suppressNextDetailClickRef.current = true;
    setOrderedRows((prev) => reorderCodexAccountRows(prev, draggedID, targetID));
    setMessage(t('codex.account_list_unsaved'));
  }

  function handleDrop() {
    suppressNextDetailClickRef.current = true;
    setDraggedID(null);
  }

  function handleDragEnd() {
    setDraggedID(null);
    window.setTimeout(() => {
      suppressNextDetailClickRef.current = false;
    }, 100);
  }

  function openDetail(rowID: string) {
    if (suppressNextDetailClickRef.current) {
      suppressNextDetailClickRef.current = false;
      return;
    }
    setDetailRowID(rowID);
    markCodexDetailInHash(rowID);
  }

  function closeDetail() {
    setDetailRowID(null);
    clearCodexDetailInHash();
  }

  function markCodexDetailInHash(rowID: string) {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = buildCodexDetailFrameHash(window.location.hash, rowID);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function clearCodexDetailInHash() {
    if (typeof window === 'undefined') {
      return;
    }
    const nextHash = clearCodexDetailFrameHash(window.location.hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncDetailFromHash = () => {
      const hashState = readFrameHashState(window.location.hash);
      if (hashState?.page === 'codex' && hashState.codexWorkspace === 'account-list' && hashState.accountDetailID) {
        setDetailRowID(hashState.accountDetailID);
        return;
      }
      setDetailRowID(null);
    };

    syncDetailFromHash();
    window.addEventListener('hashchange', syncDetailFromHash);
    return () => {
      window.removeEventListener('hashchange', syncDetailFromHash);
    };
  }, []);

  async function saveOrder() {
    if (!ready || !orderChanged) {
      return;
    }

    if (browserMode) {
      setOrderedRows((prev) => applyCodexAccountPriorities(prev));
      setMessage(t('codex.account_list_preview_saved'));
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      for (const update of priorityUpdates) {
        await trackRequest('UpdateAccountPriority', update, () => UpdateAccountPriority(update));
      }
      await reload(t('codex.account_list_saved'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_save_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccount(row: CodexAccountRow) {
    if (!ready) {
      return;
    }

    if (browserMode) {
      setOrderedRows((prev) =>
        prev.map((item) => {
          if (item.id !== row.id) {
            return item;
          }
          const disabled = !item.disabled;
          const status = disabled ? 'disabled' : item.status === 'disabled' ? 'configured' : item.status;
          const requestable = !disabled && ['ACTIVE', 'CONFIGURED', 'LOCAL'].includes(status.trim().toUpperCase());
          return {
            ...item,
            disabled,
            requestable,
            blockReason: requestable ? '' : disabled ? 'disabled' : item.blockReason || status,
            status,
          };
        }),
      );
      setMessage(t('codex.account_list_preview_status_updated'));
      return;
    }

    setPendingToggleID(row.id);
    setMessage('');
    try {
      await trackRequest('SetAccountDisabled', { id: row.id, disabled: !row.disabled }, () =>
        SetAccountDisabled(row.id, !row.disabled)
      );
      await reload(row.disabled ? t('codex.account_list_enabled') : t('codex.account_list_disabled'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_status_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setPendingToggleID(null);
    }
  }

  async function saveModelMappings(row: CodexAccountRow, mappings: CodexModelMappingRow[]) {
    if (row.sourceKind !== 'openai-compatible') {
      return;
    }

    const normalizedModels = normalizeCodexModelMappingsForProvider(mappings);
    if (browserMode) {
      setOrderedRows((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                modelMappings: buildOpenAICompatibleModelMappings({ models: normalizedModels }),
              }
            : item,
        ),
      );
      setMessage(t('codex.account_list_model_mapping_saved'));
      return;
    }

    setPendingMappingID(row.id);
    try {
      await trackRequest('UpdateOpenAICompatibleProvider', { id: row.id, models: normalizedModels }, () =>
        UpdateOpenAICompatibleProvider(
          main.UpdateOpenAICompatibleProviderInput.createFrom({
            currentName: row.provider,
            name: row.provider,
            baseUrl: row.baseUrl,
            prefix: row.prefix,
            apiKey: row.apiKey || row.apiKeys?.[0] || '',
            apiKeys: row.apiKeys && row.apiKeys.length > 0 ? row.apiKeys : row.apiKey ? [row.apiKey] : [],
            headers: row.headers || {},
            models: normalizedModels,
          }),
        ),
      );
      await reload(t('codex.account_list_model_mapping_saved'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex.account_list_model_mapping_save_failed')}: ${toErrorMessage(error)}`);
      throw error;
    } finally {
      setPendingMappingID(null);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  return (
    <div className="h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_ACCOUNT_LIST">
      <div className="w-full space-y-8">
        <WorkspacePageHeader
          title={t('codex.account_list_title')}
          subtitle={t('codex.account_list_subtitle')}
          align="center"
        />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label={t('codex.account_list_total')} value={summary.total} />
          <Metric label={t('codex.account_list_requestable')} value={summary.requestable} />
          <Metric label={t('codex.account_list_blocked')} value={summary.blocked} />
          <Metric label={t('codex.account_list_openai_compatible')} value={summary.openAICompatible} />
        </section>

        <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
          <header className="flex flex-col gap-4 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {t('codex.account_list_order')}
              </h2>
              <p className="mt-1 text-[0.625rem] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {browserMode
                  ? t('codex.account_list_browser_hint')
                  : ready
                    ? t('codex.account_list_order_hint')
                    : t('codex.account_list_waiting_ready')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void reload()}
                disabled={!ready || loading || saving}
                className="btn-swiss !px-3 !py-2 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('common.refresh')}
              </button>
              <button
                type="button"
                onClick={() => void saveOrder()}
                disabled={!ready || saving || !orderChanged}
                className="btn-swiss bg-[var(--text-primary)] !px-3 !py-2 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t('codex.account_list_saving') : t('codex.account_list_save_order')}
              </button>
            </div>
          </header>

          {message ? (
            <div className="border-b-2 border-[var(--border-color)] px-5 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
              {message}
            </div>
          ) : null}

          {!ready ? (
            <EmptyState>{t('codex.account_list_waiting_ready')}</EmptyState>
          ) : loading && orderedRows.length === 0 ? (
            <EmptyState>{t('common.loading')}</EmptyState>
          ) : orderedRows.length === 0 ? (
            <EmptyState>{t('codex.account_list_empty')}</EmptyState>
          ) : (
            <div className="divide-y-2 divide-[var(--border-color)]">
              {orderedRows.map((row, index) => (
                <AccountOrderRow
                  key={row.id}
                  row={row}
                  index={index}
                  dragged={draggedID === row.id}
                  pending={pendingToggleID === row.id}
                  t={t}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  onOpenDetail={() => openDetail(row.id)}
                  onToggle={() => void toggleAccount(row)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      {detailRow ? (
        <CodexAccountDetailModal
          row={detailRow}
          t={t}
          savingMappings={pendingMappingID === detailRow.id}
          onClose={closeDetail}
          onSaveModelMappings={(mappings) => saveModelMappings(detailRow, mappings)}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 shadow-[4px_4px_0_var(--shadow-color)]">
      <div className="text-2xl font-black italic tracking-tighter text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="p-14 text-center text-[0.75rem] font-black uppercase italic tracking-widest text-[var(--text-muted)]">
      {children}
    </div>
  );
}

function AccountOrderRow({
  row,
  index,
  dragged,
  pending,
  t,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragEnd,
  onDrop,
  onOpenDetail,
  onToggle,
}: {
  row: CodexAccountRow;
  index: number;
  dragged: boolean;
  pending: boolean;
  t: (key: string) => string;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onOpenDetail: () => void;
  onToggle: () => void;
}) {
  const endpointLabel = buildEndpointLabel(row);
  const blockedLabel = row.blockReason === 'disabled' ? t('codex.account_list_block_disabled') : row.blockReason;

  function handleDragHandleClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <article
      onDragOver={onDragOver}
      onDragEnter={() => onDragEnter(row.id)}
      onDrop={onDrop}
      onClick={onOpenDetail}
      className={`group relative grid cursor-pointer grid-cols-[3.625rem_minmax(0,1fr)_4rem] items-center gap-3 border-l-4 bg-[var(--bg-main)] px-3 py-3 transition-all ${
        row.requestable ? 'border-l-green-600' : 'border-l-[var(--accent-red)]'
      } ${
        dragged ? 'opacity-40 grayscale' : 'hover:bg-[var(--bg-surface)]'
      }`}
    >
      <div
        draggable
        onClick={handleDragHandleClick}
        onDragStart={() => onDragStart(row.id)}
        onDragEnd={onDragEnd}
        className="flex cursor-grab items-center justify-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] transition-colors active:cursor-grabbing group-hover:bg-[var(--bg-surface)]"
        title={t('accounts.rotation_drag_badge')}
      >
        <div className="flex items-center justify-center gap-1 px-2 py-2">
          <div
            className="flex items-center text-[var(--text-muted)] opacity-55 transition-opacity group-hover:opacity-100"
            title={t('accounts.rotation_drag_badge')}
          >
            <GripVertical className="h-4 w-4" strokeWidth={3} />
          </div>
          <div className="text-xl font-black leading-none text-[var(--text-primary)]">
            {String(index + 1).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="min-w-0 self-center">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(12rem,0.9fr)] md:items-center">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="max-w-full truncate text-[0.9375rem] font-black leading-tight text-[var(--text-primary)]">
                {row.label}
              </span>
              <span className="shrink-0 border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {sourceKindLabel(t, row.sourceKind)}
              </span>
            </div>
            {!row.requestable ? (
              <div className="mt-2 border-l-2 border-[var(--accent-red)] pl-2 text-[0.625rem] font-black uppercase tracking-wide text-[var(--accent-red)]">
                {blockedLabel}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 border-l-2 border-[var(--border-color)] pl-3">
            <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {t('codex.account_list_route')}
            </div>
            <div className="mt-1 break-all font-mono text-[0.6875rem] font-bold leading-snug text-[var(--text-primary)]">
              {endpointLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <ToggleSwitch
          checked={!row.disabled}
          disabled={pending}
          label={row.disabled ? t('common.enable') : t('common.disable')}
          stopPropagation
          onChange={onToggle}
        />
      </div>
    </article>
  );
}

function CodexAccountDetailModal({
  row,
  t,
  savingMappings,
  onClose,
  onSaveModelMappings,
}: {
  row: CodexAccountRow;
  t: (key: string) => string;
  savingMappings: boolean;
  onClose: () => void;
  onSaveModelMappings: (mappings: CodexModelMappingRow[]) => Promise<void>;
}) {
  const endpointLabel = buildEndpointLabel(row);
  const blockedLabel = row.blockReason === 'disabled' ? t('codex.account_list_block_disabled') : row.blockReason;
  const [mappingDraft, setMappingDraft] = useState<CodexModelMappingRow[]>(() => buildEditableModelMappings(row));
  const [mappingError, setMappingError] = useState('');
  const detailFields: Array<[string, string]> = [
    [t('common.type'), sourceKindLabel(t, row.sourceKind)],
    [t('common.status'), row.status || '—'],
    [t('codex.account_list_route'), endpointLabel || '—'],
    [t('codex.account_list_priority'), row.priority === undefined ? '—' : String(row.priority)],
    [
      t('codex.account_list_request_state'),
      row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked'),
    ],
    [t('common.enable'), row.disabled ? t('common.no') : t('common.yes')],
  ];

  useEffect(() => {
    setMappingDraft(buildEditableModelMappings(row));
    setMappingError('');
  }, [row.id, row.modelMappings]);

  function updateMappingDraft(index: number, patch: Partial<CodexModelMappingRow>) {
    setMappingDraft((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addMappingDraft() {
    setMappingDraft((prev) => [...prev, { realModel: '', codexModel: '' }]);
  }

  function removeMappingDraft(index: number) {
    setMappingDraft((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [{ realModel: '', codexModel: '' }];
    });
  }

  async function saveMappingDraft() {
    try {
      setMappingError('');
      await onSaveModelMappings(mappingDraft);
    } catch (error) {
      setMappingError(toErrorMessage(error));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      data-collaboration-id="MODAL_CODEX_ACCOUNT_DETAIL"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-[var(--border-color)] px-6 py-5">
          <div className="min-w-0 space-y-2">
            <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('codex.account_list_detail_title')}
            </div>
            <h3 className="truncate text-lg font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {row.label}
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="border border-[var(--border-color)] px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {sourceKindLabel(t, row.sourceKind)}
              </span>
              <span
                className={`border px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.16em] ${
                  row.requestable
                    ? 'border-green-600 bg-green-600/10 text-green-700'
                    : 'border-[var(--accent-red)] bg-red-500/10 text-[var(--accent-red)]'
                }`}
              >
                {row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked')}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]" aria-label={t('common.close')}>
            <X className="h-4 w-4" strokeWidth={4} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          <section className="grid gap-4 border-b-2 border-dashed border-[var(--border-color)] pb-6 md:grid-cols-3">
            {detailFields.map(([label, value]) => (
              <div key={label} className="min-w-0 space-y-1">
                <div className="text-[0.5625rem] font-black uppercase italic text-[var(--text-muted)]">{label}</div>
                <div className="break-all text-[0.6875rem] font-black uppercase text-[var(--text-primary)]">{value}</div>
              </div>
            ))}
          </section>

          {!row.requestable ? (
            <section className="mt-6 border-2 border-[var(--accent-red)] bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--accent-red)]">
              {blockedLabel}
            </section>
          ) : null}

          <section className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-[0.75rem] font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {t('codex.account_list_model_mapping')}
              </h4>
              {row.sourceKind === 'openai-compatible' ? (
                <span className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {row.modelMappings.length}
                </span>
              ) : null}
            </div>

            {row.sourceKind === 'openai-compatible' ? (
              mappingDraft.length > 0 ? (
                <div className="overflow-hidden border-2 border-[var(--border-color)]">
                  <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <span>{t('codex.account_list_real_model')}</span>
                    <span className="text-center">-&gt;</span>
                    <span className="text-right">{t('codex.account_list_codex_model')}</span>
                    <span />
                  </div>
                  <div className="divide-y divide-[var(--border-color)]">
                    {mappingDraft.map((mapping, index) => (
                      <div
                        key={`mapping-${index}`}
                        className="grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 px-3 py-2 text-[0.625rem] font-bold text-[var(--text-primary)]"
                      >
                        <input
                          value={mapping.realModel}
                          onChange={(event) => updateMappingDraft(index, { realModel: event.target.value })}
                          className="input-swiss min-w-0 !px-2 !py-1.5 !text-[0.625rem]"
                          placeholder="deepseek-chat"
                        />
                        <span className="text-center font-black text-[var(--text-muted)]">-&gt;</span>
                        <input
                          value={mapping.codexModel}
                          onChange={(event) => updateMappingDraft(index, { codexModel: event.target.value })}
                          className="input-swiss min-w-0 text-right !px-2 !py-1.5 !text-[0.625rem]"
                          placeholder={mapping.realModel || 'codex-deepseek'}
                        />
                        <button
                          type="button"
                          onClick={() => removeMappingDraft(index)}
                          className="btn-swiss !p-1.5 !shadow-none hover:bg-[var(--bg-surface)]"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-[var(--border-color)] px-4 py-6 text-center text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  {t('codex.account_list_no_model_mapping')}
                </div>
              )
            ) : (
              <div className="border-2 border-dashed border-[var(--border-color)] px-4 py-6 text-center text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {t('codex.account_list_default_model_mapping')}
              </div>
            )}

            {row.sourceKind === 'openai-compatible' ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={addMappingDraft}
                  className="btn-swiss inline-flex items-center gap-2 !py-1.5 !text-[0.5625rem]"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={4} />
                  {t('accounts.openai_provider_add_model')}
                </button>
                <button
                  type="button"
                  onClick={() => void saveMappingDraft()}
                  disabled={savingMappings}
                  className="btn-swiss bg-[var(--text-primary)] !py-1.5 !text-[0.5625rem] !text-[var(--bg-main)] disabled:cursor-wait disabled:opacity-50"
                >
                  {savingMappings ? t('codex.account_list_saving') : t('common.save')}
                </button>
                {mappingError ? (
                  <div className="basis-full border-l-2 border-[var(--accent-red)] pl-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--accent-red)]">
                    {mappingError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function sourceKindLabel(t: (key: string) => string, sourceKind: CodexAccountSourceKind) {
  if (sourceKind === 'codex-auth-file') {
    return t('codex.account_list_source_auth_file');
  }
  if (sourceKind === 'codex-api-key') {
    return t('codex.account_list_source_api_key');
  }
  return t('codex.account_list_source_openai_compatible');
}

function buildEditableModelMappings(row: Pick<CodexAccountRow, 'sourceKind' | 'modelMappings'>): CodexModelMappingRow[] {
  if (row.sourceKind !== 'openai-compatible') {
    return [];
  }
  return row.modelMappings.length > 0
    ? row.modelMappings.map((mapping) => ({ ...mapping }))
    : [{ realModel: '', codexModel: '' }];
}

function buildEndpointLabel(row: Pick<CodexAccountRow, 'baseUrl' | 'provider' | 'prefix' | 'keySuffix'>) {
  return [
    row.baseUrl || row.provider,
    row.prefix,
    row.keySuffix ? `****${row.keySuffix}` : '',
  ].filter(Boolean).join(' / ');
}
