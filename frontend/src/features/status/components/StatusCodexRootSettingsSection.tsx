import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
} from '../model/codexFeatureConfig';
import { groupCodexFeatureRows } from '../model/codexFeatureConfig';
import StatusCodexConfigRows from './StatusCodexConfigRows';

function resolveCodexRootSettingDescription(t: (key: string) => string, row: CodexFeatureRow) {
  const translationKey = `status.codex_root_setting_descriptions.${row.key}`;
  const translated = t(translationKey);
  if (translated !== translationKey) {
    return translated;
  }
  return row.description || t('status.codex_root_settings_no_description');
}

interface StatusCodexRootSettingsSectionProps {
  t: (key: string) => string;
  snapshot: CodexFeatureConfigSnapshot | null;
  rows: CodexFeatureRow[];
  preview: CodexFeaturePreview | null;
  message: string;
  dirtyCount: number;
  isLoading: boolean;
  isSaving: boolean;
  onReload: () => void;
  onChangeSetting: (id: string, value: unknown) => void;
  onRemoveSetting?: (id: string) => void;
  onPreview: () => void;
  onSave: () => void;
  onReset: () => void;
}

export default function StatusCodexRootSettingsSection({
  t,
  snapshot,
  rows,
  preview,
  message,
  dirtyCount,
  isLoading,
  isSaving,
  onReload,
  onChangeSetting,
  onRemoveSetting,
  onPreview,
  onSave,
  onReset,
}: StatusCodexRootSettingsSectionProps) {
  const isBusy = isLoading || isSaving;
  const groupedRows = groupCodexFeatureRows(rows);

  function resolveGroupTitle(groupId: string) {
    const translationKey = `status.codex_root_settings_group_${groupId}`;
    const translated = t(translationKey);
    return translated !== translationKey ? translated : groupId;
  }

  return (
    <section className="relative overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div className="grid gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="text-[length:var(--font-size-ui-sm)] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
            {t('status.codex_root_settings_title')}
          </div>
          <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-muted)]">
            {snapshot?.configPath || t('status.codex_root_settings_unavailable')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {rows.length} {t('status.codex_root_settings_visible')}
          </div>
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {dirtyCount} {t('status.codex_root_settings_changed')}
          </div>
          <button
            type="button"
            onClick={onReload}
            disabled={isBusy}
            className="btn-swiss !px-3 !py-1 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? t('status.codex_root_settings_loading') : t('common.refresh')}
          </button>
        </div>
      </div>

      {message ? (
        <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-primary)]">
          {message}
        </div>
      ) : null}

      <div>
        {groupedRows.map((group, groupIndex) => (
          <div key={group.id} className={`${groupIndex > 0 ? 'border-t-2 border-[var(--border-color)]' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-2">
              <div className="text-[length:var(--font-size-ui-xs)] font-black italic uppercase tracking-[0.18em] text-[var(--text-primary)]">
                {resolveGroupTitle(group.id)}
              </div>
              <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {group.rows.length} {t('design_system.items')}
              </div>
            </div>
            <StatusCodexConfigRows
              rows={group.rows}
              badgeLabel="ROOT"
              isBusy={isBusy}
              parentMode="section"
              resolveDescription={(row) => resolveCodexRootSettingDescription(t, row)}
              onChangeSetting={onChangeSetting}
              onRemoveSetting={onRemoveSetting}
            />
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {isLoading ? t('status.codex_root_settings_loading') : t('status.codex_root_settings_empty')}
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="border-t-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {t('status.codex_root_settings_preview_title')}: {preview.summary}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {preview.changes.map((change) => (
              <div
                key={`${change.key}-${change.kind}`}
                className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-primary)]"
              >
                <span className="font-mono">{change.key}</span>
                <span className="text-[var(--text-muted)]"> / {change.kind} / </span>
                <span>{String(change.before ?? '-')} -&gt; {String(change.after ?? '-')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3">
        <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-muted)]">
          {t('status.codex_root_settings_save_hint')}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={isBusy || !snapshot}
            className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('status.codex_root_settings_reset')}
          </button>
          <button
            type="button"
            onClick={onPreview}
            disabled={isBusy || dirtyCount === 0}
            className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('status.codex_root_settings_preview')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isBusy || dirtyCount === 0}
            className="btn-swiss bg-[var(--border-color)] !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? t('status.codex_root_settings_saving') : t('common.save')}
          </button>
        </div>
      </div>
    </section>
  );
}
