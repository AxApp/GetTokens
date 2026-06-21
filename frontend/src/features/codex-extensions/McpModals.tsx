import { Activity, GitBranch, Save, X } from 'lucide-react';
import type { ReactNode } from 'react';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import {
  buildMcpChangePreview,
  isEditableMcpTransport,
  parseMcpArgs,
  parseMcpEnv,
  parseMcpList,
  parseMcpTools,
  serializeMcpArgs,
  serializeMcpEnv,
  serializeMcpList,
  serializeMcpTools,
  validateMcpEnvRows,
  validateMcpToolRows,
  type McpPreflightResult,
  type McpServerRecord,
  type McpTransport,
} from './model';

interface TProps {
  t: (key: string) => string;
}

const codexExtensionModalPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-lg';
const codexExtensionModalHeaderClass =
  'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const codexExtensionModalFooterClass =
  'border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const codexExtensionModalButtonClass =
  'inline-flex min-h-9 w-fit items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-1.5 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';
const codexExtensionModalPrimaryButtonClass =
  'inline-flex min-h-9 w-fit items-center gap-2 rounded border border-[var(--gt-border-strong)] bg-[var(--gt-ink-primary)] px-3 py-1.5 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-surface-canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const codexExtensionModalIconButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]';
const codexExtensionModalFieldClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] transition focus:border-[var(--gt-border-strong)] focus:outline-none';
const codexExtensionModalSelectClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] transition focus:border-[var(--gt-border-strong)] focus:outline-none';

export function McpServerEditorModal({
  draft,
  preview,
  loading,
  t,
  onPatch,
  onReset,
  onClose,
  onSave,
  onPreflight,
  preflight,
  preflightLoading,
}: {
  draft: McpServerRecord;
  preview: ReturnType<typeof buildMcpChangePreview>;
  loading: boolean;
  preflight: McpPreflightResult | null;
  preflightLoading: boolean;
  onPatch: (patch: Partial<McpServerRecord>) => void;
  onReset: () => void;
  onClose: () => void;
  onSave: () => void;
  onPreflight: () => void;
} & TProps) {
  function patchTransport(transport: McpTransport) {
    if (transport === draft.transport) {
      return;
    }
    if (transport === 'stdio') {
      onPatch({
        transport,
        url: '',
        bearerTokenEnvVar: '',
        httpHeaders: [],
        envHttpHeaders: [],
        oauthClientId: '',
        oauthResource: '',
      });
      return;
    }

    onPatch({
      transport,
      command: '',
      args: [],
      env: [],
      envVarsRaw: '',
      cwd: '',
    });
  }

  const transportNeedsResolution = !isEditableMcpTransport(draft.transport);
  const envValidationIssues = [
    ...validateMcpEnvRows(draft.env),
    ...validateMcpEnvRows(draft.httpHeaders),
    ...validateMcpEnvRows(draft.envHttpHeaders),
  ];
  const toolValidationIssues = validateMcpToolRows(draft.tools);
  const currentValueToml = draft.rawConfig?.trim() || formatMcpCurrentValueToml(draft);
  return (
    <div
      className="scrollbar-stable fixed inset-0 z-50 overflow-y-auto bg-[var(--overlay-scrim-80)] px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-10"
      data-collaboration-id="MODAL_CODEX_MCP_SERVER_EDITOR"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={draft.label}
        data-codex-extension-mcp-modal="true"
        className={`${codexExtensionModalPanelClass} scrollbar-stable mx-auto max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-y-auto sm:max-h-[calc(100vh-7rem)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={`${codexExtensionModalHeaderClass} grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center`}>
          <div className="min-w-0">
            <div className="font-mono text-xl font-semibold text-[var(--gt-ink-primary)]">
              {draft.label}
            </div>
            <div className="mt-1 break-all text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
              {draft.sourcePath || '-'}
            </div>
          </div>
          <ToggleSwitch
            label={draft.enabled ? t('common.disable') : t('common.enable')}
            checked={draft.enabled}
            onChange={(checked) => onPatch({ enabled: checked, status: checked ? draft.status : 'disabled' })}
          />
          <button type="button" onClick={onClose} className={codexExtensionModalButtonClass}>
            {t('common.close')}
          </button>
        </header>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <main className="divide-y divide-[var(--gt-border-subtle)]">
            <McpEditorSection
              title={t('codex_extensions.mcp_identity_section')}
              meta={draft.transport}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('codex_extensions.server_id')} value={draft.id} onChange={(value) => onPatch({ id: value, label: value })} />
                <label className="grid gap-2">
                  <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                    {t('common.type')}
                  </span>
                  <select
                    value={draft.transport}
                    className={codexExtensionModalSelectClass}
                    onChange={(event) => patchTransport(event.target.value as McpTransport)}
                  >
                    {transportNeedsResolution ? (
                      <option value={draft.transport} disabled>{draft.transport}</option>
                    ) : null}
                    <option value="stdio">stdio</option>
                    <option value="streamable_http">streamable_http</option>
                  </select>
                </label>
              </div>
            </McpEditorSection>

            {transportNeedsResolution ? (
              <McpEditorSection
                title={t('codex_extensions.mcp_transport_resolution_section')}
                meta={draft.transport}
              >
                <div className="border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-status-danger)]">
                  {t('codex_extensions.mcp_transport_resolution_hint')}
                </div>
              </McpEditorSection>
            ) : draft.transport === 'stdio' ? (
              <McpEditorSection
                title={t('codex_extensions.mcp_stdio_section')}
                meta="stdio"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t('codex_extensions.command')} value={draft.command || ''} onChange={(value) => onPatch({ command: value })} />
                  <TextareaField label={t('codex_extensions.args')} value={serializeMcpArgs(draft.args)} onChange={(value) => onPatch({ args: parseMcpArgs(value) })} />
                  <Field label={t('codex_extensions.cwd')} value={draft.cwd || ''} onChange={(value) => onPatch({ cwd: value })} />
                  <TextareaField label={t('codex_extensions.env_vars')} value={draft.envVarsRaw || ''} onChange={(value) => onPatch({ envVarsRaw: value })} />
                  <TextareaField label={t('codex_extensions.env')} value={serializeMcpEnv(draft.env)} onChange={(value) => onPatch({ env: parseMcpEnv(value) })} />
                </div>
              </McpEditorSection>
            ) : (
              <McpEditorSection
                title={t('codex_extensions.mcp_http_section')}
                meta="streamable_http"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t('codex_extensions.url')} value={draft.url || ''} onChange={(value) => onPatch({ url: value })} />
                  <Field label={t('codex_extensions.bearer_env')} value={draft.bearerTokenEnvVar || ''} onChange={(value) => onPatch({ bearerTokenEnvVar: value })} />
                  <TextareaField label={t('codex_extensions.http_headers')} value={serializeMcpEnv(draft.httpHeaders)} onChange={(value) => onPatch({ httpHeaders: parseMcpEnv(value) })} />
                  <TextareaField label={t('codex_extensions.env_http_headers')} value={serializeMcpEnv(draft.envHttpHeaders)} onChange={(value) => onPatch({ envHttpHeaders: parseMcpEnv(value) })} />
                  <Field label={t('codex_extensions.oauth_client_id')} value={draft.oauthClientId || ''} onChange={(value) => onPatch({ oauthClientId: value })} />
                  <Field label={t('codex_extensions.oauth_resource')} value={draft.oauthResource || ''} onChange={(value) => onPatch({ oauthResource: value })} />
                </div>
              </McpEditorSection>
            )}

            <McpEditorSection
              title={t('codex_extensions.mcp_runtime_section')}
              meta={t('codex_extensions.mcp_shared_config')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('codex_extensions.environment_id')} value={draft.environmentId || ''} onChange={(value) => onPatch({ environmentId: value })} />
                <ToggleField
                  label={t('codex_extensions.required')}
                  checked={Boolean(draft.required)}
                  onChange={(checked) => onPatch({ required: checked })}
                />
                <ToggleField
                  label={t('codex_extensions.supports_parallel_tool_calls')}
                  checked={Boolean(draft.supportsParallelToolCalls)}
                  onChange={(checked) => onPatch({ supportsParallelToolCalls: checked })}
                />
                <Field label={t('codex_extensions.experimental_environment')} value={draft.experimentalEnvironment || ''} onChange={(value) => onPatch({ experimentalEnvironment: value })} />
                <Field label={t('codex_extensions.startup_timeout_sec')} value={draft.startupTimeoutSec || ''} onChange={(value) => onPatch({ startupTimeoutSec: value })} />
                <Field label={t('codex_extensions.tool_timeout_sec')} value={draft.toolTimeoutSec || ''} onChange={(value) => onPatch({ toolTimeoutSec: value })} />
                <label className="grid gap-2">
                  <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                    {t('codex_extensions.default_tools_approval_mode')}
                  </span>
                  <select
                    value={draft.defaultToolsApprovalMode || ''}
                    className={codexExtensionModalSelectClass}
                    onChange={(event) => onPatch({ defaultToolsApprovalMode: event.target.value })}
                  >
                    <option value="">-</option>
                    <option value="auto">auto</option>
                    <option value="prompt">prompt</option>
                    <option value="approve">approve</option>
                  </select>
                </label>
              </div>
            </McpEditorSection>

            <McpEditorSection
              title={t('codex_extensions.mcp_tools_section')}
              meta={t('codex_extensions.tools')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextareaField label={t('codex_extensions.enabled_tools')} value={serializeMcpList(draft.enabledTools)} onChange={(value) => onPatch({ enabledTools: parseMcpList(value) })} />
                <TextareaField label={t('codex_extensions.disabled_tools')} value={serializeMcpList(draft.disabledTools)} onChange={(value) => onPatch({ disabledTools: parseMcpList(value) })} />
                <TextareaField label={t('codex_extensions.scopes')} value={serializeMcpList(draft.scopes)} onChange={(value) => onPatch({ scopes: parseMcpList(value) })} />
                <TextareaField label={t('codex_extensions.tool_approval_modes')} value={serializeMcpTools(draft.tools)} onChange={(value) => onPatch({ tools: parseMcpTools(value) })} />
              </div>
            </McpEditorSection>

            <div className="flex flex-wrap gap-2 bg-[var(--gt-surface-muted)] p-4">
              {envValidationIssues.length > 0 ? (
                <div className="basis-full border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] p-3 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-status-danger)]">
                  {t('codex_extensions.mcp_env_validation_error')}: {formatMcpEnvValidationIssues(envValidationIssues, t)}
                </div>
              ) : null}
              {toolValidationIssues.length > 0 ? (
                <div className="basis-full border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] p-3 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-status-danger)]">
                  {t('codex_extensions.mcp_tool_validation_error')}: {formatMcpToolValidationIssues(toolValidationIssues, t)}
                </div>
              ) : null}
              <button
                type="button"
                onClick={onPreflight}
                disabled={loading || preflightLoading || transportNeedsResolution}
                className={codexExtensionModalButtonClass}
              >
                <Activity className="h-3.5 w-3.5" />
                {preflightLoading ? t('codex_extensions.mcp_preflight_running') : t('codex_extensions.mcp_preflight')}
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={preview.length === 0 || loading || transportNeedsResolution || envValidationIssues.length > 0 || toolValidationIssues.length > 0}
                className={codexExtensionModalPrimaryButtonClass}
              >
                <Save className="h-3.5 w-3.5" />
                {t('common.save')}
              </button>
              <button type="button" onClick={onReset} className={codexExtensionModalButtonClass}>
                {t('common.cancel')}
              </button>
              {preflight ? <McpPreflightPanel result={preflight} t={t} /> : null}
            </div>
          </main>
          <aside className="border-t border-[var(--gt-border-subtle)] p-4 xl:border-l xl:border-t-0">
            <div className="mb-3 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
              {t('codex_extensions.mcp_current_values')}
            </div>
            <pre className="scrollbar-stable max-h-[28rem] overflow-auto border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3 text-[length:var(--gt-font-size-sm)] leading-relaxed text-[var(--gt-ink-primary)]">
              <code className="whitespace-pre font-mono font-semibold">{currentValueToml}</code>
            </pre>

            <div className="mb-3 mt-6 flex items-center gap-2 border-t border-[var(--gt-border-subtle)] pt-4 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
              <GitBranch className="h-3.5 w-3.5" />
              {t('codex_extensions.change_preview')}
            </div>
            <div className="divide-y divide-[var(--gt-border-subtle)] border-t border-[var(--gt-border-subtle)]">
              {preview.length > 0 ? preview.map((change) => (
                <div key={change.key} className="py-2">
                  <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">{change.key}</div>
                  <div className="mt-1 break-all text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                    {change.before} -&gt; {change.after}
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                  {t('codex_extensions.no_changes')}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function formatMcpEnvValidationIssues(
  issues: ReturnType<typeof validateMcpEnvRows>,
  t: (key: string) => string,
): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.key || '-'} ${t(`codex_extensions.mcp_env_issue_${issue.reason}`)}`)
    .join(' / ');
}

function formatMcpToolValidationIssues(
  issues: ReturnType<typeof validateMcpToolRows>,
  t: (key: string) => string,
): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.name || '-'}=${issue.approvalMode || '-'} ${t(`codex_extensions.mcp_tool_issue_${issue.reason}`)}`)
    .join(' / ');
}

function McpPreflightPanel({ result, t }: { result: McpPreflightResult; t: (key: string) => string }) {
  const statusClass = {
    ok: 'border-[var(--gt-status-success)] text-[var(--gt-status-success)]',
    warning: 'border-[var(--gt-status-warning)] text-[var(--gt-status-warning)]',
    error: 'border-[var(--gt-status-danger)] text-[var(--gt-status-danger)]',
  }[result.status];

  return (
    <section className="basis-full border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]" data-codex-mcp-preflight-result="true">
      <header className={`flex items-center justify-between gap-3 border-b px-3 py-2 ${statusClass}`}>
        <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold">
          {t('codex_extensions.mcp_preflight_result')}
        </div>
        <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold">
          {t(`codex_extensions.mcp_preflight_status_${result.status}`)}
        </div>
      </header>
      <div className="divide-y divide-[var(--gt-border-subtle)]">
        {result.checks.map((check) => (
          <div key={check.id} className="grid gap-1 px-3 py-2 md:grid-cols-[8rem_minmax(0,1fr)_6rem] md:items-center">
            <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
              {check.label}
            </div>
            <div className="min-w-0 break-words font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
              {check.detail || '-'}
            </div>
            <div className={`font-mono text-[length:var(--gt-font-size-xs)] font-semibold ${preflightCheckClass(check.status)}`}>
              {t(`codex_extensions.mcp_preflight_status_${check.status}`)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function preflightCheckClass(status: McpPreflightResult['status']): string {
  if (status === 'error') {
    return 'text-[var(--gt-status-danger)]';
  }
  if (status === 'warning') {
    return 'text-[var(--gt-status-warning)]';
  }
  return 'text-[var(--gt-status-success)]';
}

export function ConfigTomlEditorModal({
  configPath,
  content,
  dirty,
  loading,
  saving,
  t,
  onChange,
  onClose,
  onSave,
}: {
  configPath: string;
  content: string;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  onChange: (content: string) => void;
  onClose: () => void;
  onSave: () => void;
} & TProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-3 backdrop-blur-sm sm:p-6"
      data-collaboration-id="MODAL_CODEX_CONFIG_TOML_EDITOR"
      onClick={onClose}
    >
      <div
        data-codex-extension-config-modal="true"
        className={`${codexExtensionModalPanelClass} flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden sm:max-h-[calc(100vh-3rem)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={`${codexExtensionModalHeaderClass} flex shrink-0 items-start justify-between gap-4 px-5 py-4`}>
          <div className="min-w-0">
            <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
              {t('codex_extensions.config_editor_title')}
            </div>
            <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-md-compact)] font-semibold text-[var(--gt-ink-primary)]">
              {configPath}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={codexExtensionModalIconButtonClass}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" strokeWidth={4} />
          </button>
        </header>

        <div className="min-h-0 flex-1 p-4">
          {loading ? (
            <div className="flex min-h-[24rem] items-center justify-center text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-muted)]">
              {t('common.loading')}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(event) => onChange(event.target.value)}
              spellCheck={false}
              className={`${codexExtensionModalFieldClass} scrollbar-stable min-h-[24rem] w-full resize-none overflow-auto font-mono text-[length:var(--gt-font-size-md)] leading-relaxed`}
              placeholder={t('codex_extensions.config_editor_placeholder')}
            />
          )}
        </div>

        <footer className={`${codexExtensionModalFooterClass} flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-4`}>
          <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
            {dirty ? t('codex_extensions.config_dirty') : t('codex_extensions.config_clean')}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={codexExtensionModalButtonClass}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || loading || saving}
              className={codexExtensionModalPrimaryButtonClass}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function McpStatusBadge({ status }: { status: McpServerRecord['status'] }) {
  const isReady = status === 'ready';
  const isDisabled = status === 'disabled';
  return (
    <div
      className={`border px-2 py-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold ${
        isReady
          ? 'border-[var(--gt-border-subtle)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]'
          : isDisabled
            ? 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]'
            : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-status-danger)]'
      }`}
    >
      {status}
    </div>
  );
}

function McpEditorSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 p-4 lg:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
          {title}
        </div>
        {meta ? (
          <div className="mt-1 break-all text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-muted)]">
            {meta}
          </div>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
        {label}
      </span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={`${codexExtensionModalFieldClass} w-full font-mono`} />
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="grid gap-2">
      <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
        {label}
      </div>
      <div className={`${codexExtensionModalFieldClass} flex h-10 items-center justify-between gap-3 py-1`}>
        <span className="font-mono text-[length:var(--gt-font-size-md-compact)] font-semibold text-[var(--gt-ink-primary)]">
          {String(checked)}
        </span>
        <ToggleSwitch
          label={label}
          checked={checked}
          onChange={onChange}
          className="!min-h-0"
        />
      </div>
    </div>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${codexExtensionModalFieldClass} min-h-28 w-full resize-y font-mono`}
      />
    </label>
  );
}

function formatMcpCurrentValueToml(server: McpServerRecord): string {
  const lines = [`[mcp_servers.${formatTomlPathSegment(server.id)}]`];

  if (server.transport === 'stdio') {
    pushTomlString(lines, 'command', server.command);
    pushTomlStringArray(lines, 'args', serializedArrayValues(server.args, serializeMcpArgs(server.args)));
    pushTomlInlineMap(lines, 'env', serializeMcpEnv(server.env));
    pushTomlRaw(lines, 'env_vars', server.envVarsRaw);
    pushTomlString(lines, 'cwd', server.cwd);
  } else {
    pushTomlString(lines, 'url', server.url);
    pushTomlString(lines, 'bearer_token_env_var', server.bearerTokenEnvVar);
    pushTomlInlineMap(lines, 'http_headers', serializeMcpEnv(server.httpHeaders));
    pushTomlInlineMap(lines, 'env_http_headers', serializeMcpEnv(server.envHttpHeaders));
  }

  if (!server.enabled) {
    lines.push('enabled = false');
  }
  pushTomlString(lines, 'environment_id', server.environmentId);
  pushTomlString(lines, 'experimental_environment', server.experimentalEnvironment);
  if (server.required) {
    lines.push('required = true');
  }
  if (server.supportsParallelToolCalls) {
    lines.push('supports_parallel_tool_calls = true');
  }
  pushTomlRaw(lines, 'startup_timeout_sec', server.startupTimeoutSec);
  pushTomlRaw(lines, 'tool_timeout_sec', server.toolTimeoutSec);
  pushTomlString(lines, 'default_tools_approval_mode', server.defaultToolsApprovalMode);
  pushTomlStringArray(lines, 'enabled_tools', serializedArrayValues(server.enabledTools, serializeMcpList(server.enabledTools)));
  pushTomlStringArray(lines, 'disabled_tools', serializedArrayValues(server.disabledTools, serializeMcpList(server.disabledTools)));
  pushTomlStringArray(lines, 'scopes', serializedArrayValues(server.scopes, serializeMcpList(server.scopes)));
  pushTomlString(lines, 'oauth_resource', server.oauthResource);

  if (server.oauthClientId?.trim()) {
    lines.push('', `[mcp_servers.${formatTomlPathSegment(server.id)}.oauth]`);
    pushTomlString(lines, 'client_id', server.oauthClientId);
  }

  const toolLines = serializeMcpTools(server.tools).split('\n').map((value) => value.trim()).filter(Boolean);
  for (const toolLine of toolLines) {
    const [toolName, approvalMode = ''] = toolLine.split('=', 2);
    lines.push('', `[mcp_servers.${formatTomlPathSegment(server.id)}.tools.${formatTomlPathSegment(toolName)}]`);
    pushTomlString(lines, 'approval_mode', approvalMode);
  }

  return lines.join('\n');
}

function pushTomlString(lines: string[], key: string, value: string | undefined) {
  const trimmed = value?.trim() || '';
  if (trimmed) {
    lines.push(`${key} = ${quoteTomlString(trimmed)}`);
  }
}

function pushTomlRaw(lines: string[], key: string, value: string | undefined) {
  const trimmed = value?.trim() || '';
  if (trimmed) {
    lines.push(`${key} = ${trimmed}`);
  }
}

function pushTomlStringArray(lines: string[], key: string, values: string[]) {
  if (values.length > 0) {
    lines.push(`${key} = [${values.map(quoteTomlString).join(', ')}]`);
  }
}

function serializedArrayValues(values: string[] | undefined, serialized: string): string[] {
  if (!serialized.trim()) {
    return [];
  }
  return (values || []).map((value) => value.trim()).filter(Boolean);
}

function pushTomlInlineMap(lines: string[], key: string, serialized: string) {
  const parts = serialized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('=');
      if (index === -1) {
        return null;
      }
      const mapKey = line.slice(0, index).trim();
      const mapValue = line.slice(index + 1).trim();
      return isBareTomlKey(mapKey) ? `${mapKey} = ${quoteTomlString(mapValue)}` : null;
    })
    .filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    lines.push(`${key} = { ${parts.join(', ')} }`);
  }
}

function quoteTomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function formatTomlPathSegment(value: string): string {
  const trimmed = value.trim();
  return isBareTomlKey(trimmed) ? trimmed : quoteTomlString(trimmed);
}

function isBareTomlKey(key: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(key);
}
