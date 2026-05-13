import { AlertTriangle, CheckCircle2, Download, Eye, FilePenLine, FolderOpen, GitBranch, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import {
  GetCodexConfigToml,
  GetCodexMcpServers,
  GetCodexSkillFilePreview,
  GetCodexSkillsSnapshot,
  OpenCodexSkillInFinder,
  RemoveCodexSkill,
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
  removeCodexSkillByID,
  parseMcpList,
  parseMcpArgs,
  parseMcpEnv,
  parseTkGitSkillSource,
  serializeMcpArgs,
  serializeMcpEnv,
  serializeMcpList,
  serializeMcpTools,
  stripSkillFrontmatter,
  updateCodexSkillEnabled,
  type CodexSkillRecord,
  type McpServerRecord,
  type McpTransport,
} from './model';
import { previewConfigToml, previewMcpServers, previewSkills } from './previewData';

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
      setSkills(previewSkills.filter(isGlobalSkillSource).map((skill) => ({ ...skill })));
      setMessage(messageOverride || t('codex_extensions.preview_loaded'));
      return;
    }

    setLoading(true);
    try {
      const snapshot = await GetCodexSkillsSnapshot();
      const nextSkills = (snapshot.skills || []).map(mapBackendSkill).filter(isGlobalSkillSource);
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
      setSelectedID('');
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
    <div className="scrollbar-stable h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_SKILLS">
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title={t('codex_extensions.skills_title')}
          subtitle={skillsHeaderSubtitle}
          align="center"
          actions={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" className="btn-swiss !px-3 !py-2 !text-[0.625rem]" onClick={() => setGitInstallOpen(true)}>
                <Download className="h-3.5 w-3.5" />
                {t('codex_extensions.add_skill')}
              </button>
              <button type="button" className="btn-swiss !px-3 !py-2 !text-[0.625rem]" onClick={() => void reloadSkills()} disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5" />
                {loading ? t('common.loading') : t('common.refresh')}
              </button>
            </div>
          }
        />

        <section className="flex min-h-[30rem] flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
          <div className="grid gap-3 border-b-2 border-[var(--border-color)] p-3 lg:grid-cols-[minmax(0,24rem)_minmax(16rem,1fr)]">
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

          {message ? (
            <div className="border-b-2 border-[var(--border-color)] px-4 py-2 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
              {message}
            </div>
          ) : null}

          <div className="scrollbar-stable min-h-0 flex-1 overflow-auto divide-y-2 divide-[var(--border-color)]">
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
      </div>

      {selectedSkill ? (
        <SkillPreviewModal
          skill={selectedSkill}
          t={t}
          loading={loading}
          browserMode={browserMode}
          canDeleteLocalFiles={!browserMode}
          onClose={() => setSelectedID('')}
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
    </div>
  );
}

function SuccessHud({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-[80] w-[min(92vw,28rem)] -translate-x-1/2" role="status" aria-live="polite">
      <div className="codex-success-hud flex items-center gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 shadow-[8px_8px_0_var(--shadow-color)]">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
          <span className="codex-success-hud-ring absolute inset-0 border-2 border-[var(--border-color)]" />
          <CheckCircle2 className="codex-success-hud-icon h-6 w-6 text-[var(--text-primary)]" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[0.75rem] font-black uppercase tracking-[0.16em] text-[var(--text-primary)]">
            {title}
          </div>
          <div className="mt-1 truncate font-mono text-[0.5625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

function GitSkillInstallModal({
  gitSource,
  parsedGitSource,
  t,
  onChange,
  onClose,
  onInstall,
}: {
  gitSource: string;
  parsedGitSource: ReturnType<typeof parseTkGitSkillSource>;
  t: (key: string) => string;
  onChange: (value: string) => void;
  onClose: () => void;
  onInstall: () => void;
}) {
  return (
    <div
      className="scrollbar-stable fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      data-collaboration-id="MODAL_CODEX_SKILL_GIT_INSTALL"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('codex_extensions.add_skill')}
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-4">
          <div className="min-w-0">
            <div className="font-mono text-xl font-black italic tracking-tighter text-[var(--text-primary)]">
              {t('codex_extensions.add_skill')}
            </div>
            <div className="mt-1 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
              {t('codex_extensions.git_source')}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-swiss !px-3 !py-2 !text-[0.625rem]">
            {t('common.close')}
          </button>
        </header>

        <main className="scrollbar-stable min-h-0 flex-1 overflow-auto p-5">
          <label className="grid gap-2">
            <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('codex_extensions.git_source')}
            </span>
            <input value={gitSource} onChange={(event) => onChange(event.target.value)} className="input-swiss w-full font-mono" />
          </label>

          <div className="mt-4 border-t-2 border-[var(--border-color)] pt-4">
            {parsedGitSource ? (
              <div className="divide-y-2 divide-[var(--border-color)]">
                <GitSourceValue label={t('codex_extensions.git_source_schema')} value={gitSource.trim()} />
                <GitSourceValue label={t('codex_extensions.git_provider')} value={parsedGitSource.provider} />
                <GitSourceValue label={t('codex_extensions.git_host')} value={parsedGitSource.host} />
                <GitSourceValue label={t('codex_extensions.git_repo')} value={parsedGitSource.repo} />
                <GitSourceValue label={t('codex_extensions.git_ref')} value={parsedGitSource.ref} />
                <GitSourceValue label={t('codex_extensions.git_path')} value={parsedGitSource.path} />
              </div>
            ) : (
              <div className="text-[0.625rem] font-black uppercase tracking-wide text-[var(--accent-red)]">
                {t('codex_extensions.git_hint')}
              </div>
            )}
          </div>
        </main>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-4">
          <button type="button" onClick={onClose} className="btn-swiss !px-3 !py-2 !text-[0.625rem]">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onInstall}
            disabled={!parsedGitSource}
            className="btn-swiss bg-[var(--text-primary)] !px-3 !py-2 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {t('codex_extensions.install_update')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function GitSourceValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-3">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="min-w-0 break-all font-mono text-[0.625rem] font-black text-[var(--text-primary)]">
        {value || '-'}
      </div>
    </div>
  );
}

function SkillPreviewModal({
  skill,
  t,
  loading,
  browserMode,
  canDeleteLocalFiles,
  onClose,
  onToggle,
  onOpenFinder,
  onRemove,
}: {
  skill: CodexSkillRecord;
  t: (key: string) => string;
  loading: boolean;
  browserMode: boolean;
  canDeleteLocalFiles: boolean;
  onClose: () => void;
  onToggle: (checked: boolean) => void;
  onOpenFinder: () => void;
  onRemove: () => void;
}) {
  const [removeAlertOpen, setRemoveAlertOpen] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState('SKILL.md');
  const [filePreviewCache, setFilePreviewCache] = useState<Record<string, { content: string; previewable: boolean }>>({});
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [filePreviewError, setFilePreviewError] = useState('');
  const canRemove = skill.sourceKind !== 'system' && canDeleteLocalFiles;
  const selectedFile = skill.files.find((file) => file.path === selectedFilePath) || skill.files[0] || null;
  const selectedPreview = selectedFile ? filePreviewCache[selectedFile.path] : null;
  const selectedFileContent = selectedPreview?.content || '';
  const canPreviewSelectedFile = Boolean(selectedFile && (selectedPreview?.previewable || selectedFile.path === 'SKILL.md'));
  const selectedFileIsMarkdown = Boolean(selectedFile && isMarkdownSkillFile(selectedFile.path));

  useEffect(() => {
    setSelectedFilePath(skill.files.some((file) => file.path === 'SKILL.md') ? 'SKILL.md' : skill.files[0]?.path || 'SKILL.md');
    const initialCache: Record<string, { content: string; previewable: boolean }> = {};
    if (skill.skillMarkdown) {
      initialCache['SKILL.md'] = { content: skill.skillMarkdown, previewable: true };
    }
    for (const file of skill.files) {
      if (file.content) {
        initialCache[file.path] = { content: file.content, previewable: Boolean(file.previewable || file.path === 'SKILL.md') };
      }
    }
    setFilePreviewCache(initialCache);
    setFilePreviewError('');
    setFilePreviewLoading(false);
  }, [skill.id, skill.files]);

  useEffect(() => {
    if (!selectedFile || filePreviewCache[selectedFile.path]) {
      return;
    }
    if (!selectedFile.previewable && selectedFile.path !== 'SKILL.md') {
      return;
    }
    let cancelled = false;
    async function loadPreview() {
      setFilePreviewLoading(true);
      setFilePreviewError('');
      try {
        if (browserMode) {
          const content = selectedFile?.content || '';
          if (!cancelled && selectedFile) {
            setFilePreviewCache((prev) => ({
              ...prev,
              [selectedFile.path]: { content, previewable: Boolean(content && (selectedFile.previewable || selectedFile.path === 'SKILL.md')) },
            }));
          }
          return;
        }
        if (!selectedFile) {
          return;
        }
        const result = await GetCodexSkillFilePreview(main.GetCodexSkillFilePreviewInput.createFrom({
          skillPath: skill.id,
          filePath: selectedFile.path,
        }));
        if (!cancelled) {
          setFilePreviewCache((prev) => ({
            ...prev,
            [selectedFile.path]: { content: result.content || '', previewable: Boolean(result.previewable) },
          }));
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setFilePreviewError(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setFilePreviewLoading(false);
        }
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [browserMode, filePreviewCache, selectedFile, skill.id]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 px-3 py-6 backdrop-blur-sm sm:px-6 sm:py-10" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={skill.name}
          className="flex h-[calc(100vh-3rem)] max-h-[48rem] w-full max-w-6xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)] sm:h-[calc(100vh-5rem)]"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="grid shrink-0 gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
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

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(10rem,16rem)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] lg:grid-rows-none">
            <aside className="scrollbar-stable min-h-0 overflow-y-auto border-b-2 border-[var(--border-color)] p-4 lg:border-b-0 lg:border-r-2">
              <MetaLine label={t('codex_extensions.source')} value={skill.origin || '-'} />
              <MetaLine label={t('codex_extensions.root')} value={skill.rootLabel || '-'} />
              <MetaLine label={t('codex_extensions.version')} value={skill.versionLabel || '-'} />
              <div className="mt-5 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('codex_extensions.files')}
              </div>
              <div className="mt-2 divide-y divide-[var(--border-color)] border-2 border-[var(--border-color)]">
                {skill.files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`block w-full px-2 py-2 text-left transition-colors ${
                      selectedFile?.path === file.path ? 'bg-[var(--border-color)] text-[var(--bg-main)]' : 'hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    <div className={`break-all font-mono text-[0.625rem] font-black ${selectedFile?.path === file.path ? 'text-[var(--bg-main)]' : 'text-[var(--text-primary)]'}`}>
                      {file.path}
                    </div>
                    <div className={`mt-0.5 text-[0.5rem] font-black uppercase tracking-[0.14em] ${selectedFile?.path === file.path ? 'text-[var(--bg-main)]' : 'text-[var(--text-muted)]'}`}>
                      {file.kind} / {file.previewable || file.path === 'SKILL.md' ? t('codex_extensions.file_previewable') : t('codex_extensions.file_not_previewable')}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <main className="min-h-0 overflow-hidden p-4">
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-3 flex min-w-0 shrink-0 items-center gap-2 text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <Eye className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selectedFile?.path || t('codex_extensions.skill_preview')}</span>
                </div>
                <div className="scrollbar-stable min-h-0 flex-1 overflow-y-auto break-words border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-4 text-[0.75rem] font-bold leading-relaxed text-[var(--text-primary)] [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--border-color)] [&_blockquote]:pl-3 [&_code]:font-mono [&_code]:font-black [&_h1]:mb-4 [&_h1]:font-mono [&_h1]:text-xl [&_h1]:font-black [&_h1]:italic [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:font-mono [&_h2]:text-base [&_h2]:font-black [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-mono [&_h3]:font-black [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_pre]:mb-4 [&_pre]:overflow-auto [&_pre]:border-2 [&_pre]:border-[var(--border-color)] [&_pre]:bg-[var(--bg-main)] [&_pre]:p-3 [&_ul]:list-disc">
                  {filePreviewLoading ? (
                    <div className="flex min-h-full items-center justify-center text-center text-[0.625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {t('common.loading')}
                    </div>
                  ) : filePreviewError ? (
                    <div className="flex min-h-full items-center justify-center px-4 text-center text-[0.625rem] font-black uppercase tracking-[0.16em] text-red-500">
                      {filePreviewError}
                    </div>
                  ) : canPreviewSelectedFile ? (
                    selectedFileIsMarkdown ? (
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                        {selectedFile?.path === 'SKILL.md' ? stripSkillFrontmatter(selectedFileContent) : selectedFileContent}
                      </ReactMarkdown>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-mono text-[0.6875rem] font-black leading-relaxed">
                        {selectedFileContent}
                      </pre>
                    )
                  ) : (
                    <div className="flex min-h-full items-center justify-center text-center text-[0.625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {t('codex_extensions.file_preview_unavailable')}
                    </div>
                  )}
                </div>
              </div>
            </main>
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {canRemove
                ? t('codex_extensions.skill_remove_hint')
                : skill.sourceKind === 'system'
                  ? t('codex_extensions.skill_remove_system_blocked')
                  : t('codex_extensions.skill_remove_desktop_required')}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={onOpenFinder} className="btn-swiss !px-3 !py-2 !text-[0.625rem]">
                <FolderOpen className="h-3.5 w-3.5" />
                {t('codex_extensions.open_in_finder')}
              </button>
              <button
                type="button"
                disabled={!canRemove || loading}
                onClick={() => setRemoveAlertOpen(true)}
                className="btn-swiss !px-3 !py-2 !text-[0.625rem] !text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('codex_extensions.remove_skill')}
              </button>
            </div>
          </footer>
        </div>
      </div>
      {removeAlertOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setRemoveAlertOpen(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="codex-skill-remove-alert-title"
            aria-describedby="codex-skill-remove-alert-body"
            className="w-full max-w-md border-2 border-[var(--accent-red)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start gap-3 border-b-2 border-[var(--accent-red)] bg-[var(--bg-surface)] p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="min-w-0">
                <div id="codex-skill-remove-alert-title" className="font-mono text-base font-black italic text-[var(--text-primary)]">
                  {t('codex_extensions.skill_remove_alert_title')}
                </div>
                <div id="codex-skill-remove-alert-body" className="mt-1 break-all text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
                  {skill.rootPath}
                </div>
              </div>
            </header>
            <div className="space-y-3 p-4">
              <p className="text-sm font-bold leading-relaxed text-[var(--text-primary)]">
                {t('codex_extensions.skill_remove_confirm')}
              </p>
              <p className="break-all font-mono text-[0.6875rem] font-black text-[var(--text-muted)]">
                {skill.id}
              </p>
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
              <button type="button" onClick={() => setRemoveAlertOpen(false)} className="btn-swiss !px-3 !py-2 !text-[0.625rem]">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setRemoveAlertOpen(false);
                  onRemove();
                }}
                className="btn-swiss !px-3 !py-2 !text-[0.625rem] !text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('common.delete')}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

function isMarkdownSkillFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower === 'skill.md' || lower.endsWith('.md') || lower.endsWith('.markdown');
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
    <div className="scrollbar-stable h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CODEX_MCP_SERVERS">
      <div className="w-full space-y-6">
        <WorkspacePageHeader
          title={t('codex_extensions.mcp_title')}
          subtitle={mcpHeaderSubtitle}
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

        <section className="flex flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[6px_6px_0_var(--shadow-color)]">
          <div className="grid gap-3 border-b-2 border-[var(--border-color)] p-3 lg:grid-cols-[minmax(0,24rem)_minmax(16rem,1fr)]">
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

          {message ? (
            <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
              {message}
            </div>
          ) : null}

          <div className="divide-y-2 divide-[var(--border-color)]">
            {filteredServers.map((server) => (
              <button
                key={server.id}
                type="button"
                onClick={() => openMcpServerEditor(server)}
                className="grid w-full gap-3 px-4 py-3 text-left text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="min-w-0 truncate font-mono text-[0.8125rem] font-black">{server.label}</div>
                  <div className="mt-1 break-all font-mono text-[0.625rem] font-bold text-[var(--text-muted)]">
                    {server.command || server.url || '-'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <McpStatusBadge status={server.status} />
                  <div className="border-2 border-[var(--border-color)] px-2 py-1 font-mono text-[0.5625rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {server.transport === 'stdio' ? 'stdio' : 'http'}
                  </div>
                </div>
              </button>
            ))}
            {filteredServers.length === 0 ? (
              <div className="px-4 py-10 text-center text-[0.625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('codex_extensions.empty_mcp')}
              </div>
            ) : null}
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

  const currentValueRows = [
    { key: 'server_id', label: t('codex_extensions.server_id'), value: draft.id, always: true },
    { key: 'label', label: t('codex_extensions.label'), value: draft.label, always: true },
    { key: 'enabled', label: t('codex_extensions.enabled'), value: String(draft.enabled), always: true },
    { key: 'status', label: t('codex_extensions.status'), value: draft.status },
    { key: 'transport', label: t('codex_extensions.transport'), value: draft.transport, always: true },
    { key: 'source_path', label: t('codex_extensions.source_path'), value: draft.sourcePath },
    { key: 'command', label: t('codex_extensions.command'), value: draft.command || '' },
    { key: 'args', label: t('codex_extensions.args'), value: serializeMcpArgs(draft.args) },
    { key: 'env', label: t('codex_extensions.env'), value: serializeMcpEnv(draft.env) },
    { key: 'env_vars', label: t('codex_extensions.env_vars'), value: draft.envVarsRaw || '' },
    { key: 'cwd', label: t('codex_extensions.cwd'), value: draft.cwd || '' },
    { key: 'url', label: t('codex_extensions.url'), value: draft.url || '' },
    { key: 'bearer_env', label: t('codex_extensions.bearer_env'), value: draft.bearerTokenEnvVar || '' },
    { key: 'http_headers', label: t('codex_extensions.http_headers'), value: serializeMcpEnv(draft.httpHeaders) },
    { key: 'env_http_headers', label: t('codex_extensions.env_http_headers'), value: serializeMcpEnv(draft.envHttpHeaders) },
    { key: 'experimental_environment', label: t('codex_extensions.experimental_environment'), value: draft.experimentalEnvironment || '' },
    { key: 'required', label: t('codex_extensions.required'), value: draft.required ? 'true' : '' },
    { key: 'supports_parallel_tool_calls', label: t('codex_extensions.supports_parallel_tool_calls'), value: draft.supportsParallelToolCalls ? 'true' : '' },
    { key: 'startup_timeout_sec', label: t('codex_extensions.startup_timeout_sec'), value: draft.startupTimeoutSec || '' },
    { key: 'tool_timeout_sec', label: t('codex_extensions.tool_timeout_sec'), value: draft.toolTimeoutSec || '' },
    { key: 'default_tools_approval_mode', label: t('codex_extensions.default_tools_approval_mode'), value: draft.defaultToolsApprovalMode || '' },
    { key: 'enabled_tools', label: t('codex_extensions.enabled_tools'), value: serializeMcpList(draft.enabledTools) },
    { key: 'disabled_tools', label: t('codex_extensions.disabled_tools'), value: serializeMcpList(draft.disabledTools) },
    { key: 'scopes', label: t('codex_extensions.scopes'), value: serializeMcpList(draft.scopes) },
    { key: 'oauth_resource', label: t('codex_extensions.oauth_resource'), value: draft.oauthResource || '' },
    { key: 'tools', label: t('codex_extensions.tools'), value: serializeMcpTools(draft.tools) },
  ].filter((row) => row.always || row.value.trim() !== '');

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
        className="scrollbar-stable mx-auto max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-y-auto border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-5rem)]"
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
                  <Field label={t('codex_extensions.oauth_resource')} value={draft.oauthResource || ''} onChange={(value) => onPatch({ oauthResource: value })} />
                </div>
              </McpEditorSection>
            )}

            <McpEditorSection
              title={t('codex_extensions.mcp_runtime_section')}
              meta={t('codex_extensions.mcp_shared_config')}
            >
              <div className="grid gap-4 md:grid-cols-2">
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
              </div>
            </McpEditorSection>

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
            <div className="divide-y-2 divide-[var(--border-color)]">
              {currentValueRows.map((row) => (
                <McpValueLine key={row.key} label={row.label} value={row.value} />
              ))}
            </div>

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

function McpStatusBadge({ status }: { status: McpServerRecord['status'] }) {
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

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 min-w-0">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 break-all font-mono text-[0.6875rem] font-black text-[var(--text-primary)]">{value}</div>
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

function McpValueLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-3">
      <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="min-w-0 whitespace-pre-wrap break-all font-mono text-[0.625rem] font-black text-[var(--text-primary)]">
        {value || '-'}
      </div>
    </div>
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
    httpHeaders: (server.httpHeaders || []).map((row) => ({ ...row })),
    envHttpHeaders: (server.envHttpHeaders || []).map((row) => ({ ...row })),
    enabledTools: [...(server.enabledTools || [])],
    disabledTools: [...(server.disabledTools || [])],
    scopes: [...(server.scopes || [])],
    tools: (server.tools || []).map((row) => ({ ...row })),
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
      content: file.content || '',
      previewable: Boolean(file.previewable),
    })),
    skillMarkdown: skill.skillMarkdown || skill.previewMarkdown || '',
  };
}

function isGlobalSkillSource(skill: CodexSkillRecord): boolean {
  return skill.sourceKind === 'system' || skill.sourceKind === 'user';
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
    env: (server.env || []).map((row) => ({ key: row.key, value: row.value })),
    envVarsRaw: server.envVarsRaw || '',
    cwd: server.cwd || '',
    url: server.url || '',
    bearerTokenEnvVar: server.bearerTokenEnvVar || '',
    httpHeaders: (server.httpHeaders || []).map((row) => ({ key: row.key, value: row.value })),
    envHttpHeaders: (server.envHttpHeaders || []).map((row) => ({ key: row.key, value: row.value })),
    experimentalEnvironment: server.experimentalEnvironment || '',
    required: Boolean(server.required),
    supportsParallelToolCalls: Boolean(server.supportsParallelToolCalls),
    startupTimeoutSec: server.startupTimeoutSec || '',
    toolTimeoutSec: server.toolTimeoutSec || '',
    defaultToolsApprovalMode: server.defaultToolsApprovalMode || '',
    enabledTools: [...(server.enabledTools || [])],
    disabledTools: [...(server.disabledTools || [])],
    scopes: [...(server.scopes || [])],
    oauthResource: server.oauthResource || '',
    tools: (server.tools || []).map((tool) => ({ name: tool.name, approvalMode: tool.approvalMode || '' })),
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
    env: server.transport === 'stdio' ? (server.env || []).map((row) => ({ key: row.key, value: row.value })) : [],
    envVarsRaw: server.transport === 'stdio' ? server.envVarsRaw || '' : '',
    cwd: server.transport === 'stdio' ? server.cwd || '' : '',
    url: server.transport === 'streamable_http' ? server.url || '' : '',
    bearerTokenEnvVar: server.transport === 'streamable_http' ? server.bearerTokenEnvVar || '' : '',
    httpHeaders: server.transport === 'streamable_http' ? (server.httpHeaders || []).map((row) => ({ key: row.key, value: row.value })) : [],
    envHttpHeaders: server.transport === 'streamable_http' ? (server.envHttpHeaders || []).map((row) => ({ key: row.key, value: row.value })) : [],
    experimentalEnvironment: server.experimentalEnvironment || '',
    required: Boolean(server.required),
    supportsParallelToolCalls: Boolean(server.supportsParallelToolCalls),
    startupTimeoutSec: server.startupTimeoutSec || '',
    toolTimeoutSec: server.toolTimeoutSec || '',
    defaultToolsApprovalMode: server.defaultToolsApprovalMode || '',
    enabledTools: [...(server.enabledTools || [])],
    disabledTools: [...(server.disabledTools || [])],
    scopes: [...(server.scopes || [])],
    oauthResource: server.transport === 'streamable_http' ? server.oauthResource || '' : '',
    tools: (server.tools || []).map((tool) => ({ name: tool.name, approvalMode: tool.approvalMode || '' })),
    sourcePath: server.sourcePath,
    status: server.status,
  } as main.CodexMcpServer;
}
