import { useEffect, useState, type MouseEvent } from 'react';
import { Button, Card, Input, Segmented, Switch, Tag } from 'antd';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import { hasWailsRuntime } from '../../utils/previewMode';
import {
  DESIGN_SYSTEM_SCREENSHOT_PATH,
  DESIGN_SYSTEM_STORYBOOK_COMMAND,
  DESIGN_SYSTEM_STORYBOOK_URL,
  designSystemStoryGroups,
  getDesignSystemStoryStats,
  resolveDesignSystemInspectOpenURL,
  resolveDesignSystemStorybookOpenURL,
  resolveDesignSystemViteOpenURL,
  resolveDesignSystemWebOpenURL,
} from './storyCatalog';

/* ─── Token reading ─── */

const COLOR_TOKENS = [
  { label: 'Canvas', var: '--gt-surface-canvas' },
  { label: 'Raised', var: '--gt-surface-raised' },
  { label: 'Muted', var: '--gt-surface-muted' },
  { label: 'Inverse', var: '--gt-surface-inverse' },
  { label: 'Ink Primary', var: '--gt-ink-primary' },
  { label: 'Ink Secondary', var: '--gt-ink-secondary' },
  { label: 'Ink Muted', var: '--gt-ink-muted' },
  { label: 'Border Subtle', var: '--gt-border-subtle' },
  { label: 'Border Default', var: '--gt-border-default' },
  { label: 'Border Strong', var: '--gt-border-strong' },
  { label: 'Focus Ring', var: '--gt-focus-ring' },
  { label: 'Accent Primary', var: '--gt-accent-primary' },
  { label: 'Accent Hover', var: '--gt-accent-hover' },
  { label: 'Status Success', var: '--gt-status-success' },
  { label: 'Status Warning', var: '--gt-status-warning' },
  { label: 'Status Danger', var: '--gt-status-danger' },
  { label: 'Status Info', var: '--gt-status-info' },
];

const RADIUS_TOKENS = [
  { label: 'xs', var: '--gt-radius-xs' },
  { label: 'sm', var: '--gt-radius-sm' },
  { label: 'md', var: '--gt-radius-md' },
  { label: 'lg', var: '--gt-radius-lg' },
  { label: 'pill', var: '--gt-radius-pill' },
];

const ELEVATION_TOKENS = [
  { label: 'flat', var: '--gt-elevation-flat' },
  { label: 'raised-1', var: '--gt-elevation-raised-1' },
  { label: 'raised-2', var: '--gt-elevation-raised-2' },
  { label: 'raised-3', var: '--gt-elevation-raised-3' },
];

function useTokenValue(varName: string): string {
  const [value, setValue] = useState('');
  useEffect(() => {
    const el = document.documentElement;
    const computed = getComputedStyle(el).getPropertyValue(varName).trim();
    setValue(computed);
  }, [varName]);
  return value;
}

function ColorSwatch({ label, varName }: { label: string; varName: string }) {
  const value = useTokenValue(varName);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 shrink-0 rounded border border-[var(--gt-border-default)]"
        style={{ backgroundColor: value }}
      />
      <div className="min-w-0">
        <div className="text-xs font-normal text-[var(--gt-ink-primary)]">{label}</div>
        <div className="font-mono text-xs text-[var(--gt-ink-muted)]">{value}</div>
      </div>
    </div>
  );
}

function RadiusSwatch({ label, varName }: { label: string; varName: string }) {
  const value = useTokenValue(varName);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-12 w-12 border border-[var(--gt-border-default)] bg-[var(--gt-surface-raised)]"
        style={{ borderRadius: value }}
      />
      <div className="text-center">
        <div className="text-xs font-normal text-[var(--gt-ink-primary)]">{label}</div>
        <div className="font-mono text-xs text-[var(--gt-ink-muted)]">{value}</div>
      </div>
    </div>
  );
}

function ElevationSwatch({ label, varName }: { label: string; varName: string }) {
  const value = useTokenValue(varName);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-16 w-24 rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)]"
        style={{ boxShadow: value || 'none' }}
      />
      <div className="text-center">
        <div className="text-xs font-normal text-[var(--gt-ink-primary)]">{label}</div>
        <div className="max-w-[10rem] break-all text-center font-mono text-xs text-[var(--gt-ink-muted)]">{value || 'none'}</div>
      </div>
    </div>
  );
}

/* ─── Anatomy previews ─── */

function AnatomySettingsRow() {
  return (
    <div className="flex items-center justify-between gap-4 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[length:var(--gt-font-size-body)] font-semibold text-[var(--gt-ink-primary)]">Setting Label</div>
        <div className="mt-1 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">Description text for this setting</div>
      </div>
      <Switch defaultChecked />
    </div>
  );
}

function AnatomySectionCard() {
  return (
    <Card size="small" title="Section Title">
      <div className="text-sm text-[var(--gt-ink-secondary)]">
        Card body content goes here.
      </div>
    </Card>
  );
}

function AnatomyMetricTile() {
  return (
    <div className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] p-4">
      <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">Spend</div>
      <div className="mt-1 text-[length:var(--gt-font-size-number)] font-semibold text-[var(--gt-ink-primary)]">$12.40</div>
      <div className="mt-2 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-success)]">+2.1%</div>
    </div>
  );
}

function AnatomyStatusPill() {
  return (
    <div className="flex flex-wrap gap-2">
      <Tag color="success">Healthy</Tag>
      <Tag color="warning">Degraded</Tag>
      <Tag color="error">Error</Tag>
      <Tag color="processing">Info</Tag>
      <Tag>Neutral</Tag>
    </div>
  );
}

function AnatomyToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-2">
      <Input size="small" placeholder="Search…" className="max-w-[12rem]" />
      <Button size="small" type="primary">New</Button>
      <Button size="small">Export</Button>
    </div>
  );
}

function AnatomyTabs() {
  return (
    <Segmented
      size="small"
      defaultValue="details"
      options={[
        { label: 'Overview', value: 'overview' },
        { label: 'Details', value: 'details' },
        { label: 'History', value: 'history' },
      ]}
    />
  );
}

function AnatomyModalShell() {
  return (
    <Card
      size="small"
      title="Detail Modal"
      extra={<span className="text-xs text-[var(--gt-ink-muted)]">✕</span>}
      className="relative w-full"
    >
      <div className="text-xs text-[var(--gt-ink-secondary)]">
        Modal body content area. Supports 2-column grid layout on wide screens.
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="small">Cancel</Button>
        <Button size="small" type="primary">Save</Button>
      </div>
    </Card>
  );
}

const ANATOMY_ITEMS = [
  { name: 'antd-settings-row', desc: '设置行：AntD Switch + gt token layout', preview: <AnatomySettingsRow /> },
  { name: 'antd-card', desc: '分区卡片：AntD Card header + body', preview: <AnatomySectionCard /> },
  { name: 'gt-metric-tile', desc: '指标卡：gt token surface + semantic delta', preview: <AnatomyMetricTile /> },
  { name: 'antd-tag', desc: '状态标签：AntD Tag 语义状态', preview: <AnatomyStatusPill /> },
  { name: 'antd-toolbar', desc: '工具栏：AntD Input + Button', preview: <AnatomyToolbar /> },
  { name: 'antd-segmented', desc: '分段切换：AntD Segmented', preview: <AnatomyTabs /> },
  { name: 'antd-modal-shell', desc: '详情弹窗骨架：AntD Card/Button preview', preview: <AnatomyModalShell /> },
];

/* ─── State matrix ─── */

const STATE_MATRIX = [
  { component: 'settings-row', states: { default: true, hover: true, active: false, disabled: true, error: true } },
  { component: 'section-card', states: { default: true, hover: false, active: false, disabled: false, error: false } },
  { component: 'metric-tile', states: { default: true, hover: false, active: false, disabled: false, error: true } },
  { component: 'status-pill', states: { default: true, hover: false, active: false, disabled: true, error: true } },
  { component: 'toolbar', states: { default: true, hover: false, active: false, disabled: false, error: false } },
  { component: 'tabs', states: { default: true, hover: true, active: true, disabled: true, error: false } },
  { component: 'detail-modal', states: { default: true, hover: false, active: false, disabled: false, error: false } },
  { component: 'app-shell', states: { default: true, hover: false, active: false, disabled: false, error: false } },
];

const STATE_COLUMNS = ['default', 'hover', 'active', 'disabled', 'error'] as const;

/* ─── Main component ─── */

export default function DesignSystemEntryFeature() {
  const { t } = useI18n();
  const stats = getDesignSystemStoryStats();
  const storybookOpenURL = resolveDesignSystemStorybookOpenURL({
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  });
  const webOpenURL = resolveDesignSystemWebOpenURL({
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  });
  const viteOpenURL = resolveDesignSystemViteOpenURL({
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  });
  const inspectOpenURL = resolveDesignSystemInspectOpenURL({
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  });
  const showDevWebOpen = import.meta.env.DEV;

  function openExternalURL(event: MouseEvent<HTMLElement>, url: string) {
    event.preventDefault();
    if (hasWailsRuntime()) {
      BrowserOpenURL(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="h-full overflow-auto bg-[var(--gt-surface-canvas)] px-8 py-7 text-[var(--gt-ink-primary)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <WorkspacePageHeader
          title={t('design_system.title')}
          subtitle={t('design_system.subtitle')}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="primary"
                href={storybookOpenURL}
                onClick={(event) => openExternalURL(event, storybookOpenURL)}
                target="_blank"
                rel="noreferrer"
              >
                {t('design_system.open_storybook')}
              </Button>
              {showDevWebOpen ? (
                <>
                  <Button
                    href={inspectOpenURL}
                    onClick={(event) => openExternalURL(event, inspectOpenURL)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('design_system.inspect_elements')}
                  </Button>
                  <Button
                    href={viteOpenURL}
                    onClick={(event) => openExternalURL(event, viteOpenURL)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('design_system.open_5173_web')}
                  </Button>
                </>
              ) : null}
            </div>
          }
        />

        {/* ── Coverage metrics ── */}
        <section className="grid grid-cols-2 gap-3">
          <MetricTile label={t('design_system.groups')} value={stats.groupCount} />
          <MetricTile label={t('design_system.stories')} value={stats.storyCount} />
        </section>

        {/* ── Token Swatches ── */}
        <section>
          <h2 className="settings-section-title">Token Contract</h2>
          <div className="settings-group p-5">
            <h3 className="mb-3 text-xs font-semibold text-[var(--gt-ink-secondary)]">Color</h3>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {COLOR_TOKENS.map((token) => (
                <ColorSwatch key={token.var} label={token.label} varName={token.var} />
              ))}
            </div>

            <h3 className="mb-3 text-xs font-semibold text-[var(--gt-ink-secondary)]">Radius</h3>
            <div className="mb-6 flex flex-wrap gap-5">
              {RADIUS_TOKENS.map((token) => (
                <RadiusSwatch key={token.var} label={token.label} varName={token.var} />
              ))}
            </div>

            <h3 className="mb-3 text-xs font-semibold text-[var(--gt-ink-secondary)]">Elevation</h3>
            <div className="flex flex-wrap gap-5">
              {ELEVATION_TOKENS.map((token) => (
                <ElevationSwatch key={token.var} label={token.label} varName={token.var} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Component Anatomy ── */}
        <section>
          <h2 className="settings-section-title">Component Anatomy</h2>
          <div className="settings-group p-5">
            <div className="grid gap-4">
              {ANATOMY_ITEMS.map((item) => (
                <div key={item.name} className="border-t border-[var(--gt-border-subtle)] pt-4">
                  <div className="mb-1 flex items-baseline gap-2">
                    <code className="font-mono text-xs font-semibold text-[var(--gt-accent-primary)]">
                      .{item.name}
                    </code>
                    <span className="text-xs text-[var(--gt-ink-muted)]">{item.desc}</span>
                  </div>
                  <div className="pt-2">{item.preview}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── State Matrix ── */}
        <section>
          <h2 className="settings-section-title">State Matrix</h2>
          <div className="settings-group overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--gt-border-subtle)]">
                  <th className="px-4 py-2 text-left font-semibold text-[var(--gt-ink-secondary)]">Component</th>
                  {STATE_COLUMNS.map((col) => (
                    <th key={col} className="px-4 py-2 text-center font-semibold text-[var(--gt-ink-secondary)]">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STATE_MATRIX.map((row) => (
                  <tr key={row.component} className="border-b border-[var(--gt-border-subtle)]">
                    <td className="px-4 py-2 font-mono font-normal text-[var(--gt-ink-primary)]">
                      {row.component}
                    </td>
                    {STATE_COLUMNS.map((col) => (
                      <td key={col} className="px-4 py-2 text-center">
                        {row.states[col] ? (
                          <span className="inline-block h-4 w-4 rounded-sm bg-[var(--gt-status-success)] opacity-70" />
                        ) : (
                          <span className="text-xs text-[var(--gt-ink-muted)]">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Story Groups ── */}
        <section>
          <h2 className="settings-section-title">Story Catalog</h2>
          <div className="grid gap-4">
            {designSystemStoryGroups.map((group) => (
              <div key={group.id} className="settings-group overflow-hidden">
                <div className="border-b border-[var(--gt-border-subtle)] px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-sm font-semibold text-[var(--gt-ink-primary)]">{group.title}</span>
                      <span className="ml-2 text-xs text-[var(--gt-ink-muted)]">{group.description}</span>
                    </div>
                    <span className="font-mono text-xs text-[var(--gt-ink-muted)]">
                      {group.stories.length}
                    </span>
                  </div>
                </div>
                <div>
                  {group.stories.map((story) => (
                    <div
                      key={story.id}
                      className="flex items-baseline justify-between border-b border-[var(--gt-border-subtle)] px-4 py-2"
                    >
                      <span className="text-xs font-normal text-[var(--gt-ink-primary)]">{story.title}</span>
                      <span className="max-w-[60%] truncate font-mono text-xs text-[var(--gt-ink-muted)]">
                        {story.storybookTitle}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] p-4">
      <div className="text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">{label}</div>
      <div className="mt-1 text-[length:var(--gt-font-size-number)] font-semibold text-[var(--gt-ink-primary)]">{value}</div>
    </div>
  );
}
