import {
  Boxes,
  Braces,
  FileCode2,
  FilePenLine,
  GitBranch,
  KeyRound,
  Layers3,
  Save,
  Server,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import AssetWorkbenchShell from '../../../components/ui/AssetWorkbenchShell';
import SearchInput from '../../../components/ui/SearchInput';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import SnippetPre from '../../../components/ui/SnippetPre';

export type ClaudeCodeAssetWorkbenchState =
  | 'skills-ready'
  | 'skills-legacy-command'
  | 'mcp-ready'
  | 'mcp-shadowed-scope'
  | 'empty'
  | 'parse-error'
  | 'saving-diff';

export type ClaudeCodeAssetWorkspace = 'skills' | 'mcp-servers';
export type ClaudeCodeAssetScope = 'user' | 'project' | 'local' | 'legacy-command';
export type ClaudeCodeMcpTransport = 'stdio' | 'http' | 'sse';
export type ClaudeCodeAssetPlanStatus = 'candidate' | 'deferred';

export interface ClaudeCodeSkillAsset {
  id: string;
  name: string;
  description: string;
  scope: Extract<ClaudeCodeAssetScope, 'user' | 'project' | 'legacy-command'>;
  path: string;
  frontmatterStatus: 'valid' | 'missing' | 'invalid';
  invocation: 'auto' | 'manual' | 'legacy';
  modelInvocation: 'enabled' | 'disabled';
  removable: boolean;
  fileCount: number;
  risk?: string;
}

export interface ClaudeCodeMcpAsset {
  id: string;
  label: string;
  transport: ClaudeCodeMcpTransport;
  scope: Extract<ClaudeCodeAssetScope, 'user' | 'project' | 'local'>;
  sourcePath: string;
  endpoint: string;
  active: boolean;
  secretState: 'redacted' | 'none';
  dirty?: boolean;
  shadowedBy?: string;
}

export interface ClaudeCodeAssetPlanItem {
  id: string;
  name: string;
  status: ClaudeCodeAssetPlanStatus;
  owner: string;
  note: string;
}

export interface ClaudeCodeDiffPreview {
  title: string;
  sourcePath: string;
  lines: readonly string[];
}

export interface ClaudeCodeAssetWorkbenchProps {
  state: ClaudeCodeAssetWorkbenchState;
  workspace: ClaudeCodeAssetWorkspace;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  skills: readonly ClaudeCodeSkillAsset[];
  mcpServers: readonly ClaudeCodeMcpAsset[];
  plannedAssets: readonly ClaudeCodeAssetPlanItem[];
  diffPreview?: ClaudeCodeDiffPreview;
  editingMcpServerID?: string;
  mcpDraftEndpoint?: string;
  mcpDraftTransport?: ClaudeCodeMcpTransport;
  savingMcpServerID?: string;
  mcpSaveMessage?: string;
  onStartMcpEdit?: (server: ClaudeCodeMcpAsset) => void;
  onCancelMcpEdit?: () => void;
  onMcpDraftEndpointChange?: (endpoint: string) => void;
  onMcpDraftTransportChange?: (transport: ClaudeCodeMcpTransport) => void;
  onSaveMcpDraft?: (server: ClaudeCodeMcpAsset) => void;
}

const stateMeta: Record<
  ClaudeCodeAssetWorkbenchState,
  { label: string; message: string; tone: 'ready' | 'warning' | 'danger' | 'neutral' }
> = {
  'skills-ready': {
    label: 'Skills ready',
    message: 'User and project skills are ready for read-only preview.',
    tone: 'ready',
  },
  'skills-legacy-command': {
    label: 'Legacy command',
    message: 'Commands stay visible as compatibility assets, not new primary entries.',
    tone: 'warning',
  },
  'mcp-ready': {
    label: 'MCP ready',
    message: 'MCP servers are grouped by Claude scope and transport.',
    tone: 'ready',
  },
  'mcp-shadowed-scope': {
    label: 'Shadowed scope',
    message: 'A higher-priority scope overrides same-name lower-priority servers.',
    tone: 'warning',
  },
  empty: {
    label: 'Empty',
    message: 'No Claude Code assets were found in the selected roots.',
    tone: 'neutral',
  },
  'parse-error': {
    label: 'Parse error',
    message: 'Broken JSON or frontmatter is kept visible with a repair path.',
    tone: 'danger',
  },
  'saving-diff': {
    label: 'Saving diff',
    message: 'Preservative patch preview is required before writing Claude files.',
    tone: 'warning',
  },
};

const toneClass: Record<'ready' | 'warning' | 'danger' | 'neutral', string> = {
  ready:
    'border-[var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_10%,transparent)] text-[var(--color-status-success)]',
  warning:
    'border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_12%,transparent)] text-[var(--color-status-warning)]',
  danger:
    'border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--color-status-danger)]',
  neutral: 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)]',
};

export function ClaudeCodeAssetWorkbench({
  state,
  workspace,
  searchQuery = '',
  onSearchQueryChange,
  skills,
  mcpServers,
  plannedAssets,
  diffPreview,
  editingMcpServerID,
  mcpDraftEndpoint = '',
  mcpDraftTransport = 'stdio',
  savingMcpServerID,
  mcpSaveMessage,
  onStartMcpEdit,
  onCancelMcpEdit,
  onMcpDraftEndpointChange,
  onMcpDraftTransportChange,
  onSaveMcpDraft,
}: ClaudeCodeAssetWorkbenchProps) {
  const currentMeta = stateMeta[state];
  const isSkillsWorkspace = workspace === 'skills';
  const activeMcpCount = mcpServers.filter((server) => server.active).length;
  const shadowedMcpCount = mcpServers.filter((server) => !server.active).length;
  const invalidSkillCount = skills.filter((skill) => skill.frontmatterStatus !== 'valid').length;
  const legacySkillCount = skills.filter((skill) => skill.scope === 'legacy-command').length;
  const dirtyMcpCount = mcpServers.filter((server) => server.dirty).length;
  const headerSubtitle = isSkillsWorkspace
    ? [`${skills.length} skills`, `${invalidSkillCount} invalid`, `${legacySkillCount} legacy command`, currentMeta.message].join(' / ')
    : [`${activeMcpCount} active MCP`, `${shadowedMcpCount} shadowed`, `${dirtyMcpCount} dirty`, currentMeta.message].join(' / ');

  return (
    <div
      data-design-system-component="true"
      data-design-system-component-name="ClaudeCodeAssetWorkbench"
      className="h-full w-full"
    >
      <AssetWorkbenchShell
        dataCollaborationId={isSkillsWorkspace ? 'PAGE_CLAUDE_SKILLS' : 'PAGE_CLAUDE_MCP_SERVERS'}
        title={isSkillsWorkspace ? 'Claude Code Skills' : 'Claude Code MCP Servers'}
        subtitle={headerSubtitle}
        actions={
          <div className="grid grid-cols-3 gap-2 text-right">
            {isSkillsWorkspace ? (
              <>
                <Metric label="skills" value={skills.length} />
                <Metric label="invalid" value={invalidSkillCount} />
                <Metric label="legacy" value={legacySkillCount} />
              </>
            ) : (
              <>
                <Metric label="active" value={activeMcpCount} />
                <Metric label="shadowed" value={shadowedMcpCount} />
                <Metric label="dirty" value={dirtyMcpCount} />
              </>
            )}
          </div>
        }
        actionsClassName="min-w-full sm:min-w-[20rem] sm:flex-none"
        toolbar={
          <SearchInput
            aria-label={isSkillsWorkspace ? 'Search Claude Code skills' : 'Search Claude Code MCP servers'}
            onChange={onSearchQueryChange ?? (() => undefined)}
            placeholder={isSkillsWorkspace ? 'Search skills, commands, scope, path' : 'Search MCP servers, endpoint, scope'}
            value={searchQuery}
          />
        }
        toolbarClassName="lg:grid-cols-1"
        notice={
          <StatusStrip
            icon={<ShieldAlert className="h-4 w-4" />}
            title={currentMeta.label}
            detail={`${currentMeta.message} / ${dirtyMcpCount} dirty MCP server(s), ${plannedAssets.length} planned assets`}
          />
        }
        aside={
          <>
            <DiffPanel diffPreview={diffPreview} />
            <PlanPanel plannedAssets={plannedAssets} />
          </>
        }
      >
        {isSkillsWorkspace ? (
          <SkillAssetMatrix skills={skills} />
        ) : (
          <McpAssetMatrix
            editingServerID={editingMcpServerID}
            draftEndpoint={mcpDraftEndpoint}
            draftTransport={mcpDraftTransport}
            mcpServers={mcpServers}
            saveMessage={mcpSaveMessage}
            savingServerID={savingMcpServerID}
            onCancelEdit={onCancelMcpEdit}
            onDraftEndpointChange={onMcpDraftEndpointChange}
            onDraftTransportChange={onMcpDraftTransportChange}
            onSaveDraft={onSaveMcpDraft}
            onStartEdit={onStartMcpEdit}
          />
        )}
      </AssetWorkbenchShell>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
      <div className="font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-normal">
      {children}
    </span>
  );
}

function SectionTitle({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{title}</h3>
          <p className="mt-0.5 text-xs font-bold leading-5 text-[var(--text-muted)]">{note}</p>
        </div>
      </div>
    </div>
  );
}

function StatusStrip({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)]">{icon}</span>
      <div className="min-w-0">
        <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide">{title}</div>
        <div className="mt-1 font-mono text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">{detail}</div>
      </div>
    </div>
  );
}

function SkillAssetMatrix({ skills }: { skills: readonly ClaudeCodeSkillAsset[] }) {
  if (skills.length === 0) {
    return <EmptyPanel title="No Claude skills discovered" detail="The selected roots returned no SKILL.md or legacy command assets." />;
  }

  return (
    <div>
      <div className="border-b-2 border-[var(--border-color)] px-4 py-3">
        <SectionTitle icon={<Boxes className="h-4 w-4" />} title="Skills / Commands" note="Claude frontmatter replaces Codex enabled overrides." />
      </div>
      <div className="scrollbar-stable min-h-0 flex-1 overflow-auto divide-y-2 divide-[var(--border-color)]">
        {skills.map((skill) => (
          <article key={skill.id} className="group grid gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-lg)] font-black">{skill.name}</span>
                <ScopeBadge scope={skill.scope} />
                <span className={`border px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal ${frontmatterTone(skill.frontmatterStatus)}`}>
                  {skill.frontmatterStatus}
                </span>
                <span className="border border-[var(--border-color)] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">
                  {skill.invocation}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[length:var(--font-size-ui-sm)] font-bold leading-snug text-[var(--text-muted)]">{skill.description}</p>
              <div className="mt-2 grid gap-1 font-mono text-[length:var(--font-size-ui-xs)] font-bold leading-5 text-[var(--text-muted)]">
                <span className="truncate">path: {skill.path}</span>
                {skill.risk ? <span className="text-[var(--color-status-warning)]">risk: {skill.risk}</span> : null}
              </div>
            </div>
            <div className="grid content-center gap-1 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)] md:text-right">
              <span>{skill.fileCount} files</span>
              <span>model {skill.modelInvocation}</span>
              <span>{skill.removable ? 'removable' : 'locked'}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const mcpTransportOptions = (['stdio', 'http', 'sse'] as const).map((transport) => ({ id: transport, label: transport.toUpperCase() }));

function McpAssetMatrix({
  mcpServers,
  editingServerID,
  draftEndpoint,
  draftTransport,
  savingServerID,
  saveMessage,
  onStartEdit,
  onCancelEdit,
  onDraftEndpointChange,
  onDraftTransportChange,
  onSaveDraft,
}: {
  mcpServers: readonly ClaudeCodeMcpAsset[];
  editingServerID?: string;
  draftEndpoint: string;
  draftTransport: ClaudeCodeMcpTransport;
  savingServerID?: string;
  saveMessage?: string;
  onStartEdit?: (server: ClaudeCodeMcpAsset) => void;
  onCancelEdit?: () => void;
  onDraftEndpointChange?: (endpoint: string) => void;
  onDraftTransportChange?: (transport: ClaudeCodeMcpTransport) => void;
  onSaveDraft?: (server: ClaudeCodeMcpAsset) => void;
}) {
  if (mcpServers.length === 0) {
    return <EmptyPanel title="No Claude MCP servers discovered" detail="User, project and local scopes are empty in the mock snapshot." />;
  }

  return (
    <div>
      <div className="border-b-2 border-[var(--border-color)] px-4 py-3">
        <SectionTitle icon={<Server className="h-4 w-4" />} title="MCP Servers" note="Local > project > user precedence is visible before any save." />
      </div>
      <div className="divide-y-2 divide-[var(--border-color)]">
        {mcpServers.map((server) => (
          <article
            key={mcpServerEditKey(server)}
            className={`grid gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface)] ${
              server.active ? '' : 'bg-[color-mix(in_srgb,var(--color-status-warning)_6%,transparent)]'
            }`}
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-lg-compact)] font-black">{server.label}</span>
                  <ScopeBadge scope={server.scope} />
                  <span className="border border-[var(--border-color)] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">
                    {server.transport}
                  </span>
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal ${
                      server.active
                        ? 'border-[var(--color-status-success)] text-[var(--color-status-success)]'
                        : 'border-[var(--color-status-warning)] text-[var(--color-status-warning)]'
                    }`}
                  >
                    {server.active ? 'active' : 'shadowed'}
                  </span>
                  {server.dirty ? (
                    <span className="border border-[var(--accent-red)] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--accent-red)]">
                      dirty
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 grid gap-1 font-mono text-[length:var(--font-size-ui-sm)] font-bold leading-5 text-[var(--text-muted)]">
                  <span className="truncate">endpoint: {server.endpoint}</span>
                  <span className="truncate">source: {server.sourcePath}</span>
                  {server.shadowedBy ? <span className="text-[var(--color-status-warning)]">shadowed by: {server.shadowedBy}</span> : null}
                </div>
              </div>
              <div className="grid content-center gap-2 md:justify-items-end">
                <div className="grid gap-1 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)] md:text-right">
                  <span>{server.secretState === 'redacted' ? 'secret redacted' : 'no secret'}</span>
                  <span>{server.scope} scope</span>
                </div>
                <button
                  type="button"
                  className="btn-swiss !px-2.5 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                  onClick={() => onStartEdit?.(server)}
                  disabled={!onStartEdit}
                >
                  <FilePenLine className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            </div>
            {editingServerID === mcpServerEditKey(server) ? (
              <div className="grid gap-3 border-t-2 border-[var(--border-color)] pt-3 md:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)_auto] md:items-end">
                <SegmentedControl options={mcpTransportOptions} value={draftTransport} onChange={onDraftTransportChange ?? (() => undefined)} />
                <label className="grid gap-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-normal text-[var(--text-muted)]">
                  Endpoint
                  <input
                    className="min-h-10 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-color)]"
                    value={draftEndpoint}
                    onChange={(event) => onDraftEndpointChange?.(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button type="button" className="btn-swiss !px-2.5 !py-1.5 !text-[length:var(--font-size-ui-xs)]" onClick={() => onSaveDraft?.(server)} disabled={!onSaveDraft || savingServerID === mcpServerEditKey(server)}>
                    <Save className="h-3.5 w-3.5" />
                    {savingServerID === mcpServerEditKey(server) ? 'Saving' : 'Save'}
                  </button>
                  <button type="button" className="btn-swiss !px-2.5 !py-1.5 !text-[length:var(--font-size-ui-xs)]" onClick={onCancelEdit}>
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                </div>
                {saveMessage ? <div className="font-mono text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)] md:col-span-3">{saveMessage}</div> : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function mcpServerEditKey(server: ClaudeCodeMcpAsset) {
  return `${server.scope}:${server.label || server.id}`;
}

function DiffPanel({ diffPreview }: { diffPreview?: ClaudeCodeDiffPreview }) {
  return (
    <section className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <SectionTitle icon={<Save className="h-4 w-4" />} title="Patch Preview" note="Preserve unknown fields before write" />
      {diffPreview ? (
        <div className="mt-3 grid gap-2">
          <div className="font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">{diffPreview.sourcePath}</div>
          <SnippetPre className="mt-2 bg-[var(--bg-main)] p-3 text-[11px] leading-5">
            {diffPreview.lines.map((line) => (
              <span
                key={line}
                className={`block whitespace-pre ${
                  line.startsWith('+') ? 'text-[var(--color-status-success)]' : line.startsWith('-') ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {line}
              </span>
            ))}
          </SnippetPre>
        </div>
      ) : (
        <p className="mt-3 text-sm font-bold leading-6 text-[var(--text-muted)]">No pending diff. Writes stay disabled until a target scope and server are selected.</p>
      )}
    </section>
  );
}

function PlanPanel({ plannedAssets }: { plannedAssets: readonly ClaudeCodeAssetPlanItem[] }) {
  return (
    <section className="bg-[var(--bg-surface)] p-3">
      <SectionTitle icon={<GitBranch className="h-4 w-4" />} title="Next Assets" note="Candidate and deferred states stay visible" />
      <div className="mt-3 grid gap-2">
        {plannedAssets.map((item) => (
          <article key={item.id} className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-black">{item.name}</span>
              <span className="border border-[var(--border-color)] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">
                {item.status}
              </span>
            </div>
            <div className="mt-2 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">{item.owner}</div>
            <p className="mt-2 text-xs font-bold leading-5 text-[var(--text-muted)]">{item.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-48 place-items-center border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-6 text-center">
      <div className="max-w-md">
        <FileCode2 className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
        <h3 className="mt-3 text-sm font-black uppercase italic tracking-normal">{title}</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-[var(--text-muted)]">{detail}</p>
      </div>
    </div>
  );
}

function ScopeBadge({ scope }: { scope: ClaudeCodeAssetScope }) {
  const icon =
    scope === 'project' ? <Layers3 className="h-3 w-3" /> : scope === 'local' ? <KeyRound className="h-3 w-3" /> : <Braces className="h-3 w-3" />;

  return (
    <span className="inline-flex min-w-[5.5rem] items-center justify-center gap-1 border border-[var(--border-color)] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">
      {icon}
      {scope}
    </span>
  );
}

function frontmatterTone(status: ClaudeCodeSkillAsset['frontmatterStatus']) {
  if (status === 'valid') {
    return 'border-[var(--color-status-success)] text-[var(--color-status-success)]';
  }
  if (status === 'invalid') {
    return 'border-[var(--color-status-danger)] text-[var(--color-status-danger)]';
  }
  return 'border-[var(--color-status-warning)] text-[var(--color-status-warning)]';
}
