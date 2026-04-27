import type { Translator } from '../model/types';
import type { OpenAICompatibleProviderFormState } from '../model/openAICompatible';

interface OpenAICompatibleComposeModalProps {
  t: Translator;
  form: OpenAICompatibleProviderFormState;
  error: string;
  onClose: () => void;
  onChange: (next: OpenAICompatibleProviderFormState) => void;
  onSubmit: () => void;
}

export default function OpenAICompatibleComposeModal({
  t,
  form,
  error,
  onClose,
  onChange,
  onSubmit,
}: OpenAICompatibleComposeModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-2xl border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-6 shadow-[12px_12px_0_var(--shadow-color)]">
        <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
          <div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {t('accounts.openai_provider_add')}
            </h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('accounts.openai_provider_add_hint')}
            </p>
          </div>
          <button onClick={onClose} className="btn-swiss !px-3 !py-2">
            {t('common.close')}
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('accounts.openai_provider_name')}</div>
            <input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              className="input-swiss"
              placeholder="deepseek"
            />
          </label>
          <label className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{t('accounts.copy_prefix')}</div>
            <input
              value={form.prefix}
              onChange={(event) => onChange({ ...form, prefix: event.target.value })}
              className="input-swiss"
              placeholder="team-a"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">BASE URL</div>
            <input
              value={form.baseUrl}
              onChange={(event) => onChange({ ...form, baseUrl: event.target.value })}
              className="input-swiss"
              placeholder="https://api.deepseek.com/v1"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">API KEY</div>
            <input
              value={form.apiKey}
              onChange={(event) => onChange({ ...form, apiKey: event.target.value })}
              className="input-swiss"
              placeholder="sk-..."
            />
          </label>
        </div>
        {error ? <div className="mt-4 border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-500">{error}</div> : null}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-swiss-secondary">
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className="btn-swiss">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
