import type { ClickEventLike, Translator } from '../model/types';

interface PasteAuthModalProps {
  t: Translator;
  pasteContent: string;
  pasteError: string;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function PasteAuthModal({
  t,
  pasteContent,
  pasteError,
  onClose,
  onChange,
  onSubmit,
}: PasteAuthModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.import_auth_file')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('accounts.paste_auth_file_title')}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <textarea
            autoFocus
            value={pasteContent}
            onChange={(event) => onChange(event.target.value)}
            className="input-swiss h-64 w-full resize-none font-mono text-xs"
            placeholder={t('accounts.paste_auth_file_placeholder')}
          />
          {pasteError ? (
            <div className="text-[10px] font-black uppercase tracking-wide text-red-500">{pasteError}</div>
          ) : null}
        </div>
        <footer className="flex items-center justify-end gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className="btn-swiss">
            {t('common.upload')}
          </button>
        </footer>
      </div>
    </div>
  );
}
