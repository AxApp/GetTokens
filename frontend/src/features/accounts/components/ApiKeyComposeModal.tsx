import type { ApiKeyFormState, ClickEventLike, TextInputEvent, Translator } from '../model/types';

interface ApiKeyComposeModalProps {
  t: Translator;
  form: ApiKeyFormState;
  error: string;
  onClose: () => void;
  onChange: (field: keyof ApiKeyFormState, value: string) => void;
  onSubmit: () => void;
}

export default function ApiKeyComposeModal({
  t,
  form,
  error,
  onClose,
  onChange,
  onSubmit,
}: ApiKeyComposeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.source_api_key')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('accounts.add_codex_api_key')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.api_key_label')}
              </span>
              <input
                value={form.label}
                onChange={(event: TextInputEvent) => onChange('label', event.target.value)}
                className="input-swiss w-full"
                placeholder={t('accounts.api_key_label_placeholder')}
              />
            </label>
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.api_key_value')}
              </span>
              <input
                value={form.apiKey}
                onChange={(event: TextInputEvent) => onChange('apiKey', event.target.value)}
                className="input-swiss w-full"
                placeholder={t('accounts.api_key_value_placeholder')}
                type="password"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Base URL
              </span>
              <input
                value={form.baseUrl}
                onChange={(event: TextInputEvent) => onChange('baseUrl', event.target.value)}
                className="input-swiss w-full"
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.api_key_priority')}
              </span>
              <input
                value={form.priority}
                onChange={(event: TextInputEvent) => onChange('priority', event.target.value)}
                className="input-swiss w-full"
                placeholder={t('accounts.api_key_priority_placeholder')}
                inputMode="numeric"
              />
            </label>
          </div>

          <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {t('accounts.api_key_plain_notice')}
          </div>

          {error ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-500">
              {error}
            </div>
          ) : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
            {t('accounts.add_codex_api_key')}
          </button>
        </footer>
      </div>
    </div>
  );
}
