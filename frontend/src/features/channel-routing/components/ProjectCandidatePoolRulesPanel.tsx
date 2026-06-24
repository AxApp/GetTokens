import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Select, Tag } from 'antd';
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

const projectCandidateRulesShellClass = 'flex min-h-0 flex-1 flex-col text-[var(--gt-ink-primary)]';
const projectCandidateRulesGridClass =
  'grid min-h-0 flex-1 gap-4 overflow-x-hidden xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)]';
const projectCandidateRulesPanelClass =
  'flex min-h-0 min-w-0 flex-col rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const projectCandidateRulesPanelBodyClass = 'flex min-h-0 flex-1 flex-col gap-3 p-3';
const projectCandidateRulesLabelClass = 'mb-1 block text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]';
const projectCandidateRulesListClass =
  'min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const projectCandidateRulesEmptyClass = 'px-3 py-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const projectCandidateRulesAccountRowClass =
  'grid min-w-0 grid-cols-[1rem_2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--gt-border-subtle)] px-3 py-2 last:border-b-0';
const projectCandidateRulesRankClass =
  'font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const projectCandidateRulesButtonClass =
  'inline-flex min-h-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-50';
const projectCandidateRulesPrimaryButtonClass =
  'inline-flex min-h-9 items-center justify-center gap-2 rounded border border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] px-3 py-1.5 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-50';
const projectCandidateRulesIconButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-45';
const projectCandidateRulesMetaClass =
  'font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const projectCandidateRulesChipClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-secondary)]';
const projectCandidateRulesStrongChipClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]';
const projectCandidateRulesDangerChipClass =
  'rounded border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,transparent)] px-2 py-1 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-danger)]';
const projectCandidateRulesMessageClass =
  'mt-3 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-secondary)]';

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
    <section className={projectCandidateRulesShellClass} data-project-candidate-pool-rules-panel>
      {primaryActionSlot
        ? createPortal(
            <Button
              type="primary"
              size="small"
              onClick={saveRule}
              disabled={controlsDisabled || draftIssues.length > 0}
              className={projectCandidateRulesPrimaryButtonClass}
              icon={<Plus className="h-3.5 w-3.5" strokeWidth={3} />}
            >
              {selectedExistingRule ? '更新规则' : '新建规则'}
            </Button>,
            primaryActionSlot,
          )
        : null}

      <div className={projectCandidateRulesGridClass}>
        <section className={projectCandidateRulesPanelClass} data-project-candidate-rule-draft>
          <div className={projectCandidateRulesPanelBodyClass}>
            <label className="block min-w-0">
              <span className={projectCandidateRulesLabelClass}>项目</span>
              <Select
                size="small"
                value={String(draft.projectKey || '')}
                disabled={controlsDisabled || projectOptions.length === 0}
                onChange={(value) => selectProject(value)}
                className="w-full"
                options={[
                  { value: '', label: '请选择历史项目' },
                  ...projectOptions.map((option) => ({
                    value: option.projectKey,
                    label: `${option.projectName || option.projectKey}${option.configured ? ' · 已配置' : option.sourceLabel ? ` · ${option.sourceLabel}` : ''}`,
                  })),
                ]}
              />
            </label>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <span className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">允许账号</span>
                <span className={projectCandidateRulesMetaClass}>
                  {normalizedAllowAccountIDs.length} enabled
                </span>
              </div>
              <div className={projectCandidateRulesListClass} data-project-candidate-account-list>
                {requestableAccounts.length === 0 ? (
                  <div className={projectCandidateRulesEmptyClass}>暂无可选账号</div>
                ) : (
                  draftAccountRows.map(({ account, rank, enabled }) => {
                    const accountID = String(account.id || '').trim();
                    const canMoveUp = enabled && rank > 1;
                    const canMoveDown = enabled && rank > 0 && rank < normalizedAllowAccountIDs.length;
                    return (
                      <div
                        key={accountID}
                        className={[
                          projectCandidateRulesAccountRowClass,
                          enabled ? 'bg-[var(--gt-surface-muted)]' : 'opacity-70',
                        ].join(' ')}
                      >
                        <Checkbox
                          id={`project-candidate-account-${accountID}`}
                          checked={enabled}
                          disabled={controlsDisabled}
                          onChange={() => toggleDraftAccount(accountID)}
                          className="h-4 w-4 accent-[var(--gt-ink-primary)]"
                          aria-label={`${enabled ? '停用' : '启用'} ${account.label || accountID}`}
                        />
                        <span className={projectCandidateRulesRankClass}>
                          {enabled ? `#${rank}` : '--'}
                        </span>
                        <label htmlFor={`project-candidate-account-${accountID}`} className="min-w-0 cursor-pointer">
                          <span className="block truncate text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                            {account.label || accountID}
                          </span>
                          <span className={projectCandidateRulesMetaClass}>
                            {account.provider || account.sourceKind || accountID}
                          </span>
                        </label>
                        <span className="flex items-center gap-1">
                          <Button
                            size="small"
                            disabled={controlsDisabled || !canMoveUp}
                            onClick={() => moveDraftAccount(accountID, -1)}
                            className={projectCandidateRulesIconButtonClass}
                            aria-label={`上移 ${account.label || accountID}`}
                            title="上移"
                            icon={<ArrowUp className="h-3.5 w-3.5" strokeWidth={3} />}
                          />
                          <Button
                            size="small"
                            disabled={controlsDisabled || !canMoveDown}
                            onClick={() => moveDraftAccount(accountID, 1)}
                            className={projectCandidateRulesIconButtonClass}
                            aria-label={`下移 ${account.label || accountID}`}
                            title="下移"
                            icon={<ArrowDown className="h-3.5 w-3.5" strokeWidth={3} />}
                          />
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <section className={projectCandidateRulesPanelClass} data-project-candidate-rule-list>
          {rows.length === 0 ? (
            <div className="min-h-0 flex-1 px-3 py-4 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
              暂无项目候选池规则
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {rows.map((row) => (
                <article key={row.id} className="min-w-0 border-b border-[var(--gt-border-subtle)] p-3 last:border-b-0" data-project-candidate-rule-row>
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">
                          {row.projectTitle}
                        </h3>
                        <Tag color="default" className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
                          {row.statusLabel}
                        </Tag>
                      </div>
                      <div className="mt-1 break-all font-mono text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
                        {row.projectKey}
                      </div>
                      {row.projectMeta ? (
                        <div className="mt-1 text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-secondary)]">{row.projectMeta}</div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {onPreviewRule ? (
                        <Button
                          size="small"
                          onClick={() => onPreviewRule(row.raw)}
                          disabled={controlsDisabled}
                          className={projectCandidateRulesButtonClass}
                        >
                          预演
                        </Button>
                      ) : null}
                      <Button
                        size="small"
                        onClick={() => void toggleRule(row.raw)}
                        disabled={controlsDisabled}
                        className={projectCandidateRulesButtonClass}
                      >
                        {row.enabled ? '停用' : '启用'}
                      </Button>
                      <Button
                        size="small"
                        onClick={() => void deleteRule(row.raw)}
                        disabled={controlsDisabled}
                        aria-label="删除项目候选池规则"
                        className={`${projectCandidateRulesButtonClass} gap-1`}
                        icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={3} />}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                    <span className={projectCandidateRulesStrongChipClass}>
                      {row.accountCountLabel}
                    </span>
                    {row.allowAccountTitles.slice(0, 5).map((title) => (
                      <span key={title} className={`${projectCandidateRulesChipClass} max-w-[14rem] truncate`}>
                        {title}
                      </span>
                    ))}
                    {row.missingAccountIDs.length > 0 ? (
                      <span className={projectCandidateRulesDangerChipClass}>
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
        <div className={projectCandidateRulesMessageClass} data-project-candidate-rules-message>
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
