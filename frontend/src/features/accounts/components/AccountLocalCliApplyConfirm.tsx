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
import { RELAY_CODEX_REASONING_EFFORT_OPTIONS } from '../model/accountConfig';

interface AccountLocalCliApplyConfirmProps {
  draft: AccountCliApplyDraft;
  relayKeyItems: AccountLocalCliRelayKeyLike[];
  applying: boolean;
  resultMessage: string;
  previewMode: boolean;
  onClose: () => void;
  onDraftChange: (draft: AccountCliApplyDraft) => void;
  onApply: (draft: AccountCliApplyDraft) => void;
}

interface PreviewFile {
  id: string;
  path: string;
  diff: string;
}

type ClaudeDraft = Extract<AccountCliApplyDraft, { target: 'claude' }>['claude'];
type CodexDraft = Extract<AccountCliApplyDraft, { target: 'codex' }>['codex'];
type CodexAuthStrategy = CodexDraft['authStrategy'];
type CodexModelCatalogProjectionMode = NonNullable<CodexDraft['modelCatalogProjectionMode']>;
type CodexTextField =
  | 'apiKey'
  | 'baseUrl'
  | 'model'
  | 'providerID'
  | 'providerName'
  | 'reasoningEffort';
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
type CodexBooleanField = 'supportsWebsockets';

const accountLocalCliPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const accountLocalCliMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const accountLocalCliButtonClass =
  'inline-flex min-h-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-1.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
const accountLocalCliPrimaryButtonClass =
  'inline-flex min-h-8 items-center justify-center rounded border border-[var(--gt-border-strong)] bg-[var(--gt-ink-primary)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-surface-canvas)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
const accountLocalCliInputClass =
  'min-w-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2 py-2 font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] outline-none placeholder:text-[var(--gt-ink-muted)] transition focus-visible:border-[var(--gt-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--gt-border-subtle)]';
const accountLocalCliMetaClass = 'font-mono text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const accountLocalCliToggleClass = 'h-4 w-4 accent-[var(--gt-status-warning)]';

export default function AccountLocalCliApplyConfirm({
  draft,
  relayKeyItems,
  applying,
  resultMessage,
  previewMode,
  onClose,
  onDraftChange,
  onApply,
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
  const handleCodexTextChange = (field: CodexTextField, value: string) => {
    if (draft.target !== 'codex') {
      return;
    }
    onDraftChange({
      ...draft,
      codex: {
        ...draft.codex,
        [field]: value,
        ...(field === 'providerID' ? { providerIDSet: true } : {}),
        ...(field === 'providerName' ? { providerNameSet: true } : {}),
        ...(field === 'model' ? { modelSet: true } : {}),
        ...(field === 'reasoningEffort' ? { reasoningEffortSet: true } : {}),
      },
    });
  };
  const handleCodexBooleanChange = (field: CodexBooleanField, value: boolean) => {
    if (draft.target !== 'codex') {
      return;
    }
    onDraftChange({
      ...draft,
      codex: {
        ...draft.codex,
        [field]: value,
        ...(field === 'supportsWebsockets' ? { supportsWebsocketsSet: true } : {}),
      },
    });
  };
  const handleCodexAuthStrategyChange = (value: CodexAuthStrategy) => {
    if (draft.target !== 'codex') {
      return;
    }
    onDraftChange({
      ...draft,
      codex: {
        ...draft.codex,
        authStrategy: value,
      },
    });
  };
  const handleCodexModelCatalogChange = (value: CodexModelCatalogProjectionMode) => {
    if (draft.target !== 'codex') {
      return;
    }
    onDraftChange({
      ...draft,
      codex: {
        ...draft.codex,
        modelCatalogProjectionMode: value,
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
            <div className={accountLocalCliMetaClass}>
              FILE PREVIEW CONFIRM
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-[var(--gt-ink-primary)]">
              {title}
            </h2>
            <div className="mt-3 flex max-w-full flex-wrap gap-2">
              <SummaryBadge label="来源账号" value={draft.source.accountTitle} />
              <SummaryBadge label="模板" value={draft.source.templateName} />
              <SummaryBadge label="模式" value={modeLabel} />
              <SummaryBadge label={draft.target === 'codex' ? '当前 provider' : '写入目标'} value={providerLabel} />
              {previewMode ? <SummaryBadge label="运行环境" value="PREVIEW ONLY" tone="warning" /> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className={accountLocalCliButtonClass}>
            关闭
          </button>
        </div>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={accountLocalCliButtonClass}>
            取消
          </button>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <div className="max-w-xl truncate font-mono text-[length:var(--gt-font-size-sm)] font-normal tracking-normal text-[var(--gt-ink-primary)]">
              {resultMessage || (blockingWarnings[0]?.message ?? (previewMode ? 'PREVIEW ONLY / 未写入' : '等待确认 / 未写入'))}
            </div>
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onApply(draft)}
              className={accountLocalCliPrimaryButtonClass}
            >
              {applying ? '正在应用' : canApply ? '确认并应用' : '无法应用'}
            </button>
          </div>
        </>
      }
      bodyClassName="bg-[var(--gt-surface-muted)]"
    >
      <div data-account-local-cli-apply-confirm="true" className="grid h-[clamp(24rem,calc(100vh-12rem),38rem)] min-h-0 gap-0 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div data-account-local-cli-apply-rail="true" className="grid min-h-0 content-start gap-3 overflow-auto border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 lg:border-b-0 lg:border-r lg:border-[var(--gt-border-subtle)]">
          {draft.target === 'codex' ? (
            <div className={`${accountLocalCliMutedPanelClass} grid gap-3 p-3`}>
              <div className={accountLocalCliMetaClass}>
                Codex 配置
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CodexSettingsField
                  label="Provider"
                  field="providerID"
                  value={draft.codex.providerID}
                  onChange={handleCodexTextChange}
                />
                <CodexSettingsField
                  label="Name"
                  field="providerName"
                  value={draft.codex.providerName}
                  onChange={handleCodexTextChange}
                />
              </div>
              <CodexSettingsField
                label="Model 名称"
                field="model"
                value={draft.codex.model}
                onChange={handleCodexTextChange}
              />
              <CodexSettingsField
                label="Reasoning Effort"
                field="reasoningEffort"
                value={draft.codex.reasoningEffort}
                listID="codex-reasoning-effort-options"
                onChange={handleCodexTextChange}
              />
              <datalist id="codex-reasoning-effort-options">
                {RELAY_CODEX_REASONING_EFFORT_OPTIONS.map((effort) => (
                  <option key={effort} value={effort} />
                ))}
              </datalist>
              <label className="grid gap-1">
                <span className={accountLocalCliMetaClass}>
                  Auth Strategy
                </span>
                <select
                  value={draft.codex.authStrategy}
                  onChange={(event) => handleCodexAuthStrategyChange(event.target.value as CodexAuthStrategy)}
                  className={accountLocalCliInputClass}
                >
                  <option value="replace_auth_with_apikey">覆盖为 API Key</option>
                  <option value="replace_auth_with_oauth">覆盖为 OAuth</option>
                  <option value="preserve_chatgpt_auth">保留 ChatGPT Auth</option>
                </select>
              </label>
              <ReadOnlyCodexSetting label="本地 auth 状态" value={draft.codex.localAuthStatus || '未检测到本地 auth 状态'} />
              <ReadOnlyCodexSetting label="Wire API" value={draft.codex.wireAPI || 'responses'} />
              <label className="flex items-center justify-between gap-3 font-mono text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-primary)]">
                <span>supports_websockets</span>
                <input
                  type="checkbox"
                  checked={draft.codex.supportsWebsockets}
                  onChange={(event) => handleCodexBooleanChange('supportsWebsockets', event.target.checked)}
                  className={accountLocalCliToggleClass}
                />
              </label>
              <label className="flex items-center justify-between gap-3 font-mono text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-primary)]">
                <span>sync_model_catalog</span>
                <input
                  type="checkbox"
                  checked={draft.codex.modelCatalogProjectionMode === 'gettokens'}
                  onChange={(event) => handleCodexModelCatalogChange(event.target.checked ? 'gettokens' : 'off')}
                  className={accountLocalCliToggleClass}
                />
              </label>
            </div>
          ) : null}
          {draft.target === 'claude' ? (
            <div className={`${accountLocalCliMutedPanelClass} grid gap-3 p-3`}>
              <div className={accountLocalCliMetaClass}>
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
                <span className={accountLocalCliMetaClass}>
                  AUTH FIELD
                </span>
                <select
                  value={draft.claude.authField}
                  onChange={(event) => handleClaudeAuthFieldChange(event.target.value as ClaudeDraft['authField'])}
                  className={accountLocalCliInputClass}
                >
                  <option value="ANTHROPIC_API_KEY">ANTHROPIC_API_KEY</option>
                  <option value="ANTHROPIC_AUTH_TOKEN">ANTHROPIC_AUTH_TOKEN</option>
                </select>
              </label>
              <label className="flex items-center gap-2 font-mono text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-primary)]">
                <input
                  type="checkbox"
                  checked={draft.claude.disableNonEssentialTraffic}
                  onChange={(event) => handleClaudeBooleanChange('disableNonEssentialTraffic', event.target.checked)}
                  className={accountLocalCliToggleClass}
                />
                Disable nonessential traffic
              </label>
              <label className="flex items-center gap-2 font-mono text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-primary)]">
                <input
                  type="checkbox"
                  checked={draft.claude.claudeCodeAttributionHeader}
                  onChange={(event) => handleClaudeBooleanChange('claudeCodeAttributionHeader', event.target.checked)}
                  className={accountLocalCliToggleClass}
                />
                Attribution header
              </label>
            </div>
          ) : null}
          <div className={accountLocalCliMetaClass}>
            文件列表
          </div>
          <div data-account-local-cli-file-list="true" className="grid gap-2">
            {previewFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedFileID(file.id)}
                className={`grid rounded border px-3 py-3 text-left transition active:scale-[0.99] ${
                  selectedFile?.id === file.id
                    ? 'border-[var(--gt-border-strong)] bg-[var(--gt-surface-muted)]'
                    : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] hover:bg-[var(--gt-surface-muted)]'
                }`}
              >
                <span className="break-all font-mono text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]">
                  {file.path}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={`${accountLocalCliPanelClass} min-h-0 min-w-0 overflow-auto p-4`}>
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
      <span className={accountLocalCliMetaClass}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(field, event.target.value)}
        className={accountLocalCliInputClass}
      />
    </label>
  );
}

function CodexSettingsField({
  label,
  field,
  value,
  listID,
  onChange,
}: {
  label: string;
  field: CodexTextField;
  value: string;
  listID?: string;
  onChange: (field: CodexTextField, value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className={accountLocalCliMetaClass}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        list={listID}
        onChange={(event) => onChange(field, event.target.value)}
        className={accountLocalCliInputClass}
      />
    </label>
  );
}

function ReadOnlyCodexSetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className={accountLocalCliMetaClass}>
        {label}
      </span>
      <div className="min-w-0 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-2 py-2 font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)]">
        {value}
      </div>
    </div>
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
      className={`inline-flex max-w-full items-center gap-2 rounded border px-3 py-2 font-mono text-[length:var(--gt-font-size-xs)] font-normal tracking-normal ${
        tone === 'warning'
          ? 'border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,transparent)] text-[var(--gt-status-warning)]'
          : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-primary)]'
      }`}
    >
      <span className="text-[var(--gt-ink-muted)]">{label}</span>
      <span className="truncate">{value}</span>
    </span>
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
    apiKeySet: draft.codex.apiKeySet,
    authFileContentSet: draft.codex.authFileContentSet,
    baseUrl: draft.codex.baseUrl,
    baseUrlSet: draft.codex.baseUrlSet,
    model: draft.codex.model,
    modelSet: draft.codex.modelSet,
    reasoningEffort: draft.codex.reasoningEffort,
    reasoningEffortSet: draft.codex.reasoningEffortSet,
    providerID: draft.codex.providerID,
    providerIDSet: draft.codex.providerIDSet,
    providerName: draft.codex.providerName,
    providerNameSet: draft.codex.providerNameSet,
    requiresOpenAIAuth: draft.codex.requiresOpenAIAuth,
    requiresOpenAIAuthSet: draft.codex.requiresOpenAIAuthSet,
    wireAPI: draft.codex.wireAPI,
    wireAPISet: draft.codex.wireAPISet,
    supportsWebsockets: draft.codex.supportsWebsockets,
    supportsWebsocketsSet: draft.codex.supportsWebsocketsSet,
    authStrategy: draft.codex.authStrategy,
  });
  const configDiffStart = diff.indexOf('--- CODEX_HOME/config.toml');
  const authDiff = configDiffStart >= 0 ? diff.slice(0, configDiffStart).trim() : diff;
  let configDiff = configDiffStart >= 0 ? diff.slice(configDiffStart).trim() : diff;
  configDiff = `${configDiff}

@@ model catalog @@
${draft.codex.modelCatalogProjectionMode === 'gettokens'
  ? '+model_catalog_json = "gettokens-model-catalog.json"'
  : '-model_catalog_json = "gettokens-model-catalog.json" # only when currently GetTokens-owned'}
# sync_model_catalog ${draft.codex.modelCatalogProjectionMode === 'gettokens' ? 'writes' : 'removes'} the GetTokens-owned Codex /model catalog pointer`;

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
