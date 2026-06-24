import { AlertTriangle, CheckCircle2, ExternalLink, History, LoaderCircle } from 'lucide-react';
import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { FetchVendorStatusRSS } from '../../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import RefreshActionButton from '../../components/ui/RefreshActionButton';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import type { LocaleCode } from '../../types';
import { getVendorStatusPreviewModel, hasVendorStatusPreviewMode } from './previewData';
import { hasWailsRuntime } from '../../utils/previewMode';
import { persistVendorStatusCache, readVendorStatusCache } from './cache';
import {
  buildComponentImpactsURL,
  type VendorStatusComponentViewModel,
  buildVendorStatusViewModel,
  type VendorIncidentViewModel,
  type VendorStatusGroupViewModel,
  type VendorStatusKind,
  type VendorStatusPageViewModel,
} from './model';

interface VendorStatusState {
  status: 'loading' | 'ready' | 'error';
  data: VendorStatusPageViewModel | null;
  errorMessage: string;
  source: 'live' | 'cache' | 'preview';
}

const summaryURL = 'https://status.openai.com/proxy/status.openai.com';
const rssURL = 'https://status.openai.com/feed.rss';
const historyURL = 'https://status.openai.com/history';

const vendorStatusPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm';
const vendorStatusHeaderClass = 'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const vendorStatusMutedPanelClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const vendorStatusChipClass =
  'inline-flex rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 py-1 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]';
const vendorStatusSecondaryButtonClass =
  'inline-flex h-9 w-fit items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]';
const vendorStatusPrimaryButtonClass =
  'inline-flex h-9 w-fit items-center gap-2 rounded border border-[var(--gt-border-strong)] bg-[var(--gt-ink-primary)] px-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-surface-canvas)]';
const vendorStatusMetaClass = 'text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]';

function canUseVendorStatusRSSBridge() {
  if (typeof window === 'undefined') {
    return false;
  }

  const wailsBridge = (window as Window & {
    go?: {
      main?: {
        App?: {
          FetchVendorStatusRSS?: (url: string) => Promise<string>;
        };
      };
    };
  }).go;

  return typeof wailsBridge?.main?.App?.FetchVendorStatusRSS === 'function';
}

function loadVendorStatusRSS() {
  if (!canUseVendorStatusRSSBridge()) {
    return Promise.resolve('');
  }
  return FetchVendorStatusRSS(rssURL).catch(() => '');
}

function statusToneClasses(status: VendorStatusKind) {
  if (status === 'major_outage' || status === 'partial_outage') {
    return 'text-[var(--gt-status-danger)]';
  }
  if (status === 'degraded_performance' || status === 'maintenance') {
    return 'text-[var(--gt-status-warning)]';
  }
  return 'text-[var(--gt-status-success)]';
}

function StatusIcon({ status, className = 'h-6 w-6' }: { status: VendorStatusKind; className?: string }) {
  if (status === 'major_outage' || status === 'partial_outage' || status === 'degraded_performance' || status === 'maintenance') {
    return <AlertTriangle className={className} />;
  }
  return <CheckCircle2 className={className} />;
}

function statusSegmentClasses(status: VendorStatusKind) {
  if (status === 'major_outage' || status === 'partial_outage') {
    return 'bg-[var(--gt-status-danger)]';
  }
  if (status === 'degraded_performance' || status === 'maintenance') {
    return 'bg-[var(--gt-status-warning)]';
  }
  return 'bg-[var(--gt-status-success)]';
}

function openExternalURL(url: string) {
  if (hasWailsRuntime()) {
    BrowserOpenURL(url);
    return;
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function LeadIncidentCard({
  incident,
  publicUrl,
  t,
}: {
  incident: VendorIncidentViewModel | null;
  publicUrl: string;
  t: (key: string) => string;
}) {
  if (!incident) {
    return (
      <section data-vendor-status-summary="operational" className={`${vendorStatusPanelClass} overflow-hidden`}>
        <div className={`${vendorStatusHeaderClass} px-6 py-5`}>
          <div className="flex items-center gap-3 text-[var(--gt-ink-primary)]">
            <CheckCircle2 className="h-6 w-6" />
            <h3 className="text-[length:var(--gt-font-size-xl)] font-semibold text-[var(--gt-ink-primary)]">{t('vendor_status.summary_all_operational')}</h3>
          </div>
        </div>
        <div className="px-6 py-6">
          <p className="text-[length:var(--gt-font-size-sm)] leading-7 text-[var(--gt-ink-primary)]">
            {t('vendor_status.summary_no_incident')}
          </p>
          <div className="mt-5">
            <a href={publicUrl} target="_blank" rel="noreferrer" className={vendorStatusSecondaryButtonClass}>
              {t('vendor_status.open_official_status')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-vendor-status-summary="incident" className={`${vendorStatusPanelClass} overflow-hidden`}>
      <div className={`${vendorStatusHeaderClass} px-6 py-5`}>
        <div className="flex items-center gap-3 text-[var(--gt-ink-primary)]">
          <AlertTriangle className="h-6 w-6" />
          <h3 className="text-[length:var(--gt-font-size-xl)] font-semibold text-[var(--gt-ink-primary)]">{t('vendor_status.summary_active_issue')}</h3>
        </div>
      </div>
      <div className="border-b border-dashed border-[var(--gt-border-subtle)] px-6 py-5">
        <span className={vendorStatusChipClass}>
          {incident.scopeLabel || t('vendor_status.scope_fallback')}
        </span>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gt-ink-primary)]" />
          <div className="min-w-0">
            <h4 className="text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]">{incident.title}</h4>
            <p className="mt-4 whitespace-pre-line text-[length:var(--gt-font-size-xl-plus)] leading-8 text-[var(--gt-ink-primary)]">
              {incident.body || t('vendor_status.summary_incident_fallback')}
            </p>
            <p className="mt-6 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
              {incident.publishedLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SystemStatusRow({
  group,
  locale,
}: {
  group: VendorStatusGroupViewModel;
  locale: LocaleCode;
}) {
  const componentCountLabel =
    locale === 'zh' ? `${group.componentCount} 个组件` : `${group.componentCount} components`;
  const [expanded, setExpanded] = useState(false);
  const canExpand = group.components.length > 0;

  const expandedRows = expanded ? group.components : [];

  return (
    <div className="grid gap-3 border-t border-[var(--gt-border-subtle)] px-5 py-5 first:border-t-0 md:grid-cols-[minmax(0,1fr)_10rem] md:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className={statusToneClasses(group.status)}>
            <StatusIcon status={group.status} className="h-5 w-5" />
          </span>
          <h4 className="text-[length:var(--gt-font-size-5xl)] font-semibold text-[var(--gt-ink-primary)] md:text-[length:var(--gt-font-size-2xl)]">{group.name}</h4>
          {canExpand ? (
            <Button
              size="small"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1.5 text-[length:var(--gt-font-size-lg)] font-normal text-[var(--gt-ink-muted)] transition-colors hover:text-[var(--gt-ink-primary)] md:text-[length:var(--gt-font-size-lg-compact)]"
            >
              <span>{componentCountLabel}</span>
              <svg
                className={`h-3.5 w-3.5 ${expanded ? 'rotate-180' : 'rotate-0'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </Button>
          ) : (
            <span className="text-[length:var(--gt-font-size-lg)] font-normal text-[var(--gt-ink-muted)] md:text-[length:var(--gt-font-size-lg-compact)]">
              {componentCountLabel}
            </span>
          )}
        </div>
        {expanded ? (
          <div className="mt-3 border-t border-[var(--gt-border-subtle)]">
            {expandedRows.map((component, index) => (
              <ExpandedComponentRow
                key={component.id}
                component={component}
                isFirst={index === 0}
              />
            ))}
          </div>
        ) : (
          <div className="mt-3.5 flex gap-[4px] overflow-hidden">
            {group.segments.map((segment) => (
              <div
                key={`${group.id}-${segment.dayKey}`}
                className={`h-7 min-w-0 flex-1 ${statusSegmentClasses(segment.status)}`}
                title={`${group.name} · ${segment.dayKey} · ${segment.status}`}
              />
            ))}
          </div>
        )}
      </div>
      <div className="text-left md:text-right">
        <p className="text-[length:var(--gt-font-size-xl-plus)] font-normal text-[var(--gt-ink-muted)] md:text-[length:var(--gt-font-size-lg)]">{group.uptimeLabel}</p>
      </div>
    </div>
  );
}

function ExpandedComponentRow({
  component,
  isFirst,
}: {
  component: VendorStatusComponentViewModel;
  isFirst: boolean;
}) {
  return (
    <div className={`px-0 py-4 ${isFirst ? '' : 'border-t border-[var(--gt-border-subtle)]'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={statusToneClasses(component.status)}>
            <StatusIcon status={component.status} className="h-4.5 w-4.5" />
          </span>
          <h5 className="truncate text-[length:var(--gt-font-size-2xl)] font-normal text-[var(--gt-ink-primary)] md:text-[length:var(--gt-font-size-xl-plus)]">{component.name}</h5>
        </div>
        <p className="shrink-0 text-[length:var(--gt-font-size-2xl)] font-normal text-[var(--gt-ink-muted)] md:text-[length:var(--gt-font-size-xl-plus)]">{component.uptimeLabel}</p>
      </div>
      <div className="mt-3 flex gap-[4px] overflow-hidden">
        {component.segments.map((segment) => (
          <div
            key={`${component.id}-${segment.dayKey}`}
            className={`h-7 min-w-0 flex-1 ${statusSegmentClasses(segment.status)}`}
            title={`${component.name} · ${segment.dayKey} · ${segment.status}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function VendorStatusFeature() {
  const { locale, t } = useI18n();
  const initialCachedData = readVendorStatusCache(typeof window === 'undefined' ? null : window.localStorage, locale);
  const [refreshToken, setRefreshToken] = useState(0);
  const [state, setState] = useState<VendorStatusState>({
    status: 'loading',
    data: initialCachedData,
    errorMessage: '',
    source: initialCachedData ? 'cache' : 'live',
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadStatus() {
      if (refreshToken === 0) {
        const cachedData = readVendorStatusCache(typeof window === 'undefined' ? null : window.localStorage, locale);
        if (cachedData) {
          setState({
            status: 'ready',
            data: cachedData,
            errorMessage: '',
            source: 'cache',
          });
          return;
        }
      }

      setState((current) => ({
        status: current.data ? 'ready' : 'loading',
        data: current.data,
        errorMessage: '',
        source: current.source,
      }));

      try {
        if (hasVendorStatusPreviewMode()) {
          if (!controller.signal.aborted) {
            setState({
              status: 'ready',
              data: getVendorStatusPreviewModel(locale),
              errorMessage: '',
              source: 'preview',
            });
          }
          return;
        }

        const now = new Date();
        const [summaryResponse, impactsResponse] = await Promise.all([
          fetch(summaryURL, { signal: controller.signal }),
          fetch(buildComponentImpactsURL(now), { signal: controller.signal }),
        ]);
        const rssPromise = loadVendorStatusRSS();

        if (!summaryResponse.ok) {
          throw new Error(`summary ${summaryResponse.status}`);
        }
        if (!impactsResponse.ok) {
          throw new Error(`component impacts ${impactsResponse.status}`);
        }

        const [summaryPayload, impactsPayload, rssXML] = await Promise.all([
          summaryResponse.json(),
          impactsResponse.json(),
          rssPromise,
        ]);
        const data = buildVendorStatusViewModel(summaryPayload, impactsPayload, rssXML, now, locale);
        persistVendorStatusCache(typeof window === 'undefined' ? null : window.localStorage, {
          summaryPayload,
          impactsPayload,
          rssXML,
          fetchedAt: now,
        });

        if (!controller.signal.aborted) {
          setState({
            status: 'ready',
            data,
            errorMessage: '',
            source: 'live',
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setState({
          status: 'error',
          data: null,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          source: 'live',
        });
      }
    }

    void loadStatus();
    return () => controller.abort();
  }, [locale, refreshToken]);

  const data = state.data;
  const sourceLabel =
    state.source === 'cache'
      ? t('vendor_status.source_cache')
      : state.source === 'preview'
        ? t('vendor_status.source_preview')
        : t('vendor_status.source_live');

  return (
    <div data-vendor-status-shell="true" className="h-full overflow-y-auto bg-[var(--gt-surface-muted)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6 md:px-8">
        <WorkspacePageHeader
          title={t('vendor_status.title')}
          subtitle={t('vendor_status.subtitle')}
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <RefreshActionButton
                onClick={() => setRefreshToken((current) => current + 1)}
                label={t('vendor_status.refresh')}
                className="!text-[length:var(--gt-font-size-xs)]"
              />
              <a
                href={data?.subscribeUrl || 'https://status.openai.com/'}
                target="_blank"
                rel="noreferrer"
                className={vendorStatusPrimaryButtonClass}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('vendor_status.subscribe')}
              </a>
              <Button
                size="small"
                onClick={() => openExternalURL(data?.publicUrl || 'https://status.openai.com/')}
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                className={vendorStatusSecondaryButtonClass}
              >
                {t('vendor_status.open_official_status')}
              </Button>
              <Button
                size="small"
                onClick={() => openExternalURL(data?.historyUrl || historyURL)}
                icon={<History className="h-3.5 w-3.5" />}
                className={vendorStatusSecondaryButtonClass}
              >
                {t('vendor_status.view_history')}
              </Button>
            </div>
          }
        />

        {state.status === 'loading' && !data ? (
          <section className={`${vendorStatusPanelClass} flex min-h-[16rem] items-center justify-center gap-3 text-[var(--gt-ink-muted)]`}>
            <LoaderCircle className="h-5 w-5" />
            <span className="text-[length:var(--gt-font-size-sm)] font-normal">{t('vendor_status.loading')}</span>
          </section>
        ) : null}

        {state.status === 'error' ? (
          <section className={`${vendorStatusMutedPanelClass} p-6`}>
            <p className="text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)]">{t('vendor_status.fetch_failed')}</p>
            <p className="mt-3 text-[length:var(--gt-font-size-sm)] leading-7 text-[var(--gt-ink-primary)]">{state.errorMessage}</p>
            <p className="mt-3 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
              {t('vendor_status.fetch_failed_hint')}
            </p>
          </section>
        ) : null}

        {data ? (
          <>
            <div className={`grid gap-3 md:grid-cols-3 ${vendorStatusMetaClass}`}>
              <span>{data.vendorName} · {sourceLabel}</span>
              <span className="md:text-center">{t('vendor_status.feed_updated')} {data.feedUpdatedLabel}</span>
              <span className="md:text-right">{t('vendor_status.last_sync')} {data.lastSyncLabel}</span>
            </div>

            <LeadIncidentCard incident={data.leadIncident} publicUrl={data.publicUrl} t={t} />

            <section data-vendor-status-matrix="true" className={`${vendorStatusPanelClass} overflow-hidden`}>
              <div className={`${vendorStatusHeaderClass} flex flex-col gap-3 px-5 py-5 md:flex-row md:items-end md:justify-between`}>
                <div className="min-w-0">
                  <p className="text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                    {t('vendor_status.live_uptime_matrix')}
                  </p>
                  <h3 className="mt-2 text-[length:var(--gt-font-size-2xl)] font-semibold text-[var(--gt-ink-primary)]">
                    {t('vendor_status.system_status')}
                  </h3>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[length:var(--gt-font-size-md)] font-normal text-[var(--gt-ink-muted)]">
                    {data.historyRangeLabel}
                  </p>
                  <p className="mt-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
                    {locale === 'zh'
                      ? `当前 ${data.activeIncidentCount} 个进行中事件`
                      : `${data.activeIncidentCount} active incident${data.activeIncidentCount === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>
              <div>
                {data.groups.map((group) => (
                  <SystemStatusRow key={group.id} group={group} locale={locale} />
                ))}
              </div>
            </section>

          </>
        ) : null}
      </div>
    </div>
  );
}
