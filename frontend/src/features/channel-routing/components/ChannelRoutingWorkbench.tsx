import { Activity, GitBranch, Play, Save, Shuffle, Split, Zap } from 'lucide-react';
import type { main } from '../../../../wailsjs/go/models';
import type { ChannelID, ChannelRouteMode, ChannelRoutingConfig } from '../model/channelRouting';

interface ChannelRoutingWorkbenchProps {
  channel: ChannelID;
  config: ChannelRoutingConfig;
  explain?: main.ChannelRoutingExplainResult | null;
  disabled?: boolean;
  saving?: boolean;
  preview?: boolean;
  message?: string;
  onModeChange: (mode: ChannelRouteMode) => void;
  onShadowEnabledChange: (enabled: boolean) => void;
  onShadowModeChange: (mode: ChannelRouteMode) => void;
  onSave: () => void;
  onExplain: () => void;
}

const routeModes: Array<{
  mode: ChannelRouteMode;
  icon: typeof Split;
  label: string;
}> = [
  { mode: 'sequential', icon: Split, label: '顺序' },
  { mode: 'balanced', icon: Shuffle, label: '均衡' },
  { mode: 'project', icon: GitBranch, label: '项目' },
];

export default function ChannelRoutingWorkbench({
  channel,
  config,
  explain,
  disabled = false,
  saving = false,
  preview = false,
  message = '',
  onModeChange,
  onShadowEnabledChange,
  onShadowModeChange,
  onSave,
  onExplain,
}: ChannelRoutingWorkbenchProps) {
  const candidateCount = explain?.candidates?.length ?? 0;
  const filteredCount = explain?.filtered?.length ?? 0;
  const selectedID = explain?.selectedAccountID || 'none';
  const shadow = explain?.shadow;

  return (
    <section className="grid gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0] text-[var(--text-secondary)]">
              <Zap className="h-4 w-4" strokeWidth={3} />
              {channel === 'codex' ? 'Codex Channel Routing' : 'Claude Channel Routing'}
            </div>
            <h2 className="mt-1 text-[length:var(--font-size-heading-sm)] font-black tracking-[0] text-[var(--text-primary)]">
              账号选取中间件
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExplain}
              disabled={disabled}
              className="btn-swiss flex min-h-10 items-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-sm)]"
            >
              <Play className="h-3.5 w-3.5" strokeWidth={4} />
              Explain
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={disabled || saving}
              className="btn-swiss flex min-h-10 items-center gap-2 !px-3 !py-2 !text-[length:var(--font-size-ui-sm)]"
            >
              <Save className="h-3.5 w-3.5" strokeWidth={4} />
              {saving ? '保存中' : preview ? '预览保存' : '保存'}
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {routeModes.map((item) => {
            const Icon = item.icon;
            const active = config.routeMode === item.mode;
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => onModeChange(item.mode)}
                disabled={disabled}
                className={`flex min-h-16 items-center justify-between border-2 px-3 py-2 text-left transition ${
                  active
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] hover:border-[var(--text-primary)]'
                }`}
              >
                <span className="text-[length:var(--font-size-ui-md)] font-black">{item.label}</span>
                <Icon className="h-4 w-4 shrink-0" strokeWidth={4} />
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="flex min-w-0 items-center gap-3">
            <input
              type="checkbox"
              checked={config.shadowEnabled}
              disabled={disabled}
              onChange={(event) => onShadowEnabledChange(event.currentTarget.checked)}
              className="h-4 w-4 accent-[var(--text-primary)]"
            />
            <span className="min-w-0">
              <span className="block text-[length:var(--font-size-ui-sm)] font-black text-[var(--text-primary)]">
                Shadow decision
              </span>
              <span className="block text-[length:var(--font-size-ui-xs)] text-[var(--text-secondary)]">
                仅记录差异，不改变真实账号选择
              </span>
            </span>
          </label>
          <select
            value={config.shadowRouteMode}
            disabled={disabled || !config.shadowEnabled}
            onChange={(event) => onShadowModeChange(event.currentTarget.value as ChannelRouteMode)}
            className="input-swiss h-10 font-mono text-[length:var(--font-size-ui-sm)]"
          >
            {routeModes.map((item) => (
              <option key={item.mode} value={item.mode}>
                {item.mode}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 text-[length:var(--font-size-ui-sm)] sm:grid-cols-3">
          <Metric label="顺序账号" value={config.orderedAccountIDs.length} />
          <Metric label="项目绑定" value={config.projectBindings.length} />
          <Metric label="账号组" value={config.accountGroups?.length ?? 0} />
        </div>

        {message ? <p className="text-[length:var(--font-size-ui-sm)] text-[var(--text-secondary)]">{message}</p> : null}
      </div>

      <div className="min-w-0 border-2 border-[var(--border-color)] bg-[var(--bg-subtle)] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-secondary)]">
            <Activity className="h-4 w-4" strokeWidth={3} />
            Dry-run
          </div>
          <span className="font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-muted)]">
            {candidateCount} candidates / {filteredCount} filtered
          </span>
        </div>
        <div className="space-y-2 font-mono text-[length:var(--font-size-ui-xs)]">
          <div className="break-all border border-[var(--border-color)] bg-[var(--bg-main)] p-2">
            selected: {selectedID}
          </div>
          <div className="break-all border border-[var(--border-color)] bg-[var(--bg-main)] p-2">
            snapshot: {explain?.snapshotVersion || 'pending'} / policy: {explain?.policyVersion || 'pending'}
          </div>
          {shadow?.enabled ? (
            <div className="break-all border border-[var(--border-color)] bg-[var(--bg-main)] p-2">
              shadow: {shadow.routeMode || 'none'} {'->'} {shadow.selectedAccountID || 'none'} / diff:{' '}
              {shadow.diff ? 'yes' : 'no'}
            </div>
          ) : null}
          {(explain?.steps || ['explain pending']).map((step, index) => (
            <div key={`${step}-${index}`} className="border border-[var(--border-color)] bg-[var(--bg-main)] p-2">
              {step}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-subtle)] p-3">
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 font-mono text-[length:var(--font-size-heading-sm)] font-black text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
