import SearchInput from '../../../components/ui/SearchInput';
import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
  CodexFeatureStageFilter,
} from '../model/codexFeatureConfig';
import { groupCodexFeatureRows } from '../model/codexFeatureConfig';
import { renderCodexValueEditor } from '../model/codexValueEditor';

const codexFeatureStageFilters: CodexFeatureStageFilter[] = [
  'all',
  'recommended',
  'stable',
  'experimental',
  'advanced',
  'compat',
  'legacy',
  'deprecated',
  'removed',
  'unknown',
  'unsupported',
];

function resolveCodexFeatureDescription(t: (key: string) => string, row: CodexFeatureRow) {
  const translationKey = `status.codex_feature_descriptions.${row.key}`;
  const translated = t(translationKey);
  if (translated !== translationKey) {
    return translated;
  }
  return row.description || t('status.codex_features_no_description');
}

interface StatusCodexFeaturesSectionProps {
  t: (key: string) => string;
  snapshot: CodexFeatureConfigSnapshot | null;
  rows: CodexFeatureRow[];
  preview: CodexFeaturePreview | null;
  message: string;
  query: string;
  stageFilter: CodexFeatureStageFilter;
  dirtyCount: number;
  isLoading: boolean;
  isSaving: boolean;
  showSearch?: boolean;
  onReload: () => void;
  onChangeQuery: (value: string) => void;
  onChangeStageFilter: (value: CodexFeatureStageFilter) => void;
  onChangeFeature: (key: string, value: unknown) => void;
  onPreview: () => void;
  onSave: () => void;
  onReset: () => void;
}

export default function StatusCodexFeaturesSection({
  t,
  snapshot,
  rows,
  preview,
  message,
  query,
  stageFilter,
  dirtyCount,
  isLoading,
  isSaving,
  showSearch = true,
  onReload,
  onChangeQuery,
  onChangeStageFilter,
  onChangeFeature,
  onPreview,
  onSave,
  onReset,
}: StatusCodexFeaturesSectionProps) {
  const visibleCount = rows.length;
  const totalCount = snapshot?.items.filter((item) => item.section === 'features').length || 0;
  const isBusy = isLoading || isSaving;
  const groupedRows = groupCodexFeatureRows(rows);

  function resolveGroupTitle(groupId: string) {
    const translationKey = `status.codex_features_group_${groupId}`;
    const translated = t(translationKey);
    return translated !== translationKey ? translated : groupId;
  }

  return (
    <section className="relative overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div className="grid gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="text-[length:var(--font-size-ui-sm)] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
            {t('status.codex_features_title')}
          </div>
          <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-muted)]">
            {snapshot?.configPath || t('status.codex_features_unavailable')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {visibleCount}/{totalCount} {t('status.codex_features_visible')}
          </div>
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {dirtyCount} {t('status.codex_features_changed')}
          </div>
          <button
            type="button"
            onClick={onReload}
            disabled={isBusy}
            className="btn-swiss !px-3 !py-1 !text-[length:var(--font-size-ui-xs)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? t('status.codex_features_loading') : t('common.refresh')}
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b-2 border-[var(--border-color)] p-4">
        <div className="flex flex-wrap gap-2">
          {codexFeatureStageFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onChangeStageFilter(filter)}
              className={`border-2 px-2.5 py-1.5 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] ${
                stageFilter === filter
                  ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              {t(`status.codex_features_filter_${filter}`)}
            </button>
          ))}
        </div>
        {showSearch ? (
          <SearchInput
            value={query}
            onChange={onChangeQuery}
            placeholder={t('status.codex_features_search_placeholder')}
            clearLabel={t('common.clear_search')}
          />
        ) : null}
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
            <div className="divide-y-2 divide-[var(--border-color)]">
              {group.rows.map((row) => (
                <div
                  key={row.key}
                  className={`grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_5rem] md:items-center ${
                    row.stage === 'unknown' || row.stage === 'unsupported' ? 'bg-[var(--bg-main)]' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="break-all font-mono text-[length:var(--font-size-ui-md)] font-black tracking-wide text-[var(--text-primary)]">
                      {row.key}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[length:var(--font-size-ui-sm)] font-bold tracking-wide text-[var(--text-muted)]">
                      <span
                        className={`inline-flex shrink-0 border-2 px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black tracking-[0.14em] ${
                          row.stage === 'unknown' || row.stage === 'unsupported' || row.stage === 'removed'
                            ? 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--color-status-danger)]'
                            : 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                        }`}
                      >
                        {t(`status.codex_features_stage_${row.stage}`)}
                      </span>
                      {row.hiddenByDefault ? (
                        <span className="inline-flex shrink-0 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black tracking-[0.14em] text-[var(--text-muted)]">
                          {t('status.codex_features_hidden_default')}
                        </span>
                      ) : null}
                      <span className="min-w-0">{resolveCodexFeatureDescription(t, row)}</span>
                    </div>
                    {row.legacyAliases.length > 0 ? (
                      <div className="mt-2 inline-flex max-w-full border-2 border-dashed border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                        <span className="truncate">
                          {t('status.codex_features_legacy_alias')}: {row.legacyAliases.join(', ')}
                        </span>
                      </div>
                    ) : null}
                    {row.unsupported ? (
                      <div className="mt-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {t('status.codex_features_unsupported_hint')}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-start md:justify-center">
                    <div className="w-full max-w-[22rem]">
                      {renderCodexValueEditor(row, row.readOnly || isBusy, onChangeFeature)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {isLoading ? t('status.codex_features_loading') : t('status.codex_features_empty')}
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="border-t-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
          <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
            {t('status.codex_features_preview_title')}: {preview.summary}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {preview.changes.map((change) => (
              <div
                key={`${change.key}-${change.kind}`}
                className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-primary)]"
              >
                <span className="font-mono">{change.key}</span>
                <span className="text-[var(--text-muted)]"> / {change.kind} / </span>
                <span>{String(change.before ?? '-')} -&gt; {String(change.after)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3">
        <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-muted)]">
          {t('status.codex_features_save_hint')}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={isBusy || !snapshot}
            className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('status.codex_features_reset')}
          </button>
          <button
            type="button"
            onClick={onPreview}
            disabled={isBusy || dirtyCount === 0}
            className="btn-swiss !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('status.codex_features_preview')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isBusy || dirtyCount === 0}
            className="btn-swiss bg-[var(--border-color)] !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? t('status.codex_features_saving') : t('common.save')}
          </button>
        </div>
      </div>
    </section>
  );
}
