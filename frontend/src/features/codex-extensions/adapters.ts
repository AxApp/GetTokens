import { main } from '../../../wailsjs/go/models';
import { isEditableMcpTransport, type CodexSkillRecord, type McpPreflightResult, type McpServerRecord, type McpTransport } from './model';

export function formatSkillSourceLabel(skill: CodexSkillRecord, t: (key: string) => string): string {
  if ((skill.sourceKind === 'github' || skill.sourceKind === 'gitlab') && skill.origin && skill.origin !== 'local') {
    return 'Git';
  }

  return t('codex_extensions.source');
}

export function formatSkillSourceValue(skill: CodexSkillRecord): string {
  if ((skill.sourceKind === 'github' || skill.sourceKind === 'gitlab') && skill.origin && skill.origin !== 'local') {
    return skill.origin;
  }

  return skill.rootPath || skill.rootLabel || '-';
}

export function cloneServer(server: McpServerRecord): McpServerRecord {
  return {
    ...server,
    args: [...(server.args || [])],
    env: (server.env || []).map((row) => ({ ...row })),
    httpHeaders: (server.httpHeaders || []).map((row) => ({ ...row })),
    envHttpHeaders: (server.envHttpHeaders || []).map((row) => ({ ...row })),
    enabledTools: [...(server.enabledTools || [])],
    disabledTools: [...(server.disabledTools || [])],
    scopes: [...(server.scopes || [])],
    tools: (server.tools || []).map((row) => ({ ...row })),
  };
}

export function mapBackendSkill(skill: main.CodexSkillRecord): CodexSkillRecord {
  const extendedSkill = skill as main.CodexSkillRecord & {
    enabledSource?: string;
    enabledSourceValue?: string;
    warnings?: string[];
  };
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || '',
    enabled: skill.enabled,
    enabledSource: normalizeSkillEnabledSource(extendedSkill.enabledSource),
    enabledSourceValue: extendedSkill.enabledSourceValue || '',
    rootLabel: skill.rootLabel,
    rootPath: skill.rootPath,
    sourceKind: normalizeSkillSourceKind(skill.sourceKind),
    origin: skill.origin || 'local',
    versionLabel: skill.versionLabel || 'local',
    files: (skill.files || []).map((file) => ({
      path: file.path,
      kind: file.kind === 'skill' || file.kind === 'asset' || file.kind === 'script' ? file.kind : 'other',
      content: file.content || '',
      previewable: Boolean(file.previewable),
    })),
    skillMarkdown: skill.skillMarkdown || skill.previewMarkdown || '',
    warnings: [...(extendedSkill.warnings || [])],
  };
}

export function isGlobalSkillSource(skill: CodexSkillRecord): boolean {
  return skill.sourceKind === 'system' || skill.sourceKind === 'user';
}

function normalizeSkillSourceKind(value: string): CodexSkillRecord['sourceKind'] {
  if (value === 'system' || value === 'user' || value === 'project' || value === 'github' || value === 'gitlab') {
    return value;
  }
  return 'user';
}

function normalizeSkillEnabledSource(value: string | undefined): CodexSkillRecord['enabledSource'] {
  if (value === 'path_rule' || value === 'name_rule' || value === 'default_enabled') {
    return value;
  }
  return 'default_enabled';
}

export function mapBackendMcpServer(server: main.CodexMcpServer): McpServerRecord {
  return {
    id: server.id,
    label: server.label || server.id,
    enabled: server.enabled,
    transport: normalizeMcpTransport(server.transport),
    command: server.command || '',
    args: [...(server.args || [])],
    env: (server.env || []).map((row) => ({ key: row.key, value: row.value })),
    envVarsRaw: server.envVarsRaw || '',
    cwd: server.cwd || '',
    url: server.url || '',
    bearerTokenEnvVar: server.bearerTokenEnvVar || '',
    httpHeaders: (server.httpHeaders || []).map((row) => ({ key: row.key, value: row.value })),
    envHttpHeaders: (server.envHttpHeaders || []).map((row) => ({ key: row.key, value: row.value })),
    environmentId: server.environmentId || '',
    experimentalEnvironment: server.experimentalEnvironment || '',
    required: Boolean(server.required),
    supportsParallelToolCalls: Boolean(server.supportsParallelToolCalls),
    startupTimeoutSec: server.startupTimeoutSec || '',
    toolTimeoutSec: server.toolTimeoutSec || '',
    defaultToolsApprovalMode: server.defaultToolsApprovalMode || '',
    enabledTools: [...(server.enabledTools || [])],
    disabledTools: [...(server.disabledTools || [])],
    scopes: [...(server.scopes || [])],
    oauthClientId: server.oauthClientId || '',
    oauthResource: server.oauthResource || '',
    tools: (server.tools || []).map((tool) => ({ name: tool.name, approvalMode: tool.approvalMode || '' })),
    rawConfig: server.rawConfig || '',
    sourcePath: server.sourcePath,
    status: normalizeMcpStatus(server.status),
  };
}

export function toBackendMcpServer(server: McpServerRecord): main.CodexMcpServer {
  if (!isEditableMcpTransport(server.transport)) {
    throw new Error(`MCP transport ${server.transport} must be resolved before saving`);
  }
  return {
    id: server.id,
    label: server.label || server.id,
    enabled: server.enabled,
    transport: server.transport,
    command: server.transport === 'stdio' ? server.command || '' : '',
    args: server.transport === 'stdio' ? [...(server.args || [])] : [],
    env: server.transport === 'stdio' ? (server.env || []).map((row) => ({ key: row.key, value: row.value })) : [],
    envVarsRaw: server.transport === 'stdio' ? server.envVarsRaw || '' : '',
    cwd: server.transport === 'stdio' ? server.cwd || '' : '',
    url: server.transport === 'streamable_http' ? server.url || '' : '',
    bearerTokenEnvVar: server.transport === 'streamable_http' ? server.bearerTokenEnvVar || '' : '',
    httpHeaders: server.transport === 'streamable_http' ? (server.httpHeaders || []).map((row) => ({ key: row.key, value: row.value })) : [],
    envHttpHeaders: server.transport === 'streamable_http' ? (server.envHttpHeaders || []).map((row) => ({ key: row.key, value: row.value })) : [],
    environmentId: server.environmentId || '',
    experimentalEnvironment: server.experimentalEnvironment || '',
    required: Boolean(server.required),
    supportsParallelToolCalls: Boolean(server.supportsParallelToolCalls),
    startupTimeoutSec: server.startupTimeoutSec || '',
    toolTimeoutSec: server.toolTimeoutSec || '',
    defaultToolsApprovalMode: server.defaultToolsApprovalMode || '',
    enabledTools: [...(server.enabledTools || [])],
    disabledTools: [...(server.disabledTools || [])],
    scopes: [...(server.scopes || [])],
    oauthClientId: server.transport === 'streamable_http' ? server.oauthClientId || '' : '',
    oauthResource: server.transport === 'streamable_http' ? server.oauthResource || '' : '',
    tools: (server.tools || []).map((tool) => ({ name: tool.name, approvalMode: tool.approvalMode || '' })),
    rawConfig: server.rawConfig || '',
    sourcePath: server.sourcePath,
    status: server.status,
  } as main.CodexMcpServer;
}

export function mapBackendMcpPreflightResult(result: main.CodexMcpPreflightResult): McpPreflightResult {
  return {
    serverID: result.serverID || '',
    status: normalizeMcpPreflightStatus(result.status),
    checks: (result.checks || []).map((check) => ({
      id: check.id || '',
      label: check.label || '',
      status: normalizeMcpPreflightStatus(check.status),
      detail: check.detail || '',
    })),
  };
}

function normalizeMcpTransport(value: string): McpTransport {
  if (value === 'streamable_http' || value === 'conflict' || value === 'unknown') {
    return value;
  }
  return 'stdio';
}

function normalizeMcpPreflightStatus(value: string): McpPreflightResult['status'] {
  if (value === 'warning' || value === 'error') {
    return value;
  }
  return 'ok';
}

function normalizeMcpStatus(value: string): McpServerRecord['status'] {
  if (value === 'disabled' || value === 'missing-env' || value === 'error') {
    return value;
  }
  return 'ready';
}
