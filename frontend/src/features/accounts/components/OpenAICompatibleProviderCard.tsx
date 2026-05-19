import AttributionCard from './AttributionCard';
import type { AccountUsageSummary } from '../model/accountUsage';
import { rateLimitStateTone, type RateLimitState } from '../model/rateLimit';
import type { Translator } from '../model/types';
import type { OpenAICompatibleProvider, ProviderVerifyState } from '../model/openAICompatible';
import { maskProviderAPIKey } from '../model/openAICompatible';
import {
  buildOpenAICompatibleCardBadges,
  buildOpenAICompatibleCardEvidenceRows,
  resolveOpenAICompatibleCardEyebrow,
  resolveOpenAICompatibleCardTone,
  resolveOpenAICompatibleVerifyMessage,
} from '../model/openAICompatibleCard';

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
  const evidenceRows = buildOpenAICompatibleCardEvidenceRows(t, provider, verifyState, effectiveModelCount);
  const verifyMessage = resolveOpenAICompatibleVerifyMessage(t, verifyState);

  return (
    <AttributionCard
      t={t}
      title={provider.name}
      subtitle={provider.baseUrl}
      eyebrow={eyebrow}
      badges={badges}
      evidenceRows={evidenceRows}
      usageSummary={usageSummary}
      rateLimitStatus={rateLimitStatus}
      tone={tone}
      style={{ minHeight: '48rem' }}
      customBody={
        <div
          className="grid min-h-[15rem] grid-cols-[minmax(0,1fr)_8rem] grid-rows-[4.75rem_minmax(0,1fr)] bg-[var(--bg-surface)]"
          data-account-card-ignore-click="true"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="border-r border-b border-[var(--border-color)] px-3 py-3">
            <RegionHead label={t('accounts.ui_base_url')} value={provider.baseUrl} wrap />
          </div>
          <div className="border-b border-[var(--border-color)] px-3 py-3">
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
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-3">
              <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {t('accounts.ui_models')}
              </div>
              <div className="grid gap-2">
                {provider.models && provider.models.length > 0 ? (
                  provider.models.slice(0, 3).map((model, index) => (
                    <div
                      key={`${model.name}-${model.alias || index}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2"
                    >
                      <code className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">
                        {model.name}
                      </code>
                      <b className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">
                        {model.alias || model.name}
                      </b>
                    </div>
                  ))
                ) : (
                  <div className="font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {t('accounts.ui_no_data_available')}
                  </div>
                )}
              </div>
            </div>
            <div className="border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_test_summary')}
                </div>
                <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {verifyState.model || '—'}
                </div>
              </div>
              <div
                className={`mt-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.04em] ${
                  verifyState.status === 'success'
                    ? 'text-[var(--color-status-success)]'
                    : verifyState.status === 'error'
                      ? 'text-[var(--color-status-danger)]'
                      : 'text-[var(--text-primary)]'
                }`}
              >
                {verifyMessage}
              </div>
            </div>
          </div>
        </div>
      }
      footer={
        <div
          className="grid grid-cols-3 gap-2 border-t border-dashed border-[var(--border-color)] pt-3"
          data-account-card-ignore-click="true"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => onOpenDetail(provider)} className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)]">
            {t('accounts.openai_provider_manage')}
          </button>
          <button
            type="button"
            onClick={() => onToggleDisabled(provider)}
            className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)]"
            disabled={pendingStatus}
          >
            {pendingStatus ? t('common.loading') : provider.disabled ? t('common.enable') : t('common.disable')}
          </button>
          <button
            type="button"
            onClick={() => onDelete(provider.name)}
            className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)] !text-[var(--color-status-danger)]"
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

function RegionHead({ label, value, wrap = false }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="grid gap-2">
      <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
      <b
        className={`${wrap ? 'break-all' : 'truncate'} font-mono text-[length:var(--font-size-ui-md-compact)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]`}
      >
        {value}
      </b>
    </div>
  );
}

function MetricPanel({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-3">
      <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
      <div className={`mt-2 ${mono ? 'font-mono' : ''} text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]`}>
        {value}
      </div>
    </div>
  );
}
