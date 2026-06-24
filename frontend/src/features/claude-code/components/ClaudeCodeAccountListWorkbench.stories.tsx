import type { Meta, StoryObj } from '@storybook/react-vite';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import {
  ClaudeCodeAccountListWorkbench,
  type ClaudeCodeAccountListWorkbenchProps,
} from './ClaudeCodeAccountListWorkbench';

const meta = {
  title: 'Design System/业务组件/Claude Code 账号列表',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const accounts: ClaudeCodeAccountListWorkbenchProps['accounts'] = [
  {
    id: 'deepseek:team-main',
    label: 'DeepSeek Team Relay',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    anthropicBaseUrl: 'https://api.deepseek.com/anthropic',
    priority: 40,
    requestable: true,
    supportedFormats: ['anthropic', 'openai'],
    mappingCount: 4,
    profileName: 'DeepSeek Claude Code',
  },
  {
    id: 'bailian:coding-plan',
    label: '百炼 Coding Plan',
    provider: 'bailian',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    anthropicBaseUrl: 'https://dashscope.aliyuncs.com/api/v2/apps/claude-code',
    priority: 30,
    requestable: true,
    supportedFormats: ['anthropic'],
    mappingCount: 3,
    profileName: 'Bailian Coding Plan',
  },
  {
    id: 'mimo:shared',
    label: 'Xiaomi MiMo Shared',
    provider: 'mimo',
    baseUrl: 'https://platform.xiaomimimo.com/v1',
    priority: 20,
    requestable: true,
    supportedFormats: ['anthropic', 'openai'],
    mappingCount: 2,
    profileName: 'MiMo Claude Code',
  },
  {
    id: 'minimax:disabled-backup',
    label: 'MiniMax Backup',
    provider: 'minimax',
    baseUrl: 'https://api.minimax.chat/v1',
    priority: 10,
    requestable: false,
    disabled: true,
    blockReason: 'disabled',
    supportedFormats: ['anthropic'],
    mappingCount: 1,
    profileName: 'MiniMax M2.7',
  },
];

const profiles: ClaudeCodeAccountListWorkbenchProps['profiles'] = [
  {
    provider: 'DeepSeek',
    plan: 'Claude Code integration',
    defaultModel: 'deepseek-v4-pro[1m]',
    haikuModel: 'deepseek-v4-flash',
    switchableModels: ['deepseek-v4-pro[1m]', 'deepseek-v4-flash'],
    localApplyHint: 'ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN',
  },
  {
    provider: '百炼',
    plan: 'Token Plan / Coding Plan / Pay-as-you-go',
    defaultModel: 'qwen3.6-plus',
    haikuModel: 'qwen3.6-flash',
    switchableModels: ['qwen3.6-plus', 'qwen3.6-flash'],
    localApplyHint: 'ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN + plan headers',
    tone: 'draft',
  },
  {
    provider: 'Xiaomi MiMo',
    plan: 'Claude Code integration',
    defaultModel: 'mimo-v2.5-pro',
    switchableModels: ['mimo-v2.5-pro[1m]', 'mimo-v2.5-pro', 'mimo-v2-pro', 'mimo-v2.5', 'mimo-v2-omni', 'mimo-v2-flash', 'mimo-v2.5-tts'],
    localApplyHint: 'ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN',
  },
  {
    provider: 'MiniMax',
    plan: 'Claude Code integration',
    defaultModel: 'MiniMax-M2.7',
    switchableModels: ['MiniMax-M2.7'],
    localApplyHint: 'ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN',
  },
];

const mappings: ClaudeCodeAccountListWorkbenchProps['mappings'] = [
  {
    provider: 'deepseek',
    realModel: 'deepseek-v4-pro[1m]',
    claudeAlias: 'claude-sonnet-4-6',
    source: 'official-profile',
  },
  {
    provider: 'deepseek',
    realModel: 'deepseek-v4-flash',
    claudeAlias: 'claude-3-5-haiku-latest',
    source: 'official-profile',
  },
  {
    provider: 'bailian',
    realModel: 'qwen3.6-plus',
    claudeAlias: 'claude-sonnet-4-6',
    source: 'saved',
  },
  {
    provider: 'mimo',
    realModel: 'mimo-v2.5-pro',
    claudeAlias: 'claude-opus-4-5',
    source: 'official-profile',
  },
  {
    provider: 'kimi',
    realModel: 'kimi-k2.5',
    claudeAlias: 'claude-sonnet-4-6',
    source: 'migration-hint',
  },
];

const probeLines = [
  '$ gt relay probe --format anthropic --model claude-sonnet-4-6',
  '[1] deepseek:team-main -> deepseek-v4-pro[1m] 200 812ms',
  '[2] bailian:coding-plan skipped by policy preview',
  '[3] mimo:shared ready, fallback not used',
  '[4] minimax:disabled-backup disabled, retained in order only',
];

function sampleProps(overrides: Partial<ClaudeCodeAccountListWorkbenchProps> = {}): ClaudeCodeAccountListWorkbenchProps {
  return {
    state: 'ready',
    accounts,
    profiles,
    mappings,
    probeLines,
    ...overrides,
  };
}

function WorkbenchSample({ label, props }: { label: string; props: ClaudeCodeAccountListWorkbenchProps }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <ClaudeCodeAccountListWorkbench {...props} />
    </DesignSystemStoryFrame>
  );
}

function ClaudeCodeAccountListOverview() {
  const conflictProfiles = profiles.map((profile) =>
    profile.provider === '百炼' ? { ...profile, tone: 'warning' as const } : profile,
  );
  const blockedAccounts = accounts.map((account) =>
    account.id === 'mimo:shared'
      ? { ...account, requestable: false, blockReason: 'rate-limit', disabled: false }
      : account,
  );

  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-muted)] p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">Claude Code Account List</h2>
        <p className="mt-2 max-w-4xl text-sm font-semibold text-[var(--gt-ink-muted)]">
          设计系统业务入口覆盖 Anthropic 格式账号筛选、请求顺序、官方默认 profile、模型映射草稿和路由探测状态；所有示例使用固定 mock 数据。
        </p>
      </div>

      <div className="grid gap-5">
        <WorkbenchSample label="DS-CLAUDE-CODE-READY" props={sampleProps()} />
        <WorkbenchSample
          label="DS-CLAUDE-CODE-SOURCE-CONFLICT"
          props={sampleProps({
            state: 'source-conflict',
            profiles: conflictProfiles,
            probeLines: [
              '$ profile diff bailian --saved-first',
              '[saved] qwen3.6-plus -> claude-sonnet-4-6 kept',
              '[official] qwen3.6-plus remains default profile',
            ],
          })}
        />
        <WorkbenchSample
          label="DS-CLAUDE-CODE-DISABLED-BLOCKED"
          props={sampleProps({
            state: 'disabled-blocked',
            accounts: blockedAccounts,
          })}
        />
        <WorkbenchSample
          label="DS-CLAUDE-CODE-PROFILE-DRAFT"
          props={sampleProps({
            state: 'profile-draft',
            mappings: mappings.filter((mapping) => mapping.source !== 'saved'),
          })}
        />
      </div>
    </div>
  );
}

export const Overview: Story = {
  render: () => <ClaudeCodeAccountListOverview />,
};

export const Ready: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-CODE-READY" props={sampleProps()} />,
};

export const SourceConflict: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-CODE-SOURCE-CONFLICT" props={sampleProps({ state: 'source-conflict' })} />,
};

export const DisabledBlocked: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-CODE-DISABLED-BLOCKED" props={sampleProps({ state: 'disabled-blocked' })} />,
};

export const ProfileDraft: Story = {
  render: () => <WorkbenchSample label="DS-CLAUDE-CODE-PROFILE-DRAFT" props={sampleProps({ state: 'profile-draft' })} />,
};
