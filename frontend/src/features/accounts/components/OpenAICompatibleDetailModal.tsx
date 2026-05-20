import type { Translator } from '../model/types';
import type {
  OpenAICompatibleProviderDraft,
  ProviderRemoteModelsState,
  ProviderVerifyState,
} from '../model/openAICompatible';
import type { RateLimitState, RateLimitStrategyMeta } from '../model/rateLimit';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import OpenAICompatibleDetailPanel from './OpenAICompatibleDetailPanel';
import RateLimitRulesSection, { type RateLimitRulesAPI } from './RateLimitRulesSection';

interface OpenAICompatibleDetailModalProps {
  t: Translator;
  draft: OpenAICompatibleProviderDraft;
  verifyState: ProviderVerifyState;
  remoteModelsState?: ProviderRemoteModelsState;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: OpenAICompatibleProviderDraft) => void;
  onSave: () => void;
  onVerify: () => void;
  onFetchModels: () => void;
  onApplyFetchedModels: () => void;
  onRateLimitRulesChanged: () => void;
}

export default function OpenAICompatibleDetailModal({
  t,
  draft,
  verifyState,
  remoteModelsState,
  rateLimitStatus,
  rateLimitStrategies,
  rateLimitRulesAPI,
  error,
  saving,
  onClose,
  onChange,
  onSave,
  onVerify,
  onFetchModels,
  onApplyFetchedModels,
  onRateLimitRulesChanged,
}: OpenAICompatibleDetailModalProps) {
  const rateLimitAccountName = draft.currentName || draft.name;
  const rateLimitAccountKey = `openai-compatible:${rateLimitAccountName}`;
  const rateLimitMatchKey = rateLimitStatus?.matchKey || `provider:${rateLimitAccountName.trim().toLowerCase()}`;

  return (
    <AccountDetailModalFrame onClose={onClose}>
      <OpenAICompatibleDetailPanel
        t={t}
        draft={draft}
        verifyState={verifyState}
        remoteModelsState={remoteModelsState}
        error={error}
        saving={saving}
        onClose={onClose}
        onChange={onChange}
        onSave={onSave}
        onVerify={onVerify}
        onFetchModels={onFetchModels}
        onApplyFetchedModels={onApplyFetchedModels}
        afterSections={
          <>
            <OpenAICompatibleEvidenceSection
              t={t}
              draft={draft}
              verifyState={verifyState}
            />
            <RateLimitRulesSection
              accountKey={rateLimitAccountKey}
              matchKey={rateLimitMatchKey}
              rateLimitStatus={rateLimitStatus}
              rateLimitStrategies={rateLimitStrategies}
              rateLimitRulesAPI={rateLimitRulesAPI}
              onRateLimitRulesChanged={onRateLimitRulesChanged}
              t={t}
            />
          </>
        }
      />
    </AccountDetailModalFrame>
  );
}

function OpenAICompatibleEvidenceSection({
  t,
  draft,
  verifyState,
}: {
  t: Translator;
  draft: OpenAICompatibleProviderDraft;
  verifyState: ProviderVerifyState;
}) {
  const providerName = draft.currentName || draft.name || '—';
  const modelCount = draft.models.filter((model) => model.name.trim()).length;
  const rows = [
    {
      label: t('accounts.card_asset'),
      value: `openai-compatible:${providerName}`,
    },
    {
      label: t('accounts.card_source_type'),
      value: 'OPENAI-COMPATIBLE',
    },
    {
      label: t('accounts.ui_models'),
      value: String(modelCount),
    },
    {
      label: t('accounts.openai_provider_last_verified'),
      value: verifyState.lastVerifiedAt ? new Date(verifyState.lastVerifiedAt).toLocaleString() : '—',
    },
  ];

  return (
    <section className="space-y-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)]/30 px-6 py-6">
      <h3 className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
        EVIDENCE
      </h3>
      <div className="grid gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start">
            <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {row.label}
            </div>
            <div className="min-w-0 break-all font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
