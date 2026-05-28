import { useMemo, useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import StatusSnippetPanel from '../../status/components/StatusSnippetPanel';
import {
  buildClaudeCodeSettingsDiff,
  buildCodexLocalApplyDiff,
} from '../../status/model/relayLocalState';
import type {
  AccountCliApplyDraft,
  AccountLocalCliRelayKeyLike,
} from '../model/accountLocalCliMapping';

interface AccountLocalCliApplyConfirmProps {
  draft: AccountCliApplyDraft;
  relayKeyItems: AccountLocalCliRelayKeyLike[];
  applying: boolean;
  resultMessage: string;
  previewMode: boolean;
  deepLinkContext?: DeepLinkApplyContext;
  onClose: () => void;
  onDraftChange: (draft: AccountCliApplyDraft) => void;
  onApply: (draft: AccountCliApplyDraft) => void;
  onImportAccountOnly?: () => void;
}

interface PreviewFile {
  id: string;
  path: string;
  diff: string;
}

export interface DeepLinkApplyContext {
  source?: string;
  resource: 'codex-config' | 'codex-setup';
  providerScope: 'current-active' | 'create-new';
  providerRewriteMode?: 'keep-current' | 'patch-current' | 'create-new';
  providerCompatibility?: 'compatible' | 'blocked_builtin_openai' | 'missing_chatgpt_auth' | 'missing_provider_section';
  redactedURL?: string;
  accountDraft?: {
    accountType: string;
    title: string;
    baseUrl?: string;
    apiKeyPreview?: string;
  };
}

type ClaudeDraft = Extract<AccountCliApplyDraft, { target: 'claude' }>['claude'];
type ClaudeTextField =
  | 'apiKey'
  | 'baseUrl'
  | 'model'
  | 'defaultHaikuModel'
  | 'defaultSonnetModel'
  | 'defaultOpusModel'
  | 'smallFastModel'
  | 'maxOutputTokens'
  | 'apiTimeoutMs';
type ClaudeBooleanField = 'disableNonEssentialTraffic' | 'claudeCodeAttributionHeader';

export default function AccountLocalCliApplyConfirm({
  draft,
  relayKeyItems,
  applying,
  resultMessage,
  previewMode,
  deepLinkContext,
  onClose,
  onDraftChange,
  onApply,
  onImportAccountOnly,
}: AccountLocalCliApplyConfirmProps) {
  const previewFiles = useMemo(() => buildPreviewFiles(draft, relayKeyItems), [draft, relayKeyItems]);
  const [selectedFileID, setSelectedFileID] = useState(previewFiles[0]?.id || '');
  const selectedFile = previewFiles.find((file) => file.id === selectedFileID) || previewFiles[0];
  const blockingWarnings = draft.source.warnings.filter((warning) => warning.severity === 'blocking');
  const canApply = draft.source.enabled && blockingWarnings.length === 0 && !applying;
  const title = draft.target === 'codex' ? '应用模板到 Codex' : '应用模板到 Claude Code';
  const modeLabel = draft.target === 'codex'
    ? draft.codex.authStrategy === 'replace_auth_with_apikey'
      ? 'API Key 写入模式'
      : draft.codex.authStrategy === 'replace_auth_with_oauth'
        ? 'OAuth 写入模式'
        : 'OAuth 保留模式'
    : draft.claude.authField === 'ANTHROPIC_AUTH_TOKEN'
      ? 'Claude Code Auth Token 模式'
      : 'Claude Code API Key 模式';
  const providerLabel = draft.target === 'codex'
    ? `${draft.codex.providerName} / ${draft.codex.providerID}`
    : 'Claude settings env';
  const handleClaudeTextChange = (field: ClaudeTextField, value: string) => {
    if (draft.target !== 'claude') {
      return;
    }
    onDraftChange({
      ...draft,
      claude: {
        ...draft.claude,
        [field]: value,
      },
    });
  };
  const handleClaudeBooleanChange = (field: ClaudeBooleanField, value: boolean) => {
    if (draft.target !== 'claude') {
      return;
    }
    onDraftChange({
      ...draft,
      claude: {
        ...draft.claude,
        [field]: value,
      },
    });
  };
  const handleClaudeAuthFieldChange = (value: ClaudeDraft['authField']) => {
    if (draft.target !== 'claude') {
      return;
    }
    onDraftChange({
      ...draft,
      claude: {
        ...draft.claude,
        authField: value,
      },
    });
  };

  return (
    <ModalFrame
      size="detail"
      onClose={onClose}
      ariaLabel={title}
      header={
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              FILE PREVIEW CONFIRM
            </div>
            <h2 className="mt-1 text-xl font-black uppercase italic tracking-normal text-[var(--text-primary)]">
              {title}
            </h2>
            <div className="mt-3 flex max-w-full flex-wrap gap-2">
              <SummaryBadge label="来源账号" value={draft.source.accountTitle} />
              <SummaryBadge label="模板" value={draft.source.templateName} />
              <SummaryBadge label="模式" value={modeLabel} />
              <SummaryBadge label={draft.target === 'codex' ? '当前 provider' : '写入目标'} value={providerLabel} />
              {deepLinkContext ? <SummaryBadge label="外部来源" value={deepLinkContext.source || 'DEEP LINK'} tone="warning" /> : null}
              {deepLinkContext ? <SummaryBadge label="resource" value={deepLinkContext.resource} /> : null}
              {deepLinkContext ? <SummaryBadge label="providerScope" value={deepLinkContext.providerScope} /> : null}
              {deepLinkContext?.providerRewriteMode ? (
                <SummaryBadge label="providerRewriteMode" value={deepLinkContext.providerRewriteMode} />
              ) : null}
              {previewMode ? <SummaryBadge label="运行环境" value="PREVIEW ONLY" tone="warning" /> : null}
            </div>
            {deepLinkContext?.redactedURL ? (
              <div className="mt-3 max-w-full truncate border-2 border-dashed border-[var(--border-muted)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {deepLinkContext.redactedURL}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="btn-swiss active:scale-95">
            关闭
          </button>
        </div>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-swiss active:scale-95">
            取消
          </button>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <div className="max-w-xl truncate font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
              {resultMessage || (blockingWarnings[0]?.message ?? (previewMode ? 'PREVIEW ONLY / 未写入' : '等待确认 / 未写入'))}
            </div>
            {onImportAccountOnly ? (
              <button
                type="button"
                disabled={applying}
                onClick={onImportAccountOnly}
                className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-xs)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                只导入账号
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onApply(draft)}
              className="btn-swiss bg-[var(--border-color)] !px-3 !py-2 !text-[length:var(--font-size-ui-xs)] !text-[var(--bg-main)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying ? '正在应用' : canApply ? '确认并应用' : '无法应用'}
            </button>
          </div>
        </>
      }
      bodyClassName="bg-[var(--bg-surface)]"
    >
      <div className="grid h-[clamp(24rem,calc(100vh-12rem),38rem)] min-h-0 gap-0 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="grid min-h-0 content-start gap-3 overflow-auto border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 lg:border-b-0 lg:border-r-2">
          {deepLinkContext ? <DeepLinkAdapterPanel context={deepLinkContext} /> : null}
          {draft.target === 'claude' ? (
            <div className="grid gap-3 border-2 border-[var(--border-muted)] bg-[var(--bg-surface)] p-3">
              <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Claude Code 配置
              </div>
              <ClaudeSettingsField
                label="API KEY / TOKEN"
                field="apiKey"
                value={draft.claude.apiKey}
                placeholder="留空使用 relay key"
                type="password"
                onChange={handleClaudeTextChange}
              />
              <ClaudeSettingsField
                label="BASE URL"
                field="baseUrl"
                value={draft.claude.baseUrl}
                onChange={handleClaudeTextChange}
              />
              <ClaudeSettingsField
                label="MODEL"
                field="model"
                value={draft.claude.model}
                onChange={handleClaudeTextChange}
              />
              <ClaudeSettingsField
                label="HAIKU"
                field="defaultHaikuModel"
                value={draft.claude.defaultHaikuModel}
                onChange={handleClaudeTextChange}
              />
              <ClaudeSettingsField
                label="SONNET"
                field="defaultSonnetModel"
                value={draft.claude.defaultSonnetModel}
                onChange={handleClaudeTextChange}
              />
              <ClaudeSettingsField
                label="OPUS"
                field="defaultOpusModel"
                value={draft.claude.defaultOpusModel}
                onChange={handleClaudeTextChange}
              />
              <ClaudeSettingsField
                label="SMALL FAST"
                field="smallFastModel"
                value={draft.claude.smallFastModel}
                onChange={handleClaudeTextChange}
              />
              <div className="grid grid-cols-2 gap-2">
                <ClaudeSettingsField
                  label="MAX TOKENS"
                  field="maxOutputTokens"
                  value={draft.claude.maxOutputTokens}
                  onChange={handleClaudeTextChange}
                />
                <ClaudeSettingsField
                  label="TIMEOUT MS"
                  field="apiTimeoutMs"
                  value={draft.claude.apiTimeoutMs}
                  onChange={handleClaudeTextChange}
                />
              </div>
              <label className="grid gap-1">
                <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  AUTH FIELD
                </span>
                <select
                  value={draft.claude.authField}
                  onChange={(event) => handleClaudeAuthFieldChange(event.target.value as ClaudeDraft['authField'])}
                  className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent-red)]"
                >
                  <option value="ANTHROPIC_API_KEY">ANTHROPIC_API_KEY</option>
                  <option value="ANTHROPIC_AUTH_TOKEN">ANTHROPIC_AUTH_TOKEN</option>
                </select>
              </label>
              <label className="flex items-center gap-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={draft.claude.disableNonEssentialTraffic}
                  onChange={(event) => handleClaudeBooleanChange('disableNonEssentialTraffic', event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-red)]"
                />
                Disable nonessential traffic
              </label>
              <label className="flex items-center gap-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={draft.claude.claudeCodeAttributionHeader}
                  onChange={(event) => handleClaudeBooleanChange('claudeCodeAttributionHeader', event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent-red)]"
                />
                Attribution header
              </label>
            </div>
          ) : null}
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            文件列表
          </div>
          <div className="grid gap-2">
            {previewFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedFileID(file.id)}
                className={`grid border-2 px-3 py-3 text-left active:scale-[0.99] ${
                  selectedFile?.id === file.id
                    ? 'border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[4px_4px_0_var(--shadow-color)]'
                    : 'border-[var(--border-muted)] bg-[var(--bg-main)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                <span className="break-all font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
                  {file.path}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 min-w-0 overflow-auto p-4">
          {selectedFile ? (
            <StatusSnippetPanel
              title={`文件改动 / ${selectedFile.path}`}
              content={selectedFile.diff}
              preClassName="max-h-[31.5rem]"
            />
          ) : null}
        </div>
      </div>
    </ModalFrame>
  );
}

function ClaudeSettingsField({
  label,
  field,
  value,
  placeholder = '',
  type = 'text',
  onChange,
}: {
  label: string;
  field: ClaudeTextField;
  value: string;
  placeholder?: string;
  type?: 'text' | 'password';
  onChange: (field: ClaudeTextField, value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(field, event.target.value)}
        className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent-red)]"
      />
    </label>
  );
}

function SummaryBadge({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 border-2 px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] ${
        tone === 'warning'
          ? 'border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_10%,transparent)] text-[var(--color-status-warning)]'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
      }`}
    >
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function DeepLinkAdapterPanel({ context }: { context: DeepLinkApplyContext }) {
  return (
    <div className="grid gap-3 border-2 border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_10%,transparent)] p-3">
      <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--color-status-warning)]">
        Deep link adapter
      </div>
      <div className="text-[length:var(--font-size-ui-sm)] font-black leading-snug text-[var(--text-primary)]">
        外部链接已转换为 Codex local apply 草稿。
      </div>
      <div className="grid gap-2 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <span>resource: {context.resource}</span>
        <span>providerScope: {context.providerScope}</span>
        {context.providerRewriteMode ? <span>providerRewriteMode: {context.providerRewriteMode}</span> : null}
        {context.providerCompatibility ? <span>providerCompatibility: {context.providerCompatibility}</span> : null}
      </div>
      {context.accountDraft ? (
        <div className="grid gap-1 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3">
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            账号草稿
          </div>
          <div className="break-words text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
            {context.accountDraft.accountType} / {context.accountDraft.title}
          </div>
          {context.accountDraft.baseUrl ? (
            <div className="break-all font-mono text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">
              base_url: {context.accountDraft.baseUrl}
            </div>
          ) : null}
          {context.accountDraft.apiKeyPreview ? (
            <div className="break-all font-mono text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">
              api_key: {context.accountDraft.apiKeyPreview}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function buildPreviewFiles(draft: AccountCliApplyDraft, relayKeyItems: AccountLocalCliRelayKeyLike[]): PreviewFile[] {
  const relayKey = relayKeyItems[draft.source.relayKeyIndex]?.value || '';
  if (draft.target === 'claude') {
    const apiKey = draft.claude.apiKey || relayKey;
    return [
      {
        id: 'claude-settings',
        path: '~/.claude/settings.json',
        diff: buildClaudeCodeSettingsDiff({
          apiKey,
          baseUrl: draft.claude.baseUrl,
          model: draft.claude.model,
          defaultHaikuModel: draft.claude.defaultHaikuModel,
          defaultSonnetModel: draft.claude.defaultSonnetModel,
          defaultOpusModel: draft.claude.defaultOpusModel,
          smallFastModel: draft.claude.smallFastModel,
          maxOutputTokens: draft.claude.maxOutputTokens,
          apiTimeoutMs: draft.claude.apiTimeoutMs,
          disableNonEssentialTraffic: draft.claude.disableNonEssentialTraffic,
          claudeCodeAttributionHeader: draft.claude.claudeCodeAttributionHeader,
          authField: draft.claude.authField,
        }),
      },
    ];
  }

  const codexAPIKey = draft.codex.authStrategy === 'replace_auth_with_apikey'
    ? draft.codex.apiKey
    : relayKey;
  const diff = buildCodexLocalApplyDiff({
    apiKey: codexAPIKey,
    baseUrl: draft.codex.baseUrl,
    model: draft.codex.model,
    reasoningEffort: draft.codex.reasoningEffort,
    providerID: draft.codex.providerID,
    providerName: draft.codex.providerName,
    supportsWebsockets: draft.codex.supportsWebsockets,
    authStrategy: draft.codex.authStrategy,
  });
  const configDiffStart = diff.indexOf('--- CODEX_HOME/config.toml');
  const authDiff = configDiffStart >= 0 ? diff.slice(0, configDiffStart).trim() : diff;
  const configDiff = configDiffStart >= 0 ? diff.slice(configDiffStart).trim() : diff;

  return [
    ...(draft.codex.authStrategy === 'replace_auth_with_apikey' || draft.codex.authStrategy === 'replace_auth_with_oauth'
      ? [
          {
            id: 'codex-auth',
            path: 'CODEX_HOME/auth.json',
            diff: authDiff || '# CODEX_HOME/auth.json 无写入 diff',
          },
        ]
      : []),
    {
      id: 'codex-config',
      path: 'CODEX_HOME/config.toml',
      diff: configDiff,
    },
  ];
}
