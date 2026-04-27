import type { Translator } from '../model/types';
import type { OpenAICompatibleProviderDraft, ProviderVerifyState } from '../model/openAICompatible';

interface OpenAICompatibleDetailModalProps {
  t: Translator;
  draft: OpenAICompatibleProviderDraft;
  verifyState: ProviderVerifyState;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: OpenAICompatibleProviderDraft) => void;
  onSave: () => void;
  onVerify: () => void;
}

function formatVerifyTone(status: ProviderVerifyState['status']) {
  if (status === 'success') return 'border-green-600 bg-green-600/10 text-green-700';
  if (status === 'error') return 'border-red-500 bg-red-500/10 text-red-500';
  return 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)]';
}

function formatLastVerifiedAt(timestamp: number | null) {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleString();
}

export default function OpenAICompatibleDetailModal({
  t,
  draft,
  verifyState,
  error,
  saving,
  onClose,
  onChange,
  onSave,
  onVerify,
}: OpenAICompatibleDetailModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-4xl border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[12px_12px_0_var(--shadow-color)]">
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-color)] px-6 py-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              OPENAI-COMPATIBLE PROVIDER
            </div>
            <h3 className="mt-2 text-3xl font-black uppercase italic tracking-tight text-[var(--text-primary)]">
              {draft.name || draft.currentName}
            </h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('accounts.openai_provider_detail_hint')}
            </p>
          </div>
          <button onClick={onClose} className="btn-swiss !px-3 !py-2">
            {t('common.close')}
          </button>
        </div>

        <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-5 border-b-2 border-[var(--border-color)] px-6 py-6 xl:border-b-0 xl:border-r-2">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_name')}
                </div>
                <input
                  value={draft.name}
                  onChange={(event) => onChange({ ...draft, name: event.target.value })}
                  className="input-swiss"
                  placeholder="deepseek"
                />
              </label>
              <label className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.copy_prefix')}
                </div>
                <input
                  value={draft.prefix}
                  onChange={(event) => onChange({ ...draft, prefix: event.target.value })}
                  className="input-swiss"
                  placeholder="team-a"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">BASE URL</div>
                <input
                  value={draft.baseUrl}
                  onChange={(event) => onChange({ ...draft, baseUrl: event.target.value })}
                  className="input-swiss"
                  placeholder="https://api.deepseek.com/v1"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">API KEY</div>
                <input
                  value={draft.apiKey}
                  onChange={(event) => onChange({ ...draft, apiKey: event.target.value })}
                  className="input-swiss"
                  placeholder="sk-..."
                />
              </label>
            </div>

            {error ? (
              <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-500">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 border-t-2 border-dashed border-[var(--border-color)] pt-5">
              <button onClick={onClose} className="btn-swiss-secondary">
                {t('common.cancel')}
              </button>
              <button onClick={onSave} className="btn-swiss" disabled={saving}>
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </section>

          <section className="space-y-5 px-6 py-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.openai_provider_test_model')}
              </div>
              <div className="mt-3 flex items-end gap-3">
                <label className="min-w-0 flex-1 space-y-2">
                  <input
                    value={draft.verifyModel}
                    onChange={(event) => onChange({ ...draft, verifyModel: event.target.value })}
                    className="input-swiss"
                    placeholder="deepseek-chat"
                  />
                </label>
                <button onClick={onVerify} className="btn-swiss whitespace-nowrap" disabled={verifyState.status === 'loading'}>
                  {verifyState.status === 'loading' ? t('accounts.openai_provider_test_running') : t('accounts.openai_provider_test')}
                </button>
              </div>
            </div>

            <div className={`border px-4 py-4 text-[10px] font-black uppercase tracking-wide ${formatVerifyTone(verifyState.status)}`}>
              {verifyState.message || t('accounts.openai_provider_test_idle')}
            </div>

            <div className="grid gap-4 border-t-2 border-dashed border-[var(--border-color)] pt-5 md:grid-cols-2">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_current_name')}
                </div>
                <div className="mt-1 break-all text-[11px] font-black uppercase text-[var(--text-primary)]">
                  {draft.currentName}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_last_verified')}
                </div>
                <div className="mt-1 break-all text-[11px] font-black uppercase text-[var(--text-primary)]">
                  {formatLastVerifiedAt(verifyState.lastVerifiedAt)}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
