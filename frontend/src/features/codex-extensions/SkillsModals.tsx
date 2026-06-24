import { Button, Input } from 'antd';
import { AlertTriangle, CheckCircle2, Download, Eye, FolderOpen, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { GetCodexSkillFilePreview } from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { toErrorMessage } from '../../utils/error';
import {
  parseTkGitSkillSource,
  stripSkillFrontmatter,
  type CodexSkillRecord,
} from './model';

interface TProps {
  t: (key: string) => string;
}

const codexSkillModalPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-lg';
const codexSkillModalHeaderClass =
  'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const codexSkillModalFooterClass =
  'border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';

export function SuccessHud({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-[80] w-[min(92vw,28rem)] -translate-x-1/2" role="status" aria-live="polite">
      <div className={`${codexSkillModalPanelClass} codex-success-hud flex items-center gap-3 px-4 py-3`}>
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--gt-status-success)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)]">
          <span className="codex-success-hud-ring absolute inset-0 rounded border border-[var(--gt-status-success)]" />
          <CheckCircle2 className="codex-success-hud-icon h-6 w-6 text-[var(--gt-status-success)]" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[length:var(--gt-font-size-md)] font-semibold text-[var(--gt-ink-primary)]">
            {title}
          </div>
          <div className="mt-1 truncate font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GitSkillInstallModal({
  gitSource,
  parsedGitSource,
  t,
  onChange,
  onClose,
  onInstall,
}: {
  gitSource: string;
  parsedGitSource: ReturnType<typeof parseTkGitSkillSource>;
  onChange: (value: string) => void;
  onClose: () => void;
  onInstall: () => void;
} & TProps) {
  return (
    <div
      className="scrollbar-stable fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--overlay-scrim-80)] p-3 sm:p-6"
      data-collaboration-id="MODAL_CODEX_SKILL_GIT_INSTALL"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('codex_extensions.add_skill')}
        data-codex-extension-skill-install-modal="true"
        className={`${codexSkillModalPanelClass} flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden sm:max-h-[calc(100vh-3rem)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={`${codexSkillModalHeaderClass} flex shrink-0 items-start justify-between gap-4 px-5 py-4`}>
          <div className="min-w-0">
            <div className="font-mono text-xl font-semibold text-[var(--gt-ink-primary)]">
              {t('codex_extensions.add_skill')}
            </div>
            <div className="mt-1 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
              {t('codex_extensions.git_source')}
            </div>
          </div>
          <Button size="small" onClick={onClose}>
            {t('common.close')}
          </Button>
        </header>

        <main className="scrollbar-stable min-h-0 flex-1 overflow-auto p-5">
          <label className="grid gap-2">
            <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
              {t('codex_extensions.git_source')}
            </span>
            <Input size="small" value={gitSource} onChange={(event) => onChange(event.target.value)} className="w-full font-mono" />
          </label>

          <div className="mt-4 border-t border-[var(--gt-border-subtle)] pt-4">
            {parsedGitSource ? (
              <div className="divide-y divide-[var(--gt-border-subtle)]">
                <GitSourceValue label={t('codex_extensions.git_source_schema')} value={gitSource.trim()} />
                <GitSourceValue label={t('codex_extensions.git_provider')} value={parsedGitSource.provider} />
                <GitSourceValue label={t('codex_extensions.git_host')} value={parsedGitSource.host} />
                <GitSourceValue label={t('codex_extensions.git_repo')} value={parsedGitSource.repo} />
                <GitSourceValue label={t('codex_extensions.git_ref')} value={parsedGitSource.ref} />
                <GitSourceValue label={t('codex_extensions.git_path')} value={parsedGitSource.path} />
              </div>
            ) : (
              <div className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-status-danger)]">
                {t('codex_extensions.git_hint')}
              </div>
            )}
          </div>
        </main>

        <footer className={`${codexSkillModalFooterClass} flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 py-4`}>
          <Button size="small" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={onInstall}
            disabled={!parsedGitSource}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            {t('codex_extensions.install_update')}
          </Button>
        </footer>
      </div>
    </div>
  );
}

export function SkillPreviewModal({
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
  loading: boolean;
  browserMode: boolean;
  canDeleteLocalFiles: boolean;
  onClose: () => void;
  onToggle: (checked: boolean) => void;
  onOpenFinder: () => void;
  onRemove: () => void;
} & TProps) {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[var(--overlay-scrim-80)] px-3 py-6 sm:px-6 sm:py-10" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={skill.name}
          data-codex-extension-skill-preview-modal="true"
          className={`${codexSkillModalPanelClass} flex h-[calc(100vh-3rem)] max-h-[48rem] w-full max-w-6xl flex-col sm:h-[calc(100vh-5rem)]`}
          onClick={(event) => event.stopPropagation()}
        >
          <header className={`${codexSkillModalHeaderClass} grid shrink-0 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center`}>
            <div className="min-w-0">
              <div className="font-mono text-xl font-semibold text-[var(--gt-ink-primary)]">
                {skill.name}
              </div>
              <div className="mt-1 break-all text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                {skill.rootPath}
              </div>
            </div>
            <ToggleSwitch
              label={skill.enabled ? t('common.disable') : t('common.enable')}
              checked={skill.enabled}
              disabled={loading}
              onChange={onToggle}
            />
            <Button size="small" onClick={onClose}>
              {t('common.close')}
            </Button>
          </header>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(10rem,16rem)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] lg:grid-rows-none">
            <aside className="scrollbar-stable min-h-0 overflow-y-auto border-b border-[var(--gt-border-subtle)] p-4 lg:border-b-0 lg:border-r">
              <MetaLine label={t('codex_extensions.source')} value={skill.origin || '-'} />
              <MetaLine label={t('codex_extensions.root')} value={skill.rootLabel || '-'} />
              <MetaLine label={t('codex_extensions.skill_enabled_source')} value={formatSkillEnabledSource(skill, t)} />
              <MetaLine label={t('codex_extensions.version')} value={skill.versionLabel || '-'} />
              {skill.warnings && skill.warnings.length > 0 ? (
                <div className="mt-4 border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] p-3">
                  <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-danger)]">
                    {t('codex_extensions.skill_scan_warnings')}
                  </div>
                  <ul className="mt-2 grid gap-1 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-danger)]">
                    {skill.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
                {t('codex_extensions.files')}
              </div>
              <div className="mt-2 divide-y divide-[var(--gt-border-subtle)] border border-[var(--gt-border-subtle)]">
                {skill.files.map((file) => (
                  <Button
                    key={file.path}
                    size="small"
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`block w-full px-2 py-2 text-left transition-colors ${
                      selectedFile?.path === file.path ? 'bg-[var(--gt-border-subtle)] text-[var(--gt-surface-canvas)]' : 'hover:bg-[var(--gt-surface-muted)]'
                    }`}
                  >
                    <div className={`break-all font-mono text-[length:var(--gt-font-size-sm)] font-semibold ${selectedFile?.path === file.path ? 'text-[var(--gt-surface-canvas)]' : 'text-[var(--gt-ink-primary)]'}`}>
                      {file.path}
                    </div>
                    <div className={`mt-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold ${selectedFile?.path === file.path ? 'text-[var(--gt-surface-canvas)]' : 'text-[var(--gt-ink-muted)]'}`}>
                      {file.kind} / {file.previewable || file.path === 'SKILL.md' ? t('codex_extensions.file_previewable') : t('codex_extensions.file_not_previewable')}
                    </div>
                  </Button>
                ))}
              </div>
            </aside>

            <main className="min-h-0 overflow-hidden p-4">
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-3 flex min-w-0 shrink-0 items-center gap-2 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                  <Eye className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selectedFile?.path || t('codex_extensions.skill_preview')}</span>
                </div>
                <div className="scrollbar-stable min-h-0 flex-1 overflow-y-auto break-words border border-dashed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4 text-[length:var(--gt-font-size-md)] font-semibold leading-relaxed text-[var(--gt-ink-primary)] [&_blockquote]:border-l [&_blockquote]:border-[var(--gt-border-subtle)] [&_blockquote]:pl-3 [&_code]:font-mono [&_code]:font-semibold [&_h1]:mb-4 [&_h1]:font-mono [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:font-mono [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-mono [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_pre]:mb-4 [&_pre]:overflow-auto [&_pre]:border [&_pre]:border-[var(--gt-border-subtle)] [&_pre]:bg-[var(--gt-surface-canvas)] [&_pre]:p-3 [&_ul]:list-disc">
                  {filePreviewLoading ? (
                    <div className="flex min-h-full items-center justify-center text-center text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                      {t('common.loading')}
                    </div>
                  ) : filePreviewError ? (
                    <div className="flex min-h-full items-center justify-center px-4 text-center text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-status-danger)]">
                      {filePreviewError}
                    </div>
                  ) : canPreviewSelectedFile ? (
                    selectedFileIsMarkdown ? (
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                        {selectedFile?.path === 'SKILL.md' ? stripSkillFrontmatter(selectedFileContent) : selectedFileContent}
                      </ReactMarkdown>
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-mono text-[length:var(--gt-font-size-md-compact)] font-semibold leading-relaxed">
                        {selectedFileContent}
                      </pre>
                    )
                  ) : (
                    <div className="flex min-h-full items-center justify-center text-center text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                      {t('codex_extensions.file_preview_unavailable')}
                    </div>
                  )}
                </div>
              </div>
            </main>
          </div>
          <footer className={`${codexSkillModalFooterClass} flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3`}>
            <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
              {canRemove
                ? t('codex_extensions.skill_remove_hint')
                : skill.sourceKind === 'system'
                  ? t('codex_extensions.skill_remove_system_blocked')
                  : t('codex_extensions.skill_remove_desktop_required')}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="small" onClick={onOpenFinder} icon={<FolderOpen className="h-3.5 w-3.5" />}>
                {t('codex_extensions.open_in_finder')}
              </Button>
              <Button
                danger
                size="small"
                disabled={!canRemove || loading}
                onClick={() => setRemoveAlertOpen(true)}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                {t('codex_extensions.remove_skill')}
              </Button>
            </div>
          </footer>
        </div>
      </div>
      {removeAlertOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim-85)] p-4" onClick={() => setRemoveAlertOpen(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="codex-skill-remove-alert-title"
            aria-describedby="codex-skill-remove-alert-body"
            data-codex-extension-skill-remove-alert="true"
            className={`${codexSkillModalPanelClass} w-full max-w-md border-[var(--gt-status-danger)]`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start gap-3 border-b border-[var(--gt-status-danger)] bg-[var(--gt-surface-muted)] p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gt-status-danger)]" />
              <div className="min-w-0">
                <div id="codex-skill-remove-alert-title" className="font-mono text-base font-semibold text-[var(--gt-ink-primary)]">
                  {t('codex_extensions.skill_remove_alert_title')}
                </div>
                <div id="codex-skill-remove-alert-body" className="mt-1 break-all text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-muted)]">
                  {skill.rootPath}
                </div>
              </div>
            </header>
            <div className="space-y-3 p-4">
              <p className="text-sm font-semibold leading-relaxed text-[var(--gt-ink-primary)]">
                {t('codex_extensions.skill_remove_confirm')}
              </p>
              <p className="break-all font-mono text-[length:var(--gt-font-size-md-compact)] font-semibold text-[var(--gt-ink-muted)]">
                {skill.id}
              </p>
            </div>
            <footer className={`${codexSkillModalFooterClass} flex flex-wrap justify-end gap-2 p-3`}>
              <Button size="small" onClick={() => setRemoveAlertOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                danger
                size="small"
                disabled={loading}
                onClick={() => {
                  setRemoveAlertOpen(false);
                  onRemove();
                }}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                {t('common.delete')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GitSourceValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-3">
      <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
        {label}
      </div>
      <div className="min-w-0 break-all font-mono text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
        {value || '-'}
      </div>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 min-w-0">
      <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">{label}</div>
      <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-md-compact)] font-semibold text-[var(--gt-ink-primary)]">{value}</div>
    </div>
  );
}

function formatSkillEnabledSource(skill: CodexSkillRecord, t: (key: string) => string): string {
  const source = skill.enabledSource || 'default_enabled';
  const label = t(`codex_extensions.skill_enabled_source_${source}`);
  return skill.enabledSourceValue ? `${label}: ${skill.enabledSourceValue}` : label;
}

function isMarkdownSkillFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower === 'skill.md' || lower.endsWith('.md') || lower.endsWith('.markdown');
}
