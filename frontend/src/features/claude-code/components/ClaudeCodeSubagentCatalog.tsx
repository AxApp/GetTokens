import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight, Edit3, EyeOff, FileCode, FolderGit2, Home, Plus, Save, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { main } from '../../../../wailsjs/go/models';
import AssetWorkbenchShell from '../../../components/ui/AssetWorkbenchShell';
import SnippetPre from '../../../components/ui/SnippetPre';

export type SubagentCatalogState =
  | 'valid-agents'
  | 'missing-name'
  | 'missing-description'
  | 'plugin-ignored-fields'
  | 'parse-error'
  | 'empty'
  | 'creating-agent'
  | 'saving-agent';

interface ClaudeCodeSubagentCatalogProps {
  snapshot: main.ClaudeCodeSubagentsSnapshotDTO;
  creatingNew?: boolean;
  editingPath?: string;
  draftName?: string;
  draftDescription?: string;
  draftBody?: string;
  savePreview?: string;
  saveError?: string;
  state: SubagentCatalogState;
  stateMessage?: string;
  onStartCreate?: () => void;
  onCancelCreate?: () => void;
  onStartEdit?: (agent: main.ClaudeCodeSubagentRecordDTO) => void;
  onCancelEdit?: () => void;
  onChangeDraftName?: (name: string) => void;
  onChangeDraftDescription?: (desc: string) => void;
  onChangeDraftBody?: (body: string) => void;
  onSaveAgent?: () => void;
  onDeleteAgent?: (agent: main.ClaudeCodeSubagentRecordDTO) => void;
}

const scopeIcons: Record<string, ReactNode> = {
  user: <Home className="h-3.5 w-3.5" />,
  project: <FolderGit2 className="h-3.5 w-3.5" />,
};

export default function ClaudeCodeSubagentCatalog({
  snapshot,
  creatingNew,
  editingPath,
  draftName,
  draftDescription,
  draftBody,
  savePreview,
  saveError,
  state,
  stateMessage,
  onStartCreate,
  onCancelCreate,
  onStartEdit,
  onCancelEdit,
  onChangeDraftName,
  onChangeDraftDescription,
  onChangeDraftBody,
  onSaveAgent,
  onDeleteAgent,
}: ClaudeCodeSubagentCatalogProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(() => {
    const set = new Set<string>();
    snapshot.agents.forEach((a) => set.add(a.path));
    return set;
  });

  function toggleAgent(path: string) {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  const total = snapshot.agents.length;
  const validCount = snapshot.agents.filter((a) => a.frontmatterValid).length;
  const errorCount = snapshot.agents.filter((a) => !a.frontmatterValid).length;
  const isEditing = Boolean(editingPath) || Boolean(creatingNew);

  return (
    <AssetWorkbenchShell
      title="Subagents"
      subtitle={
        <span className="text-xs">
          {total > 0 ? `${total} agent${total !== 1 ? 's' : ''} · ${validCount} valid · ${errorCount > 0 ? `${errorCount} with errors` : ''}` : ''}
        </span>
      }
      actions={
        !isEditing ? (
          <button
            type="button"
            onClick={onStartCreate}
            className="flex items-center gap-1 rounded border-2 border-[var(--border-color)] px-3 py-1.5 text-xs hover:bg-[var(--bg-main)]"
          >
            <Plus className="h-3.5 w-3.5" /> New Agent
          </button>
        ) : undefined
      }
      notice={
        stateMessage || errorCount > 0 ? (
          <span className={`flex items-center gap-2 text-sm ${errorCount > 0 ? 'text-[var(--text-warning)]' : 'text-[var(--text-secondary)]'}`}>
            {errorCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {stateMessage || `${errorCount} agent${errorCount !== 1 ? 's' : ''} with validation errors`}
          </span>
        ) : undefined
      }
    >
      {total === 0 && !creatingNew ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Bot className="h-10 w-10 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-muted)]">No subagents discovered</p>
          <p className="max-w-md text-xs text-[var(--text-muted)]">
            Create subagent Markdown files in ~/.claude/agents/ or .claude/agents/ to define specialized Claude Code agents.
          </p>
        </div>
      ) : (
        <div className="divide-y-2 divide-[var(--border-color)]">
          {snapshot.agents.map((agent) => (
            <div key={agent.path}>
              <button
                type="button"
                onClick={() => toggleAgent(agent.path)}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-[var(--bg-subtle)]"
              >
                <span className="text-[var(--text-secondary)]">
                  {expandedAgents.has(agent.path) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="text-[var(--text-secondary)]">{scopeIcons[agent.scope] ?? <Bot className="h-4 w-4" />}</span>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium">{agent.name || <span className="italic text-[var(--text-muted)]">unnamed</span>}</span>
                  {agent.scope && (
                    <span className="ml-2 rounded bg-[var(--badge-neutral-bg)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">{agent.scope}</span>
                  )}
                </div>
                {agent.frontmatterValid ? (
                  <span className="flex items-center gap-1 rounded bg-[var(--badge-success-bg)] px-2 py-0.5 text-xs text-[var(--text-success)]">
                    <CheckCircle2 className="h-3 w-3" /> Valid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-[var(--badge-warning-bg)] px-2 py-0.5 text-xs text-[var(--text-warning)]">
                    <AlertTriangle className="h-3 w-3" /> Errors
                  </span>
                )}
                {agent.isPlugin && (
                  <span className="flex items-center gap-1 rounded bg-[var(--badge-neutral-bg)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                    <EyeOff className="h-3 w-3" /> Plugin
                  </span>
                )}
              </button>

              {expandedAgents.has(agent.path) && (
                <div className="border-t-2 border-[var(--border-color)] bg-[var(--bg-subtle)] p-4">
                  <p className="mb-3 font-mono text-xs text-[var(--text-muted)]">{agent.path}</p>

                  {agent.frontmatterError && (
                    <div className="mb-3 rounded border-2 border-[var(--border-warning)] bg-[var(--bg-warning)]/10 p-3 text-sm text-[var(--text-warning)]">
                      {agent.frontmatterError}
                    </div>
                  )}

                  {agent.validationErrors && agent.validationErrors.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {agent.validationErrors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-warning)]">
                          <AlertTriangle className="h-3 w-3" /> {err}
                        </div>
                      ))}
                    </div>
                  )}

                  {agent.description && (
                    <p className="mb-3 text-sm text-[var(--text-secondary)]">{agent.description}</p>
                  )}

                  {agent.knownFields && Object.keys(agent.knownFields).length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Configuration</div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                        {Object.entries(agent.knownFields).map(([key, value]) => (
                          <AgentFieldRow key={key} fieldKey={key} value={value} ignored={agent.ignoredFields?.includes(key)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {agent.isPlugin && agent.ignoredFields && agent.ignoredFields.length > 0 && (
                    <div className="mb-3 rounded bg-[var(--badge-warning-bg)] p-2 text-xs text-[var(--text-warning)]">
                      Plugin subagent: {agent.ignoredFields.join(', ')} field{agent.ignoredFields.length > 1 ? 's' : ''} ignored
                    </div>
                  )}

                  {agent.bodyPreview && (
                    <div className="mb-3">
                      <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Body Preview</div>
                      <SnippetPre className="max-h-32 overflow-auto text-xs">{agent.bodyPreview}</SnippetPre>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onStartEdit?.(agent)}
                      className="flex items-center gap-1 rounded border-2 border-[var(--border-color)] px-3 py-1 text-xs hover:bg-[var(--bg-main)]"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAgent?.(agent)}
                      className="flex items-center gap-1 rounded border-2 border-[var(--border-color)] px-3 py-1 text-xs text-[var(--text-warning)] hover:bg-[var(--bg-warning)]/10"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(creatingNew || editingPath) && (
        <div className="border-t-2 border-[var(--border-color)] p-4 bg-[var(--bg-subtle)]">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            {creatingNew ? <Plus className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            {creatingNew ? 'New Subagent' : `Editing: ${editingPath}`}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Name *</label>
              <input
                type="text"
                className="w-full rounded border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                value={draftName ?? ''}
                onChange={(e) => onChangeDraftName?.(e.target.value)}
                placeholder="code-reviewer"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Description *</label>
              <input
                type="text"
                className="w-full rounded border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                value={draftDescription ?? ''}
                onChange={(e) => onChangeDraftDescription?.(e.target.value)}
                placeholder="Reviews code changes with project context"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Body (Markdown)</label>
              <textarea
                className="w-full min-h-[10rem] rounded border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                value={draftBody ?? ''}
                onChange={(e) => onChangeDraftBody?.(e.target.value)}
                placeholder="# Agent instructions..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onCancelEdit ?? onCancelCreate} className="rounded border-2 border-[var(--border-color)] px-3 py-1 text-xs hover:bg-[var(--bg-main)]">
                Cancel
              </button>
              <button type="button" onClick={onSaveAgent} className="flex items-center gap-1 rounded bg-[var(--button-primary-bg)] px-3 py-1 text-xs text-[var(--button-primary-text)]">
                <Save className="h-3 w-3" /> Save
              </button>
            </div>
          </div>

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

function AgentFieldRow({ fieldKey, value, ignored }: { fieldKey: string; value: any; ignored?: boolean }) {
  const displayValue = Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);

  return (
    <>
      <span className={`font-mono text-xs ${ignored ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}`}>
        {fieldKey}
      </span>
      <span className={`text-xs ${ignored ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
        {ignored ? `${displayValue} (ignored in plugin)` : displayValue}
      </span>
    </>
  );
}
