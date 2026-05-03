import { AlertTriangle, CheckCircle2, ExternalLink, History, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FetchVendorStatusRSS } from '../../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
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
    return 'text-[#d92d20]';
  }
  if (status === 'degraded_performance' || status === 'maintenance') {
    return 'text-[#d4a017]';
  }
  return 'text-[#10b981]';
}

function StatusIcon({ status, className = 'h-6 w-6' }: { status: VendorStatusKind; className?: string }) {
  if (status === 'major_outage' || status === 'partial_outage' || status === 'degraded_performance' || status === 'maintenance') {
    return <AlertTriangle className={className} />;
  }
  return <CheckCircle2 className={className} />;
}

function statusSegmentClasses(status: VendorStatusKind) {
  if (status === 'major_outage' || status === 'partial_outage') {
    return 'bg-[#ff6b57]';
  }
  if (status === 'degraded_performance' || status === 'maintenance') {
    return 'bg-[#ffbe2e]';
  }
  return 'bg-[#33c49f]';
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

function HeroIncidentCard({
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
      <section className="card-swiss !p-0">
        <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-5">
          <div className="flex items-center gap-3 text-[var(--text-primary)]">
            <CheckCircle2 className="h-6 w-6" />
            <h3 className="text-xl font-black uppercase italic tracking-tight">{t('vendor_status.hero_all_operational')}</h3>
          </div>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm leading-7 text-[var(--text-primary)]">
            {t('vendor_status.hero_no_incident')}
          </p>
          <div className="mt-5">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-swiss w-fit !px-3 !py-2 !text-[0.5625rem]">
              {t('vendor_status.open_official_status')}
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card-swiss !p-0">
      <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-5">
        <div className="flex items-center gap-3 text-[var(--text-primary)]">
          <AlertTriangle className="h-6 w-6" />
          <h3 className="text-xl font-black uppercase italic tracking-tight">{t('vendor_status.hero_active_issue')}</h3>
        </div>
      </div>
      <div className="border-b border-dashed border-[var(--border-color)] px-6 py-5">
        <span className="inline-flex border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-black uppercase tracking-tight text-[var(--text-primary)] shadow-[4px_4px_0_var(--shadow-color)]">
          {incident.scopeLabel || t('vendor_status.scope_fallback')}
        </span>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-primary)]" />
          <div className="min-w-0">
            <h4 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">{incident.title}</h4>
            <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-8 text-[var(--text-primary)]">
              {incident.body || t('vendor_status.hero_incident_fallback')}
            </p>
            <p className="mt-6 text-[0.625rem] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
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
    <div className="grid gap-3 border-t border-[rgba(0,0,0,0.12)] px-5 py-5 first:border-t-0 md:grid-cols-[minmax(0,1fr)_10rem] md:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className={statusToneClasses(group.status)}>
            <StatusIcon status={group.status} className="h-5 w-5" />
          </span>
          <h4 className="text-[1.625rem] font-semibold tracking-tight text-[var(--text-primary)] md:text-[1rem]">{group.name}</h4>
          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium tracking-tight text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] md:text-[0.8rem]"
            >
              <span>{componentCountLabel}</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : 'rotate-0'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          ) : (
            <span className="text-[0.9rem] font-medium tracking-tight text-[var(--text-muted)] md:text-[0.8rem]">
              {componentCountLabel}
            </span>
          )}
        </div>
        {expanded ? (
          <div className="mt-3 border-t border-[rgba(0,0,0,0.08)]">
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
        <p className="text-[0.95rem] font-medium tracking-tight text-[#8f8f97] md:text-[0.9rem]">{group.uptimeLabel}</p>
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
    <div className={`px-0 py-4 ${isFirst ? '' : 'border-t border-[rgba(0,0,0,0.08)]'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={statusToneClasses(component.status)}>
            <StatusIcon status={component.status} className="h-4.5 w-4.5" />
          </span>
          <h5 className="truncate text-[1rem] font-medium tracking-tight text-[var(--text-primary)] md:text-[0.95rem]">{component.name}</h5>
        </div>
        <p className="shrink-0 text-[1rem] font-medium tracking-tight text-[#8f8f97] md:text-[0.95rem]">{component.uptimeLabel}</p>
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
    <div className="h-full overflow-y-auto bg-[var(--bg-surface)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6 md:px-8">
        <WorkspacePageHeader
          title={t('vendor_status.title')}
          subtitle={t('vendor_status.subtitle')}
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefreshToken((current) => current + 1)}
                className="btn-swiss !px-3 !py-2 !text-[0.5625rem]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('vendor_status.refresh')}
              </button>
              <a
                href={data?.subscribeUrl || 'https://status.openai.com/'}
                target="_blank"
                rel="noreferrer"
                className="btn-swiss bg-[var(--text-primary)] !px-3 !py-2 !text-[0.5625rem] !text-[var(--bg-main)]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('vendor_status.subscribe')}
              </a>
              <button
                type="button"
                onClick={() => openExternalURL(data?.publicUrl || 'https://status.openai.com/')}
                className="btn-swiss !px-3 !py-2 !text-[0.5625rem]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('vendor_status.open_official_status')}
              </button>
              <button
                type="button"
                onClick={() => openExternalURL(data?.historyUrl || historyURL)}
                className="btn-swiss !px-3 !py-2 !text-[0.5625rem]"
              >
                <History className="h-3.5 w-3.5" />
                {t('vendor_status.view_history')}
              </button>
            </div>
          }
        />

        {state.status === 'loading' && !data ? (
          <section className="card-swiss flex min-h-[16rem] items-center justify-center gap-3 text-[var(--text-muted)]">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span className="text-sm font-bold uppercase tracking-[0.2em]">{t('vendor_status.loading')}</span>
          </section>
        ) : null}

        {state.status === 'error' ? (
          <section className="card-swiss border-[2px] border-[var(--border-color)] bg-[var(--bg-main)] !p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">{t('vendor_status.fetch_failed')}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--text-primary)]">{state.errorMessage}</p>
            <p className="mt-3 text-[0.625rem] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('vendor_status.fetch_failed_hint')}
            </p>
          </section>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-3 text-[0.625rem] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)] md:grid-cols-3">
              <span>{data.vendorName} · {sourceLabel}</span>
              <span className="md:text-center">{t('vendor_status.feed_updated')} {data.feedUpdatedLabel}</span>
              <span className="md:text-right">{t('vendor_status.last_sync')} {data.lastSyncLabel}</span>
            </div>

            <HeroIncidentCard incident={data.heroIncident} publicUrl={data.publicUrl} t={t} />

            <section className="card-swiss !p-0">
              <div className="flex flex-col gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <p className="text-[0.5rem] font-black uppercase tracking-[0.28em] text-[var(--text-muted)]">
                    {t('vendor_status.live_uptime_matrix')}
                  </p>
                  <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tight text-[var(--text-primary)]">
                    {t('vendor_status.system_status')}
                  </h3>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[0.75rem] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    {data.historyRangeLabel}
                  </p>
                  <p className="mt-2 text-[0.5625rem] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
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
