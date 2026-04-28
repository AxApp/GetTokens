import { useEffect, useMemo, useState } from 'react';
import { DownloadAuthFile, GetAuthFileModels, NormalizeAuthFileContent } from '../../../wailsjs/go/main/App';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import type { AuthFile, AuthModel } from '../../types';
import { toErrorMessage } from '../../utils/error';
import type { AccountUsageSummary } from '../../features/accounts/model/accountUsage';
import AccountHealthBar from '../../features/accounts/components/AccountHealthBar';
import { canCopyRawContent, copyRawContent, RAW_CONTENT_COPY_RESET_MS } from './accountDetailClipboard';

interface AccountDetailModalProps {
  account: AuthFile;
  usageSummary?: AccountUsageSummary;
  canStartReauth?: boolean;
  isReauthing?: boolean;
  onClose: () => void;
  onStartReauth?: () => void;
  onCancelReauth?: () => void;
}

type DetailField = readonly [string, string];

interface ClickEventLike {
  stopPropagation: () => void;
}

interface KeyboardEventLike {
  key: string;
  preventDefault: () => void;
}

function formatRefreshValue(value: unknown): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString();
}

function getModelLabel(model: AuthModel): string {
  return model.display_name || model.id || model.name || 'MODEL';
}

export default function AccountDetailModal({
  account,
  usageSummary,
  canStartReauth = false,
  isReauthing = false,
  onClose,
  onStartReauth,
  onCancelReauth,
}: AccountDetailModalProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const [models, setModels] = useState<AuthModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [sanitizedContent, setSanitizedContent] = useState('');
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [sanitizeState, setSanitizeState] = useState<'idle' | 'success' | 'error'>('idle');
  const [viewMode, setViewMode] = useState<'raw' | 'sanitized'>('raw');
  const [sanitizing, setSanitizing] = useState(false);

  const detailFields = useMemo<DetailField[]>(
    () => [
      [t('common.type'), account.type || '—'],
      [t('accounts.provider'), account.provider || '—'],
      [t('accounts.size'), account.size ? `${account.size} B` : '—'],
      [t('common.status'), account.status || '—'],
      [t('common.enable'), account.disabled ? t('common.no') : t('common.yes')],
      [t('accounts.last_refresh'), formatRefreshValue(account.lastRefresh)],
    ],
    [account, t]
  );

  const statisticsFields = useMemo<DetailField[]>(
    () => [
      [
        t('accounts.success_rate'),
        usageSummary?.successRate !== null && usageSummary?.successRate !== undefined
          ? `${Math.round(usageSummary.successRate)}%`
          : t('accounts.no_recent_activity'),
      ],
      [t('accounts.recent_success'), String(usageSummary?.success ?? 0)],
      [t('accounts.recent_failure'), String(usageSummary?.failure ?? 0)],
      [
        t('accounts.average_latency'),
        usageSummary?.averageLatencyMs ? `${usageSummary.averageLatencyMs} ms` : '—',
      ],
    ],
    [t, usageSummary]
  );

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoadingModels(true);
      try {
        const response = await trackRequest('GetAuthFileModels', { name: account.name }, () =>
          GetAuthFileModels(account.name)
        );
        if (mounted) {
          setModels(response || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setLoadingModels(false);
        }
      }

      setLoadingRaw(true);
      try {
        const response = await trackRequest('DownloadAuthFile', { name: account.name }, () =>
          DownloadAuthFile(account.name)
        );
        const binary = atob(response.contentBase64);
        let decoded = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
        try {
          decoded = JSON.stringify(JSON.parse(decoded), null, 2);
        } catch {
          // Keep the original content if it is not JSON.
        }
        if (mounted) {
          setRawContent(decoded);
          setSanitizedContent('');
          setViewMode('raw');
          setSanitizeState('idle');
        }
      } catch (error) {
        if (mounted) {
          setRawContent(`READ_ERROR: ${toErrorMessage(error)}`);
          setSanitizedContent('');
          setViewMode('raw');
          setSanitizeState('idle');
        }
      } finally {
        if (mounted) {
          setLoadingRaw(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [account.name, trackRequest]);

  useEffect(() => {
    if (copyState === 'idle' && sanitizeState === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyState('idle');
      setSanitizeState('idle');
    }, RAW_CONTENT_COPY_RESET_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyState, sanitizeState]);

  const displayedContent = viewMode === 'sanitized' && sanitizedContent ? sanitizedContent : rawContent;
  const displayedContentCopyable = canCopyRawContent(displayedContent, loadingRaw || sanitizing);

  async function handleCopyDisplayedContent() {
    const status = await copyRawContent(displayedContent, {
      loading: loadingRaw || sanitizing,
      writeText: (value) => navigator.clipboard.writeText(value),
    });

    setCopyState(status);
  }

  function handleRawContentKeyDown(event: KeyboardEventLike) {
    if (!displayedContentCopyable) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void handleCopyDisplayedContent();
    }
  }

  async function handleSanitizeContent() {
    if (viewMode === 'sanitized' && sanitizedContent) {
      setViewMode('raw');
      return;
    }

    if (sanitizedContent) {
      setViewMode('sanitized');
      return;
    }

    setSanitizing(true);
    try {
      const normalized = await trackRequest('NormalizeAuthFileContent', { name: account.name }, () =>
        NormalizeAuthFileContent(rawContent)
      );
      setSanitizedContent(normalized);
      setViewMode('sanitized');
      setSanitizeState('success');
    } catch (error) {
      console.error(error);
      setSanitizeState('error');
    } finally {
      setSanitizing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
      data-collaboration-id="MODAL_ACCOUNT_DETAIL"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
          <div className="flex flex-col">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Object_Inspection
            </div>
            <h3 className="max-w-[450px] truncate text-sm font-black italic uppercase tracking-tighter text-[var(--text-primary)]">
              {account.name}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {canStartReauth ? (
              <button
                onClick={isReauthing ? onCancelReauth : onStartReauth}
                className="btn-swiss !px-3 !py-1 !text-[9px]"
              >
                {isReauthing ? t('common.cancel') : t('accounts.reauth')}
              </button>
            ) : null}
            <button onClick={onClose} className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6 selection:bg-[var(--border-color)] selection:text-[var(--bg-main)]">
          <div className="grid grid-cols-3 gap-y-6 border-b-2 border-dashed border-[var(--border-color)] pb-8">
            {detailFields.map(([label, value]) => (
              <div key={label} className="space-y-1">
                <div className="text-[9px] font-black uppercase italic text-[var(--text-muted)]">{label}</div>
                <div className="truncate text-[11px] font-black uppercase text-[var(--text-primary)]">{value}</div>
              </div>
            ))}
          </div>

          <section className="space-y-4 border-b-2 border-dashed border-[var(--border-color)] pb-8">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.recent_health')}
              </div>
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--text-primary)]">
                {usageSummary?.hasData ? t('accounts.stability_signal_synced') : t('accounts.no_recent_activity')}
              </div>
            </div>

            {usageSummary?.hasData ? <AccountHealthBar summary={usageSummary} /> : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {statisticsFields.map(([label, value]) => (
                <div
                  key={label}
                  className="space-y-1 border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3"
                >
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</div>
                  <div className="text-[12px] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                <span className="h-2 w-2 bg-[var(--border-color)]"></span>
                {t('accounts.ui_compatible_models')}
              </div>
              {loadingModels ? <span className="animate-pulse text-[9px] font-black">{t('accounts.ui_loading_short')}</span> : null}
            </div>
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-2">
              {models.length > 0 ? (
                models.map((model, index) => (
                  <span
                    key={`${getModelLabel(model)}-${index}`}
                    className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-black italic uppercase"
                  >
                    {getModelLabel(model)}
                  </span>
                ))
              ) : !loadingModels ? (
                <div className="text-[10px] font-bold italic text-[var(--text-muted)]">{t('accounts.ui_no_data_available')}</div>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                <span className="h-2 w-2 bg-[var(--border-color)]"></span>
                {viewMode === 'sanitized' ? t('accounts.ui_sanitized_source_data') : t('accounts.ui_raw_source_data')}
              </div>
	              <div className="flex items-center gap-3">
	                {copyState !== 'idle' || sanitizeState !== 'idle' ? (
	                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--border-color)]">
	                    {copyState === 'success' || sanitizeState === 'success'
	                      ? t('accounts.copy_done')
	                      : t('accounts.copy_failed')}
	                  </span>
                ) : null}
                {loadingRaw ? (
                  <span className="animate-pulse text-[9px] font-black text-[var(--text-muted)]">{t('accounts.ui_fetching_fs')}</span>
                ) : (
                  <>
                    <button
                      onClick={() => void handleSanitizeContent()}
                      disabled={!canCopyRawContent(rawContent, loadingRaw) || sanitizing}
                      className="btn-swiss !px-3 !py-1 !text-[9px]"
                    >
                      {sanitizing
                        ? t('accounts.sanitizing_source')
                        : viewMode === 'sanitized'
                          ? t('accounts.show_raw_source')
                          : t('accounts.sanitize_source')}
                    </button>
                    <button
                      onClick={() => void handleCopyDisplayedContent()}
                      disabled={!displayedContentCopyable}
                      className="btn-swiss !px-3 !py-1 !text-[9px]"
                    >
                      {viewMode === 'sanitized' ? t('accounts.copy_sanitized_source') : t('accounts.copy_raw_source')}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div
              role="button"
              tabIndex={displayedContentCopyable ? 0 : -1}
              aria-disabled={!displayedContentCopyable}
              onClick={() => {
                if (!displayedContentCopyable) {
                  return;
                }
                void handleCopyDisplayedContent();
              }}
              onKeyDown={handleRawContentKeyDown}
              className={`max-h-[300px] overflow-auto whitespace-pre border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 font-mono text-[10px] leading-relaxed text-[var(--text-primary)] shadow-inner ${
                displayedContentCopyable
                  ? 'cursor-copy transition-colors hover:bg-[var(--bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)]'
                  : ''
              }`}
              title={displayedContentCopyable ? (viewMode === 'sanitized' ? t('accounts.copy_sanitized_source') : t('accounts.copy_raw_source')) : undefined}
            >
              {displayedContent}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
