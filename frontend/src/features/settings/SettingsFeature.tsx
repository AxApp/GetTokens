import { useEffect, useRef, useState } from 'react';
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
import SegmentedControl from '../../components/ui/SegmentedControl';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import { useTextScale } from '../../context/TextScaleContext';
import { useTheme } from '../../context/ThemeContext';
import { mapCheckedRelease } from './settingsRelease';
import {
  localProjectedUsageRefreshIntervalOptions,
  parseLocalProjectedUsageRefreshIntervalMinutes,
  resolveLocalProjectedUsageRefreshIntervalID,
  type LocalProjectedUsageRefreshIntervalID,
} from './settingsLocalUsage';
import {
  textScaleOptionIDs,
} from './settingsTextScale';
import { getSettingsSectionBadge, type SettingsSectionID } from './settingsLayout';
import { toErrorMessage } from '../../utils/error';
import { hasWailsAppBindings } from '../../utils/previewMode';
import { formatAppVersion } from '../../utils/version';
import type { LocaleCode, ReleaseInfo, SegmentedOption, ThemeMode } from '../../types';

const themes: ReadonlyArray<SegmentedOption<ThemeMode>> = [
  { id: 'system', label: 'SYSTEM' },
  { id: 'light', label: 'LIGHT' },
  { id: 'dark', label: 'DARK' },
];

const languages: ReadonlyArray<SegmentedOption<LocaleCode>> = [
  { id: 'zh', label: '简体中文' },
  { id: 'en', label: 'ENGLISH' },
];

type AppCloseAction = 'quit_app_and_service' | 'keep_service_in_menu_bar';

const closeActionOptions: ReadonlyArray<SegmentedOption<AppCloseAction>> = [
  { id: 'quit_app_and_service', label: 'QUIT' },
  { id: 'keep_service_in_menu_bar', label: 'MENUBAR' },
];

const sectionBadgeStyle = { fontSize: 'var(--gt-settings-section-badge-size, 8px)' } as const;
const sectionTitleStyle = { fontSize: 'var(--gt-settings-section-title-size, 12px)' } as const;
const fieldLabelStyle = { fontSize: 'var(--gt-settings-label-size, 9px)' } as const;
const fieldMetaStyle = { fontSize: 'var(--gt-settings-meta-size, 8px)' } as const;
const bodyTextStyle = { fontSize: 'var(--gt-settings-body-size, 9px)' } as const;
const valueTextStyle = { fontSize: 'var(--gt-settings-value-size, 10px)' } as const;

interface SettingsFeatureProps {
  version: string;
  releaseLabel: string;
  canApplyUpdate: boolean;
  usesNativeUpdaterUI: boolean;
  availableRelease: ReleaseInfo | null;
  setAvailableRelease: (release: ReleaseInfo | null) => void;
}

export default function SettingsFeature({
  version,
  releaseLabel,
  canApplyUpdate,
  usesNativeUpdaterUI,
  availableRelease,
  setAvailableRelease,
}: SettingsFeatureProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SettingsSectionID, HTMLElement | null>>>({});
  const { themeMode, setThemeMode } = useTheme();
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
  const [appRuntimeMessage, setAppRuntimeMessage] = useState('');
  const [isLoadingAppRuntimeSettings, setIsLoadingAppRuntimeSettings] = useState(true);
  const [isSavingAppRuntimeSettings, setIsSavingAppRuntimeSettings] = useState(false);
  const currentVersionLabel = formatAppVersion(version);
  const latestReleaseLabel = availableRelease ? formatAppVersion(availableRelease.version) : '—';
  const textScaleOptions: ReadonlyArray<SegmentedOption<typeof textScale>> = [
    { id: 'default', label: t('settings.text_scale_default') },
    { id: 'large', label: t('settings.text_scale_large') },
    { id: 'x-large', label: t('settings.text_scale_x_large') },
  ];
  const settingsSectionTabs: ReadonlyArray<{ id: SettingsSectionID; label: string; shortLabel: string }> = [
    { id: 'appearance', label: t('settings.appearance'), shortLabel: locale === 'zh' ? '外观' : 'LOOK' },
    { id: 'app_lifecycle', label: t('settings.app_lifecycle'), shortLabel: locale === 'zh' ? '启动' : 'RUN' },
    { id: 'local_usage_refresh', label: t('settings.local_usage_refresh'), shortLabel: locale === 'zh' ? '刷新' : 'SYNC' },
    { id: 'network_proxy', label: t('settings.network_proxy'), shortLabel: locale === 'zh' ? '代理' : 'NET' },
    { id: 'updates', label: t('settings.updates'), shortLabel: locale === 'zh' ? '更新' : 'UPD' },
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
        setCloseAction(settings?.closeAction === 'keep_service_in_menu_bar' ? 'keep_service_in_menu_bar' : 'quit_app_and_service');
        setMenuBarResident(Boolean(settings?.menuBarResident));
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
      BrowserOpenURL(availableRelease.releaseUrl);
      setUpdateMessage(t('settings.update_redirected'));
    } catch (error) {
      setUpdateMessage(`${t('settings.update_error')}: ${toErrorMessage(error)}`);
      setIsOpeningRelease(false);
      return;
    }
    setIsOpeningRelease(false);
  }

  async function handleLocalUsageIntervalChange(value: LocalProjectedUsageRefreshIntervalID) {
    setLocalUsageInterval(value);
    setIsSavingLocalUsageSettings(true);
    setLocalUsageMessage('');
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

  async function saveAppRuntimeSettings(nextLaunchAtLogin: boolean, nextCloseAction: AppCloseAction) {
    const previousLaunchAtLogin = launchAtLogin;
    const previousCloseAction = closeAction;
    const previousMenuBarResident = menuBarResident;

    setLaunchAtLogin(nextLaunchAtLogin);
    setCloseAction(nextCloseAction);
    setMenuBarResident(nextCloseAction === 'keep_service_in_menu_bar');
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
        { launchAtLogin: nextLaunchAtLogin, closeAction: nextCloseAction },
        () =>
          UpdateAppRuntimeSettings({
            launchAtLogin: nextLaunchAtLogin,
            launchAtLoginSupported,
            closeAction: nextCloseAction,
            menuBarResident: nextCloseAction === 'keep_service_in_menu_bar',
          }),
      );
      setLaunchAtLogin(Boolean(settings?.launchAtLogin));
      setLaunchAtLoginSupported(Boolean(settings?.launchAtLoginSupported));
      setCloseAction(settings?.closeAction === 'keep_service_in_menu_bar' ? 'keep_service_in_menu_bar' : 'quit_app_and_service');
      setMenuBarResident(Boolean(settings?.menuBarResident));
      setAppRuntimeMessage(t('settings.app_lifecycle_saved'));
    } catch (error) {
      setLaunchAtLogin(previousLaunchAtLogin);
      setCloseAction(previousCloseAction);
      setMenuBarResident(previousMenuBarResident);
      setAppRuntimeMessage(`${t('settings.app_lifecycle_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsSavingAppRuntimeSettings(false);
    }
  }

  function setSectionRef(sectionID: SettingsSectionID, element: HTMLElement | null) {
    sectionRefs.current[sectionID] = element;
  }

  function handleJumpToSection(sectionID: SettingsSectionID) {
    const container = pageRef.current;
    const section = sectionRefs.current[sectionID];

    if (!container || !section) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const top = container.scrollTop + sectionRect.top - containerRect.top - 24;

    container.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    });
  }

  return (
    <div ref={pageRef} className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_SETTINGS">
      <aside className="pointer-events-none fixed right-0 top-1/2 z-20 hidden -translate-y-1/2 lg:flex">
        <div className="pointer-events-auto flex flex-col gap-0.5 border-2 border-r-0 border-[var(--border-color)] bg-[var(--bg-main)] px-0.5 py-1 shadow-[-4px_4px_0_var(--shadow-color)]">
          {settingsSectionTabs.map((section) => (
            <button
              key={section.id}
              type="button"
              className="min-w-[2.5rem] border border-[var(--border-color)] bg-[var(--bg-surface)] px-1 py-1 text-center font-black uppercase italic text-[var(--text-primary)] transition-transform hover:-translate-x-1 active:scale-95"
              style={fieldMetaStyle}
              onClick={() => handleJumpToSection(section.id)}
              aria-label={section.label}
              title={section.label}
            >
              <span className="block text-[length:var(--font-size-ui-2xs)] leading-none tracking-[0.12em]">
                {section.shortLabel}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <WorkspacePageHeader
          title={t('settings.title')}
          subtitle={t('settings.subtitle')}
        />

        <div className="space-y-6">
          <section ref={(element) => setSectionRef('appearance', element)} className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono font-black uppercase text-[var(--bg-main)]"
                style={sectionBadgeStyle}
              >
                {getSettingsSectionBadge('appearance')}
              </span>
              <h3 className="font-black uppercase italic tracking-tighter text-[var(--text-primary)]" style={sectionTitleStyle}>
                {t('settings.appearance')}
              </h3>
            </div>

            <div className="card-swiss !p-0 divide-y-2 divide-[var(--border-color)]">
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="font-black uppercase italic tracking-widest text-[var(--text-muted)]" style={fieldLabelStyle}>
                    {t('settings.theme_mode')}
                  </label>
                  <span className="font-mono font-bold italic opacity-30 text-[var(--text-muted)]" style={fieldMetaStyle}>
                    CONFIG_X_THEME
                  </span>
                </div>
                <SegmentedControl options={themes} value={themeMode} onChange={setThemeMode} />
              </div>

              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="font-black uppercase italic tracking-widest text-[var(--text-muted)]" style={fieldLabelStyle}>
                    {t('settings.language')}
                  </label>
                  <span className="font-mono font-bold italic opacity-30 text-[var(--text-muted)]" style={fieldMetaStyle}>
                    CONFIG_X_LANG
                  </span>
                </div>
                <SegmentedControl options={languages} value={locale} onChange={setLocale} />
              </div>

              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="font-black uppercase italic tracking-widest text-[var(--text-muted)]" style={fieldLabelStyle}>
                    {t('settings.text_scale')}
                  </label>
                  <span className="font-mono font-bold italic opacity-30 text-[var(--text-muted)]" style={fieldMetaStyle}>
                    CONFIG_X_TEXT_SCALE
                  </span>
                </div>
                <SegmentedControl options={textScaleOptions} value={textScale} onChange={setTextScale} />
                <div className="font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]" style={bodyTextStyle}>
                  {t('settings.text_scale_hint')}
                </div>
              </div>
            </div>
          </section>

          <section ref={(element) => setSectionRef('app_lifecycle', element)} className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono font-black uppercase text-[var(--bg-main)]"
                style={sectionBadgeStyle}
              >
                {getSettingsSectionBadge('app_lifecycle')}
              </span>
              <h3 className="font-black uppercase italic tracking-tighter text-[var(--text-primary)]" style={sectionTitleStyle}>
                {t('settings.app_lifecycle')}
              </h3>
            </div>

            <div className="card-swiss !p-0 divide-y-2 divide-[var(--border-color)]">
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <label className="font-black uppercase italic tracking-widest text-[var(--text-muted)]" style={fieldLabelStyle}>
                      {t('settings.launch_at_login')}
                    </label>
                    <div className="mt-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]" style={bodyTextStyle}>
                      {isLoadingAppRuntimeSettings
                        ? t('settings.app_lifecycle_loading')
                        : launchAtLoginSupported
                          ? t('settings.launch_at_login_hint')
                          : t('settings.launch_at_login_unsupported')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold italic opacity-30 text-[var(--text-muted)]" style={fieldMetaStyle}>
                      LOGIN_ITEM
                    </span>
                    <ToggleSwitch
                      label={t('settings.launch_at_login')}
                      checked={launchAtLogin}
                      disabled={isLoadingAppRuntimeSettings || isSavingAppRuntimeSettings || !launchAtLoginSupported}
                      onChange={(checked) => void saveAppRuntimeSettings(checked, closeAction)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="font-black uppercase italic tracking-widest text-[var(--text-muted)]" style={fieldLabelStyle}>
                    {t('settings.close_action')}
                  </label>
                  <span className="font-mono font-bold italic opacity-30 text-[var(--text-muted)]" style={fieldMetaStyle}>
                    CLOSE_BEHAVIOR
                  </span>
                </div>
                <SegmentedControl
                  options={[
                    { ...closeActionOptions[0], label: t('settings.close_action_quit') },
                    { ...closeActionOptions[1], label: t('settings.close_action_menubar') },
                  ]}
                  value={closeAction}
                  onChange={(value) => void saveAppRuntimeSettings(launchAtLogin, value)}
                />
                <div className="font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]" style={bodyTextStyle}>
                  {isSavingAppRuntimeSettings
                    ? t('settings.app_lifecycle_saving')
                    : closeAction === 'keep_service_in_menu_bar'
                      ? t('settings.close_action_menubar_hint')
                      : t('settings.close_action_quit_hint')}
                </div>
                <div className="grid gap-3 border-t border-dashed border-[var(--border-color)] pt-3 sm:grid-cols-2">
                  <div className="border border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
                    <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                      {t('settings.menu_bar_resident')}
                    </div>
                    <div className="mt-1 font-black uppercase italic text-[var(--text-primary)]" style={valueTextStyle}>
                      {menuBarResident ? t('settings.enabled') : t('settings.disabled')}
                    </div>
                  </div>
                  <div className="border border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
                    <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                      {t('settings.service_on_close')}
                    </div>
                    <div className="mt-1 font-black uppercase italic text-[var(--text-primary)]" style={valueTextStyle}>
                      {closeAction === 'keep_service_in_menu_bar'
                        ? t('settings.service_on_close_keep')
                        : t('settings.service_on_close_stop')}
                    </div>
                  </div>
                </div>
                {appRuntimeMessage ? (
                  <div
                    className="border border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]"
                    style={bodyTextStyle}
                  >
                    {appRuntimeMessage}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section ref={(element) => setSectionRef('local_usage_refresh', element)} className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono font-black uppercase text-[var(--bg-main)]"
                style={sectionBadgeStyle}
              >
                {getSettingsSectionBadge('local_usage_refresh')}
              </span>
              <h3 className="font-black uppercase italic tracking-tighter text-[var(--text-primary)]" style={sectionTitleStyle}>
                {t('settings.local_usage_refresh')}
              </h3>
            </div>

            <div className="card-swiss !p-0 divide-y-2 divide-[var(--border-color)]">
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="font-black uppercase italic tracking-widest text-[var(--text-muted)]" style={fieldLabelStyle}>
                    {t('settings.local_usage_refresh_interval')}
                  </label>
                  <span className="font-mono font-bold italic opacity-30 text-[var(--text-muted)]" style={fieldMetaStyle}>
                    LOCAL_PROJECTED_USAGE
                  </span>
                </div>
                <SegmentedControl
                  options={localProjectedUsageRefreshIntervalOptions}
                  value={localUsageInterval}
                  onChange={(value) => void handleLocalUsageIntervalChange(value)}
                />
                <div className="font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]" style={bodyTextStyle}>
                  {isLoadingLocalUsageSettings
                    ? t('settings.local_usage_refresh_loading')
                    : isSavingLocalUsageSettings
                      ? t('settings.local_usage_refresh_saving')
                      : t('settings.local_usage_refresh_hint')}
                </div>
                {localUsageMessage ? (
                  <div
                    className="border border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]"
                    style={bodyTextStyle}
                  >
                    {localUsageMessage}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section ref={(element) => setSectionRef('network_proxy', element)} className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono font-black uppercase text-[var(--bg-main)]"
                style={sectionBadgeStyle}
              >
                {getSettingsSectionBadge('network_proxy')}
              </span>
              <h3 className="font-black uppercase italic tracking-tighter text-[var(--text-primary)]" style={sectionTitleStyle}>
                {t('settings.network_proxy')}
              </h3>
            </div>

            <div className="card-swiss !p-0 divide-y-2 divide-[var(--border-color)]">
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <label className="font-black uppercase italic tracking-widest text-[var(--text-muted)]" style={fieldLabelStyle}>
                      {t('settings.system_proxy')}
                    </label>
                    <div className="mt-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]" style={bodyTextStyle}>
                      {isLoadingSidecarProxySettings
                        ? t('settings.system_proxy_loading')
                        : isSavingSidecarProxySettings
                          ? t('settings.system_proxy_saving')
                          : t('settings.system_proxy_hint')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold italic opacity-30 text-[var(--text-muted)]" style={fieldMetaStyle}>
                      SIDECAR_SYSTEM_PROXY
                    </span>
                    <ToggleSwitch
                      label={t('settings.system_proxy')}
                      checked={useSystemProxy}
                      disabled={isLoadingSidecarProxySettings || isSavingSidecarProxySettings}
                      onChange={(checked) => void handleUseSystemProxyChange(checked)}
                    />
                  </div>
                </div>
                {sidecarProxyConfigPath ? (
                  <div className="break-all font-mono font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                    {sidecarProxyConfigPath}
                  </div>
                ) : null}
                {sidecarProxyMessage ? (
                  <div
                    className="border border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]"
                    style={bodyTextStyle}
                  >
                    {sidecarProxyMessage}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section ref={(element) => setSectionRef('updates', element)} className="space-y-3 opacity-80">
            <div className="flex items-center gap-2">
              <span
                className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono font-black uppercase text-[var(--bg-main)]"
                style={sectionBadgeStyle}
              >
                {getSettingsSectionBadge('updates')}
              </span>
              <h3 className="font-black uppercase italic tracking-tighter text-[var(--text-primary)]" style={sectionTitleStyle}>
                {t('settings.updates')}
              </h3>
            </div>

            <div className="card-swiss bg-[var(--bg-surface)] !p-5">
              <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                        {t('settings.current_version')}
                      </div>
                      <div className="font-black uppercase italic text-[var(--text-primary)]" style={valueTextStyle}>
                        {currentVersionLabel}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                        {t('settings.release_label')}
                      </div>
                      <div className="font-black uppercase italic text-[var(--text-primary)]" style={valueTextStyle}>
                        {releaseLabel || 'DEV'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-dashed border-[var(--border-color)] pt-4">
                    <div className="space-y-1">
                      <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                        {t('settings.latest_release')}
                      </div>
                      <div className="font-black uppercase italic text-[var(--text-primary)]" style={valueTextStyle}>
                        {latestReleaseLabel}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                        {t('settings.update_asset')}
                      </div>
                      <div className="font-mono font-bold text-[var(--text-primary)]" style={bodyTextStyle}>
                        {availableRelease?.assetName || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-[var(--border-color)] pt-4">
                    <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                      {t('settings.update_channel')}
                    </div>
                    <div className="mt-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]" style={valueTextStyle}>
                      {t(
                        usesNativeUpdaterUI
                          ? 'settings.update_channel_hint_native'
                          : canApplyUpdate
                            ? 'settings.update_channel_hint_auto'
                            : 'settings.update_channel_hint_manual'
                      )}
                    </div>
                    {updateMessage ? (
                      <div
                        className="mt-3 border border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]"
                        style={bodyTextStyle}
                      >
                        {updateMessage}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 border-t border-dashed border-[var(--border-color)] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                  <button className="btn-swiss w-full" onClick={handleCheckUpdate} disabled={isCheckingUpdate}>
                    {isCheckingUpdate ? t('settings.checking_update') : t('settings.check_update')}
                  </button>
                  {usesNativeUpdaterUI ? null : (
                    <button
                      className="btn-swiss w-full"
                      onClick={canApplyUpdate ? handleApplyUpdate : handleOpenReleasePage}
                      disabled={!availableRelease || isApplyingUpdate || isOpeningRelease}
                    >
                      {canApplyUpdate
                        ? isApplyingUpdate
                          ? t('settings.applying_update')
                          : t('settings.apply_update')
                        : isOpeningRelease
                          ? t('settings.opening_release_page')
                          : t('settings.open_release_page')}
                    </button>
                  )}
                  <div className="font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
                    {t(
                      usesNativeUpdaterUI
                        ? 'settings.native_update_hint'
                        : canApplyUpdate
                          ? 'settings.apply_update_hint'
                          : 'settings.manual_update_hint'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
