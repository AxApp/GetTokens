import { BarChart3 } from 'lucide-react';

export type SessionPluginConsoleMode = 'ready' | 'running' | 'done';

export interface SessionPluginConsolePlugin {
  id: string;
  icon: string;
  name: string;
  description: string;
  tags: string[];
  active?: boolean;
  disabled?: boolean;
}

export interface SessionPluginConsoleScopeOption {
  id: string;
  title: string;
  subtitle: string;
  active?: boolean;
}

export interface SessionPluginConsoleExecutionState {
  dialLabel: string;
  progress: number;
  headline: string;
  detail: string;
  footer: string;
  tone?: 'blue' | 'green';
}

export interface SessionPluginConsoleSession {
  id: string;
  title: string;
  metadata: string;
  score: string;
  selected?: boolean;
}

export interface SessionPluginConsoleQueueItem {
  id: string;
  title: string;
  detail: string;
  tone: 'blue' | 'orange' | 'green';
  active?: boolean;
}

export interface SessionPluginConsoleMetric {
  value: string;
  label: string;
  meta: string;
}

export interface SessionPluginConsoleKeyword {
  term: string;
  width: number;
}

export interface SessionPluginConsoleTopic {
  title: string;
  summary: string;
}

export interface SessionPluginConsolePanelProps {
  mode: SessionPluginConsoleMode;
  pluginHostTitle: string;
  pluginHostSubtitle: string;
  pluginHint: string;
  refreshLabel: string;
  runLabel: string;
  currentProjectLabel: string;
  actionStatusLabel: string;
  pluginListTitle: string;
  scopeTitle: string;
  executionTitle: string;
  sessionsTitle: string;
  queueTitle: string;
  outputTitle: string;
  metricsTitle: string;
  keywordsTitle: string;
  topicsTitle: string;
  plugins: SessionPluginConsolePlugin[];
  scopes: SessionPluginConsoleScopeOption[];
  execution: SessionPluginConsoleExecutionState;
  sessions: SessionPluginConsoleSession[];
  queue: SessionPluginConsoleQueueItem[];
  metrics: SessionPluginConsoleMetric[];
  keywords: SessionPluginConsoleKeyword[];
  topics: SessionPluginConsoleTopic[];
}

const sessionPluginConsoleButtonClass = 'inline-flex h-9 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]';
const sessionPluginConsolePrimaryButtonClass = 'inline-flex h-9 items-center justify-center rounded border border-[var(--gt-border-strong)] bg-[var(--text-primary)] px-3 text-[length:var(--font-size-ui-sm)] font-medium text-[var(--bg-main)] transition hover:opacity-90';
const sessionPluginConsolePanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const sessionPluginConsoleMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';

export default function SessionPluginConsolePanel({
  mode,
  pluginHostTitle,
  pluginHostSubtitle,
  pluginHint,
  refreshLabel,
  runLabel,
  currentProjectLabel,
  actionStatusLabel,
  pluginListTitle,
  scopeTitle,
  executionTitle,
  sessionsTitle,
  queueTitle,
  outputTitle,
  metricsTitle,
  keywordsTitle,
  topicsTitle,
  plugins,
  scopes,
  execution,
  sessions,
  queue,
  metrics,
  keywords,
  topics,
}: SessionPluginConsolePanelProps) {
  return (
    <main
      data-design-system-component="true"
      data-design-system-component-name="SessionPluginConsolePanel"
      data-session-plugin-console-panel="true"
      className="min-w-0 overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-[var(--gt-elevation-raised-2)]"
    >
      <header className="grid gap-4 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-[var(--gt-border-strong)] bg-[var(--text-primary)] text-[var(--bg-main)]">
              <BarChart3 className="h-4 w-4" strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[length:var(--font-size-ui-xl)] font-semibold text-[var(--text-primary)]">
                {pluginHostTitle}
              </h2>
              <p className="mt-1 truncate text-[length:var(--font-size-ui-sm)] font-medium text-[var(--text-muted)]">
                {pluginHostSubtitle}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[length:var(--font-size-ui-sm)] font-medium leading-5 text-[var(--text-muted)]">
            {pluginHint}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]">
            {[
              { id: 'ready', label: '就绪' },
              { id: 'running', label: '运行中' },
              { id: 'done', label: '完成' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`min-h-8 border-r border-[var(--gt-border-subtle)] px-3 text-[length:var(--font-size-ui-xs)] font-medium last:border-r-0 ${
                  mode === item.id ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className={sessionPluginConsoleButtonClass}>
            {refreshLabel}
          </button>
          <button type="button" className={sessionPluginConsolePrimaryButtonClass}>
            {runLabel}
          </button>
        </div>
      </header>

      <section className="grid min-h-0 xl:grid-cols-[260px_minmax(0,1fr)_380px]">
        <aside data-session-plugin-console-plugin-list="true" className="border-b border-[var(--gt-border-subtle)] xl:border-b-0 xl:border-r">
          <PanelHead title={pluginListTitle} count={String(plugins.length).padStart(2, '0')} />
          <div>
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className={`grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-[var(--gt-border-subtle)] p-3 ${
                  plugin.active
                    ? 'bg-[color-mix(in_srgb,var(--gt-status-info)_10%,var(--gt-surface-canvas))]'
                    : plugin.disabled
                      ? 'bg-[var(--gt-surface-muted)] text-[var(--text-muted)]'
                      : 'bg-[var(--gt-surface-canvas)]'
                }`}
              >
                <div className="grid h-8 w-8 place-items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[length:var(--font-size-ui-lg)] font-semibold">
                  {plugin.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)]">
                    {plugin.name}
                  </h3>
                  <p className="mt-1 text-[length:var(--font-size-ui-xs)] font-medium leading-4 text-[var(--text-muted)]">
                    {plugin.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {plugin.tags.map((tag) => (
                      <span
                        key={`${plugin.id}-${tag}`}
                        className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-1.5 py-0.5 text-[length:var(--font-size-ui-2xs)] font-medium text-[var(--text-muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="grid min-h-0 border-b border-[var(--gt-border-subtle)] xl:border-b-0 xl:border-r">
          <div className="grid gap-0 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] lg:grid-cols-[1.1fr_0.9fr]">
            <section className="border-b border-[var(--gt-border-subtle)] lg:border-b-0 lg:border-r">
              <PanelHead title={scopeTitle} count={String(scopes.length)} />
              <div className="grid gap-2 p-3">
                {scopes.map((scope) => (
                  <div
                    key={scope.id}
                    className={`rounded border px-3 py-2 ${
                      scope.active
                        ? 'border-[var(--gt-border-strong)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                        : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]'
                    }`}
                  >
                    <div className="text-[length:var(--font-size-ui-sm)] font-semibold">
                      {scope.title}
                    </div>
                    <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-medium opacity-75">
                      {scope.subtitle}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <PanelHead title={executionTitle} count={mode.toUpperCase()} />
              <div className="grid grid-cols-[74px_minmax(0,1fr)] gap-3 p-3">
                <div
                  className="grid h-[74px] w-[74px] place-items-center rounded-full border-[8px] border-solid text-[length:var(--font-size-ui-md)] font-semibold"
                  style={{
                    borderColor:
                      execution.tone === 'green' ? 'var(--color-status-success)' : 'var(--color-chart-blue)',
                    borderRightColor:
                      execution.tone === 'green' ? 'var(--color-status-success)' : 'var(--bg-muted)',
                  }}
                >
                  {execution.dialLabel}
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)]">
                    <span>{execution.headline}</span>
                    <b>{actionStatusLabel}</b>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-[var(--gt-surface-canvas)]">
                    <div
                      className={`h-full ${execution.tone === 'green' ? 'bg-[var(--color-status-success)]' : 'bg-[var(--color-chart-blue)]'}`}
                      style={{ width: `${Math.max(0, Math.min(100, execution.progress))}%` }}
                    />
                  </div>
                  <div className="text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]">
                    {execution.detail}
                  </div>
                  <div className="text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]">
                    {execution.footer}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="grid min-h-0 xl:grid-cols-[minmax(0,1fr)_220px]">
            <section className="min-w-0 border-b border-[var(--gt-border-subtle)] xl:border-b-0 xl:border-r">
              <PanelHead title={sessionsTitle} count={String(sessions.length)} />
              <div>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`grid min-h-[64px] grid-cols-[24px_minmax(0,1fr)_54px] items-center gap-2 border-b border-[var(--gt-border-subtle)] px-3 py-2.5 ${
                      session.selected ? 'bg-[color-mix(in_srgb,var(--gt-status-warning)_12%,var(--gt-surface-canvas))]' : 'bg-[var(--gt-surface-canvas)]'
                    }`}
                  >
                    <div className="grid h-6 w-6 place-items-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] text-[length:var(--font-size-ui-xs)] font-semibold">
                      {session.selected ? '✓' : ''}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)]">
                        {session.title}
                      </div>
                      <div className="mt-1 truncate text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]">
                        {session.metadata}
                      </div>
                    </div>
                    <div className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-1 text-center text-[length:var(--font-size-ui-xs)] font-semibold">
                      {session.score}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="bg-[var(--gt-surface-muted)]">
              <PanelHead title={queueTitle} count={String(queue.length).padStart(2, '0')} />
              <div className="grid gap-2 p-3">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className={`${sessionPluginConsolePanelClass} p-2.5 ${
                      item.active ? 'bg-[color-mix(in_srgb,var(--gt-status-info)_10%,var(--gt-surface-canvas))]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)]">
                      <span>{item.title}</span>
                      <span className={`h-2 w-2 rounded-full ${
                        item.tone === 'green'
                          ? 'bg-[var(--color-status-success)]'
                          : item.tone === 'orange'
                            ? 'bg-[var(--color-chart-peak)]'
                            : 'bg-[var(--color-chart-blue)]'
                      }`} />
                    </div>
                    <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]">
                      {item.detail}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <aside data-session-plugin-console-output="true" className="bg-[var(--gt-surface-muted)]">
          <PanelHead title={outputTitle} count="result" />
          <div className="space-y-3 p-3">
            <section className={sessionPluginConsolePanelClass}>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--gt-border-subtle)] px-3 py-2">
                <div className="text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)]">
                  {metricsTitle}
                </div>
                <span className="text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]">
                  {currentProjectLabel}
                </span>
              </div>
              <div className="grid grid-cols-2">
                {metrics.map((metric) => (
                  <div key={`${metric.label}-${metric.value}`} className="min-h-[70px] border-b border-r border-[var(--gt-border-subtle)] p-3 last:border-b-0">
                    <div className="text-[length:var(--font-size-ui-2xl)] font-semibold leading-none">{metric.value}</div>
                    <div className="mt-2 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)]">
                      {metric.label}
                    </div>
                    <div className="mt-1 text-[length:var(--font-size-ui-2xs)] font-medium text-[var(--text-muted)]">
                      {metric.meta}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={sessionPluginConsolePanelClass}>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--gt-border-subtle)] px-3 py-2">
                <div className="text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)]">
                  {keywordsTitle}
                </div>
                <BarChart3 className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="grid gap-2 p-3">
                {keywords.map((keyword) => (
                  <div key={keyword.term} className="grid grid-cols-[minmax(0,1fr)_42px] items-center gap-2">
                    <div className="truncate text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-primary)]">
                      {keyword.term}
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-[var(--gt-surface-muted)]">
                      <div className="h-full bg-[var(--color-status-success)]" style={{ width: `${keyword.width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={sessionPluginConsolePanelClass}>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--gt-border-subtle)] px-3 py-2">
                <div className="text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)]">
                  {topicsTitle}
                </div>
                <span className="text-[length:var(--font-size-ui-xs)] font-medium text-[var(--text-muted)]">
                  {sessions.length} sessions
                </span>
              </div>
              <div className="grid gap-2 p-3">
                {topics.map((topic) => (
                  <article key={topic.title} className={sessionPluginConsoleMutedPanelClass}>
                    <h4 className="truncate p-2.5 pb-0 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)]">
                      {topic.title}
                    </h4>
                    <p className="p-2.5 pt-1 text-[length:var(--font-size-ui-2xs)] font-medium leading-4 text-[var(--text-muted)]">
                      {topic.summary}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}

function PanelHead({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2">
      <div className="truncate text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)]">
        {title}
      </div>
      <span className="inline-flex min-w-7 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-1.5 py-0.5 text-[length:var(--font-size-ui-2xs)] font-medium text-[var(--text-muted)]">
        {count}
      </span>
    </div>
  );
}
