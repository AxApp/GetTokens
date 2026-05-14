import { GitBranch, Save, X } from 'lucide-react';
import type { ReactNode } from 'react';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import {
  buildMcpChangePreview,
  parseMcpArgs,
  parseMcpEnv,
  parseMcpList,
  serializeMcpArgs,
  serializeMcpEnv,
  serializeMcpList,
  serializeMcpTools,
  type McpServerRecord,
  type McpTransport,
} from './model';

interface TProps {
  t: (key: string) => string;
}

export function McpServerEditorModal({
  draft,
  preview,
  loading,
  t,
  onPatch,
  onReset,
  onClose,
  onSave,
}: {
  draft: McpServerRecord;
  preview: ReturnType<typeof buildMcpChangePreview>;
  loading: boolean;
  onPatch: (patch: Partial<McpServerRecord>) => void;
  onReset: () => void;
  onClose: () => void;
  onSave: () => void;
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

  const currentValueToml = draft.rawConfig?.trim() || formatMcpCurrentValueToml(draft);
  const hasCwd = Boolean(draft.cwd?.trim());
  const hasEnvVars = Boolean(draft.envVarsRaw?.trim());
  const hasEnv = serializeMcpEnv(draft.env).trim() !== '';
  const hasBearerEnv = Boolean(draft.bearerTokenEnvVar?.trim());
  const hasHttpHeaders = serializeMcpEnv(draft.httpHeaders).trim() !== '';
  const hasEnvHttpHeaders = serializeMcpEnv(draft.envHttpHeaders).trim() !== '';
  const hasOauthResource = Boolean(draft.oauthResource?.trim());
  const hasRuntimeConfig =
    Boolean(draft.required) ||
    Boolean(draft.supportsParallelToolCalls) ||
    Boolean(draft.experimentalEnvironment?.trim()) ||
    Boolean(draft.startupTimeoutSec?.trim()) ||
    Boolean(draft.toolTimeoutSec?.trim()) ||
    Boolean(draft.defaultToolsApprovalMode?.trim());
  const hasToolScope =
    serializeMcpList(draft.enabledTools).trim() !== '' ||
    serializeMcpList(draft.disabledTools).trim() !== '' ||
    serializeMcpList(draft.scopes).trim() !== '';

  return (
    <div
      className="scrollbar-stable fixed inset-0 z-50 overflow-y-auto bg-black/80 px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-10"
      data-collaboration-id="MODAL_CODEX_MCP_SERVER_EDITOR"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={draft.label}
        className="scrollbar-stable mx-auto max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-y-auto border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-7rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="grid gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div className="min-w-0">
            <div className="font-mono text-xl font-black italic tracking-tighter text-[var(--text-primary)]">
              {draft.label}
            </div>
            <div className="mt-1 break-all text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
              {draft.sourcePath || '-'}
            </div>
          </div>
          <ToggleSwitch
            label={draft.enabled ? t('common.disable') : t('common.enable')}
            checked={draft.enabled}
            onChange={(checked) => onPatch({ enabled: checked, status: checked ? draft.status : 'disabled' })}
          />
          <button type="button" onClick={onClose} className="btn-swiss !px-3 !py-2 !text-[0.625rem]">
            {t('common.close')}
          </button>
        </header>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <main className="divide-y-2 divide-[var(--border-color)]">
            <McpEditorSection
              title={t('codex_extensions.mcp_identity_section')}
              meta={draft.transport}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('codex_extensions.server_id')} value={draft.id} onChange={(value) => onPatch({ id: value, label: value })} />
                <label className="grid gap-2">
                  <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t('common.type')}
                  </span>
                  <select
                    value={draft.transport}
                    className="select-swiss"
                    onChange={(event) => patchTransport(event.target.value as McpTransport)}
                  >
                    <option value="stdio">stdio</option>
                    <option value="streamable_http">streamable_http</option>
                  </select>
                </label>
              </div>
            </McpEditorSection>

            {draft.transport === 'stdio' ? (
              <McpEditorSection
                title={t('codex_extensions.mcp_stdio_section')}
                meta="stdio"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t('codex_extensions.command')} value={draft.command || ''} onChange={(value) => onPatch({ command: value })} />
                  <Field label={t('codex_extensions.args')} value={serializeMcpArgs(draft.args)} onChange={(value) => onPatch({ args: parseMcpArgs(value) })} />
                  {hasCwd ? <Field label={t('codex_extensions.cwd')} value={draft.cwd || ''} onChange={(value) => onPatch({ cwd: value })} /> : null}
                  {hasEnvVars ? <TextareaField label={t('codex_extensions.env_vars')} value={draft.envVarsRaw || ''} onChange={(value) => onPatch({ envVarsRaw: value })} /> : null}
                  {hasEnv ? <TextareaField label={t('codex_extensions.env')} value={serializeMcpEnv(draft.env)} onChange={(value) => onPatch({ env: parseMcpEnv(value) })} /> : null}
                </div>
              </McpEditorSection>
            ) : (
              <McpEditorSection
                title={t('codex_extensions.mcp_http_section')}
                meta="streamable_http"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t('codex_extensions.url')} value={draft.url || ''} onChange={(value) => onPatch({ url: value })} />
                  {hasBearerEnv ? <Field label={t('codex_extensions.bearer_env')} value={draft.bearerTokenEnvVar || ''} onChange={(value) => onPatch({ bearerTokenEnvVar: value })} /> : null}
                  {hasHttpHeaders ? <TextareaField label={t('codex_extensions.http_headers')} value={serializeMcpEnv(draft.httpHeaders)} onChange={(value) => onPatch({ httpHeaders: parseMcpEnv(value) })} /> : null}
                  {hasEnvHttpHeaders ? <TextareaField label={t('codex_extensions.env_http_headers')} value={serializeMcpEnv(draft.envHttpHeaders)} onChange={(value) => onPatch({ envHttpHeaders: parseMcpEnv(value) })} /> : null}
                  {hasOauthResource ? <Field label={t('codex_extensions.oauth_resource')} value={draft.oauthResource || ''} onChange={(value) => onPatch({ oauthResource: value })} /> : null}
                </div>
              </McpEditorSection>
            )}

            {hasRuntimeConfig ? (
              <McpEditorSection
                title={t('codex_extensions.mcp_runtime_section')}
                meta={t('codex_extensions.mcp_shared_config')}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {draft.required ? (
                    <ToggleField
                      label={t('codex_extensions.required')}
                      checked={Boolean(draft.required)}
                      onChange={(checked) => onPatch({ required: checked })}
                    />
                  ) : null}
                  {draft.supportsParallelToolCalls ? (
                    <ToggleField
                      label={t('codex_extensions.supports_parallel_tool_calls')}
                      checked={Boolean(draft.supportsParallelToolCalls)}
                      onChange={(checked) => onPatch({ supportsParallelToolCalls: checked })}
                    />
                  ) : null}
                  {draft.experimentalEnvironment?.trim() ? <Field label={t('codex_extensions.experimental_environment')} value={draft.experimentalEnvironment || ''} onChange={(value) => onPatch({ experimentalEnvironment: value })} /> : null}
                  {draft.startupTimeoutSec?.trim() ? <Field label={t('codex_extensions.startup_timeout_sec')} value={draft.startupTimeoutSec || ''} onChange={(value) => onPatch({ startupTimeoutSec: value })} /> : null}
                  {draft.toolTimeoutSec?.trim() ? <Field label={t('codex_extensions.tool_timeout_sec')} value={draft.toolTimeoutSec || ''} onChange={(value) => onPatch({ toolTimeoutSec: value })} /> : null}
                  {draft.defaultToolsApprovalMode?.trim() ? (
                    <label className="grid gap-2">
                      <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {t('codex_extensions.default_tools_approval_mode')}
                      </span>
                      <select
                        value={draft.defaultToolsApprovalMode || ''}
                        className="select-swiss"
                        onChange={(event) => onPatch({ defaultToolsApprovalMode: event.target.value })}
                      >
                        <option value="">-</option>
                        <option value="auto">auto</option>
                        <option value="prompt">prompt</option>
                        <option value="approve">approve</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              </McpEditorSection>
            ) : null}

            {hasToolScope ? (
              <McpEditorSection
                title={t('codex_extensions.mcp_tools_section')}
                meta={t('codex_extensions.tools')}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {serializeMcpList(draft.enabledTools).trim() ? <TextareaField label={t('codex_extensions.enabled_tools')} value={serializeMcpList(draft.enabledTools)} onChange={(value) => onPatch({ enabledTools: parseMcpList(value) })} /> : null}
                  {serializeMcpList(draft.disabledTools).trim() ? <TextareaField label={t('codex_extensions.disabled_tools')} value={serializeMcpList(draft.disabledTools)} onChange={(value) => onPatch({ disabledTools: parseMcpList(value) })} /> : null}
                  {serializeMcpList(draft.scopes).trim() ? <TextareaField label={t('codex_extensions.scopes')} value={serializeMcpList(draft.scopes)} onChange={(value) => onPatch({ scopes: parseMcpList(value) })} /> : null}
                </div>
              </McpEditorSection>
            ) : null}

            <div className="flex flex-wrap gap-2 bg-[var(--bg-surface)] p-4">
              <button
                type="button"
                onClick={onSave}
                disabled={preview.length === 0 || loading}
                className="btn-swiss bg-[var(--text-primary)] !px-3 !py-2 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {t('common.save')}
              </button>
              <button type="button" onClick={onReset} className="btn-swiss !px-3 !py-2 !text-[0.625rem]">
                {t('common.cancel')}
              </button>
            </div>
          </main>
          <aside className="border-t-2 border-[var(--border-color)] p-4 xl:border-l-2 xl:border-t-0">
            <div className="mb-3 text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('codex_extensions.mcp_current_values')}
            </div>
            <pre className="scrollbar-stable max-h-[28rem] overflow-auto border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-[0.625rem] leading-relaxed text-[var(--text-primary)]">
              <code className="whitespace-pre font-mono font-black">{currentValueToml}</code>
            </pre>

            <div className="mb-3 mt-6 flex items-center gap-2 border-t-2 border-[var(--border-color)] pt-4 text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <GitBranch className="h-3.5 w-3.5" />
              {t('codex_extensions.change_preview')}
            </div>
            <div className="divide-y-2 divide-[var(--border-color)] border-t-2 border-[var(--border-color)]">
              {preview.length > 0 ? preview.map((change) => (
                <div key={change.key} className="py-2">
                  <div className="font-mono text-[0.625rem] font-black text-[var(--text-primary)]">{change.key}</div>
                  <div className="mt-1 break-all text-[0.5625rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {change.before} -&gt; {change.after}
                  </div>
                </div>
              )) : (
                <div className="py-8 text-center text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      data-collaboration-id="MODAL_CODEX_CONFIG_TOML_EDITOR"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-[var(--border-color)] px-5 py-4">
          <div className="min-w-0">
            <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('codex_extensions.config_editor_title')}
            </div>
            <div className="mt-1 break-all font-mono text-[0.6875rem] font-black text-[var(--text-primary)]">
              {configPath}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" strokeWidth={4} />
          </button>
        </header>

        <div className="min-h-0 flex-1 p-4">
          {loading ? (
            <div className="flex min-h-[24rem] items-center justify-center text-[0.75rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('common.loading')}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(event) => onChange(event.target.value)}
              spellCheck={false}
              className="scrollbar-stable input-swiss min-h-[24rem] w-full resize-none overflow-auto font-mono !text-[0.75rem] leading-relaxed"
              placeholder={t('codex_extensions.config_editor_placeholder')}
            />
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {dirty ? t('codex_extensions.config_dirty') : t('codex_extensions.config_clean')}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-swiss !px-3 !py-2 !text-[0.625rem]">
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || loading || saving}
              className="btn-swiss bg-[var(--text-primary)] !px-3 !py-2 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
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
      className={`border-2 px-2 py-1 font-mono text-[0.5625rem] font-black uppercase tracking-[0.16em] ${
        isReady
          ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
          : isDisabled
            ? 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
            : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--accent-red)]'
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
        <div className="font-mono text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
          {title}
        </div>
        {meta ? (
          <div className="mt-1 break-all text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
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
      <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="input-swiss w-full font-mono" />
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="grid gap-2">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="input-swiss flex h-10 items-center justify-between gap-3 !py-1">
        <span className="font-mono text-[0.6875rem] font-black text-[var(--text-primary)]">
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
      <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-swiss min-h-28 w-full resize-y font-mono"
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
