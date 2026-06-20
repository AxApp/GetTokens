import { useEffect, useMemo, useState } from 'react';
import { DownloadAuthFile, GetAuthFileModels, NormalizeAuthFileContent } from '../../../wailsjs/go/main/App';
import { useDebug } from '../../context/useDebug';
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

const accountDetailModalOverlayClass =
  'fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-8 backdrop-blur-sm';
const accountDetailModalPanelClass =
  'flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-lg';
const accountDetailModalHeaderClass =
  'flex items-center justify-between border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-6 py-4';
const accountDetailModalEyebrowClass =
  'text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailModalTitleClass =
  'max-w-[450px] truncate text-sm font-semibold tracking-normal text-[var(--text-primary)]';
const accountDetailModalActionButtonClass =
  'inline-flex min-h-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-1.5 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-50';
const accountDetailModalIconButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)]';
const accountDetailModalBodyClass =
  'flex-1 space-y-8 overflow-y-auto p-6 selection:bg-[var(--gt-border-subtle)] selection:text-[var(--text-primary)]';
const accountDetailModalInfoGridClass =
  'grid grid-cols-3 gap-y-6 border-b border-dashed border-[var(--gt-border-subtle)] pb-8';
const accountDetailModalFieldLabelClass =
  'text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailModalFieldValueClass =
  'truncate text-[length:var(--font-size-ui-md-compact)] font-semibold tracking-normal text-[var(--text-primary)]';
const accountDetailModalSectionClass =
  'space-y-4 border-b border-dashed border-[var(--gt-border-subtle)] pb-8';
const accountDetailModalSectionTitleClass =
  'flex items-center gap-2 text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailModalSectionStateClass =
  'text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-primary)]';
const accountDetailModalStatCardClass =
  'space-y-1 rounded border border-dashed border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-3';
const accountDetailModalStatLabelClass =
  'text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailModalStatValueClass =
  'text-[length:var(--font-size-ui-md)] font-semibold tracking-normal text-[var(--text-primary)]';
const accountDetailModalModelChipClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 text-[length:var(--font-size-ui-sm)] font-semibold text-[var(--text-primary)]';
const accountDetailModalFeedbackClass =
  'text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountDetailModalRawContentClass =
  'max-h-[300px] overflow-auto whitespace-pre rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4 font-mono text-[length:var(--font-size-ui-sm)] leading-relaxed text-[var(--text-primary)]';
const accountDetailModalRawContentInteractiveClass =
  'cursor-copy transition-colors hover:bg-[var(--gt-surface-canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-border-subtle)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gt-surface-canvas)]';
const accountDetailModalFooterClass =
  'flex items-center justify-end border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-4';

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
      [t('accounts.recent_requests'), String(usageSummary?.requestCount ?? 0)],
      [t('accounts.recent_success'), String(usageSummary?.success ?? 0)],
      [t('accounts.recent_failure'), String(usageSummary?.failure ?? 0)],
      [t('accounts.total_tokens'), String(usageSummary?.totalTokens ?? 0)],
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
      className={accountDetailModalOverlayClass}
      data-account-detail-modal="quiet"
      data-collaboration-id="MODAL_ACCOUNT_DETAIL"
      onClick={onClose}
    >
      <div
        className={accountDetailModalPanelClass}
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className={accountDetailModalHeaderClass}>
          <div className="flex flex-col">
            <div className={accountDetailModalEyebrowClass}>
              Object_Inspection
            </div>
            <h3 className={accountDetailModalTitleClass}>
              {account.name}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {canStartReauth ? (
              <button
                onClick={isReauthing ? onCancelReauth : onStartReauth}
                className={accountDetailModalActionButtonClass}
              >
                {isReauthing ? t('common.cancel') : t('accounts.reauth')}
              </button>
            ) : null}
            <button onClick={onClose} className={accountDetailModalIconButtonClass}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className={accountDetailModalBodyClass}>
          <div className={accountDetailModalInfoGridClass}>
            {detailFields.map(([label, value]) => (
              <div key={label} className="space-y-1">
                <div className={accountDetailModalFieldLabelClass}>{label}</div>
                <div className={accountDetailModalFieldValueClass}>{value}</div>
              </div>
            ))}
          </div>

          <section className={accountDetailModalSectionClass}>
            <div className="flex items-center justify-between gap-4">
              <div className={accountDetailModalSectionTitleClass}>
                {t('accounts.recent_health')}
              </div>
              <div className={accountDetailModalSectionStateClass}>
                {usageSummary?.hasData ? t('accounts.stability_signal_synced') : t('accounts.no_recent_activity')}
              </div>
            </div>

            {usageSummary?.hasData ? <AccountHealthBar summary={usageSummary} /> : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {statisticsFields.map(([label, value]) => (
                <div
                  key={label}
                  className={accountDetailModalStatCardClass}
                >
                  <div className={accountDetailModalStatLabelClass}>{label}</div>
                  <div className={accountDetailModalStatValueClass}>{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className={accountDetailModalSectionTitleClass}>
                <span className="h-2 w-2 bg-[var(--gt-border-subtle)]"></span>
                {t('accounts.ui_compatible_models')}
              </div>
              {loadingModels ? <span className={`animate-pulse ${accountDetailModalFeedbackClass}`}>{t('accounts.ui_loading_short')}</span> : null}
            </div>
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-2">
              {models.length > 0 ? (
                models.map((model, index) => (
                  <span
                    key={`${getModelLabel(model)}-${index}`}
                    className={accountDetailModalModelChipClass}
                  >
                    {getModelLabel(model)}
                  </span>
                ))
              ) : !loadingModels ? (
                <div className="text-[length:var(--font-size-ui-sm)] font-bold italic text-[var(--text-muted)]">{t('accounts.ui_no_data_available')}</div>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className={accountDetailModalSectionTitleClass}>
                <span className="h-2 w-2 bg-[var(--gt-border-subtle)]"></span>
                {viewMode === 'sanitized' ? t('accounts.ui_sanitized_source_data') : t('accounts.ui_raw_source_data')}
              </div>
              <div className="flex items-center gap-3">
                {copyState !== 'idle' || sanitizeState !== 'idle' ? (
                  <span className={accountDetailModalFeedbackClass}>
                    {copyState === 'success' || sanitizeState === 'success'
                      ? t('accounts.copy_done')
                      : t('accounts.copy_failed')}
                  </span>
                ) : null}
                {loadingRaw ? (
                  <span className={`animate-pulse ${accountDetailModalFeedbackClass}`}>{t('accounts.ui_fetching_fs')}</span>
                ) : (
                  <>
                    <button
                      onClick={() => void handleSanitizeContent()}
                      disabled={!canCopyRawContent(rawContent, loadingRaw) || sanitizing}
                      className={accountDetailModalActionButtonClass}
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
                      className={accountDetailModalActionButtonClass}
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
              data-account-detail-modal-raw-content="quiet"
              onClick={() => {
                if (!displayedContentCopyable) {
                  return;
                }
                void handleCopyDisplayedContent();
              }}
              onKeyDown={handleRawContentKeyDown}
              className={`${accountDetailModalRawContentClass} ${
                displayedContentCopyable
                  ? accountDetailModalRawContentInteractiveClass
                  : ''
              }`}
              title={displayedContentCopyable ? (viewMode === 'sanitized' ? t('accounts.copy_sanitized_source') : t('accounts.copy_raw_source')) : undefined}
            >
              {displayedContent}
            </div>
          </section>
        </div>

        <footer className={accountDetailModalFooterClass}>
          <button onClick={onClose} className={accountDetailModalActionButtonClass}>
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
