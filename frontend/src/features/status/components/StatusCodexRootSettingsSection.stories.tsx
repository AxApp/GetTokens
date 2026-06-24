import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type {
  CodexFeatureConfigSnapshot,
  CodexFeaturePreview,
  CodexFeatureRow,
} from '../model/codexFeatureConfig';
import StatusCodexRootSettingsSection from './StatusCodexRootSettingsSection';

const meta = {
  title: 'Design System/业务组件/状态页 Codex Root Settings',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy: Record<string, string> = {
  'common.refresh': '刷新',
  'common.save': '保存',
  'status.codex_root_settings_title': 'Codex Root Settings',
  'status.codex_root_settings_unavailable': '未读取到 config.toml',
  'status.codex_root_settings_visible': 'VISIBLE',
  'status.codex_root_settings_changed': 'CHANGED',
  'status.codex_root_settings_loading': '加载中',
  'status.codex_root_settings_empty': '没有可配置的根级设置',
  'status.codex_root_settings_preview_title': '预览变更',
  'status.codex_root_settings_save_hint': '保存前会先生成本地配置预览',
  'status.codex_root_settings_reset': '重置',
  'status.codex_root_settings_preview': '预览',
  'status.codex_root_settings_saving': '保存中',
  'status.codex_root_settings_no_description': '暂无描述',
};

const t = (key: string) => copy[key] ?? key;

function rootRow(
  row: Omit<CodexFeatureRow, 'id' | 'path' | 'draftValue' | 'dirty' | 'changeKind' | 'removed'> & {
    valueType: string;
    options?: string[];
    draftValue: unknown;
    dirty: boolean;
    changeKind: CodexFeatureRow['changeKind'];
  }
): CodexFeatureRow {
  return {
    id: `root.${row.key}`,
    path: [row.key],
    removed: false,
    ...row,
    options: row.options ?? [],
  } as CodexFeatureRow;
}

function previewChange(
  key: string,
  before: unknown,
  after: unknown,
  kind: string,
  valueType: string
) {
  return {
    id: `root.${key}`,
    section: 'root',
    key,
    path: [key],
    valueType,
    before,
    after,
    kind,
  };
}

const rows: CodexFeatureRow[] = [
  rootRow({
    section: 'root',
    key: 'hide_agent_reasoning',
    description: '隐藏 Codex UI/output 中的 AgentReasoning 事件。',
    stage: 'stable',
    valueType: 'boolean',
    options: [],
    defaultValue: false,
    localValue: true,
    localRawValue: 'true',
    effectiveValue: true,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'hide_agent_reasoning',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: true,
    dirty: true,
    changeKind: 'modified',
  }),
  rootRow({
    section: 'root',
    key: 'approval_policy',
    description: '默认命令审批策略。',
    stage: 'stable',
    valueType: 'enum',
    options: ['untrusted', 'on-failure', 'on-request', 'never'],
    defaultValue: 'on-request',
    localValue: 'on-request',
    localRawValue: '"on-request"',
    effectiveValue: 'on-request',
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'approval_policy',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 'never',
    dirty: true,
    changeKind: 'modified',
  }),
  rootRow({
    section: 'root',
    key: 'model',
    description: '当前使用的模型标识。',
    stage: 'stable',
    valueType: 'string',
    options: [],
    defaultValue: 'gpt-5.4',
    localValue: 'gpt-5.4',
    localRawValue: '"gpt-5.4"',
    effectiveValue: 'gpt-5.4',
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'model',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 'gpt-5.4',
    dirty: false,
    changeKind: 'none',
  }),
  rootRow({
    section: 'root',
    key: 'model_context_window',
    description: '模型上下文窗口大小，单位为 token。',
    stage: 'stable',
    valueType: 'integer',
    options: [],
    defaultValue: 128000,
    localValue: 128000,
    localRawValue: '128000',
    effectiveValue: 128000,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'model_context_window',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 200000,
    dirty: true,
    changeKind: 'modified',
  }),
  rootRow({
    section: 'root',
    key: 'notify',
    description: '通知命令列表。',
    stage: 'stable',
    valueType: 'string_array',
    options: [],
    defaultValue: ['terminal-notifier'],
    localValue: ['terminal-notifier', '-message'],
    localRawValue: '["terminal-notifier", "-message"]',
    effectiveValue: ['terminal-notifier', '-message'],
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'notify',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: ['terminal-notifier', '-message', 'Codex'],
    dirty: true,
    changeKind: 'modified',
  }),
  rootRow({
    section: 'root',
    key: 'include_permissions_instructions',
    description: '注入 permissions developer instruction block。',
    stage: 'advanced',
    valueType: 'boolean',
    options: [],
    defaultValue: true,
    localValue: true,
    localRawValue: 'true',
    effectiveValue: true,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'include_permissions_instructions',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: true,
    dirty: false,
    changeKind: 'none',
  }),
];

const snapshot: CodexFeatureConfigSnapshot = {
  codexHomePath: '/Users/preview/.codex',
  configPath: '/Users/preview/.codex/config.toml',
  items: rows,
  warnings: [],
  loadedAt: '2026-05-23T12:00:00Z',
};

const preview: CodexFeaturePreview = {
  configPath: snapshot.configPath,
  summary: '4 modified',
  changes: [
    previewChange('hide_agent_reasoning', true, false, 'modified', 'boolean'),
    previewChange('approval_policy', 'on-request', 'never', 'modified', 'enum'),
    previewChange('model_context_window', 128000, 200000, 'modified', 'integer'),
    previewChange(
      'notify',
      ['terminal-notifier', '-message'],
      ['terminal-notifier', '-message', 'Codex'],
      'modified',
      'string_array'
    ),
  ],
};

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">{children}</div>
    </DesignSystemStoryFrame>
  );
}

function RootSettingsSample({
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
      <StatusCodexRootSettingsSection
        t={t}
        snapshot={sampleSnapshot}
        rows={sampleRows}
        preview={samplePreview}
        message={message}
        dirtyCount={dirtyCount}
        isLoading={isLoading}
        isSaving={isSaving}
        onReload={() => undefined}
        onChangeSetting={() => undefined}
        onPreview={() => undefined}
        onSave={() => undefined}
        onReset={() => undefined}
      />
    </Frame>
  );
}

function StatusCodexRootSettingsOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">状态页 Codex Root Settings</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          Codex root 面板展示 config.toml 顶层设置、预览和保存反馈，覆盖 boolean、enum、number、string 与 array 等不同类型的机器级设置。
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-semibold tracking-normal">Root setting states</h3>
        <div className="grid gap-4">
          <RootSettingsSample label="DS-CODEX-ROOT-READY" message="loaded from config.toml" />
          <RootSettingsSample
            label="DS-CODEX-ROOT-DIRTY-PREVIEW"
            samplePreview={preview}
            dirtyCount={4}
            message="4 pending changes"
          />
          <RootSettingsSample label="DS-CODEX-ROOT-SAVING" samplePreview={preview} dirtyCount={4} isSaving />
          <div className="grid gap-4 xl:grid-cols-3">
            <RootSettingsSample label="DS-CODEX-ROOT-LOADING" sampleRows={[]} sampleSnapshot={null} isLoading />
            <RootSettingsSample label="DS-CODEX-ROOT-EMPTY" sampleRows={[]} dirtyCount={0} />
            <RootSettingsSample
              label="DS-CODEX-ROOT-UNAVAILABLE"
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
  render: () => <StatusCodexRootSettingsOverview />,
};
