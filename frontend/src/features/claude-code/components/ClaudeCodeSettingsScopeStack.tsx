import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileJson, FileWarning, Globe, Lock, ShieldCheck, Wrench } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { main } from '../../../../wailsjs/go/models';
import AssetWorkbenchShell from '../../../components/ui/AssetWorkbenchShell';
import SnippetPre from '../../../components/ui/SnippetPre';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';

export type SettingsScopeStackState =
  | 'all-layers-valid'
  | 'partial-layers'
  | 'parse-error'
  | 'managed-readonly'
  | 'env-field-editing'
  | 'all-layers-empty'
  | 'saving-diff';

interface ClaudeCodeSettingsScopeStackProps {
  snapshot: main.ClaudeCodeSettingsSnapshotDTO;
  editingScope?: string;
  draftPatches?: Record<string, any>;
  savePreview?: string;
  saveError?: string;
  onStartEdit?: (scope: string) => void;
  onCancelEdit?: () => void;
  onSavePatch?: (patches: Record<string, any>) => void;
  onToggleAttributionHeader?: (scope: string, enabled: boolean) => void;
  attributionHeaderLabel?: string;
  state: SettingsScopeStackState;
  stateMessage?: string;
}

const scopeIcons: Record<string, ReactNode> = {
  user: <FileJson className="h-4 w-4" />,
  project: <FileJson className="h-4 w-4" />,
  local: <FileWarning className="h-4 w-4" />,
  managed: <Lock className="h-4 w-4" />,
};

const scopeLabels: Record<string, string> = {
  user: 'User (~/.claude/settings.json)',
  project: 'Project (.claude/settings.json)',
  local: 'Local (.claude/settings.local.json)',
  managed: 'Managed policy (read-only)',
};

const scopePriorityLabels: Record<string, string> = {
  managed: 'Highest priority',
  local: 'Overrides project & user',
  project: 'Overrides user',
  user: 'Base',
};

const settingsScopeStackActionButtonClass =
  'inline-flex items-center gap-1 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-1 text-xs font-medium text-[var(--gt-ink-secondary)] transition-colors hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-60';
const settingsScopeStackListClass = 'divide-y divide-[var(--gt-border-subtle)]';
const settingsScopeStackRowClass =
  'flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--gt-surface-muted)]';
const settingsScopeStackPanelClass =
  'border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4';
const settingsScopeStackErrorPanelClass =
  'rounded border border-[var(--gt-status-warning)]/35 bg-[var(--gt-status-warning)]/10 p-3';

export default function ClaudeCodeSettingsScopeStack({
  snapshot,
  editingScope,
  draftPatches,
  savePreview,
  saveError,
  onStartEdit,
  onCancelEdit,
  onSavePatch,
  onToggleAttributionHeader,
  attributionHeaderLabel,
  state,
  stateMessage,
}: ClaudeCodeSettingsScopeStackProps) {
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(() => {
    const set = new Set<string>();
    snapshot.layers.filter((l) => l.exists).forEach((l) => set.add(`${l.scope}`));
    return set;
  });

  function toggleScope(scope: string) {
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  }

  const hasAnyLayers = snapshot.layers.some((l) => l.exists);
  const hasErrors = snapshot.layers.some((l) => l.parseError);

  return (
    <AssetWorkbenchShell
      title="Claude Code Settings"
      subtitle={snapshot.projectPath ? `Project: ${snapshot.projectPath}` : undefined}
      notice={
        (stateMessage || hasErrors) ? (
          <span className={`flex items-center gap-2 text-sm ${hasErrors ? 'text-[var(--gt-status-warning)]' : 'text-[var(--gt-ink-secondary)]'}`}>
            {hasErrors ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {stateMessage || (hasErrors ? 'Some layers have parse errors' : `All ${snapshot.layers.filter((l) => l.exists).length} layers loaded`)}
          </span>
        ) : undefined
      }
    >
      {!hasAnyLayers ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <FileJson className="h-10 w-10 text-[var(--gt-ink-muted)]" />
          <p className="text-sm text-[var(--gt-ink-muted)]">No Claude Code settings files discovered</p>
          <p className="max-w-md text-xs text-[var(--gt-ink-muted)]">
            Create a settings.json file in ~/.claude/ or .claude/ to start configuring Claude Code
          </p>
        </div>
      ) : (
        <div className={settingsScopeStackListClass} data-claude-settings-scope-stack="quiet">
          {snapshot.layers.map((layer) => (
            <div key={`${layer.scope}`} className="group">
              <button
                type="button"
                onClick={() => toggleScope(`${layer.scope}`)}
                className={`${settingsScopeStackRowClass} ${!layer.exists ? 'opacity-50' : ''}`}
                data-claude-settings-scope-row={`${layer.scope}`}
              >
                <span className="text-[var(--gt-ink-secondary)]">
                  {expandedScopes.has(`${layer.scope}`) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="text-[var(--gt-ink-secondary)]">{scopeIcons[`${layer.scope}`] ?? <FileJson className="h-4 w-4" />}</span>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium">{scopeLabels[`${layer.scope}`] ?? `${layer.scope}`}</span>
                  <span className="ml-2 text-xs text-[var(--gt-ink-muted)]">{scopePriorityLabels[`${layer.scope}`] ?? ''}</span>
                </div>
                {layer.parseError ? (
                  <span className="flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] px-2 py-0.5 text-xs text-[var(--gt-status-warning)]">
                    <AlertTriangle className="h-3 w-3" /> Parse Error
                  </span>
                ) : layer.exists ? (
                  <span className="flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--gt-status-success)_12%,transparent)] px-2 py-0.5 text-xs text-[var(--gt-status-success)]">
                    <CheckCircle2 className="h-3 w-3" /> Valid
                  </span>
                ) : (
                  <span className="rounded bg-[var(--gt-surface-muted)] px-2 py-0.5 text-xs text-[var(--gt-ink-muted)]">
                    Not found
                  </span>
                )}
                {`${layer.scope}` === 'managed' && (
                  <Lock className="h-3.5 w-3.5 text-[var(--gt-ink-muted)]" />
                )}
                {`${layer.scope}` === 'local' && layer.exists && (
                  <span className="rounded bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] px-2 py-0.5 text-xs text-[var(--gt-status-warning)]">
                    gitignored
                  </span>
                )}
              </button>

              {expandedScopes.has(`${layer.scope}`) && layer.exists && (
                <div className={settingsScopeStackPanelClass}>
                  <p className="mb-3 font-mono text-xs text-[var(--gt-ink-muted)]">{layer.path}</p>

                  {layer.parseError ? (
                    <div className={settingsScopeStackErrorPanelClass}>
                      <p className="text-sm text-[var(--gt-status-warning)]">{layer.parseError}</p>
                    </div>
                  ) : layer.knownFields ? (
                    <div className="space-y-4">
                      {layer.knownFields.env && Object.keys(layer.knownFields.env).length > 0 && (
                        <SettingsFieldSection icon={<Wrench className="h-4 w-4" />} title="Environment Variables">
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                            {Object.entries(layer.knownFields.env).map(([key, value]) => (
                              <EnvRow key={key} envKey={key} value={value} isEditing={`${layer.scope}` === editingScope} />
                            ))}
                          </div>
                        </SettingsFieldSection>
                      )}

                      {layer.knownFields?.env && `${layer.scope}` !== 'managed' && (
                        <div className="flex items-center justify-between ml-6 mt-4">
                          <span className="text-sm font-medium text-[var(--gt-ink-primary)]">{attributionHeaderLabel}</span>
                          <ToggleSwitch
                            label={attributionHeaderLabel ?? 'Attribution Header'}
                            checked={'CLAUDE_CODE_ATTRIBUTION_HEADER' in layer.knownFields.env}
                            className="h-8 w-14"
                            onChange={(checked) => onToggleAttributionHeader?.(`${layer.scope}`, checked)}
                          />
                        </div>
                      )}

                      {layer.knownFields.permissions && (
                        <SettingsFieldSection icon={<ShieldCheck className="h-4 w-4" />} title="Permissions">
                          <SnippetPre className="max-h-40 overflow-auto text-xs">{JSON.stringify(layer.knownFields.permissions, null, 2)}</SnippetPre>
                        </SettingsFieldSection>
                      )}

                      {layer.knownFields.disableAllHooks !== undefined && (
                        <SettingsFieldSection icon={<AlertTriangle className="h-4 w-4" />} title="Hooks">
                          <span className={`text-sm ${layer.knownFields.disableAllHooks ? 'text-[var(--gt-status-warning)]' : 'text-[var(--gt-status-success)]'}`}>
                            {layer.knownFields.disableAllHooks ? 'All hooks disabled' : 'Hooks enabled'}
                          </span>
                        </SettingsFieldSection>
                      )}

                      {layer.knownFields.outputStyle && (
                        <SettingsFieldSection icon={<Globe className="h-4 w-4" />} title="Output Style">
                          <span className="text-sm">{layer.knownFields.outputStyle}</span>
                        </SettingsFieldSection>
                      )}

                      {`${layer.scope}` !== 'managed' && (
                        <div className="flex justify-end">
                          {editingScope === `${layer.scope}` ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={onCancelEdit}
                                className={settingsScopeStackActionButtonClass}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="rounded bg-[var(--button-primary-bg)] px-3 py-1 text-xs text-[var(--button-primary-text)]"
                                onClick={() => onSavePatch?.(draftPatches ?? buildLayerPatch(layer))}
                              >
                                Save Changes
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={settingsScopeStackActionButtonClass}
                              onClick={() => onStartEdit?.(`${layer.scope}`)}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {savePreview && (
        <div className={settingsScopeStackPanelClass} data-claude-settings-preview="quiet">
          <h3 className="mb-2 text-sm font-medium">Save Preview</h3>
          <SnippetPre className="max-h-60 overflow-auto text-xs">{savePreview}</SnippetPre>
          {saveError && <p className="mt-2 text-sm text-[var(--gt-status-danger)]">{saveError}</p>}
        </div>
      )}
    </AssetWorkbenchShell>
  );
}

function buildLayerPatch(layer: main.ClaudeCodeSettingsLayer): Record<string, any> {
  const fields = layer.knownFields;
  if (!fields) return {};

  const patch: Record<string, any> = {};
  if (fields.env) patch.env = { ...fields.env };
  if (fields.permissions) patch.permissions = fields.permissions;
  if (fields.disableAllHooks !== undefined) patch.disableAllHooks = fields.disableAllHooks;
  if (fields.outputStyle) patch.outputStyle = fields.outputStyle;
  return patch;
}

function SettingsFieldSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[var(--gt-ink-secondary)]">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="ml-6">{children}</div>
    </div>
  );
}

function EnvRow({ envKey, value, isEditing }: { envKey: string; value: string; isEditing: boolean }) {
  const isSecret = /key|token|secret|auth/i.test(envKey);
  const displayValue = isSecret ? `${value.slice(0, 8)}...` : value;

  return (
    <>
      <span className="font-mono text-xs text-[var(--gt-ink-secondary)]">{envKey}</span>
      <span className="font-mono text-xs text-[var(--gt-ink-primary)]">{displayValue}</span>
    </>
  );
}
