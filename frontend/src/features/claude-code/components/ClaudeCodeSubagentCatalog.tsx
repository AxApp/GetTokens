import { useState, type ReactNode } from 'react';
import { Button, Input } from 'antd';
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight, Edit3, EyeOff, FileCode, FolderGit2, Home, Plus, Save, Trash2, X } from 'lucide-react';
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

const subagentCatalogListClass = 'divide-y divide-[var(--gt-border-subtle)]';
const subagentCatalogRowClass =
  'flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--gt-surface-muted)]';
const subagentCatalogPanelClass =
  'border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4';
const subagentCatalogWarningPanelClass =
  'mb-3 rounded border border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,transparent)] p-3 text-sm text-[var(--gt-status-warning)]';
const subagentCatalogEditorClass =
  'border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4';

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
          <Button
            size="small"
            onClick={onStartCreate}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            New Agent
          </Button>
        ) : undefined
      }
      notice={
        stateMessage || errorCount > 0 ? (
          <span className={`flex items-center gap-2 text-sm ${errorCount > 0 ? 'text-[var(--gt-status-warning)]' : 'text-[var(--gt-ink-secondary)]'}`}>
            {errorCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {stateMessage || `${errorCount} agent${errorCount !== 1 ? 's' : ''} with validation errors`}
          </span>
        ) : undefined
      }
    >
      {total === 0 && !creatingNew ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Bot className="h-10 w-10 text-[var(--gt-ink-muted)]" />
          <p className="text-sm text-[var(--gt-ink-muted)]">No subagents discovered</p>
          <p className="max-w-md text-xs text-[var(--gt-ink-muted)]">
            Create subagent Markdown files in ~/.claude/agents/ or .claude/agents/ to define specialized Claude Code agents.
          </p>
        </div>
      ) : (
        <div className={subagentCatalogListClass} data-claude-subagent-catalog="quiet">
          {snapshot.agents.map((agent) => (
            <div key={agent.path}>
              <Button
                type="text"
                onClick={() => toggleAgent(agent.path)}
                className={subagentCatalogRowClass}
                data-claude-subagent-row={agent.path}
              >
                <span className="text-[var(--gt-ink-secondary)]">
                  {expandedAgents.has(agent.path) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="text-[var(--gt-ink-secondary)]">{scopeIcons[agent.scope] ?? <Bot className="h-4 w-4" />}</span>
                <div className="flex-1 text-left">
                  <span className="text-sm font-normal">{agent.name || <span className="text-[var(--gt-ink-muted)]">unnamed</span>}</span>
                  {agent.scope && (
                    <span className="ml-2 rounded bg-[var(--gt-surface-muted)] px-1.5 py-0.5 text-xs text-[var(--gt-ink-muted)]">{agent.scope}</span>
                  )}
                </div>
                {agent.frontmatterValid ? (
                  <span className="flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--gt-status-success)_12%,transparent)] px-2 py-0.5 text-xs text-[var(--gt-status-success)]">
                    <CheckCircle2 className="h-3 w-3" /> Valid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] px-2 py-0.5 text-xs text-[var(--gt-status-warning)]">
                    <AlertTriangle className="h-3 w-3" /> Errors
                  </span>
                )}
                {agent.isPlugin && (
                  <span className="flex items-center gap-1 rounded bg-[var(--gt-surface-muted)] px-2 py-0.5 text-xs text-[var(--gt-ink-muted)]">
                    <EyeOff className="h-3 w-3" /> Plugin
                  </span>
                )}
              </Button>

              {expandedAgents.has(agent.path) && (
                <div className={subagentCatalogPanelClass}>
                  <p className="mb-3 font-mono text-xs text-[var(--gt-ink-muted)]">{agent.path}</p>

                  {agent.frontmatterError && (
                    <div className={subagentCatalogWarningPanelClass}>
                      {agent.frontmatterError}
                    </div>
                  )}

                  {agent.validationErrors && agent.validationErrors.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {agent.validationErrors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-[var(--gt-status-warning)]">
                          <AlertTriangle className="h-3 w-3" /> {err}
                        </div>
                      ))}
                    </div>
                  )}

                  {agent.description && (
                    <p className="mb-3 text-sm text-[var(--gt-ink-secondary)]">{agent.description}</p>
                  )}

                  {agent.knownFields && Object.keys(agent.knownFields).length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1 text-xs font-normal text-[var(--gt-ink-secondary)]">Configuration</div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                        {Object.entries(agent.knownFields).map(([key, value]) => (
                          <AgentFieldRow key={key} fieldKey={key} value={value} ignored={agent.ignoredFields?.includes(key)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {agent.isPlugin && agent.ignoredFields && agent.ignoredFields.length > 0 && (
                    <div className="mb-3 rounded bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] p-2 text-xs text-[var(--gt-status-warning)]">
                      Plugin subagent: {agent.ignoredFields.join(', ')} field{agent.ignoredFields.length > 1 ? 's' : ''} ignored
                    </div>
                  )}

                  {agent.bodyPreview && (
                    <div className="mb-3">
                      <div className="mb-1 text-xs font-normal text-[var(--gt-ink-secondary)]">Body Preview</div>
                      <SnippetPre className="max-h-32 overflow-auto text-xs">{agent.bodyPreview}</SnippetPre>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      size="small"
                      onClick={() => onStartEdit?.(agent)}
                      icon={<Edit3 className="h-3 w-3" />}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => onDeleteAgent?.(agent)}
                      icon={<Trash2 className="h-3 w-3" />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(creatingNew || editingPath) && (
        <div className={subagentCatalogEditorClass} data-claude-subagent-editor="quiet">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-normal">
            {creatingNew ? <Plus className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            {creatingNew ? 'New Subagent' : `Editing: ${editingPath}`}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-normal text-[var(--gt-ink-secondary)]">Name *</label>
              <Input
                size="small"
                className="font-mono"
                value={draftName ?? ''}
                onChange={(e) => onChangeDraftName?.(e.target.value)}
                placeholder="code-reviewer"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-normal text-[var(--gt-ink-secondary)]">Description *</label>
              <Input
                size="small"
                value={draftDescription ?? ''}
                onChange={(e) => onChangeDraftDescription?.(e.target.value)}
                placeholder="Reviews code changes with project context"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-normal text-[var(--gt-ink-secondary)]">Body (Markdown)</label>
              <Input.TextArea
                size="small"
                value={draftBody ?? ''}
                onChange={(e) => onChangeDraftBody?.(e.target.value)}
                placeholder="# Agent instructions..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="small" onClick={onCancelEdit ?? onCancelCreate}>
                Cancel
              </Button>
              <Button type="primary" size="small" onClick={onSaveAgent} icon={<Save className="h-3 w-3" />}>
                Save
              </Button>
            </div>
          </div>

          {savePreview && (
            <div className="mt-3">
              <span className="text-xs font-normal">Preview</span>
              <SnippetPre className="max-h-40 mt-1 overflow-auto text-xs">{savePreview}</SnippetPre>
            </div>
          )}
          {saveError && <p className="mt-2 text-sm text-[var(--gt-status-danger)]">{saveError}</p>}
        </div>
      )}
    </AssetWorkbenchShell>
  );
}

function AgentFieldRow({ fieldKey, value, ignored }: { fieldKey: string; value: any; ignored?: boolean }) {
  const displayValue = Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);

  return (
    <>
      <span className={`font-mono text-xs ${ignored ? 'text-[var(--gt-ink-muted)] line-through' : 'text-[var(--gt-ink-secondary)]'}`}>
        {fieldKey}
      </span>
      <span className={`text-xs ${ignored ? 'text-[var(--gt-ink-muted)]' : 'text-[var(--gt-ink-primary)]'}`}>
        {ignored ? `${displayValue} (ignored in plugin)` : displayValue}
      </span>
    </>
  );
}
