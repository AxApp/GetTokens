import type { MutableRefObject } from 'react';
import { Button, Tooltip } from 'antd';
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
            <Tooltip title={t('accounts.refresh_accounts')}>
              <Button
                size="large"
                onClick={onRefreshAccounts}
                disabled={!ready || loading}
                aria-label={t('accounts.refresh_accounts')}
                icon={<RefreshCw className={loading ? 'animate-spin' : ''} size={16} strokeWidth={2} />}
              >
              </Button>
            </Tooltip>
            <Tooltip title={t('accounts.refresh_runtime_hint')}>
              <Button
                size="large"
                onClick={onRefreshRuntime}
                disabled={!ready || loading || runtimeRefreshing}
                aria-busy={runtimeRefreshing ? 'true' : undefined}
                data-accounts-runtime-refreshing={runtimeRefreshing ? 'true' : undefined}
                aria-label={t('accounts.refresh_runtime')}
                icon={<Activity className="h-4 w-4" size={16} strokeWidth={2} />}
              >
              </Button>
            </Tooltip>
            <div ref={headerActionsMenuRef} className="relative">
              <Button
                size="large"
                onClick={onToggleMenu}
                aria-label={t('accounts.header_actions_menu')}
                aria-expanded={isHeaderActionsMenuOpen}
                aria-haspopup="menu"
                icon={<Menu size={16} strokeWidth={2} />}
              >
              </Button>
              {isHeaderActionsMenuOpen ? (
                <div className={ACCOUNT_HEADER_MENU_PANEL_CLASS}>
                  <div className="grid gap-1">
                    {headerActionsMenuItems.map((item) => (
                      <div key={item.id} className="grid gap-1">
                        {item.dividerBefore ? <div className={ACCOUNT_HEADER_MENU_SEPARATOR_CLASS} /> : null}
                        <Button
                          size="small"
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
                        </Button>
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
