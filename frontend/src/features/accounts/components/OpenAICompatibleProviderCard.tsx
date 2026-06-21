import AttributionCard from './AttributionCard';
import type { AccountUsageSummary } from '../model/accountUsage';
import { rateLimitStateTone, type RateLimitState } from '../model/rateLimit';
import type { Translator } from '../model/types';
import type { OpenAICompatibleProvider, ProviderVerifyState } from '../model/openAICompatible';
import { maskProviderAPIKey } from '../model/openAICompatible';
import {
  buildOpenAICompatibleCardBadges,
  resolveOpenAICompatibleCardEyebrow,
  resolveOpenAICompatibleCardTone,
  resolveOpenAICompatibleVerifyMessage,
} from '../model/openAICompatibleCard';

const openAICompatibleProviderCardBodyClass =
  'grid min-h-[15rem] grid-cols-[minmax(0,1fr)_8rem] grid-rows-[4.75rem_minmax(0,1fr)] bg-[var(--gt-surface-canvas)]';
const openAICompatibleProviderCardTopCellClass = 'border-b border-[var(--gt-border-subtle)] px-3 py-3';
const openAICompatibleProviderCardTopCellDividerClass = `${openAICompatibleProviderCardTopCellClass} border-r`;
const openAICompatibleProviderCardPanelClass =
  'border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-3';
const openAICompatibleProviderCardModelPanelClass =
  'grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-3';
const openAICompatibleProviderCardModelRowClass =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2';
const openAICompatibleProviderCardLabelClass =
  'text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const openAICompatibleProviderCardMonoValueClass =
  'font-mono text-[length:var(--gt-font-size-md-compact)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const openAICompatibleProviderCardSmallMonoClass =
  'font-mono text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const openAICompatibleProviderCardMetaClass =
  'font-mono text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const openAICompatibleProviderCardEmptyClass =
  'font-mono text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const openAICompatibleProviderCardFooterClass = 'grid grid-cols-3 gap-2 border-t border-[var(--gt-border-subtle)] pt-3';
const openAICompatibleProviderCardButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-1.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-canvas)] disabled:cursor-not-allowed disabled:opacity-45';
const openAICompatibleProviderCardDangerButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-1.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-status-danger)] transition-colors hover:border-[var(--gt-status-danger)] hover:bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,var(--gt-surface-muted))] disabled:cursor-not-allowed disabled:opacity-45';
const openAICompatibleProviderCardStatusClass = (status: ProviderVerifyState['status']) =>
  `mt-2 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal ${
    status === 'success'
      ? 'text-[var(--gt-status-success)]'
      : status === 'error'
        ? 'text-[var(--gt-status-danger)]'
        : 'text-[var(--gt-ink-primary)]'
  }`;

interface OpenAICompatibleProviderCardProps {
  t: Translator;
  provider: OpenAICompatibleProvider;
  verifyState: ProviderVerifyState;
  effectiveModelCount: number;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  pendingDelete: boolean;
  pendingStatus: boolean;
  onOpenDetail: (provider: OpenAICompatibleProvider) => void;
  onDelete: (name: string) => void;
  onToggleDisabled: (provider: OpenAICompatibleProvider) => void;
}

export default function OpenAICompatibleProviderCard({
  t,
  provider,
  verifyState,
  effectiveModelCount,
  usageSummary,
  rateLimitStatus,
  pendingDelete,
  pendingStatus,
  onOpenDetail,
  onDelete,
  onToggleDisabled,
}: OpenAICompatibleProviderCardProps) {
  const guardTone = rateLimitStateTone(rateLimitStatus);
  const tone = guardTone === 'critical' ? 'critical' : resolveOpenAICompatibleCardTone(provider, verifyState);
  const eyebrow = resolveOpenAICompatibleCardEyebrow(t, provider, verifyState);
  const badges = buildOpenAICompatibleCardBadges(t, provider);
  if (rateLimitStatus?.blocked) {
    badges.push({ label: rateLimitStatus.blockReason || 'ROUTE GUARD', tone: 'critical' });
  }
  const verifyMessage = resolveOpenAICompatibleVerifyMessage(t, verifyState);

  return (
    <AttributionCard
      t={t}
      title={provider.name}
      subtitle={provider.baseUrl}
      eyebrow={eyebrow}
      badges={badges}
      usageSummary={usageSummary}
      rateLimitStatus={rateLimitStatus}
      tone={tone}
      style={{ minHeight: '48rem' }}
      customBody={
        <div
          className={openAICompatibleProviderCardBodyClass}
          data-account-card-ignore-click="true"
          data-openai-compatible-provider-card-body
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className={openAICompatibleProviderCardTopCellDividerClass}>
            <RegionHead label={t('accounts.ui_base_url')} value={provider.baseUrl} wrap />
          </div>
          <div className={openAICompatibleProviderCardTopCellClass}>
            <RegionHead
              label={t('codex.account_list_runtime')}
              value={provider.disabled ? t('common.disable') : t('common.enable')}
            />
          </div>

          <div className="col-span-2 grid gap-3 px-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricPanel label={t('accounts.ui_api_key')} value={maskProviderAPIKey(provider.apiKey)} mono />
              <MetricPanel
                label={t('accounts.openai_provider_headers')}
                value={provider.hasHeaders ? t('accounts.ui_headers_configured') : '—'}
              />
            </div>
            <div
              className={openAICompatibleProviderCardModelPanelClass}
              data-openai-compatible-provider-card-models
            >
              <div className={openAICompatibleProviderCardLabelClass}>
                {t('accounts.ui_models')}
              </div>
              <div className="grid gap-2">
                {provider.models && provider.models.length > 0 ? (
                  provider.models.slice(0, 3).map((model, index) => (
                    <div
                      key={`${model.name}-${model.alias || index}`}
                      className={openAICompatibleProviderCardModelRowClass}
                    >
                      <code className={`truncate ${openAICompatibleProviderCardSmallMonoClass}`}>
                        {model.name}
                      </code>
                      <b className={`truncate ${openAICompatibleProviderCardSmallMonoClass}`}>
                        {model.alias || model.name}
                      </b>
                    </div>
                  ))
                ) : (
                  <div className={openAICompatibleProviderCardEmptyClass}>
                    {t('accounts.ui_no_data_available')}
                  </div>
                )}
              </div>
            </div>
            <div className={openAICompatibleProviderCardPanelClass}>
              <div className="flex items-center justify-between gap-3">
                <div className={openAICompatibleProviderCardLabelClass}>
                  {t('accounts.openai_provider_test_summary')}
                </div>
                <div className={openAICompatibleProviderCardMetaClass}>
                  {verifyState.model || '—'}
                </div>
              </div>
              <div className={openAICompatibleProviderCardStatusClass(verifyState.status)}>
                {verifyMessage}
              </div>
            </div>
          </div>
        </div>
      }
      footer={
        <div
          className={openAICompatibleProviderCardFooterClass}
          data-account-card-ignore-click="true"
          data-openai-compatible-provider-card-actions
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => onOpenDetail(provider)} className={openAICompatibleProviderCardButtonClass}>
            {t('accounts.openai_provider_manage')}
          </button>
          <button
            type="button"
            onClick={() => onToggleDisabled(provider)}
            className={openAICompatibleProviderCardButtonClass}
            disabled={pendingStatus}
          >
            {pendingStatus ? t('common.loading') : provider.disabled ? t('common.enable') : t('common.disable')}
          </button>
          <button
            type="button"
            onClick={() => onDelete(openAICompatibleProviderIdentity(provider))}
            className={openAICompatibleProviderCardDangerButtonClass}
            disabled={pendingDelete}
          >
            {pendingDelete ? t('common.loading') : t('common.delete')}
          </button>
        </div>
      }
      interactive
      onOpen={() => onOpenDetail(provider)}
    />
  );
}

function openAICompatibleProviderIdentity(provider: OpenAICompatibleProvider): string {
  const accountKey = String(provider.accountKey || '').trim();
  if (accountKey) {
    return accountKey;
  }
  return String(provider.name || '').trim();
}

function RegionHead({ label, value, wrap = false }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="grid gap-2">
      <span className={openAICompatibleProviderCardLabelClass}>{label}</span>
      <b
        className={`${wrap ? 'break-all' : 'truncate'} ${openAICompatibleProviderCardMonoValueClass}`}
      >
        {value}
      </b>
    </div>
  );
}

function MetricPanel({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={openAICompatibleProviderCardPanelClass}>
      <div className={openAICompatibleProviderCardLabelClass}>{label}</div>
      <div className={`mt-2 ${mono ? 'font-mono' : ''} text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]`}>
        {value}
      </div>
    </div>
  );
}
