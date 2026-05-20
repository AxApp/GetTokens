import { useMemo, useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import StatusSnippetPanel from '../../status/components/StatusSnippetPanel';
import {
  buildClaudeCodeSettingsDiff,
  buildCodexLocalApplyDiff,
  maskRelayKey,
} from '../../status/model/relayLocalState';
import type {
  AccountCliApplyDraft,
  AccountLocalCliRelayKeyLike,
  AccountLocalCliWarning,
} from '../model/accountLocalCliMapping';

interface AccountLocalCliApplyConfirmProps {
  draft: AccountCliApplyDraft;
  relayKeyItems: AccountLocalCliRelayKeyLike[];
  applying: boolean;
  resultMessage: string;
  previewMode: boolean;
  onClose: () => void;
  onApply: (draft: AccountCliApplyDraft) => void;
}

interface PreviewFile {
  id: string;
  path: string;
  target: string;
  status: string;
  changedFields: string[];
  preservedFields: string[];
  diff: string;
}

export default function AccountLocalCliApplyConfirm({
  draft,
  relayKeyItems,
  applying,
  resultMessage,
  previewMode,
  onClose,
  onApply,
}: AccountLocalCliApplyConfirmProps) {
  const previewFiles = useMemo(() => buildPreviewFiles(draft, relayKeyItems), [draft, relayKeyItems]);
  const [selectedFileID, setSelectedFileID] = useState(previewFiles[0]?.id || '');
  const selectedFile = previewFiles.find((file) => file.id === selectedFileID) || previewFiles[0];
  const warnings = draft.source.warnings;
  const blockingWarnings = warnings.filter((warning) => warning.severity === 'blocking');
  const canApply = draft.source.enabled && blockingWarnings.length === 0 && !applying;
  const title = draft.target === 'codex' ? '应用模板到 Codex' : '应用模板到 Claude Code';
  const modeLabel = draft.target === 'codex'
    ? draft.codex.authStrategy === 'replace_auth_with_apikey'
      ? 'API Key 写入模式'
      : 'OAuth 保留模式'
    : 'Claude Code API Key 模式';
  const providerLabel = draft.target === 'codex'
    ? `${draft.codex.providerName} / ${draft.codex.providerID}`
    : 'Claude settings env';

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
              {previewMode ? <SummaryBadge label="运行环境" value="PREVIEW ONLY" tone="warning" /> : null}
            </div>
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
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onApply(draft)}
              className="btn-swiss bg-[var(--border-color)] !px-3 !py-2 !text-[length:var(--font-size-ui-xs)] !text-[var(--bg-main)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying ? '正在应用' : '确认并应用'}
            </button>
          </div>
        </>
      }
      bodyClassName="bg-[var(--bg-surface)]"
    >
      <div className="grid min-h-0 gap-0 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="grid content-start gap-3 overflow-auto border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 lg:max-h-[calc(100vh-12rem)] lg:border-b-0 lg:border-r-2">
          <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            文件列表
          </div>
          <div className="grid gap-2">
            {previewFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedFileID(file.id)}
                className={`grid gap-2 border-2 px-3 py-3 text-left active:scale-[0.99] ${
                  selectedFile?.id === file.id
                    ? 'border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[4px_4px_0_var(--shadow-color)]'
                    : 'border-[var(--border-muted)] bg-[var(--bg-main)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                <span className="break-all font-mono text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
                  {file.path}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  <span>{file.target}</span>
                  <span className="border border-[var(--border-color)] px-1.5 py-0.5 text-[var(--color-status-warning)]">
                    {file.status}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <WarningsPanel warnings={warnings} disabledReason={draft.source.disabledReason} />
          {selectedFile ? (
            <div className="grid gap-2 border-t border-dashed border-[var(--border-color)] pt-3 text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
              <span className="font-mono font-black uppercase tracking-[0.16em]">改动字段</span>
              <span>{selectedFile.changedFields.join(' / ') || '无写入字段'}</span>
              <span className="font-mono font-black uppercase tracking-[0.16em]">保留字段</span>
              <span>{selectedFile.preservedFields.join(' / ') || '无'}</span>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 overflow-auto p-4 lg:max-h-[calc(100vh-12rem)]">
          {selectedFile ? (
            <StatusSnippetPanel
              title={`文件改动 / ${selectedFile.path}`}
              content={selectedFile.diff}
              preClassName="max-h-[calc(100vh-19rem)]"
            />
          ) : null}
        </div>
      </div>
    </ModalFrame>
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

function WarningsPanel({
  warnings,
  disabledReason,
}: {
  warnings: AccountLocalCliWarning[];
  disabledReason?: string;
}) {
  const visible = [
    ...(disabledReason ? [{ severity: 'blocking' as const, message: disabledReason }] : []),
    ...warnings,
  ];
  if (visible.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-2 border-2 border-dashed border-[var(--color-status-warning)] bg-[var(--bg-surface)] p-3 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide text-[var(--color-status-warning)]">
      {visible.map((warning, index) => (
        <span
          key={`${warning.severity}-${index}-${warning.message}`}
          className={warning.severity === 'blocking' ? 'text-[var(--color-status-danger)]' : ''}
        >
          {warning.message}
        </span>
      ))}
    </div>
  );
}

function buildPreviewFiles(draft: AccountCliApplyDraft, relayKeyItems: AccountLocalCliRelayKeyLike[]): PreviewFile[] {
  const relayKey = relayKeyItems[draft.source.relayKeyIndex]?.value || '';
  if (draft.target === 'claude') {
    return [
      {
        id: 'claude-settings',
        path: '~/.claude/settings.json',
        target: 'Claude Code',
        status: '将写入',
        changedFields: [
          'ANTHROPIC_API_KEY',
          'ANTHROPIC_BASE_URL',
          'ANTHROPIC_MODEL',
          'ANTHROPIC_DEFAULT_*',
        ],
        preservedFields: ['permissions', 'hooks', 'statusLine', 'MCP', '未知字段'],
        diff: buildClaudeCodeSettingsDiff({
          apiKey: relayKey,
          baseUrl: draft.claude.baseUrl,
          model: draft.claude.model,
          defaultHaikuModel: draft.claude.defaultHaikuModel,
          defaultSonnetModel: draft.claude.defaultSonnetModel,
          defaultOpusModel: draft.claude.defaultOpusModel,
          smallFastModel: draft.claude.smallFastModel,
          maxOutputTokens: draft.claude.maxOutputTokens,
          apiTimeoutMs: draft.claude.apiTimeoutMs,
          disableNonEssentialTraffic: draft.claude.disableNonEssentialTraffic,
          authField: draft.claude.authField,
        }),
      },
    ];
  }

  const diff = buildCodexLocalApplyDiff({
    apiKey: relayKey,
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
  const maskedKey = maskRelayKey(relayKey);

  return [
    {
      id: 'codex-auth',
      path: 'CODEX_HOME/auth.json',
      target: 'Codex',
      status: draft.codex.authStrategy === 'preserve_chatgpt_auth' ? '只读校验' : '将写入',
      changedFields: draft.codex.authStrategy === 'preserve_chatgpt_auth'
        ? []
        : ['auth_mode', `OPENAI_API_KEY=${maskedKey}`],
      preservedFields: draft.codex.authStrategy === 'preserve_chatgpt_auth'
        ? ['auth_mode', 'OPENAI_API_KEY', 'tokens', 'account metadata']
        : ['未声明字段'],
      diff: authDiff || '# CODEX_HOME/auth.json 无写入 diff',
    },
    {
      id: 'codex-config',
      path: 'CODEX_HOME/config.toml',
      target: 'Codex',
      status: '将写入',
      changedFields: [
        'model',
        'model_reasoning_effort',
        `[model_providers.${draft.codex.providerID}]`,
        draft.codex.authStrategy === 'preserve_chatgpt_auth' ? 'experimental_bearer_token' : 'provider base_url',
      ],
      preservedFields: ['mcp_servers.*', 'profiles.*', '未知 provider 字段', '用户注释'],
      diff: configDiff,
    },
  ];
}
