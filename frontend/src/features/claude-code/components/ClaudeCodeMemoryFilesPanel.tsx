import { useState, type ReactNode } from 'react';
import { Button, Input } from 'antd';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Edit3, FileText, FileWarning, GitBranch, Globe, Home, Import, Save } from 'lucide-react';
import type { main } from '../../../../wailsjs/go/models';
import AssetWorkbenchShell from '../../../components/ui/AssetWorkbenchShell';
import SnippetPre from '../../../components/ui/SnippetPre';

export type MemoryFilesPanelState =
  | 'all-files-present'
  | 'partial-files'
  | 'import-exists'
  | 'import-missing'
  | 'import-recursion'
  | 'local-not-gitignored'
  | 'save-preview'
  | 'empty'
  | 'parse-error'
  | 'import-depth-limit';

interface ClaudeCodeMemoryFilesPanelProps {
  snapshot: main.ClaudeCodeMemoryFilesSnapshotDTO;
  editingPath?: string;
  editContent?: string;
  savePreview?: string;
  saveError?: string;
  state: MemoryFilesPanelState;
  stateMessage?: string;
  onStartEdit?: (path: string, content: string) => void;
  onCancelEdit?: () => void;
  onChangeEditContent?: (content: string) => void;
  onSaveEdit?: () => void;
}

const scopeIcons: Record<string, ReactNode> = {
  user: <Home className="h-4 w-4" />,
  project: <FileText className="h-4 w-4" />,
  local: <FileWarning className="h-4 w-4" />,
};

const scopeLabels: Record<string, string> = {
  user: 'User (~/.claude/CLAUDE.md)',
  project: 'Project (CLAUDE.md)',
  local: 'Local (CLAUDE.local.md)',
};

const memoryFilesPanelListClass = 'divide-y divide-[var(--gt-border-subtle)]';
const memoryFilesPanelRowClass =
  'flex w-full items-center gap-3 bg-[var(--gt-surface-canvas)] p-4 text-left transition-colors hover:bg-[var(--gt-surface-muted)]';
const memoryFilesPanelPanelClass =
  'border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4';

export default function ClaudeCodeMemoryFilesPanel({
  snapshot,
  editingPath,
  editContent,
  savePreview,
  saveError,
  state,
  stateMessage,
  onStartEdit,
  onCancelEdit,
  onChangeEditContent,
  onSaveEdit,
}: ClaudeCodeMemoryFilesPanelProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() => {
    const set = new Set<string>();
    snapshot.files.filter((f) => f.exists).forEach((f) => set.add(f.path));
    return set;
  });

  function toggleFile(path: string) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  const existingFiles = snapshot.files.filter((f) => f.exists);
  const warnings = snapshot.warnings ?? [];
  const hasWarnings = warnings.length > 0;
  const isEditing = editingPath != null;

  return (
    <AssetWorkbenchShell
      title="CLAUDE.md"
      subtitle={snapshot.projectPath ? `Project: ${snapshot.projectPath}` : undefined}
      notice={
        stateMessage || hasWarnings ? (
          <span className={`flex items-center gap-2 text-[length:var(--gt-font-size-sm)] ${hasWarnings ? 'text-[var(--gt-status-warning)]' : 'text-[var(--gt-ink-secondary)]'}`}>
            {hasWarnings ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {stateMessage || (hasWarnings ? warnings[0] : `${existingFiles.length} file${existingFiles.length !== 1 ? 's' : ''} found`)}
          </span>
        ) : undefined
      }
    >
      {existingFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <FileText className="h-10 w-10 text-[var(--gt-ink-muted)]" />
          <p className="text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)]">No CLAUDE.md files discovered</p>
          <p className="max-w-md text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">
            Create a CLAUDE.md in ~/.claude/ or your project root to provide persistent instructions to Claude Code.
            Use @imports to include AGENTS.md or other shared Markdown files.
          </p>
        </div>
      ) : (
        <div className={memoryFilesPanelListClass} data-claude-memory-files-panel="quiet">
          {snapshot.files.map((file) => (
            <div key={file.path}>
              <Button
                type="text"
                onClick={() => toggleFile(file.path)}
                className={memoryFilesPanelRowClass}
                data-claude-memory-file-row={file.path}
              >
                <span className="text-[var(--gt-ink-secondary)]">
                  {expandedFiles.has(file.path) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="text-[var(--gt-ink-secondary)]">{scopeIcons[file.scope] ?? <FileText className="h-4 w-4" />}</span>
                <div className="flex-1 text-left">
                  <span className="text-[length:var(--gt-font-size-sm)] font-normal">{scopeLabels[file.scope] ?? file.scope}</span>
                </div>
                {file.exists ? (
                  <span className="flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--gt-status-success)_12%,transparent)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] text-[var(--gt-status-success)]">
                    <CheckCircle2 className="h-3 w-3" /> {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}KB` : `${file.size}B`}
                  </span>
                ) : (
                  <span className="rounded bg-[var(--gt-surface-muted)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">
                    Not found
                  </span>
                )}
                {file.gitIgnored && (
                  <span className="rounded bg-[color-mix(in_srgb,var(--gt-status-success)_12%,transparent)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] text-[var(--gt-status-success)]">
                    <GitBranch className="inline h-3 w-3" /> gitignored
                  </span>
                )}
                {file.scope === 'local' && !file.gitIgnored && file.exists && (
                  <span className="flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] px-2 py-0.5 text-[length:var(--gt-font-size-xs)] text-[var(--gt-status-warning)]">
                    <AlertTriangle className="h-3 w-3" /> not gitignored
                  </span>
                )}
              </Button>

              {expandedFiles.has(file.path) && file.exists && (
                <div className={memoryFilesPanelPanelClass}>
                  <p className="mb-3 font-mono text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">{file.path}</p>

                  {file.imports && file.imports.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Import className="h-3.5 w-3.5 text-[var(--gt-ink-secondary)]" />
                        <span className="text-[length:var(--gt-font-size-xs)] font-normal">Imports ({file.imports.length})</span>
                      </div>
                      <div className="ml-5 space-y-1">
                        {file.imports.map((imp) => (
                          <div key={imp.raw} className="flex items-center gap-2 text-[length:var(--gt-font-size-xs)]">
                            <span className="font-mono text-[var(--gt-ink-secondary)]">@{imp.raw}</span>
                            <span className="text-[var(--gt-ink-muted)]">&rarr;</span>
                            {imp.exists ? (
                              <span className="flex items-center gap-1 text-[var(--gt-status-success)]">
                                <CheckCircle2 className="h-3 w-3" /> {imp.resolved}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[var(--gt-status-warning)]">
                                <AlertTriangle className="h-3 w-3" /> missing: {imp.resolved}
                              </span>
                            )}
                            {imp.depth > 1 && (
                              <span className="rounded bg-[var(--gt-surface-muted)] px-1 py-0.5 text-[var(--gt-ink-muted)]">
                                depth {imp.depth}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {file.contentTruncated && (
                    <div className="mb-2 rounded bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] p-2 text-[length:var(--gt-font-size-xs)] text-[var(--gt-status-warning)]">
                      Content truncated (file exceeds 50KB limit)
                    </div>
                  )}

                  <div className="mb-3">
                    <div className="mb-1 flex items-center gap-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-secondary)]">
                      <Globe className="h-3.5 w-3.5" /> Content Preview
                    </div>
                    <SnippetPre className="max-h-60 overflow-auto text-[length:var(--gt-font-size-xs)]">{file.content || ''}</SnippetPre>
                  </div>

                  <div className="flex justify-end">
                    {editingPath === file.path ? (
                      <div className="flex gap-2">
                        <Button size="small" onClick={onCancelEdit}>
                          Cancel
                        </Button>
                        <Button type="primary" size="small" onClick={onSaveEdit} icon={<Save className="h-3 w-3" />}>
                          Save
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => onStartEdit?.(file.path, file.content || '')}
                        icon={<Edit3 className="h-3 w-3" />}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isEditing && editingPath && (
        <div className={memoryFilesPanelPanelClass} data-claude-memory-editor="quiet">
          <h3 className="mb-2 flex items-center gap-2 text-[length:var(--gt-font-size-sm)] font-normal">
            <Edit3 className="h-4 w-4" /> Editing: <span className="font-mono text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">{editingPath}</span>
          </h3>
          <Input.TextArea
            size="small"
            value={editContent ?? ''}
            onChange={(e) => onChangeEditContent?.(e.target.value)}
          />
          {savePreview && (
            <div className="mt-3">
              <span className="text-[length:var(--gt-font-size-xs)] font-normal">Preview</span>
              <SnippetPre className="max-h-40 mt-1 overflow-auto text-[length:var(--gt-font-size-xs)]">{savePreview}</SnippetPre>
            </div>
          )}
          {saveError && <p className="mt-2 text-[length:var(--gt-font-size-sm)] text-[var(--gt-status-danger)]">{saveError}</p>}
        </div>
      )}
    </AssetWorkbenchShell>
  );
}
