export type AppCloseAction = 'quit_app_and_service' | 'keep_service_in_menu_bar';

export interface AppRuntimeUIState {
  closeAction: AppCloseAction;
  menuBarResident: boolean;
  showMenuBarIcon: boolean;
}

export function normalizeAppCloseAction(value: unknown): AppCloseAction {
  return value === 'keep_service_in_menu_bar' ? 'keep_service_in_menu_bar' : 'quit_app_and_service';
}

export function resolveAppRuntimeUIState(
  closeAction: unknown,
  showMenuBarIcon: boolean,
): AppRuntimeUIState {
  const normalizedCloseAction = normalizeAppCloseAction(closeAction);
  const menuBarResident = normalizedCloseAction === 'keep_service_in_menu_bar';

  return {
    closeAction: normalizedCloseAction,
    menuBarResident,
    showMenuBarIcon: menuBarResident ? true : showMenuBarIcon,
  };
}
