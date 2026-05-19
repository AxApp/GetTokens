import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { LocalCodexAuthStateLike } from '../model/relayLocalState';
import type { RelayResolvedModelOption } from '../model/relayModelCatalog';
import type { RelayProviderOption } from '../model/relayProviderCatalog';
import { StatusApplyLocalSection } from './StatusPanels';

const meta = {
  title: 'Design System/业务组件/状态页本地 CLI 应用',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy: Record<string, string> = {
  'common.copy': '复制',
  'status.apply_local_claude': '应用到 Claude Code',
  'status.apply_local_codex': '应用到 Codex',
  'status.applying_local': '应用中',
  'status.auth_strategy_preserve_chatgpt': '保留 ChatGPT 登录',
  'status.auth_strategy_replace_apikey': '写入 API Key',
  'status.auth_strategy_title': '认证策略',
  'status.claude_api_timeout_ms': 'API timeout',
  'status.claude_default_haiku_model': 'Haiku 默认模型',
  'status.claude_default_opus_model': 'Opus 默认模型',
  'status.claude_default_sonnet_model': 'Sonnet 默认模型',
  'status.claude_disable_nonessential_traffic': '禁用非必要流量',
  'status.claude_max_output_tokens': '最大输出 Token',
  'status.claude_settings_diff': 'Claude settings diff',
  'status.claude_settings_diff_copied': 'Claude diff 已复制',
  'status.claude_small_fast_model': 'Small fast 模型',
  'status.codex_local_apply_blocked_missing_key': '缺少 Relay Key，无法写入本地配置',
  'status.codex_local_apply_blocked_not_ready': '服务未 ready',
  'status.codex_local_auth_apikey': '当前 auth.json 使用 API Key',
  'status.codex_local_auth_chatgpt_ready': 'ChatGPT 登录可保留',
  'status.codex_local_auth_chatgpt_tokens': 'ChatGPT tokens 模式',
  'status.codex_local_auth_missing': '未读取到 auth.json',
  'status.codex_local_auth_state_title': '本地 Codex 认证状态',
  'status.codex_local_auth_unknown': '未知认证状态',
  'status.codex_local_diff': 'Codex config diff',
  'status.codex_local_diff_copied': 'Codex diff 已复制',
  'status.codex_local_preserve_hint': '将保留 ChatGPT 登录，只写入自定义 provider 配置',
  'status.codex_local_preserve_requires_chatgpt': '需要可保留的 ChatGPT 登录',
  'status.codex_local_preserve_requires_custom_provider': '保留 ChatGPT 登录需要自定义 provider',
  'status.codex_local_recovery_create_key': '创建 Relay Key',
  'status.codex_local_recovery_create_provider': '创建 Provider',
  'status.codex_local_recovery_switch_provider': '切换 Provider',
  'status.codex_local_recovery_use_apikey': '改用 API Key',
  'status.endpoint_hostname': 'HOSTNAME',
  'status.endpoint_lan': 'LAN',
  'status.endpoint_localhost': 'LOCALHOST',
  'status.endpoint_title': 'Endpoint',
  'status.lan_access_off': 'LAN OFF',
  'status.lan_access_on': 'LAN ON',
  'status.local_cli_no_relay_key': '暂无 Relay Key',
  'status.local_cli_relay_key': 'Relay Key',
  'status.local_cli_tab_claude': 'Claude Code',
  'status.local_cli_tab_codex': 'Codex',
  'status.local_cli_wire_api': 'Wire API',
  'status.model_name_required': '模型名必填',
  'status.model_name_title': '模型名',
  'status.provider_title': 'Provider',
  'status.reasoning_effort_title': 'Reasoning effort',
};

const t = (key: string) => copy[key] ?? key;

const relayKeyItems = [
  {
    value: 'sk-relay-preview-primary',
    createdAt: '2026-05-19T12:00:00Z',
    lastUsedAt: '2026-05-19T13:00:00Z',
  },
  {
    value: 'sk-relay-preview-backup',
    createdAt: '2026-05-18T12:00:00Z',
    lastUsedAt: '2026-05-18T13:00:00Z',
  },
];

const endpoints = [
  {
    id: 'localhost',
    kind: 'localhost',
    host: '127.0.0.1',
    baseUrl: 'http://127.0.0.1:18317/v1',
  },
  {
    id: 'lan',
    kind: 'lan',
    host: '192.168.1.24',
    baseUrl: 'http://192.168.1.24:18317/v1',
  },
];

const providerOptions: RelayProviderOption[] = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'gettokens-relay', name: 'GetTokens Relay' },
];

const resolvedModels: RelayResolvedModelOption[] = [
  {
    name: 'gpt-5.5',
    alias: 'frontier',
    supportedReasoningEfforts: ['low', 'medium', 'high'],
    defaultReasoningEffort: 'medium',
    fromAccountPool: true,
    fromCustom: false,
  },
  {
    name: 'claude-sonnet-4-5',
    alias: 'sonnet',
    supportedReasoningEfforts: [],
    defaultReasoningEffort: '',
    fromAccountPool: false,
    fromCustom: true,
  },
  {
    name: 'claude-haiku-4-5',
    alias: 'haiku',
    supportedReasoningEfforts: [],
    defaultReasoningEffort: '',
    fromAccountPool: false,
    fromCustom: true,
  },
  {
    name: 'claude-opus-4-5',
    alias: 'opus',
    supportedReasoningEfforts: [],
    defaultReasoningEffort: '',
    fromAccountPool: false,
    fromCustom: true,
  },
];

const chatGPTAuthState: LocalCodexAuthStateLike = {
  hasAuthFile: true,
  authMode: 'chatgpt',
  hasTokens: true,
  accountEmail: 'team-codex@example.com',
  planType: 'Pro',
  canPreserveChatGPTAuth: true,
  warnings: ['token refresh window is close'],
};

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DesignSystemStoryFrame label={label}>
      <div className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

function LocalCliApplySample({
  label,
  relayKeys = relayKeyItems,
  initialActiveTarget = 'codex',
  isReady = true,
  isApplyingToLocal = false,
  isApplyingClaude = false,
  localApplyMessage = '',
  claudeApplyMessage = '',
  selectedRelayProviderID = 'gettokens-relay',
  codexLocalAuthStrategy = 'replace_auth_with_apikey',
  localCodexAuthState = null,
  codexLocalCanApply = true,
  codexLocalApplyBlockedMessage = '',
}: {
  label: string;
  relayKeys?: typeof relayKeyItems;
  initialActiveTarget?: 'codex' | 'claude';
  isReady?: boolean;
  isApplyingToLocal?: boolean;
  isApplyingClaude?: boolean;
  localApplyMessage?: string;
  claudeApplyMessage?: string;
  selectedRelayProviderID?: string;
  codexLocalAuthStrategy?: 'replace_auth_with_apikey' | 'preserve_chatgpt_auth';
  localCodexAuthState?: LocalCodexAuthStateLike | null;
  codexLocalCanApply?: boolean;
  codexLocalApplyBlockedMessage?: string;
}) {
  return (
    <Frame label={label}>
      <StatusApplyLocalSection
        t={t}
        localApplyMessage={localApplyMessage}
        claudeApplyMessage={claudeApplyMessage}
        isLANAccessEnabled
        isApplyingToLocal={isApplyingToLocal}
        isApplyingClaude={isApplyingClaude}
        isReady={isReady}
        relayKeyItems={relayKeys}
        selectedKeyIndex={0}
        visibleRelayEndpoints={endpoints}
        selectedEndpointID="localhost"
        selectedEndpointBaseUrl={endpoints[0].baseUrl}
        relayProviderOptions={providerOptions}
        selectedRelayProviderID={selectedRelayProviderID}
        codexLocalAuthStrategy={codexLocalAuthStrategy}
        localCodexAuthState={localCodexAuthState}
        codexLocalCanApply={codexLocalCanApply}
        codexLocalApplyBlockedMessage={codexLocalApplyBlockedMessage}
        relayReasoningEffortOptions={['low', 'medium', 'high']}
        selectedRelayReasoningEffort="medium"
        selectedRelayModel="gpt-5.5"
        resolvedRelayModels={resolvedModels}
        onOpenCreateRelayKeyEditor={() => undefined}
        onToggleLANAccess={() => undefined}
        onApplyRelayConfigToLocal={() => undefined}
        onApplyClaude={() => undefined}
        onSelectKeyIndex={() => undefined}
        onSelectEndpointID={() => undefined}
        onCopyEndpointBaseUrl={() => undefined}
        onOpenCreateRelayProviderEditor={() => undefined}
        onSelectRelayProviderID={() => undefined}
        onSelectCodexLocalAuthStrategy={() => undefined}
        onDeleteRelayProviderOption={() => undefined}
        onSelectRelayReasoningEffort={() => undefined}
        onCommitRelayModelSelection={() => undefined}
        onCopyText={() => undefined}
        relayKeyDisplayName={(_, index) => `Relay Key ${index + 1}`}
        supportsWebsockets
        onToggleSupportsWebsockets={() => undefined}
        initialActiveTarget={initialActiveTarget}
      />
    </Frame>
  );
}

function StatusLocalCliApplyOverview() {
  return (
    <div className="grid w-full gap-5 bg-[var(--bg-surface)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">状态页本地 CLI 应用</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--text-muted)]">
          把本地 Codex / Claude Code 配置应用面板纳入设计系统，用固定 relay key、endpoint、provider、auth state 和 diff mock 覆盖关键分支。
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Codex states</h3>
        <div className="grid gap-4">
          <LocalCliApplySample label="DS-CODEX-READY" />
          <div className="grid gap-4 xl:grid-cols-3">
            <LocalCliApplySample
              label="DS-CODEX-BLOCKED"
              relayKeys={[]}
              codexLocalCanApply={false}
              codexLocalApplyBlockedMessage="缺少 Relay Key，无法写入本地配置"
            />
            <LocalCliApplySample
              label="DS-CODEX-PRESERVE"
              codexLocalAuthStrategy="preserve_chatgpt_auth"
              localCodexAuthState={chatGPTAuthState}
            />
            <LocalCliApplySample
              label="DS-CODEX-APPLYING"
              isApplyingToLocal
              localApplyMessage="正在写入 CODEX_HOME/config.toml"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">Claude state</h3>
        <LocalCliApplySample label="DS-CLAUDE-READY" initialActiveTarget="claude" claudeApplyMessage="settings.json preview ready" />
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <StatusLocalCliApplyOverview />,
};

export const CodexReady: Story = {
  render: () => <LocalCliApplySample label="DS-CODEX-READY" />,
};

export const ClaudeReady: Story = {
  render: () => <LocalCliApplySample label="DS-CLAUDE-READY" initialActiveTarget="claude" />,
};
