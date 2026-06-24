import { Button, Input } from 'antd';
import {
  generateRandomRelayKey,
  type RelayKeyEditorState,
  type RelayModelEditorState,
  type RelayProviderEditorState,
} from '../model/relayLocalState';

const relayEditorBackdropClass =
  'fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-8';
const relayEditorModalPanelClass =
  'flex w-full max-w-xl flex-col overflow-hidden rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-sm';
const relayEditorModalHeaderClass = 'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-4';
const relayEditorEyebrowClass = 'text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const relayEditorTitleClass = 'mt-1 text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]';
const relayEditorLabelClass = 'text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const relayEditorInputClass =
  'h-9 w-full rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-raised)] px-3 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] outline-none transition-colors placeholder:text-[var(--gt-ink-muted)] focus:border-[var(--gt-border-strong)] disabled:cursor-not-allowed disabled:opacity-60';
const relayEditorErrorClass =
  'rounded border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-4 py-3 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-status-danger)]';
const relayEditorFooterClass =
  'flex items-center justify-between border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-4';

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
            <Input
              size="small"
              value={editor.name}
              onChange={(event) => onChange({ ...editor, name: event.target.value, error: '' })}
              placeholder={t('status.service_key_name_placeholder')}
            />
          </label>
          <label className="space-y-2">
            <span className={relayEditorLabelClass}>
              {t('status.service_key_value_label')}
            </span>
            <div className="relative">
              <Input
                size="small"
                value={editor.apiKey}
                onChange={(event) => onChange({ ...editor, apiKey: event.target.value, error: '' })}
                placeholder={t('status.service_key_value_placeholder')}
                disabled={editor.mode === 'rename'}
                className="pr-24"
              />
              {editor.mode === 'create' ? (
                <Button
                  size="small"
                  onClick={() => onChange({ ...editor, apiKey: generateRandomRelayKey(), error: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  {t('status.service_key_value_generate')}
                </Button>
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
          <Button size="small" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" size="small" onClick={onSubmit}>
            {editor.mode === 'create' ? t('status.service_key_create_submit') : t('common.save')}
          </Button>
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
            <Input
              size="small"
              value={editor.providerID}
              onChange={(event) => onChange({ ...editor, providerID: event.target.value, error: '' })}
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
          <Button size="small" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" size="small" onClick={onSubmit}>
            {t('status.provider_create_submit')}
          </Button>
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
            <Input
              size="small"
              value={editor.value}
              onChange={(event) => onChange({ ...editor, value: event.target.value, error: '' })}
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
          <Button size="small" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" size="small" onClick={onSubmit}>
            {t('status.model_name_create_submit')}
          </Button>
        </footer>
      </div>
    </div>
  );
}
