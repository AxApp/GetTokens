import type { Translator } from '../model/types';
import type { OpenAICompatibleProvider, ProviderVerifyState } from '../model/openAICompatible';
import { maskProviderAPIKey } from '../model/openAICompatible';

interface OpenAICompatibleWorkspaceProps {
  t: Translator;
  ready: boolean;
  loading: boolean;
  providers: OpenAICompatibleProvider[];
  verifyStates: Record<string, ProviderVerifyState>;
  pendingDeleteName: string | null;
  onCreate: () => void;
  onRefresh: () => void;
  onDelete: (name: string) => void;
  onVerifyModelChange: (name: string, model: string) => void;
  onVerify: (provider: OpenAICompatibleProvider) => void;
}

function formatVerifyTone(status: ProviderVerifyState['status']) {
  if (status === 'success') return 'border-green-600 bg-green-600/10 text-green-700';
  if (status === 'error') return 'border-red-500 bg-red-500/10 text-red-500';
  return 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)]';
}

export default function OpenAICompatibleWorkspace({
  t,
  ready,
  loading,
  providers,
  verifyStates,
  pendingDeleteName,
  onCreate,
  onRefresh,
  onDelete,
  onVerifyModelChange,
  onVerify,
}: OpenAICompatibleWorkspaceProps) {
  return (
    <div className="h-full w-full overflow-auto bg-[var(--bg-surface)] p-12" data-collaboration-id="PAGE_ACCOUNTS_OPENAI_COMPATIBLE">
      <div className="mx-auto max-w-6xl space-y-8 pb-32">
        <header className="flex items-end justify-between gap-6 border-b-4 border-[var(--border-color)] pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {t('accounts.openai_provider_title')}
            </h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {t('accounts.openai_provider_subtitle')} / {providers.length} PROVIDERS
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onRefresh} className="btn-swiss" disabled={!ready || loading}>
              {t('common.refresh')}
            </button>
            <button onClick={onCreate} className="btn-swiss" disabled={!ready}>
              {t('accounts.openai_provider_add')}
            </button>
          </div>
        </header>

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
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('accounts.openai_provider_empty_hint')}
            </p>
            <button onClick={onCreate} className="btn-swiss mt-6">
              {t('accounts.openai_provider_add')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {providers.map((provider) => {
              const verifyState = verifyStates[provider.name] ?? {
                model: '',
                status: 'idle',
                message: '',
                lastVerifiedAt: null,
              };
              return (
                <section key={provider.name} className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-5 shadow-[8px_8px_0_var(--shadow-color)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                        OPENAI-COMPATIBLE
                      </div>
                      <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tight text-[var(--text-primary)]">
                        {provider.name}
                      </h3>
                    </div>
                    <button
                      onClick={() => onDelete(provider.name)}
                      className="btn-swiss-secondary !border-red-500 !text-red-500"
                      disabled={pendingDeleteName === provider.name}
                    >
                      {pendingDeleteName === provider.name ? t('common.loading') : t('common.delete')}
                    </button>
                  </div>

                  <dl className="mt-5 space-y-3 text-xs">
                    <div>
                      <dt className="font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">BASE URL</dt>
                      <dd className="mt-1 break-all font-mono text-[var(--text-primary)]">{provider.baseUrl}</dd>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <dt className="font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">API KEY</dt>
                        <dd className="mt-1 font-mono text-[var(--text-primary)]">{maskProviderAPIKey(provider.apiKey)}</dd>
                      </div>
                      <div>
                        <dt className="font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">PREFIX</dt>
                        <dd className="mt-1 font-mono text-[var(--text-primary)]">{provider.prefix || '—'}</dd>
                      </div>
                    </div>
                  </dl>

                  <div className="mt-6 border-t-2 border-[var(--border-color)] pt-4">
                    <div className="flex items-end gap-3">
                      <label className="min-w-0 flex-1 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          {t('accounts.openai_provider_test_model')}
                        </div>
                        <input
                          value={verifyState.model}
                          onChange={(event) => onVerifyModelChange(provider.name, event.target.value)}
                          className="input-swiss"
                          placeholder="deepseek-chat"
                        />
                      </label>
                      <button
                        onClick={() => onVerify(provider)}
                        className="btn-swiss whitespace-nowrap"
                        disabled={verifyState.status === 'loading'}
                      >
                        {verifyState.status === 'loading' ? t('accounts.openai_provider_test_running') : t('accounts.openai_provider_test')}
                      </button>
                    </div>
                    <div className={`mt-4 border px-4 py-3 text-[10px] font-black uppercase tracking-wide ${formatVerifyTone(verifyState.status)}`}>
                      {verifyState.message || t('accounts.openai_provider_test_idle')}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
