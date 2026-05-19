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
          <RateLimitRulesSection
            accountKey={rateLimitAccountKey}
            matchKey={rateLimitMatchKey}
            rateLimitStatus={rateLimitStatus}
            rateLimitStrategies={rateLimitStrategies}
            rateLimitRulesAPI={rateLimitRulesAPI}
            onRateLimitRulesChanged={onRateLimitRulesChanged}
            t={t}
          />
        }
      />
    </AccountDetailModalFrame>
  );
}
