import { useEffect, useState } from 'react';
import {
  ApplyUpdate,
  CheckUpdate,
  GetLocalProjectedUsageSettings,
  UpdateLocalProjectedUsageSettings,
} from '../../../wailsjs/go/main/App';
import { BrowserOpenURL, Quit } from '../../../wailsjs/runtime/runtime';
import SegmentedControl from '../../components/ui/SegmentedControl';
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
import { toErrorMessage } from '../../utils/error';
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
  const currentVersionLabel = formatAppVersion(version);
  const latestReleaseLabel = availableRelease ? formatAppVersion(availableRelease.version) : '—';
  const textScaleOptions: ReadonlyArray<SegmentedOption<typeof textScale>> = [
    { id: 'default', label: t('settings.text_scale_default') },
    { id: 'large', label: t('settings.text_scale_large') },
    { id: 'x-large', label: t('settings.text_scale_x_large') },
  ];

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

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_SETTINGS">
      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <header className="border-b-2 border-[var(--border-color)] pb-3">
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
            {t('settings.title')}
          </h2>
          <p className="mt-0.5 font-bold uppercase tracking-widest text-[var(--text-muted)]" style={bodyTextStyle}>
            {t('settings.subtitle')}
          </p>
        </header>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono font-black uppercase text-[var(--bg-main)]"
                style={sectionBadgeStyle}
              >
                01
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

          <section className="space-y-3 opacity-80">
            <div className="flex items-center gap-2">
              <span
                className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono font-black uppercase text-[var(--bg-main)]"
                style={sectionBadgeStyle}
              >
                02
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

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono font-black uppercase text-[var(--bg-main)]"
                style={sectionBadgeStyle}
              >
                03
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
        </div>
      </div>
    </div>
  );
}
