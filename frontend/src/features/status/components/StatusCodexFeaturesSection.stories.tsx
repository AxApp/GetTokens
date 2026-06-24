import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
  CodexFeatureStageFilter,
} from '../model/codexFeatureConfig';
import StatusCodexFeaturesSection from './StatusCodexFeaturesSection';

const meta = {
  title: 'Design System/业务组件/状态页 Codex 功能',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy: Record<string, string> = {
  'common.refresh': '刷新',
  'common.save': '保存',
  'status.codex_features_title': 'Codex 功能开关',
  'status.codex_features_unavailable': '未读取到 config.toml',
  'status.codex_features_visible': 'VISIBLE',
  'status.codex_features_changed': 'CHANGED',
  'status.codex_features_loading': '加载中',
  'status.codex_features_filter_all': '全部',
  'status.codex_features_filter_recommended': '推荐',
  'status.codex_features_filter_stable': '稳定',
  'status.codex_features_filter_experimental': '实验',
  'status.codex_features_filter_advanced': '高级',
  'status.codex_features_filter_compat': '兼容',
  'status.codex_features_filter_legacy': '旧别名',
  'status.codex_features_filter_deprecated': '废弃',
  'status.codex_features_filter_removed': '已移除',
  'status.codex_features_filter_unknown': '未知',
  'status.codex_features_filter_unsupported': '不支持',
  'status.codex_features_search_placeholder': '搜索 feature key',
  'status.codex_features_empty': '没有匹配的功能开关',
  'status.codex_features_preview_title': '预览变更',
  'status.codex_features_save_hint': '保存前会先生成本地配置预览',
  'status.codex_features_reset': '重置',
  'status.codex_features_preview': '预览',
  'status.codex_features_saving': '保存中',
  'status.codex_features_no_description': '暂无描述',
  'status.codex_features_hidden_default': '默认隐藏',
  'status.codex_features_legacy_alias': '旧别名',
  'status.codex_features_unsupported_hint': '当前 Codex 版本不支持该功能',
  'status.codex_features_stage_recommended': 'RECOMMENDED',
  'status.codex_features_stage_stable': 'STABLE',
  'status.codex_features_stage_experimental': 'EXPERIMENTAL',
  'status.codex_features_stage_advanced': 'ADVANCED',
  'status.codex_features_stage_deprecated': 'DEPRECATED',
  'status.codex_features_stage_removed': 'REMOVED',
  'status.codex_features_stage_legacy': 'LEGACY',
  'status.codex_features_stage_unknown': 'UNKNOWN',
  'status.codex_features_stage_unsupported': 'UNSUPPORTED',
};

const t = (key: string) => copy[key] ?? key;

function boolRow(row: Omit<CodexFeatureRow, 'id' | 'path' | 'valueType' | 'options' | 'draftValue' | 'dirty' | 'changeKind' | 'removed'> & {
  draftValue: boolean;
  dirty: boolean;
  changeKind: CodexFeatureRow['changeKind'];
}): CodexFeatureRow {
  return {
    id: row.key,
    path: [row.key],
    valueType: 'boolean',
    options: [],
    removed: false,
    ...row,
  };
}

function previewChange(key: string, before: unknown, after: unknown, kind: string) {
  return {
    id: key,
    section: 'features',
    key,
    path: [key],
    valueType: 'boolean',
    before,
    after,
    kind,
  };
}

const rows: CodexFeatureRow[] = [
  boolRow({
    section: 'features',
    key: 'responses_api',
    description: '优先使用 Responses API 路径。',
    stage: 'recommended',
    defaultValue: true,
    localValue: true,
    localRawValue: 'true',
    effectiveValue: true,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'responses_api',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: true,
    dirty: false,
    changeKind: 'none',
  }),
  boolRow({
    section: 'features',
    key: 'compact_context',
    description: '压缩上下文窗口内的低价值历史记录。',
    stage: 'experimental',
    defaultValue: false,
    localValue: false,
    localRawValue: 'false',
    effectiveValue: false,
    hasLocalValue: true,
    legacyAliases: ['context_compaction'],
    canonicalKey: 'compact_context',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: true,
    draftValue: true,
    dirty: true,
    changeKind: 'modified',
  }),
  boolRow({
    section: 'features',
    key: 'legacy_tools',
    description: '旧版本工具桥接开关。',
    stage: 'legacy',
    defaultValue: false,
    localValue: true,
    localRawValue: 'true',
    effectiveValue: true,
    hasLocalValue: true,
    legacyAliases: ['tools_v1'],
    canonicalKey: 'tools_v2',
    unsupported: false,
    readOnly: true,
    hiddenByDefault: false,
    draftValue: true,
    dirty: false,
    changeKind: 'none',
  }),
  boolRow({
    section: 'features',
    key: 'remote_shell',
    description: '当前本地 Codex 版本不支持。',
    stage: 'unsupported',
    defaultValue: false,
    localValue: false,
    localRawValue: 'false',
    effectiveValue: false,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'remote_shell',
    unsupported: true,
    readOnly: true,
    hiddenByDefault: false,
    draftValue: false,
    dirty: false,
    changeKind: 'none',
  }),
];

const snapshot: CodexFeatureConfigSnapshot = {
  codexHomePath: '/Users/preview/.codex',
  configPath: '/Users/preview/.codex/config.toml',
  items: rows,
  warnings: [],
  loadedAt: '2026-05-19T12:00:00Z',
};

const preview: CodexFeaturePreview = {
  configPath: snapshot.configPath,
  summary: '1 modified',
  changes: [previewChange('compact_context', false, true, 'modified')],
};

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function FeatureSectionSample({
  label,
  sampleRows = rows,
  sampleSnapshot = snapshot,
  samplePreview = null,
  message = '',
  query = '',
  stageFilter = 'all',
  dirtyCount = 0,
  isLoading = false,
  isSaving = false,
}: {
  label: string;
  sampleRows?: CodexFeatureRow[];
  sampleSnapshot?: CodexFeatureConfigSnapshot | null;
  samplePreview?: CodexFeaturePreview | null;
  message?: string;
  query?: string;
  stageFilter?: CodexFeatureStageFilter;
  dirtyCount?: number;
  isLoading?: boolean;
  isSaving?: boolean;
}) {
  return (
    <Frame label={label}>
      <StatusCodexFeaturesSection
        t={t}
        snapshot={sampleSnapshot}
        rows={sampleRows}
        preview={samplePreview}
        message={message}
        query={query}
        stageFilter={stageFilter}
        dirtyCount={dirtyCount}
        isLoading={isLoading}
        isSaving={isSaving}
        onReload={() => undefined}
        onChangeQuery={() => undefined}
        onChangeStageFilter={() => undefined}
        onChangeFeature={() => undefined}
        onPreview={() => undefined}
        onSave={() => undefined}
        onReset={() => undefined}
      />
    </Frame>
  );
}

function StatusCodexFeaturesOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-muted)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">状态页 Codex 功能</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          Codex feature 开关列表进入设计系统后，用固定 snapshot、row 和 preview mock 覆盖配置型列表、筛选、空态和保存状态。
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Feature list states</h3>
        <div className="grid gap-4">
          <FeatureSectionSample label="DS-CODEX-FEATURES-READY" message="loaded from config.toml" />
          <FeatureSectionSample
            label="DS-CODEX-FEATURES-DIRTY-PREVIEW"
            samplePreview={preview}
            dirtyCount={1}
            message="1 pending change"
          />
          <FeatureSectionSample
            label="DS-CODEX-FEATURES-SAVING"
            samplePreview={preview}
            dirtyCount={1}
            isSaving
          />
          <div className="grid gap-4 xl:grid-cols-3">
            <FeatureSectionSample label="DS-CODEX-FEATURES-LOADING" sampleRows={[]} sampleSnapshot={null} isLoading />
            <FeatureSectionSample label="DS-CODEX-FEATURES-EMPTY" sampleRows={[]} query="not-found" />
            <FeatureSectionSample
              label="DS-CODEX-FEATURES-UNSUPPORTED"
              sampleRows={[rows[2], rows[3]]}
              stageFilter="compat"
              dirtyCount={0}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <StatusCodexFeaturesOverview />,
};

export const Ready: Story = {
  render: () => <FeatureSectionSample label="DS-CODEX-FEATURES-READY" />,
};

export const DirtyPreview: Story = {
  render: () => <FeatureSectionSample label="DS-CODEX-FEATURES-DIRTY-PREVIEW" samplePreview={preview} dirtyCount={1} />,
};
