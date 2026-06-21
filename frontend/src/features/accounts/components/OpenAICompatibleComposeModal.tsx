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

const openAICompatibleComposeOverlayClass = 'fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-6 backdrop-blur-sm';
const openAICompatibleComposePanelClass = 'flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-lg';
const openAICompatibleComposeHeaderClass = 'border-b border-[var(--gt-border-subtle)] px-6 py-4';
const openAICompatibleComposeBodyClass = 'grid gap-6 p-6';
const openAICompatibleComposeFooterClass = 'flex items-center justify-between border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-4';
const openAICompatibleComposeLabelClass = 'text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]';
const openAICompatibleComposeTitleClass = 'mt-1 text-sm font-semibold text-[var(--gt-ink-primary)]';
const openAICompatibleComposeHintClass = 'text-[length:var(--gt-font-size-2xs)] font-medium text-[var(--gt-ink-muted)]';
const openAICompatibleComposeInputClass = 'h-9 w-full rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-1.5 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-primary)] outline-none transition placeholder:text-[var(--gt-ink-muted)] focus:border-[var(--gt-ink-muted)]';
const openAICompatibleComposeButtonClass = 'inline-flex h-9 items-center justify-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-ink-muted)] hover:bg-[var(--gt-surface-muted)]';
const openAICompatibleComposePrimaryButtonClass = `${openAICompatibleComposeButtonClass} bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)] hover:bg-[var(--gt-ink-muted)]`;
const openAICompatibleComposeErrorClass = 'rounded-md border border-[color-mix(in_srgb,var(--gt-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,var(--gt-surface-canvas))] px-4 py-3 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-status-danger)]';

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
    <div
      className={openAICompatibleComposeOverlayClass}
      data-openai-compatible-compose-modal
      onClick={onClose}
    >
      <div
        className={openAICompatibleComposePanelClass}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={openAICompatibleComposeHeaderClass} data-openai-compatible-compose-header>
          <div className={openAICompatibleComposeLabelClass}>
            {t('accounts.openai_provider_title')}
          </div>
          <h3 className={openAICompatibleComposeTitleClass}>
            {t('accounts.openai_provider_add')}
          </h3>
        </header>

        <div className={openAICompatibleComposeBodyClass} data-openai-compatible-compose-body>
          <div className="grid gap-5">
            <label className="space-y-2">
              <div className={openAICompatibleComposeLabelClass}>
                {t('accounts.openai_provider_preset')}
              </div>
              <select
                value={selectedPresetID}
                onChange={(event) => onPresetChange(event.target.value)}
                className={openAICompatibleComposeInputClass}
              >
                <option value="">{t('accounts.openai_provider_preset_custom')}</option>
                {openAICompatibleProviderPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p className={openAICompatibleComposeHintClass}>
                {t('accounts.openai_provider_preset_hint')}
              </p>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <div className={openAICompatibleComposeLabelClass}>
                  {t('accounts.openai_provider_name')}
                </div>
                <input
                  value={form.name}
                  onChange={(event) => onChange({ ...form, name: event.target.value })}
                  className={openAICompatibleComposeInputClass}
                  placeholder={selectedPreset?.id || 'deepseek'}
                />
              </label>

              <label className="space-y-2">
                <div className={openAICompatibleComposeLabelClass}>
                  {t('accounts.ui_base_url')}
                </div>
                <input
                  value={form.baseUrl}
                  onChange={(event) => onChange({ ...form, baseUrl: event.target.value })}
                  className={openAICompatibleComposeInputClass}
                  placeholder={selectedPreset?.baseUrl || 'https://api.deepseek.com/v1'}
                />
              </label>
            </div>

            <label className="space-y-2">
              <div className={openAICompatibleComposeLabelClass}>
                {t('accounts.ui_api_key')}
              </div>
              <input
                value={form.apiKey}
                onChange={(event) => onChange({ ...form, apiKey: event.target.value })}
                className={openAICompatibleComposeInputClass}
                type="password"
                placeholder={selectedPreset?.apiKeyPlaceholder || 'sk-...'}
              />
            </label>
          </div>

          {error ? (
            <div className={openAICompatibleComposeErrorClass} data-openai-compatible-compose-error>
              {error}
            </div>
          ) : null}
        </div>

        <footer className={openAICompatibleComposeFooterClass} data-openai-compatible-compose-footer>
          <button type="button" onClick={onClose} className={openAICompatibleComposeButtonClass}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onSubmit} className={openAICompatibleComposePrimaryButtonClass}>
            {t('common.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
