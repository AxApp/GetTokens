import type { Meta, StoryObj } from '@storybook/react-vite';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { CodexFeatureRow } from '../model/codexFeatureConfig';
import StatusCodexConfigRows from './StatusCodexConfigRows';

const meta = {
  title: 'Design System/业务组件/状态页 Codex 配置行',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function codexRow(
  row: Omit<CodexFeatureRow, 'id' | 'draftValue' | 'dirty' | 'changeKind' | 'removed'> & {
    draftValue: unknown;
    dirty?: boolean;
    changeKind?: CodexFeatureRow['changeKind'];
    removed?: boolean;
  },
): CodexFeatureRow {
  return {
    id: row.path.join('.'),
    removed: row.removed ?? false,
    dirty: row.dirty ?? false,
    changeKind: row.changeKind ?? 'none',
    ...row,
  };
}

const rows: CodexFeatureRow[] = [
  codexRow({
    section: 'root',
    key: 'approval_policy',
    path: ['approval_policy'],
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
    localRecordPresent: true,
  }),
  codexRow({
    section: 'features',
    key: 'multi_agent_v2.enabled',
    path: ['features', 'multi_agent_v2', 'enabled'],
    description: '开启多 agent 调度能力。',
    stage: 'experimental',
    valueType: 'boolean',
    options: [],
    defaultValue: false,
    localValue: true,
    localRawValue: 'true',
    effectiveValue: true,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'multi_agent_v2.enabled',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: true,
    localRecordPresent: true,
  }),
  codexRow({
    section: 'features',
    key: 'multi_agent_v2.max_concurrent_threads_per_session',
    path: ['features', 'multi_agent_v2', 'max_concurrent_threads_per_session'],
    description: '单个会话可同时运行的子线程数量。',
    stage: 'advanced',
    valueType: 'integer',
    options: [],
    defaultValue: 3,
    localValue: 4,
    localRawValue: '4',
    effectiveValue: 4,
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'multi_agent_v2.max_concurrent_threads_per_session',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 6,
    dirty: true,
    changeKind: 'modified',
    localRecordPresent: true,
  }),
  codexRow({
    section: 'features',
    key: 'multi_agent_v2.usage_hint_text',
    path: ['features', 'multi_agent_v2', 'usage_hint_text'],
    description: '多 agent 面板上的提示文本。',
    stage: 'advanced',
    valueType: 'textarea',
    options: [],
    defaultValue: '',
    localValue: 'Use a subagent for isolated checks.',
    localRawValue: '"Use a subagent for isolated checks."',
    effectiveValue: 'Use a subagent for isolated checks.',
    hasLocalValue: true,
    legacyAliases: [],
    canonicalKey: 'multi_agent_v2.usage_hint_text',
    unsupported: false,
    readOnly: false,
    hiddenByDefault: false,
    draftValue: 'Use a subagent for isolated checks.\nKeep integration in the main thread.',
    dirty: true,
    changeKind: 'modified',
    localRecordPresent: true,
  }),
  codexRow({
    section: 'root',
    key: 'notify',
    path: ['notify'],
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
    localRecordPresent: true,
  }),
];

function renderFrame(isBusy = false) {
  return (
    <DesignSystemStoryFrame label={isBusy ? 'DS-CODEX-ROWS-BUSY' : 'DS-CODEX-ROWS'}>
      <div className="overflow-hidden rounded border border-[var(--gt-border-subtle)]">
        <StatusCodexConfigRows
          rows={rows}
          badgeLabel="配置"
          isBusy={isBusy}
          parentMode="section"
          resolveDescription={(row) => row.description}
          onChangeSetting={() => undefined}
          onRemoveSetting={() => undefined}
        />
      </div>
    </DesignSystemStoryFrame>
  );
}

export const Overview: Story = {
  render: () => renderFrame(false),
};

export const Busy: Story = {
  render: () => renderFrame(true),
};
