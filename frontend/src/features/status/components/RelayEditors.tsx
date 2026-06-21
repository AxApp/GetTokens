import {
  generateRandomRelayKey,
  type RelayKeyEditorState,
  type RelayModelEditorState,
  type RelayProviderEditorState,
} from '../model/relayLocalState';

const relayEditorBackdropClass =
  'fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-8 backdrop-blur-sm';
const relayEditorModalPanelClass =
  'flex w-full max-w-xl flex-col overflow-hidden rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-lg';
const relayEditorModalHeaderClass = 'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-4';
const relayEditorEyebrowClass = 'text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]';
const relayEditorTitleClass = 'mt-1 text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]';
const relayEditorLabelClass = 'text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-muted)]';
const relayEditorInputClass =
  'h-9 w-full rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-primary)] outline-none transition placeholder:text-[var(--gt-ink-muted)] focus:border-[var(--gt-border-strong)] disabled:cursor-not-allowed disabled:opacity-60';
const relayEditorInlineButtonClass =
  'absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-1 text-[length:var(--gt-font-size-xs)] font-medium text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] active:scale-95';
const relayEditorErrorClass =
  'rounded border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-4 py-3 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-status-danger)]';
const relayEditorFooterClass =
  'flex items-center justify-between border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-4';
const relayEditorSecondaryButtonClass =
  'inline-flex h-9 items-center justify-center rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]';
const relayEditorPrimaryButtonClass =
  'inline-flex h-9 items-center justify-center rounded border border-[var(--gt-border-strong)] bg-[var(--gt-ink-primary)] px-3 text-[length:var(--gt-font-size-sm)] font-medium text-[var(--gt-surface-canvas)] transition hover:opacity-90';

interface RelayKeyEditorModalProps {
  editor: RelayKeyEditorState;
  t: (key: string) => string;
  onClose: () => void;
  onChange: (next: RelayKeyEditorState) => void;
  onSubmit: () => void;
}

export function RelayKeyEditorModal({
  editor,
  t,
  onClose,
  onChange,
  onSubmit,
}: RelayKeyEditorModalProps) {
  return (
    <div
      className={relayEditorBackdropClass}
      onClick={onClose}
    >
      <div
        data-status-relay-editor-modal="key"
        className={relayEditorModalPanelClass}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={relayEditorModalHeaderClass}>
          <div className={relayEditorEyebrowClass}>
            {t('status.service_api_keys')}
          </div>
          <h3 className={relayEditorTitleClass}>
            {editor.mode === 'create' ? t('status.service_key_create_title') : t('status.service_key_rename')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <label className="space-y-2">
            <span className={relayEditorLabelClass}>
              {t('status.service_key_name_label')}
            </span>
            <input
              value={editor.name}
              onChange={(event) => onChange({ ...editor, name: event.target.value, error: '' })}
              className={relayEditorInputClass}
              placeholder={t('status.service_key_name_placeholder')}
            />
          </label>
          <label className="space-y-2">
            <span className={relayEditorLabelClass}>
              {t('status.service_key_value_label')}
            </span>
            <div className="relative">
              <input
                value={editor.apiKey}
                onChange={(event) => onChange({ ...editor, apiKey: event.target.value, error: '' })}
                className={`${relayEditorInputClass} pr-24`}
                placeholder={t('status.service_key_value_placeholder')}
                type="text"
                disabled={editor.mode === 'rename'}
              />
              {editor.mode === 'create' ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...editor, apiKey: generateRandomRelayKey(), error: '' })}
                  className={relayEditorInlineButtonClass}
                >
                  {t('status.service_key_value_generate')}
                </button>
              ) : null}
            </div>
          </label>
          {editor.error ? (
            <div className={relayEditorErrorClass}>
              {editor.error}
            </div>
          ) : null}
        </div>
        <footer className={relayEditorFooterClass}>
          <button onClick={onClose} className={relayEditorSecondaryButtonClass}>
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className={relayEditorPrimaryButtonClass}>
            {editor.mode === 'create' ? t('status.service_key_create_submit') : t('common.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}

interface RelayProviderEditorModalProps {
  editor: RelayProviderEditorState;
  t: (key: string) => string;
  onClose: () => void;
  onChange: (next: RelayProviderEditorState) => void;
  onSubmit: () => void;
}

export function RelayProviderEditorModal({
  editor,
  t,
  onClose,
  onChange,
  onSubmit,
}: RelayProviderEditorModalProps) {
  return (
    <div
      className={relayEditorBackdropClass}
      onClick={onClose}
    >
      <div
        data-status-relay-editor-modal="provider"
        className={relayEditorModalPanelClass}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={relayEditorModalHeaderClass}>
          <div className={relayEditorEyebrowClass}>
            {t('status.provider_title')}
          </div>
          <h3 className={relayEditorTitleClass}>
            {t('status.provider_create_title')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <label className="space-y-2">
            <span className={relayEditorLabelClass}>
              {t('status.provider_id_label')}
            </span>
            <input
              value={editor.providerID}
              onChange={(event) => onChange({ ...editor, providerID: event.target.value, error: '' })}
              className={relayEditorInputClass}
              placeholder={t('status.provider_id_placeholder')}
            />
          </label>
          {editor.error ? (
            <div className={relayEditorErrorClass}>
              {editor.error}
            </div>
          ) : null}
        </div>
        <footer className={relayEditorFooterClass}>
          <button onClick={onClose} className={relayEditorSecondaryButtonClass}>
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className={relayEditorPrimaryButtonClass}>
            {t('status.provider_create_submit')}
          </button>
        </footer>
      </div>
    </div>
  );
}

interface RelayModelEditorModalProps {
  editor: RelayModelEditorState;
  t: (key: string) => string;
  onClose: () => void;
  onChange: (next: RelayModelEditorState) => void;
  onSubmit: () => void;
}

export function RelayModelEditorModal({
  editor,
  t,
  onClose,
  onChange,
  onSubmit,
}: RelayModelEditorModalProps) {
  return (
    <div
      className={relayEditorBackdropClass}
      onClick={onClose}
    >
      <div
        data-status-relay-editor-modal="model"
        className={relayEditorModalPanelClass}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={relayEditorModalHeaderClass}>
          <div className={relayEditorEyebrowClass}>
            {t('status.model_name_title')}
          </div>
          <h3 className={relayEditorTitleClass}>
            {t('status.model_name_create_title')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <label className="space-y-2">
            <span className={relayEditorLabelClass}>
              {t('status.model_name_label')}
            </span>
            <input
              value={editor.value}
              onChange={(event) => onChange({ ...editor, value: event.target.value, error: '' })}
              className={relayEditorInputClass}
              placeholder={t('status.model_name_placeholder')}
            />
          </label>
          {editor.error ? (
            <div className={relayEditorErrorClass}>
              {editor.error}
            </div>
          ) : null}
        </div>
        <footer className={relayEditorFooterClass}>
          <button onClick={onClose} className={relayEditorSecondaryButtonClass}>
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className={relayEditorPrimaryButtonClass}>
            {t('status.model_name_create_submit')}
          </button>
        </footer>
      </div>
    </div>
  );
}
