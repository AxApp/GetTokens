import { Download, FilePenLine } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GetCodexConfigToml,
  GetCodexMcpServers,
  GetCodexSkillsSnapshot,
  OpenCodexSkillInFinder,
  PreflightCodexMcpServer,
  RemoveCodexSkill,
  SaveCodexConfigToml,
  SaveCodexMcpServer,
  SaveCodexSkillEnabled,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import AssetWorkbenchShell from '../../components/ui/AssetWorkbenchShell';
import RefreshActionButton from '../../components/ui/RefreshActionButton';
import SearchInput from '../../components/ui/SearchInput';
import SegmentedControl from '../../components/ui/SegmentedControl';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { useI18n } from '../../context/I18nContext';
import type { CodexWorkspace, SegmentedOption } from '../../types';
import { toErrorMessage } from '../../utils/error';
import {
  buildCodexSkillDetailFrameHash,
  clearCodexSkillDetailFrameHash,
  readFrameHashState,
} from '../../utils/pagePersistence';
import { hasWailsAppBindings } from '../../utils/previewMode';
import {
  buildMcpChangePreview,
  removeCodexSkillByID,
  parseTkGitSkillSource,
  updateCodexSkillEnabled,
  type CodexSkillRecord,
  type McpPreflightResult,
  type McpServerRecord,
  type McpTransport,
} from './model';
import {
  cloneServer,
  formatSkillSourceLabel,
  formatSkillSourceValue,
  isGlobalSkillSource,
  mapBackendMcpPreflightResult,
  mapBackendMcpServer,
  mapBackendSkill,
  toBackendMcpServer,
} from './adapters';
import { previewConfigToml, previewMcpServers, previewSkills } from './previewData';
import { GitSkillInstallModal, SkillPreviewModal, SuccessHud } from './SkillsModals';
import { ConfigTomlEditorModal, McpServerEditorModal, McpStatusBadge } from './McpModals';

type SkillRootFilter = 'all' | 'system' | 'user';
type McpFilter = 'all' | McpTransport;

const skillRootOptions: ReadonlyArray<SegmentedOption<SkillRootFilter>> = [
  { id: 'all', label: 'ALL' },
  { id: 'system', label: 'SYSTEM' },
  { id: 'user', label: 'USER' },
];

const mcpFilterOptions: ReadonlyArray<SegmentedOption<McpFilter>> = [
  { id: 'all', label: 'ALL' },
  { id: 'stdio', label: 'STDIO' },
  { id: 'streamable_http', label: 'HTTP' },
];

interface ConfigEditorState {
  open: boolean;
  configPath: string;
  content: string;
  originalContent: string;
  loading: boolean;
  saving: boolean;
}

interface CodexExtensionsFeatureProps {
  workspace: Extract<CodexWorkspace, 'skills' | 'mcp-servers'>;
}

export default function CodexExtensionsFeature({ workspace }: CodexExtensionsFeatureProps) {
  if (workspace === 'skills') {
    return <CodexSkillsWorkspace />;
  }
  return <CodexMcpServersWorkspace />;
}

function CodexSkillsWorkspace() {
  const { t } = useI18n();
  const browserMode = !hasWailsAppBindings();
  const [skills, setSkills] = useState<CodexSkillRecord[]>(() => previewSkills.filter(isGlobalSkillSource).map((skill) => ({ ...skill })));
  const [query, setQuery] = useState('');
  const [rootFilter, setRootFilter] = useState<SkillRootFilter>('all');
  const [selectedID, setSelectedID] = useState('');
  const [gitInstallOpen, setGitInstallOpen] = useState(false);
  const [gitSource, setGitSource] = useState('tk://github.com/openai/codex?ref=main&path=skills/skill-installer');
  const [message, setMessage] = useState(t('codex_extensions.preview_loaded'));
  const [loading, setLoading] = useState(false);
  const [successHud, setSuccessHud] = useState<{ title: string; detail: string } | null>(null);
  const successHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedGitSource = useMemo(() => parseTkGitSkillSource(gitSource), [gitSource]);
  const filteredSkills = useMemo(
    () =>
      skills.filter((skill) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          q.length === 0 ||
          skill.name.toLowerCase().includes(q) ||
          skill.description.toLowerCase().includes(q) ||
          skill.origin.toLowerCase().includes(q);
        const matchesRoot = rootFilter === 'all' || skill.sourceKind === rootFilter;
        return matchesQuery && matchesRoot;
      }),
    [query, rootFilter, skills],
  );
  const selectedSkill = skills.find((skill) => skill.id === selectedID) || null;
  const enabledSkillCount = skills.filter((skill) => skill.enabled).length;
  const skillsHeaderSubtitle = [
    `${skills.length} ${t('codex_extensions.total')}`,
    `${enabledSkillCount} ${t('codex_extensions.enabled')}`,
    `${filteredSkills.length}/${skills.length} ${t('codex_extensions.visible')}`,
  ].join(' / ');

  async function reloadSkills(messageOverride?: string) {
    if (browserMode) {
      const nextSkills = previewSkills.filter(isGlobalSkillSource).map((skill) => ({ ...skill }));
      setSkills(nextSkills);
      setSelectedID((current) => resolveCodexSkillDetailSelection(nextSkills, current));
      setMessage(messageOverride || t('codex_extensions.preview_loaded'));
      return;
    }

    setLoading(true);
    try {
      const snapshot = await GetCodexSkillsSnapshot();
      const nextSkills = (snapshot.skills || []).map(mapBackendSkill).filter(isGlobalSkillSource);
      setSkills(nextSkills);
      setSelectedID((current) => resolveCodexSkillDetailSelection(nextSkills, current));
      setMessage(messageOverride || t('codex_extensions.real_loaded'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex_extensions.load_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadSkills();
  }, [browserMode]);

  useEffect(() => {
    const handleHashChange = () => {
      setSelectedID(resolveCodexSkillDetailIDFromHash(window.location.hash) || '');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(
    () => () => {
      if (successHudTimerRef.current) {
        clearTimeout(successHudTimerRef.current);
      }
    },
    [],
  );

  function showSuccessHud(detail: string) {
    if (successHudTimerRef.current) {
      clearTimeout(successHudTimerRef.current);
    }
    setSuccessHud({ title: t('codex_extensions.skill_removed_hud'), detail });
    successHudTimerRef.current = setTimeout(() => {
      setSuccessHud(null);
      successHudTimerRef.current = null;
    }, 1800);
  }

  function openSkillDetail(skill: CodexSkillRecord) {
    window.history.replaceState(null, '', buildCodexSkillDetailFrameHash(window.location.hash, skill.id));
    setSelectedID(skill.id);
  }

  function closeSkillDetail() {
    window.history.replaceState(null, '', clearCodexSkillDetailFrameHash(window.location.hash));
    setSelectedID('');
  }

  async function toggleSkill(skill: CodexSkillRecord, checked: boolean) {
    if (!browserMode) {
      try {
        await SaveCodexSkillEnabled({ path: skill.id, name: skill.name, enabled: checked });
        setSkills((prev) => updateCodexSkillEnabled(prev, skill.id, checked));
        setMessage(checked ? t('codex_extensions.skill_enabled_saved') : t('codex_extensions.skill_disabled_saved'));
        return;
      } catch (error) {
        console.error(error);
        setMessage(`${t('codex_extensions.save_failed')}: ${toErrorMessage(error)}`);
        return;
      }
    }
    setSkills((prev) => updateCodexSkillEnabled(prev, skill.id, checked));
    setMessage(checked ? t('codex_extensions.skill_enabled_preview') : t('codex_extensions.skill_disabled_preview'));
  }

  async function removeSkill(skill: CodexSkillRecord) {
    if (skill.sourceKind === 'system') {
      setMessage(t('codex_extensions.skill_remove_system_blocked'));
      return;
    }
    if (browserMode) {
      setMessage(t('codex_extensions.skill_remove_desktop_required'));
      return;
    }
    try {
      const result = await RemoveCodexSkill(main.RemoveCodexSkillInput.createFrom({ path: skill.id }));
      setSkills((prev) => removeCodexSkillByID(prev, skill.id));
      closeSkillDetail();
      setMessage(t('codex_extensions.skill_removed_saved'));
      showSuccessHud(result?.removedPath || skill.rootPath || skill.id);
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex_extensions.skill_remove_failed')}: ${toErrorMessage(error)}`);
    }
  }

  async function openSkillInFinder(skill: CodexSkillRecord) {
    if (browserMode) {
      setMessage(t('codex_extensions.skill_open_finder_preview'));
      return;
    }
    try {
      await OpenCodexSkillInFinder(main.OpenCodexSkillInFinderInput.createFrom({ path: skill.id }));
      setMessage(t('codex_extensions.skill_opened_finder'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex_extensions.skill_open_finder_failed')}: ${toErrorMessage(error)}`);
    }
  }

  function installGitSkill() {
    if (!parsedGitSource) {
      setMessage(t('codex_extensions.git_invalid'));
      return;
    }

    const nextID = `${parsedGitSource.provider}-${parsedGitSource.repo}-${parsedGitSource.path}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    const installed: CodexSkillRecord = {
      id: nextID,
      name: parsedGitSource.path.split('/').filter(Boolean).pop() || parsedGitSource.repo.split('/').pop() || 'remote-skill',
      description: t('codex_extensions.git_preview_description'),
      enabled: true,
      rootLabel: '$CODEX_HOME/skills',
      rootPath: `~/.codex/skills/${parsedGitSource.path}`,
      sourceKind: 'user',
      origin: gitSource.trim(),
      versionLabel: parsedGitSource.ref,
      files: [
        {
          path: 'SKILL.md',
          kind: 'skill',
          previewable: true,
          content: `---
name: ${parsedGitSource.path.split('/').pop() || 'remote-skill'}
description: Installed from ${parsedGitSource.host}/${parsedGitSource.repo}.
---

# ${parsedGitSource.repo}

This browser preview validates the allowed Git source schema.

Provider: ${parsedGitSource.provider}
Ref: ${parsedGitSource.ref}
Path: ${parsedGitSource.path}`,
        },
        {
          path: '.git/source.json',
          kind: 'other',
          previewable: true,
          content: JSON.stringify(parsedGitSource, null, 2),
        },
      ],
      skillMarkdown: `---
name: ${parsedGitSource.path.split('/').pop() || 'remote-skill'}
description: Installed from ${parsedGitSource.host}/${parsedGitSource.repo}.
---

# ${parsedGitSource.repo}

This browser preview validates the allowed Git source schema.

Provider: ${parsedGitSource.provider}
Ref: ${parsedGitSource.ref}
Path: ${parsedGitSource.path}`,
    };
    setSkills((prev) => [installed, ...prev.filter((item) => item.id !== nextID)]);
    setSelectedID(nextID);
    setGitInstallOpen(false);
    setMessage(t('codex_extensions.git_installed_preview'));
  }

  return (
    <>
      <AssetWorkbenchShell
        dataCollaborationId="PAGE_CODEX_SKILLS"
        title={t('codex_extensions.skills_title')}
        subtitle={skillsHeaderSubtitle}
        actions={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-sm)]" onClick={() => setGitInstallOpen(true)}>
              <Download className="h-3.5 w-3.5" />
              {t('codex_extensions.add_skill')}
            </button>
            <RefreshActionButton
              onClick={() => void reloadSkills()}
              disabled={loading}
              label={t('common.refresh')}
              loading={loading}
              loadingLabel={t('common.loading')}
            />
          </div>
        }
        toolbar={
          <>
            <SegmentedControl options={skillRootOptions} value={rootFilter} onChange={setRootFilter} />
            <SearchInput
              value={query}
              onChange={setQuery}
              clearLabel={t('common.reset')}
              placeholder={t('codex_extensions.search_skills')}
            />
          </>
        }
        notice={
          message ? (
            <div className="border-b-2 border-[var(--border-color)] px-4 py-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-primary)]">
              {message}
            </div>
          ) : null
        }
        contentClassName="scrollbar-stable min-h-0 flex-1 overflow-auto divide-y-2 divide-[var(--border-color)]"
      >
        {filteredSkills.map((skill) => (
          <article
            key={skill.id}
            className="group relative grid gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface)] focus-within:bg-[var(--bg-surface)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          >
            <button
              type="button"
              aria-label={`${skill.name} ${t('common.details')}`}
              onClick={() => openSkillDetail(skill)}
              className="absolute inset-0 z-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)]"
            />
            <div className="pointer-events-none relative z-[1] min-w-0 text-left">
              <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-lg)] font-black text-[var(--text-primary)]">
                {skill.name}
              </div>
              <div className="mt-1 line-clamp-2 text-[length:var(--font-size-ui-sm)] font-bold leading-snug text-[var(--text-muted)]">
                {skill.description || skill.rootPath}
              </div>
              <div className="mt-2 break-all font-mono text-[length:var(--font-size-ui-xs)] font-black tracking-wide text-[var(--text-muted)]">
                <span className="font-black text-[var(--text-primary)]">{formatSkillSourceLabel(skill, t)}: </span>
                <span>{formatSkillSourceValue(skill)}</span>
              </div>
            </div>
            <ToggleSwitch
              label={skill.enabled ? t('common.disable') : t('common.enable')}
              checked={skill.enabled}
              disabled={loading}
              className="relative z-10"
              stopPropagation
              onChange={(checked) => void toggleSkill(skill, checked)}
            />
          </article>
        ))}
        {filteredSkills.length === 0 ? (
          <div className="px-4 py-12 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {loading ? t('common.loading') : t('codex_extensions.no_selection')}
          </div>
        ) : null}
      </AssetWorkbenchShell>

      {selectedSkill ? (
        <SkillPreviewModal
          skill={selectedSkill}
          t={t}
          loading={loading}
          browserMode={browserMode}
          canDeleteLocalFiles={!browserMode}
          onClose={closeSkillDetail}
          onToggle={(checked) => void toggleSkill(selectedSkill, checked)}
          onOpenFinder={() => void openSkillInFinder(selectedSkill)}
          onRemove={() => void removeSkill(selectedSkill)}
        />
      ) : null}
      {gitInstallOpen ? (
        <GitSkillInstallModal
          gitSource={gitSource}
          parsedGitSource={parsedGitSource}
          t={t}
          onChange={setGitSource}
          onClose={() => setGitInstallOpen(false)}
          onInstall={installGitSkill}
        />
      ) : null}
      {successHud ? <SuccessHud title={successHud.title} detail={successHud.detail} /> : null}
    </>
  );
}

function resolveCodexSkillDetailIDFromHash(hash: string): string {
  const state = readFrameHashState(hash);
  if (state?.page === 'codex' && state.codexWorkspace === 'skills' && state.codexSkillDetailID) {
    return state.codexSkillDetailID;
  }
  return '';
}

function resolveCodexSkillDetailSelection(skills: CodexSkillRecord[], currentID: string): string {
  const hashID = resolveCodexSkillDetailIDFromHash(window.location.hash);
  if (hashID && skills.some((skill) => skill.id === hashID)) {
    return hashID;
  }
  return skills.some((skill) => skill.id === currentID) ? currentID : '';
}

function buildPreviewMcpPreflight(server: McpServerRecord): McpPreflightResult {
  const checks: McpPreflightResult['checks'] = [];
  const add = (id: string, label: string, status: McpPreflightResult['status'], detail: string) => {
    checks.push({ id, label, status, detail });
  };
  if (!server.enabled) {
    add('enabled', 'enabled', 'warning', 'server is disabled in preview config');
  }
  if (server.transport === 'stdio') {
    add('command', 'command', server.command ? 'ok' : 'error', server.command ? 'preview command configured' : 'stdio server requires command');
    add('cwd', 'cwd', server.cwd ? 'ok' : 'ok', server.cwd || 'not configured');
    add('env_vars', 'env_vars', server.envVarsRaw ? 'warning' : 'ok', server.envVarsRaw ? 'desktop app checks env var presence' : 'no inherited env vars configured');
  } else if (server.transport === 'streamable_http') {
    add('url', 'url', server.url ? 'ok' : 'error', server.url ? 'preview url configured' : 'streamable_http server requires url');
    add('bearer_token_env_var', 'bearer_token_env_var', server.bearerTokenEnvVar ? 'warning' : 'warning', server.bearerTokenEnvVar ? 'desktop app checks env var presence' : 'no bearer token env var configured');
  } else {
    add('transport', 'transport', 'error', 'transport must be resolved before preflight');
  }
  const status = checks.some((check) => check.status === 'error')
    ? 'error'
    : checks.some((check) => check.status === 'warning')
      ? 'warning'
      : 'ok';
  return { serverID: server.id, status, checks };
}

function CodexMcpServersWorkspace() {
  const { t } = useI18n();
  const browserMode = !hasWailsAppBindings();
  const [servers, setServers] = useState<McpServerRecord[]>(() => previewMcpServers.map(cloneServer));
  const [mcpConfigPath, setMcpConfigPath] = useState('~/.codex/config.toml');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<McpFilter>('all');
  const [selectedID, setSelectedID] = useState('');
  const original = servers.find((server) => server.id === selectedID) || null;
  const [draft, setDraft] = useState<McpServerRecord | null>(() => (original ? cloneServer(original) : null));
  const [preflight, setPreflight] = useState<McpPreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [message, setMessage] = useState(t('codex_extensions.preview_loaded'));
  const [loading, setLoading] = useState(false);
  const [configEditor, setConfigEditor] = useState<ConfigEditorState>({
    open: false,
    configPath: '~/.codex/config.toml',
    content: '',
    originalContent: '',
    loading: false,
    saving: false,
  });

  useEffect(() => {
    setDraft(original ? cloneServer(original) : null);
    setPreflight(null);
  }, [original?.id]);

  const filteredServers = useMemo(
    () =>
      servers.filter((server) => {
        const q = query.trim().toLowerCase();
        const matchesQuery =
          q.length === 0 ||
          server.id.toLowerCase().includes(q) ||
          server.label.toLowerCase().includes(q) ||
          (server.command || '').toLowerCase().includes(q) ||
          (server.url || '').toLowerCase().includes(q);
        return matchesQuery && (filter === 'all' || server.transport === filter);
      }),
    [filter, query, servers],
  );
  const preview = original && draft ? buildMcpChangePreview(original, draft) : [];
  const isConfigEditorDirty = configEditor.content !== configEditor.originalContent;
  const enabledServerCount = servers.filter((server) => server.enabled).length;
  const mcpHeaderSubtitle = [
    mcpConfigPath,
    `${servers.length} ${t('codex_extensions.total')}`,
    `${enabledServerCount} ${t('codex_extensions.enabled')}`,
    `${preview.length} ${t('codex_extensions.changed')}`,
    `${filteredServers.length}/${servers.length} ${t('codex_extensions.visible')}`,
  ].join(' / ');

  async function reloadServers(messageOverride?: string) {
    if (browserMode) {
      const nextServers = previewMcpServers.map(cloneServer);
      setServers(nextServers);
      setMcpConfigPath('~/.codex/config.toml');
      setSelectedID((current) => (nextServers.some((server) => server.id === current) ? current : ''));
      setMessage(messageOverride || t('codex_extensions.preview_loaded'));
      return;
    }

    setLoading(true);
    try {
      const snapshot = await GetCodexMcpServers();
      const nextServers = (snapshot.servers || []).map(mapBackendMcpServer);
      setServers(nextServers);
      setMcpConfigPath(snapshot.configPath || '~/.codex/config.toml');
      setSelectedID((current) => (nextServers.some((server) => server.id === current) ? current : ''));
      setMessage(messageOverride || t('codex_extensions.real_loaded'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex_extensions.load_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadServers();
  }, [browserMode]);

  function patchDraft(patch: Partial<McpServerRecord>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setPreflight(null);
    setMessage('');
  }

  function openMcpServerEditor(server: McpServerRecord) {
    if (isConfigEditorDirty) {
      setMessage(t('codex_extensions.config_dirty_blocks_structured_edit'));
      return;
    }
    setSelectedID(server.id);
    setDraft(cloneServer(server));
    setPreflight(null);
    setMessage('');
  }

  function closeMcpServerEditor() {
    setSelectedID('');
    setDraft(null);
    setPreflight(null);
  }

  async function runMcpPreflight() {
    if (!draft) {
      return;
    }
    setPreflightLoading(true);
    setMessage('');
    if (browserMode) {
      setPreflight(buildPreviewMcpPreflight(draft));
      setPreflightLoading(false);
      return;
    }
    try {
      const result = await PreflightCodexMcpServer(main.PreflightCodexMcpServerInput.createFrom({ server: toBackendMcpServer(draft) }));
      setPreflight(mapBackendMcpPreflightResult(result));
    } catch (error) {
      console.error(error);
      setMessage(`${t('codex_extensions.mcp_preflight_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setPreflightLoading(false);
    }
  }

  async function saveDraft() {
    if (!draft) {
      return;
    }
    if (isConfigEditorDirty) {
      setMessage(t('codex_extensions.config_dirty_blocks_structured_save'));
      return;
    }
    if (!browserMode) {
      try {
        const result = await SaveCodexMcpServer(main.SaveCodexMcpServerInput.createFrom({ server: toBackendMcpServer(draft) }));
        const saved = mapBackendMcpServer(result.server);
        setServers((prev) => prev.map((server) => (server.id === saved.id ? cloneServer(saved) : server)));
        setMcpConfigPath(result.configPath || mcpConfigPath);
        setSelectedID('');
        setDraft(null);
        setMessage(t('codex_extensions.mcp_saved'));
        return;
      } catch (error) {
        console.error(error);
        setMessage(`${t('codex_extensions.save_failed')}: ${toErrorMessage(error)}`);
        return;
      }
    }
    setServers((prev) => prev.map((server) => (server.id === draft.id ? cloneServer(draft) : server)));
    setSelectedID('');
    setDraft(null);
    setMessage(t('codex_extensions.mcp_saved_preview'));
  }

  async function openConfigToml() {
    if (preview.length > 0) {
      setMessage(t('codex_extensions.structured_dirty_blocks_config_edit'));
      return;
    }
    if (browserMode) {
      setConfigEditor({
        open: true,
        configPath: '~/.codex/config.toml',
        content: previewConfigToml,
        originalContent: previewConfigToml,
        loading: false,
        saving: false,
      });
      return;
    }
    setConfigEditor((prev) => ({ ...prev, open: true, loading: true, saving: false }));
    try {
      const document = await GetCodexConfigToml();
      setConfigEditor({
        open: true,
        configPath: document.configPath,
        content: document.content || '',
        originalContent: document.content || '',
        loading: false,
        saving: false,
      });
    } catch (error) {
      console.error(error);
      setConfigEditor((prev) => ({ ...prev, open: false, loading: false, saving: false }));
      setMessage(`${t('codex_extensions.open_config_failed')}: ${toErrorMessage(error)}`);
    }
  }

  async function saveConfigToml() {
    if (browserMode) {
      setConfigEditor((prev) => ({ ...prev, originalContent: prev.content }));
      setMessage(t('codex_extensions.config_saved_preview'));
      return;
    }
    setConfigEditor((prev) => ({ ...prev, saving: true }));
    try {
      const result = await SaveCodexConfigToml(main.SaveCodexConfigTomlInput.createFrom({ content: configEditor.content }));
      const extendedResult = result as typeof result & { backupPath?: string };
      setConfigEditor((prev) => ({
        ...prev,
        configPath: result.configPath,
        content: result.content,
        originalContent: result.content,
        saving: false,
      }));
      const savedMessage = extendedResult.backupPath
        ? `${t('codex_extensions.config_saved')} · ${t('codex_extensions.config_backup_created')}: ${extendedResult.backupPath}`
        : t('codex_extensions.config_saved');
      await reloadServers(savedMessage);
    } catch (error) {
      console.error(error);
      setConfigEditor((prev) => ({ ...prev, saving: false }));
      setMessage(`${t('codex_extensions.config_save_failed')}: ${toErrorMessage(error)}`);
    }
  }

  function closeConfigEditor() {
    setConfigEditor((prev) => ({ ...prev, open: false, loading: false, saving: false }));
  }

  return (
    <>
      <AssetWorkbenchShell
        dataCollaborationId="PAGE_CODEX_MCP_SERVERS"
        title={t('codex_extensions.mcp_title')}
        subtitle={mcpHeaderSubtitle}
        actions={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="btn-swiss !px-3 !py-2 !text-[length:var(--font-size-ui-sm)]"
              onClick={() => void openConfigToml()}
              disabled={configEditor.loading}
            >
              <FilePenLine className="h-3.5 w-3.5" />
              {configEditor.loading ? t('common.loading') : t('codex_extensions.edit_config_toml')}
            </button>
            <RefreshActionButton
              onClick={() => void reloadServers()}
              disabled={loading}
              label={t('common.refresh')}
              loading={loading}
              loadingLabel={t('common.loading')}
            />
          </div>
        }
        toolbar={
          <>
            <SegmentedControl options={mcpFilterOptions} value={filter} onChange={setFilter} />
            <SearchInput
              value={query}
              onChange={setQuery}
              clearLabel={t('common.reset')}
              placeholder={t('codex_extensions.search_mcp')}
            />
          </>
        }
        notice={
          message ? (
            <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--text-primary)]">
              {message}
            </div>
          ) : null
        }
        contentClassName="divide-y-2 divide-[var(--border-color)]"
      >
        {filteredServers.map((server) => (
          <button
            key={server.id}
            type="button"
            onClick={() => openMcpServerEditor(server)}
            className="grid w-full gap-3 px-4 py-3 text-left text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          >
            <div className="min-w-0">
              <div className="min-w-0 truncate font-mono text-[length:var(--font-size-ui-lg-compact)] font-black">{server.label}</div>
              <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
                {server.command || server.url || '-'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <McpStatusBadge status={server.status} />
              <div className="border-2 border-[var(--border-color)] px-2 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {server.transport === 'stdio' ? 'stdio' : 'http'}
              </div>
            </div>
          </button>
        ))}
        {filteredServers.length === 0 ? (
          <div className="px-4 py-10 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {t('codex_extensions.empty_mcp')}
          </div>
        ) : null}
      </AssetWorkbenchShell>
        {draft ? (
          <McpServerEditorModal
            draft={draft}
            preview={preview}
            loading={loading}
            t={t}
            onPatch={patchDraft}
            onReset={() => setDraft(original ? cloneServer(original) : null)}
            onClose={closeMcpServerEditor}
            onSave={() => void saveDraft()}
            onPreflight={() => void runMcpPreflight()}
            preflight={preflight}
            preflightLoading={preflightLoading}
          />
        ) : null}
        {configEditor.open ? (
          <ConfigTomlEditorModal
            configPath={configEditor.configPath}
            content={configEditor.content}
            dirty={configEditor.content !== configEditor.originalContent}
            loading={configEditor.loading}
            saving={configEditor.saving}
            t={t}
            onChange={(content) => setConfigEditor((prev) => ({ ...prev, content }))}
            onClose={closeConfigEditor}
            onSave={() => void saveConfigToml()}
          />
        ) : null}
    </>
  );
}
