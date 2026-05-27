import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import type { ClaudeCodeLocalApplyDraft, LocalCodexAuthStateLike } from '../model/relayLocalState';
import {
  buildClaudeCodeSettingsDiff,
  buildCodexLocalApplyDiff,
  getCodexLocalApplyPreflight,
  resolveCodexLocalApplyState,
  type CodexLocalAuthStrategy,
} from '../model/relayLocalState';
import type { RelayResolvedModelOption } from '../model/relayModelCatalog';
import type { RelayProviderOption } from '../model/relayProviderCatalog';
import { formatRelayProviderSelectLabel, StatusApplyLocalSection } from './StatusPanels';
import StatusSnippetPanel from './StatusSnippetPanel';

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
  { id: 'gettokens-deepseek', name: 'GetTokens / DeepSeek' },
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

      <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">账号模板确认页</h3>
        <AccountTemplateLocalApplyConfirmSample label="DS-ACCOUNT-TEMPLATE-CONFIRM" />
      </section>
    </div>
  );
}

type TemplateConfirmTarget = 'codex' | 'claude';

const templateSource = {
  accountID: 'codex-api-key:deepseek-coding-plan',
  accountTitle: 'DeepSeek Coding Plan',
  templateID: 'deepseek',
  templateName: 'DeepSeek',
  status: '可请求',
  sourceFormat: 'anthropic / Claude Code official',
  sourceBaseUrl: 'https://api.deepseek.com/anthropic',
  relayBaseUrl: endpoints[0].baseUrl,
  relayKeyLabel: 'Relay Key 1 / sk-relay-preview-primary',
  codexDisabledReason: 'DeepSeek 官方 coding-agent guide 当前只提供 Claude Code / OpenCode / OpenClaw，没有 Codex 官方模板。',
};

const templateClaudeDraft: ClaudeCodeLocalApplyDraft = {
  relayKeyIndex: 0,
  baseUrl: endpoints[0].baseUrl,
  model: 'deepseek-v4-pro',
  defaultHaikuModel: 'deepseek-v4-flash',
  defaultSonnetModel: 'deepseek-v4-pro',
  defaultOpusModel: 'deepseek-v4-pro',
  smallFastModel: 'deepseek-v4-flash',
  maxOutputTokens: '6000',
  apiTimeoutMs: '600000',
  disableNonEssentialTraffic: true,
  claudeCodeAttributionHeader: false,
  authField: 'ANTHROPIC_API_KEY',
};

function AccountTemplateLocalApplyConfirmSample({ label }: { label: string }) {
  const [target, setTarget] = useState<TemplateConfirmTarget>('claude');
  const [authStrategy, setAuthStrategy] = useState<CodexLocalAuthStrategy>('preserve_chatgpt_auth');
  const [providerID, setProviderID] = useState('gettokens-deepseek');
  const [codexModel, setCodexModel] = useState('deepseek-v4-pro');
  const [claudeModel, setClaudeModel] = useState(templateClaudeDraft.model);
  const [result, setResult] = useState('');
  const availableTargets: TemplateConfirmTarget[] = ['claude'];
  const supportsCodexTemplate = availableTargets.includes('codex');
  const selectedRelayKey = relayKeyItems[0]?.value || '';
  const selectedProvider = providerOptions.find((provider) => provider.id === providerID) || providerOptions[0];
  const preflight = useMemo(
    () =>
      getCodexLocalApplyPreflight({
        authStrategy,
        providerID: selectedProvider.id,
        authState: chatGPTAuthState,
      }),
    [authStrategy, selectedProvider.id]
  );
  const codexApplyState = useMemo(
    () =>
      resolveCodexLocalApplyState({
        isApplyingToLocal: false,
        isReady: true,
        selectedRelayKey,
        selectedProviderID: selectedProvider.id,
        providerOptions,
        preflight,
      }),
    [preflight, selectedProvider.id, selectedRelayKey]
  );
  const diff =
    target === 'codex'
      ? buildCodexLocalApplyDiff({
          apiKey: selectedRelayKey,
          baseUrl: templateSource.relayBaseUrl,
          model: codexModel,
          reasoningEffort: 'high',
          providerID: selectedProvider.id,
          providerName: selectedProvider.name,
          supportsWebsockets: true,
          authStrategy,
        })
      : buildClaudeCodeSettingsDiff({
          ...templateClaudeDraft,
          apiKey: selectedRelayKey,
          model: claudeModel,
          targetPath: '~/.claude/settings.json',
        });
  const canApply = target === 'claude' ? true : supportsCodexTemplate && codexApplyState.canApply;
  const targetLabel = target === 'codex' ? 'Codex' : 'Claude Code';
  const isCodexPreserveMode = target === 'codex' && authStrategy === 'preserve_chatgpt_auth';
  const controlledFields =
    target === 'codex'
      ? isCodexPreserveMode
        ? [
            'CODEX_HOME/config.toml: model / model_reasoning_effort / model_provider',
            `model_providers.${selectedProvider.id}: base_url / wire_api / requires_openai_auth / experimental_bearer_token`,
          ]
        : [
            'CODEX_HOME/auth.json: auth_mode = apikey / OPENAI_API_KEY',
            'CODEX_HOME/config.toml: model / provider / wire_api',
          ]
      : ['~/.claude/settings.json env: ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL / ANTHROPIC_MODEL / DEFAULT_*'];
  const preservedFields =
    target === 'codex'
      ? isCodexPreserveMode
        ? [
            'CODEX_HOME/auth.json: auth_mode / OPENAI_API_KEY / tokens / account metadata 原样保留',
            'MCP servers / profiles / agents / comments',
          ]
        : ['MCP servers / profiles / agents / comments', '未受控 provider / profiles / unknown sections']
      : ['permissions / hooks / statusLine / MCP', 'HTTP_PROXY / 未知 env 字段'];

  function confirmApply() {
    setResult(`PREVIEW ONLY / ${targetLabel} 草稿已确认，真实实现会调用既有 local apply handler。`);
  }

  return (
    <DesignSystemStoryFrame label={label}>
      <div className="grid gap-4 bg-[var(--bg-surface)] p-4">
        <div className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              TEMPLATE APPLY CONFIRM
            </div>
            <h2 className="mt-1 text-xl font-black uppercase italic tracking-normal text-[var(--text-primary)]">
              {templateSource.templateName} {'->'} {targetLabel}
            </h2>
            <div className="mt-2 grid gap-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)] md:grid-cols-2">
              <span>来源账号：{templateSource.accountTitle}</span>
              <span>模板：{templateSource.templateID}</span>
              <span>格式：{templateSource.sourceFormat}</span>
              <span>状态：{templateSource.status}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTargets.map((nextTarget) => (
              <button
                key={nextTarget}
                type="button"
                onClick={() => {
                  setTarget(nextTarget);
                  setResult('');
                }}
                className={`btn-swiss active:scale-95 ${
                  target === nextTarget ? 'bg-[var(--border-color)] !text-[var(--bg-main)]' : ''
                }`}
              >
                {nextTarget === 'codex' ? 'Codex' : 'Claude Code'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-4">
            <ConfirmSection title="来源与目标">
              <ConfirmRow label="Relay Key" value={templateSource.relayKeyLabel} />
              <ConfirmRow label="Relay Endpoint" value={templateSource.relayBaseUrl} />
              <ConfirmRow label="上游模板端点" value={templateSource.sourceBaseUrl} />
              <ConfirmRow label="官方模板目标" value="Claude Code" />
              <ConfirmRow label="写入模式" value="P0 只写 GetTokens relay，不直写上游 key" tone="warning" />
              <ConfirmNotice tone="warning" text={`未展示 Codex 动作：${templateSource.codexDisabledReason}`} />
            </ConfirmSection>

            {target === 'codex' ? (
              <ConfirmSection title="Codex 配置">
                <label className="grid gap-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Provider
                  </span>
                  <select value={providerID} onChange={(event) => setProviderID(event.target.value)} className="select-swiss">
                    {providerOptions.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {formatRelayProviderSelectLabel(provider)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Auth Strategy
                  </span>
                  <select
                    value={authStrategy}
                    onChange={(event) => setAuthStrategy(event.target.value as CodexLocalAuthStrategy)}
                    className="select-swiss"
                  >
                    <option value="preserve_chatgpt_auth">保留 ChatGPT 登录</option>
                    <option value="replace_auth_with_apikey">写入 API Key</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Model
                  </span>
                  <input value={codexModel} onChange={(event) => setCodexModel(event.target.value)} className="input-swiss" />
                </label>
                {codexApplyState.canApply ? (
                  <ConfirmNotice
                    tone="success"
                    text={
                      authStrategy === 'preserve_chatgpt_auth'
                        ? 'OAuth preserve 通过：auth.json 只读校验，写入 custom provider + experimental_bearer_token。'
                        : 'Preflight 通过：确认后写入 auth.json API Key 模式与 config.toml。'
                    }
                  />
                ) : (
                  <ConfirmNotice tone="danger" text={`Preflight 阻断：${codexApplyState.disabledReason}`} />
                )}
              </ConfirmSection>
            ) : (
              <ConfirmSection title="Claude Code 配置">
                <label className="grid gap-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    ANTHROPIC_MODEL
                  </span>
                  <input value={claudeModel} onChange={(event) => setClaudeModel(event.target.value)} className="input-swiss" />
                </label>
                <ConfirmRow label="Haiku" value={templateClaudeDraft.defaultHaikuModel} />
                <ConfirmRow label="Sonnet" value={templateClaudeDraft.defaultSonnetModel} />
                <ConfirmRow label="Opus" value={templateClaudeDraft.defaultOpusModel} />
                <ConfirmNotice tone="warning" text="如果本机已有 ANTHROPIC_AUTH_TOKEN，后端会保留并返回冲突 warning。" />
              </ConfirmSection>
            )}

            <ConfirmSection title="受控与保留">
              <ConfirmList title="将修改" items={controlledFields} />
              <ConfirmList title="明确保留" items={preservedFields} />
            </ConfirmSection>
          </div>

          <StatusSnippetPanel
            title={`${targetLabel} 修改预览`}
            content={diff}
            onCopy={() => setResult('Diff copied / preview')}
            headerAction={
              <button
                type="button"
                disabled={!canApply}
                onClick={confirmApply}
                className="btn-swiss bg-[var(--border-color)] !px-3 !py-1 !text-[length:var(--font-size-ui-xs)] !text-[var(--bg-main)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                确认并应用
              </button>
            }
            preClassName="max-h-[36rem]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3">
          <button type="button" onClick={() => setResult('已取消 / 未写入任何本地文件')} className="btn-swiss active:scale-95">
            取消
          </button>
          <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
            {result || '等待确认 / 未写入'}
          </div>
        </div>
      </div>
    </DesignSystemStoryFrame>
  );
}

function ConfirmSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
      <h3 className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ConfirmRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={`break-all font-mono text-[length:var(--font-size-ui-sm)] font-bold ${
          tone === 'warning' ? 'text-[var(--color-status-warning)]' : 'text-[var(--text-primary)]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ConfirmList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="grid gap-2">
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {title}
      </div>
      <div className="grid gap-1">
        {items.map((item) => (
          <div
            key={item}
            className="border-l-4 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-primary)]"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmNotice({ tone, text }: { tone: 'success' | 'warning' | 'danger'; text: string }) {
  const color =
    tone === 'success'
      ? 'var(--color-status-success)'
      : tone === 'danger'
        ? 'var(--color-status-danger)'
        : 'var(--color-status-warning)';
  return (
    <div
      className="border-2 border-dashed bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide"
      style={{ borderColor: color, color }}
    >
      {text}
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

export const AccountTemplateConfirm: Story = {
  render: () => <AccountTemplateLocalApplyConfirmSample label="DS-ACCOUNT-TEMPLATE-CONFIRM" />,
};
