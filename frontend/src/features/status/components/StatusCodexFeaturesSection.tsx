import { Cpu, Info, MessageSquareText, Network, Timer } from 'lucide-react';
import SearchInput from '../../../components/ui/SearchInput';
import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
  CodexFeatureRowPathDisplay,
  CodexFeatureStageFilter,
} from '../model/codexFeatureConfig';
import { groupCodexFeatureRows, resolveCodexFeatureRowPathDisplay } from '../model/codexFeatureConfig';
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

interface CodexFeaturePathGroupedRow {
  row: CodexFeatureRow;
  pathDisplay: CodexFeatureRowPathDisplay;
}

interface CodexFeaturePathGroup {
  id: string;
  primaryLabel: string;
  rows: CodexFeaturePathGroupedRow[];
}

function groupFeatureRowsByPrimaryPath(rows: CodexFeatureRow[]): CodexFeaturePathGroup[] {
  const groups: CodexFeaturePathGroup[] = [];
  const groupsByPrimaryLabel = new Map<string, CodexFeaturePathGroup>();

  for (const row of rows) {
    const pathDisplay = resolveCodexFeatureRowPathDisplay(row);
    const groupID = pathDisplay.primaryLabel;
    let group = groupsByPrimaryLabel.get(groupID);
    if (!group) {
      group = { id: groupID, primaryLabel: pathDisplay.primaryLabel, rows: [] };
      groupsByPrimaryLabel.set(groupID, group);
      groups.push(group);
    }
    group.rows.push({ row, pathDisplay });
  }

  return groups;
}

function resolveFeatureRowPathLabels(pathDisplay: CodexFeatureRowPathDisplay, nested: boolean) {
  if (nested && pathDisplay.childLabels.length > 0) {
    return pathDisplay.childLabels;
  }
  return [pathDisplay.primaryLabel, ...pathDisplay.childLabels];
}

function resolveFeatureObjectAccentClass(row: CodexFeatureRow | undefined) {
  if (!row) {
    return 'bg-[var(--text-muted)]';
  }
  if (row.stage === 'unknown' || row.stage === 'unsupported' || row.stage === 'removed') {
    return 'bg-[var(--color-status-danger)]';
  }
  if (row.stage === 'experimental' || row.stage === 'advanced') {
    return 'bg-[var(--color-status-warning)]';
  }
  return 'bg-[var(--color-status-success)]';
}

function findMultiAgentV2Row(pathGroup: CodexFeaturePathGroup, childKey: string) {
  return pathGroup.rows.find(({ pathDisplay }) => pathDisplay.primaryLabel === 'multi_agent_v2' && pathDisplay.childLabels[0] === childKey);
}

function compactFeatureRows(rows: Array<CodexFeaturePathGroupedRow | undefined>) {
  return rows.filter((row): row is CodexFeaturePathGroupedRow => Boolean(row));
}

function shouldSpanFeatureField(row: CodexFeatureRow) {
  const valueType = row.valueType.trim().toLowerCase();
  return valueType === 'text' || valueType === 'textarea' || valueType === 'toml' || valueType === 'string_array';
}

function resolveFeatureFieldLayoutClass(row: CodexFeatureRow) {
  return shouldSpanFeatureField(row) ? 'lg:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(13rem,18rem)]';
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
  onRemoveFeature?: (key: string) => void;
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
  onRemoveFeature,
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

  function renderFeatureField({ row, pathDisplay }: CodexFeaturePathGroupedRow, nested: boolean) {
    const pathLabels = resolveFeatureRowPathLabels(pathDisplay, nested);

    return (
      <div
        key={row.id}
        data-codex-feature-card-field={row.id}
        className={`grid min-w-0 gap-3 px-4 py-3 ${resolveFeatureFieldLayoutClass(row)} lg:items-start ${
          row.stage === 'unknown' || row.stage === 'unsupported' ? 'bg-[var(--bg-main)]' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1 font-mono text-[length:var(--font-size-ui-md)] font-black tracking-normal text-[var(--text-primary)]">
            {pathLabels.map((label, index) => (
              <span key={`${pathDisplay.fullLabel}-${index}`} className="inline-flex min-w-0 items-center gap-1">
                {index > 0 ? <span className="text-[var(--text-muted)]">/</span> : null}
                <span className="min-w-0 break-words">{label}</span>
              </span>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[length:var(--font-size-ui-sm)] font-medium tracking-normal text-[var(--text-muted)]">
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
        <div className="w-full min-w-0 lg:justify-self-end">
          {renderCodexValueEditor(row, row.readOnly || isBusy, onChangeFeature, onRemoveFeature)}
        </div>
      </div>
    );
  }

  function renderComplexFeatureField({ row, pathDisplay }: CodexFeaturePathGroupedRow) {
    const fieldLabel = pathDisplay.childLabels[0] || pathDisplay.primaryLabel;
    const isWideField = shouldSpanFeatureField(row);

    return (
      <div
        key={row.id}
        data-codex-feature-card-field={row.id}
        className={`grid min-w-0 gap-2 px-3 py-3 ${
          isWideField ? 'grid-cols-1' : 'sm:grid-cols-[minmax(0,1fr)_minmax(9rem,14rem)] sm:items-center'
        }`}
      >
        <div className="min-w-0">
          <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black tracking-normal text-[var(--text-primary)]">
            {fieldLabel}
          </div>
          <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-bold leading-relaxed tracking-wide text-[var(--text-muted)]">
            {resolveCodexFeatureDescription(t, row)}
          </div>
        </div>
        <div className="min-w-0 sm:justify-self-end">{renderCodexValueEditor(row, row.readOnly || isBusy, onChangeFeature, onRemoveFeature)}</div>
      </div>
    );
  }

  function renderMultiAgentV2Panel(pathGroup: CodexFeaturePathGroup) {
    const enabledRow = findMultiAgentV2Row(pathGroup, 'enabled');
    const runtimeRows = compactFeatureRows([findMultiAgentV2Row(pathGroup, 'max_concurrent_threads_per_session')]);
    const waitRows = compactFeatureRows([
      findMultiAgentV2Row(pathGroup, 'min_wait_timeout_ms'),
      findMultiAgentV2Row(pathGroup, 'max_wait_timeout_ms'),
      findMultiAgentV2Row(pathGroup, 'default_wait_timeout_ms'),
    ]);
    const usageRows = compactFeatureRows([
      findMultiAgentV2Row(pathGroup, 'usage_hint_enabled'),
      findMultiAgentV2Row(pathGroup, 'usage_hint_text'),
      findMultiAgentV2Row(pathGroup, 'root_agent_usage_hint_text'),
      findMultiAgentV2Row(pathGroup, 'subagent_usage_hint_text'),
    ]);
    const metadataRows = compactFeatureRows([
      findMultiAgentV2Row(pathGroup, 'tool_namespace'),
      findMultiAgentV2Row(pathGroup, 'hide_spawn_agent_metadata'),
      findMultiAgentV2Row(pathGroup, 'non_code_mode_only'),
    ]);
    const hasDirtyRows = pathGroup.rows.some(({ row }) => row.dirty);
    const groupSections = [
      { id: 'runtime-capacity', title: t('status.codex_features_multi_agent_v2_runtime'), icon: Cpu, rows: runtimeRows },
      { id: 'wait-timeouts', title: t('status.codex_features_multi_agent_v2_timeouts'), icon: Timer, rows: waitRows },
      { id: 'usage-hints', title: t('status.codex_features_multi_agent_v2_usage'), icon: MessageSquareText, rows: usageRows },
      { id: 'tool-metadata', title: t('status.codex_features_multi_agent_v2_metadata'), icon: Info, rows: metadataRows },
    ];

    return (
      <div
        key={pathGroup.id}
        data-codex-feature-object-card={pathGroup.primaryLabel}
        data-codex-complex-feature-panel="multi_agent_v2"
        className="overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
      >
        <div
          data-codex-feature-primary-heading={pathGroup.primaryLabel}
          className="grid gap-4 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]">
              <Network className="h-5 w-5" strokeWidth={2.6} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-[length:var(--font-size-ui-lg)] font-black leading-tight tracking-normal text-[var(--text-primary)]">
                  {pathGroup.primaryLabel}
                </h3>
                {hasDirtyRows ? (
                  <span className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                    {t('status.codex_features_changed')}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-2xl text-[length:var(--font-size-ui-sm)] font-medium leading-relaxed text-[var(--text-primary)]">
                {t('status.codex_features_multi_agent_v2_description')}
              </p>
            </div>
          </div>
          {enabledRow ? (
            <div className="flex items-center justify-start gap-3 lg:justify-end">
              <span className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                {t('status.codex_features_multi_agent_v2_active')}
              </span>
              <div className="w-20">{renderCodexValueEditor(enabledRow.row, enabledRow.row.readOnly || isBusy, onChangeFeature, onRemoveFeature)}</div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 px-4 py-4 lg:grid-cols-2">
          {groupSections.map((section) => {
            if (section.rows.length === 0) {
              return null;
            }
            const Icon = section.icon;
            return (
              <div key={section.id} data-codex-complex-feature-group={section.id} className="min-w-0">
                <div className="mb-3 flex items-center gap-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <Icon className="h-4 w-4" strokeWidth={2.4} />
                  <span>{section.title}</span>
                </div>
                <div className="divide-y-2 divide-[var(--border-color)]">
                  {section.rows.map((groupedRow) => renderComplexFeatureField(groupedRow))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderFeatureObjectCard(pathGroup: CodexFeaturePathGroup) {
    const hasNestedRows = pathGroup.rows.some(({ pathDisplay }) => pathDisplay.childLabels.length > 0);
    const primaryRow = pathGroup.rows[0]?.row;
    const stageSummary = Array.from(new Set(pathGroup.rows.map(({ row }) => row.stage)));
    const hasDirtyRows = pathGroup.rows.some(({ row }) => row.dirty);
    const accentClass = resolveFeatureObjectAccentClass(primaryRow);
    const description = primaryRow ? resolveCodexFeatureDescription(t, primaryRow) : '';

    if (pathGroup.primaryLabel === 'multi_agent_v2') {
      return renderMultiAgentV2Panel(pathGroup);
    }

    if (!hasNestedRows) {
      return pathGroup.rows.map((groupedRow) => {
        const rowAccentClass = resolveFeatureObjectAccentClass(groupedRow.row);
        return (
          <div
            key={groupedRow.row.id}
            data-codex-feature-object-card={pathGroup.primaryLabel}
            className="relative grid min-w-0 max-w-full gap-3 bg-[var(--bg-main)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,18rem)] lg:items-center"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${rowAccentClass}`} />
                <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-md)] font-black tracking-normal text-[var(--text-primary)]">
                  {pathGroup.primaryLabel}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[length:var(--font-size-ui-sm)] font-medium leading-relaxed text-[var(--text-muted)]">
                <span>{resolveCodexFeatureDescription(t, groupedRow.row)}</span>
                <span className="inline-flex border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black tracking-[0.14em] text-[var(--text-muted)]">
                  {t(`status.codex_features_stage_${groupedRow.row.stage}`)}
                </span>
                {groupedRow.row.dirty ? (
                  <span className="inline-flex border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black tracking-[0.14em] text-[var(--text-primary)]">
                    {t('status.codex_features_changed')}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="min-w-0 lg:justify-self-end">
              {renderCodexValueEditor(groupedRow.row, groupedRow.row.readOnly || isBusy, onChangeFeature, onRemoveFeature)}
              {groupedRow.row.legacyAliases.length > 0 || groupedRow.row.unsupported ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {groupedRow.row.legacyAliases.length > 0 ? (
                    <span className="min-w-0 truncate border-2 border-dashed border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                      {t('status.codex_features_legacy_alias')}: {groupedRow.row.legacyAliases.join(', ')}
                    </span>
                  ) : null}
                  {groupedRow.row.unsupported ? (
                    <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {t('status.codex_features_unsupported_hint')}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      });
    }

    return (
      <div
        key={pathGroup.id}
        data-codex-feature-object-card={pathGroup.primaryLabel}
        className="relative flex min-w-0 max-w-full flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
      >
        <div
          data-codex-feature-primary-heading={pathGroup.primaryLabel}
          className="grid min-w-0 gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 lg:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)_auto] lg:items-start"
        >
          <div className="grid min-w-0 content-start gap-2">
            <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${accentClass}`} />
              <h3 className="truncate font-mono text-[length:var(--font-size-ui-lg)] font-black leading-tight tracking-normal text-[var(--text-primary)]">
                {pathGroup.primaryLabel}
              </h3>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {stageSummary.map((stage) => (
                <span
                  key={stage}
                  className="inline-flex shrink-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black tracking-[0.14em] text-[var(--text-muted)]"
                >
                  {t(`status.codex_features_stage_${stage}`)}
                </span>
              ))}
              {hasDirtyRows ? (
                <span className="inline-flex shrink-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black tracking-[0.14em] text-[var(--text-primary)]">
                  {t('status.codex_features_changed')}
                </span>
              ) : null}
            </div>
          </div>
          {description ? (
            <div className="min-w-0 text-[length:var(--font-size-ui-sm)] font-bold leading-relaxed text-[var(--text-muted)]">
              {description}
            </div>
          ) : null}
          <div className="justify-self-start border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black tracking-[0.14em] text-[var(--text-muted)] lg:justify-self-end">
            {pathGroup.rows.length} {t('design_system.items')}
          </div>
        </div>
        <div className="divide-y-2 divide-[var(--border-color)]">{pathGroup.rows.map((groupedRow) => renderFeatureField(groupedRow, true))}</div>
      </div>
    );
  }

  return (
    <section data-codex-feature-config-panel="true" className="relative overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
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
            <div
              data-codex-feature-object-list="settings-table"
              className="divide-y-2 divide-[var(--border-color)] border-2 border-[var(--border-color)] bg-[var(--bg-main)]"
            >
              {groupFeatureRowsByPrimaryPath(group.rows).map((pathGroup) => renderFeatureObjectCard(pathGroup))}
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
                <span>{String(change.before ?? '-')} -&gt; {String(change.after ?? '-')}</span>
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
