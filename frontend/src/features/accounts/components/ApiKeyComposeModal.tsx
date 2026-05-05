import type { ApiKeyFormState, ClickEventLike, TextInputEvent, Translator } from '../model/types';

interface ApiKeyComposeModalProps {
  t: Translator;
  form: ApiKeyFormState;
  error: string;
  onClose: () => void;
  onChange: (field: keyof ApiKeyFormState, value: string | boolean) => void;
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
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.source_api_key')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('accounts.add_codex_api_key')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Base URL
              </span>
              <input
                value={form.baseUrl}
                onChange={(event: TextInputEvent) => onChange('baseUrl', event.target.value)}
                className="input-swiss w-full"
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
              <input
                type="checkbox"
                checked={form.quotaEnabled}
                onChange={(event) => onChange('quotaEnabled', event.target.checked)}
              />
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.quota_curl_enabled')}
              </span>
            </label>
            <label className="space-y-2">
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.quota_curl')}
              </span>
              <textarea
                value={form.quotaCurl}
                onChange={(event) => onChange('quotaCurl', event.target.value)}
                className="input-swiss min-h-28 w-full resize-y font-mono"
                placeholder='curl -sS "https://example.com/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"'
              />
            </label>
          </div>

          {error ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
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
