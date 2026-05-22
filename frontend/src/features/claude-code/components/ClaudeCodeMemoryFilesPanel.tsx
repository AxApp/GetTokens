import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Edit3, FileText, FileWarning, GitBranch, Globe, Home, Import, Save, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
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
  snapshot: main.ClaudeCodeMemoryFilesSnapshot;
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
  const hasWarnings = snapshot.warnings.length > 0;
  const isEditing = editingPath != null;

  return (
    <AssetWorkbenchShell
      title="CLAUDE.md"
      subtitle={snapshot.projectPath ? `Project: ${snapshot.projectPath}` : undefined}
      notice={
        stateMessage || hasWarnings ? (
          <span className={`flex items-center gap-2 text-sm ${hasWarnings ? 'text-[var(--text-warning)]' : 'text-[var(--text-secondary)]'}`}>
            {hasWarnings ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {stateMessage || (hasWarnings ? snapshot.warnings[0] : `${existingFiles.length} file${existingFiles.length !== 1 ? 's' : ''} found`)}
          </span>
        ) : undefined
      }
    >
      {existingFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <FileText className="h-10 w-10 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">No CLAUDE.md files discovered</p>
          <p className="max-w-md text-xs text-[var(--text-muted)]">
            Create a CLAUDE.md in ~/.claude/ or your project root to provide persistent instructions to Claude Code.
            Use @imports to include AGENTS.md or other shared Markdown files.
          </p>
        </div>
      ) : (
        <div className="divide-y-2 divide-[var(--border-color)]">
          {snapshot.files.map((file) => (
            <div key={file.path}>
              <button
                type="button"
                onClick={() => toggleFile(file.path)}
                className={`flex w-full items-center gap-3 p-4 text-left hover:bg-[var(--bg-subtle)] ${!file.exists ? 'opacity-50' : ''}`}
              >
                <span className="text-[var(--text-secondary)]">
                  {expandedFiles.has(file.path) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="text-[var(--text-secondary)]">{scopeIcons[file.scope] ?? <FileText className="h-4 w-4" />}</span>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium">{scopeLabels[file.scope] ?? file.scope}</span>
                </div>
                {file.exists ? (
                  <span className="flex items-center gap-1 rounded bg-[var(--badge-success-bg)] px-2 py-0.5 text-xs text-[var(--text-success)]">
                    <CheckCircle2 className="h-3 w-3" /> {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}KB` : `${file.size}B`}
                  </span>
                ) : (
                  <span className="rounded bg-[var(--badge-neutral-bg)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                    Not found
                  </span>
                )}
                {file.gitIgnored && (
                  <span className="rounded bg-[var(--badge-success-bg)] px-2 py-0.5 text-xs text-[var(--text-success)]">
                    <GitBranch className="inline h-3 w-3" /> gitignored
                  </span>
                )}
                {file.scope === 'local' && !file.gitIgnored && file.exists && (
                  <span className="flex items-center gap-1 rounded bg-[var(--badge-warning-bg)] px-2 py-0.5 text-xs text-[var(--text-warning)]">
                    <AlertTriangle className="h-3 w-3" /> not gitignored
                  </span>
                )}
              </button>

              {expandedFiles.has(file.path) && file.exists && (
                <div className="border-t-2 border-[var(--border-color)] bg-[var(--bg-subtle)] p-4">
                  <p className="mb-3 font-mono text-xs text-[var(--text-muted)]">{file.path}</p>

                  {file.imports && file.imports.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Import className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                        <span className="text-xs font-medium">Imports ({file.imports.length})</span>
                      </div>
                      <div className="ml-5 space-y-1">
                        {file.imports.map((imp) => (
                          <div key={imp.raw} className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-[var(--text-secondary)]">@{imp.raw}</span>
                            <span className="text-[var(--text-muted)]">&rarr;</span>
                            {imp.exists ? (
                              <span className="flex items-center gap-1 text-[var(--text-success)]">
                                <CheckCircle2 className="h-3 w-3" /> {imp.resolved}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[var(--text-warning)]">
                                <AlertTriangle className="h-3 w-3" /> missing: {imp.resolved}
                              </span>
                            )}
                            {imp.depth > 1 && (
                              <span className="rounded bg-[var(--badge-neutral-bg)] px-1 py-0.5 text-[var(--text-muted)]">
                                depth {imp.depth}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {file.contentTruncated && (
                    <div className="mb-2 rounded bg-[var(--badge-warning-bg)] p-2 text-xs text-[var(--text-warning)]">
                      Content truncated (file exceeds 50KB limit)
                    </div>
                  )}

                  <div className="mb-3">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                      <Globe className="h-3.5 w-3.5" /> Content Preview
                    </div>
                    <SnippetPre className="max-h-60 overflow-auto text-xs">{file.content || ''}</SnippetPre>
                  </div>

                  <div className="flex justify-end">
                    {editingPath === file.path ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={onCancelEdit} className="rounded border-2 border-[var(--border-color)] px-3 py-1 text-xs hover:bg-[var(--bg-main)]">
                          Cancel
                        </button>
                        <button type="button" onClick={onSaveEdit} className="flex items-center gap-1 rounded bg-[var(--button-primary-bg)] px-3 py-1 text-xs text-[var(--button-primary-text)]">
                          <Save className="h-3 w-3" /> Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartEdit?.(file.path, file.content || '')}
                        className="flex items-center gap-1 rounded border-2 border-[var(--border-color)] px-3 py-1 text-xs hover:bg-[var(--bg-main)]"
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isEditing && editingPath && (
        <div className="border-t-2 border-[var(--border-color)] p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Edit3 className="h-4 w-4" /> Editing: <span className="font-mono text-xs text-[var(--text-muted)]">{editingPath}</span>
          </h3>
          <textarea
            className="w-full min-h-[12rem] rounded border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
            value={editContent ?? ''}
            onChange={(e) => onChangeEditContent?.(e.target.value)}
          />
          {savePreview && (
            <div className="mt-3">
              <span className="text-xs font-medium">Preview</span>
              <SnippetPre className="max-h-40 mt-1 overflow-auto text-xs">{savePreview}</SnippetPre>
            </div>
          )}
          {saveError && <p className="mt-2 text-sm text-[var(--text-danger)]">{saveError}</p>}
        </div>
      )}
    </AssetWorkbenchShell>
  );
}
