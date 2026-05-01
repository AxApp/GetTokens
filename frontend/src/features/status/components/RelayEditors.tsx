import {
  generateRandomRelayKey,
  type RelayKeyEditorState,
  type RelayModelEditorState,
  type RelayProviderEditorState,
} from '../model/relayLocalState';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('status.service_api_keys')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {editor.mode === 'create' ? t('status.service_key_create_title') : t('status.service_key_rename')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <label className="space-y-2">
            <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('status.service_key_name_label')}
            </span>
            <input
              value={editor.name}
              onChange={(event) => onChange({ ...editor, name: event.target.value, error: '' })}
              className="input-swiss w-full"
              placeholder={t('status.service_key_name_placeholder')}
            />
          </label>
          <label className="space-y-2">
            <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('status.service_key_value_label')}
            </span>
            <div className="relative">
              <input
                value={editor.apiKey}
                onChange={(event) => onChange({ ...editor, apiKey: event.target.value, error: '' })}
                className="input-swiss w-full pr-24"
                placeholder={t('status.service_key_value_placeholder')}
                type="text"
                disabled={editor.mode === 'rename'}
              />
              {editor.mode === 'create' ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...editor, apiKey: generateRandomRelayKey(), error: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[0.5625rem] font-black uppercase tracking-wide text-[var(--text-primary)] active:scale-95"
                >
                  {t('status.service_key_value_generate')}
                </button>
              ) : null}
            </div>
          </label>
          {editor.error ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
              {editor.error}
            </div>
          ) : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('status.provider_title')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('status.provider_create_title')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <label className="space-y-2">
            <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('status.provider_id_label')}
            </span>
            <input
              value={editor.providerID}
              onChange={(event) => onChange({ ...editor, providerID: event.target.value, error: '' })}
              className="input-swiss w-full"
              placeholder={t('status.provider_id_placeholder')}
            />
          </label>
          <label className="space-y-2">
            <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('status.provider_name_label')}
            </span>
            <input
              value={editor.providerName}
              onChange={(event) => onChange({ ...editor, providerName: event.target.value, error: '' })}
              className="input-swiss w-full"
              placeholder={t('status.provider_name_placeholder')}
            />
          </label>
          {editor.error ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
              {editor.error}
            </div>
          ) : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('status.model_name_title')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('status.model_name_create_title')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <label className="space-y-2">
            <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('status.model_name_label')}
            </span>
            <input
              value={editor.value}
              onChange={(event) => onChange({ ...editor, value: event.target.value, error: '' })}
              className="input-swiss w-full"
              placeholder={t('status.model_name_placeholder')}
            />
          </label>
          {editor.error ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
              {editor.error}
            </div>
          ) : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
            {t('status.model_name_create_submit')}
          </button>
        </footer>
      </div>
    </div>
  );
}
