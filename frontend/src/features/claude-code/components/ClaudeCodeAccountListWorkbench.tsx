import { Play, Save, ShieldCheck, SlidersHorizontal, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';

type ClaudeCodeAccountState = 'ready' | 'source-conflict' | 'disabled-blocked' | 'profile-draft';
type ClaudeCodeProfileTone = 'default' | 'draft' | 'warning';

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

const stateCopy: Record<ClaudeCodeAccountState, { label: string; value: string; tone: string }> = {
  ready: {
    label: 'Ready',
    value: 'Anthropic relay queue is requestable',
    tone: 'border-[var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_10%,transparent)] text-[var(--color-status-success)]',
  },
  'source-conflict': {
    label: 'Profile diff',
    value: 'Saved mapping takes precedence over official profile',
    tone: 'border-[var(--color-status-warning)] bg-[color-mix(in_srgb,var(--color-status-warning)_12%,transparent)] text-[var(--color-status-warning)]',
  },
  'disabled-blocked': {
    label: 'Blocked',
    value: 'Disabled rows stay ordered but skip runtime requests',
    tone: 'border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--color-status-danger)]',
  },
  'profile-draft': {
    label: 'Draft',
    value: 'Official defaults can fill local apply and relay mapping draft',
    tone: 'border-[var(--accent-red)] bg-[color-mix(in_srgb,var(--accent-red)_8%,transparent)] text-[var(--accent-red)]',
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
      className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]"
    >
      <header className="grid gap-4 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-normal">
              Claude Code
            </span>
            <span className={`border-2 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-normal ${stateMeta.tone}`}>
              {stateMeta.label}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black uppercase italic tracking-normal">账号列表 / 模型映射工作台</h2>
          <p className="mt-2 max-w-4xl text-sm font-bold leading-6 text-[var(--text-muted)]">
            只收 `supportedFormats` 包含 `anthropic` 的账号；Claude Code 本地只应用一个 relay endpoint 和 key，多账号请求顺序由 GetTokens relay 执行。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right sm:min-w-[24rem]">
          <Metric label="Anthropic" value={anthropicAccounts.length} />
          <Metric label="Requestable" value={requestableAccounts.length} />
          <Metric label="Blocked" value={blockedAccounts.length} />
        </div>
      </header>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <div className="grid gap-4">
          <PanelTitle icon={<SlidersHorizontal className="h-4 w-4" />} title="请求顺序" note={stateMeta.value} />
          <div className="grid gap-2">
            {anthropicAccounts.map((account, index) => (
              <AccountQueueRow key={account.id} account={account} index={index} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
              <PanelTitle icon={<ShieldCheck className="h-4 w-4" />} title="模型映射草稿" note="UI: real upstream model -> Claude Code alias" />
              <div className="mt-3 grid gap-2">
                {mappings.map((mapping) => (
                  <MappingRow key={`${mapping.provider}:${mapping.realModel}:${mapping.claudeAlias}`} mapping={mapping} />
                ))}
              </div>
            </div>

            <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
              <PanelTitle icon={<Terminal className="h-4 w-4" />} title="路由探测" note="Preview only, no runtime sidecar" />
              <div className="mt-3 grid gap-1 bg-[var(--bg-main)] p-3 font-mono text-[11px] font-bold leading-5 text-[var(--text-muted)]">
                {probeLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-3">
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
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-3">
      <div className="font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function PanelTitle({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase italic tracking-normal">{title}</h3>
          <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">{note}</p>
        </div>
      </div>
    </div>
  );
}

function AccountQueueRow({ account, index }: { account: ClaudeCodeAccountRow; index: number }) {
  const blocked = !account.requestable || account.disabled;
  return (
    <article className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] font-mono text-xs font-black">
          #{index + 1}
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]"
          aria-label="Run route probe"
          title="Run route probe"
        >
          <Play className="h-4 w-4" />
        </button>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-black">{account.label}</span>
          <span className="border border-[var(--border-color)] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">
            {account.provider}
          </span>
          <span
            className={`border px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal ${
              blocked
                ? 'border-[var(--color-status-danger)] text-[var(--color-status-danger)]'
                : 'border-[var(--color-status-success)] text-[var(--color-status-success)]'
            }`}
          >
            {blocked ? account.blockReason || 'blocked' : 'requestable'}
          </span>
        </div>
        <div className="mt-2 grid gap-1 font-mono text-[11px] font-bold leading-5 text-[var(--text-muted)]">
          <span className="truncate">request base: {resolveRequestBaseUrl(account)}</span>
          <span>
            profile: {account.profileName} / mappings: {account.mappingCount}
          </span>
        </div>
      </div>
      <div className="grid content-center gap-1 text-right font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">
        <span>priority {account.priority}</span>
        <span>{account.supportedFormats.join(' + ')}</span>
      </div>
    </article>
  );
}

function ProviderProfileCard({ profile }: { profile: ClaudeCodeProviderProfile }) {
  const tone = profile.tone || 'default';
  const toneClass =
    tone === 'warning'
      ? 'border-[var(--color-status-warning)]'
      : tone === 'draft'
        ? 'border-[var(--accent-red)]'
        : 'border-[var(--border-color)]';

  return (
    <article className={`border-2 ${toneClass} bg-[var(--bg-surface)] p-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-black uppercase italic tracking-normal">{profile.provider}</h4>
          <p className="mt-1 font-mono text-[10px] font-black uppercase tracking-normal text-[var(--text-muted)]">{profile.plan}</p>
        </div>
        <span className="border border-[var(--border-color)] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-normal">
          官网默认值
        </span>
      </div>
      <div className="mt-3 grid gap-2 font-mono text-[11px] font-bold leading-5">
        <span>default: {profile.defaultModel}</span>
        {profile.haikuModel ? <span>haiku: {profile.haikuModel}</span> : null}
        <span className="text-[var(--text-muted)]">local apply: {profile.localApplyHint}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile.switchableModels.map((model) => (
          <span key={model} className="border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 py-0.5 font-mono text-[10px] font-bold">
            {model}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs font-bold text-[var(--text-muted)]">上方模型是官方可切换模型集合，不作为默认值候选。</p>
    </article>
  );
}

function MappingRow({ mapping }: { mapping: ClaudeCodeModelMappingDraft }) {
  const sourceLabel =
    mapping.source === 'saved' ? 'saved' : mapping.source === 'official-profile' ? 'official profile' : 'migration hint';
  return (
    <div className="grid gap-2 border border-[var(--border-color)] bg-[var(--bg-main)] p-2 font-mono text-[11px] font-bold sm:grid-cols-[minmax(0,1fr)_auto]">
      <span className="min-w-0 truncate">
        {mapping.realModel} -&gt; {mapping.claudeAlias}
      </span>
      <span className="text-[var(--text-muted)]">{mapping.provider} / {sourceLabel}</span>
    </div>
  );
}
