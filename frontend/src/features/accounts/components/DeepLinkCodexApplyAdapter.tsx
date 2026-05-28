import AccountLocalCliApplyConfirm, { type DeepLinkApplyContext } from './AccountLocalCliApplyConfirm';
import type {
  AccountCliApplyDraft,
  AccountLocalCliRelayKeyLike,
} from '../model/accountLocalCliMapping';

interface DeepLinkCodexApplyAdapterProps {
  draft: Extract<AccountCliApplyDraft, { target: 'codex' }>;
  relayKeyItems: AccountLocalCliRelayKeyLike[];
  context: DeepLinkApplyContext;
  applying: boolean;
  resultMessage: string;
  previewMode: boolean;
  onClose: () => void;
  onDraftChange: (draft: AccountCliApplyDraft) => void;
  onApply: (draft: AccountCliApplyDraft) => void;
  onImportAccountOnly?: () => void;
}

export default function DeepLinkCodexApplyAdapter({
  draft,
  relayKeyItems,
  context,
  applying,
  resultMessage,
  previewMode,
  onClose,
  onDraftChange,
  onApply,
  onImportAccountOnly,
}: DeepLinkCodexApplyAdapterProps) {
  return (
    <AccountLocalCliApplyConfirm
      draft={draft}
      relayKeyItems={relayKeyItems}
      applying={applying}
      resultMessage={resultMessage}
      previewMode={previewMode}
      deepLinkContext={context}
      onClose={onClose}
      onDraftChange={onDraftChange}
      onApply={onApply}
      onImportAccountOnly={context.resource === 'codex-setup' ? onImportAccountOnly : undefined}
    />
  );
}
