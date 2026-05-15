import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { Translator } from '../model/types';
import type { OpenAICompatibleProvider, ProviderRemoteModelsState, ProviderVerifyState } from '../model/openAICompatible';
import { buildProviderConfigSignature } from '../model/openAICompatible';
import OpenAICompatibleProviderCard from './OpenAICompatibleProviderCard';

interface OpenAICompatibleWorkspaceProps {
  t: Translator;
  ready: boolean;
  loading: boolean;
  providers: OpenAICompatibleProvider[];
  verifyStates: Record<string, ProviderVerifyState>;
  remoteModelsStates: Record<string, ProviderRemoteModelsState>;
  pendingDeleteName: string | null;
  pendingStatusName: string | null;
  accountUsageByID?: Record<string, AccountUsageSummary>;
  onCreate: () => void;
  onRefresh: () => void;
  onOpenDetail: (provider: OpenAICompatibleProvider) => void;
  onDelete: (name: string) => void;
  onToggleDisabled: (provider: OpenAICompatibleProvider) => void;
  embedded?: boolean;
}

export default function OpenAICompatibleWorkspace({
  t,
  ready,
  loading,
  providers,
  verifyStates,
  remoteModelsStates,
  pendingDeleteName,
  pendingStatusName,
  accountUsageByID = {},
  onCreate,
  onRefresh,
  onOpenDetail,
  onDelete,
  onToggleDisabled,
  embedded = false,
}: OpenAICompatibleWorkspaceProps) {
  const content = (
    <>
      <WorkspacePageHeader
        title={t('accounts.openai_provider_title')}
        subtitle={
          <>
            {t('accounts.openai_provider_subtitle')} / {providers.length} {t('accounts.ui_provider_count_unit')}
          </>
        }
        actions={
          <>
            <button
              onClick={onRefresh}
              className="btn-swiss flex h-11 w-11 items-center justify-center !px-0"
              disabled={!ready || loading}
              title={t('common.refresh')}
            >
              <svg
                className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
            <button onClick={onCreate} className="btn-swiss" disabled={!ready}>
              {t('accounts.openai_provider_add')}
            </button>
          </>
        }
      />

      {!ready ? (
        <div className="border-2 border-dashed border-[var(--border-color)] p-20 text-center font-black uppercase italic text-[var(--text-muted)]">
          {t('common.loading')}
        </div>
      ) : loading ? (
        <div className="border-2 border-dashed border-[var(--border-color)] p-20 text-center font-black uppercase italic text-[var(--text-muted)]">
          {t('common.loading')}
        </div>
      ) : providers.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--border-color)] p-20 text-center">
          <div className="text-lg font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('accounts.openai_provider_empty')}
          </div>
          <p className="mt-3 text-[0.625rem] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.openai_provider_empty_hint')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => {
              const providerConfigSignature = buildProviderConfigSignature(provider);
              const cachedVerifyState = verifyStates[provider.name];
              const cachedRemoteModelsState = remoteModelsStates[provider.name];
              const verifyState =
                cachedVerifyState?.configSignature === providerConfigSignature
                  ? cachedVerifyState
                  : {
                      model: '',
                      status: 'idle' as const,
                      message: '',
                      lastVerifiedAt: null,
                    };
              const remoteModelsState =
                cachedRemoteModelsState?.configSignature === providerConfigSignature ? cachedRemoteModelsState : undefined;
              const effectiveModelCount =
                remoteModelsState?.status === 'success' ? remoteModelsState.models.length : provider.modelCount || 0;

              return (
                <OpenAICompatibleProviderCard
                  key={provider.name}
                  t={t}
                  provider={provider}
                  verifyState={verifyState}
                  effectiveModelCount={effectiveModelCount}
                  usageSummary={accountUsageByID[`openai-compatible:${provider.name}`]}
                  pendingDelete={pendingDeleteName === provider.name}
                  pendingStatus={pendingStatusName === provider.name}
                  onOpenDetail={onOpenDetail}
                  onDelete={onDelete}
                  onToggleDisabled={onToggleDisabled}
                />
              );
          })}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <section className="space-y-8" data-collaboration-id="PAGE_ACCOUNTS_OPENAI_COMPATIBLE_SECTION">{content}</section>;
  }

  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-surface)] p-12" data-collaboration-id="PAGE_ACCOUNTS_OPENAI_COMPATIBLE">
      <div className="mx-auto max-w-6xl space-y-8 pb-32">{content}</div>
    </div>
  );
}
