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
      className="min-w-0 border-4 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[10px_10px_0_var(--shadow-color)]"
    >
      <header className="grid gap-4 border-b-4 border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center border-2 border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]">
              SP
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[length:var(--font-size-ui-2xl)] font-black uppercase tracking-normal">
                {pluginHostTitle}
              </h2>
              <p className="mt-1 truncate text-[length:var(--font-size-ui-xs)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {pluginHostSubtitle}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {pluginHint}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
            {[
              { id: 'ready', label: '就绪' },
              { id: 'running', label: '运行中' },
              { id: 'done', label: '完成' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`min-h-8 border-r border-[var(--border-color)] px-3 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] last:border-r-0 ${
                  mode === item.id ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-swiss text-[length:var(--font-size-ui-xs)]">
            {refreshLabel}
          </button>
          <button type="button" className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] text-[length:var(--font-size-ui-xs)]">
            {runLabel}
          </button>
        </div>
      </header>

      <section className="grid min-h-0 xl:grid-cols-[260px_minmax(0,1fr)_380px]">
        <aside className="border-b-4 border-[var(--border-color)] xl:border-b-0 xl:border-r-4">
          <PanelHead title={pluginListTitle} count={String(plugins.length).padStart(2, '0')} />
          <div>
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className={`grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b-2 border-[var(--border-color)] p-3 ${
                  plugin.active ? 'bg-[#eef4ff]' : plugin.disabled ? 'bg-[var(--bg-surface)] text-[var(--text-muted)]' : 'bg-[var(--bg-main)]'
                }`}
              >
                <div className="grid h-8 w-8 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[length:var(--font-size-ui-xl)] font-black">
                  {plugin.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.14em]">
                    {plugin.name}
                  </h3>
                  <p className="mt-1 text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {plugin.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {plugin.tags.map((tag) => (
                      <span
                        key={`${plugin.id}-${tag}`}
                        className="border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 py-0.5 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.12em]"
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

        <section className="grid min-h-0 border-b-4 border-[var(--border-color)] xl:border-b-0 xl:border-r-4">
          <div className="grid gap-0 border-b-4 border-[var(--border-color)] bg-[var(--bg-surface)] lg:grid-cols-[1.1fr_0.9fr]">
            <section className="border-b-4 border-[var(--border-color)] lg:border-b-0 lg:border-r-2">
              <PanelHead title={scopeTitle} count={String(scopes.length)} />
              <div className="grid gap-2 p-3">
                {scopes.map((scope) => (
                  <div
                    key={scope.id}
                    className={`border-2 border-[var(--border-color)] px-3 py-2 ${
                      scope.active ? 'bg-[var(--text-primary)] text-[var(--bg-main)]' : 'bg-[var(--bg-surface)]'
                    }`}
                  >
                    <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em]">
                      {scope.title}
                    </div>
                    <div className="mt-1 text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] opacity-75">
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
                  className="grid h-[74px] w-[74px] place-items-center rounded-full border-[8px] border-solid text-[length:var(--font-size-ui-md)] font-black"
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
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em]">
                    <span>{execution.headline}</span>
                    <b>{actionStatusLabel}</b>
                  </div>
                  <div className="h-2 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-muted)]">
                    <div
                      className={`h-full ${execution.tone === 'green' ? 'bg-[var(--color-status-success)]' : 'bg-[var(--color-chart-blue)]'}`}
                      style={{ width: `${Math.max(0, Math.min(100, execution.progress))}%` }}
                    />
                  </div>
                  <div className="text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {execution.detail}
                  </div>
                  <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {execution.footer}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="grid min-h-0 xl:grid-cols-[minmax(0,1fr)_220px]">
            <section className="min-w-0 border-b-4 border-[var(--border-color)] xl:border-b-0 xl:border-r-2">
              <PanelHead title={sessionsTitle} count={String(sessions.length)} />
              <div>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`grid min-h-[64px] grid-cols-[24px_minmax(0,1fr)_54px] items-center gap-2 border-b border-[var(--border-color)] px-3 py-2.5 ${
                      session.selected ? 'bg-[#fff6df]' : 'bg-[var(--bg-main)]'
                    }`}
                  >
                    <div className="grid h-6 w-6 place-items-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] font-black">
                      {session.selected ? '✓' : ''}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em]">
                        {session.title}
                      </div>
                      <div className="mt-1 truncate text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        {session.metadata}
                      </div>
                    </div>
                    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-center text-[length:var(--font-size-ui-xs)] font-black">
                      {session.score}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="bg-[var(--bg-surface)]">
              <PanelHead title={queueTitle} count={String(queue.length).padStart(2, '0')} />
              <div className="grid gap-2 p-3">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className={`border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-2.5 ${
                      item.active ? 'bg-[#eef4ff]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em]">
                      <span>{item.title}</span>
                      <span className={`h-2 w-2 border border-[var(--border-color)] rounded-full ${
                        item.tone === 'green'
                          ? 'bg-[var(--color-status-success)]'
                          : item.tone === 'orange'
                            ? 'bg-[var(--color-chart-peak)]'
                            : 'bg-[var(--color-chart-blue)]'
                      }`} />
                    </div>
                    <div className="mt-1 text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {item.detail}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <aside className="bg-[var(--bg-surface)]">
          <PanelHead title={outputTitle} count="result" />
          <div className="space-y-3 p-3">
            <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
              <div className="flex items-center justify-between gap-2 border-b-2 border-[var(--border-color)] px-3 py-2">
                <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em]">
                  {metricsTitle}
                </div>
                <span className="text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {currentProjectLabel}
                </span>
              </div>
              <div className="grid grid-cols-2">
                {metrics.map((metric) => (
                  <div key={`${metric.label}-${metric.value}`} className="min-h-[70px] border-b border-r border-[var(--border-color)] p-3 last:border-b-0">
                    <div className="text-[length:var(--font-size-ui-2xl)] font-black leading-none">{metric.value}</div>
                    <div className="mt-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em]">
                      {metric.label}
                    </div>
                    <div className="mt-1 text-[length:var(--font-size-ui-3xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {metric.meta}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
              <div className="flex items-center justify-between gap-2 border-b-2 border-[var(--border-color)] px-3 py-2">
                <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em]">
                  {keywordsTitle}
                </div>
                <BarChart3 className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <div className="grid gap-2 p-3">
                {keywords.map((keyword) => (
                  <div key={keyword.term} className="grid grid-cols-[minmax(0,1fr)_42px] items-center gap-2">
                    <div className="truncate text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em]">
                      {keyword.term}
                    </div>
                    <div className="h-2 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-muted)]">
                      <div className="h-full bg-[var(--color-status-success)]" style={{ width: `${keyword.width}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)]">
              <div className="flex items-center justify-between gap-2 border-b-2 border-[var(--border-color)] px-3 py-2">
                <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em]">
                  {topicsTitle}
                </div>
                <span className="text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {sessions.length} sessions
                </span>
              </div>
              <div className="grid gap-2 p-3">
                {topics.map((topic) => (
                  <article key={topic.title} className="border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5">
                    <h4 className="truncate text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em]">
                      {topic.title}
                    </h4>
                    <p className="mt-1 text-[length:var(--font-size-ui-3xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
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
    <div className="flex min-h-11 items-center justify-between gap-3 border-b-2 border-[var(--border-color)] px-3 py-2">
      <div className="truncate text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em]">
        {title}
      </div>
      <span className="inline-flex min-w-7 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 py-0.5 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.16em]">
        {count}
      </span>
    </div>
  );
}
