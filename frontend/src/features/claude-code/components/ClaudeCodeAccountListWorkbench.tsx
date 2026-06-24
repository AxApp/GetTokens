import type { ReactNode } from 'react';
import { Button } from 'antd';
import { Play, Save, ShieldCheck, SlidersHorizontal, Terminal } from 'lucide-react';

type ClaudeCodeAccountState = 'ready' | 'source-conflict' | 'disabled-blocked' | 'profile-draft';
type ClaudeCodeProfileTone = 'default' | 'draft' | 'warning';
type ClaudeAccountTone = 'success' | 'warning' | 'danger';

export interface ClaudeCodeAccountRow {
  id: string;
  label: string;
  provider: string;
  baseUrl: string;
  anthropicBaseUrl?: string;
  priority: number;
  requestable: boolean;
  disabled?: boolean;
  blockReason?: string;
  supportedFormats: readonly string[];
  mappingCount: number;
  profileName: string;
}

export interface ClaudeCodeProviderProfile {
  provider: string;
  plan: string;
  defaultModel: string;
  haikuModel?: string;
  switchableModels: readonly string[];
  localApplyHint: string;
  tone?: ClaudeCodeProfileTone;
}

export interface ClaudeCodeModelMappingDraft {
  provider: string;
  realModel: string;
  claudeAlias: string;
  source: 'saved' | 'official-profile' | 'migration-hint';
}

export interface ClaudeCodeAccountListWorkbenchProps {
  state: ClaudeCodeAccountState;
  accounts: readonly ClaudeCodeAccountRow[];
  profiles: readonly ClaudeCodeProviderProfile[];
  mappings: readonly ClaudeCodeModelMappingDraft[];
  probeLines: readonly string[];
}

const claudeAccountWorkbenchShellClass =
  'min-w-0 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)]';
const claudeAccountHeaderClass =
  'grid gap-4 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4 xl:grid-cols-[minmax(0,1fr)_auto]';
const claudeAccountMainGridClass = 'grid gap-4 p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]';
const claudeAccountBadgeClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-2 py-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const claudeAccountStatusToneClass = {
  success:
    'border-[var(--gt-status-success)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,transparent)] text-[var(--gt-status-success)]',
  warning:
    'border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,transparent)] text-[var(--gt-status-warning)]',
  danger:
    'border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] text-[var(--gt-status-danger)]',
} satisfies Record<ClaudeAccountTone, string>;
const claudeAccountMetricClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3';
const claudeAccountPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3';
const claudeAccountTerminalClass =
  'mt-3 grid gap-1 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3 font-mono text-[length:var(--gt-font-size-xs)] font-normal leading-5 text-[var(--gt-ink-muted)]';
const claudeAccountIconClass =
  'grid h-8 w-8 shrink-0 place-items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-primary)]';
const claudeAccountQueueRowClass =
  'grid gap-3 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]';
const claudeAccountQueueIndexClass =
  'grid h-10 w-10 place-items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] font-mono text-[length:var(--gt-font-size-xs)] font-semibold';
const claudeAccountChipClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-1.5 py-0.5 font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const claudeAccountStatusChipBaseClass = 'rounded border px-1.5 py-0.5 font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal';
const claudeAccountProfileCardClass =
  'rounded border bg-[var(--gt-surface-muted)] p-3';
const claudeAccountProfileToneClass: Record<ClaudeCodeProfileTone, string> = {
  default: 'border-[var(--gt-border-subtle)]',
  draft: 'border-[var(--gt-status-warning)]',
  warning: 'border-[var(--gt-status-warning)]',
};
const claudeAccountMappingRowClass =
  'grid gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-2 font-mono text-[length:var(--gt-font-size-xs)] font-normal sm:grid-cols-[minmax(0,1fr)_auto]';

const stateCopy: Record<ClaudeCodeAccountState, { label: string; value: string; tone: ClaudeAccountTone }> = {
  ready: {
    label: 'Ready',
    value: 'Anthropic relay queue is requestable',
    tone: 'success',
  },
  'source-conflict': {
    label: 'Profile diff',
    value: 'Saved mapping takes precedence over official profile',
    tone: 'warning',
  },
  'disabled-blocked': {
    label: 'Blocked',
    value: 'Disabled rows stay ordered but skip runtime requests',
    tone: 'danger',
  },
  'profile-draft': {
    label: 'Draft',
    value: 'Official defaults can fill local apply and relay mapping draft',
    tone: 'warning',
  },
};

function hasAnthropicFormat(account: ClaudeCodeAccountRow) {
  return account.supportedFormats.includes('anthropic');
}

function resolveRequestBaseUrl(account: ClaudeCodeAccountRow) {
  return account.anthropicBaseUrl || account.baseUrl;
}

export function ClaudeCodeAccountListWorkbench({
  state,
  accounts,
  profiles,
  mappings,
  probeLines,
}: ClaudeCodeAccountListWorkbenchProps) {
  const anthropicAccounts = accounts.filter(hasAnthropicFormat);
  const requestableAccounts = anthropicAccounts.filter((account) => account.requestable && !account.disabled);
  const blockedAccounts = anthropicAccounts.filter((account) => !account.requestable || account.disabled);
  const stateMeta = stateCopy[state];

  return (
    <section
      data-design-system-component="true"
      data-design-system-component-name="ClaudeCodeAccountListWorkbench"
      data-claude-account-workbench-shell
      className={claudeAccountWorkbenchShellClass}
    >
      <header className={claudeAccountHeaderClass} data-claude-account-workbench-header>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={claudeAccountBadgeClass}>
              Claude Code
            </span>
            <span className={`${claudeAccountBadgeClass} ${claudeAccountStatusToneClass[stateMeta.tone]}`}>
              {stateMeta.label}
            </span>
          </div>
          <h2 className="mt-3 text-[length:var(--gt-font-size-2xl)] font-semibold tracking-normal">账号列表 / 模型映射工作台</h2>
          <p className="mt-2 max-w-4xl text-[length:var(--gt-font-size-sm)] font-normal leading-6 text-[var(--gt-ink-muted)]">
            只收 `supportedFormats` 包含 `anthropic` 的账号；Claude Code 本地只应用一个 relay endpoint 和 key，多账号请求顺序由 GetTokens relay 执行。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right sm:min-w-[24rem]">
          <Metric label="Anthropic" value={anthropicAccounts.length} />
          <Metric label="Requestable" value={requestableAccounts.length} />
          <Metric label="Blocked" value={blockedAccounts.length} />
        </div>
      </header>

      <div className={claudeAccountMainGridClass}>
        <div className="grid gap-4">
          <PanelTitle icon={<SlidersHorizontal className="h-4 w-4" />} title="请求顺序" note={stateMeta.value} />
          <div className="grid gap-2" data-claude-account-queue>
            {anthropicAccounts.map((account, index) => (
              <AccountQueueRow key={account.id} account={account} index={index} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className={claudeAccountPanelClass} data-claude-account-mapping-panel>
              <PanelTitle icon={<ShieldCheck className="h-4 w-4" />} title="模型映射草稿" note="UI: real upstream model -> Claude Code alias" />
              <div className="mt-3 grid gap-2">
                {mappings.map((mapping) => (
                  <MappingRow key={`${mapping.provider}:${mapping.realModel}:${mapping.claudeAlias}`} mapping={mapping} />
                ))}
              </div>
            </div>

            <div className={claudeAccountPanelClass} data-claude-account-probe-panel>
              <PanelTitle icon={<Terminal className="h-4 w-4" />} title="路由探测" note="Preview only, no runtime sidecar" />
              <div className={claudeAccountTerminalClass}>
                {probeLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-3" data-claude-account-profile-list>
          <PanelTitle icon={<Save className="h-4 w-4" />} title="官方默认 Profile" note="官网默认值是权威默认，不被远端 /models 覆盖" />
          {profiles.map((profile) => (
            <ProviderProfileCard key={`${profile.provider}:${profile.plan}`} profile={profile} />
          ))}
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={claudeAccountMetricClass}>
      <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">{label}</div>
      <div className="mt-1 text-[length:var(--gt-font-size-2xl)] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PanelTitle({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={claudeAccountIconClass}>
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal">{title}</h3>
          <p className="mt-0.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">{note}</p>
        </div>
      </div>
    </div>
  );
}

function AccountQueueRow({ account, index }: { account: ClaudeCodeAccountRow; index: number }) {
  const blocked = !account.requestable || account.disabled;
  return (
    <article className={claudeAccountQueueRowClass} data-claude-account-queue-row>
      <div className="flex items-center gap-3">
        <div className={claudeAccountQueueIndexClass}>
          #{index + 1}
        </div>
        <Button
          size="small"
          aria-label="Run route probe"
          title="Run route probe"
          icon={<Play className="h-4 w-4" />}
        />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[length:var(--gt-font-size-sm)] font-semibold">{account.label}</span>
          <span className={claudeAccountChipClass}>
            {account.provider}
          </span>
          <span
            className={`${claudeAccountStatusChipBaseClass} ${
              blocked
                ? 'border-[var(--gt-status-danger)] text-[var(--gt-status-danger)]'
                : 'border-[var(--gt-status-success)] text-[var(--gt-status-success)]'
            }`}
          >
            {blocked ? account.blockReason || 'blocked' : 'requestable'}
          </span>
        </div>
        <div className="mt-2 grid gap-1 font-mono text-[length:var(--gt-font-size-xs)] font-normal leading-5 text-[var(--gt-ink-muted)]">
          <span className="truncate">request base: {resolveRequestBaseUrl(account)}</span>
          <span>
            profile: {account.profileName} / mappings: {account.mappingCount}
          </span>
        </div>
      </div>
      <div className="grid content-center gap-1 text-right font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
        <span>priority {account.priority}</span>
        <span>{account.supportedFormats.join(' + ')}</span>
      </div>
    </article>
  );
}

function ProviderProfileCard({ profile }: { profile: ClaudeCodeProviderProfile }) {
  const tone = profile.tone || 'default';

  return (
    <article className={`${claudeAccountProfileCardClass} ${claudeAccountProfileToneClass[tone]}`} data-claude-account-profile-card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal">{profile.provider}</h4>
          <p className="mt-1 font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">{profile.plan}</p>
        </div>
        <span className={claudeAccountChipClass}>
          官网默认值
        </span>
      </div>
      <div className="mt-3 grid gap-2 font-mono text-[length:var(--gt-font-size-xs)] font-normal leading-5">
        <span>default: {profile.defaultModel}</span>
        {profile.haikuModel ? <span>haiku: {profile.haikuModel}</span> : null}
        <span className="text-[var(--gt-ink-muted)]">local apply: {profile.localApplyHint}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile.switchableModels.map((model) => (
          <span key={model} className={claudeAccountChipClass}>
            {model}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">上方模型是官方可切换模型集合，不作为默认值候选。</p>
    </article>
  );
}

function MappingRow({ mapping }: { mapping: ClaudeCodeModelMappingDraft }) {
  const sourceLabel =
    mapping.source === 'saved' ? 'saved' : mapping.source === 'official-profile' ? 'official profile' : 'migration hint';
  return (
    <div className={claudeAccountMappingRowClass}>
      <span className="min-w-0 truncate">
        {mapping.realModel} -&gt; {mapping.claudeAlias}
      </span>
      <span className="text-[var(--gt-ink-muted)]">{mapping.provider} / {sourceLabel}</span>
    </div>
  );
}
