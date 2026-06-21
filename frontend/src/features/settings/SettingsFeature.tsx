import { useEffect, useRef, useState } from 'react';
import { Segmented, Switch } from 'antd';
import {
  ApplyUpdate,
  CheckUpdate,
  GetAppRuntimeSettings,
  GetLocalProjectedUsageSettings,
  GetSidecarProxySettings,
  UpdateAppRuntimeSettings,
  UpdateLocalProjectedUsageSettings,
  UpdateSidecarProxySettings,
} from '../../../wailsjs/go/main/App';
import { BrowserOpenURL, Quit } from '../../../wailsjs/runtime/runtime';
import SettingsReleasePanel from './components/SettingsReleasePanel';
import { useDebug } from '../../context/useDebug';
import { useI18n } from '../../context/I18nContext';
import { useTextScale } from '../../context/TextScaleContext';
import { buildGitHashCommit, buildGitHashLabel, formatBuildGitHash } from './settingsBuildMetadata';
import {
  buildGetTokensReleaseURL,
  buildGitHubCommitURL,
  cliProxyApiGitHubRepositoryURL,
  getTokensGitHubRepositoryURL,
  mapCheckedRelease,
} from './settingsRelease';
import {
  localProjectedUsageRefreshIntervalOptions,
  parseLocalProjectedUsageRefreshIntervalMinutes,
  resolveLocalProjectedUsageRefreshIntervalID,
  type LocalProjectedUsageRefreshIntervalID,
} from './settingsLocalUsage';
import {
  resolveAppRuntimeUIState,
  type AppCloseAction,
} from './settingsAppRuntime';
import {
  textScaleOptionIDs,
} from './settingsTextScale';
import { toErrorMessage } from '../../utils/error';
import { hasWailsAppBindings, hasWailsRuntime } from '../../utils/previewMode';
import { formatAppVersion } from '../../utils/version';
import type { LocaleCode, ReleaseInfo, SegmentedOption, SidecarStatus } from '../../types';

const languages: ReadonlyArray<SegmentedOption<LocaleCode>> = [
  { id: 'zh', label: '简体中文' },
  { id: 'en', label: 'ENGLISH' },
];

const closeActionOptions: ReadonlyArray<SegmentedOption<AppCloseAction>> = [
  { id: 'quit_app_and_service', label: 'QUIT' },
  { id: 'keep_service_in_menu_bar', label: 'MENUBAR' },
];

function toAntdSegmentedOptions<T extends string>(options: ReadonlyArray<SegmentedOption<T>>) {
  return options.map((option) => ({ label: option.label, value: option.id }));
}

const settingsRowClass = 'flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0';
const settingsRowLabelClass = 'text-[length:var(--gt-font-size-body)] font-semibold text-[var(--gt-ink-primary)]';
const settingsRowDescriptionClass = 'mt-1 text-[length:var(--gt-font-size-xs)] font-medium leading-5 text-[var(--gt-ink-muted)]';
const settingsRowControlClass = 'flex shrink-0 items-center justify-end';

interface SettingsFeatureProps {
  version: string;
  releaseLabel: string;
  sidecarStatus: SidecarStatus;
  canApplyUpdate: boolean;
  usesNativeUpdaterUI: boolean;
  availableRelease: ReleaseInfo | null;
  setAvailableRelease: (release: ReleaseInfo | null) => void;
}

export default function SettingsFeature({
  version,
  releaseLabel,
  sidecarStatus,
  canApplyUpdate,
  usesNativeUpdaterUI,
  availableRelease,
  setAvailableRelease,
}: SettingsFeatureProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { textScale, setTextScale } = useTextScale();
  const { locale, setLocale, t } = useI18n();
  const { trackRequest } = useDebug();
  const [updateMessage, setUpdateMessage] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [isOpeningRelease, setIsOpeningRelease] = useState(false);
  const [localUsageInterval, setLocalUsageInterval] = useState<LocalProjectedUsageRefreshIntervalID>('15');
  const [localUsageMessage, setLocalUsageMessage] = useState('');
  const [isLoadingLocalUsageSettings, setIsLoadingLocalUsageSettings] = useState(true);
  const [isSavingLocalUsageSettings, setIsSavingLocalUsageSettings] = useState(false);
  const [useSystemProxy, setUseSystemProxy] = useState(false);
  const [sidecarProxyConfigPath, setSidecarProxyConfigPath] = useState('');
  const [sidecarProxyMessage, setSidecarProxyMessage] = useState('');
  const [isLoadingSidecarProxySettings, setIsLoadingSidecarProxySettings] = useState(true);
  const [isSavingSidecarProxySettings, setIsSavingSidecarProxySettings] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [launchAtLoginSupported, setLaunchAtLoginSupported] = useState(false);
  const [closeAction, setCloseAction] = useState<AppCloseAction>('quit_app_and_service');
  const [menuBarResident, setMenuBarResident] = useState(false);
  const [showMenuBarIcon, setShowMenuBarIcon] = useState(true);
  const [appRuntimeMessage, setAppRuntimeMessage] = useState('');
  const [isLoadingAppRuntimeSettings, setIsLoadingAppRuntimeSettings] = useState(true);
  const [isSavingAppRuntimeSettings, setIsSavingAppRuntimeSettings] = useState(false);
  const currentVersionLabel = formatAppVersion(version);
  const latestReleaseLabel = availableRelease ? formatAppVersion(availableRelease.version) : '—';
  const cliProxyApiGitHashLabel = formatBuildGitHash(sidecarStatus.gitHash);
  const currentReleaseGitHubURL = buildGetTokensReleaseURL(currentVersionLabel);
  const latestReleaseGitHubURL = availableRelease?.releaseUrl ?? '';
  const gitHashGitHubURL = buildGitHubCommitURL(getTokensGitHubRepositoryURL, buildGitHashCommit);
  const cliProxyApiGitHashGitHubURL = buildGitHubCommitURL(cliProxyApiGitHubRepositoryURL, sidecarStatus.gitHash ?? '');
  const textScaleOptions: ReadonlyArray<SegmentedOption<typeof textScale>> = [
    { id: 'default', label: t('settings.text_scale_default') },
    { id: 'large', label: t('settings.text_scale_large') },
    { id: 'x-large', label: t('settings.text_scale_x_large') },
  ];

  useEffect(() => {
    let mounted = true;

    async function loadAppRuntimeSettings() {
      setIsLoadingAppRuntimeSettings(true);
      setAppRuntimeMessage('');
      if (!hasWailsAppBindings()) {
        setLaunchAtLogin(false);
        setLaunchAtLoginSupported(false);
        setCloseAction('quit_app_and_service');
        setMenuBarResident(false);
        setShowMenuBarIcon(true);
        setAppRuntimeMessage(t('settings.app_lifecycle_preview'));
        setIsLoadingAppRuntimeSettings(false);
        return;
      }
      try {
        const settings = await trackRequest<any>(
          'GetAppRuntimeSettings',
          { args: [] },
          () => GetAppRuntimeSettings(),
        );
        if (!mounted) return;
        setLaunchAtLogin(Boolean(settings?.launchAtLogin));
        setLaunchAtLoginSupported(Boolean(settings?.launchAtLoginSupported));
        const runtimeState = resolveAppRuntimeUIState(settings?.closeAction, settings?.showMenuBarIcon !== false);
        setCloseAction(runtimeState.closeAction);
        setMenuBarResident(Boolean(settings?.menuBarResident));
        setShowMenuBarIcon(runtimeState.showMenuBarIcon);
      } catch (error) {
        if (!mounted) return;
        setAppRuntimeMessage(`${t('settings.app_lifecycle_failed')}: ${toErrorMessage(error)}`);
      } finally {
        if (mounted) {
          setIsLoadingAppRuntimeSettings(false);
        }
      }
    }

    void loadAppRuntimeSettings();

    return () => {
      mounted = false;
    };
  }, [t, trackRequest]);

  useEffect(() => {
    let mounted = true;

    async function loadLocalUsageSettings() {
      setIsLoadingLocalUsageSettings(true);
      setLocalUsageMessage('');
      if (!hasWailsAppBindings()) {
        setLocalUsageInterval('15');
        setLocalUsageMessage('');
        setIsLoadingLocalUsageSettings(false);
        return;
      }
      try {
        const settings = await trackRequest<any>(
          'GetLocalProjectedUsageSettings',
          { args: [] },
          () => GetLocalProjectedUsageSettings(),
        );
        if (!mounted) return;
        setLocalUsageInterval(resolveLocalProjectedUsageRefreshIntervalID(settings?.refreshIntervalMinutes ?? 15));
      } catch (error) {
        if (!mounted) return;
        setLocalUsageMessage(`${t('settings.local_usage_refresh_failed')}: ${toErrorMessage(error)}`);
      } finally {
        if (mounted) {
          setIsLoadingLocalUsageSettings(false);
        }
      }
    }

    void loadLocalUsageSettings();

    return () => {
      mounted = false;
    };
  }, [t, trackRequest]);

  useEffect(() => {
    let mounted = true;

    async function loadSidecarProxySettings() {
      setIsLoadingSidecarProxySettings(true);
      setSidecarProxyMessage('');
      if (!hasWailsAppBindings()) {
        setUseSystemProxy(false);
        setSidecarProxyConfigPath('');
        setSidecarProxyMessage('');
        setIsLoadingSidecarProxySettings(false);
        return;
      }
      try {
        const settings = await trackRequest<any>(
          'GetSidecarProxySettings',
          { args: [] },
          () => GetSidecarProxySettings(),
        );
        if (!mounted) return;
        setUseSystemProxy(Boolean(settings?.useSystemProxy));
        setSidecarProxyConfigPath(settings?.configPath ?? '');
      } catch (error) {
        if (!mounted) return;
        setSidecarProxyMessage(`${t('settings.system_proxy_failed')}: ${toErrorMessage(error)}`);
      } finally {
        if (mounted) {
          setIsLoadingSidecarProxySettings(false);
        }
      }
    }

    void loadSidecarProxySettings();

    return () => {
      mounted = false;
    };
  }, [t, trackRequest]);

  async function handleCheckUpdate() {
    setIsCheckingUpdate(true);
    setUpdateMessage('');
    try {
      if (usesNativeUpdaterUI) {
        await trackRequest('CheckUpdate', { args: [] }, () => CheckUpdate());
        setUpdateMessage(t('settings.native_update_invoked'));
        return;
      }
      const release = await trackRequest(
        'CheckUpdate',
        { args: [] },
        () => CheckUpdate(),
        {
          mapSuccess: (result) => mapCheckedRelease(result),
        }
      );
      setAvailableRelease(release ?? null);
      setUpdateMessage(release ? t('settings.update_available') : t('settings.update_up_to_date'));
    } catch (error) {
      setUpdateMessage(`${t('settings.update_error')}: ${toErrorMessage(error)}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  async function handleApplyUpdate() {
    if (!availableRelease || !canApplyUpdate) {
      return;
    }

    setIsApplyingUpdate(true);
    setUpdateMessage('');
    try {
      await trackRequest('ApplyUpdate', { version: availableRelease.version }, () => ApplyUpdate());
      setUpdateMessage(t('settings.update_applied'));
      Quit();
    } catch (error) {
      setUpdateMessage(`${t('settings.update_error')}: ${toErrorMessage(error)}`);
      setIsApplyingUpdate(false);
    }
  }

  async function handleOpenReleasePage() {
    if (!availableRelease) {
      return;
    }

    setIsOpeningRelease(true);
    setUpdateMessage('');
    try {
      openExternalURL(availableRelease.releaseUrl);
      setUpdateMessage(t('settings.update_redirected'));
    } catch (error) {
      setUpdateMessage(`${t('settings.update_error')}: ${toErrorMessage(error)}`);
      setIsOpeningRelease(false);
      return;
    }
    setIsOpeningRelease(false);
  }

  function handleOpenGitHubURL(url: string) {
    openExternalURL(url);
  }

  function openExternalURL(url: string) {
    if (!url) {
      return;
    }

    if (hasWailsRuntime()) {
      BrowserOpenURL(url);
      return;
    }

    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async function handleLocalUsageIntervalChange(value: LocalProjectedUsageRefreshIntervalID) {
    setLocalUsageInterval(value);
    setIsSavingLocalUsageSettings(true);
    setLocalUsageMessage('');
    if (!hasWailsAppBindings()) {
      setLocalUsageMessage(t('settings.local_usage_refresh_preview_saved'));
      setIsSavingLocalUsageSettings(false);
      return;
    }
    try {
      const settings = await trackRequest<any>(
        'UpdateLocalProjectedUsageSettings',
        { refreshIntervalMinutes: parseLocalProjectedUsageRefreshIntervalMinutes(value) },
        () =>
          UpdateLocalProjectedUsageSettings({
            refreshIntervalMinutes: parseLocalProjectedUsageRefreshIntervalMinutes(value),
          }),
      );
      setLocalUsageInterval(resolveLocalProjectedUsageRefreshIntervalID(settings?.refreshIntervalMinutes ?? 15));
      setLocalUsageMessage(t('settings.local_usage_refresh_saved'));
    } catch (error) {
      setLocalUsageMessage(`${t('settings.local_usage_refresh_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsSavingLocalUsageSettings(false);
    }
  }

  async function handleUseSystemProxyChange(checked: boolean) {
    setUseSystemProxy(checked);
    setIsSavingSidecarProxySettings(true);
    setSidecarProxyMessage('');
    if (!hasWailsAppBindings()) {
      setSidecarProxyMessage(t('settings.system_proxy_preview_saved'));
      setIsSavingSidecarProxySettings(false);
      return;
    }
    try {
      const settings = await trackRequest<any>(
        'UpdateSidecarProxySettings',
        { useSystemProxy: checked },
        () => UpdateSidecarProxySettings({ useSystemProxy: checked, configPath: sidecarProxyConfigPath, appliedToRunningSidecar: false }),
      );
      setUseSystemProxy(Boolean(settings?.useSystemProxy));
      setSidecarProxyConfigPath(settings?.configPath ?? sidecarProxyConfigPath);
      setSidecarProxyMessage(
        settings?.appliedToRunningSidecar
          ? t('settings.system_proxy_saved_live')
          : t('settings.system_proxy_saved_restart'),
      );
    } catch (error) {
      setUseSystemProxy(!checked);
      setSidecarProxyMessage(`${t('settings.system_proxy_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsSavingSidecarProxySettings(false);
    }
  }

  async function saveAppRuntimeSettings(
    nextLaunchAtLogin: boolean,
    nextCloseAction: AppCloseAction,
    nextShowMenuBarIcon: boolean = showMenuBarIcon,
  ) {
    const runtimeState = resolveAppRuntimeUIState(nextCloseAction, nextShowMenuBarIcon);
    const previousLaunchAtLogin = launchAtLogin;
    const previousCloseAction = closeAction;
    const previousMenuBarResident = menuBarResident;
    const previousShowMenuBarIcon = showMenuBarIcon;

    setLaunchAtLogin(nextLaunchAtLogin);
    setCloseAction(runtimeState.closeAction);
    setMenuBarResident(runtimeState.menuBarResident);
    setShowMenuBarIcon(runtimeState.showMenuBarIcon);
    setIsSavingAppRuntimeSettings(true);
    setAppRuntimeMessage('');
    if (!hasWailsAppBindings()) {
      setAppRuntimeMessage(t('settings.app_lifecycle_preview_saved'));
      setIsSavingAppRuntimeSettings(false);
      return;
    }
    try {
      const settings = await trackRequest<any>(
        'UpdateAppRuntimeSettings',
        { launchAtLogin: nextLaunchAtLogin, closeAction: runtimeState.closeAction, showMenuBarIcon: runtimeState.showMenuBarIcon },
        () =>
          UpdateAppRuntimeSettings({
            codexModelCatalogSyncEnabled: false,
            launchAtLogin: nextLaunchAtLogin,
            launchAtLoginSupported,
            closeAction: runtimeState.closeAction,
            menuBarResident: runtimeState.menuBarResident,
            showMenuBarIcon: runtimeState.showMenuBarIcon,
          }),
      );
      setLaunchAtLogin(Boolean(settings?.launchAtLogin));
      setLaunchAtLoginSupported(Boolean(settings?.launchAtLoginSupported));
      const savedRuntimeState = resolveAppRuntimeUIState(settings?.closeAction, settings?.showMenuBarIcon !== false);
      setCloseAction(savedRuntimeState.closeAction);
      setMenuBarResident(Boolean(settings?.menuBarResident));
      setShowMenuBarIcon(savedRuntimeState.showMenuBarIcon);
      setAppRuntimeMessage(t('settings.app_lifecycle_saved'));
    } catch (error) {
      setLaunchAtLogin(previousLaunchAtLogin);
      setCloseAction(previousCloseAction);
      setMenuBarResident(previousMenuBarResident);
      setShowMenuBarIcon(previousShowMenuBarIcon);
      setAppRuntimeMessage(`${t('settings.app_lifecycle_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsSavingAppRuntimeSettings(false);
    }
  }

  return (
    <div
      ref={pageRef}
      className="settings-page h-full w-full overflow-auto text-[var(--gt-ink-primary)]"
      data-settings-redesign="macos-preferences"
      data-settings-antd-spike="true"
    >
      <div className="mx-auto max-w-3xl space-y-8 px-8 py-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--gt-font-family-sans)' }}>
            {t('settings.title')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-sans)' }}>
            {t('settings.subtitle')}
          </p>
        </header>

        {/* Appearance */}
        <section data-settings-section="appearance">
          <h2 className="settings-section-title">{t('settings.appearance')}</h2>
          <div className="settings-group">
            <div className={settingsRowClass}>
              <div className="min-w-0 flex-1">
                <div className={settingsRowLabelClass}>{t('settings.language')}</div>
              </div>
              <div className={settingsRowControlClass}>
                <Segmented
                  options={toAntdSegmentedOptions(languages)}
                  value={locale}
                  onChange={(value) => setLocale(value as LocaleCode)}
                />
              </div>
            </div>
            <div className={settingsRowClass}>
              <div className="min-w-0 flex-1">
                <div className={settingsRowLabelClass}>{t('settings.text_scale')}</div>
                <div className={settingsRowDescriptionClass}>
                  {t('settings.text_scale_hint')}
                </div>
              </div>
              <div className={settingsRowControlClass}>
                <Segmented
                  options={toAntdSegmentedOptions(textScaleOptions)}
                  value={textScale}
                  onChange={(value) => setTextScale(value as typeof textScale)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* App Lifecycle */}
        <section data-settings-section="app-lifecycle">
          <h2 className="settings-section-title">{t('settings.app_lifecycle')}</h2>
          <div className="settings-group">
            <div className={settingsRowClass}>
              <div className="min-w-0 flex-1">
                <div className={settingsRowLabelClass}>{t('settings.launch_at_login')}</div>
                <div className={settingsRowDescriptionClass}>
                  {isLoadingAppRuntimeSettings
                    ? t('settings.app_lifecycle_loading')
                    : launchAtLoginSupported
                      ? t('settings.launch_at_login_hint')
                      : t('settings.launch_at_login_unsupported')}
                </div>
              </div>
              <div className={settingsRowControlClass}>
                <Switch
                  aria-label={t('settings.launch_at_login')}
                  checked={launchAtLogin}
                  disabled={isLoadingAppRuntimeSettings || isSavingAppRuntimeSettings || !launchAtLoginSupported}
                  onChange={(checked) => void saveAppRuntimeSettings(checked, closeAction)}
                />
              </div>
            </div>
            <div className={settingsRowClass}>
              <div className="min-w-0 flex-1">
                <div className={settingsRowLabelClass}>{t('settings.show_menu_bar_icon')}</div>
                <div className={settingsRowDescriptionClass}>
                  {closeAction === 'keep_service_in_menu_bar'
                    ? t('settings.show_menu_bar_icon_forced_hint')
                    : t('settings.show_menu_bar_icon_hint')}
                </div>
              </div>
              <div className={settingsRowControlClass}>
                <Switch
                  aria-label={t('settings.show_menu_bar_icon')}
                  checked={showMenuBarIcon}
                  disabled={isLoadingAppRuntimeSettings || isSavingAppRuntimeSettings || closeAction === 'keep_service_in_menu_bar'}
                  onChange={(checked) => void saveAppRuntimeSettings(launchAtLogin, closeAction, checked)}
                />
              </div>
            </div>
            <div className={settingsRowClass}>
              <div className="min-w-0 flex-1">
                <div className={settingsRowLabelClass}>{t('settings.close_action')}</div>
                <div className={settingsRowDescriptionClass}>
                  {isSavingAppRuntimeSettings
                    ? t('settings.app_lifecycle_saving')
                    : closeAction === 'keep_service_in_menu_bar'
                      ? t('settings.close_action_menubar_hint')
                      : t('settings.close_action_quit_hint')}
                </div>
              </div>
              <div className={settingsRowControlClass}>
                <Segmented
                  options={toAntdSegmentedOptions([
                    { ...closeActionOptions[0], label: t('settings.close_action_quit') },
                    { ...closeActionOptions[1], label: t('settings.close_action_menubar') },
                  ])}
                  value={closeAction}
                  onChange={(value) => void saveAppRuntimeSettings(launchAtLogin, value as AppCloseAction)}
                />
              </div>
            </div>
            {appRuntimeMessage ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--gt-status-danger)' }}>
                {appRuntimeMessage}
              </div>
            ) : null}
          </div>
        </section>

        {/* Local Usage Refresh */}
        <section data-settings-section="local-usage-refresh">
          <h2 className="settings-section-title">{t('settings.local_usage_refresh')}</h2>
          <div className="settings-group">
            <div className={settingsRowClass}>
              <div className="min-w-0 flex-1">
                <div className={settingsRowLabelClass}>{t('settings.local_usage_refresh_interval')}</div>
                <div className={settingsRowDescriptionClass}>
                  {isLoadingLocalUsageSettings
                    ? t('settings.local_usage_refresh_loading')
                    : isSavingLocalUsageSettings
                      ? t('settings.local_usage_refresh_saving')
                      : t('settings.local_usage_refresh_hint')}
                </div>
              </div>
              <div className={settingsRowControlClass}>
                <Segmented
                  options={toAntdSegmentedOptions(localProjectedUsageRefreshIntervalOptions)}
                  value={localUsageInterval}
                  onChange={(value) => void handleLocalUsageIntervalChange(value as LocalProjectedUsageRefreshIntervalID)}
                />
              </div>
            </div>
            {localUsageMessage ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--gt-status-danger)' }}>
                {localUsageMessage}
              </div>
            ) : null}
          </div>
        </section>

        {/* Network Proxy */}
        <section data-settings-section="network-proxy">
          <h2 className="settings-section-title">{t('settings.network_proxy')}</h2>
          <div className="settings-group">
            <div className={settingsRowClass}>
              <div className="min-w-0 flex-1">
                <div className={settingsRowLabelClass}>{t('settings.system_proxy')}</div>
                <div className={settingsRowDescriptionClass}>
                  {isLoadingSidecarProxySettings
                    ? t('settings.system_proxy_loading')
                    : isSavingSidecarProxySettings
                      ? t('settings.system_proxy_saving')
                      : t('settings.system_proxy_hint')}
                </div>
                {sidecarProxyConfigPath ? (
                  <div className="mt-1 break-all text-xs" style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}>
                    {sidecarProxyConfigPath}
                  </div>
                ) : null}
              </div>
              <div className={settingsRowControlClass}>
                <Switch
                  aria-label={t('settings.system_proxy')}
                  checked={useSystemProxy}
                  disabled={isLoadingSidecarProxySettings || isSavingSidecarProxySettings}
                  onChange={(checked) => void handleUseSystemProxyChange(checked)}
                />
              </div>
            </div>
            {sidecarProxyMessage ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--gt-status-danger)' }}>
                {sidecarProxyMessage}
              </div>
            ) : null}
          </div>
        </section>

        {/* Updates */}
        <section data-settings-section="updates">
          <h2 className="settings-section-title">{t('settings.updates')}</h2>
          <div className="settings-group">
            <SettingsReleasePanel
              currentVersionTitle={t('settings.current_version')}
              currentVersionLabel={currentVersionLabel}
              gitHashTitle={t('settings.git_hash')}
              gitHashLabel={buildGitHashLabel}
              cliProxyApiGitHashTitle="CLIProxyAPI Git Hash"
              cliProxyApiGitHashLabel={cliProxyApiGitHashLabel}
              latestReleaseTitle={t('settings.latest_release')}
              latestReleaseLabel={latestReleaseLabel}
              latestReleaseGitHubURL={latestReleaseGitHubURL}
              currentReleaseGitHubURL={currentReleaseGitHubURL}
              gitHashGitHubURL={gitHashGitHubURL}
              cliProxyApiGitHashGitHubURL={cliProxyApiGitHashGitHubURL}
              openGitHubLabel={t('settings.open_github')}
              onOpenGitHubURL={handleOpenGitHubURL}
              updateMessage={updateMessage}
              checkUpdateLabel={t('settings.check_update')}
              checkingUpdateLabel={t('settings.checking_update')}
              isCheckingUpdate={isCheckingUpdate}
              onCheckUpdate={handleCheckUpdate}
              showPrimaryUpdateAction={!usesNativeUpdaterUI}
              primaryUpdateLabel={
                canApplyUpdate
                  ? isApplyingUpdate
                    ? t('settings.applying_update')
                    : t('settings.apply_update')
                  : isOpeningRelease
                    ? t('settings.opening_release_page')
                    : t('settings.open_release_page')
              }
              primaryUpdateDisabled={!availableRelease || isApplyingUpdate || isOpeningRelease}
              onPrimaryUpdateAction={canApplyUpdate ? handleApplyUpdate : handleOpenReleasePage}
              updateActionHint={t(
                usesNativeUpdaterUI
                  ? 'settings.native_update_hint'
                  : canApplyUpdate
                    ? 'settings.apply_update_hint'
                    : 'settings.manual_update_hint'
              )}
            />
          </div>
        </section>

        <footer className="border-t pt-6 text-center" style={{ borderColor: 'var(--gt-border-subtle)' }}>
          <div className="text-xs font-medium" style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-mono)' }}>
            GetTokens {currentVersionLabel} · {releaseLabel || 'DEV'}
          </div>
        </footer>
      </div>
    </div>
  );
}
