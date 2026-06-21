import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
} from '../model/codexFeatureConfig';
import { groupCodexFeatureRows } from '../model/codexFeatureConfig';
import { renderCodexValueEditor } from '../model/codexValueEditor';

function resolveCodexNoticeDescription(t: (key: string) => string, row: CodexFeatureRow) {
  const translationKey = `status.codex_notice_descriptions.${row.key}`;
  const translated = t(translationKey);
  if (translated !== translationKey) {
    return translated;
  }
  return row.description || t('status.codex_notices_no_description');
}

const codexConfigSectionPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm';
const codexConfigSectionHeaderClass = 'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const codexConfigSectionGroupHeaderClass =
  'flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-2';
const codexConfigSectionChipClass =
  'inline-flex shrink-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-1 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-primary)]';
const codexConfigSectionRowChipClass =
  'inline-flex shrink-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]';
const codexConfigSectionSecondaryButtonClass =
  'inline-flex h-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';
const codexConfigSectionPrimaryButtonClass =
  'inline-flex h-8 items-center justify-center rounded border border-[var(--gt-border-strong)] bg-[var(--gt-ink-primary)] px-3 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-surface-canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

interface StatusCodexNoticeSectionProps {
  t: (key: string) => string;
  snapshot: CodexFeatureConfigSnapshot | null;
  rows: CodexFeatureRow[];
  preview: CodexFeaturePreview | null;
  message: string;
  dirtyCount: number;
  isLoading: boolean;
  isSaving: boolean;
  onReload: () => void;
  onChangeNotice: (key: string, value: unknown) => void;
  onRemoveNotice?: (key: string) => void;
  onPreview: () => void;
  onSave: () => void;
  onReset: () => void;
}

export default function StatusCodexNoticeSection({
  t,
  snapshot,
  rows,
  preview,
  message,
  dirtyCount,
  isLoading,
  isSaving,
  onReload,
  onChangeNotice,
  onRemoveNotice,
  onPreview,
  onSave,
  onReset,
}: StatusCodexNoticeSectionProps) {
  const isBusy = isLoading || isSaving;
  const groupedRows = groupCodexFeatureRows(rows);

  function resolveGroupTitle(groupId: string) {
    const translationKey = `status.codex_notices_group_${groupId}`;
    const translated = t(translationKey);
    return translated !== translationKey ? translated : groupId;
  }

  return (
    <section className={`${codexConfigSectionPanelClass} relative overflow-hidden`}>
      <div className={`${codexConfigSectionHeaderClass} grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start`}>
        <div className="min-w-0">
          <div className="text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]">
            {t('status.codex_notices_title')}
          </div>
          <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-muted)]">
            {snapshot?.configPath || t('status.codex_notices_unavailable')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className={codexConfigSectionChipClass}>
            {rows.length} {t('status.codex_notices_visible')}
          </div>
          <div className={codexConfigSectionChipClass}>
            {dirtyCount} {t('status.codex_notices_changed')}
          </div>
          <button
            type="button"
            onClick={onReload}
            disabled={isBusy}
            className={codexConfigSectionSecondaryButtonClass}
          >
            {isLoading ? t('status.codex_notices_loading') : t('common.refresh')}
          </button>
        </div>
      </div>

      {message ? (
        <div className="border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-primary)]">
          {message}
        </div>
      ) : null}

      <div>
        {groupedRows.map((group, groupIndex) => (
          <div key={group.id} className={`${groupIndex > 0 ? 'border-t border-[var(--gt-border-subtle)]' : ''}`}>
            <div className={codexConfigSectionGroupHeaderClass}>
              <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                {resolveGroupTitle(group.id)}
              </div>
              <div className="text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]">
                {group.rows.length} {t('design_system.items')}
              </div>
            </div>
            <div className="divide-y divide-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]">
              {group.rows.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_5rem] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="break-all font-mono text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
                      {row.key}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-muted)]">
                      <span className={codexConfigSectionRowChipClass}>
                        NOTICE
                      </span>
                      <span className="min-w-0">{resolveCodexNoticeDescription(t, row)}</span>
                    </div>
                  </div>
                  <div className="flex justify-start md:justify-center">
                    <div className="w-full max-w-[22rem]">
                      {renderCodexValueEditor(row, row.readOnly || isBusy, onChangeNotice, onRemoveNotice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-muted)]">
            {isLoading ? t('status.codex_notices_loading') : t('status.codex_notices_empty')}
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4">
          <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
            {t('status.codex_notices_preview_title')}: {preview.summary}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {preview.changes.map((change) => (
              <div
                key={`${change.key}-${change.kind}`}
                className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-primary)]"
              >
                <span className="font-mono">{change.key}</span>
                <span className="text-[var(--gt-ink-muted)]"> / {change.kind} / </span>
                <span>{String(change.before ?? '-')} -&gt; {String(change.after ?? '-')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3">
        <div className="text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-muted)]">
          {t('status.codex_notices_save_hint')}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={isBusy || !snapshot}
            className={codexConfigSectionSecondaryButtonClass}
          >
            {t('status.codex_notices_reset')}
          </button>
          <button
            type="button"
            onClick={onPreview}
            disabled={isBusy || dirtyCount === 0}
            className={codexConfigSectionSecondaryButtonClass}
          >
            {t('status.codex_notices_preview')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isBusy || dirtyCount === 0}
            className={codexConfigSectionPrimaryButtonClass}
          >
            {isSaving ? t('status.codex_notices_saving') : t('common.save')}
          </button>
        </div>
      </div>
    </section>
  );
}
