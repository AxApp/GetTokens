import { Play, RotateCcw, Terminal } from 'lucide-react';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import { ModelCombobox } from './ModelCombobox';
import {
  DEFAULT_CODEX_ROUTING_PROBE_MODEL,
  type CodexAccountRow,
  type CodexRoutingProbeStreamLineStatus,
} from '../model/codexAccountList';

export function RouteProbeCard({
  t,
  routingProbeModel,
  routingProbeModelOptions,
  routingProbeRunning,
  routingProbeDisabled,
  allowFallback,
  routePolicyPreviewRows,
  routingProbeStreamLines,
  latestUsedFallback,
  onFallbackChange,
  onModelChange,
  onProbeOnce,
  onProbeSeries,
  onReset,
}: {
  t: (key: string) => string;
  routingProbeModel: string;
  routingProbeModelOptions: string[];
  routingProbeRunning: boolean;
  routingProbeDisabled: boolean;
  allowFallback: boolean;
  routePolicyPreviewRows: CodexAccountRow[];
  routingProbeStreamLines: Array<{
    key: string;
    marker: string;
    label: string;
    detail: string;
    status: CodexRoutingProbeStreamLineStatus;
  }>;
  latestUsedFallback: boolean;
  onFallbackChange: () => void;
  onModelChange: (value: string) => void;
  onProbeOnce: () => void;
  onProbeSeries: () => void;
  onReset: () => void;
}) {
  return (
    <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
      <header className="grid gap-0 border-b-2 border-[var(--border-color)] xl:grid-cols-[minmax(18rem,0.54fr)_minmax(0,1.46fr)]">
        <div className="grid content-start gap-4 border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-5 xl:border-b-0 xl:border-r-2">
          <div>
            <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {t('codex.account_list_policy_title')}
            </div>
            <div className="mt-2 text-xl font-black uppercase italic leading-none tracking-tighter text-[var(--text-primary)]">
              {t('codex.account_list_policy_headline')}
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {t('codex.account_list_probe_model')}
            </span>
            <ModelCombobox
              value={routingProbeModel}
              options={routingProbeModelOptions}
              onChange={onModelChange}
              placeholder={DEFAULT_CODEX_ROUTING_PROBE_MODEL}
            />
          </label>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={onProbeOnce}
              disabled={routingProbeDisabled}
              className="btn-swiss flex min-h-10 w-full items-center justify-center gap-2 !px-3 !py-2 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" strokeWidth={4} />
              {routingProbeRunning ? t('codex.account_list_probe_running') : t('codex.account_list_probe_once')}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onProbeSeries}
                disabled={routingProbeDisabled}
                className="btn-swiss min-h-10 !px-3 !py-2 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('codex.account_list_probe_series')}
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={routingProbeRunning}
                className="btn-swiss flex min-h-10 items-center justify-center gap-2 !px-3 !py-2 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={4} />
                {t('common.reset')}
              </button>
            </div>
          </div>

          <div className="border-t-2 border-[var(--border-color)] pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {t('codex.account_list_policy_fallback_scope')}
                </span>
                <span className="mt-1 block text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                  {t('codex.account_list_policy_fallback')}
                </span>
                <span className="mt-1 block text-[0.5rem] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                  {t('codex.account_list_policy_fallback_hint')}
                </span>
              </span>
              <ToggleSwitch checked={allowFallback} label={t('codex.account_list_policy_fallback')} onChange={onFallbackChange} />
            </div>
          </div>
        </div>

        <div className="min-w-0 p-5">
          <RouteProbeTerminal
            lines={routingProbeStreamLines}
            previewRows={routePolicyPreviewRows}
            latestUsedFallback={latestUsedFallback}
            t={t}
          />
        </div>
      </header>

    </section>
  );
}

function RouteProbeTerminal({
  lines,
  previewRows,
  latestUsedFallback,
  t,
}: {
  lines: Array<{
    key: string;
    marker: string;
    label: string;
    detail: string;
    status: CodexRoutingProbeStreamLineStatus;
  }>;
  previewRows: CodexAccountRow[];
  latestUsedFallback: boolean;
  t: (key: string) => string;
}) {
  const previewText = previewRows.map((row) => row.label).join(' -> ') || t('codex.account_list_probe_no_account');
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--border-color)] pb-2">
        <div className="flex items-center gap-2 text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
          <Terminal className="h-3.5 w-3.5" strokeWidth={3} />
          {t('codex.account_list_probe_terminal')}
        </div>
        {latestUsedFallback ? (
          <div className="border-2 border-[var(--accent-red)] bg-red-500/10 px-2 py-1 text-[0.5625rem] font-black uppercase tracking-wide text-[var(--accent-red)]">
            {t('codex.account_list_probe_fallback_hit')}
          </div>
        ) : null}
      </div>
      <div className="border-b-2 border-[var(--border-color)] py-2">
        <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {t('codex.account_list_policy_preview')}
        </div>
        <div className="mt-1 break-words font-mono text-[0.6875rem] font-black leading-snug text-[var(--text-primary)]">
          {previewText}
        </div>
      </div>
      <div className="max-h-64 overflow-auto bg-[var(--bg-main)] py-2 font-mono text-[0.6875rem] font-black leading-6 text-[var(--text-primary)]">
        {lines.map((line) => (
          <div key={line.key} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 border-b border-dashed border-[var(--border-color)] py-1 last:border-b-0">
            <span className={`text-right tabular-nums ${routeProbeLineTone(line.status)}`}>{line.marker}</span>
            <span className="min-w-0">
              <span className="break-all">{line.label}</span>
              {line.detail ? (
                <span className={`ml-2 break-all text-[0.625rem] ${line.status === 'command' ? 'text-[var(--text-muted)]' : routeProbeLineTone(line.status)}`}>
                  · {line.detail}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function routeProbeLineTone(status: CodexRoutingProbeStreamLineStatus) {
  switch (status) {
    case 'hit':
    case 'running':
      return 'text-[var(--text-primary)]';
    case 'passed':
      return 'text-[var(--text-primary)]';
    case 'miss':
    case 'empty':
      return 'text-[var(--accent-red)]';
    case 'queued':
      return 'text-[var(--text-muted)]';
    case 'command':
    default:
      return 'text-[var(--text-primary)]';
  }
}
