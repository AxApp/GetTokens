import { useEffect, useState, type MouseEvent } from 'react';
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
  { label: 'Panel', var: '--gt-surface-panel' },
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
        className="h-10 w-10 shrink-0 rounded border"
        style={{ backgroundColor: value, borderColor: 'var(--gt-border-default)' }}
      />
      <div className="min-w-0">
        <div className="text-xs font-medium" style={{ color: 'var(--gt-ink-primary)' }}>{label}</div>
        <div className="text-xs" style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}>{value}</div>
      </div>
    </div>
  );
}

function RadiusSwatch({ label, varName }: { label: string; varName: string }) {
  const value = useTokenValue(varName);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-12 w-12 border"
        style={{ borderRadius: value, backgroundColor: 'var(--gt-surface-raised)', borderColor: 'var(--gt-border-default)' }}
      />
      <div className="text-center">
        <div className="text-xs font-medium" style={{ color: 'var(--gt-ink-primary)' }}>{label}</div>
        <div className="text-xs" style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}>{value}</div>
      </div>
    </div>
  );
}

function ElevationSwatch({ label, varName }: { label: string; varName: string }) {
  const value = useTokenValue(varName);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-16 w-24 rounded-lg"
        style={{ boxShadow: value || 'none', backgroundColor: 'var(--gt-surface-raised)', border: '1px solid var(--gt-border-subtle)' }}
      />
      <div className="text-center">
        <div className="text-xs font-medium" style={{ color: 'var(--gt-ink-primary)' }}>{label}</div>
        <div className="max-w-[10rem] break-all text-center text-xs" style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}>{value || 'none'}</div>
      </div>
    </div>
  );
}

/* ─── Anatomy previews ─── */

function AnatomySettingsRow() {
  return (
    <div className="parchment-settings-row" style={{ border: '1px solid var(--gt-border-subtle)', borderRadius: 'var(--gt-radius-md)', backgroundColor: 'var(--gt-surface-raised)' }}>
      <div className="min-w-0 flex-1">
        <div className="parchment-settings-row-label">Setting Label</div>
        <div className="parchment-settings-row-description">Description text for this setting</div>
      </div>
      <div className="parchment-settings-row-control">
        <div className="h-5 w-9 rounded-full" style={{ backgroundColor: 'var(--gt-status-success)' }} />
      </div>
    </div>
  );
}

function AnatomySectionCard() {
  return (
    <div className="parchment-section-card">
      <div className="parchment-section-card-header">
        <span className="parchment-section-card-header-title">Section Title</span>
      </div>
      <div className="parchment-section-card-body text-sm" style={{ color: 'var(--gt-ink-secondary)' }}>
        Card body content goes here.
      </div>
    </div>
  );
}

function AnatomyMetricTile() {
  return (
    <div className="parchment-metric-tile">
      <div className="parchment-metric-tile-label">Spend</div>
      <div className="parchment-metric-tile-value">$12.40</div>
      <div className="parchment-metric-tile-delta parchment-metric-tile-delta-success">+2.1%</div>
    </div>
  );
}

function AnatomyStatusPill() {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="parchment-status-pill parchment-status-pill-healthy">Healthy</span>
      <span className="parchment-status-pill parchment-status-pill-degraded">Degraded</span>
      <span className="parchment-status-pill parchment-status-pill-error">Error</span>
      <span className="parchment-status-pill parchment-status-pill-info">Info</span>
      <span className="parchment-status-pill parchment-status-pill-neutral">Neutral</span>
    </div>
  );
}

function AnatomyToolbar() {
  return (
    <div className="parchment-toolbar" style={{ height: 'auto', padding: '0.5rem 1rem' }}>
      <div className="parchment-toolbar-search" style={{ maxWidth: '12rem', height: '28px' }}>Search…</div>
      <div className="parchment-toolbar-action-primary" style={{ minHeight: '28px', padding: '0 0.75rem', fontSize: '11px' }}>New</div>
      <div className="parchment-toolbar-action-secondary" style={{ minHeight: '28px', padding: '0 0.75rem', fontSize: '11px' }}>Export</div>
    </div>
  );
}

function AnatomyTabs() {
  return (
    <div className="parchment-tabs">
      <button type="button" className="parchment-tab">Overview</button>
      <button type="button" className="parchment-tab parchment-tab-active">Details</button>
      <button type="button" className="parchment-tab">History</button>
    </div>
  );
}

function AnatomyModalShell() {
  return (
    <div className="parchment-detail-modal-shell" style={{ width: '100%', maxHeight: '10rem', position: 'relative' }}>
      <div className="parchment-detail-modal-header">
        <span className="text-sm font-semibold" style={{ color: 'var(--gt-ink-primary)' }}>Detail Modal</span>
        <span className="text-xs" style={{ color: 'var(--gt-ink-muted)' }}>✕</span>
      </div>
      <div className="parchment-detail-modal-body text-xs" style={{ color: 'var(--gt-ink-secondary)' }}>
        Modal body content area. Supports 2-column grid layout on wide screens.
      </div>
      <div className="parchment-detail-modal-footer">
        <div className="parchment-toolbar-action-secondary" style={{ minHeight: '24px', padding: '0 0.5rem', fontSize: '11px' }}>Cancel</div>
        <div className="parchment-toolbar-action-primary" style={{ minHeight: '24px', padding: '0 0.5rem', fontSize: '11px' }}>Save</div>
      </div>
    </div>
  );
}

const ANATOMY_ITEMS = [
  { name: 'parchment-settings-row', desc: '设置行：label + description + control', preview: <AnatomySettingsRow /> },
  { name: 'parchment-section-card', desc: '分区卡片：header + body', preview: <AnatomySectionCard /> },
  { name: 'parchment-metric-tile', desc: '指标卡：label + value + delta', preview: <AnatomyMetricTile /> },
  { name: 'parchment-status-pill', desc: '状态胶囊：5 种语义状态', preview: <AnatomyStatusPill /> },
  { name: 'parchment-toolbar', desc: '工具栏：search + actions', preview: <AnatomyToolbar /> },
  { name: 'parchment-tabs', desc: '下划线 tab：active 用 accent underline', preview: <AnatomyTabs /> },
  { name: 'parchment-detail-modal-shell', desc: '详情弹窗：overlay + shell + header/body/footer', preview: <AnatomyModalShell /> },
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

  function openExternalURL(event: MouseEvent<HTMLAnchorElement>, url: string) {
    event.preventDefault();
    if (hasWailsRuntime()) {
      BrowserOpenURL(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="h-full overflow-auto text-[var(--text-primary)]"
      style={{ backgroundColor: 'var(--gt-surface-canvas)', padding: '1.75rem 2rem' }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <WorkspacePageHeader
          title={t('design_system.title')}
          subtitle={t('design_system.subtitle')}
          actions={
            <div className="flex flex-wrap gap-2">
              <a
                className="parchment-toolbar-action-primary"
                style={{ minHeight: 'auto', padding: '0.5rem 1rem', fontSize: '12px', textDecoration: 'none' }}
                href={storybookOpenURL}
                onClick={(event) => openExternalURL(event, storybookOpenURL)}
                target="_blank"
                rel="noreferrer"
              >
                {t('design_system.open_storybook')}
              </a>
              {showDevWebOpen ? (
                <>
                  <a
                    className="parchment-toolbar-action-secondary"
                    style={{ minHeight: 'auto', padding: '0.5rem 1rem', fontSize: '12px', textDecoration: 'none' }}
                    href={inspectOpenURL}
                    onClick={(event) => openExternalURL(event, inspectOpenURL)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('design_system.inspect_elements')}
                  </a>
                  <a
                    className="parchment-toolbar-action-secondary"
                    style={{ minHeight: 'auto', padding: '0.5rem 1rem', fontSize: '12px', textDecoration: 'none' }}
                    href={viteOpenURL}
                    onClick={(event) => openExternalURL(event, viteOpenURL)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('design_system.open_5173_web')}
                  </a>
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
          <div className="settings-group" style={{ padding: '1.25rem' }}>
            <h3 className="mb-3 text-xs font-semibold" style={{ color: 'var(--gt-ink-secondary)' }}>Color</h3>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {COLOR_TOKENS.map((token) => (
                <ColorSwatch key={token.var} label={token.label} varName={token.var} />
              ))}
            </div>

            <h3 className="mb-3 text-xs font-semibold" style={{ color: 'var(--gt-ink-secondary)' }}>Radius</h3>
            <div className="mb-6 flex flex-wrap gap-5">
              {RADIUS_TOKENS.map((token) => (
                <RadiusSwatch key={token.var} label={token.label} varName={token.var} />
              ))}
            </div>

            <h3 className="mb-3 text-xs font-semibold" style={{ color: 'var(--gt-ink-secondary)' }}>Elevation</h3>
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
          <div className="settings-group" style={{ padding: '1.25rem' }}>
            <div className="grid gap-4">
              {ANATOMY_ITEMS.map((item) => (
                <div key={item.name} style={{ borderTop: '1px solid var(--gt-border-subtle)', paddingTop: '1rem' }}>
                  <div className="mb-1 flex items-baseline gap-2">
                    <code className="text-xs font-semibold" style={{ color: 'var(--gt-accent-primary)', fontFamily: 'var(--gt-font-family-mono)' }}>
                      .{item.name}
                    </code>
                    <span className="text-xs" style={{ color: 'var(--gt-ink-muted)' }}>{item.desc}</span>
                  </div>
                  <div style={{ paddingTop: '0.5rem' }}>{item.preview}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── State Matrix ── */}
        <section>
          <h2 className="settings-section-title">State Matrix</h2>
          <div className="settings-group" style={{ overflow: 'hidden' }}>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gt-border-subtle)' }}>
                  <th className="px-4 py-2 text-left font-semibold" style={{ color: 'var(--gt-ink-secondary)' }}>Component</th>
                  {STATE_COLUMNS.map((col) => (
                    <th key={col} className="px-4 py-2 text-center font-semibold" style={{ color: 'var(--gt-ink-secondary)' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STATE_MATRIX.map((row) => (
                  <tr key={row.component} style={{ borderBottom: '1px solid var(--gt-border-subtle)' }}>
                    <td className="px-4 py-2 font-medium" style={{ color: 'var(--gt-ink-primary)', fontFamily: 'var(--gt-font-family-mono)' }}>
                      {row.component}
                    </td>
                    {STATE_COLUMNS.map((col) => (
                      <td key={col} className="px-4 py-2 text-center">
                        {row.states[col] ? (
                          <span className="inline-block h-4 w-4 rounded-sm" style={{ backgroundColor: 'var(--gt-status-success)', opacity: 0.7 }} />
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--gt-ink-muted)' }}>—</span>
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
              <div key={group.id} className="settings-group" style={{ overflow: 'hidden' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--gt-border-subtle)' }}>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--gt-ink-primary)' }}>{group.title}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--gt-ink-muted)' }}>{group.description}</span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}>
                      {group.stories.length}
                    </span>
                  </div>
                </div>
                <div>
                  {group.stories.map((story) => (
                    <div
                      key={story.id}
                      className="flex items-baseline justify-between px-4 py-2"
                      style={{ borderBottom: '1px solid var(--gt-border-subtle)' }}
                    >
                      <span className="text-xs font-medium" style={{ color: 'var(--gt-ink-primary)' }}>{story.title}</span>
                      <span className="truncate text-xs" style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)', maxWidth: '60%' }}>
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
    <div className="parchment-metric-tile">
      <div className="parchment-metric-tile-label">{label}</div>
      <div className="parchment-metric-tile-value">{value}</div>
    </div>
  );
}
