import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import type { Translator } from '../model/types';
import type { OpenAICompatibleProvider, ProviderRemoteModelsState, ProviderVerifyState } from '../model/openAICompatible';
import { buildProviderConfigSignature, maskProviderAPIKey } from '../model/openAICompatible';
import { shouldOpenAccountDetailsFromTarget } from '../model/accountCardInteractions';

interface OpenAICompatibleWorkspaceProps {
  t: Translator;
  ready: boolean;
  loading: boolean;
  providers: OpenAICompatibleProvider[];
  verifyStates: Record<string, ProviderVerifyState>;
  remoteModelsStates: Record<string, ProviderRemoteModelsState>;
  pendingDeleteName: string | null;
  pendingStatusName: string | null;
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
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {providers.map((provider) => {
              const providerConfigSignature = buildProviderConfigSignature(provider);
              const cachedVerifyState = verifyStates[provider.name];
              const cachedRemoteModelsState = remoteModelsStates[provider.name];
              const verifyState =
                cachedVerifyState?.configSignature === providerConfigSignature
                  ? cachedVerifyState
                  : {
                      model: '',
                      status: 'idle',
                      message: '',
                      lastVerifiedAt: null,
                    };
              const remoteModelsState =
                cachedRemoteModelsState?.configSignature === providerConfigSignature ? cachedRemoteModelsState : undefined;
              const effectiveModelCount =
                remoteModelsState?.status === 'success' ? remoteModelsState.models.length : provider.modelCount || 0;

              const statusColor =
                verifyState.status === 'success' ? 'bg-green-500' : verifyState.status === 'error' ? 'bg-red-500' : 'bg-yellow-500';

              const messageTone =
                verifyState.status === 'success' ? 'text-green-600' : verifyState.status === 'error' ? 'text-red-500' : 'text-[var(--text-muted)]';

              return (
                <div
                  data-account-card
                  key={provider.name}
                  className={`card-swiss flex h-full cursor-pointer flex-col bg-[var(--bg-main)] p-5 transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px] ${
                    provider.disabled ? 'opacity-80' : ''
                  }`}
                  onClick={(event) => {
                    if (!shouldOpenAccountDetailsFromTarget(event.target, event.currentTarget)) {
                      return;
                    }
                    onOpenDetail(provider);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') {
                      return;
                    }
                    if (!shouldOpenAccountDetailsFromTarget(event.target, event.currentTarget)) {
                      return;
                    }
                    event.preventDefault();
                    onOpenDetail(provider);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="text-[0.5rem] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                        {t('accounts.ui_openai_compatible_badge')}
                      </div>
                      <h3 className="flex items-center gap-2 break-all text-[0.75rem] font-black uppercase italic leading-snug tracking-[0.08em] text-[var(--text-primary)]">
                        <div title={verifyState.status} className={`h-2 w-2 shrink-0 ${statusColor}`} />
                        <span>{provider.name}</span>
                        {provider.disabled ? (
                          <span className="border border-amber-600 bg-amber-100 px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.2em] text-amber-700">
                            {t('accounts.rotation_disabled_badge')}
                          </span>
                        ) : null}
                      </h3>
                      {provider.disabled ? (
                        <p className="text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-amber-700">
                          {t('accounts.rotation_disabled_hint')}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-dashed border-[var(--border-color)] pt-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-[0.5rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          {t('accounts.ui_base_url')}
                        </div>
                        <div className="break-all font-mono text-[0.625rem] font-bold text-[var(--text-primary)]">
                          {provider.baseUrl}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[0.5rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          {t('accounts.ui_api_key')}
                        </div>
                        <div className="font-mono text-[0.625rem] font-bold text-[var(--text-primary)]">
                          {maskProviderAPIKey(provider.apiKey)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-[0.5rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          {t('accounts.openai_provider_headers')}
                        </div>
                        <div className="font-mono text-[0.625rem] font-bold text-[var(--text-primary)]">
                          {provider.hasHeaders ? t('accounts.ui_headers_configured') : '—'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[0.5rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          {t('accounts.ui_models')}
                        </div>
                        <div className="font-mono text-[0.625rem] font-bold text-[var(--text-primary)]">
                          {effectiveModelCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-dashed border-[var(--border-color)] pt-4">
                    <div className="space-y-2 border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[0.5rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                          {t('accounts.openai_provider_test_summary')}
                        </div>
                        <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          {verifyState.model || '—'}
                        </div>
                      </div>
                      <div className={`text-[0.625rem] font-black uppercase tracking-tight ${messageTone}`}>
                        {verifyState.message || t('accounts.openai_provider_test_idle')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-3 gap-2 border-t border-dashed border-[var(--border-color)] pt-4">
                    <button onClick={() => onOpenDetail(provider)} className="btn-swiss !py-1.5 !text-[0.5625rem]">
                      {t('accounts.openai_provider_manage')}
                    </button>
                    <button
                      onClick={() => onToggleDisabled(provider)}
                      className="btn-swiss !py-1.5 !text-[0.5625rem]"
                      disabled={pendingStatusName === provider.name}
                    >
                      {pendingStatusName === provider.name
                        ? t('common.loading')
                        : provider.disabled
                          ? t('common.enable')
                          : t('common.disable')}
                    </button>
                    <button
                      onClick={() => onDelete(provider.name)}
                      className="btn-swiss !py-1.5 !text-[0.5625rem] !text-red-500"
                      disabled={pendingDeleteName === provider.name}
                    >
                      {pendingDeleteName === provider.name ? t('common.loading') : t('common.delete')}
                    </button>
                  </div>
                </div>
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
