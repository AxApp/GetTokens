import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  primaryActionSlot?: HTMLElement | null;
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
  primaryActionSlot,
}: ProjectCandidatePoolRulesPanelProps) {
  const [draft, setDraft] = useState<ProjectCandidatePoolRuleLike>(emptyDraft);
  const [message, setMessage] = useState('');
  const [pendingRuleID, setPendingRuleID] = useState('');
  const [creating, setCreating] = useState(false);
  const rows = useMemo(() => buildProjectCandidatePoolRuleRows(rules, accounts), [accounts, rules]);
  const requestableAccounts = accounts.filter((account) => account.requestable !== false && account.disabled !== true);
  const normalizedDraft = normalizeProjectCandidatePoolRuleDraft(draft, channel);
  const normalizedAllowAccountIDs = normalizeAllowAccountIDs(normalizedDraft.allowAccountIDs);
  const draftAccountRows = buildDraftAccountRows(requestableAccounts, normalizedAllowAccountIDs);
  const draftIssues = validateProjectCandidatePoolRuleDraft(normalizedDraft);
  const controlsDisabled = disabled || saving || creating || Boolean(pendingRuleID);
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
    const selected = new Set(normalizedAllowAccountIDs);
    updateDraft({
      allowAccountIDs: selected.has(accountID)
        ? normalizedAllowAccountIDs.filter((id) => id !== accountID)
        : [...normalizedAllowAccountIDs, accountID],
    });
  }

  function moveDraftAccount(accountID: string, direction: -1 | 1) {
    const index = normalizedAllowAccountIDs.indexOf(accountID);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= normalizedAllowAccountIDs.length) {
      return;
    }
    const next = [...normalizedAllowAccountIDs];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    updateDraft({ allowAccountIDs: next });
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
          : normalizedAllowAccountIDs,
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
    <section className="flex min-h-0 flex-1 flex-col">
      {primaryActionSlot
        ? createPortal(
            <button
              type="button"
              onClick={saveRule}
              disabled={controlsDisabled || draftIssues.length > 0}
              className="btn-swiss flex min-h-9 items-center justify-center gap-2 !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={4} />
              {selectedExistingRule ? '更新规则' : '新建规则'}
            </button>,
            primaryActionSlot,
          )
        : null}

      <div className="grid min-h-0 flex-1 gap-6 overflow-x-hidden xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <section className="flex min-h-0 min-w-0 flex-col xl:border-r xl:border-[var(--border-color)] xl:pr-5">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
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
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <span className="text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">允许账号</span>
                <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                  {normalizedAllowAccountIDs.length} enabled
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-y border-[var(--border-color)]">
                {requestableAccounts.length === 0 ? (
                  <div className="px-3 py-3 text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">暂无可选账号</div>
                ) : (
                  draftAccountRows.map(({ account, rank, enabled }) => {
                    const accountID = String(account.id || '').trim();
                    const canMoveUp = enabled && rank > 1;
                    const canMoveDown = enabled && rank > 0 && rank < normalizedAllowAccountIDs.length;
                    return (
                      <div
                        key={accountID}
                        className={[
                          'grid min-w-0 grid-cols-[1rem_2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--border-color)] px-3 py-2 last:border-b-0',
                          enabled ? 'bg-[var(--bg-panel)]' : 'opacity-70',
                        ].join(' ')}
                      >
                        <input
                          id={`project-candidate-account-${accountID}`}
                          type="checkbox"
                          checked={enabled}
                          disabled={controlsDisabled}
                          onChange={() => toggleDraftAccount(accountID)}
                          className="h-4 w-4 accent-[var(--text-primary)]"
                          aria-label={`${enabled ? '停用' : '启用'} ${account.label || accountID}`}
                        />
                        <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                          {enabled ? `#${rank}` : '--'}
                        </span>
                        <label htmlFor={`project-candidate-account-${accountID}`} className="min-w-0 cursor-pointer">
                          <span className="block truncate text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">
                            {account.label || accountID}
                          </span>
                          <span className="block truncate font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-wide text-[var(--text-muted)]">
                            {account.provider || account.sourceKind || accountID}
                          </span>
                        </label>
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={controlsDisabled || !canMoveUp}
                            onClick={() => moveDraftAccount(accountID, -1)}
                            className="btn-swiss flex h-7 w-7 items-center justify-center !px-0 !py-0"
                            aria-label={`上移 ${account.label || accountID}`}
                            title="上移"
                          >
                            <ArrowUp className="h-3.5 w-3.5" strokeWidth={4} />
                          </button>
                          <button
                            type="button"
                            disabled={controlsDisabled || !canMoveDown}
                            onClick={() => moveDraftAccount(accountID, 1)}
                            className="btn-swiss flex h-7 w-7 items-center justify-center !px-0 !py-0"
                            aria-label={`下移 ${account.label || accountID}`}
                            title="下移"
                          >
                            <ArrowDown className="h-3.5 w-3.5" strokeWidth={4} />
                          </button>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col">
          {rows.length === 0 ? (
            <div className="min-h-0 flex-1 border-y border-[var(--border-color)] px-3 py-4 text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-muted)]">
              暂无项目候选池规则
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-y border-[var(--border-color)]">
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

function buildDraftAccountRows(
  accounts: ChannelRoutingParticipantAccountLike[],
  allowAccountIDs: string[],
): Array<{ account: ChannelRoutingParticipantAccountLike; enabled: boolean; rank: number }> {
  const accountByID = new Map<string, ChannelRoutingParticipantAccountLike>();
  for (const account of accounts) {
    const id = String(account.id || '').trim();
    if (id && !accountByID.has(id)) {
      accountByID.set(id, account);
    }
  }

  const rows: Array<{ account: ChannelRoutingParticipantAccountLike; enabled: boolean; rank: number }> = [];
  const used = new Set<string>();
  allowAccountIDs.forEach((accountID, index) => {
    const account = accountByID.get(accountID);
    if (!account) {
      return;
    }
    used.add(accountID);
    rows.push({ account, enabled: true, rank: index + 1 });
  });
  for (const account of accounts) {
    const accountID = String(account.id || '').trim();
    if (!accountID || used.has(accountID)) {
      continue;
    }
    rows.push({ account, enabled: false, rank: 0 });
  }
  return rows;
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
