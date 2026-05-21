import { useEffect, useMemo, useState } from 'react';
import { GetClaudeCodeExtensionsSnapshot, SaveClaudeCodeMcpServer } from '../../../wailsjs/go/main/App';
import type { main } from '../../../wailsjs/go/models';
import type { ClaudeWorkspace } from '../../types';
import { hasWailsAppBindings } from '../../utils/previewMode';
import {
  ClaudeCodeAssetWorkbench,
  type ClaudeCodeMcpAsset,
  type ClaudeCodeSkillAsset,
  type ClaudeCodeAssetWorkbenchProps,
} from './components/ClaudeCodeAssetWorkbench';
import {
  claudeCodePreviewDiff,
  claudeCodePreviewMcpServers,
  claudeCodePreviewPlannedAssets,
  claudeCodePreviewSkills,
} from './assetPreviewData';

interface ClaudeCodeAssetWorkbenchFeatureProps {
  workspace?: Extract<ClaudeWorkspace, 'skills' | 'mcp-servers'>;
}

function includesQuery(values: readonly string[], query: string) {
  if (!query) {
    return true;
  }
  const normalizedQuery = query.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalizedQuery));
}

export default function ClaudeCodeAssetWorkbenchFeature({ workspace = 'skills' }: ClaudeCodeAssetWorkbenchFeatureProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [skills, setSkills] = useState<readonly ClaudeCodeSkillAsset[]>(claudeCodePreviewSkills);
  const [mcpServers, setMcpServers] = useState<readonly ClaudeCodeMcpAsset[]>(claudeCodePreviewMcpServers);
  const [loadError, setLoadError] = useState('');
  const [editingMcpServer, setEditingMcpServer] = useState<ClaudeCodeMcpAsset | null>(null);
  const [mcpDraftEndpoint, setMcpDraftEndpoint] = useState('');
  const [mcpDraftTransport, setMcpDraftTransport] = useState<ClaudeCodeMcpAsset['transport']>('stdio');
  const [savingMcpServerID, setSavingMcpServerID] = useState('');
  const [mcpSaveMessage, setMcpSaveMessage] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();

  async function loadSnapshot() {
    if (!hasWailsAppBindings()) {
      setSkills(claudeCodePreviewSkills);
      setMcpServers(claudeCodePreviewMcpServers);
      setLoadError('');
      return;
    }
    const snapshot = await GetClaudeCodeExtensionsSnapshot();
    setSkills((snapshot.skills || []).map(mapBackendSkillAsset));
    setMcpServers((snapshot.mcpServers || []).map(mapBackendMcpAsset));
    setLoadError('');
  }

  useEffect(() => {
    if (!hasWailsAppBindings()) {
      void loadSnapshot();
      return;
    }

    let cancelled = false;
    loadSnapshot()
      .then(() => {
        if (cancelled) {
          return;
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error(error);
        setSkills([]);
        setMcpServers([]);
        setLoadError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function startMcpEdit(server: ClaudeCodeMcpAsset) {
    setEditingMcpServer(server);
    setMcpDraftEndpoint(server.endpoint);
    setMcpDraftTransport(server.transport);
    setMcpSaveMessage('');
  }

  function cancelMcpEdit() {
    setEditingMcpServer(null);
    setMcpDraftEndpoint('');
    setMcpDraftTransport('stdio');
    setMcpSaveMessage('');
  }

  async function saveMcpDraft(server: ClaudeCodeMcpAsset) {
    const editKey = mcpServerEditKey(server);
    const nextServer: ClaudeCodeMcpAsset = {
      ...server,
      endpoint: mcpDraftEndpoint.trim(),
      transport: mcpDraftTransport,
    };
    if (!nextServer.endpoint) {
      setMcpSaveMessage('Endpoint is required.');
      return;
    }
    if (!hasWailsAppBindings()) {
      setMcpServers((current) => current.map((item) => (mcpServerEditKey(item) === editKey ? { ...nextServer, dirty: true } : item)));
      setMcpSaveMessage('Preview save only.');
      setEditingMcpServer(nextServer);
      return;
    }
    setSavingMcpServerID(editKey);
    setMcpSaveMessage('');
    try {
      const result = await SaveClaudeCodeMcpServer({
        server: mapFrontendMcpAssetToBackend(nextServer),
      } as main.SaveClaudeCodeMcpServerInput);
      await loadSnapshot();
      const saved = mapBackendMcpAsset(result.server);
      setEditingMcpServer(saved);
      setMcpDraftEndpoint(saved.endpoint);
      setMcpDraftTransport(saved.transport);
      setMcpSaveMessage(`Saved ${result.changes?.length || 0} change(s).`);
    } catch (error) {
      console.error(error);
      setMcpSaveMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingMcpServerID('');
    }
  }

  const filteredSkills = useMemo(
    () =>
      skills.filter((skill) =>
        includesQuery([skill.name, skill.description, skill.scope, skill.path, skill.invocation, skill.modelInvocation], normalizedQuery),
      ),
    [normalizedQuery, skills],
  );
  const filteredMcpServers = useMemo(
    () =>
      mcpServers.filter((server) =>
        includesQuery([server.label, server.endpoint, server.scope, server.sourcePath, server.transport, server.shadowedBy || ''], normalizedQuery),
      ),
    [normalizedQuery, mcpServers],
  );

  const state = resolveWorkbenchState({
    workspace,
    hasLoadError: loadError.length > 0,
    skills: filteredSkills,
    mcpServers: filteredMcpServers,
  });

  if (workspace === 'skills') {
    return (
      <ClaudeCodeSkillsWorkspace
        mcpServers={filteredMcpServers}
        plannedAssets={claudeCodePreviewPlannedAssets}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        skills={filteredSkills}
        state={state}
      />
    );
  }

  return (
    <ClaudeCodeMcpServersWorkspace
      diffPreview={claudeCodePreviewDiff}
      editingMcpServerID={editingMcpServer ? mcpServerEditKey(editingMcpServer) : ''}
      mcpServers={filteredMcpServers}
      mcpDraftEndpoint={mcpDraftEndpoint}
      mcpDraftTransport={mcpDraftTransport}
      mcpSaveMessage={mcpSaveMessage}
      onCancelMcpEdit={cancelMcpEdit}
      onMcpDraftEndpointChange={setMcpDraftEndpoint}
      onMcpDraftTransportChange={setMcpDraftTransport}
      onSaveMcpDraft={saveMcpDraft}
      onStartMcpEdit={startMcpEdit}
      plannedAssets={claudeCodePreviewPlannedAssets}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      savingMcpServerID={savingMcpServerID}
      skills={filteredSkills}
      state={state}
    />
  );
}

interface ClaudeCodeWorkspaceViewProps {
  state: ClaudeCodeAssetWorkbenchProps['state'];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  skills: readonly ClaudeCodeSkillAsset[];
  mcpServers: readonly ClaudeCodeMcpAsset[];
  plannedAssets: typeof claudeCodePreviewPlannedAssets;
}

function ClaudeCodeSkillsWorkspace({
  state,
  searchQuery,
  setSearchQuery,
  skills,
  mcpServers,
  plannedAssets,
}: ClaudeCodeWorkspaceViewProps) {
  return (
    <ClaudeCodeAssetWorkbench
      mcpServers={mcpServers}
      onSearchQueryChange={setSearchQuery}
      plannedAssets={plannedAssets}
      searchQuery={searchQuery}
      skills={skills}
      state={state}
      workspace="skills"
    />
  );
}

interface ClaudeCodeMcpServersWorkspaceProps extends ClaudeCodeWorkspaceViewProps {
  diffPreview: typeof claudeCodePreviewDiff;
  editingMcpServerID: string;
  mcpDraftEndpoint: string;
  mcpDraftTransport: ClaudeCodeMcpAsset['transport'];
  mcpSaveMessage: string;
  savingMcpServerID: string;
  onCancelMcpEdit: () => void;
  onMcpDraftEndpointChange: (endpoint: string) => void;
  onMcpDraftTransportChange: (transport: ClaudeCodeMcpAsset['transport']) => void;
  onSaveMcpDraft: (server: ClaudeCodeMcpAsset) => void;
  onStartMcpEdit: (server: ClaudeCodeMcpAsset) => void;
}

function ClaudeCodeMcpServersWorkspace({
  state,
  searchQuery,
  setSearchQuery,
  skills,
  mcpServers,
  plannedAssets,
  diffPreview,
  editingMcpServerID,
  mcpDraftEndpoint,
  mcpDraftTransport,
  mcpSaveMessage,
  savingMcpServerID,
  onCancelMcpEdit,
  onMcpDraftEndpointChange,
  onMcpDraftTransportChange,
  onSaveMcpDraft,
  onStartMcpEdit,
}: ClaudeCodeMcpServersWorkspaceProps) {
  return (
    <ClaudeCodeAssetWorkbench
      diffPreview={diffPreview}
      editingMcpServerID={editingMcpServerID}
      mcpDraftEndpoint={mcpDraftEndpoint}
      mcpDraftTransport={mcpDraftTransport}
      mcpSaveMessage={mcpSaveMessage}
      mcpServers={mcpServers}
      onCancelMcpEdit={onCancelMcpEdit}
      onMcpDraftEndpointChange={onMcpDraftEndpointChange}
      onMcpDraftTransportChange={onMcpDraftTransportChange}
      onSaveMcpDraft={onSaveMcpDraft}
      onSearchQueryChange={setSearchQuery}
      onStartMcpEdit={onStartMcpEdit}
      plannedAssets={plannedAssets}
      searchQuery={searchQuery}
      savingMcpServerID={savingMcpServerID}
      skills={skills}
      state={state}
      workspace="mcp-servers"
    />
  );
}

function resolveWorkbenchState({
  workspace,
  hasLoadError,
  skills,
  mcpServers,
}: {
  workspace: Extract<ClaudeWorkspace, 'skills' | 'mcp-servers'>;
  hasLoadError: boolean;
  skills: readonly ClaudeCodeSkillAsset[];
  mcpServers: readonly ClaudeCodeMcpAsset[];
}): ClaudeCodeAssetWorkbenchProps['state'] {
  if (hasLoadError) {
    return 'parse-error';
  }
  if (workspace === 'skills') {
    if (skills.length === 0) {
      return 'empty';
    }
    return skills.some((skill) => skill.scope === 'legacy-command') ? 'skills-legacy-command' : 'skills-ready';
  }
  if (mcpServers.length === 0) {
    return 'empty';
  }
  return mcpServers.some((server) => !server.active) ? 'mcp-shadowed-scope' : 'mcp-ready';
}

function mapBackendSkillAsset(skill: main.ClaudeCodeSkillAsset): ClaudeCodeSkillAsset {
  return {
    id: skill.id,
    name: skill.name || 'unnamed-skill',
    description: skill.description || skill.path || '',
    scope: normalizeSkillScope(skill.scope),
    path: skill.path || '',
    frontmatterStatus: normalizeFrontmatterStatus(skill.frontmatterStatus),
    invocation: normalizeInvocation(skill.invocation),
    modelInvocation: normalizeModelInvocation(skill.modelInvocation),
    removable: Boolean(skill.removable),
    fileCount: Number(skill.fileCount || 0),
    risk: skill.frontmatterError || skill.risk,
  };
}

function mapBackendMcpAsset(server: main.ClaudeCodeMcpAsset): ClaudeCodeMcpAsset {
  return {
    id: server.id,
    label: server.label || server.id,
    transport: normalizeMcpTransport(server.transport),
    scope: normalizeMcpScope(server.scope),
    sourcePath: server.sourcePath || '',
    endpoint: server.endpoint || '',
    active: Boolean(server.active),
    secretState: server.secretState === 'redacted' ? 'redacted' : 'none',
    dirty: Boolean(server.dirty),
    shadowedBy: server.shadowedBy,
  };
}

function mapFrontendMcpAssetToBackend(server: ClaudeCodeMcpAsset): main.ClaudeCodeMcpAsset {
  return {
    id: server.id,
    label: server.label,
    transport: server.transport,
    scope: server.scope,
    sourcePath: server.sourcePath,
    endpoint: server.endpoint,
    active: server.active,
    secretState: server.secretState,
    dirty: server.dirty,
    shadowedBy: server.shadowedBy,
  } as main.ClaudeCodeMcpAsset;
}

function mcpServerEditKey(server: ClaudeCodeMcpAsset) {
  return `${server.scope}:${server.label || server.id}`;
}

function normalizeSkillScope(scope: string): ClaudeCodeSkillAsset['scope'] {
  if (scope === 'project' || scope === 'legacy-command') {
    return scope;
  }
  return 'user';
}

function normalizeMcpScope(scope: string): ClaudeCodeMcpAsset['scope'] {
  if (scope === 'project' || scope === 'local') {
    return scope;
  }
  return 'user';
}

function normalizeFrontmatterStatus(status: string): ClaudeCodeSkillAsset['frontmatterStatus'] {
  if (status === 'missing' || status === 'invalid') {
    return status;
  }
  return 'valid';
}

function normalizeInvocation(invocation: string): ClaudeCodeSkillAsset['invocation'] {
  if (invocation === 'manual' || invocation === 'legacy') {
    return invocation;
  }
  return 'auto';
}

function normalizeModelInvocation(value: string): ClaudeCodeSkillAsset['modelInvocation'] {
  return value === 'disabled' ? 'disabled' : 'enabled';
}

function normalizeMcpTransport(value: string): ClaudeCodeMcpAsset['transport'] {
  if (value === 'http' || value === 'sse') {
    return value;
  }
  return 'stdio';
}
