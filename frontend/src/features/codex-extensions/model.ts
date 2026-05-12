export type CodexGitProvider = 'github' | 'gitlab';
export type CodexSkillSourceKind = 'system' | 'user' | 'project' | 'github' | 'gitlab';
export type McpTransport = 'stdio' | 'streamable_http';

export interface CodexSkillFile {
  path: string;
  kind: 'skill' | 'asset' | 'script' | 'other';
}

export interface CodexSkillRecord {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rootLabel: string;
  rootPath: string;
  sourceKind: CodexSkillSourceKind;
  origin: string;
  versionLabel: string;
  files: CodexSkillFile[];
  skillMarkdown: string;
}

export interface McpEnvRow {
  key: string;
  value: string;
}

export interface McpServerRecord {
  id: string;
  label: string;
  enabled: boolean;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  env?: McpEnvRow[];
  bearerTokenEnvVar?: string;
  sourcePath: string;
  status: 'ready' | 'missing-env' | 'disabled';
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

const gitlabAllowlist = new Set(['gitlab.com']);

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

  if (host === 'github.com') {
    return {
      provider: 'github',
      host,
      repo: `${segments[0]}/${segments[1]}`,
      ref: url.searchParams.get('ref') || 'main',
      path: url.searchParams.get('path') || '.',
    };
  }

  if (host.endsWith('gitlab.com') && gitlabAllowlist.has(host)) {
    const repoSegments = segments.length > 2 ? segments : segments.slice(0, 2);
    return {
      provider: 'gitlab',
      host,
      repo: repoSegments.join('/'),
      ref: url.searchParams.get('ref') || 'main',
      path: url.searchParams.get('path') || '.',
    };
  }

  return null;
}

export function serializeMcpArgs(args: string[] | undefined): string {
  return (args || []).join(' ');
}

export function parseMcpArgs(value: string): string[] {
  return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
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
        return { key: line, value: '' };
      }
      return {
        key: line.slice(0, index).trim(),
        value: line.slice(index + 1).trim(),
      };
    })
    .filter((row) => row.key.length > 0);
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
  pushChange('command', original.command, draft.command);
  pushChange('args', serializeMcpArgs(original.args), serializeMcpArgs(draft.args));
  pushChange('url', original.url, draft.url);
  pushChange('bearer_token_env_var', original.bearerTokenEnvVar, draft.bearerTokenEnvVar);
  pushChange('env', serializeMcpEnv(original.env), serializeMcpEnv(draft.env));

  return changes;
}
