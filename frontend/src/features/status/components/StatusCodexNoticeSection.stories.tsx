import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
} from '../model/codexFeatureConfig';
import StatusCodexNoticeSection from './StatusCodexNoticeSection';

const meta = {
  title: 'Design System/业务组件/状态页 Codex Notices',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy: Record<string, string> = {
  'common.refresh': '刷新',
  'common.save': '保存',
  'status.codex_notices_title': 'Codex 提示开关',
  'status.codex_notices_unavailable': '未读取到 config.toml',
  'status.codex_notices_visible': 'VISIBLE',
  'status.codex_notices_changed': 'CHANGED',
  'status.codex_notices_loading': '加载中',
  'status.codex_notices_empty': '没有可配置的提示开关',
  'status.codex_notices_preview_title': '预览变更',
  'status.codex_notices_save_hint': '保存前会先生成本地配置预览',
  'status.codex_notices_reset': '重置',
  'status.codex_notices_preview': '预览',
  'status.codex_notices_saving': '保存中',
  'status.codex_notices_no_description': '暂无描述',
};

const t = (key: string) => copy[key] ?? key;

function boolRow(row: Omit<CodexFeatureRow, 'id' | 'path' | 'valueType' | 'options' | 'draftValue' | 'dirty' | 'changeKind' | 'removed'> & {
  draftValue: boolean;
  dirty: boolean;
  changeKind: CodexFeatureRow['changeKind'];
}): CodexFeatureRow {
  return {
    id: `notice.${row.key}`,
    path: [row.key],
    valueType: 'boolean',
    options: [],
    removed: false,
    ...row,
  };
}

function previewChange(key: string, before: unknown, after: unknown, kind: string) {
  return {
    id: `notice.${key}`,
    section: 'notice',
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
    section: 'notice',
    key: 'hide_full_access_warning',
    description: '隐藏 full access 风险确认提示。',
    stage: 'stable',
    defaultValue: false,
    localValue: false,
    localRawValue: 'false',
    effectiveValue: false,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'hide_full_access_warning',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: false,
    dirty: false,
    changeKind: 'none',
  }),
  boolRow({
    section: 'notice',
    key: 'hide_rate_limit_model_nudge',
    description: '隐藏额度接近上限时切换低成本模型的提醒。',
    stage: 'stable',
    defaultValue: false,
    localValue: true,
    localRawValue: 'true',
    effectiveValue: true,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'hide_rate_limit_model_nudge',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: true,
    dirty: true,
    changeKind: 'modified',
  }),
  boolRow({
    section: 'notice',
    key: 'hide_gpt-5.1-codex-max_migration_prompt',
    description: '隐藏 gpt-5.1-codex-max 模型迁移提示。',
    stage: 'stable',
    defaultValue: false,
    localValue: false,
    localRawValue: 'false',
    effectiveValue: false,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'hide_gpt-5.1-codex-max_migration_prompt',
    unsupported: false,
    readOnly: false,
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
  changes: [previewChange('hide_rate_limit_model_nudge', true, false, 'modified')],
};

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">{children}</div>
    </DesignSystemStoryFrame>
  );
}

function NoticeSectionSample({
  label,
  sampleRows = rows,
  sampleSnapshot = snapshot,
  samplePreview = null,
  message = '',
  dirtyCount = 0,
  isLoading = false,
  isSaving = false,
}: {
  label: string;
  sampleRows?: CodexFeatureRow[];
  sampleSnapshot?: CodexFeatureConfigSnapshot | null;
  samplePreview?: CodexFeaturePreview | null;
  message?: string;
  dirtyCount?: number;
  isLoading?: boolean;
  isSaving?: boolean;
}) {
  return (
    <Frame label={label}>
      <StatusCodexNoticeSection
        t={t}
        snapshot={sampleSnapshot}
        rows={sampleRows}
        preview={samplePreview}
        message={message}
        dirtyCount={dirtyCount}
        isLoading={isLoading}
        isSaving={isSaving}
        onReload={() => undefined}
        onChangeNotice={() => undefined}
        onPreview={() => undefined}
        onSave={() => undefined}
        onReset={() => undefined}
      />
    </Frame>
  );
}

function StatusCodexNoticeOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-muted)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">状态页 Codex Notices</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          Codex notice 开关面板展示本地提示确认状态、预览和保存反馈，覆盖最常见的隐藏提示场景。
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Notice states</h3>
        <div className="grid gap-4">
          <NoticeSectionSample label="DS-CODEX-NOTICES-READY" message="loaded from config.toml" />
          <NoticeSectionSample
            label="DS-CODEX-NOTICES-DIRTY-PREVIEW"
            samplePreview={preview}
            dirtyCount={1}
            message="1 pending change"
          />
          <NoticeSectionSample label="DS-CODEX-NOTICES-SAVING" samplePreview={preview} dirtyCount={1} isSaving />
          <div className="grid gap-4 xl:grid-cols-3">
            <NoticeSectionSample label="DS-CODEX-NOTICES-LOADING" sampleRows={[]} sampleSnapshot={null} isLoading />
            <NoticeSectionSample label="DS-CODEX-NOTICES-EMPTY" sampleRows={[]} dirtyCount={0} />
            <NoticeSectionSample
              label="DS-CODEX-NOTICES-UNAVAILABLE"
              sampleRows={[]}
              sampleSnapshot={null}
              message="local config unavailable"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <StatusCodexNoticeOverview />,
};
