import type { MutableRefObject } from 'react';
import { Activity, KeyRound, LogIn, Menu, Plus, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import type { Translator } from '../model/types';
import {
  ACCOUNT_HEADER_MENU_ICON_CLASS,
  ACCOUNT_HEADER_MENU_ITEM_CLASS,
  ACCOUNT_HEADER_MENU_LABEL_CLASS,
  ACCOUNT_HEADER_MENU_PANEL_CLASS,
  ACCOUNT_HEADER_MENU_SEPARATOR_CLASS,
  buildAccountsHeaderMenuItems,
  type AccountHeaderMenuIcon,
} from './accountHeaderMenu';

interface AccountsHeaderProps {
  t: Translator;
  accountCount: number;
  ready: boolean;
  loading: boolean;
  runtimeRefreshing?: boolean;
  isHeaderActionsMenuOpen: boolean;
  headerActionsMenuRef: MutableRefObject<HTMLDivElement | null>;
  onToggleMenu: () => void;
  onOpenImportModal: () => void;
  onOpenApiKeyModal: () => void;
  onOpenRotationModal?: () => void;
  onStartCodexOAuth: () => void;
  onRefreshAccounts: () => void;
  onRefreshRuntime: () => void;
  onOpenUnifiedCompose?: () => void;
}

export default function AccountsHeader({
  t,
  accountCount,
  ready,
  loading,
  runtimeRefreshing = false,
  isHeaderActionsMenuOpen,
  headerActionsMenuRef,
  onToggleMenu,
  onOpenImportModal,
  onOpenApiKeyModal,
  onOpenRotationModal,
  onStartCodexOAuth,
  onRefreshAccounts,
  onRefreshRuntime,
  onOpenUnifiedCompose,
}: AccountsHeaderProps) {
  const headerActionsMenuItems = buildAccountsHeaderMenuItems({
    ready,
    loading,
    includeUnifiedCompose: Boolean(onOpenUnifiedCompose),
    includeRotationSettings: Boolean(onOpenRotationModal),
  });

  function closeMenu() {
    if (isHeaderActionsMenuOpen) {
      onToggleMenu();
    }
  }

  function handleMenuAction(action: () => void) {
    closeMenu();
    action();
  }

  function renderMenuIcon(icon: AccountHeaderMenuIcon) {
    switch (icon) {
      case 'plus':
        return <Plus className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'log-in':
        return <LogIn className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'upload':
        return <Upload className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'key-round':
        return <KeyRound className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      case 'rotate-ccw':
        return <RotateCcw className={ACCOUNT_HEADER_MENU_ICON_CLASS} strokeWidth={3} />;
      default:
        return null;
    }
  }

  return (
    <div className="contents">
      <WorkspacePageHeader
        title={t('accounts.title')}
        subtitle={
          <>
            {t('accounts.subtitle')} · {accountCount}
          </>
        }
        actions={
          <>
            <button
              onClick={onRefreshAccounts}
              className="parchment-toolbar-action-secondary flex h-10 w-10 items-center justify-center !px-0"
              disabled={!ready || loading}
              title={t('accounts.refresh_accounts')}
              aria-label={t('accounts.refresh_accounts')}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
            </button>
            <button
              onClick={onRefreshRuntime}
              className="parchment-toolbar-action-secondary flex h-10 w-10 items-center justify-center !px-0"
              disabled={!ready || loading || runtimeRefreshing}
              aria-busy={runtimeRefreshing ? 'true' : undefined}
              data-accounts-runtime-refreshing={runtimeRefreshing ? 'true' : undefined}
              title={t('accounts.refresh_runtime_hint')}
              aria-label={t('accounts.refresh_runtime')}
            >
              <Activity className={`h-4 w-4 ${runtimeRefreshing ? 'animate-pulse' : ''}`} strokeWidth={2} />
            </button>
            <div ref={headerActionsMenuRef} className="relative">
              <button
                onClick={onToggleMenu}
                className="parchment-toolbar-action-secondary flex h-10 w-10 items-center justify-center !px-0"
                aria-label={t('accounts.header_actions_menu')}
                aria-expanded={isHeaderActionsMenuOpen}
                aria-haspopup="menu"
              >
                <Menu className="h-4 w-4" strokeWidth={2} />
              </button>
              {isHeaderActionsMenuOpen ? (
                <div className={ACCOUNT_HEADER_MENU_PANEL_CLASS}>
                  <div className="grid gap-1">
                    {headerActionsMenuItems.map((item) => (
                      <div key={item.id} className="grid gap-1">
                        {item.dividerBefore ? <div className={ACCOUNT_HEADER_MENU_SEPARATOR_CLASS} /> : null}
                        <button
                          type="button"
                          onClick={() => {
                            if (item.id === 'unified-compose') {
                              handleMenuAction(() => {
                                onOpenUnifiedCompose?.();
                              });
                              return;
                            }

                            if (item.id === 'chatgpt-login') {
                              handleMenuAction(() => {
                                onStartCodexOAuth();
                              });
                              return;
                            }

                            if (item.id === 'account-import') {
                              handleMenuAction(() => {
                                onOpenImportModal();
                              });
                              return;
                            }

                            if (item.id === 'codex-api-key') {
                              handleMenuAction(() => {
                                onOpenApiKeyModal();
                              });
                              return;
                            }

                            if (item.id === 'rotation-settings') {
                              handleMenuAction(() => {
                                onOpenRotationModal?.();
                              });
                            }
                          }}
                          disabled={item.disabled}
                          className={`${ACCOUNT_HEADER_MENU_ITEM_CLASS} ${item.emphasis ? 'bg-[var(--gt-surface-muted)]' : ''}`}
                          data-account-header-menu-item={item.id}
                        >
                          {renderMenuIcon(item.icon)}
                          <span className={ACCOUNT_HEADER_MENU_LABEL_CLASS}>{t(item.labelKey)}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        }
      />
    </div>
  );
}
