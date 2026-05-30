import { useEffect, useRef, useState } from 'react';
import type { Translator } from '../model/types';
import type { AccountUsageSummary } from '../model/accountUsage';
import type {
  OpenAICompatibleProviderDraft,
  ProviderRemoteModelsState,
  ProviderVerifyState,
} from '../model/openAICompatible';
import type { RateLimitState, RateLimitStrategyMeta } from '../model/rateLimit';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import { AccountRuntimeSnapshotSection } from './AccountDetailSections';
import {
  AccountDetailEvidenceGrid,
  AccountDetailOverviewGrid,
  AccountDetailSection,
} from './AccountDetailPrimitives';
import OpenAICompatibleDetailPanel from './OpenAICompatibleDetailPanel';
import RateLimitRulesSection, { type RateLimitRulesAPI, type RateLimitRulesSectionHandle } from './RateLimitRulesSection';

interface OpenAICompatibleDetailModalProps {
  t: Translator;
  draft: OpenAICompatibleProviderDraft;
  verifyState: ProviderVerifyState;
  remoteModelsState?: ProviderRemoteModelsState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: OpenAICompatibleProviderDraft) => void;
  onSave: () => void | Promise<void>;
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
  usageSummary,
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
  const [rateLimitDirty, setRateLimitDirty] = useState(false);
  const [savingRateLimit, setSavingRateLimit] = useState(false);
  const rateLimitRulesRef = useRef<RateLimitRulesSectionHandle>(null);
  const rateLimitAccountKey = String(draft.accountKey || '').trim();

  useEffect(() => {
    setRateLimitDirty(false);
  }, [rateLimitAccountKey]);

  async function saveDetail() {
    if (saving || savingRateLimit) {
      return;
    }
    setSavingRateLimit(true);
    try {
      await onSave();
      if (rateLimitDirty) {
        await rateLimitRulesRef.current?.save();
      }
    } finally {
      setSavingRateLimit(false);
    }
  }

  return (
    <AccountDetailModalFrame onClose={onClose}>
      <OpenAICompatibleDetailPanel
        t={t}
        draft={draft}
        verifyState={verifyState}
        remoteModelsState={remoteModelsState}
        error={error}
        saving={saving || savingRateLimit}
        footerMessage={rateLimitDirty ? t('accounts.rate_limit_dirty') : undefined}
        onClose={onClose}
        onChange={onChange}
        onSave={saveDetail}
        onVerify={onVerify}
        onFetchModels={onFetchModels}
        onApplyFetchedModels={onApplyFetchedModels}
        leadingSections={
          <AccountDetailOverviewGrid
            runtime={<AccountRuntimeSnapshotSection usageSummary={usageSummary} />}
            className="lg:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
            evidence={
              <OpenAICompatibleEvidenceSection
                t={t}
                draft={draft}
                verifyState={verifyState}
              />
            }
          />
        }
        afterSections={
          <>
            <RateLimitRulesSection
              ref={rateLimitRulesRef}
              accountKey={rateLimitAccountKey}
              rateLimitStatus={rateLimitStatus}
              rateLimitStrategies={rateLimitStrategies}
              rateLimitRulesAPI={rateLimitRulesAPI}
              onDirtyChange={setRateLimitDirty}
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
      value: draft.accountKey || providerName,
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
    <AccountDetailSection componentName="OpenAICompatibleEvidenceSection" density="dense" muted eyebrow="Audit" title="EVIDENCE">
      <AccountDetailEvidenceGrid rows={rows} />
    </AccountDetailSection>
  );
}
