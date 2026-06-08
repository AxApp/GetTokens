export type CodexGitProvider = 'github' | 'gitlab';
export type CodexSkillSourceKind = 'system' | 'user' | 'project' | 'github' | 'gitlab';
export type McpTransport = 'stdio' | 'streamable_http' | 'conflict' | 'unknown';

export interface CodexSkillFile {
  path: string;
  kind: 'skill' | 'asset' | 'script' | 'other';
  content?: string;
  previewable?: boolean;
}

export interface CodexSkillRecord {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  enabledSource?: 'default_enabled' | 'path_rule' | 'name_rule';
  enabledSourceValue?: string;
  rootLabel: string;
  rootPath: string;
  sourceKind: CodexSkillSourceKind;
  origin: string;
  versionLabel: string;
  files: CodexSkillFile[];
  skillMarkdown: string;
  warnings?: string[];
}

export interface McpEnvRow {
  key: string;
  value: string;
  source?: 'missing-separator';
}

export interface McpToolRow {
  name: string;
  approvalMode?: string;
}

export interface McpServerRecord {
  id: string;
  label: string;
  enabled: boolean;
  transport: McpTransport;
  command?: string;
  args?: string[];
  env?: McpEnvRow[];
  envVarsRaw?: string;
  cwd?: string;
  url?: string;
  bearerTokenEnvVar?: string;
  httpHeaders?: McpEnvRow[];
  envHttpHeaders?: McpEnvRow[];
  environmentId?: string;
  experimentalEnvironment?: string;
  required?: boolean;
  supportsParallelToolCalls?: boolean;
  startupTimeoutSec?: string;
  toolTimeoutSec?: string;
  defaultToolsApprovalMode?: string;
  enabledTools?: string[];
  disabledTools?: string[];
  scopes?: string[];
  oauthClientId?: string;
  oauthResource?: string;
  tools?: McpToolRow[];
  rawConfig?: string;
  sourcePath: string;
  status: 'ready' | 'missing-env' | 'disabled' | 'error';
}

export type McpPreflightStatus = 'ok' | 'warning' | 'error';

export interface McpPreflightCheck {
  id: string;
  label: string;
  status: McpPreflightStatus;
  detail: string;
}

export interface McpPreflightResult {
  serverID: string;
  status: McpPreflightStatus;
  checks: McpPreflightCheck[];
}

export interface GitSkillSource {
  provider: CodexGitProvider;
  host: string;
  repo: string;
  ref: string;
  path: string;
}

export interface McpChangePreview {
  key: string;
  before: string;
  after: string;
}

export interface McpEnvValidationIssue {
  key: string;
  reason: 'invalid-key' | 'missing-separator';
}

export interface McpToolValidationIssue {
  name: string;
  approvalMode: string;
  reason: 'invalid-approval-mode';
}

const gitlabAllowlist = new Set(['gitlab.com']);
const windowsDrivePathPattern = /^[a-zA-Z]:[\\/]/;

export function stripSkillFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---')) {
    return markdown.trim();
  }

  const end = markdown.indexOf('\n---', 3);
  if (end === -1) {
    return markdown.trim();
  }

  return markdown.slice(end + 4).trim();
}

export function updateCodexSkillEnabled(
  skills: CodexSkillRecord[],
  skillID: string,
  enabled: boolean,
): CodexSkillRecord[] {
  return skills.map((skill) => (skill.id === skillID ? { ...skill, enabled } : skill));
}

export function removeCodexSkillByID(skills: CodexSkillRecord[], skillID: string): CodexSkillRecord[] {
  return skills.filter((skill) => skill.id !== skillID);
}

export function parseTkGitSkillSource(input: string): GitSkillSource | null {
  const value = input.trim();
  if (!value.startsWith('tk://')) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value.replace(/^tk:\/\//, 'https://'));
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const sourcePathParam = url.searchParams.get('path');
  const sourcePath = sourcePathParam === null ? '.' : sourcePathParam;
  if (!isSafeGitSkillSourcePath(sourcePath)) {
    return null;
  }

  if (host === 'github.com') {
    return {
      provider: 'github',
      host,
      repo: `${segments[0]}/${segments[1]}`,
      ref: url.searchParams.get('ref') || 'main',
      path: sourcePath,
    };
  }

  if (host.endsWith('gitlab.com') && gitlabAllowlist.has(host)) {
    const repoSegments = segments.length > 2 ? segments : segments.slice(0, 2);
    return {
      provider: 'gitlab',
      host,
      repo: repoSegments.join('/'),
      ref: url.searchParams.get('ref') || 'main',
      path: sourcePath,
    };
  }

  return null;
}

export function isEditableMcpTransport(transport: McpTransport): transport is 'stdio' | 'streamable_http' {
  return transport === 'stdio' || transport === 'streamable_http';
}

function isSafeGitSkillSourcePath(sourcePath: string): boolean {
  const value = sourcePath.trim();
  if (!value) {
    return false;
  }
  if (value.includes('\0') || value.startsWith('/') || windowsDrivePathPattern.test(value)) {
    return false;
  }
  return value.split(/[\\/]+/).every((segment) => segment !== '..');
}

export function serializeMcpArgs(args: string[] | undefined): string {
  return (args || []).join('\n');
}

export function parseMcpArgs(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeMcpEnv(env: McpEnvRow[] | undefined): string {
  return (env || []).map((row) => `${row.key}=${row.value}`).join('\n');
}

export function parseMcpEnv(value: string): McpEnvRow[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('=');
      if (index === -1) {
        return { key: line, value: '', source: 'missing-separator' as const };
      }
      return {
        key: line.slice(0, index).trim(),
        value: line.slice(index + 1).trim(),
      };
    })
    .filter((row) => row.key.length > 0);
}

export function validateMcpEnvRows(rows: readonly McpEnvRow[] | undefined): McpEnvValidationIssue[] {
  return (rows || []).flatMap<McpEnvValidationIssue>((row) => {
    const key = row.key.trim();
    if (row.source === 'missing-separator') {
      return [{ key, reason: 'missing-separator' as const }];
    }
    if (!isBareTomlKey(key)) {
      return [{ key, reason: 'invalid-key' as const }];
    }
    return [];
  });
}

export function isBareTomlKey(key: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(key);
}

export function serializeMcpList(values: string[] | undefined): string {
  return (values || []).join('\n');
}

export function parseMcpList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function serializeMcpTools(tools: McpToolRow[] | undefined): string {
  return (tools || []).map((tool) => `${tool.name}${tool.approvalMode ? `=${tool.approvalMode}` : ''}`).join('\n');
}

export function parseMcpTools(value: string): McpToolRow[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, approvalMode = ''] = line.split('=', 2);
      return { name: name.trim(), approvalMode: approvalMode.trim() };
    })
    .filter((tool) => tool.name);
}

export function validateMcpToolRows(rows: readonly McpToolRow[] | undefined): McpToolValidationIssue[] {
  return (rows || []).flatMap<McpToolValidationIssue>((row) => {
    const approvalMode = (row.approvalMode || '').trim();
    if (approvalMode === '' || approvalMode === 'auto' || approvalMode === 'prompt' || approvalMode === 'approve') {
      return [];
    }
    return [{
      name: row.name.trim(),
      approvalMode,
      reason: 'invalid-approval-mode',
    }];
  });
}

export function buildMcpChangePreview(original: McpServerRecord, draft: McpServerRecord): McpChangePreview[] {
  const changes: McpChangePreview[] = [];
  const pushChange = (key: string, before: string | undefined, after: string | undefined) => {
    const beforeValue = before || '';
    const afterValue = after || '';
    if (beforeValue !== afterValue) {
      changes.push({ key, before: beforeValue || '-', after: afterValue || '-' });
    }
  };

  if (original.enabled !== draft.enabled) {
    changes.push({
      key: 'enabled',
      before: String(original.enabled),
      after: String(draft.enabled),
    });
  }
  if ((original.required || false) !== (draft.required || false)) {
    changes.push({ key: 'required', before: String(original.required || false), after: String(draft.required || false) });
  }
  if ((original.supportsParallelToolCalls || false) !== (draft.supportsParallelToolCalls || false)) {
    changes.push({
      key: 'supports_parallel_tool_calls',
      before: String(original.supportsParallelToolCalls || false),
      after: String(draft.supportsParallelToolCalls || false),
    });
  }
  pushChange('transport', original.transport, draft.transport);
  pushChange('command', original.command, draft.command);
  pushChange('args', serializeMcpArgs(original.args), serializeMcpArgs(draft.args));
  pushChange('env', serializeMcpEnv(original.env), serializeMcpEnv(draft.env));
  pushChange('env_vars', original.envVarsRaw, draft.envVarsRaw);
  pushChange('cwd', original.cwd, draft.cwd);
  pushChange('url', original.url, draft.url);
  pushChange('bearer_token_env_var', original.bearerTokenEnvVar, draft.bearerTokenEnvVar);
  pushChange('http_headers', serializeMcpEnv(original.httpHeaders), serializeMcpEnv(draft.httpHeaders));
  pushChange('env_http_headers', serializeMcpEnv(original.envHttpHeaders), serializeMcpEnv(draft.envHttpHeaders));
  pushChange('environment_id', original.environmentId, draft.environmentId);
  pushChange('experimental_environment', original.experimentalEnvironment, draft.experimentalEnvironment);
  pushChange('startup_timeout_sec', original.startupTimeoutSec, draft.startupTimeoutSec);
  pushChange('tool_timeout_sec', original.toolTimeoutSec, draft.toolTimeoutSec);
  pushChange('default_tools_approval_mode', original.defaultToolsApprovalMode, draft.defaultToolsApprovalMode);
  pushChange('enabled_tools', serializeMcpList(original.enabledTools), serializeMcpList(draft.enabledTools));
  pushChange('disabled_tools', serializeMcpList(original.disabledTools), serializeMcpList(draft.disabledTools));
  pushChange('scopes', serializeMcpList(original.scopes), serializeMcpList(draft.scopes));
  pushChange('oauth.client_id', original.oauthClientId, draft.oauthClientId);
  pushChange('oauth_resource', original.oauthResource, draft.oauthResource);
  pushChange('tools', serializeMcpTools(original.tools), serializeMcpTools(draft.tools));

  return changes;
}
