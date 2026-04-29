import type { Translator } from '../model/types';
import {
  getOpenAICompatibleProviderPreset,
  openAICompatibleProviderPresets,
  type OpenAICompatibleProviderFormState,
} from '../model/openAICompatible';

interface OpenAICompatibleComposeModalProps {
  t: Translator;
  form: OpenAICompatibleProviderFormState;
  selectedPresetID: string;
  error: string;
  onClose: () => void;
  onChange: (next: OpenAICompatibleProviderFormState) => void;
  onPresetChange: (presetID: string) => void;
  onSubmit: () => void;
}

export default function OpenAICompatibleComposeModal({
  t,
  form,
  selectedPresetID,
  error,
  onClose,
  onChange,
  onPresetChange,
  onSubmit,
}: OpenAICompatibleComposeModalProps) {
  const selectedPreset = getOpenAICompatibleProviderPreset(selectedPresetID);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.openai_provider_title')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('accounts.openai_provider_add')}
          </h3>
        </header>

        <div className="space-y-6 p-6">
          <div className="grid gap-5">
            <label className="space-y-2">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.openai_provider_preset')}
              </div>
              <select
                value={selectedPresetID}
                onChange={(event) => onPresetChange(event.target.value)}
                className="input-swiss w-full"
              >
                <option value="">{t('accounts.openai_provider_preset_custom')}</option>
                {openAICompatibleProviderPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p className="text-[0.5rem] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {t('accounts.openai_provider_preset_hint')}
              </p>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_name')}
                </div>
                <input
                  value={form.name}
                  onChange={(event) => onChange({ ...form, name: event.target.value })}
                  className="input-swiss w-full"
                  placeholder={selectedPreset?.id || 'deepseek'}
                />
              </label>

              <label className="space-y-2">
                <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.ui_base_url')}
                </div>
                <input
                  value={form.baseUrl}
                  onChange={(event) => onChange({ ...form, baseUrl: event.target.value })}
                  className="input-swiss w-full"
                  placeholder={selectedPreset?.baseUrl || 'https://api.deepseek.com/v1'}
                />
              </label>
            </div>

            <label className="space-y-2">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.ui_api_key')}
              </div>
              <input
                value={form.apiKey}
                onChange={(event) => onChange({ ...form, apiKey: event.target.value })}
                className="input-swiss w-full"
                type="password"
                placeholder={selectedPreset?.apiKeyPlaceholder || 'sk-...'}
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
            {t('common.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
