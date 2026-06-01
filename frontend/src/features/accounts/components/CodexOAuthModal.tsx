import { useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import { buildCodexOAuthDialogHint, buildCodexOAuthDialogTitle } from '../model/accountOAuth';
import type { Translator } from '../model/types';

interface CodexOAuthModalProps {
  t: Translator;
  existingName?: string | null;
  url: string;
  onClose: () => void;
  onOpenInBrowser: () => void;
  onCopyUrl?: (url: string) => Promise<void> | void;
  initialCopyState?: 'idle' | 'success' | 'error';
}

export default function CodexOAuthModal({
  t,
  existingName,
  url,
  onClose,
  onOpenInBrowser,
  onCopyUrl,
  initialCopyState = 'idle',
}: CodexOAuthModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>(initialCopyState);

  async function handleCopy() {
    try {
      if (onCopyUrl) {
        await onCopyUrl(url);
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <ModalFrame
      onClose={onClose}
      size="md"
      portal
      coverViewport
      zIndexClassName="z-[70]"
      ariaLabel={buildCodexOAuthDialogTitle(t, existingName)}
      header={
        <>
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.login_chatgpt')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {buildCodexOAuthDialogTitle(t, existingName)}
          </h3>
        </>
      }
      headerClassName="px-6 py-4"
      bodyClassName="space-y-4 p-6"
      footerClassName="sm:!justify-end"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button onClick={onClose} className="btn-swiss">
            {t('common.close')}
          </button>
          <button onClick={() => void handleCopy()} className="btn-swiss">
            {t('accounts.oauth_dialog_copy_url')}
          </button>
          <button onClick={onOpenInBrowser} className="btn-swiss">
            {t('accounts.oauth_dialog_open_url')}
          </button>
        </div>
      }
    >
      <p className="text-[length:var(--font-size-ui-md-compact)] font-bold leading-relaxed text-[var(--text-secondary)]">
        {buildCodexOAuthDialogHint(t, existingName)}
      </p>
      <div className="space-y-2">
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {t('accounts.oauth_dialog_url_label')}
        </div>
        <div className="break-all border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 font-mono text-[length:var(--font-size-ui-md-compact)] leading-relaxed text-[var(--text-primary)]">
          {url}
        </div>
        {copyState !== 'idle' ? (
          <div
            className={`text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide ${
              copyState === 'success' ? 'text-[var(--color-status-success)]' : 'text-[var(--color-status-danger)]'
            }`}
          >
            {copyState === 'success' ? t('accounts.oauth_dialog_copy_success') : t('accounts.oauth_dialog_copy_failed')}
          </div>
        ) : null}
      </div>
    </ModalFrame>
  );
}
