import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { main } from '../../../../wailsjs/go/models';
import {
  buildProjectCandidatePoolRuleRows,
  normalizeProjectCandidatePoolRuleDraft,
  validateProjectCandidatePoolRuleDraft,
  type ChannelID,
  type ChannelRoutingParticipantAccountLike,
  type ProjectCandidatePoolProjectOption,
  type ProjectCandidatePoolRuleLike,
} from '../model/channelRouting';

export interface ProjectCandidatePoolRulesAPI {
  create: (rule: ProjectCandidatePoolRuleLike) => Promise<main.ProjectCandidatePoolRule[] | ProjectCandidatePoolRuleLike[] | null | undefined>;
  update: (rule: ProjectCandidatePoolRuleLike) => Promise<main.ProjectCandidatePoolRule[] | ProjectCandidatePoolRuleLike[] | null | undefined>;
  delete: (input: { id: string }) => Promise<unknown>;
}

interface ProjectCandidatePoolRulesPanelProps {
  channel: ChannelID;
  rules: ProjectCandidatePoolRuleLike[];
  projectOptions: ProjectCandidatePoolProjectOption[];
  accounts: ChannelRoutingParticipantAccountLike[];
  disabled?: boolean;
  saving?: boolean;
  api?: ProjectCandidatePoolRulesAPI;
  onRulesChange: (rules: ProjectCandidatePoolRuleLike[]) => void;
  onPreviewRule?: (rule: ProjectCandidatePoolRuleLike) => void;
}

const emptyDraft: ProjectCandidatePoolRuleLike = {
  projectKey: '',
  projectName: '',
  projectKeySource: '',
  projectKeyConfidence: '',
  enabled: true,
  allowAccountIDs: [],
};

export default function ProjectCandidatePoolRulesPanel({
  channel,
  rules,
  projectOptions,
  accounts,
  disabled = false,
  saving = false,
  api,
  onRulesChange,
  onPreviewRule,
}: ProjectCandidatePoolRulesPanelProps) {
  const [draft, setDraft] = useState<ProjectCandidatePoolRuleLike>(emptyDraft);
  const [message, setMessage] = useState('');
  const [pendingRuleID, setPendingRuleID] = useState('');
  const [creating, setCreating] = useState(false);
  const rows = useMemo(() => buildProjectCandidatePoolRuleRows(rules, accounts), [accounts, rules]);
  const requestableAccounts = accounts.filter((account) => account.requestable !== false && account.disabled !== true);
  const normalizedDraft = normalizeProjectCandidatePoolRuleDraft(draft, channel);
  const draftIssues = validateProjectCandidatePoolRuleDraft(normalizedDraft);
  const controlsDisabled = disabled || saving || creating || Boolean(pendingRuleID);
  const selectedProjectOption = projectOptions.find((option) => option.projectKey === normalizedDraft.projectKey);
  const selectedExistingRule = rules.find(
    (rule) => String(rule.projectKey || '').trim() === normalizedDraft.projectKey,
  );

  function updateDraft(patch: Partial<ProjectCandidatePoolRuleLike>) {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
    setMessage('');
  }

  function toggleDraftAccount(accountID: string) {
    const selected = new Set(normalizedDraft.allowAccountIDs || []);
    if (selected.has(accountID)) {
      selected.delete(accountID);
    } else {
      selected.add(accountID);
    }
    updateDraft({ allowAccountIDs: Array.from(selected) });
  }

  function selectProject(projectKey: string) {
    const option = projectOptions.find((item) => item.projectKey === projectKey);
    const existingRule = rules.find((rule) => String(rule.projectKey || '').trim() === projectKey);
    if (!option) {
      updateDraft({
        ...emptyDraft,
        allowAccountIDs: normalizedDraft.allowAccountIDs,
      });
      return;
    }
    updateDraft({
      projectKey: option.projectKey,
      projectName: option.projectName,
      projectKeySource: option.projectKeySource,
      projectKeyConfidence: option.projectKeyConfidence,
      allowAccountIDs:
        normalizeAllowAccountIDs(existingRule?.allowAccountIDs).length > 0
          ? normalizeAllowAccountIDs(existingRule?.allowAccountIDs)
          : normalizedDraft.allowAccountIDs,
    });
  }

  async function saveRule() {
    if (draftIssues.length > 0 || controlsDisabled) {
      setMessage(draftIssues[0] || '');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const nextRule = selectedExistingRule?.id
        ? {
            ...selectedExistingRule,
            ...normalizedDraft,
            id: selectedExistingRule.id,
          }
        : normalizedDraft;
      if (api) {
        const next = selectedExistingRule?.id ? await api.update(nextRule) : await api.create(nextRule);
        onRulesChange(mapProjectRules(next));
      } else {
        if (selectedExistingRule) {
          onRulesChange(
            rules.map((item) =>
              String(item.id || item.projectKey) === String(selectedExistingRule.id || selectedExistingRule.projectKey)
                ? {
                    ...nextRule,
                    id: selectedExistingRule.id || nextRule.id || nextRule.projectKey,
                  }
                : item,
            ),
          );
          setMessage('浏览器预览：规则已更新');
        } else {
          onRulesChange([
            ...rules,
            {
              ...nextRule,
              id: nextRule.id || `preview-${Date.now()}`,
            },
          ]);
          setMessage('浏览器预览：规则已暂存');
        }
      }
      setDraft(emptyDraft);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  }

  async function toggleRule(rule: ProjectCandidatePoolRuleLike) {
    const normalized = normalizeProjectCandidatePoolRuleDraft({ ...rule, enabled: rule.enabled === false }, channel);
    await updateRule(normalized);
  }

  async function updateRule(rule: ProjectCandidatePoolRuleLike) {
    const normalized = normalizeProjectCandidatePoolRuleDraft(rule, channel);
    const issues = validateProjectCandidatePoolRuleDraft(normalized);
    if (issues.length > 0) {
      setMessage(issues[0]);
      return;
    }
    const ruleID = String(normalized.id || normalized.projectKey || '').trim();
    setPendingRuleID(ruleID);
    setMessage('');
    try {
      if (api && normalized.id) {
        const next = await api.update(normalized);
        onRulesChange(mapProjectRules(next));
      } else {
        onRulesChange(rules.map((item) => (String(item.id || item.projectKey) === ruleID ? normalized : item)));
        setMessage('浏览器预览：规则已更新');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingRuleID('');
    }
  }

  async function deleteRule(rule: ProjectCandidatePoolRuleLike) {
    const ruleID = String(rule.id || rule.projectKey || '').trim();
    if (!ruleID) {
      return;
    }
    setPendingRuleID(ruleID);
    setMessage('');
    try {
      if (api && rule.id) {
        await api.delete({ id: rule.id });
        onRulesChange(rules.filter((item) => item.id !== rule.id));
      } else {
        onRulesChange(rules.filter((item) => String(item.id || item.projectKey) !== ruleID));
        setMessage('浏览器预览：规则已删除');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingRuleID('');
    }
  }

  return (
    <section className="min-w-0">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
        <div className="min-w-0">
          <h2 className="text-[length:var(--font-size-ui-lg)] font-black leading-5 text-[var(--text-primary)]">
            项目候选池
          </h2>
          <p className="mt-1 text-[length:var(--font-size-ui-xs)] leading-5 text-[var(--text-secondary)]">
            命中历史项目后，只在允许账号内进入顺序或均衡路由。
          </p>
        </div>
        <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
          {rows.length} rules
        </span>
      </header>

      <div className="grid gap-6 pt-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 xl:border-r xl:border-[var(--border-color)] xl:pr-5">
          <div className="grid gap-3">
            <label className="block min-w-0">
              <span className="mb-1 block text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">项目</span>
              <select
                value={String(draft.projectKey || '')}
                disabled={controlsDisabled || projectOptions.length === 0}
                onChange={(event) => selectProject(event.currentTarget.value)}
                className="input-swiss h-10 w-full text-[length:var(--font-size-ui-sm)]"
              >
                <option value="">请选择历史项目</option>
                {projectOptions.map((option) => (
                  <option key={option.projectKey} value={option.projectKey}>
                    {option.projectName || option.projectKey}
                    {option.configured ? ' · 已配置' : option.sourceLabel ? ` · ${option.sourceLabel}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {selectedProjectOption ? (
              <div className="border-y border-[var(--border-color)] px-3 py-2">
                <div className="truncate text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
                  {selectedProjectOption.projectName || selectedProjectOption.projectKey}
                </div>
                <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                  {selectedProjectOption.projectKey}
                </div>
                <div className="mt-1 text-[length:var(--font-size-ui-xs)] text-[var(--text-secondary)]">
                  {[
                    selectedProjectOption.sourceLabel,
                    selectedProjectOption.projectKeySource,
                    selectedProjectOption.projectKeyConfidence,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '历史识别项目'}
                </div>
              </div>
            ) : (
              <div className="border-y border-[var(--border-color)] px-3 py-3 text-[length:var(--font-size-ui-xs)] font-black leading-5 text-[var(--text-muted)]">
                暂无可选历史项目。打开或产生一次带工作目录身份的会话后，会定期同步到这里。
              </div>
            )}
            <div className="min-w-0">
              <div className="mb-1 text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">允许账号</div>
              <div className="max-h-56 overflow-auto border-y border-[var(--border-color)]">
                {requestableAccounts.length === 0 ? (
                  <div className="px-3 py-3 text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">暂无可选账号</div>
                ) : (
                  requestableAccounts.map((account) => {
                    const accountID = String(account.id || '').trim();
                    const checked = (normalizedDraft.allowAccountIDs || []).includes(accountID);
                    return (
                      <label key={accountID} className="grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)] gap-2 border-b border-[var(--border-color)] px-3 py-2 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={controlsDisabled}
                          onChange={() => toggleDraftAccount(accountID)}
                          className="mt-1 h-4 w-4 accent-[var(--text-primary)]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">
                            {account.label || accountID}
                          </span>
                          <span className="block truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                            {account.provider || account.sourceKind || accountID}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={saveRule}
              disabled={controlsDisabled || draftIssues.length > 0}
              className="btn-swiss flex min-h-9 items-center justify-center gap-2 !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={4} />
              {selectedExistingRule ? '更新规则' : '新建规则'}
            </button>
            {draftIssues.length > 0 ? (
              <div className="text-[length:var(--font-size-ui-xs)] font-black leading-5 text-[var(--color-status-danger)]">
                {draftIssues[0]}
              </div>
            ) : null}
          </div>
        </section>

        <section className="min-w-0">
          {rows.length === 0 ? (
            <div className="border-y border-[var(--border-color)] px-3 py-4 text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">
              暂无项目候选池规则
            </div>
          ) : (
            <div className="border-y border-[var(--border-color)]">
              {rows.map((row) => (
                <article key={row.id} className="min-w-0 border-b border-[var(--border-color)] p-3 last:border-b-0">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
                          {row.projectTitle}
                        </h3>
                        <span className="border border-[var(--border-color)] px-1.5 py-0.5 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                          {row.statusLabel}
                        </span>
                      </div>
                      <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                        {row.projectKey}
                      </div>
                      {row.projectMeta ? (
                        <div className="mt-1 text-[length:var(--font-size-ui-xs)] text-[var(--text-secondary)]">{row.projectMeta}</div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {onPreviewRule ? (
                        <button
                          type="button"
                          onClick={() => onPreviewRule(row.raw)}
                          disabled={controlsDisabled}
                          className="btn-swiss min-h-8 !px-2 !py-1 !text-[length:var(--font-size-ui-xs)]"
                        >
                          预演
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void toggleRule(row.raw)}
                        disabled={controlsDisabled}
                        className="btn-swiss min-h-8 !px-2 !py-1 !text-[length:var(--font-size-ui-xs)]"
                      >
                        {row.enabled ? '停用' : '启用'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRule(row.raw)}
                        disabled={controlsDisabled}
                        aria-label="删除项目候选池规则"
                        className="btn-swiss flex min-h-8 items-center gap-1 !px-2 !py-1 !text-[length:var(--font-size-ui-xs)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={4} />
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                    <span className="border border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">
                      {row.accountCountLabel}
                    </span>
                    {row.allowAccountTitles.slice(0, 5).map((title) => (
                      <span key={title} className="max-w-[14rem] truncate border border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-xs)] text-[var(--text-secondary)]">
                        {title}
                      </span>
                    ))}
                    {row.missingAccountIDs.length > 0 ? (
                      <span className="border border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black text-[var(--color-status-danger)]">
                        缺失 {row.missingAccountIDs.length}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {message ? (
        <div className="border-t-2 border-[var(--border-color)] px-4 py-3 text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-secondary)]">
          {message}
        </div>
      ) : null}
    </section>
  );
}

function mapProjectRules(input: main.ProjectCandidatePoolRule[] | ProjectCandidatePoolRuleLike[] | null | undefined): ProjectCandidatePoolRuleLike[] {
  return (input || []).map((rule) => ({
    id: rule.id,
    channel: rule.channel,
    projectKey: rule.projectKey,
    projectName: rule.projectName,
    projectKeySource: rule.projectKeySource,
    projectKeyConfidence: rule.projectKeyConfidence,
    enabled: rule.enabled,
    allowAccountIDs: [...(rule.allowAccountIDs || [])],
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  }));
}

function normalizeAllowAccountIDs(input: string[] | null | undefined): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of input || []) {
    const id = String(item || '').trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
