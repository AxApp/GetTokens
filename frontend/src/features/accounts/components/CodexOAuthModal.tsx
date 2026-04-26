import { useState } from 'react';
import { buildCodexOAuthDialogHint, buildCodexOAuthDialogTitle } from '../model/accountOAuth';
import type { ClickEventLike, Translator } from '../model/types';

interface CodexOAuthModalProps {
  t: Translator;
  existingName?: string | null;
  url: string;
  onClose: () => void;
  onOpenInBrowser: () => void;
}

export default function CodexOAuthModal({
  t,
  existingName,
  url,
  onClose,
  onOpenInBrowser,
}: CodexOAuthModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.login_chatgpt')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {buildCodexOAuthDialogTitle(t, existingName)}
          </h3>
        </header>
        <div className="space-y-4 p-6">
          <p className="text-[11px] font-bold leading-relaxed text-[var(--text-secondary)]">
            {buildCodexOAuthDialogHint(t, existingName)}
          </p>
          <div className="space-y-2">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {t('accounts.oauth_dialog_url_label')}
            </div>
            <div className="break-all border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 font-mono text-[11px] leading-relaxed text-[var(--text-primary)]">
              {url}
            </div>
            {copyState !== 'idle' ? (
              <div
                className={`text-[10px] font-black uppercase tracking-wide ${
                  copyState === 'success' ? 'text-green-700' : 'text-red-500'
                }`}
              >
                {copyState === 'success' ? t('accounts.oauth_dialog_copy_success') : t('accounts.oauth_dialog_copy_failed')}
              </div>
            ) : null}
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.close')}
          </button>
          <button onClick={() => void handleCopy()} className="btn-swiss">
            {t('accounts.oauth_dialog_copy_url')}
          </button>
          <button onClick={onOpenInBrowser} className="btn-swiss">
            {t('accounts.oauth_dialog_open_url')}
          </button>
        </footer>
      </div>
    </div>
  );
}
