import { Download, Eye, FilePenLine, GitBranch, RefreshCw, Save, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import {
  GetCodexConfigToml,
  GetCodexMcpServers,
  GetCodexSkillsSnapshot,
  SaveCodexConfigToml,
  SaveCodexMcpServer,
  SaveCodexSkillEnabled,
} from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import SegmentedControl from '../../components/ui/SegmentedControl';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import type { CodexWorkspace, SegmentedOption } from '../../types';
import { toErrorMessage } from '../../utils/error';
import { hasWailsAppBindings } from '../../utils/previewMode';
import {
  buildMcpChangePreview,
  parseMcpArgs,
  parseMcpEnv,
  parseTkGitSkillSource,
  serializeMcpArgs,
  serializeMcpEnv,
  stripSkillFrontmatter,
  type CodexSkillRecord,
  type McpServerRecord,
  type McpTransport,
} from './model';
import { previewConfigToml, previewMcpServers, previewSkills } from './previewData';

type SkillRootFilter = 'all' | 'system' | 'user' | 'project' | 'git';
type McpFilter = 'all' | McpTransport;

const skillRootOptions: ReadonlyArray<SegmentedOption<SkillRootFilter>> = [
  { id: 'all', label: 'ALL' },
  { id: 'system', label: 'SYSTEM' },
  { id: 'user', label: 'USER' },
  { id: 'project', label: 'PROJECT' },
  { id: 'git', label: 'GIT' },
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
  const [skills, setSkills] = useState<CodexSkillRecord[]>(() => previewSkills.map((skill) => ({ ...skill })));
  const [query, setQuery] = useState('');
  const [rootFilter, setRootFilter] = useState<SkillRootFilter>('all');
  const [selectedID, setSelectedID] = useState('');
  const [gitSource, setGitSource] = useState('tk://github.com/openai/codex?ref=main&path=skills/skill-installer');
  const [message, setMessage] = useState(t('codex_extensions.preview_loaded'));
  const [loading, setLoading] = useState(false);

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
        const matchesRoot =
          rootFilter === 'all' ||
          skill.sourceKind === rootFilter ||
          (rootFilter === 'git' && (skill.sourceKind === 'github' || skill.sourceKind === 'gitlab'));
        return matchesQuery && matchesRoot;
      }),
    [query, rootFilter, skills],
  );
  const selectedSkill = skills.find((skill) => skill.id === selectedID) || null;

  async function reloadSkills(messageOverride?: string) {
    if (browserMode) {
      setSkills(previewSkills.map((skill) => ({ ...skill })));
      setMessage(messageOverride || t('codex_extensions.preview_loaded'));
      return;
    }

    setLoading(true);
    try {
      const snapshot = await GetCodexSkillsSnapshot();
      const nextSkills = (snapshot.skills || []).map(mapBackendSkill);
      setSkills(nextSkills);
      setSelectedID((current) => (nextSkills.some((skill) => skill.id === current) ? current : ''));
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

  async function toggleSkill(skill: CodexSkillRecord, checked: boolean) {
    if (!browserMode) {
      try {
        await SaveCodexSkillEnabled({ path: skill.id, enabled: checked });
        await reloadSkills(checked ? t('codex_extensions.skill_enabled_saved') : t('codex_extensions.skill_disabled_saved'));
        return;
      } catch (error) {
        console.error(error);
        setMessage(`${t('codex_extensions.save_failed')}: ${toErrorMessage(error)}`);
        return;
      }
    }
    setSkills((prev) => prev.map((item) => (item.id === skill.id ? { ...item, enabled: checked } : item)));
    setMessage(checked ? t('codex_extensions.skill_enabled_preview') : t('codex_extensions.skill_disabled_preview'));
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
      sourceKind: parsedGitSource.provider,
      origin: gitSource.trim(),
      versionLabel: parsedGitSource.ref,
      files: [
        { path: 'SKILL.md', kind: 'skill' },
        { path: '.git/source.json', kind: 'other' },
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
    setMessage(t('codex_extensions.git_installed_preview'));
  }

  return (
    <div className="h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_SKILLS">
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title={t('codex_extensions.skills_title')}
          subtitle={t('codex_extensions.skills_subtitle')}
          align="center"
          actions={
            <button type="button" className="btn-swiss !px-3 !py-2 !text-[0.625rem]" onClick={() => void reloadSkills()} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
              {loading ? t('common.loading') : t('common.refresh')}
            </button>
          }
        />

        <section className="grid gap-3 md:grid-cols-3">
          <Metric label={t('codex_extensions.total')} value={skills.length} />
          <Metric label={t('codex_extensions.enabled')} value={skills.filter((skill) => skill.enabled).length} />
          <Metric label={t('codex_extensions.git_sources')} value={skills.filter((skill) => skill.sourceKind === 'github' || skill.sourceKind === 'gitlab').length} />
        </section>

        <section className="flex min-h-[30rem] flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
          <div className="space-y-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,24rem)_minmax(16rem,1fr)]">
              <SegmentedControl options={skillRootOptions} value={rootFilter} onChange={setRootFilter} />
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input-swiss w-full !pl-9"
                  placeholder={t('codex_extensions.search_skills')}
                />
              </label>
            </div>
          </div>

          {message ? (
            <div className="border-b-2 border-[var(--border-color)] px-4 py-2 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
              {message}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto divide-y-2 divide-[var(--border-color)]">
            {filteredSkills.map((skill) => (
              <article
                key={skill.id}
                className="group relative grid gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface)] focus-within:bg-[var(--bg-surface)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <button
                  type="button"
                  aria-label={`${skill.name} ${t('common.details')}`}
                  onClick={() => setSelectedID(skill.id)}
                  className="absolute inset-0 z-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)]"
                />
                <div className="pointer-events-none relative z-[1] min-w-0 text-left">
                  <div className="min-w-0 truncate font-mono text-[0.875rem] font-black text-[var(--text-primary)]">
                    {skill.name}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[0.625rem] font-bold leading-snug text-[var(--text-muted)]">
                    {skill.description || skill.rootPath}
                  </div>
                  <div className="mt-2 break-all font-mono text-[0.5625rem] font-black tracking-wide text-[var(--text-muted)]">
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
              <div className="px-4 py-12 text-center text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {loading ? t('common.loading') : t('codex_extensions.no_selection')}
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-[6px_6px_0_var(--shadow-color)] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <label className="min-w-0">
            <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('codex_extensions.git_source')}
            </span>
            <input value={gitSource} onChange={(event) => setGitSource(event.target.value)} className="input-swiss mt-2 w-full font-mono" />
          </label>
          <button type="button" onClick={installGitSkill} className="btn-swiss self-end !px-3 !py-2 !text-[0.625rem]">
            <Download className="h-3.5 w-3.5" />
            {t('codex_extensions.install_update')}
          </button>
          <div className={`xl:col-span-2 text-[0.625rem] font-black uppercase tracking-wide ${parsedGitSource ? 'text-[var(--text-muted)]' : 'text-[var(--accent-red)]'}`}>
            {parsedGitSource
              ? `${parsedGitSource.provider} / ${parsedGitSource.repo} / ${parsedGitSource.ref} / ${parsedGitSource.path}`
              : t('codex_extensions.git_hint')}
          </div>
        </section>
      </div>

      {selectedSkill ? (
        <SkillPreviewModal
          skill={selectedSkill}
          t={t}
          loading={loading}
          onClose={() => setSelectedID('')}
          onToggle={(checked) => void toggleSkill(selectedSkill, checked)}
        />
      ) : null}
    </div>
  );
}

function SkillPreviewModal({
  skill,
  t,
  loading,
  onClose,
  onToggle,
}: {
  skill: CodexSkillRecord;
  t: (key: string) => string;
  loading: boolean;
  onClose: () => void;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={skill.name}
        className="flex max-h-[90vh] w-full max-w-6xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="grid gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
          <div className="min-w-0">
            <div className="font-mono text-xl font-black italic tracking-tighter text-[var(--text-primary)]">
              {skill.name}
            </div>
            <div className="mt-1 break-all text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
              {skill.rootPath}
            </div>
          </div>
          <ToggleSwitch
            label={skill.enabled ? t('common.disable') : t('common.enable')}
            checked={skill.enabled}
            disabled={loading}
            onChange={onToggle}
          />
          <button type="button" onClick={onClose} className="btn-swiss !px-3 !py-2 !text-[0.625rem]">
            {t('common.close')}
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
          <aside className="border-b-2 border-[var(--border-color)] p-4 lg:border-b-0 lg:border-r-2">
            <MetaLine label={t('codex_extensions.source')} value={skill.origin || '-'} />
            <MetaLine label={t('codex_extensions.root')} value={skill.rootLabel || '-'} />
            <MetaLine label={t('codex_extensions.version')} value={skill.versionLabel || '-'} />
            <div className="mt-5 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('codex_extensions.files')}
            </div>
            <div className="mt-2 divide-y divide-[var(--border-color)] border-2 border-[var(--border-color)]">
              {skill.files.map((file) => (
                <div key={file.path} className="px-2 py-2">
                  <div className="break-all font-mono text-[0.625rem] font-black text-[var(--text-primary)]">{file.path}</div>
                  <div className="mt-0.5 text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">{file.kind}</div>
                </div>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-auto p-4">
            <div className="mb-3 flex items-center gap-2 text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <Eye className="h-3.5 w-3.5" />
              {t('codex_extensions.skill_preview')}
            </div>
            <div className="min-h-[28rem] break-words border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-4 text-[0.75rem] font-bold leading-relaxed text-[var(--text-primary)] [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border-color)] [&_blockquote]:pl-3 [&_code]:font-mono [&_code]:font-black [&_h1]:mb-4 [&_h1]:font-mono [&_h1]:text-xl [&_h1]:font-black [&_h1]:italic [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:font-mono [&_h2]:text-base [&_h2]:font-black [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-mono [&_h3]:font-black [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_pre]:mb-4 [&_pre]:overflow-auto [&_pre]:border-2 [&_pre]:border-[var(--border-color)] [&_pre]:bg-[var(--bg-main)] [&_pre]:p-3 [&_ul]:list-disc">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                {stripSkillFrontmatter(skill.skillMarkdown)}
              </ReactMarkdown>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function CodexMcpServersWorkspace() {
  const { t } = useI18n();
  const browserMode = !hasWailsAppBindings();
  const [servers, setServers] = useState<McpServerRecord[]>(() => previewMcpServers.map(cloneServer));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<McpFilter>('all');
  const [selectedID, setSelectedID] = useState('');
  const original = servers.find((server) => server.id === selectedID) || null;
  const [draft, setDraft] = useState<McpServerRecord | null>(() => (original ? cloneServer(original) : null));
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

  async function reloadServers(messageOverride?: string) {
    if (browserMode) {
      const nextServers = previewMcpServers.map(cloneServer);
      setServers(nextServers);
      setSelectedID((current) => (nextServers.some((server) => server.id === current) ? current : ''));
      setMessage(messageOverride || t('codex_extensions.preview_loaded'));
      return;
    }

    setLoading(true);
    try {
      const snapshot = await GetCodexMcpServers();
      const nextServers = (snapshot.servers || []).map(mapBackendMcpServer);
      setServers(nextServers);
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
    setMessage('');
  }

  function openMcpServerEditor(server: McpServerRecord) {
    setSelectedID(server.id);
    setDraft(cloneServer(server));
    setMessage('');
  }

  function closeMcpServerEditor() {
    setSelectedID('');
    setDraft(null);
  }

  async function saveDraft() {
    if (!draft) {
      return;
    }
    if (!browserMode) {
      try {
        const result = await SaveCodexMcpServer(main.SaveCodexMcpServerInput.createFrom({ server: toBackendMcpServer(draft) }));
        const saved = mapBackendMcpServer(result.server);
        setServers((prev) => prev.map((server) => (server.id === saved.id ? cloneServer(saved) : server)));
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
      setConfigEditor((prev) => ({
        ...prev,
        configPath: result.configPath,
        content: result.content,
        originalContent: result.content,
        saving: false,
      }));
      await reloadServers(t('codex_extensions.config_saved'));
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
    <div className="h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_MCP_SERVERS">
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title={t('codex_extensions.mcp_title')}
          subtitle={t('codex_extensions.mcp_subtitle')}
          align="center"
          actions={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="btn-swiss !px-3 !py-2 !text-[0.625rem]"
                onClick={() => void openConfigToml()}
                disabled={configEditor.loading}
              >
                <FilePenLine className="h-3.5 w-3.5" />
                {configEditor.loading ? t('common.loading') : t('codex_extensions.edit_config_toml')}
              </button>
              <button type="button" className="btn-swiss !px-3 !py-2 !text-[0.625rem]" onClick={() => void reloadServers()} disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5" />
                {loading ? t('common.loading') : t('common.refresh')}
              </button>
            </div>
          }
        />

        <section className="grid gap-3 md:grid-cols-3">
          <Metric label={t('codex_extensions.total')} value={servers.length} />
          <Metric label={t('codex_extensions.enabled')} value={servers.filter((server) => server.enabled).length} />
          <Metric label={t('codex_extensions.changed')} value={preview.length} />
        </section>

        <section className="flex min-h-[34rem] flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
            <div className="space-y-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,24rem)_minmax(16rem,1fr)]">
                <SegmentedControl options={mcpFilterOptions} value={filter} onChange={setFilter} />
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="input-swiss w-full !pl-9"
                    placeholder={t('codex_extensions.search_mcp')}
                  />
                </label>
              </div>
            </div>

            {message ? (
              <div className="border-b-2 border-[var(--border-color)] px-4 py-2 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                {message}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto divide-y-2 divide-[var(--border-color)]">
              {filteredServers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => openMcpServerEditor(server)}
                  className="grid w-full gap-2 px-4 py-3 text-left text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="min-w-0 truncate font-mono text-[0.8125rem] font-black">{server.label}</div>
                    <div className="mt-1 break-all font-mono text-[0.625rem] font-bold text-[var(--text-muted)]">
                      {server.command || server.url || '-'}
                    </div>
                  </div>
                  <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {server.transport === 'stdio' ? 'stdio' : 'streamable_http'}
                  </div>
                </button>
              ))}
            </div>
        </section>
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
      </div>
    </div>
  );
}

function McpServerEditorModal({
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
  t: (key: string) => string;
  onPatch: (patch: Partial<McpServerRecord>) => void;
  onReset: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      data-collaboration-id="MODAL_CODEX_MCP_SERVER_EDITOR"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={draft.label}
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="grid shrink-0 gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
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

        <div className="grid min-h-0 flex-1 overflow-auto 2xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
          <main className="min-h-0 overflow-auto p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('codex_extensions.server_id')} value={draft.id} onChange={(value) => onPatch({ id: value, label: value })} />
              <label className="grid gap-2">
                <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('common.type')}
                </span>
                <select
                  value={draft.transport}
                  className="select-swiss"
                  onChange={(event) => onPatch({ transport: event.target.value as McpTransport })}
                >
                  <option value="stdio">stdio</option>
                  <option value="streamable_http">streamable_http</option>
                </select>
              </label>
              <Field label={t('codex_extensions.command')} value={draft.command || ''} onChange={(value) => onPatch({ command: value })} />
              <Field label={t('codex_extensions.url')} value={draft.url || ''} onChange={(value) => onPatch({ url: value })} />
              <Field label={t('codex_extensions.args')} value={serializeMcpArgs(draft.args)} onChange={(value) => onPatch({ args: parseMcpArgs(value) })} />
              <Field label={t('codex_extensions.bearer_env')} value={draft.bearerTokenEnvVar || ''} onChange={(value) => onPatch({ bearerTokenEnvVar: value })} />
            </div>
            <label className="mt-4 grid gap-2">
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('codex_extensions.env')}
              </span>
              <textarea
                value={serializeMcpEnv(draft.env)}
                onChange={(event) => onPatch({ env: parseMcpEnv(event.target.value) })}
                className="input-swiss min-h-28 w-full resize-y font-mono"
                placeholder="KEY=value"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
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
          <aside className="border-t-2 border-[var(--border-color)] p-4 2xl:border-l-2 2xl:border-t-0">
            <div className="mb-3 flex items-center gap-2 text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <GitBranch className="h-3.5 w-3.5" />
              {t('codex_extensions.change_preview')}
            </div>
            <div className="divide-y-2 divide-[var(--border-color)] border-2 border-[var(--border-color)]">
              {preview.length > 0 ? preview.map((change) => (
                <div key={change.key} className="px-3 py-2">
                  <div className="font-mono text-[0.625rem] font-black text-[var(--text-primary)]">{change.key}</div>
                  <div className="mt-1 break-all text-[0.5625rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {change.before} -&gt; {change.after}
                  </div>
                </div>
              )) : (
                <div className="px-3 py-8 text-center text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
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

function ConfigTomlEditorModal({
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
  t: (key: string) => string;
  onChange: (content: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
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
              className="input-swiss min-h-[24rem] w-full resize-none overflow-auto font-mono !text-[0.75rem] leading-relaxed"
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 shadow-[4px_4px_0_var(--shadow-color)]">
      <div className="text-2xl font-black italic tracking-tighter text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 min-w-0">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 break-all font-mono text-[0.6875rem] font-black text-[var(--text-primary)]">{value}</div>
    </div>
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

function formatSkillSourceLabel(skill: CodexSkillRecord, t: (key: string) => string): string {
  if ((skill.sourceKind === 'github' || skill.sourceKind === 'gitlab') && skill.origin && skill.origin !== 'local') {
    return 'Git';
  }

  return t('codex_extensions.source');
}

function formatSkillSourceValue(skill: CodexSkillRecord): string {
  if ((skill.sourceKind === 'github' || skill.sourceKind === 'gitlab') && skill.origin && skill.origin !== 'local') {
    return skill.origin;
  }

  return skill.rootPath || skill.rootLabel || '-';
}

function cloneServer(server: McpServerRecord): McpServerRecord {
  return {
    ...server,
    args: [...(server.args || [])],
    env: (server.env || []).map((row) => ({ ...row })),
  };
}

function mapBackendSkill(skill: main.CodexSkillRecord): CodexSkillRecord {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || '',
    enabled: skill.enabled,
    rootLabel: skill.rootLabel,
    rootPath: skill.rootPath,
    sourceKind: normalizeSkillSourceKind(skill.sourceKind),
    origin: skill.origin || 'local',
    versionLabel: skill.versionLabel || 'local',
    files: (skill.files || []).map((file) => ({
      path: file.path,
      kind: file.kind === 'skill' || file.kind === 'asset' || file.kind === 'script' ? file.kind : 'other',
    })),
    skillMarkdown: skill.previewMarkdown || skill.skillMarkdown || '',
  };
}

function normalizeSkillSourceKind(value: string): CodexSkillRecord['sourceKind'] {
  if (value === 'system' || value === 'user' || value === 'project' || value === 'github' || value === 'gitlab') {
    return value;
  }
  return 'user';
}

function mapBackendMcpServer(server: main.CodexMcpServer): McpServerRecord {
  return {
    id: server.id,
    label: server.label || server.id,
    enabled: server.enabled,
    transport: server.transport === 'streamable_http' ? 'streamable_http' : 'stdio',
    command: server.command || '',
    args: [...(server.args || [])],
    url: server.url || '',
    env: (server.env || []).map((row) => ({ key: row.key, value: row.value })),
    bearerTokenEnvVar: server.bearerTokenEnvVar || '',
    sourcePath: server.sourcePath,
    status: server.status === 'disabled' || server.status === 'missing-env' ? server.status : 'ready',
  };
}

function toBackendMcpServer(server: McpServerRecord): main.CodexMcpServer {
  return {
    id: server.id,
    label: server.label || server.id,
    enabled: server.enabled,
    transport: server.transport,
    command: server.transport === 'stdio' ? server.command || '' : '',
    args: server.transport === 'stdio' ? [...(server.args || [])] : [],
    url: server.transport === 'streamable_http' ? server.url || '' : '',
    env: server.transport === 'stdio' ? (server.env || []).map((row) => ({ key: row.key, value: row.value })) : [],
    bearerTokenEnvVar: server.transport === 'streamable_http' ? server.bearerTokenEnvVar || '' : '',
    sourcePath: server.sourcePath,
    status: server.status,
  } as main.CodexMcpServer;
}
